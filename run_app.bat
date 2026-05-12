@echo off
echo Starting QC Autonomous Agent...
echo.

echo Starting backend (port 8001)...
start "QC Backend" cmd /k "call venv\Scripts\activate && uvicorn backend.main:app --reload --port 8001"

timeout /t 3 /nobreak >nul

echo Starting frontend (port 5174)...
start "QC Frontend" cmd /k "cd frontend && npm run dev"

timeout /t 4 /nobreak >nul

echo Opening browser...
start http://localhost:5174

echo.
echo App is running at http://localhost:5174
echo Close the two terminal windows to stop the app.
