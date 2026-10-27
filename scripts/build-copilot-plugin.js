#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
const MANIFEST_FIELDS = ['$schema', 'name', 'version', 'description', 'author',
  'homepage', 'repository', 'license', 'keywords', 'extensions'];
const AGENT = 'com.github.copilot/agents/tdd.agent.md';

function files(directory, prefix = '') {
  const stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink()) throw new Error(`Symbolic links are not allowed: ${directory}`);
  if (stat.isFile()) return [prefix];
  if (!stat.isDirectory()) throw new Error(`Not a regular package file: ${directory}`);
  return fs.readdirSync(directory).sort().flatMap((entry) =>
    files(path.join(directory, entry), prefix ? `${prefix}/${entry}` : entry));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function validateManifest(plugin) {
  if (plugin.$schema !== SCHEMA || Object.keys(plugin).some((key) => !MANIFEST_FIELDS.includes(key))) {
    throw new Error('Expected only Agent Plugins 1.0 manifest fields and canonical schema');
  }
  if (typeof plugin.name !== 'string' || plugin.name.length > 64 ||
      !/^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(plugin.name)) {
    throw new Error('Invalid plugin name');
  }
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(plugin.version)) {
    throw new Error('Plugin version must be MAJOR.MINOR.PATCH without leading zeroes');
  }
  for (const key of ['description', 'homepage', 'repository', 'license']) {
    if (typeof plugin[key] !== 'string' || !plugin[key].trim()) throw new Error(`Invalid ${key}`);
  }
  if (!plugin.author || typeof plugin.author.name !== 'string' ||
      Object.entries(plugin.author).some(([key, value]) =>
        !['name', 'url', 'email'].includes(key) || typeof value !== 'string')) {
    throw new Error('Invalid plugin author');
  }
  if (!Array.isArray(plugin.keywords) || plugin.keywords.some((key) => typeof key !== 'string')) {
    throw new Error('Invalid plugin keywords');
  }
  if (!isDeepStrictEqual(plugin.extensions, {})) {
    throw new Error('This plugin uses conventional skills/ and com.github.copilot/ discovery, without extensions');
  }
}

function packageSkill(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n[\s\S]*)$/);
  if (!match) throw new Error('Skill must have YAML frontmatter');
  const fields = match[1].match(/^[a-z][a-z-]*:[^\n]*(?:\n(?![a-z][a-z-]*:)[^\n]*)*/gm) || [];
  const standard = [];
  const metadata = [];
  for (const field of fields) {
    const key = field.slice(0, field.indexOf(':'));
    if (['name', 'description', 'license', 'compatibility', 'allowed-tools', 'metadata'].includes(key)) {
      standard.push(field);
    } else {
      metadata.push(`  ${key}: ${JSON.stringify(field.slice(key.length + 1).trim())}`);
    }
  }
  if (metadata.length) {
    const existing = standard.findIndex((field) => field.startsWith('metadata:'));
    if (existing >= 0) standard[existing] += `\n${metadata.join('\n')}`;
    else standard.push(`metadata:\n${metadata.join('\n')}`);
  }
  return `---\n${standard.join('\n')}\n---${match[2]}`;
}

