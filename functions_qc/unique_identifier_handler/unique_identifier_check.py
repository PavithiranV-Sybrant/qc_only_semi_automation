import pandas as pd


def check_unique_identifier(df: pd.DataFrame, unique_id_col: str) -> tuple:
    """
    Checks whether each value in the Unique Identifier column is unique across
    all rows. Inserts 'Comments_unique_identifier_verifier' immediately to the
    right of the source column.

    Labels:
        "Unique"    — value appears exactly once in the column
        "Duplicate" — value appears more than once in the column
        ""          — value is blank / NaN
    """
    if unique_id_col not in df.columns:
        return df, {"status": "error", "message": f"Column '{unique_id_col}' not found"}

    new_col = "Comments_unique_identifier_verifier"

    # Build a count map — treat NaN / blank as non-identifiers
    non_blank = df[unique_id_col].dropna()
    non_blank = non_blank[non_blank.astype(str).str.strip() != ""]
    value_counts = non_blank.value_counts()

    def _label(val):
        if pd.isna(val) or str(val).strip() == "":
            return ""
        return "Duplicate" if value_counts.get(val, 0) > 1 else "Unique"

    values = df[unique_id_col].apply(_label)

    idx = df.columns.get_loc(unique_id_col) + 1
    df.insert(idx, new_col, values)

    counts = values.value_counts().to_dict()
    return df, {
        "status": "success",
        "column_created": new_col,
        "counts": counts,
        "rows_processed": len(df),
    }
