import json
import time
from pathlib import Path

import pandas as pd
import streamlit as st

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

_BASE        = Path(__file__).parent.parent
_CONFIG_PATH = _BASE / "instructions" / "runner_config.json"

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


def _load_defaults():
    with open(_CONFIG_PATH) as f:
        cfg = json.load(f)
    return cfg.get("steps", {}), cfg.get("thresholds", {})



def _fmt(detail) -> str:
    if isinstance(detail, dict):
        keys = ["cells_updated","valid_emails","invalid_emails","matches","non_matches",
                "matched","not_matched","invalid","mapped","columns_removed","categories","message"]
        parts = [f"{k}: {detail[k]}" for k in keys if k in detail]
        return " | ".join(parts) or str(detail)
    return str(detail)


def render_pipeline_controls():
    """Renders step toggles and threshold sliders. Call inside sidebar."""
    defaults, threshold_defaults = _load_defaults()

    _c1, _c2 = st.columns([3, 1])
    _c1.markdown("**Steps**")
    _all_on = _c2.toggle("All", key="tog_all_steps", value=True)
    _prev_all = st.session_state.get("_all_steps_prev")
    if _prev_all is not None and _prev_all != _all_on:
        for key in STEP_LABELS:
            st.session_state[f"tog_{key}"] = _all_on
    st.session_state["_all_steps_prev"] = _all_on

    toggles = {}
    for key, label in STEP_LABELS.items():
        toggles[key] = st.toggle(label, value=defaults.get(key, True), key=f"tog_{key}")

    st.divider()
    st.markdown("**Thresholds**")
    thresholds = {
        "name_email_fuzzy": st.slider(
            "Name / Email fuzzy threshold", 0, 100,
            value=int(threshold_defaults.get("name_email_fuzzy", 80)), key="thr_email"
        ),
        "linkedin_fuzzy": st.slider(
            "LinkedIn fuzzy threshold", 0.0, 1.0,
            value=float(threshold_defaults.get("linkedin_fuzzy", 0.5)),
            step=0.05, key="thr_li"
        ),
    }

    st.session_state.step_toggles = toggles
    st.session_state.thresholds   = thresholds


def _build_steps(df, cols, toggles, thresholds):
    """Return ordered list of step dicts."""
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

    # 0
    if toggles.get("name_split", False) and has(fln):
        steps.append({"name": "name_split", "label": STEP_LABELS["name_split"],
                      "func": split_full_name,
                      "kwargs": {"full_name_col": fln}})

    # 1
    if toggles.get("dot_remove", True) and has(fn, ln):
        steps.append({"name": "dot_remove", "label": STEP_LABELS["dot_remove"],
                      "func": remove_dot_from_names,
                      "kwargs": {"first_name_col": fn, "middle_name_col": mn, "last_name_col": ln}})

    # 2
    if toggles.get("name_company_match", True) and has(fn, ln, co):
        steps.append({"name": "name_company_match", "label": STEP_LABELS["name_company_match"],
                      "func": check_company_name_direct_match,
                      "kwargs": {"first_name_col": fn, "middle_name_col": mn,
                                 "last_name_col": ln, "company_name_col": co}})

    # 3
    if toggles.get("non_alpha_name_handle", True) and has(fn, ln):
        steps.append({"name": "non_alpha_name_handle", "label": STEP_LABELS["non_alpha_name_handle"],
                      "func": check_name_non_alphabetic_content,
                      "kwargs": {"first_name_col": fn, "middle_name_col": mn, "last_name_col": ln}})

    # 4
    if toggles.get("email_structure_validation", True) and has(em):
        steps.append({"name": "email_structure_validation", "label": STEP_LABELS["email_structure_validation"],
                      "func": validate_email_structure,
                      "kwargs": {"email_column": em}})

    # 6
    if toggles.get("company_email_domain_match", True) and has(co, em):
        steps.append({"name": "company_email_domain_match", "label": STEP_LABELS["company_email_domain_match"],
                      "func": company_email_domain_match,
                      "kwargs": {"company_column": co, "email_column": em}})

    # 7
    if toggles.get("name_email_fuzzy_match", True) and has(fn, ln, em):
        steps.append({"name": "name_email_fuzzy_match", "label": STEP_LABELS["name_email_fuzzy_match"],
                      "func": name_email_fuzzy_match,
                      "kwargs": {"first_name_column": fn, "last_name_column": ln,
                                 "email_column": em, "middle_name_column": mn,
                                 "threshold": thresholds.get("name_email_fuzzy", 80)}})

    # 8+9 per phone column
    for phone_col in (ph if isinstance(ph, list) else [ph]):
        if not phone_col or phone_col not in df.columns:
            continue
        label_norm = f"8. Normalize phone [{phone_col}]"
        label_val  = f"9. Phone/State validate [{phone_col}]"

        if toggles.get("normalize_phone_excel", True):
            steps.append({"name": "normalize_phone_excel", "label": label_norm,
                          "func": normalize_phone_excel,
                          "kwargs": {"column_name": phone_col}})

        if toggles.get("validate_phone_state", True) and has(st_):
            std_col = f"{phone_col}_standardized_number"
            cc_col  = f"{phone_col}_country_code"
            steps.append({"name": "validate_phone_state", "label": label_val,
                          "func": validate_phone_state,
                          "kwargs": {"country_code_column": cc_col,
                                     "area_code_mobile_number_column": std_col,
                                     "office_state_column": st_},
                          "deferred": True})  # needs normalize to run first


    # 10
    if toggles.get("normalize_employee_count", True) and has(emp):
        steps.append({"name": "normalize_employee_count", "label": STEP_LABELS["normalize_employee_count"],
                      "func": normalize_employee_count,
                      "kwargs": {"old_employee_count": emp}})

    # 11
    if toggles.get("name_linkedin_fuzzy_match", True) and has(fn, ln, li):
        steps.append({"name": "name_linkedin_fuzzy_match", "label": STEP_LABELS["name_linkedin_fuzzy_match"],
                      "func": verify_linkedin_profile_match,
                      "kwargs": {"first_name_col": fn, "middle_name_col": mn,
                                 "last_name_col": ln, "linkedin_col": li,
                                 "threshold": thresholds.get("linkedin_fuzzy", 0.5)}})

    # 12
    if toggles.get("extract_primary_industry", True) and has(pi):
        steps.append({"name": "extract_primary_industry", "label": STEP_LABELS["extract_primary_industry"],
                      "func": extract_primary_industry,
                      "kwargs": {"source_column": pi}})

    # 13
    if toggles.get("job_title_categories", True) and has(jt):
        steps.append({"name": "job_title_categories", "label": STEP_LABELS["job_title_categories"],
                      "func": categorize_job_titles,
                      "kwargs": {"job_title_col": jt}})

    # 14
    if toggles.get("sic_code_naics", True) and has(sic):
        steps.append({"name": "sic_code_naics", "label": STEP_LABELS["sic_code_naics"],
                      "func": process_sic_naics,
                      "kwargs": {"sic_code_col": sic}})

    return steps


