'use strict';

// Extension contracts. Adapters must be explicitly installed before the registry
// advertises them. No shell fallback, microphone listener, or coordinate clicking.
class SpeechAdapter {
  async listenOnce({ signal } = {}) { signal?.throwIfAborted(); throw Error('Use the microphone button for local dictation. Agent-initiated microphone capture is not available.'); }
  async speak(text, { signal } = {}) { signal?.throwIfAborted(); throw Error('Local speech synthesis is not installed.'); }
  stop() {}
}
class AccessibilityAdapter {
  async inspect({ signal } = {}) { signal?.throwIfAborted(); throw Error('Windows UI Automation reader is not installed.'); }
  // Future implementation: stable element identity, fresh inspection, native
  // confirmation of the exact effect, then revalidation before Invoke/Value.
  async invokeApproved() { throw Error('Accessibility actions are not installed.'); }
}
module.exports = { SpeechAdapter, AccessibilityAdapter };
