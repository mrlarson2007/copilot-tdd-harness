module.exports = (output, context) => {
  const vars = context?.vars || context?.test?.vars || {};
  const expected = vars.clarificationExpected;
  const pass = output?.clarificationAsked === expected;
  return {
    pass,
    score: pass ? 1 : 0,
    reason: `Clarification expectation satisfied (expected=${expected}).`,
  };
};