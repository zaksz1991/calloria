# CALLORIA 0.7.0 — Verification Report

## Source

Prepared from the uploaded `CALLORIA-v0.6.0.zip` project. Existing recruitment, workforce, voice, 3D workplace and contact-centre files were retained while the multi-channel engine and UI were added.

## Completed checks

| Check | Result |
|---|---|
| Automated regression suite | 55/55 passed |
| JavaScript syntax checks (`npm run check`) | Passed |
| Multi-channel queue, lifecycle and priority tests | Passed |
| Credential/card-data request blocking tests | Passed |
| Social privacy context tests | Passed |
| CRM linkage and UI wiring checks | Passed |
| ZIP integrity | Checked when the release archive was packaged |

## Not verified

- Vite production build: `npm run build` returned `vite: not found` because dependencies were not installed.
- Dependency installation: `npm install --no-audit --no-fund` did not complete within 120 seconds.
- Browser rendering, live form interaction, responsive layout and physical-device behaviour were not tested in a browser.
- 3D rendering, GLB downloads, animation clips and workstation station interactions were not browser-tested.
- No GitHub commit or Vercel deployment was made.

## Functional boundary

Digital support is a single-player synthetic simulation. It does not connect to Gmail, Outlook, Instagram, Facebook, X, WhatsApp, a live chat provider or a real CRM. The rule-based digital QA score is an instructional feedback aid, not a certified assessment standard. Email, chat and social response targets are illustrative values.
