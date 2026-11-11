import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../public/people-operations-engine.js');

function state() { return E.createInitialState('2026-11-11'); }
function validProfile(overrides = {}) {
  return {
    id: 'ag-150', name: 'Test Employee', email: 'test.employee@calloria.example', department: 'general-cx',
    jobTitle: 'Customer Service Associate', supervisor: 'Maryam Bello', hireDate: '2026-11-01', contractType: 'Permanent',
    workPattern: 'Full-time', status: 'Active', probationDue: '',
    leaveBalances: { annual: 20, casual: 5, sick: 10, parental: 0 }, profileNotes: '', ...overrides
  };
}
function fakeStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return { getItem: (key) => map.has(key) ? map.get(key) : null, setItem: (key, value) => map.set(key, value), _map: map };
}

test('initial state includes employee, leave, attendance, probation and cases data', () => {
  const s = state();
  assert.equal(s.version, 50);
  assert.equal(s.profiles.length, 10);
  assert.ok(s.leaveRequests.length >= 1);
  assert.ok(s.attendance.length >= 1);
  assert.ok(s.probationReviews.length >= 1);
  assert.ok(s.cases.length >= 1);
});

test('weekday calculation excludes Saturdays and Sundays', () => {
  assert.equal(E.workdaysBetween('2026-11-13', '2026-11-16'), 2);
  assert.equal(E.workdaysBetween('2026-11-14', '2026-11-15'), 0);
  assert.equal(E.workdaysBetween('2026-11-20', '2026-11-19'), 0);
});

test('date validation rejects impossible calendar dates', () => {
  assert.equal(E.isDate('2026-02-29'), false);
  assert.equal(E.isDate('2026-11-11'), true);
  assert.equal(E.isDate('11/11/2026'), false);
});

test('creates an employee record with validated defaults', () => {
  const s = state();
  const saved = E.saveProfile(s, validProfile());
  assert.equal(saved.id, 'ag-150');
  assert.equal(saved.status, 'Active');
  assert.equal(s.profiles.length, 11);
});

test('updates an existing employee without creating a duplicate', () => {
  const s = state();
  const originalCount = s.profiles.length;
  const current = s.profiles[0];
  const saved = E.saveProfile(s, validProfile({ id: current.id, name: 'Amina Yusuf Updated', email: current.email, department: current.department, jobTitle: current.jobTitle, supervisor: current.supervisor, hireDate: current.hireDate, contractType: current.contractType, status: current.status, leaveBalances: current.leaveBalances }));
  assert.equal(saved.name, 'Amina Yusuf Updated');
  assert.equal(s.profiles.length, originalCount);
});

test('rejects duplicate staff IDs and duplicate work emails', () => {
  const s = state();
  assert.throws(() => E.saveProfile(s, validProfile({ id: 'AG-104' })), /already exists/i);
  assert.throws(() => E.saveProfile(s, validProfile({ email: s.profiles[0].email })), /already assigned/i);
});

test('requires a future review date for probation status', () => {
  const s = state();
  assert.throws(() => E.saveProfile(s, validProfile({ status: 'Probation' })), /probation employee needs a review date/i);
  const saved = E.saveProfile(s, validProfile({ status: 'Probation', probationDue: '2026-12-01' }));
  assert.equal(saved.probationDue, '2026-12-01');
});

test('rejects invalid department and leave entitlements', () => {
  const s = state();
  assert.throws(() => E.saveProfile(s, validProfile({ department: 'made-up' })), /valid department/i);
  assert.throws(() => E.saveProfile(s, validProfile({ leaveBalances: { annual: -1, casual: 5, sick: 10, parental: 0 } })), /invalid annual/i);
});

test('calculates leave balances with pending reservations', () => {
  const s = state();
  const balance = E.getLeaveBalance(s, 'ag-104', 'annual');
  assert.equal(balance.allowance, 20);
  assert.equal(balance.reserved, 3);
  assert.equal(balance.available, 17);
});

test('creates leave requests using working days and reserves balance', () => {
  const s = state();
  const request = E.createLeaveRequest(s, { employeeId: 'ag-104', type: 'annual', startDate: '2026-11-23', endDate: '2026-11-25', reason: 'Planned break' });
  assert.equal(request.days, 3);
  assert.equal(request.status, 'Pending');
  assert.equal(E.getLeaveBalance(s, 'ag-104', 'annual').reserved, 6);
});

