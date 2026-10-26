'use strict';

// This gate lives in the main process: model text cannot approve a desktop action.
function createCloseHandler({ config, apps, dialog }) {
  let busy = false;
  const allowed = () => config.load().desktopActions && !config.load().gamingMode;
  return async (_event, { name, force }) => {
    if (!allowed() || busy) return { error: 'Desktop actions are disabled or busy' };
    busy = true;
    try {
      const target = (await apps.list()).find((a) => a.process === name);
      if (!target) return { error: 'App is unavailable or protected' };
      const { response } = await dialog.showMessageBox({
        type: 'warning', title: 'CapriGPT — confirm desktop action',
        message: `${force ? 'Force quit' : 'Close'} ${target.process}?`,
        detail: force ? 'Unsaved work can be lost. This affects all instances of this app.' : 'The app may ask you to save. This affects all instances of this app.',
        buttons: ['Cancel', force ? 'Force quit' : 'Close app'], defaultId: 0, cancelId: 0, noLink: true,
      });
      if (response !== 1 || !allowed()) return { error: 'Cancelled' };
      return await apps.close(name, { force: Boolean(force) });
    } catch (err) { return { error: err.message }; }
    finally { busy = false; }
  };
}

module.exports = { createCloseHandler };
