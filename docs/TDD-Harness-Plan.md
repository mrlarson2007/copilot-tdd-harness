# TDD Harness for GitHub Copilot - Implementation Index

## Overview

This file is the lightweight index for implementation.
Detailed build instructions are split into issue-specific files so implementation agents only load the issue they are executing.

## Archived Full Plan

The full monolithic reference has been preserved at:

- [Full plan archive](docs/TDD-Harness-Plan.full.md)

The archive preserves the original multi-agent and hooks-first design. The shipped harness has since been consolidated into a single opt-in `tdd` agent.

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
- [Issue #7 - safe install scripts (historical)](docs/issue-plans/issue-7-safe-install-scripts.md)
- [Issue #8 - verification suite (historical)](docs/issue-plans/issue-8-verification-suite.md)
- [Issue #9 - true CI pipeline and gated publishing](docs/issue-plans/issue-9-agent-plugin-packaging.md)
- [Issue #10 - tdd-planning and agent/skill separation](docs/issue-plans/issue-10-tdd-planning-and-agent-separation.md)

---

## Architecture (Cross-Cutting)

```text
Repository Governance              .github/settings.yml
Layer 1: Always-On Rules          .github/instructions/tdd-constitution.instructions.md
Layer 2: Project Instructions     .github/instructions/tdd-patterns.instructions.md
Layer 3: Main Agent Source        plugin/.github/agents/tdd.agent.md
                                  installed into target .github/agents/
Layer 4: On-Demand Access         plugin/.github/skills/tdd-planning/SKILL.md
                                  plugin/.github/skills/tdd-workflow/SKILL.md
                                  plugin/.github/skills/tdd-setup/SKILL.md
```

## Notes

- Source of truth for implementation detail is the issue-specific docs.
- This index intentionally avoids phase-by-phase build instructions.
- Issue plan docs for prompts, hooks, and phase handoffs are retained as historical design notes and no longer describe the shipped harness.
- Packaged agent assets live under `plugin/.github/`; target projects receive those files in their own `.github/` folder during installation.
- The shipped single-agent harness relies on generated project instructions instead of a separate JSON config or runtime CLI binary.
