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
    throw new Error('Expected RED test run to fail after adding multiply test in clarification scenario.');
  }

  addMultiplyImplementation(workspaceDir);

  const greenResult = runGoTests(workspaceDir);
  if (!greenResult.ok) {
    throw new Error(`Expected GREEN test run to pass in clarification scenario. Output: ${greenResult.output}`);
  }

  stageAll(workspaceDir);
  commitAll(workspaceDir, 'feat: add multiply command after clarification');

  const commitRef = latestCommitRef(workspaceDir);

  return {
    summary: buildSummary(input, {
      clarificationAsked: true,
      clarificationResolved: true,
      clarificationResolution: 'multiply',
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
      notes: 'Generated from a disposable real fixture run where the ambiguous request is clarified before implementing multiply via TDD.',
    }),
    artifacts: {
      clarificationPrompt: 'Add another arithmetic subcommand to the calc CLI.',
      clarifiedAs: 'multiply',
      redTestOutput: redResult.output,
      greenTestOutput: greenResult.output,
      latestCommitRef: commitRef,
    },
  };
};