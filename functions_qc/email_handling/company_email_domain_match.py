import pandas as pd
import re

FREE_EMAIL_DOMAINS = {
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
    "aol.com", "icloud.com", "comcast.net", "cox.net",
    "att.net", "verizon.net", "sbcglobal.net", "live.com",
    "msn.com", "protonmail.com", "ymail.com", "me.com",
}

COMMON_SUFFIXES = {"inc", "ltd", "llc", "pvt", "limited", "corp", "corporation", "co", "company", "private"}
STOPWORDS = {"and", "with", "the", "of", "for", "group", "services", "solutions", "a", "an", "at", "by"}
MIN_TOKEN_LEN = 4


def _extract_full_domain(email):
    try:
        return str(email).lower().split("@")[1]
    except Exception:
        return ""


def _get_domain_name(full_domain):
    parts = full_domain.split(".")
    return parts[0] if parts else ""


def _get_tokens(company):
    words = re.findall(r"[a-z]+", str(company).lower())
    return [w for w in words if w not in COMMON_SUFFIXES and w not in STOPWORDS and len(w) >= MIN_TOKEN_LEN]


def _token_match(tokens, domain_name):
    return any(t in domain_name for t in tokens)


def _join_match(tokens, domain_name):
    if not tokens:
        return False
    return domain_name in "".join(tokens)


def _acronym_match(tokens, domain_name):
    acronym = "".join(w[0] for w in tokens if w)
    return len(acronym) >= 3 and acronym in domain_name


def _is_match(company, email):
    full_domain = _extract_full_domain(email)
    if full_domain in FREE_EMAIL_DOMAINS:
        return False
    domain_name = _get_domain_name(full_domain)
    tokens = _get_tokens(company)
    if not tokens or not domain_name:
        return False
    return _token_match(tokens, domain_name) or _join_match(tokens, domain_name) or _acronym_match(tokens, domain_name)


def company_email_domain_match(
    df: pd.DataFrame,
    company_column: str,
    email_column: str,
) -> tuple:
    if company_column not in df.columns or email_column not in df.columns:
        return df, {"status": "error", "message": "Invalid column names"}

    new_col = "comments_company_email_domain_match"
    results = []
    match_count = no_match_count = 0

    for _, row in df.iterrows():
        company = row[company_column]
        email = row[email_column]

        if not email or "@" not in str(email):
            results.append(None)
            no_match_count += 1
        elif not company or pd.isna(company):
            results.append("no match")
            no_match_count += 1
        elif _is_match(str(company), str(email)):
            results.append("match")
            match_count += 1
        else:
            results.append("no match")
            no_match_count += 1

    idx = df.columns.get_loc(email_column) + 1
    df.insert(idx, new_col, results)

    return df, {
        "status": "success",
        "column_created": new_col,
        "matches": match_count,
        "non_matches": no_match_count,
    }
