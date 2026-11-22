/** CALLORIA v7.17 — source-aware digital specialist handoff integration. */

const PLUGIN_NAME = 'calloria-digital-specialist-handoff-v7-17';
const MAIN_ID = /(?:^|\/)js\/main\.js(?:\?.*)?$/;
const MARKER = 'CALLORIA_DIGITAL_SPECIALIST_HANDOFF_V717';

const IMPORT_ANCHOR = "import { DIGITAL_CHANNELS, DIGITAL_STATUS, DIGITAL_SCENARIOS, createDigitalQueue, sortDigitalQueue, findDigitalContact, acceptDigitalContact, recordDigitalReply, deliverDigitalFollowUp, completeDigitalContact, digitalQueueMetrics, appendDigitalEvent } from './multichannel-engine.js';";
const FORM_ANCHOR = '<label class="form-field">DISPOSITION<select name="disposition" ${interactiveBlocked ? \'disabled\' : \'\'}><option value="resolved">Resolved</option><option value="pending_customer">Pending customer response</option><option value="escalated">Escalated to specialist team</option></select></label>';
const FINISH_ANCHOR = 'function finishDigitalContact(form) {';
const VALUES_ANCHOR = "const disposition = String(values.get('disposition') || '');";
const CASE_PUSH_ANCHOR = 'state.cases.push(digitalCase);recordCustomerContinuityFromCase(digitalCase,{customerRef:contact.customerRef});';
const SUPERVISOR_CARD_ANCHOR = '<p>${escapeHTML(request.reason || \'Agent assistance requested.\')}</p><div class="supervisor-escalation-meta">';

function count(source, needle) {
  return source.split(needle).length - 1;
}
function replaceExactlyOnce(source, anchor, replacement, label) {
  const found = count(source, anchor);
  if (found !== 1) throw new Error(`${label}: expected exactly one source anchor, found ${found}.`);
  return source.replace(anchor, replacement);
}

const importLine = "import { validateDigitalSpecialistHandoff, createDigitalSpecialistHandoffRequest, attachDigitalSpecialistHandoff } from './digital-specialist-handoff-v717.js';\nimport '../styles/calloria-digital-specialist-handoff-v717.css';";

const escalationFields = `<label class="form-field">DISPOSITION<select name="disposition" \${interactiveBlocked ? 'disabled' : ''}><option value="resolved">Resolved</option><option value="pending_customer">Pending customer response</option><option value="escalated">Escalated to specialist team</option></select></label>
          <div class="digital-escalation-fields" data-digital-escalation-fields hidden>
            <div class="digital-escalation-notice"><strong>Supervisor-routed specialist handoff</strong><small>The requested destination enters the Supervisor Escalations queue. A supervisor must claim and review it; selecting a destination does not transfer ownership automatically.</small></div>
            <label class="form-field">SPECIALIST DESTINATION<select name="specialistDepartment" disabled><option value="">Choose a destination</option><option>Cards &amp; Payments</option><option>Transfers Support</option><option>Fraud &amp; Payments</option><option>Digital Support</option><option>Customer Experience</option><option>IT Systems Support</option><option>RuffNeck Product Support</option><option>Life &amp; Advice</option><option>Complaints &amp; Resolution</option></select></label>
            <label class="form-field">WHY IS SPECIALIST SUPPORT REQUIRED?<input name="escalationReason" type="text" minlength="12" maxlength="240" placeholder="Describe the unresolved issue and why this team is needed." disabled></label>
          </div>`;

const changeListener = `// ${MARKER}: keep specialist fields conditional and enforce native form state.
document.addEventListener('change', event => {
  const selector = event.target;
  if (!selector?.matches?.('#digitalCloseForm select[name="disposition"]')) return;
  const fields = selector.form?.querySelector?.('[data-digital-escalation-fields]');
  if (!fields) return;
  const enabled = selector.value === 'escalated' && !selector.disabled;
  fields.hidden = !enabled;
  for (const control of fields.querySelectorAll('select,input,textarea')) {
    control.disabled = !enabled;
    control.required = enabled;
  }
});\n\n`;

