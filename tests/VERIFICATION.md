# Verification — CALLORIA v2.8

The focused plugin contract suite is designed to test against the current staff integration source anchors observed in `main` on 9 November 2026.

Included checks:
1. Meshopt decoder import and registration.
2. Removal of the arbitrary minimum bone count.
3. Meshopt support while retaining Draco rejection.
4. Static GLB support only for standing positions.
5. Separate animated/static telemetry.
6. Idempotency and unrelated-file isolation.
7. Fail-closed behaviour when the upstream source contract changes.
8. Preservation of existing Vite plugins and registration order.

The ZIP does not contain the complete CALLORIA repository or `node_modules`. A full Vercel production build and actual browser/mobile model rendering have not been run here. Those must be confirmed by the next deployment.
