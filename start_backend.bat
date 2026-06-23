@echo off
title Gen Vid - Backend (FastAPI :8000)
echo Starting Gen Vid backend on http://localhost:8000 ...
echo.

:: Use the venv if it exists, otherwise fall back to system Python
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
) else (
    echo [WARNING] Virtual environment not found. Run setup.bat first.
    echo           Attempting to use system Python...
)

cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
