import concurrent.futures
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Any

from backend.session_store import get_session, update_session
from backend.job_store import create_job, get_job, update_job
from backend.pipeline_executor import execute_pipeline

router  = APIRouter()
_pool   = concurrent.futures.ThreadPoolExecutor(max_workers=4)


class RunRequest(BaseModel):
    session_id:     str
    column_mapping: dict[str, Any]
    step_toggles:   dict[str, bool]
    thresholds:     dict[str, float]


def _run_pipeline_task(job_id: str, req: RunRequest):
    """Runs in a background thread. Updates job store with progress and results."""
    sess = get_session(req.session_id)
    if not sess:
        update_job(job_id, {"status": "error", "error": "Session not found. Please re-upload the file."})
        return

    def progress_cb(step_index, total_steps, label):
        update_job(job_id, {
            "status":       "running",
            "step_index":   step_index,
            "total_steps":  total_steps,
            "current_step": label,
        })

    try:
        df = sess["df_original"].copy()
        df_out, results, elapsed = execute_pipeline(
            df, req.column_mapping, req.step_toggles, req.thresholds,
            progress_cb=progress_cb,
        )

        original_cols = set(sess["original_columns"])
        new_cols      = [c for c in df_out.columns if c not in original_cols]

        new_cols_summary = []
        distributions    = {}
        for col in new_cols:
            total     = len(df_out)
            populated = int(df_out[col].notna().sum())
            vc        = df_out[col].value_counts(dropna=True)
            top_val   = str(vc.index[0]) if len(vc) else ""
            new_cols_summary.append({
                "column":    col,
                "populated": populated,
                "null":      total - populated,
                "unique":    int(df_out[col].nunique(dropna=True)),
                "top_value": top_val,
            })
            distributions[col] = {str(k): int(v) for k, v in vc.head(20).items()}

        update_session(req.session_id, {"df_working": df_out})
        update_job(job_id, {
            "status":           "done",
            "results":          results,
            "elapsed_total":    elapsed,
            "new_columns":      new_cols,
            "new_cols_summary": new_cols_summary,
            "distributions":    distributions,
            "rows":             len(df_out),
        })
    except Exception as e:
        update_job(job_id, {"status": "error", "error": str(e)})


@router.post("/run-pipeline")
def run_pipeline(req: RunRequest):
    """Start pipeline in background. Returns job_id immediately."""
    sess = get_session(req.session_id)
    if not sess:
        raise HTTPException(404, "Session not found. Please re-upload the file.")

    job_id = create_job(req.session_id)
    _pool.submit(_run_pipeline_task, job_id, req)
    return {"job_id": job_id, "status": "started"}


@router.get("/pipeline-status/{job_id}")
def pipeline_status(job_id: str):
    """Poll this endpoint to get live progress and final results."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found.")
    return job
