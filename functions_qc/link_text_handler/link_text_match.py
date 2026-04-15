import re

import pandas as pd
from rapidfuzz import fuzz


# =====================================================
# Helpers
# =====================================================

def _split_words(text) -> list:
    """Lowercase and split on any non-alpha character; return non-empty tokens."""
    if pd.isna(text) or text is None:
        return []
    words = re.split(r'[^a-zA-Z]+', str(text).lower())
    return [w for w in words if w]


def _exact_match(source_words: list, target_words: list) -> str:
    target_set = set(target_words)
    match_count = sum(1 for w in source_words if w in target_set)
    total = len(source_words)
    if total == 0:
        return "Not_match"
    ratio = match_count / total
    if ratio == 1:
        return "Matched"
    if ratio >= 0.75:
        return "Most_matched"
    if match_count > 0:
        return "Partial_match"
    return "Not_match"


def _fuzzy_match(source_words: list, target_words: list, threshold: int) -> str:
    match_count = 0
    for sw in source_words:
        for tw in target_words:
            if fuzz.ratio(sw, tw) >= threshold:
                match_count += 1
                break
    total = len(source_words)
    if total == 0:
        return "Not_match"
    ratio = match_count / total
    if ratio == 1:
        return "Matched"
    if ratio >= 0.75:
        return "Most_matched"
    if match_count > 0:
        return "Partial_match"
    return "Not_match"


# =====================================================
# Main module function
# =====================================================

def match_link_text_fields(
    df: pd.DataFrame,
    company_col: str,
    link_text_col: str,
    description_col: str,
    full_name_col: str = None,
    first_name_col: str = None,
    last_name_col: str = None,
    middle_name_col: str = None,
    fuzzy_threshold: int = 85,
) -> tuple:
    """
    Appends 6 comment columns:

      comments_name_link_exact      — exact word match: full name vs link text
      comments_name_link_fuzzy      — fuzzy word match: full name vs link text
      comments_company_link_exact   — exact word match: company vs link text
      comments_company_link_fuzzy   — fuzzy word match: company vs link text
      comments_company_desc_exact   — exact word match: company vs description
      comments_company_desc_fuzzy   — fuzzy word match: company vs description

    Match labels: Matched | Most_matched | Partial_match | Not_match
    """
    new_cols = [
        "comments_name_link_exact",
        "comments_name_link_fuzzy",
        "comments_company_link_exact",
        "comments_company_link_fuzzy",
        "comments_company_desc_exact",
        "comments_company_desc_fuzzy",
    ]

    results = {col: [] for col in new_cols}

    use_full_name = full_name_col and full_name_col in df.columns

    for _, row in df.iterrows():
        if use_full_name:
            name_str = str(row.get(full_name_col, "") or "")
        else:
            fn = str(row.get(first_name_col, "") or "")
            ln = str(row.get(last_name_col, "") or "")
            mn = str(row.get(middle_name_col, "") or "") if middle_name_col else ""
            name_str = f"{fn} {mn} {ln}"

        name_words    = _split_words(name_str)
        company_words = _split_words(row.get(company_col))
        link_words    = _split_words(row.get(link_text_col))
        desc_words    = _split_words(row.get(description_col))

        results["comments_name_link_exact"].append(_exact_match(name_words, link_words))
        results["comments_name_link_fuzzy"].append(_fuzzy_match(name_words, link_words, fuzzy_threshold))
        results["comments_company_link_exact"].append(_exact_match(company_words, link_words))
        results["comments_company_link_fuzzy"].append(_fuzzy_match(company_words, link_words, fuzzy_threshold))
        results["comments_company_desc_exact"].append(_exact_match(company_words, desc_words))
        results["comments_company_desc_fuzzy"].append(_fuzzy_match(company_words, desc_words, fuzzy_threshold))

    for col in new_cols:
        df[col] = results[col]

    return df, {
        "status": "success",
        "columns_created": len(new_cols),
        "rows_processed": len(df),
        "fuzzy_threshold": fuzzy_threshold,
    }
