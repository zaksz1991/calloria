# Verification — CALLORIA v6.42

The included focused test suite covers:

- current main.js consent/privacy anchors;
- the explicit agent-response action;
- communication rubric and critical security-request handling;
- CRM transcript and call-timeline persistence;
- fail-closed behaviour when application anchors change;
- duplicate-transform protection.

The plugin and test files can be syntax-checked without installing project dependencies.

Not verified in this workspace:

- the full Vite production build;
- the complete repository test suite;
- microphone permissions or live speech recognition in a browser;
- mobile-device speech recognition;
- a Vercel deployment or live production behaviour.

The patch is based on the source anchors currently present in the public `main` branch. The transform validates all required anchors before making any change and skips without partial edits if the application source has drifted.
