---
name: tdd-setup
description: >
  Configure TDD harness for this project. Scans existing code to detect
  test runner, framework, and naming patterns, then interviews you to fill
  any gaps. Generates tdd-config.json and tdd-patterns.instructions.md.
user-invocable: true
---

# tdd-setup

Use this skill when the user runs `/tdd-setup`.

## Goal
Generate project-specific TDD harness files:
- `.github/tdd-config.json`
- `.github/instructions/tdd-patterns.instructions.md`

## Mode Detection

1. Determine mode:
   - **Existing project mode**: if any of `*.sln`, `package.json`, `pyproject.toml`, `pom.xml`, `build.gradle`, or existing test files are present.
   - **New project mode**: if none of the above are present.
2. In existing-project mode, run the platform scan script and pre-fill values.
3. In new-project mode, skip scan output and ask interview questions directly.

## Existing-Project Scan

- On Windows run: `pwsh -NoProfile -File scripts/tdd-scan.ps1`
- On Linux/macOS run: `bash scripts/tdd-scan.sh`

Parse the JSON object and use these fields when available:
- `testRunner`
- `testWorkingDir`
- `testDir`
- `namingPattern`
- `assertionLib`
- `mockLib`
- `existingTestCount`
- `detected` (array of field names)

## Interview + Confirmation Flow

1. Present all detected values in a compact checklist/table.
2. Ask the user to confirm or edit each value before writing files.
3. For missing values, ask:
   - Test runner command
   - Test working directory
   - Test file directory/pattern
   - Test naming convention
   - Assertion library/style
   - Mocking library/approach
   - Project-specific test patterns (DB/time/logging/etc.)
4. Do not write files until the user confirms final values.

## File Generation

After confirmation, generate:

1. `.github/tdd-config.json`
   - Include confirmed values for command, working directory, and test file pattern.
2. `.github/instructions/tdd-patterns.instructions.md`
   - Select template from `.github/skills/tdd-setup/templates/` based on stack:
     - `dotnet.tdd-patterns.md`
     - `node.tdd-patterns.md`
     - `python.tdd-patterns.md`
     - `java.tdd-patterns.md`
   - If no template fits, generate from scratch.
   - Fill template placeholders with confirmed values and examples.

## Output Contract

Report what was created/updated and echo final confirmed values so the user can review them quickly.
