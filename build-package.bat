@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo Building Farsi Font Chrome Extension Package
echo ============================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\build-package.ps1"

if %ERRORLEVEL% equ 0 (
    echo.
    echo ============================================
    echo SUCCESS: Package created successfully!
    echo Output: dist\Farsi_Font_Chrome_Extension.zip
    echo ============================================
) else (
    echo.
    echo ============================================
    echo ERROR: Build failed with error code %ERRORLEVEL%.
    echo ============================================
    pause
    exit /b %ERRORLEVEL%
)

echo.
pause
