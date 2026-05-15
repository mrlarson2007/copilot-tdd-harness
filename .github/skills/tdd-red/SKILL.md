---
title: TDD Red Phase Skill
description: |
  Guides the creation of a single failing behavior test for a scenario slice. Enforces one-behavior-per-test, readable assertions, and correct failure detection. Loads detailed rules from asset files.
role: phase-skill
user-invocable: false
contracts:
  - red_request
  - red_result
---

# TDD Red Phase Skill

## Purpose
- Add one failing unit test for the current scenario slice
- Assert only one behavior per test
- Prioritize readability and intent
- No production code changes in this phase
- No test refactoring except for clarity

## Inputs
- Scenario slice
- Skill and asset references
- Project testing patterns from `.github/instructions/tdd-patterns.instructions.md`
- Canonical RED style guide placeholder at `.github/skills/tdd-red/assets/project-testing-patterns.md`

## Outputs
- Failing test artifact
- Failure output and rationale

## Steps
1. Load `.github/skills/tdd-red/assets/project-testing-patterns.md` first, then load core asset files for assertion quality, failure verification, and anti-patterns
2. Write a single failing test for the scenario
3. Use `tdd-test-run` with a `test_run_request` contract whose expected result is
  the specific failing test and failure signal for this RED step
4. If the observed result does not match the expected RED outcome, revert only
  the scoped test changes and retry or escalate based on the `test_run_result`
5. Return contract output

## Completion Checks
- Only one new failing test
- Failure is for the intended assertion
- Test is readable and focused
