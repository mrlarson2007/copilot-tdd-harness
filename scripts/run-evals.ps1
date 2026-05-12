param(
    [switch]$Extended,
    [switch]$Both,
    [switch]$View,
    [string]$ConfigPath
)

$ErrorActionPreference = "Stop"

if (($Extended -and $Both) -or ($View -and ($Extended -or $Both -or $ConfigPath))) {
    throw "Choose only one mode: default, -Extended, -Both, -View, or -ConfigPath <path>."
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path
$evalDir = Join-Path $repoRoot "evals\promptfoo"
$toolingDir = Join-Path $repoRoot ".promptfoo-tooling"

if (-not (Test-Path (Join-Path $toolingDir "package.json"))) {
    throw "Missing .promptfoo-tooling\package.json. Install promptfoo tooling before running evals."
}

function Invoke-Promptfoo {
    param(
        [string[]]$PromptfooArgs,
        [string]$Label
    )

    Write-Host "==> $Label"
    & npx --prefix $toolingDir promptfoo @PromptfooArgs
    if ($LASTEXITCODE -ne 0) {
        throw "promptfoo exited with code $LASTEXITCODE while running: $Label"
    }
}

Push-Location $evalDir
try {
    if ($View) {
        Invoke-Promptfoo -PromptfooArgs @("view") -Label "Opening promptfoo results viewer"
        return
    }

    if ($ConfigPath) {
        Invoke-Promptfoo -PromptfooArgs @("eval", "-c", $ConfigPath) -Label "Running promptfoo eval with custom config"
        return
    }

    if ($Both) {
        Invoke-Promptfoo -PromptfooArgs @("eval") -Label "Running standard promptfoo benchmark"
        Invoke-Promptfoo -PromptfooArgs @("eval", "-c", "promptfooconfig.extended.yaml") -Label "Running extended promptfoo benchmark"
        return
    }

    if ($Extended) {
        Invoke-Promptfoo -PromptfooArgs @("eval", "-c", "promptfooconfig.extended.yaml") -Label "Running extended promptfoo benchmark"
        return
    }

    Invoke-Promptfoo -PromptfooArgs @("eval") -Label "Running standard promptfoo benchmark"
}
finally {
    Pop-Location
}