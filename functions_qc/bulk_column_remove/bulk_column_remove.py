import pandas as pd


def remove_columns_from_excel(
    df: pd.DataFrame,
    columns_to_remove: list,
    **kwargs,
) -> tuple:
    found = [c for c in columns_to_remove if c in df.columns]
    not_found = [c for c in columns_to_remove if c not in df.columns]
    df = df.drop(columns=found)
    return df, {
        "status": "success",
        "columns_removed": found,
        "columns_not_found": not_found,
    }
