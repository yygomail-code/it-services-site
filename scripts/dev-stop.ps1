# Остановка локальной среды: MariaDB + PHP dev-сервер

$ErrorActionPreference = "SilentlyContinue"

# 1. Остановить PHP dev-сервер (процесс с аргументом -S)
Get-CimInstance Win32_Process -Filter "Name='php.exe'" |
    Where-Object { $_.CommandLine -like "*8090*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host "Stopped PHP server (PID $($_.ProcessId))" -ForegroundColor Yellow }

# 2. Остановить MariaDB
Get-CimInstance Win32_Process -Filter "Name='mariadbd.exe'" |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host "Stopped MariaDB (PID $($_.ProcessId))" -ForegroundColor Yellow }

Write-Host "Локальная среда остановлена" -ForegroundColor Cyan
