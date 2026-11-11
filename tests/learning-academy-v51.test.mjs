import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const API = require(path.join(root, 'public', 'learning-academy-engine.js'));

const date = '2026-11-11';
const answersFor = (course) => course.quiz.map((question) => question.correct);
function fullyComplete(state, record, at = date) {
  API.startCourse(state, record.id, at);
  const course = API.courseById(record.courseId);
  course.lessons.forEach((_, index) => API.completeLesson(state, record.id, index, at));
}

test('release constants and course catalogue are internally consistent', () => {
  assert.equal(API.VERSION, 51);
  assert.equal(API.PASS_MARK, 80);
  assert.deepEqual(API.BRIEFING_TIMES, ['07:30', '14:00']);
  assert.ok(API.COURSES.length >= 9);
  assert.equal(new Set(API.COURSES.map((course) => course.id)).size, API.COURSES.length);
  assert.equal(new Set(API.SKILLS.map((skill) => skill.id)).size, API.SKILLS.length);
  API.COURSES.forEach((course) => {
    assert.ok(course.lessons.length >= 2);
    assert.ok(course.quiz.length >= 3);
    course.skills.forEach((id) => assert.ok(API.SKILLS.some((skill) => skill.id === id)));
  });
});

test('initial state includes synthetic staff and an empty training ledger', () => {
  const state = API.createInitialState(date);
  assert.equal(state.asOfDate, date);
  assert.ok(state.employees.length >= 10);
  assert.equal(state.learning.length, 0);
  assert.equal(state.competencyAssessments.length, 0);
});

test('initial state accepts an existing People Operations employee snapshot', () => {
  const state = API.createInitialState(date, { profiles: [{ id: 'st-901', name: 'Sample Employee', department: 'voice', jobTitle: 'Voice Agent', supervisor: 'Team Lead', status: 'Active' }] });
  assert.equal(state.employees.length, 1);
  assert.equal(state.employees[0].id, 'st-901');
});

test('manual employee snapshot import updates matching rows and adds new rows', () => {
  const state = API.createInitialState(date);
  const result = API.importPeopleSnapshot(state, { profiles: [
    { id: 'ag-104', name: 'Amina Updated', department: 'general-cx', jobTitle: 'Senior Agent', supervisor: 'Lead B', status: 'Active' },
    { id: 'ag-500', name: 'New Agent', department: 'chat', jobTitle: 'Agent', supervisor: 'Lead C', status: 'Active' }
  ] }, date);
  assert.deepEqual(result, { imported: 2, added: 1, updated: 1 });
  assert.equal(API.employeeById(state, 'ag-104').name, 'Amina Updated');
  assert.equal(API.employeeById(state, 'ag-500').name, 'New Agent');
  assert.equal(state.integration.imported, 2);
});

test('snapshot import rejects missing or empty employee arrays', () => {
  const state = API.createInitialState(date);
  assert.throws(() => API.importPeopleSnapshot(state, null, date), /snapshot was not found/);
  assert.throws(() => API.importPeopleSnapshot(state, { profiles: [] }, date), /no valid employee records/);
});

test('single employee course assignment creates an Assigned learning record', () => {
  const state = API.createInitialState(date);
  const record = API.assignCourse(state, { employeeId: 'ag-104', courseId: 'cx-foundations', dueDate: '2026-11-20', assignedBy: 'Trainer' }, date);
  assert.equal(record.status, 'Assigned');
  assert.equal(record.employeeId, 'ag-104');
  assert.equal(record.completedLessons.length, 0);
});

test('course assignment rejects unknown employees, inactive staff and invalid courses', () => {
  const state = API.createInitialState(date);
  assert.throws(() => API.assignCourse(state, { employeeId: 'no-such', courseId: 'cx-foundations', dueDate: '2026-11-20' }, date), /valid employee/);
  state.employees.find((item) => item.id === 'ag-104').status = 'Exited';
  assert.throws(() => API.assignCourse(state, { employeeId: 'ag-104', courseId: 'cx-foundations', dueDate: '2026-11-20' }, date), /active or probation/);
  assert.throws(() => API.assignCourse(state, { employeeId: 'ag-112', courseId: 'no-course', dueDate: '2026-11-20' }, date), /valid course/);
});

