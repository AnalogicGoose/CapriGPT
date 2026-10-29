'use strict';

const os = require('node:os');

const DEFAULT_PRIVACY = Object.freeze({
  memoryEnabled: false, memoryCandidates: false, memoryRecall: true, memoryConfirmChanges: false, retentionDays: 90,
  contextTime: true, contextPower: true, contextForeground: true, contextTitles: true,
  contextProcesses: true, contextPerformance: true, contextEvents: true, allApps: true,
  processAllowlist: ['code', 'chrome', 'firefox', 'spotify', 'discord'],
  promptBudget: 800,
});

function permissions(input = {}) {
  if (!input || typeof input !== 'object') input = {};
  const result = { ...DEFAULT_PRIVACY };
  for (const [key, value] of Object.entries(input)) {
    if (typeof DEFAULT_PRIVACY[key] === 'boolean' && typeof value === 'boolean') result[key] = value;
  }
  if ([0, 30, 90, 365].includes(input.retentionDays)) result.retentionDays = input.retentionDays;
  if (Number.isInteger(input.promptBudget)) result.promptBudget = Math.max(0, Math.min(800, input.promptBudget));
  if (Array.isArray(input.processAllowlist)) result.processAllowlist = [...new Set(input.processAllowlist
    .filter(n => typeof n === 'string' && /^[\p{L}\p{N} _.-]{1,60}$/u.test(n)).map(n => n.toLowerCase().replace(/\.exe$/, '')))].slice(0, 30);
  return result;
}

function windowsSnapshot(options) {
  if (process.platform !== 'win32') return Promise.resolve({ unavailable: 'Windows provider unavailable' });
  return Promise.resolve().then(() => require('./native-windows').context(options));
}

function appAllowed(name, options) {
  if (typeof name !== 'string' || !name || name.length > 260 || /[\x00-\x1f\\/]/.test(name)) return false;
  return options.allApps || options.processAllowlist.includes(name.toLowerCase().replace(/\.exe$/, ''));
}

class ContextService {
  constructor({ settings, provider = windowsSnapshot, now = () => new Date(), system = os } = {}) {
    this.settings = settings;
    this.provider = provider;
    this.now = now;
    this.system = system;
    this.lastEvent = null;
  }
  async snapshot(reason = 'on-demand', fields = null) {
    const cfg = this.settings();
    const p = permissions(cfg.privacy);
    if (fields) {
      for (const key of ['contextTime', 'contextPerformance', 'contextForeground', 'contextProcesses', 'contextPower']) {
        if (!fields.includes(key)) p[key] = false;
      }
      if (!p.contextForeground) p.contextTitles = false;
    }
    if (cfg.gamingMode) return { unavailable: 'Gaming mode' };
    const result = { collected_at: this.now().toISOString(), source: 'on-demand-pc', reason };
    if (p.contextTime) result.time = { local: this.now().toString(), weekday: this.now().toLocaleDateString('en-US', { weekday: 'long' }) };
    if (p.contextPerformance) {
      try {
        result.performance = { ram_total: this.system.totalmem(), ram_free: this.system.freemem(),
          // Cumulative CPU utilization since boot, never a blocking sample loop.
          cpu_average_since_boot: cpuAverage(this.system.cpus()) };
      } catch { result.performance = { unavailable: true }; }
    }
    if (p.contextForeground || p.contextProcesses || p.contextPower) {
      try {
        const data = await this.provider(p);
        // Recheck permission revocation / gaming mode after asynchronous work.
        const current = this.settings();
        if (current.gamingMode) return { unavailable: 'Gaming mode' };
        const fresh = permissions(current.privacy);
        const cleanName = n => appAllowed(n, p) && appAllowed(n, fresh);
        if (p.contextForeground && fresh.contextForeground && cleanName(data.foreground?.app)) {
          result.foreground = { app: data.foreground.app };
          if (p.contextTitles && fresh.contextTitles && typeof data.foreground.title === 'string') result.foreground.title = data.foreground.title.slice(0, 200);
        }
        if (p.contextProcesses && fresh.contextProcesses) {
          const names = [...new Set((data.processes || []).filter(cleanName))];
          result.processes = names.slice(0, 512);
          if (names.length > 512) result.processes_truncated = true;
          if (Array.isArray(data.apps)) result.apps = [...new Set(data.apps.filter(cleanName))].slice(0, 256);
        }
        if (p.contextPower && fresh.contextPower) result.power = data.power || { unavailable: true };
        if (data.unavailable) result.provider = { unavailable: true };
      } catch { result.provider = { unavailable: true }; }
    }
    // Discard fields revoked while collecting, including purely local providers.
    const fresh = permissions(this.settings().privacy);
    if (!fresh.contextTime) delete result.time;
    if (!fresh.contextPerformance) delete result.performance;
    return result;
  }
  // No timer or OS hook: callers trigger this only for a meaningful existing app event.
  async onEvent(event) {
    if (!permissions(this.settings().privacy).contextEvents || !['resume', 'power-change'].includes(event)) return null;
    const snapshot = await this.snapshot(event);
    if (!this.settings().gamingMode && permissions(this.settings().privacy).contextEvents) {
      this.lastEvent = snapshot;
      clearTimeout(this.expiry);
      this.expiry = setTimeout(() => { this.lastEvent = null; }, 60000);
      this.expiry.unref?.();
    }
    return snapshot;
  }
  eventSnapshot() {
    const cfg = this.settings(), p = permissions(cfg.privacy);
    if (!p.contextEvents || cfg.gamingMode || !this.lastEvent
      || this.now().getTime() - Date.parse(this.lastEvent.collected_at) > 60000) {
      this.lastEvent = null; return null;
    }
    const snapshot = structuredClone(this.lastEvent);
    if (!p.contextTime) delete snapshot.time;
    if (!p.contextPower) delete snapshot.power;
    if (!p.contextPerformance) delete snapshot.performance;
    for (const key of ['processes', 'apps']) {
      if (!p.contextProcesses) delete snapshot[key];
      else if (snapshot[key]) snapshot[key] = snapshot[key].filter(n => appAllowed(n, p));
    }
    if (!p.contextProcesses) delete snapshot.processes_truncated;
    if (!p.contextForeground || !appAllowed(snapshot.foreground?.app, p)) delete snapshot.foreground;
    else if (!p.contextTitles) delete snapshot.foreground.title;
    this.lastEvent = snapshot;
    return snapshot;
  }
}

