#!/usr/bin/env node
'use strict';

// Builds site/data/eval-report.js from promptfoo result files written by
// scripts/run-evals.{sh,ps1} into evals/promptfoo/results/runs/.
//
// Usage:
//   node scripts/build-eval-report.js [--input <dir>] [--output <file>] [--harness-version <v>]

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_INPUT = path.join(REPO_ROOT, 'evals', 'promptfoo', 'results', 'runs');
const DEFAULT_OUTPUT = path.join(REPO_ROOT, 'site', 'data', 'eval-report.js');

// Scenarios that exist to test the eval infrastructure itself, not the agent.
const EXCLUDED_SCENARIOS = new Set(['commit-discipline-failure']);

const CONDITIONS = [
  { id: 'harness', label: 'With TDD harness', description: 'copilot --agent=tdd with the tdd-* agent and skills installed in the workspace.' },
  { id: 'baseline', label: 'No skills', description: 'Default Copilot agent with the same prompt and fixture, and no harness agent or skills installed.' },
];

const METRICS = [
  { id: 'test_first', label: 'Test first', description: 'No production code changed before the first failing test.', source: 'summary.productionChangedBeforeFirstFailingTest' },
  { id: 'protocol_fidelity', label: 'Protocol fidelity', description: 'Run shows RED, GREEN and COMMIT phases, adds a test and ends green.', source: 'assertions/protocol-fidelity.js' },
  { id: 'commit_discipline', label: 'Commit discipline', description: 'Work is committed; nothing left uncommitted at the end.', source: 'assertions/commit-discipline.js' },
  { id: 'commit_quality', label: 'Commit quality', description: 'Test and production code land together in one atomic commit.', source: 'assertions/commit-quality.js' },
  { id: 'tests_pass_end', label: 'Tests pass at end', description: 'The full test suite passes after the run.', source: 'summary.testsPassedAtEnd' },
  { id: 'no_unneeded_questions', label: 'Proceeds on clear requests', description: 'Does not stop to ask a question when the request is already clear.', source: 'assertions/clarification-expected.js' },
  { id: 'clarification', label: 'Asks when ambiguous', description: 'Stops to ask a clarifying question before changing code on an ambiguous request.', source: 'assertions/clarification-stops.js, assertions/clarification-quality.js' },
  { id: 'extended_discipline', label: 'Holds discipline (long run)', description: 'Discipline does not degrade across a three-cycle session.', source: 'assertions/extended-run-discipline.js' },
];

// promptfoo assertion metric name -> report metric id.
const ASSERTION_METRICS = {
  protocol_fidelity: 'protocol_fidelity',
  commit_discipline: 'commit_discipline',
  commit_quality: 'commit_quality',
  clarification: 'no_unneeded_questions',
  clarification_stops: 'clarification',
  clarification_quality: 'clarification',
  extended_discipline: 'extended_discipline',
};

