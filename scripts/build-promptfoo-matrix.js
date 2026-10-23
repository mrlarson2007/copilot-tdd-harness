'use strict';

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

module.exports = { buildMatrixConfig };
