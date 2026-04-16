#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Find-First {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Patterns
    )

    foreach ($pattern in $Patterns) {
        $match = Get-ChildItem -Path . -Filter $pattern -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -ne $match) {
            return $match
        }
    }

    return $null
}

function Get-TestRunner {
    if (Find-First -Patterns @('*.sln', '*.csproj')) {
        return 'dotnet test'
    }

    $packageJson = Find-First -Patterns @('package.json')
    if ($packageJson) {
        try {
            $pkg = Get-Content -Raw -Path $packageJson.FullName | ConvertFrom-Json
            $deps = @{}
            foreach ($section in @('dependencies', 'devDependencies', 'peerDependencies')) {
                if ($pkg.$section) {
                    $pkg.$section.PSObject.Properties | ForEach-Object { $deps[$_.Name] = $_.Value }
                }
            }
            if ($deps.ContainsKey('vitest')) {
                return 'npx vitest run'
            }
            if ($deps.ContainsKey('jest')) {
                return 'npm test'
            }
            if ($pkg.scripts -and $pkg.scripts.test) {
                return 'npm test'
            }
        } catch {
            return 'npm test'
        }

        return 'npm test'
    }

    if (Find-First -Patterns @('pyproject.toml', 'requirements.txt')) {
        return 'pytest'
    }

    if (Find-First -Patterns @('pom.xml')) {
        return 'mvn test'
    }

    if (Find-First -Patterns @('build.gradle', 'build.gradle.kts')) {
        return './gradlew test'
    }

    return $null
}

function Get-TestDir {
    foreach ($name in @('tests', 'test', '__tests__', 'spec')) {
        $dir = Get-ChildItem -Path . -Directory -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq $name } | Select-Object -First 1
        if ($dir) {
            $relative = [System.IO.Path]::GetRelativePath((Resolve-Path .).Path, $dir.FullName)
            if ([string]::IsNullOrWhiteSpace($relative) -or $relative -eq '.') {
                return './'
            }
            return ($relative -replace '\\', '/') + '/'
        }
    }

    return $null
}

$testPatterns = @('*test*.cs', '*test*.js', '*test*.ts', 'test_*.py', '*Test.java', '*Tests.java', '*Spec.java')
$testFiles = @()
foreach ($pattern in $testPatterns) {
    $testFiles += Get-ChildItem -Path . -Recurse -File -Filter $pattern -ErrorAction SilentlyContinue
}

foreach ($dirName in @('tests', 'test', '__tests__', 'spec')) {
    $testFiles += Get-ChildItem -Path . -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -match "[\\/]$dirName[\\/]" -and
            @('.cs', '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.kt') -contains $_.Extension.ToLowerInvariant()
        }
}

$testFiles = @($testFiles | Sort-Object -Property FullName -Unique)
$sampleFiles = @($testFiles | Select-Object -First 20)

$patternCounts = @{
    'WhenCondition_ShouldExpectedOutcome' = 0
    'Given_When_Then' = 0
    'test_function_style' = 0
    'it_should_style' = 0
}

$assertionSignatures = @{
    'Shouldly' = @('\bShould\w*\(')
    'FluentAssertions' = @('\.Should\(\)')
    'xUnit/NUnit assertions' = @('\bAssert\.[A-Za-z]+\(')
    'Jest expect' = @('\bexpect\s*\(')
    'Chai' = @('\bchai\b', '\bexpect\s*\(')
    'pytest/assert' = @('\bassert\s+')
    'AssertJ' = @('\bassertThat\s*\(')
    'JUnit assertions' = @('\bAssertions\.[A-Za-z]+\(')
}

$mockSignatures = @{
    'Moq' = @('\bMoq\b', '\bMock<')
    'NSubstitute' = @('\bNSubstitute\b', '\bSubstitute\.For')
    'Jest mocks' = @('\bjest\.mock\(', '\bjest\.fn\(')
    'Sinon' = @('\bsinon\b')
    'unittest.mock' = @('\bunittest\.mock\b', '\bmock\.[A-Za-z]+')
    'Mockito' = @('\bMockito\b', '\bmock\s*\(')
}

$assertionHits = @{}
$mockHits = @{}
foreach ($k in $assertionSignatures.Keys) { $assertionHits[$k] = 0 }
foreach ($k in $mockSignatures.Keys) { $mockHits[$k] = 0 }

foreach ($file in $sampleFiles) {
    $text = Get-Content -Raw -Path $file.FullName -ErrorAction SilentlyContinue
    if (-not $text) { continue }

    $patternCounts['WhenCondition_ShouldExpectedOutcome'] += ([regex]::Matches($text, '\bWhen[A-Za-z0-9_]*_Should[A-Za-z0-9_]*\b')).Count
    $patternCounts['Given_When_Then'] += ([regex]::Matches($text, '\bGiven[A-Za-z0-9_]*_When[A-Za-z0-9_]*_Then[A-Za-z0-9_]*\b')).Count
    $patternCounts['test_function_style'] += ([regex]::Matches($text, '\bdef\s+test_[A-Za-z0-9_]*\s*\(')).Count
    $patternCounts['it_should_style'] += ([regex]::Matches($text, '\bit\s*\(\s*["'']should\b', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)).Count

    foreach ($lib in $assertionSignatures.Keys) {
        foreach ($sig in $assertionSignatures[$lib]) {
            $assertionHits[$lib] += ([regex]::Matches($text, $sig)).Count
        }
    }

    foreach ($lib in $mockSignatures.Keys) {
        foreach ($sig in $mockSignatures[$lib]) {
            $mockHits[$lib] += ([regex]::Matches($text, $sig)).Count
        }
    }
}

$namingPattern = $null
if (($patternCounts.Values | Measure-Object -Maximum).Maximum -gt 0) {
    $namingPattern = ($patternCounts.GetEnumerator() | Sort-Object -Property Value -Descending | Select-Object -First 1).Key
}

$assertionLib = $null
if (($assertionHits.Values | Measure-Object -Maximum).Maximum -gt 0) {
    $assertionLib = ($assertionHits.GetEnumerator() | Sort-Object -Property Value -Descending | Select-Object -First 1).Key
}

$mockLib = $null
if (($mockHits.Values | Measure-Object -Maximum).Maximum -gt 0) {
    $mockLib = ($mockHits.GetEnumerator() | Sort-Object -Property Value -Descending | Select-Object -First 1).Key
}

$existingProject = $false
if (Find-First -Patterns @('*.sln', '*.csproj', 'package.json', 'pyproject.toml', 'requirements.txt', 'pom.xml', 'build.gradle', 'build.gradle.kts')) {
    $existingProject = $true
}
if (-not $existingProject -and $testFiles.Count -gt 0) {
    $existingProject = $true
}

$result = [ordered]@{
    mode = if ($existingProject) { 'existing-project' } else { 'new-project' }
    testRunner = Get-TestRunner
    testWorkingDir = '.'
    testDir = Get-TestDir
    namingPattern = $namingPattern
    assertionLib = $assertionLib
    mockLib = $mockLib
    existingTestCount = $testFiles.Count
    detected = @()
}

foreach ($field in @('testRunner', 'testWorkingDir', 'testDir', 'namingPattern', 'assertionLib', 'mockLib')) {
    if ($result[$field]) {
        $result.detected += $field
    }
}

$result | ConvertTo-Json -Depth 4
