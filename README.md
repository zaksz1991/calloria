# CALLORIA v6.57.1 — Vercel Build Repair

Corrective update for the v6.57 Seamless Product Handoff build failure.

The former plugin treated one exact line of JavaScript as mandatory and threw when Vite's transformed module no longer contained that exact text. The replacement detects the actual support-router workbench bindings and appends the prefill bridge after the module. Unexpected module shapes produce a warning rather than a fatal build error.

The product discovery links, six RuffNeck platform IDs, prefilled enquiry copy, consent requirement and manual submission behaviour remain unchanged.

See `INSTALL-GITHUB.md` for the GitHub GUI installation steps and `VERIFICATION.md` for limitations.
