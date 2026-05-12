import uuid
from typing import Optional

_store: dict = {}


def create_session(df_original, file_name: str) -> str:
    sid = str(uuid.uuid4())
    _store[sid] = {
        "df_original": df_original,
        "file_name": file_name,
        "excel_bytes": None,
    }
    return sid


def get_session(sid: str) -> Optional[dict]:
    return _store.get(sid)


def set_excel_bytes(sid: str, data: bytes):
    if sid in _store:
        _store[sid]["excel_bytes"] = data


def delete_session(sid: str):
    _store.pop(sid, None)
