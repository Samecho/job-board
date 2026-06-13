@echo off
setlocal
title InternRadar Local Launcher
set "ROOT=%~dp0"

if not exist "%ROOT%backend\.venv\Scripts\python.exe" (
  echo [ERROR] Missing backend virtual environment.
  echo Run: cd backend ^&^& python -m venv .venv ^&^& .venv\Scripts\python.exe -m pip install -r requirements.txt
  pause
  exit /b 1
)

set "NPM_CMD="
for /f "delims=" %%I in ('where npm.cmd 2^>nul') do if not defined NPM_CMD set "NPM_CMD=%%I"
if not defined NPM_CMD if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM_CMD=%ProgramFiles%\nodejs\npm.cmd"
if not defined NPM_CMD (
  echo [ERROR] npm.cmd was not found.
  pause
  exit /b 1
)
for %%I in ("%NPM_CMD%") do set "PATH=%%~dpI;%PATH%"

if not exist "%ROOT%frontend\node_modules" (
  echo [ERROR] Run npm install in the frontend directory first.
  pause
  exit /b 1
)

if not exist "%ROOT%backend\.env" copy /y "%ROOT%backend\.env.example" "%ROOT%backend\.env" >nul
> "%ROOT%frontend\.env.local" echo VITE_API_URL=http://localhost:8000

start "InternRadar Backend" /D "%ROOT%backend" cmd /k ".venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
start "InternRadar Frontend" /D "%ROOT%frontend" cmd /k ""%NPM_CMD%" run dev -- --host 127.0.0.1 --port 5173"
timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"
endlocal
