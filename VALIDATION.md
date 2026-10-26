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
