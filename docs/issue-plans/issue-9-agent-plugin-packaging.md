# Detailed Issue Plan

This file contains the active implementation content for the current GitHub issue.

## Phase 7 — True CI Pipeline and Gated Publishing ([#9](https://github.com/mrlarson2007/copilot-tdd-harness/issues/9))

Implement a real CI pipeline that evaluates the packaged harness against example
projects with promptfoo and only publishes when the gated score is met on the
default branch.

## Goals

- Run promptfoo evals against example projects in CI.
- Execute each scenario in a disposable git worktree reset to the branch base.
- Allow scenarios to create real local commits while being evaluated.
- Publish the package only from the default branch and only when the score clears the gate.
- Run eval-only on non-default branches.

## Desired CI Behavior

### Pull requests and non-default branches

- Check out the branch under test.
- Reset each example scenario to the merge-base or other chosen branch base before the run.
- Run the promptfoo suite.
- Upload run summaries, scores, and artifacts.
- Do not publish any package.

### Default branch

- Re-run the promptfoo suite from a clean baseline.
- Require the configured minimum score before any publish step.
- If the score passes, package the harness assets and publish.
- If the score fails, fail the workflow and skip publish.

## Implementation Outline

1. Build an eval runner that prepares disposable worktrees per example fixture.
2. Ensure each eval run starts from the branch base, not a dirty prior state.
3. Allow the evaluated agent flow to create real commits inside the disposable worktree.
4. Collect promptfoo outputs plus git history artifacts for scoring and audit.
5. Add CI workflow separation:
   - eval workflow for branches and pull requests
   - publish workflow for default branch only
6. Define the publishable artifact format and versioning source.
7. Gate the publish workflow on the promptfoo threshold.

## Acceptance Criteria

- [ ] Branch and PR CI run promptfoo evals against the example suite.
- [ ] Each example run starts from a clean branch-base snapshot.
- [ ] Eval runs are allowed to create local commits in disposable worktrees.
- [ ] CI stores enough artifacts to inspect score, transcript, diffs, and commit history.
- [ ] Default-branch CI skips publish when the promptfoo score is below the threshold.
- [ ] Default-branch CI publishes the package when the score meets or exceeds the threshold.
- [ ] Non-default branches never publish packages.
- [ ] The pipeline documents where the score threshold is configured.

## Open Decisions

- What exact promptfoo score threshold should gate publish?
- What artifact should be published: plugin package, release asset bundle, or both?
- Should the branch base be `origin/master`, PR merge-base, or another explicit ref?

This is the active issue-plan doc for the current CI pipeline work.