test('course assignment requires an in-range due date', () => {
  const state = API.createInitialState(date);
  assert.throws(() => API.assignCourse(state, { employeeId: 'ag-104', courseId: 'cx-foundations', dueDate: '2026-11-10' }, date), /on or after/);
  assert.throws(() => API.assignCourse(state, { employeeId: 'ag-104', courseId: 'cx-foundations', dueDate: '2026-02-31' }, date), /on or after/);
});

test('single course assignments enforce the department mapping', () => {
  const state = API.createInitialState(date);
  assert.throws(() => API.assignCourse(state, { employeeId: 'ag-123', courseId: 'voice-contact', dueDate: '2026-11-20' }, date), /not mapped to the selected employee/);
  assert.doesNotThrow(() => API.assignCourse(state, { employeeId: 'ag-112', courseId: 'voice-contact', dueDate: '2026-11-20' }, date));
});

test('duplicate open course assignments are blocked', () => {
  const state = API.createInitialState(date);
  API.assignCourse(state, { employeeId: 'ag-104', courseId: 'cx-foundations', dueDate: '2026-11-20' }, date);
  assert.throws(() => API.assignCourse(state, { employeeId: 'ag-104', courseId: 'cx-foundations', dueDate: '2026-11-22' }, date), /already has an open assignment/);
});

test('department assignment creates eligible active staff records and skips duplicates', () => {
  const state = API.createInitialState(date);
  const first = API.assignDepartmentCourse(state, { courseId: 'cx-foundations', department: 'general-cx', dueDate: '2026-11-20' }, date);
  const second = API.assignDepartmentCourse(state, { courseId: 'cx-foundations', department: 'general-cx', dueDate: '2026-11-20' }, date);
  assert.equal(first.assigned, 1);
  assert.equal(second.assigned, 0);
  assert.equal(second.skipped, 1);
});

test('department assignment supports the all-active-employees audience', () => {
  const state = API.createInitialState(date);
  const result = API.assignDepartmentCourse(state, { courseId: 'privacy-verification', department: 'all', dueDate: '2026-11-30' }, date);
  assert.equal(result.assigned, 10);
  assert.equal(result.skipped, 0);
});

test('role-specific courses cannot be assigned to an unsupported department or all employees', () => {
  const state = API.createInitialState(date);
  assert.throws(() => API.assignDepartmentCourse(state, { courseId: 'voice-contact', department: 'email', dueDate: '2026-11-30' }, date), /not mapped to the selected department/);
  assert.throws(() => API.assignDepartmentCourse(state, { courseId: 'voice-contact', department: 'all', dueDate: '2026-11-30' }, date), /role-specific/);
});

test('starting and completing lessons advances assignment state', () => {
  const state = API.createInitialState(date);
  const record = API.assignCourse(state, { employeeId: 'ag-104', courseId: 'cx-foundations', dueDate: '2026-11-20' }, date);
  API.startCourse(state, record.id, date);
  assert.equal(record.status, 'In progress');
  const first = API.completeLesson(state, record.id, 0, date);
  assert.equal(first.completed, 1);
  assert.equal(record.status, 'In progress');
});

test('lesson completion rejects invalid lesson indexes', () => {
  const state = API.createInitialState(date);
  const record = API.assignCourse(state, { employeeId: 'ag-104', courseId: 'cx-foundations', dueDate: '2026-11-20' }, date);
  assert.throws(() => API.completeLesson(state, record.id, 50, date), /valid lesson/);
});

test('assessment cannot be submitted before every lesson is complete', () => {
  const state = API.createInitialState(date);
  const record = API.assignCourse(state, { employeeId: 'ag-104', courseId: 'cx-foundations', dueDate: '2026-11-20' }, date);
  assert.throws(() => API.submitAssessment(state, record.id, answersFor(API.courseById(record.courseId)), date), /Complete every lesson/);
});

test('assessment requires every question to have an answer', () => {
  const state = API.createInitialState(date);
  const record = API.assignCourse(state, { employeeId: 'ag-104', courseId: 'cx-foundations', dueDate: '2026-11-20' }, date);
  fullyComplete(state, record);
  assert.throws(() => API.submitAssessment(state, record.id, [0], date), /Answer every assessment question/);
});

