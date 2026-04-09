import uuid
from typing import Dict, Any

_sessions: Dict[str, Dict[str, Any]] = {}


def create_session() -> str:
    sid = str(uuid.uuid4())
    _sessions[sid] = {}
    return sid


def get_session(sid: str) -> Dict[str, Any]:
    return _sessions.get(sid, {})


def update_session(sid: str, data: Dict[str, Any]):
    if sid not in _sessions:
        _sessions[sid] = {}
    _sessions[sid].update(data)
