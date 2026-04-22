import re
import json
import pandas as pd
from pathlib import Path

_JSON_PATH = Path(__file__).parent.parent.parent / "us_city_zipcode" / "USCities.json"

# ── Lookup table (built once on first call) ───────────────────────────────────
# Structure: { zip_int: [(city_lower, state_lower), ...] }
_LOOKUP: dict | None = None


def _get_lookup() -> dict:
    global _LOOKUP
    if _LOOKUP is None:
        with open(_JSON_PATH, encoding="utf-8") as f:
            data = json.load(f)
        lookup: dict = {}
        for entry in data:
            z = entry.get("zip_code")
            c = (entry.get("city") or "").strip().lower()
            s = (entry.get("state") or "").strip().lower()
            if z is not None:
                lookup.setdefault(int(z), []).append((c, s))
        _LOOKUP = lookup
    return _LOOKUP


def _extract_zip_int(value) -> int | None:
    """
    Normalise a postal code cell to an integer for lookup.
    Handles:
        "00501"   → 501
        "90249"   → 90249
        "90249-1234" → 90249  (ZIP+4 format)
        90249     → 90249     (already numeric)
    """
    if pd.isna(value):
        return None
    digits = re.sub(r"\D", "", str(value))
    if not digits:
        return None
    # Take first 5 digits to strip any ZIP+4 suffix
    return int(digits[:5])


# ── Main module function ──────────────────────────────────────────────────────

def check_city_state_postal(
    df: pd.DataFrame,
    postal_col: str,
    state_col: str,
    city_col: str,
) -> tuple:
    """
    Looks up the postal code in USCities.json and checks whether the
    'Office State' and 'Office City' columns match the JSON data.

    Both city and state must match (case-insensitive) for a row to be TRUE.

    Output column: comments_city_state_match_postal_code
    Values:
        True  — zip found AND city AND state both match
        False — zip not found, or city/state mismatch, or blank postal code
    """
    for col in (postal_col, state_col, city_col):
        if col not in df.columns:
            return df, {"status": "error", "message": f"Column '{col}' not found"}

    lookup  = _get_lookup()
    new_col = "comments_city_state_match_postal_code"
    results = []

    for _, row in df.iterrows():
        zip_int = _extract_zip_int(row.get(postal_col))

        if zip_int is None:
            results.append(False)
            continue

        entries = lookup.get(zip_int)
        if not entries:
            results.append(False)
            continue

        row_state = str(row.get(state_col) or "").strip().lower()
        row_city  = str(row.get(city_col)  or "").strip().lower()

        matched = any(
            city == row_city and state == row_state
            for city, state in entries
        )
        results.append(matched)

    # Insert immediately after the postal code column
    idx = df.columns.get_loc(postal_col) + 1
    df.insert(idx, new_col, results)

    true_count  = sum(results)
    false_count = len(results) - true_count

    return df, {
        "status":         "success",
        "column_created": new_col,
        "matched":        true_count,
        "not_matched":    false_count,
        "rows_processed": len(df),
    }
