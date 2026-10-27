#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const PACKAGE_PATHS = ['plugin.json', '.github/skills', 'plugin/agents', 'README.md', 'LICENSE'];

function checkFiles(file) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink()) throw new Error(`Symbolic links are not allowed: ${file}`);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(file)) checkFiles(path.join(file, entry));
  } else if (!stat.isFile()) {
    throw new Error(`Not a regular package file: ${file}`);
  }
}

function validatePlugin(root = REPO_ROOT) {
  for (const parent of ['.github', '.github/plugin', 'plugin']) {
    if (fs.lstatSync(path.join(root, parent)).isSymbolicLink()) {
      throw new Error(`Symbolic links are not allowed: ${parent}`);
    }
  }
  for (const entry of [...PACKAGE_PATHS, '.github/plugin/marketplace.json']) {
    checkFiles(path.join(root, entry));
  }
  const plugin = JSON.parse(fs.readFileSync(path.join(root, 'plugin.json'), 'utf8'));
  const marketplace = JSON.parse(fs.readFileSync(path.join(root, '.github/plugin/marketplace.json'), 'utf8'));
  if (marketplace.plugins?.length !== 1 || marketplace.plugins[0].version !== plugin.version) {
    throw new Error('Marketplace and plugin versions must match');
  }
  if (marketplace.plugins[0].name !== plugin.name || marketplace.plugins[0].source !== './') {
    throw new Error('Marketplace identity and source must match the root plugin');
  }
  if (plugin.skills !== '.github/skills/' || plugin.agents !== 'plugin/agents/') {
    throw new Error('Unexpected plugin component paths');
  }
  for (const name of fs.readdirSync(path.join(root, plugin.skills))) {
    const directory = path.join(root, plugin.skills, name);
    const skill = fs.readFileSync(path.join(directory, 'SKILL.md'), 'utf8');
    const declaredName = skill.match(/^---\r?\nname: ([a-z0-9-]+)\r?\n/);
    if (declaredName?.[1] !== name) throw new Error(`Skill name must match its directory: ${name}`);
    for (const match of skill.matchAll(/`(\.\/(?:assets|templates)\/[^`]+)`/g)) {
      const target = path.resolve(directory, match[1]);
      if (!target.startsWith(`${directory}${path.sep}`) || !fs.existsSync(target)) {
        throw new Error(`Missing bundled reference in ${name}: ${match[1]}`);
      }
    }
  }
  return plugin;
}

function buildPlugin(output, root = REPO_ROOT) {
  validatePlugin(root);
  const destination = path.resolve(output);
  const relative = path.relative(root, destination);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative) && !relative.startsWith(`dist${path.sep}`))) {
    throw new Error('Build outside the source repository or inside its dist directory');
  }
  fs.mkdirSync(destination);
  for (const entry of PACKAGE_PATHS) {
    fs.cpSync(path.join(root, entry), path.join(destination, entry), { recursive: true });
  }
  return destination;
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3) {
      throw new Error('Usage: node scripts/build-copilot-plugin.js OUTPUT_DIRECTORY');
    }
    console.log(buildPlugin(process.argv[2]));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { buildPlugin, validatePlugin };