test('rejects overlapping leave requests and non-working-day-only periods', () => {
  const s = state();
  assert.throws(() => E.createLeaveRequest(s, { employeeId: 'ag-104', type: 'annual', startDate: '2026-11-17', endDate: '2026-11-19' }), /already has a pending or approved/i);
  assert.throws(() => E.createLeaveRequest(s, { employeeId: 'ag-104', type: 'annual', startDate: '2026-11-21', endDate: '2026-11-22' }), /no working days/i);
});

test('rejects leave that exceeds available balance and inactive staff requests', () => {
  const s = state();
  assert.throws(() => E.createLeaveRequest(s, { employeeId: 'ag-104', type: 'annual', startDate: '2026-12-01', endDate: '2027-01-01' }), /insufficient annual leave balance/i);
  const profile = E.profileById(s, 'ag-104'); profile.status = 'Exited';
  assert.throws(() => E.createLeaveRequest(s, { employeeId: 'ag-104', type: 'unpaid', startDate: '2026-12-01', endDate: '2026-12-02' }), /only be created for active/i);
});

test('approves pending leave and rejects repeat decisions', () => {
  const s = state();
  const approved = E.decideLeaveRequest(s, 'lv-5001', 'Approved', 'HR Lead', 'Coverage confirmed');
  assert.equal(approved.status, 'Approved');
  assert.equal(approved.decisionBy, 'HR Lead');
  assert.throws(() => E.decideLeaveRequest(s, 'lv-5001', 'Rejected', 'HR Lead', ''), /only pending/i);
});

test('rejects unknown leave decisions', () => {
  const s = state();
  assert.throws(() => E.decideLeaveRequest(s, 'lv-5001', 'Maybe', 'HR Lead', ''), /must be Approved or Rejected/i);
});

test('records one attendance status per employee per date', () => {
  const s = state();
  const record = E.recordAttendance(s, { employeeId: 'ag-104', date: '2026-11-11', status: 'Late', minutes: 12, note: 'Transport delay reported' });
  assert.equal(record.minutes, 12);
  assert.throws(() => E.recordAttendance(s, { employeeId: 'ag-104', date: '2026-11-11', status: 'Present' }), /already exists/i);
  assert.throws(() => E.recordAttendance(s, { employeeId: 'ag-104', date: '2026-11-12', status: 'Late', minutes: 1500 }), /between 0 and 1440/i);
});

test('confirms probation and updates employment status', () => {
  const s = state();
  const review = E.completeProbationReview(s, { employeeId: 'ag-108', outcome: 'Confirm', reviewer: 'Maryam Bello', notes: 'Completed learning and coached service targets with consistent quality.' });
  assert.equal(review.outcome, 'Confirm');
  assert.equal(E.profileById(s, 'ag-108').status, 'Active');
  assert.equal(E.profileById(s, 'ag-108').probationDue, null);
});

test('extends probation only when the new review date is in the future', () => {
  const s = state();
  assert.throws(() => E.completeProbationReview(s, { employeeId: 'ag-108', outcome: 'Extend', newDueDate: '2026-11-01', notes: 'Need additional evidence from customer service practice.' }), /future review date/i);
  const review = E.completeProbationReview(s, { employeeId: 'ag-108', outcome: 'Extend', newDueDate: '2027-01-15', notes: 'Need additional evidence from customer service practice.' });
  assert.equal(review.outcome, 'Extend');
  assert.equal(E.profileById(s, 'ag-108').probationDue, '2027-01-15');
});

test('probation decision requires evidence notes and a probation employee', () => {
  const s = state();
  assert.throws(() => E.completeProbationReview(s, { employeeId: 'ag-104', outcome: 'Confirm', notes: 'No' }), /only employees on probation/i);
  assert.throws(() => E.completeProbationReview(s, { employeeId: 'ag-108', outcome: 'Confirm', notes: 'Short' }), /meaningful evidence summary/i);
});

test('refers unsuccessful probation to notice period, not an immediate exit', () => {
  const s = state();
  E.completeProbationReview(s, { employeeId: 'ag-108', outcome: 'End employment', notes: 'Probation standards were not met after documented support and review.' });
  assert.equal(E.profileById(s, 'ag-108').status, 'Notice period');
});

test('creates employee cases with objective context', () => {
  const s = state();
  const record = E.createCase(s, { employeeId: 'ag-104', type: 'Grievance', title: 'Work schedule concern', notes: 'Employee requested a review of the published shift allocation.' });
  assert.equal(record.status, 'Open');
  assert.equal(record.type, 'Grievance');
  assert.throws(() => E.createCase(s, { employeeId: 'ag-104', type: 'Grievance', title: 'Short case title', notes: 'Too short' }), /objective context or evidence/i);
});

