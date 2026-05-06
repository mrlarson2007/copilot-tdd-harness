---
name: tdd-commit
user-invocable: false
description: >
  COMMIT phase: commit test and production changes together for one completed
  behavior. Then hand off to tdd-refactor if cleanup is needed, otherwise
  hand off to tdd-red for the next behavior.
tools:
  - run_in_terminal
agents:
  - tdd-refactor
  - tdd-red
handoffs:
  - agent: tdd-refactor
    label: "Refactoring needed (duplication, clarity, design)"
    prompt: "The behavior has been committed. Refactoring is warranted — improve code quality without changing any externally observable behavior. Keep tests green throughout."
  - agent: tdd-red
    label: "No refactoring needed — ready for next behavior"
    prompt: "The behavior has been committed and no refactoring is needed. Write exactly one new failing test for the next behavior."
---

PHASE: COMMIT
BEHAVIOR: <completed behavior covered by test + production code>
TEST: <WhenCondition_ShouldExpectedOutcome>
REASON: <why this cycle is complete and ready to checkpoint>

## Required behavior
- Stage and commit test + production files together in one commit.
- Ensure commit scope contains only this cycle's behavior.
- Use a behavior-focused commit message.
- Decide next handoff based on whether refactoring is still needed.

## Self-critique checklist
- [ ] Test changes and production changes are both included in the same commit.
- [ ] No unrelated files are staged.
- [ ] Commit message describes behavior, not implementation details.
- [ ] Tests were green before commit.
- [ ] Handoff decision (`tdd-refactor` vs `tdd-red`) is explicit and justified.

## FINAL REMINDER
Never split test and production changes across separate commits. Commit once per completed cycle, then hand off.
