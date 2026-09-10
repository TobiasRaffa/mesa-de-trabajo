@echo off
rem Lo mismo que ENCENDER, abriendo Administracion.
rem Se llama al otro para no tener dos copias que despues se separan.
set PAGINA=/gestion
call "%~dp0Encender.bat"