const FAILURE_MODES = [
  { id: 'production-before-red', label: 'Wrote production code before a failing test' },
  { id: 'no-commit', label: 'Made no commits' },
  { id: 'uncommitted-changes', label: 'Left work uncommitted' },
  { id: 'test-and-code-split-commit', label: 'Committed tests without the code that makes them pass' },
  { id: 'production-only-commit', label: 'Committed production code without a test' },
  { id: 'tests-failed-at-end', label: 'Finished with failing tests' },
  { id: 'no-clarification-asked', label: 'Guessed instead of asking' },
];

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function parseOutput(output) {
  if (output && typeof output === 'object' && !Array.isArray(output)) return output;
  if (typeof output === 'string') {
    try {
      const parsed = JSON.parse(output);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function scenarioKey(vars) {
  if (vars.scenarioModulePath) {
    return path.basename(vars.scenarioModulePath).replace(/\.js$/, '');
  }
  return vars.scenarioId || null;
}

// Returns { [metricId]: boolean } for one trial.
function scoreTrial(row, output, family) {
  const scores = {};
  for (const component of row.gradingResult?.componentResults || []) {
    const metricId = ASSERTION_METRICS[component.assertion?.metric];
    if (!metricId) continue;
    // A metric fed by several assertions passes only if all of them pass.
    scores[metricId] = (scores[metricId] ?? true) && component.pass === true;
  }

  if (family !== 'clarification') {
    if (typeof output.productionChangedBeforeFirstFailingTest === 'boolean') {
      scores.test_first = output.productionChangedBeforeFirstFailingTest === false;
    }
    if (typeof output.testsPassedAtEnd === 'boolean') {
      scores.tests_pass_end = output.testsPassedAtEnd;
    }
  }

  return scores;
}

function trialFailureModes(output, scores, family) {
  const modes = family === 'clarification'
    ? []
    : (Array.isArray(output.failureModes) ? output.failureModes : []);
  return scores.clarification === false ? [...modes, 'no-clarification-asked'] : modes;
}

function getRows(json) {
  if (Array.isArray(json?.results?.results)) return json.results.results;
  if (Array.isArray(json?.results)) return json.results;
  return [];
}

/**
 * @param {{ fileName: string, json: object }[]} runFiles promptfoo JSON outputs
 * @param {{ generatedAt?: string, harnessVersion?: string }} options
 */
function buildReport(runFiles, options = {}) {
  const cells = new Map();
  const scenarios = new Map();
  const skipped = { erroredRows: 0, excludedRows: 0 };

  for (const { json } of runFiles) {
    for (const row of getRows(json)) {
      const vars = row.vars || row.testCase?.vars || {};
      const key = scenarioKey(vars);

      if (!key || !vars.fixtureId || EXCLUDED_SCENARIOS.has(key)) {
        skipped.excludedRows += 1;
        continue;
      }

      const output = parseOutput(row.response?.output);
      if (!output) {
        skipped.erroredRows += 1;
        continue;
      }

      const metadata = row.response?.metadata || row.metadata || {};
      const model = metadata.evalModel || 'default';
      const condition = metadata.evalCondition || 'harness';
      const family = vars.scenarioFamily || output.scenarioFamily || 'feature';

      if (!scenarios.has(key)) {
        scenarios.set(key, {
          id: key,
          label: row.testCase?.description || row.description || key,
          fixtureId: vars.fixtureId,
          family,
        });
      }

      const cellKey = `${model}\u0000${condition}\u0000${key}`;
      if (!cells.has(cellKey)) {
        cells.set(cellKey, {
          model, condition, scenario: key, trials: 0, passes: {}, failureModes: {}, durations: [], commits: [],
        });
      }
      const cell = cells.get(cellKey);

      const scores = scoreTrial(row, output, family);
      cell.trials += 1;
      for (const [metricId, passed] of Object.entries(scores)) {
        cell.passes[metricId] = (cell.passes[metricId] || 0) + (passed ? 1 : 0);
      }
      for (const mode of trialFailureModes(output, scores, family)) {
        cell.failureModes[mode] = (cell.failureModes[mode] || 0) + 1;
      }
      if (Number.isFinite(row.latencyMs)) cell.durations.push(row.latencyMs / 1000);
      if (Number.isFinite(output.commitCount)) cell.commits.push(output.commitCount);
    }
  }

  const runs = [...cells.values()]
    .map(({ durations, commits, ...cell }) => ({
      ...cell,
      medianDurationSec: durations.length ? Math.round(median(durations)) : null,
      medianCommits: median(commits),
    }))
    .sort((a, b) => `${a.model}|${a.condition}|${a.scenario}`.localeCompare(`${b.model}|${b.condition}|${b.scenario}`));

  const measuredMetrics = new Set(runs.flatMap((r) => Object.keys(r.passes)));
  const seenFailureModes = new Set(runs.flatMap((r) => Object.keys(r.failureModes)));
  const trialCounts = runs.map((r) => r.trials);

  return {
    schemaVersion: '0.1.0-prototype',
    isSample: false,
    generatedAt: options.generatedAt || new Date().toISOString(),
    harnessVersion: options.harnessVersion || 'unknown',
    trialsPerCell: trialCounts.length ? Math.min(...trialCounts) : 0,
    conditions: CONDITIONS,
    models: [...new Set(runs.map((r) => r.model))].sort().map((id) => ({ id, label: id })),
    metrics: METRICS.filter((m) => measuredMetrics.has(m.id)),
    scenarios: [...scenarios.values()].filter((s) => runs.some((r) => r.scenario === s.id)),
    failureModes: [
      ...FAILURE_MODES.filter((f) => seenFailureModes.has(f.id)),
      ...[...seenFailureModes]
        .filter((id) => !FAILURE_MODES.some((f) => f.id === id))
        .map((id) => ({ id, label: id })),
    ],
    skipped,
    runs,
  };
}

function renderReportScript(report) {
  return [
    '// Generated by scripts/build-eval-report.js. Do not edit by hand.',
    `window.EVAL_REPORT = ${JSON.stringify(report, null, 2)};`,
    '',
  ].join('\n');
}

function readRunFiles(inputDir) {
  if (!fs.existsSync(inputDir)) return [];
  return fs.readdirSync(inputDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => ({ fileName: name, json: JSON.parse(fs.readFileSync(path.join(inputDir, name), 'utf8')) }));
}

function detectHarnessVersion() {
  try {
    return execFileSync('git', ['describe', '--tags', '--always', '--dirty'], {
      cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

function parseArgs(argv) {
  const args = { input: DEFAULT_INPUT, output: DEFAULT_OUTPUT, harnessVersion: null };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--input') { args.input = path.resolve(value); i += 1; }
    else if (flag === '--output') { args.output = path.resolve(value); i += 1; }
    else if (flag === '--harness-version') { args.harnessVersion = value; i += 1; }
    else if (flag === '--help' || flag === '-h') { args.help = true; }
    else { throw new Error(`Unknown option: ${flag}`); }
  }
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: node scripts/build-eval-report.js [--input <dir>] [--output <file>] [--harness-version <v>]');
    return 0;
  }

  const runFiles = readRunFiles(args.input);
  const report = buildReport(runFiles, { harnessVersion: args.harnessVersion || detectHarnessVersion() });

  if (report.runs.length === 0) {
    console.error(`No usable eval results found in ${args.input}. Run scripts/run-evals.sh (or .ps1) first.`);
    return 1;
  }

  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, renderReportScript(report), 'utf8');

  const trials = report.runs.reduce((n, r) => n + r.trials, 0);
  console.log(`Wrote ${path.relative(process.cwd(), args.output)} from ${runFiles.length} run file(s): `
    + `${report.models.length} model(s), ${report.scenarios.length} scenario(s), ${trials} trial(s).`);
  if (report.skipped.erroredRows > 0) {
    console.warn(`Skipped ${report.skipped.erroredRows} row(s) with no agent output (provider errors).`);
  }
  const conditions = new Set(report.runs.map((r) => r.condition));
  for (const c of CONDITIONS) {
    if (!conditions.has(c.id)) {
      console.warn(`No "${c.id}" runs found; comparisons on the dashboard will show "—". Run with --condition ${c.id}.`);
    }
  }
  return 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { buildReport, renderReportScript };
