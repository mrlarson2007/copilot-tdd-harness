// Commit quality (15% of the V1 scoring weight).
//
// Deterministic checks:
//   - At least one commit was produced.
//   - Test and production code were committed together.

module.exports = function assertCommitQuality(output) {
  if (output.commitCount === 0) {
    return {
      pass: false,
      score: 0,
      reason: 'No commits were produced during the run.',
    };
  }
  if (output.testAndCodeCommittedTogether !== true) {
    return {
      pass: false,
      score: 0.5,
      reason: 'Test and production code were committed separately.',
    };
  }
  return {
    pass: true,
    score: 1,
    reason: `${output.commitCount} commit(s) produced with test + production grouped together.`,
  };
};
