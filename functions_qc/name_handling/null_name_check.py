import pandas as pd


def check_null_names(
    df: pd.DataFrame,
    first_name_col: str | None,
    last_name_col: str | None,
) -> tuple:
    fn_col = "comments_first_name_null_values"
    ln_col = "comments_last_name_null_values"

    def _is_null(val):
        return pd.isna(val) or str(val).strip() == ""

    fn_ok = first_name_col and first_name_col in df.columns
    ln_ok = last_name_col and last_name_col in df.columns

    if fn_ok:
        fn_results = df[first_name_col].apply(_is_null)
        fn_idx = df.columns.get_loc(first_name_col) + 1
        df.insert(fn_idx, fn_col, fn_results)
    else:
        fn_results = pd.Series([False] * len(df), index=df.index)
        df[fn_col] = fn_results

    if ln_ok:
        ln_results = df[last_name_col].apply(_is_null)
        ln_idx = df.columns.get_loc(last_name_col) + 1
        df.insert(ln_idx, ln_col, ln_results)
    else:
        ln_results = pd.Series([False] * len(df), index=df.index)
        df[ln_col] = ln_results

    return df, {
        "status": "success",
        "columns_created": [fn_col, ln_col],
        "first_name_nulls": int(fn_results.sum()),
        "last_name_nulls": int(ln_results.sum()),
        "rows_processed": len(df),
    }