test('requires a closure outcome when closing a people case', () => {
  const s = state();
  assert.throws(() => E.updateCase(s, 'hr-5001', { status: 'Closed', outcome: 'Done' }), /closure outcome is required/i);
  const updated = E.updateCase(s, 'hr-5001', { status: 'Under review', owner: 'HR Partner', outcome: 'Interview scheduled' });
  assert.equal(updated.status, 'Under review');
  assert.equal(updated.owner, 'HR Partner');
});

test('proposes and approves internal transfer only to a valid new department', () => {
  const s = state();
  assert.throws(() => E.proposeTransfer(s, { employeeId: 'ag-104', toDepartment: 'general-cx', effectiveDate: '2026-12-01' }), /different destination/i);
  const proposal = E.proposeTransfer(s, { employeeId: 'ag-104', toDepartment: 'email', effectiveDate: '2026-12-01', toTitle: 'Email Service Agent' });
  assert.equal(E.profileById(s, 'ag-104').department, 'general-cx');
  E.decideTransfer(s, proposal.id, 'Approved', 'Operations Director');
  assert.equal(proposal.status, 'Approved');
  assert.equal(E.profileById(s, 'ag-104').department, 'general-cx');
  s.asOfDate = '2026-12-01';
  assert.equal(E.applyEffectiveTransfers(s), 1);
  assert.equal(proposal.status, 'Completed');
  assert.equal(E.profileById(s, 'ag-104').department, 'email');
  assert.equal(E.profileById(s, 'ag-104').jobTitle, 'Email Service Agent');
});

test('rejects transfer to unknown department and prevents duplicate decisions', () => {
  const s = state();
  assert.throws(() => E.proposeTransfer(s, { employeeId: 'ag-104', toDepartment: 'other', effectiveDate: '2026-12-01' }), /valid destination/i);
  const proposal = E.proposeTransfer(s, { employeeId: 'ag-104', toDepartment: 'email', effectiveDate: '2026-12-01' });
  E.decideTransfer(s, proposal.id, 'Rejected', 'HR Lead');
  assert.throws(() => E.decideTransfer(s, proposal.id, 'Approved', 'HR Lead'), /only pending/i);
});

test('prevents overlapping unresolved transfers for the same employee', () => {
  const s = state();
  E.proposeTransfer(s, { employeeId: 'ag-104', toDepartment: 'email', effectiveDate: '2026-12-01' });
  assert.throws(() => E.proposeTransfer(s, { employeeId: 'ag-104', toDepartment: 'social', effectiveDate: '2026-12-10' }), /unresolved transfer proposal/i);
});

test('puts an approved transfer on hold if the employee changed before its effective date', () => {
  const s = state();
  const proposal = E.proposeTransfer(s, { employeeId: 'ag-104', toDepartment: 'email', effectiveDate: '2026-12-01' });
  E.decideTransfer(s, proposal.id, 'Approved', 'HR Lead');
  E.profileById(s, 'ag-104').department = 'social';
  s.asOfDate = '2026-12-01';
  assert.equal(E.applyEffectiveTransfers(s), 1);
  assert.equal(proposal.status, 'On hold');
  assert.equal(E.profileById(s, 'ag-104').department, 'social');
});

test('starts offboarding and changes employee to notice period', () => {
  const s = state();
  const record = E.startOffboarding(s, { employeeId: 'ag-104', lastWorkingDate: '2026-11-30', reason: 'Resignation' });
  assert.equal(record.status, 'In progress');
  assert.equal(E.profileById(s, 'ag-104').status, 'Notice period');
});

test('offboarding cannot complete until every exit control is checked', () => {
  const s = state();
  const record = E.startOffboarding(s, { employeeId: 'ag-104', lastWorkingDate: '2026-11-30', reason: 'Resignation' });
  assert.throws(() => E.completeOffboarding(s, record.id), /complete all exit controls/i);
  E.OFFBOARDING_ITEMS.forEach((item) => E.updateOffboardingItem(s, record.id, item.id, true));
  assert.throws(() => E.completeOffboarding(s, record.id), /before the recorded last working date/i);
  s.asOfDate = '2026-11-30';
  E.completeOffboarding(s, record.id);
  assert.equal(record.status, 'Completed');
  assert.equal(E.profileById(s, 'ag-104').status, 'Exited');
});

