'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { questionsForPhase } = require('./jev-scorer');

const [input, output] = process.argv.slice(2);
const phaseNames = ['red', 'green', 'commit', 'refactor'];

function writeReport(details, hasScores = false, complete = false) {
	const report = `# Jev Recorded Results Report

Status: ${complete ? 'complete' : 'incomplete'}

${details}

${hasScores ? `Scores are shown as recorded, without invented values.
Raw score (0–2): 0, 1, and 2 correspond to the listed criteria; fractional scores remain raw.
Noul yes probability (0–1): noul is the probability of yes, not a criteria score.
Complete execution does not imply a favorable judgment.` : 'Scores: unavailable. No scores were invented.'}

${complete ? '' : 'This diagnostic does not indicate a completed evaluation.\n'}The existing completion gate remains authoritative.
`;
	fs.mkdirSync(path.dirname(output), { recursive: true });
	fs.writeFileSync(output, report, 'utf8');
	if (process.env.GITHUB_STEP_SUMMARY) {
		fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report, 'utf8');
	}
}

if (!fs.existsSync(input)) {
	writeReport('The recorded-results JSON is missing.');
} else {
	try {
		const recorded = JSON.parse(fs.readFileSync(input, 'utf8'));
		const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
		const display = (value) => {
			const text = typeof value === 'string'
				? value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '')
				: '';
			return text.trim() ? text
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/[\\`*_[\]{}()#+!|~]/g, '\\$&') : 'unavailable';
		};
		let details;
		let hasScores = false;
		let complete = false;
		if (isObject(recorded) && recorded.results === undefined) {
			details = 'The recorded-results wrapper results.results is absent.';
		} else if (!isObject(recorded) || !isObject(recorded.results)) {
			details = 'The recorded-results wrapper results.results is malformed.';
		} else if (recorded.results.results === undefined) {
			details = 'The recorded-results wrapper results.results is absent.';
		} else if (!Array.isArray(recorded.results.results)) {
			details = 'The recorded-results wrapper results.results is malformed.';
		} else if (recorded.results.results.length === 0) {
			details = 'The recorded-results wrapper results.results is empty.';
		} else {
			complete = recorded.results.results.every((entry) =>
				entry?.response?.output?.status === 'complete'
				&& entry?.response?.output?.collectionStatus === 'collected'
				&& phaseNames.every((phase) =>
					entry?.response?.output?.phases?.[phase]?.status === 'scored'));
			details = recorded.results.results.map((entry, index) => {
				if (!isObject(entry) || !isObject(entry.response) || !isObject(entry.response.output)) {
					return `Result ${index + 1}: response.output is absent or malformed; recorded execution unavailable.`;
				}
				const execution = entry.response.output;
				const phases = isObject(execution.phases) ? execution.phases : {};
				return [
					`Revision: ${display(execution.revision)}`,
					'',
					`Fixture: ${display(execution.fixtureId)}`,
					'',
					`Scenario: ${display(execution.scenarioId)}`,
					'',
					`Execution status: ${display(execution.status)}`,
					'',
					`Collection status: ${display(execution.collectionStatus)}`,
					'',
					'| Phase | Status | Raw score (0–2) | Noul yes probability (0–1) |',
					'| --- | --- | --- | --- |',
					...phaseNames.map((phase) =>
						`| ${phase.toUpperCase()} | ${display(phases[phase]?.status)} | unavailable | unavailable |`),
					'',
					...phaseNames.map((phase) => {
						const judgment = isObject(phases[phase]) ? phases[phase] : {};
						const heading = `${phase.toUpperCase()}: status: ${display(judgment.status)}; model: ${display(judgment.response?.model)}`;
						const usefulNumber = (value) => Number.isFinite(value) && value >= 0 ? value : 'unavailable';
						const metrics = `elapsedMs: ${usefulNumber(judgment.elapsedMs)}; input_tokens: ${usefulNumber(judgment.response?.usage?.input_tokens)}; output_tokens: ${usefulNumber(judgment.response?.usage?.output_tokens)}`;
						const answers = isObject(judgment.response?.answers) ? judgment.response.answers : {};
						const supplied = isObject(judgment.request?.questions) ? judgment.request.questions : {};
						if (!Object.keys(answers).length && !Object.keys(supplied).length && execution.status !== 'complete') {
							return `${heading}\n${metrics}\nQuestions: unavailable (answers absent).`;
						}
						const questions = questionsForPhase(phase);
						const ids = [...new Set([...Object.keys(questions), ...Object.keys(supplied), ...Object.keys(answers)])];
						const rows = ids.map((id) => {
							const question = Object.hasOwn(questions, id) ? questions[id] : undefined;
							const answer = Object.hasOwn(answers, id) ? answers[id] : undefined;
							const label = question?.criteria
								? question.criteria.map((text, value) => `${value}: ${display(text)}`).join('; ')
								: question ? 'noul yes' : 'unavailable';
							let diagnostic;
							if (!question) diagnostic = 'unknown question';
							else if (!isObject(answer)) diagnostic = 'answer absent or malformed';
							else if (answer.type !== question.type
								|| (Object.hasOwn(supplied, id) && supplied[id]?.type !== question.type)) {
								diagnostic = 'answer or question type mismatch';
							} else {
								const value = answer[question.type];
								if (!Number.isFinite(value)) diagnostic = 'answer missing or nonfinite';
								else if (value < 0 || value > (question.type === 'score' ? 2 : 1)) diagnostic = 'answer out of range';
							}
							if (diagnostic) {
								return `| ${display(id)} | ${label} | unavailable | unavailable | unavailable | unavailable: ${diagnostic} |`;
							}
							hasScores = true;
							const score = question.type === 'score' ? answer.score : '—';
							const noul = question.type === 'noul' ? answer.noul : '—';
							const confidence = Number.isFinite(answer.confidence) ? answer.confidence : 'unavailable';
							return `| ${display(id)} | ${label} | ${score} | ${noul} | ${confidence} | recorded |`;
						});
						return [
							heading, metrics, '',
							'| Question ID | Criteria labels / kind | Raw score (0–2) | Noul yes probability (0–1) | Confidence | Diagnostic |',
							'| --- | --- | --- | --- | --- | --- |',
							...rows, '',
						].join('\n');
					}).map((details, index) => [
						'<details>',
						`<summary>${phaseNames[index].toUpperCase()} question details</summary>`,
						'', details, '', '</details>', '',
					].join('\n')),
				].join('\n');
			}).join('\n\n');
		}
		writeReport(details, hasScores, complete);
	} catch (error) {
		if (!(error instanceof SyntaxError)) throw error;
		writeReport('The recorded-results JSON is malformed.');
	}
}
