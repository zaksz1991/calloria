# Source baseline — CALLORIA v7.13

Target baseline: public `main` branch of `zaksz1991/calloria`, inspected 22 November 2026.

The change targets these exact `main.js` operations:
- completion of inbound callback task after validated inbound wrap-up;
- outbound callback-task completion in after-contact work;
- inbound `returnCallToQueue()`;
- outbound `cancelOutbound()`;
- outbound promise retry scheduling inside `scheduleRetryForCommitment()`.

The Vite plugin is registered after the existing public visitor/product plugins and after the v7.12 Promise Control integrity plugin. The existing application files and asset binaries are not replaced.

This is a targeted source overlay. It does not contain the full repository, `public/assets/` model binaries, secrets or environment files.
