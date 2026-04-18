---
name: tdd-commit
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
    condition: "tests.status == 'passing' && commit.created && refactor.required"
  - agent: tdd-red
    condition: "tests.status == 'passing' && commit.created && !refactor.required"
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

## Handoff condition context
- `tests.status`: overall test status before handoff (`passing`/`failing`).
- `commit.created`: whether the phase created a commit.
- `refactor.required`: explicit decision flag for additional cleanup work.
- Runtime note: these variables are evaluated from agent execution metadata/state in the handoff engine.

## Refactor decision criteria
- Set `refactor.required = true` when at least one concrete trigger exists after GREEN:
  - duplicated logic in multiple locations,
  - misleading/ambiguous names,
  - oversized function/class that should be split,
  - dead code left from minimal GREEN implementation.
- Set `refactor.required = false` when behavior is complete and code quality is already acceptable for the cycle.

## Self-critique checklist
- [ ] Test changes and production changes are both included in the same commit.
- [ ] No unrelated files are staged.
- [ ] Commit message describes behavior, not implementation details.
- [ ] Tests were green before commit.
- [ ] Handoff decision (`tdd-refactor` vs `tdd-red`) is explicit and justified.

## FINAL REMINDER
Never split test and production changes across separate commits. Commit once per completed cycle, then hand off.
