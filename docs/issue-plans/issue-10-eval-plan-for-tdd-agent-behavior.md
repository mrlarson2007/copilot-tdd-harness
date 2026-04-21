# Detailed Issue Plan

This file contains the detailed implementation content for this single GitHub issue, extracted from the master plan.

## Issue #10 — Eval Plan for TDD Agent Behavior

Goal: evaluate how consistently agents follow TDD across different problem types, then score outputs on TDD process fidelity, commit quality, test coverage, and code structure.

### 1) Evaluation Dimensions (Scored Per Run)

Use a 0-2 rubric per dimension (0 = fails expectation, 1 = partial, 2 = meets expectation).

1. **TDD adherence**
   - RED first (new failing test before production code)
   - GREEN minimal implementation
   - REFACTOR only after green
   - One behavior per cycle
2. **Commit quality**
   - Test + production code committed together for each behavior
   - Commit message describes behavior outcome (not implementation detail)
   - Commit boundaries are small and understandable
3. **Coverage quality**
   - Coverage increases meaningfully for the changed behavior
   - New tests cover edge cases and happy path
   - No test deletion to force green
4. **Code structure quality**
   - Minimal duplication
   - Clear naming and cohesion
   - Refactors preserve behavior (all tests remain green)

### 2) Problem Set Design

Run the same protocol across multiple task categories:

- **Tiny algorithm tasks** (single-function behavior changes)
- **Parser/validation tasks** (input edge cases and error paths)
- **Stateful workflow tasks** (multi-step domain behavior)
- **Bug-fix tasks** (reproduce with failing test, then fix)
- **Refactor-trigger tasks** (initial duplication likely, then cleanup)

For each category, define at least:
- one edge-case-first prompt
- one happy-path-first prompt
- one ambiguous prompt requiring clarification

### 3) Run Protocol

Per scenario:

1. Start from clean branch + same baseline snapshot.
2. Give the task prompt and require TDD workflow usage.
3. Capture transcript artifacts:
   - prompt/response log
   - sequence of file edits
   - commit history
   - test run outcomes
   - coverage report
4. Score the run with the rubric above.
5. Record notable failures (for example: skipped RED, oversized commit, weak edge coverage).

### 4) Scoring Sheet (Per Scenario)

Track:

- Scenario ID and category
- Agent/model identifier
- TDD adherence (0-2)
- Commit quality (0-2)
- Coverage quality (0-2)
- Code structure quality (0-2)
- Total score (0-8)
- Failure notes
- Representative commit SHA(s)

### 5) Aggregate Analysis

Compare by:

- average total score by category
- pass rate for strict TDD adherence (dimension score = 2)
- frequency of failure modes
- relationship between coverage quality and code structure quality

Use findings to tune:
- agent prompts and handoff conditions
- hook enforcement messaging
- verification checklist depth
