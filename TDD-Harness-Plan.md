# TDD Harness for GitHub Copilot - Implementation Index

## Overview

This is the lightweight index for implementing the Copilot TDD harness.
Detailed implementation content has been split into issue-specific documents so agents can load only the issue they are working on.

## How To Use This Plan

1. Pick a GitHub issue.
2. Open only that issue document from the list below.
3. Implement from that document.
4. Use this file only for high-level architecture and cross-cutting context.

---

## Issue Documents (Primary Implementation Sources)

- [Issue #1 - tdd-setup skill](docs/issue-plans/issue-1-tdd-setup-skill.md)
- [Issue #2 - always-on rules and config](docs/issue-plans/issue-2-always-on-rules-and-config.md)
- [Issue #3 - tdd-workflow skill](docs/issue-plans/issue-3-tdd-workflow-skill.md)
- [Issue #4 - phase agents and handoffs](docs/issue-plans/issue-4-phase-agents-and-handoffs.md)
- [Issue #5 - lifecycle hooks and test reward](docs/issue-plans/issue-5-lifecycle-hooks-and-test-reward.md)
- [Issue #6 - prompt files](docs/issue-plans/issue-6-prompt-files.md)
- [Issue #7 - safe install scripts](docs/issue-plans/issue-7-safe-install-scripts.md)
- [Issue #8 - verification suite](docs/issue-plans/issue-8-verification-suite.md)
- [Issue #9 - agent plugin packaging](docs/issue-plans/issue-9-agent-plugin-packaging.md)
- [Issue #10 - eval benchmark matrix for TDD agent behavior](docs/issue-plans/issue-10-eval-plan-for-tdd-agent-behavior.md)

---

## Research Foundations

Nine LLM research papers (2022-2025) inform the design decisions:

| Paper | Year | Key Finding | Applied As |
|-------|------|------------|-----------|
| ReAct (Yao et al) | 2022 | Interleaved reasoning+acting reduces hallucination | Mandatory phase declaration block before every file action |
| Constitutional AI (Bai et al) | 2022 | Hierarchical rules + self-critique without human labels | Per-phase self-critique checklist at end of each agent body |
| Reflexion (Shinn et al) | 2023 | Verbal reinforcement (91% pass@1 on HumanEval) | Structured narrative feedback from PostToolUse hook |
| Lost in the Middle (Liu et al) | 2023 | Middle of context is ignored; start+end attended | TDD constraints repeated at top AND bottom of each agent |
| SWE-agent / ACI (Yang et al) | 2024 | ACI design is #1 performance factor (12.5x improvement) | Structured JSON output from hook scripts, not raw stdout |
| ReST-MCTS* / PRM (Zhang et al) | 2024 | Step-level rewards outperform outcome-only rewards | Two-level reward: PostToolUse (step) + Stop hook (terminal) |
| TheAgentCompany (Xu et al) | 2024 | Long-horizon tasks fail most (30% completion) | Each phase agent scoped to ONE behavior per session |
| SWE-RL (Wei et al) | 2025 | Binary pass/fail is sufficient rule-based reward | Deterministic test-pass hook is the correct reward signal |
| START hint injection (Li et al) | 2025 | Brief hints during inference stimulate tool use | UserPromptSubmit hook injects one-line phase reminder |

---

## Architecture - 5 Layers

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

---

## Complete File Structure (Target)

```
.github/
  instructions/
    tdd-constitution.instructions.md
    tdd-patterns.instructions.md
  tdd-config.json
  agents/
    tdd-red.agent.md
    tdd-green.agent.md
    tdd-commit.agent.md
    tdd-refactor.agent.md
  hooks/
    tdd-enforcement.json
  skills/
    tdd-workflow/
      SKILL.md
    tdd-setup/
      SKILL.md
      templates/
        dotnet.tdd-patterns.md
        node.tdd-patterns.md
        python.tdd-patterns.md
        java.tdd-patterns.md
  prompts/
    tdd-start.prompt.md
    tdd-status.prompt.md
scripts/
  tdd-run-tests.ps1
  tdd-run-tests.sh
  tdd-scan.ps1
  tdd-scan.sh
  install-tdd-harness.ps1
  install-tdd-harness.sh
plugin.json
copilot-tdd-harness.nuspec
TDD-Framework.md
```

---

## Cross-Cutting References

For enforcement behavior, implementation constraints, and acceptance criteria, use issue documents as source of truth:

- Hooks and reward model: [Issue #5](docs/issue-plans/issue-5-lifecycle-hooks-and-test-reward.md)
- Agent handoffs and phase contracts: [Issue #4](docs/issue-plans/issue-4-phase-agents-and-handoffs.md)
- Verification checklist: [Issue #8](docs/issue-plans/issue-8-verification-suite.md)
- Packaging and distribution: [Issue #9](docs/issue-plans/issue-9-agent-plugin-packaging.md)

---

## Notes

- This file intentionally avoids full phase implementation details.
- If an agent is implementing an issue, it should read only the corresponding issue document above.
