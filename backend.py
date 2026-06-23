import math
from pathlib import Path

import pandas as pd

WORKBOOK_PATH = Path("Mock-Up Data - new.xlsx")
SHEET1_INDEX = 0
SHEET2_NAME = "Demo Dataset v3"

COMPONENT_WEIGHTS = {
    "driftSeverity": 0.50,
    "persistence": 0.25,
    "velocity": 0.10,
    "moneyImpact": 0.10,
    "concentration": 0.05,
}

VELOCITY_CRITICAL_PCT = 5.0
PERSISTENCE_DAY_CAP = 30.0

MONEY_BANDS = (
    (0, 25_000, 0.0, 0.25),
    (25_000, 100_000, 0.26, 0.50),
    (100_000, 500_000, 0.51, 0.75),
    (500_000, float("inf"), 0.76, 1.0),
)

CONCENTRATION_BANDS = (
    (0, 40, 0.0, 0.25),
    (40, 60, 0.26, 0.50),
    (60, 80, 0.51, 0.75),
    (80, 100, 0.76, 1.0),
)


def load_sheet(path: Path, sheet: str | int) -> pd.DataFrame:
    xls = pd.ExcelFile(path)
    sheet_label = xls.sheet_names[sheet] if isinstance(sheet, int) else sheet
    df = pd.read_excel(xls, sheet, header=None)
    print(f"Loaded sheet: {sheet_label}, shape={df.shape}")
    return df


def normalize_number(value):
    if pd.isna(value):
        return None
    if isinstance(value, str):
        value = value.strip()
        if value == "":
            return None
        value = value.replace("%", "").replace("$", "").replace(",", "")
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def get_string(profile: pd.Series, key: str) -> str | None:
    value = profile.get(key)
    if pd.isna(value):
        return None
    return str(value).strip()


def get_numeric(profile: pd.Series, key: str) -> float | None:
    return normalize_number(profile.get(key))


def parse_thresholds(sheet2: pd.DataFrame) -> list[dict]:
    thresholds = []
    for row_index in range(2, 8):
        row = sheet2.iloc[row_index]
        portfolio_type = row[6]
        watch = row[7]
        critical = row[8]
        risk_level = row[9]
        if pd.isna(portfolio_type) or pd.isna(watch) or pd.isna(critical):
            continue
        thresholds.append({
            "Portfolio Type": str(portfolio_type).strip(),
            "Watch Threshold (%)": float(watch),
            "Critical Threshold (%)": float(critical),
            "Risk Level": str(risk_level).strip() if not pd.isna(risk_level) else None,
        })
    print("Parsed portfolio-type thresholds:")
    for item in thresholds:
        print(
            f"  - {item['Portfolio Type']}: watch={item['Watch Threshold (%)']}%, "
            f"critical={item['Critical Threshold (%)']}%, risk={item['Risk Level']}"
        )
    return thresholds


def build_threshold_lookup(thresholds: list[dict]) -> dict[str, dict]:
    lookup = {item["Portfolio Type"]: item for item in thresholds}
    lookup["High-Net-Worth"] = lookup.get(
        "High-Net-Worth (Complex Portfolio)",
        {
            "Watch Threshold (%)": 7.0,
            "Critical Threshold (%)": 12.0,
            "Risk Level": "Medium",
        },
    )
    return lookup


def parse_sheet1_clients(sheet1: pd.DataFrame) -> pd.DataFrame:
    header_row_index = 8
    headers = sheet1.iloc[header_row_index].tolist()
    profile_rows = sheet1.iloc[header_row_index + 1 :].copy()
    profile_rows.columns = headers
    profile_rows = profile_rows[profile_rows["Name"].notna()].copy()
    profile_rows["Name"] = profile_rows["Name"].astype(str).str.strip()
    print(f"Parsed {len(profile_rows)} scoring rows from sheet 1.")
    return profile_rows


def parse_sheet2_profiles(sheet2: pd.DataFrame) -> pd.DataFrame:
    header_row_index = 9
    headers = sheet2.iloc[header_row_index].tolist()
    profile_rows = sheet2.iloc[header_row_index + 1 :].copy()
    profile_rows.columns = headers
    profile_rows = profile_rows[profile_rows["Name"].notna()].copy()
    profile_rows["Name"] = profile_rows["Name"].astype(str).str.strip()
    print(f"Parsed {len(profile_rows)} enrichment rows from sheet 2.")
    return profile_rows


