module.exports = (output) => {
  const failureModes = Array.isArray(output?.failureModes) ? output.failureModes : [];
  const pass = output?.commitCount === 0 || failureModes.includes('missing-commit');
  return {
    pass,
    score: pass ? 1 : 0,
    reason: pass
      ? 'Detected missing-commit behavior as expected.'
      : 'Expected missing-commit behavior was not detected.',
  };
};