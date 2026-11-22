const importAnchor = "import { assessDigitalSla, digitalSlaDisplay, advanceDigitalSlaMonitor, digitalSlaMetrics } from './digital-sla-engine.js';";
const activeSlaAnchor = "    const activeSlaClass = activeSla.status === 'breached' ? 'breached' : activeSla.status === 'at_risk' ? 'at-risk' : activeSla.status === 'met' ? 'met' : 'on-track';";
const threadAnchor = '         <div class="digital-thread">${messageRows}</div>';
const renderAnchor = 'function renderDigital() {';
const marker = '/* CALLORIA_V721_DIGITAL_RESPONSE_CYCLE */';

function count(source, value) {
  return source.split(value).length - 1;
}

function panelFunction() {
  return [
    marker,
    'function renderDigitalResponseCyclePanel(contact, now) {',
    '  const report = assessDigitalResponseCycles(contact, now);',
    "  if (!report.cycles.length) return '';",
    '  const latest = report.cycles[report.cycles.length - 1];',
    "  const tone = latest.status === 'breached' ? 'breached' : latest.status === 'at_risk' ? 'at-risk' : latest.status === 'met' ? 'met' : 'on-track';",
    "  const headline = latest.responded ? (latest.status === 'met' ? 'Last customer follow-up answered within target' : 'Last customer follow-up answered late') : 'Customer follow-up awaiting agent response';",
    "  const detail = latest.responded ? 'Response took ' + latest.responseMinutes + ' simulated minutes against a ' + latest.targetMinutes + '-minute target.' : 'Target ' + latest.targetMinutes + ' simulated minutes · ' + digitalResponseCycleDisplay(latest) + '.';",
    "  const summary = report.open + ' open · ' + report.atRisk + ' due soon · ' + report.overdue + ' overdue · ' + (report.met + report.late) + ' answered';",
    "  return '<section class=\"digital-response-cycle ' + tone + '\" aria-live=\"polite\"><div class=\"digital-response-cycle-head\"><strong>FOLLOW-UP RESPONSE SLA</strong><span class=\"digital-sla-pill ' + tone + '\">' + digitalResponseCycleDisplay(latest) + '</span></div><p>' + headline + '</p><small>' + detail + '</small><small class=\"digital-response-cycle-summary\">' + summary + '</small></section>';",
    '}'
  ].join('\n') + '\n';
}

export function calloriaDigitalResponseCyclePluginV721() {
  return {
    name: 'calloria-digital-response-cycle-v7-21',
    transform(source, id) {
      if (!/[/\\]js[/\\]main\.js(?:\?.*)?$/.test(id)) return null;
      if (source.includes(marker)) return null;

      const checks = [
        [importAnchor, 'digital SLA engine import'],
        [activeSlaAnchor, 'active first-response SLA render anchor'],
        [threadAnchor, 'digital message-thread render anchor'],
        [renderAnchor, 'digital render function anchor']
      ];
      const missing = checks.filter(([anchor]) => count(source, anchor) !== 1).map(([, label]) => label);
      if (missing.length) {
        this.warn(`CALLORIA v7.21 skipped safely: ${missing.join(', ')} did not match exactly once. No partial transform was applied.`);
        return null;
      }

      let code = source.replace(
        importAnchor,
        `${importAnchor}\nimport { assessDigitalResponseCycles, digitalResponseCycleDisplay } from './digital-response-cycle-engine-v721.js';\nimport '../styles/calloria-digital-response-cycle-v721.css';`
      );
      code = code.replace(renderAnchor, `${panelFunction()}\n${renderAnchor}`);
      code = code.replace(activeSlaAnchor, `${activeSlaAnchor}\n    const responseCyclePanel = renderDigitalResponseCyclePanel(active, digitalNow);`);
      code = code.replace(threadAnchor, `         \${responseCyclePanel}\n${threadAnchor}`);
      return { code, map: null };
    }
  };
}
