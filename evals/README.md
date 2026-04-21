# TDD Agent Evaluation Harness

This directory contains the evaluation harness for the TDD agent workflow.
The design follows the benchmark matrix described in
[`docs/issue-plans/issue-10-eval-plan-for-tdd-agent-behavior.md`](../docs/issue-plans/issue-10-eval-plan-for-tdd-agent-behavior.md).

## Layout

```
evals/
  schema/
    run-summary.schema.json   # v1 contract between harness runner and Promptfoo
  scenarios/
    <fixtureId>/
      <scenarioId>.yaml       # one evaluation unit (one scenario, one baseline)
  fixtures/
    run-summaries/            # synthetic run-summaries used to exercise scoring
  promptfoo/
    promptfooconfig.yaml      # legacy v0 scaffold (validates runner eval payload)
    promptfoo-benchmark.yaml  # v1 benchmark matrix scoring config
    benchmark-provider.js     # reads run-summary JSON and returns it as output
    assertions/               # deterministic scoring assertions
```

## Architecture

Two layers, with clear ownership:

1. **Harness runner** (planned, not yet wired) owns execution and artifact
   capture: fixture checkout, agent invocation, transcript collection, git
   history capture, test/coverage execution, and run-summary JSON generation.
2. **Promptfoo** owns scoring and aggregation: the custom provider invokes
   the harness runner (or, for now, reads a pre-produced run-summary JSON
   file), and the assertions inspect the structured output.

## Run-summary JSON contract

Every benchmark run produces a single run-summary JSON document conforming to
[`schema/run-summary.schema.json`](./schema/run-summary.schema.json). The
schema is the **only** contract between the two layers. Prefer
artifact-derived facts (git history, test exit codes, file diffs) over model
self-report.

Key fields used by the v1 deterministic scoring layer:

- `productionChangedBeforeFirstFailingTest` — central RED-before-production
  signal.
- `testsPassedAtEnd` — final-state correctness.
- `testAndCodeCommittedTogether` — commit boundary signal.
- `clarificationAsked` — combined with the scenario manifest's
  `clarificationExpected`.
- `failureModes` — structured list of detected fidelity failures.

## Scenario manifests

Each scenario is one evaluation unit: **one scenario from one known baseline**.
See [`scenarios/fizzbuzz-go/feature-add-divisible-by-seven.yaml`](./scenarios/fizzbuzz-go/feature-add-divisible-by-seven.yaml)
for the full field list and inline schema.

The starter matrix is intentionally small (proof-of-concept scope from the
issue plan):

| Fixture | Feature | Validation | Bug-fix | Refactor-only | Ambiguous | Longitudinal |
|---------|---------|------------|---------|---------------|-----------|--------------|
| `fizzbuzz-go` | yes | — | — | — | — | — |
| `calculator-cli-go` | yes | yes | yes | optional | yes | planned |
| `todo-cli-go` | planned | planned | planned | planned | planned | planned |

## Holdout strategy

Scenarios with `holdout: true` are reserved for benchmark reporting and
should not be used during prompt tuning. The starter scenarios are all
`holdout: false`; holdout scenarios will be added once the runner stabilizes.

## Running the v1 benchmark scoring

The benchmark scoring layer is exercised today against synthetic
run-summary fixtures committed under `fixtures/run-summaries/`:

```text
npx promptfoo@latest eval -c evals/promptfoo/promptfoo-benchmark.yaml
```

This validates the schema, deterministic protocol-fidelity checks, commit
quality checks, and clarification expectation checks against both a clean
exemplar and a TDD-violating exemplar.

## Running the v0 runner scaffold

The earlier scaffold that exercises the `tdd-run-tests` runner's `eval`-mode
payload is still here:

```text
npx promptfoo@latest eval -c evals/promptfoo/promptfooconfig.yaml
```

## Producing real run-summaries: `tdd-eval-run summarize`

The [`cmd/tdd-eval-run`](../cmd/tdd-eval-run/main.go) command produces a
deterministic run-summary JSON document by analyzing the git history of a
workspace against a known baseline ref. It is post-hoc: the agent (or a
human) does the work in a workspace, then this command derives the summary
from artifacts.

```text
go run ./cmd/tdd-eval-run summarize \
  --workspace ./samples/calculator-cli-go \
  --baseline baseline \
  --fixture-id calculator-cli-go \
  --scenario-id feature-add-subtract-command \
  --scenario-family feature \
  --run-mode micro-cycle \
  --tests-passed-at-end \
  > run-summary.json
```

Derived deterministically from `git log baseline..HEAD`:

- `commitCount`, `productionFilesChanged`, `newTestsAdded`
- `productionChangedBeforeFirstFailingTest`
- `testAndCodeCommittedTogether`
- `phaseTransitions` (from RED/GREEN/REFACTOR/COMMIT keywords in commit messages)
- `failureModes`

Reported by the orchestrator (flags):

- `testsPassedAtEnd`, `testRunCount`, `firstFailingTestName`
- `clarificationAsked`, `clarificationExpected`

Unit tests for the summarize logic live in
[`internal/evalrun/summarize_test.go`](../internal/evalrun/summarize_test.go).

## What is intentionally stubbed in v1

- The orchestration layer that drives the agent end-to-end (fixture reset,
  agent invocation, capturing `clarificationAsked` from the transcript,
  running the test command and feeding `--tests-passed-at-end` into
  `tdd-eval-run summarize`). Until it lands, the benchmark Promptfoo config
  reads pre-produced run-summary JSON files via `vars.summaryPath`; those
  files can now be produced manually by `tdd-eval-run summarize`.
- Coverage delta is always `null` until coverage capture is wired in.
- Longitudinal multi-cycle scoring is scaffolded by the schema but no
  scenarios of that family exist yet.
- Multi-baseline materialization (e.g. the `bug-add-overflows-on-int-max`
  baseline referenced by the bug-fix scenario) is a runner responsibility
  and is not yet implemented.

## Recommended implementation order (from issue plan)

1. ✅ Define the run-summary JSON schema.
2. ✅ Add the first real CLI fixture (`calculator-cli-go`).
3. 🟡 Implement fixture reset + scenario runner plumbing. (Post-hoc
   summarizer landed via `tdd-eval-run summarize`; live agent runner
   pending.)
4. ✅ Score deterministic TDD signals with Promptfoo (against synthetic
   run-summaries; live runner pending).
5. ✅ Add one ambiguity scenario and one bug-fix scenario.
6. ⏳ Add one longitudinal multi-cycle run.
