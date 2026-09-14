# Запуск локальной среды разработки: MariaDB + PHP dev-сервер
# Использование: .\scripts\dev-start.ps1
# Остановка:     .\scripts\dev-stop.ps1

$ErrorActionPreference = "Stop"

# 1. Проверить и запустить MariaDB
$listening = Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
    Write-Host "Starting MariaDB..." -ForegroundColor Green
    Start-Process -FilePath "C:\mariadb\bin\mariadbd.exe" `
        -ArgumentList "--defaults-file=C:\mariadb\my.ini", "--console" `
        -WindowStyle Hidden
    Start-Sleep -Seconds 6
} else {
    Write-Host "MariaDB already running on 3306" -ForegroundColor Yellow
}

# 2. Проверить и запустить PHP dev-сервер
$phpListening = Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue
if (-not $phpListening) {
    Write-Host "Starting PHP dev server on http://127.0.0.1:8090 ..." -ForegroundColor Green
    Start-Process -FilePath "C:\php\php.exe" `
        -ArgumentList "-S", "127.0.0.1:8090", "-t", "C:\Users\analitvinov\Proects3" `
        -WindowStyle Hidden
    Start-Sleep -Seconds 2
} else {
    Write-Host "PHP server already running on 8090" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Локальная среда готова ===" -ForegroundColor Cyan
Write-Host "  PHP:      http://127.0.0.1:8090"
Write-Host "  Шлюз:     POST http://127.0.0.1:8090/api/lead.php"
Write-Host "  MariaDB:  127.0.0.1:3306 (root, без пароля)"
Write-Host "  БД:       it_services"
Write-Host ""
Write-Host "Для Angular dev-сервера: npm start (http://localhost:4200)"
Write-Host "Остановка: .\scripts\dev-stop.ps1"
