---
name: tdd-cycle-runner
description: |
  Guides the orchestration of a single TDD cycle (Red → Green → Commit → Refactor) for a scenario slice. Defines contract handoffs, escalation, and progressive context disclosure. Specifies how to load and reference phase skills and assets.
metadata:
  title: "TDD Cycle Runner Skill"
  role: "orchestrator-skill"
  user-invocable: "false"
  contracts: "- red_request\n  - red_result\n  - green_request\n  - green_result\n  - test_run_request\n  - test_run_result\n  - commit_request\n  - commit_result\n  - refactor_request\n  - cycle_result\n  - cycle_complete\n  - escalate_cycle_failure"
---

# TDD Cycle Runner Skill

Run phases in the current agent using the installed skills. No phase agents are required.
Load sibling skills by name, or resolve `../<skill-name>/SKILL.md` relative to
this SKILL.md. Resolve each skill's bundled assets relative to that skill.
Read project-specific patterns from the working repository, never the plugin cache.

## Workflow
1. Receive `start_cycle` contract from main orchestrator
2. For each phase:
  - Load phase SKILL.md and asset files
  - Execute phase guidance through the loaded phase skill
  - Route every RED, GREEN, and REFACTOR verification through `tdd-test-run`
    using an explicit expected-result contract before advancing the cycle
  - Validate contract result
  - On failure, escalate to main orchestrator
3. On completion, return `cycle_complete` contract

## Decision Points
- If any phase fails, escalate immediately
- If all phases succeed, return cycle summary

## Quality Criteria
- Only minimal context passed to each phase
- All contract handoffs validated
- No direct communication with main orchestrator by phase skill executions
- Progressive disclosure enforced
- Any rollback after a failed verification is limited to the scoped files named
  in the `test_run_request` contract

## Completion Checks
- All contracts for the cycle are satisfied
- All phase outputs are validated
- Escalation path is tested
