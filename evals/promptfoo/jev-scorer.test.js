'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { scorePhase } = require('./jev-scorer');

test('missing phase evidence is recorded as unscored without calling Jev', async () => {
	let calls = 0;
	const result = await scorePhase({ phase: 'red', evidence: null }, {
		client: { systemOne: async () => { calls++; } },
	});
	assert.equal(result.status, 'missing-evidence');
	assert.equal(calls, 0);
	assert.equal(result.response, null);
});
