module.exports = (output) => {
  if (!output || typeof output !== 'object') {
    return {
      pass: false,
      score: 0,
      reason: 'Plan output must be a JSON object.',
    };
  }

  const pass = output.hasGivenWhenThen && output.scenarioCount > 0;
  return {
    pass,
    score: pass ? 1 : 0,
    reason: pass
      ? `Plan has ${output.scenarioCount} Given/When/Then scenario(s).`
      : 'Plan missing Given/When/Then scenarios.',
  };
};
