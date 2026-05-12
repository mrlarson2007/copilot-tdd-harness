'use strict';

const { execFileSync } = require('child_process');

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

function runCommand(command, args, cwd) {
  try {
    const output = execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, exitCode: 0, output };
  } catch (error) {
    return {
      ok: false,
      exitCode: error.status ?? 1,
      output: `${error.stdout || ''}${error.stderr || ''}`,
    };
  }
}

function git(cwd, args) {
  return runCommand('git', args, cwd);
}

/**
 * Returns commits from initialHead..HEAD in chronological order.
 * Each entry: { ref: string, files: string[] }
 */
function getCommitsSinceBaseline(workspaceDir, initialHead) {
  const result = git(workspaceDir, [
    'log',
    `${initialHead}..HEAD`,
    '--name-only',
    '--format=COMMIT %H',
    '--reverse',
  ]);
  if (!result.ok || !result.output.trim()) return [];

  const commits = [];
  let current = null;
  for (const line of result.output.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('COMMIT ')) {
      if (current) commits.push(current);
      current = { ref: trimmed.slice(7), files: [] };
    } else if (trimmed && current) {
      current.files.push(trimmed);
    }
  }
  if (current) commits.push(current);
  return commits;
}

// ---------------------------------------------------------------------------
// File classifiers
// ---------------------------------------------------------------------------

function isGoTestFile(f) { return f.endsWith('_test.go'); }
function isGoProductionFile(f) { return f.endsWith('.go') && !f.endsWith('_test.go'); }

function isDotnetTestFile(f) {
  return f.endsWith('.cs') && (
    f.includes('.Tests/') || f.includes('.Tests\\') || /Tests\.cs$/.test(f)
  );
}
function isDotnetProductionFile(f) {
  return f.endsWith('.cs') && !isDotnetTestFile(f);
}

function getFileClassifiers(fixtureId) {
  if (fixtureId && fixtureId.includes('dotnet')) {
    return { isTestFile: isDotnetTestFile, isProductionFile: isDotnetProductionFile };
  }
  return { isTestFile: isGoTestFile, isProductionFile: isGoProductionFile };
}

// ---------------------------------------------------------------------------
// Commit classification
// ---------------------------------------------------------------------------

function classifyCommit(commit, isTestFile, isProductionFile) {
  return {
    ...commit,
    hasTest: commit.files.some(isTestFile),
    hasProduction: commit.files.some(isProductionFile),
    isRefactor: false, // set by markRefactorCommits
  };
}

/**
 * A production-only commit is a valid REFACTOR commit when it follows at least
 * one prior GREEN commit (i.e. a commit that had both test + production files).
 * Without a prior GREEN commit, a production-only commit is a protocol error.
 */
function markRefactorCommits(classified) {
  let hasSeenGreenCommit = false;
  return classified.map(c => {
    const isGreen = c.hasTest && c.hasProduction;
    const isRefactor = !c.hasTest && c.hasProduction && hasSeenGreenCommit;
    if (isGreen) hasSeenGreenCommit = true;
    return { ...c, isRefactor };
  });
}

function productionChangedBeforeFirstTest(classified) {
  const firstTestIdx = classified.findIndex(c => c.hasTest);
  if (firstTestIdx === -1) return classified.some(c => c.hasProduction);
  return classified.slice(0, firstTestIdx).some(c => c.hasProduction);
}

function allCodeCommitsMixed(classified) {
  // A run has good togetherness when every code-bearing commit is either a GREEN
  // commit (test + production together) or a valid REFACTOR commit.
  const code = classified.filter(c => c.hasTest || c.hasProduction);
  if (code.length === 0) return false;
  return code.every(c => (c.hasTest && c.hasProduction) || c.isRefactor);
}

// ---------------------------------------------------------------------------
// Test count
// ---------------------------------------------------------------------------

