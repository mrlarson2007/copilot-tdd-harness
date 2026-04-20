param(
    [ValidateSet("hint", "step", "terminal", "state", "status")]
    [string]$Mode = "status"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path
Set-Location -Path $repoRoot

function Get-TestConfig {
    $testCommand = $env:TDD_TEST_COMMAND
    $testWorkingDir = $env:TDD_TEST_WORKING_DIR

    if ((-not $testCommand) -and (Test-Path ".github/tdd-config.json")) {
        try {
            $config = Get-Content ".github/tdd-config.json" -Raw | ConvertFrom-Json
            if (-not $testCommand) { $testCommand = $config.testCommand }
            if (-not $testWorkingDir) { $testWorkingDir = $config.testWorkingDir }
        }
        catch {
            # Keep defaults if config is unreadable.
        }
    }

    if (-not $testCommand) {
        if (Get-ChildItem -Recurse -File -Include *.sln, *.csproj -ErrorAction SilentlyContinue | Select-Object -First 1) {
            $testCommand = "dotnet test"
        }
        elseif ((Test-Path "package.json") -and ((Get-Content "package.json" -Raw) -match '"vitest"')) {
            $testCommand = "npx vitest run"
        }
        elseif ((Test-Path "package.json") -and ((Get-Content "package.json" -Raw) -match '"jest"')) {
            $testCommand = "npm test -- --runInBand"
        }
        elseif (Get-ChildItem -Recurse -File -Include pyproject.toml, requirements.txt, setup.py -ErrorAction SilentlyContinue | Select-Object -First 1) {
            $testCommand = "pytest"
        }
        elseif (Test-Path "pom.xml") {
            $testCommand = "mvn test"
        }
        elseif (Get-ChildItem -Recurse -File -Include build.gradle, build.gradle.kts -ErrorAction SilentlyContinue | Select-Object -First 1) {
            $testCommand = "./gradlew test"
        }
    }

    if (-not $testWorkingDir) {
        $testWorkingDir = "."
    }

    return @{
        testCommand    = $testCommand
        testWorkingDir = $testWorkingDir
    }
}

function Get-FirstMatchNumber {
    param(
        [string]$Text,
        [string]$Pattern
    )

    $match = [regex]::Match($Text, $Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($match.Success) {
        return [int]$match.Groups[1].Value
    }
    return $null
}

function Resolve-Phase {
    param(
        [int]$FailedCount
    )

    if ($env:TDD_PHASE) {
        return $env:TDD_PHASE.ToUpperInvariant()
    }

    $gitMessage = ""
    try {
        $gitMessage = (git log -1 --pretty=%s 2>$null).Trim()
    }
    catch {
        $gitMessage = ""
    }

    $lower = $gitMessage.ToLowerInvariant()
    if ($lower.Contains("red")) { return "RED" }
    if ($lower.Contains("green")) { return "GREEN" }
    if ($lower.Contains("refactor")) { return "REFACTOR" }
    if ($lower.Contains("commit")) { return "COMMIT" }

    if ($FailedCount -gt 0) { return "GREEN" }
    return "REFACTOR"
}

function Get-TestState {
    param(
        [hashtable]$Config
    )

    $output = ""
    $exitCode = 0
    $passed = 0
    $failed = 0

    if ($Config.testCommand) {
        try {
            Push-Location -Path $Config.testWorkingDir
            $global:LASTEXITCODE = 0
            $output = (Invoke-Expression $Config.testCommand 2>&1 | Out-String)
            $exitCode = if ($null -ne $LASTEXITCODE) { [int]$LASTEXITCODE } else { 0 }
        }
        catch {
            $output = ($_ | Out-String)
            $exitCode = 1
        }
        finally {
            Pop-Location
        }

        $passedPatterns = @(
            '(\d+)\s+passed',
            '(\d+)\s+passing',
            'passed:\s*(\d+)'
        )
        foreach ($pattern in $passedPatterns) {
            $candidate = Get-FirstMatchNumber -Text $output -Pattern $pattern
            if ($null -ne $candidate) {
                $passed = $candidate
                break
            }
        }

        $failedPatterns = @(
            '(\d+)\s+failed',
            '(\d+)\s+failing',
            'failed:\s*(\d+)',
            'Failures:\s*(\d+)'
        )
        foreach ($pattern in $failedPatterns) {
            $candidate = Get-FirstMatchNumber -Text $output -Pattern $pattern
            if ($null -ne $candidate) {
                $failed = $candidate
                break
            }
        }

        if (($exitCode -ne 0) -and ($failed -eq 0)) {
            $failed = 1
        }
    }

    $firstFailureTest = ""
    if ($failed -gt 0) {
        $patterns = @(
            '(?m)^--- FAIL: ([^\s]+)',
            '(?m)^\s*✕\s+(.+)$',
            '(?m)^\s*\d+\)\s+(.+)$'
        )
        foreach ($pattern in $patterns) {
            $match = [regex]::Match($output, $pattern)
            if ($match.Success) {
                $firstFailureTest = $match.Groups[1].Value.Trim()
                break
            }
        }
        if (-not $firstFailureTest) { $firstFailureTest = "UnknownTest" }
    }

    $expected = ""
    $actual = ""
    if ($failed -gt 0) {
        $expected = [regex]::Match($output, '(?im)expected[:\s]+(.+)$').Groups[1].Value.Trim()
        $actual = [regex]::Match($output, '(?im)(received|actual)[:\s]+(.+)$').Groups[2].Value.Trim()
        if (-not $expected) { $expected = "expected behavior" }
        if (-not $actual) { $actual = "actual behavior differs" }
    }

    $likelyCause = "the implementation for this behavior is incomplete"
    $hypothesis = "update the production code minimally to satisfy the failing assertion, then rerun tests"
    if ($failed -gt 0) {
        $outputLower = $output.ToLowerInvariant()
        if ($outputLower.Contains("expected") -and ($outputLower.Contains("actual") -or $outputLower.Contains("received"))) {
            $likelyCause = "assertion mismatch indicates current behavior differs from test expectation"
            $hypothesis = "adjust the implementation branch used by the failing test, then rerun tests"
        }
        elseif ($outputLower.Contains("command not found") -or $outputLower.Contains("is not recognized as")) {
            $likelyCause = "configured test command is unavailable in the current environment"
            $hypothesis = "fix testCommand/testWorkingDir configuration and rerun tests"
        }
        elseif ($outputLower.Contains("module not found") -or $outputLower.Contains("cannot find module") -or $outputLower.Contains("importerror")) {
            $likelyCause = "missing dependency or unresolved import in test execution path"
            $hypothesis = "install or restore required dependencies and rerun tests"
        }
    }
    $reflexion = if ($failed -gt 0) {
        "REFLEXION: $firstFailureTest failed. Expected $expected, got $actual. Likely cause: $likelyCause. Hypothesis: $hypothesis."
    }
    else {
        "REFLEXION: All tests passed. Continue with strict phase discipline."
    }

    return @{
        output          = $output
        testExitCode    = $exitCode
        passed          = $passed
        failed          = $failed
        firstFailureTest = $firstFailureTest
        expected        = $expected
        actual          = $actual
        likelyCause     = $likelyCause
        hypothesis      = $hypothesis
        reflexion       = $reflexion
    }
}

$config = Get-TestConfig
$state = Get-TestState -Config $config
$phase = Resolve-Phase -FailedCount $state.failed

$phaseConstraint = switch ($phase) {
    "RED" { "write exactly one failing test and avoid production changes." }
    "GREEN" { "write only the minimal production code needed to make the failing test pass." }
    "REFACTOR" { "refactor only while all tests remain green and behavior stays unchanged." }
    "COMMIT" { "commit test and production changes together for one completed behavior." }
    default { "follow the current phase rule strictly and keep changes minimal." }
}

$stopHookActiveRaw = if ($env:STOP_HOOK_ACTIVE) { $env:STOP_HOOK_ACTIVE } elseif ($env:stop_hook_active) { $env:stop_hook_active } else { "false" }
$stopHookActive = @("true", "1", "yes") -contains $stopHookActiveRaw.ToLowerInvariant()

$gitMessage = ""
try {
    $gitMessage = (git log -1 --pretty=%s 2>$null).Trim()
}
catch {
    $gitMessage = ""
}

$payload = switch ($Mode) {
    "hint" {
        [ordered]@{
            event = "UserPromptSubmit"
            additionalContext = "HINT: Current phase is $phase. The single constraint: $phaseConstraint"
            decision = "continue"
        }
        break
    }
    "step" {
        [ordered]@{
            event = "PostToolUse"
            phase = $phase
            passed = $state.passed
            failed = $state.failed
            failures = @(
                if ($state.failed -gt 0) {
                    [ordered]@{
                        testName = $state.firstFailureTest
                        expected = $state.expected
                        actual = $state.actual
                        cause = $state.likelyCause
                    }
                }
            )
            reflexion = $state.reflexion
        }
        break
    }
    "terminal" {
        if ($stopHookActive) {
            [ordered]@{
                event = "Stop"
                passed = $state.passed
                failed = $state.failed
                decision = "allow"
                stop_hook_active = $true
                message = "stop_hook_active=true, skipping terminal enforcement to prevent recursion."
            }
            break
        }

        $decision = if ($state.failed -gt 0) { "block" } else { "allow" }
        $message = if ($state.failed -gt 0) {
            if ($state.failed -eq 1) {
                "1 test failing. Run tests and make them pass before finishing."
            }
            else {
                "$($state.failed) tests failing. Run tests and make them pass before finishing."
            }
        }
        elseif ($config.testCommand) {
            "All $($state.passed) tests pass. GREEN phase complete."
        }
        else {
            "No test command configured; terminal hook allows progress."
        }

        [ordered]@{
            event = "Stop"
            passed = $state.passed
            failed = $state.failed
            decision = $decision
            stop_hook_active = $stopHookActive
            message = $message
        }
        break
    }
    "state" {
        $stateTest = if ($state.failed -gt 0) { $state.firstFailureTest } else { "None" }
        $stateReflexion = if ($state.failed -gt 0) { $state.likelyCause } else { "all tests passing" }
        [ordered]@{
            event = "PreCompact"
            additionalContext = "TDD STATE: phase=$phase | test=$stateTest | lastReflexion=$stateReflexion | passed=$($state.passed) | failed=$($state.failed)"
        }
        break
    }
    "status" {
        $nextAction = if ($state.failed -gt 0) {
            "Continue GREEN phase: make the failing test pass with the minimal production change."
        }
        else {
            "All tests are passing. Continue with COMMIT or REFACTOR discipline."
        }

        [ordered]@{
            event = "Status"
            phase = $phase
            passed = $state.passed
            failed = $state.failed
            failingTests = @(if ($state.failed -gt 0) { $state.firstFailureTest })
            lastCommittedBehavior = $gitMessage
            recommendedNextAction = $nextAction
            testCommand = $config.testCommand
            testWorkingDir = $config.testWorkingDir
            testExitCode = $state.testExitCode
        }
        break
    }
}

$payload | ConvertTo-Json -Depth 6
