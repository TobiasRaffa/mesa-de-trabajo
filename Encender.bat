@echo off
chcp 65001 >nul
title Mesa de trabajo
cd /d "%~dp0"

rem Que abre este acceso. El otro .bat le pasa otra pagina.
if "%PAGINA%"=="" set PAGINA=/probar

echo.
echo   MESA DE TRABAJO
echo   ---------------
echo.

rem Averiguar la direccion de esta computadora en la red de casa,
rem para poder entrar desde el telefono.
set IP=
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  if not defined IP set IP=%%a
)
set IP=%IP: =%

rem Si el servidor ya esta prendido, no hay que prender otro: dos procesos
rem peleando por el mismo puerto es como se rompia esto antes. El segundo
rem fallaba, la ventana se cerraba, y parecia que el acceso no hacia nada.
set YAESTA=
for /f %%p in ('netstat -ano ^| findstr LISTENING ^| findstr :3000') do set YAESTA=1

if defined YAESTA (
  echo   El servidor ya estaba prendido. Abriendo la aplicacion...
  echo.
  start "" http://localhost:3000%PAGINA%
  echo   Podes cerrar esta ventana: el servidor lo tiene la otra.
  echo.
  timeout /t 6 >nul
  exit /b
)

echo   Encendiendo... la primera vez tarda unos segundos.
echo.
echo   Desde esta computadora:
echo     Portal del cliente    http://localhost:3000/probar
echo     Administracion        http://localhost:3000/gestion
echo.
if defined IP (
  echo   Desde el telefono, con el mismo wifi:
  echo     Portal del cliente    http://%IP%:3000/probar
  echo     Administracion        http://%IP%:3000/gestion
  echo.
)
echo   /probar entra al portal del primer cliente, para no copiar un link
echo   cada vez. Al subir la aplicacion esa direccion deja de existir.
echo.
echo   Para apagarlo: cerra esta ventana, o apreta Ctrl+C.
echo.
echo   ----------------------------------------------------------
echo.

rem Abrir el navegador cuando el servidor CONTESTE, no a los tantos segundos.
start "" /b cmd /c ""%~dp0abrir-cuando-este.bat" "%PAGINA%""

call npm run dev

echo.
echo   El servidor se apago.
pause
