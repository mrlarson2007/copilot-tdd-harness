---
name: tdd-workflow
description: >
  Enforces a strict Red-Green-Refactor-Commit TDD workflow. Use when making
  any code changes or adding behavior. Guides the RED→GREEN→COMMIT→REFACTOR
  cycle with one-test-per-cycle discipline, edge-case-first ordering, and
  minimal green implementations.
user-invocable: false
---

# TDD Workflow Skill

Use this skill when implementing or changing behavior via strict TDD.

Canonical source: [TDD-Framework.md](../../../TDD-Framework.md)

## Core Rules (Distilled)

1. Never write production code before a failing test (RED first).
2. Write exactly one new test per TDD cycle (one behavior at a time).
3. Prefer edge cases first, then happy-path coverage.
4. In GREEN, write the smallest possible code to pass the failing test only.
5. Do not refactor while any test is failing.
6. Keep tests permanent; do not delete or weaken tests to force passing results.
7. Commit test + production changes together in one commit.

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
- Confirm failure is for the correct behavioral reason.
- No production code edits.

### GREEN
- Make the failing test pass with minimal code.
- Avoid speculative functionality.
- Keep all existing tests green.

Minimal GREEN examples:
- Return a constant required by the test (temporarily) instead of building broader logic.
- Add the narrowest conditional branch needed for the new failing edge case.
- Create only the smallest helper needed to satisfy current assertions.

### COMMIT
- Stage and commit test + production code together.
- Keep scope to one completed behavior.

### REFACTOR
- Improve design/readability only with tests green throughout.
- No behavior changes, no new features.
- If behavior changes are needed, start a new RED cycle.

## Quick Self-Check Before Handoff

- Did I add exactly one test for exactly one behavior?
- Is the test named `WhenCondition_ShouldExpectedOutcome`?
- Did I cover an edge case first when applicable?
- Is GREEN implementation minimal and only for current test?
- Are all tests passing before refactor/commit transitions?
