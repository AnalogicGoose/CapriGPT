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
  send('waiting');
  assert.equal(mode, 'alert');
  assert.equal(messages.at(-1).hold, null);
  assert.match(messages.at(-1).line, /Review it in Codex/);
  send('completed', [{ stage: 'waiting' }, { stage: 'completed' }]);
  assert.equal(mode, 'alert', 'Another task must not erase a pending approval');
  assert.equal(messages.length, 1);
  send('working');
  send('tool_failed');
  assert.equal(messages.at(-1).kind, 'error');
  send('completed');
  assert.equal(mode, 'idle');
  assert.equal(messages.at(-1).kind, 'done');
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
