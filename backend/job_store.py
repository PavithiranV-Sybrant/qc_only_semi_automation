"""
In-memory job store for background pipeline execution.
Each job tracks status, step progress, and results.
"""
import uuid
from typing import Dict, Any

_jobs: Dict[str, Dict[str, Any]] = {}


def create_job(session_id: str) -> str:
    jid = str(uuid.uuid4())
    _jobs[jid] = {
        "status":       "pending",   # pending | running | preparing_download | done | error | cancelled
        "session_id":   session_id,
        "step_index":   0,
        "total_steps":  0,
        "current_step": "Starting...",
        "results":      None,
        "new_columns":  None,
        "new_cols_summary": None,
        "distributions": None,
        "elapsed_total": 0.0,
        "error":        None,
        "cancelled":    False,
    }
    return jid


def get_job(jid: str) -> Dict[str, Any] | None:
    return _jobs.get(jid)


def update_job(jid: str, data: Dict[str, Any]):
    if jid in _jobs:
        _jobs[jid].update(data)
