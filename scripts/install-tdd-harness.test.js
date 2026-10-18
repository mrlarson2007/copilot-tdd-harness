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
