# v6.29 changes

- Adds graphics-tier idle update rates: low 12 Hz, balanced 20 Hz, high 30 Hz.
- Caches staff hierarchy visibility for 250 ms instead of traversing every rendered frame.
- Staggers controller update phases to reduce simultaneous pose-update bursts.
- Preserves authored mixer updates, existing idle channels, bounded delta and lifecycle cleanup.
- Adds scheduler tier and visibility-cache details to runtime diagnostics.
