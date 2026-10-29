'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { MemoryStore, candidate } = require('../src/main/memory');
const { permissions, ContextService, contextFields, isAppQuery } = require('../src/main/pc-context');
const { PersonalAssistant } = require('../src/main/personal-assistant');
const RESTRICTED = { allApps: false, contextPower: false, contextForeground: false,
  contextTitles: false, contextProcesses: false, contextPerformance: false, contextEvents: false };

function fixture(t, privacy = {}) {
  const cfg = { privacy: { ...RESTRICTED, memoryEnabled: true, memoryConfirmChanges: true, ...privacy } };
  const store = new MemoryStore(':memory:');
  t.after(() => store.close());
  let approved = true, confirms = 0, collections = 0, exported;
  const context = new ContextService({ settings: () => cfg, provider: async () => { collections++; return {}; } });
  const assistant = new PersonalAssistant({ settings: () => cfg, store: () => store, context,
    confirm: async () => { confirms++; return approved; },
    exportFile: async text => { exported = JSON.parse(text); return true; } });
  return { cfg, store, context, assistant, approve: value => { approved = value; },
    stats: () => ({ confirms, collections, exported }) };
}

test('SQLite survives restart, records provenance, edits without changing creation date, literal search and forget', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capri-memory-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'memory.sqlite');
  let at = new Date('2026-10-01T00:00:00Z');
  let store = new MemoryStore(file, { now: () => at });
  const row = store.remember('My favorite language is Spanish');
  assert.equal(row.source, 'explicit');
  assert.equal(row.confirmed_at, at.toISOString());
  assert.equal(store.remember(row.text).id, row.id, 'deduplicate exact memories');
  store.close();
  store = new MemoryStore(file, { now: () => at });
  try {
    assert.equal(store.search('Spanish')[0].id, row.id);
    assert.deepEqual(store.search("%' OR 1=1 --"), []);
    at = new Date('2026-10-02T00:00:00Z');
    const changed = store.edit(row.id, 'My favorite language is English');
    assert.equal(changed.created_at, row.created_at);
    assert.equal(changed.updated_at, at.toISOString());
    assert.equal(changed.source, 'user-edit');
    assert.deepEqual(store.search('Spanish'), []);
    assert.equal(store.forget(row.id), 1);
    assert.deepEqual(JSON.parse(store.export()).memories, []);
    assert.deepEqual(store.search('English'), []);
  } finally { store.close(); }
});

test('retention applies before reads, search and exports, with an explicit keep-until-deleted option', () => {
  let at = new Date('2026-01-01T00:00:00Z'), days = 30;
  const store = new MemoryStore(':memory:', { now: () => at, retentionDays: () => days });
  try {
    store.remember('I like coffee');
    at = new Date('2026-03-01T00:00:00Z');
    assert.deepEqual(store.search('coffee'), []);
    assert.deepEqual(JSON.parse(store.export()).memories, []);
    days = 0;
    store.remember('I like tea');
    at = new Date('2028-01-01T00:00:00Z');
    assert.equal(store.search('tea').length, 1);
    store.clear();
    assert.deepEqual(store.list(), []);
  } finally { store.close(); }
});

test('profile facts survive restart and recall without keywords; edits, forgetting and memory switches still apply', async t => {
  const f = fixture(t);
  const row = f.store.remember('Uses English and Spanish; plays Cyberpunk 2077.', 'explicit', { profile: true });
  f.store.remember('An unrelated ordinary saved note');
  const messages = [{ role: 'system', content: 'Persona' }, { role: 'user', content: 'Hello!' }];
  let result = await f.assistant.augment(messages);
  assert.match(result[0].content, /Cyberpunk/);
  assert.doesNotMatch(result[0].content, /unrelated ordinary/);
  assert.ok(Buffer.byteLength(result[0].content.slice('Persona'.length)) <= 801);
  f.store.edit(row.id, 'Uses English and Spanish; enjoys useful coding projects.');
  result = await f.assistant.augment(messages);
  assert.match(result[0].content, /coding projects/);assert.doesNotMatch(result[0].content, /Cyberpunk/);
  f.cfg.privacy.memoryRecall = false;
  assert.deepEqual(await f.assistant.augment(messages), messages);
  f.cfg.privacy.memoryRecall = true;f.cfg.privacy.memoryEnabled = false;
  assert.deepEqual(await f.assistant.augment(messages), messages);
  f.cfg.privacy.memoryEnabled = true;f.store.forget(row.id);
  assert.deepEqual(await f.assistant.augment(messages), messages);
});

