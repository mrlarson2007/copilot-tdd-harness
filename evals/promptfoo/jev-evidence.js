'use strict';

const fs = require('fs');
const path = require('path');

const MAX_BYTES = 5 * 1024 * 1024;
const phases = ['red', 'green', 'commit', 'refactor'];

function validateBundle(bundle, expectedRevision) {
	if (!bundle || bundle.schemaVersion !== 1 || bundle.fixtureId !== 'calculator-cli-go'
		|| bundle.scenarioId !== 'jev-phase-subtract') throw new Error('Invalid public fixture evidence bundle');
	if (!/^[a-f0-9]{40}$/.test(bundle.revision)
		|| (expectedRevision && bundle.revision !== expectedRevision)) throw new Error('Evidence revision does not match reviewed revision');
	if (!Array.isArray(bundle.records) || bundle.records.length > phases.length
		|| !['collecting', 'collected', 'agent-failed', 'phase-failed', 'baseline-failed', 'collection-failed'].includes(bundle.status)) {
		throw new Error('Invalid collection status or phase records');
	}
	if (bundle.status === 'collected' && bundle.records.length !== phases.length) throw new Error('Incomplete collected evidence');
	for (const [index, record] of bundle.records.entries()) {
		if (record?.phase !== phases[index] || record.evidence?.phase !== record.phase
			|| record.evidence.fixtureId !== bundle.fixtureId || typeof record.evidence.scenario !== 'string'
			|| !record.evidence.before || !record.evidence.after
			|| !Array.isArray(record.evidence.testResults) || record.evidence.testResults.length === 0) {
			throw new Error('Invalid phase evidence');
		}
	}
	return bundle;
}

function redact(text, secrets) {
	for (const secret of secrets.filter((value) => typeof value === 'string' && value.length >= 8)) {
		for (const representation of [
			JSON.stringify(secret).slice(1, -1), Buffer.from(secret).toString('base64'), encodeURIComponent(secret),
		]) text = text.split(representation).join('[REDACTED]');
	}
	return text;
}

function writeBundle(filePath, bundle, secrets = []) {
	validateBundle(bundle);
	const content = redact(JSON.stringify(bundle), secrets);
	if (Buffer.byteLength(content) > MAX_BYTES) throw new Error('Evidence exceeds 5 MiB limit');
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	const temporary = `${filePath}.tmp`;
	fs.writeFileSync(temporary, `${content}\n`, { mode: 0o600, flag: 'w' });
	fs.chmodSync(temporary, 0o600);
	fs.renameSync(temporary, filePath);
}

function readBundle(filePath, expectedRevision) {
	const stat = fs.lstatSync(filePath);
	if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error('Evidence must be a regular JSON file no larger than 5 MiB');
	// No import/require, shell interpolation, or execution of downloaded content.
	return validateBundle(JSON.parse(fs.readFileSync(filePath, 'utf8')), expectedRevision);
}

module.exports = { writeBundle, readBundle, phases, MAX_BYTES };
