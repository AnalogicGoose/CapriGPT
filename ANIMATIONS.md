# Capri animation expansion

The original `capri-full.png`, shader rig, colors, line boil and silhouette are unchanged.
New exposure sheets use the existing 12 fps held drawings; the gaming departure uses
the existing 24 fps action timing. No generated art, replacement sprites or new sounds.

| Animation | Trigger |
| --- | --- |
| `idleSway` | Gentle side-to-side head and mane sway |
| `idlePreen` | Small one-handed mane gesture |
| `idleStretch` | Both arms stretch, then settle |
| `listen` | Opening chat or entering an approval-wait state |
| `think` | Local chat request or an observed tool without a more specific action |
| `read` | Observed read/view/inspect/list tool |
| `search` | Observed search/grep/glob/find/fetch/browser tool |
| `type` | Observed write/edit/patch/notebook tool |
| Gaming teleport | Gaming mode teleports Capri off screen; resuming teleports her back |

The `gameReady` hand pose remains available for manual previews; Gaming mode uses
the original teleport collapse, beam, shards and reassembly effects instead.

Idle gestures start after 12–22 seconds, then vary every 16–30 seconds without an
immediate repeat. They work standing and seated. They pause during work, sleep,
chat generation, travel, dragging, pointing and gaming. Existing wandering and
larger idle flourishes remain available. Routine tool reactions have a 4.5 second
cooldown, can replace a quiet idle gesture, and respect stronger reactions.

While a local chat response is pending, the existing focus cycle plays underneath
the thinking gesture. It clears on the first answer text, completion, error or
closing chat. Codex notification activity keeps its separate work/alert state.

Gaming mode still pauses AI, stops window tracking, unloads models and hides Capri.
Its departure uses her existing teleport-out effect, with a 1.1 second fallback if
the renderer does not answer. On resume, Capri starts invisible before the overlay
is shown and teleports into her safe corner, since her old window may have closed.
Hidden/stowed/dormant Capri stays put away. A short move may finish before departure;
dragging or longer travel skips that departure. Reduced motion uses a short fade
out/in and skips automatic idle gestures.

## Try it

Restart Capri when convenient to load the changed source; an already running copy
keeps its loaded code. No automatic restart is performed.

1. Leave Capri idle and watch for the three new quiet variations. Try her seated
   on a window too; she should stay anchored to its ledge.
2. Open chat and send a question: she listens, thinks, and returns to her prior
   work/idle cycle when the reply arrives. Closing a pending chat clears focus.
3. With Codex hooks connected, use read, search and edit tools. Distinct action
   poses should appear between events; rapid tool bursts should stay quiet.
4. Turn Gaming mode on in the control room: she collapses into light and teleports
   off screen. Resume through the same switch or the tray: she teleports back into
   her corner with the original arrival effects.
5. With Windows reduced motion enabled, teleporting uses a short fade instead.

## Verification

- `npm test` checks the exposure sheets, tool mapping and existing app behavior.
- `node_modules/electron/dist/electron.exe scripts/check-animations.js` uses an
  isolated renderer to check actual WebGL drawings, action priority, idle rotation,
  chat focus cleanup, seated anchoring and gaming gating. It saves a pose gallery
  under `.caprigpt-local/animation-check/poses.png` without starting Capri or AI.
- `npm run test:settings` exercises the real control room and gaming pause/resume
  with an isolated test profile and model unload mocked.

No animation claims to observe gameplay or infer game events. The gaming gesture
is tied to the actual Gaming mode switch.

## Dragging and dropping

Hold the left mouse button on Capri and move more than five pixels: she squirms
with alternating arm swings, leg kicks and trailing mane motion. These physical
animations interpolate at up to 60 fps, with short blends into pickup, falling
and landing. Her original artwork and ink texture remain unchanged. The held
point follows the pointer directly, without added bobbing or glitch flashes.

Release above the desktop to see her fall under gravity, then settle with a soft
landing. She can also land on a free window ledge. Releasing at the floor or right
beside a ledge lands directly. A click without dragging still opens her usual
status. Pointer capture keeps the drag active outside her silhouette; cancellation
or losing focus releases her safely. Reduced motion uses a still held pose and
places her directly on the landing surface.

The isolated Electron check exercises actual mouse pickup/release, focus-loss
cleanup, falling to the floor, landing on a window and reduced-motion handling.

## Live panel portrait

All message and chat panel avatars now use `assets/capri/portrait-blink.png`, a
new two-frame portrait with open and closed eyes. It preserves Capri's red angular
hair, lime face, blue concentric eyes and jagged grin with cleaner portrait art.
Original full-body art, desktop icons and cinematic cut-ins remain in use.

The portrait blinks every few seconds, with an eased close/open and occasional
subtle displaced scan bands. A slim violet-to-mint border and faint scanlines
frame it. Animation stops when its panel is hidden or suspended, the document is
hidden, or reduced motion is enabled. Existing mood names share this consistent
portrait, with a brief glitch when the mood changes instead of different crops.

`node_modules/electron/dist/electron.exe scripts/check-portraits.js` verifies asset
loading, blinking, glitching, all mood names, visibility and reduced motion. It
saves an actual-size panel preview to `.caprigpt-local/portrait-check/panels.png`.
Art provenance and the generation prompt are in `assets/capri/portrait-source.md`.

## Automatic fullscreen teleport

On Windows, Capri now teleports away when the foreground app covers her entire
display, then teleports back when fullscreen ends or you switch away. Normal
maximized windows and fullscreen apps on another display do not trigger this.
The detector reads only native window geometry every 50 ms; it does not collect
screenshots, titles, keystrokes or send an AI request. The teleport begins as soon
as a changed state arrives and takes 160 ms (an 80 ms fade with reduced motion).

Each new fullscreen state reverses the current visual transition immediately.
There is no queue of teleport tasks. A revision number prevents old snapshots,
animation acknowledgments or delayed hide timers from overriding a newer state.
The overlay becomes click-through immediately, hides after departure, and has a
260 ms hide fallback for an unresponsive renderer. Temporary animation throttling
is disabled during the transition so losing focus does not stall it.

Fullscreen presence composes over the current sprite without changing its alpha
or its regular teleport state. Manual stowing and Gaming mode remain independent;
resuming Gaming mode while still fullscreen keeps Capri hidden. Putting her away
or bringing her out while fullscreen updates her state without waiting on hidden
animation frames.

Verification: `npm test` includes geometry/detection, rapid reversals, late snapshots
and reduced motion. Run `node_modules/electron/dist/electron.exe scripts/smoke-electron.js --fullscreen-only`
for an isolated production-app check of the native-probe → IPC → shader → OS
visibility path. That check supplies simulated native window geometry and tests
rapid toggles, stale hide acknowledgments, overlapping ordinary teleports, Gaming
mode combinations and manual stow; it does not take over the desktop with a real
fullscreen app.
