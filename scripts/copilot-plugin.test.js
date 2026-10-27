'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

test('WhenMarketplaceIsRegistered_ShouldDiscoverOneCompleteVersionedTddPlugin', () => {
  const marketplace = readJson('.github/plugin/marketplace.json');
  const plugin = readJson('plugin.json');

  assert.equal(marketplace.name, 'copilot-tdd-harness');
  assert.equal(marketplace.plugins.length, 1);
  const entry = marketplace.plugins[0];
  assert.equal(entry.source, './');
  assert.equal(entry.name, plugin.name);
  assert.equal(entry.version, plugin.version);
  assert.match(plugin.version, /^\d+\.\d+\.\d+$/);
  assert.equal(plugin.license, 'MIT');
  assert.equal(plugin.skills, '.github/skills/');
  assert.equal(plugin.agents, 'plugin/agents/');
  assert.equal(plugin.hooks, undefined);
  assert.equal(plugin.mcpServers, undefined);
  assert.ok(fs.existsSync(path.join(root, plugin.agents, 'tdd.agent.md')));

  const skills = fs.readdirSync(path.join(root, plugin.skills));
  assert.deepEqual(skills.sort(), [
    'requirements-planning', 'tdd-commit', 'tdd-cycle-runner', 'tdd-green',
    'tdd-planning', 'tdd-red', 'tdd-refactor', 'tdd-setup', 'tdd-test-run', 'tdd-workflow',
  ]);
  for (const name of skills) {
    const skill = fs.readFileSync(path.join(root, plugin.skills, name, 'SKILL.md'), 'utf8');
    assert.match(skill, new RegExp(`^---\\r?\\nname: ${name}\\r?\\n`), name);
    assert.match(skill, /\ndescription: [>|]?\n? +\S/, name);
  }
});

test('WhenSkillsAreCachedOutsideProject_ShouldKeepBundledAssetsReadOnlyAndProjectPatternsLocal', () => {
  const skills = path.join(root, '.github', 'skills');
  const setup = fs.readFileSync(path.join(skills, 'tdd-setup', 'SKILL.md'), 'utf8');
  assert.ok(setup.includes('`./templates/`'), 'templates must be skill-relative');
  assert.ok(setup.includes('Treat the installed skill directory as read-only.'));
  assert.ok(setup.includes('Never overwrite an existing project file without explicit confirmation.'));
  for (const [phase, asset] of [
    ['red', 'project-testing-patterns.md'],
    ['green', 'project-code-style-patterns.md'],
    ['refactor', 'project-refactor-patterns.md'],
    ['test-run', 'project-test-run-patterns.md'],
  ]) {
    const skill = fs.readFileSync(path.join(skills, `tdd-${phase}`, 'SKILL.md'), 'utf8');
    const projectPath = `.github/tdd-harness/${asset}`;
    assert.ok(setup.includes(projectPath), `setup must generate ${projectPath}`);
    assert.ok(skill.includes(projectPath), `phase must read ${projectPath}`);
    assert.ok(skill.includes(`\`./assets/${asset}\``), `missing relative fallback for ${phase}`);
    assert.ok(fs.existsSync(path.join(skills, `tdd-${phase}`, 'assets', asset)));
    assert.ok(skill.includes('relative to this SKILL.md'));
    assert.ok(skill.includes('Never write to the bundled fallback.'));
  }
  const workflow = fs.readFileSync(path.join(skills, 'tdd-workflow', 'SKILL.md'), 'utf8');
  assert.ok(workflow.includes('Only activate when the user explicitly requests TDD'));
  const cycle = fs.readFileSync(path.join(skills, 'tdd-cycle-runner', 'SKILL.md'), 'utf8');
  assert.ok(cycle.includes('No phase agents are required.'));
  assert.ok(!cycle.includes('related_agents:'));
});
