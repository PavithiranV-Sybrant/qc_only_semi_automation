from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import upload, pipeline, download

app = FastAPI(title="QC Automation API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router,   prefix="/api")
app.include_router(pipeline.router, prefix="/api")
app.include_router(download.router, prefix="/api")


@app.get("/")
def root():
    return {"status": "QC Automation API running"}
