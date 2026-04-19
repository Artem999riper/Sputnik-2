@echo off
chcp 65001 >nul 2>&1
title ПурГеоКом — Управление
cd /d "%~dp0"

:: ─── Проверка Node.js ───────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
  cls
  echo.
  echo  [ОШИБКА] Node.js не установлен!
  echo  Скачайте: https://nodejs.org
  echo.
  pause
  exit /b 1
)

:: ─── Первый запуск ──────────────────────────────────────────
if not exist node_modules (
  cls
  echo.
  echo  ════════════════════════════════════════════
  echo    ПурГеоКом — Первый запуск
  echo  ════════════════════════════════════════════
  echo.
  echo  Установка зависимостей, подождите...
  echo.
  npm install
  echo.
  echo  Готово! Нажмите любую клавишу...
  pause >nul
)

:: ─── Главное меню ───────────────────────────────────────────
:menu
cls
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║       ПурГеоКом — Система изысканий         ║
echo  ╚══════════════════════════════════════════════╝
echo.

netstat -an 2>nul | findstr ":3000" | findstr "LISTEN" >nul 2>&1
if %errorlevel%==0 (
  echo    Сервер:   [ ЗАПУЩЕН ]  http://localhost:3000
) else (
  echo    Сервер:   [ ОСТАНОВЛЕН ]
)

echo.
echo    ──────────────────────────────────────────────
echo    1.  Запустить сервер
echo    2.  Открыть в браузере
echo    3.  Переустановить зависимости
echo    4.  Выход
echo    ──────────────────────────────────────────────
echo.
set choice=
set /p choice=   Выберите действие (1-4):

if "%choice%"=="1" goto :start_server
if "%choice%"=="2" goto :open_browser
if "%choice%"=="3" goto :reinstall
if "%choice%"=="4" goto :exit_app
goto :menu

:: ─── Запустить сервер ───────────────────────────────────────
:start_server
netstat -an 2>nul | findstr ":3000" | findstr "LISTEN" >nul 2>&1
if %errorlevel%==0 (
  echo.
  echo    Сервер уже запущен!
  timeout /t 2 /nobreak >nul
  goto :menu
)
echo.
echo    Запуск сервера...
start "ПурГеоКом — Сервер" /d "%~dp0" cmd /k node server.js
timeout /t 2 /nobreak >nul
start "" http://localhost:3000
goto :menu

:: ─── Открыть браузер ────────────────────────────────────────
:open_browser
start "" http://localhost:3000
timeout /t 1 /nobreak >nul
goto :menu

:: ─── Переустановить зависимости ─────────────────────────────
:reinstall
cls
echo.
echo  Переустановка зависимостей...
echo.
if exist node_modules rmdir /s /q node_modules
npm install
echo.
echo  Готово! Нажмите любую клавишу...
pause >nul
goto :menu

:: ─── Выход ──────────────────────────────────────────────────
:exit_app
echo.
echo    До свидания!
timeout /t 1 /nobreak >nul
exit /b 0
