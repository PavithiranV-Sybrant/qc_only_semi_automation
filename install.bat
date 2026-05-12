@echo off
echo Installing QC Autonomous Agent...
echo.

echo [1/3] Creating Python virtual environment...
python -m venv venv
call venv\Scripts\activate

echo [2/3] Installing Python dependencies...
pip install -r requirements.txt

echo [3/3] Installing frontend dependencies...
cd frontend
npm install
cd ..

echo.
echo Installation complete!
echo Run run_app.bat to start the application.
pause