function validateSkills(skillRoot) {
  const allFiles = files(skillRoot);
  const names = fs.readdirSync(skillRoot);
  if (names.length !== 10) throw new Error('Expected ten harness skills');
  for (const name of names) {
    const skill = fs.readFileSync(path.join(skillRoot, name, 'SKILL.md'), 'utf8');
    if (skill.match(/^---\r?\nname: ([a-z0-9-]+)\r?\n/)?.[1] !== name) {
      throw new Error(`Skill name must match its directory: ${name}`);
    }
  }
  for (const file of allFiles.filter((entry) => entry.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(skillRoot, file), 'utf8');
    const references = [
      ...Array.from(text.matchAll(/`((?:\.\/(?:assets|templates)\/|\.\.\/)[^`]+)`/g), (match) => match[1]),
      ...Array.from(text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g), (match) => match[1]),
    ];
    for (const reference of references) {
      if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(reference) || /[<>]/.test(reference)) continue;
      const target = path.resolve(path.dirname(path.join(skillRoot, file)), reference.split('#')[0]);
      if (!target.startsWith(`${skillRoot}${path.sep}`) || !fs.existsSync(target)) {
        throw new Error(`Missing bundled reference or external relative reference in ${file}: ${reference}`);
      }
    }
  }
}

function expectedGenerated(root) {
  for (const entry of ['.github', '.github/skills', '.github/plugin', 'plugin']) {
    if (fs.lstatSync(path.join(root, entry)).isSymbolicLink()) {
      throw new Error(`Symbolic links are not allowed: ${entry}`);
    }
  }
  for (const file of ['plugin.json', '.github/plugin/marketplace.json', 'LICENSE']) files(path.join(root, file));
  const manifest = readJson(path.join(root, 'plugin.json'));
  validateManifest(manifest);
  const marketplace = readJson(path.join(root, '.github/plugin/marketplace.json'));
  if (marketplace.plugins?.length !== 1 || marketplace.plugins[0].version !== manifest.version) {
    throw new Error('Marketplace and plugin versions must match');
  }
  if (marketplace.plugins[0].name !== manifest.name || marketplace.plugins[0].source !== './plugin') {
    throw new Error('Marketplace identity and source must match the checked-in plugin');
  }
  const skillRoot = path.join(root, '.github/skills');
  validateSkills(skillRoot);
  const generated = new Map([
    ['plugin.json', fs.readFileSync(path.join(root, 'plugin.json'))],
    ['LICENSE', fs.readFileSync(path.join(root, 'LICENSE'))],
  ]);
  for (const file of files(skillRoot)) {
    const content = fs.readFileSync(path.join(skillRoot, file));
    generated.set(`skills/${file}`, file.endsWith('/SKILL.md') ? Buffer.from(packageSkill(content.toString())) : content);
  }
  return { manifest, generated };
}

function validateBundle(directory) {
  const entries = files(directory);
  validateManifest(readJson(path.join(directory, 'plugin.json')));
  if (!entries.includes(AGENT)) throw new Error('Missing Copilot tdd agent');
  if (entries.some((entry) => !['plugin.json', 'LICENSE', AGENT].includes(entry) && !entry.startsWith('skills/'))) {
    throw new Error('Unexpected packaged component');
  }
  validateSkills(path.join(directory, 'skills'));
}

function validatePlugin(root = REPO_ROOT) {
  const { manifest, generated } = expectedGenerated(root);
  const directory = path.join(root, 'plugin');
  validateBundle(directory);
  const actual = files(directory).filter((file) => file !== AGENT);
  if (!isDeepStrictEqual(actual.sort(), [...generated.keys()].sort())) {
    throw new Error('Generated plugin file list drift; run --generate');
  }
  for (const [file, content] of generated) {
    if (!content.equals(fs.readFileSync(path.join(directory, file)))) {
      throw new Error(`Generated plugin drift: ${file}; run --generate`);
    }
  }
  return manifest;
}

function generatePlugin(root = REPO_ROOT) {
  const { manifest, generated } = expectedGenerated(root);
  const directory = path.join(root, 'plugin');
  const current = files(directory);
  // Only replace generated content; the single authored agent remains untouched.
  for (const file of current) {
    if (file !== AGENT && !generated.has(file) && !file.startsWith('skills/')) {
      throw new Error(`Unexpected plugin file: ${file}`);
    }
  }
  fs.rmSync(path.join(directory, 'skills'), { recursive: true, force: true });
  for (const [file, content] of generated) {
    const target = path.join(directory, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  validatePlugin(root);
  return manifest;
}

function buildPlugin(output, root = REPO_ROOT) {
  root = fs.realpathSync(root);
  validatePlugin(root);
  const requested = path.resolve(output);
  const destination = path.join(fs.realpathSync(path.dirname(requested)), path.basename(requested));
  const relative = path.relative(root, destination);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative) && !relative.startsWith(`dist${path.sep}`))) {
    throw new Error('Build outside the source repository or inside its dist directory');
  }
  fs.mkdirSync(destination);
  fs.cpSync(path.join(root, 'plugin'), destination, { recursive: true });
  validateBundle(destination);
  return destination;
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3) {
      throw new Error('Usage: node scripts/build-copilot-plugin.js OUTPUT_DIRECTORY|--check|--generate|--check-bundle=DIRECTORY');
    }
    const argument = process.argv[2];
    if (argument.startsWith('--check-bundle=')) {
      const directory = path.resolve(argument.slice('--check-bundle='.length));
      validateBundle(directory);
      console.log(readJson(path.join(directory, 'plugin.json')).version);
    } else {
      console.log(argument === '--check' ? validatePlugin().version
        : argument === '--generate' ? generatePlugin().version : buildPlugin(argument));
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { buildPlugin, validatePlugin, validateBundle, generatePlugin, packageSkill };
