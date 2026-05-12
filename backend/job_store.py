import uuid
from typing import Optional

_jobs: dict = {}


def create_job(session_id: str, file_name: str) -> str:
    jid = str(uuid.uuid4())
    _jobs[jid] = {
        "job_id": jid,
        "session_id": session_id,
        "file_name": file_name,
        "status": "pending",   # pending | running | done | error
        "phase": "",
        "message": "Queued",
        "pct": 0,
        "role_map": None,
        "step_results": [],
        "error": None,
        "total_rows": 0,
        "columns_added": [],
        "quality_score": 0.0,
    }
    return jid


def get_job(jid: str) -> Optional[dict]:
    return _jobs.get(jid)


def list_jobs() -> list:
    return list(_jobs.values())


def update_job(jid: str, **kwargs):
    if jid in _jobs:
        _jobs[jid].update(kwargs)
