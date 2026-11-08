# CALLORIA GLB-first workplace correction v2.1

- Starts mobile gameplay at the exact approach point for GLB-backed Agent Station 11, including on every later floor entry.
- Adds an in-world objective card that guides the player to USE and responds to the existing nearest-station and station-access callbacks.
- Replaces selected front-row primitive desks, both monitor positions, and the reception counter with actual repository GLBs.
- Adds desk/computer/headset/reception asset limits by device tier; preserves instanced fallback furniture for unselected stations.
- Registers Meshopt decoding in the new office loader and reports individual load/rejection errors.
- Allows proportion-checked, unit-normalized static human GLBs at standing support posts only; seated agents still need a proper seated animation.
- Replaces the false local-staff success label with confirmed GLB counts and explicit loading/fallback/failure status.
- Preserves all original GLB files and existing application modules.
