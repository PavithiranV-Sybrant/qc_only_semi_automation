import threading
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.session_store import get_session, set_excel_bytes
from backend.job_store import create_job, get_job, update_job
from backend.settings_store import load_settings
from backend import llm_client
from backend.pipeline_runner import run_pipeline, build_excel_bytes

router = APIRouter()


class RunRequest(BaseModel):
    session_id: str


@router.post("/pipeline/run")
def start_pipeline(req: RunRequest):
    sess = get_session(req.session_id)
    if not sess:
        raise HTTPException(404, "Session not found — please re-upload the file.")

    settings = load_settings()
    api_key = settings.get("groq_api_key", "").strip()
    if not api_key:
        raise HTTPException(400, "No Groq API key configured. Go to Settings and enter your key.")

    job_id = create_job(req.session_id, sess["file_name"])

    def _worker():
        update_job(job_id, status="running", phase="analyze", message="Detecting column roles…", pct=5)
        try:
            df = sess["df_original"].copy()
            original_columns = list(df.columns)
            columns = list(df.columns)

            # Build sample rows (NaN → None, cast to str)
            sample_rows = []
            for _, row in df.head(3).iterrows():
                sample_rows.append({
                    col: (None if __import__("pandas").isna(val) else str(val))
                    for col, val in row.items()
                })

            update_job(job_id, message=f"Analyzing {len(columns)} columns in batches…", pct=8)
            role_map = llm_client.analyze_columns_in_batches(api_key, columns, sample_rows)
            update_job(job_id, role_map=role_map, phase="pipeline", message="Running QC pipeline…", pct=15)

            def progress_cb(msg: str, pct: int):
                update_job(job_id, message=msg, pct=pct)

            df_result, step_results, cols_added = run_pipeline(df, role_map, progress_cb)

            update_job(job_id, message="Writing Excel output…", pct=93)
            excel_bytes = build_excel_bytes(df_result, original_columns)
            set_excel_bytes(req.session_id, excel_bytes)

            # Compute simple quality score
            total_flag_cols = len(cols_added)
            flagged_steps = [r for r in step_results if r["status"] == "error"]
            score = max(0.0, 100.0 - len(flagged_steps) * 5)

            update_job(
                job_id,
                status="done",
                phase="done",
                message=f"Complete — {total_flag_cols} QC columns added",
                pct=100,
                step_results=step_results,
                columns_added=cols_added,
                total_rows=len(df_result),
                quality_score=score,
            )

        except Exception as e:
            update_job(job_id, status="error", message=str(e), error=str(e), pct=0)

    threading.Thread(target=_worker, daemon=True, name=f"qc-{job_id[:8]}").start()
    return {"job_id": job_id}


@router.get("/pipeline/status/{job_id}")
def pipeline_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found.")
    return job
