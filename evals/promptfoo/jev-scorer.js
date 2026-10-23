'use strict';

async function scorePhase({ phase, evidence }) {
	if (!evidence) return { phase, status: 'missing-evidence', response: null };
}

module.exports = { scorePhase };
