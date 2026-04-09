import json
from pathlib import Path

import streamlit as st
from fuzzywuzzy import fuzz

_BASE = Path(__file__).parent.parent
_TEMPLATES_DIR = _BASE / "instructions" / "templates"
_CONFIG_PATH   = _BASE / "instructions" / "runner_config.json"

# Logical column roles (ordered for display)
LOGICAL_ROLES = [
    ("full_name",        "Full Name (to split)"),
    ("first_name",       "First Name"),
    ("middle_name",      "Middle Name"),
    ("last_name",        "Last Name"),
    ("company",          "Company"),
    ("email",            "Email"),
    ("office_state",     "Office State"),
    ("employee_count",   "Employee Count"),
    ("linkedin",         "LinkedIn"),
    ("primary_industry", "Primary Industry"),
    ("job_title",        "Job Title"),
    ("sic_code",         "SIC Code"),
]


def _load_templates() -> dict:
    templates = {}
    if _TEMPLATES_DIR.exists():
        for f in _TEMPLATES_DIR.glob("*.json"):
            try:
                data = json.loads(f.read_text())
                if "columns" in data:
                    templates[f.stem] = data["columns"]
            except Exception:
                pass
    return templates


def _best_match(header: str, candidates: list[str]) -> tuple[str, int]:
    """Return (best_candidate, score) for a given header against a list."""
    best, best_score = "", 0
    for c in candidates:
        s = fuzz.token_sort_ratio(header.lower(), c.lower())
        if s > best_score:
            best, best_score = c, s
    return best, best_score


def _detect_best_template(df_cols: list[str], templates: dict) -> tuple[str, dict, int]:
    """Return (template_name, column_map, aggregate_score)."""
    best_name, best_map, best_score = "", {}, 0
    for name, col_map in templates.items():
        score = 0
        count = 0
        for role, expected in col_map.items():
            if role == "phone_columns":
                for ph in (expected if isinstance(expected, list) else [expected]):
                    _, s = _best_match(ph, df_cols)
                    score += s
                    count += 1
            else:
                _, s = _best_match(str(expected), df_cols)
                score += s
                count += 1
        avg = score / count if count else 0
        if avg > best_score:
            best_name, best_map, best_score = name, col_map, avg
    return best_name, best_map, int(best_score)


def render_column_mapper(df):
    """
    Renders column mapping UI in the sidebar.
    Writes result into st.session_state.column_mapping.
    """
    templates = _load_templates()
    df_cols   = list(df.columns)
    options   = ["(unmapped)"] + df_cols

    tab_auto, tab_manual = st.tabs(["Auto Match", "Manual"])

    # ------------------------------------------------------------------
    # AUTO MATCH TAB
    # ------------------------------------------------------------------
    with tab_auto:
        tmpl_name, tmpl_map, score = _detect_best_template(df_cols, templates)
        if tmpl_name:
            st.success(f"Detected: **{tmpl_name}** (confidence {score}%)")
        else:
            st.info("No existing template detected. Using defaults.")

        st.markdown("**Adjust column mappings:**")

        mapping = {}

        for role, label in LOGICAL_ROLES:
            # Get expected header from detected template or config
            if tmpl_name and role in tmpl_map:
                expected = tmpl_map[role]
                if isinstance(expected, list):
                    expected = expected[0] if expected else ""
            else:
                expected = ""

            best, _ = _best_match(str(expected), df_cols) if expected else ("(unmapped)", 0)
            default_idx = options.index(best) if best in options else 0

            mapping[role] = st.selectbox(
                label, options, index=default_idx, key=f"auto_{role}"
            )

        # Phone columns (multi-select)
        if tmpl_name and "phone_columns" in tmpl_map:
            ph_expected = tmpl_map["phone_columns"]
            if isinstance(ph_expected, list):
                ph_defaults = [c for c in ph_expected if c in df_cols]
            else:
                ph_defaults = [ph_expected] if ph_expected in df_cols else []
        else:
            ph_defaults = []

        mapping["phone_columns"] = st.multiselect(
            "Phone Columns", df_cols, default=ph_defaults, key="auto_phone"
        )

        # Clean up unmapped
        mapping = {k: v for k, v in mapping.items() if v != "(unmapped)"}

        col1, col2 = st.columns(2)
        if col1.button("Apply Auto Mapping", use_container_width=True):
            st.session_state.column_mapping = mapping
            st.success("Mapping applied.")

        # Save as new template
        new_name = col2.text_input("Template name", placeholder="my_template", key="new_tmpl_name")
        if col2.button("Save Template", use_container_width=True):
            if new_name.strip():
                out = {"_comment": f"Custom template: {new_name}", "sheet_name": None, "columns": mapping}
                path = _TEMPLATES_DIR / f"{new_name.strip()}.json"
                path.write_text(json.dumps(out, indent=4))
                st.success(f"Saved as {path.name}")
            else:
                st.warning("Enter a template name first.")

    # ------------------------------------------------------------------
    # MANUAL TAB
    # ------------------------------------------------------------------
    with tab_manual:
        st.markdown("**Select columns manually:**")

        m_mapping = {}
        for role, label in LOGICAL_ROLES:
            m_mapping[role] = st.selectbox(
                label, options, key=f"manual_{role}"
            )

        m_mapping["phone_columns"] = st.multiselect(
            "Phone Columns", df_cols, key="manual_phone"
        )

        m_mapping = {k: v for k, v in m_mapping.items() if v != "(unmapped)"}

        if st.button("Apply Manual Mapping", use_container_width=True):
            st.session_state.column_mapping = m_mapping
            st.success("Mapping applied.")
