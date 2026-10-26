'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { connectionFile } = require('../hooks/caprigpt-codex-hook');
async function check() {
  const file = connectionFile();
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Number.isInteger(config.port) || config.port < 1024 || config.port > 65535 || !/^[a-f0-9]{64}$/.test(config.token)) throw Error('Invalid local connection settings');
  const response = await fetch(`http://127.0.0.1:${config.port}/integration/status`, { headers: { authorization: `Bearer ${config.token}` }, redirect: 'error', signal: AbortSignal.timeout(1500) });
  let delivery = null;
  try { delivery = JSON.parse(fs.readFileSync(path.join(path.dirname(file), 'codex-hook-status.json'), 'utf8')); } catch {}
  if (response.status === 404) {
    console.log(JSON.stringify({ capri: 'Running build predates the detailed status endpoint; restart Capri when convenient.', lastHookDelivery: delivery }, null, 2));
    return;
  }
  if (!response.ok) throw Error(`Capri connection returned HTTP ${response.status}`);
  console.log(JSON.stringify({ capri: await response.json(), lastHookDelivery: delivery }, null, 2));
}
check().catch((error) => { console.error(error.message); process.exitCode = 1; });
