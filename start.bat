@echo off
title PDFForge AI - Launching Enterprise Suite
echo ============================================================
echo   PDFForge AI - Enterprise Document Intelligence Platform
echo ============================================================
echo.
echo Starting all microservices with Docker Compose...
cd /d "%~dp0"
docker compose -p pdfforge--ai-main up -d

echo.
echo Waiting for services to initialize...
timeout /t 3 /nobreak >nul

echo.
echo ============================================================
echo   Platform Online:
echo   - Web Application:     http://localhost:3000
echo   - API Gateway Docs:    http://localhost:4000/api/docs
echo   - Python Worker:       http://localhost:8000/health
echo   - MinIO S3 Console:    http://localhost:9001 (minioadmin / minioadmin)
echo ============================================================
echo.
echo Opening PDFForge AI in your browser...
start http://localhost:3000
echo.
pause
