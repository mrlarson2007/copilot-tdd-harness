const fs = require('node:fs');
const path = require('node:path');

function resolveVars(options, context) {
  const candidate = context || options || {};
  if (candidate && typeof candidate === 'object' && candidate.vars && typeof candidate.vars === 'object') {
    return candidate.vars;
  }
  if (candidate && typeof candidate === 'object') {
    return candidate;
  }
  return {};
}

/**
 * Benchmark provider for the TDD agent eval matrix.
 *
 * For v1, the provider reads a pre-produced run-summary JSON file from
 * `vars.summaryPath` (resolved relative to the repo root) and returns it as
 * the model output. This lets the deterministic Promptfoo assertions exercise
 * the scoring layer end-to-end while the agent harness runner is still under
 * construction.
 *
 * Once the harness runner is wired up, this provider will instead invoke the
 * runner against `vars.fixtureId` + `vars.scenarioId` and return the produced
 * run-summary JSON.
 */
module.exports = class TddBenchmarkProvider {
  id() {
    return 'tdd-benchmark-provider';
  }

  async callApi(_prompt, _options, context) {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const vars = resolveVars(_options, context);
    const summaryPath = vars.summaryPath;

    if (!summaryPath) {
      throw new Error('benchmark provider requires vars.summaryPath until the harness runner is wired up');
    }

    const absolute = path.isAbsolute(summaryPath)
      ? summaryPath
      : path.join(repoRoot, summaryPath);

    const raw = fs.readFileSync(absolute, 'utf8');
    const parsed = JSON.parse(raw);

    return {
      output: parsed,
      metadata: {
        summaryPath: absolute,
        fixtureId: parsed.fixtureId,
        scenarioId: parsed.scenarioId,
        scenarioFamily: parsed.scenarioFamily,
        runMode: parsed.runMode,
      },
    };
  }
};
