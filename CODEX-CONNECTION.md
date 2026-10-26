# Connect Capri to Codex

The notification connection is implemented and tested. On this laptop, its eight hook definitions are installed in `C:\Users\gabri\.codex\hooks.json`. Codex's own hook listing recognizes them and reports them as **untrusted**. Real automatic activity remains pending your review.

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

The receiver binds to `127.0.0.1`. A random token in `%APPDATA%\CapriGPT\integration.json` authenticates the new notification endpoint. The hook reads that file and always sends to the loopback address; no remote address is configurable. This token is local connection material, not a ChatGPT/API credential. Other software already running as your user is outside this protection boundary.

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

No genuine Codex lifecycle event has yet been verified in the running desktop app: that last check needs the trust activation above.
