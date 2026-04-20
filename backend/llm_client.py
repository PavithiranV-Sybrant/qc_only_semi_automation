"""
Groq LLM client for autonomous file analysis.
Handles rate-limit retries with exponential back-off (5 s → 10 s → 20 s).
"""
import json
import re
import time

# ── Available models ──────────────────────────────────────────────────────────
GROQ_MODELS = [
    {"id": "llama-3.3-70b-versatile",      "name": "Llama 3.3 70B Versatile",          "context": "128K"},
    {"id": "openai/gpt-oss-120b",           "name": "GPT-OSS 120B (Structured Output)",  "context": "128K"},
    {"id": "openai/gpt-oss-20b",            "name": "GPT-OSS 20B (Structured Output)",   "context": "128K"},
    {"id": "deepseek-r1-distill-llama-70b", "name": "DeepSeek R1 Distill 70B",           "context": "128K"},
    {"id": "llama-3.1-8b-instant",          "name": "Llama 3.1 8B Instant (Fast)",       "context": "128K"},
    {"id": "qwen/qwen3-32b",                "name": "Qwen3 32B",                          "context": "256K"},
]

_ALL_ROLES = [
    "first_name", "last_name", "middle_name", "full_name",
    "company", "email", "phone_columns",
    "office_state", "employee_count", "linkedin",
    "primary_industry", "job_title", "sic_code",
    "link_text", "description",
    "unique_identifier", "facebook", "facebook_link_text", "facebook_description",
]

_ALL_STEPS = [
    "name_split", "dot_remove", "name_company_match", "non_alpha_name_handle",
    "email_structure_validation", "company_email_domain_match", "name_email_fuzzy_match",
    "normalize_phone_excel", "validate_phone_state", "normalize_employee_count",
    "name_linkedin_fuzzy_match", "extract_primary_industry", "job_title_categories",
    "sic_code_naics", "link_text_match", "unique_identifier_check", "facebook_match",
]

# Models that support strict JSON schema enforcement (vs json_object mode)
_STRUCTURED_OUTPUT_MODELS = {"openai/gpt-oss-20b", "openai/gpt-oss-120b"}


def _build_prompt(columns: list, sample_rows: list) -> str:
    rows_preview = json.dumps(sample_rows[:5], default=str)
    return f"""You are a data quality expert for business contact databases.

EXCEL COLUMNS: {json.dumps(columns)}

SAMPLE DATA (first {min(5, len(sample_rows))} rows):
{rows_preview}

TASK: Map each column to its QC role and decide which steps to enable.

ROLES (set value to exact column name from the list above, or null if not present):
first_name, last_name, middle_name, full_name, company, email,
phone_columns (array — list ALL phone-type columns),
office_state, employee_count, linkedin, primary_industry, job_title, sic_code,
link_text, description, unique_identifier,
facebook, facebook_link_text, facebook_description

ENABLE a step only if ALL its required columns are mapped:
- name_split        → needs full_name
- dot_remove        → needs first_name + last_name
- name_company_match → needs first_name + last_name + company
- non_alpha_name_handle → needs first_name + last_name
- email_structure_validation → needs email
- company_email_domain_match → needs company + email
- name_email_fuzzy_match → needs first_name + last_name + email
- normalize_phone_excel → needs phone_columns (non-empty)
- validate_phone_state → needs phone_columns + office_state
- normalize_employee_count → needs employee_count
- name_linkedin_fuzzy_match → needs first_name + last_name + linkedin
- extract_primary_industry → needs primary_industry
- job_title_categories → needs job_title
- sic_code_naics → needs sic_code
- link_text_match → needs company + (first_name+last_name OR full_name) + link_text + description
- unique_identifier_check → needs unique_identifier (default OFF unless column clearly exists)
- facebook_match → needs first_name + last_name AND (facebook OR facebook_link_text OR facebook_description)

Respond with ONLY valid JSON — no markdown, no extra text:
{{"column_mapping":{{"first_name":null,"last_name":null,"middle_name":null,"full_name":null,"company":null,"email":null,"phone_columns":[],"office_state":null,"employee_count":null,"linkedin":null,"primary_industry":null,"job_title":null,"sic_code":null,"link_text":null,"description":null,"unique_identifier":null,"facebook":null,"facebook_link_text":null,"facebook_description":null}},"steps":{{"name_split":false,"dot_remove":false,"name_company_match":false,"non_alpha_name_handle":false,"email_structure_validation":false,"company_email_domain_match":false,"name_email_fuzzy_match":false,"normalize_phone_excel":false,"validate_phone_state":false,"normalize_employee_count":false,"name_linkedin_fuzzy_match":false,"extract_primary_industry":false,"job_title_categories":false,"sic_code_naics":false,"link_text_match":false,"unique_identifier_check":false,"facebook_match":false}},"reasoning":"explain your mapping decisions","confidence":0.9}}"""


