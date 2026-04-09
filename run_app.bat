@echo off
cd /d "%~dp0"
echo ================================================
echo   QC Automation App
echo ================================================
echo.

:: Start backend in a new window
echo Starting backend (FastAPI)...
start "QC Backend" cmd /k "cd /d %~dp0 && venv\Scripts\activate && uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000"

:: Wait for backend to be ready
timeout /t 3 /nobreak >nul

:: Start frontend in a new window
echo Starting frontend (React)...
start "QC Frontend" cmd /k "cd /d %~dp0\frontend && npm run dev"

:: Wait then open browser
timeout /t 3 /nobreak >nul
echo Opening browser...
start http://localhost:5173

:: Get local network IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1"') do (
    set LOCAL_IP=%%a
    goto :found
)
:found
set LOCAL_IP=%LOCAL_IP: =%

echo.
echo ================================================
echo   App is running!
echo.
echo   Local:    http://localhost:5173
if defined LOCAL_IP (
echo   Network:  http://%LOCAL_IP%:5173
)
echo.
echo   Close the two terminal windows to stop.
echo ================================================
echo.
pause
