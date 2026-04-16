# Detailed Issue Plan

This file contains the detailed implementation content for this single GitHub issue, extracted from the master plan.

## Phase 3 — Phase Agents ([#4](https://github.com/mrlarson2007/copilot-tdd-harness/issues/4))

Four agents implement the handoff chain: `tdd-red` → `tdd-green` → `tdd-commit` → `tdd-refactor` → `tdd-commit` (or back to `tdd-red`).

### Handoff Chain

```
tdd-red  ──handoff──▶  tdd-green  ──handoff──▶  tdd-commit
                                                      │
                        tdd-red  ◀──handoff──  tdd-refactor
                                                      ▲
                                               tdd-commit ──handoff──▶ tdd-refactor (optional)
```

### tdd-red.agent.md

```yaml
---
name: tdd-red
description: >
  RED phase: Write exactly ONE failing test for the described behavior.
  Do not write any production code. Commit nothing. Hand off to tdd-green.
tools:
  - read_file
  - create_file
  - file_search
  - grep_search
agents:
  - tdd-green
handoffs:
  - agent: tdd-green
    condition: "exactly one new failing test exists and all prior tests still pass"
---
```

**ReAct block** (required at start of every response):
```
PHASE: RED
BEHAVIOR: <one sentence describing the behavior under test>
TEST: <WhenCondition_ShouldExpectedOutcome>
REASON: <why this is the right edge case to test first>
```

**Self-critique checklist** (Constitutional AI — required before handoff):
- [ ] Exactly ONE new test added?
- [ ] Test fails for the right reason (not compile error)?
- [ ] Tests behavior, not implementation?
- [ ] No production code written or modified?
- [ ] Test name follows `WhenCondition_ShouldExpectedOutcome` pattern?

**FINAL REMINDER**: Write ONE test. ONE. Do not write production code.

### tdd-green.agent.md

```yaml
---
name: tdd-green
description: >
  GREEN phase: Write the minimal production code to make the failing test pass.
  Do not add extra functionality. Do not refactor. All prior tests must still pass.
tools:
  - read_file
  - create_file
  - replace_string_in_file
  - multi_replace_string_in_file
  - run_in_terminal
agents:
  - tdd-commit
handoffs:
  - agent: tdd-commit
    condition: "all tests pass including the new one"
hooks:
  Stop:
    - command: "scripts/tdd-run-tests.{ps1,sh}"
      decision: "block"
      message: "All tests must pass before leaving GREEN phase."
---
```

**ReAct block**:
```
PHASE: GREEN
FAILING TEST: <test name>
HYPOTHESIS: <minimal code change that will make it pass>
APPROACH: <one sentence>
```

**Self-critique checklist**:
- [ ] All tests pass (including the new one)?
- [ ] Minimal code only — no extra functionality added?
- [ ] No refactoring done?
- [ ] No new tests written?

**FINAL REMINDER**: Minimal code only. If tests pass, hand off immediately. Do not improve code structure yet.

### tdd-commit.agent.md

```yaml
---
name: tdd-commit
description: >
  COMMIT phase: Commit test and production code together in a single commit.
  Never commit test and production code separately. Then hand off to either
  tdd-refactor (if refactoring needed) or tdd-red (for next behavior).
tools:
  - run_in_terminal
agents:
  - tdd-red
  - tdd-refactor
handoffs:
  - agent: tdd-refactor
    condition: "refactoring is needed (duplication, clarity, design)"
  - agent: tdd-red
    condition: "no refactoring needed; ready for next behavior"
---
```

**Self-critique checklist**:
- [ ] Both test file AND production file are staged?
- [ ] Commit message describes the behavior, not the implementation?
- [ ] No unrelated files staged?

**FINAL REMINDER**: Test + production code in ONE commit. Never split them.

### tdd-refactor.agent.md

```yaml
---
name: tdd-refactor
description: >
  REFACTOR phase: Improve code quality without changing behavior.
  All tests must remain green throughout. No new tests. No new functionality.
  Hand off to tdd-commit when done.
tools:
  - read_file
  - replace_string_in_file
  - multi_replace_string_in_file
  - run_in_terminal
agents:
  - tdd-commit
handoffs:
  - agent: tdd-commit
    condition: "refactoring complete and all tests still pass"
---
```

**ReAct block**:
```
PHASE: REFACTOR
REFACTORING TARGET: <what is being improved>
BEHAVIOR PRESERVED: <how I will verify behavior is unchanged>
APPROACH: <specific change>
```

**Self-critique checklist**:
- [ ] All tests still pass?
- [ ] No new functionality added?
- [ ] No new tests written?
- [ ] Behavior externally identical?

**FINAL REMINDER**: Tests must stay green throughout every refactoring step. Run tests after each change.

