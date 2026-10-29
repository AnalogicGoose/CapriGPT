'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

function sourceFingerprint(root) {
  const hash = createHash('sha256');
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (/\.(js|html|css)$/.test(entry.name)) hash.update(path.relative(root, file)).update(fs.readFileSync(file));
    }
  };
  hash.update(fs.readFileSync(path.join(root, 'package.json')));
  visit(path.join(root, 'src'));
  return hash.digest('hex').slice(0, 12);
}

function runtimeInfo(root, version) {
  const startedAt = new Date().toISOString();
  const build = sourceFingerprint(root);
  return () => {
    let currentSource = false;
    try { currentSource = sourceFingerprint(root) === build; } catch {}
    return { version, build, root, pid: process.pid, startedAt, currentSource,
      contextBackend: 'native-win32', terminalHelpers: false, ollamaHost: require('./ollama').base() };
  };
}

module.exports = { sourceFingerprint, runtimeInfo };