test('existing version-two SQLite memories migrate without being promoted to profile facts', t => {
  const { DatabaseSync } = require('node:sqlite');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capri-profile-migration-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'memory.sqlite');
  const old = new DatabaseSync(file);
  old.exec("CREATE TABLE memories(id INTEGER PRIMARY KEY AUTOINCREMENT,text TEXT NOT NULL,source TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,confirmed_at TEXT NOT NULL); PRAGMA user_version=2;");
  const at = new Date().toISOString();
  old.prepare('INSERT INTO memories(text,source,created_at,updated_at,confirmed_at) VALUES (?,?,?,?,?)').run('Existing fact', 'explicit', at, at, at);old.close();
  let store = new MemoryStore(file);
  assert.equal(store.list()[0].text, 'Existing fact');assert.deepEqual(store.profile(), []);
  store.remember('Confirmed profile fact', 'explicit', {profile:true});store.close();
  store = new MemoryStore(file);
  assert.equal(store.profile()[0].text, 'Confirmed profile fact');store.close();
});

test('all candidates including health and explicit facts need confirmation; secrets are refused', async t => {
  const f = fixture(t, { memoryCandidates: true });
  f.approve(false);
  assert.match((await f.assistant.route('My diagnosis is private')).text, /not saved/);
  assert.match((await f.assistant.route('remember that I prefer Spanish')).text, /not saved/);
  assert.equal(f.store.list().length, 0);
  f.approve(true);
  assert.match((await f.assistant.route('I prefer Spanish')).text, /Saved memory/);
  assert.equal(f.store.list()[0].source, 'conversation-confirmed');
  assert.match((await f.assistant.route('edit memory 1: I prefer English')).text, /Updated/);
  assert.equal(f.store.list()[0].source, 'user-edit');
  assert.match((await f.assistant.route('recall English')).text, /English/);
  await assert.rejects(f.assistant.route('remember my password is abc'), /password manager/);
  assert.equal(candidate('Imagine I prefer tea'), null);
  assert.equal(candidate('Do I like coffee?'), null);
  assert.equal((await f.assistant.route('Explain recursion')).handled, false);
  assert.equal(f.stats().confirms, 4);
});

test('disabled memory prevents save and recall; existing data can be exported and deleted', async t => {
  const f = fixture(t);
  f.store.remember('I like coffee');
  f.cfg.privacy.memoryEnabled = false;
  assert.match((await f.assistant.route('remember I like tea')).text, /off/);
  assert.match((await f.assistant.route('recall coffee')).text, /off/);
  await f.assistant.route('/memory export');
  assert.equal(f.stats().exported.memories.length, 1);
  f.approve(false);
  await f.assistant.route('/memory delete-all');
  assert.equal(f.store.list().length, 1);
  f.approve(true);
  await f.assistant.route('forget 1');
  assert.equal(f.store.list().length, 0);
});

test('permission revoked during confirmation prevents a write', async t => {
  const f = fixture(t);
  f.assistant.confirm = async () => { f.cfg.privacy.memoryEnabled = false; return true; };
  assert.match((await f.assistant.route('remember I like coffee')).text, /turned off/);
  assert.equal(f.store.list().length, 0);
});

test('invalid edit IDs cannot create a new memory', async t => {
  const f = fixture(t);
  assert.match((await f.assistant.route('edit memory 0: I like tea')).text, /not found/);
  assert.equal(f.store.list().length, 0);
  assert.equal(f.stats().confirms, 0);
});

