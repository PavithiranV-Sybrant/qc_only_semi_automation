import pandas as pd
import re


def _resolve_k_notation(text: str) -> str:
    """Convert k/K suffix to full number before parsing. e.g. 5k→5000, 1.5k→1500."""
    def _replace(match):
        return str(int(float(match.group(1)) * 1000))
    return re.sub(r'(\d+\.?\d*)\s*[kK]\b', _replace, text)


def _extract_numbers(text: str) -> list:
    return [int(n.replace(",", "")) for n in re.findall(r"\d[\d,]*", str(text))]


def _map_to_range(value: int) -> str:
    thresholds = [
        (10,    "1-10"),
        (25,    "10-25"),
        (50,    "25-50"),
        (100,   "50-100"),
        (250,   "100-250"),
        (500,   "250-500"),
        (1000,  "500-1,000"),
        (2500,  "1,000-2,500"),
        (5000,  "2,500-5,000"),
        (10000, "5,000-10,000"),
    ]
    for limit, label in thresholds:
        if value <= limit:
            return label
    return "10,000+"


def normalize_employee_count(
    df: pd.DataFrame,
    old_employee_count: str,
) -> tuple:
    if old_employee_count not in df.columns:
        return df, {"status": "error", "message": f"Column '{old_employee_count}' not found"}

    new_col = "employee_count"

    def process(raw):
        if pd.isna(raw) or str(raw).strip() == "":
            return None
        text = _resolve_k_notation(str(raw))
        numbers = _extract_numbers(text)
        if not numbers:
            return None
        return _map_to_range(max(numbers))

    values = df[old_employee_count].apply(process)
    idx = df.columns.get_loc(old_employee_count) + 1
    df.insert(idx, new_col, values)

    return df, {"status": "success", "column_created": new_col}