def band_interp(value: float | None, bands: tuple[tuple[float, float, float, float], ...]) -> float:
    if value is None:
        return 0.0
    for lo_edge, hi_edge, score_lo, score_hi in bands:
        if value <= hi_edge:
            span = hi_edge - lo_edge
            if span <= 0:
                return score_hi
            frac = max(0.0, min(1.0, (value - lo_edge) / span))
            return score_lo + frac * (score_hi - score_lo)
    return bands[-1][3]


def score_drift_severity(drift_percent: float | None, critical_threshold: float) -> float:
    if drift_percent is None or critical_threshold <= 0:
        return 0.0
    return min(1.0, abs(drift_percent) / critical_threshold)


def score_persistence(days: float | None) -> float:
    if days is None:
        return 0.0
    return min(1.0, days / PERSISTENCE_DAY_CAP)


def score_velocity(velocity_percent: float | None) -> float:
    if velocity_percent is None:
        return 0.0
    return min(1.0, velocity_percent / VELOCITY_CRITICAL_PCT)


def resolve_dollar_drift(
    enrichment: pd.Series,
    drift_percent: float | None,
) -> float | None:
    dollar_drift = get_numeric(enrichment, "Dollar Drift Estimate")
    if dollar_drift is not None:
        return dollar_drift

    portfolio_value = get_numeric(enrichment, "Portfolio Value")
    turnover_drift = get_numeric(enrichment, "Turnover Drift %")
    if portfolio_value is not None and turnover_drift is not None:
        return portfolio_value * turnover_drift / 100.0

    if portfolio_value is not None and drift_percent is not None:
        return portfolio_value * abs(drift_percent) / 100.0

    return None


def score_money_impact(dollar_drift: float | None) -> float:
    return band_interp(dollar_drift, MONEY_BANDS)


def score_concentration(concentration_percent: float | None) -> float:
    return band_interp(concentration_percent, CONCENTRATION_BANDS)


def compute_priority_score(component_scores: dict[str, float]) -> float:
    total = sum(
        component_scores[key] * weight
        for key, weight in COMPONENT_WEIGHTS.items()
    )
    return round(total * 100, 1)


def classify_from_score(priority_score: float) -> str:
    if priority_score < 40:
        return "Normal"
    if priority_score < 60:
        return "Watch"
    if priority_score < 80:
        return "Review Soon"
    return "Critical"


