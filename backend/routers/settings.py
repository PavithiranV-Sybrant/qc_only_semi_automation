from fastapi import APIRouter
from pydantic import BaseModel
from backend.settings_store import load_settings, save_settings
from backend import llm_client

router = APIRouter()


class SettingsBody(BaseModel):
    groq_api_key: str = ""


@router.get("/settings")
def get_settings():
    s = load_settings()
    # Mask the key — only return whether it's set
    key = s.get("groq_api_key", "")
    return {
        "groq_api_key": key,
        "has_key": bool(key),
        "model": llm_client.MODEL,
    }


@router.post("/settings")
def post_settings(body: SettingsBody):
    save_settings({"groq_api_key": body.groq_api_key.strip()})
    return {"status": "saved"}


@router.post("/settings/test-connection")
def test_connection():
    s = load_settings()
    key = s.get("groq_api_key", "").strip()
    if not key:
        return {"status": "error", "message": "No API key configured."}
    try:
        reply = llm_client.test_connection(key)
        return {"status": "ok", "model": llm_client.MODEL, "reply": reply}
    except Exception as e:
        return {"status": "error", "message": str(e)}
