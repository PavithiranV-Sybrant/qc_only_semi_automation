import threading
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.session_store import get_session, set_excel_bytes
from backend.job_store import create_job, get_job, update_job
from backend.settings_store import load_settings
from backend.examine.role_mapper import detect_roles
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

    job_id = create_job(req.session_id, sess["file_name"])

    def _worker():
        update_job(job_id, status="running", phase="analyze",
                   message="Starting column detection...", pct=5)
        try:
            df = sess["df_original"].copy()
            original_columns = list(df.columns)

            def progress_cb(msg: str, pct: int):
                update_job(job_id, message=msg, pct=pct)

            # 4-layer autonomous column detection
            role_map = detect_roles(df, api_key=api_key, progress_cb=progress_cb)
            update_job(job_id, role_map=role_map, phase="pipeline",
                       message="Running QC pipeline...", pct=15)

            # Run all applicable QC steps (unchanged logic)
            df_result, step_results, cols_added = run_pipeline(df, role_map, progress_cb)

            update_job(job_id, message="Writing Excel output...", pct=93)
            excel_bytes = build_excel_bytes(df_result, original_columns)
            set_excel_bytes(req.session_id, excel_bytes)

            failed = [r for r in step_results if r["status"] == "error"]
            score = max(0.0, 100.0 - len(failed) * 5)

            update_job(
                job_id,
                status="done", phase="done",
                message=f"Complete — {len(cols_added)} QC columns added",
                pct=100,
                step_results=step_results,
                columns_added=cols_added,
                total_rows=len(df_result),
                quality_score=score,
            )

        except Exception as e:
            import traceback
            traceback.print_exc()
            update_job(job_id, status="error", message=str(e), error=str(e), pct=0)

    threading.Thread(target=_worker, daemon=True, name=f"qc-{job_id[:8]}").start()
    return {"job_id": job_id}


@router.get("/pipeline/status/{job_id}")
def pipeline_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found.")
    return job
