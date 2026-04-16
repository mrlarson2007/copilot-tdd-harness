# Detailed Issue Plan

This file contains the detailed implementation content for this single GitHub issue, extracted from the master plan.

## Phase 1 — Always-On Rules & Project Config ([#2](https://github.com/mrlarson2007/copilot-tdd-harness/issues/2))

### tdd-constitution.instructions.md

```markdown
---
applyTo: "**"
---

# TDD Constitution

These rules apply to ALL code changes in this project.

1. Never write production code without a failing test first (RED phase).
2. Write the minimal production code to make the failing test pass (GREEN phase).
3. Never refactor production code while tests are failing.
4. Commit test and production code together — never separately.
5. One behavior per TDD cycle. Do not implement multiple behaviors in one cycle.
6. Tests are permanent — never delete or modify tests to make them pass.

FINAL REMINDER: If you are about to write production code, ask yourself: "Is there a failing test for this?" If no, write the test first.
```

> **Conflict avoidance**: Uses `.github/instructions/` with `applyTo: "**"` instead of `copilot-instructions.md`. This is purely additive — coexists with any existing `copilot-instructions.md`.

### tdd-config.json Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "description": "TDD harness configuration for this project",
  "type": "object",
  "properties": {
    "testCommand": {
      "type": "string",
      "description": "Command to run all tests",
      "examples": ["dotnet test", "npm test", "pytest", "./gradlew test"]
    },
    "testWorkingDir": {
      "type": "string",
      "description": "Working directory for test command",
      "default": "."
    },
    "testFilePattern": {
      "type": "string",
      "description": "Glob pattern for test files",
      "examples": ["**/*Tests.cs", "**/*.test.ts", "**/test_*.py"]
    },
    "sourceFilePattern": {
      "type": "string",
      "description": "Glob pattern for production source files"
    },
    "hookMode": {
      "type": "string",
      "enum": ["soft", "hard", "both"],
      "description": "soft=PostToolUse feedback only; hard=Stop hook blocks; both=both",
      "default": "both"
    }
  },
  "required": ["testCommand"]
}
```

