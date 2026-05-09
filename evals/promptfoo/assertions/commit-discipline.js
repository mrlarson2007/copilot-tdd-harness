/**
 * Verifies the agent committed all code changes before finishing:
 *   - hasUncommittedChanges === false  (no lingering test/production edits)
 *
 * This catches the most common commit-discipline failure: the agent refactors
 * (or writes production code) but forgets the post-REFACTOR commit, leaving
 * changes in the working tree that are discarded when the workspace is torn down.
 */
module.exports = (output) => {
  const uncommitted = output?.uncommittedFiles ?? [];
  const pass = output?.hasUncommittedChanges === false;

  return {
    pass,
    score: pass ? 1 : 0,
    reason: pass
      ? 'All code changes were committed before the session ended.'
      : `Uncommitted code files found at end of run: ${uncommitted.join(', ') || '(see failureModes)'}`,
  };
};
