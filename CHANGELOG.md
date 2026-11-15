# CALLORIA v6.57.1 — Vercel Build Repair

This is a corrective release for the v6.57 product-to-support handoff. It addresses the Vercel production-build failure caused when the support-router module transform could not find one exact final render-call string.

Changes:
- Removes the brittle dependency on the exact text `renderPlatforms(); renderSelectedHelp();`.
- Appends the prefill bridge at the end of the support-router workbench module after verifying the expected lexical bindings and form selectors.
- Skips the prefill bridge with a Vite warning when the module shape is unexpected, rather than throwing and failing the entire production build.
- Keeps the existing customer-care discovery-card links, product IDs, consent checks and support-router templates unchanged.

No Supabase schema, secrets, environment variables, package dependencies, public GLB assets or gameplay files are changed.
