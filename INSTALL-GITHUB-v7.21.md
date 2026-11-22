# Install CALLORIA v7.21 — GUI instructions

This is an additive overlay for the existing repository, not a complete replacement.

## 1. Back up the working tree

In GitHub Desktop, confirm the current repository and branch. Commit or otherwise preserve any unfinished changes before merging this package.

## 2. Merge the files

Extract `CALLORIA-v7.21.zip`. Open the existing repository folder using GitHub Desktop → Repository → Show in Explorer. Copy these folders from the extracted package into the repository root and merge when Windows asks:

- `js/`
- `build/`
- `styles/`
- `tests/`

The files to add are:

- `js/digital-response-cycle-engine-v721.js`
- `build/calloria-digital-response-cycle-v721.mjs`
- `styles/calloria-digital-response-cycle-v721.css`
- `tests/digital-response-cycle-v721.test.mjs`

Do not replace `js/main.js`, `js/digital-sla-engine.js`, `vite.config.js`, `package.json`, `vercel.json`, Supabase files, `.env` files, `public/assets/`, GLB models or `.git`.

## 3. Register the plugin once

Open the existing `vite.config.js` using your normal text editor. Add the import from `VITE-CONFIG-ADDITIONS-v7.21.txt` beside the other build plugin imports. Add `calloriaDigitalResponseCyclePluginV721()` as the final entry in the existing `plugins` array.

If v7.20 is already installed and registered, keep it and put v7.21 after it. Do not duplicate either registration. If v7.20 is not installed, append v7.21 after the current last plugin, `calloriaTryItStudioPlugin()`.

## 4. Commit and push

In GitHub Desktop, review the changed files and commit:

`CALLORIA v7.21 — digital follow-up response cycle SLA`

Push to `main` and inspect the Vercel deployment log.

## 5. Expected behaviour

During an active digital conversation, the original FIRST-RESPONSE SERVICE LEVEL banner remains unchanged. Once the customer sends a later response, the new FOLLOW-UP RESPONSE SLA card appears above the message thread. It reports the latest follow-up response as on track, due soon, overdue, met or late.

This is synthetic simulator timing. It does not connect to real customer channels.
