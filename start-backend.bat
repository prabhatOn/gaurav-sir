@echo off
echo ========================================
echo  Trading Platform - Backend Server
echo ========================================
echo.

REM Check if node_modules exists in backend
if not exist "backend\node_modules" (
    echo [INFO] Installing backend dependencies...
    cd backend
    call npm install
    cd ..
    echo.
)

echo [INFO] Starting backend server on port 5000...
echo [INFO] API: http://localhost:5000/api
echo [INFO] Socket.IO: ws://localhost:5000
echo.
echo Press Ctrl+C to stop the server
echo.

cd backend
node server.js
