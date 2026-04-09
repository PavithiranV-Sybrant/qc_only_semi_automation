import pandas as pd
import re
from difflib import SequenceMatcher


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z]", "", str(text).lower())


def _fuzzy_match(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def verify_linkedin_profile_match(
    df: pd.DataFrame,
    first_name_col: str,
    middle_name_col: str,
    last_name_col: str,
    linkedin_col: str,
    threshold: float = 0.5,
) -> tuple:
    if linkedin_col not in df.columns:
        return df, {"status": "error", "message": f"Column '{linkedin_col}' not found"}

    new_col = "comments_linkedin_match"
    results = []
    matched = not_matched = invalid = 0

    for _, row in df.iterrows():
        first   = row.get(first_name_col)
        middle  = row.get(middle_name_col)
        last    = row.get(last_name_col)
        linkedin = row.get(linkedin_col)

        if pd.isna(linkedin) or not linkedin:
            results.append("invalid")
            invalid += 1
            continue

        li_str = str(linkedin).lower()
        match = re.search(r"linkedin\.com/in/([^/?]+)", li_str)
        if not match:
            results.append("invalid")
            invalid += 1
            continue

        slug_clean = _normalize(match.group(1))

        name_parts = [
            _normalize(first  or ""),
            _normalize(middle or ""),
            _normalize(last   or ""),
        ]
        name_parts = [n for n in name_parts if n]

        if not name_parts:
            results.append("invalid")
            invalid += 1
            continue

        match_flag = False
        for part in name_parts:
            if part in slug_clean:
                match_flag = True
                break
            if len(part) >= 3 and _fuzzy_match(part, slug_clean) >= threshold:
                match_flag = True
                break

        if match_flag:
            results.append("matched")
            matched += 1
        else:
            results.append("not matched")
            not_matched += 1

    idx = df.columns.get_loc(linkedin_col) + 1
    df.insert(idx, new_col, results)

    return df, {
        "status": "success",
        "column_created": new_col,
        "matched": matched,
        "not_matched": not_matched,
        "invalid": invalid,
        "threshold_used": threshold,
    }
