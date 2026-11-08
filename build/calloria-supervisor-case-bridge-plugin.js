const MAIN_TARGET = '/js/main.js';
const STATE_ANCHOR = 'let state = loadState();';
const SAVE_ANCHOR = 'function saveState()';
const OPERATION_ANCHOR = 'function pushOperationEvent(type, reference, message, status = \'recorded\', details = {})';
const MARKER = '__CALLORIA_SUPERVISOR_CASE_BRIDGE_V19__';

function requireOnce(context, source, anchor, label) {
  const count = source.split(anchor).length - 1;
  if (count !== 1) context.error(`CALLORIA supervisor case bridge expected exactly one ${label} anchor (${count} found). Refusing a partial transform.`);
}

export function calloriaSupervisorCaseBridgePlugin() {
  return {
    name: 'calloria-supervisor-case-bridge-v1-9',
    enforce: 'post',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (!normalizedId.endsWith(MAIN_TARGET)) return null;
      const normalizedSource = String(source).replace(/\r\n?/g, '\n');
      if (normalizedSource.includes(MARKER)) return null;
      requireOnce(this, normalizedSource, STATE_ANCHOR, 'main application state');
      requireOnce(this, normalizedSource, SAVE_ANCHOR, 'saveState function');
      requireOnce(this, normalizedSource, OPERATION_ANCHOR, 'operation timeline function');
      const bridge = `\n// ${MARKER}: persist supervisor disposition without mutating critical QA status.\nif (typeof window !== 'undefined') {\n  window.addEventListener('calloria:supervisor-case-recorded', (event) => {\n    const detail = event?.detail || {};\n    const session = state.customerLabSession;\n    if (!session || session.id !== detail.scenarioId || session.status !== 'escalated') {\n      window.dispatchEvent(new CustomEvent('calloria:supervisor-case-recorded-result', { detail: { ok: false, scenarioId: detail.scenarioId || null, reason: 'No matching escalated Customer Intelligence Lab session is active.' } }));\n      toast('No matching escalated customer practice case is active.', 'warning');\n      return;\n    }\n    const disposition = detail.disposition === 'supervisor_review_recorded' ? 'supervisor_review_recorded' : 'returned_to_agent';\n    const record = {\n      id: \`SUP-\\${Date.now().toString(36).toUpperCase()}\`,\n      disposition,\n      supervisorAssetId: detail.supervisorAssetId || null,\n      turn: Number(detail.turn) || 0,\n      recordedAt: new Date().toISOString()\n    };\n    session.supervisorInterventions = Array.isArray(session.supervisorInterventions) ? session.supervisorInterventions : [];\n    session.supervisorInterventions.push(record);\n    session.supervisorDisposition = disposition;\n    pushOperationEvent(\n      'customer-intelligence',\n      session.id,\n      disposition === 'supervisor_review_recorded'\n        ? 'Supervisor review recorded; mandatory QA review remains open.'\n        : 'Supervisor returned the escalated interaction to the original agent; mandatory QA review remains open.',\n      disposition,\n      { supervisorAssetId: record.supervisorAssetId, turn: record.turn }\n    );\n    saveState();\n    renderView();\n    toast(disposition === 'supervisor_review_recorded' ? 'Supervisor review recorded. Mandatory QA review remains open.' : 'Case returned to the agent. Mandatory QA review remains open.', 'success');\n    window.dispatchEvent(new CustomEvent('calloria:supervisor-case-recorded-result', { detail: { ok: true, scenarioId: session.id, disposition, record } }));\n  });\n}\n`;
      return { code: `${normalizedSource}${bridge}`, map: null };
    }
  };
}
