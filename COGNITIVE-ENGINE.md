# Cognitive Engine — Foundation (Phase 1)

This first slice introduces a local-only, **observation-only** curiosity journal. It is deliberately not an autonomous conversational system yet.

## How it works

- Existing Windows foreground-change notifications trigger a bounded context snapshot.
- The observer extracts **only a validated foreground application name**. It neither stores window titles nor records keyboard input, screen content or conversation transcripts.
- Three observations of the same application within ten minutes produce one low-confidence open question (30-minute per-app cooldown). Repeated unresolved questions are deduplicated.
- Questions are stored in a separate `curiosity.sqlite` file within the Capri user-data profile, bounded to 100 records and pruned after 30 days.
- The existing privacy policy is checked before and after each asynchronous observation. Agent disabled, gaming mode, revoked foreground/event permissions, or shutdown suppresses observation.
- No automatic model call, user notification or tool execution occurs in this phase.

## Local commands

- `/curiosity status` — journal status, including whether observation is available
- `/curiosity list` — inspect recent questions
- `/curiosity resolve <id>` — resolve a question
- `/curiosity dismiss <id>` — dismiss a question
- `/curiosity clear` — delete all curiosity questions

## Limitations and next steps

This is a safe foundation, not proof of conscious thought, and a repeated app focus alone does not reliably imply that the user needs assistance. The current questions must be treated as speculative, and cannot initiate conversation.

Next: model-assisted structured curiosity with evidence-based priority scoring, persistent goal state, bounded reflection, explicit source tagging, low-priority inference coordinated with the existing ForegroundPriority, and a separate, user-controllable interruption policy. Use real outcomes and feedback to evaluate usefulness before enabling spontaneous speech.

## Testing

`npm test` includes `tests/cognitive-foundation.test.js`. Windows Electron smoke tests are still necessary for real-world foreground observation and app lifecycle behavior.
