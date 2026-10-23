# Promptfoo Evals

This folder contains these benchmark modes:

- `promptfooconfig.yaml` for fast scripted micro-cycles
- `promptfooconfig.extended.yaml` for opt-in longer drift checks
- `promptfooconfig.red.yaml` for an independent, real-agent RED-only evaluation
- `promptfooconfig.jev.yaml` for experimental Jev scoring at each TDD phase boundary

## Real Agent Replays

`benchmark-provider.js` supports two inputs:

- `scenarioModulePath`: runs a scripted disposable-repo scenario
- `summaryFilePath`: loads an already-produced run summary JSON from disk

The replay path is the bridge for real agent evaluation. A live `tdd` agent run
can write a summary JSON using the same schema as the scripted scenarios, and
promptfoo can then score that real run without changing the assertions.

Use replay mode when you want to score an actual agent session but do not have a
non-interactive CLI/API to launch that session directly from promptfoo.

## RED in Isolation

Prerequisites: Node.js, Git, Go (the fixture's `go.mod`), installed Promptfoo
tooling, and an authenticated `copilot` CLI on `PATH`. No model API key is used
by the evaluator; Copilot CLI authentication supplies the live agent.

From any directory in this checkout, run the RED eval separately:

```bash
PROMPTFOO_CACHE_ENABLED=false bash /home/runner/work/copilot-tdd-harness/copilot-tdd-harness/scripts/run-evals.sh \
  --config /home/runner/work/copilot-tdd-harness/copilot-tdd-harness/evals/promptfoo/promptfooconfig.red.yaml
```

Adjust the absolute checkout prefix for your installation. Alternatively, invoke
Promptfoo directly (explicitly disabling cached agent results):

```bash
npx --prefix /home/runner/work/copilot-tdd-harness/copilot-tdd-harness/.promptfoo-tooling promptfoo eval --no-cache \
  -c /home/runner/work/copilot-tdd-harness/copilot-tdd-harness/evals/promptfoo/promptfooconfig.red.yaml
```

The existing default, `--extended`, and `--both` modes are unchanged. PowerShell
users can use the existing `-ConfigPath` option with this config and set
`$env:PROMPTFOO_CACHE_ENABLED = "false"`.

### What is measured

The provider reuses the disposable Go calculator. The RED scenario copies only
the authoritative `tdd-red` and `tdd-test-run` skills, their complete asset
directories, and phase contracts. It uses a minimal CLI prompt to load those
files, not a copy of their instructions, and does not install cycle/green/commit
agents. The request is one failing test for `subtract 9 4` producing `5`, then
stop. Tool permissions remain unrestricted, so production edits and accidental
commits are possible and must be detected.

Before invoking Copilot, the evaluator records file bytes/modes, test inventory,
Git state, and passing baseline results. Independently after Copilot stops, it:

- Inventories Go tests and requires exactly one additional test.
- Preserves existing test files byte-for-byte (append-only additions are allowed).
  A separate root-level `*_test.go` is also allowed. Production and all other
  workspace files/configuration must remain identical.
- Executes the selected test and full suite with uncached Go JSON results.
  Requires a source-located test assertion containing `unknown command: subtract`,
  exactly the requested failure, and passing pre-existing tests. Build errors,
  missing tools/dependencies, skips, panics, timeouts, and unrelated failures
  cannot pass.
- Compares HEAD, refs, raw reflogs, local Git configuration, and all commit-object
  IDs. A commit followed by a reset is not hidden by final HEAD equality; even
  reflog expiry leaves commit-object evidence.
- Captures RED artifacts **before** applying the evaluator's known subtract
  implementation. With the agent-authored test unchanged, both selected test and
  suite must then pass. An unconditional failure is rejected. The evaluator
  also substitutes addition for subtraction and requires the test to reject that
  incorrect implementation, ruling out a source-only command-presence check.
  It checks Git/files again after executing agent-authored Go code, including
  test initialization and known/wrong implementation checks. The evaluator
  restores production afterward; it never commits.

### Evidence and deterministic checks

Before disposable-workspace cleanup, the existing provider saves
`summary.json`, `scenario-artifacts.json`, and Git status/log/diff under
`evals/promptfoo/results/red-artifacts/calculator-cli-go/red-only-subtract/<run-id>/`.
`scenario-artifacts.json` contains the baseline, agent exit/output, RED test
results, working-tree and staged diffs, full file snapshots (base64 content plus
modes, including untracked tests), reflogs and commit objects, and
known/wrong-implementation source/results. Use these RED-specific snapshots/diffs:
the provider's generic `git-diff.txt` only compares commits. Promptfoo's scoring
report is `evals/promptfoo/results/promptfoo-red.json`.

Run the deterministic evaluator and packaging checks without Copilot:

```bash
RED_EVAL_TEST_ARTIFACT_DIR=/home/runner/work/copilot-tdd-harness/copilot-tdd-harness/evals/promptfoo/results/red-unit-artifacts \
node --test /home/runner/work/copilot-tdd-harness/copilot-tdd-harness/evals/fixtures/scenarios/calculator-cli-go/red-evaluator.test.js \
  /home/runner/work/copilot-tdd-harness/copilot-tdd-harness/evals/fixtures/scenarios/calculator-cli-go/red-only.test.js \
  /home/runner/work/copilot-tdd-harness/copilot-tdd-harness/evals/fixtures/scenarios/summary-deriver.test.js
```

Scripted test mutations exist only in evaluator unit tests; the live positive
scenario always invokes Copilot to author its test. No agent narrative or
`red_result` is accepted as proof. The optional `RED_EVAL_TEST_ARTIFACT_DIR`
preserves each deterministic case's evidence before its temporary workspace is
removed; these files are explicitly labeled `synthetic-evaluator-unit-test`,
not real-agent results.

This verifies **RED in isolation**, not RED/GREEN/COMMIT ordering throughout a
complete TDD cycle. Git evidence detects ordinary mistakes and reset concealment,
not a hostile agent that deliberately erases both reflogs and unreachable
objects. The baseline fixture's assertions must remain byte-identical; harmless
import reformatting is deliberately rejected. The existing RED skill references
core assertion/anti-pattern guidance without naming additional core asset files;
the eval loads the actual available skills and assets without inventing them.
Unavailable/unauthenticated Copilot is a failed live run, never a passing result.

## Jev Phase-Scoring Experiment

This opt-in experiment runs the real RED, GREEN, COMMIT, and REFACTOR skills in
separate Copilot CLI invocations over one disposable calculator workspace. It
captures each boundary **before** starting the next phase; it does not infer
phase artifacts from final commit history. The agent writes the positive-case
test, not a script. The existing standard, extended, and deterministic RED-only
evals are unchanged.

The installed TypeSafe skill is in `.agents/skills/typesafe-ai/SKILL.md`. The
pinned `@typesafe-ai/sdk` dependency is in `.promptfoo-tooling`; Jev itself is a
hosted model, not a local model installation. The integration uses the SDK's
typed `systemOne` interface with `score` and `noul` questions, batching independent
questions for each phase into one request.

### Run

Requires Node.js **22 or later**, Git, Go, authenticated Copilot CLI, and a
TypeSafe API key supplied securely as `TYPESAFE_API_KEY` in the environment.
Install the evaluation dependencies using the existing tooling:

```bash
npm --prefix /home/runner/work/copilot-tdd-harness/copilot-tdd-harness/.promptfoo-tooling ci
```

**Data boundary:** Jev receives the public disposable fixture's before/after
tests and production source, configuration, file hashes/modes, diffs, test
output, commit messages/diffs/refs, phase contract JSON, and preceding phase
results. Do not use this experiment for sensitive/private source or fixtures
containing secrets. Raw agent transcripts remain local, not in Jev state. The
Jev key is removed from the agent environment; evaluator Go/Git commands use an
allowlisted environment without service credentials. This is not a sandbox
against hostile generated code.

Explicitly opt into uploading **only non-sensitive public fixture evidence**:

```bash
TDD_JEV_ALLOW_PUBLIC_FIXTURE_UPLOAD=1 PROMPTFOO_CACHE_ENABLED=false \
bash /home/runner/work/copilot-tdd-harness/copilot-tdd-harness/scripts/run-evals.sh \
  --config /home/runner/work/copilot-tdd-harness/copilot-tdd-harness/evals/promptfoo/promptfooconfig.jev.yaml
```

Do not place an API key in the config, command line, or committed files. The
default model is `jev-latest`; `TYPESAFE_DEFAULT_MODEL` can select another model
available to your account. Requests use the official TypeSafe endpoint, a
30-second per-request timeout, no automatic retries, and no SDK body logging.
No live request is made when the key or upload opt-in is missing.

### What Jev judges

| Phase | Context | Judgments |
| --- | --- | --- |
| RED | Before/after tests and production, actual failing suite output, phase JSON, Git evidence | One meaningful focused test; intended assertion failure rather than build/timeout failure; unchanged production/existing assertions; no commit |
| GREEN | RED context, production/test diff, actual suite output, phase JSON, any immediate GREEN commit | Smallest behavior needed by the test; no weakened tests; verified passing suite; coherent commit scope |
| COMMIT | GREEN state, cumulative test+production diff, actual commits/messages, suite output, phase JSON | Atomic test+production commit; descriptive message; no scope creep or leftover changes |
| REFACTOR | Committed GREEN state, refactor diff, tests/output, phase JSON and commit evidence | Justified local improvement or justified no-op; preserved behavior/assertions; committed changes if refactored |

Scores use a three-level rubric (0–2); `noul` answers are probabilities of yes
(0–1), not pass/fail flags. Raw responses preserve model, answers, probabilities,
confidence where the primitive supplies it, and token usage. No weighted average
or arbitrary pass threshold is applied. These judgments are experimental and
need calibration against labeled examples; typed answers do not guarantee
truth. The deterministic RED-only evaluator remains available separately.

The runner only gates execution prerequisites: a valid successful phase
contract, behavioral test failure in RED, passing tests afterward, and committed
clean state before/after REFACTOR. It records the unsuccessful phase before
stopping. These safety gates are not substitutes for Jev's semantic scoring.
GREEN may commit immediately as required by the real skill; COMMIT then reports
that commit instead of creating a duplicate. REFACTOR may explicitly do nothing.
Evaluator-installed skill files are committed as scaffold **before** the
measurement baseline and excluded from measured cycle commits.

### Promptfoo only records

There are deliberately **no Promptfoo assertions or grading thresholds** in this
config. A single cycle's provider output contains `phases.red`,
`phases.green`, `phases.commit`, and `phases.refactor`, each with the raw Jev
response, request/rubric, timing, and status. Inspect `output.status` and each
phase's status; a green Promptfoo row without assertions does **not** mean TDD
compliance. `complete` means all four phases were executed and scored, not that
their judgments were favorable. `unavailable`, `agent-failed`, `phase-failed`,
`judge-unavailable`, `invalid-response`, and `not-run` never become fabricated
scores. The recorder stops on an agent or judging service failure.

Before cleanup, the existing provider writes the output plus baseline,
per-phase agent transcript, before/after snapshots, actual test commands and
results, phase JSON, Git evidence, and Jev requests/responses under:

`evals/promptfoo/results/jev-artifacts/calculator-cli-go/jev-phase-subtract/<run-id>/`

The Promptfoo report is `evals/promptfoo/results/promptfoo-jev.json`. These
generated results are ignored by Git.

This config also opts into retaining the workspace if artifact writing fails.
The output then has `status: artifact-persistence-failed`, the prior execution
status in `executionStatus`, and recovery locations/error details in Promptfoo
metadata. A recovery JSON is attempted in the retained temporary directory.
Even if that fails (for example, a full disk), Promptfoo still receives the
in-memory phase records and the workspace is not deleted. Remove the retained
directory manually after recovering the evidence.

### Deterministic checks and live limitations

```bash
node --test /home/runner/work/copilot-tdd-harness/copilot-tdd-harness/evals/promptfoo/jev-scorer.test.js \
  /home/runner/work/copilot-tdd-harness/copilot-tdd-harness/evals/fixtures/scenarios/calculator-cli-go/jev-phase-experiment.test.js \
  /home/runner/work/copilot-tdd-harness/copilot-tdd-harness/evals/promptfoo/benchmark-provider.test.js
```

Unit tests use explicitly synthetic agents/Jev responses, real Go and Git, and
the installed TypeSafe SDK with a mocked HTTP transport. They test wiring and
error handling, not Jev's judging accuracy. Live execution needs both Copilot
and TypeSafe access; missing credentials must be reported as unavailable, not
claimed as a passed evaluation.

During implementation, the live TypeSafe docs hostname could not resolve.
The public upstream skill, package README, and installed SDK declarations were
used instead; the SDK request shapes are checked by the transport test.