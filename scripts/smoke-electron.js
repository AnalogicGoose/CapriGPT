'use strict';
// Run with npm run test:desktop. Exercises our own app via its preload IPC API.
const { app, BrowserWindow, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
process.env.CAPRI_PORT = '47824';
const scratch = path.resolve(__dirname, '../../../work');
fs.mkdirSync(scratch, { recursive: true });
process.env.CAPRIGPT_TEST_PROFILE = fs.mkdtempSync(path.join(scratch, 'caprigpt-smoke-'));
process.env.CAPRIGPT_CONNECTION_FILE = path.join(process.env.CAPRIGPT_TEST_PROFILE, 'integration.json');
require('../src/main/main');
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const limit = setTimeout(() => { console.error('Desktop smoke test timed out'); app.exit(1); }, 150000);
app.whenReady().then(async () => {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    if (win.webContents.isLoading()) await new Promise((r) => win.webContents.once('did-finish-load', r));
    const js = (source) => win.webContents.executeJavaScript(source);
    for (let i = 0; i < 120 && !await js("document.documentElement.dataset.caprigptReady === 'true'"); i++) await pause(500);
    assert.equal(await js("document.documentElement.dataset.caprigptReady"), 'true');
    const status = await js('host.chatStatus()');
    assert.equal(status.ok, true, JSON.stringify(status));
    const hook = async (hook_event_name, extra = {}) => {
      const child = spawn('node', [path.resolve(__dirname, '../hooks/caprigpt-codex-hook.js'), '--test'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      const finished = once(child, 'exit');
      child.stdin.end(JSON.stringify({ hook_event_name, session_id: 'smoke-codex', turn_id: 'smoke-turn', cwd: 'C:/CapriGPT-test', ...extra }));
      assert.equal((await finished)[0], 0);
      assert.deepEqual(JSON.parse(stdout), {});
      await pause(200);
    };
    const waitForApproval = async () => {
      for (let i = 0; i < 50; i++) {
        const text = await js("document.querySelector('.panel__line').textContent");
        if (text.includes('Review it in Codex.') || text.includes('Revísala en Codex.')) return text;
        await pause(100);
      }
      throw new Error('Approval notification did not finish appearing');
    };
    await hook('UserPromptSubmit');
    await hook('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'NEVER_FORWARD_THIS' } });
    await hook('PermissionRequest', { tool_name: 'Bash' });
    const waiting = await js('host.integrationStatus()');
    assert.equal(waiting.sessions.at(-1).stage, 'waiting');
    assert.equal(waiting.lastSeen, null, 'Test events must not claim real Codex connection');
    assert.doesNotMatch(JSON.stringify(waiting), /NEVER_FORWARD_THIS/);
    assert.match(await waitForApproval(), /approval|aprobación/);
    assert.equal(await js("document.querySelector('.panel__actions').children.length"), 0, 'No approval button in Capri');
    const integrationCapture = path.resolve(__dirname, '..', 'captures', 'codex-notifications.png');
    fs.mkdirSync(path.dirname(integrationCapture), { recursive: true });
    fs.writeFileSync(integrationCapture, (await win.webContents.capturePage()).toPNG());
    await hook('PostToolUse', { tool_name: 'Bash', tool_response: { exit_code: 0 } });
    assert.equal(await js("document.querySelector('#panel').hidden"), true, 'Approval alert should clear once the tool resumes');
    await hook('Stop');
    await js("window.smokeDeltas = ''; host.onChatDelta(({text}) => { window.smokeDeltas += text; }); true");
    const disabled = await js('host.closeApp("test-nonexistent-app", false)');
    assert.match(disabled.error, /disabled/);
    // Open the actual chat UI and submit through its form.
    win.webContents.send('capri:command', { name: 'chat' });
    await pause(2000);
    await js(`document.querySelector('.panel__input').value = 'Who are you working with now, and can you see their tasks yet?';
      document.querySelector('.panel__chat').requestSubmit();`);
    assert.equal(await js("document.querySelector('.panel__quote').textContent"), 'Who are you working with now, and can you see their tasks yet?');
    let reply = '';
    for (let i = 0; i < 120; i++) {
      await pause(500);
      const state = await js(`({reply: document.querySelector('.panel__line').innerText, busy: document.querySelector('.panel__input').disabled})`);
      if (state.reply && !state.busy) { reply = state.reply; break; }
    }
    assert.ok(reply.length > 0, 'No answer in the renderer');
    assert.ok((await js('window.smokeDeltas')).length > 0, 'No streamed model output received');
    assert.doesNotMatch(reply, /Claude/i, 'Unexpected legacy branding in her introduction');
    console.log('RENDERER_REPLY:', reply);
    const capture = path.resolve(__dirname, '..', 'captures', 'local-chat.png');
    fs.mkdirSync(path.dirname(capture), { recursive: true });
    fs.writeFileSync(capture, (await win.webContents.capturePage()).toPNG());
    // The production menu action exercises real pause/unload/hide behavior.
    // Capture the menu constructed by rebuildTray on a normal config update.
    let built;
    const originalBuild = Menu.buildFromTemplate;
    Menu.buildFromTemplate = function(template) { built = originalBuild.call(this, template); return built; };
    await js('host.setConfig({volume: 0.7})');
    Menu.buildFromTemplate = originalBuild;
    const gaming = built.items.find((item) => item.label.startsWith('Gaming mode'));
    assert.ok(gaming);
    await js(`window.smokePending = host.chatSend({id: 98, messages: [{role:'user', content:'Write a long story.'}]}); true`);
    await pause(250);
    await gaming.click({ checked: true });
    const cancelled = await js('window.smokePending');
    assert.equal(cancelled.ok, false);
    assert.equal(cancelled.error, 'stopped');
    assert.equal(win.isVisible(), false);
    const paused = await js('host.chatSend({id: 99, messages: [{role:"user",content:"hi"}]})');
    assert.match(paused.error, /Gaming mode/);
    const loaded = await (await fetch('http://127.0.0.1:11434/api/ps')).json();
    assert.equal(loaded.models.some((m) => m.name === status.model), false, 'Model still loaded');
    await hook('PermissionRequest', { turn_id: 'paused-turn', tool_name: 'Bash' });
    assert.equal(win.isVisible(), false, 'Notification must not reveal Capri during gaming');
    await gaming.click({ checked: false });
    assert.equal(win.isVisible(), true);
    assert.match(await waitForApproval(), /approval|aprobación/, 'Outstanding approval should be visible after resume');
    await hook('Interrupt', { turn_id: 'paused-turn' });
    // Preview/cancel the handoff via a fake dialog; no real clipboard is changed.
    const { dialog, clipboard } = require('electron');
    const originalDialog = dialog.showMessageBox;
    let preview;
    dialog.showMessageBox = async (options) => { preview = options; return { response: 0 }; };
    assert.equal((await js('host.chatHandoff("Test handoff preview")')).ok, false);
    assert.equal(preview.detail, 'Test handoff preview');
    assert.equal(preview.defaultId, 0);
    const originalWrite = clipboard.write;
    let copied;
    clipboard.write = async (items) => { copied = items; };
    dialog.showMessageBox = async () => ({ response: 1 });
    assert.equal((await js('host.chatHandoff("Test handoff copy")')).ok, true);
    assert.equal(await (await copied[0].getType('text/plain')).text(), 'Test handoff copy');
    clipboard.write = originalWrite;
    dialog.showMessageBox = originalDialog;
    console.log('PASS: Codex hook-to-renderer notifications, no approvals, handoff preview, local chat, gaming cancellation/unload/resume');
    console.log('CAPTURE:', capture);
    clearTimeout(limit);
    app.exit(0);
  } catch (error) { console.error(error); clearTimeout(limit); app.exit(1); }
});