const handoffValidation = `
    let specialistHandoffDraft = null;
    if (disposition === 'escalated') {
      const validation = validateDigitalSpecialistHandoff({
        department: values.get('specialistDepartment'),
        reason: values.get('escalationReason')
      });
      if (!validation.ok) { toast(validation.error, 'warning'); return; }
      const existingRequest = state.supervisorRequests.find(item => item?.contactId === contact.id && item.status === 'open');
      specialistHandoffDraft = createDigitalSpecialistHandoffRequest({
        id: existingRequest?.id || makeCallReference('SUP'),
        contact,
        caseReference: \`DIG-\${contact.id}\`,
        department: validation.value.department,
        reason: validation.value.reason,
        actor: state.applicantName || 'Agent',
        now: queueSimulationNowMs()
      });
    }
`;

const handoffPersistence = `if (specialistHandoffDraft) {
       const existingHandoffRequest = state.supervisorRequests.find(item => item?.id === specialistHandoffDraft.id && item.status === 'open');
       if (existingHandoffRequest) {
         const updatedHandoffRequest = attachDigitalSpecialistHandoff(existingHandoffRequest, specialistHandoffDraft);
         Object.assign(existingHandoffRequest, updatedHandoffRequest);
       } else {
         state.supervisorRequests.push(specialistHandoffDraft);
       }
       digitalCase.specialistDepartment = specialistHandoffDraft.specialistDepartment;
       digitalCase.escalationReason = specialistHandoffDraft.handoff.reason;
       digitalCase.supervisorRequestId = specialistHandoffDraft.id;
       pushOperationEvent('supervisor', contact.id, \`Digital case \${reference} requested specialist review by \${specialistHandoffDraft.specialistDepartment}.\`, 'open', { requestId: specialistHandoffDraft.id, caseReference: reference, department: specialistHandoffDraft.specialistDepartment });
     }
     ${CASE_PUSH_ANCHOR}`;

const cardReplacement = `<p>\${escapeHTML(request.reason || 'Agent assistance requested.')}</p>\${request.specialistDepartment ? \`<div class="supervisor-handoff-destination"><strong>Requested specialist destination</strong><span>\${escapeHTML(request.specialistDepartment)}</span><small>Linked case: \${escapeHTML(request.linkedCaseReference || request.reference || '')}</small></div>\` : ''}<div class="supervisor-escalation-meta">`;

export function transformDigitalSpecialistHandoffMain(source) {
  if (typeof source !== 'string') throw new TypeError('CALLORIA main.js source must be text.');
  if (source.includes(MARKER)) return { code: source, changed: false, alreadyPatched: true };
  const required = [IMPORT_ANCHOR, FORM_ANCHOR, FINISH_ANCHOR, VALUES_ANCHOR, CASE_PUSH_ANCHOR, SUPERVISOR_CARD_ANCHOR];
  const labels = ['digital engine import', 'digital disposition form', 'finishDigitalContact function', 'disposition value', 'digital case persistence point', 'supervisor escalation card'];
  for (let index = 0; index < required.length; index += 1) {
    const found = count(source, required[index]);
    if (found !== 1) throw new Error(`${labels[index]}: expected exactly one source anchor, found ${found}.`);
  }
  let code = source;
  code = replaceExactlyOnce(code, IMPORT_ANCHOR, `${IMPORT_ANCHOR}\n${importLine}`, labels[0]);
  code = replaceExactlyOnce(code, FORM_ANCHOR, escalationFields, labels[1]);
  code = replaceExactlyOnce(code, FINISH_ANCHOR, `${changeListener}${FINISH_ANCHOR}`, labels[2]);
  code = replaceExactlyOnce(code, VALUES_ANCHOR, `${VALUES_ANCHOR}${handoffValidation}`, labels[3]);
  code = replaceExactlyOnce(code, CASE_PUSH_ANCHOR, handoffPersistence, labels[4]);
  code = replaceExactlyOnce(code, SUPERVISOR_CARD_ANCHOR, cardReplacement, labels[5]);
  return { code: `${code}\n/* ${MARKER} */`, changed: true, alreadyPatched: false };
}

export function calloriaDigitalSpecialistHandoffPluginV717() {
  return {
    name: PLUGIN_NAME,
    enforce: 'post',
    transform(source, id) {
      if (!MAIN_ID.test(String(id).replaceAll('\\\\', '/'))) return null;
      try {
        const result = transformDigitalSpecialistHandoffMain(source);
        return result.changed ? { code: result.code, map: null } : null;
      } catch (error) {
        this.error(`[${PLUGIN_NAME}] ${error.message} No partial transform was applied.`);
      }
    }
  };
}
