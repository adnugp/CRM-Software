@echo off
echo ========================================
echo Starting AI Chatbot CRM System
echo ========================================
echo.

:: Check if Ollama is running
echo Checking Ollama status...
curl -s http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Ollama is not running!
    echo Please start Ollama first by running: ollama serve
    echo Then pull the model: ollama pull llama2
    pause
    exit /b 1
) else (
    echo [OK] Ollama is running
)

:: Check if Ollama model is available
echo Checking Ollama model...
curl -s http://localhost:11434/api/tags | findstr "llama2" >nul
if %errorlevel% neq 0 (
    echo [WARNING] Llama2 model not found. Pulling now...
    ollama pull llama2
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to pull Llama2 model
        pause
        exit /b 1
    )
) else (
    echo [OK] Llama2 model is available
)

:: Start the AI Chat Backend
echo.
echo Starting AI Chat Backend...
cd /d "%~dp0ai-chat-backend"
start "AI Chat Backend" cmd /k "npm run dev"

:: Wait a moment for backend to start
timeout /t 3 /nobreak >nul

:: Check if backend is running
echo Checking backend status...
curl -s http://localhost:3001/api/health >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Backend may still be starting...
    echo Waiting 5 more seconds...
    timeout /t 5 /nobreak >nul
)

:: Start the Frontend
echo.
echo Starting Frontend...
cd /d "%~dp0"
start "CRM Frontend" cmd /k "npm run dev"

echo.
echo ========================================
echo System Startup Complete!
echo ========================================
echo.
echo AI Chatbot Backend: http://localhost:3001
echo CRM Frontend: http://localhost:5173
echo.
echo The AI Chatbot widget will appear in the bottom-right corner
echo of the CRM interface as a blue "Chat AI" button.
echo.
echo Press any key to exit this window...
pause >nul
