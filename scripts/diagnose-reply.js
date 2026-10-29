'use strict';

// On-demand, bounded diagnostic. No terminal contents, app titles or user chats.
const native = require('../src/main/native-windows');
const ollama = require('../src/main/ollama');
const net = require('node:net');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const history = new Map(native.processRows().map(row => [row.id, row]));
  const seen = new Set(history.keys());
  const consoleIds = new Set(native.consoleWindows().map(row => row.hwnd));
  const starts = [], consoles = [];
  const chain = pid => {
    const result = [];
    for (let i = 0; pid && i < 5; i++) {
      const row = history.get(pid);
      if (!row) break;
      result.push(`${row.name}:${row.id}`); pid = row.parentId;
    }
    return result;
  };
  const sample = () => {
    for (const row of native.processRows()) {
      history.set(row.id, row);
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      if (/powershell|pwsh|cmd|csc|conhost|openconsole|windowsterminal|ollama|llama|runner|electron/i.test(row.name)) {
        const event = { kind: 'helper-start', chain: chain(row.id) };
        starts.push(event); console.log(JSON.stringify(event));
      }
    }
    for (const row of native.consoleWindows()) {
      if (consoleIds.has(row.hwnd)) continue;
      consoleIds.add(row.hwnd);
      const event = { kind: 'visible-terminal', className: row.className, chain: chain(row.pid) };
      consoles.push(event); console.log(JSON.stringify(event));
    }
  };
  const interval = setInterval(sample, 40);
  let ownedServer;
  try {
    if (process.argv.includes('--fresh-server')) {
      const reservation = net.createServer();
      await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
      const port = reservation.address().port;
      await new Promise(resolve => reservation.close(resolve));
      const file = require('../src/main/ollama-runtime').executable();
      if (!file) throw Error('Installed Ollama executable unavailable.');
      process.env.OLLAMA_HOST = `127.0.0.1:${port}`;
      ownedServer = require('../src/main/hidden-ollama').startHiddenOllama(file, ollama.base());
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline && !await ollama.models().then(() => true, () => false)) await delay(200);
    }
    const models = await ollama.models();
    const model = models.find(m => m === 'llama3.2:3b') || models.find(m => !m.endsWith('-cloud'));
    if (!model) throw Error('No downloaded local model.');
    console.log(JSON.stringify({ kind: 'test-start', model, request: 'A fixed harmless greeting, not user conversation' }));
    const result = await ollama.chat({ model, messages: [{ role: 'user', content: 'Reply with hello only.' }] }, () => {}, AbortSignal.timeout(30000));
    await delay(1000);
    sample();
    console.log(JSON.stringify({ kind: 'test-complete', replyCharacters: result.length, helperStarts: starts.length, visibleTerminals: consoles.length }));
  } finally {
    clearInterval(interval);
    if (ownedServer) {
      // Only the disposable server created above and its direct model children.
      for (const row of native.processRows().filter(row => row.parentId === ownedServer.pid && ['llama-server', 'ollama'].includes(row.name))) native.forceClose([row.id], row.name);
      native.forceClose([ownedServer.pid], 'ollama');
    }
  }
}

main().catch(err => { console.error(err.message); process.exitCode = 1; });
