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

  const hasSummary = output.hasFeatureSummary;
  const hasStakeholders = output.hasStakeholders;
  const hasAssumptions = output.hasAssumptions;

  const allPresent = hasSummary && hasStakeholders && hasAssumptions;

  const sections = [];
  if (!hasSummary) sections.push('feature summary');
  if (!hasStakeholders) sections.push('stakeholders');
  if (!hasAssumptions) sections.push('assumptions');

  return {
    pass: allPresent,
    score: allPresent ? 1 : 0,
    reason: allPresent
      ? 'Plan includes feature summary, stakeholders, and assumptions.'
      : `Plan missing sections: ${sections.join(', ')}.`,
  };
};
