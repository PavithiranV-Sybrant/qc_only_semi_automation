"""
Autonomous agent router — LLM-driven column mapping and step selection.

Endpoints
---------
POST /api/autonomous/analyze          analyse uploaded file with LLM
POST /api/autonomous/test-connection  verify API key + model are valid
GET  /api/autonomous/models           list available Groq models
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.session_store import get_session
from backend.settings_store import load_settings
from backend import llm_client

router = APIRouter()


class AnalyzeRequest(BaseModel):
    session_id: str


@router.post("/autonomous/analyze")
def autonomous_analyze(req: AnalyzeRequest):
    """
    Reads column names + up to 5 sample rows from the session, sends them
    to the configured Groq LLM, and returns suggested column_mapping + steps.
    """
    sess = get_session(req.session_id)
    if not sess:
        raise HTTPException(404, "Session not found — please re-upload the file.")

    settings = load_settings()
    api_key  = settings.get("llm_api_key", "").strip()
    model    = settings.get("llm_model", "llama-3.3-70b-versatile")

    if not api_key:
        raise HTTPException(
            400,
            "No LLM API key configured. Go to Settings → LLM Configuration and add your Groq API key.",
        )

    df      = sess["df_original"]
    columns = list(df.columns)

    # Build safe sample rows (NaN → None, everything cast to object)
    sample_df   = df.head(5).copy().astype(object)
    sample_rows = [
        {col: (None if val != val else val)  # NaN != NaN in Python
         for col, val in row.items()}
        for row in sample_df.to_dict(orient="records")
    ]

    try:
        result = llm_client.analyze_columns(api_key, model, columns, sample_rows)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))

    return {**result, "model_used": model, "columns": columns}


@router.post("/autonomous/test-connection")
def test_connection():
    """Verify the saved API key and model with a minimal LLM call."""
    settings = load_settings()
    api_key  = settings.get("llm_api_key", "").strip()
    model    = settings.get("llm_model", "llama-3.3-70b-versatile")

    if not api_key:
        raise HTTPException(400, "No API key configured. Please save one in Settings first.")

    try:
        reply = llm_client.test_connection(api_key, model)
        return {"status": "ok", "model": model, "reply": reply}
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))


@router.get("/autonomous/models")
def list_models():
    """Return the list of supported Groq models."""
    return {"models": llm_client.GROQ_MODELS}
