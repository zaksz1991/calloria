# v7.08 installation checklist

- [ ] Copy `calloria-mobile-runtime-v6-80.css` to the repository root.
- [ ] Merge `tests/mobile-runtime-v708.test.mjs` into `tests/`.
- [ ] Do not overwrite the real `index.html` with the ZIP fixture.
- [ ] Keep all previous Vite and application changes.
- [ ] Commit and push through GitHub Desktop.
- [ ] Confirm Vercel serves `/calloria-mobile-runtime-v6-80.css` with HTTP 200.
- [ ] Confirm the production build completes.
- [ ] On a phone, verify assessment answers and Continue are visible, page width does not scroll sideways, tables scroll within their panels, and the Shift Control launcher sits above the bottom nav.
