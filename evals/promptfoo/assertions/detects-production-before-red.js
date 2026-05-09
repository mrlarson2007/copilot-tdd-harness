module.exports = (output) => {
  const failureModes = Array.isArray(output?.failureModes) ? output.failureModes : [];
  const pass = output?.productionChangedBeforeFirstFailingTest === true || failureModes.includes('production-before-red');
  return {
    pass,
    score: pass ? 1 : 0,
    reason: pass
      ? 'Detected production-before-red as expected.'
      : 'Expected production-before-red violation was not detected.',
  };
};