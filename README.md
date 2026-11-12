# CALLORIA v6.35 — Staff Eye-Gaze Morph Support

This is an incremental replacement patch for the CALLORIA staff GLB build plugin. It adds occasional, subtle eye glances to static-pose staff GLBs only when they already contain compatible per-eye eye-look morph targets.

The controller recognises explicit ARKit-style per-eye directions, returns inactive directions to their captured baseline, and reports how many deployed staff/morph targets support the feature. It does not create facial geometry or animation clips.

No new packages, runtime pages, assets, API keys, Supabase changes, or database migrations are included. Apply over v6.34; see `INSTALL-GITHUB.md`.
