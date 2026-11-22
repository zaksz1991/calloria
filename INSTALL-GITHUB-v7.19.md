# Install CALLORIA v7.19 — GUI workflow

This is an additive overlay, not a complete repository replacement.

## 1. Back up the repository

In GitHub Desktop, choose **Repository → Show in Explorer**. Copy the existing CALLORIA folder or create a ZIP backup before changing files.

## 2. Merge the package

Extract `CALLORIA-v7.19.zip`. Merge its `js`, `build` and `tests` folders into the repository root. Keep existing files and folders. Do not replace `main.js`, `vite.config.js`, `package.json`, `vercel.json`, Supabase configuration, `.env` files or `public/assets/`.

New files:

- `js/digital-disposition-integrity-v719.js`
- `build/calloria-digital-disposition-integrity-v719.mjs`
- `tests/digital-disposition-integrity-v719.test.mjs`

## 3. Register the plugin

Open the existing `vite.config.js` in the repository's current editor. Add this import with the other local plugin imports:

```js
import { calloriaDigitalDispositionIntegrityPluginV719 } from './build/calloria-digital-disposition-integrity-v719.mjs';
```

Add this single call as the final item in the existing `plugins` array:

```js
calloriaDigitalDispositionIntegrityPluginV719()
```

Do not remove or reorder existing plugins. Do not register this plugin twice. The v7.19 plugin is independent of the v7.18 SLA triage overlay; when v7.18 is installed, keep its registration before v7.19.

## 4. Commit and push

In GitHub Desktop, review the changed files. Commit with:

`CALLORIA v7.19 — digital resolution evidence integrity`

Push to `main` and inspect the Vercel deployment log.

## 5. Expected application behaviour

Open the Digital Support workspace during a simulated shift. After an agent reply, the after-contact form now includes **Outcome evidence**. The evidence code must agree with the selected disposition:

- Resolved: customer confirmed, or one-touch resolution with no pending customer response.
- Pending customer: information/confirmation requested.
- Escalated: specialist referral recorded and a linked supervisor request exists.

A customer flagged for supervisor intervention cannot be closed as resolved until the linked supervisor request is recorded as reviewed, resolved, closed or completed.

## Rollback

Remove the v7.19 plugin registration and import from `vite.config.js`, then remove the three v7.19 files. Existing digital contact records remain readable; the new evidence property is additive.
