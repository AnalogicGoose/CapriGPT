# CapriGPT next milestones

## 1. Local companion (current)

Use upstream art and animation locally, Ollama chat, bounded inference, manual gaming pause, loopback-only AI transport, and a main-process confirmation gate. No cloud fallback, background agent, or autonomous desktop executor. Keep this small enough to validate before adding integrations.

## 2. Optional paid OpenAI API routing

Add a provider interface in the main process with `ollama` as the default and an explicitly selected `openai` provider. Use the [Responses API](https://developers.openai.com/api/docs/guides/text). Keep the key in Windows Credential Manager or equivalent OS-backed storage; never put it in the renderer, repository, screenshots, or logs.

Before any cloud send, show the destination, selected model, and exact outgoing text. Require explicit approval for cloud use; a failed local request must not silently switch to a paid provider. Limit reply tokens, request concurrency, retry count, and daily requests. Show estimated cost before sending and actual usage afterward. An application-level budget can stop this app's requests; it does not cap spending by other apps using the same account. Use current official pricing when implementing, rather than hardcoding today's prices in this prototype.

**ChatGPT Plus is separate from OpenAI API billing.** A Plus subscription does not provide general-purpose Platform API credits. API-key requests are billed to the Platform account. Codex with ChatGPT sign-in uses the applicable subscription allowance and limits. See official [pricing](https://learn.chatgpt.com/docs/pricing) and [authentication](https://learn.chatgpt.com/docs/auth) documentation.

Keep normal casual conversation local. Offer cloud routing as a visible user choice for a specific difficult request. Gaming mode should block all inference in the initial design, including cloud calls, until the user explicitly changes that policy.

## 3. ChatGPT/Codex integration

First implement a manual handoff: copy a user-approved prompt or summary for use in ChatGPT/Codex. Do not read browser sessions, reuse cookies, extract the desktop app's tokens, or promise access to ChatGPT memories/conversation history.

Next, prototype a separate opt-in Codex adapter using documented [Codex app-server](https://learn.chatgpt.com/docs/app-server) events and approval messages. Map task start, progress, waiting-for-user, failure and completion to existing Capri animations. Start with read-only notifications. Label Codex events distinctly rather than pretending they are Claude events. Strip file content and command output unless explicitly needed and approved. Never interpret a model's text as authorization.

Codex supports ChatGPT sign-in and API-key authentication; these have different billing and usage rules. Use its supported authentication flow instead of handling credentials inside Capri. Recheck current [Sign in with ChatGPT integration guidance](https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt) before implementing broader subscription-powered app features. Availability and eligibility must be verified; no such integration is wired in this milestone.

Any future desktop tool needs a narrow allowlist, a concrete preview, a fresh confirmation bound to the exact action and target, expiry, and a cancellation path. Preserve native Codex approval behavior. Do not connect model output directly to shell execution. File writes, launching programs, browser actions, and external messages remain separate future scopes.

## 4. Distribution and gaming polish

Resolve character asset permissions or replace them with licensed assets before publishing installers. Preserve original credits and font licenses. Benchmark idle overlay cost, active inference and gaming FPS on the actual laptop. Consider optional CPU-only chat or automatic game detection only after measuring; manual pause and quitting remain the predictable ways to remove inference/overlay cost.

## Repository map

- `src/main/ollama.js`: local transport, model checks, bounds, timeout and unload.
- `src/main/main.js`: Electron window, tray, IPC, gaming pause and streaming coordination.
- `src/main/action-confirmation.js`: main-process app-close approval gate.
- `src/main/apps.js`: restricted Windows close operations.
- `src/renderer/js/chat.js`: upstream persona, history and chat panel.
- `src/renderer/js/acting.js`, `capri.js`, `sprite.js`, `fx.js`: existing animations and rendering.
- `hooks/`, `scripts/install-hooks.js`: legacy optional Claude integration.

Hosted fork: [Chocoyito1/capri-desktop](https://github.com/Chocoyito1/capri-desktop). The prototype is pushed to `codex/caprigpt-local`, based on upstream `79a016c`.
