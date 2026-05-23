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
$packageDir = Join-Path $harnessDir ".github"
$targetDir  = (Resolve-Path $TargetDir).Path

$installed = 0
$skipped   = 0
$obsolete  = 0

$obsoleteFiles = @(
    ".github\tdd-config.json",
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

# Install packaged .github files, excluding project-specific setup files
Get-ChildItem -Path $packageDir -Recurse -File |
    Where-Object {
        $_.FullName -notlike "*\instructions\tdd-patterns.instructions.md"
    } |
    Sort-Object FullName |
    ForEach-Object {
        $relPath = $_.FullName.Substring($packageDir.Length).TrimStart('\', '/')
        $relPath = Join-Path ".github" $relPath
        $dst = Join-Path $targetDir $relPath
        Install-File -Src $_.FullName -Dst $dst
    }

foreach ($obsoleteFile in $obsoleteFiles) {
    Report-ObsoleteFile -RelativePath $obsoleteFile
}

Write-Host ""
Write-Host "Install complete: $installed files installed, $skipped files skipped."
if ($obsolete -gt 0) {
    Write-Host "Obsolete files detected: $obsolete. Remove the files listed above to finish upgrading to the single-agent TDD harness."
}
Write-Host "Next steps: Run /tdd-setup in Copilot Chat to generate the project-specific TDD instructions, then switch to the tdd agent when you want the workflow."
