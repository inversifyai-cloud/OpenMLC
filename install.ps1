

$ErrorActionPreference = "Stop"

function Step($msg) { Write-Host "▸ $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "! $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "✗ $msg" -ForegroundColor Red; exit 1 }

$RepoRaw    = "https://raw.githubusercontent.com/inversifyai-cloud/OpenMLC/main"
$InstallDir = if ($env:OPENMLC_DIR) { $env:OPENMLC_DIR } else { Join-Path $env:USERPROFILE "openmlc" }

@'
   ___                   __  __ _    ___
  / _ \ _ __  ___ _ _   |  \/  | |  / __|
 | (_) | '_ \/ -_) ' \  | |\/| | |_| (__
  \___/| .__/\___|_||_| |_|  |_|____\___|
       |_|

  self-hosted, byok ai chat - installer (windows)

'@ | Write-Host

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fail "docker is not installed or not in PATH. install Docker Desktop: https://docs.docker.com/desktop/install/windows-install/"
}

try {
    docker version --format "{{.Server.Version}}" *> $null
    if ($LASTEXITCODE -ne 0) { throw }
} catch {
    Fail "Docker is installed but the daemon isn't running. Start Docker Desktop and re-run."
}

try {
    docker compose version *> $null
    if ($LASTEXITCODE -ne 0) { throw }
} catch {
    Fail "docker compose plugin is not available. Update Docker Desktop."
}

Step "docker found and running"

if (Test-Path $InstallDir) {
    Warn "directory $InstallDir already exists."
    $answer = Read-Host "overwrite the docker-compose.yml + .env in there? (y/N)"
    if ($answer -notmatch '^[Yy]$') {
        Fail "aborted. either remove $InstallDir or set OPENMLC_DIR to a different path and re-run."
    }
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Set-Location $InstallDir
Step "using install dir: $InstallDir"

Step "downloading docker-compose.yml..."
try {
    Invoke-WebRequest -Uri "$RepoRaw/docker-compose.yml" -OutFile "docker-compose.yml" -UseBasicParsing
} catch {
    Fail "could not download docker-compose.yml from $RepoRaw"
}

function Get-RandomHex([int]$bytes) {
    $buf = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($buf)
    -join ($buf | ForEach-Object { $_.ToString("x2") })
}

Step "generating session + encryption secrets..."
$sessionSecret = Get-RandomHex 32
$encryptionKey = Get-RandomHex 32

$envContent = @"
SESSION_SECRET=$sessionSecret
ENCRYPTION_KEY=$encryptionKey
"@
Set-Content -Path ".env" -Value $envContent -NoNewline -Encoding UTF8
Step "wrote .env"

Step "pulling image (first run can take a minute)..."
docker compose pull
if ($LASTEXITCODE -ne 0) { Fail "image pull failed - see error above" }

Step "starting openmlc..."
docker compose up -d *> $null
if ($LASTEXITCODE -ne 0) { Fail "docker compose up failed. run 'docker compose logs' in $InstallDir to see why." }

Step "waiting for the server to come up..."
$ready = $false
for ($i = 1; $i -le 30; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:3000/api/models" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Start-Sleep -Seconds 1
}

Write-Host ""
if ($ready) {
    Write-Host "✓ openmlc is live" -ForegroundColor Green
    Write-Host ""
    Write-Host "  -> open http://localhost:3000 in your browser" -ForegroundColor White
    Write-Host ""
    Write-Host "  install dir:  $InstallDir"
    Write-Host "  view logs:    cd '$InstallDir' ; docker compose logs -f"
    Write-Host "  stop:         cd '$InstallDir' ; docker compose down"
    Write-Host "  update:       cd '$InstallDir' ; docker compose pull ; docker compose up -d"
    Write-Host ""
    Write-Host "  your data lives in named docker volumes (openmlc-data + openmlc-uploads)." -ForegroundColor DarkGray
    Write-Host "  don't run 'docker compose down -v' - that wipes them." -ForegroundColor DarkGray
} else {
    Warn "container started but the server didn't respond on :3000 in 30s."
    Warn "check logs with: cd '$InstallDir' ; docker compose logs -f"
}
