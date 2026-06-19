import math
from pathlib import Path
import pandas as pd

WORKBOOK_PATH = Path("Mock-Up Data - Infosys Interns 2026.xlsx")

RISK_WEIGHTS = {
    "Low": 1.0,
    "Medium": 1.5,
    "High": 2.0,
}


def load_first_sheet(path: Path) -> pd.DataFrame:
    xls = pd.ExcelFile(path)
    first_sheet = xls.sheet_names[0]
    df = pd.read_excel(xls, first_sheet, header=None)
    print(f"Loaded sheet: {first_sheet}, shape={df.shape}")
    return df


def parse_thresholds(df: pd.DataFrame) -> list[dict]:
    thresholds = []
    # The first sheet includes threshold rows in rows 2..7 (0-based)
    for row_index in range(2, 8):
        row = df.iloc[row_index]
        portfolio_type = row[4]
        watch = row[5]
        critical = row[6]
        risk_level = row[7]
        if pd.isna(portfolio_type) or pd.isna(watch) or pd.isna(critical):
            continue
        thresholds.append({
            "Portfolio Type": str(portfolio_type).strip(),
            "Watch Threshold (%)": float(watch),
            "Critical Threshold (%)": float(critical),
            "Risk Level": str(risk_level).strip() if not pd.isna(risk_level) else None,
        })
    print("Parsed threshold rules:")
    for item in thresholds:
        print(f"  - {item['Portfolio Type']}: watch={item['Watch Threshold (%)']}%, critical={item['Critical Threshold (%)']}%, risk={item['Risk Level']}")
    return thresholds


def build_threshold_lookup(thresholds: list[dict]) -> dict[str, dict]:
    lookup = {}
    for item in thresholds:
        lookup[item["Portfolio Type"]] = item
    return lookup


def parse_profiles(df: pd.DataFrame) -> pd.DataFrame:
    header_row_index = 9
    headers = df.iloc[header_row_index].tolist()
    profile_rows = df.iloc[header_row_index + 1 :].copy()
    profile_rows.columns = headers
    profile_rows = profile_rows[profile_rows["Name"].notna()]
    print(f"Parsed {len(profile_rows)} profile rows from the first sheet.")
    return profile_rows


def normalize_number(value):
    if pd.isna(value):
        return None
    if isinstance(value, str):
        value = value.strip()
        if value == "":
            return None
        value = value.replace("%", "")
    try:
        return float(value)
    except Exception:
        return None


def get_string(profile: pd.Series, key: str) -> str | None:
    value = profile.get(key)
    if pd.isna(value):
        return None
    return str(value)


def get_numeric(profile: pd.Series, key: str) -> float | None:
    return normalize_number(profile.get(key))


def classify_profile(profile: pd.Series, threshold_lookup: dict[str, dict]) -> dict:
    portfolio_type = str(profile.get("Portfolio Type", "")).strip()
    drift_value = normalize_number(profile.get("Portfolio Drift %"))
    current_status = get_string(profile, "Alert Status") or "Unknown"
    risk_profile = get_string(profile, "Risk Profile") or "Unknown"

    threshold = threshold_lookup.get(portfolio_type)
    if threshold is None:
        threshold = {
            "Watch Threshold (%)": 0.0,
            "Critical Threshold (%)": 0.0,
            "Risk Level": None,
        }

    watch_threshold = threshold["Watch Threshold (%)"]
    critical_threshold = threshold["Critical Threshold (%)"]

    drift_abs = abs(drift_value) if drift_value is not None else math.nan
    if pd.isna(drift_abs):
        classification = "Unknown"
    elif drift_abs >= critical_threshold:
        classification = "Critical"
    elif drift_abs >= watch_threshold:
        classification = "Watch"
    else:
        classification = "Normal"

    risk_weight = RISK_WEIGHTS.get(risk_profile, 1.0)
    score = 0.0
    if not math.isnan(drift_abs):
        score = drift_abs * risk_weight
        if classification == "Watch":
            score += 5.0
        elif classification == "Critical":
            score += 10.0

    return {
        "source": get_string(profile, "Source"),
        "clientName": get_string(profile, "Name"),
        "portfolioType": portfolio_type,
        "dob": get_string(profile, "DOB"),
        "identifier": get_string(profile, "Identifier"),
        "portfolioValue": get_numeric(profile, "Portfolio Value"),
        "initialInvestment": get_numeric(profile, "Initial Investment"),
        "equityPercent": get_numeric(profile, "Equity %"),
        "fixedIncomePercent": get_numeric(profile, "Fixed Income %"),
        "cashPercent": get_numeric(profile, "Cash %"),
        "alternativesPercent": get_numeric(profile, "Alternatives %"),
        "portfolioDriftPercent": drift_value,
        "riskProfile": risk_profile,
        "excelAlertStatus": current_status,
        "financialGoal": get_string(profile, "Financial Goal"),
        "equityDriftPercent": get_numeric(profile, "Equity Drift %"),
        "fixedIncomeDriftPercent": get_numeric(profile, "Fixed Income Drift %"),
        "cashDriftPercent": get_numeric(profile, "Cash Drift %"),
        "alternativesDriftPercent": get_numeric(profile, "Alternatives Drift %"),
        "daysOutsideThreshold": get_numeric(profile, "Days Outside Threshold"),
        "previousDriftPercent": get_numeric(profile, "Previous Drift %"),
        "driftVelocityPercent": get_numeric(profile, "Drift Velocity %"),
        "triggerCondition": get_string(profile, "Trigger Condition"),
        "watchThreshold": watch_threshold,
        "criticalThreshold": critical_threshold,
        "riskLevel": threshold.get("Risk Level"),
        "classification": classification,
        "urgencyScore": score,
    }


def print_classification(profile_result: dict, index: int) -> None:
    print(f"--- Profile {index + 1}: {profile_result['clientName']} ({profile_result['identifier']}) ---")
    print(f"  Portfolio Type: {profile_result['portfolioType']}")
    print(f"  Drift: {profile_result['portfolioDriftPercent']}%")
    print(f"  Thresholds: watch={profile_result['watchThreshold']}%, critical={profile_result['criticalThreshold']}%")
    print(f"  Risk Profile: {profile_result['riskProfile']} / Risk Level: {profile_result['riskLevel']}")
    print(f"  Excel Alert Status: {profile_result['excelAlertStatus']}")
    print(f"  Computed Classification: {profile_result['classification']}")
    print(f"  Urgency Score: {profile_result['urgencyScore']:.2f}")


def export_profiles(results: list[dict], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(results).to_json(output_path, orient='records', indent=2, force_ascii=False)
    print(f"Exported {len(results)} computed profiles to {output_path}")


def main() -> None:
    df = load_first_sheet(WORKBOOK_PATH)
    thresholds = parse_thresholds(df)
    threshold_lookup = build_threshold_lookup(thresholds)
    profiles = parse_profiles(df)

    results = []
    for index, profile in profiles.iterrows():
        result = classify_profile(profile, threshold_lookup)
        results.append(result)
        print_classification(result, index)

    counts = {
        "Normal": sum(1 for item in results if item["classification"] == "Normal"),
        "Watch": sum(1 for item in results if item["classification"] == "Watch"),
        "Critical": sum(1 for item in results if item["classification"] == "Critical"),
        "Unknown": sum(1 for item in results if item["classification"] == "Unknown"),
    }
    print("\nSummary:")
    for status, count in counts.items():
        print(f"  {status}: {count}")

    export_profiles(results, Path('src/profiles.json'))


if __name__ == "__main__":
    main()
