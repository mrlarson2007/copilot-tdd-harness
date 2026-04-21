param(
    [ValidateSet("hint", "step", "terminal", "state", "status")]
    [string]$Mode = "status"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path
$binaryDir = Join-Path $repoRoot ".github/bin"

$osName = if ($IsWindows) { "windows" } elseif ($IsMacOS) { "darwin" } else { "linux" }
$archName = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString().ToLowerInvariant()
if ($archName -eq "x64") { $archName = "amd64" }
if ($archName -eq "aarch64") { $archName = "arm64" }

$exeSuffix = if ($osName -eq "windows") { ".exe" } else { "" }
$binaryPath = Join-Path $binaryDir "tdd-run-tests-$osName-$archName$exeSuffix"

if ((-not (Test-Path $binaryPath)) -and (Get-Command go -ErrorAction SilentlyContinue)) {
    New-Item -ItemType Directory -Force -Path $binaryDir | Out-Null
    Push-Location $repoRoot
    try {
        $env:GOOS = $osName
        $env:GOARCH = $archName
        go build -o $binaryPath ./cmd/tdd-run-tests | Out-Null
    }
    finally {
        Remove-Item Env:GOOS -ErrorAction SilentlyContinue
        Remove-Item Env:GOARCH -ErrorAction SilentlyContinue
        Pop-Location
    }
}

if (Test-Path $binaryPath) {
    & $binaryPath $Mode
    exit $LASTEXITCODE
}

if (Get-Command go -ErrorAction SilentlyContinue) {
    Push-Location $repoRoot
    try {
        go run ./cmd/tdd-run-tests --mode $Mode
    }
    finally {
        Pop-Location
    }
    exit $LASTEXITCODE
}

@"
{
  "event": "Error",
  "decision": "continue",
  "message": "Unable to execute tdd-run-tests CLI: no binary found and Go is not installed."
}
"@
