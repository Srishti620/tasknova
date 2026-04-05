@echo off
echo.
echo ========================================
echo   TaskNova - Setup Script
echo ========================================
echo.

echo [1/3] Installing server dependencies...
cd server
call npm install
echo Server dependencies installed!
echo.

echo [2/3] Installing client dependencies...
cd ../client
call npm install
echo Client dependencies installed!
echo.

echo [3/3] Setup complete!
echo.
echo ========================================
echo   HOW TO RUN:
echo   Open TWO terminals:
echo.
echo   Terminal 1 (Server):
echo     cd tasknova\server
echo     node server.js
echo.
echo   Terminal 2 (Client):
echo     cd tasknova\client
echo     npm start
echo.
echo   Then open: http://localhost:3000
echo ========================================
echo.
pause
