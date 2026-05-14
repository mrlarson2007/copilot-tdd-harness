module.exports = (output, context) => {
  if (!output || typeof output !== 'object') {
    return {
      pass: false,
      score: 0,
      reason: 'Plan output must be a JSON object.',
    };
  }

  const vars = context?.vars || context?.test?.vars || {};
  const allowClarificationFirst = vars.allowClarificationFirst === true;
  if (allowClarificationFirst && output?.clarificationAsked === true) {
    return {
      pass: true,
      score: 1,
      reason: 'Clarification-first behavior accepted for ambiguous planning prompt.',
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