def _parse_llm_response(raw: str) -> dict:
    """Strip markdown fences / think-blocks and extract the JSON object."""
    # Remove DeepSeek <think> blocks
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
    # Strip markdown code fences
    raw = re.sub(r"^```(?:json)?\s*\n?", "", raw)
    raw = re.sub(r"\n?```\s*$", "", raw).strip()
    # Extract the outermost JSON object if there is surrounding text
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if m:
        raw = m.group(0)
    return json.loads(raw)


def _normalise_result(result: dict) -> dict:
    """Ensure all expected keys exist in the returned dict."""
    mapping = result.get("column_mapping", {})
    steps   = result.get("steps", {})

    for role in _ALL_ROLES:
        if role not in mapping:
            mapping[role] = [] if role == "phone_columns" else None

    for step in _ALL_STEPS:
        if step not in steps:
            steps[step] = False

    return {
        "column_mapping": mapping,
        "steps":          steps,
        "reasoning":      result.get("reasoning", ""),
        "confidence":     float(result.get("confidence", 0.0)),
    }


def analyze_columns(api_key: str, model: str, columns: list, sample_rows: list) -> dict:
    """
    Send column names + sample data to the Groq LLM and get back a
    column_mapping + step selection dict.

    Retries up to 3 times on rate-limit (HTTP 429) errors, with
    exponential back-off: 5 s → 10 s → 20 s.
    """
    try:
        from groq import Groq
    except ImportError:
        raise RuntimeError("groq package not installed. Run: pip install groq")

    client = Groq(api_key=api_key)
    prompt = _build_prompt(columns, sample_rows)
    use_json_mode = model not in _STRUCTURED_OUTPUT_MODELS

    last_exc = None
    for attempt in range(3):
        try:
            kwargs = dict(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=1500,
            )
            if use_json_mode:
                kwargs["response_format"] = {"type": "json_object"}

            completion = client.chat.completions.create(**kwargs)
            raw    = (completion.choices[0].message.content or "").strip()
            parsed = _parse_llm_response(raw)
            return _normalise_result(parsed)

        except Exception as exc:
            err_str = str(exc)
            is_rate_limit = (
                "429" in err_str
                or "rate_limit" in err_str.lower()
                or "rate limit" in err_str.lower()
                or "ratelimit" in err_str.lower()
            )
            if is_rate_limit:
                last_exc = exc
                wait = 5 * (2 ** attempt)   # 5 s, 10 s, 20 s
                time.sleep(wait)
                continue
            raise RuntimeError(f"LLM error: {err_str}") from exc

    raise RuntimeError(
        f"Groq rate limit reached — retried 3 times. "
        f"Please wait a moment and try again. (last error: {last_exc})"
    )


def test_connection(api_key: str, model: str) -> str:
    """
    Make a minimal API call to verify the key and model are valid.
    Returns the model's short reply on success, raises RuntimeError otherwise.
    """
    try:
        from groq import Groq
    except ImportError:
        raise RuntimeError("groq package not installed. Run: pip install groq")

    client = Groq(api_key=api_key)
    completion = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": "Reply with exactly: ok"}],
        max_tokens=10,
        temperature=0,
    )
    return (completion.choices[0].message.content or "ok").strip()
