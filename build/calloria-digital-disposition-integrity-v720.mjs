/**
 * CALLORIA v7.20 — disposition evidence transform that is compatible with
 * the v7.17 specialist-handoff transform. It injects validation immediately
 * before completeDigitalContact(), rather than matching a brittle block of
 * preceding lines that v7.17 legitimately expands.
 */
const PLUGIN_NAME = 'calloria-digital-disposition-integrity-v7-20';
const MARKER = '/* CALLORIA_V720_DIGITAL_DISPOSITION_INTEGRITY */';
const MAIN_SUFFIX = '/js/main.js';

const CUSTOMER_BEHAVIOUR_IMPORT = "import { ensureDigitalCustomerBehaviour, evaluateDigitalCustomerReaction, deliverAdaptiveDigitalCustomerResponse, digitalCustomerBehaviourSnapshot, digitalCustomerBehaviourMetrics } from './digital-customer-behaviour-engine.js';";
const COMPLETE_CALL_ANCHOR = "    const completed = completeDigitalContact(state.digitalQueue, contact.id, { disposition, notes: values.get('notes') }, queueSimulationNowMs());";
const CASE_NOTES_ANCHOR = '<label class="form-field">CASE NOTES<textarea name="notes" rows="3" minlength="12" maxlength="1200" required placeholder="Issue, checks, action, owner and agreed next step."';
const CASE_RECORD_ANCHOR = 'notes: completed.notes, createdAt: completed.completedAt, messages:';

function count(source, needle) {
  return source.split(needle).length - 1;
}

export function transformDigitalDispositionIntegrityV720(source) {
  const code = String(source ?? '');
  if (code.includes(MARKER)) return { code, changed: false, alreadyPatched: true, reason: null };

  const anchors = [
    ['digital customer behaviour import', CUSTOMER_BEHAVIOUR_IMPORT],
    ['digital completion call', COMPLETE_CALL_ANCHOR],
    ['case notes field', CASE_NOTES_ANCHOR],
    ['digital CRM case evidence point', CASE_RECORD_ANCHOR]
  ];
  const mismatches = anchors.filter(([, needle]) => count(code, needle) !== 1);
  if (mismatches.length) {
    return {
      code,
      changed: false,
      alreadyPatched: false,
      reason: `Expected one source anchor for: ${mismatches.map(([label]) => label).join(', ')}.`
    };
  }

  if (code.includes('validateDigitalDispositionEvidence') || code.includes('name="outcomeEvidence"')) {
    return {
      code,
      changed: false,
      alreadyPatched: false,
      reason: 'A partial digital outcome-evidence integration already exists; refusing duplicate injection.'
    };
  }

  let output = code.replace(
    CUSTOMER_BEHAVIOUR_IMPORT,
    `${CUSTOMER_BEHAVIOUR_IMPORT}\nimport { validateDigitalDispositionEvidence } from './digital-disposition-integrity-v719.js';`
  );

  const evidenceGuard = `    const evidenceType = String(values.get('outcomeEvidence') || '');
    const relatedRequests = (Array.isArray(state.supervisorRequests) ? state.supervisorRequests : []).filter(item => item && item.contactId === contact.id);
    const supervisorRequestOpen = relatedRequests.some(item => item.status === 'open') || (typeof specialistHandoffDraft !== 'undefined' && Boolean(specialistHandoffDraft));
    const supervisorReviewRecorded = relatedRequests.some(item => ['reviewed', 'resolved', 'closed', 'completed'].includes(item.status));
    const evidenceCheck = validateDigitalDispositionEvidence({
      contact, disposition, evidenceType, notes: values.get('notes'),
      supervisorRequestOpen, supervisorReviewRecorded
    });
    if (!evidenceCheck.allowed) throw new Error(evidenceCheck.reason);
    const evidenceClockNow = queueSimulationNowMs();
    const evidenceRecordedAt = new Date(evidenceClockNow).toISOString();
    const completed = completeDigitalContact(state.digitalQueue, contact.id, { disposition, notes: values.get('notes') }, evidenceClockNow);
    completed.dispositionEvidence = { type: evidenceType, label: evidenceCheck.label, recordedAt: evidenceRecordedAt, notesLength: evidenceCheck.notesLength, customerReplyObserved: evidenceCheck.customerReplyObserved };`;

  output = output.replace(COMPLETE_CALL_ANCHOR, evidenceGuard);

  const evidenceField = `<label class="form-field">OUTCOME EVIDENCE<select name="outcomeEvidence" required><option value="">Choose supporting evidence…</option><option value="customer_confirmed">Customer confirmed the outcome</option><option value="one_touch_resolution">One-touch guidance / resolution provided</option><option value="customer_information_pending">Customer information or confirmation requested</option><option value="specialist_referral_created">Specialist referral recorded</option></select></label><label class="form-field">CASE NOTES<textarea name="notes" rows="3" minlength="20" maxlength="1200" required placeholder="Record the issue, action, outcome evidence, owner and agreed next step."`;
  output = output.replace(CASE_NOTES_ANCHOR, evidenceField);
  output = output.replace(CASE_RECORD_ANCHOR, 'notes: completed.notes, dispositionEvidence: completed.dispositionEvidence, createdAt: completed.completedAt, messages:');

  return { code: `${output}\n${MARKER}\n`, changed: true, alreadyPatched: false, reason: null };
}

export function calloriaDigitalDispositionIntegrityPluginV720() {
  return {
    name: PLUGIN_NAME,
    enforce: 'post',
    transform(source, id) {
      const cleanId = String(id || '').split('?')[0].replace(/\\/g, '/');
      if (!cleanId.endsWith(MAIN_SUFFIX)) return null;
      const result = transformDigitalDispositionIntegrityV720(source);
      if (result.alreadyPatched) return null;
      if (!result.changed) {
        this.warn(`[${PLUGIN_NAME}] skipped safely: ${result.reason} No partial transform was applied.`);
        return null;
      }
      return { code: result.code, map: null };
    }
  };
}

export { MARKER as CALLORIA_V720_DIGITAL_DISPOSITION_MARKER };
