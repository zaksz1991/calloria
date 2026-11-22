# Vite configuration change summary — v7.24

The replacement `vite.config.js` preserves the current public v7.22 configuration and adds:

- Import: `calloriaDigitalCompletionSuitePluginV724` from `./build/calloria-digital-completion-suite-v724.mjs`
- Registration immediately after `calloriaDigitalExperienceSuitePluginV722()`.

The v7.24 plugin internally applies the v7.23 Customer 360 Recovery Plan transform and then the two fresh-state default corrections. There is no separate v7.23 registration.
