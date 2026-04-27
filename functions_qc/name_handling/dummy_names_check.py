import pandas as pd

_DUMMY_WORDS = {"unknown", "testing", "test", "xxx", "dummy", "n/a", "na", "none", "null", "sample"}


def check_dummy_names(
    df: pd.DataFrame,
    first_name_col: str,
    last_name_col: str,
) -> tuple:
    if first_name_col not in df.columns or last_name_col not in df.columns:
        missing = [c for c in [first_name_col, last_name_col] if c not in df.columns]
        return df, {"status": "error", "message": f"Column(s) not found: {missing}"}

    new_col = "comments_dummy_names_check"

    def _is_dummy(row):
        fn = str(row.get(first_name_col) or "").strip().lower()
        ln = str(row.get(last_name_col) or "").strip().lower()
        return fn in _DUMMY_WORDS or ln in _DUMMY_WORDS

    results = df.apply(_is_dummy, axis=1)

    idx = df.columns.get_loc(last_name_col) + 1
    df.insert(idx, new_col, results)

    return df, {
        "status": "success",
        "column_created": new_col,
        "dummy_found": int(results.sum()),
        "rows_processed": len(df),
    }
