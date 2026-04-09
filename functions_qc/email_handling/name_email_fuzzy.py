import pandas as pd
import re
from fuzzywuzzy import fuzz


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z]", "", str(text).lower())


def name_email_fuzzy_match(
    df: pd.DataFrame,
    first_name_column: str,
    last_name_column: str,
    email_column: str,
    middle_name_column: str = None,
    threshold: int = 80,
) -> tuple:
    missing = [c for c in [first_name_column, last_name_column, email_column] if c not in df.columns]
    if missing:
        return df, {"status": "error", "message": f"Columns not found: {missing}"}

    new_col = "comments_fuzzy_email_name_match"
    results = []
    match_count = no_match_count = 0

    for _, row in df.iterrows():
        email = row[email_column]

        if not email or "@" not in str(email):
            results.append("no match")
            no_match_count += 1
            continue

        prefix_clean = _normalize(str(email).split("@")[0])
        if not prefix_clean:
            results.append("no match")
            no_match_count += 1
            continue

        first = _normalize(str(row[first_name_column] or ""))
        last = _normalize(str(row[last_name_column] or ""))
        middle = _normalize(str(row[middle_name_column] or "")) if middle_name_column and middle_name_column in df.columns else ""

        name_parts = [p for p in [first, middle, last] if p]

        if not name_parts:
            results.append("no match")
            no_match_count += 1
            continue

        # Existing fuzzy match on individual name parts
        matched = any(fuzz.partial_ratio(part, prefix_clean) >= threshold for part in name_parts)

        if not matched and first and last:
            # 1. First letter of first name + full last name  (e.g. "jsmith")
            pattern_1 = first[0] + last
            # 2. First letter of first name + first letter of last name  (e.g. "js")
            pattern_2 = first[0] + last[0]
            # 3. First letter of first name + first 2 letters of last name  (e.g. "jsm")
            pattern_3 = first[0] + last[:2]
            # 4a. first+middle+last without space  (e.g. "johnmdoe")
            pattern_4a = first + middle + last
            # 4b. first.middle.last with dots  (e.g. "john.m.doe")
            dot_parts = [p for p in [first, middle, last] if p]
            pattern_4b = ".".join(dot_parts)

            matched = any(p in prefix_clean or prefix_clean in p
                          for p in [pattern_1, pattern_2, pattern_3, pattern_4a, pattern_4b]
                          if p)

        results.append("match" if matched else "no match")
        if matched:
            match_count += 1
        else:
            no_match_count += 1

    idx = df.columns.get_loc(email_column) + 1
    df.insert(idx, new_col, results)

    return df, {
        "status": "success",
        "column_created": new_col,
        "matches": match_count,
        "non_matches": no_match_count,
        "threshold_used": threshold,
    }
