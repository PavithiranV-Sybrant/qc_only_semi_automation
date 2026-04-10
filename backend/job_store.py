"""
In-memory job store for background pipeline execution.
Each job tracks status, step progress, and results.
"""
import uuid
from datetime import datetime, timezone
from typing import Dict, Any

_jobs: Dict[str, Dict[str, Any]] = {}


def create_job(session_id: str, file_name: str = "") -> str:
    jid = str(uuid.uuid4())
    _jobs[jid] = {
        "status":           "pending",
        "session_id":       session_id,
        "file_name":        file_name,
        "started_at":       datetime.now(timezone.utc).isoformat(),
        "type":             "single",
        "step_index":       0,
        "total_steps":      0,
        "current_step":     "Starting...",
        "results":          None,
        "new_columns":      None,
        "new_cols_summary": None,
        "distributions":    None,
        "elapsed_total":    0.0,
        "error":            None,
        "cancelled":        False,
        "download_ready":   False,
        "storage_file_id":  None,
    }
    return jid


def get_job(jid: str) -> Dict[str, Any] | None:
    return _jobs.get(jid)


def update_job(jid: str, data: Dict[str, Any]):
    if jid in _jobs:
        _jobs[jid].update(data)


def list_jobs() -> list:
    """Return all jobs sorted newest-first."""
    jobs = [{"id": jid, **job} for jid, job in _jobs.items()]
    return sorted(jobs, key=lambda j: j.get("started_at") or "", reverse=True)


def dismiss_job(jid: str) -> bool:
    """Remove a job from the store. Returns True if it existed."""
    if jid in _jobs:
        del _jobs[jid]
        return True
    return False