def run_pipeline(df, column_mapping, step_toggles, thresholds):
    """Execute pipeline with live Streamlit progress. Returns (df, results, elapsed_seconds)."""
    steps    = _build_steps(df, column_mapping, step_toggles, thresholds)
    total    = len(steps)
    results  = []

    if total == 0:
        st.warning("No steps to run. Check column mapping and step toggles.")
        return df, results, 0.0

    _start_time    = time.time()
    progress_bar   = st.progress(0, text="Starting pipeline...")
    results_area   = st.container()

    with results_area:
        for i, step in enumerate(steps):
            label = step["label"]
            pct   = int((i / total) * 100)
            progress_bar.progress(pct, text=f"Running: {label}")

            # For validate_phone_state: check prerequisite column now (it may have just been created)
            if step.get("deferred"):
                std_col = step["kwargs"].get("area_code_mobile_number_column", "")
                if std_col not in df.columns:
                    with st.container():
                        st.warning(f"⏭ SKIP — {label} (prerequisite column not found)")
                    results.append({"step": step["name"], "label": label, "status": "skipped",
                                    "detail": "prerequisite column not found", "elapsed": 0.0})
                    progress_bar.progress(int(((i + 1) / total) * 100))
                    continue

            with st.status(label, state="running") as status:
                try:
                    _t0 = time.time()
                    df, detail = step["func"](df, **step["kwargs"])
                    _elapsed = time.time() - _t0
                    detail_str = _fmt(detail)
                    st.write(f"✅ {detail_str}")
                    status.update(label=label, state="complete")
                    results.append({"step": step["name"], "label": label, "status": "ok",
                                    "detail": detail, "elapsed": _elapsed})
                except Exception as e:
                    import traceback
                    _elapsed = time.time() - _t0
                    st.error(str(e))
                    st.code(traceback.format_exc(), language="python")
                    status.update(label=label, state="error")
                    results.append({"step": step["name"], "label": label, "status": "exception",
                                    "detail": str(e), "elapsed": _elapsed})

            progress_bar.progress(int(((i + 1) / total) * 100),
                                   text=f"Completed: {label}")

    progress_bar.progress(100, text="Pipeline complete!")
    elapsed = time.time() - _start_time
    return df, results, elapsed


def _fmt_elapsed(seconds: float) -> str:
    if seconds >= 60:
        m = int(seconds // 60)
        s = int(seconds % 60)
        return f"{m}m {s}s"
    return f"{seconds:.1f}s"


def render_results_summary(results: list):
    if not results:
        return
    ok   = sum(1 for r in results if r["status"] == "ok")
    skip = sum(1 for r in results if r["status"] == "skipped")
    fail = sum(1 for r in results if r["status"] == "exception")

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total Steps", len(results))
    c2.metric("OK", ok, delta=None)
    c3.metric("Skipped", skip)
    c4.metric("Failed", fail, delta=None)


def render_elapsed(elapsed: float):
    st.metric("Pipeline Time", _fmt_elapsed(elapsed))


def render_step_timings(results: list):
    if not results:
        return
    status_icon = {"ok": "✅", "skipped": "⏭", "exception": "❌"}
    rows = [
        {
            "Step": r.get("label", r["step"]),
            "Status": status_icon.get(r["status"], r["status"]),
            "Time": f"{r.get('elapsed', 0.0):.2f}s",
        }
        for r in results
    ]
    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
