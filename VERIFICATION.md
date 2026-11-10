# v3.6.0 Verification Record

## Checks performed in the preparation workspace

- `node --check` on the new conversation engine: passed.
- `node --check` on the new Vite plugin: passed.
- `node --check` on the replacement Vite config: passed.
- Applied the current v3.5.1 main.js transform followed by the v3.6 transform to the available v1.4.0 application source fixture: passed.
- `node --check` on the transformed application fixture: passed.
- Focused Node tests: **14 passed, 0 failed**.
- ZIP integrity: checked after packaging.

## Verification boundary

The available local source fixture is the archived v1.4.0 application source plus the current v3.5.1 transform. Public `main` source inspection confirmed the required current inbound renderer, call-start, submission, CRM case and Vite plugin anchors; the full current repository was not available as a local checkout.

Not performed:
- Full repository `npm test`.
- Full Vite production build against the complete latest `main` checkout.
- Vercel build/deployment.
- Real-browser interaction, physical Android/iOS or GPU profiling.
- Microphone-driven conversation, external telephony or live CRM/core-banking integration.

The ZIP is a source patch, not evidence of a successful deployment.
