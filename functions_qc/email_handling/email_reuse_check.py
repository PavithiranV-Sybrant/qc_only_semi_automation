import pandas as pd


def check_email_reuse(
    df: pd.DataFrame,
    email_column: str | None,
) -> tuple:
    col_suffix = email_column if email_column else "email"
    new_col = f"comments_{col_suffix}_reused_column"

    if not email_column or email_column not in df.columns:
        df[new_col] = ""
        return df, {"status": "success", "column_created": new_col,
                    "reused_count": 0, "rows_processed": len(df), "note": "email column not mapped"}

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
