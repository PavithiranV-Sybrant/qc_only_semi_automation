@echo off
cd /d "%~dp0"
echo Starting QC Automation App...
call venv\Scripts\activate
streamlit run streamlit_app.py
pause
