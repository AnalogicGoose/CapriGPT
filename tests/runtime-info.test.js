'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runtimeInfo } = require('../src/main/runtime-info');
const { environmentBlock, startHiddenOllama } = require('../src/main/hidden-ollama');

test('runtime identity distinguishes a current build from files changed since startup', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'capri-build-'));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'package.json'), '{"version":"0.4.0"}');
  const source = path.join(root, 'src', 'main.js');
  fs.writeFileSync(source, 'original');
  const status = runtimeInfo(root, '0.4.0');
  assert.equal(status().version, '0.4.0');
  assert.equal(status().root, root);
  assert.equal(status().currentSource, true);
  assert.match(status().build, /^[a-f0-9]{12}$/);
  fs.writeFileSync(source, 'updated');
  assert.equal(status().currentSource, false);
});

test('hidden Ollama launch accepts only the fixed executable and loopback host; environment is Unicode and terminated', () => {
  const text = environmentBlock({ Path: 'old', PATH: 'new', OLLAMA_HOST: '127.0.0.1:11435', 'BAD=KEY': 'no', INJECT: 'bad\0value', EMPTY: undefined }).toString('utf16le');
  assert.ok(text.endsWith('\0\0'));
  assert.match(text, /PATH=new/);
  assert.doesNotMatch(text, /old|BAD=KEY|INJECT|EMPTY/);
  assert.throws(() => startHiddenOllama('untrusted.exe', 'http://127.0.0.1:11435'));
  assert.throws(() => startHiddenOllama('C:\\Trusted\\ollama.exe', 'http://example.com'));
});
