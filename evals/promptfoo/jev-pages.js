'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { questionsForPhase } = require('./jev-scorer');

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

function number(value, maximum = Number.MAX_VALUE) {
	return Number.isFinite(value) && value >= 0 && value <= maximum ? value : 'unavailable';
}

function projectExecution(execution) {
	return {
		status: 'complete', collectionStatus: 'collected',
		fixture: execution.fixtureId === 'calculator-cli-go' ? 'calculator-cli-go' : 'unavailable',
		scenario: execution.scenarioId === 'jev-phase-subtract' ? 'jev-phase-subtract' : 'unavailable',
		phases: phaseNames.map((phase) => {
			const judgment = execution.phases[phase];
			return {
				phase, status: 'scored', elapsed: number(judgment.elapsedMs),
				inputTokens: number(judgment.response?.usage?.input_tokens),
				outputTokens: number(judgment.response?.usage?.output_tokens),
				questions: Object.entries(questionsForPhase(phase)).map(([id, question]) => {
					const answer = judgment.response?.answers?.[id];
					const validType = answer?.type === question.type;
					return {
						id, instructions: question.instructions, criteria: question.criteria,
						score: question.type === 'score' && validType ? number(answer.score, question.criteria.length - 1) : 'unavailable',
						noul: question.type === 'noul' && validType ? number(answer.noul, 1) : 'unavailable',
						confidence: validType ? number(answer.confidence, 1) : 'unavailable',
					};
				}),
			};
		}),
	};
}

function executionDetails(execution, index) {
	const details = execution.phases.map((judgment) => {
		const questions = judgment.questions.map((question) => {
			const criteria = (question.criteria || []).map((criterion, value) =>
				`<li>${value}: ${escapeHtml(criterion)}</li>`).join('');
			return `<tr><th scope="row">${escapeHtml(question.id)}</th>
<td>${escapeHtml(question.instructions)}${criteria ? `<ol start="0">${criteria}</ol>` : '<p>Noul yes probability</p>'}</td>
<td>${escapeHtml(question.score)}</td><td>${escapeHtml(question.noul)}</td><td>${escapeHtml(question.confidence)}</td></tr>`;
		}).join('');
		return `<details><summary>${escapeHtml(judgment.phase.toUpperCase())}: scored</summary>
<p>Elapsed (ms): ${escapeHtml(judgment.elapsed)} · Input tokens: ${escapeHtml(judgment.inputTokens)} · Output tokens: ${escapeHtml(judgment.outputTokens)}</p>
<table><caption>Recorded ${escapeHtml(judgment.phase.toUpperCase())} judgments</caption>
<thead><tr><th scope="col">Question ID</th><th scope="col">Canonical question and criteria</th>
<th scope="col">Raw score (0–2)</th><th scope="col">Noul yes probability (0–1)</th><th scope="col">Confidence (0–1)</th></tr></thead>
<tbody>${questions}</tbody></table></details>`;
	}).join('');
	return `<article><h2>Execution ${index + 1}</h2>
<p>Execution status: ${escapeHtml(execution.status)} · Collection status: ${escapeHtml(execution.collectionStatus)}</p>
<p>Fixture: ${escapeHtml(execution.fixture)} · Scenario: ${escapeHtml(execution.scenario)}</p>${details}</article>`;
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
	const executions = rows.map((row) => projectExecution(row.response.output));
	const runMetadata = metadata(env);
	const complete = executions.filter((execution) => execution.status === 'complete').length;
	const summary = `<p>Status: complete</p><p>Complete executions: ${complete} · Incomplete executions: ${executions.length - complete}</p>`;
	const explanation = '<p>Scores are recorded values, not pass/fail verdicts. Fractional scores remain raw; noul is the probability of yes, not a criteria score. Unavailable values are never invented.</p>'
		+ '<p>Complete execution does not imply compliance or a favorable judgment. Assertion-free execution is not a compliance check.</p>';
	const details = executions.map(executionDetails).join('');
	const pages = {
		'index.html': page('Recorded evaluation overview', runMetadata, summary),
		'jev.html': page('Recorded Jev scorecard', runMetadata, summary + explanation + details),
		'promptfoo.html': page('Promptfoo execution results', runMetadata, summary + explanation + details),
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
