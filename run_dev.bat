@echo off
cd /d "%~dp0"
echo Starting QC Automation (React + FastAPI)...

:: Start FastAPI backend
start "QC Backend" cmd /k "venv\Scripts\activate && uvicorn backend.main:app --reload --port 8000"

:: Wait briefly then start frontend
timeout /t 2 /nobreak >nul
start "QC Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo.
pause
