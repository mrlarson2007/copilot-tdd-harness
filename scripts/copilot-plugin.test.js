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
