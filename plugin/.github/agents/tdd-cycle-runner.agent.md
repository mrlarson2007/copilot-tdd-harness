---
title: TDD Cycle Runner Agent
description: |
  Orchestrates a single TDD cycle (Red → Green → Commit → Refactor) for a scenario slice. Handles all phase transitions, contract handoffs, and escalation. Loads phase skills and assets as needed. Reports only cycle-complete or escalate to the main orchestrator.
role: orchestrator
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

# TDD Cycle Runner Agent

## Purpose
- Owns the execution of a single TDD cycle for a scenario slice
- Routes through Red, Green, Commit, Refactor phases
- Loads phase skill and asset files for each step
- Handles all contract handoffs and escalation
- Reports only cycle-complete or escalate to the main orchestrator

## Inputs
- Scenario slice
- Skill and asset references for each phase
- Global guardrails and gates

## Outputs
- Cycle summary (on success)
- Escalation contract (on failure)

## Steps
1. Receive start_cycle contract from main orchestrator
2. For each phase (Red, Green, Commit, Refactor):
   - Load SKILL.md and asset files
  - Execute phase guidance through the loaded phase skill
   - Validate contract result
   - On failure, escalate to main orchestrator
3. On completion, return cycle_complete contract

## Quality Criteria
- Only minimal context passed to each phase
- All contract handoffs validated
- No direct communication with main orchestrator by phase skill executions
- Progressive disclosure enforced
