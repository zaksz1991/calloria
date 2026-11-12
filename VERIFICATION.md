# Verification — CALLORIA v6.19

Locally verified:

- Four focused Node contract tests pass.
- `node --check` passes for the department partition runtime, reception lifecycle integration, and Vite compatibility plugin.
- The existing lobby alias export is preserved.
- The old Vite plugin export remains callable and its stale source transform is disabled.
- ZIP archive integrity passes.

Not verified:

- Full Vite production build against the complete current CALLORIA repository.
- Vercel deployment.
- Live browser rendering or successful external CC0 asset retrieval.
- Whether the current production scene contains all three expected authored pane anchors with the published dimensions. The runtime will report missing or invalid anchors and leave original panes visible.
