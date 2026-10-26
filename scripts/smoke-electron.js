'use strict';
// Run with npm run test:desktop. Exercises our own app via its preload IPC API.
const { app, BrowserWindow, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
process.env.CAPRI_PORT = '47824';
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
    assert.match(reply, /ChatGPT|Codex/i, 'Expected the current collaborators in her introduction');
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
    await gaming.click({ checked: false });
    assert.equal(win.isVisible(), true);
    console.log('PASS: renderer chat, action denial, active cancellation, gaming hide/block/unload/resume');
    console.log('CAPTURE:', capture);
    clearTimeout(limit);
    app.exit(0);
  } catch (error) { console.error(error); clearTimeout(limit); app.exit(1); }
});
