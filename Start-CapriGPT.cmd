@echo off
cd /d "%~dp0"
if not exist "%~dp0node_modules\electron\dist\electron.exe" (
  echo CapriGPT dependencies are missing. Run npm.cmd ci in this folder first.
  pause
  exit /b 1
)
start "" "%~dp0node_modules\electron\dist\electron.exe" "."
