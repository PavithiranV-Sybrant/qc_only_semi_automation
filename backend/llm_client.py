"""
Layer 3: LLM inference — only for columns not caught by header/value patterns.
Model: openai/gpt-oss-120b (locked). Sends unmatched columns in one batch.
"""
import re
import json
import time

from backend.rate_limiter import make_rate_limiter, RateLimitExhausted

MODEL = "openai/gpt-oss-120b"
MAX_RETRIES = 5
_BACKOFF_BASE = 10

_ALL_ROLES = [
    "first_name", "last_name", "middle_name", "full_name",
    "company", "email", "phone",
    "office_state", "employee_count", "linkedin",
    "primary_industry", "job_title", "sic_code",
    "link_text", "description", "unique_identifier",
    "facebook", "facebook_link_text", "facebook_description",
    "company_revenue", "city", "state", "postal_code",
]

_SYSTEM = """You are a data quality expert. Identify the role of each spreadsheet column.

Available roles:
first_name, last_name, middle_name, full_name, company, email, phone,
office_state, employee_count, linkedin, primary_industry, job_title,
sic_code, link_text, description, unique_identifier, facebook,
facebook_link_text, facebook_description, company_revenue, city, state, postal_code

Return ONLY a JSON object: {"Column Name": "role_or_null", ...}
Use null if no role fits. No markdown, no explanation."""


def llm_infer_unmatched(api_key: str, unmatched_profiles: list, sample_rows: list) -> dict:
    """
    Send only unmatched columns to LLM. Returns {column_name: role} dict.
    Uses a single LLM call for all unmatched columns (token-efficient).
    """
    if not unmatched_profiles:
        return {}

    try:
        from groq import Groq
    except ImportError:
        raise RuntimeError("groq not installed. Run: pip install groq")

    limiter = make_rate_limiter(MODEL)
    client = Groq(api_key=api_key)

    col_descriptions = []
    for profile in unmatched_profiles:
        samples = [s for s in profile.sample_values[:5] if s and s.lower() not in ("nan", "none", "")]
        col_descriptions.append(
            f'Column: "{profile.header}"\nSamples: {", ".join(samples) or "(empty)"}'
        )

    user_prompt = (
        "Identify the role of each column. Return JSON with column names as keys.\n\n"
        + "\n\n".join(col_descriptions)
    )

    estimated_tokens = max(300, len(user_prompt) // 4 + 300)

    for attempt in range(MAX_RETRIES):
        try:
            try:
                limiter.wait_if_needed(estimated_tokens)
            except RateLimitExhausted as e:
                raise RuntimeError(f"Daily quota exhausted: {e}")

            resp = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": _SYSTEM},
                    {"role": "user",   "content": user_prompt},
                ],
                temperature=0,
                max_tokens=600,
            )
            raw = (resp.choices[0].message.content or "").strip()

            if hasattr(resp, "usage") and resp.usage:
                actual = (resp.usage.prompt_tokens or 0) + (resp.usage.completion_tokens or 0)
                if actual > 0:
                    limiter.record_usage(actual)

            return _parse(raw)

        except Exception as exc:
            err = str(exc)
            is_rate = "429" in err or "rate_limit" in err.lower() or "too many" in err.lower()
            if is_rate and attempt < MAX_RETRIES - 1:
                m = re.search(r"try again in\s+([\d.]+)s", err, re.I)
                wait = float(m.group(1)) + 1.0 if m else _BACKOFF_BASE * (2 ** attempt)
                print(f"[rate-limit] waiting {min(wait, 180):.0f}s...")
                time.sleep(min(wait, 180))
                continue
            raise RuntimeError(f"LLM error: {err}") from exc

    return {}


def _parse(raw: str) -> dict:
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
    raw = re.sub(r"^```(?:json)?\s*\n?", "", raw)
    raw = re.sub(r"\n?```\s*$", "", raw).strip()
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if m:
        raw = m.group(0)
    try:
        result = json.loads(raw)
        return {k: v for k, v in result.items() if v and v != "null" and v in _ALL_ROLES}
    except Exception:
        return {}


def test_connection(api_key: str) -> str:
    try:
        from groq import Groq
    except ImportError:
        raise RuntimeError("groq not installed")
    client = Groq(api_key=api_key)
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": "Reply: ok"}],
        max_tokens=5, temperature=0,
    )
    return (resp.choices[0].message.content or "ok").strip()
