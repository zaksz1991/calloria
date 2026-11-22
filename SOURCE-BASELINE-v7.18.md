# Source baseline — v7.18

Inspection date: 22 November 2026.

Baseline inspected: public `main` branch of `github.com/zaksz1991/calloria`.

## Files inspected

- `js/main.js`
- `js/multichannel-engine.js`
- `js/digital-sla-engine.js`
- `js/agent-workload-engine.js`
- `vite.config.js`
- `package.json`

## Anchors confirmed in current public source

`js/main.js` imports the existing SLA functions from `./digital-sla-engine.js` and imports `sortDigitalQueue` from `./multichannel-engine.js`.

Inside `renderDigital()` the public source contains one active-thread quick-queue expression:

```js
const quickQueue = sortDigitalQueue(state.digitalQueue, { channel: state.digitalChannelFilter || 'all', now: digitalNow }).slice(0, 5);
```

It also contains one full-queue expression:

```js
const queue = sortDigitalQueue(state.digitalQueue, { channel: state.digitalChannelFilter || 'all', now: digitalNow });
```

The same SLA badge expression appears in both queue-row renderers:

```js
<span class="digital-sla-pill ${assessDigitalSla(item, digitalNow).status}">${escapeHTML(digitalSlaDisplay(assessDigitalSla(item, digitalNow)))}</span>
```

The Vite configuration registers its normal application plugins in `plugins` and the current public final plugin registration is `calloriaTryItStudioPlugin()`. Install the new plugin after all existing plugins and previously installed overlays.

## Public source references

- https://raw.githubusercontent.com/zaksz1991/calloria/main/js/main.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/js/multichannel-engine.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/js/digital-sla-engine.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/js/agent-workload-engine.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/vite.config.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/package.json

This is a snapshot of public `main`, not a claim that a particular unpushed local branch contains these exact anchors. The transform warns and skips without partial output if its expected anchors drift.
