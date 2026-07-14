"""Gemini-powered client report generation with file-based caching."""

from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv
from pydantic import BaseModel, Field, ValidationError

load_dotenv()

_BUNDLED_REPORTS_DIR = Path(__file__).resolve().parent.parent / "data" / "reports"
DEFAULT_MODEL = "gemini-3.1-flash-lite"


def _reports_dir() -> Path:
    """Cache directory — /tmp on Vercel (read-only deploy FS)."""
    if os.getenv("VERCEL"):
        path = Path(tempfile.gettempdir()) / "portfolio-drift" / "reports"
        path.mkdir(parents=True, exist_ok=True)
        return path
    return _BUNDLED_REPORTS_DIR


GEMINI_MODEL = os.getenv("GEMINI_MODEL", DEFAULT_MODEL)
MODEL_FALLBACKS = [
    m for m in dict.fromkeys([
        GEMINI_MODEL,
        DEFAULT_MODEL,
        "gemini-3.5-flash",
        "gemini-2.5-flash",
        "gemini-flash-latest",
    ]) if m
]
MAX_OUTPUT_TOKENS = 1000
REPORT_PROMPT_VERSION = "v3"

SYSTEM_PROMPT = """You are a senior wealth management advisor drafting a client portfolio advisory report for a relationship manager. Write in a professional, clear, institutional tone suitable for a private banking desk. Output JSON only.

Output schema (strict JSON, no markdown):
{
  "executiveSummary": "4-5 sentences (~100-120 words). Open with client name and alert status. Summarize portfolio drift, priority score, and whether intervention is warranted. Reference specific metrics (drift %, days outside threshold, dollar impact). End with a clear recommendation stance.",
  "situationAssessment": "2-3 sentences (~60-80 words). Describe current portfolio health vs. the client's risk profile, financial goal, and watch/critical thresholds. Note trend (velocity, persistence) if relevant.",
  "keyConcerns": ["3-5 bullets. Each 30-45 words. Cite exact numbers from the data. Explain WHY each issue matters to the client relationship and portfolio risk."],
  "riskDrivers": ["2-4 bullets. Identify which scoring components (drift severity, persistence, velocity, money impact, concentration) are driving the priority score and quantify their contribution."],
  "recommendedActions": ["3-5 prioritized action steps for the advisor. Each 25-40 words. Include sequencing (immediate vs. near-term), rebalancing targets, or monitoring cadence. Be specific and actionable."],
  "outlook": "2 sentences (~40-50 words). Contrast likely trajectory if no action is taken vs. if recommended steps are followed.",
  "urgencyLevel": "low" | "medium" | "high"
}

Rules:
- Use only provided data. Never invent holdings, trades, or numbers.
- Reference portfolio type, risk profile, financial goal, and trigger condition when present.
- Tie recommendations to watch/critical thresholds and component scores.
- Match urgencyLevel to classification (Critical=high, Review Soon=high, Watch=medium, Normal=low).
- Write as if preparing a formal advisor briefing, not a casual chat.
"""


class ClientAIReport(BaseModel):
    executiveSummary: str
    situationAssessment: str = ""
    keyConcerns: list[str] = Field(min_length=1, max_length=5)
    riskDrivers: list[str] = Field(default_factory=list, max_length=4)
    recommendedActions: list[str] = Field(min_length=1, max_length=5)
    outlook: str = ""
    urgencyLevel: Literal["low", "medium", "high"]


class CachedReport(BaseModel):
    dataHash: str
    report: ClientAIReport
    generatedAt: str


def _safe_filename(identifier: str) -> str:
    return re.sub(r"[^\w\-]", "_", identifier)


def _round_optional(value: Any, decimals: int = 2) -> Any:
    if value is None:
        return None
    if isinstance(value, float):
        return round(value, decimals)
    return value


