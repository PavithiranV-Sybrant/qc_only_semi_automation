import pandas as pd


def extract_primary_industry(
    df: pd.DataFrame,
    source_column: str,
) -> tuple:
    if source_column not in df.columns:
        return df, {"status": "error", "message": f"Column '{source_column}' not found"}

    new_col = "comments_primary_industry_extracted"

    def extract(val):
        if pd.isna(val) or not val:
            return None
        parts = [p.strip() for p in str(val).split(">") if p.strip()]
        return parts[2] if len(parts) >= 3 else None

    values = df[source_column].apply(extract)
    extracted = int(values.notna().sum())
    missing = int(values.isna().sum())

    idx = df.columns.get_loc(source_column) + 1
    df.insert(idx, new_col, values)

    return df, {
        "status": "success",
        "column_created": new_col,
        "extracted": extracted,
        "missing_or_invalid": missing,
    }
