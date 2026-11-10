# CALLORIA v3.5.1 verification

- `node --check build/calloria-first-working-shift-v3-5-plugin.mjs`: PASS
- `node --test tests/calloria-first-working-shift-v3-5.test.mjs`: 12 PASS, 0 FAIL
- ZIP integrity: PASS
- Full repository `npm test`: NOT RUN
- Full Vite production build: NOT RUN
- Vercel deployment: NOT RUN
- Live model loading and Android verification: NOT RUN

The patch verification covers the modified build transform and its focused tests only.
