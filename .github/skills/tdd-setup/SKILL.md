---
name: tdd-setup
description: >
  Configure TDD harness for this project. Scans existing code to detect
  test runner, framework, and naming patterns, then interviews you to fill
  any gaps. Generates .github/tdd-config.json and
  .github/instructions/tdd-patterns.instructions.md.
user-invocable: true
---

# tdd-setup

Use this skill when the repository needs project-specific TDD configuration.

## Goals

Generate:

- `.github/tdd-config.json`
- `.github/instructions/tdd-patterns.instructions.md`

## Operating Modes

- **Existing project**: Run the scan script first, pre-fill detected values, and ask the user to confirm or correct them before writing files.
- **New project**: If nothing meaningful is detected and there are no existing tests, skip raw scan details and interview the user directly.

## Scan Step

1. Detect the host OS.
2. Run the matching script from the repository root:
   - Windows: `pwsh -File scripts/tdd-scan.ps1`
   - Linux/macOS: `bash scripts/tdd-scan.sh`
3. Parse the JSON output only. Do not invent detected values that are not present in the scan output.

Expected scan payload:

```json
{
  "testRunner": "dotnet test",
  "testWorkingDir": ".",
  "testDir": "tests/",
  "namingPattern": "WhenCondition_ShouldExpectedOutcome",
  "assertionLib": "Shouldly",
  "mockLib": "Moq",
  "existingTestCount": 42,
  "detected": ["testRunner", "testDir", "namingPattern", "assertionLib", "mockLib"]
}
```

## Interview Workflow

Present detected values first, then ask for confirmation or corrections.

If a value is missing, ask:

1. What test runner do you use?
2. Where are your test files?
3. What naming convention do you use for test methods or test cases?
4. What assertion library do you use?
5. What mocking approach or mocking library do you use?
6. Are there project-specific testing patterns for time, logging, HTTP, database, or other dependencies?

Do not write files until the user has confirmed the final values.

## File Generation

After confirmation:

1. Write `.github/tdd-config.json` with the confirmed test runner and file patterns.
2. Choose the closest template from `.github/skills/tdd-setup/templates/`:
   - `dotnet.tdd-patterns.md`
   - `node.tdd-patterns.md`
   - `python.tdd-patterns.md`
   - `java.tdd-patterns.md`
3. Expand the template with project-specific values.
4. Write the result to `.github/instructions/tdd-patterns.instructions.md`.

Use this config shape when generating `.github/tdd-config.json`:

```json
{
  "testCommand": "<confirmed test runner command>",
  "testWorkingDir": "<confirmed working directory>",
  "testFilePattern": "<pattern derived from the confirmed test directory and language>",
  "sourceFilePattern": "<matching source file glob>"
}
```

## Template Selection Guide

- **dotnet**: `dotnet test`, `.sln`, `.csproj`
- **node**: `npm test`, `npx vitest`, `package.json`
- **python**: `pytest`, `pyproject.toml`, `requirements.txt`
- **java**: `mvn test`, `./gradlew test`, `pom.xml`, `build.gradle`

If no template is a close match, generate the instructions from scratch using the same sections as the nearest template.

## Output Requirements

When the skill completes, report:

- which values were auto-detected
- which values were provided by the user
- which files were created or updated
- any values the user may still want to refine later
