"""
Persistent on-disk file registry.
Processed Excel outputs are saved to data/outputs/ and tracked in data/file_registry.json.
Thread-safe: all registry mutations are protected by a single lock.
"""
import json
import threading
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

_PROJECT_ROOT = Path(__file__).parent.parent
_DATA_DIR     = _PROJECT_ROOT / "data"
_OUTPUTS_DIR  = _DATA_DIR / "outputs"
_REGISTRY     = _DATA_DIR / "file_registry.json"

_lock = threading.Lock()


# ─── internal helpers ───────────────────────────────────────────────────────

def _load() -> list:
    """Load registry from disk (call with lock held)."""
    if _REGISTRY.exists():
        try:
            return json.loads(_REGISTRY.read_text(encoding="utf-8"))
        except Exception:
            return []
    return []


def _save(records: list) -> None:
    """Write registry to disk (call with lock held)."""
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    _REGISTRY.write_text(json.dumps(records, indent=2), encoding="utf-8")


# ─── public API ─────────────────────────────────────────────────────────────

def save_file(original_name: str, excel_bytes: bytes) -> dict:
    """Persist excel bytes to disk and add a registry entry. Returns the record."""
    _OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    file_id   = str(uuid.uuid4())
    stem      = original_name.rsplit(".", 1)[0]
    disk_name = f"{file_id}_{stem}.xlsx"
    path      = _OUTPUTS_DIR / disk_name
    path.write_bytes(excel_bytes)

    record = {
        "id":            file_id,
        "file_name":     f"qc_{stem}.xlsx",        # download name shown to user
        "original_name": original_name,
        "saved_at":      datetime.now(timezone.utc).isoformat(),
        "size_bytes":    len(excel_bytes),
        "path":          str(path),
    }

    with _lock:
        records = _load()
        records.append(record)
        _save(records)

    return record


def list_files() -> list:
    """Return all valid registry entries, newest first. Prunes missing files."""
    with _lock:
        records = _load()
        valid = [r for r in records if Path(r["path"]).exists()]
        if len(valid) != len(records):
            _save(valid)
    return sorted(valid, key=lambda r: r["saved_at"], reverse=True)


def get_file(file_id: str) -> dict | None:
    """Return a single registry entry by id, or None if not found / missing on disk."""
    with _lock:
        records = _load()
    rec = next((r for r in records if r["id"] == file_id), None)
    if rec and Path(rec["path"]).exists():
        return rec
    return None


def delete_file(file_id: str) -> bool:
    """Remove a file from disk and registry. Returns True if found."""
    with _lock:
        records = _load()
        rec = next((r for r in records if r["id"] == file_id), None)
        if not rec:
            return False
        path = Path(rec["path"])
        if path.exists():
            path.unlink()
        _save([r for r in records if r["id"] != file_id])
    return True


def delete_all_files() -> int:
    """Delete every stored file and clear the registry. Returns count deleted."""
    with _lock:
        records = _load()
        for r in records:
            p = Path(r["path"])
            if p.exists():
                p.unlink()
        _save([])
    return len(records)


def cleanup_old_files(backup_days: int) -> int:
    """Delete files older than backup_days. Returns count deleted."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=backup_days)

    with _lock:
        records = _load()
        keep, purge = [], []
        for r in records:
            ts = datetime.fromisoformat(r["saved_at"])
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            (purge if ts < cutoff else keep).append(r)

        for r in purge:
            p = Path(r["path"])
            if p.exists():
                p.unlink()
        _save(keep)

    return len(purge)
