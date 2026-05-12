"""
4-Layer column role detection:
  Layer 1 — Header regex (fast, zero tokens)
  Layer 2 — Value pattern matching (zero tokens)
  Layer 3 — LLM for remaining unmatched columns (minimal tokens)

Returns a flat role_map: {role: column_name} and {phone_columns: [list]}
"""
from backend.examine.column_profiler import profile_columns
from backend.examine.header_patterns import header_match
from backend.examine.value_detectors import value_pattern_match


def detect_roles(df, api_key: str = "", progress_cb=None) -> dict:
    """
    Full 4-layer detection. Returns role_map dict used by pipeline_runner.
    role_map format: {"email": "col_name", "phone_columns": ["col1","col2"], ...}
    """
    if progress_cb:
        progress_cb("Profiling columns...", 6)

    profiles = profile_columns(df)

    if progress_cb:
        progress_cb("Layer 1: Header pattern matching...", 8)

    # Layer 1 — header regex
    role_map = header_match(profiles)

    if progress_cb:
        progress_cb("Layer 2: Value pattern matching...", 10)

    # Layer 2 — value patterns on unmatched columns
    role_map = value_pattern_match(profiles, role_map)

    # Layer 3 — LLM for still-unmatched columns
    mapped_cols = _mapped_cols(role_map)
    unmatched = [p for p in profiles if p.header not in mapped_cols and p.null_pct < 90]

    if unmatched and api_key:
        if progress_cb:
            progress_cb(f"Layer 3: LLM detecting {len(unmatched)} remaining columns...", 12)
        try:
            from backend.llm_client import llm_infer_unmatched
            sample_rows = _sample_rows(df, 3)
            llm_result = llm_infer_unmatched(api_key, unmatched, sample_rows)

            phone_cols = list(role_map.get("phone_columns", []))
            for col, role in llm_result.items():
                if role == "phone":
                    if col not in {p["column"] for p in phone_cols}:
                        phone_cols.append({"column": col, "confidence": 0.70, "layer": 3})
                elif role not in role_map:
                    role_map[role] = {"column": col, "confidence": 0.70, "layer": 3}
            if phone_cols:
                role_map["phone_columns"] = phone_cols

        except Exception as e:
            print(f"[layer3] LLM inference skipped: {e}")
    elif unmatched:
        if progress_cb:
            progress_cb(f"Layer 3 skipped (no API key) — {len(unmatched)} columns undetected", 12)

    if progress_cb:
        detected = len([k for k in role_map if k != "phone_columns"]) + len(role_map.get("phone_columns", []))
        progress_cb(f"Detected {detected} column roles", 14)

    # Flatten: convert {"column": x, "confidence": y} → just column name string
    return _flatten(role_map)


def _flatten(role_map: dict) -> dict:
    """Convert internal format to simple {role: col_name} for pipeline_runner."""
    flat = {}
    for role, val in role_map.items():
        if role == "phone_columns":
            if isinstance(val, list):
                flat["phone_columns"] = [p["column"] if isinstance(p, dict) else p for p in val]
            else:
                flat["phone_columns"] = []
        elif isinstance(val, dict) and "column" in val:
            flat[role] = val["column"]
        else:
            flat[role] = val
    if "phone_columns" not in flat:
        flat["phone_columns"] = []
    return flat


def _mapped_cols(role_map: dict) -> set:
    cols = set()
    for k, v in role_map.items():
        if k == "phone_columns" and isinstance(v, list):
            cols.update(p["column"] if isinstance(p, dict) else p for p in v)
        elif isinstance(v, dict) and "column" in v:
            cols.add(v["column"])
    return cols


def _sample_rows(df, n: int) -> list:
    import pandas as pd
    rows = []
    for _, row in df.head(n).iterrows():
        rows.append({col: (None if pd.isna(val) else str(val)) for col, val in row.items()})
    return rows
