# CapriGPT: Windows local prototype

This is a local development branch of [mochiiwuff/capri-desktop](https://github.com/mochiiwuff/capri-desktop), based on upstream commit `79a016c` (0.3.1). The hosted fork is [Chocoyito1/capri-desktop](https://github.com/Chocoyito1/capri-desktop), with the prototype on branch `codex/caprigpt-local`. No changes have been pushed to the original upstream repository.

## Start on this laptop

Git, Node.js, Ollama, app dependencies, and the `llama3.2:3b` model are installed. Open Ollama first. Double-click `Start-CapriGPT.cmd`, or open PowerShell in this folder and run:

```powershell
npm.cmd start
```

Keep the terminal open. Right-click Capri or her tray icon → **Talk to her**. Type your message and press Enter. The model runs locally; the first reply may take longer while loading. Escape closes chat and cancels an active reply. Quit from her tray menu.

## Install again on another Windows PC

Install [Node.js](https://nodejs.org/) 20 or newer, [Git](https://git-scm.com/), and [Ollama](https://ollama.com/download/windows) from their official sites. Open Ollama, then in this folder run:

```powershell
npm.cmd ci
ollama pull llama3.2:3b
npm.cmd start
```

The model download is about 2 GB. It uses Meta's model license; it is not covered by this project's MIT code license. Review [the model listing and license](https://ollama.com/library/llama3.2).

## Gaming and resource use

Right-click the tray icon → **Gaming mode — pause AI and hide Capri** before starting a game. This cancels an active reply, blocks further chat, unloads the selected model, stops window tracking, and hides the overlay so Chromium can throttle it. Untick it to resume. Gaming mode persists between launches; the tray remains available while Capri is hidden.

This is a manual pause, not automatic game detection. It does not stop other applications from using Ollama. `ollama ps` should show no Capri model loaded after the pause. If unloading fails, Capri shows a warning. Quit Capri for the lowest possible overlay overhead.

Normal chat uses a 4,096-token context, at most 240 generated tokens per reply, and one reply at a time. There is no warmup or idle inference. `keep_alive: 0` asks Ollama to release the model after each reply; this saves idle VRAM at the expense of reload latency. Your laptop reports an RTX 5070 Ti Laptop GPU with 12 GB VRAM and 32 GB system RAM. Performance depends on drivers, other apps, and power mode; no in-game FPS guarantee is claimed.

Ctrl+Alt+C uses upstream's small biochip view; it is **not** gaming mode.

## Desktop permissions and privacy

**App closing starts disabled.** Enable it explicitly in the tray menu if wanted. A proposed close requires the panel button and a separate native Windows confirmation, with Cancel selected by default. Force quit gets its own confirmation and can lose unsaved work. Windows components, Capri, Ollama, ChatGPT, and Codex are protected. No shell execution, file editing, screenshot capture, or arbitrary computer-control tool is provided to the model.

AI requests go to a literal loopback HTTP address, normally `127.0.0.1:11434`. Remote hosts, redirects, and cloud model metadata are rejected. Use `127.0.0.1`, rather than `localhost`, if setting `OLLAMA_HOST`. This assumes you trust your installed local Ollama service; Capri cannot control Ollama's own update checks or a malicious replacement service.

Chat history remains in renderer memory for this run. The last 12 conversation messages, the character prompt, and upstream task-summary context are sent to local Ollama. App names are added only when app closing is enabled. Upstream window tracking reads window positions locally. Settings and the local mission log live under `%APPDATA%\CapriGPT`; the old Capri profile is separate. No API key is required. No Claude hooks or startup entry are installed automatically. The separate Codex notification installer adds only its own definitions; this laptop’s eight definitions are now trusted. The complete Codex CLI connection has been verified; see CODEX-CONNECTION.md. Legacy Claude options are isolated in an optional legacy submenu. Normal chat and help describe Capri as a companion for ChatGPT and Codex. Her context distinguishes installed notification hooks from genuine Codex events received. No ordinary ChatGPT conversation feed is connected.

The local event bridge remains on `127.0.0.1:47823` and rejects browser Origin headers. The Codex notification endpoint also requires a local token. It is a local development integration, not a boundary against malicious programs already running on the PC. Debug routes are available only with `npm.cmd run dev`; use normal start for daily use.

## Troubleshooting

- No model: open Ollama and run `ollama pull llama3.2:3b`, then reopen chat.
- Cannot reach Ollama: check `http://127.0.0.1:11434/api/tags` and remove a remote `OLLAMA_HOST` setting.
- Capri absent: check the tray's Gaming mode setting. Also try Ctrl+Alt+C for the biochip state.
- Port occupied: quit another Capri instance. For development, set `$env:CAPRI_PORT='47825'` before starting; hooks must use the same port.
- A very slow or failed first reply: inspect Ollama's logs and update Ollama/NVIDIA drivers from official sources. No automatic paid fallback exists.

## Validation

```powershell
npm.cmd test
npm.cmd run test:desktop
```

Nine safety/integration tests cover the local notification protocol, hook installer and desktop-action gate. The tests use fake apps and fake confirmation responses; they never close a real app. The desktop smoke test starts the actual Electron renderer, asks who Capri works with, checks that a streamed local reply arrives without default Claude branding, then exercises gaming pause, unload and resume. It exits afterward. Run it while another CapriGPT instance is closed and with the default model installed. Test captures are in `captures/` and ignored by Git.

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
