# CALLORIA v7.09 verification

## Automated checks

- Pure engine regression tests: 11 cases covering record creation, legacy normalization, idempotent call/case capture, QA threshold, missing QA, breaches, coaching acknowledgement, clean-case target, re-opened review, attestations and immutable completed status.
- Build-plugin tests: 2 cases covering successful post-transform injection, idempotency and transactional safe-skip when expected markers / anchors are missing.
- JavaScript syntax checks: engine, plugin and injected runtime snippet.
- CSS structural checks: balanced delimiters, responsive layout, mobile button sizing and reduced-motion handling.
- ZIP archive integrity check.

## Production checks not performed

- Full Vite build in the user's repository.
- GitHub Actions execution against the actual repository.
- Vercel production deployment.
- Browser end-to-end interaction with real saved profiles.
- Physical phone testing.

The plugin depends on the current First Shift Gameplay and OJT transforms. It warns and skips without partial modification if those markers or the final `renderView()` insertion boundary differ.
