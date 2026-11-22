# Install CALLORIA v7.13 through GitHub Desktop

This is a cumulative overlay carrying forward the v7.12 callback integrity feature. It is not a complete repository replacement.

## 1. Back up the current repository

In GitHub Desktop, open the CALLORIA repository and use **Repository → Show in Explorer**. Copy the current folder to a backup location before merging the package.

## 2. Merge package files

Extract `CALLORIA-v7.13-CALLBACK-ATTEMPT-OUTCOMES.zip` and merge the included folders into the repository root. Keep the existing `.git`, `.env` files, Supabase settings, `public/assets/`, GLB binaries, `package.json`, `vercel.json` and all application pages.

The package supplies these files:

- `build/calloria-callback-integrity-v712-plugin.mjs` (carried forward)
- `build/calloria-callback-attempt-outcomes-v713-plugin.mjs` (new)
- `js/callback-integrity-engine-v712.js` (carried forward and updated for `attempt_failed`)
- `js/callback-attempt-outcome-engine-v713.js` (new)
- `styles/calloria-callback-integrity-v712.css` (carried forward)
- `tests/callback-integrity-v712.test.mjs` (carried forward)
- `tests/callback-attempt-outcomes-v713.test.mjs` (new)

## 3. Register both Vite plugins exactly once

Open the existing `vite.config.js` in the repository's normal editor. Add these imports beside the existing plugin imports:

```js
import { calloriaCallbackIntegrityPluginV712 } from './build/calloria-callback-integrity-v712-plugin.mjs';
import { calloriaCallbackAttemptOutcomesPluginV713 } from './build/calloria-callback-attempt-outcomes-v713-plugin.mjs';
```

At the end of the existing `plugins` array, after the current `calloriaTryItStudioPlugin()` entry, add the two registrations in this order:

```js
calloriaCallbackIntegrityPluginV712(),
calloriaCallbackAttemptOutcomesPluginV713()
```

If v7.12 is already registered, do not add it again. In that case, add only the v7.13 import and registration after the existing v7.12 registration. Preserve all other plugin registrations and their ordering.

The order matters: v7.12 must add the Promise Control integrity panel first; v7.13 then corrects the callback lifecycle in `main.js`.

## 4. Commit and push

In GitHub Desktop, review the changed-file list. Confirm no GLB assets, `.env` files or Supabase configuration have been deleted or replaced. Use commit message:

`CALLORIA v7.13 — callback attempt outcome integrity`

Push to `main` and inspect the Vercel deployment.

## 5. Expected deployment behaviour

The build-time transform checks all five source anchors. If the `main.js` source has drifted, it emits one warning and skips the entire v7.13 transform; it does not apply a partial patch. A successful Vercel build still needs to be confirmed from the deployment log.
