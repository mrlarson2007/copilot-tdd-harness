# install-tdd-harness.ps1 — deploy the TDD harness into any project
#
# Usage: .\scripts\install-tdd-harness.ps1 [-TargetDir <path>] [-Agent copilot|codex|both]
#   TargetDir  Directory of the project to install into (default: current directory)
#   Agent      Assistant integration to install (default: copilot)
#
# Safety contract: never overwrites existing files.
# Prints "SKIP: <file> — already exists, merge manually" for conflicts.

[CmdletBinding()]
param(
    [string]$TargetDir = (Get-Location).Path,
    [ValidateSet("copilot", "codex", "both")]
    [string]$Agent = "copilot"
)

$ErrorActionPreference = "Stop"

$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$harnessDir = (Resolve-Path (Join-Path $scriptDir "..")).Path
$packageDir = Join-Path $harnessDir ".github"
if ($Agent -eq "copilot") {
    $targetDir = (Resolve-Path -LiteralPath $TargetDir).Path
} else {
    $targetDir = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($TargetDir)
}

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
    param([string]$Src, [string]$Dst, [string]$Content)
    if ($Agent -ne "copilot") {
        $ancestor = $Dst
        while ($ancestor) {
            $item = Get-Item -LiteralPath $ancestor -Force -ErrorAction SilentlyContinue
            if ($item -and ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
                Write-Host "SKIP: $Dst — symbolic link in destination, merge manually"
                $script:skipped++
                return
            }
            $ancestor = Split-Path -Parent $ancestor
        }
    }
    if (Test-Path -LiteralPath $Dst) {
        Write-Host "SKIP: $Dst — already exists, merge manually"
        $script:skipped++
    } else {
        $dstDir = Split-Path -Parent $Dst
        if (-not (Test-Path -LiteralPath $dstDir)) {
            New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
        }
        if ($Src -eq "-") {
            [System.IO.File]::WriteAllText($Dst, $Content.Replace("`r`n", "`n") + "`n")
        } else {
            Copy-Item -Path $Src -Destination $Dst
        }
        Write-Host "INSTALL: $Dst"
        $script:installed++
    }
}

function Report-ObsoleteFile {
    param([string]$RelativePath)

    $dst = Join-Path $targetDir $RelativePath
    if (Test-Path -LiteralPath $dst) {
        Write-Host "REMOVE: $dst — obsolete in the single-agent TDD harness"
        $script:obsolete++
    }
}

# Install packaged .github files, excluding project-specific setup files
$resourceRoots = @($packageDir)
if ($Agent -eq "codex") {
    $resourceRoots = @((Join-Path $packageDir "skills"), (Join-Path $packageDir "contracts"))
}
Get-ChildItem -Path $resourceRoots -Recurse -File |
    Where-Object {
        ($_.FullName.Replace('\', '/') -notlike "*/instructions/tdd-patterns.instructions.md")
    } |
    Sort-Object FullName |
    ForEach-Object {
        $relPath = $_.FullName.Substring($packageDir.Length).TrimStart('\', '/')
        $relPath = Join-Path ".github" $relPath
        $dst = Join-Path $targetDir $relPath
        Install-File -Src $_.FullName -Dst $dst
    }

if ($Agent -ne "copilot") {
    Get-ChildItem -Path (Join-Path $packageDir "skills") -Directory | ForEach-Object {
        $name = $_.Name
        $wrapper = @"
---
name: ${name}
description: Load canonical ${name} guidance for the opt-in TDD harness.
---

Read and follow .github/skills/${name}/SKILL.md from the repository root.
Resolve its asset, template, and contract paths from the repository root, not this wrapper.
The canonical .github/skills guidance is authoritative; do not duplicate phase policy here.
"@
        Install-File -Src "-" -Dst (Join-Path $targetDir ".agents/skills/${name}/SKILL.md") -Content $wrapper
    }
    $entry = @'
---
name: tdd
description: Explicit opt-in to the canonical TDD workflow for a feature or fix.
---

Activate only when the user explicitly invokes $tdd or requests this workflow.
Read paths below from the repository root; .github/skills remains authoritative.
First check .github/instructions/tdd-patterns.instructions.md. If absent,
stop and request $tdd-setup before any behavior edits; follow
.github/skills/tdd-setup/SKILL.md and obtain its required user confirmation.
Otherwise load the project instructions before planning or editing.

Load .github/skills/tdd-workflow/SKILL.md and
.github/skills/tdd-planning/SKILL.md. Ask for clarification when scope,
expected behavior, commands, or authorization is ambiguous; do not guess.
Use .github/skills/tdd-cycle-runner/SKILL.md to orchestrate one chosen slice.
Run as a single agent inline. No Copilot task or handoff tools are required:
interpret agent/handoff references as logical phase boundaries, not tool calls.
Use .github/contracts/tdd-cycle-contracts.md as local phase records.

Progressively load the relevant canonical phase guidance and its assets:
- .github/skills/tdd-red/SKILL.md
- .github/skills/tdd-green/SKILL.md
- .github/skills/tdd-test-run/SKILL.md
- .github/skills/tdd-commit/SKILL.md
- .github/skills/tdd-refactor/SKILL.md

Follow the canonical phase policy, not a second copy here. Execute verification
commands with an explicit expected result and inspect actual output after edits;
never claim unrun checks. Stop on unexpected results and apply only the scoped
rollback specified by canonical verification guidance. Make a real atomic
commit immediately after GREEN; assess refactoring, verify and commit it before
the next RED. If commands or commits are blocked, stop and report the blocker.
Report completed slices, tests, commits, and remaining work; clarify whether to
continue after a cycle when the user's requested scope is unclear.
No blocking hooks are installed; this is opt-in guidance, not enforcement.
'@
    Install-File -Src "-" -Dst (Join-Path $targetDir ".agents/skills/tdd/SKILL.md") -Content $entry
}

foreach ($obsoleteFile in $obsoleteFiles) {
    Report-ObsoleteFile -RelativePath $obsoleteFile
}

Write-Host ""
Write-Host "Install complete: $installed files installed, $skipped files skipped."
if ($obsolete -gt 0) {
    Write-Host "Obsolete files detected: $obsolete. Remove the files listed above to finish upgrading to the single-agent TDD harness."
}
if ($Agent -ne "codex") {
    Write-Host "Next steps: Run /tdd-setup in Copilot Chat to generate the project-specific TDD instructions, then switch to the tdd agent when you want the workflow."
}
if ($Agent -ne "copilot") {
    Write-Host 'Next steps (Codex CLI/app): Run $tdd-setup, then explicitly invoke $tdd. Restart/reopen the app and check its skill picker if needed.'
}
