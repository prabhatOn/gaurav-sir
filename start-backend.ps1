# Trading Platform - Quick Start

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Trading Platform - Backend Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if node_modules exists in backend
if (-Not (Test-Path "backend\node_modules")) {
    Write-Host "[INFO] Installing backend dependencies..." -ForegroundColor Yellow
    Push-Location backend
    npm install
    Pop-Location
    Write-Host ""
}

Write-Host "[INFO] Starting backend server on port 5000..." -ForegroundColor Green
Write-Host "[INFO] API: http://localhost:5000/api" -ForegroundColor Cyan
Write-Host "[INFO] Socket.IO: ws://localhost:5000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

Push-Location backend
node server.js
Pop-Location
