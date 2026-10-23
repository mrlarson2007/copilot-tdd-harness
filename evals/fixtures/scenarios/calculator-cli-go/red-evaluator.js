'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { isDeepStrictEqual } = require('util');
const { addSubtractImplementation } = require('./scenario-helpers');

function command(dir, executable, args) {
	const result = spawnSync(executable, args, {
		cwd: dir,
		encoding: 'utf8',
		timeout: 90_000,
		maxBuffer: 8 * 1024 * 1024,
		env: { ...process.env, GOWORK: 'off', GOFLAGS: '' },
	});
	return {
		command: [executable, ...args],
		exitCode: result.status,
		signal: result.signal,
		error: result.error?.message || null,
		output: `${result.stdout || ''}${result.stderr || ''}`,
	};
}

function succeeded(result) {
	return result.exitCode === 0 && !result.error && !result.signal;
}

function snapshot(dir, relative = '') {
	const files = {};
	for (const entry of fs.readdirSync(path.join(dir, relative))) {
		if (!relative && entry === '.git') continue;
		const name = relative ? `${relative}/${entry}` : entry;
		const full = path.join(dir, name);
		const stat = fs.lstatSync(full);
		if (stat.isDirectory()) {
			Object.assign(files, snapshot(dir, name));
		} else {
			files[name] = {
				mode: stat.mode,
				type: stat.isSymbolicLink() ? 'symlink' : 'file',
				content: stat.isSymbolicLink() ? fs.readlinkSync(full) : fs.readFileSync(full).toString('base64'),
			};
		}
	}
	return files;
}

function gitEvidence(dir) {
	const git = (...args) => command(dir, 'git', args);
	return {
		head: git('rev-parse', 'HEAD'),
		status: git('status', '--porcelain=v1', '--untracked-files=all'),
		diff: git('diff', '--no-ext-diff', '--no-textconv', 'HEAD', '--'),
		staged: git('diff', '--cached', '--no-ext-diff', '--no-textconv'),
		reflog: git('reflog', 'show', '--all', '--format=%H %gs'),
		refs: git('show-ref'),
		objects: git('cat-file', '--batch-all-objects', '--batch-check=%(objectname) %(objecttype)'),
		config: git('config', '--local', '--list'),
		rawLogs: snapshot(path.join(dir, '.git', 'logs')),
	};
}

function goTests(dir, pattern) {
	return command(dir, 'go', [
		'test', '-json', '-count=1', '-timeout=30s',
		...(pattern ? ['-run', pattern] : []), './...',
	]);
}

function events(result) {
	return result.output.split('\n').flatMap((line) => {
		try { return [JSON.parse(line)]; } catch { return []; }
	});
}

function names(result, action) {
	return events(result).filter((event) => event.Action === action && event.Test).map((event) => event.Test).sort();
}

function pattern(namesToRun) {
	return `^(${namesToRun.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`;
}

function listedTests(result) {
	return result.output.split('\n').filter((line) => /^Test\S+$/.test(line)).sort();
}

function listTests(dir) {
	return command(dir, 'go', ['test', '-list', '^Test', './...']);
}

