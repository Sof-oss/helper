@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Install it from https://nodejs.org and try again.
  echo.
  pause
  exit /b 1
)

rem 1. выгрузка всех игроков из игры (скрипт спросит токен)
node fetch-players.js
if errorlevel 1 (
  echo.
  echo Fetch FAILED - see the error above.
  echo.
  pause
  exit /b 1
)

rem 2. сборка рейтингов для сайта
node build-top100.js
if errorlevel 1 (
  echo.
  echo Build FAILED - see the error above.
) else (
  echo.
  echo Done.
)
echo.
pause
