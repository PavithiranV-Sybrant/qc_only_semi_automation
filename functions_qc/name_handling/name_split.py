import pandas as pd


def _split_name(full_name):
    if pd.isna(full_name):
        return "", "", ""
    parts = str(full_name).strip().split()
    if len(parts) == 1:
        return parts[0], "", ""
    elif len(parts) == 2:
        return parts[0], "", parts[1]
    else:
        return parts[0], " ".join(parts[1:-1]), parts[-1]


def split_full_name(df, full_name_col):
    """
    Splits a full name column into First_Name, Middle_Name, Last_Name columns
    inserted immediately to the right of the source column.
    Returns (df, status_dict).
    """
    if full_name_col not in df.columns:
        return df, {"status": "skipped", "message": f"Column '{full_name_col}' not found"}

    split_df = df[full_name_col].apply(lambda x: pd.Series(_split_name(x)))
    split_df.columns = ["First_Name", "Middle_Name", "Last_Name"]

    col_index = df.columns.get_loc(full_name_col)
    for i, col in enumerate(split_df.columns):
        if col not in df.columns:
            df.insert(col_index + 1 + i, col, split_df[col])

    cells_updated = int(df[full_name_col].notna().sum())
    return df, {
        "cells_updated": cells_updated,
        "message": f"Split '{full_name_col}' → First_Name, Middle_Name, Last_Name",
    }
