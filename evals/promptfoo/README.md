# Promptfoo Evals

This folder contains two benchmark modes:

- `promptfooconfig.yaml` for fast scripted micro-cycles
- `promptfooconfig.extended.yaml` for opt-in longer drift checks

## Real Agent Replays

`benchmark-provider.js` supports two inputs:

- `scenarioModulePath`: runs a scripted disposable-repo scenario
- `summaryFilePath`: loads an already-produced run summary JSON from disk

The replay path is the bridge for real agent evaluation. A live `tdd` agent run
can write a summary JSON using the same schema as the scripted scenarios, and
promptfoo can then score that real run without changing the assertions.

Use replay mode when you want to score an actual agent session but do not have a
non-interactive CLI/API to launch that session directly from promptfoo.

## Model And Condition Matrix

`evals/fixtures/scenarios/agent-runner.js` reads two environment variables:

- `EVAL_MODEL`: passed to `copilot --model`. If unset, the Copilot CLI default
  model is used.
- `EVAL_CONDITION`: `harness` (the default) installs the agent and skills and
  runs `copilot --agent=<name>`. `baseline` installs nothing and runs the
  default agent with the same prompt.

`benchmark-provider.js` records both values in each result's metadata as
`evalModel` and `evalCondition`. `scripts/run-evals.sh` and `run-evals.ps1` set
the variables for you (`--model`, `--condition`, `--repeat`). They write one
result file per run to `results/runs/`, and `scripts/build-eval-report.js`
reads those files.
