# Voice-agent speech research and implementation choice

Investigated on 2026-10-29 after the Windows dictation engine repeatedly misheard
the user's real speech. The earlier synthetic-voice test did not establish that
engine's accuracy for the user's accent, microphone or room.

## What developers commonly build

A documented voice-agent pipeline separates microphone capture, speech detection,
speech-to-text, the language model and optional text-to-speech. LiveKit describes
STT → LLM → TTS as its core pipeline and integrates multiple dedicated STT models.
Pipecat likewise has dedicated cloud and local speech services. These are modern
neural recognition models, rather than the legacy Windows desktop dictation engine.

Some frameworks also offer speech-to-speech models. Capri's current requirement
is microphone dictation into a text draft, so an STT pipeline fits the existing app
without replacing its local Ollama conversation model.

There is no reliable cross-ecosystem usage census in the sources checked. A list
of integrations, a vendor's popularity claim or GitHub stars is not proof that
one provider is used by a majority of developers. The evidence supports a common
architecture and established options, not a defensible single "most used" engine.

Primary references:
- [LiveKit STT overview](https://docs.livekit.io/agents/models/stt/): pipeline, supported engines and multilingual transcription.
- [Pipecat supported services](https://github.com/pipecat-ai/pipecat): cloud/local STT and speech-to-speech integrations.
- [Deepgram + LiveKit guide](https://developers.deepgram.com/docs/build-voice-agent-with-livekit-and-deepgram): a documented hosted deployment needing credentials.

## Options relevant to Capri

| Approach | Practical consequence |
| --- | --- |
| Dedicated hosted STT, such as Deepgram | Established framework integrations and streaming services; requires credentials and sends audio to the provider. |
| Local Whisper, via faster-whisper or whisper.cpp | Established open-source recognition implementations; model downloads and local compute, but no speech API key or external audio upload. |
| Existing Windows desktop dictation | Already available, but failed this user's actual speech; removed from Capri's recognition path. |

Pipecat explicitly supports offline Whisper and automatic language detection.
Whisper's published research/model documentation describes multilingual training
and robustness to accents and noise, while also documenting limitations. This is
not a promise of perfect recognition for every speaker.

Primary references:
- [Pipecat local Whisper](https://docs.pipecat.ai/api-reference/server/services/stt/whisper).
- [Whisper repository and model documentation](https://github.com/openai/whisper).
- [Whisper model card](https://huggingface.co/openai/whisper-base/blob/main/README.md).
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper).
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp).

## Implemented decision

The user selected **Local Whisper, no API key**. Capri now uses:

- Default-device microphone capture through Chromium with noise suppression and
  echo cancellation, mono 16 kHz PCM through an AudioWorklet.
- Phrase boundaries with a short pre-roll and quiet tail, followed by neural
  Silero VAD to reject non-speech.
- Multilingual **Whisper large-v3-turbo**, Q5 quantized, running through a hidden
  local whisper.cpp server. Automatic language detection; transcription rather
  than translation. English and Spanish require no Windows speech packs.
- GPU inference on the tested RTX 5070 Ti. The same model can use CPU fallback;
  that fallback is slower and does not silently revert to Windows recognition.
- Completed phrases inserted into the existing draft, with manual Send preserved.
  Unstable word-by-word hypotheses from Windows are no longer the main UI output.

The desktop app already has its own microphone/UI lifecycle, so a full LiveKit
network transport deployment is unnecessary. This adopts the dedicated neural
STT architecture used by those frameworks while fitting Capri's local desktop.

The pinned official whisper.cpp build is b5454 (the v1.9.5 commit), with SHA-256
verification for the Windows binaries, model and Silero weights. Model audio
requests remain in memory on 127.0.0.1; they are not uploaded or saved as recordings.

## Evidence from this PC

A CPU trial of the larger model took about 13 seconds for the generated phrase,
so CPU alone was not selected as the primary route. NVIDIA acceleration passed.
Its initial driver/kernel warm-up was much slower than subsequent runs; after
warm-up, the production engine loaded in roughly 0.8 seconds and transcribed the
checked speech clips in roughly 0.2–0.3 seconds each. Silence returned an empty
transcript in about 6 ms. These small fixture timings do not predict every clip.

The checks include generated English, actual recorded English, actual recorded
Spanish telephone speech, and quieter English with added interference. They check
key phrase content and silence, not a broad statistical word-error-rate benchmark.
A trial with the user's actual voice is still needed to assess that microphone
and accent. The old failed approach is not retained as a fallback.

Public audio sources and attribution:
- [LibriSpeech test fixture](https://huggingface.co/datasets/hf-internal-testing/librispeech_asr_dummy), clean/validation row 0; spoken book-review sentence.
- [PolyAI MINDS-14](https://huggingface.co/datasets/PolyAI/minds14), es-ES/train row 0; CC BY 4.0; Spanish telephone/application-error sentence.

Raw fixtures and results are kept only in ignored `.caprigpt-local/speech-check/`.
No microphone audio from the user was recorded for automated testing.

The full production app was additionally tested with the recorded English file as
Chromium's non-looping fake microphone: actual AudioWorklet → PCM IPC → segmenter →
GPU Whisper/Silero → draft, including stop/final flush and model release. It returned
the expected sentence without extra words after end-of-file silence. The automated
suite now has 98 passing tests, including late permission/worklet cancellation
that must not stop a replacement capture session.
