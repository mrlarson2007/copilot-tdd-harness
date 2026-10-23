'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { setupRedWorkspace } = require('./red-only');
const score = require('../../../promptfoo/assertions/red-only');

test('RED workspace contains authoritative skills and verification assets, not cycle agents', (t) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'red-workspace-test-'));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	setupRedWorkspace(dir);
	for (const skill of ['tdd-red', 'tdd-test-run']) {
		const source = path.resolve(__dirname, '../../../../.github/skills', skill);
		const destination = path.join(dir, '.github', 'skills', skill);
		assert.deepEqual(fs.readdirSync(destination, { recursive: true }).sort(),
			fs.readdirSync(source, { recursive: true }).sort());
		for (const file of fs.readdirSync(source, { recursive: true })) {
			if (fs.statSync(path.join(source, file)).isFile()) {
				assert.deepEqual(fs.readFileSync(path.join(source, file)), fs.readFileSync(path.join(destination, file)));
			}
		}
	}
	assert.equal(fs.existsSync(path.join(dir, '.github', 'agents')), false);
	assert.equal(fs.existsSync(path.join(dir, '.github', 'skills', 'tdd-green')), false);
	assert.equal(fs.existsSync(path.join(dir, '.github', 'contracts', 'tdd-cycle-contracts.md')), true);
});

test('RED assertion rejects a claimed pass without independent check results', () => {
	assert.equal(score({ runMode: 'red-only', pass: true, red_result: 'ok' }).pass, false);
});
