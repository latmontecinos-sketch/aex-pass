@echo off
rem Abre la demo en Windows Terminal con PowerShell 7. demo.ps1 necesita PowerShell 7 (pwsh).
where pwsh >nul 2>nul || (
  echo Falta PowerShell 7. Instalalo con: winget install Microsoft.PowerShell
  pause
  exit /b 1
)
where wt >nul 2>nul && (
  wt -d "%~dp0." pwsh -NoLogo -NoExit -File "%~dp0demo.ps1"
) || (
  pwsh -NoLogo -NoExit -File "%~dp0demo.ps1"
)
