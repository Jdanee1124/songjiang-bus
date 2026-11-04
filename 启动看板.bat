@echo off
chcp 65001 >nul
title 松江通勤实时看板启动中...
echo ==============================================
echo 🚌 正在启动松江通勤本地服务与直连隧道...
echo ==============================================

cd /d "%~dp0"

taskkill /f /im cloudflared.exe >nul 2>&1

start "" /b node server.mjs
timeout /t 2 /nobreak >nul
start "" .\cloudflared.exe tunnel --url http://localhost:3000

echo.
echo ✅ 服务已在后台启动！
echo 📱 手机请直接访问 trycloudflare 网址即可。
echo ==============================================
pause
