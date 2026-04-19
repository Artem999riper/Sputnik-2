@echo off
title ПурГеоКом — Запуск
echo.
echo  ══════════════════════════════════════
echo   ПурГеоКом — Система изысканий
echo  ══════════════════════════════════════
echo.
cd /d "%~dp0"
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ОШИБКА] Node.js не установлен!
    echo  Скачайте с: https://nodejs.org
    pause
    exit /b 1
)
if not exist node_modules (
    echo  Первый запуск — установка зависимостей...
    npm install
    echo.
)
echo  Сервер запускается на http://localhost:3000
echo  Нажмите Ctrl+C для остановки
echo.
start "" http://localhost:3000
node server.js
pause
