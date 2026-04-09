import os
import pandas as pd
import json
import re

_HERE = os.path.dirname(os.path.abspath(__file__))
_AREA_CODES_PATH = os.path.normpath(os.path.join(_HERE, "..", "..", "data_postal", "areaCodes.json"))


def validate_phone_state(
    df: pd.DataFrame,
    country_code_column: str,
    area_code_mobile_number_column: str,
    office_state_column: str,
) -> tuple:
    if area_code_mobile_number_column not in df.columns:
        return df, {"status": "error", "message": f"Column '{area_code_mobile_number_column}' not found"}

    with open(_AREA_CODES_PATH) as f:
        area_codes = json.load(f)

    new_col = "comments_phone_address_postal_validation"
    results = []
    matched = not_matched = invalid = 0

    for _, row in df.iterrows():
        cc = str(row.get(country_code_column, "") or "").strip()
        phone = row.get(area_code_mobile_number_column)
        state = row.get(office_state_column)

        if not cc or cc in ("", "nan"):
            cc = "+1"
        if not cc.startswith("+"):
            cc = "+" + cc

        if pd.isna(phone) or pd.isna(state):
            results.append("invalid")
            invalid += 1
            continue

        phone_digits = re.sub(r"\D", "", str(phone))
        if len(phone_digits) == 11 and phone_digits.startswith("1"):
            phone_digits = phone_digits[1:]

        if len(phone_digits) < 10:
            results.append("invalid")
            invalid += 1
            continue

        area_code = phone_digits[:3]

        # Toll-free numbers are nationally valid — no state match needed
        _TOLL_FREE = {"800", "888", "877", "866", "855", "844", "833", "822"}
        if area_code in _TOLL_FREE:
            results.append("matched")
            matched += 1
            continue

        key = f"{cc} {area_code}".strip()
        area_data = area_codes.get(key)

        if not area_data:
            results.append("invalid")
            invalid += 1
        else:
            json_state_code = area_data.get("stateCode", "")
            json_state_full = area_data.get("state", "")
            data_state = str(state).strip().lower()

            if not json_state_code and not json_state_full:
                results.append("invalid")
                invalid += 1
            elif json_state_code.lower() == data_state or json_state_full.lower() == data_state:
                results.append("matched")
                matched += 1
            else:
                results.append("not matched")
                not_matched += 1

    idx = df.columns.get_loc(area_code_mobile_number_column) + 1
    df.insert(idx, new_col, results)

    return df, {
        "status": "success",
        "column_created": new_col,
        "matched": matched,
        "not_matched": not_matched,
        "invalid": invalid,
    }
