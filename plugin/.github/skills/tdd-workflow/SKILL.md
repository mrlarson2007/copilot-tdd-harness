---
title: TDD Workflow Skill
description: >
  Enforces a strict Red-Green-Refactor-Commit TDD workflow. Use when making
  any code changes or adding behavior. Guides the RED→GREEN→COMMIT→REFACTOR
  cycle with one-test-per-cycle discipline, edge-case-first ordering, minimal
  green implementations, and explicit verification checkpoints.
user-invocable: true
---

Use this skill when implementing or changing behavior via strict TDD.

This skill assumes a concrete target behavior has already been chosen by the
user or by `tdd-planning`. It governs execution discipline; it does not decide
which feature slice to implement next.


## Core Rules (Distilled)

1. Never write production code before a failing test (RED first).
2. Write exactly one new test per TDD cycle (one behavior at a time).
3. Prefer edge cases first, then happy-path coverage.
4. In GREEN, write the smallest possible code to pass the failing test only.
5. Every RED, GREEN, and REFACTOR edit must be followed by an explicit VERIFY step.
6. If VERIFY disproves the expected result, revert only the in-scope changes from
  the current step and return to the preceding step.
7. Do not refactor while any test is failing.
8. Keep tests permanent; do not delete or weaken tests to force passing results.
9. **Commit immediately after GREEN** — test + production code together in one commit.
10. **Commit again after REFACTOR** — if any refactoring was done, commit the cleaned-up code before starting the next RED cycle. Never carry uncommitted refactoring into the next cycle.

## Required Test Naming

All newly added tests should follow:

`WhenCondition_ShouldExpectedOutcome`

Examples:
- `WhenInputIsNull_ShouldThrowValidationError`
- `WhenCartIsEmpty_ShouldReturnZeroTotal`
- `WhenTokenIsExpired_ShouldReturnUnauthorized`

## Execution Discipline

### RED
- Add one failing test for the next behavior.
- VERIFY the expected failing result through `tdd-test-run`.
- No production code edits.

### GREEN
- Make the failing test pass with minimal code.
- VERIFY the expected passing result through `tdd-test-run`.
- Avoid speculative functionality.
- Keep all existing tests green.

Minimal GREEN examples:
- Return a constant required by the test (temporarily) instead of building broader logic.
- Add the narrowest conditional branch needed for the new failing edge case.
- Create only the smallest helper needed to satisfy current assertions.

### COMMIT (after GREEN)
- Stage and commit test + production code together.
- Keep scope to one completed behavior.
- **This commit is mandatory. Do it immediately after GREEN verification succeeds.**
- Do not insert formatting, cleanup, refactoring, or next-slice planning between
  GREEN and this commit, except for removing unstaged build artifacts that should
  not be committed.
- Entering REFACTOR before this commit is a protocol error.

### REFACTOR
- Improve design/readability only with tests green throughout.
- VERIFY after refactoring through `tdd-test-run` before claiming behavior is preserved.
- No behavior changes, no new features.
- If behavior changes are needed, start a new RED cycle.
- REFACTOR is optional and only starts after the GREEN behavior commit is done.
- After every GREEN commit, explicitly check whether the new passing slice created
  obvious duplication, brittle setup, or a misleading fake in either tests or
  production code.
- When that check finds a local design improvement that can be made without
  changing behavior, perform a REFACTOR step before the next RED cycle instead
  of continuing to stack more cases on top of the duplication.
- Typical REFACTOR examples include consolidating repeated tests into a Theory
  with inline data, extracting a small lookup or loop from repeated conditionals,
  and renaming helpers or variables to match the protected behavior more clearly.
- **If you made any changes during REFACTOR, you must commit them before starting
  the next RED cycle.** Use a commit message that describes the design improvement
  (e.g. `refactor: extract helper`, `style: rename for clarity`).
- Carrying uncommitted refactoring into the next cycle is a protocol error.

## Quick Self-Check Before Handoff

- Did I add exactly one test for exactly one behavior?
- Is the test named `WhenCondition_ShouldExpectedOutcome`?
- Did I cover an edge case first when applicable?
- Is GREEN implementation minimal and only for current test?
- Did I run VERIFY after the last edit and get the expected result?
- If VERIFY failed, did I revert only the current step's in-scope changes?
- Are all tests passing before refactor/commit transitions?
- **Did I commit immediately after GREEN? (mandatory — not optional)**
- **After the GREEN commit, did I explicitly evaluate whether a REFACTOR is now
  warranted because of duplication or a temporary fake?**
- **If I refactored, did I commit the refactoring before starting the next RED?**

## Required Handoff Context

Before using this skill, make sure you can state:

- the single behavior being implemented now
- the failing test or the exact test you are about to add
- why this is the next smallest slice

If you cannot state those without guessing, go back to `tdd-planning` before
starting RED.
