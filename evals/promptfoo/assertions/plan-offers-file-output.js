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

  const pass = output.fileOutputOffered;
  return {
    pass,
    score: pass ? 1 : 0,
    reason: pass
      ? 'Agent offered to save the plan to docs/requirements.'
      : 'Agent did not offer to save the plan to docs/requirements.',
  };
};
