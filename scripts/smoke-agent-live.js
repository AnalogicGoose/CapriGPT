'use strict';
const assert = require('node:assert/strict');
const { Agent } = require('../src/main/agent');
const { WorldState } = require('../src/main/world-state');
const { ContextService } = require('../src/main/pc-context');
const ollama = require('../src/main/ollama');

(async () => {
  const cfg = { agentEnabled: true, desktopActions: false, privacy: {} };
  const agent = new Agent({ settings: () => cfg,
    world: new WorldState({ context: new ContextService({ settings: () => cfg }) }),
    models: ollama.models, infer: (request, signal) => ollama.chat(request, () => {}, signal),
    apps: { list: async () => { throw Error('No action discovery allowed in this live test'); } },
    close: async () => { throw Error('No desktop actions allowed in this live test'); },
  });
  const at = Date.now();
  const result = await agent.run('Offer one short helpful suggestion about my current PC activity. Do not close anything.');
  assert.ok(['wait', 'suggest'].includes(agent.lastResult), result);
  assert.equal(agent.pending, null);
  console.log(`PASS: real Qwen 3.5 9B + real native Windows world state; validated ${agent.lastResult}; ${Date.now() - at}ms; no desktop actions`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
