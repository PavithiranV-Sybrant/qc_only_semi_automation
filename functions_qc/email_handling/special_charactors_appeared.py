import pandas as pd


def company_special_char_check(
    df: pd.DataFrame,
    company_column: str,
) -> tuple:
    if company_column not in df.columns:
        return df, {"status": "error", "message": "Column not found"}

    new_col = "comments_company_special_chars"
    results = []
    count_flagged = 0

    for val in df[company_column]:
        if pd.isna(val) or not val:
            results.append("Not Exist")
            continue

        text = str(val).lower()
        findings = []
        if "#" in text:
            findings.append("# appeared")
        if "@" in text:
            findings.append("@ appeared")
        if ".com" in text:
            findings.append(".com appeared")

        if findings:
            results.append(", ".join(findings))
            count_flagged += 1
        else:
            results.append("Not Exist")

    idx = df.columns.get_loc(company_column) + 1
    df.insert(idx, new_col, results)

    return df, {"status": "success", "column_created": new_col, "rows_flagged": count_flagged}
