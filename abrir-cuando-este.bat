@echo off
rem Abre la aplicacion en el navegador, pero recien cuando el servidor conteste.
rem
rem Vive aparte y no adentro de ENCENDER porque lo que hace es esperar, y
rem ENCENDER tiene que seguir de largo a prender el servidor. Se lo llama en
rem segundo plano.
rem
rem Antes esto era "esperar seis segundos y abrir". El arranque tarda entre
rem cuatro y ocho segun el dia, asi que cuando tardaba de mas el navegador
rem abria contra un servidor que todavia no estaba, mostraba "no se puede
rem acceder", y parecia que el acceso directo no servia.
rem
rem El primer parametro es la pagina a abrir. Sesenta intentos de un segundo:
rem si en un minuto no contesto, no va a contestar.

setlocal
set PAGINA=%~1
if "%PAGINA%"=="" set PAGINA=/

for /l %%i in (1,1,60) do (
  netstat -ano | findstr LISTENING | findstr :3000 >nul 2>&1
  if not errorlevel 1 (
    start "" "http://localhost:3000%PAGINA%"
    exit /b 0
  )
  ping -n 2 127.0.0.1 >nul 2>&1
)

exit /b 1
