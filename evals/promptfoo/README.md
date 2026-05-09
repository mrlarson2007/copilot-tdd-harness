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