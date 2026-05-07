const {
  appendMultiplyTest,
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

  appendMultiplyTest(workspaceDir);

  const redResult = runGoTests(workspaceDir);
  if (redResult.ok) {
    throw new Error('Expected RED test run to fail after adding multiply test.');
  }

  addMultiplyImplementation(workspaceDir);

  const greenResult = runGoTests(workspaceDir);
  if (!greenResult.ok) {
    throw new Error(`Expected GREEN test run to pass. Output: ${greenResult.output}`);
  }

  stageAll(workspaceDir);
  commitAll(workspaceDir, 'feat: add multiply command');

  const commitRef = latestCommitRef(workspaceDir);

  return {
    summary: buildSummary(input, {
      phaseTransitions: [
        { phase: 'RED', source: 'test-run', atTestRunIndex: 0 },
        { phase: 'GREEN', source: 'test-run', atTestRunIndex: 1 },
        { phase: 'COMMIT', source: 'commit', ref: commitRef },
      ],
      newTestsAdded: 1,
      productionFilesChanged: 1,
      productionChangedBeforeFirstFailingTest: false,
      testsPassedAtEnd: true,
      testRunCount: 2,
      firstFailingTestName: 'TestMultiplyCommand_PrintsProduct',
      commitCount: commitRangeCount(workspaceDir, initialHead),
      testAndCodeCommittedTogether: true,
      failureModes: [],
      notes: 'Generated from a disposable real fixture run adding a multiply command via RED-GREEN-COMMIT.',
    }),
    artifacts: {
      redTestOutput: redResult.output,
      greenTestOutput: greenResult.output,
      latestCommitRef: commitRef,
    },
  };
};