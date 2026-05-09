module.exports = (output) => {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return { pass: false, score: 0, reason: 'Run-summary output must be a JSON object.' };
  }

  const requiredFields = [
    'schemaVersion',
    'fixtureId',
    'scenarioId',
    'scenarioFamily',
    'runMode',
    'phaseTransitions',
    'clarificationAsked',
    'newTestsAdded',
    'productionFilesChanged',
    'productionChangedBeforeFirstFailingTest',
    'testsPassedAtEnd',
    'testRunCount',
    'commitCount',
    'refactorCommitCount',
    'testAndCodeCommittedTogether',
    'hasUncommittedChanges',
    'uncommittedFiles',
    'failureModes',
  ];

  const missing = requiredFields.filter((field) => !(field in output));
  if (missing.length > 0) {
    return {
      pass: false,
      score: 0,
      reason: `Run-summary missing required fields: ${missing.join(', ')}.`,
    };
  }

  if (output.schemaVersion !== '1.0.0') {
    return { pass: false, score: 0, reason: `Unexpected schemaVersion ${output.schemaVersion}.` };
  }

  if (!Array.isArray(output.phaseTransitions) || !Array.isArray(output.failureModes) || !Array.isArray(output.uncommittedFiles)) {
    return { pass: false, score: 0, reason: 'phaseTransitions, failureModes, and uncommittedFiles must be arrays.' };
  }

  return { pass: true, score: 1, reason: 'Run-summary matches v1 schema.' };
};