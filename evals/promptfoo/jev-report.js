'use strict';

const fs = require('node:fs');

const [input, output] = process.argv.slice(2);

function writeReport(details) {
	fs.writeFileSync(output, `# Jev Recorded Results Report

Status: incomplete

${details}

Scores: unavailable. No scores were invented.

This diagnostic does not indicate a completed evaluation.
The existing completion gate remains authoritative.
`, 'utf8');
}

if (!fs.existsSync(input)) {
	writeReport('The recorded-results JSON is missing.');
} else {
	try {
		const recorded = JSON.parse(fs.readFileSync(input, 'utf8'));
		const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
		const display = (value) => {
			const text = typeof value === 'string'
				? value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '')
				: '';
			return text.trim() ? text
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/[\\`*_[\]{}()#+!|~]/g, '\\$&') : 'unavailable';
		};
		let details;
		if (isObject(recorded) && recorded.results === undefined) {
			details = 'The recorded-results wrapper results.results is absent.';
		} else if (!isObject(recorded) || !isObject(recorded.results)) {
			details = 'The recorded-results wrapper results.results is malformed.';
		} else if (recorded.results.results === undefined) {
			details = 'The recorded-results wrapper results.results is absent.';
		} else if (!Array.isArray(recorded.results.results)) {
			details = 'The recorded-results wrapper results.results is malformed.';
		} else if (recorded.results.results.length === 0) {
			details = 'The recorded-results wrapper results.results is empty.';
		} else {
			details = recorded.results.results.map((entry, index) => {
				if (!isObject(entry) || !isObject(entry.response) || !isObject(entry.response.output)) {
					return `Result ${index + 1}: response.output is absent or malformed; recorded execution unavailable.`;
				}
				const execution = entry.response.output;
				const phases = isObject(execution.phases) ? execution.phases : {};
				return [
					`Revision: ${display(execution.revision)}`,
					`Fixture: ${display(execution.fixtureId)}`,
					`Scenario: ${display(execution.scenarioId)}`,
					`Execution status: ${display(execution.status)}`,
					`Collection status: ${display(execution.collectionStatus)}`,
					'',
					...['red', 'green', 'commit', 'refactor'].map((phase) => {
						const judgment = isObject(phases[phase]) ? phases[phase] : {};
						return `${phase.toUpperCase()}: status: ${display(judgment.status)}; model: ${display(judgment.response?.model)}`;
					}),
				].join('\n');
			}).join('\n\n');
		}
		writeReport(details);
	} catch (error) {
		if (!(error instanceof SyntaxError)) throw error;
		writeReport('The recorded-results JSON is malformed.');
	}
}
