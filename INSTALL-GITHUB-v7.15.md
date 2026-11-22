# Install CALLORIA v7.15 — GUI steps

## 1. Back up the current repository

Create a GitHub Desktop branch or commit your current working state before merging this overlay.

## 2. Merge the supplied folders

Extract `CALLORIA-v7.15.zip`. Open your CALLORIA repository in GitHub Desktop and use **Repository → Show in Explorer**.

Copy these folders from the extracted package into the repository root, allowing folders to merge:

- `build/`
- `js/`
- `styles/`
- `tests/`

The new files are:

- `build/calloria-digital-response-quality-coach-v715.mjs`
- `js/digital-response-quality-coach-v715.js`
- `styles/calloria-digital-response-quality-v715.css`
- `tests/digital-response-quality-v715.test.mjs`

Do not replace existing folders or delete existing files.

## 3. Register the Vite plugin exactly once

Open the existing `vite.config.js` in your normal text editor.

Add this import with the other build-plugin imports:

```js
import { calloriaDigitalResponseQualityCoachPluginV715 } from './build/calloria-digital-response-quality-coach-v715.mjs';
```

At the bottom of the existing `plugins` array, keep the current final entry and add a comma after it. Then add:

```js
calloriaDigitalResponseQualityCoachPluginV715()
```

For the current public baseline, the existing last plugin is `calloriaTryItStudioPlugin()`. The final two entries should be:

```js
calloriaTryItStudioPlugin(),
calloriaDigitalResponseQualityCoachPluginV715()
```

Do not replace `vite.config.js` with a small snippet. Preserve all existing plugin imports, order, Rollup inputs, output settings, ports and build options.

## 4. Run the project's existing checks

Use the GitHub Actions workflow or your established project verification process. The package includes a Node test file and is compatible with the root package's `tests/*.test.mjs` test glob.

## 5. Commit and push

Suggested commit message:

`CALLORIA v7.15 — digital response quality coach`

## 6. Check the deployment

Confirm that Vercel completes `npm install` and `npm run build`. Then open an active simulated email, live-chat or social contact. The Digital Reply Quality Coach should appear above the reply composer.

### Important

This is an additive overlay, not a complete repository replacement. It does not include `main.js`, `vite.config.js`, `package.json`, `vercel.json`, Supabase settings, `.env` files or 3D assets. No Supabase migration or environment-variable change is required.
