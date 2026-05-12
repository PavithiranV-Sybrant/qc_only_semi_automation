from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from backend.session_store import get_session

router = APIRouter()


@router.get("/download/{session_id}")
def download_result(session_id: str):
    sess = get_session(session_id)
    if not sess:
        raise HTTPException(404, "Session not found.")
    data = sess.get("excel_bytes")
    if not data:
        raise HTTPException(404, "Result not ready yet.")
    name = sess.get("file_name", "output").rsplit(".", 1)[0]
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{name}_qc_output.xlsx"'},
    )
