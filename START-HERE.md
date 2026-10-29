> **Settings update:** The native tray menu has been replaced by Capri’s custom control room. Right-click Capri or her tray icon. Memory and PC awareness have separate sections; appearance includes size and screen; sound has its own section; versions/restarts live in Updates & app. Legacy Claude integration and chat handoff have been removed.

# CapriGPT: Windows local prototype

This is a local development branch of [mochiiwuff/capri-desktop](https://github.com/mochiiwuff/capri-desktop), based on upstream commit `79a016c` (0.3.1). The hosted fork is [Chocoyito1/capri-desktop](https://github.com/Chocoyito1/capri-desktop), with the prototype on branch `codex/caprigpt-local`. No changes have been pushed to the original upstream repository.

## Start on this laptop

Git, Node.js, Ollama, app dependencies, and the `llama3.2:3b` model are installed.
CapriGPT v0.4.0 starts a separate local Ollama server on `127.0.0.1:11435`, using
the installed Ollama executable and the same downloaded models. On Windows the
server has a hidden console that GPU-discovery workers can inherit, preventing
the terminal flashes seen when those workers started without a parent console.
Capri does not restart or modify your usual Ollama server on port 11434. An
already running Capri server is reused. Gaming mode blocks server startup, and
the model stays unloaded until a chat message needs it. Double-click the desktop
shortcut or `Start-CapriGPT.cmd`, or open PowerShell in this folder and run:

```powershell
npm.cmd start
```

The desktop shortcut opens Capri without a terminal window. If you instead run `npm start` from a terminal, keep that terminal open. Right-click Capri or her tray icon → **Talk to her**. You can also click her during Codex work and choose **Talk to me**. The chat shows a separate Codex activity line that updates while you talk. Type your message and press Enter. The model runs locally; the first reply may take longer while loading. Escape closes chat and cancels an active reply. Quit from her tray menu.

The chat header shows **v0.4.0**. **About / verify running version** in the tray
shows the loaded build fingerprint, project folder and whether source files
changed since launch. **Restart Capri to load updates** loads changed code.
Clicking the shortcut also restarts an idle instance when its source changed.

## Install again on another Windows PC

Install [Node.js](https://nodejs.org/) 22.13 or newer, [Git](https://git-scm.com/), and [Ollama](https://ollama.com/download/windows) from their official sites. Open Ollama, then in this folder run:

```powershell
npm.cmd ci
ollama pull llama3.2:3b
npm.cmd start
```

The model download is about 2 GB. It uses Meta's model license; it is not covered by this project's MIT code license. Review [the model listing and license](https://ollama.com/library/llama3.2).

## Gaming and resource use

Right-click the tray icon → **Gaming mode — pause AI and hide Capri** before starting a game. This cancels an active reply, blocks further chat, unloads the selected model, stops window tracking, and hides the overlay so Chromium can throttle it. Untick it to resume. Gaming mode persists between launches; the tray remains available while Capri is hidden.

This is a manual pause, not automatic game detection. It does not stop other
applications from using Ollama. Capri's server at `127.0.0.1:11435/api/ps` should
show no Capri model loaded after the pause; a plain `ollama ps` normally checks
the separate default server on port 11434. If unloading fails, Capri shows a
warning. Quit Capri for the lowest possible overlay overhead.

Normal chat requests up to a 32,768-token context, capped by the installed model's advertised limit, and allows up to 1,536 generated tokens per reply (less for smaller-context models). Prompt selection reserves space for the answer and model template, using a conservative UTF-8 byte budget. Structured action/memory decisions retain their separate 8,192-token/400-token settings. Only one reply runs at a time, with no warmup or idle inference. `keep_alive: 0` asks Ollama to release the model after each reply. Larger contexts can use more memory. On this laptop, the live Qwen check reported a 32,768-token allocation entirely on GPU, about 6.56 GB. See [PERSONALITY-AND-CONTINUITY.md](PERSONALITY-AND-CONTINUITY.md) for the test conditions and limits.

Ctrl+Alt+C uses upstream's small biochip view; it is **not** gaming mode.

## Desktop permissions and privacy

Personal memory and PC context are available under **Memory & PC privacy** in
the tray. Memory defaults off; saves and edits always need confirmation. Local
memory commands work without Ollama. At the user's request, PC awareness now
defaults on for all apps, including newly installed apps, without per-app setup.
Observation remains on demand or OS-event-triggered, with optional opt-outs.
Decorative continuous window tracking stays off by default. See
[MEMORY-AND-CONTEXT.md](MEMORY-AND-CONTEXT.md) for commands, SQLite storage,
retention, export/delete controls, prompt limits and privacy details. The SQLite
file and exported JSON are local plain text, not encrypted.

**App closing is enabled by default**, with a native Windows confirmation before
each close and Cancel selected by default. Force quit gets its own confirmation
and can lose unsaved work. Windows components, Capri, Ollama, ChatGPT, and Codex
remain protected. Broad PC observation does not provide shell execution, file
editing, screenshot capture, or arbitrary computer control to the model.

AI requests go to a literal loopback HTTP address, normally `127.0.0.1:11435`.
Remote hosts, redirects, and cloud model metadata are rejected. An explicit
`OLLAMA_HOST` override is still supported, but reusing an independently launched
server can bring back its worker-console behavior. This assumes you trust your
installed local Ollama service; Capri cannot control Ollama's own update checks
or a malicious replacement service.

Chat history stays in renderer RAM for this run, bounded to 256 messages (up to 128 completed turns) and 768 KiB of text. Each reply uses the character prompt, verified capabilities, relevant permitted personal/PC context, recent complete conversation turns, and selected exact older user excerpts when needed. Selection is bounded; not every retained detail fits every reply. Restarting clears session chat. Saved personal memory is separate and follows its settings; forgetting a saved record does not erase ordinary chat messages. There is no automatic transcript saving. Settings and the local mission log live under `%APPDATA%\CapriGPT`; the old Capri profile is separate. No API key is required. Codex notification hooks report actual lifecycle events; ordinary ChatGPT conversations are not connected.

The local event bridge remains on `127.0.0.1:47823` and rejects browser Origin headers. The Codex notification endpoint also requires a local token. It is a local development integration, not a boundary against malicious programs already running on the PC. Debug routes are available only with `npm.cmd run dev`; use normal start for daily use.

## Troubleshooting

- No model: open Ollama and run `ollama pull llama3.2:3b`, then reopen chat.
- Cannot reach Ollama: if installed in the standard Windows location, Capri offers **Start Ollama**. It starts Capri's hidden local server without preloading a model. Check `http://127.0.0.1:11435/api/tags` and remove an unintended `OLLAMA_HOST` override. Gaming mode blocks the Start button.
- Capri absent: check the tray's Gaming mode setting. Also try Ctrl+Alt+C for the biochip state.
- Port occupied: quit another Capri instance. For development, set `$env:CAPRI_PORT='47825'` before starting; hooks must use the same port.
- A very slow or failed first reply: inspect Ollama's logs and update Ollama/NVIDIA drivers from official sources. No automatic paid fallback exists.

## Validation

```powershell
npm.cmd test
npm.cmd run test:memory
npm.cmd run test:release
npm.cmd run test:desktop
```

Safety/integration tests cover notifications, desktop-action gates and personal
memory/context. `test:memory` uses an isolated Electron profile with mocked
dialogs and model calls, so it needs no running Ollama. On Windows it also checks
the native PC APIs without launching terminal helpers or closing real apps. The
broader desktop smoke test starts the actual Electron renderer, asks who Capri
works with, checks a streamed local reply, and exercises gaming pause, unload and
resume. Run that broader test with another CapriGPT instance closed and the
default model installed. Test captures are in `captures/` and ignored by Git.

`test:release` types the exact screenshot phrase “whats openned in my pc capri?”
in the real chat UI, verifies a direct app list, then checks a real local model
reply while watching for visible terminal windows. `node scripts/diagnose-reply.js
--fresh-server` traces a disposable hidden server from cold startup through a
harmless reply, then cleans up that test server. These diagnostics read process
IDs/names and terminal window classes, never terminal text, titles or user chat.

## Rights and future integration

The code is MIT; preserve `LICENSE` and upstream attribution. **The character images in `assets/capri/` are not MIT-licensed.** Upstream identifies anime frames, fan art and a fan cut-out without a general redistribution grant. Existing animation/art is retained for this local prototype; this does not establish permission to publish or commercially redistribute it. Obtain permission or replace restricted imagery before distributing a build. Fonts are under the SIL Open Font License. No new character art was generated.

See [CODEX-CONNECTION.md](CODEX-CONNECTION.md) to activate the installed local Codex notification hooks and use the previewed ChatGPT/Codex handoff. Ordinary ChatGPT conversations are not automatically observed. Optional paid OpenAI routing remains planned in `ROADMAP.md`.

## GitHub fork

The hosted fork is [Chocoyito1/capri-desktop](https://github.com/Chocoyito1/capri-desktop). The local prototype branch tracks `origin/codex/caprigpt-local`. `upstream` points to the original mochiiwuff repository.

To obtain this prototype on another PC:

```powershell
git clone --branch codex/caprigpt-local https://github.com/Chocoyito1/capri-desktop.git CapriGPT
cd CapriGPT
npm.cmd ci
ollama pull llama3.2:3b
npm.cmd start
```

The fork retains upstream attribution and rights notices. No installer or release has been published.
