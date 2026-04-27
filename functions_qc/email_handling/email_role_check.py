import pandas as pd

_ROLE_PREFIXES = {
    "info", "sales", "contact", "admin", "support", "noreply", "no-reply",
    "help", "hello", "team", "office", "hr", "billing", "marketing",
    "services", "enquiries", "enquiry", "postmaster", "webmaster",
    "hostmaster", "abuse", "security", "privacy", "legal", "press",
    "media", "careers", "jobs", "recruitment", "feedback", "newsletter",
}


def check_role_email(
    df: pd.DataFrame,
    email_column: str | None,
) -> tuple:
    col_suffix = email_column if email_column else "email"
    new_col = f"comments_{col_suffix}_role_account"

    if not email_column or email_column not in df.columns:
        df[new_col] = False
        return df, {"status": "success", "column_created": new_col,
                    "role_accounts_found": 0, "rows_processed": len(df),
                    "note": "email column not mapped"}

    def _is_role(val):
        if pd.isna(val) or not str(val).strip():
            return False
        email = str(val).strip().lower()
        if "@" not in email:
            return False
        local = email.split("@")[0]
        return local in _ROLE_PREFIXES

    results = df[email_column].apply(_is_role)

    idx = df.columns.get_loc(email_column) + 1
    df.insert(idx, new_col, results)

    return df, {
        "status": "success",
        "column_created": new_col,
        "role_accounts_found": int(results.sum()),
        "rows_processed": len(df),
    }
