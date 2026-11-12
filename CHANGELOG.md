# CALLORIA v6.21 changelog

## Lobby greenery shadow polish

- Keeps greenery batches separate from static lobby architecture while still batching compatible foliage by shared material and vertex attributes.
- Detects the greenery asset through its authored parent marker; no guessed mesh names or new placements are introduced.
- Balanced/high tiers allow foliage batches to cast shadows and the lobby to receive shadows. Low tier disables both to protect mobile performance.
- Static lobby architecture remains non-casting, avoiding a large shadow-map cost.
- Adds decorative batch, mesh and shadow-caster counts to the existing lobby lighting status.
- Preserves the v6.20 glass finish, v6.19 department partition runtime, v6.18 greenery placements and v6.17.1 lobby export compatibility.
