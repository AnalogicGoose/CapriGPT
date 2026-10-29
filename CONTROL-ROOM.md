# Capri control room

Right-click Capri or her tray icon to open her custom settings window. The tray’s
left click opens it too. Close with Escape or the top-right X; Capri stays running.

The window shares her existing fonts, dark violet palette, green accents, cut
corners and character portrait. It has seven sections:

| Section | Controls |
| --- | --- |
| Overview | Agent status, local brain, memory state, gaming pause, put away/bring back |
| Appearance | Character size, display, wandering, sitting on windows, window mischief |
| Sound | Mute, volume, custom sound folder |
| Memory | Confirmed memories, suggestions, recall, retention, review/export/delete |
| PC awareness | Active app, titles, process names, event refresh, time, power, performance |
| Connections | Codex notification status and where approvals belong |
| Updates & app | Local source/version check, restart, Windows startup, language, build details |

Changes save automatically and update the overlay. The control room remains
available while gaming mode hides Capri, so pausing never removes the resume
control. Ctrl+Alt+C still puts her away/brings her back. Click Capri to chat.

The old Windows menu is no longer used. Teleport, demo, guide, mission report,
chat handoff and redundant Talk/agent/action controls were removed from the menu.
Agent and app-closing support default on; native confirmation is still required
before closing an app. New apps remain automatically included in PC awareness.

Qwen 3.5 9B is selected by default. Llama 3.2 3B was deleted through Ollama’s
model API after verifying Qwen was installed. Existing appearances and gaming
pause preferences are preserved by the settings migration.

Legacy Claude event ingestion, renderer subscription, hook setup endpoints and
menu entries were removed. Existing hook settings were checked; this account had
no Capri hooks installed in Claude. Archived upstream guide/installer files stay
in the repository but are not connected to the running application.

Settings run in a separate sandboxed window with a restricted preload. Only the
displayed preferences and named actions are accepted by its main-process API;
hidden agent/action switches, arbitrary commands and navigation are rejected.
Memory export/deletion retain the existing review dialogs.

Validation: `npm test`, `npm run test:settings`, and the existing Electron smoke
checks. Settings tests exercise all seven rendered sections, appearance/sound
persistence, removed legacy endpoints, pause/resume while controls remain visible,
and close/reopen behavior. Screenshots are saved under ignored `captures/`.
