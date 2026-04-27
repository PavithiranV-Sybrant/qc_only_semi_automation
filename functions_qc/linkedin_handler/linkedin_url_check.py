import re
import pandas as pd

# Matches linkedin.com/in/<slug> (with optional trailing slash or query params)
_VALID_PATTERN = re.compile(
    r"^https?://(?:www\.)?linkedin\.com/in/[^/\s?#]+/?(?:[?#].*)?$",
    re.IGNORECASE,
)


def check_linkedin_url(
    df: pd.DataFrame,
    linkedin_col: str,
) -> tuple:
    if linkedin_col not in df.columns:
        return df, {"status": "error", "message": f"Column '{linkedin_col}' not found"}

    new_col = "comments_linkedin_url_valid_by_in"

    def _validate(val):
        if pd.isna(val) or not str(val).strip():
            return "invalid"
        url = str(val).strip()
        # If value has no scheme, prepend https:// for matching
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        return "valid" if _VALID_PATTERN.match(url) else "invalid"

    results = df[linkedin_col].apply(_validate)

    idx = df.columns.get_loc(linkedin_col) + 1
    df.insert(idx, new_col, results)

    return df, {
        "status": "success",
        "column_created": new_col,
        "valid_count": int((results == "valid").sum()),
        "invalid_count": int((results == "invalid").sum()),
        "rows_processed": len(df),
    }
