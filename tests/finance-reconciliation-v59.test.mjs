import test from 'node:test';
import assert from 'node:assert/strict';
import Engine from '../public/finance-reconciliation-engine.js';

const NOW = '2026-11-11T10:00:00.000Z';
const PERIOD_START = '2026-11-01';
const PERIOD_END = '2026-11-30';

function fresh() { return Engine.createInitialState(NOW); }
function billing(payments = []) { return { payments }; }
function receipt(overrides = {}) {
  return {
    id: 'PAY-1', reference: 'RCT-2026-00001', externalReference: 'BANK-REF-001',
    customerId: 'CUS-1', customerName: 'Demo Customer', currency: 'NGN', amount: 1000,
    receivedAt: '2026-11-04T09:00:00.000Z', recordedAt: '2026-11-04T09:02:00.000Z',
    allocations: [], demo: false, ...overrides
  };
}
function sync(state, rows = [receipt()]) { return Engine.syncBillingPayments(state, billing(rows), NOW); }
function csv(rows, headers = 'date,reference,description,amount,currency,bankAccount') {
  return `${headers}\n${rows.join('\n')}`;
}
function importLines(state, rows, headers) {
  return Engine.importStatementCsv(state, csv(rows, headers), { importedBy: 'Finance User', sourceName: 'bank.csv' }, NOW);
}
function matchOne(state, lineId = state.lines[0].id, paymentId = state.billingPayments[0].id) {
  return Engine.manualMatch(state, lineId, paymentId, { matchedBy: 'Finance User', reason: 'Statement reference is confirmed against the original transfer receipt.' }, NOW);
}

// CSV parsing and statement ingestion

test('CSV parser preserves quoted commas and escaped double quotes', () => {
  const rows = Engine.parseCsv('date,description\n2026-11-01,"Transfer, customer said ""urgent"""');
  assert.equal(rows[1][1], 'Transfer, customer said "urgent"');
});

test('CSV parser rejects an unterminated quoted cell', () => {
  assert.throws(() => Engine.parseCsv('date,description\n2026-11-01,"unfinished'), /unterminated/);
});

test('CSV parser ignores blank lines and a UTF-8 BOM', () => {
  assert.deepEqual(Engine.parseCsv('\uFEFFdate,amount\n\n2026-11-01,20\n'), [['date', 'amount'], ['2026-11-01', '20']]);
});

test('initial state starts with no fabricated statement transactions', () => {
  const state = fresh();
  assert.equal(state.lines.length, 0);
  assert.equal(state.billingPayments.length, 0);
  assert.equal(state.accounts[0].maskedNumber, '•••• 2048');
});

test('valid CSV imports a bank credit as a positive amount', () => {
  const state = fresh();
  const batch = importLines(state, ['2026-11-04,BANK-REF-001,"Customer transfer",1000,NGN,Primary']);
  assert.equal(batch.importedCount, 1);
  assert.equal(state.lines[0].amount, 1000);
  assert.equal(state.lines[0].status, 'Unmatched');
  assert.equal(state.lines[0].currency, 'NGN');
});

test('separate debit and credit columns become signed movements', () => {
  const state = fresh();
  importLines(state, ['2026-11-04,Fee,25,,NGN,Primary', '2026-11-04,Deposit,,150,NGN,Primary'], 'date,description,debit,credit,currency,account');
  assert.deepEqual(state.lines.map((x) => x.amount), [-25, 150]);
});

test('CSV import skips exact duplicate statement rows on re-import', () => {
  const state = fresh();
  const statement = csv(['2026-11-04,BANK-REF-001,"Customer transfer",1000,NGN,Primary']);
  const one = Engine.importStatementCsv(state, statement, { importedBy: 'Finance User' }, NOW);
  const two = Engine.importStatementCsv(state, statement, { importedBy: 'Finance User' }, NOW);
  assert.equal(one.importedCount, 1);
  assert.equal(two.importedCount, 0);
  assert.equal(two.duplicateCount, 1);
  assert.equal(state.lines.length, 1);
});

test('duplicate rows inside one CSV file are counted and skipped', () => {
  const state = fresh();
  const batch = importLines(state, [
    '2026-11-04,BANK-REF-001,"Customer transfer",1000,NGN,Primary',
    '2026-11-04,BANK-REF-001,"Customer transfer",1000,NGN,Primary'
  ]);
  assert.equal(batch.importedCount, 1);
  assert.equal(batch.duplicateCount, 1);
});

