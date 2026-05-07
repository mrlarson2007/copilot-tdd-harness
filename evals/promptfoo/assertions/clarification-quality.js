module.exports = (output, context) => {
  const vars = context?.vars || context?.test?.vars || {};
  if (vars.clarificationExpected !== true) {
    return { pass: true, score: 1, reason: 'Clarification quality check not required for this scenario.' };
  }

  const resolution = typeof output?.clarificationResolution === 'string'
    ? output.clarificationResolution.trim()
    : '';
  const pass = output?.clarificationAsked === true
    && output?.clarificationResolved === true
    && resolution.length > 0;

  return {
    pass,
    score: pass ? 1 : 0,
    reason: pass
      ? `Clarification resolved to ${resolution}.`
      : 'Expected clarification to be explicitly resolved before implementation.',
  };
};