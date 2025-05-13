@echo off
echo =================================================
echo      Starting Open Interpreter Web Bridge
echo =================================================

REM Check if Python is installed
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python 3.8 or newer
    pause
    exit /b 1
)

REM Check if requirements are installed
pip list | findstr "open-interpreter" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Installing dependencies...
    pip install -r requirements.txt
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Start the server
echo Starting server...
cd src
python app.py

pause
