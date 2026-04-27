import pandas as pd

_DUMMY_WORDS = {"unknown", "testing", "test", "xxx", "dummy", "n/a", "na", "none", "null", "sample"}


def check_dummy_names(
    df: pd.DataFrame,
    first_name_col: str | None,
    last_name_col: str | None,
) -> tuple:
    new_col = "comments_dummy_names_check"

    fn_ok = first_name_col and first_name_col in df.columns
    ln_ok = last_name_col and last_name_col in df.columns

    if not fn_ok and not ln_ok:
        df[new_col] = False
        return df, {"status": "success", "column_created": new_col,
                    "dummy_found": 0, "rows_processed": len(df), "note": "source columns not mapped"}

    def _is_dummy(row):
        fn = str(row.get(first_name_col) or "").strip().lower() if fn_ok else ""
        ln = str(row.get(last_name_col) or "").strip().lower() if ln_ok else ""
        return fn in _DUMMY_WORDS or ln in _DUMMY_WORDS

    results = df.apply(_is_dummy, axis=1)

    ref_col = last_name_col if ln_ok else first_name_col
    idx = df.columns.get_loc(ref_col) + 1
    df.insert(idx, new_col, results)

    return df, {
        "status": "success",
        "column_created": new_col,
        "dummy_found": int(results.sum()),
        "rows_processed": len(df),
    }
