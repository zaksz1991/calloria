# CALLORIA Agent Desk build repair

## Scope

This package replaces exactly one file from the Phase 8 integration:

`js/agent-desk-workbench.js`

The production build error is caused by an unescaped apostrophe in a single-quoted JavaScript string in `renderKnowledge()`:

`'No catalogue entry matched. Use the owning platform's current help information.'`

The apostrophe in `platform's` prematurely terminates the string. The replacement uses a double-quoted JavaScript string for that message. No application workflow, API request, database object, permission rule, or environment variable is changed.

## Installation

Replace the existing `js/agent-desk-workbench.js` with the file at the same path in this archive. Do not replace other application files with this repair package.

Then run the normal Vercel deployment/build for the same repository branch.
