> **Settings update:** The native tray menu has been replaced by Capri’s custom control room. Right-click Capri or her tray icon. Memory and PC awareness have separate sections; appearance includes size and screen; sound has its own section; versions/restarts live in Updates & app. Legacy Claude integration and chat handoff have been removed.

# Personal memory and PC context

This branch is an Electron/JavaScript assistant. There is no Python entry point
or YAML planner here. Memory commands run before local Ollama chat, in Electron's
main process. This implementation adds no cloud routing or paid API calls.

Version 0.4.0 also fixes Ollama worker terminal flashes by starting Capri's own
loopback server on port 11435 with a hidden parent console. It shares downloaded
models with the regular Ollama installation; it does not download another model
or change the regular server. PC context remains a separate native Win32 path.

## Start and enable

Use Node.js 22.13+ (Node 24 is installed on this PC), then:

```powershell
npm.cmd ci
npm.cmd start
```

Right-click Capri or her tray icon → **Memory & PC privacy**.
**Enable personal memory** is off initially. Enable it to save or recall facts.
**Offer conversational memories** is a separate opt-in. Requested saves, edits
and individual removals run directly by default. **Review requested changes**
can restore the native confirmation step. Suggested conversational memories
and deleting all memories still ask first, with Cancel as the default.
Cancelling stores nothing. Recognizable credential phrases are
refused; the heuristic cannot recognize every secret. Keep secrets in a password
manager.

Open **Local memory commands (works without AI)** from that submenu. It works
without Ollama or a downloaded model and does not load the GPU. The same commands
also work inside ordinary chat:

| Command | Result |
| --- | --- |
| `remember I prefer Spanish` | Save a requested fact |
| `recall Spanish` | Search saved facts locally |
| `/memory list` | Show the newest 100 records with IDs and provenance |
| `edit memory 1: I prefer English` | Replace ID 1 |
| `forget 1` | Remove ID 1 |
| `/memory export` | Choose a JSON export file |
| `/memory delete-all` | Confirm deletion of all personal memories |
| `/context` | Get a fresh permitted PC snapshot |
| `/context event` | Show the latest permitted resume/power snapshot, if under 60 seconds old |
| `/privacy status` | Show effective settings |
| `/memory` | Show command help |

Basic Spanish variants include `recuerda que ...`, `recuerda sobre ...`,
`edita recuerdo 1: ...`, and `olvida 1`. IDs make deletion and editing unambiguous.

With conversational candidates enabled, statements starting with phrases such
as “I prefer”, “My name”, “I live”, or “Me gusta” offer a memory confirmation.
This is deliberately conservative English/Spanish pattern detection, not a
general extraction model. It can miss paraphrases or offer an unsuitable fact;
review the exact proposed text. Questions, hypothetical examples and long
messages are skipped. No transcript or pending candidate is written to disk.

## Storage, retention, and deletion

Confirmed facts live in `%APPDATA%\CapriGPT\personal-memory.sqlite`, outside the
repository. Each row has an ID, exact fact, source (`explicit`,
`conversation-confirmed`, or `user-edit`), UTC creation, update and confirmation
timestamps. Editing keeps the original creation time, replaces the text, and
records new provenance and confirmation; Capri does not retain old versions.

The database and JSON exports are **not encrypted**. They inherit local Windows
folder access; anyone or any backup software with access to those files can read
them. This is not a credential vault. No telemetry, embeddings or third-party
memory service is used. Do not put exports in a shared/synced folder unless that
is intentional.

Retention defaults to **90 days from the last save/edit**. Choose 30 days, 90
days, a year, or until deleted from the tray submenu. Expiry is enforced at
startup, on setting changes, and before memory reads/writes/exports; there is no
background retention job while Capri is closed. Recalling a fact does not renew
its lifetime. SQLite secure deletion is enabled; delete-all also vacuums the
database. This does not erase exports, filesystem snapshots, backups, or copies
previously sent anywhere else. Export includes every unexpired record, not just
the first displayed page.

Turning memory off blocks saves, local recall/list and prompt recall. Existing
records stay on disk under retention so they can be exported or deleted while
memory is off. Disable just **Recall relevant memories in local AI replies** to
keep local memory commands available without using memory in AI prompts.

