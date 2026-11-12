# CALLORIA v6.32 — Staff Eye-Blink Morph Support

This incremental patch extends the staff GLB runtime so supported static-pose characters can blink using morph targets already embedded in their GLB files.

The runtime recognises narrowly defined eye-blink morph names, keeps their original neutral influence, and applies an occasional short closure pulse with per-character timing variation. It does not alter authored animation clips or facial expression channels that do not clearly identify an eye blink.

A model only receives this effect when it exposes one or more compatible blink morph targets. Models without them continue using the existing idle behaviour.

See `INSTALL-GITHUB.md` for the single-file replacement path and `VERIFICATION.md` for the checks performed.
