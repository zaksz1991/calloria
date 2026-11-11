import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../public/sales-operations-engine.js');

const BASE = '2026-11-11T10:00:00.000Z';
function fresh() { return E.createInitialState(BASE); }
function opportunity(state, overrides = {}) {
  return E.createOpportunity(state, {
    customerId: 'CUS-9001', customerName: 'Example Customer', type: 'Cross-sell', productId: 'ruffneck-connect',
    source: 'Inbound enquiry', channel: 'Voice', owner: 'Test Agent', need: 'Customer wants a better way to coordinate team communications.',
    fit: 'The Connect product can be reviewed against the requested collaboration workflow.', permission: true,
    permissionNote: 'Customer asked to discuss the service during this inbound contact.',
    nextAction: 'Arrange a guided product walkthrough with the customer.', followUpAt: '2026-11-12T10:00:00.000Z', estimatedValue: '120000', ...overrides
  }, BASE);
}
function qualify(state, item, extras = {}) {
  return E.qualifyOpportunity(state, item.id, { suitabilityConfirmed: true, ...extras }, BASE);
}
function customerContext(overrides = {}) {
  return { customers: [{ id: 'CUS-9001', status: 'Active', consent: { email: true, sms: false, marketing: true }, ...overrides }], cases: [] };
}

