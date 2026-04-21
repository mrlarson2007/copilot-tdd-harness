# Detailed Issue Plan

This file contains the detailed implementation content for this single GitHub issue, extracted from the master plan.

## Phase 4 — Lifecycle Hooks ([#5](https://github.com/mrlarson2007/copilot-tdd-harness/issues/5))

### tdd-enforcement.json

```json
{
  "hooks": [
    {
      "event": "UserPromptSubmit",
      "command": "scripts/tdd-run-tests hint",
      "description": "START hint injection: inject current phase reminder"
    },
    {
      "event": "PostToolUse",
      "tools": ["replace_string_in_file", "multi_replace_string_in_file", "create_file"],
      "command": "scripts/tdd-run-tests step",
      "description": "Reflexion feedback after every file edit (step reward)"
    },
    {
      "event": "Stop",
      "command": "scripts/tdd-run-tests terminal",
      "description": "Hard block if tests fail at session end (terminal reward)"
    },
    {
      "event": "PreCompact",
      "command": "scripts/tdd-run-tests state",
      "description": "Save TDD state before context compaction"
    }
  ]
}
```

### tdd-run-tests Script Output (ACI Design)

All modes emit structured JSON via `additionalContext`. Raw test output is never passed to the model.

Implementation note: `scripts/tdd-run-tests.sh` and `scripts/tdd-run-tests.ps1` are thin wrappers that delegate to the cross-platform Go CLI (`cmd/tdd-run-tests`). This keeps the hook contract unchanged while allowing Linux/macOS/Windows artifacts to be built in CI via `.github/workflows/build-tdd-run-tests-cli.yml`.

**Step reward (PostToolUse)**:
```json
{
  "event": "PostToolUse",
  "phase": "GREEN",
  "passed": 14,
  "failed": 1,
  "failures": [
    {
      "testName": "WhenInvalidPassword_ShouldReturnUnauthorized",
      "expected": "401 Unauthorized",
      "actual": "200 OK",
      "cause": "AuthService.Authenticate always returns true"
    }
  ],
  "reflexion": "REFLEXION: WhenInvalidPassword_ShouldReturnUnauthorized failed. Expected 401, got 200. Likely cause: password validation not yet implemented. Hypothesis: add null/empty check in AuthService.Authenticate."
}
```

**Terminal reward (Stop hook)**:
```json
{
  "event": "Stop",
  "passed": 15,
  "failed": 0,
  "decision": "allow",
  "message": "All 15 tests pass. GREEN phase complete."
}
```

or when blocking:
```json
{
  "event": "Stop",
  "passed": 14,
  "failed": 1,
  "decision": "block",
  "stop_hook_active": false,
  "message": "1 test failing. Run tests and make them pass before finishing."
}
```

> **Infinite loop guard**: Scripts always check `stop_hook_active` environment variable. If `true`, emit `"decision": "allow"` immediately to prevent hook recursion.

**UserPromptSubmit hint injection**:
```json
{
  "event": "UserPromptSubmit",
  "additionalContext": "HINT: Current phase is GREEN. The single constraint: write only the minimal code needed to make the failing test pass. Do not add extra functionality.",
  "decision": "continue"
}
```

**PreCompact state preservation**:
```json
{
  "event": "PreCompact",
  "additionalContext": "TDD STATE: phase=GREEN | test=WhenInvalidPassword_ShouldReturnUnauthorized | lastReflexion=Password validation not yet implemented | passed=14 | failed=1"
}
```
