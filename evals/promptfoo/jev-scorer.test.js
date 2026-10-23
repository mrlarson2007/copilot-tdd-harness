'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
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

test('every phase has explicit typed criteria without a synthetic overall pass threshold', () => {
	for (const phase of ['red', 'green', 'commit', 'refactor']) {
		const questions = questionsForPhase(phase);
		assert.ok(Object.keys(questions).length >= 3);
		for (const question of Object.values(questions)) {
			assert.match(question.instructions, /evidence/);
			assert.ok(['score', 'noul'].includes(question.type));
			if (question.type === 'score') assert.equal(question.criteria.length, 3);
		}
	}
	assert.throws(() => questionsForPhase('unknown'), /Unsupported TDD phase/);
});

test('a Jev service failure is unscored and cannot become a passing evaluation', async () => {
	const result = await scorePhase({ phase: 'green', evidence }, {
		client: { systemOne: async () => { throw Object.assign(new Error('not persisted'), { status: 503 }); } },
	});
	assert.equal(result.status, 'unavailable');
	assert.equal(result.response, null);
	assert.equal(result.error.status, 503);
	assert.equal(JSON.stringify(result).includes('not persisted'), false);
});

test('missing and out-of-range answers are retained as invalid rather than scored', async () => {
	for (const response of [
		{ model: 'fake-jev', answers: {} },
		{ model: 'fake-jev', answers: {
			atomic_commit: { type: 'noul', noul: 9 },
			message_quality: { type: 'score', score: 1 },
			no_scope_creep: { type: 'noul', noul: 0.9 },
		} },
	]) {
		const result = await scorePhase({ phase: 'commit', evidence }, {
			client: { systemOne: async () => response },
		});
		assert.equal(result.status, 'invalid-response');
		assert.deepEqual(result.response, response);
	}
});

test('the installed TypeSafe SDK accepts every phase rubric through a mocked HTTP transport', async () => {
	const toolingRequire = createRequire(path.resolve(__dirname, '../../.promptfoo-tooling/package.json'));
	const { TypeSafeClient } = toolingRequire('@typesafe-ai/sdk');
	const requests = [];
	const client = new TypeSafeClient({
		apiKey: 'synthetic-test-key',
		compression: false,
		logLevel: 'off',
		retry: { maxRetries: 0 },
		fetch: async (url, init) => {
			const body = JSON.parse(init.body);
			requests.push({ url, body });
			return new Response(JSON.stringify({
				model: 'synthetic-jev',
				answers: Object.fromEntries(Object.entries(body.questions).map(([id, question]) => [
					id, question.type === 'noul' ? { type: 'noul', noul: 0.9 }
						: { type: 'score', score: 1.5, confidence: 0.8, probabilities: { 0: 0, 1: 0.5, 2: 0.5 } },
				])),
				usage: { input_tokens: 100, output_tokens: 20 },
			}), { headers: { 'content-type': 'application/json' } });
		},
	});
	for (const phase of ['red', 'green', 'commit', 'refactor']) {
		const result = await scorePhase({ phase, evidence }, { client });
		assert.equal(result.status, 'scored');
		assert.equal(result.response.model, 'synthetic-jev');
	}
	assert.equal(requests.length, 4);
	assert.ok(requests.every(({ url }) => url.endsWith('/v1/systemone')));
});
