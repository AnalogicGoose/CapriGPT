'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

test('Windows context, app discovery and geometry work with every child-process launcher forbidden', { skip: process.platform !== 'win32' }, () => {
  const child = require('node:child_process');
  const originals = {};
  for (const key of ['spawn', 'exec', 'execFile', 'fork', 'spawnSync', 'execSync', 'execFileSync']) {
    originals[key] = child[key];
    child[key] = () => { throw Error(`Unexpected terminal/helper launch: ${key}`); };
  }
  try {
    const native = require('../src/main/native-windows');
    const self = native.processRows().find(row => row.id === process.pid);
    assert.ok(self, 'Win32 process snapshot should include this test process');
    const data = native.context({ contextProcesses: true, contextPower: true, processAllowlist: [self.name] });
    assert.deepEqual(data.processes, [self.name]);
    const all = native.context({ contextProcesses: true, allApps: true, processAllowlist: [] });
    assert.ok(all.processes.includes(self.name), 'All-app mode works without any allowlist');
    assert.ok(data.power);
    assert.equal(data.foreground, undefined);
    for (const row of native.desktopApps()) {
      assert.equal(typeof row.name, 'string');
      assert.equal(row.title, undefined);
      assert.equal(row.path, undefined);
    }
    const geometry = native.geometry(0);
    const foreground = native.foregroundBounds();
    if (foreground) {
      assert.equal(typeof foreground.width, 'number');
      assert.equal(typeof foreground.caption, 'boolean');
      assert.equal(foreground.title, undefined);
      assert.equal(foreground.name, undefined);
    }
    assert.ok(Array.isArray(geometry.wins));
    for (const win of geometry.wins) assert.equal(win.title, undefined);
  } finally { Object.assign(child, originals); }
});

test('native app actions preserve protected apps and send only mocked selected handles or IDs', { skip: process.platform !== 'win32' }, async () => {
  const native = require('../src/main/native-windows');
  const apps = require('../src/main/apps');
  const originals = { desktopApps: native.desktopApps, requestClose: native.requestClose,
    forceClose: native.forceClose, processRows: native.processRows };
  const normal = [], forced = [];
  native.desktopApps = () => [
    { name: 'test-app', process: 'test-app', label: 'Test app', ids: [123], handles: [456] },
    { name: 'electron', process: 'electron', ids: [999], handles: [888] },
  ];
  native.requestClose = handles => normal.push(handles);
  native.forceClose = (ids, name) => forced.push({ ids, name });
  native.processRows = () => [{ id: 123, name: 'test-app' }];
  try {
    assert.deepEqual((await apps.list()).map(row => row.name), ['test-app']);
    await apps.close('electron');
    assert.deepEqual(normal, []);
    await apps.close('test-app');
    assert.deepEqual(normal, [[456]]);
    await apps.close('test-app', { force: true });
    assert.deepEqual(forced, [{ ids: [123], name: 'test-app' }]);
  } finally { Object.assign(native, originals); }
});
