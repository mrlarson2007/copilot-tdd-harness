---
title: TDD Cycle Runner Skill
description: |
  Guides the orchestration of a single TDD cycle (Red → Green → Commit → Refactor) for a scenario slice. Defines contract handoffs, escalation, and progressive context disclosure. Specifies how to load and reference phase skills and assets.
role: orchestrator-skill
user-invocable: false
related_agents:
  - tdd-cycle-runner.agent.md
contracts:
  - red_request
  - red_result
  - green_request
  - green_result
  - commit_request
  - commit_result
  - refactor_request
  - cycle_result
  - cycle_complete
  - escalate_cycle_failure
---

# TDD Cycle Runner Skill

## Workflow
1. Receive `start_cycle` contract from main orchestrator
2. For each phase:
  - Load phase SKILL.md and asset files
  - Execute phase guidance through the loaded phase skill
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

## Completion Checks
- All contracts for the cycle are satisfied
- All phase outputs are validated
- Escalation path is tested
