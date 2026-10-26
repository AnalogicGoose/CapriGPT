# Local validation

Validated on this Windows laptop during the CapriGPT build session:

- Upstream `79a016c` (0.3.1) cloned, dependencies installed, original Electron app launched and its local health endpoint responded.
- `npm.cmd ci`: installed successfully; npm audit reported zero known vulnerabilities at installation time.
- Ollama `llama3.2:3b` downloaded (Q4_K_M, about 2 GB on disk).
- GPU reported as RTX 5070 Ti Laptop GPU, 12,227 MiB VRAM.
- `npm.cmd test`: five safety tests pass. These cover address restrictions, request bounds/unload/no-tools/redirect policy, cloud metadata rejection, cancellation, and the desktop confirmation gate with simulated responses.
- `npm.cmd run test:desktop`: actual Electron renderer/preload/main/Ollama flow passes. A submitted arithmetic question received streamed model output and displayed `15` in the successful run. The test verifies that output came from stream events rather than a canned greeting.
- Same desktop test verifies disabled app-closing requests, cancellation of active inference, gaming-mode hiding and blocking, unloaded model via `/api/ps`, and overlay resume.
- The app's own chat capture was inspected visually (`captures/local-chat.png`). It contains only the transparent application overlay, not a desktop screenshot.
- `git diff --check`: passes.

One cold-start inference took roughly 27 seconds in Ollama's server log; subsequent runs were faster. This is a functional prototype, not a performance benchmark. Small model answers can be inaccurate or stay too much in character; a failed arithmetic answer in an earlier run prompted clearer helpful-assistant instructions. No gaming FPS test was performed.

Real applications were not closed or force-quit as part of validation. Approval behavior was tested with fake app backends; production requests use the native confirmation gate. No Windows installer was built and no cloud inference request was sent. After browser access connected, the GitHub fork was created at https://github.com/Chocoyito1/capri-desktop and the prototype branch was pushed. No PR or release was created. Inherited asset rights limitations still apply.

## Companion identity update

Removed Claude as the default collaborator from the system prompt and task context. Default help now describes local Ollama chat with planned ChatGPT/Codex task integration. Legacy hook setup remains in a labelled submenu. Added explicit limits against inventing calendar, clock, sunrise, orbit tracking or live task access. Restart clears the old in-memory conversation.

Safety tests and the desktop smoke test pass after this change. The updated live chat test answered: "I\'m working with ChatGPT and Codex as my collaborators, but their task integration isn\'t connected yet, so I don\'t have access to their current tasks or activities." The sampled response is evidence for this prompt, not a guarantee that a small generative model will never hallucinate. Gaming cancellation/unload/resume checks also passed.

## Codex notification milestone

Nine tests pass, including bounded metadata stripping, late-event deduplication, safe installer merging/removal, and a real forwarding child process against the authenticated HTTP receiver. The Electron smoke test passes for hook-to-renderer approval notifications, clearing on resume, cancellation/unload, gaming suppression, alerts after gaming resume, and local handoff preview/copy with mocked clipboard writes. Captured `captures/codex-notifications.png` is labelled CODEX · TEST and was inspected visually.

The installed Codex CLI reports version 0.164.0-alpha.11.1 and ChatGPT sign-in. A read-only app-server hooks/list call recognizes all eight installed CapriGPT definitions. They are enabled but untrusted: no genuine lifecycle dispatch is claimed yet. Review via /hooks is the remaining activation step. No trust bypass, account token extraction, cloud inference request, or background agent was used. Ordinary ChatGPT chats have manual handoff only.

## Real CLI activation verified

All eight hook definitions were confirmed trusted and enabled. The user’s app-bundled 0.164.0-alpha.11.1 terminal completed test prompts but did not launch the forwarder in this environment. Installing the complete official @openai/codex 0.164.0 package separately and launching it in a terminal with TERM cleared produced a genuine, non-test completion delivery (HTTP 200). The user confirmed that Capri visibly reacted. No account credentials or trust state were replaced. Desktop-app-originated events remain unverified.

Added an authenticated read-only receiver status endpoint and a bounded last-delivery diagnostic file without conversation content. Smoke tests use their own profile and connection file so they can run without stopping the live companion.

## Working-label cleanup

Fixed a state-isolation bug where an unfinished diagnostic fixture could keep the CODEX ticker visible after a genuine turn completed. Real events now remove test-only state, and test fixtures cannot enter an already-live connection. The renderer also excludes test state from real activity decisions. Ten tests pass, including a regression for an unfinished test task followed by a real task completion. The currently running older build needs a normal restart to load this change.
