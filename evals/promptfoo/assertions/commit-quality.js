module.exports = (output) => {
  const pass = output?.commitCount >= 1 && output?.testAndCodeCommittedTogether === true;
  return {
    pass,
    score: pass ? 1 : 0,
    reason: pass
      ? `${output.commitCount} commit(s) produced with test + production grouped together.`
      : 'Expected at least one commit with test and production changes grouped together.',
  };
};