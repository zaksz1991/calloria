const CATEGORIES = Object.freeze({
  account_access: 'Account access / profile',
  payments_transactions: 'Payments / transactions',
  technical_support: 'Technical support',
  service_complaint: 'Complaint / service failure',
  product_information: 'Product / service information',
  general_enquiry: 'General enquiry',
  other: 'Other / mixed issue'
});
const ROOT_CAUSES = Object.freeze({
  customer_action: 'Customer action / configuration',
  service_failure: 'Product or service failure',
  process_delay: 'Internal process / delay',
  third_party: 'Third-party dependency',
  technical_fault: 'System / technical fault',
  not_established: 'Not established during this contact'
});
const ACTIONS = Object.freeze({
  service_resolved: 'Issue resolved during contact',
  information_provided: 'Information / guidance provided',
  troubleshooting_completed: 'Troubleshooting performed',
  complaint_recorded: 'Complaint recorded for investigation',
  specialist_escalation: 'Referred for specialist / supervisor review',
  callback_agreed: 'Callback agreed with customer',
  no_contact: 'No live customer contact made',
  customer_declined: 'Customer declined the proposed action',
  opt_out_recorded: 'Do-not-contact preference recorded'
});
const UNDERSTANDING = Object.freeze({
  confirmed: 'Customer confirmed understanding / next step',
  not_confirmed: 'Understanding not confirmed',
  not_reached: 'Customer not reached'
});
function optionsHtml(options, selected = '') {
  return Object.entries(options).map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`).join('');
}
function suggestedAction(disposition, noConnectOutcome) {
  if (noConnectOutcome) return 'no_contact';
  if (disposition === 'callback') return 'callback_agreed';
  if (['escalated', 'review'].includes(disposition)) return 'specialist_escalation';
  if (disposition === 'declined') return 'customer_declined';
  if (disposition === 'opt_out') return 'opt_out_recorded';
  return '';
}
export function renderWrapEvidencePanel({ disposition = '', noConnectOutcome = false } = {}) {
  const action = suggestedAction(disposition, noConnectOutcome);
  const understanding = noConnectOutcome ? 'not_reached' : disposition === 'callback' ? 'confirmed' : '';
  return `<style>
.calloria-wrap-evidence-v711{margin:16px 0;padding:16px;border:1px solid var(--line,#d9e1ea);border-radius:14px;background:var(--surface-2,#f7f9fc)}
.calloria-wrap-evidence-v711 .evidence-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.calloria-wrap-evidence-v711 .evidence-field{min-width:0;display:flex;flex-direction:column;gap:6px}
.calloria-wrap-evidence-v711 label{font-size:11px;font-weight:800;letter-spacing:.055em}
.calloria-wrap-evidence-v711 select{width:100%;min-width:0;min-height:42px;padding:9px 10px;border:1px solid var(--line,#cbd5e1);border-radius:9px;background:var(--surface,#fff);color:inherit;font:inherit}
.calloria-wrap-evidence-v711 .evidence-check{display:flex;align-items:flex-start;gap:10px;margin-top:12px;font-size:13px;line-height:1.45}
.calloria-wrap-evidence-v711 .evidence-check input{width:20px;height:20px;flex:0 0 20px;margin:0}
.calloria-wrap-evidence-v711 .evidence-note{margin:8px 0 0;font-size:12px;line-height:1.5;color:var(--muted,#64748b)}
@media(max-width:640px){.calloria-wrap-evidence-v711{padding:12px}.calloria-wrap-evidence-v711 .evidence-grid{grid-template-columns:1fr}.calloria-wrap-evidence-v711 select{min-height:46px}}
</style>
<section class="calloria-wrap-evidence-v711" aria-labelledby="wrapEvidenceHeading">
  <div class="panel-head"><div><h3 id="wrapEvidenceHeading">Case outcome evidence</h3><p>Record what happened, what action was taken and what the customer understood.</p></div><span class="pill amber">REQUIRED</span></div>
  <div class="evidence-grid">
    <div class="evidence-field"><label for="wrapIssueCategory">ISSUE CATEGORY</label><select id="wrapIssueCategory"><option value="">Select issue category</option>${optionsHtml(CATEGORIES)}</select></div>
    <div class="evidence-field"><label for="wrapRootCause">PRIMARY ROOT CAUSE</label><select id="wrapRootCause"><option value="">Select root cause</option>${optionsHtml(ROOT_CAUSES)}</select></div>
    <div class="evidence-field"><label for="wrapPrimaryAction">ACTION ACTUALLY TAKEN</label><select id="wrapPrimaryAction"><option value="">Select action taken</option>${optionsHtml(ACTIONS, action)}</select></div>
    <div class="evidence-field"><label for="wrapCustomerUnderstanding">CUSTOMER UNDERSTANDING</label><select id="wrapCustomerUnderstanding"><option value="">Select customer outcome</option>${optionsHtml(UNDERSTANDING, understanding)}</select></div>
  </div>
  <label class="evidence-check"><input id="wrapFactsConfirmed" type="checkbox"><span>I confirm the notes contain factual actions and outcomes only, with no passwords, PINs, one-time codes or unnecessary sensitive information.</span></label>
  <p class="evidence-note">The selected action must agree with the final disposition. Unknown root causes must be recorded as “Not established”; do not guess.</p>
</section>`;
}
export function validateWrapEvidence({ disposition = '', noConnectOutcome = false, values = {}, notes = '', capturedAt = new Date().toISOString() } = {}) {
  const category = String(values.category || '');
  const rootCause = String(values.rootCause || '');
  const action = String(values.action || '');
  const customerUnderstanding = String(values.customerUnderstanding || '');
  const factsConfirmed = values.factsConfirmed === true;
  const errors = [];
  let focusId = 'wrapIssueCategory';
  if (!Object.hasOwn(CATEGORIES, category)) errors.push('Select the issue category.');
  else if (!Object.hasOwn(ROOT_CAUSES, rootCause)) { focusId = 'wrapRootCause'; errors.push('Select the primary root cause, or choose “Not established”.'); }
  else if (!Object.hasOwn(ACTIONS, action)) { focusId = 'wrapPrimaryAction'; errors.push('Select the action actually taken.'); }
  else if (!Object.hasOwn(UNDERSTANDING, customerUnderstanding)) { focusId = 'wrapCustomerUnderstanding'; errors.push('Record whether the customer understood the outcome or was reached.'); }
  else if (!factsConfirmed) { focusId = 'wrapFactsConfirmed'; errors.push('Confirm that the notes contain factual information and no authentication secrets.'); }
  if (!errors.length) {
    if (noConnectOutcome) {
      if (action !== 'no_contact' || customerUnderstanding !== 'not_reached') {
        focusId = action !== 'no_contact' ? 'wrapPrimaryAction' : 'wrapCustomerUnderstanding';
        errors.push('A no-answer, busy or voicemail attempt must be recorded as no contact made.');
      }
    } else if (disposition === 'callback') {
      if (action !== 'callback_agreed' || customerUnderstanding !== 'confirmed') {
        focusId = action !== 'callback_agreed' ? 'wrapPrimaryAction' : 'wrapCustomerUnderstanding';
        errors.push('A callback disposition requires an agreed callback action and confirmed customer understanding.');
      }
    } else if (['escalated', 'review'].includes(disposition)) {
      if (action !== 'specialist_escalation') { focusId = 'wrapPrimaryAction'; errors.push('An escalated or review disposition requires a specialist / supervisor referral action.'); }
    } else if (disposition === 'opt_out') {
      if (action !== 'opt_out_recorded') { focusId = 'wrapPrimaryAction'; errors.push('An opt-out disposition requires the do-not-contact preference to be recorded.'); }
    } else if (disposition === 'declined') {
      if (action !== 'customer_declined') { focusId = 'wrapPrimaryAction'; errors.push('A declined disposition requires the customer-declined action.'); }
    } else if (['resolved', 'completed'].includes(disposition)) {
      const acceptable = ['service_resolved', 'information_provided', 'troubleshooting_completed', 'complaint_recorded'];
      if (!acceptable.includes(action)) { focusId = 'wrapPrimaryAction'; errors.push('A completed interaction must record the resolution, guidance, troubleshooting or complaint action actually performed.'); }
      else if (customerUnderstanding !== 'confirmed') { focusId = 'wrapCustomerUnderstanding'; errors.push('Confirm customer understanding before recording a completed resolution.'); }
    }
  }
  if (errors.length) return { ok: false, errors, focusId, evidence: null };
  return { ok: true, errors: [], focusId: null, evidence: {
    version: '7.11', issueCategory: category, issueCategoryLabel: CATEGORIES[category],
    rootCause, rootCauseLabel: ROOT_CAUSES[rootCause], primaryAction: action, primaryActionLabel: ACTIONS[action],
    customerUnderstanding, customerUnderstandingLabel: UNDERSTANDING[customerUnderstanding],
    factualNotesConfirmed: true, disposition, capturedAt, noteLength: String(notes || '').trim().length
  } };
}
