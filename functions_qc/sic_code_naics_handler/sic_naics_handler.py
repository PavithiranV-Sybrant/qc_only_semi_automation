import os
import pandas as pd
import re
import json

_HERE = os.path.dirname(os.path.abspath(__file__))
_JSON_PATH = os.path.normpath(os.path.join(_HERE, "..", "..", "naic_sic_code_mapping", "sic_naics_code.json"))


def process_sic_naics(
    df: pd.DataFrame,
    sic_code_col: str,
) -> tuple:
    if sic_code_col not in df.columns:
        return df, {"status": "error", "message": f"Column '{sic_code_col}' not found"}

    with open(_JSON_PATH) as f:
        mapping_data = json.load(f)
    sic_to_naics = {item["sic"]: item["naics"] for item in mapping_data}

    def extract_sic(val):
        if pd.isna(val):
            return ""
        m = re.search(r"\b\d{4}\b", str(val))
        return m.group(0) if m else ""

    sic_values  = df[sic_code_col].apply(extract_sic)
    naics_values = sic_values.map(sic_to_naics).fillna("")

    idx = df.columns.get_loc(sic_code_col) + 1

    # Safe rerun: remove if already present
    for col in ["sic", "naics"]:
        if col in df.columns:
            df = df.drop(columns=[col])

    df.insert(idx,     "sic",   sic_values)
    df.insert(idx + 1, "naics", naics_values)

    extracted = int((sic_values  != "").sum())
    mapped    = int((naics_values != "").sum())

    return df, {
        "status": "success",
        "column_created": "sic / naics",
        "extracted": extracted,
        "mapped": mapped,
        "missing_or_invalid": len(df) - mapped,
    }
