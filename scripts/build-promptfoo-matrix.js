'use strict';

const fs = require('node:fs');
const path = require('node:path');

function buildMatrixConfig(source, models, conditions) {
  if (typeof source !== 'string' || !Array.isArray(models) || models.length === 0
    || !models.every((model) => typeof model === 'string')
    || !Array.isArray(conditions) || conditions.length === 0
    || !conditions.every((condition) => ['harness', 'baseline'].includes(condition))) {
    throw new Error('Invalid Promptfoo matrix configuration');
  }

  const providerSection = /^providers:\r?\n[\s\S]*?(?=^tests:\s*$)/m;
  if (!providerSection.test(source)) throw new Error('Promptfoo configuration has no providers section');

  const providers = models.flatMap((model) => conditions.map((condition) => {
    const label = `${model || 'default'} (${condition})`;
    return [
      '  - id: file://./benchmark-provider.js',
      `    label: ${JSON.stringify(label)}`,
      '    config:',
      `      evalModel: ${model ? JSON.stringify(model) : 'null'}`,
      `      evalCondition: ${JSON.stringify(condition)}`,
    ].join('\n');
  }));

  return source.replace(providerSection, `providers:\n${providers.join('\n')}\n`);
}

function main(argv) {
  if (argv.length < 2) throw new Error('Usage: build-promptfoo-matrix.js <input> <output> [--model <id>] [--condition <condition>]');
  const [input, output, ...options] = argv;
  if (path.resolve(input) === path.resolve(output)) throw new Error('Input and output paths must differ');
  const models = [];
  const conditions = [];
  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    const value = options[index + 1];
    if (value === undefined) throw new Error(`Missing value for ${option}`);
    if (option === '--model') models.push(value);
    else if (option === '--condition') conditions.push(value);
    else throw new Error(`Unknown option: ${option}`);
    index += 1;
  }

  const source = fs.readFileSync(input, 'utf8');
  fs.writeFileSync(output, buildMatrixConfig(source, models.length ? models : [''],
    conditions.length ? conditions : ['harness']), 'utf8');
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { buildMatrixConfig };