function countNewTestFunctions(workspaceDir, initialHead, isTestFile, fixtureId) {
  const diffResult = git(workspaceDir, ['diff', `${initialHead}..HEAD`, '--unified=0']);
  if (!diffResult.ok) return 0;

  const lines = diffResult.output.split('\n');
  let inTestFile = false;
  let count = 0;

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      const m = line.match(/b\/(.+)$/);
      inTestFile = m ? isTestFile(m[1]) : false;
    }
    if (!inTestFile) continue;
    if (fixtureId && fixtureId.includes('dotnet')) {
      if (/^\+\s+\[(?:Fact|Theory)\]/.test(line)) count++;
    } else {
      if (/^\+func Test[A-Za-z0-9_]+\s*\(/.test(line)) count++;
    }
  }
  return count;
}

function countChangedProductionFiles(workspaceDir, initialHead, isProductionFile) {
  const result = git(workspaceDir, ['diff', '--name-only', `${initialHead}..HEAD`]);
  if (!result.ok) return 0;
  return result.output.split('\n').filter(f => f.trim() && isProductionFile(f.trim())).length;
}

// ---------------------------------------------------------------------------
// Phase transitions
// ---------------------------------------------------------------------------

/**
 * Emit one RED → GREEN → COMMIT triple per GREEN commit (hasTest && hasProduction).
 * Refactor commits (production-only, post-GREEN) are excluded — they are not
 * separate TDD cycles.  This gives the extended-run-discipline assertion the
 * per-cycle counts it needs without inflating cycleCount.
 */
function buildPhaseTransitions(classified) {
  const transitions = [];
  let cycleIndex = 0;
  for (const commit of classified) {
    if (!commit.hasTest || !commit.hasProduction) continue; // GREEN commits only
    transitions.push({ phase: 'RED', source: 'derived', cycleIndex });
    transitions.push({ phase: 'GREEN', source: 'derived', cycleIndex });
    transitions.push({ phase: 'COMMIT', source: 'derived', ref: commit.ref, cycleIndex });
    cycleIndex++;
  }
  return transitions;
}

// ---------------------------------------------------------------------------
// Clarification detection
// ---------------------------------------------------------------------------

function detectClarification(agentOutput) {
  if (!agentOutput) return false;
  return [
    /\?\s*$/m,
    /\b(clarif|which (operation|subcommand|command)|please specify|could you (clarify|specify|tell))\b/i,
    /before (I|we) (proceed|start|begin|implement)/i,
    /\bwhat (operation|command|feature|behavior)\b/i,
    /\bwhich (one|specific|operation|subcommand)\b/i,
    /\bspecif(y|ic)\b.*\b(operation|command|behavior|feature)\b/i,
    /\b(multiply|subtract|divide|modulo|power)\b.*\?/i,
    /should I implement\b/i,
  ].some(p => p.test(agentOutput));
}

function extractClarificationResolution(agentOutput) {
  if (!agentOutput) return null;
  const m = agentOutput.match(
    /(?:clarification resolved:\s*|proceeding with|implementing|adding|using)\s*(?:\*\*`)?(multiply|subtract|divide|add|power)(?:`\*\*)?(?:\s+as the clarified choice)?/i,
  );
  return m ? m[1].toLowerCase() : null;
}

// ---------------------------------------------------------------------------
// Test run count estimation
// ---------------------------------------------------------------------------

function estimateTestRunCount(agentOutput, commitCount) {
  if (!agentOutput) return commitCount * 2;
  const goMatches = (agentOutput.match(/^(?:ok|FAIL|---\s+(?:PASS|FAIL))\s+/gm) || []).length;
  const dotnetMatches = (agentOutput.match(/(?:Passed!|Failed!)/gm) || []).length;
  const counted = Math.max(goMatches, dotnetMatches * 2);
  return counted > 0 ? counted : commitCount * 2;
}

// ---------------------------------------------------------------------------
// Uncommitted change detection
// ---------------------------------------------------------------------------

/**
 * Returns any code files (test or production) that are modified but not
 * committed at the end of the agent run.  A non-empty list means the agent
 * violated commit discipline (e.g. refactored but forgot to commit).
 */
function detectUncommittedCodeFiles(workspaceDir, isTestFile, isProductionFile) {
  const result = git(workspaceDir, ['status', '--porcelain']);
  if (!result.ok || !result.output.trim()) return [];

  return result.output
    .split('\n')
    .filter(l => l.trim())
    .map(l => l.slice(3).trim())          // strip 2-char status + space
    .filter(f => f && (isTestFile(f) || isProductionFile(f)));
}

