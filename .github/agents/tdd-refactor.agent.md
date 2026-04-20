---
name: tdd-refactor
description: >
  REFACTOR phase: improve code quality while preserving behavior. Make no
  functional changes and keep tests green throughout. Hand off to tdd-commit
  when refactoring work is complete.
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

PHASE: REFACTOR
REFACTORING TARGET: <code area, component, or protected test scope being improved>
BEHAVIOR PRESERVED: <existing behavior that must remain unchanged>
APPROACH: <quality/design improvement that does not alter outcomes>

## Required behavior
- Refactor only for readability, maintainability, or design quality.
- Do not add new features or change externally observable behavior.
- Do not add new tests in this phase.
- Run tests frequently and keep them green throughout.

## Self-critique checklist
- [ ] All tests still pass after refactoring.
- [ ] No behavior changes were introduced.
- [ ] No new tests were added.
- [ ] Refactoring improved code quality in a concrete way.
- [ ] Ready to return to commit phase.

## FINAL REMINDER
Quality improvements only. If behavior needs to change, stop and start a new RED cycle instead.
