@echo off
chcp 65001 >nul
title Mesa de trabajo
cd /d "%~dp0"

rem Que abre este acceso. El otro .bat le pasa otra pagina.
if "%PAGINA%"=="" set PAGINA=/gestion

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
echo     Administracion        http://localhost:3000/gestion
echo.
if defined IP (
  echo   Desde el telefono, con el mismo wifi:
  echo     Administracion        http://%IP%:3000/gestion
  echo.
)
echo   El portal del cliente se abre con su link, que sale de Administracion.
echo.
echo   Para apagarlo: cerra esta ventana, o apreta Ctrl+C.
echo.
echo   ----------------------------------------------------------
echo.

rem Abrir el navegador unos segundos despues, cuando el servidor este listo.
start "" /b cmd /c "timeout /t 6 >nul & start http://localhost:3000%PAGINA%"

call npm run dev

echo.
echo   El servidor se apago.
pause
