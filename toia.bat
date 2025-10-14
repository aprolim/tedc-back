@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

title Compilador de Archivos
echo.
echo Compilando archivos...
echo.

set "ARCHIVO_SALIDA=compilado.txt"

:: Eliminar archivo de salida si existe
if exist "%ARCHIVO_SALIDA%" del "%ARCHIVO_SALIDA%"

echo COMPILADO DE ARCHIVOS > "%ARCHIVO_SALIDA%"
echo. >> "%ARCHIVO_SALIDA%"

set ARCHIVOS_PROCESADOS=0

:: Procesar archivos recursivamente pero excluir node_modules, .git y package-lock.json
for /f "delims=" %%F in ('dir /s /b /a-d * ^| findstr /v /i "\\node_modules\\ \\.git\\ package-lock\.json"') do (
    if not "%%F"=="%~f0" (
        if not "%%F"=="%CD%\%ARCHIVO_SALIDA%" (
            :: Obtener ruta relativa
            set "ruta_completa=%%F"
            set "ruta_relativa=!ruta_completa:%CD%\=!"
            
            echo Procesando: !ruta_relativa!
            echo. >> "%ARCHIVO_SALIDA%"
            echo ================================= >> "%ARCHIVO_SALIDA%"
            echo !ruta_relativa! >> "%ARCHIVO_SALIDA%"
            echo ================================= >> "%ARCHIVO_SALIDA%"
            echo. >> "%ARCHIVO_SALIDA%"
            type "%%F" >> "%ARCHIVO_SALIDA%" 2>nul
            set /a ARCHIVOS_PROCESADOS+=1
        )
    )
)

echo. >> "%ARCHIVO_SALIDA%"
echo Total archivos: %ARCHIVOS_PROCESADOS% >> "%ARCHIVO_SALIDA%"

echo.
echo ✅ Compilación completada!
echo 📊 Archivos procesados: %ARCHIVOS_PROCESADOS%
echo 💾 Guardado en: %ARCHIVO_SALIDA%
echo.

pause