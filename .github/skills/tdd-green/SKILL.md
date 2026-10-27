---
name: tdd-green
title: TDD Green Phase Skill
description: |
  Guides the implementation of the simplest code to pass the current failing test. Enforces minimal change, no test edits, and commit discipline. Loads detailed rules from asset files.
role: phase-skill
user-invocable: false
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
- Project GREEN style guide at `.github/tdd-harness/project-code-style-patterns.md`

Resolve bundled paths relative to this SKILL.md, not the working directory.
Read the project style guide first. For manual-install compatibility, fall back
to the working project's `.github/skills/tdd-green/assets/project-code-style-patterns.md`
if present, then to the bundled `./assets/project-code-style-patterns.md`.
Never write to the bundled fallback.

## Outputs
- Changed production files
- Test pass summary

## Steps
1. Load the style guide using the precedence above, then apply this skill's
   minimal-implementation and commit guidance
2. **Check whether the RED test compiles.**
   - If the test references missing production symbols (types, methods, fields), the only allowed edit is the smallest possible compile-only stub — no behavior.
   - Run the narrow test again. It must now compile and fail at runtime/assertion level before proceeding.
   - This is the distinction between *structural red* (compile failure) and *behavioral red* (assertion failure). Both are RED; behavior must not be added until you are at behavioral red.
3. **Judge the next GREEN move before editing production code.**
  - Ask whether the change is the dumbest possible thing that makes only the current test pass.
  - If the change also solves untested cases, tries to generalize, or looks like the feature instead of the slice, it is too broad.
  - Prefer a constant, hardcoded branch, or the narrowest exact-case behavior the current test demands.
  - Do not move from behavioral red into generalized implementation just because the change is small.
4. Write minimal code to pass the test
5. Use `tdd-test-run` with a `test_run_request` contract whose expected result is
  a passing narrow check for the protected test or slice
6. If the observed result does not match the expected GREEN outcome, revert only
  the scoped production changes and return to the preceding GREEN decision point
7. Run the broader validation required by project policy through `tdd-test-run`
  before reporting GREEN complete
8. Return contract output

## Completion Checks
- Only minimal code added
- All tests pass
- No test or refactor changes
