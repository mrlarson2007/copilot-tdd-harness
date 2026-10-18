# Promptfoo Evals

This folder contains three benchmark modes:

- `promptfooconfig.yaml` for fast scripted micro-cycles
- `promptfooconfig.extended.yaml` for opt-in longer drift checks
- `promptfooconfig.codex.yaml` for opt-in Codex CLI functionality and clarification checks

## Real Agent Replays

`benchmark-provider.js` supports two inputs:

- `scenarioModulePath`: runs a scripted disposable-repo scenario
- `summaryFilePath`: loads an already-produced run summary JSON from disk

The replay path is the bridge for real agent evaluation. A live `tdd` agent run
can write a summary JSON using the same schema as the scripted scenarios, and
promptfoo can then score that real run without changing the assertions.

Use replay mode when you want to score an actual agent session but do not have a
non-interactive CLI/API to launch that session directly from promptfoo.

## Opt-in Codex CLI Checks

Prerequisites: Node.js and the existing promptfoo tooling, Bash, Git, Go (matching
the fixture's `go.mod`), and `codex` on `PATH`. Authenticate using your existing
local Codex login before running; do not put credentials in the config, prompts,
or repository. These checks use real model calls and may incur charges.

Run from the repository root, passing an **absolute** config path because the
wrapper changes its working directory:

```bash
EVAL_MODEL=your-model bash scripts/run-evals.sh \
  --config "$PWD/evals/promptfoo/promptfooconfig.codex.yaml"
```

PowerShell (Bash is still required by the scenario installer):

```powershell
$env:EVAL_MODEL = "your-model"
.\scripts\run-evals.ps1 -ConfigPath (Resolve-Path .\evals\promptfoo\promptfooconfig.codex.yaml).Path
```

Alternatively, set `vars.model` in the config's `defaultTest` or individual test.
It takes precedence over `EVAL_MODEL`. If neither is supplied, the CLI chooses
its configured default; the recorded model is `null` (not a guessed model).
Existing Copilot configs and runners are unchanged.

The existing benchmark provider creates a disposable calculator-cli-go repository.
The scenario runs the Bash installer with `--agent codex`, commits installed
resources as a setup baseline, and records their paths. Setup changes are not
counted as model commits or dirty-worktree failures. It then launches:

```text
codex exec --json --sandbox workspace-write [--model MODEL] -
```

The task prompt is sent on stdin, not interpolated into a shell command. No
approval/sandbox bypass or global config edits are used. Stdout JSONL events,
stderr, completed agent messages, command executions, usage (when emitted), and
elapsed durations are retained in `scenario.artifacts`, persisted by the provider
under `results/codex-run-artifacts`. Treat artifacts as potentially sensitive
model/command output; review them before sharing.

The feature check runs `go test ./...` and three signed-integer subtract probes
**outside the model**. The clarification check requires a question in a completed
agent message, passing external tests, no commits after setup, and a clean final
worktree. Question detection is a heuristic; final state cannot prove that no
transient edits occurred. Feature functionality does not require a clean
worktree; that state and commit count are reported separately.
An independent `clarification_no_changes` assertion checks the clean-worktree
and zero-post-setup-commit evidence rather than trusting `behavior.passed`.

Infrastructure and behavior have separate metrics. Launch/auth/CLI failures,
JSON errors, missing completion, timeouts (default ten minutes), and output-limit
failures (default 4 MiB combined stdout/stderr) fail closed, even with exit code
zero or a final message claiming success.

**Limits:** this adapter does not verify RED/GREEN test evidence or phase order.
Those fields remain `null`, transitions are empty, and no protocol-fidelity
assertion is used. Agent messages and commit names are not proof of test results.
Codex source includes hook support; integrating hooks into this adapter is
deferred, not an absent runtime capability.
`workspace-write` may prevent writes to `.git`, so strict harness commit
discipline may be unavailable even when feature functionality passes. Keep the
sandbox intact rather than bypassing it to obtain a passing score. The initial
implementation was verified with mocked CLI events and external fixture checks,
not a live Codex/model run (`codex` was unavailable in the implementation environment).