def compute_profile(
    scoring_row: pd.Series,
    enrichment: pd.Series | None,
    threshold_lookup: dict[str, dict],
) -> dict:
    portfolio_type = get_string(scoring_row, "Portfolio Type") or "Unknown"
    drift_percent = get_numeric(scoring_row, "Portfolio Drift %")
    days_outside = get_numeric(scoring_row, "Days Outside Threshold")
    drift_velocity = get_numeric(scoring_row, "Drift Velocity %")
    concentration_percent = get_numeric(scoring_row, "Concentration %")

    threshold = threshold_lookup.get(portfolio_type, {})
    watch_threshold = threshold.get("Watch Threshold (%)", 0.0)
    critical_threshold = threshold.get("Critical Threshold (%)", 12.0)
    risk_level = threshold.get("Risk Level")

    enrichment = enrichment if enrichment is not None else pd.Series(dtype=object)
    dollar_drift = resolve_dollar_drift(enrichment, drift_percent)

    component_scores = {
        "driftSeverity": score_drift_severity(drift_percent, critical_threshold),
        "persistence": score_persistence(days_outside),
        "velocity": score_velocity(drift_velocity),
        "moneyImpact": score_money_impact(dollar_drift),
        "concentration": score_concentration(concentration_percent),
    }
    priority_score = compute_priority_score(component_scores)
    classification = classify_from_score(priority_score)

    return {
        "source": get_string(enrichment, "Source"),
        "clientName": get_string(scoring_row, "Name") or "Unknown",
        "portfolioType": portfolio_type,
        "dob": get_string(enrichment, "DOB"),
        "identifier": get_string(enrichment, "Client ID") or get_string(enrichment, "Identifier") or "Unknown",
        "portfolioValue": get_numeric(enrichment, "Portfolio Value"),
        "initialInvestment": get_numeric(enrichment, "Initial Investment"),
        "equityPercent": get_numeric(enrichment, "Current Equity %") or get_numeric(enrichment, "Equity %"),
        "fixedIncomePercent": get_numeric(enrichment, "Current Fixed Income %") or get_numeric(enrichment, "Fixed Income %"),
        "cashPercent": get_numeric(enrichment, "Current Cash %") or get_numeric(enrichment, "Cash %"),
        "alternativesPercent": get_numeric(enrichment, "Current Alternatives %") or get_numeric(enrichment, "Alternatives %"),
        "portfolioDriftPercent": drift_percent,
        "riskProfile": get_string(enrichment, "Risk Profile") or "Unknown",
        "financialGoal": get_string(enrichment, "Financial Goal") or "",
        "equityDriftPercent": get_numeric(enrichment, "Signed Equity Drift %") or get_numeric(enrichment, "Equity Drift %"),
        "fixedIncomeDriftPercent": get_numeric(enrichment, "Signed Fixed Income Drift %") or get_numeric(enrichment, "Fixed Income Drift %"),
        "cashDriftPercent": get_numeric(enrichment, "Signed Cash Drift %") or get_numeric(enrichment, "Cash Drift %"),
        "alternativesDriftPercent": get_numeric(enrichment, "Signed Alternatives Drift %") or get_numeric(enrichment, "Alternatives Drift %"),
        "daysOutsideThreshold": days_outside,
        "previousDriftPercent": get_numeric(enrichment, "Previous Drift %"),
        "driftVelocityPercent": drift_velocity,
        "triggerCondition": get_string(enrichment, "Trigger Condition") or "",
        "concentrationPercent": concentration_percent,
        "dollarDriftEstimate": dollar_drift,
        "watchThreshold": watch_threshold,
        "criticalThreshold": critical_threshold,
        "riskLevel": risk_level,
        "componentScores": component_scores,
        "priorityScore": priority_score,
        "classification": classification,
    }


def print_profile(profile: dict, index: int) -> None:
    scores = profile["componentScores"]
    print(f"--- Profile {index + 1}: {profile['clientName']} ({profile['identifier']}) ---")
    print(f"  Portfolio Type: {profile['portfolioType']}")
    print(f"  Drift: {profile['portfolioDriftPercent']}%")
    print(
        f"  Components: drift={scores['driftSeverity']:.2f}, "
        f"persist={scores['persistence']:.2f}, velocity={scores['velocity']:.2f}, "
        f"money={scores['moneyImpact']:.2f}, conc={scores['concentration']:.2f}"
    )
    print(f"  Priority Score: {profile['priorityScore']:.1f}")
    print(f"  Classification: {profile['classification']}")


def export_profiles(results: list[dict], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(results).to_json(output_path, orient="records", indent=2, force_ascii=False)
    print(f"Exported {len(results)} computed profiles to {output_path}")


def main() -> None:
    sheet1 = load_sheet(WORKBOOK_PATH, SHEET1_INDEX)
    sheet2 = load_sheet(WORKBOOK_PATH, SHEET2_NAME)

    thresholds = parse_thresholds(sheet2)
    threshold_lookup = build_threshold_lookup(thresholds)
    scoring_rows = parse_sheet1_clients(sheet1)
    enrichment_rows = parse_sheet2_profiles(sheet2)
    enrichment_by_name = enrichment_rows.set_index("Name")

    results = []
    for index, scoring_row in scoring_rows.iterrows():
        name = scoring_row["Name"]
        enrichment = enrichment_by_name.loc[name] if name in enrichment_by_name.index else None
        if enrichment is not None and isinstance(enrichment, pd.DataFrame):
            enrichment = enrichment.iloc[0]
        result = compute_profile(scoring_row, enrichment, threshold_lookup)
        results.append(result)
        print_profile(result, len(results) - 1)

    counts: dict[str, int] = {}
    for item in results:
        tag = item["classification"]
        counts[tag] = counts.get(tag, 0) + 1

    print("\nSummary:")
    for status in ("Normal", "Watch", "Review Soon", "Critical"):
        print(f"  {status}: {counts.get(status, 0)}")

    export_profiles(results, Path("src/profiles.json"))


if __name__ == "__main__":
    main()
