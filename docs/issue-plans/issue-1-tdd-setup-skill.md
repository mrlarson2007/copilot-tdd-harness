# Detailed Issue Plan

This file contains the detailed implementation content for this single GitHub issue, extracted from the master plan.

## Phase 0 — tdd-setup Skill ([#1](https://github.com/mrlarson2007/copilot-tdd-harness/issues/1))

### Purpose

Generate the two project-specific config files so the harness knows how to run tests and what patterns to enforce:
- `.github/tdd-config.json` — test runner command, working directory, file patterns
- `.github/instructions/tdd-patterns.instructions.md` — naming conventions, assertion style, mock patterns

### Two Modes (auto-detected)

**Existing project** — scans first, pre-fills all detected values, confirms with user before writing.

**New project** — pure interview; no scan output to confuse the user.

### SKILL.md Frontmatter

```yaml
---
name: tdd-setup
description: >
  Configure TDD harness for this project. Scans existing code to detect
  test runner, framework, and naming patterns, then interviews you to fill
  any gaps. Generates tdd-config.json and tdd-patterns.instructions.md.
user-invocable: true
---
```

Invoked as `/tdd-setup` from Copilot Chat.

### Scan Script Output (Structured JSON — ACI design)

`scripts/tdd-scan.ps1` / `scripts/tdd-scan.sh` emit:

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

Detection heuristics:
- `*.csproj` / `*.sln` → `dotnet test`
- `package.json` with jest/vitest → `npm test` or `npx vitest`
- `requirements.txt` / `pyproject.toml` → `pytest`
- `pom.xml` / `build.gradle` → `mvn test` or `./gradlew test`
- Scan first 20 test files for naming patterns (regex on method names)
- Scan `using` / `import` / `require` statements for assertion library

### Interview Questions (when scan is insufficient)

1. What test runner do you use? *(auto-filled if detected)*
2. Where are your test files? *(auto-filled)*
3. What naming convention for test methods? *(auto-filled if detected; else show examples)*
4. What assertion library? *(auto-filled)*
5. What mocking approach? *(auto-filled or None)*
6. Any project-specific patterns? (database, time, logging, etc.)

### SKILL.md Workflow

1. Detect OS, run `scripts/tdd-scan.{ps1,sh}`
2. Parse JSON output — pre-fill all detected values
3. Present detected values to user for confirmation
4. For any undetected value, ask the corresponding interview question
5. Generate `tdd-config.json` with confirmed values
6. Choose matching template from `skills/tdd-setup/templates/` OR generate from scratch
7. Generate `tdd-patterns.instructions.md` using confirmed values + examples from TDD-Framework.md
8. Report what was created/updated
