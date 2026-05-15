# Project Test Run Patterns Placeholder

Status: placeholder

Use this file as the canonical verification and rollback guide for the TDD test-run phase.

## Verification Scope

- Prefer the narrowest test command that can prove the expected result.
- Widen to the full suite only when required by the current phase or project policy.

## Expected Result Checks

- RED should prove the intended failure, not just any failure.
- GREEN should prove the protected slice is passing.
- REFACTOR should prove the protected slice and broader regression checks still pass.

## Rollback Rules

- Revert only the files explicitly named in the test-run contract.
- Never roll back unrelated user changes to achieve a clean state.
- If scoped rollback is ambiguous or unsafe, escalate instead of guessing.
