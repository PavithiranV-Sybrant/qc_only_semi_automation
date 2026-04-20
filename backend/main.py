import threading
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import upload, pipeline, download, templates, batch, storage, background, final_output_templates, autonomous

app = FastAPI(title="QC Automation API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router,   prefix="/api")
app.include_router(pipeline.router, prefix="/api")
app.include_router(download.router, prefix="/api")
app.include_router(templates.router, prefix="/api")
app.include_router(batch.router,    prefix="/api")
app.include_router(storage.router,    prefix="/api")
app.include_router(background.router, prefix="/api")
app.include_router(final_output_templates.router, prefix="/api")
app.include_router(autonomous.router,             prefix="/api")


# ─── startup cleanup + daily scheduler ───────────────────────────────────────

def _run_cleanup():
    """Run old-file cleanup using the current backup_days setting."""
    try:
        from backend.settings_store import load_settings
        from backend.file_store import cleanup_old_files
        settings = load_settings()
        cleanup_old_files(settings["backup_days"])
    except Exception:
        pass


def _daily_cleanup_loop():
    """Background daemon thread: sleep 24 h then clean up old files."""
    while True:
        time.sleep(24 * 3600)
        _run_cleanup()


@app.on_event("startup")
def on_startup():
    # Clean up old files immediately when the app starts
    _run_cleanup()
    # Start the daily background scheduler
    t = threading.Thread(target=_daily_cleanup_loop, daemon=True)
    t.start()


@app.get("/")
def root():
    return {"status": "QC Automation API running"}
