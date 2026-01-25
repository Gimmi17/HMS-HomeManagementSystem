@echo off
REM Meal Planner - Server Control (Windows Launcher)
REM Launches the cross-platform Python script

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Python non trovato. Installalo da https://python.org
    pause
    exit /b 1
)

REM Run the Python script with all arguments
python "%~dp0start.py" %*
