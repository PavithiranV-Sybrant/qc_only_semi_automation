import pandas as pd


def remove_dot_from_names(
    df: pd.DataFrame,
    first_name_col: str,
    middle_name_col: str,
    last_name_col: str,
) -> tuple:
    updated = 0
    for col in [first_name_col, middle_name_col, last_name_col]:
        if col not in df.columns:
            continue
        mask = df[col].notna() & df[col].astype(str).str.contains(".", regex=False)
        updated += int(mask.sum())
        df[col] = df[col].apply(
            lambda v: str(v).replace(".", "").strip() if pd.notna(v) and isinstance(v, str) else v
        )
    return df, {
        "status": "success",
        "columns_processed": [first_name_col, middle_name_col, last_name_col],
        "cells_updated": updated,
    }
