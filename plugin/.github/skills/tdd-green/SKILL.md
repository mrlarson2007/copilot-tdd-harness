---
title: TDD Green Phase Skill
description: |
  Guides the implementation of the simplest code to pass the current failing test. Enforces minimal change, no test edits, and commit discipline. Loads detailed rules from asset files.
role: phase-skill
contracts:
  - green_request
  - green_result
---

# TDD Green Phase Skill

## Purpose
- Write the simplest code to make the failing test pass
- Do not modify tests in this phase
- No refactoring or generalization
- Commit after tests pass

## Inputs
- Failing test id
- Skill and asset references
- Project code style patterns from `.github/instructions/tdd-patterns.instructions.md`
- Canonical GREEN style guide placeholder at `.github/skills/tdd-green/assets/project-code-style-patterns.md`

## Outputs
- Changed production files
- Test pass summary

## Steps
1. Load `.github/skills/tdd-green/assets/project-code-style-patterns.md` first, then load core asset files for minimal implementation, anti-patterns, and commit discipline
2. Write minimal code to pass the test
3. Run all tests and confirm green
4. Return contract output

## Completion Checks
- Only minimal code added
- All tests pass
- No test or refactor changes
