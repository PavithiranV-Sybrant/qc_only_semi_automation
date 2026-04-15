import re
import pandas as pd
from difflib import SequenceMatcher

# ── Slug patterns that are NOT personal profile names ─────────────────────────
_SKIP_SLUGS = {"profile.php", "pages", "groups", "events", "watch", "marketplace",
               "gaming", "help", "login", "home", "share", "sharer"}


def _normalize(text: str) -> str:
    """Lowercase and strip all non-alpha characters."""
    return re.sub(r"[^a-z]", "", str(text).lower())


def _fuzzy(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def _extract_facebook_slug(url: str) -> str | None:
    """
    Extract the personal slug from a Facebook URL.
    Returns None for profile.php / non-name paths.

    Handles:
        https://www.facebook.com/john.smith       → "john.smith"
        https://m.facebook.com/john.smith         → "john.smith"
        https://fb.com/john.smith                 → "john.smith"
        https://www.facebook.com/profile.php?...  → None (numeric/opaque ID)
    """
    if pd.isna(url) or not url:
        return None
    url_str = str(url).strip()
    m = re.search(r"(?:facebook\.com|fb\.com)/([^/?#\s]+)", url_str, re.IGNORECASE)
    if not m:
        return None
    slug = m.group(1).lower()
    if slug in _SKIP_SLUGS or slug.startswith("profile.php"):
        return None
    return slug


def _match_name_in_text(name_parts: list, text: str, threshold: float) -> bool:
    """
    Check whether any name part appears in a free-text field.
    Splits the text into words and checks for substring containment or
    fuzzy match above threshold.
    """
    if not text or pd.isna(text):
        return False
    words = re.findall(r"[a-z]+", str(text).lower())
    for part in name_parts:
        if not part:
            continue
        # Direct substring match in the full lowercased text
        if part in str(text).lower():
            return True
        # Fuzzy match against each word in the text
        for w in words:
            if len(part) >= 3 and _fuzzy(part, w) >= threshold:
                return True
    return False


# ── Main module function ──────────────────────────────────────────────────────

def verify_facebook_profile_match(
    df: pd.DataFrame,
    first_name_col: str,
    last_name_col: str,
    middle_name_col: str = None,
    facebook_col: str = None,
    extra_cols: list = None,
    threshold: float = 0.5,
) -> tuple:
    """
    Fuzzy-matches the contact's name against:
      1. The personal slug extracted from the Facebook profile URL.
      2. Any extra text columns supplied (e.g. link_text1, description1).

    A row is labelled "matched" if ANY source produces a match.

    Output column: comments_facebook_match
    Labels:        matched | not matched | invalid

    Parameters
    ----------
    facebook_col : str | None
        Column containing the Facebook profile URL.
    extra_cols   : list[str] | None
        Additional text columns to match the name against
        (e.g. ["link_text1", "description1"]).
    threshold    : float
        Fuzzy similarity threshold (0–1, default 0.5).
    """
    extra_cols = [c for c in (extra_cols or []) if c and c in df.columns]
    fb_present = facebook_col and facebook_col in df.columns

    if not fb_present and not extra_cols:
        return df, {"status": "error",
                    "message": "No Facebook URL column or extra columns found in the file."}

    new_col = "comments_facebook_match"
    results = []
    matched = not_matched = invalid = 0

    for _, row in df.iterrows():
        fn = _normalize(row.get(first_name_col) or "")
        ln = _normalize(row.get(last_name_col)  or "")
        mn = _normalize(row.get(middle_name_col) or "") if middle_name_col else ""
        name_parts = [p for p in [fn, mn, ln] if p]

        if not name_parts:
            results.append("invalid")
            invalid += 1
            continue

        match_flag = False

        # ── 1. Facebook URL slug ──────────────────────────────────────────────
        if fb_present:
            slug = _extract_facebook_slug(row.get(facebook_col))
            if slug:
                slug_clean = _normalize(slug)
                for part in name_parts:
                    if part in slug_clean:
                        match_flag = True
                        break
                    if len(part) >= 3 and _fuzzy(part, slug_clean) >= threshold:
                        match_flag = True
                        break

        # ── 2. Extra text columns (link_text1, description1, …) ──────────────
        if not match_flag:
            for col in extra_cols:
                if _match_name_in_text(name_parts, row.get(col), threshold):
                    match_flag = True
                    break

        if match_flag:
            results.append("matched")
            matched += 1
        else:
            # Only "invalid" if Facebook URL was present but unparseable AND
            # no extra cols had any content either
            fb_val = row.get(facebook_col) if fb_present else None
            has_any_data = (fb_val and not pd.isna(fb_val)) or any(
                row.get(c) and not pd.isna(row.get(c)) for c in extra_cols
            )
            if has_any_data:
                results.append("not matched")
                not_matched += 1
            else:
                results.append("invalid")
                invalid += 1

    # Insert immediately after the Facebook URL column (or last extra col)
    anchor = facebook_col if fb_present else extra_cols[-1]
    idx = df.columns.get_loc(anchor) + 1
    df.insert(idx, new_col, results)

    return df, {
        "status":         "success",
        "column_created": new_col,
        "matched":        matched,
        "not_matched":    not_matched,
        "invalid":        invalid,
        "threshold_used": threshold,
        "sources_used":   (["facebook_url"] if fb_present else []) + extra_cols,
    }
