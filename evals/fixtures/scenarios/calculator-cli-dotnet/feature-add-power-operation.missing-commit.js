const {
  appendPowerTest,
  addPowerImplementation,
  buildSummary,
  commitRangeCount,
  runDotnetTests,
  stageAll,
} = require('./scenario-helpers');

module.exports = async function runScenario(input) {
  const { workspaceDir, initialHead } = input;

  appendPowerTest(workspaceDir);

  const redResult = runDotnetTests(workspaceDir);
  if (redResult.ok) {
    throw new Error('Expected RED dotnet test run to fail in missing-commit scenario.');
  }

  addPowerImplementation(workspaceDir);

  const greenResult = runDotnetTests(workspaceDir);
  if (!greenResult.ok) {
    throw new Error(`Expected GREEN dotnet test run to pass in missing-commit scenario. Output: ${greenResult.output}`);
  }

  stageAll(workspaceDir);

  return {
    summary: buildSummary(input, {
      phaseTransitions: [
        { phase: 'RED', source: 'test-run', atTestRunIndex: 0 },
        { phase: 'GREEN', source: 'test-run', atTestRunIndex: 1 },
      ],
      newTestsAdded: 1,
      productionFilesChanged: 1,
      productionChangedBeforeFirstFailingTest: false,
      testsPassedAtEnd: true,
      testRunCount: 2,
      firstFailingTestName: 'Power_WhenTwoNumbersProvided_ShouldReturnExponentResult',
      commitCount: commitRangeCount(workspaceDir, initialHead),
      testAndCodeCommittedTogether: false,
      failureModes: ['missing-commit'],
      notes: 'Generated from a disposable dotnet fixture run that finishes green without creating the required behavior commit.',
    }),
    artifacts: {
      redTestOutput: redResult.output,
      greenTestOutput: greenResult.output,
    },
  };
};