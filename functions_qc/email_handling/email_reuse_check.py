import pandas as pd


def check_email_reuse(
    df: pd.DataFrame,
    email_column: str,
) -> tuple:
    if email_column not in df.columns:
        return df, {"status": "error", "message": f"Column '{email_column}' not found"}

    new_col = f"comments_{email_column}_reused_column"

    normalized = df[email_column].apply(
        lambda v: str(v).strip().lower() if pd.notna(v) and str(v).strip() else None
    )
    counts = normalized.value_counts()

    def _label(val):
        if val is None:
            return ""
        return "Reused" if counts.get(val, 0) > 1 else ""

    results = normalized.apply(_label)

    idx = df.columns.get_loc(email_column) + 1
    df.insert(idx, new_col, results)

    return df, {
        "status": "success",
        "column_created": new_col,
        "reused_count": int((results == "Reused").sum()),
        "rows_processed": len(df),
    }
