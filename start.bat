@echo off
title InternRadar Launcher

set ROOT=%~dp0

echo ================================
echo Starting InternRadar...
echo Project root: %ROOT%
echo ================================
echo.

REM Check backend virtual environment
if not exist "%ROOT%backend\.venv\Scripts\python.exe" (
    echo [ERROR] Backend virtual environment not found.
    echo Expected: backend\.venv\Scripts\python.exe
    echo.
    echo Please create/install backend dependencies first.
    pause
    exit /b 1
)

REM Check frontend dependencies
if not exist "%ROOT%frontend\node_modules" (
    echo [ERROR] Frontend node_modules not found.
    echo Please run this first:
    echo.
    echo cd frontend
    echo npm.cmd install
    echo.
    pause
    exit /b 1
)

echo Starting backend on http://127.0.0.1:8000 ...
start "InternRadar Backend" /D "%ROOT%backend" cmd /k ".venv\Scripts\python.exe -m uvicorn app.main:app --reload"

echo Starting frontend on http://localhost:5173 ...
start "InternRadar Frontend" /D "%ROOT%frontend" cmd /k "npm.cmd run dev"

echo Waiting a few seconds before opening browser...
timeout /t 5 /nobreak >nul

start "" "http://localhost:5173"

echo.
echo Done.
echo Backend docs: http://127.0.0.1:8000/docs
echo Frontend:     http://localhost:5173
echo.
pause