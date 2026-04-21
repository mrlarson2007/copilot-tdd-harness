// Protocol fidelity (50% of the V1 scoring weight).
//
// Deterministic checks derived from the run-summary contract:
//   - A failing test was observed before any production-code change.
//   - All tests pass at end of run.
//   - No "refactor-while-red" failure mode was recorded.
//   - No "multi-behavior-cycle" failure mode was recorded.
//
// Each check contributes equally to the partial score.

module.exports = function assertProtocolFidelity(output) {
  const checks = [
    {
      name: 'red-before-production',
      pass: output.productionChangedBeforeFirstFailingTest === false,
    },
    {
      name: 'tests-green-at-end',
      pass: output.testsPassedAtEnd === true,
    },
    {
      name: 'no-refactor-while-red',
      pass: !output.failureModes.includes('refactor-while-red'),
    },
    {
      name: 'one-behavior-per-cycle',
      pass: !output.failureModes.includes('multi-behavior-cycle'),
    },
  ];

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  const failed = checks.filter((c) => !c.pass).map((c) => c.name);

  return {
    pass: failed.length === 0,
    score: passed / total,
    reason:
      failed.length === 0
        ? `Protocol fidelity: ${passed}/${total} checks passed.`
        : `Protocol fidelity ${passed}/${total}. Failed: ${failed.join(', ')}.`,
  };
};
