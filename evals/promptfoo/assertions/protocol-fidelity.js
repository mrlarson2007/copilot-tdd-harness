module.exports = (output) => {
  const phases = Array.isArray(output?.phaseTransitions)
    ? output.phaseTransitions.map((transition) => transition.phase)
    : [];

  const checks = [
    phases.includes('RED'),
    phases.includes('GREEN'),
    phases.includes('COMMIT'),
    output?.productionChangedBeforeFirstFailingTest === false,
    output?.newTestsAdded === 1,
    output?.testsPassedAtEnd === true,
  ];

  const passedChecks = checks.filter(Boolean).length;
  const pass = passedChecks === checks.length;

  return {
    pass,
    score: pass ? 1 : 0,
    reason: pass
      ? `Protocol fidelity: ${passedChecks}/${checks.length} checks passed.`
      : `Protocol fidelity failed: ${passedChecks}/${checks.length} checks passed.`,
  };
};