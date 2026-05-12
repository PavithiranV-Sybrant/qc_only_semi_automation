import json
import os

_SETTINGS_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "settings.json")
_DEFAULTS = {
    "groq_api_key": "",
}


def load_settings() -> dict:
    path = os.path.abspath(_SETTINGS_PATH)
    if not os.path.exists(path):
        return dict(_DEFAULTS)
    try:
        with open(path) as f:
            data = json.load(f)
        return {**_DEFAULTS, **data}
    except Exception:
        return dict(_DEFAULTS)


def save_settings(data: dict):
    path = os.path.abspath(_SETTINGS_PATH)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    current = load_settings()
    current.update(data)
    with open(path, "w") as f:
        json.dump(current, f, indent=2)
