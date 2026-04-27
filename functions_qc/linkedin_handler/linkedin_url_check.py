import re
import pandas as pd

_VALID_PATTERN = re.compile(
    r"^https?://(?:www\.)?linkedin\.com/in/[^/\s?#]+/?(?:[?#].*)?$",
    re.IGNORECASE,
)


def check_linkedin_url(
    df: pd.DataFrame,
    linkedin_col: str | None,
) -> tuple:
    new_col = "comments_linkedin_url_valid_by_in"

    if not linkedin_col or linkedin_col not in df.columns:
        df[new_col] = "invalid"
        return df, {"status": "success", "column_created": new_col,
                    "valid_count": 0, "invalid_count": len(df), "rows_processed": len(df),
                    "note": "linkedin column not mapped"}

    def _validate(val):
        if pd.isna(val) or not str(val).strip():
            return "invalid"
        url = str(val).strip()
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
