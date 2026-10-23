'use strict';

const { readBundle, phases } = require('./jev-evidence');
const { scorePhase } = require('./jev-scorer');

class JevEvidenceProvider {
	constructor(options = {}) {
		this.judge = options.judge || scorePhase;
	}

	id() { return 'jev-recorded-evidence'; }

	async callApi(_prompt, context) {
		const vars = context?.vars || {};
		const filePath = process.env.JEV_EVIDENCE_FILE || vars.evidenceFilePath;
		const expectedRevision = process.env.GITHUB_SHA || vars.reviewedRevision;
		if (!filePath) throw new Error('JEV_EVIDENCE_FILE is required');
		const bundle = readBundle(filePath, expectedRevision);
		const judgments = {};
		for (const phase of phases) {
			const record = bundle.records.find((entry) => entry.phase === phase);
			judgments[phase] = record ? await this.judge({ phase, evidence: record.evidence })
				: { phase, status: 'not-run', response: null };
		}
		const complete = bundle.status === 'collected'
			&& Object.values(judgments).every((judgment) => judgment.status === 'scored');
		return {
			output: {
				fixtureId: bundle.fixtureId, scenarioId: bundle.scenarioId,
				revision: bundle.revision, runMode: 'jev-recorded-evidence',
				status: complete ? 'complete' : 'incomplete',
				collectionStatus: bundle.status, phases: judgments,
			},
			metadata: { evidenceSchemaVersion: bundle.schemaVersion, recordedOnly: true },
		};
	}
}

module.exports = JevEvidenceProvider;
