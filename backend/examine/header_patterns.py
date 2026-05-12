"""Layer 1: Header regex matching — fast, zero tokens."""
import re

PATTERNS = {
    "first_name":     (r"first.?name|fname|given.?name",              0.95),
    "last_name":      (r"last.?name|lname|surname|family.?name",      0.95),
    "middle_name":    (r"middle.?name|mid.?name|mname",               0.90),
    "full_name":      (r"^full.?name$|^name$|contact.?name",          0.85),
    "email":          (r"e.?mail|email.?address|professional.?email",  0.95),
    "company":        (r"company|employer|organization|org.?name|firm|company.?name", 0.90),
    "phone":          (r"phone|mobile|cell(?!ar)|direct|desk.?phone|business.?phone|personal.?mobile|office.?main", 0.90),
    "office_state":   (r"office.?state|^state$|province|region",      0.85),
    "employee_count": (r"employee|emp.?count|headcount|staff.?size",   0.85),
    "linkedin":       (r"linkedin|linked.?in",                        0.95),
    "primary_industry":(r"trade.?name|primary.?industry|^industry$",  0.80),
    "job_title":      (r"job.?title|^title$|^position$|^role$|designation", 0.90),
    "sic_code":       (r"\bsic\b|industry.?code|standard.?industrial", 0.90),
    "link_text":      (r"link.?text|anchor.?text",                    0.90),
    "description":    (r"^description$|^desc$",                       0.80),
    "unique_identifier": (r"unique.?id|record.?key|row.?id",          0.90),
    "facebook":       (r"facebook.?url|fb.?url|^facebook$",           0.95),
    "facebook_link_text": (r"facebook.?link|fb.?link",               0.90),
    "facebook_description": (r"facebook.?desc|fb.?desc",             0.85),
    "company_revenue": (r"revenue|annual.?revenue|company.?revenue",  0.90),
    "city":           (r"office.?city|^city$|^town$",                 0.90),
    "state":          (r"office.?state|^state$|^province$",           0.85),
    "postal_code":    (r"postal|zip|postcode|province.?postal",       0.90),
}

# phone columns can be multiple — track separately
_PHONE_PATTERN = re.compile(r"phone|mobile|cell(?!ar)|desk.?phone|business.*phone|personal.*mobile|office.*main", re.I)


def header_match(profiles: list) -> dict:
    """Returns role_map with high-confidence header-based assignments."""
    role_map = {}
    phone_columns = []

    for profile in profiles:
        header = profile.header
        h = re.sub(r"[_\-]", " ", header.lower()).strip()

        # Check phone first (multi-column role)
        if _PHONE_PATTERN.search(h):
            phone_columns.append({"column": header, "confidence": 0.90, "layer": 1})
            continue

        # Check all other roles
        for role, (pattern, confidence) in PATTERNS.items():
            if role in ("phone",):
                continue
            if re.search(pattern, h, re.I):
                if role not in role_map or confidence > role_map[role]["confidence"]:
                    role_map[role] = {"column": header, "confidence": confidence, "layer": 1}
                break

    if phone_columns:
        role_map["phone_columns"] = phone_columns

    return role_map
