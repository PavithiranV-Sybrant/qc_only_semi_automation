from fastapi import APIRouter, HTTPException

from backend.job_store import list_jobs, dismiss_job

router = APIRouter()


@router.get("/background-jobs")
def get_background_jobs():
    """Unified view of all running/recent single-file and batch jobs."""
    from backend.routers.batch import list_batches
    return {
        "single": list_jobs(),
        "batch":  list_batches(),
    }


@router.delete("/background-jobs/single/{job_id}")
def dismiss_single_job(job_id: str):
    if not dismiss_job(job_id):
        raise HTTPException(404, "Job not found.")
    return {"status": "dismissed"}


@router.delete("/background-jobs/batch/{batch_id}")
def dismiss_batch_job(batch_id: str):
    from backend.routers.batch import dismiss_batch
    if not dismiss_batch(batch_id):
        raise HTTPException(404, "Batch not found.")
    return {"status": "dismissed"}
