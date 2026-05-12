module.exports = (output) => {
  if (!output || typeof output !== 'object') {
    return {
      pass: false,
      score: 0,
      reason: 'Plan output must be a JSON object.',
    };
  }

  const pass = output.fileOutputOffered;
  return {
    pass,
    score: pass ? 1 : 0,
    reason: pass
      ? 'Agent offered to save the plan to docs/requirements.'
      : 'Agent did not offer to save the plan to docs/requirements.',
  };
};
