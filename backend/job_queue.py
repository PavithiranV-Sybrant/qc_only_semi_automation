"""
Global sequential job queue.
A single daemon thread processes one job at a time in submission order.
Both single-file jobs and entire batches are enqueued here, so the system
processes one job at a time across all modes.
"""
import threading
import queue as _q
from typing import Callable

_queue: _q.Queue = _q.Queue()
_store: list[dict] = []
_lock = threading.Lock()


def _worker():
    while True:
        fn = _queue.get()
        try:
            fn()
        finally:
            _queue.task_done()


# Start the single worker daemon on module import
threading.Thread(target=_worker, daemon=True, name="job-queue-worker").start()


def enqueue(fn: Callable, meta: dict) -> str:
    """
    Append a job to the queue.
    meta must contain: id (str), type ('single'|'batch'), label (str).
    Returns the item id.
    """
    with _lock:
        _store.append({**meta, "status": "queued"})
    _queue.put(fn)
    return meta["id"]


def list_queue() -> list:
    """Return a snapshot of all queue entries."""
    with _lock:
        return list(_store)


def _set(item_id: str, **kw):
    with _lock:
        for item in _store:
            if item["id"] == item_id:
                item.update(kw)
                return


def mark_running(item_id: str):
    _set(item_id, status="running")


def mark_done(item_id: str):
    _set(item_id, status="done")


def mark_error(item_id: str, err: str = ""):
    _set(item_id, status="error", error=err)


def mark_cancelled(item_id: str):
    _set(item_id, status="cancelled")
