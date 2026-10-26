'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const ollama = require('./ollama');

function executable() {
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) return null;
  const file = path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe');
  return fs.existsSync(file) ? file : null;
}
let starting;
async function start() {
  if (starting) return starting;
  starting = (async () => {
    const file = executable();
    if (!file) return { ok: false, error: 'Ollama is not installed in its standard Windows location.' };
    try {
      if (await ollama.models().then(() => true, () => false)) return { ok: true };
      // Fixed executable and argument list: never execute model/user text.
      const child = spawn(file, ['serve'], { windowsHide: true, detached: true, stdio: 'ignore',
        env: { ...process.env, OLLAMA_HOST: ollama.base() } });
      await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
      child.unref();
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        if (await ollama.models().then(() => true, () => false)) return { ok: true };
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      return { ok: false, error: 'Ollama did not become ready. Open Ollama and try again.' };
    } catch (err) { return { ok: false, error: err.message }; }
  })();
  try { return await starting; } finally { starting = null; }
}
module.exports = { executable, start };
