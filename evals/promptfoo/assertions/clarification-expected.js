// Clarification expectation check.
//
// Each scenario manifest declares whether the agent should have asked for
// clarification. This assertion enforces that expectation against the
// run-summary's clarificationAsked field.
//
// Drives the "ambiguous" scenario family but is safe to apply to every
// scenario because non-ambiguous scenarios set clarificationExpected=false.

module.exports = function assertClarificationExpected(output, context) {
  const expected = context.vars.clarificationExpected === true;
  const actual = output.clarificationAsked === true;
  if (actual === expected) {
    return {
      pass: true,
      score: 1,
      reason: `Clarification expectation satisfied (expected=${expected}).`,
    };
  }
  return {
    pass: false,
    score: 0,
    reason: `Clarification mismatch: expected=${expected}, observed=${actual}.`,
  };
};
