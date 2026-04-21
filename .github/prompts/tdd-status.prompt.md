---
description: Report the current TDD phase and test state
tools:
  - run_in_terminal
  - read_file
---

Report the current TDD state:

1. Run `scripts/tdd-run-tests status` and parse output.
2. Identify the current phase (RED/GREEN/REFACTOR/COMMIT) from the most recent commit messages and test state.
3. Report:
   - Current phase
   - Number of passing tests
   - Number of failing tests (with names)
   - Last committed behavior
   - Recommended next action