test('completed offboarding checklist cannot be changed', () => {
  const s = state();
  const record = E.startOffboarding(s, { employeeId: 'ag-104', lastWorkingDate: '2026-11-11', reason: 'Resignation' });
  E.OFFBOARDING_ITEMS.forEach((item) => E.updateOffboardingItem(s, record.id, item.id, true));
  E.completeOffboarding(s, record.id);
  assert.throws(() => E.updateOffboardingItem(s, record.id, 'equipment', false), /locked/i);
});

test('imports the v4.9 staff snapshot without mutating its source record', () => {
  const upstream = { version: 49, asOfDate: '2026-11-11', staff: [
    { id: 'ag-104', name: 'Amina Y. Snapshot', department: 'email', level: 'senior', supervisor: 'New Supervisor', status: 'Active' },
    { id: 'ag-199', name: 'New Imported Person', department: 'voice', level: 'agent', supervisor: 'Team Lead', status: 'Active' }
  ] };
  const storage = fakeStorage({ [E.PERFORMANCE_KEY]: JSON.stringify(upstream) });
  const s = state();
  const result = E.importPerformanceStaff(s, storage);
  assert.deepEqual(result, { imported: 1, updated: 1, available: true });
  assert.equal(E.profileById(s, 'ag-104').department, 'email');
  assert.equal(E.profileById(s, 'ag-104').jobTitle, 'Senior Customer Service Agent');
  assert.equal(E.profileById(s, 'ag-199').name, 'New Imported Person');
  assert.equal(upstream.staff[0].department, 'email');
});

test('does not import unknown or malformed upstream department records', () => {
  const storage = fakeStorage({ [E.PERFORMANCE_KEY]: JSON.stringify({ version: 49, staff: [{ id: 'bad', name: 'Bad', department: 'unknown', level: 'agent' }] }) });
  const s = state();
  const result = E.importPerformanceStaff(s, storage);
  assert.equal(result.available, true);
  assert.equal(result.imported, 0);
  assert.equal(s.profiles.length, 10);
});

test('returns unavailable when v4.9 source is absent or incompatible', () => {
  const s = state();
  assert.equal(E.importPerformanceStaff(s, fakeStorage()).available, false);
  assert.equal(E.importPerformanceStaff(s, fakeStorage({ [E.PERFORMANCE_KEY]: '{bad json' })).available, false);
});

test('dashboard metrics reflect pending HR work', () => {
  const metrics = E.dashboard(state());
  assert.equal(metrics.headcount, 10);
  assert.equal(metrics.active, 9);
  assert.equal(metrics.pendingLeave, 1);
  assert.equal(metrics.openCases, 1);
});

test('persists and reloads valid module state', () => {
  const storage = fakeStorage();
  const s = state();
  E.saveProfile(s, validProfile());
  assert.equal(E.saveState(s, storage), true);
  const loaded = E.loadState(storage);
  assert.equal(loaded.profiles.length, 11);
  assert.equal(loaded.profiles.find((profile) => profile.id === 'ag-150').id, 'ag-150');
});

test('ignores malformed or wrong-version stored state', () => {
  const bad = fakeStorage({ [E.STORAGE_KEY]: '{bad json' });
  assert.equal(E.loadState(bad).version, 50);
  const wrong = fakeStorage({ [E.STORAGE_KEY]: JSON.stringify({ version: 49, profiles: [] }) });
  assert.equal(E.loadState(wrong).profiles.length, 10);
});

test('CSV export escapes quotes and keeps deterministic headers', () => {
  const csv = E.exportCsv([{ name: 'Amina "A" Yusuf', email: 'a@example.test' }], [{ key: 'name', label: 'Employee' }, { key: 'email', label: 'Work email' }]);
  assert.equal(csv.split('\r\n')[0], '"Employee","Work email"');
  assert.match(csv, /"Amina ""A"" Yusuf","a@example\.test"/);
});

test('HTML IDs cover every DOM binding used by the page script', async () => {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const htmlPath = fileURLToPath(new URL('../public/people-operations.html', import.meta.url));
  const jsPath = fileURLToPath(new URL('../public/people-operations.js', import.meta.url));
  const html = await readFile(htmlPath, 'utf8');
  const js = await readFile(jsPath, 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const idSet = new Set(ids);
  const refs = [...js.matchAll(/\$\('([^']+)'\)/g)].map((match) => match[1]);
  assert.equal(idSet.size, ids.length, 'HTML contains duplicate IDs');
  assert.deepEqual([...new Set(refs)].filter((id) => !idSet.has(id)), []);
  assert.match(html, /people-operations-engine\.js/);
  assert.match(html, /people-operations\.css/);
});
