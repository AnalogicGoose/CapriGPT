'use strict';

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

function fact(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > 1000) throw Error('Use 1–1000 characters per memory.');
  // Credentials belong in a password manager, never in assistant memory.
  if (/\b(password|contrase[ñn]a|api[ _-]?key|access[ _-]?token|private[ _-]?key|seed phrase|recovery phrase)\b|sk-[a-z0-9_-]{16,}|-----BEGIN .*PRIVATE KEY/i.test(text)) {
    throw Error('Please keep credentials and recovery secrets in a password manager.');
  }
  return text.trim();
}

class MemoryStore {
  constructor(file, { now = () => new Date(), retentionDays = () => 90 } = {}) {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.now = now;
    this.retentionDays = retentionDays;
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA secure_delete=ON;
      PRAGMA journal_mode=DELETE;
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL,
        source TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        confirmed_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS agent_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL,
        status TEXT NOT NULL, created_at TEXT NOT NULL);
      `);
    // Profile facts share normal edit/delete/retention controls, but can be
    // recalled without a keyword match. Existing memories stay ordinary.
    if (!this.db.prepare('PRAGMA table_info(memories)').all().some(column => column.name === 'profile')) {
      this.db.exec('ALTER TABLE memories ADD COLUMN profile INTEGER NOT NULL DEFAULT 0 CHECK(profile IN (0,1));');
    }
    this.db.exec('PRAGMA user_version=3;');
    this.prune();
  }
  prune() {
    // Operational journal contains codes only, never goals, titles or model output.
    this.db.prepare('DELETE FROM agent_events WHERE created_at < ?').run(new Date(this.now().getTime() - 7 * 86400000).toISOString());
    const days = this.retentionDays();
    if (Number.isInteger(days) && days > 0) {
      const cutoff = new Date(this.now().getTime() - days * 86400000).toISOString();
      this.db.prepare('DELETE FROM memories WHERE updated_at < ?').run(cutoff);
    }
  }
  audit(kind, status) {
    if (!['decision', 'action'].includes(kind) || !['wait', 'suggest', 'propose_close', 'cancelled', 'unavailable', 'cancelled-or-failed', 'still-running', 'closed'].includes(status)) throw Error('Invalid agent journal code.');
    this.prune();
    this.db.prepare('INSERT INTO agent_events(kind,status,created_at) VALUES (?,?,?)').run(kind, status, this.now().toISOString());
    this.db.exec('DELETE FROM agent_events WHERE id NOT IN (SELECT id FROM agent_events ORDER BY id DESC LIMIT 500)');
  }
  remember(text, source = 'explicit', { profile = false } = {}) {
    text = fact(text);
    if (!['explicit', 'conversation-confirmed', 'user-edit'].includes(source)) throw Error('Invalid memory source.');
    this.prune();
    const existing = this.db.prepare('SELECT * FROM memories WHERE text = ?').get(text);
    if (existing) {
      if (profile && !existing.profile) this.db.prepare('UPDATE memories SET profile=1 WHERE id=?').run(existing.id);
      return this.get(existing.id);
    }
    const at = this.now().toISOString();
    const result = this.db.prepare('INSERT INTO memories(text,source,created_at,updated_at,confirmed_at,profile) VALUES (?,?,?,?,?,?)')
      .run(text, source, at, at, at, profile ? 1 : 0);
    return this.get(Number(result.lastInsertRowid));
  }
  get(id) { this.prune(); return this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id); }
  edit(id, text) {
    text = fact(text);
    this.prune();
    const at = this.now().toISOString();
    this.db.prepare('UPDATE memories SET text=?,source=?,updated_at=?,confirmed_at=? WHERE id=?')
      .run(text, 'user-edit', at, at, id);
    return this.get(id);
  }
  forget(id) { return Number(this.db.prepare('DELETE FROM memories WHERE id=?').run(id).changes); }
  applyChanges(changes, expected) {
    this.prune();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const row of expected) {
        const current = this.get(row.id);
        if (!current || current.text !== row.text || current.updated_at !== row.updated_at || current.profile !== row.profile) throw Error('A saved memory changed during review. Please try again.');
      }
      for (const change of changes) {
        if (change.kind === 'add') this.remember(change.text, 'explicit');
        else if (change.kind === 'edit') this.edit(change.id, change.text);
        else if (change.kind === 'forget') this.forget(change.id);
        else throw Error('Invalid memory change.');
      }
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  clear() { this.db.exec('DELETE FROM memories; VACUUM;'); }
  list(limit = 100) {
    this.prune();
    return this.db.prepare('SELECT * FROM memories ORDER BY updated_at DESC,id DESC LIMIT ?').all(Math.min(1000, Math.max(1, limit)));
  }
  profile(limit = 3) {
    this.prune();
    return this.db.prepare('SELECT * FROM memories WHERE profile=1 ORDER BY id LIMIT ?').all(Math.min(6, Math.max(1, limit)));
  }
  search(query, limit = 5) {
    this.prune();
    const words = [...new Set(String(query).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [])]
      .filter(w => !new Set(['what', 'about', 'tell', 'remember', 'recall', 'the', 'and', 'that', 'you', 'your', 'know', 'does', 'have', 'with', 'que', 'para', 'como', 'sobre', 'recuerda']).has(w)).slice(0, 12);
    if (!words.length) return [];
    const where = words.map(() => "lower(text) LIKE ? ESCAPE '\\'").join(' OR ');
    const args = words.map(w => `%${w.replace(/[\\%_]/g, '\\$&')}%`);
    return this.db.prepare(`SELECT * FROM memories WHERE ${where} ORDER BY updated_at DESC,id DESC LIMIT 100`)
      .all(...args).map(row => ({ row, score: words.filter(w => row.text.toLowerCase().includes(w)).length }))
      .sort((a, b) => b.score - a.score).slice(0, limit).map(({ row }) => row);
  }
  export() {
    this.prune();
    return JSON.stringify({ version: 1, exported_at: this.now().toISOString(), memories:
      this.db.prepare('SELECT * FROM memories ORDER BY id').all() }, null, 2);
  }
  close() { this.db.close(); }
}

// Conservative, local-only candidate detection. No transcript, embeddings or extraction call.
// Every candidate (including seemingly ordinary facts) needs explicit confirmation.
function candidate(text) {
  if (typeof text !== 'string' || text.length > 1000 || /[?？]|\b(if|imagine|suppose|pretend|example)\b/i.test(text)) return null;
  if (/^(?:my (?:name|birthday|favorite|favourite|job|address|partner|wife|husband|diagnosis)\b|i (?:prefer|like|love|live|work|study|have|am allergic)\b|mi (?:nombre|cumplea[ñn]os|favorito|trabajo|direcci[oó]n)\b|(?:prefiero|me gusta|vivo|trabajo|estudio|soy al[eé]rgic)\b)/i.test(text.trim())) {
    return fact(text);
  }
  return null;
}

module.exports = { MemoryStore, candidate, fact };
