'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { fromHook, CodexEvents, EVENTS } = require('../src/main/codex-events');
const { createBridge } = require('../src/main/bridge');
const installer = require('../scripts/install-codex-hooks');

test('hook mapper forwards bounded metadata and strips secrets, prompts and tool results', () => {
  const event = fromHook({ hook_event_name: 'PostToolUse', session_id: 'session', turn_id: 'turn', cwd: 'C:\\private\\project', tool_name: 'Bash',
    prompt: 'secret-prompt', transcript_path: 'secret-path', last_assistant_message: 'secret-answer', tool_input: { command: 'secret-command' }, tool_response: { exit_code: 2, output: 'secret-output' } });
  assert.equal(event.stage, 'tool_failed');
  assert.equal(event.project, 'project');
  assert.doesNotMatch(JSON.stringify(event), /secret|private|tool_input|tool_response/);
  assert.equal(fromHook({ hook_event_name: 'Unknown' }), null);
  for (const name of EVENTS) assert.ok(fromHook({ hook_event_name: name }));
});

test('event state deduplicates and cannot resurrect a completed turn with late background events', () => {
  const state = new CodexEvents();
  const event = { ...fromHook({ hook_event_name: 'Stop', session_id: 's', turn_id: 't' }), at: 20, demo: true };
  assert.ok(state.accept(event));
  assert.equal(state.accept(event), null);
  assert.equal(state.accept({ ...event, id: 'late', stage: 'working', at: 30 }), null);
  assert.equal(state.snapshot().sessions[0].stage, 'completed');
  assert.equal(state.snapshot().lastSeen, null); // demo does not claim a live connection
  assert.ok(state.accept({ ...event, id: 'new', turnId: 't2', stage: 'working', at: 40, demo: false }));
  assert.ok(state.snapshot().lastSeen);
  assert.throws(() => state.accept({ provider: 'chatgpt' }), /Invalid/);
});

test('installer preserves unrelated hooks, backs up, is idempotent and removes only its own handlers', () => {
  const before = process.env.CODEX_HOME;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'caprigpt-hook-test-'));
  process.env.CODEX_HOME = dir;
  try {
    const target = path.join(dir, 'hooks.json');
    const other = { type: 'command', command: 'other-observer' };
    fs.writeFileSync(target, JSON.stringify({ description: 'Keep this', hooks: { Stop: [{ hooks: [other] }] } }));
    const result = installer.configure();
    assert.ok(fs.existsSync(result.backup));
    assert.equal(installer.status().installed, true);
    const content = fs.readFileSync(target, 'utf8');
    assert.equal(installer.configure().changed, false);
    assert.equal(fs.readFileSync(target, 'utf8'), content);
    const handlers = JSON.parse(content).hooks.PermissionRequest.flatMap((group) => group.hooks);
    assert.ok(handlers.every((hook) => hook.async === true));
    installer.configure(true);
    assert.deepEqual(JSON.parse(fs.readFileSync(target, 'utf8')).hooks.Stop, [{ hooks: [other] }]);
    fs.writeFileSync(target, '{bad json');
    assert.throws(() => installer.configure());
    assert.equal(fs.readFileSync(target, 'utf8'), '{bad json');
  } finally {
    if (before === undefined) delete process.env.CODEX_HOME; else process.env.CODEX_HOME = before;
    // Test fixtures only, created above with a fixed prefix in the OS temp directory.
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('real hook process delivers to authenticated local bridge with no permission decision output', async () => {
  const state = new CodexEvents();
  const token = 'a'.repeat(64);
  const server = createBridge({ port: 0, onEvent: () => {}, integrationToken: token, onCodexEvent: (event) => state.accept(event), onIntegrationStatus: () => state.snapshot() });
  await once(server, 'listening');
  const port = server.address().port;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'caprigpt-bridge-test-'));
  const connection = path.join(dir, 'integration.json');
  fs.writeFileSync(connection, JSON.stringify({ port, token }));
  try {
    const denied = await fetch(`http://127.0.0.1:${port}/integration/codex`, { method: 'POST', body: '{}' });
    assert.equal(denied.status, 403);
    assert.equal((await fetch(`http://127.0.0.1:${port}/integration/status`)).status, 403);
    const origin = await fetch(`http://127.0.0.1:${port}/integration/codex`, { method: 'POST', headers: { origin: 'https://example.com', authorization: `Bearer ${token}` }, body: '{}' });
    assert.equal(origin.status, 403);
    const child = spawn(process.execPath, [path.resolve(__dirname, '../hooks/caprigpt-codex-hook.js'), '--test'],
      { env: { ...process.env, CAPRIGPT_CONNECTION_FILE: connection }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    const finished = once(child, 'exit');
    child.stdin.end(JSON.stringify({ hook_event_name: 'PermissionRequest', session_id: 's', turn_id: 't', tool_name: 'Bash', tool_input: { command: 'private' } }));
    const [code] = await finished;
    assert.equal(code, 0);
    assert.deepEqual(JSON.parse(stdout), {}); // never allow/deny/continue/rewrite
    assert.equal(state.snapshot().sessions[0].stage, 'waiting');
    assert.equal(state.snapshot().lastSeen, null);
    const status = await fetch(`http://127.0.0.1:${port}/integration/status`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal((await status.json()).sessions[0].stage, 'waiting');
    const diagnostic = fs.readFileSync(path.join(dir, 'codex-hook-status.json'), 'utf8');
    assert.equal(JSON.parse(diagnostic).status, 'delivered');
    assert.doesNotMatch(diagnostic, /private|authorization|aaaaaaa/);
  } finally { server.closeAllConnections(); server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
