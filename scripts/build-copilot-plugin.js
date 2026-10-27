#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const PACKAGE_PATHS = ['plugin.json', '.github/skills', 'plugin/agents', 'README.md', 'LICENSE'];

function buildPlugin(output, root = REPO_ROOT) {
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

module.exports = { buildPlugin };
