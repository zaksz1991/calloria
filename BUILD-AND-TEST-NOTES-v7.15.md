# Build and test notes — v7.15

- Uses native browser event delegation; the live coach supports the active dynamic digital-contact view without binding duplicate listeners on each render.
- The submit guard is attached in capture phase so a blocked unsafe draft is stopped before CALLORIA's delegated submit handler records it.
- Coaching gaps and unsupported outcome statements are warnings, not automatic send blocks.
- The only blocking rules are requests for authentication secrets, unmasked payment-card numbers and requests for account/personal identifiers in public social replies.
- The build plugin is `enforce: 'post'`, targets only `/js/main.js`, requires two unique anchors and is idempotent.
- Test command in the repository is `node --test tests/*.test.mjs tests/commitment-engine-v69.test.cjs`; the focused package suite was run separately and passed all 16 tests.
