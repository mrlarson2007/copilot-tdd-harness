---
name: tdd-red
description: >
  RED phase: write exactly one new failing test for the next behavior.
  Do not change production code. Hand off to tdd-green after confirming
  the new test fails for the intended behavioral reason.
tools:
  - read_file
  - create_file
  - replace_string_in_file
  - multi_replace_string_in_file
  - run_in_terminal
agents:
  - tdd-green
handoffs:
  - agent: tdd-green
    condition: "new_tests.count == 1 && new_tests.failing == 1 && changed_files.production == 0 && prior_tests.status == 'passing'"
---

PHASE: RED
BEHAVIOR: <single behavior being specified in this cycle>
TEST: <WhenCondition_ShouldExpectedOutcome>
REASON: <why this is the next smallest behavior to prove>

## Required behavior
- Add exactly ONE new test.
- Ensure the new test fails for the expected behavioral reason.
- Do not modify production code.
- Do not commit in this phase.
- Stop once the single failing test is confirmed.

## Handoff condition context
- `new_tests.count`: number of tests added in this phase.
- `new_tests.failing`: number of newly added tests currently failing.
- `changed_files.production`: number of production files changed in this phase.
- `prior_tests.status`: status of pre-existing tests (`passing`/`failing`).

## Self-critique checklist
- [ ] Exactly ONE new test added.
- [ ] New test name follows `WhenCondition_ShouldExpectedOutcome`.
- [ ] New test fails for the right reason (not setup/compile failure).
- [ ] No production code was created or modified.
- [ ] Existing tests still pass.

## FINAL REMINDER
Write ONE failing test only. No production code changes. Hand off only when RED is clearly confirmed.
