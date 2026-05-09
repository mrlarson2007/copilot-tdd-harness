# Detailed Issue Plan

This file captures the next architectural cleanup for the shipped single-agent
TDD harness.

## Phase 4 — `tdd-planning` and Agent/Skill Separation

### Goal

Refactor the current single `tdd` agent so it is easier to share outside this
repository and less coupled to the benchmark scenarios used in the local eval
suite.

The target shape is:

- `tdd.agent.md` is a thin orchestrator.
- `tdd-planning` is a reusable planning skill that helps select the next
  behavior the way a strong TDD engineer would.
- `tdd-workflow` remains the canonical execution skill for RED -> GREEN ->
  COMMIT -> REFACTOR discipline.

### Motivation

The current `tdd` agent mixes three concerns:

1. Session orchestration and user interaction
2. TDD execution policy
3. Planning guidance for how to decompose a feature into edge-case-first
   behaviors

That makes the agent harder to share and tempts benchmark-specific language to
leak into the generic orchestration layer.

### Desired Responsibilities

#### `tdd.agent.md`

Keep only orchestration concerns:

- determine the task
- detect missing project inputs
- decide whether clarification is required before RED
- determine one-cycle vs until-complete scope
- invoke `tdd-planning` before the first cycle when the task is not already
  concrete
- invoke `tdd-workflow` as the source of truth for execution

Do not keep detailed phase policy here unless it is required for routing.

#### `tdd-planning`

New reusable planning skill responsible for:

- converting feature requests into candidate behaviors
- preferring edge cases before happy path behavior when appropriate
- selecting the smallest falsifiable next slice
- stating why that slice is the right first RED target
- identifying when a request is still too ambiguous to start
- producing a concise handoff to `tdd-workflow`

This skill should explain how a strong software engineer using TDD would think
about the problem before writing the next failing test.

#### `tdd-workflow`

Remain the canonical execution policy for:

- one test per cycle
- RED/GREEN/COMMIT/REFACTOR discipline
- minimal GREEN implementations
- tests and production changes committed together
- phase transition self-checks

### Non-Goals

- Do not reintroduce the historical multi-agent phase handoff chain in this
  change.
- Do not make `tdd-planning` a separate agent yet.
- Do not move benchmark-specific wording into the shared generic agent.

### Implementation Steps

1. Add a new skill at `.github/skills/tdd-planning/SKILL.md`.
2. Move planning-specific guidance out of `tdd.agent.md` into that skill.
3. Trim `tdd.agent.md` so it delegates planning and execution instead of
   restating both in full.
4. Keep project-specific instruction precedence in the agent, because that is a
   routing/orchestration concern.
5. Leave `tdd-workflow` as the canonical execution source, but expand it only
   where the execution contract is currently underspecified.
6. Keep eval-specific determinism in benchmark prompts or configs rather than
   embedding benchmark language into the generic agent.

### Acceptance Criteria

The refactor is complete when all of the following are true:

- A reader can understand `tdd.agent.md` as an orchestrator rather than as the
  full TDD doctrine.
- A reader can understand `tdd-planning` as the place where behavior selection
  and edge-case-first planning live.
- A reader can understand `tdd-workflow` as the place where phase execution
  rules live.
- The harness remains usable in repositories outside this benchmark setup.
- Existing promptfoo evals still pass after the split.

### Suggested Follow-Up Work

After the skill split is stable, consider a later follow-up issue for a
separate `tdd-planning` agent. That follow-up should only happen after the
skill boundaries are proven and the shared language is sufficiently generic.