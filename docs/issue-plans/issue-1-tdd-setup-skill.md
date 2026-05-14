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
  Configure TDD harness for this project. Uses exemplar test and production
  code plus LLM analysis to extract project patterns, then interviews you to
  fill any gaps. Generates tdd-patterns.instructions.md and stage assets.
user-invocable: true
---
```

Invoked as `/tdd-setup` from Copilot Chat.

### Pattern Extraction Output (Structured Summary)

Setup analyzes user-selected exemplar test and production files and emits confirmed pattern summaries:

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

Extraction heuristics:
- Analyze exemplar tests for naming, assertions, doubles, and structure.
- Analyze exemplar production code for naming, formatting, and implementation conventions.
- Analyze both for refactor boundaries and surrounding-code consistency rules.

### Interview Questions (when exemplar analysis is insufficient)

1. What test runner do you use?
2. Where are your test files?
3. What naming convention for test methods?
4. What assertion library?
5. What mocking approach?
6. Any project-specific patterns? (database, time, logging, etc.)

### SKILL.md Workflow

1. Ask user for exemplar test and production files
2. Run LLM analysis to extract project patterns
3. Present extracted patterns to user for confirmation
4. For any missing values, ask interview questions
5. Choose matching template from `skills/tdd-setup/templates/` OR generate from scratch
6. Generate `tdd-patterns.instructions.md` and stage-specific pattern assets
7. Report what was created/updated