Local memory commands and accepted/rejected candidates bypass the model and are
not appended to chat history. Prompt augmentation happens only in main and is
never copied back into renderer history or the ChatGPT/Codex handoff. Ordinary
messages that are not recognized as memory commands/candidates still use the
existing ephemeral chat history. A user can manually repeat private facts in
that conversation; forgetting a database record does not retroactively erase
ordinary chat messages, model outputs or user-created handoffs. Restart Capri
to clear the run's ephemeral conversation history.

## PC permissions and collection

At the user's request, PC awareness now defaults on: time/day, battery/power,
foreground app, window titles, running apps/processes, CPU/RAM and OS-event
refresh. **All apps — automatically include new apps** is on by default, so newly
installed apps are recognized as soon as they run. There is no per-app approval
or allowlist maintenance. Existing profiles receive these settings once on next
launch; later opt-outs are respected. Local personal memory retains its separate
settings and save confirmations.

Each category can still be turned off. Turning **All apps** off enables the
optional **Restricted app list**. Its **Choose from open apps…** picker discovers
desktop app names on demand; only selected names are observed in this mode. The normalized
`privacy.processAllowlist` in `%APPDATA%\CapriGPT\config.json` also accepts up to
30 executable base names for other apps (restart after manual file edits).
Window titles require both foreground observation and title observation, and can
contain document names, URLs or other private information. They are capped at
200 characters. When Capri's own chat has focus, the requested foreground app
may be Capri itself. A missing foreground observation does not mean another app
is closed.

On Windows, direct Win32 calls through the pinned Koffi native dependency take
each snapshot inside Capri. No PowerShell, script compiler or terminal helper
is launched. The returned snapshot contains foreground information, process names,
and power data; no process paths or command lines. Each OS provider is optional
and fails independently. Batteryless desktops report a null battery percentage.
CPU data is explicitly labeled as the average since boot, not an instantaneous
load estimate. RAM is total/free system memory. No GPU model runs to collect
this information.

Normal chat requests a snapshot only when the latest user message mentions PC
context, such as battery, time, running apps or RAM. `/context` and the tray's
**View PC context now** always request a fresh permitted snapshot. There is no
PC context polling loop. Optional event refresh uses Electron's existing
resume/on-AC/on-battery notifications. It holds at most one temporary snapshot,
expires it after 60 seconds, and never writes a history or sends notifications.
Revoking permissions filters/discards cached fields. Gaming mode blocks
collection, drops event context, cancels chat and retains its existing model
unload behavior.

Questions such as “Capri, which apps are open rn?” return the permitted running
app names directly, without asking a model to interpret or invent them. These
show desktop apps with windows. “Which processes are running?” also includes
background process names. “Is Discord running?” and similarly named-app questions
check process status directly. New apps require no catalogue entry. Windows may
hide protected processes. Snapshots cap process names at 512 and desktop apps at
256; a truncated process list is identified. In restricted mode, only allowlisted
names are returned. With observation off or a failed provider, Capri reports that explicitly.
The exact phrasing “whats openned in my pc capri?” is covered too, including its
typo and common contractions, rather than falling back to a model refusal.
Each relevant chat question collects only its requested categories: an app-list
question does not collect titles, power or performance data. App-closing discovery
also runs only when a close is requested, rather than at chat startup and after
every reply. PC context, app discovery, decorative window geometry and confirmed
app closing now use direct Windows calls instead of spawning terminal helpers.
Follow-ups like “only those?” explain the current all-app or restricted mode locally.

Upstream's decorative window perching used a continuous geometry watcher.
That watcher now defaults off and has its own **Window perching geometry**
toggle. If enabled it still reads only window IDs/positions, never titles or
contents, and does not feed the memory system. Existing app-closing permission
is separate and still requires confirmation. Nothing in this subsystem captures
screenshots, records keys, reads files, or monitors browser history.

## Recall and prompt cost

Search is local lexical matching with recency and keyword overlap, not semantic
embeddings. Up to four matching facts can enter a reply's system prompt;
irrelevant memories are left out. Optional PC records carry collection times.
All supplemental records are marked as untrusted data, not instructions or
permission to perform actions. No fact can authorize closing an app.

