@echo off
setlocal EnableDelayedExpansion
title Gen Vid - Setup

echo.
echo =====================================================
echo   Gen Vid - Local AI Video Generator - Setup
echo =====================================================
echo.

:: -------------------------------------------------------
:: Locate Python — try PATH first, then known install dirs
:: -------------------------------------------------------
set PYTHON_EXE=

:: Prefer Python 3.12 — PyTorch has the best wheel coverage for 3.12.
:: 3.13 is skipped intentionally: PyTorch CUDA wheels don't support it yet.

:: Try known user-install locations (3.12 first, then older)
for %%V in (312 311 310) do (
    set _P=%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe
    if exist "!_P!" (
        set PYTHON_EXE=!_P!
        goto :python_found
    )
)

:: Try Program Files
for %%V in (312 311 310) do (
    set _P=%ProgramFiles%\Python%%V\python.exe
    if exist "!_P!" (
        set PYTHON_EXE=!_P!
        goto :python_found
    )
)

:: Try py launcher pinned to 3.12
py -3.12 --version >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_EXE=py -3.12
    goto :python_found
)

:: Last resort: whatever python is on PATH
python --version >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_EXE=python
    goto :python_found
)

echo [ERROR] Python 3.10+ not found.
echo.
echo   Install Python from https://python.org/downloads
echo   Make sure to check "Add Python to PATH" during installation.
echo.
pause
exit /b 1

:python_found
echo [OK] Python found: %PYTHON_EXE%
"%PYTHON_EXE%" --version

:: -------------------------------------------------------
:: Check Node.js
:: -------------------------------------------------------
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js found
node --version

:: -------------------------------------------------------
:: Check FFmpeg (warning only — can proceed without it for now)
:: -------------------------------------------------------
ffmpeg -version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] FFmpeg not found in PATH.
    echo    Download: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip
    echo    Extract it, then add the 'bin' folder to your system PATH.
    echo    FFmpeg is REQUIRED to generate MP4 videos.
    echo.
) else (
    echo [OK] FFmpeg found
)

:: -------------------------------------------------------
:: 1/4 — Create Python virtual environment
:: -------------------------------------------------------
echo.
echo [1/4] Creating Python virtual environment...
"%PYTHON_EXE%" -m venv venv
if %errorlevel% neq 0 (
    echo [ERROR] Failed to create virtual environment.
    pause
    exit /b 1
)
echo [OK] Virtual environment created at .\venv\

:: -------------------------------------------------------
:: 2/4 — Install backend Python dependencies
:: -------------------------------------------------------
echo.
echo [2/4] Installing backend Python dependencies...
echo       (PyTorch + Diffusers + FastAPI — this can take several minutes)
echo.

call venv\Scripts\activate.bat

:: Detect CUDA — install matching PyTorch build
nvidia-smi >nul 2>&1
if %errorlevel% equ 0 (
    echo [GPU] NVIDIA GPU detected — installing PyTorch with CUDA 12.1 support.
    echo       If you have CUDA 11.8 instead, edit this file and change cu121 to cu118.
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
) else (
    echo [CPU] No NVIDIA GPU detected — installing CPU-only PyTorch.
    echo       WARNING: Video generation will be very slow without a GPU.
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
)

if %errorlevel% neq 0 (
    echo [ERROR] PyTorch installation failed.
    pause
    exit /b 1
)

pip install -r backend\requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Backend dependencies installation failed.
    pause
    exit /b 1
)
echo [OK] Backend dependencies installed.

:: -------------------------------------------------------
:: 3/4 — Install frontend Node dependencies
:: -------------------------------------------------------
echo.
echo [3/4] Installing frontend dependencies (npm install)...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed.
    cd ..
    pause
    exit /b 1
)
cd ..
echo [OK] Frontend dependencies installed.

:: -------------------------------------------------------
:: 4/4 — Create outputs directory
:: -------------------------------------------------------
echo.
echo [4/4] Creating outputs directory...
if not exist outputs mkdir outputs
echo [OK] outputs\ directory is ready.

:: -------------------------------------------------------
:: Done
:: -------------------------------------------------------
echo.
echo =====================================================
echo   Setup complete!
echo =====================================================
echo.
echo   HOW TO START:
echo     1. Double-click  start_backend.bat    (API server on port 8000)
echo     2. Double-click  start_frontend.bat   (UI on port 3000)
echo     3. Open http://localhost:3000 in your browser
echo.
echo   FIRST RUN NOTE:
echo     The AI models are downloaded automatically when you first
echo     generate a video (~6 GB Wan2.1 + ~5 GB LTX-Video).
echo     Keep internet connected for the first generation.
echo.
pause
