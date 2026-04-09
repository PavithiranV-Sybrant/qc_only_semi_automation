from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any

from backend.session_store import get_session, update_session
from backend.pipeline_executor import execute_pipeline

router = APIRouter()


class RunRequest(BaseModel):
    session_id:     str
    column_mapping: dict[str, Any]
    step_toggles:   dict[str, bool]
    thresholds:     dict[str, float]


@router.post("/run-pipeline")
def run_pipeline(req: RunRequest):
    sess = get_session(req.session_id)
    if not sess:
        raise HTTPException(404, "Session not found. Please re-upload the file.")

    df = sess["df_original"].copy()
    df_out, results, elapsed = execute_pipeline(
        df, req.column_mapping, req.step_toggles, req.thresholds
    )

    original_cols = set(sess["original_columns"])
    new_cols = [c for c in df_out.columns if c not in original_cols]

    # Build new columns summary
    new_cols_summary = []
    distributions    = {}
    for col in new_cols:
        total     = len(df_out)
        populated = int(df_out[col].notna().sum())
        null_c    = total - populated
        unique    = int(df_out[col].nunique(dropna=True))
        vc        = df_out[col].value_counts(dropna=True)
        top_val   = str(vc.index[0]) if len(vc) else ""
        new_cols_summary.append({
            "column":    col,
            "populated": populated,
            "null":      null_c,
            "unique":    unique,
            "top_value": top_val,
        })
        distributions[col] = {str(k): int(v) for k, v in vc.head(20).items()}

    update_session(req.session_id, {"df_working": df_out})

    return {
        "results":          results,
        "elapsed_total":    elapsed,
        "new_columns":      new_cols,
        "new_cols_summary": new_cols_summary,
        "distributions":    distributions,
        "rows":             len(df_out),
    }
