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

test('WhenTddIsInvoked_ShouldOfferSetupGatedInlineCanonicalOrchestration', t => {
  const entries = [];
  for (const installer of installers) {
    const target = fixture(t);
    assert.equal(run(installer, target, installer.select('codex')).status, 0);
    const entry = fs.readFileSync(path.join(target, '.agents/skills/tdd/SKILL.md'), 'utf8');
    assert.match(entry, /^---\nname: tdd\ndescription: .+\n---\n/);
    for (const name of ['tdd-workflow', 'tdd-planning', 'tdd-cycle-runner', 'tdd-red',
      'tdd-green', 'tdd-test-run', 'tdd-commit', 'tdd-refactor', 'tdd-setup']) {
      assert.ok(entry.includes(`.github/skills/${name}/SKILL.md`), name);
    }
    for (const phrase of ['Explicit opt-in', '$tdd', 'stop and request $tdd-setup',
      'before any behavior edits', '.github/instructions/tdd-patterns.instructions.md',
      'single agent inline', 'No Copilot task or handoff tools', 'clarification',
      'expected result', 'actual output', 'commit immediately after GREEN',
      '.github/contracts/tdd-cycle-contracts.md', 'No blocking hooks']) {
      assert.ok(entry.includes(phrase), phrase);
    }
    entries.push(entry);
  }
  assert.equal(entries[0], entries[1]);
});

test('WhenCodexDestinationUsesSymlinks_ShouldSkipWithoutFollowingLinks', t => {
  const cases = [
    ['.agents', false], ['.agents/skills/tdd', false],
    ['.agents/skills/tdd/SKILL.md', false], ['.agents/skills/tdd/SKILL.md', true],
    ['.github/skills', false], ['.github/contracts/tdd-cycle-contracts.md', false],
    ['.', true],
  ];
  for (const installer of installers) {
    for (const agent of ['codex', 'both']) {
      for (const [relative, existing] of cases) {
        const scratch = fixture(t);
        const target = path.join(scratch, 'project');
        const outside = path.join(scratch, 'outside');
        const fileLink = relative.endsWith('.md');
        fs.mkdirSync(target);
        if (existing) {
          if (fileLink) fs.writeFileSync(outside, 'untouched');
          else fs.mkdirSync(outside);
        }
        const link = path.join(target, relative);
        if (relative === '.') fs.rmdirSync(target);
        else fs.mkdirSync(path.dirname(link), { recursive: true });
        fs.symlinkSync(outside, link, fileLink ? 'file' : 'dir');
        const result = run(installer, target, installer.select(agent));
        assert.equal(result.status, 0, `${installer.name}: ${relative}: ${result.stderr}`);
        assert.ok(fs.lstatSync(link).isSymbolicLink());
        assert.match(result.stdout, /SKIP:.*merge manually/);
        if (!existing) assert.equal(fs.existsSync(outside), false, relative);
        else if (fileLink) assert.equal(fs.readFileSync(outside, 'utf8'), 'untouched');
        else assert.deepEqual(fs.readdirSync(outside), []);
      }
    }
  }
});
