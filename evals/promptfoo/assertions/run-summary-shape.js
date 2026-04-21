// Validates a run-summary JSON object against the v1 contract from
// evals/schema/run-summary.schema.json without requiring a JSON-Schema
// runtime dependency. Keep this in sync with the schema file.

const REQUIRED_KEYS = [
  'schemaVersion',
  'fixtureId',
  'scenarioId',
  'scenarioFamily',
  'runMode',
  'prompt',
  'phaseTransitions',
  'clarificationAsked',
  'newTestsAdded',
  'productionFilesChanged',
  'productionChangedBeforeFirstFailingTest',
  'testsPassedAtEnd',
  'testRunCount',
  'commitCount',
  'testAndCodeCommittedTogether',
  'failureModes',
];

const SCENARIO_FAMILIES = new Set([
  'feature',
  'validation',
  'bug-fix',
  'refactor-only',
  'ambiguous',
  'longitudinal',
]);

const RUN_MODES = new Set(['micro-cycle', 'longitudinal']);

const PHASES = new Set(['RED', 'GREEN', 'REFACTOR', 'COMMIT']);

const PHASE_SOURCES = new Set(['commit', 'hook', 'test-run', 'edit']);

const FAILURE_MODES = new Set([
  'production-before-red',
  'no-failing-test-observed',
  'tests-failing-at-end',
  'refactor-while-red',
  'missing-clarification',
  'multi-behavior-cycle',
  'test-and-code-split-commit',
  'no-commit-produced',
  'harness-error',
]);

function fail(reason) {
  return { pass: false, score: 0, reason };
}

module.exports = function assertRunSummaryShape(output) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return fail('Expected run-summary object output.');
  }

  const missing = REQUIRED_KEYS.filter((k) => !(k in output));
  if (missing.length > 0) {
    return fail(`Missing required keys: ${missing.join(', ')}`);
  }

  if (output.schemaVersion !== '1.0.0') {
    return fail(`Unsupported schemaVersion: ${output.schemaVersion}`);
  }
  if (!SCENARIO_FAMILIES.has(output.scenarioFamily)) {
    return fail(`Invalid scenarioFamily: ${output.scenarioFamily}`);
  }
  if (!RUN_MODES.has(output.runMode)) {
    return fail(`Invalid runMode: ${output.runMode}`);
  }

  if (!Array.isArray(output.phaseTransitions)) {
    return fail('phaseTransitions must be an array.');
  }
  for (const [i, t] of output.phaseTransitions.entries()) {
    if (!t || typeof t !== 'object') {
      return fail(`phaseTransitions[${i}] must be an object.`);
    }
    if (!PHASES.has(t.phase)) {
      return fail(`phaseTransitions[${i}].phase invalid: ${t.phase}`);
    }
    if (!PHASE_SOURCES.has(t.source)) {
      return fail(`phaseTransitions[${i}].source invalid: ${t.source}`);
    }
  }

  if (!Array.isArray(output.failureModes)) {
    return fail('failureModes must be an array.');
  }
  for (const m of output.failureModes) {
    if (!FAILURE_MODES.has(m)) {
      return fail(`Unknown failureMode: ${m}`);
    }
  }

  const intFields = [
    'newTestsAdded',
    'productionFilesChanged',
    'testRunCount',
    'commitCount',
  ];
  for (const f of intFields) {
    if (!Number.isInteger(output[f]) || output[f] < 0) {
      return fail(`${f} must be a non-negative integer, got ${output[f]}`);
    }
  }

  const boolFields = [
    'clarificationAsked',
    'productionChangedBeforeFirstFailingTest',
    'testsPassedAtEnd',
    'testAndCodeCommittedTogether',
  ];
  for (const f of boolFields) {
    if (typeof output[f] !== 'boolean') {
      return fail(`${f} must be boolean, got ${typeof output[f]}`);
    }
  }

  return { pass: true, score: 1, reason: 'Run-summary matches v1 schema.' };
};
