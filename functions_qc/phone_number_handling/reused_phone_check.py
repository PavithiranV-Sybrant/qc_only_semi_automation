import re
import pandas as pd


def _normalize_phone(val) -> str | None:
    if pd.isna(val) or not str(val).strip():
        return None
    digits = re.sub(r"\D", "", str(val))
    if len(digits) < 7:
        return None
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    return digits


def check_reused_phone(
    df: pd.DataFrame,
    phone_columns: list,
) -> tuple:
    new_col = "comments_reused_phone_number"

    valid_cols = [c for c in (phone_columns or []) if c and c in df.columns]

    if not valid_cols:
        df[new_col] = ""
        return df, {"status": "success", "column_created": new_col,
                    "reused_count": 0, "rows_processed": len(df),
                    "note": "no phone columns mapped"}

    phone_index: dict[str, set] = {}
    for col in valid_cols:
        for row_idx, val in df[col].items():
            norm = _normalize_phone(val)
            if norm:
                phone_index.setdefault(norm, set()).add(row_idx)

    reused_numbers = {num for num, rows in phone_index.items() if len(rows) > 1}

    results = []
    for row_idx, row in df.iterrows():
        is_reused = any(
            _normalize_phone(row.get(col)) in reused_numbers
            for col in valid_cols
            if _normalize_phone(row.get(col))
        )
        results.append("Reused" if is_reused else "")

    df[new_col] = results

    return df, {
        "status": "success",
        "column_created": new_col,
        "reused_count": sum(1 for r in results if r == "Reused"),
        "rows_processed": len(df),
    }
