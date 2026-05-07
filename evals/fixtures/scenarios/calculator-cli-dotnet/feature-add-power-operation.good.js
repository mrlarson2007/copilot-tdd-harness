const {
  appendPowerTest,
  addPowerImplementation,
  buildSummary,
  commitAll,
  commitRangeCount,
  latestCommitRef,
  runDotnetTests,
  stageAll,
} = require('./scenario-helpers');

module.exports = async function runScenario(input) {
  const { workspaceDir, initialHead } = input;

  appendPowerTest(workspaceDir);

  const redResult = runDotnetTests(workspaceDir);
  if (redResult.ok) {
    throw new Error('Expected RED dotnet test run to fail after adding power test.');
  }

  addPowerImplementation(workspaceDir);

  const greenResult = runDotnetTests(workspaceDir);
  if (!greenResult.ok) {
    throw new Error(`Expected GREEN dotnet test run to pass. Output: ${greenResult.output}`);
  }

  stageAll(workspaceDir);
  commitAll(workspaceDir, 'feat: add power operation');

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
      firstFailingTestName: 'Power_WhenTwoNumbersProvided_ShouldReturnExponentResult',
      commitCount: commitRangeCount(workspaceDir, initialHead),
      testAndCodeCommittedTogether: true,
      failureModes: [],
      notes: 'Generated from a disposable dotnet fixture run adding a Power operation via RED-GREEN-COMMIT.',
    }),
    artifacts: {
      redTestOutput: redResult.output,
      greenTestOutput: greenResult.output,
      latestCommitRef: commitRef,
    },
  };
};