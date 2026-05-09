/**
 * Verifies that the agent stopped before RED when the task was ambiguous:
 *   - clarificationAsked === true  (question was output before proceeding)
 *   - commitCount === 0            (no unilateral implementation)
 *
 * Only applied to scenarios where clarificationExpected === true.
 */
module.exports = (output, context) => {
  const vars = context?.vars || context?.test?.vars || {};
  if (vars.clarificationExpected !== true) {
    return { pass: true, score: 1, reason: 'clarification-stops check not required for this scenario.' };
  }

  const asked = output?.clarificationAsked === true;
  const stopped = output?.commitCount === 0;
  const pass = asked && stopped;

  return {
    pass,
    score: pass ? 1 : 0,
    reason: pass
      ? 'Agent asked for clarification and made no unilateral commit.'
      : `clarification-stops failed: clarificationAsked=${asked}, commitCount=${output?.commitCount}`,
  };
};
