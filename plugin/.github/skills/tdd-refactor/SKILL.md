---
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
- Canonical REFACTOR style guide placeholder at `.github/skills/tdd-refactor/assets/project-refactor-patterns.md`

## Outputs
- Refactor diff
- Test pass evidence
- Helper/builder notes

## Steps
1. Load `.github/skills/tdd-refactor/assets/project-refactor-patterns.md` first, then load core asset files for refactor patterns, anti-patterns, and test readability
2. Inspect surrounding code around each in-scope change before refactoring
3. Refactor code and tests as needed
4. Run all tests to confirm behavior unchanged
5. Return contract output

## Completion Checks
- All behavior preserved
- Code and tests are more readable/maintainable
- Helpers/builders introduced only when justified
