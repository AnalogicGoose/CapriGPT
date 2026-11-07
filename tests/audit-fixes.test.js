'use strict';
// Regression tests for the November 2026 code audit fixes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ActionAgent } = require('../src/main/action-agent');
const { DesktopTools } = require('../src/main/desktop-tools');
const { overlayPatch } = require('../src/main/settings-policy');
const { unpack } = require('../src/main/speech-runtime');

function launcher(shortcuts = () => [{ label: 'Firefox', file: 'C:\\Apps\\Firefox.lnk' }]) {
  const opened = [];
  const desktop = new DesktopTools({ openPath: async file => { opened.push(file); return ''; }, shortcuts, executables: () => [],
    native: { desktopApps: () => [] } });
  const runner = new ActionAgent({ settings: () => ({ agentEnabled: true, desktopActions: true }), desktop, web: {}, browser: { stop() {} },
    models: async () => { throw Error('No model should be needed.'); }, infer: async () => '{}' });
  return { runner, desktop, opened };
}

test('a bare app name asked as a question does not launch it; the shorthand and explicit requests still do', async () => {
  const f = launcher();
  for (const input of ['calculator?', 'Paint?', 'firefox?', 'firefox ?']) {
    assert.equal(f.runner.willHandle(input), false, input);
    assert.equal(await f.runner.route(input), null, input);
  }
  assert.deepEqual(f.opened, []);
  for (const input of ['firefox', 'open firefox?', '/do firefox?']) assert.equal((await f.runner.route(input)).task, true, input);
  assert.equal(f.opened.length, 3);
});

test('a questioning app name still answers a pending app-choice question', async () => {
  const f = launcher();
  assert.match((await f.runner.route('open my browser')).text, /Which browser/);
  await f.runner.route('firefox?');
  assert.deepEqual(f.opened, ['C:\\Apps\\Firefox.lnk']);
});

test('message routing reuses the Start menu catalog; explicit launches rescan it', async () => {
  let scans = 0;
  const f = launcher(() => { scans++; return [{ label: 'Firefox', file: 'C:\\Apps\\Firefox.lnk' }]; });
  for (const input of ['hello', 'firefox is great', 'what is new?']) f.runner.willHandle(input);
  f.desktop.evidence(); f.desktop.matchName('Firefox');
  assert.equal(scans, 1);
  await f.desktop.open('Firefox');
  assert.equal(scans, 2, 'an explicit launch must see newly installed apps');
});

test('the overlay may only change its visibility and welcome flags', () => {
  assert.deepEqual(overlayPatch({ visible: true, welcomed: true }), { visible: true, welcomed: true });
  for (const input of [{ gamingMode: true }, { desktopActions: true }, { agentEnabled: false }, { chatModel: 'x' },
    { privacy: { memoryEnabled: true } }, { visible: 'yes' }, null, [], 'visible']) assert.throws(() => overlayPatch(input));
});

test('closing an app ignores unrelated background processes with the same name', async t => {
  const native = require('../src/main/native-windows');
  const saved = { desktopApps: native.desktopApps, processRows: native.processRows, forceClose: native.forceClose };
  t.after(() => Object.assign(native, saved));
  if (process.platform !== 'win32') return t.skip('Windows only');
  const apps = require('../src/main/apps');
  native.desktopApps = () => [{ name: 'chrome', process: 'chrome', label: 'Chrome', ids: [10], handles: [1] }];
  native.forceClose = () => {};
  native.processRows = () => [{ id: 22, name: 'chrome' }, { id: 23, name: 'chrome' }];
  assert.deepEqual(await apps.close('chrome', { force: true }), { running: false });
  native.processRows = () => [{ id: 10, name: 'chrome' }];
  assert.deepEqual(await apps.close('chrome', { force: true }), { running: true });
});

test('speech archives are extracted by Windows tar in a separate process, into the bin folder', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capri-unpack-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const calls = [];
  const bin = path.join(dir, 'bin');
  await unpack(path.join(dir, 'a.zip'), bin, { systemRoot: 'C:\\Windows', run: (file, args, options, done) => { calls.push({ file, args, options }); done(null); } });
  assert.ok(fs.statSync(bin).isDirectory());
  assert.equal(calls[0].file, path.join('C:\\Windows', 'System32', 'tar.exe'));
  assert.deepEqual(calls[0].args, ['-xf', path.join(dir, 'a.zip'), '-C', bin]);
  assert.equal(calls[0].options.windowsHide, true);
  await assert.rejects(unpack('a.zip', bin, { run: (_f, _a, _o, done) => done(Error('bad entry')) }), /speech-download-failed/);
});

test('an installed Capri and its Codex hook agree on a writable connection file', () => {
  const { connectionFile } = require('../hooks/caprigpt-codex-hook');
  const env = { APPDATA: 'C:\\Users\\me\\AppData\\Roaming' };
  const expected = path.join(env.APPDATA, 'CapriGPT', 'integration.json');
  // Capri's main process loads the hook from the archive; Codex runs it from the unpacked copy.
  assert.equal(connectionFile('C:\\Apps\\CapriGPT\\resources\\app.asar\\hooks', env), expected);
  assert.equal(connectionFile('C:\\Apps\\CapriGPT\\resources\\app.asar.unpacked\\hooks', env), expected);
  assert.equal(connectionFile('C:\\DEV\\CapriGPT\\hooks', env), path.resolve('C:\\DEV\\CapriGPT', '.caprigpt-local', 'integration.json'));
  assert.equal(connectionFile('C:\\Apps\\CapriGPT\\resources\\app.asar\\hooks', { ...env, CAPRIGPT_CONNECTION_FILE: 'X:\\test.json' }), 'X:\\test.json');
});