def build_compact_snapshot(profile: dict, weights: dict[str, float]) -> dict:
    """Strip profile to essential fields for a token-efficient prompt."""
    scores = profile.get("componentScores") or {}
    snapshot: dict[str, Any] = {
        "clientName": profile.get("clientName"),
        "identifier": profile.get("identifier"),
        "portfolioType": profile.get("portfolioType"),
        "riskProfile": profile.get("riskProfile"),
        "financialGoal": profile.get("financialGoal") or None,
        "classification": profile.get("classification"),
        "priorityScore": _round_optional(profile.get("priorityScore"), 1),
        "componentScores": {k: _round_optional(scores.get(k)) for k in scores},
        "scoringWeights": {k: _round_optional(weights.get(k)) for k in weights},
        "portfolioDriftPct": _round_optional(profile.get("portfolioDriftPercent")),
        "previousDriftPct": _round_optional(profile.get("previousDriftPercent")),
        "daysOutsideThreshold": profile.get("daysOutsideThreshold"),
        "driftVelocityPct": _round_optional(profile.get("driftVelocityPercent")),
        "dollarDriftEstimate": _round_optional(profile.get("dollarDriftEstimate"), 0),
        "concentrationPct": _round_optional(profile.get("concentrationPercent")),
        "watchThresholdPct": _round_optional(profile.get("watchThreshold")),
        "criticalThresholdPct": _round_optional(profile.get("criticalThreshold")),
        "riskLevel": profile.get("riskLevel"),
        "portfolioValue": _round_optional(profile.get("portfolioValue"), 0),
        "allocation": {
            "equityPct": _round_optional(profile.get("equityPercent")),
            "fixedIncomePct": _round_optional(profile.get("fixedIncomePercent")),
            "cashPct": _round_optional(profile.get("cashPercent")),
            "alternativesPct": _round_optional(profile.get("alternativesPercent")),
        },
        "assetDrifts": {
            "equity": _round_optional(profile.get("equityDriftPercent")),
            "fixedIncome": _round_optional(profile.get("fixedIncomeDriftPercent")),
            "cash": _round_optional(profile.get("cashDriftPercent")),
            "alternatives": _round_optional(profile.get("alternativesDriftPercent")),
        },
        "triggerCondition": profile.get("triggerCondition") or None,
    }
    return {k: v for k, v in snapshot.items() if v is not None}


def compute_data_hash(profile: dict, weights: dict[str, float]) -> str:
    payload = {"version": REPORT_PROMPT_VERSION, **build_compact_snapshot(profile, weights)}
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode()).hexdigest()[:16]


def _cache_path(identifier: str) -> Path:
    return _reports_dir() / f"{_safe_filename(identifier)}.json"


def load_cached_report(identifier: str, data_hash: str) -> ClientAIReport | None:
    path = _cache_path(identifier)
    if not path.exists():
        return None
    try:
        with path.open(encoding="utf-8") as handle:
            cached = CachedReport.model_validate(json.load(handle))
        if cached.dataHash == data_hash:
            return cached.report
    except (json.JSONDecodeError, ValidationError):
        return None
    return None


def save_cached_report(
    identifier: str,
    data_hash: str,
    report: ClientAIReport,
) -> None:
    from datetime import datetime, timezone

    _reports_dir().mkdir(parents=True, exist_ok=True)
    cached = CachedReport(
        dataHash=data_hash,
        report=report,
        generatedAt=datetime.now(timezone.utc).isoformat(),
    )
    with _cache_path(identifier).open("w", encoding="utf-8") as handle:
        handle.write(cached.model_dump_json(indent=2))
        handle.write("\n")


def _parse_json_response(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned)


def _is_quota_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return "429" in message or "quota" in message or "resource exhausted" in message


def _call_gemini_with_model(snapshot: dict, model_name: str) -> ClientAIReport:
    import google.generativeai as genai

    model = genai.GenerativeModel(
        model_name,
        generation_config={
            "temperature": 0.3,
            "max_output_tokens": MAX_OUTPUT_TOKENS,
            "response_mime_type": "application/json",
        },
    )
    user_message = f"Client portfolio data:\n{json.dumps(snapshot, separators=(',', ':'))}"
    response = model.generate_content([SYSTEM_PROMPT, user_message])
    raw_text = response.text or ""
    parsed = _parse_json_response(raw_text)
    return ClientAIReport.model_validate(parsed)


