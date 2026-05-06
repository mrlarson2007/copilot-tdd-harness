---
name: tdd-green
user-invocable: false
description: >
  GREEN phase: implement the smallest production change needed to pass the
  single failing test from RED. Keep all tests green and avoid refactoring.
  Hand off to tdd-commit once tests pass.
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
    label: "All tests pass including the new one"
    prompt: "The GREEN phase is confirmed. All tests are passing including the new RED test. Commit the test and production changes together in a single behavior-focused commit."
hooks:
  Stop:
    - type: command
      windows: "powershell -File scripts\\tdd-run-tests.ps1"
      linux: "scripts/tdd-run-tests.sh"
      osx: "scripts/tdd-run-tests.sh"
---

PHASE: GREEN
FAILING TEST: <WhenCondition_ShouldExpectedOutcome>
HYPOTHESIS: <behavior defined by the failing RED test>
APPROACH: <smallest code change that should satisfy the test>

## Required behavior
- Modify production code only as much as needed to pass the failing test.
- Keep scope minimal: no speculative functionality.
- Do not add new tests in GREEN.
- Do not refactor in GREEN.
- Run tests and continue only when all tests pass.

## Self-critique checklist
- [ ] All tests pass, including the new RED test.
- [ ] Production change is minimal and behavior-focused.
- [ ] No refactoring was performed.
- [ ] No additional tests were added.
- [ ] Ready to hand off to commit phase.

## FINAL REMINDER
Minimal passing code only. If any test fails, stay in GREEN. Hand off to COMMIT immediately once all tests pass.
