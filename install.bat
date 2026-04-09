@echo off
cd /d "%~dp0"
echo ================================================
echo   QC Automation App - Installation
echo ================================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo         Download it from https://www.python.org/downloads/
    echo         Make sure to check "Add Python to PATH" during install.
    pause & exit /b 1
)
echo [OK] Python found:
python --version
echo.

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo         Download it from https://nodejs.org/
    pause & exit /b 1
)
echo [OK] Node.js found:
node --version
echo.

:: Python venv
echo [1/4] Creating Python virtual environment...
python -m venv venv
if errorlevel 1 ( echo [ERROR] Failed to create venv. & pause & exit /b 1 )
echo [OK] Virtual environment created.
echo.

:: Python dependencies
echo [2/4] Installing Python dependencies...
call venv\Scripts\activate
pip install --upgrade pip -q
pip install -r requirements.txt
if errorlevel 1 ( echo [ERROR] Failed to install Python dependencies. & pause & exit /b 1 )
echo [OK] Python dependencies installed.
echo.

:: Node dependencies
echo [3/4] Installing frontend (Node.js) dependencies...
cd frontend
npm install
if errorlevel 1 ( echo [ERROR] Failed to install Node dependencies. & pause & exit /b 1 )
cd ..
echo [OK] Frontend dependencies installed.
echo.

echo [4/4] Setup complete.
echo.
echo ================================================
echo   Installation finished!
echo   Double-click run_app.bat to launch.
echo ================================================
echo.
pause
