@echo off
chcp 65001 >nul
title Mesa de trabajo
cd /d "%~dp0"

echo.
echo   MESA DE TRABAJO
echo   ---------------
echo.
echo   Encendiendo... la primera vez tarda unos segundos.
echo.

rem Averiguar la direccion de esta computadora en la red de casa,
rem para poder entrar desde el telefono.
set IP=
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  if not defined IP set IP=%%a
)
set IP=%IP: =%

echo   Desde esta computadora:
echo     Portal del cliente    http://localhost:3000/t/ejemplo
echo     Administracion        http://localhost:3000/gestion
echo.
if defined IP (
  echo   Desde el telefono, con el mismo wifi:
  echo     Portal del cliente    http://%IP%:3000/t/ejemplo
  echo     Administracion        http://%IP%:3000/gestion
  echo.
)
echo   Para apagarlo: cerra esta ventana, o apreta Ctrl+C.
echo.
echo   ----------------------------------------------------------
echo.

rem Abrir el navegador unos segundos despues, cuando el servidor este listo.
start "" /b cmd /c "timeout /t 6 >nul & start http://localhost:3000/t/ejemplo"

call npm run dev

echo.
echo   El servidor se apago.
pause
