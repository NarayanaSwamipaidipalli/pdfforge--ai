@echo off
title PDFForge AI - Stopping Services
echo ============================================================
echo   Stopping PDFForge AI Microservices...
echo ============================================================
cd /d "%~dp0"
docker compose -p pdfforge--ai-main stop
echo.
echo All services stopped safely.
pause
