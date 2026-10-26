'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const loadRenderer = (name) => import(`data:text/javascript;base64,${fs.readFileSync(path.join(__dirname, '../src/renderer/js', name)).toString('base64')}`);

test('quiet notifications animate work bursts and retain completion, error and approval messages', async () => {
  const { IntegrationCompanion } = await loadRenderer('integration.js');
  const messages = [], acts = [], sounds = [];
  let pulses = 0, mode;
  const callbacks = {};
  const companion = new IntegrationCompanion({
    capri: { setMode: value => { mode = value; }, pulse: () => pulses++, perform: value => acts.push(value), hurt: () => acts.push('hurt') },
    panel: { setTicker() {}, clearKind() {}, say: value => messages.push(value) },
    voice: { play: value => sounds.push(value) }, brain: { lang: 'en' },
    host: { onIntegrationState: fn => { callbacks.state = fn; }, onIntegrationEvent: fn => { callbacks.event = fn; }, integrationStatus: async () => ({ lastSeen: null, sessions: [] }) },
  });
  await Promise.resolve();
  const send = (stage, sessions = [{ stage }]) => {
    callbacks.state({ lastSeen: 1, sessions });
    callbacks.event({ stage, project: 'Capri', demo: false });
  };
  send('ready');
  send('working');
  for (let i = 0; i < 30; i++) send('working');
  assert.equal(mode, 'work');
  assert.equal(messages.length, 0);
  assert.equal(pulses, 1, 'Tool bursts must not repeatedly flash');
  assert.equal(companion.statusMessage().kind, 'work');
  assert.match(companion.statusMessage().line, /Codex is working/);
  let talked = false;
  companion.brain.t = { chat: { talk: 'Talk to me' } };
  companion.brain.onTalk = () => { talked = true; };
  companion.statusMessage().onAction('talk');
  assert.equal(talked, true);
  assert.equal(companion.statusMessage().actions[0].id, 'talk');
  send('waiting');
  assert.equal(mode, 'alert');
  assert.equal(messages.at(-1).hold, null);
  assert.match(messages.at(-1).line, /Review it in Codex/);
  send('completed', [{ stage: 'waiting' }, { stage: 'completed' }]);
  assert.equal(mode, 'alert', 'Another task must not erase a pending approval');
  assert.equal(messages.length, 1);
  assert.equal(companion.statusMessage().kind, 'alert');
  assert.equal(companion.statusMessage().hold, null);
  assert.equal(companion.statusMessage().actions, undefined, 'Approval stays focused on Codex');
  send('working');
  send('tool_failed');
  assert.equal(messages.at(-1).kind, 'error');
  assert.equal(companion.statusMessage().kind, 'error');
  send('completed');
  assert.equal(mode, 'idle');
  assert.equal(messages.at(-1).kind, 'done');
  assert.equal(companion.statusMessage(), null, 'Completed turns should allow the idle status');
  assert.match(companion.activityLine(), /no active task/);
  assert.deepEqual(acts, ['hurt', 'hop']);
  assert.deepEqual(sounds, ['alert', 'error']);
  const count = messages.length;
  send('interrupted'); send('closed');
  assert.equal(messages.length, count);
  assert.match(companion.context(), /No prompts/);
});

test('focus cycle loops held poses without effect or sound cues', async () => {
  const { Player } = await loadRenderer('acting.js');
  const player = new Player('focus', { at: 0 });
  const duration = player.total * 1000 / 12;
  for (let now = 0; now < duration; now += 100) {
    const frame = player.sample(now);
    assert.equal(frame.cue, undefined);
    const pose = player.resolve(frame.pose, 1);
    assert.ok(Math.abs(pose.head) <= 0.12);
    assert.ok(Math.abs(pose.bob) <= 3);
    assert.deepEqual(player.sample(now + duration), frame);
  }
});

test('installed offline Ollama offers explicit start and reopens chat with activity', async () => {
  // Supply the two formatting helpers so this controller can run without browser globals.
  const source = fs.readFileSync(path.join(__dirname, '../src/renderer/js/chat.js'), 'utf8')
    .replace("import { pick, fmt } from './util.js';", 'const pick = items => items[0]; const fmt = text => text;');
  const { Chat } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  let started = 0, message;
  const panel = { chatInput: { focus() {} }, say: msg => { message = msg; return true; }, setActions() {}, hide() {} };
  const chat = new Chat({ panel, capri: { wake() {}, towardCenter() {}, perform() {} }, voice: {},
    brain: { lang: 'en', t: { chat: { offline: 'Cannot reach Ollama', ok: 'OK', hello: ['Hello'], again: ['Hello again'] } }, integrationActivity: () => 'Codex is working.' },
    host: { onChatDelta() {}, chatStatus: async () => started ? { ok: true, model: 'llama3.2:3b' } : { ok: false, error: 'offline', installed: true },
      startOllama: async () => { started++; return { ok: true }; }, focusOverlay() {}, openApps: async () => [] },
  });
  await chat.start();
  assert.equal(started, 0, 'Checking status must not start a background server');
  assert.match(message.quote, /installed but is not running/);
  assert.equal(message.actions[0].id, 'start');
  await message.onAction('start');
  assert.equal(started, 1);
  assert.equal(chat.open, true);
  assert.equal(message.activity, 'Codex is working.');
});
