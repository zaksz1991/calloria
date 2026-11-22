# CALLORIA v7.24 — Changelog

## Integration repairs

1. Adds the v7.23 Customer 360 Recovery Plan to the live Vite plugin chain. The public `vite.config.js` baseline registered v7.22 but omitted v7.23; the public v7.23 engine file existed while its build plugin was not available at the expected raw path. This package supplies the complete module/plugin/style/test set and registers it through v7.24.
2. Preserves the v7.22 unified digital suite and runs v7.23 recovery after it.
3. Replaces separate manual v7.23 registration with one v7.24 completion-suite registration to avoid duplicate transforms.

## Product default correction

4. New applicants now start on `service` / `Customer Experience` with the matching ₦170,000 starting salary, not the banking track defaults.
5. The explicit Banking, Technical Support and Sales career options remain available.
6. Existing saved selections, departments and salaries remain unchanged when populated. For legacy saves missing department or salary, v7.24 fills only the missing fields using the stored career track.

## Preserved

- v7.22 digital features and order.
- Customer 360 continuity data shape.
- Existing role and salary mapping for all four career tracks.
- Supabase configuration, storage keys, saved applicant records and game progression.
- Existing 3D, OJT, workforce, mobile and other Vite plugins.

## Verification limits

128 regression tests and JavaScript syntax checks passed. No full Vite production build, live browser test, physical-device test or Vercel deployment was performed in this workspace.
