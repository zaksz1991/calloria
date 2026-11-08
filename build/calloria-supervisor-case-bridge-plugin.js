const MAIN_TARGET = '/js/main.js';
const STATE_ANCHOR = 'let state = loadState();';
const SAVE_ANCHOR = 'function saveState()';
const OPERATION_ANCHOR = "function pushOperationEvent(type, reference, message, status = 'recorded', details = {})";
const MARKER = '__CALLORIA_SUPERVISOR_CASE_BRIDGE_V19_1__';

function requireOnce(context, source, anchor, label) {
  const count = source.split(anchor).length - 1;
  if (count !== 1) {
    context.error(`CALLORIA supervisor case bridge expected exactly one ${label} anchor (${count} found). Refusing a partial transform.`);
  }
}

export function calloriaSupervisorCaseBridgePlugin() {
  return {
    name: 'calloria-supervisor-case-bridge-v1-9-1',
    enforce: 'post',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (!normalizedId.endsWith(MAIN_TARGET)) return null;

      const normalizedSource = String(source).replace(/\r\n?/g, '\n');
      if (normalizedSource.includes(MARKER) || normalizedSource.includes('__CALLORIA_SUPERVISOR_CASE_BRIDGE_V19__')) {
        return null;
      }

      requireOnce(this, normalizedSource, STATE_ANCHOR, 'main application state');
      requireOnce(this, normalizedSource, SAVE_ANCHOR, 'saveState function');
      requireOnce(this, normalizedSource, OPERATION_ANCHOR, 'operation timeline function');

      // Build generated source as a raw template: the \n inside the toast
      // string must remain an escape sequence in main.js, not become a literal
      // line break inside a single-quoted JavaScript string.
      const bridge = String.raw`
// ${MARKER}: persist supervisor disposition without changing QA status.
if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
  window.addEventListener('calloria:supervisor-case-recorded', (event) => {
    const detail = event?.detail || {};
    const session = state.customerLabSession;
    if (!session || session.id !== detail.scenarioId || session.status !== 'escalated') {
      window.dispatchEvent(new CustomEvent('calloria:supervisor-case-recorded-result', {
        detail: { ok: false, scenarioId: detail.scenarioId || null, reason: 'No matching escalated Customer Intelligence Lab session is active.' }
      }));
      toast('No matching escalated customer practice case is active.', 'warning');
      return;
    }

    const disposition = detail.disposition === 'supervisor_review_recorded'
      ? 'supervisor_review_recorded'
      : 'returned_to_agent';
    const record = {
      id: 'SUP-' + Date.now().toString(36).toUpperCase(),
      disposition,
      supervisorAssetId: detail.supervisorAssetId || null,
      turn: Number(detail.turn) || 0,
      recordedAt: new Date().toISOString()
    };

    session.supervisorInterventions = Array.isArray(session.supervisorInterventions)
      ? session.supervisorInterventions
      : [];
    session.supervisorInterventions.push(record);
    session.supervisorDisposition = disposition;

    pushOperationEvent(
      'customer-intelligence',
      session.id,
      disposition === 'supervisor_review_recorded'
        ? 'Supervisor review recorded; mandatory QA review remains open.'
        : 'Supervisor returned the interaction to the original agent; mandatory QA review remains open.',
      disposition,
      { supervisorAssetId: record.supervisorAssetId, turn: record.turn }
    );

    saveState();
    renderView();
    toast(
      disposition === 'supervisor_review_recorded'
        ? 'Supervisor review recorded.\nMandatory QA review remains open.'
        : 'Case returned to the agent. Mandatory QA review remains open.',
      'success'
    );
    window.dispatchEvent(new CustomEvent('calloria:supervisor-case-recorded-result', {
      detail: { ok: true, scenarioId: session.id, disposition, record }
    }));
  });
}
`;

      return { code: `${normalizedSource}${bridge}`, map: null };
    }
  };
}
