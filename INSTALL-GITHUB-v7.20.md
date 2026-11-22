# Install CALLORIA v7.20 — GUI workflow

This is a cumulative additive overlay, not a complete repository replacement.

## 1. Back up the repository

In GitHub Desktop, create a branch or commit the current state. Use **Repository → Show in Explorer** to open the repository folder.

## 2. Merge the package

Extract `CALLORIA-v7.20.zip`. Copy the supplied `build`, `js`, `styles` and `tests` folders into the repository root. Allow folders to merge; do not delete existing project files.

The package includes the complete v7.15–v7.18 support modules and plugins, plus the compatibility-repaired disposition transform. Existing files with the same names can be replaced by the included copies.

## 3. Consolidate Vite registration

Open the existing `vite.config.js` in your normal text editor.

Remove any individually-added imports and registrations for these earlier digital overlays, if present:

- `calloriaDigitalResponseQualityCoachPluginV715`
- `calloriaDigitalStateIntegrityPluginV716`
- `calloriaDigitalSpecialistHandoffPluginV717`
- `calloriaDigitalSlaTriagePluginV718`
- `calloriaDigitalDispositionIntegrityPluginV719`

Do not remove any unrelated Vite plugin.

Add this single import with the other local build-plugin imports:

```js
import { calloriaDigitalWorkflowSuitePluginV720 } from './build/calloria-digital-workflow-suite-v720.mjs';
```

Add the suite as the final entry in the existing `plugins` array. On the current public baseline, the final entries should become:

```js
calloriaTryItStudioPlugin(),
calloriaDigitalWorkflowSuitePluginV720()
```

Register the suite exactly once. Do not separately register the five plugins that it composes internally. Keep all unrelated Vite plugin imports, order, Rollup inputs and output settings unchanged.

## 4. Commit and push

Use this commit message:

`CALLORIA v7.20 — consolidate digital workflow suite`

Push `main` through GitHub Desktop and inspect the Vercel deployment.

## 5. Expected checks in CALLORIA

1. Open Digital Support during a simulated shift.
2. Open an email, live-chat or social interaction. The Digital Reply Quality Coach should appear above the reply composer.
3. Try a synthetic reply that requests a PIN/OTP/password. It should be blocked before the native simulated reply handler records it.
4. Confirm the performance rows distinguish active threads awaiting a customer from CRM cases pending customer information.
5. Choose Escalated to specialist team. The destination/reason fields should appear; provide a valid department and reason.
6. Complete the interaction using `specialist_referral_created`. The case and supervisor request should link to the same contact.
7. Test `resolved`, `pending_customer` and `escalated` with mismatched evidence; the completion should be rejected before the contact status changes.
8. Confirm digital queue rows show SLA status and the breached/at-risk queue ranks ahead of on-track items.

## Rollback

Remove the suite import and its single registration from `vite.config.js`, then remove only the v7.15–v7.20 files supplied by this package. Existing saved digital interactions remain readable; the new evidence object is additive.

## Important

The package contains tests and focused transforms, but it is not a full CALLORIA source export. Preserve `main.js`, `multichannel-engine.js`, `package.json`, `vercel.json`, Supabase configuration, `.env` files and `public/assets/`.
