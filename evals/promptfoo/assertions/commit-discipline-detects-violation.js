/**
 * NEGATIVE TEST assertion: verifies that the eval infrastructure correctly
 * detects a commit-discipline violation (uncommitted code files).
 *
 * This passes when `hasUncommittedChanges === true`, proving the detection
 * mechanism works before we rely on commit-discipline in production evals.
 */
module.exports = (output) => {
  const uncommitted = output?.uncommittedFiles ?? [];
  const detected = output?.hasUncommittedChanges === true && uncommitted.length > 0;

  return {
    pass: detected,
    score: detected ? 1 : 0,
    reason: detected
      ? `Commit-discipline violation correctly detected: ${uncommitted.join(', ')}`
      : 'Expected uncommitted files to be detected, but hasUncommittedChanges was false or no files listed.',
  };
};
