import io
import json
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse

from backend.session_store import create_session, update_session
from backend.pipeline_executor import load_config, STEP_LABELS

router = APIRouter()

_TEMPLATES_DIR = Path(__file__).parent.parent.parent / "instructions" / "templates"
MAX_FILE_BYTES  = 100 * 1024 * 1024   # 100 MB hard limit
WARN_ROW_COUNT  = 50_000              # warn user if rows exceed this


def _data_quality(df: pd.DataFrame) -> list:
    rows = []
    total = len(df)
    for col in df.columns:
        null_count = int(df[col].isna().sum())
        unique = int(df[col].nunique(dropna=True))
        samples = df[col].dropna().astype(str).head(3).tolist()
        rows.append({
            "column":     col,
            "null_count": null_count,
            "null_pct":   round(null_count / total * 100, 1) if total else 0,
            "unique":     unique,
            "samples":    samples,
        })
    return rows


def _clean(df: pd.DataFrame) -> pd.DataFrame:
    """Replace blank/whitespace-only strings with NA — column-by-column (faster than whole-df regex)."""
    for col in df.columns:
        mask = df[col].str.strip().eq("") if df[col].dtype == object else pd.Series(False, index=df.index)
        df.loc[mask, col] = pd.NA
    return df


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    name = file.filename or ""
    ext  = name.rsplit(".", 1)[-1].lower()
    if ext not in ("xlsx", "csv"):
        raise HTTPException(400, "Only .xlsx and .csv files are supported.")

    # Read in chunks to enforce size limit without loading everything first
    chunks = []
    total_bytes = 0
    async for chunk in file:
        total_bytes += len(chunk)
        if total_bytes > MAX_FILE_BYTES:
            raise HTTPException(413, f"File exceeds the 100 MB limit ({total_bytes // (1024*1024)} MB received).")
        chunks.append(chunk)
    content = b"".join(chunks)

    try:
        if ext == "xlsx":
            df = pd.read_excel(io.BytesIO(content), dtype=str)
        else:
            df = pd.read_csv(io.BytesIO(content), dtype=str)
        df = _clean(df)
    except Exception as e:
        raise HTTPException(400, f"Could not parse file: {e}")

    # Free raw bytes immediately
    del content

    sid = create_session()
    update_session(sid, {
        "df_original":      df,          # single copy — pipeline clones on run
        "original_columns": list(df.columns),
        "file_name":        name,
    })

    preview = df.head(200).where(pd.notna(df.head(200)), None).values.tolist()

    return {
        "session_id":   sid,
        "file_name":    name,
        "rows":         len(df),
        "columns":      len(df.columns),
        "column_names": list(df.columns),
        "preview_rows": preview,
        "data_quality": _data_quality(df),
        "large_file":   len(df) > WARN_ROW_COUNT,
    }


@router.get("/config")
def get_config():
    steps, thresholds, columns = load_config()
    templates = {}
    if _TEMPLATES_DIR.exists():
        for f in _TEMPLATES_DIR.glob("*.json"):
            try:
                data = json.loads(f.read_text())
                if "columns" in data:
                    templates[f.stem] = data["columns"]
            except Exception:
                pass
    return {
        "steps":      steps,
        "thresholds": thresholds,
        "columns":    columns,
        "step_labels": STEP_LABELS,
        "templates":  templates,
    }
