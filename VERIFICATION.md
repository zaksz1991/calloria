# CALLORIA v6.21 verification

Performed in the patch workspace:

- Focused Node tests: 6 passed, 0 failed.
- JavaScript syntax checks: passed for both modified production modules and the test file.
- ZIP archive integrity: passed.
- Static checks confirm compatibility with the existing lobby alias and partition/greenery lifecycle imports.

Not verified: full Vite production build against the current GitHub tree, Vercel deployment, external CC0 asset delivery, actual browser/WebGL appearance, or renderer shadow-map configuration. Visible foliage shadows require the existing renderer to have shadow mapping enabled. This patch does not enable global shadows or change renderer quality settings.
