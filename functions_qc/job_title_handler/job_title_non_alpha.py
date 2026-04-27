import re
import pandas as pd

_ALLOWED = re.compile(r"^[A-Za-z\s\-'\.&/()]+$")


def check_job_title_non_alpha(
    df: pd.DataFrame,
    job_title_col: str | None,
) -> tuple:
    new_col = "comments_job_title_non_Alphabetical_charactor_appears"

    if not job_title_col or job_title_col not in df.columns:
        df[new_col] = False
        return df, {"status": "success", "column_created": new_col,
                    "flagged_count": 0, "rows_processed": len(df),
                    "note": "job title column not mapped"}

    def _has_non_alpha(val):
        if pd.isna(val) or not str(val).strip():
            return False
        return not bool(_ALLOWED.match(str(val).strip()))

    results = df[job_title_col].apply(_has_non_alpha)

    idx = df.columns.get_loc(job_title_col) + 1
    df.insert(idx, new_col, results)

    return df, {
        "status": "success",
        "column_created": new_col,
        "flagged_count": int(results.sum()),
        "rows_processed": len(df),
    }
