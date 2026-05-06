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
$obsolete  = 0

$obsoleteFiles = @(
    ".github\agents\tdd-red.agent.md",
    ".github\agents\tdd-green.agent.md",
    ".github\agents\tdd-commit.agent.md",
    ".github\agents\tdd-refactor.agent.md",
    ".github\prompts\tdd-start.prompt.md",
    ".github\prompts\tdd-status.prompt.md",
    ".github\hooks\tdd-enforcement.json",
    "scripts\tdd-run-tests",
    "scripts\tdd-run-tests.sh",
    "scripts\tdd-run-tests.ps1"
)

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

function Report-ObsoleteFile {
    param([string]$RelativePath)

    $dst = Join-Path $targetDir $RelativePath
    if (Test-Path $dst) {
        Write-Host "REMOVE: $dst — obsolete in the single-agent TDD harness"
        $script:obsolete++
    }
}

function Get-BinaryName {
    $osName = if ($IsWindows) { "windows" } elseif ($IsMacOS) { "darwin" } else { "linux" }
    $archName = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString().ToLowerInvariant()
    if ($archName -eq "x64") { $archName = "amd64" }
    if ($archName -eq "aarch64") { $archName = "arm64" }

    $binaryName = "tdd-run-tests-$osName-$archName"
    if ($osName -eq "windows") {
        $binaryName += ".exe"
    }

    return $binaryName
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

foreach ($obsoleteFile in $obsoleteFiles) {
    Report-ObsoleteFile -RelativePath $obsoleteFile
}

# Install platform CLI binary
$binaryName = Get-BinaryName
$binarySrc = Join-Path $harnessDir ".github\bin" $binaryName
$binaryDst = Join-Path $targetDir ".github\bin" $binaryName

if (Test-Path $binarySrc) {
    Install-File -Src $binarySrc -Dst $binaryDst
} else {
    Write-Host "SKIP: $binaryDst — no bundled CLI binary available for this OS/architecture"
    $script:skipped++
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
        if ($pkg -match '"jest"\s*:') {
            $testCommand = "npm test"
        } elseif ($pkg -match '"vitest"\s*:') {
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
if ($obsolete -gt 0) {
    Write-Host "Obsolete files detected: $obsolete. Remove the files listed above to finish upgrading to the single-agent TDD harness."
}
Write-Host "Next steps: Run /tdd-setup in Copilot Chat to complete configuration, then switch to the tdd agent when you want the workflow. The CLI binary is installed under .github\bin\."