function cpuAverage(cpus) {
  const totals = cpus.reduce((a, cpu) => {
    a.idle += cpu.times.idle; a.total += Object.values(cpu.times).reduce((s, n) => s + n, 0); return a;
  }, { idle: 0, total: 0 });
  return totals.total ? Math.round(100 * (1 - totals.idle / totals.total)) : null;
}

function needsContext(text) {
  return contextFields(text).length > 0;
}

function contextFields(text) {
  if (/\b(pc|computer|laptop|desktop|computadora|equipo)\b/i.test(text)
    && /\b(what|status|happening|going on|doing|activity|check|estado|pasando)\b/i.test(text)) {
    return ['contextTime', 'contextPower', 'contextProcesses', 'contextForeground', 'contextPerformance'];
  }
  const fields = [];
  if (/\b(time|day|date|hora|fecha|d[ií]a)\b/i.test(text)) fields.push('contextTime');
  if (/\b(battery|charging|plug|power|bater[ií]a|cargando|enchufado)\b/i.test(text)) fields.push('contextPower');
  if (/\b(apps?|programs?|processes|running|aplicaciones|programas|procesos)\b/i.test(text)) fields.push('contextProcesses');
  if (/\b(foreground|windows?|ventanas?)\b/i.test(text)) fields.push('contextForeground');
  if (/\b(cpu|ram|memory usage|performance|rendimiento)\b/i.test(text)) fields.push('contextPerformance');
  return fields;
}

function isAppQuery(text) {
  text = text.normalize('NFD').replace(/\p{M}/gu, '').replace(/\bwhat(?:['’]s|s)\b/gi, 'what is');
  return /\b(apps?|programs?|processes|aplicaciones|programas|procesos|pc|computer|laptop|desktop|computadora|equipo)\b/i.test(text)
    && /\b(open|opened|openned|running|active|abiert[oa]s?|ejecutando)\b/i.test(text)
    && /\b(what|which|list|show|tell|see|are|que|cuales|muestra|lista)\b/i.test(text)
    && !/\b(open source|how to|how do|how can|can you open|should i open)\b/i.test(text)
    && !/\b(close|quit|kill|shut|cierra|cerrar|abre|launch)\b/i.test(text);
}

module.exports = { DEFAULT_PRIVACY, permissions, ContextService, windowsSnapshot, needsContext, contextFields, isAppQuery };