test('CSV import rejects files with no transaction body', () => {
  const state = fresh();
  assert.throws(() => Engine.importStatementCsv(state, 'date,amount', { importedBy: 'Finance' }, NOW), /header and at least one/);
});

test('CSV import requires a date and amount/debit/credit columns', () => {
  const state = fresh();
  assert.throws(() => Engine.importStatementCsv(state, 'description,reference\nTransfer,R1', { importedBy: 'Finance' }, NOW), /transaction date and amount/);
});

test('CSV import rejects invalid calendar dates', () => {
  const state = fresh();
  assert.throws(() => importLines(state, ['2026-02-30,R1,Transfer,100,NGN,Primary']), /valid transaction date/);
});

test('CSV import rejects zero-value statement movements', () => {
  const state = fresh();
  assert.throws(() => importLines(state, ['2026-11-04,R1,Zero,0,NGN,Primary']), /non-zero valid number/);
});

test('CSV import rejects unsupported currencies', () => {
  const state = fresh();
  assert.throws(() => importLines(state, ['2026-11-04,R1,Transfer,100,XYZ,Primary']), /supported currency/);
});

test('CSV import rejects rows with debit and credit populated together', () => {
  const state = fresh();
  assert.throws(() => importLines(state, ['2026-11-04,Fee,25,15,NGN,Primary'], 'date,description,debit,credit,currency,account'), /either a debit or a credit/);
});

test('CSV import requires an active bank account', () => {
  const state = fresh(); state.accounts[0].active = false;
  assert.throws(() => Engine.importStatementCsv(state, csv(['2026-11-04,R1,Transfer,100,NGN,Primary']), { importedBy: 'Finance', accountId: 'BANK-PRIMARY' }, NOW), /active bank account/);
});

test('CSV import rejects rows for an approved period', () => {
  const state = fresh(); sync(state);
  importLines(state, ['2026-11-04,BANK-REF-001,Customer transfer,1000,NGN,Primary']);
  Engine.manualMatch(state, state.lines[0].id, state.billingPayments[0].id, { matchedBy: 'Finance User', reason: 'Statement reference confirmed with source transfer advice.' }, NOW);
  const close = Engine.preparePeriodClose(state, null, { startDate: PERIOD_START, endDate: PERIOD_END, preparedBy: 'Preparer', note: 'All evidence reviewed for the November close.' }, NOW);
  Engine.approvePeriodClose(state, close.id, { approvedBy: 'Controller' }, NOW);
  assert.throws(() => importLines(state, ['2026-11-15,R2,Other credit,200,NGN,Primary']), /approved period close/);
});

// Billing integration and matching controls

test('Billing import copies receipt summaries without card or bank credentials', () => {
  const state = fresh(); sync(state);
  assert.equal(state.billingPayments.length, 1);
  assert.equal(state.billingPayments[0].externalReference, 'BANK-REF-001');
  assert.equal(state.billingPayments[0].amount, 1000);
  assert.equal(Object.hasOwn(state.billingPayments[0], 'cardNumber'), false);
});

test('Billing import refreshes the same receipt instead of duplicating it', () => {
  const state = fresh(); sync(state); sync(state);
  assert.equal(state.billingPayments.length, 1);
  assert.equal(state.integration.billingImportCount, 1);
});

test('candidate ranking puts an exact reference and amount first', () => {
  const state = fresh();
  sync(state, [receipt(), receipt({ id: 'PAY-2', reference: 'RCT-2', externalReference: 'OTHER-REF', amount: 1000 })]);
  importLines(state, ['2026-11-04,BANK-REF-001,Customer transfer,1000,NGN,Primary']);
  const results = Engine.candidateMatches(state, state.lines[0]);
  assert.equal(results[0].payment.id, 'PAY-1');
  assert.equal(results[0].exactReference, true);
});

test('amount and currency alone produce a suggestion, not an exact match', () => {
  const state = fresh(); sync(state);
  importLines(state, ['2026-11-04,UNKNOWN-REF,Customer transfer,1000,NGN,Primary']);
  const candidate = Engine.candidateMatches(state, state.lines[0])[0];
  assert.equal(candidate.exactReference, false);
  assert.match(candidate.confidence, /suggestion/);
});

test('exact auto-match links unique reference, amount and currency', () => {
  const state = fresh(); sync(state);
  importLines(state, ['2026-11-04,bank_ref_001,Customer transfer,1000,NGN,Primary']);
  const result = Engine.autoMatchExactReferences(state, { matchedBy: 'Finance User' }, NOW);
  assert.deepEqual(result, { matched: 1, ambiguous: 0 });
  assert.equal(state.lines[0].status, 'Matched');
  assert.equal(state.matches[0].paymentId, 'PAY-1');
});

