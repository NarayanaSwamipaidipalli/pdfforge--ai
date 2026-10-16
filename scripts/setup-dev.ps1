# PDFForge AI - Windows Developer Environment Setup Script
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " PDFForge AI - Enterprise Development Bootstrap (Windows)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check Node.js
try {
    $nodeVersion = node -v
    Write-Host "[OK] Node.js detected: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERR] Node.js is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

# 2. Check Python
try {
    $pyVersion = py -V
    Write-Host "[OK] Python detected: $pyVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERR] Python launcher 'py' is not installed." -ForegroundColor Red
}

# 3. Setup API Gateway environment
Write-Host "`n[1/3] Configuring API Gateway..." -ForegroundColor Yellow
if (-not (Test-Path "apps\api\.env")) {
    Copy-Item "apps\api\.env.example" "apps\api\.env"
    Write-Host "  → Created apps\api\.env from template" -ForegroundColor Gray
}

# 4. Setup Python Worker environment
Write-Host "`n[2/3] Setting up Python Worker Virtual Environment..." -ForegroundColor Yellow
$venvPath = "services\pdf-worker\.venv"
if (-not (Test-Path $venvPath)) {
    py -m venv $venvPath
    Write-Host "  → Created virtual environment at $venvPath" -ForegroundColor Gray
}
Write-Host "  → To activate: services\pdf-worker\.venv\Scripts\Activate.ps1" -ForegroundColor Gray

# 5. Summary
Write-Host "`n[3/3] Ready for Docker Orchestration!" -ForegroundColor Green
Write-Host "To start the entire platform with PostgreSQL, Redis, MinIO, API & Web:" -ForegroundColor White
Write-Host "  docker-compose up --build" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
