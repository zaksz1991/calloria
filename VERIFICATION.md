# Verification — CALLORIA v6.20

Executed in the patch workspace:

- Node built-in focused tests: 4 passed, 0 failed.
- `node --check` syntax checks: passed for all four production JavaScript modules.
- Static lifecycle contract checks: passed, including v6.17.1 lobby export, v6.18 greenery integration, and v6.19 partition integration.
- ZIP archive integrity: passed.

Not verified: full Vite production build, Vercel deployment, HTTP delivery of external CC0 assets, actual browser/WebGL rendering, and renderer shadow-map configuration. Lobby shadow receiving only becomes visible when the existing renderer has shadow mapping enabled and dynamic objects cast shadows. Glass appearance depends on the source GLB's material names/alpha/transmission metadata; the status counts report whether materials were actually matched.
