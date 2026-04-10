@echo off
title Hook Champions - Multi-Player Launcher
cls
echo ==================================================
echo.
echo    H O O K   C H A M P I O N S
echo    Multi-Player Arena Launcher
echo.
echo ==================================================
echo.
echo [1/3] Starting PartyKit Multiplayer Server...
start "Hook Champions - PartyKit" cmd /c "npm run party"
echo.
echo [2/3] Starting Vite Game Engine...
start "Hook Champions - Vite" cmd /c "npm run dev"
echo.
echo [3/3] Waiting for servers to initialize...
timeout /t 5 /nobreak > nul
echo.
echo [DONE] Launching Game in Browser...
start http://localhost:3000
echo.
echo --------------------------------------------------
echo GAME IS RUNNING.
echo Minimize this window. Close it to finish session.
echo --------------------------------------------------
pause > nul
