# TDD Harness for GitHub Copilot - Implementation Index

## Overview

This file is the lightweight index for implementation.
Detailed build instructions are split into issue-specific files so implementation agents only load the issue they are executing.

## Archived Full Plan

The full monolithic reference has been preserved at:
- [Full plan archive](docs/TDD-Harness-Plan.full.md)

## How To Use

1. Choose the GitHub issue you are implementing.
2. Read only that issue detail file.
3. Implement directly from that file.
4. Use this index only for cross-cutting context.

---

## Issue-Specific Detail Docs

- [Issue #1 - tdd-setup skill](docs/issue-plans/issue-1-tdd-setup-skill.md)
- [Issue #2 - always-on rules and config](docs/issue-plans/issue-2-always-on-rules-and-config.md)
- [Issue #3 - tdd-workflow skill](docs/issue-plans/issue-3-tdd-workflow-skill.md)
- [Issue #4 - phase agents and handoffs](docs/issue-plans/issue-4-phase-agents-and-handoffs.md)
- [Issue #5 - lifecycle hooks and test reward](docs/issue-plans/issue-5-lifecycle-hooks-and-test-reward.md)
- [Issue #6 - prompt files](docs/issue-plans/issue-6-prompt-files.md)
- [Issue #7 - safe install scripts](docs/issue-plans/issue-7-safe-install-scripts.md)
- [Issue #8 - verification suite](docs/issue-plans/issue-8-verification-suite.md)
- [Issue #9 - agent plugin packaging](docs/issue-plans/issue-9-agent-plugin-packaging.md)

---

## Architecture (Cross-Cutting)

```
Layer 1: Always-On Rules          .github/instructions/tdd-constitution.instructions.md
Layer 2: Project Configuration    .github/tdd-config.json
                                  .github/instructions/tdd-patterns.instructions.md
Layer 3: Phase Agents             .github/agents/tdd-{red,green,commit,refactor}.agent.md
Layer 4: Lifecycle Hooks          .github/hooks/tdd-enforcement.json
                                  scripts/tdd-run-tests.{ps1,sh}
Layer 5: On-Demand Access         .github/skills/tdd-workflow/SKILL.md
                                  .github/skills/tdd-setup/SKILL.md
                                  .github/prompts/tdd-{start,status}.prompt.md
```

## Notes

- Source of truth for implementation detail is the issue-specific docs.
- This index intentionally avoids phase-by-phase build instructions.
