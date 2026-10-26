'use strict';
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PermissionRequest', 'PostToolUse', 'Stop', 'Interrupt', 'SessionEnd'];
const STAGES = new Set(['ready', 'working', 'waiting', 'tool_failed', 'completed', 'interrupted', 'closed']);
const clean = (value, length = 120) => String(value || '').replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, length);

// Deliberately omit prompts, command arguments, file paths, transcripts and answer text.
function fromHook(input) {
  if (!input || !EVENTS.includes(input.hook_event_name)) return null;
  const stage = { SessionStart: 'ready', UserPromptSubmit: 'working', PreToolUse: 'working',
    PermissionRequest: 'waiting', PostToolUse: 'working', Stop: 'completed', Interrupt: 'interrupted', SessionEnd: 'closed' }[input.hook_event_name];
  const failed = input.hook_event_name === 'PostToolUse'
    && (input.tool_response?.isError === true || (typeof input.tool_response?.exit_code === 'number' && input.tool_response.exit_code !== 0));
  return { version: 1, provider: 'codex', id: randomUUID(), sessionId: clean(input.session_id),
    turnId: clean(input.turn_id), project: clean(path.win32.basename(String(input.cwd || '').replace(/\/+$/, '')) || 'Codex'),
    stage: failed ? 'tool_failed' : stage, tool: clean(input.tool_name, 80), at: Date.now() };
}

function normalize(input) {
  if (!input || input.version !== 1 || input.provider !== 'codex' || !STAGES.has(input.stage)
    || typeof input.sessionId !== 'string' || !input.sessionId || typeof input.id !== 'string'
    || !Number.isFinite(input.at)) throw new Error('Invalid Codex companion event');
  return { version: 1, provider: 'codex', id: clean(input.id), sessionId: clean(input.sessionId),
    turnId: clean(input.turnId), project: clean(input.project) || 'Codex', stage: input.stage,
    tool: clean(input.tool, 80), at: input.at, demo: input.demo === true };
}

class CodexEvents {
  constructor() { this.sessions = new Map(); this.seen = new Set(); this.lastSeen = null; }
  accept(input) {
    const event = normalize(input);
    if (this.seen.has(event.id)) return null;
    this.seen.add(event.id);
    if (this.seen.size > 512) this.seen.delete(this.seen.values().next().value);
    if (!event.demo) this.lastSeen = Date.now();
    const key = `${event.sessionId}:${event.turnId}`;
    const previous = this.sessions.get(key);
    // Background hook processes can arrive late: a finished turn must stay finished.
    if (previous && (previous.at > event.at || ['completed', 'interrupted', 'closed'].includes(previous.stage))) return null;
    if (event.turnId && event.stage === 'working') {
      for (const [id, entry] of this.sessions) {
        if (entry.sessionId === event.sessionId && entry.turnId && entry.turnId !== event.turnId
          && !['completed', 'interrupted', 'closed'].includes(entry.stage) && entry.at <= event.at) this.sessions.delete(id);
      }
    }
    this.sessions.delete(key);
    this.sessions.set(key, event);
    if (this.sessions.size > 64) this.sessions.delete(this.sessions.keys().next().value);
    if (event.stage === 'closed') {
      for (const [id, entry] of this.sessions) if (entry.sessionId === event.sessionId) this.sessions.set(id, { ...entry, stage: 'closed' });
    }
    return event;
  }
  snapshot() { return { lastSeen: this.lastSeen, sessions: [...this.sessions.values()].slice(-20) }; }
}
module.exports = { EVENTS, fromHook, normalize, CodexEvents };
