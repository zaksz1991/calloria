(function () {
  'use strict';
  const E = window.CalloriaPeopleOperations;
  if (!E) return;
  let state = E.loadState();
  let selectedProfileId = null;
  const $ = (id) => document.getElementById(id);
  const text = (value) => String(value == null ? '' : value);
  const esc = (value) => text(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const departmentName = (id) => (E.DEPARTMENTS.find((item) => item.id === id) || {}).name || id || '—';
  const personName = (id) => (E.profileById(state, id) || {}).name || id || 'Unknown employee';
  const dateLabel = (date) => date ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const statusClass = (status) => `status-${String(status || '').toLowerCase().replace(/[^a-z]+/g, '-')}`;
  let toastTimer;

  function notify(message, isError) {
    const toast = $('toast');
    toast.textContent = message;
    toast.className = `toast show${isError ? ' error' : ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3600);
  }
  function persist() { E.saveState(state); }
  function run(action) {
    try { const value = action(); persist(); render(); return value; }
    catch (error) { notify(error.message || 'Unable to complete this action.', true); return null; }
  }
  function options(items, selected, firstLabel) {
    const head = firstLabel ? `<option value="">${esc(firstLabel)}</option>` : '';
    return head + items.map((item) => {
      const value = typeof item === 'string' ? item : item.id;
      const label = typeof item === 'string' ? item : item.name || item.label;
      return `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`;
    }).join('');
  }
  function populateStaticSelects() {
    $('profile-department').innerHTML = options(E.DEPARTMENTS);
    $('directory-department').innerHTML = '<option value="All">All departments</option>' + options(E.DEPARTMENTS);
    $('directory-status').innerHTML = '<option value="All">All statuses</option>' + options(E.EMPLOYMENT_STATUSES);
    $('profile-contract').innerHTML = options(E.CONTRACT_TYPES);
    $('profile-status').innerHTML = options(E.EMPLOYMENT_STATUSES, 'Active');
    $('leave-type').innerHTML = options(E.LEAVE_TYPES);
    $('case-type').innerHTML = options(E.CASE_TYPES);
    $('transfer-department').innerHTML = options(E.DEPARTMENTS);
  }
  function fillEmployeeSelects() {
    const profiles = state.profiles.slice().sort((a, b) => a.name.localeCompare(b.name));
    const list = profiles.map((profile) => ({ id: profile.id, name: `${profile.name} · ${profile.id}` }));
    ['leave-employee', 'attendance-employee', 'case-employee', 'transfer-employee', 'offboarding-employee'].forEach((id) => {
      const previous = $(id).value;
      $(id).innerHTML = options(list, previous, 'Select employee');
    });
    const probation = profiles.filter((profile) => profile.status === 'Probation').map((profile) => ({ id: profile.id, name: `${profile.name} · ${profile.id}` }));
    const prev = $('probation-employee').value;
    $('probation-employee').innerHTML = options(probation, prev, 'Select probation employee');
  }
  function renderOverview() {
    const metrics = E.dashboard(state);
    $('metric-headcount').textContent = metrics.headcount;
    $('metric-active').textContent = metrics.active;
    $('metric-leave').textContent = metrics.pendingLeave;
    $('metric-cases').textContent = metrics.openCases;
    $('nav-leave-count').textContent = metrics.pendingLeave;
    $('attention-total').textContent = `${metrics.pendingLeave + metrics.openCases + metrics.pendingTransfers + metrics.overdueProbation} ACTIONS`;
    const attention = [];
    state.leaveRequests.filter((item) => item.status === 'Pending').forEach((item) => attention.push({ title: `Leave request · ${personName(item.employeeId)}`, detail: `${item.days} working day(s), ${dateLabel(item.startDate)} – ${dateLabel(item.endDate)}`, go: 'leave', type: 'Leave approval' }));
    state.profiles.filter((profile) => profile.status === 'Probation' && profile.probationDue && profile.probationDue <= state.asOfDate).forEach((profile) => attention.push({ title: `Probation review · ${profile.name}`, detail: `Review due ${dateLabel(profile.probationDue)}`, go: 'attendance', type: 'Probation' }));
    state.cases.filter((item) => item.status !== 'Closed').forEach((item) => attention.push({ title: `${item.type} · ${personName(item.employeeId)}`, detail: item.title, go: 'cases', type: item.priority }));
    state.transfers.filter((item) => item.status === 'Pending').forEach((item) => attention.push({ title: `Transfer approval · ${personName(item.employeeId)}`, detail: `${departmentName(item.fromDepartment)} → ${departmentName(item.toDepartment)}`, go: 'cases', type: 'Transfer' }));
    state.transfers.filter((item) => item.status === 'Approved').forEach((item) => attention.push({ title: `Scheduled transfer · ${personName(item.employeeId)}`, detail: `Effective ${dateLabel(item.effectiveDate)}`, go: 'cases', type: 'Scheduled' }));
    $('attention-list').innerHTML = attention.length ? attention.slice(0, 9).map((item) => `<button class="attention-row" data-go="${esc(item.go)}"><span class="attention-mark"></span><span><b>${esc(item.title)}</b><small>${esc(item.detail)}</small></span><i>${esc(item.type)}</i></button>`).join('') : '<div class="empty-state">No pending HR actions. The workspace has no items in the attention queue.</div>';
    const counts = E.EMPLOYMENT_STATUSES.map((status) => ({ status, count: state.profiles.filter((profile) => profile.status === status).length })).filter((item) => item.count > 0);
    $('status-breakdown').innerHTML = counts.map((item) => `<div class="status-line"><span class="dot ${statusClass(item.status)}"></span><span>${esc(item.status)}</span><b>${item.count}</b></div>`).join('');
    $('activity-feed').innerHTML = state.activity.slice(0, 8).map((item) => `<div class="activity-row"><span class="activity-dot"></span><span><b>${esc(item.text)}</b><small>${dateLabel(item.date)}</small></span></div>`).join('') || '<div class="empty-state">No activity recorded.</div>';
  }
  function renderDirectory() {
    const q = $('directory-search').value.trim().toLowerCase();
    const dept = $('directory-department').value;
    const status = $('directory-status').value;
    const rows = state.profiles.filter((profile) => {
      const haystack = [profile.id, profile.name, profile.email, profile.jobTitle, profile.supervisor].join(' ').toLowerCase();
      return (!q || haystack.includes(q)) && (dept === 'All' || profile.department === dept) && (status === 'All' || profile.status === status);
    }).sort((a, b) => a.name.localeCompare(b.name));
    $('directory-count').textContent = rows.length;
    $('directory-table').innerHTML = rows.map((profile) => `<tr data-profile="${esc(profile.id)}" class="${selectedProfileId === profile.id ? 'selected-row' : ''}"><td><b>${esc(profile.name)}</b><small>${esc(profile.id)}${profile.importedFromPerformance ? ' · v4.9 snapshot' : ''}</small></td><td>${esc(departmentName(profile.department))}</td><td>${esc(profile.jobTitle)}</td><td>${esc(profile.supervisor)}</td><td>${dateLabel(profile.hireDate)}</td><td><span class="status-chip ${statusClass(profile.status)}">${esc(profile.status)}</span></td></tr>`).join('') || '<tr><td colspan="6" class="empty-cell">No employee records match the selected filters.</td></tr>';
    $('directory-table').querySelectorAll('[data-profile]').forEach((row) => row.addEventListener('click', () => loadProfile(row.dataset.profile)));
    if (selectedProfileId) renderProfileDetail();
  }
  function resetProfileForm() {
    selectedProfileId = null;
    $('profile-form').reset();
    $('profile-id').disabled = false;
    $('profile-status').value = 'Active';
    $('profile-probation-due').value = ''; $('profile-probation-wrap').classList.add('hidden');
    $('profile-contract').value = 'Permanent';
    $('profile-form-title').textContent = 'Add employee record';
    $('save-profile').textContent = 'Save employee';
    $('profile-detail').classList.add('hidden');
    renderDirectory();
  }
  function loadProfile(id) {
    const profile = E.profileById(state, id);
    if (!profile) return;
    selectedProfileId = id;
    $('profile-id').value = profile.id;
    $('profile-id').disabled = true;
    $('profile-name').value = profile.name;
    $('profile-email').value = profile.email || '';
    $('profile-department').value = profile.department;
    $('profile-title').value = profile.jobTitle;
    $('profile-supervisor').value = profile.supervisor;
    $('profile-hire-date').value = profile.hireDate;
    $('profile-contract').value = profile.contractType;
    $('profile-pattern').value = profile.workPattern || 'Full-time';
    $('profile-status').value = profile.status;
    $('profile-probation-due').value = profile.probationDue || ''; $('profile-probation-wrap').classList.toggle('hidden', profile.status !== 'Probation');
    $('balance-annual').value = profile.leaveBalances.annual;
    $('balance-casual').value = profile.leaveBalances.casual;
    $('balance-sick').value = profile.leaveBalances.sick;
    $('balance-parental').value = profile.leaveBalances.parental;
    $('profile-notes').value = profile.profileNotes || '';
    $('profile-form-title').textContent = `Update ${profile.name}`;
    $('save-profile').textContent = 'Save changes';
    renderDirectory();
    renderProfileDetail();
  }
  function renderProfileDetail() {
    const profile = E.profileById(state, selectedProfileId);
    if (!profile) return;
    const balances = ['annual', 'casual', 'sick', 'parental'].map((type) => {
      const item = E.getLeaveBalance(state, profile.id, type);
      return `<div><span>${type[0].toUpperCase() + type.slice(1)}</span><b>${item ? item.available : 0} <small>/ ${item ? item.allowance : 0} days available</small></b></div>`;
    }).join('');
    $('profile-detail').classList.remove('hidden');
    $('profile-detail').innerHTML = `<div class="detail-heading"><b>EMPLOYEE SNAPSHOT</b><span class="status-chip ${statusClass(profile.status)}">${esc(profile.status)}</span></div><div class="detail-grid"><div><small>STAFF ID</small><b>${esc(profile.id)}</b></div><div><small>CONTRACT</small><b>${esc(profile.contractType)}</b></div><div><small>WORK PATTERN</small><b>${esc(profile.workPattern || '—')}</b></div><div><small>LOCATION</small><b>${esc(profile.location || 'CALLORIA Operations')}</b></div></div><div class="balance-list">${balances}</div><p>${esc(profile.profileNotes || 'No additional HR note.')}</p>`;
  }
  function renderLeave() {
    const rows = state.leaveRequests.slice().sort((a, b) => b.startDate.localeCompare(a.startDate));
    const pending = rows.filter((item) => item.status === 'Pending').length;
    $('pending-leave-label').textContent = `${pending} PENDING`;
    $('leave-table').innerHTML = rows.map((item) => {
      const leave = E.LEAVE_TYPES.find((type) => type.id === item.type);
      const decision = item.status === 'Pending' ? `<button class="mini-btn approve" data-leave="${esc(item.id)}" data-decision="Approved">Approve</button><button class="mini-btn reject" data-leave="${esc(item.id)}" data-decision="Rejected">Reject</button>` : `<small>${esc(item.decisionBy || '—')}<br>${dateLabel(item.decisionAt)}</small>`;
      return `<tr><td><b>${esc(personName(item.employeeId))}</b><small>${esc(item.employeeId)}</small></td><td>${esc(leave ? leave.label : item.type)}</td><td>${dateLabel(item.startDate)}<small>to ${dateLabel(item.endDate)}</small></td><td><b>${item.days}</b></td><td>${esc(item.reason)}</td><td><span class="status-chip ${statusClass(item.status)}">${esc(item.status)}</span></td><td>${decision}</td></tr>`;
    }).join('') || '<tr><td colspan="7" class="empty-cell">No leave requests recorded.</td></tr>';
    $('leave-table').querySelectorAll('[data-leave]').forEach((button) => button.addEventListener('click', () => {
      const decision = button.dataset.decision;
      const note = window.prompt(`${decision} this leave request. Add a short decision note (optional):`, decision === 'Approved' ? 'Approved.' : 'Not approved.');
      if (note === null) return;
      const updated = run(() => E.decideLeaveRequest(state, button.dataset.leave, decision, 'People Operations', note));
      if (updated) notify(`Leave request ${decision.toLowerCase()}.`);
    }));
    updateLeaveBalancePreview();
  }
  function updateLeaveBalancePreview() {
    const employee = $('leave-employee').value;
    const type = $('leave-type').value;
    const preview = $('leave-balance-preview');
    if (!employee || !type) { preview.textContent = 'Choose an employee and leave type to view their balance.'; return; }
    const balance = E.getLeaveBalance(state, employee, type);
    preview.textContent = balance ? `${balance.available} days available · ${balance.used} approved · ${balance.reserved} pending · ${balance.allowance} total entitlement` : 'Unpaid leave does not consume a paid leave balance.';
  }
  function renderAttendance() {
    $('attendance-table').innerHTML = state.attendance.slice().sort((a, b) => b.date.localeCompare(a.date)).map((item) => `<tr><td>${dateLabel(item.date)}</td><td><b>${esc(personName(item.employeeId))}</b><small>${esc(item.employeeId)}</small></td><td><span class="status-chip ${statusClass(item.status)}">${esc(item.status)}</span></td><td>${item.minutes || 0}</td><td>${esc(item.note || '—')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-cell">No attendance records recorded.</td></tr>';
    const probationers = state.profiles.filter((profile) => profile.status === 'Probation');
    $('probation-count').textContent = `${probationers.length} ACTIVE`;
    $('probation-list').innerHTML = probationers.map((profile) => `<div class="probation-row"><span class="avatar-small">${esc(profile.name.split(' ').map((part) => part[0]).slice(0, 2).join(''))}</span><span><b>${esc(profile.name)}</b><small>${esc(profile.jobTitle)} · Review ${dateLabel(profile.probationDue)}</small></span><span class="status-chip ${profile.probationDue && profile.probationDue <= state.asOfDate ? 'status-rejected' : 'status-pending'}">${profile.probationDue && profile.probationDue <= state.asOfDate ? 'Due' : 'In progress'}</span></div>`).join('') || '<div class="empty-state">No employees are currently on probation.</div>';
    $('probation-form').querySelector('button[type="submit"]').disabled = probationers.length === 0;
  }
  function renderCases() {
    const activeCases = state.cases.filter((item) => item.status !== 'Closed').length;
    $('open-case-label').textContent = `${activeCases} OPEN`;
    $('cases-table').innerHTML = state.cases.map((item) => `<tr><td><b>${esc(personName(item.employeeId))}</b><small>${esc(item.employeeId)}</small></td><td>${esc(item.type)}</td><td><b>${esc(item.title)}</b><small>${esc(item.notes)}</small></td><td>${esc(item.owner)}</td><td>${dateLabel(item.openedAt)}</td><td><span class="status-chip ${statusClass(item.status)}">${esc(item.status)}</span></td><td>${item.status === 'Closed' ? '—' : `<button class="mini-btn" data-case="${esc(item.id)}">Update</button>`}</td></tr>`).join('') || '<tr><td colspan="7" class="empty-cell">No employee cases recorded.</td></tr>';
    $('cases-table').querySelectorAll('[data-case]').forEach((button) => button.addEventListener('click', () => {
      const record = state.cases.find((item) => item.id === button.dataset.case);
      if (!record) return;
      const status = window.prompt('Set case status: Open, Under review or Closed', record.status);
      if (status === null) return;
      const outcome = status === 'Closed' ? window.prompt('Closure outcome (required):', '') : window.prompt('Manager update (optional):', record.outcome || '');
      if (outcome === null) return;
      run(() => E.updateCase(state, record.id, { status, outcome }));
      notify('Employee case updated.');
    }));
    $('transfer-table').innerHTML = state.transfers.map((item) => `<tr><td><b>${esc(personName(item.employeeId))}</b></td><td>${esc(departmentName(item.fromDepartment))}</td><td>${esc(departmentName(item.toDepartment))}<small>${esc(item.toTitle)}</small></td><td>${dateLabel(item.effectiveDate)}</td><td>${esc(item.proposedBy)}</td><td><span class="status-chip ${statusClass(item.status)}">${esc(item.status)}</span></td><td>${item.status === 'Pending' ? `<button class="mini-btn approve" data-transfer="${esc(item.id)}" data-decision="Approved">Approve</button><button class="mini-btn reject" data-transfer="${esc(item.id)}" data-decision="Rejected">Reject</button>` : esc(item.approvedBy || '—')}</td></tr>`).join('') || '<tr><td colspan="7" class="empty-cell">No internal transfer proposals.</td></tr>';
    $('transfer-table').querySelectorAll('[data-transfer]').forEach((button) => button.addEventListener('click', () => {
      const decision = button.dataset.decision;
      if (!window.confirm(`${decision} this transfer proposal?`)) return;
      const updated = run(() => E.decideTransfer(state, button.dataset.transfer, decision, 'People Operations'));
      if (updated) notify(`Transfer ${decision.toLowerCase()}.`);
    }));
  }
  function renderOffboarding() {
    const inProgress = state.offboarding.filter((item) => item.status !== 'Completed').length;
    $('offboarding-count').textContent = `${inProgress} IN PROGRESS`;
    $('offboarding-list').innerHTML = state.offboarding.map((record) => {
      const completed = E.OFFBOARDING_ITEMS.filter((item) => record.checklist[item.id]).length;
      const controls = E.OFFBOARDING_ITEMS.map((item) => `<label class="check-row"><input type="checkbox" data-offboarding="${esc(record.id)}" data-item="${esc(item.id)}" ${record.checklist[item.id] ? 'checked' : ''} ${record.status === 'Completed' ? 'disabled' : ''}><span>${esc(item.label)}</span></label>`).join('');
      return `<article class="offboarding-card"><div class="offboard-head"><div><b>${esc(personName(record.employeeId))}</b><small>${esc(record.reason)} · Last day ${dateLabel(record.lastWorkingDate)}</small></div><span class="status-chip ${statusClass(record.status)}">${esc(record.status)}</span></div><div class="offboard-progress"><span style="width:${Math.round(completed / E.OFFBOARDING_ITEMS.length * 100)}%"></span></div><small class="progress-label">${completed} of ${E.OFFBOARDING_ITEMS.length} exit controls complete</small><div class="check-list">${controls}</div>${record.status === 'Completed' ? '<div class="success-note">Exit controls completed and employee marked Exited.</div>' : `<button class="btn btn-primary full" data-complete-offboarding="${esc(record.id)}">Complete offboarding</button>`}</article>`;
    }).join('') || '<div class="empty-state">No offboarding processes started.</div>';
    $('offboarding-list').querySelectorAll('[data-offboarding]').forEach((checkbox) => checkbox.addEventListener('change', () => {
      run(() => E.updateOffboardingItem(state, checkbox.dataset.offboarding, checkbox.dataset.item, checkbox.checked));
    }));
    $('offboarding-list').querySelectorAll('[data-complete-offboarding]').forEach((button) => button.addEventListener('click', () => {
      const completed = run(() => E.completeOffboarding(state, button.dataset.completeOffboarding));
      if (completed) notify('Offboarding completed. Employee status changed to Exited.');
    }));
  }
  function render() {
    $('as-of-date').value = state.asOfDate;
    fillEmployeeSelects();
    if (E.applyEffectiveTransfers(state) > 0) persist();
    renderOverview(); renderDirectory(); renderLeave(); renderAttendance(); renderCases(); renderOffboarding();
  }
  function showView(name) {
    document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${name}`));
    document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
    $('sidebar').classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function downloadCsv(filename, rows, columns) {
    const csv = E.exportCsv(rows, columns);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }
  function exportDirectory() { downloadCsv('calloria-employee-directory.csv', state.profiles, [{ key: 'id', label: 'Staff ID' }, { key: 'name', label: 'Name' }, { key: 'email', label: 'Work email' }, { key: 'department', label: 'Department ID' }, { key: 'jobTitle', label: 'Job title' }, { key: 'supervisor', label: 'Supervisor' }, { key: 'hireDate', label: 'Hire date' }, { key: 'contractType', label: 'Contract type' }, { key: 'status', label: 'Employment status' }]); }

  populateStaticSelects();
  document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
  document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.go)));
  $('menu-toggle').addEventListener('click', () => $('sidebar').classList.toggle('open'));
  $('as-of-date').addEventListener('change', () => { if (E.isDate($('as-of-date').value)) { state.asOfDate = $('as-of-date').value; persist(); render(); } });
  $('directory-search').addEventListener('input', renderDirectory);
  $('directory-department').addEventListener('change', renderDirectory);
  $('directory-status').addEventListener('change', renderDirectory);
  $('reset-profile').addEventListener('click', resetProfileForm);
  $('profile-status').addEventListener('change', () => $('profile-probation-wrap').classList.toggle('hidden', $('profile-status').value !== 'Probation'));
  $('profile-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = {
      id: $('profile-id').value, name: $('profile-name').value, email: $('profile-email').value,
      department: $('profile-department').value, jobTitle: $('profile-title').value, supervisor: $('profile-supervisor').value,
      hireDate: $('profile-hire-date').value, contractType: $('profile-contract').value, workPattern: $('profile-pattern').value,
      status: $('profile-status').value, probationDue: $('profile-probation-due').value, leaveBalances: { annual: Number($('balance-annual').value), casual: Number($('balance-casual').value), sick: Number($('balance-sick').value), parental: Number($('balance-parental').value) },
      profileNotes: $('profile-notes').value
    };
    const saved = run(() => E.saveProfile(state, input));
    if (saved) { selectedProfileId = saved.id; $('profile-id').disabled = false; loadProfile(saved.id); notify('Employee record saved.'); }
  });
  ['leave-employee', 'leave-type'].forEach((id) => $(id).addEventListener('change', updateLeaveBalancePreview));
  $('leave-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const record = run(() => E.createLeaveRequest(state, { employeeId: $('leave-employee').value, type: $('leave-type').value, startDate: $('leave-start').value, endDate: $('leave-end').value, reason: $('leave-reason').value }));
    if (record) { $('leave-form').reset(); notify(`Leave request submitted for ${record.days} working day(s).`); }
  });
  $('attendance-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const record = run(() => E.recordAttendance(state, { employeeId: $('attendance-employee').value, date: $('attendance-date').value, status: $('attendance-status').value, minutes: $('attendance-minutes').value, note: $('attendance-note').value }));
    if (record) { $('attendance-form').reset(); notify('Attendance record saved.'); }
  });
  $('probation-outcome').addEventListener('change', () => $('extension-date-wrap').classList.toggle('hidden', $('probation-outcome').value !== 'Extend'));
  $('probation-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const record = run(() => E.completeProbationReview(state, { employeeId: $('probation-employee').value, outcome: $('probation-outcome').value, newDueDate: $('probation-new-date').value, reviewer: $('probation-reviewer').value, notes: $('probation-notes').value }));
    if (record) { $('probation-form').reset(); $('extension-date-wrap').classList.add('hidden'); notify(`Probation decision recorded: ${record.outcome}.`); }
  });
  $('case-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const record = run(() => E.createCase(state, { employeeId: $('case-employee').value, type: $('case-type').value, title: $('case-title').value, priority: $('case-priority').value, owner: $('case-owner').value, notes: $('case-notes').value }));
    if (record) { $('case-form').reset(); $('case-owner').value = 'People Operations'; notify('Employee case opened.'); }
  });
  $('transfer-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const record = run(() => E.proposeTransfer(state, { employeeId: $('transfer-employee').value, toDepartment: $('transfer-department').value, toTitle: $('transfer-title').value, newSupervisor: $('transfer-supervisor').value, effectiveDate: $('transfer-date').value, reason: $('transfer-reason').value }));
    if (record) { $('transfer-form').reset(); notify('Transfer proposal submitted for approval.'); }
  });
  $('offboarding-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const record = run(() => E.startOffboarding(state, { employeeId: $('offboarding-employee').value, lastWorkingDate: $('offboarding-date').value, reason: $('offboarding-reason').value }));
    if (record) { $('offboarding-form').reset(); notify('Offboarding checklist created.'); }
  });
  $('import-performance').addEventListener('click', () => {
    const result = run(() => E.importPerformanceStaff(state));
    if (!result) return;
    notify(result.available ? `v4.9 snapshot imported: ${result.imported} new, ${result.updated} refreshed.` : 'No v4.9 records found in this browser origin.', !result.available);
  });
  $('export-directory').addEventListener('click', exportDirectory);
  $('export-leave').addEventListener('click', () => downloadCsv('calloria-leave-register.csv', state.leaveRequests, [{ key: 'employeeId', label: 'Staff ID' }, { key: 'type', label: 'Leave type' }, { key: 'startDate', label: 'Start date' }, { key: 'endDate', label: 'End date' }, { key: 'days', label: 'Working days' }, { key: 'status', label: 'Status' }, { key: 'reason', label: 'Reason' }, { key: 'decisionBy', label: 'Decision by' }]));
  $('export-attendance').addEventListener('click', () => downloadCsv('calloria-attendance-register.csv', state.attendance, [{ key: 'employeeId', label: 'Staff ID' }, { key: 'date', label: 'Date' }, { key: 'status', label: 'Status' }, { key: 'minutes', label: 'Minutes' }, { key: 'note', label: 'Note' }]));
  $('export-cases').addEventListener('click', () => downloadCsv('calloria-employee-cases.csv', state.cases, [{ key: 'employeeId', label: 'Staff ID' }, { key: 'type', label: 'Case type' }, { key: 'title', label: 'Title' }, { key: 'status', label: 'Status' }, { key: 'priority', label: 'Priority' }, { key: 'owner', label: 'Owner' }, { key: 'openedAt', label: 'Opened' }, { key: 'notes', label: 'Notes' }, { key: 'outcome', label: 'Outcome' }]));
  $('export-offboarding').addEventListener('click', () => downloadCsv('calloria-offboarding-register.csv', state.offboarding.map((item) => ({ ...item, checklistComplete: E.OFFBOARDING_ITEMS.filter((x) => item.checklist[x.id]).length })), [{ key: 'employeeId', label: 'Staff ID' }, { key: 'reason', label: 'Reason' }, { key: 'lastWorkingDate', label: 'Last working date' }, { key: 'status', label: 'Status' }, { key: 'checklistComplete', label: 'Completed exit controls' }, { key: 'completedAt', label: 'Completed at' }]));

  render();
})();
