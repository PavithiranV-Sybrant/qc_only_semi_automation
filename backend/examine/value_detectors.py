"""Layer 2: Value pattern matching for columns not caught by header regex."""
import re

US_STATES = {
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN",
    "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV",
    "NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN",
    "TX","UT","VT","VA","WA","WV","WI","WY","DC",
}

_EMAIL_P   = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")
_PHONE_P   = re.compile(r"^[\d\-\(\)\+\s\.]{7,}$")
_URL_P     = re.compile(r"https?://|www\.", re.I)
_LI_P      = re.compile(r"linkedin\.com", re.I)
_FB_P      = re.compile(r"facebook\.com|fb\.com", re.I)
_SIC_P     = re.compile(r"^\d{4}$")
_ZIP_P     = re.compile(r"^\d{5}(-\d{4})?$")
_IP_P      = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")
_NONH_P    = re.compile(r"code|naic|sic|\bid\b|_id$|^id$|url|domain|ip\b|website|zip|postal|lat|lon|geo|coord|score|index|num$|number$", re.I)


def value_pattern_match(profiles: list, role_map: dict) -> dict:
    """Fill gaps in role_map using sample value patterns."""
    mapped_cols = _mapped_cols(role_map)
    phone_columns = list(role_map.get("phone_columns", []))

    for profile in profiles:
        if profile.header in mapped_cols:
            continue
        samples = [s for s in profile.sample_values if s and s.lower() not in ("nan","none","")]
        if not samples:
            continue

        role, conf = _detect(samples, profile.header)
        if not role or conf < 0.60:
            continue

        if role == "phone":
            if profile.header not in {p["column"] for p in phone_columns}:
                phone_columns.append({"column": profile.header, "confidence": conf, "layer": 2})
        elif role not in role_map:
            role_map[role] = {"column": profile.header, "confidence": conf, "layer": 2}

    if phone_columns:
        role_map["phone_columns"] = phone_columns

    return role_map


def _mapped_cols(role_map: dict) -> set:
    cols = set()
    for k, v in role_map.items():
        if k == "phone_columns" and isinstance(v, list):
            cols.update(p["column"] for p in v)
        elif isinstance(v, dict) and "column" in v:
            cols.add(v["column"])
    return cols


def _detect(samples: list, header: str) -> tuple:
    total = len(samples)

    email_hits = sum(1 for s in samples if _EMAIL_P.match(s.strip()))
    if email_hits / total >= 0.7:
        return "email", 0.85

    if not _NONH_P.search(header):
        phone_hits = sum(
            1 for s in samples
            if _PHONE_P.match(s.strip())
            and not _IP_P.match(s.strip())
            and not _SIC_P.match(s.strip())
        )
        if phone_hits / total >= 0.6:
            return "phone", 0.80

    fb_hits = sum(1 for s in samples if _FB_P.search(s))
    if fb_hits / total >= 0.5:
        return "facebook", 0.85

    li_hits = sum(1 for s in samples if _LI_P.search(s))
    if li_hits / total >= 0.5:
        return "linkedin", 0.85

    url_hits = sum(1 for s in samples if _URL_P.search(s))
    if url_hits / total >= 0.6:
        return "linkedin", 0.75

    state_hits = sum(1 for s in samples if s.strip().upper() in US_STATES)
    if state_hits / total >= 0.7:
        return "office_state", 0.85

    sic_hits = sum(1 for s in samples if _SIC_P.match(s.strip()))
    if sic_hits / total >= 0.6:
        return "sic_code", 0.80

    zip_hits = sum(1 for s in samples if _ZIP_P.match(s.strip()))
    if zip_hits / total >= 0.7:
        return "postal_code", 0.85

    return None, 0.0
