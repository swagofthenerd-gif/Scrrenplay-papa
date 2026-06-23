@echo off
REM Build ScrivenLight for Windows.
REM Produces:
REM   dist\ScrivenLight\                 (portable folder - copy anywhere, run ScrivenLight.exe)
REM   dist\ScrivenLight-win-portable.zip (zipped portable build)
REM   (optionally) Output\ScrivenLight-Setup.exe via Inno Setup - see PACKAGING.md
REM
REM Requirements: Windows 10/11, Python 3.9+ (from python.org, "Add to PATH" checked).
REM Run from the project root:  build_windows.bat

setlocal enabledelayedexpansion
set APP_NAME=ScrivenLight
cd /d "%~dp0"

echo ==^> [1/4] Creating an isolated build environment
python -m venv .build-venv
if errorlevel 1 (
    echo ERROR: could not create venv. Is Python installed and on PATH?
    exit /b 1
)
call .build-venv\Scripts\activate.bat
python -m pip install --upgrade pip wheel >nul

echo ==^> Installing dependencies ^(PyQt6, reportlab, pyinstaller^)...
pip install PyQt6 reportlab pyinstaller >nul
if errorlevel 1 (
    echo ERROR: dependency install failed.
    exit /b 1
)

echo ==^> [2/4] Building with PyInstaller
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
pyinstaller scrivenlight.spec --noconfirm
if not exist "dist\%APP_NAME%\%APP_NAME%.exe" (
    echo ERROR: build failed - dist\%APP_NAME%\%APP_NAME%.exe not found
    exit /b 1
)
echo     built dist\%APP_NAME%\%APP_NAME%.exe

echo ==^> [3/4] Creating portable zip
powershell -NoProfile -Command ^
  "Compress-Archive -Path 'dist\%APP_NAME%\*' -DestinationPath 'dist\%APP_NAME%-win-portable.zip' -Force"
echo     wrote dist\%APP_NAME%-win-portable.zip

echo ==^> [4/4] Optional installer
where iscc >nul 2>nul
if %errorlevel%==0 (
    echo     Inno Setup found - building installer...
    iscc installer_windows.iss
    echo     installer written to Output\%APP_NAME%-Setup.exe
) else (
    echo     Inno Setup ^(iscc^) not found on PATH - skipping installer.
    echo     The portable build is ready. To also build a Setup.exe, install
    echo     Inno Setup from https://jrsoftware.org/isdl.php then re-run this.
)

call deactivate
echo.
echo Done. In dist\ you now have:
echo     %APP_NAME%\                      - portable folder (run %APP_NAME%.exe)
echo     %APP_NAME%-win-portable.zip      - zipped portable build
echo.
echo NOTE: this build is unsigned, so SmartScreen may warn on first launch.
echo   Click "More info" then "Run anyway". To remove that, sign with a
echo   code-signing certificate (see PACKAGING.md).
endlocal
