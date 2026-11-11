(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CalloriaLearningAcademy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 51;
  const STORAGE_KEY = 'calloria.learning-academy.v51';
  const PEOPLE_KEY = 'calloria.people-operations.v50';
  const PASS_MARK = 80;
  const BRIEFING_TIMES = Object.freeze(['07:30', '14:00']);

  const DEPARTMENTS = Object.freeze([
    { id: 'general-cx', name: 'General Customer Experience' }, { id: 'voice', name: 'Voice Operations' },
    { id: 'email', name: 'Email Operations' }, { id: 'social', name: 'Social Media Care' },
    { id: 'it', name: 'IT & Systems Support' }, { id: 'quality', name: 'Quality Assurance' },
    { id: 'workforce', name: 'Workforce Management' }, { id: 'crm', name: 'CRM & Customer Data' },
    { id: 'training', name: 'Training & Knowledge' }, { id: 'operations', name: 'Operations & Escalations' },
    { id: 'sales', name: 'Sales & Retention' }
  ]);

  const SKILLS = Object.freeze([
    { id: 'customer-empathy', label: 'Customer empathy & communication', category: 'Core' },
    { id: 'identity-verification', label: 'Identity verification & data care', category: 'Core' },
    { id: 'crm-logging', label: 'CRM accuracy & case notes', category: 'Core' },
    { id: 'resolution', label: 'Investigation & resolution ownership', category: 'Core' },
    { id: 'voice-handling', label: 'Voice contact handling', category: 'Channel' },
    { id: 'written-handling', label: 'Written contact handling', category: 'Channel' },
    { id: 'complaints', label: 'Complaint recovery & escalation', category: 'Specialist' },
    { id: 'quality-review', label: 'Quality evaluation & calibration', category: 'Specialist' },
    { id: 'workforce-tools', label: 'Workforce & schedule controls', category: 'Specialist' },
    { id: 'coaching', label: 'Coaching & team leadership', category: 'Leadership' },
    { id: 'systems-support', label: 'Systems troubleshooting', category: 'Specialist' },
    { id: 'knowledge-writing', label: 'Knowledge article writing', category: 'Specialist' }
  ]);

  const COURSES = Object.freeze([
    {
      id: 'cx-foundations', title: 'Customer Experience Foundations', category: 'Core', level: 'Foundation', durationMinutes: 25,
      departments: ['all'], skills: ['customer-empathy', 'resolution'], validityDays: 365,
      lessons: [
        { title: 'Understand the customer need', body: 'Let the customer explain the issue. Confirm the outcome they need before choosing a process. Separate the stated request from the underlying cause.' },
        { title: 'Communicate with ownership', body: 'Use clear language, explain the next step and time expectation, and avoid promises outside your authority. Keep ownership until the agreed hand-off is accepted.' },
        { title: 'Close the loop', body: 'Summarise the action taken, confirm whether the customer has a remaining question, and record the next step in the approved system.' }
      ],
      quiz: [
        { q: 'What should happen before selecting a resolution?', options: ['Transfer immediately', 'Clarify the issue and desired outcome', 'Close the contact'], correct: 1, explanation: 'Clarifying the issue prevents solving the wrong problem.' },
        { q: 'A customer asks for an outcome outside your authority. What is the sound response?', options: ['Promise it anyway', 'End the contact', 'Explain the limit and arrange an accepted escalation'], correct: 2, explanation: 'The agent should be transparent and retain ownership through a valid hand-off.' },
        { q: 'What belongs in a contact closure?', options: ['A clear summary and next step', 'Only the customer name', 'No record if the customer is satisfied'], correct: 0, explanation: 'A closure record supports continuity and review.' }
      ]
    },
    {
      id: 'privacy-verification', title: 'Customer Verification & Data Protection', category: 'Core', level: 'Foundation', durationMinutes: 30,
      departments: ['all'], skills: ['identity-verification', 'crm-logging'], validityDays: 365,
      lessons: [
        { title: 'Verify before disclosure', body: 'Use the approved verification steps for the service and contact type. Do not disclose account or personal information before the required checks pass.' },
        { title: 'Collect only what is needed', body: 'Do not ask for unnecessary sensitive information. Keep confidential data out of free-text notes unless the approved workflow requires it.' },
        { title: 'Handle uncertainty safely', body: 'Pause the action and seek an authorised supervisor or specialist when verification fails or a request appears unusual.' }
      ],
      quiz: [
        { q: 'When may an agent disclose protected account information?', options: ['After the approved verification passes', 'When the caller sounds confident', 'When the queue is busy'], correct: 0, explanation: 'Verification must follow the approved service process.' },
        { q: 'What is the data-minimisation principle?', options: ['Collect everything', 'Collect only information needed for the task', 'Keep personal information in chat notes'], correct: 1, explanation: 'Only necessary information should be collected and recorded.' },
        { q: 'Verification does not pass. What next?', options: ['Continue anyway', 'Guess the missing details', 'Stop disclosure and follow the safe escalation path'], correct: 2, explanation: 'Do not bypass controls when identity is not established.' }
      ]
    },
    {
      id: 'crm-case-quality', title: 'CRM Logging & Case Management', category: 'Core', level: 'Foundation', durationMinutes: 35,
      departments: ['all'], skills: ['crm-logging', 'resolution'], validityDays: 365,
      lessons: [
        { title: 'Create a useful case record', body: 'Record the customer issue, relevant checks, actions taken, outcome, owner and next step. Use factual language rather than assumptions or labels.' },
        { title: 'Choose the correct status', body: 'Use the status that reflects the real work state. A pending item needs an owner, reason and follow-up point; it must not be marked resolved just to clear a queue.' },
        { title: 'Protect continuity', body: 'A colleague should be able to understand what happened and continue the case without asking the customer to repeat everything.' }
      ],
      quiz: [
        { q: 'Which note is most useful?', options: ['Customer was difficult', 'Customer queried a delayed order; tracking checked; carrier update due tomorrow', 'Handled'], correct: 1, explanation: 'A factual note captures the issue, action and follow-up.' },
        { q: 'When should a case be marked resolved?', options: ['When the queue is full', 'When the agent wants to stop work', 'When the resolution criteria are met and the outcome is recorded'], correct: 2, explanation: 'Statuses must reflect actual case progress.' },
        { q: 'What does good case continuity require?', options: ['Clear factual notes and a named next owner/action', 'A long unstructured paragraph', 'No follow-up date'], correct: 0, explanation: 'Clear records prevent unnecessary customer repetition.' }
      ]
    },
    {
      id: 'voice-contact', title: 'Voice Contact Handling', category: 'Channel', level: 'Operational', durationMinutes: 30,
      departments: ['general-cx', 'voice', 'operations', 'sales'], skills: ['voice-handling', 'customer-empathy'], validityDays: 365,
      lessons: [
        { title: 'Opening and control', body: 'Use the approved greeting, establish the reason for contact, and set a calm structure. Do not interrupt the customer to rush through a script.' },
        { title: 'Investigate while listening', body: 'Ask focused questions, acknowledge the impact, and explain when you need time to check information. Use hold and transfer procedures correctly.' },
        { title: 'Close clearly', body: 'Repeat the agreed action, confirm expectations and document the result before completing wrap-up.' }
      ],
      quiz: [
        { q: 'What is the best response when you need time to investigate?', options: ['Stay silent', 'Explain what you are checking and follow hold procedure', 'Transfer without explanation'], correct: 1, explanation: 'Customers need clear expectations and controlled handling.' },
        { q: 'What should an agent do before completing wrap-up?', options: ['Record the action and outcome', 'Skip documentation', 'Delete the case'], correct: 0, explanation: 'Wrap-up records support service continuity and performance review.' },
        { q: 'A caller is upset. Which action is appropriate?', options: ['Argue about fault', 'Speak faster', 'Acknowledge impact and ask focused questions'], correct: 2, explanation: 'Acknowledgement and investigation help de-escalate.' }
      ]
    },
    {
      id: 'digital-writing', title: 'Email, Chat & Social Care Writing', category: 'Channel', level: 'Operational', durationMinutes: 30,
      departments: ['general-cx', 'email', 'social', 'operations'], skills: ['written-handling', 'customer-empathy'], validityDays: 365,
      lessons: [
        { title: 'Write for clarity', body: 'Lead with the answer or action. Use short paragraphs, direct language and a professional tone. Avoid internal jargon and unexplained abbreviations.' },
        { title: 'Protect public conversations', body: 'Move account-specific details to an approved private channel. Do not publish customer personal information in public replies.' },
        { title: 'Manage expectations', body: 'State what has been done, what remains and when the next update is expected. Do not claim an issue is fixed before checking.' }
      ],
      quiz: [
        { q: 'A public social post contains account details. What should the agent do?', options: ['Repeat the details publicly', 'Move the conversation to an approved private channel', 'Ignore the customer'], correct: 1, explanation: 'Sensitive account details must not be exposed in public.' },
        { q: 'What improves a written response?', options: ['Dense jargon', 'Unverified claims', 'Clear answer, action and next update'], correct: 2, explanation: 'A good response is readable and sets an accurate expectation.' },
        { q: 'When can an agent say an issue is fixed?', options: ['After the resolution has been checked', 'When a customer asks', 'Before opening the case'], correct: 0, explanation: 'Do not state an outcome that has not been verified.' }
      ]
    },
    {
      id: 'complaint-recovery', title: 'Complaint Recovery & Escalation', category: 'Specialist', level: 'Operational', durationMinutes: 40,
      departments: ['all'], skills: ['complaints', 'resolution'], validityDays: 365,
      lessons: [
        { title: 'Understand the impact', body: 'Listen without defensiveness. Establish what failed, the impact on the customer and what outcome would reasonably address the issue.' },
        { title: 'Use escalation thresholds', body: 'Recognise safety, vulnerability, legal, fraud, repeated failure and authority-limit triggers. Escalate through the defined route without abandoning the customer.' },
        { title: 'Track the commitment', body: 'Record the owner, priority, due time and customer update plan. Escalation is a transfer of specialist action, not a transfer of responsibility for communication.' }
      ],
      quiz: [
        { q: 'What should accompany an escalation?', options: ['No notes', 'A clear issue summary, trigger, owner and follow-up plan', 'A promise of immediate compensation'], correct: 1, explanation: 'Escalations need evidence and accountable next steps.' },
        { q: 'Which situation may require urgent specialist escalation?', options: ['A routine balance question', 'A request for opening hours', 'A potential fraud or safety concern'], correct: 2, explanation: 'Potential harm or fraud triggers require the approved urgent route.' },
        { q: 'Who owns customer updates after an escalation?', options: ['The originating agent or assigned case owner under the workflow', 'Nobody', 'Only the customer'], correct: 0, explanation: 'Escalation does not remove communication ownership.' }
      ]
    },
    {
      id: 'qa-calibration', title: 'Quality Assurance & Calibration', category: 'Specialist', level: 'Specialist', durationMinutes: 40,
      departments: ['quality', 'training', 'operations'], skills: ['quality-review', 'coaching'], validityDays: 365,
      lessons: [
        { title: 'Evaluate observable behaviour', body: 'Score against the defined criterion and interaction evidence. Do not infer intent or penalise an agent for factors outside their control.' },
        { title: 'Separate critical controls', body: 'A critical compliance failure must be recorded explicitly and handled under policy; a high average score must not conceal it.' },
        { title: 'Calibrate consistently', body: 'Discuss the same evidence and scoring guide, document disagreement and escalate unresolved scoring differences to the calibration owner.' }
      ],
      quiz: [
        { q: 'What should a QA score be based on?', options: ['Observable interaction evidence and agreed criteria', 'Agent popularity', 'Queue length alone'], correct: 0, explanation: 'QA ratings should be evidence-based and criteria-led.' },
        { q: 'Can a high average score cancel a critical failure?', options: ['Yes', 'No, critical failures remain separately visible', 'Only for senior agents'], correct: 1, explanation: 'Critical controls must not be averaged away.' },
        { q: 'What is calibration intended to improve?', options: ['Reduce all scores', 'Reward one evaluator', 'Consistency in applying the same standard'], correct: 2, explanation: 'Calibration aligns evaluators on evidence and standards.' }
      ]
    },
    {
      id: 'wfm-operations', title: 'Workforce & Intraday Operations', category: 'Specialist', level: 'Specialist', durationMinutes: 35,
      departments: ['workforce', 'operations', 'training'], skills: ['workforce-tools', 'resolution'], validityDays: 365,
      lessons: [
        { title: 'Understand the operating plan', body: 'Use the published roster, skill coverage and channel demand forecast. Check the effective date and avoid treating forecast values as actual contact volumes.' },
        { title: 'Manage exceptions fairly', body: 'Record the reason, time window and action for adherence exceptions. Follow authorised break and schedule-change controls.' },
        { title: 'Protect service and staff', body: 'Escalate material coverage gaps early. Do not solve a queue problem by silently removing required breaks or assigning unqualified staff.' }
      ],
      quiz: [
        { q: 'A demand forecast is:', options: ['A guaranteed actual count', 'An estimate used for planning', 'A customer record'], correct: 1, explanation: 'Forecasts guide planning but differ from actual demand.' },
        { q: 'A staff member lacks the required channel skill. What should happen?', options: ['Assign anyway', 'Ignore the skill gap', 'Use qualified coverage and flag the gap'], correct: 2, explanation: 'Assignments must respect skill capability.' },
        { q: 'How should an adherence exception be handled?', options: ['Record evidence and follow authorised controls', 'Delete the roster', 'Automatically deduct pay'], correct: 0, explanation: 'Exceptions require transparent review, not unsupported penalties.' }
      ]
    },
    {
      id: 'systems-security', title: 'Systems Support & Cyber Hygiene', category: 'Specialist', level: 'Specialist', durationMinutes: 35,
      departments: ['it', 'crm', 'workforce', 'quality', 'training'], skills: ['systems-support', 'identity-verification'], validityDays: 365,
      lessons: [
        { title: 'Verify the incident', body: 'Capture the affected system, user impact, start time and error evidence. Never request or record a user password.' },
        { title: 'Use controlled access', body: 'Grant only approved access for a defined role and period. Follow identity checks and approval requirements before changing permissions.' },
        { title: 'Communicate service status', body: 'Provide a known-impact summary, workaround if approved, owner and next update. Do not speculate about root cause before evidence is available.' }
      ],
      quiz: [
        { q: 'Should support staff ask users to send their passwords?', options: ['Yes, in a secure chat', 'No, passwords must not be requested', 'Only when urgent'], correct: 1, explanation: 'Passwords are secrets and must not be collected by support staff.' },
        { q: 'What does least-privilege access mean?', options: ['Everyone gets admin', 'Access never expires', 'Only the approved access needed for the role is granted'], correct: 2, explanation: 'Access should be limited to approved business need.' },
        { q: 'What should an incident update include?', options: ['Known impact, owner and next update', 'An unverified root cause', 'Personal opinions'], correct: 0, explanation: 'Updates should separate known facts from investigation.' }
      ]
    },
    {
      id: 'team-coaching', title: 'Team Coaching & Performance Conversations', category: 'Leadership', level: 'Leadership', durationMinutes: 40,
      departments: ['training', 'quality', 'operations'], skills: ['coaching', 'customer-empathy'], validityDays: 365,
      lessons: [
        { title: 'Prepare with evidence', body: 'Review the agreed KPI period, relevant QA samples and employee context. Discuss patterns rather than one isolated event.' },
        { title: 'Agree a practical action', body: 'Define one or two observable behaviours, support required, owner and review date. Invite the employee to identify barriers and solutions.' },
        { title: 'Follow through', body: 'Review the evidence at the agreed date, record progress fairly and adjust the plan where circumstances change.' }
      ],
      quiz: [
        { q: 'What makes a coaching plan useful?', options: ['A general warning', 'Observable action, support, owner and review date', 'No follow-up'], correct: 1, explanation: 'A plan must define the behaviour and how progress is reviewed.' },
        { q: 'What evidence should inform a conversation?', options: ['Rumour', 'A single unexplained impression', 'Relevant KPI and interaction evidence with context'], correct: 2, explanation: 'Coaching should be evidence-based and contextual.' },
        { q: 'What should happen at the review date?', options: ['Check progress and agree next action', 'Automatically close regardless', 'Delete the record'], correct: 0, explanation: 'Follow-through makes coaching meaningful.' }
      ]
    },
    {
      id: 'knowledge-management', title: 'Knowledge Base & Service Updates', category: 'Specialist', level: 'Operational', durationMinutes: 30,
      departments: ['training', 'quality', 'it', 'crm', 'general-cx', 'voice', 'email', 'social'], skills: ['knowledge-writing', 'crm-logging'], validityDays: 365,
      lessons: [
        { title: 'Write usable guidance', body: 'Use a clear title, purpose, applicability, steps, exceptions, escalation route, owner and review date. Write for the employee performing the task.' },
        { title: 'Control published changes', body: 'Draft, review, approve and publish through the assigned owner. Mark superseded guidance clearly and retain a revision history.' },
        { title: 'Brief affected teams', body: 'Identify who is affected, what changed, when it takes effect and what action employees must take. Record briefing attendance.' }
      ],
      quiz: [
        { q: 'What should a service article include?', options: ['Only a title', 'Steps, exceptions, owner and review date', 'Unverified personal advice'], correct: 1, explanation: 'Structured guidance supports safe and consistent work.' },
        { q: 'Who may publish a controlled policy change?', options: ['Any employee without review', 'A customer', 'The authorised content owner after required review'], correct: 2, explanation: 'Published guidance needs controlled ownership and approval.' },
        { q: 'How should an effective change be communicated?', options: ['State the change, effective time and required employee action', 'Assume everyone has seen it', 'Only update a hidden file'], correct: 0, explanation: 'Affected teams need an explicit operational briefing.' }
      ]
    }
  ]);

  const SEED_EMPLOYEES = Object.freeze([
    ['ag-104', 'Amina Yusuf', 'general-cx', 'Customer Service Agent', 'Maryam Bello', 'Active'],
    ['ag-108', 'Daniel Okafor', 'sales', 'Customer Service Agent', 'Maryam Bello', 'Probation'],
    ['ag-112', 'Chiamaka Nwosu', 'voice', 'Senior Customer Service Agent', 'Samuel Garba', 'Active'],
    ['ag-119', 'Ibrahim Musa', 'operations', 'Customer Service Agent', 'Samuel Garba', 'Active'],
    ['ag-123', 'Fatima Abdullahi', 'email', 'Customer Service Agent', 'Maryam Bello', 'Active'],
    ['ag-127', 'Yusuf Sani', 'social', 'Senior Customer Service Agent', 'Samuel Garba', 'Active'],
    ['ag-131', 'Ngozi Eze', 'quality', 'Senior Customer Service Agent', 'Maryam Bello', 'Active'],
    ['ag-136', 'Musa Bello', 'workforce', 'Customer Service Agent', 'Samuel Garba', 'Active'],
    ['ag-140', 'Maryam Bello', 'it', 'Supervisor', 'Head of Operations', 'Active'],
    ['ag-144', 'Samuel Garba', 'training', 'Team Lead', 'Head of Operations', 'Active']
  ]);

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function cleanText(value, max = 240) { return String(value == null ? '' : value).trim().slice(0, max); }
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function dateString(value) {
    if (validDate(value)) return value;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  function makeId(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
  function courseById(id) { return COURSES.find((course) => course.id === id) || null; }
  function skillById(id) { return SKILLS.find((skill) => skill.id === id) || null; }
  function employeeById(state, id) { return (state.employees || []).find((employee) => employee.id === id) || null; }
  function activeEmployee(employee) { return employee && ['Active', 'Probation'].includes(employee.status); }
  function normaliseEmployee(profile) {
    return {
      id: cleanText(profile.id, 40), name: cleanText(profile.name, 120), department: cleanText(profile.department, 40),
      jobTitle: cleanText(profile.jobTitle || profile.role || 'Customer Service Agent', 100),
      supervisor: cleanText(profile.supervisor || 'Unassigned', 100), status: cleanText(profile.status || 'Active', 30)
    };
  }

  function createInitialState(date, peopleState) {
    const asOfDate = dateString(date);
    let employees = SEED_EMPLOYEES.map((row) => ({ id: row[0], name: row[1], department: row[2], jobTitle: row[3], supervisor: row[4], status: row[5] }));
    if (peopleState && Array.isArray(peopleState.profiles) && peopleState.profiles.length) {
      employees = peopleState.profiles.map(normaliseEmployee).filter((item) => item.id && item.name);
    }
    return {
      version: VERSION, asOfDate, employees, learning: [], competencyAssessments: [], sessions: [], sessionAttendance: [],
      activity: [{ id: 'la-act-1', date: asOfDate, text: 'Learning & Competency Academy initialised.' }],
      integration: { lastImportAt: null, imported: 0, source: 'People Operations v5.0', mode: 'Manual one-way snapshot' }
    };
  }

  function addActivity(state, text, date) {
    state.activity.unshift({ id: makeId('la-act'), date: dateString(date || state.asOfDate), text: cleanText(text, 300) });
    state.activity = state.activity.slice(0, 80);
  }

  function importPeopleSnapshot(state, peopleState, date) {
    if (!peopleState || !Array.isArray(peopleState.profiles)) throw new Error('People Operations v5.0 employee snapshot was not found.');
    const imported = peopleState.profiles.map(normaliseEmployee).filter((item) => item.id && item.name);
    if (!imported.length) throw new Error('The People Operations snapshot contains no valid employee records.');
    const existing = new Map(state.employees.map((item) => [item.id, item]));
    let added = 0;
    let updated = 0;
    imported.forEach((employee) => {
      if (existing.has(employee.id)) { Object.assign(existing.get(employee.id), employee); updated += 1; }
      else { state.employees.push(employee); existing.set(employee.id, employee); added += 1; }
    });
    state.integration = { lastImportAt: dateString(date || state.asOfDate), imported: imported.length, source: 'People Operations v5.0', mode: 'Manual one-way snapshot' };
    addActivity(state, `Imported ${imported.length} employee records from People Operations v5.0 (${added} added, ${updated} refreshed).`, date);
    return { imported: imported.length, added, updated };
  }

  function assignCourse(state, input, date) {
    if (!input || !employeeById(state, input.employeeId)) throw new Error('Select a valid employee.');
    const employee = employeeById(state, input.employeeId);
    if (!activeEmployee(employee)) throw new Error('Training can only be assigned to an active or probation employee.');
    const course = courseById(input.courseId);
    if (!course) throw new Error('Select a valid course.');
    if (!course.departments.includes('all') && !course.departments.includes(employee.department)) throw new Error('This course is not mapped to the selected employee’s department.');
    if (!validDate(input.dueDate) || input.dueDate < dateString(date || state.asOfDate)) throw new Error('Enter a due date on or after the workspace date.');
    const current = state.learning.find((record) => record.employeeId === employee.id && record.courseId === course.id && ['Assigned', 'In progress'].includes(record.status));
    if (current) throw new Error('This employee already has an open assignment for the selected course.');
    const record = {
      id: makeId('learn'), employeeId: employee.id, courseId: course.id, assignedAt: dateString(date || state.asOfDate),
      dueDate: input.dueDate, assignedBy: cleanText(input.assignedBy || 'Learning Team', 100), status: 'Assigned',
      completedLessons: [], attempts: 0, latestScore: null, completedAt: null, certificationId: null
    };
    state.learning.unshift(record);
    addActivity(state, `${course.title} assigned to ${employee.name}; due ${record.dueDate}.`, date);
    return record;
  }

  function assignDepartmentCourse(state, input, date) {
    const course = courseById(input && input.courseId);
    if (!course) throw new Error('Select a valid course.');
    const department = cleanText(input.department, 40);
    if (department !== 'all' && !DEPARTMENTS.some((item) => item.id === department)) throw new Error('Select a valid department.');
    if (department === 'all' && !course.departments.includes('all')) throw new Error('This course is role-specific. Select a supported department instead of all employees.');
    if (department !== 'all' && !course.departments.includes('all') && !course.departments.includes(department)) throw new Error('This course is not mapped to the selected department.');
    const dueDate = input.dueDate;
    if (!validDate(dueDate) || dueDate < dateString(date || state.asOfDate)) throw new Error('Enter a due date on or after the workspace date.');
    const targets = state.employees.filter((employee) => activeEmployee(employee) && (department === 'all' || employee.department === department));
    const assigned = [];
    const skipped = [];
    targets.forEach((employee) => {
      const hasOpen = state.learning.some((record) => record.employeeId === employee.id && record.courseId === course.id && ['Assigned', 'In progress'].includes(record.status));
      if (hasOpen) { skipped.push(employee.id); return; }
      assigned.push(assignCourse(state, { employeeId: employee.id, courseId: course.id, dueDate, assignedBy: input.assignedBy || 'Learning Team' }, date));
    });
    return { assigned: assigned.length, skipped: skipped.length, records: assigned };
  }

  function startCourse(state, learningId, date) {
    const record = state.learning.find((item) => item.id === learningId);
    if (!record) throw new Error('Learning assignment was not found.');
    if (!['Assigned', 'In progress'].includes(record.status)) throw new Error('Only an open assignment can be started.');
    record.status = 'In progress';
    record.startedAt = record.startedAt || dateString(date || state.asOfDate);
    addActivity(state, `${employeeById(state, record.employeeId).name} started ${courseById(record.courseId).title}.`, date);
    return record;
  }

  function completeLesson(state, learningId, lessonIndex, date) {
    const record = state.learning.find((item) => item.id === learningId);
    if (!record) throw new Error('Learning assignment was not found.');
    if (!['Assigned', 'In progress'].includes(record.status)) throw new Error('Lessons can only be completed on an open assignment.');
    const course = courseById(record.courseId);
    if (!Number.isInteger(lessonIndex) || lessonIndex < 0 || lessonIndex >= course.lessons.length) throw new Error('Select a valid lesson.');
    if (!record.completedLessons.includes(lessonIndex)) record.completedLessons.push(lessonIndex);
    record.status = 'In progress';
    record.startedAt = record.startedAt || dateString(date || state.asOfDate);
    record.completedLessons.sort((a, b) => a - b);
    return { completed: record.completedLessons.length, total: course.lessons.length, record };
  }

  function submitAssessment(state, learningId, answers, date) {
    const record = state.learning.find((item) => item.id === learningId);
    if (!record) throw new Error('Learning assignment was not found.');
    if (!['Assigned', 'In progress'].includes(record.status)) throw new Error(record.status === 'Failed' ? 'Start an explicit retake before attempting this assessment again.' : 'This course is not available for assessment.');
    const course = courseById(record.courseId);
    if (record.completedLessons.length !== course.lessons.length) throw new Error('Complete every lesson before taking the assessment.');
    if (!Array.isArray(answers) || answers.length !== course.quiz.length) throw new Error('Answer every assessment question.');
    const correct = answers.reduce((sum, answer, index) => sum + (Number(answer) === course.quiz[index].correct ? 1 : 0), 0);
    const score = Math.round((correct / course.quiz.length) * 100);
    record.attempts += 1;
    record.latestScore = score;
    record.lastAttemptAt = dateString(date || state.asOfDate);
    record.status = score >= PASS_MARK ? 'Completed' : 'Failed';
    if (record.status === 'Completed') {
      record.completedAt = record.lastAttemptAt;
      const expiry = new Date(`${record.completedAt}T00:00:00Z`);
      expiry.setUTCDate(expiry.getUTCDate() + course.validityDays);
      record.certificationId = makeId('cert');
      course.skills.forEach((skillId) => state.competencyAssessments.push({
        id: makeId('comp'), employeeId: record.employeeId, skillId, rating: 'Competent',
        evidence: `Passed ${course.title} assessment (${score}%).`, assessedBy: 'Learning Assessment', assessedAt: record.completedAt,
        source: 'Course assessment'
      }));
      record.certification = { id: record.certificationId, title: course.title, issuedAt: record.completedAt, expiresAt: expiry.toISOString().slice(0, 10) };
    }
    addActivity(state, `${employeeById(state, record.employeeId).name} ${record.status.toLowerCase()} ${course.title} with ${score}% (attempt ${record.attempts}).`, date);
    return { score, correct, total: course.quiz.length, passed: score >= PASS_MARK, status: record.status, record, feedback: course.quiz.map((question, index) => ({ correct: Number(answers[index]) === question.correct, explanation: question.explanation })) };
  }

  function retakeCourse(state, learningId, date) {
    const record = state.learning.find((item) => item.id === learningId);
    if (!record || record.status !== 'Failed') throw new Error('Only a failed course can be retaken.');
    record.status = 'Assigned';
    record.completedLessons = [];
    record.startedAt = null;
    addActivity(state, `${employeeById(state, record.employeeId).name} scheduled a retake for ${courseById(record.courseId).title}.`, date);
    return record;
  }

  function assessCompetency(state, input, date) {
    if (!input || !employeeById(state, input.employeeId)) throw new Error('Select a valid employee.');
    const employee = employeeById(state, input.employeeId);
    if (!activeEmployee(employee)) throw new Error('Competency assessments require an active or probation employee.');
    const skill = skillById(input.skillId);
    if (!skill) throw new Error('Select a valid competency.');
    if (!['Competent', 'Needs support', 'Not observed'].includes(input.rating)) throw new Error('Select a valid assessment outcome.');
    const evidence = cleanText(input.evidence, 600);
    if (evidence.length < 12) throw new Error('Record at least 12 characters of observable evidence.');
    const assessedBy = cleanText(input.assessedBy, 100);
    if (assessedBy.length < 2) throw new Error('Enter the assessor name.');
    const record = {
      id: makeId('comp'), employeeId: employee.id, skillId: skill.id, rating: input.rating,
      evidence, assessedBy, assessedAt: dateString(date || state.asOfDate), source: cleanText(input.source || 'Observed assessment', 80)
    };
    state.competencyAssessments.unshift(record);
    addActivity(state, `${skill.label} assessed for ${employee.name}: ${record.rating}.`, date);
    return record;
  }

  function scheduleBriefing(state, input, date) {
    if (!input || !validDate(input.date) || input.date < dateString(date || state.asOfDate)) throw new Error('Enter a briefing date on or after the workspace date.');
    if (!BRIEFING_TIMES.includes(input.time)) throw new Error('Briefings must use the 07:30 morning or 14:00 afternoon slot.');
    const topic = cleanText(input.topic, 140);
    if (topic.length < 4) throw new Error('Enter a briefing topic.');
    const trainer = cleanText(input.trainer, 100);
    if (trainer.length < 2) throw new Error('Enter the briefing trainer or facilitator.');
    const audience = cleanText(input.audience || 'all', 40);
    if (audience !== 'all' && !DEPARTMENTS.some((item) => item.id === audience)) throw new Error('Select a valid audience.');
    if (state.sessions.some((session) => session.date === input.date && session.time === input.time && session.status !== 'Cancelled')) throw new Error('A briefing already exists for this date and time.');
    const session = {
      id: makeId('brief'), date: input.date, time: input.time, topic, trainer, audience,
      courseId: courseById(input.courseId) ? input.courseId : null, summary: cleanText(input.summary, 800), status: 'Scheduled', createdAt: dateString(date || state.asOfDate)
    };
    state.sessions.unshift(session);
    addActivity(state, `${input.time} briefing scheduled: ${topic}.`, date);
    return session;
  }

  function recordBriefingAttendance(state, input, date) {
    const session = (state.sessions || []).find((item) => item.id === input.sessionId);
    if (!session) throw new Error('Select a valid briefing.');
    const employee = employeeById(state, input.employeeId);
    if (!employee) throw new Error('Select a valid employee.');
    if (!activeEmployee(employee)) throw new Error('Only active or probation employees can be marked for briefing attendance.');
    if (session.date > dateString(date || state.asOfDate)) throw new Error('Attendance cannot be recorded before the briefing date.');
    if (session.audience !== 'all' && session.audience !== employee.department) throw new Error('This employee is outside the briefing audience.');
    if (!['Attended', 'Absent', 'Excused'].includes(input.status)) throw new Error('Select a valid attendance status.');
    const existing = state.sessionAttendance.find((item) => item.sessionId === session.id && item.employeeId === employee.id);
    if (existing) throw new Error('Attendance has already been recorded for this employee and briefing.');
    const record = { id: makeId('ba'), sessionId: session.id, employeeId: employee.id, status: input.status, note: cleanText(input.note, 240), recordedAt: dateString(date || state.asOfDate) };
    state.sessionAttendance.unshift(record);
    addActivity(state, `${employee.name} marked ${record.status.toLowerCase()} for ${session.topic}.`, date);
    return record;
  }

  function getEmployeeLearning(state, employeeId) {
    return state.learning.filter((record) => record.employeeId === employeeId).map((record) => ({
      ...record, course: courseById(record.courseId), overdue: ['Assigned', 'In progress'].includes(record.status) && record.dueDate < state.asOfDate
    }));
  }

  function getCertificationStatus(state, date) {
    const asOf = dateString(date || state.asOfDate);
    return state.learning.filter((record) => record.certification).map((record) => ({
      employee: employeeById(state, record.employeeId), course: courseById(record.courseId), certification: record.certification,
      status: record.certification.expiresAt < asOf ? 'Expired' : record.certification.expiresAt <= addDays(asOf, 30) ? 'Renewal due' : 'Valid'
    }));
  }

  function addDays(date, count) {
    const result = new Date(`${date}T00:00:00Z`);
    result.setUTCDate(result.getUTCDate() + count);
    return result.toISOString().slice(0, 10);
  }

  function getDashboard(state, date) {
    const asOf = dateString(date || state.asOfDate);
    const active = state.employees.filter(activeEmployee).length;
    const open = state.learning.filter((item) => ['Assigned', 'In progress'].includes(item.status));
    const overdue = open.filter((item) => item.dueDate < asOf).length;
    const completed = state.learning.filter((item) => item.status === 'Completed').length;
    const failed = state.learning.filter((item) => item.status === 'Failed').length;
    const certified = getCertificationStatus(state, asOf);
    const upcomingBriefings = state.sessions.filter((item) => item.date >= asOf && item.status === 'Scheduled').length;
    const completionRate = state.learning.length ? Math.round((completed / state.learning.length) * 100) : 0;
    const competentLatest = new Map();
    state.competencyAssessments.slice().sort((a, b) => `${b.assessedAt}${b.id}`.localeCompare(`${a.assessedAt}${a.id}`)).forEach((item) => {
      const key = `${item.employeeId}:${item.skillId}`;
      if (!competentLatest.has(key)) competentLatest.set(key, item.rating);
    });
    return {
      activeEmployees: active, assignments: state.learning.length, openAssignments: open.length, overdue,
      completed, failed, completionRate, certificationsValid: certified.filter((item) => item.status === 'Valid').length,
      certificationsDue: certified.filter((item) => item.status === 'Renewal due' || item.status === 'Expired').length,
      upcomingBriefings, skillsNeedingSupport: Array.from(competentLatest.values()).filter((rating) => rating === 'Needs support').length
    };
  }

  function getSkillMatrix(state, employeeId) {
    const latest = new Map();
    state.competencyAssessments.filter((item) => item.employeeId === employeeId).slice().sort((a, b) => `${b.assessedAt}${b.id}`.localeCompare(`${a.assessedAt}${a.id}`)).forEach((item) => {
      if (!latest.has(item.skillId)) latest.set(item.skillId, item);
    });
    return SKILLS.map((skill) => ({ skill, assessment: latest.get(skill.id) || null, rating: latest.has(skill.id) ? latest.get(skill.id).rating : 'Not assessed' }));
  }

  function exportCsv(rows, columns) {
    const quote = (value) => `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
    return [columns.map((column) => quote(column.label)).join(','), ...rows.map((row) => columns.map((column) => quote(row[column.key])).join(','))].join('\r\n');
  }

  function createStore(storage) {
    const target = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    return {
      load(date) {
        if (!target) return createInitialState(date);
        try {
          const parsed = JSON.parse(target.getItem(STORAGE_KEY) || 'null');
          if (parsed && parsed.version === VERSION && Array.isArray(parsed.employees) && Array.isArray(parsed.learning)) return parsed;
        } catch (_) { /* corrupt demo storage is reset below */ }
        let peopleState = null;
        try { peopleState = JSON.parse(target.getItem(PEOPLE_KEY) || 'null'); } catch (_) { peopleState = null; }
        const state = createInitialState(date, peopleState);
        this.save(state);
        return state;
      },
      save(state) {
        if (!target) return false;
        try { target.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch (_) { return false; }
      }
    };
  }

  return {
    VERSION, STORAGE_KEY, PEOPLE_KEY, PASS_MARK, BRIEFING_TIMES, DEPARTMENTS, SKILLS, COURSES,
    createInitialState, importPeopleSnapshot, assignCourse, assignDepartmentCourse, startCourse, completeLesson,
    submitAssessment, retakeCourse, assessCompetency, scheduleBriefing, recordBriefingAttendance,
    getEmployeeLearning, getCertificationStatus, getDashboard, getSkillMatrix, exportCsv, createStore,
    validDate, dateString, courseById, employeeById
  };
});