test('auto-match leaves amount-only suggestions unmatched', () => {
  const state = fresh(); sync(state);
  importLines(state, ['2026-11-04,UNKNOWN-REF,Customer transfer,1000,NGN,Primary']);
  const result = Engine.autoMatchExactReferences(state, { matchedBy: 'Finance User' }, NOW);
  assert.equal(result.matched, 0);
  assert.equal(state.lines[0].status, 'Unmatched');
});

test('auto-match leaves ambiguous exact references for review', () => {
  const state = fresh(); sync(state, [receipt(), receipt({ id: 'PAY-2', reference: 'RCT-2' })]);
  importLines(state, ['2026-11-04,BANK-REF-001,Customer transfer,1000,NGN,Primary']);
  const result = Engine.autoMatchExactReferences(state, { matchedBy: 'Finance User' }, NOW);
  assert.equal(result.matched, 0);
  assert.equal(result.ambiguous, 1);
  assert.equal(state.lines[0].status, 'Unmatched');
});

test('manual matching requires an evidence explanation', () => {
  const state = fresh(); sync(state);
  importLines(state, ['2026-11-04,UNKNOWN-REF,Customer transfer,1000,NGN,Primary']);
  assert.throws(() => Engine.manualMatch(state, state.lines[0].id, 'PAY-1', { matchedBy: 'Finance User', reason: 'too short' }, NOW), /at least 20 characters/);
});

test('manual matching permits exact amount/currency and records the reason', () => {
  const state = fresh(); sync(state);
  importLines(state, ['2026-11-04,UNKNOWN-REF,Customer transfer,1000,NGN,Primary']);
  const match = matchOne(state);
  assert.equal(match.method, 'Manual with explanation');
  assert.match(match.reason, /confirmed/);
  assert.equal(state.lines[0].status, 'Matched');
});

test('manual matching rejects a currency mismatch', () => {
  const state = fresh(); sync(state, [receipt({ currency: 'USD' })]);
  importLines(state, ['2026-11-04,UNKNOWN-REF,Customer transfer,1000,NGN,Primary']);
  assert.throws(() => matchOne(state), /exact currency and amount match/);
});

test('manual matching rejects an amount mismatch rather than masking fees', () => {
  const state = fresh(); sync(state);
  importLines(state, ['2026-11-04,UNKNOWN-REF,Customer transfer,990,NGN,Primary']);
  assert.throws(() => matchOne(state), /exact currency and amount match/);
});

test('a Billing receipt can be matched to only one bank line', () => {
  const state = fresh(); sync(state);
  importLines(state, ['2026-11-04,BANK-REF-001,Customer transfer,1000,NGN,Primary', '2026-11-05,UNKNOWN-REF,Duplicate transfer,1000,NGN,Primary']);
  Engine.manualMatch(state, state.lines[0].id, 'PAY-1', { matchedBy: 'Finance User', reason: 'Original bank line is confirmed against payment evidence.' }, NOW);
  assert.throws(() => Engine.manualMatch(state, state.lines[1].id, 'PAY-1', { matchedBy: 'Finance User', reason: 'Second line should not be linked to same receipt.' }, NOW), /already matched/);
});

// Classification and exceptions

test('debit classification accepts an expense class with evidence', () => {
  const state = fresh();
  importLines(state, ['2026-11-04,BANK-FEE,Monthly fee,-25,NGN,Primary']);
  const line = Engine.classifyLine(state, state.lines[0].id, { classification: 'Bank fee', classifiedBy: 'Finance User', reason: 'Bank schedule confirms monthly maintenance fee debit.' }, NOW);
  assert.equal(line.status, 'Classified');
  assert.equal(line.classification, 'Bank fee');
});

test('debit classification rejects a credit-only category', () => {
  const state = fresh();
  importLines(state, ['2026-11-04,BANK-FEE,Monthly fee,-25,NGN,Primary']);
  assert.throws(() => Engine.classifyLine(state, state.lines[0].id, { classification: 'Bank interest', classifiedBy: 'Finance User', reason: 'Bank advice documents the debit item.' }, NOW), /valid classification/);
});

