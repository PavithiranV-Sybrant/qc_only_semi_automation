"""
Pure-Python pipeline executor — no Streamlit dependency.
Mirrors the logic in ui_old/pipeline_runner.py but returns plain dicts.
"""
import time
from pathlib import Path
import json

from functions_qc.name_handling.name_split                         import split_full_name
from functions_qc.name_handling.dot_remove                         import remove_dot_from_names
from functions_qc.name_handling.name_company_match                 import check_company_name_direct_match
from functions_qc.name_handling.non_alpha_name_handle              import check_name_non_alphabetic_content
from functions_qc.email_handling.email_structure_validation        import validate_email_structure
from functions_qc.email_handling.company_email_domain_match        import company_email_domain_match
from functions_qc.email_handling.name_email_fuzzy                  import name_email_fuzzy_match
from functions_qc.phone_number_handling.standaize_phone_number     import normalize_phone_excel
from functions_qc.phone_number_handling.address_phone_postal       import validate_phone_state
from functions_qc.employee_count_handler.employee_count_normalizer import normalize_employee_count
from functions_qc.linkedin_handler.name_linkedin_fuzzy_match       import verify_linkedin_profile_match
from functions_qc.primary_industry.primary_industry_split_using_graterthen_greater_then import extract_primary_industry
from functions_qc.job_title_handler.job_title_categories           import categorize_job_titles
from functions_qc.sic_code_naics_handler.sic_naics_handler         import process_sic_naics

_CONFIG_PATH = Path(__file__).parent.parent / "instructions" / "runner_config.json"

STEP_LABELS = {
    "name_split":                "0. Split full name into parts",
    "dot_remove":                "1. Remove dots from names",
    "name_company_match":        "2. Name / Company match",
    "non_alpha_name_handle":     "3. Non-alpha characters in names",
    "email_structure_validation":"5. Email structure validation",
    "company_email_domain_match":"6. Company / Email domain match",
    "name_email_fuzzy_match":    "7. Name / Email fuzzy match",
    "normalize_phone_excel":     "8. Normalize phone numbers",
    "validate_phone_state":      "9. Phone / State validation",
    "normalize_employee_count":  "10. Normalize employee count",
    "name_linkedin_fuzzy_match": "11. LinkedIn name match",
    "extract_primary_industry":  "12. Extract primary industry",
    "job_title_categories":      "13. Job title categorization",
    "sic_code_naics":            "14. SIC → NAICS mapping",
}


def load_config():
    with open(_CONFIG_PATH) as f:
        cfg = json.load(f)
    return cfg.get("steps", {}), cfg.get("thresholds", {}), cfg.get("columns", {})


