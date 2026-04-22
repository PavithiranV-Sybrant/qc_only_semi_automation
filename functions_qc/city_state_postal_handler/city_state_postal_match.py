import re
import pandas as pd
from uszipcode import SearchEngine

# Shared SearchEngine instance — initialised once, reused across all rows
_SEARCH: SearchEngine | None = None


def _get_search() -> SearchEngine:
    global _SEARCH
    if _SEARCH is None:
        _SEARCH = SearchEngine()
    return _SEARCH


def _format_zip(value) -> str | None:
    """
    Normalise a postal code cell to a zero-padded 5-digit string.
    Handles:
        "00501"      → "00501"
        501 (int)    → "00501"
        "90249"      → "90249"
        "90249-1234" → "90249"  (ZIP+4)
    """
    if pd.isna(value):
        return None
    digits = re.sub(r"\D", "", str(value))
    if not digits:
        return None
    return digits[:5].zfill(5)


# ── Main module function ──────────────────────────────────────────────────────

def check_city_state_postal(
    df: pd.DataFrame,
    postal_col: str,
    state_col: str,
    city_col: str,
) -> tuple:
    """
    Looks up each postal code via the uszipcode database and checks whether
    the Office State and Office City columns both match.

    Both city (major_city) and state must match case-insensitively for TRUE.

    Output column: comments_city_state_match_postal_code
    Values:
        True  — ZIP found AND city AND state both match
        False — ZIP not found, mismatch, or blank postal code
    """
    for col in (postal_col, state_col, city_col):
        if col not in df.columns:
            return df, {"status": "error", "message": f"Column '{col}' not found"}

    search  = _get_search()
    new_col = "comments_city_state_match_postal_code"
    results = []

    for _, row in df.iterrows():
        zip_str = _format_zip(row.get(postal_col))

        if not zip_str:
            results.append(False)
            continue

        record = search.by_zipcode(zip_str)

        if not record or not record.zipcode:
            results.append(False)
            continue

        db_city  = (record.major_city or "").strip().lower()
        db_state = (record.state      or "").strip().lower()

        row_city  = str(row.get(city_col)  or "").strip().lower()
        row_state = str(row.get(state_col) or "").strip().lower()

        results.append(db_city == row_city and db_state == row_state)

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
