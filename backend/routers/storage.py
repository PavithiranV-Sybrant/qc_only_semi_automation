from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from backend.file_store import (
    list_files, get_file, delete_file, delete_all_files, cleanup_old_files,
)
from backend.settings_store import load_settings, save_settings

router = APIRouter()


# ─── settings ────────────────────────────────────────────────────────────────

class SettingsPayload(BaseModel):
    backup_days: int = Field(..., ge=1, le=365)


@router.get("/settings")
def get_settings():
    return load_settings()


@router.post("/settings")
def update_settings(payload: SettingsPayload):
    return save_settings({"backup_days": payload.backup_days})


# ─── file history ─────────────────────────────────────────────────────────────

@router.get("/storage/files")
def list_stored_files():
    return list_files()


@router.get("/storage/download/{file_id}")
def download_stored_file(file_id: str):
    rec = get_file(file_id)
    if not rec:
        raise HTTPException(404, "File not found.")
    return FileResponse(
        path=rec["path"],
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=rec["file_name"],
    )


@router.delete("/storage/files/{file_id}")
def delete_stored_file(file_id: str):
    if not delete_file(file_id):
        raise HTTPException(404, "File not found.")
    return {"status": "deleted"}


@router.delete("/storage/files")
def delete_all_stored_files():
    count = delete_all_files()
    return {"deleted_count": count}


@router.post("/storage/cleanup")
def manual_cleanup():
    settings = load_settings()
    count    = cleanup_old_files(settings["backup_days"])
    return {"deleted_count": count, "backup_days": settings["backup_days"]}
