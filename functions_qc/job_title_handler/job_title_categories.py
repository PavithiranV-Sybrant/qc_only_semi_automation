import pandas as pd
import re

_C_SUITE = {
    "ceo","coo","cfo","clo","cco","chro","cpo","cto","ciso",
    "cmo","cdo","cao","caio","cdto","cio","cxo","cbo","cso",
}


def _clean(text: str) -> str:
    return re.sub(r"[^a-z]", "", text)


def _categorize(title) -> str:
    if pd.isna(title):
        return ""

    t = str(title).lower()
    t_compact = _clean(t)
    words = set(re.findall(r"[a-z]+", t))

    if "founder" in t or "founder" in t_compact:
        return "Founder"
    if "owner" in t or "owner" in t_compact:
        return "Owner"
    if (
        "managing director" in t
        or "managingdirector" in t_compact
        or (
            ("president" in t or "president" in t_compact)
            and "vice president" not in t
            and "vicepresident" not in t_compact
        )
    ):
        return "Founder"
    if "director" in t or "director" in t_compact:
        return "Director"
    if "chief" in words or bool(words & _C_SUITE):
        return "C-Suite"
    if "vp" in words or "svp" in words or "evp" in words or "vice president" in t or "vicepresident" in t_compact:
        return "VP"
    if "head" in t or "head" in t_compact:
        return "Head"
    if "manager" in t or "manager" in t_compact:
        return "Manager"
    if "partner" in t or "partner" in t_compact:
        return "Partner"
    if "principal" in t or "principal" in t_compact:
        return "Principal"
    return ""


def categorize_job_titles(
    df: pd.DataFrame,
    job_title_col: str,
) -> tuple:
    if job_title_col not in df.columns:
        return df, {"status": "error", "message": f"Column '{job_title_col}' not found"}

    new_col = "comments_job_title_categories"
    values = df[job_title_col].apply(_categorize)

    idx = df.columns.get_loc(job_title_col) + 1
    df.insert(idx, new_col, values)

    counts = values.value_counts().to_dict()
    return df, {"status": "success", "column_created": new_col, "categories": counts}
