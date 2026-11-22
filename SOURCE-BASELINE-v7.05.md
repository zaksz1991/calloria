# CALLORIA v7.05 source baseline

Checked against the public repository `main` source during preparation.

- `vite.config.js` declares 19 HTML entry pages plus `widgets/calloria-chat.js`.
- `index.html` exposes the home navigation through `button.nav-item[data-view]` and renders dynamic workspace content into `#viewRoot`.
- `js/main.js` supplies the corresponding render metadata map and `switch(state.currentView)` dispatcher. It handles home navigation with a delegated click listener reading `nav.dataset.view`. The visible menu identifiers reviewed in the public source (`overview`, `inbound`, `queue`, `outbound`, `digital`, `commitments`, `agentHandover`, `customerIntel`, `crm`, `knowledge`, `performance`, `career`, `qa`, `supervisor`, `promiseControl`, `workforce`, `organization`) are represented in both metadata and switch cases.
- `vercel.json` enables `cleanUrls`, so extensionless local routes such as `/case-desk` can resolve to `case-desk.html`.
- The public main manifest at audit time is still test-only; this archive therefore includes the v7.04 production recovery layer rather than relying on it already being present upstream.

The audit checks these contracts in the user's repository at prebuild time. It does not claim that every reference in the user's deployed branch is already valid.
