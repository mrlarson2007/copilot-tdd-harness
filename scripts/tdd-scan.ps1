param(
    [string]$Path = "."
)

$ErrorActionPreference = "Stop"
Set-Location -Path $Path

function Find-Files {
    param(
        [string[]]$Patterns
    )

    Get-ChildItem -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
        $name = $_.Name
        foreach ($pattern in $Patterns) {
            if ($name -like $pattern) {
                return $true
            }
        }
        return $false
    }
}

function Get-FirstMatchValue {
    param(
        [string[]]$Patterns,
        [string]$Value
    )

    if (Find-Files -Patterns $Patterns | Select-Object -First 1) {
        return $Value
    }

    return $null
}

function Test-ContentMatch {
    param(
        [System.IO.FileInfo[]]$Files,
        [string]$Pattern
    )

    foreach ($file in $Files) {
        if (Select-String -Path $file.FullName -Pattern $Pattern -Quiet -ErrorAction SilentlyContinue) {
            return $true
        }
    }

    return $false
}

$packageJson = if (Test-Path "package.json") { Get-Content "package.json" -Raw } else { $null }

$testRunner = $null
if (Get-FirstMatchValue -Patterns @("*.sln", "*.csproj") -Value "dotnet test") {
    $testRunner = "dotnet test"
}
elseif ($packageJson -and $packageJson -match '"vitest"') {
    $testRunner = "npx vitest"
}
elseif ($packageJson -and $packageJson -match '"jest"') {
    $testRunner = "npm test"
}
elseif (Get-FirstMatchValue -Patterns @("pyproject.toml", "requirements.txt", "setup.py") -Value "pytest") {
    $testRunner = "pytest"
}
elseif (Test-Path "pom.xml") {
    $testRunner = "mvn test"
}
elseif (Get-FirstMatchValue -Patterns @("build.gradle", "build.gradle.kts") -Value "./gradlew test") {
    $testRunner = "./gradlew test"
}

$testFiles = Find-Files -Patterns @(
    "*Tests.cs",
    "*Test.cs",
    "*.test.js",
    "*.test.jsx",
    "*.test.ts",
    "*.test.tsx",
    "*.spec.js",
    "*.spec.jsx",
    "*.spec.ts",
    "*.spec.tsx",
    "test_*.py",
    "*_test.py",
    "*Test.java",
    "*Tests.java"
) | Sort-Object FullName

$existingTestCount = @($testFiles).Count
$testWorkingDir = "."
$testDir = $null

if ($existingTestCount -gt 0) {
    $relative = [System.IO.Path]::GetRelativePath((Get-Location).Path, $testFiles[0].DirectoryName).Replace('\', '/')
    if ($relative -eq ".") {
        $testDir = "./"
    }
    else {
        $testDir = "$relative/"
    }
}
else {
    foreach ($candidate in @("tests", "test", "__tests__", "spec", "src/test")) {
        if (Test-Path $candidate) {
            $testDir = "$candidate/"
            break
        }
    }
}

$sampleFiles = @($testFiles | Select-Object -First 20)
$namingPattern = $null
if ($sampleFiles.Count -gt 0) {
    if (Test-ContentMatch -Files $sampleFiles -Pattern 'When[A-Za-z0-9_]+_Should[A-Za-z0-9_]+') {
        $namingPattern = "WhenCondition_ShouldExpectedOutcome"
    }
    elseif (Test-ContentMatch -Files $sampleFiles -Pattern 'def test_[A-Za-z0-9_]+') {
        $namingPattern = "test_function_name"
    }
    elseif (Test-ContentMatch -Files $sampleFiles -Pattern '\b(it|test)\s*\(') {
        $namingPattern = 'test("behavior description")'
    }
    elseif (Test-ContentMatch -Files $sampleFiles -Pattern '@Test|void [A-Za-z0-9_]+Test\s*\(') {
        $namingPattern = "shouldExpectedOutcomeWhenCondition"
    }
}

$scanSources = Find-Files -Patterns @(
    "*.cs",
    "*.csproj",
    "package.json",
    "*.js",
    "*.jsx",
    "*.ts",
    "*.tsx",
    "pyproject.toml",
    "requirements.txt",
    "*.py",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "*.java"
) | Sort-Object FullName

$assertionLib = $null
if (Test-ContentMatch -Files $scanSources -Pattern 'Shouldly') {
    $assertionLib = "Shouldly"
}
elseif (Test-ContentMatch -Files $scanSources -Pattern 'FluentAssertions') {
    $assertionLib = "FluentAssertions"
}
elseif (Test-ContentMatch -Files $scanSources -Pattern '@testing-library|expect\(') {
    if ($testRunner -eq "npx vitest") {
        $assertionLib = "Vitest"
    }
    elseif ($testRunner -eq "npm test") {
        $assertionLib = "Jest"
    }
}
elseif (Test-ContentMatch -Files $scanSources -Pattern 'pytest') {
    $assertionLib = "pytest"
}
elseif (Test-ContentMatch -Files $scanSources -Pattern 'assertj|AssertJ|assertThat\(') {
    $assertionLib = "AssertJ"
}
elseif (Test-ContentMatch -Files $scanSources -Pattern 'hamcrest|MatcherAssert') {
    $assertionLib = "Hamcrest"
}
elseif (Test-ContentMatch -Files $scanSources -Pattern 'Assertions\.') {
    $assertionLib = "JUnit"
}

$mockLib = $null
if (Test-ContentMatch -Files $scanSources -Pattern '\bMoq\b') {
    $mockLib = "Moq"
}
elseif (Test-ContentMatch -Files $scanSources -Pattern 'NSubstitute') {
    $mockLib = "NSubstitute"
}
elseif (Test-ContentMatch -Files $scanSources -Pattern 'sinon') {
    $mockLib = "Sinon"
}
elseif (Test-ContentMatch -Files $scanSources -Pattern 'unittest\.mock|from mock import|pytest-mock') {
    $mockLib = "unittest.mock"
}
elseif (Test-ContentMatch -Files $scanSources -Pattern 'Mockito|mockito') {
    $mockLib = "Mockito"
}
elseif (Test-ContentMatch -Files $scanSources -Pattern 'jest\.fn|vi\.fn|vi\.mock|jest\.mock') {
    $mockLib = "Built-in test doubles"
}

$detected = @()
if ($null -ne $testRunner) { $detected += "testRunner" }
if ($null -ne $testDir) { $detected += "testDir" }
if ($null -ne $namingPattern) { $detected += "namingPattern" }
if ($null -ne $assertionLib) { $detected += "assertionLib" }
if ($null -ne $mockLib) { $detected += "mockLib" }

[ordered]@{
    testRunner = $testRunner
    testWorkingDir = $testWorkingDir
    testDir = $testDir
    namingPattern = $namingPattern
    assertionLib = $assertionLib
    mockLib = $mockLib
    existingTestCount = $existingTestCount
    detected = $detected
} | ConvertTo-Json -Depth 3
