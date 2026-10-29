'use strict';
const { EventEmitter } = require('node:events');

// A transient world model, separate from both decorative geometry and personal memory.
class WorldState extends EventEmitter {
  constructor({ context, now = Date.now }) {
    super(); this.context = context; this.now = now; this.revision = 0;
  }
  async refresh(reason = 'on-demand') {
    const snapshot = await this.context.snapshot(reason);
    const state = { revision: ++this.revision, observedAt: this.now(), ...snapshot };
    this.emit('change', { reason, revision: state.revision });
    // Do not cache titles/process lists across permission changes or persist them.
    return state;
  }
}
module.exports = { WorldState };
