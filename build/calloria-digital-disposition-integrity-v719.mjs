const PLUGIN_NAME = 'calloria-digital-disposition-integrity-v7-19';
const MARKER = '/* CALLORIA_V719_DIGITAL_DISPOSITION_INTEGRITY */';

const CUSTOMER_BEHAVIOUR_IMPORT = "import { ensureDigitalCustomerBehaviour, evaluateDigitalCustomerReaction, deliverAdaptiveDigitalCustomerResponse, digitalCustomerBehaviourSnapshot, digitalCustomerBehaviourMetrics } from './digital-customer-behaviour-engine.js';";
const FINISH_ANCHOR = `  const disposition = String(values.get('disposition') || '');\n  try {\n    const completed = completeDigitalContact(state.digitalQueue, contact.id, { disposition, notes: values.get('notes') }, queueSimulationNowMs());`;
const FORM_ANCHOR = '</select></label><label class="form-field">CASE NOTES<textarea name="notes" rows="3" minlength="12" maxlength="1200" required placeholder="Issue, checks, action, owner and agreed next step."';
const CASE_ANCHOR = 'notes: completed.notes, createdAt: completed.completedAt, messages:';

function count(source, needle) {
  return source.split(needle).length - 1;
}

export function calloriaDigitalDispositionIntegrityPluginV719() {
  return {
    name: PLUGIN_NAME,
    enforce: 'post',
    transform(source, id) {
      if (!id.replaceAll('\\', '/').endsWith('/js/main.js')) return null;
      if (source.includes(MARKER)) return null;

      const checks = [
        ['customer behaviour import', CUSTOMER_BEHAVIOUR_IMPORT],
        ['digital completion workflow', FINISH_ANCHOR],
        ['digital after-contact form', FORM_ANCHOR],
        ['digital CRM case record', CASE_ANCHOR]
      ];
      const drift = checks.filter(([, anchor]) => count(source, anchor) !== 1);
      if (drift.length) {
        this.warn(`[${PLUGIN_NAME}] skipped safely; expected one match for: ${drift.map(([label]) => label).join(', ')}. No partial transform was applied.`);
        return null;
      }

      let output = source.replace(
        CUSTOMER_BEHAVIOUR_IMPORT,
        `${CUSTOMER_BEHAVIOUR_IMPORT}\nimport { validateDigitalDispositionEvidence } from './digital-disposition-integrity-v719.js';`
      );

      output = output.replace(
        FINISH_ANCHOR,
        `  const disposition = String(values.get('disposition') || '');\n  const evidenceType = String(values.get('outcomeEvidence') || '');\n  try {\n    const relatedRequests = (Array.isArray(state.supervisorRequests) ? state.supervisorRequests : []).filter(item => item && item.contactId === contact.id);\n    const supervisorRequestOpen = relatedRequests.some(item => item.status === 'open');\n    const supervisorReviewRecorded = relatedRequests.some(item => ['reviewed', 'resolved', 'closed', 'completed'].includes(item.status));\n    const evidenceCheck = validateDigitalDispositionEvidence({\n      contact, disposition, evidenceType, notes: values.get('notes'),\n      supervisorRequestOpen, supervisorReviewRecorded\n    });\n    if (!evidenceCheck.allowed) throw new Error(evidenceCheck.reason);\n    const evidenceClockNow = queueSimulationNowMs();\n    const evidenceRecordedAt = new Date(evidenceClockNow).toISOString();\n    const completed = completeDigitalContact(state.digitalQueue, contact.id, { disposition, notes: values.get('notes') }, evidenceClockNow);\n    completed.dispositionEvidence = { type: evidenceType, label: evidenceCheck.label, recordedAt: evidenceRecordedAt, notesLength: evidenceCheck.notesLength, customerReplyObserved: evidenceCheck.customerReplyObserved };`
      );

      output = output.replace(
        FORM_ANCHOR,
        `</select></label><label class="form-field">OUTCOME EVIDENCE<select name="outcomeEvidence" required><option value="">Choose supporting evidence…</option><option value="customer_confirmed">Customer confirmed the outcome</option><option value="one_touch_resolution">One-touch guidance / resolution provided</option><option value="customer_information_pending">Customer information or confirmation requested</option><option value="specialist_referral_created">Specialist referral recorded</option></select></label><label class="form-field">CASE NOTES<textarea name="notes" rows="3" minlength="20" maxlength="1200" required placeholder="Record the issue, action, outcome evidence, owner and agreed next step."`
      );

      output = output.replace(
        CASE_ANCHOR,
        'notes: completed.notes, dispositionEvidence: completed.dispositionEvidence, createdAt: completed.completedAt, messages:'
      );
      output += `\n${MARKER}\n`;
      return { code: output, map: null };
    }
  };
}
