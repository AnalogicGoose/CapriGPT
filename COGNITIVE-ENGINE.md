# Capri Cognitive Engine — Foundations and Private Reflection

This branch implements the first two stages of a bounded, local-first curiosity pipeline. **It does not enable autonomous tool execution, spontaneous conversations, screen capture or speech.**

## Event → question → local reflection

1. The existing Windows foreground-change watcher triggers the `CognitiveFoundation` observer through the permissioned `ContextService`.
2. Three visits to the same application within ten minutes create one tentative question (30-minute per-app cooldown).
3. The observer stores **only a validated application name and a fixed evidence code** in a separate SQLite journal. No window titles, process lists, messages, screenshots or keystrokes are stored.
4. The `ReflectionEngine` schedules a low-priority local Ollama inference. It asks the existing `qwen3.5:9b` agent model for schema-constrained JSON: a revised question, hypothesis, counterpoint, confidence, priority and `wait | ask_later | dismiss`.
5. The result is fully validated before persisting. Hypotheses are explicitly speculative; `ask_later` only records a possibility and **does not** send a message.
6. Reflections survive app restart. Unprocessed questions remain in the journal and can be processed on a later qualifying event.

## Safety and runtime limits

- Existing agent, gaming mode, foreground context and event-observation settings gate the pipeline. Permissions are rechecked after asynchronous observation and before saving model output.
- The reflection engine uses the existing local Ollama integration. It cannot use the web or any desktop tools. It does not write to authorized personal memories.
- At most **two autonomous reflection model calls per rolling hour** while Capri is running, including unsuccessful calls; maximum one concurrent job; 45-second cancellation deadline.
- User requests cancel background reflection through `ForegroundPriority`. An in-progress reflection is also cancelled on game mode, policy changes, application shutdown, or explicit pause.
- Only meaningful observed events schedule reflection; there is no continuous model inference loop.
- Journal holds at most 100 questions and prunes entries older than 30 days.
- Default `cognitiveEnabled=true` can be disabled through the local `/curiosity off` command. Questions remain until the user deletes them.

## User commands

- `/curiosity status`: view observation and model-assistance status.
- `/curiosity list`: inspect questions and stored reflection records.
- `/curiosity on` / `/curiosity off`: enable or pause cognition.
- `/curiosity resolve <id>`: mark a question resolved.
- `/curiosity dismiss <id>`: dismiss a question.
- `/curiosity clear`: delete the entire curiosity journal.

## What this is not

This is bounded self-questioning behavior, not evidence of consciousness. Repeated app focus does not prove a user wants help. Model output must not be treated as observation or authorization, and it never initiates a spoken conversation at this stage.

## Next milestone

Add explicit user-goal and feedback signals with verified provenance; measure useful questions and false positive rates; add opt-in interruption policies and a soft, non-invasive UI for inspecting curiosity. Only then consider proactive conversation.

## Validation

Unit tests include the reflection output schema, numeric limits, local inference orchestration, permission gating, foreground cancellation, error handling, duplicate questions and retention. Run `npm test` and relevant Windows Electron smoke tests before merging.
