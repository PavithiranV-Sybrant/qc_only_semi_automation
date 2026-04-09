@echo off
cd /d "%~dp0"
echo ================================================
echo   QC Automation App
echo ================================================
echo.

:: Start backend in a new window
echo Starting backend (FastAPI)...
start "QC Backend" cmd /k "cd /d %~dp0 && venv\Scripts\activate && uvicorn backend.main:app --reload --port 8000"

:: Wait for backend to be ready
timeout /t 3 /nobreak >nul

:: Start frontend in a new window
echo Starting frontend (React)...
start "QC Frontend" cmd /k "cd /d %~dp0\frontend && npm run dev"

:: Wait then open browser
timeout /t 3 /nobreak >nul
echo Opening browser...
start http://localhost:5173

echo.
echo ================================================
echo   App is running at http://localhost:5173
echo   Close the two terminal windows to stop.
echo ================================================
echo.
pause
