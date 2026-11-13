# v6.37 — Native Browser Staff Voice

- Added `window.CalloriaStaffVoice` using the browser-native SpeechSynthesis API.
- Connected utterance `onstart`, `onend` and `onerror` lifecycle to the existing targeted `calloria:staff-speaking` morph event.
- Added `speak`, `stop`, `cancel`, `getVoices` and `isSupported` methods.
- Added bounded language, voice, rate, pitch, volume and mouth-intensity options.
- Enforced one active CALLORIA utterance at a time and resolved cancelled utterance promises safely.
- Preserved an existing app-owned `window.CalloriaStaffVoice` object.
- Kept the v6.36 event receiver and all earlier staff idle/morph functionality intact.
- The separate contact-handling UI is not automatically wired; it must call the documented API.
