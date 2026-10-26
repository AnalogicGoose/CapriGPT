#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { EVENTS } = require('../src/main/codex-events');
const MARK = 'caprigpt-codex-hook.js';
function file() { return path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'hooks.json'); }
function read(target) {
  if (!fs.existsSync(target)) return {};
  const data = JSON.parse(fs.readFileSync(target, 'utf8'));
  if (!data || typeof data !== 'object' || Array.isArray(data) || (data.hooks && (typeof data.hooks !== 'object' || Array.isArray(data.hooks)))) throw Error('Invalid hooks configuration; nothing changed');
  return data;
}
function own(handler) { return handler?.type === 'command' && String(handler.command || '').includes(MARK); }
function status() {
  const target = file();
  const data = read(target);
  return { file: target, installed: EVENTS.every((event) => data.hooks?.[event]?.some((group) => group.hooks?.some(own))) };
}
function configure(remove = false) {
  const target = file();
  const data = read(target);
  const script = path.resolve(__dirname, '..', 'hooks', MARK).replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`).replace(/\\/g, '/');
  const command = `node "${script}"`;
  data.hooks ||= {};
  for (const event of EVENTS) {
    const groups = data.hooks[event] || [];
    if (!Array.isArray(groups)) throw Error(`Invalid ${event} configuration; nothing changed`);
    data.hooks[event] = groups.map((group) => {
      if (!Array.isArray(group.hooks)) throw Error(`Invalid ${event} handler; nothing changed`);
      return { ...group, hooks: group.hooks.filter((handler) => !own(handler)) };
    }).filter((group) => group.hooks.length);
    if (!remove) data.hooks[event].push({ hooks: [{ type: 'command', command, async: event !== 'SessionEnd', timeout: 2, statusMessage: 'Notify CapriGPT locally' }] });
    if (!data.hooks[event].length) delete data.hooks[event];
  }
  const content = JSON.stringify(data, null, 2) + '\n';
  if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') === content) return { file: target, changed: false };
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const backup = fs.existsSync(target) ? `${target}.caprigpt-backup-${Date.now()}` : null;
  if (backup) fs.copyFileSync(target, backup, fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(`${target}.caprigpt-tmp`, content, { flag: 'wx' });
  fs.renameSync(`${target}.caprigpt-tmp`, target);
  return { file: target, backup, changed: true, needsTrustReview: !remove };
}
if (require.main === module) {
  try { console.log(JSON.stringify(process.argv.includes('--status') ? status() : configure(process.argv.includes('--uninstall')), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { status, configure };
