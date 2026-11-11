(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CalloriaPeopleOperations = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 50;
  const STORAGE_KEY = 'calloria.people-operations.v50';
  const PERFORMANCE_KEY = 'calloria.performance-career.v49';
  const DEPARTMENTS = Object.freeze([
    { id: 'general-cx', name: 'General Customer Experience' }, { id: 'voice', name: 'Voice Operations' },
    { id: 'email', name: 'Email Operations' }, { id: 'social', name: 'Social Media Care' },
    { id: 'it', name: 'IT & Systems Support' }, { id: 'quality', name: 'Quality Assurance' },
    { id: 'workforce', name: 'Workforce Management' }, { id: 'crm', name: 'CRM & Customer Data' },
    { id: 'training', name: 'Training & Knowledge' }, { id: 'operations', name: 'Operations & Escalations' },
    { id: 'sales', name: 'Sales & Retention' }
  ]);
  const LEAVE_TYPES = Object.freeze([
    { id: 'annual', label: 'Annual leave', balanceKey: 'annual' },
    { id: 'casual', label: 'Personal / casual leave', balanceKey: 'casual' },
    { id: 'sick', label: 'Sick leave', balanceKey: 'sick' },
    { id: 'parental', label: 'Parental leave', balanceKey: 'parental' },
    { id: 'unpaid', label: 'Unpaid leave', balanceKey: null }
  ]);
  const CASE_TYPES = Object.freeze(['Coaching note', 'Recognition', 'Grievance', 'Conduct review', 'Attendance review', 'Workplace concern']);
  const EMPLOYMENT_STATUSES = Object.freeze(['Probation', 'Active', 'On leave', 'Notice period', 'Exited']);
  const CONTRACT_TYPES = Object.freeze(['Permanent', 'Fixed-term', 'Temporary', 'Part-time', 'Internship']);
  const OFFBOARDING_ITEMS = Object.freeze([
    { id: 'equipment', label: 'Company equipment returned' },
    { id: 'access', label: 'System access removal requested' },
    { id: 'handover', label: 'Customer and team handover completed' },
    { id: 'payroll', label: 'Final payroll hand-off sent to authorised payroll team' },
    { id: 'exitInterview', label: 'Exit interview recorded or declined' }
  ]);

  const seedProfiles = [
    ['ag-104', 'Amina Yusuf', 'amina.yusuf@calloria.example', 'general-cx', 'Customer Service Agent', 'Maryam Bello', '2024-08-12', 'Permanent', 'Active'],
    ['ag-108', 'Daniel Okafor', 'daniel.okafor@calloria.example', 'sales', 'Customer Service Agent', 'Maryam Bello', '2025-07-01', 'Permanent', 'Active'],
    ['ag-112', 'Chiamaka Nwosu', 'chiamaka.nwosu@calloria.example', 'voice', 'Senior Customer Service Agent', 'Samuel Garba', '2022-05-09', 'Permanent', 'Active'],
    ['ag-119', 'Ibrahim Musa', 'ibrahim.musa@calloria.example', 'operations', 'Customer Service Agent', 'Samuel Garba', '2023-02-13', 'Fixed-term', 'Active'],
    ['ag-123', 'Fatima Abdullahi', 'fatima.abdullahi@calloria.example', 'email', 'Customer Service Agent', 'Maryam Bello', '2024-04-15', 'Permanent', 'Active'],
    ['ag-127', 'Yusuf Sani', 'yusuf.sani@calloria.example', 'social', 'Senior Customer Service Agent', 'Samuel Garba', '2021-10-04', 'Permanent', 'Active'],
    ['ag-131', 'Ngozi Eze', 'ngozi.eze@calloria.example', 'quality', 'Senior Customer Service Agent', 'Maryam Bello', '2022-08-22', 'Permanent', 'Active'],
    ['ag-136', 'Musa Bello', 'musa.bello@calloria.example', 'workforce', 'Customer Service Agent', 'Samuel Garba', '2024-01-08', 'Permanent', 'Active'],
    ['ag-140', 'Maryam Bello', 'maryam.bello@calloria.example', 'it', 'Supervisor', 'Head of Operations', '2020-06-01', 'Permanent', 'Active'],
    ['ag-144', 'Samuel Garba', 'samuel.garba@calloria.example', 'training', 'Team Lead', 'Head of Operations', '2021-03-15', 'Permanent', 'Active']
  ];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function todayString(value) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  function isDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function createId(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
  function cleanText(value, max = 240) { return String(value == null ? '' : value).trim().slice(0, max); }
  function departmentExists(id) { return DEPARTMENTS.some((department) => department.id === id); }
  function profileById(state, id) { return (state.profiles || []).find((profile) => profile.id === id) || null; }
  function workdaysBetween(start, end) {
    if (!isDate(start) || !isDate(end) || end < start) return 0;
    let count = 0;
    const cursor = new Date(`${start}T00:00:00Z`);
    const last = new Date(`${end}T00:00:00Z`);
    while (cursor <= last) {
      const day = cursor.getUTCDay();
      if (day !== 0 && day !== 6) count += 1;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return count;
  }
  function datesOverlap(aStart, aEnd, bStart, bEnd) { return aStart <= bEnd && bStart <= aEnd; }

  function makeProfile(row) {
    return {
      id: row[0], name: row[1], email: row[2], department: row[3], jobTitle: row[4], supervisor: row[5],
      hireDate: row[6], contractType: row[7], status: row[8], workPattern: 'Full-time', location: 'CALLORIA Operations',
      probationDue: null, leaveBalances: { annual: 20, casual: 5, sick: 10, parental: 0 },
      profileNotes: '', importedFromPerformance: false, updatedAt: null
    };
  }
  function createInitialState(date) {
    const asOfDate = todayString(date);
    return {
      version: VERSION, asOfDate, profiles: seedProfiles.map((row) => { const profile = makeProfile(row); if (profile.id === 'ag-108') { profile.status = 'Probation'; profile.probationDue = '2026-12-01'; } return profile; }),
      leaveRequests: [
        { id: 'lv-5001', employeeId: 'ag-104', type: 'annual', startDate: '2026-11-16', endDate: '2026-11-18', days: 3, reason: 'Planned annual leave', status: 'Pending', requestedAt: '2026-11-05', decisionBy: null, decisionAt: null, decisionNote: '' },
        { id: 'lv-5002', employeeId: 'ag-123', type: 'casual', startDate: '2026-10-21', endDate: '2026-10-21', days: 1, reason: 'Personal appointment', status: 'Approved', requestedAt: '2026-10-10', decisionBy: 'Maryam Bello', decisionAt: '2026-10-11', decisionNote: 'Approved.' }
      ],
      attendance: [
        { id: 'at-5001', employeeId: 'ag-119', date: '2026-11-10', status: 'Late', minutes: 18, note: 'Late arrival recorded by supervisor.' },
        { id: 'at-5002', employeeId: 'ag-136', date: '2026-11-10', status: 'Present', minutes: 0, note: 'Rostered shift attended.' },
        { id: 'at-5003', employeeId: 'ag-127', date: '2026-11-09', status: 'Remote', minutes: 0, note: 'Approved remote working day.' }
      ],
      probationReviews: [
        { id: 'pb-5001', employeeId: 'ag-108', dueDate: '2026-12-01', outcome: 'Pending', reviewer: 'Maryam Bello', completedAt: null, notes: 'Review service handling, CRM accuracy and attendance before confirmation.' }
      ],
      cases: [
        { id: 'hr-5001', employeeId: 'ag-119', type: 'Coaching note', title: 'Attendance and case-quality support', status: 'Open', priority: 'Normal', openedAt: '2026-11-04', owner: 'Samuel Garba', notes: 'Agree an improvement plan and review evidence at the next check-in.', outcome: '' },
        { id: 'hr-5002', employeeId: 'ag-112', type: 'Recognition', title: 'Complex complaint recovery', status: 'Closed', priority: 'Low', openedAt: '2026-10-28', owner: 'Maryam Bello', notes: 'Customer recovery feedback and peer support recognised.', outcome: 'Recognition shared with team.' }
      ],
      transfers: [], offboarding: [],
      activity: [
        { id: 'act-5001', date: asOfDate, text: 'People Operations workspace opened.' },
        { id: 'act-5002', date: '2026-11-05', text: 'Annual leave request submitted for ag-104.' },
        { id: 'act-5003', date: '2026-11-04', text: 'Attendance support case opened for ag-119.' }
      ],
      integration: { lastImportAt: null, imported: 0, source: 'Performance & Career v4.9', mode: 'Manual snapshot import' }
    };
  }
  function addActivity(state, text, date) {
    state.activity.unshift({ id: createId('act'), date: todayString(date || state.asOfDate), text: cleanText(text, 300) });
    state.activity = state.activity.slice(0, 60);
  }
  function saveProfile(state, input) {
    if (!input) throw new Error('Employee details are required.');
    const id = cleanText(input.id, 40);
    const name = cleanText(input.name, 120);
    if (!/^[a-z0-9][a-z0-9_-]{1,39}$/i.test(id)) throw new Error('Staff ID must be 2–40 letters, numbers, hyphens or underscores.');
    if (name.length < 2) throw new Error('Enter the employee full name.');
    if (!departmentExists(input.department)) throw new Error('Select a valid department.');
    if (!cleanText(input.jobTitle, 100) || !cleanText(input.supervisor, 100)) throw new Error('Job title and reporting supervisor are required.');
    if (!isDate(input.hireDate)) throw new Error('Enter a valid hire date.');
    if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input.email))) throw new Error('Enter a valid work email address.');
    if (!CONTRACT_TYPES.includes(input.contractType)) throw new Error('Select a valid contract type.');
    if (!EMPLOYMENT_STATUSES.includes(input.status)) throw new Error('Select a valid employment status.');
    const balances = {};
    ['annual', 'casual', 'sick', 'parental'].forEach((key) => {
      const value = Number(input.leaveBalances && input.leaveBalances[key]);
      if (!Number.isInteger(value) || value < 0 || value > 365) throw new Error(`Invalid ${key} leave entitlement.`);
      balances[key] = value;
    });
    const existing = profileById(state, id);
    if (!existing && state.profiles.some((item) => item.id.toLowerCase() === id.toLowerCase())) throw new Error('A staff record with this ID already exists.');
    const email = cleanText(input.email, 160).toLowerCase();
    if (email && state.profiles.some((item) => item.id !== id && String(item.email || '').toLowerCase() === email)) throw new Error('This work email is already assigned to another employee.');
    if (input.status === 'Probation' && (!isDate(input.probationDue) || input.probationDue < todayString(input.updatedAt || state.asOfDate))) throw new Error('A probation employee needs a review date on or after the current workspace date.');
    if (existing) {
      Object.assign(existing, {
        name, email: cleanText(input.email, 160), department: input.department, jobTitle: cleanText(input.jobTitle, 100),
        supervisor: cleanText(input.supervisor, 100), hireDate: input.hireDate, contractType: input.contractType,
        workPattern: cleanText(input.workPattern, 40) || 'Full-time', status: input.status, leaveBalances: balances,
        profileNotes: cleanText(input.profileNotes, 500), probationDue: input.status === 'Probation' ? input.probationDue : null, updatedAt: todayString(input.updatedAt || state.asOfDate)
      });
      addActivity(state, `Employee record updated for ${name}.`);
      return existing;
    }
    const record = {
      id, name, email: cleanText(input.email, 160), department: input.department, jobTitle: cleanText(input.jobTitle, 100),
      supervisor: cleanText(input.supervisor, 100), hireDate: input.hireDate, contractType: input.contractType,
      workPattern: cleanText(input.workPattern, 40) || 'Full-time', location: 'CALLORIA Operations', status: input.status,
      probationDue: input.status === 'Probation' ? input.probationDue : null,
      leaveBalances: balances, profileNotes: cleanText(input.profileNotes, 500), importedFromPerformance: false,
      updatedAt: todayString(input.updatedAt || state.asOfDate)
    };
    state.profiles.unshift(record);
    addActivity(state, `Employee record created for ${name}.`);
    return record;
  }

  function getLeaveBalance(state, employeeId, type) {
    const profile = profileById(state, employeeId);
    const leaveType = LEAVE_TYPES.find((item) => item.id === type);
    if (!profile || !leaveType || !leaveType.balanceKey) return null;
    const allowance = Number(profile.leaveBalances && profile.leaveBalances[leaveType.balanceKey]) || 0;
    const used = state.leaveRequests.filter((item) => item.employeeId === employeeId && item.type === type && item.status === 'Approved')
      .reduce((sum, item) => sum + Number(item.days || 0), 0);
    const reserved = state.leaveRequests.filter((item) => item.employeeId === employeeId && item.type === type && item.status === 'Pending')
      .reduce((sum, item) => sum + Number(item.days || 0), 0);
    return { allowance, used, reserved, available: Math.max(0, allowance - used - reserved) };
  }
  function createLeaveRequest(state, input) {
    if (!input || !profileById(state, input.employeeId)) throw new Error('Select a valid employee.');
    const profile = profileById(state, input.employeeId);
    if (profile.status !== 'Active') throw new Error('Leave requests can only be created for active employees.');
    const type = LEAVE_TYPES.find((item) => item.id === input.type);
    if (!type) throw new Error('Select a valid leave type.');
    const startDate = String(input.startDate || '');
    const endDate = String(input.endDate || '');
    if (!isDate(startDate) || !isDate(endDate) || endDate < startDate) throw new Error('Enter a valid leave date range.');
    const days = workdaysBetween(startDate, endDate);
    if (days < 1) throw new Error('The selected period contains no working days.');
    const conflicts = state.leaveRequests.filter((item) => item.employeeId === input.employeeId && ['Pending', 'Approved'].includes(item.status) && datesOverlap(startDate, endDate, item.startDate, item.endDate));
    if (conflicts.length) throw new Error('This employee already has a pending or approved request covering these dates.');
    if (type.balanceKey) {
      const balance = getLeaveBalance(state, input.employeeId, input.type);
      if (days > balance.available) throw new Error(`Insufficient ${type.label.toLowerCase()} balance. Available: ${balance.available} day(s).`);
    }
    const request = {
      id: input.id || createId('lv'), employeeId: input.employeeId, type: input.type, startDate, endDate, days,
      reason: cleanText(input.reason, 180) || 'No reason supplied', status: 'Pending', requestedAt: todayString(input.requestedAt || state.asOfDate),
      decisionBy: null, decisionAt: null, decisionNote: ''
    };
    state.leaveRequests.unshift(request);
    addActivity(state, `Leave request ${request.id} submitted for ${profile.name}.`, request.requestedAt);
    return request;
  }
  function decideLeaveRequest(state, requestId, decision, actor, note, date) {
    const request = state.leaveRequests.find((item) => item.id === requestId);
    if (!request) throw new Error('Leave request not found.');
    if (request.status !== 'Pending') throw new Error('Only pending leave requests can be decided.');
    if (!['Approved', 'Rejected'].includes(decision)) throw new Error('Decision must be Approved or Rejected.');
    if (decision === 'Approved') {
      const leaveType = LEAVE_TYPES.find((item) => item.id === request.type);
      if (leaveType && leaveType.balanceKey) {
        const profile = profileById(state, request.employeeId);
        const allowance = Number(profile && profile.leaveBalances && profile.leaveBalances[leaveType.balanceKey]) || 0;
        const committed = state.leaveRequests.filter((item) => item.id !== request.id && item.employeeId === request.employeeId && item.type === request.type && ['Pending', 'Approved'].includes(item.status)).reduce((sum, item) => sum + Number(item.days || 0), 0);
        if (request.days > Math.max(0, allowance - committed)) throw new Error('Leave balance changed; review the request before approval.');
      }
      const conflict = state.leaveRequests.some((item) => item.id !== request.id && item.employeeId === request.employeeId && item.status === 'Approved' && datesOverlap(request.startDate, request.endDate, item.startDate, item.endDate));
      if (conflict) throw new Error('An approved leave request now conflicts with these dates.');
    }
    request.status = decision;
    request.decisionBy = cleanText(actor, 100) || 'People Operations';
    request.decisionAt = todayString(date || state.asOfDate);
    request.decisionNote = cleanText(note, 300);
    addActivity(state, `Leave request ${request.id} ${decision.toLowerCase()}.`, request.decisionAt);
    return request;
  }
  function recordAttendance(state, input) {
    if (!input || !profileById(state, input.employeeId)) throw new Error('Select a valid employee.');
    if (!isDate(input.date)) throw new Error('Enter a valid attendance date.');
    const statuses = ['Present', 'Late', 'Absent', 'Early departure', 'Remote', 'Approved leave'];
    if (!statuses.includes(input.status)) throw new Error('Select a valid attendance status.');
    if (state.attendance.some((item) => item.employeeId === input.employeeId && item.date === input.date)) throw new Error('An attendance record already exists for this employee and date.');
    const minutes = Number(input.minutes || 0);
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) throw new Error('Minutes must be between 0 and 1440.');
    const record = { id: input.id || createId('at'), employeeId: input.employeeId, date: input.date, status: input.status, minutes: input.status === 'Late' || input.status === 'Early departure' ? minutes : 0, note: cleanText(input.note, 260) };
    state.attendance.unshift(record);
    addActivity(state, `Attendance recorded for ${profileById(state, input.employeeId).name}: ${record.status}.`, input.date);
    return record;
  }
  function completeProbationReview(state, input) {
    if (!input || !profileById(state, input.employeeId)) throw new Error('Select a valid employee.');
    const profile = profileById(state, input.employeeId);
    if (profile.status !== 'Probation') throw new Error('Only employees on probation can receive a probation decision.');
    if (!['Confirm', 'Extend', 'End employment'].includes(input.outcome)) throw new Error('Select a valid probation outcome.');
    const notes = cleanText(input.notes, 800);
    if (notes.length < 12) throw new Error('Add a meaningful evidence summary before recording the decision.');
    const date = todayString(input.completedAt || state.asOfDate);
    if (!isDate(date)) throw new Error('Enter a valid decision date.');
    if (input.outcome === 'Extend' && (!isDate(input.newDueDate) || input.newDueDate <= date)) throw new Error('An extension requires a future review date.');
    const review = { id: input.id || createId('pb'), employeeId: input.employeeId, dueDate: input.dueDate || profile.probationDue || date, outcome: input.outcome, reviewer: cleanText(input.reviewer, 100) || 'People Operations', completedAt: date, notes };
    state.probationReviews.unshift(review);
    if (input.outcome === 'Confirm') { profile.status = 'Active'; profile.probationDue = null; }
    if (input.outcome === 'Extend') profile.probationDue = input.newDueDate;
    if (input.outcome === 'End employment') profile.status = 'Notice period';
    profile.updatedAt = date;
    addActivity(state, `Probation outcome ${input.outcome.toLowerCase()} recorded for ${profile.name}.`, date);
    return review;
  }
  function createCase(state, input) {
    if (!input || !profileById(state, input.employeeId)) throw new Error('Select a valid employee.');
    if (!CASE_TYPES.includes(input.type)) throw new Error('Select a valid people case type.');
    const title = cleanText(input.title, 120);
    if (title.length < 4) throw new Error('Case title must contain at least four characters.');
    const notes = cleanText(input.notes, 1000);
    if (notes.length < 10) throw new Error('Record objective context or evidence before opening a case.');
    const record = { id: input.id || createId('hr'), employeeId: input.employeeId, type: input.type, title, status: 'Open', priority: ['Low', 'Normal', 'High'].includes(input.priority) ? input.priority : 'Normal', openedAt: todayString(input.openedAt || state.asOfDate), owner: cleanText(input.owner, 100) || 'People Operations', notes, outcome: '' };
    state.cases.unshift(record);
    addActivity(state, `${record.type} opened for ${profileById(state, input.employeeId).name}.`, record.openedAt);
    return record;
  }
  function updateCase(state, caseId, input) {
    const record = state.cases.find((item) => item.id === caseId);
    if (!record) throw new Error('People case not found.');
    if (!['Open', 'Under review', 'Closed'].includes(input.status)) throw new Error('Select a valid case status.');
    const outcome = cleanText(input.outcome, 1000);
    if (input.status === 'Closed' && outcome.length < 8) throw new Error('A closure outcome is required.');
    record.status = input.status;
    record.owner = cleanText(input.owner, 100) || record.owner;
    if (outcome) record.outcome = outcome;
    record.updatedAt = todayString(input.updatedAt || state.asOfDate);
    addActivity(state, `People case ${record.id} moved to ${record.status.toLowerCase()}.`, record.updatedAt);
    return record;
  }
  function proposeTransfer(state, input) {
    if (!input || !profileById(state, input.employeeId)) throw new Error('Select a valid employee.');
    const profile = profileById(state, input.employeeId);
    if (profile.status !== 'Active') throw new Error('Only active employees can be transferred.');
    if (!departmentExists(input.toDepartment)) throw new Error('Select a valid destination department.');
    if (input.toDepartment === profile.department) throw new Error('Choose a different destination department.');
    if (state.transfers.some((item) => item.employeeId === input.employeeId && ['Pending', 'Approved'].includes(item.status))) throw new Error('This employee already has an unresolved transfer proposal.');
    if (!isDate(input.effectiveDate) || input.effectiveDate < state.asOfDate) throw new Error('The transfer date must be today or later.');
    const transfer = { id: input.id || createId('tr'), employeeId: input.employeeId, fromDepartment: profile.department, toDepartment: input.toDepartment, fromTitle: profile.jobTitle, toTitle: cleanText(input.toTitle, 100) || profile.jobTitle, newSupervisor: cleanText(input.newSupervisor, 100) || profile.supervisor, effectiveDate: input.effectiveDate, reason: cleanText(input.reason, 400), status: 'Pending', proposedBy: cleanText(input.proposedBy, 100) || 'People Operations', approvedBy: null };
    state.transfers.unshift(transfer);
    addActivity(state, `Internal transfer proposed for ${profile.name}.`, state.asOfDate);
    return transfer;
  }
  function decideTransfer(state, transferId, decision, actor) {
    const transfer = state.transfers.find((item) => item.id === transferId);
    if (!transfer) throw new Error('Transfer proposal not found.');
    if (transfer.status !== 'Pending') throw new Error('Only pending transfer proposals can be decided.');
    if (!['Approved', 'Rejected'].includes(decision)) throw new Error('Decision must be Approved or Rejected.');
    const profile = profileById(state, transfer.employeeId);
    if (!profile) throw new Error('Employee profile no longer exists.');
    if (decision === 'Approved' && profile.status !== 'Active') throw new Error('Only active employees can receive an approved transfer.');
    transfer.status = decision;
    transfer.approvedBy = cleanText(actor, 100) || 'People Operations';
    transfer.decidedAt = state.asOfDate;
    if (decision === 'Approved' && transfer.effectiveDate <= state.asOfDate) {
      profile.department = transfer.toDepartment;
      profile.jobTitle = transfer.toTitle;
      profile.supervisor = transfer.newSupervisor;
      profile.updatedAt = state.asOfDate;
      transfer.status = 'Completed';
    }
    addActivity(state, `Transfer proposal ${transfer.id} ${decision.toLowerCase()}.`, state.asOfDate);
    return transfer;
  }
  function applyEffectiveTransfers(state) {
    let changed = 0;
    state.transfers.filter((item) => item.status === 'Approved' && item.effectiveDate <= state.asOfDate).forEach((transfer) => {
      const profile = profileById(state, transfer.employeeId);
      if (profile && profile.status === 'Active' && profile.department === transfer.fromDepartment) {
        profile.department = transfer.toDepartment;
        profile.jobTitle = transfer.toTitle;
        profile.supervisor = transfer.newSupervisor;
        profile.updatedAt = state.asOfDate;
        transfer.status = 'Completed';
        changed += 1;
        addActivity(state, `Internal transfer became effective for ${profile.name}.`, state.asOfDate);
      } else {
        transfer.status = 'On hold';
        changed += 1;
      }
    });
    return changed;
  }
  function startOffboarding(state, input) {
    if (!input || !profileById(state, input.employeeId)) throw new Error('Select a valid employee.');
    const profile = profileById(state, input.employeeId);
    if (profile.status === 'Exited') throw new Error('Employee is already marked as exited.');
    if (!isDate(input.lastWorkingDate) || input.lastWorkingDate < state.asOfDate) throw new Error('Last working date must be today or later.');
    let record = state.offboarding.find((item) => item.employeeId === input.employeeId && item.status !== 'Completed');
    if (record) throw new Error('An offboarding process is already open for this employee.');
    record = { id: input.id || createId('off'), employeeId: input.employeeId, reason: cleanText(input.reason, 180), lastWorkingDate: input.lastWorkingDate, status: 'In progress', checklist: Object.fromEntries(OFFBOARDING_ITEMS.map((item) => [item.id, false])), startedAt: state.asOfDate, completedAt: null };
    state.offboarding.unshift(record);
    profile.status = 'Notice period';
    profile.updatedAt = state.asOfDate;
    addActivity(state, `Offboarding started for ${profile.name}.`, state.asOfDate);
    return record;
  }
  function updateOffboardingItem(state, offboardingId, itemId, complete) {
    const record = state.offboarding.find((item) => item.id === offboardingId);
    if (!record) throw new Error('Offboarding record not found.');
    if (record.status === 'Completed') throw new Error('Completed offboarding records are locked.');
    if (!OFFBOARDING_ITEMS.some((item) => item.id === itemId)) throw new Error('Unknown offboarding checklist item.');
    record.checklist[itemId] = Boolean(complete);
    return record;
  }
  function completeOffboarding(state, offboardingId) {
    const record = state.offboarding.find((item) => item.id === offboardingId);
    if (!record) throw new Error('Offboarding record not found.');
    if (record.status === 'Completed') throw new Error('Offboarding is already completed.');
    const missing = OFFBOARDING_ITEMS.filter((item) => !record.checklist[item.id]);
    if (missing.length) throw new Error(`Complete all exit controls first: ${missing.map((item) => item.label).join(', ')}.`);
    const profile = profileById(state, record.employeeId);
    if (!profile) throw new Error('Employee profile not found.');
    if (state.asOfDate < record.lastWorkingDate) throw new Error('Offboarding cannot be completed before the recorded last working date.');
    record.status = 'Completed';
    record.completedAt = state.asOfDate;
    profile.status = 'Exited';
    profile.updatedAt = state.asOfDate;
    addActivity(state, `Offboarding completed for ${profile.name}.`, state.asOfDate);
    return record;
  }
  function importPerformanceStaff(state, storage) {
    const source = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!source) return { imported: 0, updated: 0, available: false };
    let upstream;
    try { upstream = JSON.parse(source.getItem(PERFORMANCE_KEY) || 'null'); } catch (_) { upstream = null; }
    if (!upstream || upstream.version !== 49 || !Array.isArray(upstream.staff)) return { imported: 0, updated: 0, available: false };
    let imported = 0;
    let updated = 0;
    upstream.staff.forEach((staff) => {
      if (!staff || !staff.id || !cleanText(staff.name, 120) || !departmentExists(staff.department)) return;
      const existing = profileById(state, staff.id);
      if (existing) {
        existing.name = cleanText(staff.name, 120);
        existing.department = staff.department;
        existing.jobTitle = ({ associate: 'Customer Service Associate', agent: 'Customer Service Agent', senior: 'Senior Customer Service Agent', 'team-lead': 'Team Lead', supervisor: 'Supervisor', 'operations-manager': 'Operations Manager' })[staff.level] || existing.jobTitle;
        existing.supervisor = cleanText(staff.supervisor, 100) || existing.supervisor;
        existing.status = EMPLOYMENT_STATUSES.includes(staff.status) ? staff.status : existing.status;
        if (existing.status !== 'Probation') existing.probationDue = null;
        existing.importedFromPerformance = true;
        existing.updatedAt = state.asOfDate;
        updated += 1;
      } else {
        const profile = makeProfile([staff.id, cleanText(staff.name, 120), '', staff.department, ({ associate: 'Customer Service Associate', agent: 'Customer Service Agent', senior: 'Senior Customer Service Agent', 'team-lead': 'Team Lead', supervisor: 'Supervisor', 'operations-manager': 'Operations Manager' })[staff.level] || 'Customer Service Associate', cleanText(staff.supervisor, 100) || 'Unassigned', state.asOfDate, 'Permanent', 'Active']);
        profile.importedFromPerformance = true;
        state.profiles.push(profile);
        imported += 1;
      }
    });
    state.integration = { lastImportAt: new Date().toISOString(), imported, updated, source: 'Performance & Career v4.9', mode: 'Manual snapshot import' };
    addActivity(state, `Performance & Career snapshot imported: ${imported} new, ${updated} refreshed.`);
    return { imported, updated, available: true };
  }
  function dashboard(state) {
    const active = state.profiles.filter((item) => item.status === 'Active').length;
    const probation = state.profiles.filter((item) => item.status === 'Probation').length;
    const pendingLeave = state.leaveRequests.filter((item) => item.status === 'Pending').length;
    const openCases = state.cases.filter((item) => item.status !== 'Closed').length;
    const pendingTransfers = state.transfers.filter((item) => item.status === 'Pending').length;
    const notice = state.profiles.filter((item) => item.status === 'Notice period').length;
    const overdueProbation = state.profiles.filter((profile) => profile.status === 'Probation' && profile.probationDue && profile.probationDue < state.asOfDate).length;
    return { headcount: state.profiles.length, active, probation, pendingLeave, openCases, pendingTransfers, notice, overdueProbation };
  }
  function loadState(storage) {
    const source = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!source) return createInitialState();
    try {
      const parsed = JSON.parse(source.getItem(STORAGE_KEY) || 'null');
      if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.profiles)) return createInitialState();
      const base = createInitialState(parsed.asOfDate);
      return {
        ...base, ...parsed,
        profiles: parsed.profiles,
        leaveRequests: Array.isArray(parsed.leaveRequests) ? parsed.leaveRequests : [],
        attendance: Array.isArray(parsed.attendance) ? parsed.attendance : [],
        probationReviews: Array.isArray(parsed.probationReviews) ? parsed.probationReviews : [],
        cases: Array.isArray(parsed.cases) ? parsed.cases : [],
        transfers: Array.isArray(parsed.transfers) ? parsed.transfers : [],
        offboarding: Array.isArray(parsed.offboarding) ? parsed.offboarding : [],
        activity: Array.isArray(parsed.activity) ? parsed.activity : [],
        integration: parsed.integration || base.integration
      };
    } catch (_) { return createInitialState(); }
  }
  function saveState(state, storage) {
    const target = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!target) return false;
    try { target.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch (_) { return false; }
  }
  function exportCsv(rows, columns) {
    const escape = (value) => `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
    return [columns.map((column) => escape(column.label)).join(','), ...rows.map((row) => columns.map((column) => escape(row[column.key])).join(','))].join('\r\n');
  }

  return {
    VERSION, STORAGE_KEY, PERFORMANCE_KEY, DEPARTMENTS, LEAVE_TYPES, CASE_TYPES, EMPLOYMENT_STATUSES, CONTRACT_TYPES, OFFBOARDING_ITEMS,
    createInitialState, todayString, isDate, workdaysBetween, profileById, saveProfile, getLeaveBalance, createLeaveRequest, decideLeaveRequest,
    recordAttendance, completeProbationReview, createCase, updateCase, proposeTransfer, decideTransfer, applyEffectiveTransfers,
    startOffboarding, updateOffboardingItem, completeOffboarding, importPerformanceStaff, dashboard, loadState, saveState, exportCsv, addActivity
  };
});
