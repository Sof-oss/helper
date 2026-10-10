@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Heart of the Zone - local site

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Install it from https://nodejs.org and try again.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First run: installing dependencies [npm ci]...
  call npm ci
  if errorlevel 1 (
    echo.
    echo npm ci FAILED - see the error above.
    pause
    exit /b 1
  )
)

node dev.js %*
echo.
pause
