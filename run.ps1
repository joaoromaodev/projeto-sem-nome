# Sobe o servidor. Com -Tunel, abre também um endereço público pra mandar no grupo.
#
#   .\run.ps1            -> só local, em http://localhost:8000
#   .\run.ps1 -Tunel     -> local + link público (precisa do cloudflared)

param(
    [switch]$Tunel,
    [int]$Porta = 8000
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

python -c "import fastapi" 2>$null
if (-not $?) {
    Write-Host "Instalando dependencias..." -ForegroundColor Yellow
    python -m pip install -r requirements.txt --quiet
}

if ($Tunel) {
    $cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
    if (-not $cf) {
        Write-Host ""
        Write-Host "cloudflared nao encontrado." -ForegroundColor Red
        Write-Host "Instale com:  winget install --id Cloudflare.cloudflared"
        Write-Host "Subindo so em local por enquanto."
        Write-Host ""
    } else {
        Write-Host "Abrindo tunel publico..." -ForegroundColor Cyan
        Write-Host "O link https://...trycloudflare.com aparece na janela do tunel." -ForegroundColor Cyan
        Start-Process -FilePath $cf -ArgumentList "tunnel", "--url", "http://localhost:$Porta"
    }
}

Write-Host ""
Write-Host "  Sala rodando em http://localhost:$Porta" -ForegroundColor Green
Write-Host "  Ctrl+C para parar." -ForegroundColor DarkGray
Write-Host ""

python -m uvicorn app.main:app --host 0.0.0.0 --port $Porta
