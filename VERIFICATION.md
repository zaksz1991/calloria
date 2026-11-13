# v6.40 verification

- 146/146 regression tests passed across the carried-forward suite and new contact-session tests.
- Build-plugin JavaScript syntax check passed.
- Generated staff-runtime transform syntax check passed.
- Contact-session lifecycle tests passed: start, say, interrupt, hold, resume, end and session replacement.
- Held-session replay and stale-session ownership tests passed.
- Event-based CRM integration, duplicate request protection, invalid-input handling and disposal tests passed.
- v6.39-to-v6.40 upgrade and transform idempotence tests passed.
- ZIP archive integrity verified.

Not verified: a complete Vite production build, Vercel deployment, integration with the live CRM/call screen, real browser speech playback, or in-world GLB mouth animation. The call screen still needs to call the session API or emit the documented contact-dialogue events.
