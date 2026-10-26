# Connect Capri to Codex

The notification connection is implemented and live-tested. On this laptop, all eight definitions are trusted. A genuine completion event was delivered from the complete official Codex CLI 0.164.0, and the user confirmed that Capri reacted.

## Activate once

1. Keep Capri running. Open a terminal and run `codex`.
2. Inside Codex, enter `/hooks`.
3. Review the CapriGPT handlers whose command ends in `hooks/caprigpt-codex-hook.js`. Trust the definitions you have reviewed. Do not change your normal tool-approval settings.
4. Start a fresh Codex turn, or reopen the Codex chat if it needs to reload its configuration.
5. Right-click Capri → **Codex companion notifications → Connection status / activation help**. After a genuine hook fires, the status reports its receipt time. Until then, it honestly says no real event has arrived.

This trust requirement comes from [Codex's official hook documentation](https://learn.chatgpt.com/docs/hooks#review-and-trust-hooks): new definitions are skipped until reviewed. The installer does not mark them trusted or bypass that review. If the desktop composer does not expose `/hooks`, use the installed Codex CLI for the review. Exact desktop behavior and hook coverage may differ by client version; verify real events after activation rather than treating installation as proof of connection.

## What she shows

| Observed event | Capri's response |
| --- | --- |
| Session starts | Connection acknowledgement |
| New turn / tool starts | Working state and a tool-name ticker |
| Codex asks for permission | Alert telling you to review it in Codex |
| Tool resumes | Clears that alert |
| Structured tool failure | Error notification |
| Turn finishes | Done notification and a small existing animation |
| Turn interrupted / session ends | Stops the corresponding activity display |

She does not approve or deny a request, run commands, or resume a turn. These hook handlers return an empty JSON object and provide no model context. Most run in the background; Codex requires the session-end handler to run synchronously, with a short timeout.

## Local data and performance

Only bounded metadata is forwarded: Codex session/turn IDs, event ID, project folder **name**, stage, tool name, and timestamp. Prompts, assistant replies, command arguments, full paths, file contents, and tool output are not forwarded. The hook does not open transcripts. Codex supplies an event to the small forwarding process, which strips it down before sending.

The receiver binds to `127.0.0.1`. A local token in this checkout’s ignored `.caprigpt-local/integration.json` authenticates the notification endpoint. The same file is used by both desktop-shortcut and CLI launches. The hook reads that file and always sends to the loopback address; no remote address is configurable. This token is local connection material, not a ChatGPT/API credential. Other software already running as your user is outside this protection boundary.

Notifications do not call Ollama or any cloud model, so they add no inference usage. Existing Codex work still consumes its normal subscription/API allowance. Gaming mode keeps the latest states in memory while hiding notifications; an approval still waiting when you resume is displayed then. No replay of old celebrations occurs. Restarting Capri clears its observed state until new events arrive.

## ChatGPT connection: manual handoff

Normal ChatGPT conversations do **not** automatically send lifecycle events to Capri. This build does not read browser cookies, account tokens, private conversation history, or desktop internals.

To move a local conversation into ChatGPT or Codex, choose **Copy chat handoff for ChatGPT / Codex…** in Capri's menu. Preview the exact text, choose Copy, and paste it yourself in the intended chat. Nothing is sent automatically. The handoff labels Capri's output as potentially mistaken conversation context.

The Codex lifecycle connection is separate from model routing. Capri still talks through local Ollama. Optional paid OpenAI API inference remains disabled; ChatGPT Plus and Platform API billing remain separate. See [authentication](https://learn.chatgpt.com/docs/auth).

## Install, remove, and test

On another PC, run these from the CapriGPT folder after installing Node and Codex:

```powershell
npm.cmd run codex:install
```

The installer preserves unrelated hook handlers, writes a backup when replacing an existing file, and refuses malformed configuration. Repeat installation is safe. Review trust again whenever the hook definition changes. It points at this checkout, so reinstall if you move it.

```powershell
npm.cmd run codex:status
npm.cmd run codex:uninstall
```

Uninstall removes only CapriGPT handlers. It preserves other hooks and backups. Restart/reload Codex afterward.

```powershell
npm.cmd test
npm.cmd run test:desktop
```

The desktop test sends clearly labelled **CODEX · TEST** fixtures through the real forwarding process, authenticated receiver, and renderer. Fixtures never claim a real connection. It verifies the approval alert and clearing behavior, no approval button, paused notifications, outstanding alerts after gaming resume, local chat, and handoff preview/copy using fake clipboard writes. It does not run real Codex tasks or consume cloud inference for integration testing.

A genuine Codex CLI event has now been verified: local delivery diagnostics recorded a non-test completion event with HTTP 200, and the user confirmed the visible reaction. This validates the complete CLI path; the desktop app’s own Codex runtime remains a separate unverified path.

## Windows launcher and delivery diagnostics

The app-bundled alpha CLI in this setup showed an incomplete-package error and did not launch the trusted forwarding hook during the test. The complete official `@openai/codex` 0.164.0 package did launch it. Use a complete CLI package for terminal work; do not rely on the app-internal executable path as a standalone installation. The local `outputs/Start-Codex.cmd` launcher opens the separately installed complete package in this project and clears an inherited `TERM=dumb` setting for the new terminal only. It does not alter account authentication, trust decisions, or normal approval settings.

Run `npm.cmd run codex:check` for delivery status. The newest app build exposes an authenticated read-only status endpoint; an older running build may need a normal restart before detailed receiver state is available. A single `.caprigpt-local/codex-hook-status.json` file records the last forwarding outcome, timestamp, stage, test marker and HTTP acceptance result. It contains no prompts, commands, reply text or connection token. Tests now use an isolated profile so they cannot replace the live companion’s connection settings.

## Desktop-app activation check

The three requested follow-ups are saved in TODO.md. Desktop Codex chats are the current integration target; ordinary ChatGPT chats remain a separate surface.

The previous saved connection location produced HTTP 403 after a desktop launch. Both sides now use this checkout’s `.caprigpt-local/integration.json`, which is ignored by Git. The token is reused across normal restarts, and the file is published only after Capri owns its local port. The restarted desktop-shortcut instance now answers the authenticated status check correctly. This shared per-checkout location is for the current development prototype; installer/runtime relocation belongs to the packaging to-do.

The app’s background Codex process predates hook installation. No supported hook-reload method was found in the installed app-server protocol. Completely quit and reopen the desktop app, return to this chat, then send a fresh message to test whether its runtime loads the trusted definitions. This remains an activation test, not a claim that desktop-originated events are already working. Current receiver status has no genuine app event yet.
