'use strict';

// Full monitor bounds, rather than the work area: maximizing is not fullscreen.
function coversDisplay(window, display, ownPid = process.pid) {
  if (!window || window.pid === ownPid || window.caption || !display) return false;
  const tolerance = 2;
  return window.x <= display.x + tolerance && window.y <= display.y + tolerance
    && window.x + window.width >= display.x + display.width - tolerance
    && window.y + window.height >= display.y + display.height - tolerance;
}

function startFullscreenWatch({ read, display, onChange, interval = 50 }) {
  let previous;
  const tick = () => {
    try {
      const active = coversDisplay(read(), display());
      if (active !== previous) { previous = active; onChange(active); }
    } catch { /* A transient native/display failure must not flash Capri back in. */ }
  };
  const timer = setInterval(tick, interval);
  tick();
  return { tick, stop() { clearInterval(timer); } };
}

module.exports = { coversDisplay, startFullscreenWatch };
