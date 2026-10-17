param(
    [switch]$Extended,
    [switch]$Both,
    [switch]$View,
    [string]$ConfigPath,
    # Copilot model id(s) passed to 'copilot --model'. Defaults to the Copilot CLI default model.
    [string[]]$Model = @(),
    # 'harness' runs with the TDD agent and skills, 'baseline' runs the default agent with no skills.
    [ValidateSet("harness", "baseline", "both")]
    [string]$Condition = "harness",
    [ValidateRange(1, [int]::MaxValue)]
    [int]$Repeat = 0
)

$ErrorActionPreference = "Stop"

if (($Extended -and $Both) -or ($ConfigPath -and ($Extended -or $Both)) -or ($View -and ($Extended -or $Both -or $ConfigPath))) {
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
    & npx --prefix $toolingDir promptfoo @PromptfooArgs | Out-Host
    return $LASTEXITCODE
}

function Get-DefaultOutput([string]$Config) {
    switch ($Config) {
        "promptfooconfig.yaml" { return "results/promptfoo-benchmark.json" }
        "promptfooconfig.extended.yaml" { return "results/promptfoo-extended-benchmark.json" }
        default { return $null }
    }
}

function ConvertTo-SafeSegment([string]$Value) {
    return ($Value -replace '[^a-zA-Z0-9._-]+', '-').Trim('-')
}

Push-Location $evalDir
$previousModel = $env:EVAL_MODEL
$previousCondition = $env:EVAL_CONDITION
$finalStatus = 0
try {
    if ($View) {
        $null = Invoke-Promptfoo -PromptfooArgs @("view") -Label "Opening promptfoo results viewer"
        return
    }

    $configs = @("promptfooconfig.yaml")
    if ($ConfigPath) { $configs = @($ConfigPath) }
    elseif ($Both) { $configs = @("promptfooconfig.yaml", "promptfooconfig.extended.yaml") }
    elseif ($Extended) { $configs = @("promptfooconfig.extended.yaml") }

    $conditions = if ($Condition -eq "both") { @("harness", "baseline") } else { @($Condition) }
    $models = @($Model | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    if ($models.Count -eq 0) { $models = @("") }

    New-Item -ItemType Directory -Force -Path "results/runs" | Out-Null

    foreach ($config in $configs) {
        foreach ($cond in $conditions) {
            foreach ($m in $models) {
                $stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
                $configName = [System.IO.Path]::GetFileNameWithoutExtension($config)
                $modelName = if ($m) { $m } else { "default" }
                $runFile = "results/runs/$stamp-$(ConvertTo-SafeSegment $configName)-$cond-$(ConvertTo-SafeSegment $modelName).json"

                $outputs = @()
                $defaultOutput = Get-DefaultOutput $config
                if ($defaultOutput) { $outputs += $defaultOutput }
                $outputs += $runFile

                $promptfooArgs = @("eval", "-c", $config)
                if ($Repeat -gt 0) { $promptfooArgs += @("--repeat", "$Repeat") }
                $promptfooArgs += "-o"
                $promptfooArgs += $outputs

                $env:EVAL_CONDITION = $cond
                $env:EVAL_MODEL = $m
                $status = Invoke-Promptfoo -PromptfooArgs $promptfooArgs -Label "Running $configName (condition=$cond, model=$modelName)"
                Write-Host "    results: evals/promptfoo/$runFile (exit $status)"
                if ($status -ne 0 -and $finalStatus -eq 0) { $finalStatus = $status }
            }
        }
    }
}
finally {
    $env:EVAL_MODEL = $previousModel
    $env:EVAL_CONDITION = $previousCondition
    Pop-Location
}

if ($finalStatus -ne 0) {
    throw "promptfoo exited with code $finalStatus for at least one run. Failing runs are still written to evals/promptfoo/results/runs/."
}
