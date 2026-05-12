"""
Groq LLM client for autonomous column role detection.
Model: openai/gpt-oss-120b (locked — 30 RPM, 6K TPM)

Batch strategy: reads columns 6 at a time with 3 sample rows to stay
within TPM budget. Results merged after all batches complete.
"""
import re
import json
import time

from backend.rate_limiter import make_rate_limiter, RateLimitExhausted

MODEL = "openai/gpt-oss-120b"
BATCH_SIZE = 6
MAX_SAMPLE_ROWS = 3
MAX_RETRIES = 5
_BACKOFF_BASE = 10

_ALL_ROLES = [
    "first_name", "last_name", "middle_name", "full_name",
    "company", "email", "phone",
    "office_state", "employee_count", "linkedin",
    "primary_industry", "job_title", "sic_code",
    "link_text", "description",
    "unique_identifier", "facebook", "facebook_link_text", "facebook_description",
    "company_revenue", "city", "state", "postal_code",
]

_ROLE_DESCRIPTIONS = {
    "first_name": "contact first name",
    "last_name": "contact last name",
    "middle_name": "contact middle name",
    "full_name": "contact full name (combined first+last)",
    "company": "company/organization name",
    "email": "email address",
    "phone": "phone number (any format)",
    "office_state": "US state (abbreviation like CA, TX, NY)",
    "employee_count": "number of employees / headcount band",
    "linkedin": "LinkedIn profile URL",
    "primary_industry": "industry category (often > delimited)",
    "job_title": "job title / position",
    "sic_code": "SIC code (industry classification number)",
    "link_text": "link anchor text / hyperlink label",
    "description": "text description field",
    "unique_identifier": "unique row ID / record key",
    "facebook": "Facebook profile URL",
    "facebook_link_text": "Facebook link anchor text",
    "facebook_description": "Facebook profile description",
    "company_revenue": "company revenue (e.g. $5M, 10B-50B)",
    "city": "city name",
    "state": "state / province (can overlap office_state if same column)",
    "postal_code": "ZIP / postal code",
}

# Roles that can appear multiple times (phone columns)
_MULTI_ROLES = {"phone"}


def _build_batch_prompt(batch_cols: list[str], sample_rows: list[dict]) -> str:
    roles_desc = "\n".join(f"  {r}: {d}" for r, d in _ROLE_DESCRIPTIONS.items())
    samples_json = json.dumps(
        [{c: row.get(c) for c in batch_cols} for row in sample_rows[:MAX_SAMPLE_ROWS]],
        default=str, ensure_ascii=False
    )
    return f"""You are a data quality expert for business contact databases.

COLUMNS TO CLASSIFY: {json.dumps(batch_cols)}

SAMPLE DATA (up to {MAX_SAMPLE_ROWS} rows, showing only these columns):
{samples_json}

AVAILABLE ROLES:
{roles_desc}

TASK: For each column listed, assign the best matching role from the list above.
- Assign null if no role fits.
- Multiple columns can share "phone" role (e.g. mobile, office phone).
- Use exact column names from the input list.

Respond ONLY with a JSON object. Keys are column names, values are role strings or null.
Example: {{"First Name": "first_name", "Company Email": "email", "Revenue": null}}
"""


def _parse_response(raw: str) -> dict:
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
    raw = re.sub(r"^```(?:json)?\s*\n?", "", raw)
    raw = re.sub(r"\n?```\s*$", "", raw).strip()
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if m:
        raw = m.group(0)
    return json.loads(raw)


def analyze_columns_in_batches(api_key: str, df_columns: list, sample_rows: list) -> dict:
    """
    Analyze all columns in batches of BATCH_SIZE.
    Returns a merged role_map dict: {role: column_name} and {phone: [list]}.
    """
    try:
        from groq import Groq
    except ImportError:
        raise RuntimeError("groq package not installed. Run: pip install groq")

    client = Groq(api_key=api_key)
    limiter = make_rate_limiter(MODEL)

    # Split columns into batches
    batches = [df_columns[i:i + BATCH_SIZE] for i in range(0, len(df_columns), BATCH_SIZE)]
    col_role_map: dict[str, str] = {}  # column_name → role

    for batch_idx, batch in enumerate(batches):
        prompt = _build_batch_prompt(batch, sample_rows)
        estimated_tokens = max(300, len(prompt) // 4 + 200)

        for attempt in range(MAX_RETRIES):
            try:
                try:
                    limiter.wait_if_needed(estimated_tokens)
                except RateLimitExhausted as e:
                    raise RuntimeError(f"Daily quota exhausted: {e}")

                resp = client.chat.completions.create(
                    model=MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0,
                    max_tokens=500,
                )
                raw = (resp.choices[0].message.content or "").strip()

                # Record actual token usage
                if hasattr(resp, "usage") and resp.usage:
                    actual = (resp.usage.prompt_tokens or 0) + (resp.usage.completion_tokens or 0)
                    if actual > 0:
                        limiter.record_usage(actual)

                batch_result = _parse_response(raw)
                # Merge into col_role_map (column → role)
                for col, role in batch_result.items():
                    if col in batch and role and isinstance(role, str):
                        col_role_map[col] = role.strip()
                break  # success

            except Exception as exc:
                err = str(exc)
                is_rate = (
                    "429" in err
                    or "rate_limit" in err.lower()
                    or "ratelimit" in err.lower()
                    or "too many" in err.lower()
                )
                if is_rate and attempt < MAX_RETRIES - 1:
                    # Parse retry-after hint from error message
                    m = re.search(r"try again in\s+([\d.]+)s", err, re.IGNORECASE)
                    wait = float(m.group(1)) + 1.0 if m else _BACKOFF_BASE * (2 ** attempt)
                    wait = min(wait, 180)
                    print(f"[rate-limit] batch {batch_idx+1}/{len(batches)} — waiting {wait:.0f}s")
                    time.sleep(wait)
                    continue
                raise RuntimeError(f"LLM error on batch {batch_idx+1}: {err}") from exc

    # Convert col_role_map → role_map (role → column) with phone as list
    role_map: dict = {}
    phone_cols: list[str] = []

    for col, role in col_role_map.items():
        if role == "phone":
            phone_cols.append(col)
        elif role in _ALL_ROLES:
            if role not in role_map:
                role_map[role] = col
            # If duplicate (two cols claiming same non-phone role), keep first

    role_map["phone_columns"] = phone_cols
    return role_map


def test_connection(api_key: str) -> str:
    try:
        from groq import Groq
    except ImportError:
        raise RuntimeError("groq not installed")
    client = Groq(api_key=api_key)
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": "Reply: ok"}],
        max_tokens=5,
        temperature=0,
    )
    return (resp.choices[0].message.content or "ok").strip()
