'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { scorePhase, questionsForPhase } = require('./jev-scorer');

test('missing phase evidence is recorded as unscored without calling Jev', async () => {
	let calls = 0;
	const result = await scorePhase({ phase: 'red', evidence: null }, {
		client: { systemOne: async () => { calls++; } },
	});
	assert.equal(result.status, 'missing-evidence');
	assert.equal(calls, 0);
	assert.equal(result.response, null);
});

const evidence = {
		fixtureId: 'calculator-cli-go',
		scenario: 'subtract 9 4 prints 5',
		before: { tests: { 'main_test.go': 'existing test' } },
		after: { tests: { 'main_test.go': 'existing test plus subtract test' } },
		testResults: [{ command: ['go', 'test'], exitCode: 1, output: 'assertion failure' }],
		phaseResult: { contract: 'red_result', status: 'ok' },
		diff: 'test-only diff',
};

test('batches independent RED questions and preserves the complete typed Jev response', async () => {
		const response = {
			model: 'jev-latest',
			answers: {
				focused_test: { type: 'score', score: 1.8, confidence: 0.9, probabilities: { 0: 0, 1: 0.2, 2: 0.8 } },
				meaningful_failure: { type: 'noul', noul: 0.95 },
				scope_preserved: { type: 'noul', noul: 0.99 },
				no_commit: { type: 'noul', noul: 0.99 },
			},
			usage: { input_tokens: 123, output_tokens: 12 },
		};
		const requests = [];
		const result = await scorePhase({ phase: 'red', evidence }, {
			client: { systemOne: async (request) => { requests.push(request); return response; } },
		});
		assert.equal(requests.length, 1);
		assert.deepEqual(requests[0].state, evidence);
		assert.deepEqual(Object.keys(requests[0].questions), Object.keys(response.answers));
		assert.equal(result.status, 'scored');
		assert.deepEqual(result.response, response);
		assert.deepEqual(result.request, requests[0]);
		assert.equal('pass' in result, false);
		assert.equal('score' in result, false);
});