`privacy.promptBudget` defaults to 800 and is clamped to 0–800. To avoid a model
tokenizer dependency, the entire added prompt (including its instruction guard)
uses a conservative UTF-8 byte limit: at most 800 additional byte-fallback tokens,
usually substantially fewer tokens. Records that do not fit are skipped whole.
Zero disables prompt augmentation. Long facts remain locally searchable even
if they cannot fit the AI allowance. The existing 4,096-token Ollama context and
240-token output limit remain. No remote fallback is introduced.

## Verification

```powershell
npm.cmd test
npm.cmd run test:memory
```

Unit tests use temporary SQLite stores, a fake clock, fake PC providers and fake
confirmation responses. They cover persistence across reopen, provenance, edits,
search, forget/delete/export, retention, candidates, cancelled saves, permission
revocation during async work, allowlists/title gates, failure tolerance, gaming
mode and prompt limits. `test:memory` launches real Electron with an isolated
profile and mocked model/dialogs, verifies IPC, SQLite and the offline command
interface, and exits. It never invokes inference or starts Ollama. On Windows it
also loads the real native addon and checks its own process, power data, desktop
app-name enumeration and title-free geometry. A separate native test forbids all
child-process launchers while exercising those reads. No real app is closed.
The ignored `captures/personal-memory.png` is the app's own UI.

For a manual check: enable memory, remember a harmless preference, cancel one
save, restart Capri and recall the saved preference. Edit it, then forget its ID
and verify recall finds nothing. Toggle each PC permission and compare
`/context`; disable titles while foreground remains on. Keep all PC permissions
off for a command-only session. Nothing needs to be uploaded to test this.

The existing broader `npm.cmd run test:desktop` smoke test still uses real local
Ollama and its installed model. Run it separately if desired; the dedicated
memory smoke test uses no model.

## User-authorized profile

SQLite schema version 3 adds a `profile` flag to saved memories. Existing entries
remain ordinary memories. Up to three explicitly designated profile facts can
enter ordinary chat without a keyword match, after relevant search results,
within the existing 800-byte personal-context budget. This avoids a blank slate
when a greeting or general identity question has no matching search words.
No model automatically promotes conversation text to profile facts.

Profile facts share the existing memory/recall switches, retention, edit,
export, forget and delete-all behavior. Personal values are stored in the user's
local SQLite database, never in tracked project source or a hardcoded persona.
An authorized bootstrap manifest and pre-import database/config backup are kept
under the ignored `.caprigpt-local/` folder. Backups are separate from live memory
deletion. The default 90-day retention remains unchanged.

Profile regression checks cover keyword-free recall, prompt limits, disabled
recall/memory, edits, forgetting, and migration from an existing SQLite database.

## Natural memory requests

`MemoryAgent` interprets natural topic-based requests, compound changes and short
memory follow-ups using local Qwen with a bounded structured response. Explicit
simple memory commands still work offline. Ordinary chat and hypothetical
examples do not automatically become saved facts. Broader phrasing is routed by
intent hints; this is not a general conversational planner for every domain.

For “forget about wow. remember i like games and cool coding stuff”, it proposes
an edit removing the WoW clause while preserving languages and other interests,
and saves the new preference in the same SQLite transaction. All mutations are
validated against the supplied existing IDs. When review is enabled, the exact
before/after text is shown before committing. Concurrent edits, cancellation, revoked permission, malformed
output and offline inference cause no partial memory changes. Profile flags
survive topic edits. A clarification expires after two minutes or unrelated
conversation. A ten-minute operation receipt contains status/counts only, so
ordinary chat can distinguish completed, cancelled and failed memory changes.

Checks: `npm test` (83 passing), `npm run test:memory-language` (real chat/IPC,
SQLite topic correction and preference save with zero confirmation dialogs, model responses mocked), and
`npm run test:memory-language-live` (real local Qwen, temporary SQLite, reviewed
compound correction, recall and cancelled removal). Live tests never modify
the user's real personal database.

`node scripts/smoke-memory-language-live.js --no-review` verifies the same
compound correction and recall with real local Qwen and no review dialogs.
Ambiguous requests still ask which detail was intended. PC-action approvals
are independent of this memory preference.
