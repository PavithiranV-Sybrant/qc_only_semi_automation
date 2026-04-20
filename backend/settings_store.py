"""
Persistent app settings stored in data/settings.json.
"""
import json
from pathlib import Path

_DATA_DIR     = Path(__file__).parent.parent / "data"
_SETTINGS_FILE = _DATA_DIR / "settings.json"

DEFAULTS: dict = {
    "backup_days":    7,
    "llm_provider":   "groq",
    "llm_api_key":    "",
    "llm_model":      "llama-3.3-70b-versatile",
}


def load_settings() -> dict:
    if _SETTINGS_FILE.exists():
        try:
            data = json.loads(_SETTINGS_FILE.read_text(encoding="utf-8"))
            return {**DEFAULTS, **data}
        except Exception:
            pass
    return dict(DEFAULTS)


def save_settings(updates: dict) -> dict:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    current = load_settings()
    merged  = {**current, **updates}
    _SETTINGS_FILE.write_text(json.dumps(merged, indent=2), encoding="utf-8")
    return merged
