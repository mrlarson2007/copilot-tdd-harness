# install-tdd-harness.ps1 — deploy the TDD harness into any project
#
# Usage: .\scripts\install-tdd-harness.ps1 [-TargetDir <path>]
#   TargetDir  Directory of the project to install into (default: current directory)
#
# Safety contract: never overwrites existing files.
# Prints "SKIP: <file> — already exists, merge manually" for conflicts.

param(
    [string]$TargetDir = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$harnessDir = (Resolve-Path (Join-Path $scriptDir "..")).Path
$targetDir  = (Resolve-Path $TargetDir).Path

$installed = 0
$skipped   = 0

function Install-File {
    param([string]$Src, [string]$Dst)
    if (Test-Path $Dst) {
        Write-Host "SKIP: $Dst — already exists, merge manually"
        $script:skipped++
    } else {
        $dstDir = Split-Path -Parent $Dst
        if (-not (Test-Path $dstDir)) {
            New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
        }
        Copy-Item -Path $Src -Destination $Dst
        Write-Host "INSTALL: $Dst"
        $script:installed++
    }
}

# Install harness .github files, excluding repo-only files
$githubSrc = Join-Path $harnessDir ".github"
Get-ChildItem -Path $githubSrc -Recurse -File |
    Where-Object {
        $_.Name -ne "settings.yml" -and
        $_.FullName -notlike "*\workflows\*" -and
        $_.FullName -notlike "*\bin\*"
    } |
    Sort-Object FullName |
    ForEach-Object {
        $relPath = $_.FullName.Substring($harnessDir.Length).TrimStart('\', '/')
        $dst = Join-Path $targetDir $relPath
        Install-File -Src $_.FullName -Dst $dst
    }

# Install run-tests wrapper scripts
foreach ($script in @("tdd-run-tests.sh", "tdd-run-tests.ps1")) {
    $src = Join-Path $harnessDir "scripts" $script
    $dst = Join-Path $targetDir  "scripts" $script
    Install-File -Src $src -Dst $dst
}

# Write tdd-config.json only if not already present
$configFile = Join-Path $targetDir ".github\tdd-config.json"
if (-not (Test-Path $configFile)) {
    $testCommand = ""

    # Auto-detect test runner from project files
    if ((Get-ChildItem -Path $targetDir -Filter "*.sln" -ErrorAction SilentlyContinue) -or
        (Get-ChildItem -Path $targetDir -Filter "*.csproj" -ErrorAction SilentlyContinue)) {
        $testCommand = "dotnet test"
    } elseif (Test-Path (Join-Path $targetDir "package.json")) {
        $pkg = Get-Content (Join-Path $targetDir "package.json") -Raw
        if ($pkg -match '"jest"') {
            $testCommand = "npm test"
        } elseif ($pkg -match '"vitest"') {
            $testCommand = "npx vitest"
        }
    } elseif ((Test-Path (Join-Path $targetDir "pyproject.toml")) -or
              (Test-Path (Join-Path $targetDir "setup.py"))) {
        $testCommand = "pytest"
    } elseif (Test-Path (Join-Path $targetDir "pom.xml")) {
        $testCommand = "mvn test"
    } elseif (Test-Path (Join-Path $targetDir "build.gradle")) {
        $testCommand = "./gradlew test"
    }

    $githubDir = Join-Path $targetDir ".github"
    if (-not (Test-Path $githubDir)) {
        New-Item -ItemType Directory -Force -Path $githubDir | Out-Null
    }

    @"
{
  "testCommand": "$testCommand"
}
"@ | Set-Content -Path $configFile -Encoding UTF8

    if ($testCommand) {
        Write-Host "INSTALL: $configFile (detected: $testCommand)"
    } else {
        Write-Host "INSTALL: $configFile (no runner detected — set testCommand manually)"
    }
    $script:installed++
} else {
    Write-Host "SKIP: $configFile — already exists, merge manually"
    $script:skipped++
}

Write-Host ""
Write-Host "Install complete: $installed files installed, $skipped files skipped."
Write-Host "Next steps: Run /tdd-setup in Copilot Chat to complete configuration."
