import pandas as pd
import re

_PATTERN = re.compile(r"^[A-Za-z.]+$")


def check_name_non_alphabetic_content(
    df: pd.DataFrame,
    first_name_col: str,
    middle_name_col: str,
    last_name_col: str,
) -> tuple:
    new_col = "comments_name_non_alphabetic_content_exist"

    def check(row):
        for col in [first_name_col, middle_name_col, last_name_col]:
            val = row.get(col)
            if pd.notna(val) and val:
                if not _PATTERN.fullmatch(str(val).strip()):
                    return "Exist"
        return "Not Exist"

    values = df.apply(check, axis=1)
    idx = df.columns.get_loc(last_name_col) + 1
    df.insert(idx, new_col, values)

    return df, {"status": "success", "new_column": new_col, "column_position": idx + 1}
