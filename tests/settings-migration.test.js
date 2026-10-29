'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { migratePcSettings, PC_DEFAULTS } = require('../src/main/settings-migration');
const { permissions } = require('../src/main/pc-context');

test('PC awareness defaults on for all apps, with a one-time migration preserving unrelated settings', () => {
  for (const [key, value] of Object.entries(PC_DEFAULTS)) assert.equal(permissions()[key], value);
  const old = { desktopActions: false, chatModel: 'my-model', gamingMode: true,
    privacy: { contextProcesses: false, memoryEnabled: false, retentionDays: 30 } };
  const migrated = migratePcSettings(old);
  assert.equal(migrated.privacy.allApps, true);
  assert.equal(migrated.privacy.contextProcesses, true);
  assert.equal(migrated.desktopActions, true);
  assert.equal(migrated.gamingMode, true);
  assert.equal(migrated.chatModel, 'my-model');
  assert.equal(migrated.privacy.memoryEnabled, false);
  assert.equal(migrated.privacy.retentionDays, 30);
  assert.equal(old.desktopActions, false);
  migrated.privacy.allApps = false;
  migrated.privacy.contextProcesses = false;
  assert.equal(migratePcSettings(migrated), migrated);
  assert.equal(migratePcSettings(migrated).privacy.contextProcesses, false, 'later opt-outs stay disabled');
});
