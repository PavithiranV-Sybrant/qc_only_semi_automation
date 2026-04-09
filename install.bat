@echo off
cd /d "%~dp0"
echo ================================================
echo   QC Automation App - Installation
echo ================================================
echo.

:: Check Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo         Download it from https://www.python.org/downloads/
    echo         Make sure to check "Add Python to PATH" during install.
    pause
    exit /b 1
)

echo [OK] Python found:
python --version
echo.

:: Create virtual environment
echo [1/3] Creating virtual environment...
python -m venv venv
if errorlevel 1 (
    echo [ERROR] Failed to create virtual environment.
    pause
    exit /b 1
)
echo [OK] Virtual environment created.
echo.

:: Activate and install dependencies
echo [2/3] Installing dependencies...
call venv\Scripts\activate
pip install --upgrade pip -q
pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)
echo [OK] Dependencies installed.
echo.

:: Done
echo [3/3] Setup complete.
echo.
echo ================================================
echo   Installation finished successfully!
echo   Double-click run_app.bat to launch the app.
echo ================================================
echo.
pause
