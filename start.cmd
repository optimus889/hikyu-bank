@echo off
setlocal
cd /d "%~dp0"
if not "%~2"=="" (
    echo Usage: start.cmd [local^|cloud]
    exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1" -Mode "%~1"
exit /b %errorlevel%
