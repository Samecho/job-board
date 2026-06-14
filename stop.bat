@echo off
setlocal
set "RUNTIME=%~dp0.runtime"

call :stop_process backend
call :stop_process frontend

echo InternRadar stopped.
endlocal
exit /b 0

:stop_process
set "PID_FILE=%RUNTIME%\%~1.pid"
if not exist "%PID_FILE%" exit /b 0
set /p PID=<"%PID_FILE%"
if defined PID taskkill /PID %PID% /T /F >nul 2>&1
del /q "%PID_FILE%" >nul 2>&1
exit /b 0
