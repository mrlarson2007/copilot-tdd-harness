# Detailed Issue Plan

This file contains the detailed implementation content for this single GitHub issue, extracted from the master plan.

## Phase 5 — Prompt Files ([#6](https://github.com/mrlarson2007/copilot-tdd-harness/issues/6))

### tdd-start.prompt.md

```yaml
---
description: Begin a new TDD cycle for a specific behavior
agent: tdd-red
tools:
  - read_file
  - create_file
  - file_search
---

You are starting a new TDD cycle. The user will describe a behavior.

1. Confirm the behavior description is clear and specific.
2. Identify the correct test file location using project conventions from tdd-patterns.instructions.md.
3. Invoke the tdd-red agent to write the first failing test.

Ask the user: "What behavior do you want to implement?"
```

Invoked as `/tdd-start` from Copilot Chat.

### tdd-status.prompt.md

```yaml
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
```

Invoked as `/tdd-status` from Copilot Chat.

