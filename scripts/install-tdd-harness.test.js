const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const installers = [
  { name: 'bash', command: 'bash', args: [path.join(__dirname, 'install-tdd-harness.sh')],
    select: agent => ['--agent', agent] },
  { name: 'pwsh', command: 'pwsh', args: ['-NoProfile', '-File', path.join(__dirname, 'install-tdd-harness.ps1')],
    select: agent => ['-Agent', agent] },
];

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(root, '.installer-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function run(installer, target, args = []) {
  return spawnSync(installer.command, [...installer.args, target, ...args], {
    cwd: root, encoding: 'utf8',
  });
}

test('WhenAgentArgumentsAreInvalid_ShouldRejectBeforeWriting', t => {
  for (const installer of installers) {
    for (const args of [installer.select('other'), installer.select('').slice(0, 1), ['--unknown']]) {
      const target = fixture(t);
      const result = run(installer, target, args);
      assert.notEqual(result.status, 0, `${installer.name}: ${args}`);
      assert.deepEqual(fs.readdirSync(target), [], `${installer.name}: no writes`);
    }
  }
});

test('WhenCodexIsSelected_ShouldInstallOnlyCanonicalTddResources', t => {
  for (const installer of installers) {
    const target = fixture(t);
    const result = run(installer, target, installer.select('codex'));
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(fs.readdirSync(path.join(target, '.github')).sort(), ['contracts', 'skills']);
    for (const folder of ['skills', 'contracts']) {
      for (const relative of fs.readdirSync(path.join(root, '.github', folder), { recursive: true })) {
        const source = path.join(root, '.github', folder, relative);
        if (fs.statSync(source).isFile()) {
          assert.deepEqual(fs.readFileSync(path.join(target, '.github', folder, relative)),
            fs.readFileSync(source), `${installer.name}: ${relative}`);
        }
      }
    }
    assert.equal(fs.existsSync(path.join(target, '.github/instructions/tdd-patterns.instructions.md')), false);
  }
});

test('WhenCodexIsSelected_ShouldExposeThinNamedWrappersForEveryCanonicalSkill', t => {
  const wrappers = [];
  for (const installer of installers) {
    const target = fixture(t);
    const result = run(installer, target, installer.select('codex'));
    assert.equal(result.status, 0, result.stderr);
    const content = {};
    for (const name of fs.readdirSync(path.join(root, '.github/skills'))) {
      const wrapper = fs.readFileSync(path.join(target, '.agents/skills', name, 'SKILL.md'), 'utf8');
      assert.match(wrapper, new RegExp(`^---\\nname: ${name}\\ndescription: .+\\n---\\n`));
      assert.ok(wrapper.includes(`.github/skills/${name}/SKILL.md`));
      assert.match(wrapper, /repository root/);
      assert.ok(wrapper.length < 700, 'wrapper should load policy, not duplicate it');
      content[name] = wrapper;
    }
    wrappers.push(content);
  }
  assert.deepEqual(wrappers[0], wrappers[1], 'both installers generate identical wrappers');
});
