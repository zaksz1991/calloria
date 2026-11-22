# Install CALLORIA v7.14 using GitHub Desktop

This is an additive source overlay, not a full repository replacement.

## 1. Back up the repository

Open CALLORIA in GitHub Desktop. Select **Repository → Show in Explorer** and make a backup copy of the repository folder.

## 2. Merge the supplied files

Extract the ZIP and merge the folders into the repository root. Add these files:

- `build/calloria-simulated-callback-clock-v714-plugin.mjs`
- `js/callback-attempt-outcome-engine-v714.js`
- `tests/callback-clock-integrity-v714.test.mjs`

Do not replace `package.json`, `vite.config.js`, `vercel.json`, `main.js`, `campaign-operations-engine.js`, Supabase configuration, `.env` files, `public/assets/` or any GLB files.

## 3. Register the plugin once

Open the existing `vite.config.js` in the editor normally used for this repository.

Add this import beside the other Vite plugin imports:

```js
import { calloriaSimulatedCallbackClockV714Plugin } from './build/calloria-simulated-callback-clock-v714-plugin.mjs';
```

Add this registration as the final item in the existing `plugins` array, after `calloriaTryItStudioPlugin()` and after any other plugin that transforms `js/main.js` or `js/campaign-operations-engine.js`:

```js
calloriaSimulatedCallbackClockV714Plugin()
```

Do not create a second `plugins` array or replace the current Vite configuration.

### Existing v7.13 registration

If you previously registered `calloriaCallbackAttemptOutcomesPluginV713()`, remove only its import and registration. v7.14 includes the callback attempt lifecycle repair and clock-safe due-time handling. You may leave the old v7.13 source files in the repository; they are simply no longer registered. Keep any separate v7.12 read-only Promise Control panel registration if it is installed.

## 4. Commit and push

In GitHub Desktop, review the changed files. Confirm the package has not removed any existing source, public assets, GLB files, credentials or environment files.

Commit message:

`CALLORIA v7.14 — simulated callback clock integrity`

Push to `main` and inspect the Vercel deployment.

## 5. Expected build behaviour

The plugin validates all required anchors in `main.js` and `campaign-operations-engine.js`. If the source has materially changed, the transform fails with a specific anchor report instead of producing a partial patch.

After deployment, test a callback promise created from after-contact work. Verify that the commitment portfolio, callback record and outbound campaign work item show the same due timestamp. Advance the in-game clock to the due time and resume the callback. Confirm the stored due timestamp does not change merely because the callback is resumed.
