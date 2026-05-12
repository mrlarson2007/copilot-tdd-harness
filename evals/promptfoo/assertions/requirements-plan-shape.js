module.exports = (output) => {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return {
      pass: false,
      score: 0,
      reason: 'Plan output must be a JSON object.',
    };
  }

  const requiredFields = [
    'schemaVersion',
    'hasPlan',
    'hasGivenWhenThen',
    'scenarioCount',
    'hasFeatureSummary',
    'hasStakeholders',
    'hasAssumptions',
    'clarificationAsked',
    'fileOutputOffered',
  ];

  const missing = requiredFields.filter((field) => !(field in output));
  if (missing.length > 0) {
    return {
      pass: false,
      score: 0,
      reason: `Plan missing required fields: ${missing.join(', ')}.`,
    };
  }

  if (output.schemaVersion !== '1.0.0') {
    return {
      pass: false,
      score: 0,
      reason: `Unexpected schemaVersion ${output.schemaVersion}.`,
    };
  }

  return {
    pass: true,
    score: 1,
    reason: 'Requirements plan matches v1 schema.',
  };
};
