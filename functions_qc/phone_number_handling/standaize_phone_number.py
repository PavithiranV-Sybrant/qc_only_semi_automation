import pandas as pd
import re

try:
    import phonenumbers
    from phonenumbers import PhoneNumberType, NumberParseException
    _PHONENUMBERS_AVAILABLE = True
except ImportError:
    _PHONENUMBERS_AVAILABLE = False

_TYPE_MAP = {
    PhoneNumberType.MOBILE:               "MOBILE",
    PhoneNumberType.FIXED_LINE:           "FIXED_LINE",
    PhoneNumberType.FIXED_LINE_OR_MOBILE: "FIXED_LINE_OR_MOBILE",
    PhoneNumberType.TOLL_FREE:            "TOLL_FREE",
    PhoneNumberType.PREMIUM_RATE:         "PREMIUM_RATE",
    PhoneNumberType.VOIP:                 "VOIP",
    PhoneNumberType.UNKNOWN:              "UNKNOWN",
} if _PHONENUMBERS_AVAILABLE else {}


def _fmt_phone(digits: str) -> str:
    if len(digits) == 10:
        return f"{digits[0:3]}-{digits[3:6]}-{digits[6:10]}"
    return "INVALID"


def _phonenumbers_validate(phone) -> tuple:
    """Returns (is_valid, is_us, number_type) for a formatted phone string."""
    if not _PHONENUMBERS_AVAILABLE or pd.isna(phone) or str(phone).strip() in ("", "INVALID"):
        return False, False, "PARSE_ERROR"
    try:
        num = phonenumbers.parse(str(phone), "US")
        is_valid = phonenumbers.is_valid_number(num)
        is_us    = phonenumbers.is_valid_number_for_region(num, "US")
        ntype    = phonenumbers.number_type(num)
        return is_valid, is_us, _TYPE_MAP.get(ntype, "UNKNOWN")
    except NumberParseException:
        return False, False, "PARSE_ERROR"


def normalize_phone_excel(
    df: pd.DataFrame,
    column_name: str,
) -> tuple:
    if column_name not in df.columns:
        return df, {"status": "skipped", "message": f"Column '{column_name}' not found."}

    col = df[column_name]
    if col.isna().all() or (col.astype(str).str.strip() == "").all():
        return df, {"status": "skipped", "message": f"Column '{column_name}' is empty. No processing needed."}

    country_codes, standardized, exts = [], [], []
    ph_is_valid, ph_is_us, ph_type = [], [], []

    for val in col:
        if pd.isna(val):
            country_codes.append("")
            standardized.append("INVALID")
            exts.append("")
            ph_is_valid.append(False)
            ph_is_us.append(False)
            ph_type.append("PARSE_ERROR")
            continue

        text = str(val)

        # Extract extension FIRST, then remove it from text before digit parsing
        ext_m = re.search(r"[-\s]*(ext|x|#|extension)[-\s]*(\d+)", text, re.I)
        ext = ext_m.group(2) if ext_m else ""
        text_for_digits = text[:ext_m.start()] if ext_m else text

        digits = re.sub(r"\D", "", text_for_digits)

        country = ""
        if len(digits) > 10:
            standard = _fmt_phone(digits[-10:])
            cc = digits[:-10]
            country = "+" + cc if cc else ""
        elif len(digits) == 10:
            standard = _fmt_phone(digits)
        else:
            standard = "INVALID"

        is_valid, is_us, ntype = _phonenumbers_validate(standard)

        country_codes.append(country)
        standardized.append(standard)
        exts.append(ext)
        ph_is_valid.append(is_valid)
        ph_is_us.append(is_us)
        ph_type.append(ntype)

    idx = df.columns.get_loc(column_name) + 1
    df.insert(idx,     f"{column_name}_country_code",         country_codes)
    df.insert(idx + 1, f"{column_name}_standardized_number",  standardized)
    df.insert(idx + 2, f"{column_name}_ext",                  exts)
    df.insert(idx + 3, f"{column_name}_is_valid",             ph_is_valid)
    df.insert(idx + 4, f"{column_name}_region_us",            ph_is_us)
    df.insert(idx + 5, f"{column_name}_number_type",          ph_type)

    valid_count = sum(ph_is_valid)
    return df, {
        "status": "success",
        "message": "Phone numbers processed successfully.",
        "valid": valid_count,
        "invalid": len(df) - valid_count,
    }
