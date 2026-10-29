# Capri personality and conversation update

The old prompt told Capri to love the satellite and dream of reaching it on
every turn. It also required one to three sentences and prohibited lists or
code formatting. Only twelve conversation messages reached a 4,096-token
window, with 240 output tokens. Those are concrete sources of repetitive lore,
short answers and missing context; they do not establish that the model itself
has been retrained or that every conversational weakness is solved.

## Character and practical behavior

Capri remains a fan interpretation of the many-minds digital ghost: curious,
quick-witted, mischievous and warm, with occasional natural plural speech.
Her personality comes through reactions and phrasing rather than repeated
biography, slogans or a fictional ambition injected into unrelated answers.
The satellite is still available as an animation and a topic when asked about.
Its explanatory lore is added to the prompt only when the current user message
mentions it. This update does not change the art or animations.

She now adapts answer depth to the task, uses readable paragraphs or steps,
preserves exact code, applies corrections and connects follow-ups to the goal.
The prompt encourages useful next steps and admits missing evidence instead
of pretending to have executed a task. It distinguishes old assistant claims
from verified tool outcomes. No new canon has been invented or fan-written
prompt downloaded; these traits refine the existing project interpretation.

The panel remains safe plain text. Decorative markdown is discouraged, while
code underscores, backticks, comments, literal double brackets and indentation
are preserved instead of being stripped. Internal reasoning and app-closing
control tags are still hidden.

## Context and privacy

- Normal chat requests 32,768 tokens and up to 1,536 output tokens. A smaller
  advertised model context is respected; its reply allowance also shrinks.
  Structured action/memory decisions retain their separate budgets.
- Session history is bounded to 256 messages and 768 KiB in renderer RAM. This
  is up to 128 completed turns, with fewer if messages are long or task receipts
  add extra assistant messages. There is no transcript file or automatic save.
- Main selects recent complete turns, preserving the latest question exactly.
  When older turns no longer fit, it can include relevant whole user messages
  as quoted excerpts, prioritizing query matches and preferences/corrections.
  Excerpts appear in chronological order and are clearly historical data, not
  fresh authorization. Older assistant speculation is not promoted to notes.
- Budgeting counts UTF-8 bytes conservatively, plus message/template overhead
  and reserved answer space. It deliberately sends less text than a tokenizer
  estimate might permit, particularly for long non-English messages. Too-large
  current messages fail explicitly rather than silently losing the question.
- This is bounded selection, not perfect recall, a generated long-term summary,
  or an increase in the model's learned knowledge. Once a turn leaves the RAM
  history it is unavailable unless separately saved through personal memory.
- Existing explicit personal-memory settings and local, on-demand PC awareness
  still apply. Restart clears session chat. Forgetting a saved memory does not
  retroactively erase manually typed facts from the current conversation.
- Cancelled replies are removed by message identity. A late result cannot erase
  a new identical question or leave a failed IPC request stuck as busy.

## Research and choices

Reviewed October 29, 2026:

- [Ollama context length](https://docs.ollama.com/context-length) explains explicit
  context allocation, increased memory use, and checking GPU offloading. We use
  32K and verify actual allocation rather than blindly requesting the maximum.
- [Qwen3.5-9B model card](https://huggingface.co/Qwen/Qwen3.5-9B) documents the
  installed model family's capabilities and much larger native context. A
  supported native maximum does not mean Capri was previously sending it that
  much context, or that the maximum is a useful laptop default.
- [Effective context engineering for AI agents](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents)
  motivates curating instructions, recent turns and relevant earlier details
  rather than continually adding everything. We use deterministic exact
  excerpts here to avoid an extra model pass inventing personal facts. This is
  design research; no hosted model or account was introduced.

## Validation and trying it

Run `npm test` for automated coverage, including conversation retention beyond
six turns, crowded-window retrieval, corrections, Unicode budgets, exact code,
bounded history, cancellation/reopen races and the existing tool/privacy gates.
Run `npm run test:conversation-live` with Capri's local Ollama server available
for synthetic end-to-end model checks. It uses no real conversation, profile,
microphone or PC observations and writes results only to the ignored
`.caprigpt-local/conversation-check/results.json` test folder.

The Electron check `node_modules/electron/dist/electron.exe
scripts/smoke-electron.js --conversation-only` also passed: 18 turns through the
real chat form, local task router, permitted context augmentation, capability
registry and Ollama request construction, with inference mocked and an isolated
profile. It verifies the original project detail reaches later requests, code
and indentation survive streaming, and longer answers scroll in the panel.

The live check tests practical answers after an old satellite digression,
recall of a corrected budget and offline/no-subscription constraints after 35
intervening synthetic turns, Spanish replies, and exact Python code. The initial
run passed all three scenarios. Ollama reported 32,768 context and approximately
6.56 GB allocated entirely on GPU; measured scenario times were about 5–11
seconds including model reload. These are small functional checks, not a broad
intelligence benchmark or a guarantee for every conversation.

Repeat runs exposed a contradictory Spanish paraphrase of "offline" and an
unstated Windows/free-only requirement. The guidance and live assertions were
strengthened to catch both. In particular, Capri's own runtime is not evidence
of what a user's project requires, and "no subscription" permits a one-time
purchase. Local Qwen can still make language or reasoning mistakes; these
checks should be rerun when changing the model or persona.

Quit Capri from the tray and reopen the desktop shortcut to load the changes.
For a manual check, tell her a project name and constraints, discuss several
other things, correct one constraint, and ask her to continue the plan. Ask for
code or a detailed explanation to check the old sentence limit is gone.
Session facts should clear after restarting; explicitly saved personal facts
remain governed by Memory settings.