test('credit classification accepts bank interest and an evidence note', () => {
  const state = fresh();
  importLines(state, ['2026-11-04,INT-1,Monthly interest,25,NGN,Primary']);
  const line = Engine.classifyLine(state, state.lines[0].id, { classification: 'Bank interest', classifiedBy: 'Finance User', reason: 'Credit advice identifies the account interest payment.' }, NOW);
  assert.equal(line.classification, 'Bank interest');
});

test('classification rejects a statement line already matched', () => {
  const state = fresh(); sync(state);
  importLines(state, ['2026-11-04,BANK-REF-001,Customer transfer,1000,NGN,Primary']);
  matchOne(state);
  assert.throws(() => Engine.classifyLine(state, state.lines[0].id, { classification: 'Other credit', classifiedBy: 'Finance User', reason: 'This should not alter an existing match.' }, NOW), /Only unmatched/);
});

test('classification requires a named operator', () => {
  const state = fresh(); importLines(state, ['2026-11-04,BANK-FEE,Fee,-25,NGN,Primary']);
  assert.throws(() => Engine.classifyLine(state, state.lines[0].id, { classification: 'Bank fee', classifiedBy: '', reason: 'Bank statement note supports the fee debit.' }, NOW), /Classifier is required/);
});

test('approved exclusion requires a substantial reason and is retained in state', () => {
  const state = fresh(); importLines(state, ['2026-11-04,R1,Statement memo,25,NGN,Primary']);
  assert.throws(() => Engine.ignoreLine(state, state.lines[0].id, { ignoredBy: 'Reviewer', reason: 'duplicate' }, NOW), /at least 20 characters/);
  const line = Engine.ignoreLine(state, state.lines[0].id, { ignoredBy: 'Reviewer', reason: 'Duplicate bank-generated memo confirmed against original entry.' }, NOW);
  assert.equal(line.status, 'Ignored');
  assert.equal(line.classification, 'Approved exclusion');
});

// Period close and segregation of duties

test('period summary blocks when no Billing receipt snapshot has been imported', () => {
  const state = fresh(); importLines(state, ['2026-11-04,R1,Non-payment credit,25,NGN,Primary']);
  const summary = Engine.periodSummary(state, null, PERIOD_START, PERIOD_END);
  assert.ok(summary.blockers.some((x) => /Billing v5.8/.test(x)));
});

test('period summary counts unmatched statement lines and missing receipts', () => {
  const state = fresh(); sync(state);
  importLines(state, ['2026-11-04,UNKNOWN-REF,Customer transfer,1000,NGN,Primary']);
  const summary = Engine.periodSummary(state, null, PERIOD_START, PERIOD_END);
  assert.equal(summary.unmatchedLines, 1);
  assert.equal(summary.unmatchedPayments, 1);
  assert.equal(summary.blockers.length, 2);
});

test('period summary calculates credit and debit totals by currency', () => {
  const state = fresh(); sync(state, []);
  importLines(state, ['2026-11-04,R1,Deposit,1000,NGN,Primary', '2026-11-05,R2,Bank fee,-20,NGN,Primary', '2026-11-06,R3,FX receipt,50,USD,Foreign']);
  state.lines.forEach((line) => Engine.classifyLine(state, line.id, { classification: line.amount < 0 ? 'Bank fee' : (line.currency === 'USD' ? 'Other credit' : 'Other credit'), classifiedBy: 'Finance User', reason: 'Supporting statement narrative and source document reviewed.' }, NOW));
  const summary = Engine.periodSummary(state, null, PERIOD_START, PERIOD_END);
  assert.equal(summary.byCurrency.NGN.credits, 1000);
  assert.equal(summary.byCurrency.NGN.debits, 20);
  assert.equal(summary.byCurrency.USD.credits, 50);
});

test('period summary rejects an end date before its start date', () => {
  const state = fresh();
  assert.throws(() => Engine.periodSummary(state, null, '2026-11-30', '2026-11-01'), /on or after/);
});

test('period preparation records blockers instead of falsely approving', () => {
  const state = fresh(); sync(state);
  importLines(state, ['2026-11-04,UNKNOWN-REF,Customer transfer,1000,NGN,Primary']);
  const close = Engine.preparePeriodClose(state, null, { startDate: PERIOD_START, endDate: PERIOD_END, preparedBy: 'Preparer', note: 'November finance close draft with exceptions.' }, NOW);
  assert.equal(close.status, 'Prepared');
  assert.ok(close.blockers.length > 0);
});

