'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { startHiddenOllama } = require('./hidden-ollama');
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
      startHiddenOllama(file, ollama.base());
      const deadline = Date.now() + 30000; // cold Windows GPU discovery can exceed eight seconds
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
