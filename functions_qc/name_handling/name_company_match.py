import pandas as pd


def check_company_name_direct_match(
    df: pd.DataFrame,
    first_name_col: str,
    middle_name_col: str,
    last_name_col: str,
    company_name_col: str,
) -> tuple:
    new_col = "comments_name_company_appreared"

    def check(row):
        names = [
            str(row[first_name_col]).strip().lower() if pd.notna(row.get(first_name_col)) else "",
            str(row[middle_name_col]).strip().lower() if pd.notna(row.get(middle_name_col)) else "",
            str(row[last_name_col]).strip().lower() if pd.notna(row.get(last_name_col)) else "",
        ]
        company = str(row[company_name_col]).strip().lower() if pd.notna(row.get(company_name_col)) else ""
        return "Exist" if company and company in names else "Not Exist"

    values = df.apply(check, axis=1)
    idx = df.columns.get_loc(last_name_col) + 1
    df.insert(idx, new_col, values)

    return df, {"status": "success", "match_type": "direct", "new_column": new_col}
