# Source baseline — CALLORIA v7.15

Inspected the current public GitHub `main` source on 22 November 2026.

## Relevant source files

- `js/main.js`: https://raw.githubusercontent.com/zaksz1991/calloria/main/js/main.js
- `js/multichannel-engine.js`: https://raw.githubusercontent.com/zaksz1991/calloria/main/js/multichannel-engine.js
- `vite.config.js`: https://raw.githubusercontent.com/zaksz1991/calloria/main/vite.config.js

## Integration anchors observed

1. `main.js` imports digital-channel operations from `./multichannel-engine.js`.
2. `renderDigital()` creates the active digital thread and the form with `id="digitalReplyForm"`.
3. The composer is emitted when `active.status === DIGITAL_STATUS.ACTIVE` and begins with `<div class="digital-template-row">`.
4. `submitDigitalReply(form)` records a simulated reply with `recordDigitalReply(...)`.
5. `multichannel-engine.js` already has a deterministic `evaluateDigitalReply()` and blocks credential requests in `recordDigitalReply()`.
6. `vite.config.js` currently ends its plugin array with `calloriaTryItStudioPlugin()`.

The v7.15 transform targets the multichannel import and digital composer anchor. It requires each anchor exactly once; if the source differs, it warns and skips without partially modifying `main.js`.

## Scope

This package adds a presentation and pre-submit safety-coaching layer. It deliberately does not replace the native digital QA evaluator, digital queue engine, case records or main application source.
