---
name: tdd-test-run
description: |
  Runs the expected verification command for a TDD step, compares the observed
  result with the declared expectation, and reverts only the scoped changes when
  verification disproves the step.
metadata:
  title: "TDD Test Run Phase Skill"
  role: "phase-skill"
  user-invocable: "false"
  contracts: "- test_run_request\n  - test_run_result"
---

# TDD Test Run Phase Skill

## Purpose
- Run the exact verification step required by RED, GREEN, or REFACTOR
- Compare actual test output with the declared expected result
- Prevent optimistic phase transitions that are not backed by execution
- Revert only the in-scope changes for the current step when verification fails

## Inputs
- Phase name (`red`, `green`, or `refactor`)
- Narrow or broad test command hint
- Expected outcome contract (`fail` or `pass`, relevant test names, expected signal)
- Files in scope for rollback
- Project test command guidance from `.github/instructions/tdd-patterns.instructions.md`
- Project verification guide at `.github/tdd-harness/project-test-run-patterns.md`

Resolve bundled paths relative to this SKILL.md, not the working directory.
Read the project verification guide first. For manual-install compatibility,
fall back to the working project's
`.github/skills/tdd-test-run/assets/project-test-run-patterns.md` if present,
then to the bundled `./assets/project-test-run-patterns.md`.
Never write to the bundled fallback.

## Outputs
- Verification command output
- Match or mismatch result
- Scoped rollback summary when a mismatch occurs

## Steps
1. Load the verification guide using the precedence above.
2. Run the narrowest practical verification command that satisfies the contract.
3. Compare the observed output with the declared expected result.
4. If the expected result matches, return `test_run_result` with `status: ok`.
5. If the expected result does not match:
   - Revert only the files listed in the contract scope.
   - Do not revert unrelated user changes.
   - If scoped rollback cannot be done safely, return `status: escalate`.
6. Return `test_run_result` with the command output, match status, and any reverted files.

## Completion Checks
- The verification command actually ran.
- The expected result was checked explicitly, not assumed.
- Any rollback was limited to the scoped files for the current step.
- A mismatch never advances the workflow to the next phase.