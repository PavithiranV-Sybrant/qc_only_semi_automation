import re
import pandas as pd

# Allowed characters: digits, M, B, K, $, >, <, -, space, dot, comma
# Examples of valid values: "$5M", "1B - 5B", "> $100M", "< $1B", "50-100M", "1,000"
_ALLOWED = re.compile(r"^[0-9MmBbKk$><\-\s.,]*$")


def _has_unusual_chars(value) -> bool:
    """Return True if the value contains characters outside the allowed set."""
    if pd.isna(value) or str(value).strip() == "":
        return False
    return not bool(_ALLOWED.match(str(value).strip()))


def check_company_revenue(df: pd.DataFrame, revenue_col: str) -> tuple:
    """
    Checks the Company Revenue column for characters outside the allowed set.

    Allowed characters: digits (0-9), M, B, K (case-insensitive),
    $, >, <, -, space, dot, comma.

    Output column: comments_company_revenue_unusual_charactors
    Values:        True  — unusual characters found
                   False — value is clean or blank
    """
    if revenue_col not in df.columns:
        return df, {"status": "error", "message": f"Column '{revenue_col}' not found"}

    new_col = "comments_company_revenue_unusual_charactors"
    values  = df[revenue_col].apply(_has_unusual_chars)

    idx = df.columns.get_loc(revenue_col) + 1
    df.insert(idx, new_col, values)

    true_count  = int(values.sum())
    false_count = len(values) - true_count

    return df, {
        "status":         "success",
        "column_created": new_col,
        "unusual_count":  true_count,
        "clean_count":    false_count,
        "rows_processed": len(df),
    }
