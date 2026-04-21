# Promptfoo Eval Configs

Two Promptfoo configurations live here:

| Config | Purpose |
|--------|---------|
| `promptfooconfig.yaml` | v0 scaffold. Validates that the `tdd-run-tests` runner emits a stable `eval` payload. |
| `promptfoo-benchmark.yaml` | v1 TDD agent benchmark scoring. Reads run-summary JSON artifacts and scores deterministic protocol-fidelity, commit-quality, and clarification signals. |

Run either from the repository root:

```text
npx promptfoo@latest eval -c evals/promptfoo/promptfooconfig.yaml
npx promptfoo@latest eval -c evals/promptfoo/promptfoo-benchmark.yaml
```

Both configs use Promptfoo Community/local mode only — no hosted features
are required. See [`../README.md`](../README.md) for the overall benchmark
architecture and the run-summary JSON contract.