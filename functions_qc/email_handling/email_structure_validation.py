import pandas as pd
import re

_EMAIL_PATTERN = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


def is_valid_email_format(email) -> bool:
    if not email:
        return False
    return bool(_EMAIL_PATTERN.match(str(email).strip()))


def validate_email_structure(
    df: pd.DataFrame,
    email_column: str,
) -> tuple:
    if email_column not in df.columns:
        return df, {"status": "error", "message": "Column not found"}

    new_col = "comments_email_structure_valid"
    values = df[email_column].apply(lambda e: "valid" if is_valid_email_format(e) else "invalid")

    idx = df.columns.get_loc(email_column) + 1
    df.insert(idx, new_col, values)

    return df, {
        "status": "success",
        "column_created": new_col,
        "valid_emails": int((values == "valid").sum()),
        "invalid_emails": int((values == "invalid").sum()),
    }
