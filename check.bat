@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Install it from https://nodejs.org and try again.
  echo.
  pause
  exit /b 1
)

rem same checks CI runs before deploy: prettier canonical form + lint + tests
npx prettier --write .
if errorlevel 1 (
  echo.
  echo PRETTIER FAILED - send me the error text
  echo.
  pause
  exit /b 1
)
npm run lint
if errorlevel 1 (
  echo.
  echo LINT FAILED - send me the error text
  echo.
  pause
  exit /b 1
)
npm test
if errorlevel 1 (
  echo.
  echo TESTS FAILED - send me the error text
  echo.
  pause
  exit /b 1
)
echo.
echo Done: format fixed, lint and tests green - ready to push.
echo.
pause
