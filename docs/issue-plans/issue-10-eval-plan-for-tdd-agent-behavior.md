# Detailed Issue Plan

This file contains the detailed implementation content for this single GitHub issue, extracted from the master plan.

## Issue #10 — Eval Benchmark Matrix for TDD Agent Behavior ([#20](https://github.com/mrlarson2007/copilot-tdd-harness/issues/20))

### Goal

Evaluate how consistently coding agents follow TDD across different change types, fixture families, and session lengths. The benchmark must measure TDD process fidelity, not just whether the final task was completed.

### Core Design Shift

Do **not** organize the benchmark only as an easy/medium/hard ladder.

That structure is too coarse and mixes together multiple factors:
- repo complexity
- task familiarity
- bug-fix vs feature work
- ambiguity handling
- statefulness
- long-horizon drift

Instead, use a **benchmark matrix**:
- **Fixture families** define the kind of codebase being changed.
- **Scenario families** define the kind of behavioral pressure being applied.
- **Run modes** distinguish between single-cycle discipline and multi-cycle drift.

### Deliverables

Implement a Promptfoo-backed evaluation harness that includes:
- a benchmark matrix, not just a difficulty ladder
- a deterministic run-summary JSON schema derived from artifacts
- a small starter fixture set
- repeatable run protocol from clean baselines
- rubric scoring for TDD fidelity, task correctness, and commit quality
- a holdout set for prompt-tuning resistance

### V1 Benchmark Structure

#### 1) Fixture Families

Start with three fixture families:

1. **Tiny function/library fixture**
   - Example: `samples/fizzbuzz-go`
   - Purpose: smoke-test the TDD loop on a tiny codebase with minimal setup noise.
2. **CLI fixture**
   - Example: a new `calculator-cli-go`
   - Purpose: exercise argument parsing, validation, exit codes, and multiple commands.
3. **Stateful fixture**
   - Example: a new `todo-cli-go`
   - Purpose: exercise persistence, multi-step workflows, invalid states, and longer reasoning chains.

#### 2) Scenario Families

Each fixture family should eventually support these scenario families:

1. **Feature addition**
   - Add one new behavior from a clean baseline.
2. **Validation edge case**
   - Add or fix handling for invalid input, missing data, or malformed usage.
3. **Bug-fix regression**
   - Start from a repo state where a failing regression already exists.
4. **Refactor-only**
   - Require improvement without externally observable behavior changes.
5. **Ambiguous requirement**
   - Require the agent to ask for clarification before coding.
6. **Longitudinal drift**
   - Run several TDD cycles in the same fixture to see whether discipline decays over time.

#### 3) Run Modes

Support two run modes:

1. **Micro-cycle run**
   - One behavior from one clean baseline.
   - Purpose: measure isolated RED → GREEN → COMMIT → REFACTOR discipline.
2. **Longitudinal run**
   - Multiple behavior changes in sequence inside the same fixture.
   - Purpose: measure whether TDD fidelity degrades as context and repo state grow.

### Starter Matrix (V1)

Use a small but diagnostic matrix first.

| Fixture | Feature | Validation | Bug-fix | Refactor-only | Ambiguous | Longitudinal |
|---------|---------|------------|---------|---------------|-----------|--------------|
| `fizzbuzz-go` | yes | optional | no | no | no | no |
| `calculator-cli-go` | yes | yes | yes | optional | yes | yes |
| `todo-cli-go` | yes | yes | yes | yes | yes | yes |

Notes:
- `fizzbuzz-go` is a smoke fixture only. Do not over-index on it.
- `calculator-cli-go` is the first real benchmark target.
- `todo-cli-go` or equivalent stateful fixture is the first long-horizon stress target.

### Evaluation Unit

The unit of evaluation is **one scenario from one known baseline**, not “solve the whole app.”

Each scenario must specify:
- fixture identifier
- baseline snapshot identifier
- scenario identifier
- scenario family
- user prompt
- expected TDD constraints
- whether clarification is expected
- whether this run is micro-cycle or longitudinal

### Run Protocol

Per scenario:

1. Start from a clean fixture snapshot.
2. Invoke the agent loop with one behavior prompt.
3. Capture transcript, file edits, git changes, test output, and optional coverage.
4. Produce a run-summary JSON file from those artifacts.
5. Score the run via Promptfoo assertions over the summary JSON.
6. Reset to the same baseline for comparison runs.