test('requested saves, edits and individual removals need no dialog; suggested facts and delete-all still confirm', async t => {
  const f=fixture(t,{memoryConfirmChanges:false,memoryCandidates:true});
  assert.match((await f.assistant.route('remember I like games')).text,/Saved/);
  assert.match((await f.assistant.route('edit memory 1: I like coding')).text,/Updated/);
  assert.match((await f.assistant.route('forget 1')).text,/Forgot/);
  assert.equal(f.stats().confirms,0);
  f.approve(false);
  assert.match((await f.assistant.route('I like coffee')).text,/not saved/);
  assert.equal(f.stats().confirms,1);
  f.store.remember('Preserve this fact');
  assert.match((await f.assistant.route('/memory delete-all')).text,/cancelled/);
  assert.equal(f.stats().confirms,2);assert.equal(f.store.list().length,1);
});

test('context does not invoke disabled providers; allowlist and title gate filter mocked output', async () => {
  const cfg = { privacy: { ...RESTRICTED } };
  let calls = 0;
  const service = new ContextService({ settings: () => cfg, provider: async () => {
    calls++; return { foreground: { app: 'code', title: 'Private.txt' }, processes: ['code', 'secret-app', 'code'], power: { ac: 'Online' } };
  } });
  assert.ok((await service.snapshot()).time);
  assert.equal(calls, 0);
  cfg.privacy = { ...RESTRICTED, contextForeground: true, contextProcesses: true, contextPower: true };
  let snap = await service.snapshot();
  assert.deepEqual(snap.foreground, { app: 'code' });
  assert.deepEqual(snap.processes, ['code']);
  assert.equal(snap.power.ac, 'Online');
  cfg.privacy.contextTitles = true;
  snap = await service.snapshot();
  assert.equal(snap.foreground.title, 'Private.txt');
  cfg.privacy.processAllowlist = [];
  snap = await service.snapshot();
  assert.equal(snap.foreground, undefined);
  assert.deepEqual(snap.processes, []);
});

test('provider failures, permission revocation and gaming mode fail closed; no scheduled collection', async () => {
  const cfg = { privacy: { ...RESTRICTED, contextForeground: true, contextPerformance: true } };
  let calls = 0;
  const service = new ContextService({ settings: () => cfg,
    system: { totalmem: () => 32e9, freemem: () => 16e9, cpus: () => [{ times: { idle: 50, user: 50 } }] },
    provider: async () => { calls++; throw Error('provider failed with private output'); } });
  const snap = await service.snapshot();
  assert.ok(snap.time);
  assert.equal(snap.performance.cpu_average_since_boot, 50);
  assert.deepEqual(snap.provider, { unavailable: true });
  assert.equal(await service.onEvent('resume'), null);
  assert.equal(calls, 1);
  service.provider = async () => { cfg.privacy.contextForeground = false; cfg.privacy.contextPerformance = false; return { foreground: { app: 'code', title: 'Private' } }; };
  const revoked = await service.snapshot();
  assert.equal(revoked.foreground, undefined);
  assert.equal(revoked.performance, undefined);
  cfg.gamingMode = true;
  assert.deepEqual(await service.snapshot(), { unavailable: 'Gaming mode' });
});

test('selective recall and PC collection use latest user message, respect budget and never mutate history', async t => {
  const f = fixture(t, { promptBudget: 800, contextPower: true });
  f.store.remember('I prefer coffee');
  f.store.remember('My favorite music is jazz');
  const messages = [{ role: 'system', content: 'Persona' }, { role: 'user', content: 'What coffee do I prefer?' }];
  const original = JSON.stringify(messages);
  let result = await f.assistant.augment(messages);
  assert.match(result[0].content, /I prefer coffee/);
  assert.doesNotMatch(result[0].content, /jazz/);
  assert.ok(Buffer.byteLength(result[0].content.slice('Persona\n'.length)) <= 800);
  assert.equal(JSON.stringify(messages), original);
  assert.equal(f.stats().collections, 0);
  f.cfg.privacy.memoryRecall = false;
  result = await f.assistant.augment(messages);
  assert.equal(result[0].content, 'Persona');
  await f.assistant.augment([{ role: 'user', content: 'What is my battery level?' }]);
  assert.equal(f.stats().collections, 1);
  f.cfg.privacy.promptBudget = 0;
  result = await f.assistant.augment(messages);
  assert.equal(result[0].content, 'Persona');
  assert.equal(permissions({ contextTitles: 'false', processAllowlist: ["a'; Remove-Item", 'CODE.exe'] }).contextTitles, true);
  assert.deepEqual(permissions({ processAllowlist: ['CODE.exe', '*'] }).processAllowlist, ['code']);
});

