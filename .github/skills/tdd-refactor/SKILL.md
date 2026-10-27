---
name: tdd-refactor
title: TDD Refactor Phase Skill
description: |
  Guides the improvement of code and tests after green. Enforces behavior preservation, readability, and helper/builder introduction. Loads detailed rules from asset files.
role: phase-skill
user-invocable: false
contracts:
  - refactor_request
  - cycle_result
---

# TDD Refactor Phase Skill

## Purpose
- Improve code and test design after green
- Preserve all existing behavior
- Prioritize readability over forced deduplication
- Introduce helpers/builders when they improve future test authoring

## Inputs
- Commit details from commit stage (sha/message)
- Committed baseline
- Readability goals
- Project refactor patterns from `.github/instructions/tdd-patterns.instructions.md`
- Project REFACTOR style guide at `.github/tdd-harness/project-refactor-patterns.md`

Resolve bundled paths relative to this SKILL.md, not the working directory.
Read the project style guide first. For manual-install compatibility, fall back
to the working project's `.github/skills/tdd-refactor/assets/project-refactor-patterns.md`
if present, then to the bundled `./assets/project-refactor-patterns.md`.
Never write to the bundled fallback.

## Outputs
- Refactor diff
- Test pass evidence
- Helper/builder notes

## Steps
1. Load the style guide using the precedence above, then load the bundled
   `./assets/surrounding-code-review.md` for surrounding-code review
2. Inspect surrounding code around each in-scope change before refactoring
3. Refactor code and tests as needed
4. Use `tdd-test-run` with a `test_run_request` contract whose expected result is
  a passing validation for the touched slice, then the broader suite required
  by project policy
5. If the observed result does not match the expected REFACTOR outcome, revert
  only the scoped refactor changes and return to the pre-refactor baseline
6. Return contract output

## Completion Checks
- All behavior preserved
- Code and tests are more readable/maintainable
- Helpers/builders introduced only when justified
