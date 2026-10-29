'use strict';

const PC_DEFAULTS = Object.freeze({ allApps: true, contextTime: true, contextPower: true,
  contextForeground: true, contextTitles: true, contextProcesses: true,
  contextPerformance: true, contextEvents: true });

// The user requested broad PC awareness as the default. Apply it once to this
// personal prototype's existing profiles; later user opt-outs are preserved.
function migratePcSettings(saved = {}) {
  if (saved.pcAwarenessDefaults === 1) return saved;
  return { ...saved, pcAwarenessDefaults: 1, desktopActions: true,
    privacy: { ...saved.privacy, ...PC_DEFAULTS } };
}

function migrateControlRoom(saved) {
  if (saved.controlRoomDefaults === 1) return saved;
  return { ...saved, controlRoomDefaults: 1, agentEnabled: true, desktopActions: true,
    chatModel: 'qwen3.5:9b', privacy: { ...saved.privacy, allApps: true } };
}

module.exports = { PC_DEFAULTS, migratePcSettings, migrateControlRoom };
