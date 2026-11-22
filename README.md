# CALLORIA v7.14 — Simulated Callback Clock Integrity

## Why this upgrade exists

The current public `main` source evaluates customer callback promises using CALLORIA's simulated shift clock, but the outbound campaign worklist also applies a wall-clock timestamp check. The current resume handler works around that mismatch by rewriting `callbackDueAt` to `Date.now() - 1000`. The worklist can therefore display a fabricated due time instead of the time the customer was promised.

The current source also stores `Date.now() + 60 seconds` in the campaign worklist while the linked commitment has its own simulated due time. A callback can consequently have different times in the promise portfolio and outbound campaign list.

## What v7.14 changes

- The commitment's calculated `dueAt` becomes the single due-time source for the callback record and outbound campaign work item.
- Scheduling no longer substitutes an arbitrary wall-clock `now + 60 seconds` timestamp.
- Resuming a callback no longer backdates `callbackDueAt` to make the dialler accept it.
- The resume handler first validates the callback against CALLORIA's simulated shift clock, then passes an explicit `callbackPrevalidated` flag to the campaign engine.
- That flag bypasses only the campaign engine's wall-clock due check for a callback already verified by `callbackIsDue`; suppression, shift availability, agent availability, attempt limits and contact-state checks remain enforced.
- Callback completion, no-answer, busy, voicemail, cancellation and return-to-queue outcomes remain distinct. Only confirmed customer contact marks a callback completed.
- A cancelled linked outbound callback keeps its commitment open and creates one supervisor review request if one is not already open.
- The campaign engine permits a valid simulated promise due time in `finishCampaignContact` when the main workflow has already validated the commitment. Invalid timestamps are still rejected.

## Package scope

This is a targeted cumulative source overlay, not a complete repository replacement. It supplies a Vite transform plugin, a callback attempt evidence helper, regression tests and GUI installation documentation. No Supabase migration, new dependency, environment variable or GLB asset is required.