test('passing the course assessment issues a dated certification and skill evidence', () => {
  const state = API.createInitialState(date);
  const record = API.assignCourse(state, { employeeId: 'ag-104', courseId: 'cx-foundations', dueDate: '2026-11-20' }, date);
  fullyComplete(state, record);
  const result = API.submitAssessment(state, record.id, answersFor(API.courseById(record.courseId)), date);
  assert.equal(result.score, 100);
  assert.equal(result.passed, true);
  assert.equal(record.status, 'Completed');
  assert.equal(record.certification.expiresAt, '2027-11-11');
  assert.equal(state.competencyAssessments.length, API.courseById(record.courseId).skills.length);
  assert.equal(state.competencyAssessments[0].rating, 'Competent');
});

test('failed assessment remains failed until an explicit retake is started', () => {
  const state = API.createInitialState(date);
  const record = API.assignCourse(state, { employeeId: 'ag-104', courseId: 'cx-foundations', dueDate: '2026-11-20' }, date);
  fullyComplete(state, record);
  const wrong = API.courseById(record.courseId).quiz.map(() => -1);
  const result = API.submitAssessment(state, record.id, wrong, date);
  assert.equal(result.score, 0);
  assert.equal(record.status, 'Failed');
  assert.throws(() => API.submitAssessment(state, record.id, answersFor(API.courseById(record.courseId)), date), /explicit retake/);
  API.retakeCourse(state, record.id, date);
  assert.equal(record.status, 'Assigned');
  assert.equal(record.completedLessons.length, 0);
  assert.equal(record.attempts, 1);
});

test('a failed course can pass on a later attempt', () => {
  const state = API.createInitialState(date);
  const record = API.assignCourse(state, { employeeId: 'ag-104', courseId: 'cx-foundations', dueDate: '2026-11-20' }, date);
  fullyComplete(state, record);
  API.submitAssessment(state, record.id, [0, 0, 0], date);
  API.retakeCourse(state, record.id, date);
  fullyComplete(state, record, '2026-11-12');
  const result = API.submitAssessment(state, record.id, answersFor(API.courseById(record.courseId)), '2026-11-12');
  assert.equal(result.passed, true);
  assert.equal(record.attempts, 2);
});

test('completed assignments cannot be silently reassessed', () => {
  const state = API.createInitialState(date);
  const record = API.assignCourse(state, { employeeId: 'ag-104', courseId: 'cx-foundations', dueDate: '2026-11-20' }, date);
  fullyComplete(state, record);
  API.submitAssessment(state, record.id, answersFor(API.courseById(record.courseId)), date);
  assert.throws(() => API.submitAssessment(state, record.id, answersFor(API.courseById(record.courseId)), date), /not available for assessment/);
});

test('certification status distinguishes valid, renewal due and expired', () => {
  const state = API.createInitialState(date);
  const record = API.assignCourse(state, { employeeId: 'ag-104', courseId: 'privacy-verification', dueDate: '2026-11-20' }, date);
  fullyComplete(state, record);
  API.submitAssessment(state, record.id, answersFor(API.courseById(record.courseId)), date);
  assert.equal(API.getCertificationStatus(state, date)[0].status, 'Valid');
  assert.equal(API.getCertificationStatus(state, '2027-10-20')[0].status, 'Renewal due');
  assert.equal(API.getCertificationStatus(state, '2027-11-12')[0].status, 'Expired');
});

test('competency assessment requires an active employee, a valid skill and evidence', () => {
  const state = API.createInitialState(date);
  assert.throws(() => API.assessCompetency(state, { employeeId: 'unknown', skillId: 'crm-logging', rating: 'Competent', evidence: 'Observed a real CRM workflow', assessedBy: 'Coach' }, date), /valid employee/);
  assert.throws(() => API.assessCompetency(state, { employeeId: 'ag-104', skillId: 'unknown', rating: 'Competent', evidence: 'Observed a real CRM workflow', assessedBy: 'Coach' }, date), /valid competency/);
  assert.throws(() => API.assessCompetency(state, { employeeId: 'ag-104', skillId: 'crm-logging', rating: 'Competent', evidence: 'short', assessedBy: 'Coach' }, date), /12 characters/);
});

