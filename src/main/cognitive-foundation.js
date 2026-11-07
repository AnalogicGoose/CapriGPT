'use strict';

// Bounded local curiosity journal. This is NOT personal memory and never
// authorizes a tool call or a spontaneous interruption.
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const WINDOW_MS = 10 * 60_000;
const COOLDOWN_MS = 30 * 60_000;
const MAX_QUESTIONS = 100;
const VALID_APP = /^[\\p{L}\\p{N} ._+()-]{1,80}$/u;

class CognitiveFoundation {
  constructor({ file = ':memory:', settings = () => ({}), context, now = Date.now } = {}) {
    if (!context || typeof context.snapshot !== 'function') throw Error('Context service required.');
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA secure_delete=ON;
      CREATE TABLE IF NOT EXISTS curiosity_questions (
        id INTEGER PRIMARY KEY, question TEXT NOT NULL, subject TEXT NOT NULL,
        evidence TEXT NOT NULL, confidence REAL NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('open','dismissed','resolved')),
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS curiosity_subject_status
        ON curiosity_questions(subject, status) WHERE status='open';`);
    this.settings = settings;
    this.context = context;
    this.now = now;
    this.seen = new Map();
    this.last = new Map();
    this.closed = false;
    this.busy = false;
  }

  allowed() {
    const cfg = this.settings();
    const p = require('./pc-context').permissions(cfg.privacy);
    return cfg.cognitiveEnabled !== false && cfg.agentEnabled !== false &&
      !cfg.gamingMode && p.contextEvents && p.contextForeground;
  }

  async foregroundChanged() {
    if (!this.allowed() || this.busy || this.closed) return null;
    this.busy = true;
    try {
      const snapshot = await this.context.snapshot('curiosity-foreground', ['contextForeground']);
      // Revalidate after awaiting native collection / revoked permissions.
      if (!this.allowed() || snapshot.unavailable || snapshot.provider?.unavailable) return null;
      return this.observeApp(snapshot.foreground?.app);
    } finally { this.busy = false; }
  }

  observeApp(value) {
    if (!this.allowed() || this.closed) return null;
    const app = String(value || '').trim();
    if (!VALID_APP.test(app)) return null;
    const subject = app.toLowerCase();
    const time = this.now();
    const previous = this.seen.get(subject) || [];
    const seen = previous.filter(t => time - t >= 0 && time - t <= WINDOW_MS);
    seen.push(time);
    this.seen.set(subject, seen.slice(-10));
    if (this.seen.size > 100) this.seen.delete(this.seen.keys().next().value);
    if (seen.length < 3 || time - (this.last.get(subject) ?? -Infinity) < COOLDOWN_MS) return null;
    this.last.set(subject, time);
    const existing = this.db.prepare("SELECT * FROM curiosity_questions WHERE subject=? AND status='open'").get(subject);
    if (existing) return existing;
    // Store only a validated application name and event count, never window titles,
    // screenshots, typed text, conversation transcripts or process inventories.
    const question = `The user returned to ${app} several times. Is there a useful reason to offer help, or should I stay quiet?`;
    const result = this.db.prepare(`INSERT INTO curiosity_questions
      (question,subject,evidence,confidence,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?)`).run(question, subject, 'foreground-activation-repeated', 0.35, 'open', time, time);
    this.prune();
    return this.db.prepare('SELECT * FROM curiosity_questions WHERE id=?').get(Number(result.lastInsertRowid));
  }

  list(limit = 20) {
    return this.db.prepare('SELECT * FROM curiosity_questions ORDER BY updated_at DESC LIMIT ?')
      .all(Math.min(100, Math.max(1, limit)));
  }

  update(id, status) {
    if (!['dismissed','resolved'].includes(status)) throw Error('Invalid question status.');
    const result = this.db.prepare("UPDATE curiosity_questions SET status=?, updated_at=? WHERE id=? AND status='open'")
      .run(status, this.now(), id);
    return Number(result.changes) === 1;
  }

  prune() {
    const cutoff = this.now() - 30 * 86_400_000;
    this.db.prepare('DELETE FROM curiosity_questions WHERE updated_at < ?').run(cutoff);
    this.db.exec(`DELETE FROM curiosity_questions WHERE id NOT IN
      (SELECT id FROM curiosity_questions ORDER BY updated_at DESC LIMIT ${MAX_QUESTIONS})`);
  }

  clear() {
    this.db.exec('DELETE FROM curiosity_questions');
    this.seen.clear();
    this.last.clear();
  }

  status() {
    return { enabled: this.allowed(), busy: this.busy, questions: this.list().length,
      modelCalls: 0, unsolicitedMessages: 0, stage: 'observation-only' };
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.db.close();
  }
}

module.exports = { CognitiveFoundation };
