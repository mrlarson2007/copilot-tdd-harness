module.exports = (output) => {
  const phases = Array.isArray(output?.phaseTransitions) ? output.phaseTransitions : [];
  const countPhase = (phaseName) => phases.filter((phase) => phase.phase === phaseName).length;

  const checks = [
    output?.runMode === 'extended-run',
    output?.cycleCount === 3,
    countPhase('RED') === 3,
    countPhase('GREEN') === 3,
    countPhase('COMMIT') === 3,
    output?.newTestsAdded === 3,
    output?.testRunCount === 6,
    output?.commitCount === 3,
    output?.productionChangedBeforeFirstFailingTest === false,
    output?.testsPassedAtEnd === true,
    output?.clarificationAsked === true,
    output?.clarificationResolved === true,
    output?.clarificationResolution === 'multiply',
    output?.testAndCodeCommittedTogether === true,
  ];

  const passedChecks = checks.filter(Boolean).length;
  const pass = passedChecks === checks.length;

  return {
    pass,
    score: pass ? 1 : 0,
    reason: pass
      ? `Extended run discipline: ${passedChecks}/${checks.length} checks passed.`
      : `Extended run discipline failed: ${passedChecks}/${checks.length} checks passed.`,
  };
};