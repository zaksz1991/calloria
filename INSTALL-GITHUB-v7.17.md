# Install CALLORIA v7.17 — GUI steps

This is an additive overlay, not a full repository replacement.

## 1. Back up the current repository

In GitHub Desktop, select the CALLORIA repository and confirm the working tree is committed or otherwise backed up. Do not delete `.git`, `.env` files, `public/assets/`, GLB models, Supabase configuration, `package.json`, `vite.config.js` or `vercel.json`.

## 2. Copy the supplied folders

Extract the ZIP. Merge these folders into the repository root, preserving existing files:

- `js/digital-specialist-handoff-v717.js`
- `build/calloria-digital-specialist-handoff-v717.mjs`
- `styles/calloria-digital-specialist-handoff-v717.css`
- `tests/digital-specialist-handoff-v717.test.mjs`

The Vite transform automatically adds the helper-module and stylesheet imports to `js/main.js` during the build. Do not manually add those two imports to `main.js`.

## 3. Register the Vite plugin once

Open the existing `vite.config.js` in File Explorer using your normal text editor.

Add this import alongside the other local plugin imports:

```js
import { calloriaDigitalSpecialistHandoffPluginV717 } from './build/calloria-digital-specialist-handoff-v717.mjs';
```

Add `calloriaDigitalSpecialistHandoffPluginV717()` as the final plugin entry, after the existing `calloriaTryItStudioPlugin()` entry. If the v7.16 Digital State Integrity plugin is already installed, leave it before v7.17. Do not register v7.17 twice.

The supplied `VITE-CONFIG-ADDITIONS-v7.17.txt` shows the exact additions. Do not replace the whole Vite configuration.

## 4. Review and push

GitHub Desktop should show the four added files and the Vite configuration change. Review the file list, then commit:

`CALLORIA v7.17 — digital specialist handoff and supervisor routing`

Push to `main` and inspect the Vercel deployment.

## 5. In-game verification

1. Open a synthetic email, live-chat or social contact in the normal CALLORIA digital desk.
2. Open its after-contact form and select **Escalated to specialist team**.
3. Confirm the destination and reason fields appear and become required.
4. Submit with no destination or a short reason; CALLORIA should reject it without completing the contact.
5. Choose a listed department and enter a reason between 12 and 240 characters.
6. Complete the contact. Confirm the CRM case records the department and supervisor request reference.
7. Open **Supervisor Escalations**. Confirm the new request shows the requested destination and linked CRM case.
8. Confirm the supervisor must still claim/review the request; the agent's selection must not automatically transfer ownership.

This release does not connect synthetic digital contacts to real WhatsApp or SMS provider inboxes.
