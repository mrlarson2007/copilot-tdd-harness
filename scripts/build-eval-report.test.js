'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildReport, renderReportScript } = require('./build-eval-report');

function featureRow({ model, condition, pass = true, latencyMs = 60000, overrides = {} }) {
  return {
    testCase: { description: 'calculator-cli-go feature-add-subtract-command' },
    vars: {
      fixtureId: 'calculator-cli-go',
      scenarioFamily: 'feature',
      scenarioModulePath: '../fixtures/scenarios/calculator-cli-go/feature-add-subtract-command.js',
    },
    latencyMs,
    response: {
      metadata: { evalModel: model, evalCondition: condition },
      output: {
        productionChangedBeforeFirstFailingTest: !pass,
        testsPassedAtEnd: true,
        commitCount: pass ? 1 : 0,
        failureModes: pass ? [] : ['production-before-red', 'no-commit'],
        ...overrides,
      },
    },
    gradingResult: {
      componentResults: [
        { pass: true, assertion: { metric: 'schema_shape' } },
        { pass, assertion: { metric: 'protocol_fidelity' } },
        { pass, assertion: { metric: 'commit_discipline' } },
        { pass: true, assertion: { metric: 'clarification' } },
      ],
    },
  };
}

function runFile(rows) {
  return { fileName: 'run.json', json: { results: { results: rows } } };
}

test('buildReport groups trials by model, condition and scenario', () => {
  const report = buildReport([
    runFile([
      featureRow({ model: 'model-x', condition: 'harness', pass: true }),
      featureRow({ model: 'model-x', condition: 'harness', pass: false }),
      featureRow({ model: 'model-x', condition: 'baseline', pass: false }),
    ]),
  ], { generatedAt: '2026-01-01T00:00:00Z', harnessVersion: 'v1.2.3' });

  assert.equal(report.isSample, false);
  assert.deepEqual(report.models.map((m) => m.id), ['model-x']);
  assert.equal(report.runs.length, 2);

  const harness = report.runs.find((r) => r.condition === 'harness');
  assert.equal(harness.scenario, 'feature-add-subtract-command');
  assert.equal(harness.trials, 2);
  assert.equal(harness.passes.test_first, 1);
  assert.equal(harness.passes.protocol_fidelity, 1);
  assert.equal(harness.passes.tests_pass_end, 2);
  assert.equal(harness.passes.no_unneeded_questions, 2);
  assert.equal(harness.failureModes['no-commit'], 1);
  assert.equal(harness.medianDurationSec, 60);
  assert.equal(harness.medianCommits, 0.5);
});

test('buildReport ignores schema checks and lists only metrics that were measured', () => {
  const report = buildReport([runFile([featureRow({ model: 'm', condition: 'harness' })])]);

  const metricIds = report.metrics.map((m) => m.id);
  assert.ok(!metricIds.includes('schema_shape'));
  assert.ok(!metricIds.includes('extended_discipline'));
  assert.ok(metricIds.includes('test_first'));
});

test('buildReport describes test-first results as absence of a detected violation', () => {
  const row = featureRow({
    model: 'm',
    condition: 'harness',
    overrides: { commitCount: 0, newTestsAdded: 0 },
  });

  const report = buildReport([runFile([row])]);
  const metric = report.metrics.find((item) => item.id === 'test_first');

  assert.equal(report.runs[0].passes.test_first, 1);
  assert.equal(metric.label, 'No detected production-before-test violation');
  assert.match(metric.description, /does not establish that a failing test was written first/);
});

test('buildReport treats runs without model or condition metadata as harness runs on the default model', () => {
  const row = featureRow({ model: undefined, condition: undefined });
  row.response.metadata = {};

  const report = buildReport([runFile([row])]);

  assert.equal(report.runs[0].model, 'default');
  assert.equal(report.runs[0].condition, 'harness');
});

test('buildReport skips the eval self-test, non-TDD scenarios and rows without output', () => {
  const selfTest = featureRow({ model: 'm', condition: 'harness' });
  selfTest.vars.scenarioModulePath = '../fixtures/scenarios/calculator-cli-go/commit-discipline-failure.js';
  const planning = featureRow({ model: 'm', condition: 'harness' });
  delete planning.vars.fixtureId;
  const errored = { ...featureRow({ model: 'm', condition: 'harness' }), response: { error: 'boom' } };

  const report = buildReport([runFile([selfTest, planning, errored])]);

  assert.equal(report.runs.length, 0);
  assert.equal(report.skipped.erroredRows, 1);
});

test('WhenScenarioFamilyIsUnsupported_ShouldExcludeRowFromReport', () => {
  const row = featureRow({ model: 'm', condition: 'harness' });
  row.vars.scenarioFamily = 'red-phase';

  const report = buildReport([runFile([row])]);

  assert.deepEqual(report.runs, []);
  assert.deepEqual(report.scenarios, []);
  assert.equal(report.skipped.excludedRows, 1);
});

test('buildReport scores the ambiguous-prompt scenario on clarification only', () => {
  const row = featureRow({ model: 'm', condition: 'baseline' });
  row.vars.scenarioFamily = 'clarification';
  row.vars.scenarioModulePath = '../fixtures/scenarios/calculator-cli-go/feature-add-multiply-command.clarify.js';
  row.gradingResult.componentResults = [{ pass: false, assertion: { metric: 'clarification_stops' } }];

  const report = buildReport([runFile([row])]);

  assert.deepEqual(report.runs[0].passes, { clarification: 0 });
  assert.deepEqual(report.runs[0].failureModes, { 'no-clarification-asked': 1 });
});

test('buildReport does not report guessing when clarification was asked', () => {
  const row = featureRow({ model: 'm', condition: 'baseline' });
  row.vars.scenarioFamily = 'clarification';
  row.gradingResult.componentResults = [
    { pass: false, assertion: { metric: 'clarification_stops' } },
    { pass: false, assertion: { metric: 'clarification_quality' } },
  ];
  row.response.output.clarificationAsked = true;

  const report = buildReport([runFile([row])]);

  assert.deepEqual(report.runs[0].failureModes, {});
});

test('renderReportScript assigns the report to window.EVAL_REPORT', () => {
  const script = renderReportScript({ isSample: false });
  assert.match(script, /window\.EVAL_REPORT = \{\n {2}"isSample": false\n\};\n$/);
});
