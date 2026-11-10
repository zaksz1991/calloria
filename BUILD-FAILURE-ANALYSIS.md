# Build failure analysis — commit 12772ea

Observed failure:

`[plugin calloria-ojt-glb-activation-v3-7] js/main.js: CALLORIA v3.7 expected one employment offer acceptance anchor; found 0.`

Cause: the v3.7 plugin searched for the entire pre-bridge `acceptOffer()` line. The earlier first-shift integration inserts a `window.dispatchEvent(new CustomEvent('calloria:game-employment-accepted', ...))` statement inside that function. The exact full-line anchor therefore disappears even though the offer-acceptance function is still present and valid.

Related fragility: v3.7 also searched for the old asset-status callback text. The first-shift bridge owns and changes that callback to publish GLB staff/office telemetry. It also can modify the workstation action tail. The repair therefore removes those brittle dependencies and uses stable function boundaries.

No application business logic is rewritten wholesale. OJT state is inserted immediately after the stable `state.hired=true;` prefix; the prior gameplay event and remaining function body remain intact.
