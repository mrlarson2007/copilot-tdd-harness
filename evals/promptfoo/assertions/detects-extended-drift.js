module.exports = (output) => {
  const failureModes = Array.isArray(output?.failureModes) ? output.failureModes : [];
  const phases = Array.isArray(output?.phaseTransitions) ? output.phaseTransitions : [];
  const commitCount = phases.filter((phase) => phase.phase === 'COMMIT').length;
  const redCount = phases.filter((phase) => phase.phase === 'RED').length;

  const pass = output?.runMode === 'extended-run'
    && output?.cycleCount === 3
    && output?.productionChangedBeforeFirstFailingTest === true
    && failureModes.includes('production-before-red')
    && failureModes.includes('missing-cycle-commit')
    && redCount < output.cycleCount
    && commitCount < output.cycleCount;

  return {
    pass,
    score: pass ? 1 : 0,
    reason: pass
      ? 'Detected extended-run drift: production changed before RED and at least one cycle was left uncommitted.'
      : 'Expected the extended-run negative exemplar to show detectable drift.',
  };
};