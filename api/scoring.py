"""Shared scoring logic for CLI ETL and FastAPI server."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

DEFAULT_WEIGHTS: dict[str, float] = {
    "driftSeverity": 0.50,
    "persistence": 0.25,
    "velocity": 0.10,
    "moneyImpact": 0.10,
    "concentration": 0.05,
}

WEIGHT_KEYS = tuple(DEFAULT_WEIGHTS.keys())
CLASSIFICATION_ORDER = ("Normal", "Watch", "Review Soon", "Critical")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
WEIGHTS_PATH = DATA_DIR / "weights.json"
PROFILES_PATH = DATA_DIR / "profiles.json"


def compute_priority_score(
    component_scores: dict[str, float],
    weights: dict[str, float] | None = None,
) -> float:
    active_weights = weights or DEFAULT_WEIGHTS
    total = sum(
        component_scores[key] * active_weights[key]
        for key in WEIGHT_KEYS
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


def apply_weights_to_profile(
    profile: dict,
    weights: dict[str, float],
) -> dict:
    updated = deepcopy(profile)
    component_scores = updated.get("componentScores") or {}
    priority_score = compute_priority_score(component_scores, weights)
    updated["priorityScore"] = priority_score
    updated["classification"] = classify_from_score(priority_score)
    return updated


def apply_weights_to_profiles(
    profiles: list[dict],
    weights: dict[str, float],
) -> list[dict]:
    return [apply_weights_to_profile(profile, weights) for profile in profiles]


def classification_counts(profiles: list[dict]) -> dict[str, int]:
    counts = {status: 0 for status in CLASSIFICATION_ORDER}
    for profile in profiles:
        classification = profile.get("classification", "Normal")
        counts[classification] = counts.get(classification, 0) + 1
    return counts


def load_weights() -> dict[str, float]:
    if not WEIGHTS_PATH.exists():
        save_weights(DEFAULT_WEIGHTS)
        return dict(DEFAULT_WEIGHTS)
    with WEIGHTS_PATH.open(encoding="utf-8") as handle:
        data = json.load(handle)
    return {key: float(data[key]) for key in WEIGHT_KEYS}


def save_weights(weights: dict[str, float]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with WEIGHTS_PATH.open("w", encoding="utf-8") as handle:
        json.dump(weights, handle, indent=2)
        handle.write("\n")


def load_profiles() -> list[dict]:
    if not PROFILES_PATH.exists():
        fallback = Path(__file__).resolve().parent.parent / "src" / "profiles.json"
        if fallback.exists():
            with fallback.open(encoding="utf-8") as handle:
                return json.load(handle)
        return []
    with PROFILES_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


def validate_weights(weights: dict[str, float]) -> None:
    missing = [key for key in WEIGHT_KEYS if key not in weights]
    if missing:
        raise ValueError(f"Missing weight keys: {', '.join(missing)}")

    for key in WEIGHT_KEYS:
        value = weights[key]
        if not isinstance(value, (int, float)):
            raise ValueError(f"Weight '{key}' must be a number")
        if value < 0 or value > 1:
            raise ValueError(f"Weight '{key}' must be between 0 and 1")

    total = sum(weights[key] for key in WEIGHT_KEYS)
    if abs(total - 1.0) > 0.01:
        raise ValueError(f"Weights must sum to 1.0 (got {total:.4f})")