test('competency matrix returns the latest assessment per skill', () => {
  const state = API.createInitialState(date);
  API.assessCompetency(state, { employeeId: 'ag-104', skillId: 'crm-logging', rating: 'Needs support', evidence: 'Case notes omitted the next follow-up date.', assessedBy: 'Coach' }, date);
  API.assessCompetency(state, { employeeId: 'ag-104', skillId: 'crm-logging', rating: 'Competent', evidence: 'Follow-up and case ownership were recorded accurately.', assessedBy: 'Coach' }, '2026-11-12');
  const entry = API.getSkillMatrix(state, 'ag-104').find((item) => item.skill.id === 'crm-logging');
  assert.equal(entry.rating, 'Competent');
  assert.equal(entry.assessment.assessedAt, '2026-11-12');
});

test('briefings accept only 7:30 AM or 2:00 PM slots', () => {
  const state = API.createInitialState(date);
  assert.throws(() => API.scheduleBriefing(state, { date, time: '09:00', topic: 'Daily service update', trainer: 'Trainer' }, date), /07:30 morning or 14:00 afternoon/);
  const morning = API.scheduleBriefing(state, { date, time: '07:30', topic: 'New product service rules', trainer: 'Trainer', audience: 'all' }, date);
  const afternoon = API.scheduleBriefing(state, { date, time: '14:00', topic: 'Afternoon change briefing', trainer: 'Trainer', audience: 'voice' }, date);
  assert.equal(morning.time, '07:30');
  assert.equal(afternoon.time, '14:00');
});

test('briefing schedule blocks duplicate date and time slots', () => {
  const state = API.createInitialState(date);
  API.scheduleBriefing(state, { date, time: '07:30', topic: 'Morning change update', trainer: 'Trainer' }, date);
  assert.throws(() => API.scheduleBriefing(state, { date, time: '07:30', topic: 'Another topic', trainer: 'Trainer' }, date), /already exists/);
});

test('briefing schedule validates date, topic and trainer', () => {
  const state = API.createInitialState(date);
  assert.throws(() => API.scheduleBriefing(state, { date: '2026-11-10', time: '07:30', topic: 'Topic', trainer: 'Trainer' }, date), /on or after/);
  assert.throws(() => API.scheduleBriefing(state, { date, time: '07:30', topic: 'A', trainer: 'Trainer' }, date), /briefing topic/);
  assert.throws(() => API.scheduleBriefing(state, { date, time: '07:30', topic: 'Product update', trainer: ' ' }, date), /trainer or facilitator/);
});

test('briefing attendance is constrained to the session audience', () => {
  const state = API.createInitialState(date);
  const session = API.scheduleBriefing(state, { date, time: '14:00', topic: 'Voice routing process update', trainer: 'Team Lead', audience: 'voice' }, date);
  assert.throws(() => API.recordBriefingAttendance(state, { sessionId: session.id, employeeId: 'ag-104', status: 'Attended' }, date), /outside the briefing audience/);
  const record = API.recordBriefingAttendance(state, { sessionId: session.id, employeeId: 'ag-112', status: 'Attended' }, date);
  assert.equal(record.status, 'Attended');
});

test('briefing attendance cannot be recorded ahead of the scheduled session date', () => {
  const state = API.createInitialState(date);
  const session = API.scheduleBriefing(state, { date: '2026-11-12', time: '07:30', topic: 'Tomorrow service update', trainer: 'Trainer' }, date);
  assert.throws(() => API.recordBriefingAttendance(state, { sessionId: session.id, employeeId: 'ag-104', status: 'Attended' }, date), /before the briefing date/);
});

test('briefing attendance can be recorded only once for each employee and session', () => {
  const state = API.createInitialState(date);
  const session = API.scheduleBriefing(state, { date, time: '07:30', topic: 'Product release update', trainer: 'Trainer', audience: 'all' }, date);
  API.recordBriefingAttendance(state, { sessionId: session.id, employeeId: 'ag-104', status: 'Attended' }, date);
  assert.throws(() => API.recordBriefingAttendance(state, { sessionId: session.id, employeeId: 'ag-104', status: 'Absent' }, date), /already been recorded/);
});

