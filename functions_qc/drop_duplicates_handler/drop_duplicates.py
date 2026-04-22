import pandas as pd


def drop_duplicate_rows(df: pd.DataFrame, subset: list = None) -> tuple:
    """
    Removes duplicate rows from the DataFrame.

    If `subset` is provided (e.g. the Unique Identifier column), duplicates
    are detected based on those columns only — the first occurrence is kept.
    If `subset` is None, rows that are completely identical across all columns
    are dropped.

    Returns the deduplicated DataFrame and a status dict.
    """
    rows_before = len(df)

    valid_subset = None
    if subset:
        valid_subset = [c for c in subset if c in df.columns] or None

    df = df.drop_duplicates(subset=valid_subset, keep="first").reset_index(drop=True)

    rows_after   = len(df)
    rows_removed = rows_before - rows_after

    return df, {
        "status":       "success",
        "rows_before":  rows_before,
        "rows_after":   rows_after,
        "rows_removed": rows_removed,
        "subset_used":  valid_subset,
    }