def _build_steps(df, cols, toggles, thresholds):
    fln = cols.get("full_name")
    fn  = cols.get("first_name")
    mn  = cols.get("middle_name")
    ln  = cols.get("last_name")
    co  = cols.get("company")
    em  = cols.get("email")
    st_ = cols.get("office_state")
    emp = cols.get("employee_count")
    li  = cols.get("linkedin")
    pi  = cols.get("primary_industry")
    jt  = cols.get("job_title")
    sic = cols.get("sic_code")
    ph  = cols.get("phone_columns", [])

    def has(*c): return all(x and x in df.columns for x in c)

    steps = []

    if toggles.get("name_split", False) and has(fln):
        steps.append({"name": "name_split", "label": STEP_LABELS["name_split"],
                      "func": split_full_name, "kwargs": {"full_name_col": fln}})

    if toggles.get("dot_remove", True) and has(fn, ln):
        steps.append({"name": "dot_remove", "label": STEP_LABELS["dot_remove"],
                      "func": remove_dot_from_names,
                      "kwargs": {"first_name_col": fn, "middle_name_col": mn, "last_name_col": ln}})

    if toggles.get("name_company_match", True) and has(fn, ln, co):
        steps.append({"name": "name_company_match", "label": STEP_LABELS["name_company_match"],
                      "func": check_company_name_direct_match,
                      "kwargs": {"first_name_col": fn, "middle_name_col": mn,
                                 "last_name_col": ln, "company_name_col": co}})

    if toggles.get("non_alpha_name_handle", True) and has(fn, ln):
        steps.append({"name": "non_alpha_name_handle", "label": STEP_LABELS["non_alpha_name_handle"],
                      "func": check_name_non_alphabetic_content,
                      "kwargs": {"first_name_col": fn, "middle_name_col": mn, "last_name_col": ln}})

    if toggles.get("email_structure_validation", True) and has(em):
        steps.append({"name": "email_structure_validation", "label": STEP_LABELS["email_structure_validation"],
                      "func": validate_email_structure, "kwargs": {"email_column": em}})

    if toggles.get("company_email_domain_match", True) and has(co, em):
        steps.append({"name": "company_email_domain_match", "label": STEP_LABELS["company_email_domain_match"],
                      "func": company_email_domain_match,
                      "kwargs": {"company_column": co, "email_column": em}})

    if toggles.get("name_email_fuzzy_match", True) and has(fn, ln, em):
        steps.append({"name": "name_email_fuzzy_match", "label": STEP_LABELS["name_email_fuzzy_match"],
                      "func": name_email_fuzzy_match,
                      "kwargs": {"first_name_column": fn, "last_name_column": ln,
                                 "email_column": em, "middle_name_column": mn,
                                 "threshold": thresholds.get("name_email_fuzzy", 80)}})

    for phone_col in (ph if isinstance(ph, list) else [ph]):
        if not phone_col or phone_col not in df.columns:
            continue
        if toggles.get("normalize_phone_excel", True):
            steps.append({"name": "normalize_phone_excel",
                          "label": f"8. Normalize phone [{phone_col}]",
                          "func": normalize_phone_excel, "kwargs": {"column_name": phone_col}})
        if toggles.get("validate_phone_state", True) and has(st_):
            steps.append({"name": "validate_phone_state",
                          "label": f"9. Phone/State validate [{phone_col}]",
                          "func": validate_phone_state,
                          "kwargs": {"country_code_column": f"{phone_col}_country_code",
                                     "area_code_mobile_number_column": f"{phone_col}_standardized_number",
                                     "office_state_column": st_},
                          "deferred": True})

    if toggles.get("normalize_employee_count", True) and has(emp):
        steps.append({"name": "normalize_employee_count", "label": STEP_LABELS["normalize_employee_count"],
                      "func": normalize_employee_count, "kwargs": {"old_employee_count": emp}})

    if toggles.get("name_linkedin_fuzzy_match", True) and has(fn, ln, li):
        steps.append({"name": "name_linkedin_fuzzy_match", "label": STEP_LABELS["name_linkedin_fuzzy_match"],
                      "func": verify_linkedin_profile_match,
                      "kwargs": {"first_name_col": fn, "middle_name_col": mn,
                                 "last_name_col": ln, "linkedin_col": li,
                                 "threshold": thresholds.get("linkedin_fuzzy", 0.5)}})

    if toggles.get("extract_primary_industry", True) and has(pi):
        steps.append({"name": "extract_primary_industry", "label": STEP_LABELS["extract_primary_industry"],
                      "func": extract_primary_industry, "kwargs": {"source_column": pi}})

    if toggles.get("job_title_categories", True) and has(jt):
        steps.append({"name": "job_title_categories", "label": STEP_LABELS["job_title_categories"],
                      "func": categorize_job_titles, "kwargs": {"job_title_col": jt}})

    if toggles.get("sic_code_naics", True) and has(sic):
        steps.append({"name": "sic_code_naics", "label": STEP_LABELS["sic_code_naics"],
                      "func": process_sic_naics, "kwargs": {"sic_code_col": sic}})

    return steps


def execute_pipeline(df, column_mapping, step_toggles, thresholds, progress_cb=None):
    """
    Run all steps and return (df, results, elapsed_seconds).
    progress_cb(step_index, total_steps, label) is called before each step.
    """
    steps   = _build_steps(df, column_mapping, step_toggles, thresholds)
    results = []
    total   = len(steps)
    t_start = time.time()

    for i, step in enumerate(steps):
        label = step["label"]
        if progress_cb:
            progress_cb(i, total, label)

        if step.get("deferred"):
            std_col = step["kwargs"].get("area_code_mobile_number_column", "")
            if std_col not in df.columns:
                results.append({"step": step["name"], "label": label, "status": "skipped",
                                "detail": "prerequisite column not found", "elapsed": 0.0})
                continue
        t0 = time.time()
        try:
            df, detail = step["func"](df, **step["kwargs"])
            elapsed = time.time() - t0
            results.append({"step": step["name"], "label": label, "status": "ok",
                            "detail": detail if isinstance(detail, dict) else {"message": str(detail)},
                            "elapsed": round(elapsed, 3)})
        except Exception as e:
            elapsed = time.time() - t0
            results.append({"step": step["name"], "label": label, "status": "error",
                            "detail": {"message": str(e)}, "elapsed": round(elapsed, 3)})

    if progress_cb:
        progress_cb(total, total, "Done")
    return df, results, round(time.time() - t_start, 3)
