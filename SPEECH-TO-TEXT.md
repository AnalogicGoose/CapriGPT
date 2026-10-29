# Speech to text

Restart Capri to load the new speech engine. The old Windows desktop recognizer
has been replaced by local **Whisper large-v3-turbo**, with Silero voice activity
detection and GPU acceleration when available.

1. Open chat and click the microphone beside Send.
2. Speak into the PC's default microphone. Pause naturally between phrases; the
   recognized phrase appears after the pause, rather than unstable word guesses.
3. Click again to stop, review or edit the text, then press Send. Nothing sends
   automatically. Esc stops dictation without closing chat.

The microphone turns red while active and its green bar indicates input level.
Status distinguishes model loading, microphone opening, listening and transcribing.
The draft is read-only and Send is disabled while listening or finishing the last
phrase. Existing text and the cursor/selection are preserved. Each session lasts
up to 90 seconds, and the draft stays within 500 characters.

## Accuracy and languages

The multilingual model detects the spoken language automatically, including English
and Spanish. No Windows speech language packs, API key or speech account are used.
Audio is captured as mono PCM at 16 kHz with browser noise suppression and echo
cancellation. Short pauses delimit phrases; neural Silero VAD rejects non-speech
before Whisper decodes it. Silence is never deliberately turned into a transcript.
There is no fallback to the old Windows recognizer.

## Local runtime

This checkout has the runtime and models installed under ignored
`.caprigpt-local/speech-runtime/`. The model is approximately 574 MB; the NVIDIA
runtime is approximately 685 MB compressed. The user's RTX 5070 Ti was tested with
GPU inference. An official CPU build is included as a compatibility fallback.

The installed application stores its runtime under its own user-data folder.
On first microphone use, missing runtime/model files download from official
whisper.cpp GitHub releases and the linked Hugging Face model repositories. All
archives and weights are pinned to SHA-256 digests and verified before use.
Downloads carry model files only, never microphone audio. No speech model runs
just because Capri starts.

Recognized audio is processed by a hidden whisper.cpp process bound only to
127.0.0.1, on a fresh local port and random private request path. Audio travels
from the microphone to that local process in memory. It is not uploaded to an
external server, saved as a recording or written into application logs. Whisper
and its GPU allocation are released after dictation finishes or is cancelled.

Manual setup: `node scripts/install-speech.js --gpu` for this NVIDIA PC, or
`node scripts/install-speech.js` for the CPU runtime.

## Stopping and cancellation

Clicking Stop first closes microphone tracks, flushes the last audio buffer and
then transcribes the final phrase. Chat close, put-away, focus loss, fullscreen,
Gaming mode, reload or app exit cancels dictation. Returning does not restart it.
Session IDs and capture epochs reject late microphone permissions, old audio and
stale transcripts. A stopped session cannot overwrite a new session's draft.

If capture fails, check the default input in Windows Sound settings and desktop
microphone access under Windows privacy settings. If setup fails, check internet
connectivity for the initial model download. Already-installed models work offline.

## Verification

- `npm test`: speech segmentation, WAV format, request validation, cancellation,
  final-phrase flushing, stale results, draft limits and the application suite.
- `node scripts/check-whisper.js`: actual production Whisper engine against a
  recorded English sample (LibriSpeech), a recorded Spanish telephone sample
  (PolyAI MINDS-14), quieter English with added interference, and silence. It also
  uses the generated English WAV if available. Public fixtures are fetched on
  first run and cached only in the ignored local test folder.
- `powershell.exe -NoProfile -NonInteractive -File scripts/check-speech.ps1`:
  generates an English test WAV, then runs the same Whisper checks. System.Speech
  is used here only to create synthetic test audio, never for recognition.
- `node_modules/electron/dist/electron.exe scripts/smoke-electron.js --speech-only`:
  real Chromium fake-device capture, AudioWorklet, PCM IPC, draft insertion and
  full UI lifecycle, with neural inference mocked. It checks startup/stop races,
  final audio flushing, chat close, Gaming mode, fullscreen and Esc. It never opens
  the user's actual microphone.
- `node_modules/electron/dist/electron.exe scripts/smoke-electron.js --speech-whisper-live`:
  the complete production pipeline with the recorded English WAV as Chromium's
  non-looping fake microphone. Real AudioWorklet capture, PCM IPC, speech boundaries,
  GPU Whisper/Silero decoding, draft insertion, final flushing and model release
  are exercised together. Run `node scripts/check-whisper.js` first to cache the
  public audio fixture. The user's actual microphone is not opened.

Recent local results are in `.caprigpt-local/speech-check/whisper-results.json`.
Recorded English and Spanish, quieter/interfered English and silence checks passed;
GPU transcription took about 0.2–0.3 seconds per tested speech clip after warm-up.
Those are small fixture checks, not a general accuracy benchmark or a guarantee
for an untested microphone/accent. A trial with the user's voice remains useful.

See [VOICE-RESEARCH.md](VOICE-RESEARCH.md) for the decision and primary sources.
