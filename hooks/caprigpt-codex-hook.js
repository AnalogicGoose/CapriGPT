#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { fromHook } = require('../src/main/codex-events');

function connectionFile() {
  return process.env.CAPRIGPT_CONNECTION_FILE || path.resolve(__dirname, '..', '.caprigpt-local', 'integration.json');
}
function record(status) {
  try {
    fs.writeFileSync(path.join(path.dirname(connectionFile()), 'codex-hook-status.json'), JSON.stringify({ at: new Date().toISOString(), ...status }));
  } catch { /* diagnostics must never interfere with Codex */ }
}
async function send(event) {
  const cfg = JSON.parse(fs.readFileSync(connectionFile(), 'utf8'));
  if (!Number.isInteger(cfg.port) || cfg.port < 1024 || cfg.port > 65535 || !/^[a-f0-9]{64}$/.test(cfg.token)) return;
  const body = JSON.stringify(event);
  await new Promise((resolve) => {
    const req = http.request({ hostname: '127.0.0.1', port: cfg.port, path: '/integration/codex', method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), authorization: `Bearer ${cfg.token}` } },
    (res) => {
      let response = '';
      res.on('data', (chunk) => { if (response.length < 2048) response += chunk.toString(); });
      res.on('end', () => {
        let accepted = false;
        try { accepted = JSON.parse(response).accepted === true; } catch {}
        record({ event: event.stage, demo: Boolean(event.demo), turnIdPresent: Boolean(event.turnId),
          status: res.statusCode === 200 && accepted ? 'delivered' : 'rejected', httpStatus: res.statusCode, accepted });
        resolve();
      });
    });
    req.setTimeout(500, () => { record({ status: 'timeout' }); req.destroy(); resolve(); });
    req.on('error', (error) => { record({ status: 'connection-error', code: error.code || 'UNKNOWN' }); resolve(); });
    req.end(body);
  });
}
async function run() {
  record({ status: 'started' });
  let size = 0;
  const chunks = [];
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 4 * 1024 * 1024) return;
    chunks.push(chunk);
  }
  const event = fromHook(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  if (event && process.argv.includes('--test')) event.demo = true;
  if (event) await send(event);
}
if (require.main === module) {
  // A background observer never returns allow/deny, rewrites input, or continues a turn.
  // Stop hooks expect JSON. An empty object carries no decision or context.
  run().catch((error) => { record({ status: 'forwarder-error', code: error.code || error.name }); }).finally(() => { process.stdout.write('{}\n'); });
}
module.exports = { connectionFile, send };