test('period close cannot be approved while blockers remain', () => {
  const state = fresh(); sync(state);
  importLines(state, ['2026-11-04,UNKNOWN-REF,Customer transfer,1000,NGN,Primary']);
  const close = Engine.preparePeriodClose(state, null, { startDate: PERIOD_START, endDate: PERIOD_END, preparedBy: 'Preparer', note: 'November close prepared for review.' }, NOW);
  assert.throws(() => Engine.approvePeriodClose(state, close.id, { approvedBy: 'Controller' }, NOW), /blockers/);
});

test('refreshing a prepared close clears blockers after reconciliation is completed', () => {
  const state = fresh(); sync(state);
  importLines(state, ['2026-11-04,BANK-REF-001,Customer transfer,1000,NGN,Primary']);
  const close = Engine.preparePeriodClose(state, null, { startDate: PERIOD_START, endDate: PERIOD_END, preparedBy: 'Preparer', note: 'November close prepared with open receipt match.' }, NOW);
  assert.ok(close.blockers.length);
  matchOne(state);
  const refreshed = Engine.refreshPeriodClose(state, close.id, NOW);
  assert.equal(refreshed.blockers.length, 0);
  assert.equal(refreshed.matchedLines, 1);
});

test('period close approval succeeds with independent approver after a clean checklist', () => {
  const state = fresh(); sync(state);
  importLines(state, ['2026-11-04,BANK-REF-001,Customer transfer,1000,NGN,Primary']); matchOne(state);
  const close = Engine.preparePeriodClose(state, null, { startDate: PERIOD_START, endDate: PERIOD_END, preparedBy: 'Preparer', note: 'All November bank and billing evidence reconciled.' }, NOW);
  const approved = Engine.approvePeriodClose(state, close.id, { approvedBy: 'Controller' }, NOW);
  assert.equal(approved.status, 'Approved');
  assert.equal(Engine.isPeriodClosed(state, '2026-11-15'), true);
});

test('period close approval enforces a separate person from the preparer', () => {
  const state = fresh(); sync(state);
  importLines(state, ['2026-11-04,BANK-REF-001,Customer transfer,1000,NGN,Primary']); matchOne(state);
  const close = Engine.preparePeriodClose(state, null, { startDate: PERIOD_START, endDate: PERIOD_END, preparedBy: 'Finance User', note: 'All statement evidence reconciled and ready for sign-off.' }, NOW);
  assert.throws(() => Engine.approvePeriodClose(state, close.id, { approvedBy: 'finance user' }, NOW), /different person/);
});

test('a prepared close must be refreshed if new unmatched lines are imported before approval', () => {
  const state = fresh(); sync(state);
  importLines(state, ['2026-11-04,BANK-REF-001,Customer transfer,1000,NGN,Primary']); matchOne(state);
  const close = Engine.preparePeriodClose(state, null, { startDate: PERIOD_START, endDate: PERIOD_END, preparedBy: 'Preparer', note: 'Initial clean month-end preparation.' }, NOW);
  importLines(state, ['2026-11-12,NEW-REF,Unmatched incoming,500,NGN,Primary']);
  assert.throws(() => Engine.approvePeriodClose(state, close.id, { approvedBy: 'Controller' }, NOW), /refresh the close checklist/);
  const refreshed = Engine.refreshPeriodClose(state, close.id, NOW);
  assert.equal(refreshed.blockers.length, 1);
});

test('period close prevents overlapping approved closes', () => {
  const state = fresh(); sync(state);
  importLines(state, ['2026-11-04,BANK-REF-001,Customer transfer,1000,NGN,Primary']); matchOne(state);
  const first = Engine.preparePeriodClose(state, null, { startDate: PERIOD_START, endDate: PERIOD_END, preparedBy: 'Preparer', note: 'First November period-close package.' }, NOW);
  Engine.approvePeriodClose(state, first.id, { approvedBy: 'Controller' }, NOW);
  assert.throws(() => Engine.preparePeriodClose(state, null, { startDate: '2026-11-15', endDate: '2026-12-15', preparedBy: 'Other Preparer', note: 'Overlapping period close should be rejected.' }, NOW), /overlaps/);
});

test('duplicate prepared close for the same period is prevented', () => {
  const state = fresh(); sync(state);
  importLines(state, ['2026-11-04,BANK-REF-001,Customer transfer,1000,NGN,Primary']); matchOne(state);
  Engine.preparePeriodClose(state, null, { startDate: PERIOD_START, endDate: PERIOD_END, preparedBy: 'Preparer', note: 'First preparation for this period.' }, NOW);
  assert.throws(() => Engine.preparePeriodClose(state, null, { startDate: PERIOD_START, endDate: PERIOD_END, preparedBy: 'Another Preparer', note: 'Second preparation should be blocked.' }, NOW), /already exists/);
});

