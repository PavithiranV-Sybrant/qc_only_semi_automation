import io
import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException
from backend.session_store import create_session

router = APIRouter()


def _safe_sample(df: pd.DataFrame, n: int = 3) -> list:
    """Return up to n rows as list of dicts with NaN → None."""
    rows = []
    for _, row in df.head(n).iterrows():
        rows.append({
            col: (None if pd.isna(val) else str(val))
            for col, val in row.items()
        })
    return rows


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ("xlsx", "xls", "csv"):
        raise HTTPException(400, "Only .xlsx, .xls, .csv files supported.")

    content = await file.read()
    try:
        if ext == "csv":
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Could not parse file: {e}")

    if df.empty or len(df.columns) == 0:
        raise HTTPException(400, "File has no data.")

    session_id = create_session(df.copy(), file.filename or "upload")
    columns = list(df.columns)
    sample_rows = _safe_sample(df)

    return {
        "session_id": session_id,
        "file_name": file.filename,
        "total_rows": len(df),
        "total_columns": len(columns),
        "columns": columns,
        "sample_rows": sample_rows,
    }