For longitudinal runs:

1. Start from a clean fixture snapshot.
2. Execute a predefined sequence of behavior prompts.
3. Capture per-cycle artifacts plus an end-of-run aggregate summary.
4. Score both per-cycle fidelity and drift over time.

### Architecture Split

Use **two layers**, with clear ownership:

1. **Harness runner owns execution and artifact capture**
   - fixture checkout/copy
   - agent invocation
   - transcript collection
   - git history capture
   - test and coverage execution
   - run-summary JSON generation
2. **Promptfoo owns scoring and aggregation**
   - custom provider invokes the harness runner
   - assertions inspect structured JSON output
   - derived metrics aggregate results across runs

This keeps Promptfoo as the scoring layer, not the entire orchestration layer.

### Required Run-Summary JSON Schema

The run-summary schema is the main contract between the harness and Promptfoo.

V1 must include fields such as:
- `fixtureId`
- `scenarioId`
- `scenarioFamily`
- `runMode`
- `prompt`
- `phaseTransitions`
- `clarificationAsked`
- `newTestsAdded`
- `productionFilesChanged`
- `productionChangedBeforeFirstFailingTest`
- `testsPassedAtEnd`
- `testRunCount`
- `firstFailingTestName`
- `commitCount`
- `testAndCodeCommittedTogether`
- `coverageDelta` (optional in V1 if unavailable)
- `failureModes`
- `notes`

The schema should prefer artifact-derived facts over model self-report.

### Scoring Model

Keep TDD fidelity separate from general task completion.

#### Recommended V1 Weighting

1. **Protocol fidelity** — 50%
   - RED before production code
   - one behavior per cycle
   - all tests green before refactor/commit transition
   - no refactor while tests fail
2. **Task correctness** — 25%
   - requested behavior implemented correctly
   - required validation or bug-fix actually works
3. **Commit quality** — 15%
   - commit boundaries are small and understandable
   - test + production code committed together when commits exist
4. **Code quality / coverage movement** — 10%
   - duplication not worsened materially
   - coverage or direct test support improved for changed behavior

#### Deterministic First, Heuristic Later

V1 should prefer deterministic measures where possible:
- did a failing test appear before production changes?
- did all tests pass at the end?
- was clarification asked when expected?
- were commits behavior-scoped?

Coverage and code quality can begin with lighter-weight heuristics and be improved later.

### Holdout Strategy

Do not tune prompts only against the public benchmark set.

Maintain:
- **development scenarios** used during harness implementation and prompt tuning
- **holdout scenarios** used only for benchmark reporting

Without a holdout set, the eval becomes a tuning target instead of a trustworthy measurement.

### Proof-of-Concept Scope

The first working slice should be intentionally small:

1. `fizzbuzz-go` smoke scenarios
2. one `calculator-cli-go` feature scenario
3. one `calculator-cli-go` validation scenario
4. one deterministic Promptfoo scoring configuration over run-summary JSON

Do **not** attempt to cover all scenario families before the runner and schema are stable.

### Non-Goals for V1

V1 should explicitly avoid:
- hosted Promptfoo dependencies
- production monitoring
- generic RAG or chat quality metrics
- provider-specific eval stacks such as OpenAI Evals as the primary path
- scoring whole-app generation in one prompt

### Acceptance Criteria

- A benchmark matrix exists across fixture families and scenario families.
- The benchmark is organized around one-scenario-from-one-baseline runs.
- A run-summary JSON schema exists and is artifact-derived.
- Promptfoo Community/local mode is the documented scoring framework for v1.
- The proof-of-concept includes both smoke and real benchmark scenarios.
- The plan distinguishes micro-cycle fidelity from longitudinal drift.
- A holdout strategy is defined to reduce benchmark gaming.

### Recommended Implementation Order

1. Define the run-summary JSON schema.
2. Add the first real CLI fixture (`calculator-cli-go`).
3. Implement fixture reset + scenario runner plumbing.
4. Score deterministic TDD signals with Promptfoo.
5. Add one ambiguity scenario and one bug-fix scenario.
6. Add one longitudinal multi-cycle run.