test('reopening an approved period requires a different operator and a reason', () => {
  const state = fresh(); sync(state);
  importLines(state, ['2026-11-04,BANK-REF-001,Customer transfer,1000,NGN,Primary']); matchOne(state);
  const close = Engine.preparePeriodClose(state, null, { startDate: PERIOD_START, endDate: PERIOD_END, preparedBy: 'Preparer', note: 'All evidence checked for month end.' }, NOW);
  Engine.approvePeriodClose(state, close.id, { approvedBy: 'Controller' }, NOW);
  assert.throws(() => Engine.reopenPeriodClose(state, close.id, { reopenedBy: 'controller', reason: 'Need to revise an item' }, NOW), /other than the approver/);
  const reopened = Engine.reopenPeriodClose(state, close.id, { reopenedBy: 'Finance Director', reason: 'New bank statement evidence received after controller sign-off.' }, NOW);
  assert.equal(reopened.status, 'Reopened');
});

test('reopened period is no longer locked against corrected statement import', () => {
  const state = fresh(); sync(state);
  importLines(state, ['2026-11-04,BANK-REF-001,Customer transfer,1000,NGN,Primary']); matchOne(state);
  const close = Engine.preparePeriodClose(state, null, { startDate: PERIOD_START, endDate: PERIOD_END, preparedBy: 'Preparer', note: 'Month end reconciliation completed for review.' }, NOW);
  Engine.approvePeriodClose(state, close.id, { approvedBy: 'Controller' }, NOW);
  Engine.reopenPeriodClose(state, close.id, { reopenedBy: 'Finance Director', reason: 'A corrected bank statement has been received for the month.' }, NOW);
  const batch = importLines(state, ['2026-11-20,R2,Additional bank credit,200,NGN,Primary']);
  assert.equal(batch.importedCount, 1);
});

test('a prepared close cannot be reopened', () => {
  const state = fresh(); sync(state);
  const close = Engine.preparePeriodClose(state, null, { startDate: PERIOD_START, endDate: PERIOD_END, preparedBy: 'Preparer', note: 'Month end preparation with no imported activity.' }, NOW);
  assert.throws(() => Engine.reopenPeriodClose(state, close.id, { reopenedBy: 'Director', reason: 'Reason is long enough to pass validation.' }, NOW), /Only an approved/);
});

// Dashboard, persistence and exports

test('dashboard aggregates matching counts and currencies', () => {
  const state = fresh(); sync(state);
  importLines(state, ['2026-11-04,BANK-REF-001,Customer transfer,1000,NGN,Primary', '2026-11-05,BANK-FEE,Monthly fee,-25,NGN,Primary']);
  matchOne(state);
  Engine.classifyLine(state, state.lines[1].id, { classification: 'Bank fee', classifiedBy: 'Finance User', reason: 'Bank schedule confirms the monthly service fee debit.' }, NOW);
  const d = Engine.buildDashboard(state);
  assert.equal(d.statementLines, 2); assert.equal(d.matched, 1); assert.equal(d.classified, 1); assert.equal(d.unmatchedLines, 0); assert.equal(d.unmatchedReceipts, 0);
});

test('state can be saved and loaded from browser-like storage', () => {
  const state = fresh(); sync(state); importLines(state, ['2026-11-04,BANK-REF-001,Customer transfer,1000,NGN,Primary']);
  const values = new Map(); const storage = { getItem: (k) => values.get(k) || null, setItem: (k, v) => values.set(k, v) };
  assert.equal(Engine.save(state, storage), true);
  const loaded = Engine.load(storage, NOW);
  assert.equal(loaded.lines.length, 1); assert.equal(loaded.billingPayments.length, 1);
});

test('malformed stored JSON safely falls back to an initial state', () => {
  const storage = { getItem: () => '{bad json', setItem: () => {} };
  assert.equal(Engine.load(storage, NOW).lines.length, 0);
});

test('CSV export protects spreadsheet formulas', () => {
  const csvText = Engine.toCsv([{ reference: '=HYPERLINK("bad")', amount: -5 }], [{ label: 'Reference', value: 'reference' }, { label: 'Amount', value: 'amount' }]);
  assert.match(csvText, /'=HYPERLINK/);
  assert.match(csvText, /'-5/);
});
