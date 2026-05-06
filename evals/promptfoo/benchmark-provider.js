const fs = require('fs');
const path = require('path');

function getVars(context) {
  return context?.vars || context?.test?.vars || context?.prompt?.vars || {};
}

class BenchmarkProvider {
  constructor(options = {}) {
    this.options = options;
  }

  id() {
    return this.options.id || 'tdd-agent-benchmark-provider';
  }

  async callApi(_prompt, context) {
    const vars = getVars(context);
    const summaryPath = vars.summaryPath;

    if (!summaryPath) {
      throw new Error('Missing vars.summaryPath for promptfoo benchmark provider');
    }

    const absoluteSummaryPath = path.resolve(__dirname, summaryPath);
    const raw = fs.readFileSync(absoluteSummaryPath, 'utf8');
    const output = JSON.parse(raw);

    return {
      output,
      metadata: {
        summaryPath: absoluteSummaryPath,
        fixtureId: output.fixtureId,
        scenarioId: output.scenarioId,
        scenarioFamily: output.scenarioFamily,
        runMode: output.runMode,
      },
    };
  }
}

module.exports = BenchmarkProvider;