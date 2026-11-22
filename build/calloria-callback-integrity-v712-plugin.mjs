/** CALLORIA v7.12 Vite post-transform for Promise Control. */
const MARKER = '__CALLORIA_CALLBACK_INTEGRITY_V712__';
const count = (source, needle) => source.split(needle).length - 1;
export function calloriaCallbackIntegrityPluginV712() {
  return {
    name: 'calloria-callback-integrity-v7-12',
    enforce: 'post',
    transform(source, id) {
      if (!/[/\\]js[/\\]main\.js(?:\?.*)?$/.test(id) || source.includes(MARKER)) return null;
      const anchors = [
        'function renderPromiseControl(){',
        'const dashboard=PromiseControlEngine.buildPortfolio(commitmentStore(),commitmentShiftSnapshot(),state.callbacks,state.supervisorRequests);',
        'const metrics=dashboard.metrics;',
        'viewRoot.innerHTML=`\n     <div class="ops-summary-grid promise-control-metrics">'
      ];
      const counts = anchors.map(anchor => count(source, anchor));
      if (counts.some(value => value !== 1)) {
        this.warn(`[${this.name}] skipped safely: Promise Control anchors expected once, found (${counts.join(', ')}). No partial transform was applied.`);
        return null;
      }
      let code = `/* ${MARKER} */\nimport { auditCallbackIntegrity, renderCallbackIntegrityPanel } from './callback-integrity-engine-v712.js';\nimport '../styles/calloria-callback-integrity-v712.css';\n` + source;
      code = code.replace('const metrics=dashboard.metrics;', `const metrics=dashboard.metrics;\n   const __calloriaCallbackIntegrity = auditCallbackIntegrity(commitmentStore(), state.callbacks);\n   const __calloriaCallbackIntegrityPanel = renderCallbackIntegrityPanel(__calloriaCallbackIntegrity);`);
      code = code.replace('viewRoot.innerHTML=`\n     <div class="ops-summary-grid promise-control-metrics">', 'viewRoot.innerHTML=`\n     ${__calloriaCallbackIntegrityPanel}\n     <div class="ops-summary-grid promise-control-metrics">');
      return { code, map: null };
    }
  };
}
