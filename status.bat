@echo off
title PDFForge AI - Status and Health Check
echo ============================================================
echo   PDFForge AI - Container and Service Status
echo ============================================================
echo.
docker ps --filter "name=pdfforge" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo.
echo ============================================================
echo Testing endpoint connectivity:
echo.
curl.exe -s -o nul -w "  [Web Frontend]   http://localhost:3000 -> HTTP %%{http_code}\n" http://localhost:3000
curl.exe -s -o nul -w "  [API Gateway]    http://localhost:4000/api/docs -> HTTP %%{http_code}\n" http://localhost:4000/api/docs
curl.exe -s -o nul -w "  [Python Worker]  http://localhost:8000/health -> HTTP %%{http_code}\n" http://localhost:8000/health
curl.exe -s -o nul -w "  [MinIO Console]  http://localhost:9001 -> HTTP %%{http_code}\n" http://localhost:9001
echo.
echo ============================================================
pause