def _fallback_report(snapshot: dict) -> ClientAIReport:
    """Rule-based report when Gemini quota is unavailable."""
    classification = snapshot.get("classification", "Normal")
    name = snapshot.get("clientName", "This client")
    drift = snapshot.get("portfolioDriftPct", 0)
    prev_drift = snapshot.get("previousDriftPct")
    priority = snapshot.get("priorityScore", 0)
    days_out = snapshot.get("daysOutsideThreshold")
    concentration = snapshot.get("concentrationPct")
    dollar_drift = snapshot.get("dollarDriftEstimate")
    goal = snapshot.get("financialGoal") or "their financial objectives"
    portfolio_type = snapshot.get("portfolioType", "target")
    watch = snapshot.get("watchThresholdPct")
    critical = snapshot.get("criticalThresholdPct")
    scores = snapshot.get("componentScores") or {}
    weights = snapshot.get("scoringWeights") or {}

    urgency_map = {
        "Critical": "high",
        "Review Soon": "high",
        "Watch": "medium",
        "Normal": "low",
    }
    urgency = urgency_map.get(classification, "medium")

    trend_note = ""
    if prev_drift is not None and drift is not None:
        direction = "widened" if abs(drift) > abs(prev_drift) else "narrowed"
        trend_note = f" Drift has {direction} from {prev_drift}% previously."

    concerns: list[str] = []
    if drift is not None:
        threshold_ref = f" (watch: {watch}%, critical: {critical}%)" if watch and critical else ""
        concerns.append(
            f"Portfolio drift stands at {drift}%{threshold_ref}, indicating the allocation has "
            f"moved away from the {portfolio_type} strategy targets and may require rebalancing review."
        )
    if days_out:
        concerns.append(
            f"The portfolio has remained outside acceptable drift thresholds for {days_out} consecutive days, "
            f"suggesting persistence rather than a short-term market fluctuation."
        )
    if concentration and concentration > 60:
        concerns.append(
            f"Position concentration at {concentration}% elevates idiosyncratic risk and contributes "
            f"to the elevated priority score under the concentration component."
        )
    if dollar_drift:
        concerns.append(
            f"Estimated dollar drift of ${dollar_drift:,.0f} represents meaningful notional exposure "
            f"that should be factored into rebalancing decisions and client communication."
        )
    if not concerns:
        concerns.append(
            "Portfolio metrics are within normal monitoring parameters; continued surveillance "
            "is appropriate with no immediate intervention required."
        )

    risk_drivers: list[str] = []
    for key, score in scores.items():
        weight = weights.get(key, 0)
        contribution = round(score * weight * 100, 1)
        if contribution >= 5:
            label = key.replace("Severity", " severity").replace("moneyImpact", "money impact")
            risk_drivers.append(
                f"{label.title()}: component score {score:.2f} contributes ~{contribution} points "
                f"to the priority score ({int(weight * 100)}% weight)."
            )
    if not risk_drivers:
        risk_drivers.append("No single component dominates; priority score reflects a balanced mix of factors.")

    actions: list[str] = []
    if classification in ("Critical", "Review Soon"):
        actions.append(
            "Immediate: Schedule a client review within 5 business days to discuss rebalancing "
            "options and confirm risk tolerance has not changed."
        )
        actions.append(
            "Near-term: Execute trades to reduce drift in the largest off-target asset class, "
            "prioritizing tax-efficient lot selection where applicable."
        )
    elif classification == "Watch":
        actions.append(
            "Monitor drift weekly over the next 30 days and prepare a pre-approved rebalancing "
            "plan if drift exceeds the watch threshold again."
        )
    else:
        actions.append(
            "Continue standard quarterly monitoring cadence; document that portfolio remains "
            "within policy guidelines at the next relationship review."
        )
    if concentration and concentration > 60:
        actions.append(
            "Evaluate position sizing and consider gradual diversification to bring concentration "
            "below 60% over the next two review cycles."
        )

    return ClientAIReport(
        executiveSummary=(
            f"{name} is currently classified as {classification} with a composite priority score of {priority}. "
            f"The portfolio shows {drift}% drift against its {portfolio_type} allocation framework.{trend_note} "
            f"Based on the available metrics, {'prompt advisor engagement is recommended' if classification != 'Normal' else 'the relationship remains in good standing with routine monitoring sufficient'}."
        ),
        situationAssessment=(
            f"Relative to the client's {snapshot.get('riskProfile', 'stated')} risk profile and goal of {goal}, "
            f"the portfolio {'requires active management attention' if classification != 'Normal' else 'appears aligned with policy'}. "
            f"Watch and critical thresholds are set at {watch}% and {critical}% respectively."
        ),
        keyConcerns=concerns[:5],
        riskDrivers=risk_drivers[:4],
        recommendedActions=actions[:5],
        outlook=(
            f"Without intervention, sustained drift may compound and increase rebalancing costs over time. "
            f"Following the recommended actions should restore alignment with your {portfolio_type} strategy within one to two review cycles."
        ),
        urgencyLevel=urgency,  # type: ignore[arg-type]
    )


def _call_gemini(snapshot: dict) -> ClientAIReport:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set. Add it to your .env file.")

    import google.generativeai as genai

    genai.configure(api_key=api_key)

    errors: list[str] = []
    for model_name in MODEL_FALLBACKS:
        try:
            return _call_gemini_with_model(snapshot, model_name)
        except Exception as exc:
            errors.append(f"{model_name}: {exc}")
            if not _is_quota_error(exc):
                raise

    # All models hit quota — use local fallback so the page still works
    return _fallback_report(snapshot)


def generate_client_report(
    profile: dict,
    weights: dict[str, float],
    *,
    force: bool = False,
) -> tuple[ClientAIReport, bool]:
    """
    Return (report, from_cache).
    Generates via Gemini on cache miss or when force=True.
    """
    identifier = profile.get("identifier") or "unknown"
    data_hash = compute_data_hash(profile, weights)

    if not force:
        cached = load_cached_report(identifier, data_hash)
        if cached is not None:
            return cached, True

    snapshot = build_compact_snapshot(profile, weights)
    report = _call_gemini(snapshot)
    save_cached_report(identifier, data_hash, report)
    return report, False
