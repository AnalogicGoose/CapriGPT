'use strict';
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createCloseHandler } = require('../src/main/action-confirmation');
const ollama = require('../src/main/ollama');
const originalFetch = global.fetch;
const originalHost = process.env.OLLAMA_HOST;
afterEach(() => {
  global.fetch = originalFetch;
  if (originalHost === undefined) delete process.env.OLLAMA_HOST;
  else process.env.OLLAMA_HOST = originalHost;
});

test('non-loopback addresses, credentials, paths and HTTPS are rejected', () => {
  for (const host of ['https://127.0.0.1:11434', 'example.com:11434', '127.0.0.1.evil.test', 'user:pass@127.0.0.1', '127.0.0.1:11434/proxy']) {
    process.env.OLLAMA_HOST = host;
    assert.throws(ollama.base);
  }
  process.env.OLLAMA_HOST = '127.0.0.1:11434';
  assert.equal(ollama.base(), 'http://127.0.0.1:11434');
});

test('streamed chat has bounded context, no tools, unloads and refuses redirects', async () => {
  delete process.env.OLLAMA_HOST;
  let request;
  global.fetch = async (url, options) => {
    assert.equal(options.redirect, 'error');
    if (url.endsWith('/api/show')) return Response.json({ details: { parameter_size: '3.2B' } });
    request = JSON.parse(options.body);
    return new Response('{"message":{"content":"Hello"}}\n{"done":true}\n');
  };
  let streamed = '';
  assert.equal(await ollama.chat({ model: 'test', messages: [{ role: 'user', content: 'hi' }] }, (s) => { streamed += s; }), 'Hello');
  assert.equal(streamed, 'Hello');
  assert.equal(request.keep_alive, 0);
  assert.equal(request.options.num_ctx, 32768);
  assert.equal(request.options.num_predict, 1536);
  assert.equal(request.tools, undefined);
  assert.equal(request.think, false);
});

test('agent schema reaches the local model with bounded generation and no tool execution', async () => {
  let request;
  const { DECISION_SCHEMA } = require('../src/main/agent');
  global.fetch = async (url, options) => {
    if (url.endsWith('/api/show')) return Response.json({ details: { parameter_size: '9B' } });
    request = JSON.parse(options.body);
    return new Response('{"message":{"content":"{}"},"done":true}\n');
  };
  await ollama.chat({ model: 'qwen3.5:9b', schema: DECISION_SCHEMA, messages: [{ role: 'user', content: 'help' }] }, () => {});
  assert.deepEqual(request.format, DECISION_SCHEMA);
  assert.equal(request.options.num_ctx, 8192);
  assert.equal(request.options.num_predict, 400);
  assert.equal(request.keep_alive, 0);
  assert.equal(request.tools, undefined);
});

test('remote model metadata prevents any inference request', async () => {
  let calls = 0;
  global.fetch = async () => { calls++; return Response.json({ remote_model: 'cloud-model' }); };
  await assert.rejects(ollama.chat({ model: 'alias', messages: [{ role: 'user', content: 'hi' }] }, () => {}), /local models/);
  assert.equal(calls, 1);
});

test('chat respects a smaller installed model context and preserves the latest question', async () => {
  let request;
  global.fetch = async (url, options) => {
    if (url.endsWith('/api/show')) return Response.json({ details: { parameter_size: '3B' }, model_info: { 'llama.context_length': 8192 } });
    request = JSON.parse(options.body);
    return new Response('{"message":{"content":"Hello"},"done":true}\n');
  };
  await ollama.chat({ model: 'small', messages: [{ role: 'system', content: 'Capri' }, { role: 'user', content: 'Current question' }] }, () => {});
  assert.equal(request.options.num_ctx, 8192);
  assert.equal(request.options.num_predict, 1024);
  assert.equal(request.messages.at(-1).content, 'Current question');
});

test('cancelled inference does not start generation', async () => {
  const abort = new AbortController();
  abort.abort();
  global.fetch = async (_url, options) => { options.signal.throwIfAborted(); throw Error('unexpected request'); };
  await assert.rejects(ollama.chat({ model: 'test', messages: [{ role: 'user', content: 'hi' }] }, () => {}, abort.signal), { name: 'AbortError' });
});

test('desktop gate denies disabled, cancelled, protected and gaming requests', async () => {
  const cfg = { desktopActions: false, gamingMode: false };
  let confirms = 0;
  let closes = 0;
  let response = 0;
  let duringDialog = () => {};
  const handler = createCloseHandler({
    config: { load: () => cfg },
    apps: { list: async () => [{ process: 'test-app' }], close: async () => { closes++; return { running: false }; } },
    dialog: { showMessageBox: async (options) => { confirms++; assert.equal(options.defaultId, 0); duringDialog(); return { response }; } },
  });
  await handler(null, { name: 'test-app' });
  assert.equal(confirms, 0);
  cfg.desktopActions = true;
  await handler(null, { name: 'protected-app' });
  assert.equal(confirms, 0);
  await handler(null, { name: 'test-app' });
  assert.equal(closes, 0);
  response = 1;
  duringDialog = () => { cfg.gamingMode = true; };
  await handler(null, { name: 'test-app' });
  assert.equal(closes, 0);
  cfg.gamingMode = false;
  duringDialog = () => {};
  await handler(null, { name: 'test-app' });
  assert.equal(closes, 1);
  response = 0;
  await handler(null, { name: 'test-app', force: true });
  assert.equal(closes, 1); // force needs its own fresh approval
});