test('forget during asynchronous snapshot prevents stale memory injection', async t => {
  const f = fixture(t, { contextPower: true, promptBudget: 800 });
  const saved = f.store.remember('My battery is special');
  f.context.provider = async () => { f.store.forget(saved.id); return {}; };
  const result = await f.assistant.augment([{ role: 'system', content: 'Persona' }, { role: 'user', content: 'battery special' }]);
  assert.doesNotMatch(result[0].content, /My battery is special/);
});

test('event snapshots require opt-in, have expiry and lose revoked fields', async () => {
  const cfg = { privacy: { ...RESTRICTED, contextEvents: true, contextTitles: true, contextForeground: true, contextProcesses: true } };
  let at = new Date('2026-10-01T00:00:00Z'), calls = 0;
  const service = new ContextService({ settings: () => cfg, now: () => at, provider: async () => {
    calls++; return { foreground: { app: 'code', title: 'Private' }, processes: ['code'] };
  } });
  try {
    assert.equal(await service.onEvent('random-keystroke'), null);
    await service.onEvent('resume');
    assert.equal(calls, 1);
    assert.equal(service.eventSnapshot().foreground.title, 'Private');
    cfg.privacy.contextTitles = false;
    assert.deepEqual(service.eventSnapshot().foreground, { app: 'code' });
    cfg.privacy.processAllowlist = [];
    assert.equal(service.eventSnapshot().foreground, undefined);
    assert.deepEqual(service.eventSnapshot().processes, []);
    at = new Date(at.getTime() + 61000);
    assert.equal(service.eventSnapshot(), null);
    cfg.privacy.contextEvents = false;
    assert.equal(await service.onEvent('resume'), null);
    assert.equal(calls, 1);
  } finally { clearTimeout(service.expiry); }
});

test('natural running-app questions return real allowlisted data without a model or unrelated collection', async t => {
  const f = fixture(t, { contextProcesses: true, contextForeground: true, contextTitles: true, contextPower: true, contextPerformance: true });
  let calls = 0;
  f.context.provider = async options => {
    calls++;
    assert.equal(options.contextProcesses, true);
    assert.equal(options.contextForeground, false);
    assert.equal(options.contextTitles, false);
    assert.equal(options.contextPower, false);
    assert.equal(options.contextPerformance, false);
    return { processes: ['code', 'chrome', 'secret-app'] };
  };
  const result = await f.assistant.route('capri which apps are open rn?');
  assert.equal(result.handled, true);
  assert.match(result.text, /Visual Studio Code, Google Chrome/);
  assert.match(result.text, /allowlist/);
  assert.doesNotMatch(result.text, /secret-app/);
  assert.equal(calls, 1);
  f.cfg.privacy.contextProcesses = false;
  assert.match((await f.assistant.route('what programs are running?')).text, /context is off/);
  assert.equal(calls, 1);
  assert.equal(isAppQuery('open Spotify'), false);
  assert.equal(isAppQuery('close the apps that are open'), false);
  assert.equal(isAppQuery('qué aplicaciones están abiertas ahora?'), true);
  assert.deepEqual(contextFields('which apps are open rn?'), ['contextProcesses']);
});

test('failed app provider is reported as unavailable rather than an empty list', async t => {
  const f = fixture(t, { contextProcesses: true });
  f.context.provider = async () => { throw Error('unavailable'); };
  assert.match((await f.assistant.route('which apps are open?')).text, /couldn’t read/);
});