test('version, keys and stage catalogue are stable', () => {
  assert.equal(E.VERSION, '5.7.0');
  assert.equal(E.STORAGE_KEY, 'calloria.sales-operations.v57');
  assert.ok(E.STAGES.includes('Won') && E.STAGES.includes('Disqualified'));
  assert.ok(E.PRODUCTS.some((item) => item.id === 'sponsorship'));
});
test('initial state provides marked demonstration opportunities', () => {
  const state = fresh();
  assert.equal(state.opportunities.length, 3);
  assert.ok(state.opportunities.every((item) => item.demo === true));
  assert.ok(state.opportunities.some((item) => item.stage === 'Qualified'));
});
test('normalise repairs malformed collections', () => {
  const state = E.normaliseState({ opportunities: null, suppression: 'bad', activity: null }, BASE);
  assert.ok(Array.isArray(state.opportunities));
  assert.deepEqual(state.suppression, []);
  assert.deepEqual(state.activity, []);
});
test('load returns a clean demo state when storage is empty', () => {
  const storage = { getItem: () => null };
  assert.equal(E.load(storage, BASE).version, E.VERSION);
});
test('load tolerates invalid JSON', () => {
  const storage = { getItem: () => '{bad json' };
  assert.equal(E.load(storage, BASE).opportunities.length, 3);
});
test('save writes state to storage', () => {
  let value = '';
  const storage = { setItem: (_key, next) => { value = next; } };
  assert.equal(E.save(fresh(), storage), true);
  assert.equal(JSON.parse(value).version, E.VERSION);
});
test('save reports storage exceptions', () => {
  assert.equal(E.save(fresh(), { setItem: () => { throw new Error('quota'); } }), false);
});
test('clean strips markup and control characters', () => {
  assert.equal(E.clean(' <sale>\nlead\u0000 '), 'sale lead');
});
test('creates a valid cross-sell opportunity', () => {
  const item = opportunity(fresh());
  assert.equal(item.stage, 'New');
  assert.equal(item.customerId, 'CUS-9001');
  assert.equal(item.estimatedValue, 120000);
});
test('creates a prospect without a customer profile', () => {
  const item = opportunity(fresh(), { customerId: '', customerName: 'Example Organisation' });
  assert.equal(item.customerId, null);
  assert.equal(item.customerName, 'Example Organisation');
});
test('rejects missing prospect name', () => {
  assert.throws(() => opportunity(fresh(), { customerId: '', customerName: '' }), /prospect name/i);
});
test('rejects invalid opportunity type', () => {
  assert.throws(() => opportunity(fresh(), { type: 'Unapproved' }), /opportunity type/i);
});
test('rejects invalid product', () => {
  assert.throws(() => opportunity(fresh(), { productId: 'unknown' }), /product or commercial/i);
});
test('rejects missing documented customer need', () => {
  assert.throws(() => opportunity(fresh(), { need: 'Need' }), /customer need/i);
});
test('rejects missing fit evidence', () => {
  assert.throws(() => opportunity(fresh(), { fit: 'Fit' }), /product-fit evidence/i);
});
test('rejects an invalid estimated value', () => {
  assert.throws(() => opportunity(fresh(), { estimatedValue: '-1' }), /non-negative/i);
});
test('opportunity requires a dated next action while active', () => {
  assert.throws(() => opportunity(fresh(), { followUpAt: '' }), /dated next action/i);
});
test('cannot qualify without explicit customer permission', () => {
  const state = fresh(); const item = opportunity(state, { permission: false, permissionNote: '' });
  assert.throws(() => qualify(state, item), /explicit permission/i);
});
test('cannot qualify when permission source is undocumented', () => {
  const state = fresh(); const item = opportunity(state, { permissionNote: 'ok' });
  assert.throws(() => qualify(state, item), /explicit permission/i);
});
test('cannot qualify without suitability confirmation', () => {
  const state = fresh(); const item = opportunity(state);
  assert.throws(() => E.qualifyOpportunity(state, item.id, { suitabilityConfirmed: false }, BASE), /suitability/i);
});
test('qualifies with permission, need, fit and suitability', () => {
  const state = fresh(); const item = opportunity(state);
  assert.equal(qualify(state, item).stage, 'Qualified');
});
test('blocks qualification when linked profile is inactive', () => {
  const state = fresh(); const item = opportunity(state);
  assert.throws(() => qualify(state, item, { customerState: customerContext({ status: 'Inactive' }) }), /not active/i);
});
test('blocks qualification for unresolved complaint or P1 service risk', () => {
  const state = fresh(); const item = opportunity(state);
  const context = customerContext(); context.cases.push({ customerId: 'CUS-9001', status: 'Open', category: 'Complaint & service recovery', priority: 'P2 - High' });
  assert.throws(() => qualify(state, item, { customerState: context }), /service-risk review/i);
});
test('allows qualification only with documented supervisor service-risk review', () => {
  const state = fresh(); const item = opportunity(state);
  const context = customerContext(); context.cases.push({ customerId: 'CUS-9001', status: 'Open', category: 'Complaint & service recovery', priority: 'P2 - High' });
  assert.equal(qualify(state, item, { customerState: context, serviceRiskAcknowledged: true, serviceRiskReason: 'Supervisor confirmed the customer requested a separate product discussion.' }).stage, 'Qualified');
});
test('service risk helper ignores resolved and closed cases', () => {
  const context = customerContext(); context.cases.push({ customerId: 'CUS-9001', status: 'Resolved', category: 'Complaint & service recovery', priority: 'P1 - Urgent' });
  assert.equal(E.activeServiceRisk(context, 'CUS-9001'), false);
});
test('creates a proposal for a qualified opportunity', () => {
  const state = fresh(); const item = opportunity(state); qualify(state, item);
  const result = E.createProposal(state, item.id, { summary: 'A scoped service proposal for the customer need.', terms: 'Includes a guided setup and agreed support review.', disclosures: 'Availability and any price must be confirmed through approved commercial controls.', estimatedValue: 135000, discountPercent: 10, basis: 'Approved internal estimate' }, BASE);
  assert.equal(result.stage, 'Proposal');
  assert.equal(result.proposal.estimatedValue, 135000);
});
test('rejects proposal before qualification', () => {
  const state = fresh(); const item = opportunity(state);
  assert.throws(() => E.createProposal(state, item.id, {}, BASE), /qualified opportunity/i);
});
test('requires proposal disclosures and terms', () => {
  const state = fresh(); const item = opportunity(state); qualify(state, item);
  assert.throws(() => E.createProposal(state, item.id, { summary: 'long enough summary for test', terms: 'terms', disclosures: 'disclosure' }, BASE), /terms and limitations/i);
});
test('discount above 20 percent needs supervisor approval', () => {
  const state = fresh(); const item = opportunity(state); qualify(state, item);
  const details = { summary: 'A scoped service proposal for the customer need.', terms: 'Includes a guided setup and agreed support review.', disclosures: 'Availability and any price must be confirmed through approved commercial controls.', discountPercent: 25 };
  assert.throws(() => E.createProposal(state, item.id, details, BASE), /supervisor approval/i);
});
test('discount above 20 percent succeeds with approval', () => {
  const state = fresh(); const item = opportunity(state); qualify(state, item);
  const result = E.createProposal(state, item.id, { summary: 'A scoped service proposal for the customer need.', terms: 'Includes a guided setup and agreed support review.', disclosures: 'Availability and any price must be confirmed through approved commercial controls.', discountPercent: 25, supervisorApproved: true }, BASE);
  assert.equal(result.proposal.supervisorApproved, true);
});
test('discount cannot exceed 50 percent', () => {
  const state = fresh(); const item = opportunity(state); qualify(state, item);
  assert.throws(() => E.createProposal(state, item.id, { summary: 'A scoped service proposal for the customer need.', terms: 'Includes a guided setup and agreed support review.', disclosures: 'Availability and any price must be confirmed through approved commercial controls.', discountPercent: 55, supervisorApproved: true }, BASE), /from 0% to 50%/i);
});
test('won stage requires customer acceptance evidence', () => {
  const state = fresh(); const item = opportunity(state); qualify(state, item);
  E.createProposal(state, item.id, { summary: 'A scoped service proposal for the customer need.', terms: 'Includes a guided setup and agreed support review.', disclosures: 'Availability and any price must be confirmed through approved commercial controls.' }, BASE);
  assert.throws(() => E.transitionStage(state, item.id, 'Won', { evidence: 'ok' }, BASE), /acceptance.*evidence/i);
});
test('records a won outcome with evidence', () => {
  const state = fresh(); const item = opportunity(state); qualify(state, item);
  E.createProposal(state, item.id, { summary: 'A scoped service proposal for the customer need.', terms: 'Includes a guided setup and agreed support review.', disclosures: 'Availability and any price must be confirmed through approved commercial controls.' }, BASE);
  assert.equal(E.transitionStage(state, item.id, 'Won', { evidence: 'Customer confirmed acceptance by signed order reference SO-ACCEPT-01.' }, BASE).stage, 'Won');
});
test('lost outcome requires a supported reason and description', () => {
  const state = fresh(); const item = opportunity(state); qualify(state, item);
  assert.throws(() => E.transitionStage(state, item.id, 'Lost', { lossReason: 'Something', reason: 'Customer said no.' }, BASE), /loss reason/i);
});
test('records disqualification from new stage with reason', () => {
  const state = fresh(); const item = opportunity(state);
  assert.equal(E.transitionStage(state, item.id, 'Disqualified', { reason: 'The enquiry did not represent a valid customer requirement.' }, BASE).stage, 'Disqualified');
});
test('rejects invalid stage transition', () => {
  const state = fresh(); const item = opportunity(state);
  assert.throws(() => E.transitionStage(state, item.id, 'Negotiation', {}, BASE), /cannot move/i);
});
test('requires permission before scheduling follow-up', () => {
  const state = fresh(); const item = opportunity(state, { permission: false, permissionNote: '' });
  assert.throws(() => E.addFollowUp(state, item.id, { channel: 'Email', dueAt: '2026-11-12T10:00:00Z', action: 'Call customer to check the proposal.' }, BASE), /permission/i);
});
test('schedules a service follow-up after permission', () => {
  const state = fresh(); const item = opportunity(state);
  const followUp = E.addFollowUp(state, item.id, { channel: 'Voice', dueAt: '2026-11-12T10:00:00Z', action: 'Confirm whether customer wants the requested walkthrough.' }, BASE);
  assert.equal(followUp.status, 'Scheduled');
});
test('marketing follow-up requires linked Customer 360 marketing consent', () => {
  const state = fresh(); const item = opportunity(state);
  assert.throws(() => E.addFollowUp(state, item.id, { channel: 'Email', dueAt: '2026-11-12T10:00:00Z', action: 'Send the approved monthly product update.', marketingMessage: true }, BASE, customerContext({ consent: { marketing: false } })), /marketing consent/i);
});
test('marketing follow-up succeeds only with Customer 360 consent', () => {
  const state = fresh(); const item = opportunity(state);
  const followUp = E.addFollowUp(state, item.id, { channel: 'Email', dueAt: '2026-11-12T10:00:00Z', action: 'Send the approved monthly product update.', marketingMessage: true }, BASE, customerContext());
  assert.equal(followUp.marketingMessage, true);
});
test('completes follow-up with a controlled outcome', () => {
  const state = fresh(); const item = opportunity(state);
  const followUp = E.addFollowUp(state, item.id, { channel: 'Voice', dueAt: '2026-11-12T10:00:00Z', action: 'Ask whether a demonstration is still required.' }, BASE);
  assert.equal(E.completeFollowUp(state, item.id, followUp.id, 'No response', BASE).status, 'No response');
});
test('rejects invalid follow-up outcome', () => {
  const state = fresh(); const item = opportunity(state);
  const followUp = E.addFollowUp(state, item.id, { channel: 'Voice', dueAt: '2026-11-12T10:00:00Z', action: 'Ask whether a demonstration is still required.' }, BASE);
  assert.throws(() => E.completeFollowUp(state, item.id, followUp.id, 'Sent', BASE), /valid follow-up outcome/i);
});
test('do-not-contact suppression blocks new opportunities', () => {
  const state = fresh(); E.setDoNotContact(state, 'CUS-9001', 'Customer requested no further sales messages.', BASE);
  assert.throws(() => opportunity(state), /do-not-contact/i);
});
test('do-not-contact requires an auditable reason', () => {
  assert.throws(() => E.setDoNotContact(fresh(), 'CUS-9001', 'No', BASE), /why the customer requested/i);
});
test('cannot schedule follow-up after suppression', () => {
  const state = fresh(); const item = opportunity(state); E.setDoNotContact(state, 'CUS-9001', 'Customer asked to stop all sales contact.', BASE);
  assert.throws(() => E.addFollowUp(state, item.id, { channel: 'Voice', dueAt: '2026-11-12T10:00:00Z', action: 'Check interest in another service.' }, BASE), /suppressed/i);
});
test('adds a note to an opportunity', () => {
  const state = fresh(); const item = opportunity(state);
  assert.equal(E.addNote(state, item.id, 'Customer requested a product walkthrough next week.', 'Test Agent', BASE).author, 'Test Agent');
});
test('imports Customer 360 profiles without modifying them', () => {
  const profiles = E.importCustomers({ customers: [{ id: 'CUS-1', firstName: 'Amina', lastName: 'Lawal', status: 'Active', consent: { marketing: true }, services: ['general'] }] });
  assert.equal(profiles[0].name, 'Amina Lawal');
  assert.equal(profiles[0].marketingConsent, true);
});
test('imports completed workbench contacts only', () => {
  const rows = E.importCompletedContacts({ contacts: [{ id: 'CT-1', status: 'Completed', customerId: 'CUS-1', channel: 'Voice', productId: 'kano-run' }, { id: 'CT-2', status: 'Queued' }] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, 'Completed service contact');
});
test('dashboard calculates active and decided pipeline metrics', () => {
  const state = fresh(); const dashboard = E.buildDashboard(state, BASE);
  assert.ok(dashboard.total >= 3);
  assert.equal(dashboard.won, 0);
  assert.equal(typeof dashboard.estimatedPipeline, 'number');
  assert.equal(typeof dashboard.conversionPercent, 'number');
});
test('dashboard flags overdue scheduled follow-ups', () => {
  const state = fresh(); const item = opportunity(state);
  E.addFollowUp(state, item.id, { channel: 'Voice', dueAt: '2026-11-10T10:00:00Z', action: 'Check whether the customer wants a product walkthrough.' }, BASE);
  const dashboard = E.buildDashboard(state, '2026-11-11T12:00:00Z');
  assert.ok(dashboard.overdueFollowUps >= 1);
});
test('CSV export quotes values and neutralises formula injection', () => {
  const csv = E.toCsv([{ name: '=HYPERLINK("bad")' }], [{ label: 'Name', value: 'name' }]);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /"Name"/);
});
