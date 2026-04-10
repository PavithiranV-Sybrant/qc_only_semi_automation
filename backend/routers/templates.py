import json
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

_TEMPLATES_DIR = Path(__file__).parent.parent.parent / "instructions" / "templates"


class TemplatePayload(BaseModel):
    comment: Optional[str] = ""
    sheet_name: Optional[str] = None
    columns: dict[str, Any]


@router.get("/templates")
def list_templates():
    templates = []
    if _TEMPLATES_DIR.exists():
        for f in sorted(_TEMPLATES_DIR.glob("*.json")):
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
                templates.append({
                    "name":       f.stem,
                    "comment":    data.get("_comment", ""),
                    "sheet_name": data.get("sheet_name"),
                    "columns":    data.get("columns", {}),
                })
            except Exception:
                pass
    return templates


@router.get("/templates/{name}")
def get_template(name: str):
    path = _TEMPLATES_DIR / f"{name}.json"
    if not path.exists():
        raise HTTPException(404, f"Template '{name}' not found.")
    data = json.loads(path.read_text(encoding="utf-8"))
    return {
        "name":       name,
        "comment":    data.get("_comment", ""),
        "sheet_name": data.get("sheet_name"),
        "columns":    data.get("columns", {}),
    }


@router.post("/templates/{name}")
def save_template(name: str, payload: TemplatePayload):
    safe = "".join(c for c in name if c.isalnum() or c in "_-")
    if not safe:
        raise HTTPException(400, "Invalid template name.")
    _TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)
    path = _TEMPLATES_DIR / f"{safe}.json"
    data = {
        "_comment":   payload.comment or f"Column mappings for the {safe} template.",
        "sheet_name": payload.sheet_name or None,
        "columns":    payload.columns,
    }
    path.write_text(json.dumps(data, indent=4), encoding="utf-8")
    return {"name": safe, "status": "saved"}


@router.delete("/templates/{name}")
def delete_template(name: str):
    path = _TEMPLATES_DIR / f"{name}.json"
    if not path.exists():
        raise HTTPException(404, f"Template '{name}' not found.")
    path.unlink()
    return {"status": "deleted"}