async function evaluateRed(dir, runAgent) {
	const checks = {};
	const evidence = {
		baseline: {
			files: snapshot(dir),
			git: gitEvidence(dir),
			list: listTests(dir),
			suite: goTests(dir),
			environment: { GOWORK: 'off', GOFLAGS: '', go: command(dir, 'go', ['version']) },
		},
	};
	const baseline = evidence.baseline;
	const existing = listedTests(baseline.list);
	checks.baselinePasses = succeeded(baseline.list) && succeeded(baseline.suite)
		&& existing.length > 0 && isDeepStrictEqual(names(baseline.suite, 'pass'), existing);
	if (!checks.baselinePasses) return { pass: false, checks, evidence, agent: null };

	let agent;
	try {
		agent = await runAgent();
	} catch (error) {
		agent = { ok: false, output: String(error), exitCode: null };
	}
	checks.agentCompleted = agent?.ok === true && agent.exitCode === 0;
	const red = evidence.red = {
		files: snapshot(dir),
		git: gitEvidence(dir),
		list: listTests(dir),
	};
	const additions = listedTests(red.list).filter((name) => !existing.includes(name));
	checks.oneNewTest = succeeded(red.list) && additions.length === 1
		&& existing.every((name) => listedTests(red.list).includes(name));
	const changed = Object.keys({ ...baseline.files, ...red.files })
		.filter((name) => !isDeepStrictEqual(baseline.files[name], red.files[name]));
	red.changedFiles = changed;
	red.newTests = additions;
	checks.onlyTestsChanged = changed.length > 0 && changed.every((name) => {
		const before = baseline.files[name];
		const after = red.files[name];
		if (!/^[^/]+_test\.go$/.test(name) || !after || after.type !== 'file') return false;
		if (!before) return true;
		// Keep every byte of existing tests, including imports and assertions.
		return before.type === 'file' && before.mode === after.mode
			&& Buffer.from(after.content, 'base64').subarray(0, Buffer.from(before.content, 'base64').length)
				.equals(Buffer.from(before.content, 'base64'));
	});
	checks.noCommits = ['head', 'reflog', 'refs', 'objects', 'config'].every((key) =>
		succeeded(baseline.git[key]) && succeeded(red.git[key])
		&& (key === 'objects'
			? baseline.git[key].output.split('\n').filter((line) => line.endsWith(' commit')).sort().join('\n')
				=== red.git[key].output.split('\n').filter((line) => line.endsWith(' commit')).sort().join('\n')
			: baseline.git[key].output === red.git[key].output))
		&& isDeepStrictEqual(baseline.git.rawLogs, red.git.rawLogs);
	red.existing = goTests(dir, pattern(existing));
	checks.existingTestsPass = succeeded(red.existing)
		&& isDeepStrictEqual(names(red.existing, 'pass'), existing)
		&& names(red.existing, 'skip').length === 0;
	if (!checks.oneNewTest) return { pass: false, checks, evidence, agent };

	red.selected = goTests(dir, pattern(additions));
	red.suite = goTests(dir);
	const selectedOutput = events(red.selected).filter((event) => event.Test === additions[0]
		&& event.Action === 'output').map((event) => event.Output || '').join('');
	checks.expectedAssertionFailure = red.selected.exitCode === 1 && !red.selected.error
		&& !red.selected.signal && isDeepStrictEqual(names(red.selected, 'fail'), additions)
		&& names(red.selected, 'skip').length === 0
		&& /_test\.go:\d+:/.test(selectedOutput)
		&& /unknown command: subtract/.test(selectedOutput)
		&& !/panic:|test timed out|DATA RACE/.test(red.selected.output);
	checks.onlyRequestedFailure = red.suite.exitCode === 1 && !red.suite.error && !red.suite.signal
		&& isDeepStrictEqual(names(red.suite, 'fail'), additions)
		&& isDeepStrictEqual(names(red.suite, 'pass'), existing)
		&& isDeepStrictEqual(names(red.suite, 'run'), [...existing, ...additions].sort());

	// Capture RED evidence above before the evaluator (not the agent) applies GREEN.
	if (checks.onlyTestsChanged && checks.noCommits) {
		const mainPath = path.join(dir, 'main.go');
		const original = fs.readFileSync(mainPath);
		try {
			addSubtractImplementation(dir);
			evidence.knownImplementation = {
				production: fs.readFileSync(mainPath, 'utf8'),
				selected: goTests(dir, pattern(additions)),
				suite: goTests(dir),
				files: snapshot(dir),
			};
			const known = evidence.knownImplementation;
			checks.usefulWithKnownImplementation = succeeded(known.selected) && succeeded(known.suite)
				&& isDeepStrictEqual(names(known.selected, 'pass'), additions)
				&& isDeepStrictEqual(names(known.suite, 'pass'), [...existing, ...additions].sort())
				&& Object.keys(red.files).filter((name) => name.endsWith('_test.go'))
					.every((name) => isDeepStrictEqual(red.files[name], known.files[name]));
		} finally {
			fs.writeFileSync(mainPath, original);
		}
	} else {
		checks.usefulWithKnownImplementation = false;
	}
	return { pass: Object.values(checks).every(Boolean), checks, evidence, agent };
}

module.exports = { evaluateRed };
