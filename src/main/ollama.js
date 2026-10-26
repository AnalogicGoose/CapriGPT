'use strict';

// Talking to her: a local model through Ollama (https://ollama.com). Done from here, not from
// the overlay's page, which can't reach other local ports. Everything stays on this machine
// Remote Ollama hosts and redirects are deliberately forbidden in this milestone.

function base() {
  let host = process.env.OLLAMA_HOST || '127.0.0.1:11434';
  if (!/^https?:\/\//.test(host)) host = `http://${host}`;
  const url = new URL(host.replace('://0.0.0.0', '://127.0.0.1'));
  if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(url.hostname)
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('CapriGPT requires a loopback Ollama address, e.g. 127.0.0.1:11434');
  }
  return url.origin;
}

// Ollama's errors come as {"error": "..."}
async function failure(res) {
  const body = await res.text().catch(() => '');
  try {
    return new Error(JSON.parse(body).error);
  } catch {
    return new Error(body || `Ollama answered ${res.status}`);
  }
}

// The models installed, by name ("llama3.2:latest"...).
async function models() {
  const res = await fetch(`${base()}/api/tags`, { redirect: 'error', signal: AbortSignal.timeout(2500) });
  if (!res.ok) throw await failure(res);
  const { models: list = [] } = await res.json();
  return list.map((m) => m.name);
}

// Release the selected model without generating text.
async function unload(model) {
  if (!model) return;
  const res = await fetch(`${base()}/api/generate`, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, keep_alive: 0 }),
  });
  if (!res.ok) throw await failure(res);
}

// Her answer, streamed: onDelta(piece) as it comes, resolves with all of it.
async function chat({ model, messages }, onDelta, signal) {
  if (typeof model !== 'string' || !model || model.endsWith('-cloud')) throw new Error('Choose a local model');
  if (!Array.isArray(messages) || messages.length > 16 || !messages.length
      || messages.some((m) => !['system', 'user', 'assistant'].includes(m.role)
        || typeof m.content !== 'string' || m.content.length > 12000)) throw new Error('Invalid chat messages');
  const deadline = signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000);
  const info = await fetch(`${base()}/api/show`, {
    method: 'POST', redirect: 'error', signal: deadline,
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model }),
  });
  if (!info.ok) throw await failure(info);
  const metadata = await info.json();
  if (metadata.remote_model || metadata.remote_host || !metadata.details?.parameter_size) {
    throw new Error('Only downloaded local models are allowed');
  }
  const res = await fetch(`${base()}/api/chat`, {
    method: 'POST',
    redirect: 'error',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      keep_alive: 0, // release model memory after every reply
      options: { temperature: 0.75, num_predict: 240, num_ctx: 4096 },
    }),
    signal: deadline,
  });
  if (!res.ok) throw await failure(res);
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.error) throw new Error(msg.error);
      const piece = msg.message?.content || ''; // a thinking model's reasoning comes apart, and is left out
      if (piece) {
        text += piece;
        onDelta(piece);
      }
      if (msg.done) return text;
    }
  }
  return text;
}

module.exports = { models, unload, chat, base };
