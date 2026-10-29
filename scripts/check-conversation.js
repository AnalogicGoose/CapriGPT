'use strict';
// Synthetic dialogue only; no user profile, microphone or desktop observation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ollama = require('../src/main/ollama');
const capabilities = require('../src/main/capabilities');
const { packConversation, cost } = require('../src/main/conversation-context');

(async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/renderer/js/chat.js'), 'utf8')
    .replace("import { pick, fmt } from './util.js';", 'const pick = items => items[0]; const fmt = text => text;');
  const { Chat, clean } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const chat = new Chat({ host: { onChatDelta() {} }, brain: { lang: 'en', context: () => 'No PC observations or task events supplied for this test.' } });
  const cfg = { gamingMode: false, agentEnabled: true, desktopActions: true, privacy: { memoryEnabled: false } };
  const cases = [
    { name: 'practical answer without recurring lore', history: [
      { role: 'user', content: 'Can you help plan a small portfolio website?' },
      { role: 'assistant', content: 'Sure, choom. Maybe someday we will reach that satellite.' },
      { role: 'user', content: 'Give me three concrete first steps for building the portfolio. Keep it practical.' },
    ], check: answer => { assert.doesNotMatch(answer, /satellite|orbit|capricorn/i); assert.ok(answer.length > 120); } },
    { name: 'older constraints and newer correction', history: (() => {
      const history = [
        { role: 'user', content: 'Our project is Orchid. The budget is 430 quetzales. We need it offline, with no subscription.' },
        { role: 'assistant', content: 'Got it.' },
        { role: 'user', content: 'Correction: the Orchid budget is 570 quetzales now. Keep the offline and no subscription requirements.' },
        { role: 'assistant', content: 'Understood.' },
      ];
      for (let i = 0; i < 35; i++) history.push({ role: 'user', content: `Design discussion ${i}: ` + 'We are considering layout spacing, readable labels and color contrast. '.repeat(10) }, { role: 'assistant', content: 'A straightforward layout would work. '.repeat(10) });
      history.push({ role: 'user', content: '¿Cuál es el presupuesto actual de Orchid y qué restricciones acordamos? Responde en español.' });
      return history;
    })(), check: answer => {
      assert.match(answer, /570/);
      // Mentioning the previous budget while explaining its correction is valid.
      assert.doesNotMatch(answer.replace(/\*/g, ''), /presupuesto\s+(?:actual\s+)?(?:es|sigue siendo)\s+(?:de\s+)?430/i);
      assert.match(answer, /offline|sin conexi[oó]n|sin internet/i);
      assert.match(answer, /sin (?:\w+\s+){0,2}suscripci[oó]n/i);
      assert.doesNotMatch(answer, /Windows|Ollama|gratuit/i, 'Do not invent a platform requirement or turn no subscription into free-only.');
      assert.doesNotMatch(answer, /\b(?:completamente|totalmente|solo|s[oó]lo|necesita|requiere)\s+(?:estar\s+)?en l[ií]nea/i,
        'Calling an offline requirement online is contradictory, even if the word offline is also present.');
    } },
    { name: 'code punctuation survives the UI cleanup', history: [
      { role: 'user', content: 'Write only a Python function named my_func taking user_name and returning "Hi " + user_name. Preserve the underscores and indentation.' },
    ], check: answer => { assert.match(answer, /def my_func\(user_name\):/); assert.match(answer, /\n +return .*user_name/); } },
  ];
  const results = [];
  for (const scenario of cases) {
    chat.history = scenario.history;
    const messages = capabilities.inject([{ role: 'system', content: chat.persona() }, ...scenario.history], cfg);
    const packed = packConversation(messages);
    const started = Date.now();
    let usage;
    const answer = clean(await ollama.chat({ model: 'qwen3.5:9b', messages }, () => {
      usage ||= fetch(`${ollama.base()}/api/ps`).then(res => res.json()).catch(() => null);
    }));
    const running = await usage;
    const allocation = running?.models?.map(m => ({ model: m.name, context: m.context_length, size: m.size, size_vram: m.size_vram }));
    const result = { name: scenario.name, seconds: (Date.now() - started) / 1000, inputMessages: messages.length,
      packedMessages: packed.length, conservativePromptUnits: packed.reduce((n, m) => n + cost(m), 0), allocation, answer };
    results.push(result);
    console.log(JSON.stringify(result));
    scenario.check(answer);
  }
  const output = path.join(__dirname, '../.caprigpt-local/conversation-check');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log('PASS: real local Qwen conversation checks.');
})().catch(error => { console.error(error); process.exitCode = 1; });
