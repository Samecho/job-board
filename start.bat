@echo off
setlocal
set "ROOT=%~dp0"
set "RUNTIME=%ROOT%.runtime"
set "PYTHON=%ROOT%backend\.venv\Scripts\python.exe"

if not exist "%PYTHON%" (
  echo [ERROR] Missing backend virtual environment.
  echo Run the setup steps in README.md first.
  exit /b 1
)

set "NPM_CMD="
for /f "delims=" %%I in ('where npm.cmd 2^>nul') do if not defined NPM_CMD set "NPM_CMD=%%I"
if not defined NPM_CMD if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM_CMD=%ProgramFiles%\nodejs\npm.cmd"
if not defined NPM_CMD (
  echo [ERROR] npm.cmd was not found.
  exit /b 1
)
for %%I in ("%NPM_CMD%") do set "NODE_DIR=%%~dpI"

if not exist "%ROOT%frontend\node_modules" (
  echo [ERROR] Run npm install in the frontend directory first.
  exit /b 1
)

netstat -ano -p TCP | findstr /R /C:"127.0.0.1:8000 .*LISTENING" >nul
if not errorlevel 1 (
  echo [ERROR] Port 8000 is already in use.
  exit /b 1
)
netstat -ano -p TCP | findstr /R /C:"127.0.0.1:5173 .*LISTENING" >nul
if not errorlevel 1 (
  echo [ERROR] Port 5173 is already in use.
  exit /b 1
)

if not exist "%RUNTIME%" mkdir "%RUNTIME%"
if not exist "%ROOT%backend\.env" copy /y "%ROOT%backend\.env.example" "%ROOT%backend\.env" >nul
> "%ROOT%frontend\.env.local" echo VITE_API_URL=http://localhost:8000

> "%RUNTIME%\backend-run.cmd" echo @echo off
>> "%RUNTIME%\backend-run.cmd" echo cd /d "%ROOT%backend"
>> "%RUNTIME%\backend-run.cmd" echo "%PYTHON%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 ^>^> "%RUNTIME%\backend.log" 2^>^&1

> "%RUNTIME%\frontend-run.cmd" echo @echo off
>> "%RUNTIME%\frontend-run.cmd" echo cd /d "%ROOT%frontend"
>> "%RUNTIME%\frontend-run.cmd" echo set "PATH=%NODE_DIR%;%SystemRoot%\System32;%SystemRoot%"
>> "%RUNTIME%\frontend-run.cmd" echo call "%NPM_CMD%" run dev -- --host 127.0.0.1 --port 5173 ^>^> "%RUNTIME%\frontend.log" 2^>^&1

powershell.exe -NoProfile -WindowStyle Hidden -Command ^
  "$process = Start-Process -FilePath $env:ComSpec -ArgumentList '/d','/c','\"%RUNTIME%\backend-run.cmd\"' -WindowStyle Hidden -PassThru;" ^
  "Set-Content -LiteralPath '%RUNTIME%\backend.pid' -Value $process.Id"

powershell.exe -NoProfile -WindowStyle Hidden -Command ^
  "$process = Start-Process -FilePath $env:ComSpec -ArgumentList '/d','/c','\"%RUNTIME%\frontend-run.cmd\"' -WindowStyle Hidden -PassThru;" ^
  "Set-Content -LiteralPath '%RUNTIME%\frontend.pid' -Value $process.Id"

powershell.exe -NoProfile -Command "Start-Sleep -Seconds 3"
start "" "http://localhost:5173"
echo InternRadar started. Logs are in .runtime.
endlocal
