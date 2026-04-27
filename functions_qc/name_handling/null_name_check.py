import pandas as pd


def check_null_names(
    df: pd.DataFrame,
    first_name_col: str,
    last_name_col: str,
) -> tuple:
    if first_name_col not in df.columns or last_name_col not in df.columns:
        missing = [c for c in [first_name_col, last_name_col] if c not in df.columns]
        return df, {"status": "error", "message": f"Column(s) not found: {missing}"}

    fn_col = "comments_first_name_null_values"
    ln_col = "comments_last_name_null_values"

    def _is_null(val):
        return pd.isna(val) or str(val).strip() == ""

    fn_results = df[first_name_col].apply(_is_null)
    ln_results = df[last_name_col].apply(_is_null)

    fn_idx = df.columns.get_loc(first_name_col) + 1
    df.insert(fn_idx, fn_col, fn_results)

    ln_idx = df.columns.get_loc(last_name_col) + 1
    df.insert(ln_idx, ln_col, ln_results)

    return df, {
        "status": "success",
        "columns_created": [fn_col, ln_col],
        "first_name_nulls": int(fn_results.sum()),
        "last_name_nulls": int(ln_results.sum()),
        "rows_processed": len(df),
    }
