'use strict';

module.exports = (output) => {
	const result = typeof output === 'string' ? JSON.parse(output) : output;
	const required = [
		'baselinePasses', 'agentCompleted', 'oneNewTest', 'onlyTestsChanged',
		'noCommits', 'existingTestsPass', 'expectedAssertionFailure',
		'onlyRequestedFailure', 'usefulWithKnownImplementation', 'verificationPreservesWorkspace',
	];
	const failed = required.filter((name) => result?.checks?.[name] !== true);
	const pass = result?.runMode === 'red-only' && result?.pass === true && failed.length === 0;
	return { pass, score: pass ? 1 : 0, reason: pass ? 'Verified RED artifacts in isolation'
		: `RED artifact verification failed: ${failed.join(', ') || 'invalid summary'}` };
};