test('briefing attendance rejects exited employees and invalid statuses', () => {
  const state = API.createInitialState(date);
  const session = API.scheduleBriefing(state, { date, time: '07:30', topic: 'Product release update', trainer: 'Trainer' }, date);
  state.employees.find((item) => item.id === 'ag-104').status = 'Exited';
  assert.throws(() => API.recordBriefingAttendance(state, { sessionId: session.id, employeeId: 'ag-104', status: 'Attended' }, date), /active or probation/);
  assert.throws(() => API.recordBriefingAttendance(state, { sessionId: session.id, employeeId: 'ag-112', status: 'Late' }, date), /valid attendance status/);
});

test('employee learning view calculates overdue from the workspace date', () => {
  const state = API.createInitialState(date);
  API.assignCourse(state, { employeeId: 'ag-104', courseId: 'cx-foundations', dueDate: '2026-11-10' }, '2026-11-10');
  state.asOfDate = date;
  assert.equal(API.getEmployeeLearning(state, 'ag-104')[0].overdue, true);
});

test('dashboard aggregates assignments, completions, overdue and briefings', () => {
  const state = API.createInitialState(date);
  const overdue = API.assignCourse(state, { employeeId: 'ag-104', courseId: 'cx-foundations', dueDate: '2026-11-10' }, '2026-11-10');
  const done = API.assignCourse(state, { employeeId: 'ag-108', courseId: 'privacy-verification', dueDate: '2026-11-20' }, date);
  fullyComplete(state, done);
  API.submitAssessment(state, done.id, answersFor(API.courseById(done.courseId)), date);
  API.scheduleBriefing(state, { date: '2026-11-12', time: '07:30', topic: 'Tomorrow product update', trainer: 'Trainer' }, date);
  const result = API.getDashboard(state, date);
  assert.equal(result.assignments, 2);
  assert.equal(result.completed, 1);
  assert.equal(result.overdue, 1);
  assert.equal(result.upcomingBriefings, 1);
  assert.ok(result.activeEmployees >= 9);
});

test('CSV export escapes commas, quotes and newlines', () => {
  const csv = API.exportCsv([{ name: 'Agent, One', note: 'Said "hello"\nnext' }], [{ key: 'name', label: 'Name' }, { key: 'note', label: 'Note' }]);
  assert.equal(csv, '"Name","Note"\r\n"Agent, One","Said ""hello""\nnext"');
});

test('storage adapter loads, saves and recovers corrupted state', () => {
  const map = new Map();
  const fakeStorage = { getItem: (key) => map.has(key) ? map.get(key) : null, setItem: (key, value) => map.set(key, value) };
  const store = API.createStore(fakeStorage);
  const state = store.load(date);
  assert.equal(state.version, 51);
  assert.equal(store.save(state), true);
  map.set(API.STORAGE_KEY, '{invalid');
  const recovered = store.load(date);
  assert.equal(recovered.version, 51);
  assert.ok(Array.isArray(recovered.employees));
});

test('storage adapter imports v5.0 employee snapshot when academy has no saved state', () => {
  const map = new Map([[API.PEOPLE_KEY, JSON.stringify({ profiles: [{ id: 'hr-222', name: 'Library Test Agent', department: 'email', jobTitle: 'Email Agent', supervisor: 'Supervisor', status: 'Active' }] })]]);
  const fakeStorage = { getItem: (key) => map.has(key) ? map.get(key) : null, setItem: (key, value) => map.set(key, value) };
  const state = API.createStore(fakeStorage).load(date);
  assert.equal(state.employees.length, 1);
  assert.equal(state.employees[0].id, 'hr-222');
});

test('HTML scripts, forms and navigation bindings are present and unique', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'learning-academy.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'public', 'learning-academy.js'), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'HTML IDs must be unique');
  ['employee-select', 'import-people', 'export-report', 'metrics', 'workspace', 'notice', 'page-title', 'page-subtitle'].forEach((id) => assert.ok(ids.includes(id), `Missing HTML id: ${id}`));
  ['dashboard', 'courses', 'learning', 'competencies', 'briefings'].forEach((view) => assert.ok(html.includes(`data-view="${view}"`)));
  ['assign-form', 'competency-form', 'briefing-form', 'attendance-form', 'assessment-form'].forEach((form) => assert.ok(js.includes(`'${form}'`)));
  assert.match(html, /learning-academy-engine\.js/);
  assert.match(html, /learning-academy\.js/);
});
