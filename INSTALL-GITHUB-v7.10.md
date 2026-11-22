# Install CALLORIA v7.10

## Files to add

Copy these files from the ZIP into the existing repository, preserving the folder structure:

- `js/live-call-coach-v710.js`
- `build/calloria-live-call-coach-v710-plugin.mjs`
- `calloria-live-call-coach-v710.css` (repository root)
- `tests/live-call-coach-v710.test.mjs`

## Vite registration

Open the existing root `vite.config.js` in a text editor. Do not replace the file.

Add this import alongside the other local build-plugin imports:

```js
import { calloriaLiveCallCoachV710Plugin } from './build/calloria-live-call-coach-v710-plugin.mjs';
```

Add this call as the final entry in the existing `plugins` array:

```js
calloriaLiveCallCoachV710Plugin()
```

If the v7.09 First Shift Mentor plugin is already registered in your branch, keep it and place `calloriaLiveCallCoachV710Plugin()` after it. Do not remove or reorder the existing GLB, OJT, mobile, RuffNeck, career or public-experience plugins. Register v7.10 exactly once.

## GitHub Desktop workflow

1. Back up the current repository folder.
2. Extract the ZIP.
3. In GitHub Desktop, choose **Repository → Show in Explorer**.
4. Copy the four files above into the matching repository folders.
5. Edit `vite.config.js` with the import and one final plugin call shown above.
6. Return to GitHub Desktop. Review the changed files, commit and push to `main`.

Suggested commit message: `CALLORIA v7.10 — live call coach and contextual playbook`.

## What to preserve

Do not replace `js/main.js`, `index.html`, `package.json`, `vite.config.js` wholesale, `vercel.json`, `.env` files, Supabase settings, `public/assets/`, GLB files or existing tests. No Supabase migration, new npm dependency or environment variable is required.

## Runtime behaviour

During an active inbound call, the new card appears in the right-hand call side stack between the existing customer behaviour monitor and customer continuity panel. It reads the current scenario, current call step, voice behaviour snapshot and pending customer decision already in scope in `renderInbound()`.

`Add to response` only appends the suggested wording into the existing response textarea. The agent must edit and explicitly press the existing **Send response to customer** button. The coach checklist is held in JavaScript memory for the current page session only. It does not change the native interaction score or persist after a full page reload.
