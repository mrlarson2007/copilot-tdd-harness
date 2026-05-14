# TDD Hybrid Architecture Migration Plan

## Goal
Implement the hybrid TDD orchestrator/cycle-runner/phase-agent architecture with skill/asset packaging, while keeping evals operational throughout.

## Steps

### 1. Planning & Scaffolding
- [x] Update architecture doc with hybrid model, skill/asset packaging, and contract schema
- [ ] Create this migration plan doc
- [ ] Scaffold new cycle runner agent and skill using best-practice templates
- [ ] Scaffold phase skill/asset structure for Red, Green, Commit, Refactor
- [ ] Draft contract/message schema for phase handoffs

### 2. Orchestrator Refactor
- [ ] Refactor main orchestrator agent to delegate to cycle runner
- [ ] Remove direct phase calls from orchestrator

### 3. Cycle Runner Implementation
- [ ] Implement cycle runner agent logic: phase routing, contract handoff, escalation
- [ ] Integrate skill/asset loading for each phase

### 4. Phase Skill/Asset Implementation
- [ ] Move existing phase logic into new SKILL.md and asset files for each phase
- [ ] Ensure each phase agent loads its skill and assets at runtime

### 5. Evals Compatibility
- [ ] Update evals to invoke orchestrator/cycle runner, not direct phase agents
- [ ] Adapt eval assertions to new contract outputs
- [ ] Continuously run evals to ensure no regression

### 6. Finalization
- [ ] Remove legacy direct phase agent code
- [ ] Document new workflow for contributors

## Principles
- Progressive disclosure: only pass minimal context between phases
- Skill/asset separation: high-level in SKILL.md, details in assets/
- Contract-driven: all handoffs use explicit JSON contracts
- Evals-first: keep evaluation green at every step

---

_Next: Scaffold cycle runner agent and skill using create-agent and create-skill best practices._
