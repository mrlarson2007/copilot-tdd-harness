const {
  addMultiplyImplementation,
  buildSummary,
  commitAll,
  commitRangeCount,
  latestCommitRef,
  runGoTests,
  stageAll,
} = require('./scenario-helpers');

module.exports = async function runScenario(input) {
  const { workspaceDir, initialHead } = input;

  addMultiplyImplementation(workspaceDir);

  const testResult = runGoTests(workspaceDir);
  if (!testResult.ok) {
    throw new Error(`Expected tests to stay green after production-first multiply change. Output: ${testResult.output}`);
  }

  stageAll(workspaceDir);
  commitAll(workspaceDir, 'feat: add multiply command without test');

  const commitRef = latestCommitRef(workspaceDir);

  return {
    summary: buildSummary(input, {
      phaseTransitions: [
        { phase: 'GREEN', source: 'edit' },
        { phase: 'COMMIT', source: 'commit', ref: commitRef },
      ],
      newTestsAdded: 0,
      productionFilesChanged: 1,
      productionChangedBeforeFirstFailingTest: true,
      testsPassedAtEnd: true,
      testRunCount: 1,
      commitCount: commitRangeCount(workspaceDir, initialHead),
      testAndCodeCommittedTogether: false,
      failureModes: [
        'production-before-red',
        'no-failing-test-observed',
        'test-and-code-split-commit',
      ],
      notes: 'Generated from a disposable real fixture run that adds multiply production code before any failing test.',
    }),
    artifacts: {
      greenTestOutput: testResult.output,
      latestCommitRef: commitRef,
    },
  };
};