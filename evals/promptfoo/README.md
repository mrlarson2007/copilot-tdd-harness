# Promptfoo Evals

This folder contains three benchmark modes:

- `promptfooconfig.yaml` for fast scripted micro-cycles
- `promptfooconfig.extended.yaml` for opt-in longer drift checks
- `promptfooconfig.red.yaml` for an independent, real-agent RED-only evaluation

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