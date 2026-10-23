'use strict';

const fs = require('node:fs');
const path = require('node:path');

const phaseNames = ['red', 'green', 'commit', 'refactor'];
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
	'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

function metadata(env) {
	const repository = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(env.GITHUB_REPOSITORY || '')
		? env.GITHUB_REPOSITORY : 'unavailable';
	const run = /^\d+$/.test(env.GITHUB_RUN_ID || '') ? env.GITHUB_RUN_ID : 'unavailable';
	const attempt = /^\d+$/.test(env.GITHUB_RUN_ATTEMPT || '') ? env.GITHUB_RUN_ATTEMPT : 'unavailable';
	// EVAL_TIMESTAMP optionally supplies an ISO timestamp for reproducible builds.
	const date = env.EVAL_TIMESTAMP === undefined ? new Date() : new Date(env.EVAL_TIMESTAMP);
	const timestamp = Number.isFinite(date.getTime()) ? date.toISOString() : 'unavailable';
	const server = env.GITHUB_SERVER_URL === 'https://github.com' || env.GITHUB_SERVER_URL === 'https://github.com/'
		? 'https://github.com' : null;
	const base = server && repository !== 'unavailable' ? `${server}/${repository}` : null;
	const links = [
		base ? `<a href="${escapeHtml(`${base}/commit/${env.GITHUB_SHA}`)}">Source commit</a>` : 'Source commit unavailable',
		base && run !== 'unavailable' && attempt !== 'unavailable'
			? `<a href="${escapeHtml(`${base}/actions/runs/${run}/attempts/${attempt}`)}">Source run</a>`
			: 'Source run unavailable',
	].join(' · ');
	return `<section aria-label="Run metadata"><h2>Run metadata</h2>
<p>Repository: ${escapeHtml(repository)} · Revision: ${escapeHtml(env.GITHUB_SHA)}</p>
<p>Run: ${escapeHtml(run)} · Attempt: ${escapeHtml(attempt)} · Timestamp: ${escapeHtml(timestamp)}</p>
<p>${links}</p></section>`;
}

function page(title, runMetadata, content) {
	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title></head><body>
<nav><a href="index.html">Overview</a> · <a href="jev.html">Jev scorecard</a> · <a href="promptfoo.html">Promptfoo results</a></nav>
<h1>${escapeHtml(title)}</h1>${runMetadata}${content}</body></html>\n`;
}

function generatePages(input, output, env = process.env) {
	const recorded = JSON.parse(fs.readFileSync(input, 'utf8'));
	const rows = recorded?.results?.results;
	if (!/^[a-f\d]{40}$/i.test(env.GITHUB_SHA || '') || !Array.isArray(rows) || rows.length === 0
		|| !rows.every((row) => {
			const execution = row?.response?.output;
			return isObject(execution) && execution.status === 'complete'
				&& execution.collectionStatus === 'collected' && execution.revision === env.GITHUB_SHA
				&& phaseNames.every((phase) => execution.phases?.[phase]?.status === 'scored');
		})) throw new Error('Invalid evaluation');
	const runMetadata = metadata(env);
	const summary = `<p>Status: complete</p><p>Complete executions: ${rows.length} · Incomplete executions: 0</p>`;
	const pages = {
		'index.html': page('Recorded evaluation overview', runMetadata, summary),
		'jev.html': page('Recorded Jev scorecard', runMetadata, summary),
		'promptfoo.html': page('Promptfoo execution results', runMetadata, summary),
	};
	fs.mkdirSync(output, { recursive: true });
	for (const [name, html] of Object.entries(pages)) fs.writeFileSync(path.join(output, name), html, 'utf8');
}

if (require.main === module) {
	try {
		if (process.argv.length !== 4) throw new Error('Invalid arguments');
		generatePages(process.argv[2], process.argv[3]);
	} catch {
		process.stderr.write('Evaluation is incomplete or invalid; no pages were generated.\n');
		process.exitCode = 1;
	}
}

module.exports = { generatePages };
