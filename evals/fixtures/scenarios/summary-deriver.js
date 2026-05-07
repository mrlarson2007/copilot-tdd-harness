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
  };
}

function productionChangedBeforeFirstTest(classified) {
  const firstTestIdx = classified.findIndex(c => c.hasTest);
  if (firstTestIdx === -1) return classified.some(c => c.hasProduction);
  return classified.slice(0, firstTestIdx).some(c => c.hasProduction);
}

function allCodeCommitsMixed(classified) {
  const code = classified.filter(c => c.hasTest || c.hasProduction);
  if (code.length === 0) return false;
  return code.every(c => c.hasTest && c.hasProduction);
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
 * Emit one RED → GREEN → COMMIT triple per code-bearing commit.
 * This gives the extended-run-discipline assertion the per-cycle counts it needs.
 */
function buildPhaseTransitions(classified) {
  const transitions = [];
  let cycleIndex = 0;
  for (const commit of classified) {
    if (!commit.hasTest && !commit.hasProduction) continue;
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
  ].some(p => p.test(agentOutput));
}

function extractClarificationResolution(agentOutput) {
  if (!agentOutput) return null;
  const m = agentOutput.match(/(?:proceeding with|implementing|adding)\s+(multiply|subtract|divide|add|power)/i);
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
// Failure mode detection
// ---------------------------------------------------------------------------

function detectFailureModes(classified, testsPassedAtEnd) {
  const modes = [];

  if (productionChangedBeforeFirstTest(classified)) {
    modes.push('production-before-red');
  }

  const code = classified.filter(c => c.hasTest || c.hasProduction);
  if (code.some(c => c.hasProduction && !c.hasTest)) modes.push('production-only-commit');
  if (code.some(c => c.hasTest && !c.hasProduction)) modes.push('test-and-code-split-commit');
  if (classified.length === 0) modes.push('no-commit');
  if (!testsPassedAtEnd) modes.push('tests-failed-at-end');

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
  const classified = rawCommits.map(c => classifyCommit(c, isTestFile, isProductionFile));

  const finalTestResult = testRunnerFn(workspaceDir);
  const testsPassedAtEnd = finalTestResult.ok;

  const newTestsAdded = countNewTestFunctions(workspaceDir, initialHead, isTestFile, input.fixtureId);
  const productionFilesChanged = countChangedProductionFiles(workspaceDir, initialHead, isProductionFile);
  const prodBeforeRed = productionChangedBeforeFirstTest(classified);
  const togetherness = allCodeCommitsMixed(classified);
  const clarificationAsked = detectClarification(agentOutput);
  const clarificationResolution = clarificationAsked ? extractClarificationResolution(agentOutput) : null;
  const phaseTransitions = buildPhaseTransitions(classified);
  const commitCount = classified.length;
  const testRunCount = estimateTestRunCount(agentOutput, commitCount);
  const failureModes = detectFailureModes(classified, testsPassedAtEnd);

  return {
    schemaVersion: '1.0.0',
    fixtureId: input.fixtureId,
    baselineId: input.baselineId,
    scenarioId: input.scenarioId,
    scenarioFamily: input.scenarioFamily,
    runMode: input.runMode,
    prompt: input.prompt,
    clarificationAsked,
    clarificationResolved: clarificationAsked,
    clarificationResolution,
    coverageDelta: null,
    cycleCount: commitCount,
    phaseTransitions,
    newTestsAdded,
    productionFilesChanged,
    productionChangedBeforeFirstFailingTest: prodBeforeRed,
    testsPassedAtEnd,
    testRunCount,
    firstFailingTestName: null,
    commitCount,
    testAndCodeCommittedTogether: togetherness,
    failureModes,
  };
}

module.exports = { deriveRunSummary };
