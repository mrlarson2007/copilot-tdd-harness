# Eval Report Site (Prototypes)

Static pages that present the harness eval results to visitors. There is no
build step: open `site/index.html` in a browser, or serve the `site/` folder
with any static host (for example GitHub Pages).

> **The current data is sample data.** `data/eval-report.js` was generated to
> exercise the layouts. The numbers are not real measurements. Every page shows a
> banner while `isSample` is `true`.

## Prototypes

| Prototype | Path | Idea |
| --- | --- | --- |
| A · Scorecard | `prototype-a-scorecard/` | One leaderboard: overall score per model with the harness and with no skills, plus the lift. Expand a row for per-metric detail. |
| B · Dashboard | `prototype-b-dashboard/` | Filter by scenario and metric. Shows a grouped bar chart, a model × metric heatmap, and a per-scenario table. |
| C · Story | `prototype-c-story/` | A before/after page covering test-first rate, a typical run timeline, failure modes, lift per model, and cost. |

All three use the same data file (`data/eval-report.js`) and the same helpers
(`assets/report.js`, `assets/base.css`).

## Data contract

`data/eval-report.js` sets `window.EVAL_REPORT`. The data is loaded with a
script tag instead of `fetch`, so the pages also work when opened from
`file://`.

| Field | Meaning |
| --- | --- |
| `isSample`, `sampleNotice` | Shows the sample-data banner while `isSample` is true. |
| `conditions` | `harness` (`copilot --agent=tdd` with the `tdd-*` skills) and `baseline` (the default agent with no skills). Both get the same prompt and fixture. |
| `models` | `{ id, label, tier }` for each model evaluated. |
| `metrics` | `{ id, label, description, source }`. Each metric maps to an assertion in `evals/promptfoo/assertions/` or to a run-summary field. |
| `scenarios` | `{ id, label, fixtureId, family }`, matching the promptfoo test cases. |
| `failureModes` | `{ id, label }` for each failure mode shown in the story page. |
| `runs[]` | One entry per (model, condition, scenario) cell: `trials`, `passes` (passed-trial count per metric, listing only the metrics that apply), `failureModes` (count per id), `medianDurationSec`, `medianCommits`. |

Pass rates are pooled as passes ÷ trials. The "overall score" is the
unweighted mean of the per-metric pass rates.

## Producing real data (next steps)

1. Add a model option to `agent-runner.js` and pass it through as `--model`.
2. Add a baseline mode that skips `setupWorkspaceAgentFiles` and runs the
   default agent.
3. Run the promptfoo matrix for each model × condition with N repeats.
4. Fold the promptfoo JSON output (`results/promptfoo-benchmark.json`) into the
   contract above, then set `isSample: false`.
5. Publish `site/` with GitHub Pages, for example from a workflow that runs
   after the evals finish.
