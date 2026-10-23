'use strict';

const fs = require('node:fs');

const [input, output] = process.argv.slice(2);

if (!fs.existsSync(input)) {
	fs.writeFileSync(output, `# Jev Recorded Results Report

Status: incomplete

The recorded-results JSON is missing.

Scores: unavailable. No scores were invented.

This diagnostic does not indicate a completed evaluation.
The existing completion gate remains authoritative.
`, 'utf8');
} else {
	try {
		JSON.parse(fs.readFileSync(input, 'utf8'));
	} catch (error) {
		if (!(error instanceof SyntaxError)) throw error;
		fs.writeFileSync(output, `# Jev Recorded Results Report

Status: incomplete

The recorded-results JSON is malformed.

Scores: unavailable. No scores were invented.

This diagnostic does not indicate a completed evaluation.
The existing completion gate remains authoritative.
`, 'utf8');
	}
}
