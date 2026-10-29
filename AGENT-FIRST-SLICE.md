> **Action tools are now implemented:** Capability registry revision 2 adds natural-language app launching, verified newest-upload YouTube playback, live news/web search and Steam specials. See [DESKTOP-TASKS.md](DESKTOP-TASKS.md) for current behavior. This document records the earlier first-slice baseline.

# Capri local agent — first vertical slice

Implemented October 28, 2026. Existing character art, animations, voice effects,
chat layout, memory confirmation, and app protection remain in use.

## What works

- `src/main/capabilities.js` owns revision 1 of Capri’s self-description. The main
  process injects a current registry into every chat request and agent decision.
  Enabled permissions and installed skills are reflected at request time. Old
  chat claims cannot define her current abilities. Increase the revision when
  capabilities change, and advertise only implemented adapters.
- `WorldState` builds a timestamped, revisioned snapshot through the existing
  native Win32 context provider. Foreground app/title, process names, battery,
  time and performance obey the current privacy switches. Newly installed apps
  require no allowlist. No screenshots, screen recording, keyboard hooks, or
  persistent activity history are added. Snapshot values are untrusted data.
- `Agent` uses downloaded **qwen3.5:9b** through the loopback Ollama server.
  One schema-constrained decision per invocation: wait, suggest, or propose an
  app close. Resume, power changes, and foreground changes from the geometry
  watcher debounce for two seconds; background inference has a five-minute
  cooldown. There is no recursive planning or periodic inference timer.
  Foreground events currently depend on window geometry tracking being enabled.
- Event decisions can only wait or suggest. Explicit `/agent think` requests may
  propose a permitted app close. IDs expire after 60 seconds, are single-use,
  and lead to the existing main-process native Cancel/Close dialog. No model
  output counts as approval. Force quitting stays on the existing separate path.
- Gaming mode, config changes, and exit cancel in-flight decisions and clear
  proposals. Chat and agent inference cannot run together. Model failures,
  malformed JSON and unknown targets produce no action. Models unload after
  replies; gaming mode waits for cancellation before unloading.
- Existing confirmed personal facts remain in local SQLite and can be recalled
  into explicit agent decisions when memory/recall are enabled. Personal memory
  remains off until enabled. A separate SQLite operational journal stores only
  decision/action status codes, capped at 500 entries and seven days. It stores
  no goals, titles, observations, model output, or transcripts.

## Use

Start from **CapriGPT** on the desktop. In chat or the offline local commands panel:

```text
/agent status
/agent think Look at my current PC activity and suggest useful help.
/agent think Help me close Notepad.
/agent approve <the displayed proposal ID>
/agent cancel
```

Right-click Capri or her tray icon for the custom **Control room**. The local
agent and confirmed app actions are built in and enabled by default. Use
**Overview → Gaming mode** to pause AI. **Appearance → Sit on windows** enables sitting on
ordinary restored windows with enough room above them. Maximized windows have
no available ledge; minimizing/closing/covering a perched window makes her leave.
The existing profile had this setting off, which prevented sitting entirely.
New profiles now default it on.

Qwen's official Ollama tag is [qwen3.5:9b](https://ollama.com/library/qwen3.5).
Missing Qwen is reported explicitly rather than silently using a weaker model
for agent decisions. Ordinary chat can still use another selected local model.

## Validation commands

```text
npm test
npm run test:agent
npm run test:memory
npm run test:agent-live
```

`test:agent` uses an isolated profile and mocked inference/action effects. It
exercises real main/preload/renderer routing, real native confirmation logic,
and a real temporary Windows window for overlay perching/minimize regression.
`test:agent-live` requires the local server and downloaded Qwen. It tests real
native observations and real model JSON; it cannot discover or close targets.

## Next milestones

1. Implement a bounded Windows UI Automation reader in a worker with timeouts,
   password-field exclusion, stable element identity and fresh permission checks.
   Then add approved Invoke/Value actions with exact-target revalidation and
   result inspection. `agent-adapters.js` is a contract only, not working UIA.
2. Install local push-to-talk recognition and speech synthesis adapters. Reuse
   the character’s sound controls, show microphone state, support immediate stop,
   and avoid an always-listening microphone. Speech adapters are contracts only.
3. Add a visible goals/proposals/history panel and multi-step plans with explicit
   step budgets, interruption, result verification, and restart recovery. This
   slice deliberately executes no multi-step plans or arbitrary shell commands.
4. Replace decorative-watcher foreground triggers with a dedicated WinEvent
   sensor so awareness remains event-driven when perching geometry is disabled.
   Measure false suggestions and latency before expanding proactive behavior.

## Results on this PC

- All 45 Node tests passed, including real native Windows process/window reads,
  memory persistence, safety gates, JSON transport, cancellation and expiry.
- Electron `test:agent` passed: real IPC routing, mocked action effects with
  native confirmation cancel/accept, proposal replay rejection, real overlay
  sitting and departure when the test window was minimized.
- Electron `test:memory` passed: SQLite, save confirmation, edit/recall/forget,
  prompt integration, offline commands and native addon loading.
- `test:agent-live` passed with the downloaded Qwen 3.5 9B and real PC context:
  a schema-validated suggestion in 57.8 seconds on the initial cold run. This is
  functional but too slow for fluid spoken interaction; latency remains a
  milestone. Models unload after each request to release gaming resources.
- `test:release` passed: real running-app question and real Qwen chat reply in
  Capri’s UI, with no new visible terminal windows during the reply.
- The saved profile now selects Qwen and enables perching and the agent. Its
  previous settings were backed up under ignored `.caprigpt-local/`.
- The Windows Desktop special-folder shortcut already had the correct direct
  Electron target, absolute checkout argument, working directory and Capri icon;
  it was verified and left intact. No running Capri was restarted.

Foreground-priority correction: both user-message routing and ordinary chat
generation reserve priority before waiting for background inference to stop.
Desktop-event decisions cannot begin during those reservations. Existing
explicit user tasks retain their concurrency protection. This removes the race
where an ordinary “what do you know about me?” question was rejected with
“One local reply at a time” merely because a background decision was running.

All 81 Node tests passed. `npm run test:foreground-priority` passed through the
actual chat UI with a deliberately busy background inference, isolated profile
recall and a competing event during reply generation. Model text was mocked;
the real routing, cancellation and priority checks were exercised.