// ---------------------------------------------------------------------------
// Failure mode detection
// ---------------------------------------------------------------------------

function detectFailureModes(classified, testsPassedAtEnd, uncommittedFiles) {
  const modes = [];

  if (productionChangedBeforeFirstTest(classified)) {
    modes.push('production-before-red');
  }

  const code = classified.filter(c => c.hasTest || c.hasProduction);
  // production-only commit that is NOT a valid post-GREEN refactor commit
  if (code.some(c => c.hasProduction && !c.hasTest && !c.isRefactor)) modes.push('production-only-commit');
  if (code.some(c => c.hasTest && !c.hasProduction)) modes.push('test-and-code-split-commit');
  if (classified.length === 0) modes.push('no-commit');
  if (!testsPassedAtEnd) modes.push('tests-failed-at-end');
  if (uncommittedFiles.length > 0) modes.push('uncommitted-changes');

  return [...new Set(modes)];
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Derive the run summary from git history, a final test run, and agent output.
 *
 * @param {object}   input          - The input object from benchmark-provider.js
 * @param {string}   workspaceDir   - Path to the disposable git workspace
 * @param {string}   initialHead    - SHA of the baseline commit
 * @param {string}   agentOutput    - Captured stdout from the copilot CLI invocation
 * @param {function} testRunnerFn   - (workspaceDir) => { ok, output } — runs the project's tests
 */
function deriveRunSummary(input, workspaceDir, initialHead, agentOutput, testRunnerFn) {
  const { isTestFile, isProductionFile } = getFileClassifiers(input.fixtureId);
  const rawCommits = getCommitsSinceBaseline(workspaceDir, initialHead);
  const classified = markRefactorCommits(
    rawCommits.map(c => classifyCommit(c, isTestFile, isProductionFile))
  );

  const finalTestResult = testRunnerFn(workspaceDir);
  const testsPassedAtEnd = finalTestResult.ok;

  const newTestsAdded = countNewTestFunctions(workspaceDir, initialHead, isTestFile, input.fixtureId);
  const productionFilesChanged = countChangedProductionFiles(workspaceDir, initialHead, isProductionFile);
  const prodBeforeRed = productionChangedBeforeFirstTest(classified);
  const togetherness = allCodeCommitsMixed(classified);
  const uncommittedFiles = detectUncommittedCodeFiles(workspaceDir, isTestFile, isProductionFile);
  const clarificationAsked = detectClarification(agentOutput);
  const clarificationResolution = clarificationAsked ? extractClarificationResolution(agentOutput) : null;
  const phaseTransitions = buildPhaseTransitions(classified);
  const codeBearingCommits = classified.filter(c => c.hasTest || c.hasProduction);
  const greenCommits = classified.filter(c => c.hasTest && c.hasProduction);
  const refactorCommits = classified.filter(c => c.isRefactor);
  const testRunCount = estimateTestRunCount(agentOutput, codeBearingCommits.length);
  const failureModes = detectFailureModes(classified, testsPassedAtEnd, uncommittedFiles);

  return {
    schemaVersion: '1.0.0',
    fixtureId: input.fixtureId,
    baselineId: input.baselineId,
    scenarioId: input.scenarioId,
    scenarioFamily: input.scenarioFamily,
    runMode: input.runMode,
    prompt: input.prompt,
    clarificationAsked,
    clarificationResolved: clarificationResolution !== null,
    clarificationResolution,
    coverageDelta: null,
    cycleCount: greenCommits.length,
    phaseTransitions,
    newTestsAdded,
    productionFilesChanged,
    productionChangedBeforeFirstFailingTest: prodBeforeRed,
    testsPassedAtEnd,
    testRunCount,
    firstFailingTestName: null,
    commitCount: codeBearingCommits.length,
    refactorCommitCount: refactorCommits.length,
    testAndCodeCommittedTogether: togetherness,
    hasUncommittedChanges: uncommittedFiles.length > 0,
    uncommittedFiles,
    failureModes,
    agentOutputSnippet: agentOutput ? agentOutput.slice(0, 500) : null,
  };
}

module.exports = { deriveRunSummary };