test('app follow-ups explain the allowlist locally, and newly selected apps are supported', async t => {
  const f = fixture(t, { contextProcesses: true, processAllowlist: ['firefox', 'steamwebhelper', 'my-custom-app'] });
  let calls = 0;
  f.context.provider = async () => { calls++; return { processes: ['firefox', 'steamwebhelper', 'my-custom-app', 'chrome'] }; };
  const result = await f.assistant.route('which apps are open?');
  assert.match(result.text, /Firefox, Steam \(desktop interface\), my-custom-app/);
  assert.doesNotMatch(result.text, /Google Chrome/);
  const follow = await f.assistant.route('only those?');
  assert.equal(follow.handled, true);
  assert.match(follow.text, /not every app/);
  assert.match(follow.text, /Choose from open apps/);
  assert.equal(calls, 1, 'Follow-up explanations do not collect more data');
  f.assistant.lastAppQuestion = 0;
  assert.equal((await f.assistant.route('only those?')).handled, false);
});

test('all-app defaults include newly installed names, desktop apps and background processes without a list', async t => {
  const f = fixture(t);
  f.cfg.privacy = {};
  let calls = 0;
  f.context.provider = async p => {
    calls++;
    assert.equal(p.allApps, true);
    return { processes: ['brand-new-game', 'new-background-service', 'discord'], apps: ['brand-new-game', 'discord'] };
  };
  const result = await f.assistant.route('which apps are open?');
  assert.match(result.text, /Open desktop apps: brand-new-game, Discord/);
  assert.doesNotMatch(result.text, /new-background-service|allowlist/);
  assert.match((await f.assistant.route('only those?')).text, /including new apps/);
  assert.equal(calls, 1);
  assert.match((await f.assistant.route('is brand new game running?')).text, /is running/);
  assert.match((await f.assistant.route('what about Discord?')).text, /Discord is running/);
  assert.match((await f.assistant.route('which processes are running?')).text, /new-background-service/);
  assert.match((await f.assistant.route('is not-installed running?')).text, /wasn’t found/);
});

test('switching from all apps to restricted during collection filters new and cached observations', async () => {
  const cfg = { privacy: {} };
  const context = new ContextService({ settings: () => cfg, provider: async () => {
    cfg.privacy = { allApps: false, processAllowlist: ['code'] };
    return { processes: ['code', 'new-game'], apps: ['new-game'], foreground: { app: 'new-game', title: 'Private' } };
  } });
  const snapshot = await context.snapshot();
  assert.deepEqual(snapshot.processes, ['code']);
  assert.deepEqual(snapshot.apps, []);
  assert.equal(snapshot.foreground, undefined);
});

test('all-app mode does not retain the old 30-name cap and includes unknown foreground apps', async () => {
  const names = Array.from({ length: 75 }, (_, i) => `new-app-${i}`);
  const context = new ContextService({ settings: () => ({ privacy: {} }), provider: async () => ({
    processes: names, foreground: { app: 'new-app-74', title: 'New app window' },
  }) });
  const snapshot = await context.snapshot('test', ['contextProcesses', 'contextForeground']);
  assert.equal(snapshot.processes.length, 75);
  assert.equal(snapshot.foreground.app, 'new-app-74');
  assert.equal(snapshot.foreground.title, 'New app window');
  assert.ok(contextFields('what is happening on my PC?').includes('contextProcesses'));
});

test('exact screenshot wording and everyday variants bypass the model and report real apps', async t => {
  const f = fixture(t, { allApps: true, contextProcesses: true });
  f.context.provider = async () => ({ processes: ['firefox', 'discord'], apps: ['firefox', 'discord'] });
  for (const question of ['whats openned in my pc capri?', "what's opened on my computer?", 'what’s open on my laptop?', 'what is open on my desktop?']) {
    const result = await f.assistant.route(question);
    assert.equal(result.handled, true, question);
    assert.match(result.text, /^Open desktop apps: Firefox, Discord/);
  }
  assert.equal(isAppQuery('what is open source computer software?'), false);
  assert.equal(isAppQuery('how do apps open files on my PC?'), false);
});
