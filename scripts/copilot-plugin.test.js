'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

function sourceFixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-plugin-source-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'source');
  for (const entry of [
    'plugin.json', '.github/plugin/marketplace.json', '.github/skills',
    'plugin/agents', 'README.md', 'LICENSE',
  ]) {
    const destination = path.join(source, entry);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(path.join(root, entry), destination, { recursive: true });
  }
  return { source, output: path.join(directory, 'package') };
}

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

test('WhenPluginIsBuiltOutsideRepository_ShouldContainOnlyInstallableComponentsAndBundledAssets', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-plugin-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const output = path.join(directory, 'package');
  const result = spawnSync(process.execPath, [
    path.join(root, 'scripts', 'build-copilot-plugin.js'), output,
  ], { cwd: directory, encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fs.readdirSync(output).sort(), [
    '.github', 'LICENSE', 'README.md', 'plugin', 'plugin.json',
  ]);
  assert.deepEqual(fs.readdirSync(path.join(output, '.github')), ['skills']);
  assert.deepEqual(fs.readdirSync(path.join(output, 'plugin')), ['agents']);
  const plugin = JSON.parse(fs.readFileSync(path.join(output, 'plugin.json'), 'utf8'));
  const skillRoot = path.join(output, plugin.skills);
  for (const name of fs.readdirSync(skillRoot)) {
    const skill = fs.readFileSync(path.join(skillRoot, name, 'SKILL.md'), 'utf8');
    for (const match of skill.matchAll(/`(\.\/(?:assets|templates)\/[^`]+)`/g)) {
      assert.ok(fs.existsSync(path.resolve(skillRoot, name, match[1])), match[1]);
    }
  }
  for (const language of ['dotnet', 'java', 'node', 'python']) {
    assert.ok(fs.existsSync(path.join(skillRoot, 'tdd-setup', 'templates', `${language}.tdd-patterns.md`)));
  }
  assert.equal(fs.readFileSync(path.join(output, 'plugin/agents/tdd.agent.md'), 'utf8'),
    fs.readFileSync(path.join(root, 'plugin/agents/tdd.agent.md'), 'utf8'));
});

test('WhenMarketplaceVersionDiffers_ShouldRejectBuildBeforeCreatingOutput', (t) => {
  const { buildPlugin } = require('./build-copilot-plugin');
  const { source, output } = sourceFixture(t);
  const manifestPath = path.join(source, '.github/plugin/marketplace.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.plugins[0].version = '99.0.0';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));

  assert.throws(() => buildPlugin(output, source), /Marketplace and plugin versions must match/);
  assert.equal(fs.existsSync(output), false);
});

test('WhenPluginSourcesAreInvalid_ShouldRejectIncompleteOrEscapingBundles', (t) => {
  const { buildPlugin } = require('./build-copilot-plugin');
  const cases = [
    ['missing skill name', (source) => {
      const file = path.join(source, '.github/skills/tdd-red/SKILL.md');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('name: tdd-red\n', ''));
    }, /Skill name must match/],
    ['missing asset', (source) => {
      fs.unlinkSync(path.join(source, '.github/skills/tdd-red/assets/project-testing-patterns.md'));
    }, /Missing bundled reference/],
    ['linked asset', (source) => {
      const file = path.join(source, '.github/skills/tdd-red/assets/project-testing-patterns.md');
      fs.unlinkSync(file);
      fs.symlinkSync(path.join(root, 'LICENSE'), file);
    }, /Symbolic links are not allowed/],
    ['escaped skill directory', (source) => {
      const file = path.join(source, 'plugin.json');
      const plugin = JSON.parse(fs.readFileSync(file, 'utf8'));
      plugin.skills = '../elsewhere';
      fs.writeFileSync(file, JSON.stringify(plugin));
    }, /Unexpected plugin component paths/],
    ['inconsistent identity', (source) => {
      const file = path.join(source, 'plugin.json');
      const plugin = JSON.parse(fs.readFileSync(file, 'utf8'));
      plugin.name = 'another-plugin';
      fs.writeFileSync(file, JSON.stringify(plugin));
    }, /Marketplace identity and source must match/],
  ];
  for (const [label, mutate, expected] of cases) {
    const { source, output } = sourceFixture(t);
    mutate(source);
    assert.throws(() => buildPlugin(output, source), expected, label);
    assert.equal(fs.existsSync(output), false, label);
  }
});

test('WhenBuildTargetsExistingOrSourceDirectories_ShouldPreserveFilesEvenThroughSymlinkedParents', (t) => {
  const { buildPlugin } = require('./build-copilot-plugin');
  const { source, output } = sourceFixture(t);
  fs.mkdirSync(output);
  const sentinel = path.join(output, 'keep.txt');
  fs.writeFileSync(sentinel, 'user content');
  assert.throws(() => buildPlugin(output, source), /EEXIST/);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'user content');

  const alias = path.join(path.dirname(source), 'alias');
  fs.symlinkSync(source, alias, 'dir');
  for (const destination of [
    path.join(source, '.github', 'unexpected'),
    path.join(alias, 'unexpected'),
  ]) {
    assert.throws(() => buildPlugin(destination, source), /Build outside the source repository/);
    assert.equal(fs.existsSync(destination), false);
  }
});
