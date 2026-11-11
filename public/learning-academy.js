(function () {
  'use strict';
  const API = window.CalloriaLearningAcademy;
  if (!API) throw new Error('CALLORIA Learning Academy engine failed to load.');

  const store = API.createStore(window.localStorage);
  const today = localDate();
  let state = store.load(today);
  state.asOfDate = today;
  let currentView = 'dashboard';
  let selectedEmployeeId = state.employees[0] ? state.employees[0].id : '';
  let currentLearningId = null;
  let lastFeedback = null;
  let noticeTimer = null;
  store.save(state);

  const workspace = document.getElementById('workspace');
  const metrics = document.getElementById('metrics');
  const notice = document.getElementById('notice');
  const employeeSelect = document.getElementById('employee-select');
  const title = document.getElementById('page-title');
  const subtitle = document.getElementById('page-subtitle');

  function localDate() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function addDays(date, days) {
    const value = new Date(`${date}T00:00:00`);
    value.setDate(value.getDate() + days);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function selectedEmployee() { return API.employeeById(state, selectedEmployeeId); }
  function employeeOptions(selected) {
    return state.employees.filter((employee) => ['Active', 'Probation'].includes(employee.status))
      .map((employee) => `<option value="${esc(employee.id)}" ${employee.id === selected ? 'selected' : ''}>${esc(employee.name)} · ${esc(employee.id)}</option>`).join('');
  }
  function departmentOptions(selected, includeAll) {
    const all = includeAll ? `<option value="all" ${selected === 'all' ? 'selected' : ''}>All active employees</option>` : '';
    return all + API.DEPARTMENTS.map((department) => `<option value="${esc(department.id)}" ${department.id === selected ? 'selected' : ''}>${esc(department.name)}</option>`).join('');
  }
  function courseOptions(selected) {
    return API.COURSES.map((course) => `<option value="${esc(course.id)}" ${course.id === selected ? 'selected' : ''}>${esc(course.title)}</option>`).join('');
  }
  function skillOptions(selected) {
    return API.SKILLS.map((skill) => `<option value="${esc(skill.id)}" ${skill.id === selected ? 'selected' : ''}>${esc(skill.label)}</option>`).join('');
  }
  function statusClass(status) {
    return String(status || '').toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
  }
  function statusBadge(status) { return `<span class="status ${statusClass(status)}">${esc(status)}</span>`; }
  function selectedNav() {
    document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === currentView));
  }
  function updateEmployeeSelect() {
    employeeSelect.innerHTML = employeeOptions(selectedEmployeeId);
    if (!state.employees.some((employee) => employee.id === selectedEmployeeId)) selectedEmployeeId = state.employees[0] ? state.employees[0].id : '';
    employeeSelect.value = selectedEmployeeId;
  }
  function showNotice(message, type) {
    notice.textContent = message;
    notice.className = `notice ${type || ''}`.trim();
    notice.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.hidden = true; }, 5200);
  }
  function saveAndRender(message, type) {
    const saved = store.save(state);
    render();
    if (!saved) showNotice('Browser storage could not save this change. Export a report before leaving this page.', 'error');
    else if (message) showNotice(message, type || 'success');
  }
  function metricCard(label, value, note) {
    return `<article class="metric-card"><div class="metric-label">${esc(label)}</div><div class="metric-value">${esc(value)}</div><div class="metric-note">${esc(note || '')}</div></article>`;
  }
  function renderMetrics() {
    const data = API.getDashboard(state, today);
    metrics.innerHTML = [
      metricCard('Active employees', data.activeEmployees, 'Active and probationary staff'),
      metricCard('Open assignments', data.openAssignments, `${data.assignments} total learning records`),
      metricCard('Overdue training', data.overdue, 'Assignments past their due date'),
      metricCard('Completion rate', `${data.completionRate}%`, `${data.completed} completed · ${data.failed} failed`),
      metricCard('Renewals due', data.certificationsDue, `${data.certificationsValid} current certifications`)
    ].join('');
  }
  function render() {
    updateEmployeeSelect();
    selectedNav();
    renderMetrics();
    const headings = {
      dashboard: ['Learning overview', 'Training assignments, practical competencies and service briefings.'],
      courses: ['Course catalogue', 'Assign role-relevant learning and launch structured lessons and assessments.'],
      learning: ['Learning records', 'Review the selected employee’s course assignments, attempts and certifications.'],
      competencies: ['Competency matrix', 'Record observed workplace evidence and review skill coverage.'],
      briefings: ['Team briefings', 'Plan the 7:30 AM and 2:00 PM service update briefings and record attendance.'],
      player: ['Course workspace', 'Complete the lessons before attempting the course assessment.']
    };
    title.textContent = headings[currentView][0];
    subtitle.textContent = headings[currentView][1];
    if (currentView === 'dashboard') workspace.innerHTML = renderDashboard();
    else if (currentView === 'courses') workspace.innerHTML = renderCourses();
    else if (currentView === 'learning') workspace.innerHTML = renderLearning();
    else if (currentView === 'competencies') workspace.innerHTML = renderCompetencies();
    else if (currentView === 'briefings') workspace.innerHTML = renderBriefings();
    else if (currentView === 'player') workspace.innerHTML = renderPlayer();
    bindDynamicControls();
  }
  function renderDashboard() {
    const data = API.getDashboard(state, today);
    const open = state.learning.filter((item) => ['Assigned', 'In progress', 'Failed'].includes(item.status)).slice(0, 7);
    const upcoming = state.sessions.filter((item) => item.date >= today && item.status === 'Scheduled').sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 4);
    const employee = selectedEmployee();
    const activity = state.activity.slice(0, 7).map((item) => `<div class="activity-item"><span class="activity-dot"></span><div><p>${esc(item.text)}</p><small>${esc(item.date)}</small></div></div>`).join('') || '<div class="empty-state">No activity recorded.</div>';
    const openRows = open.map((record) => {
      const person = API.employeeById(state, record.employeeId);
      const course = API.courseById(record.courseId);
      const overdue = ['Assigned', 'In progress'].includes(record.status) && record.dueDate < today;
      return `<tr><td><strong>${esc(person ? person.name : record.employeeId)}</strong><br><span class="muted">${esc(record.employeeId)}</span></td><td>${esc(course ? course.title : record.courseId)}</td><td>${statusBadge(overdue ? 'Overdue' : record.status)}</td><td>${esc(record.dueDate)}</td><td><button class="button button-outline button-small" data-action="open-learning" data-id="${esc(record.id)}">Open</button></td></tr>`;
    }).join('');
    const upcomingHtml = upcoming.map((session) => `<div class="briefing-card"><div class="briefing-time">${esc(session.time)}</div><div class="briefing-info"><h3>${esc(session.topic)}</h3><p>${esc(session.date)} · ${esc(session.trainer)} · ${session.audience === 'all' ? 'All teams' : esc(departmentName(session.audience))}</p></div><button class="button button-outline button-small" data-view="briefings">Open</button></div>`).join('') || '<div class="empty-state">No upcoming briefings scheduled.</div>';
    return `
      <div class="two-column">
        <section class="panel">
          <div class="panel-header"><div><h2>Training attention queue</h2><p>Assignments needing learner or manager action.</p></div><button class="button button-outline button-small" data-view="learning">View all</button></div>
          ${openRows ? `<div class="table-wrap"><table><thead><tr><th>Employee</th><th>Course</th><th>Status</th><th>Due</th><th></th></tr></thead><tbody>${openRows}</tbody></table></div>` : '<div class="empty-state">No open assignments. Assign a course from the catalogue.</div>'}
        </section>
        <section class="panel"><div class="panel-header"><div><h2>Learning activity</h2><p>Recent changes across this workspace.</p></div></div><div class="activity-list">${activity}</div></section>
      </div>
      <div class="two-column">
        <section class="panel"><div class="panel-header"><div><h2>Upcoming briefings</h2><p>Daily service and product update windows.</p></div><button class="button button-outline button-small" data-view="briefings">Manage</button></div>${upcomingHtml}</section>
        <section class="panel"><div class="panel-header"><div><h2>Selected employee</h2><p>Current learner context.</p></div><button class="button button-outline button-small" data-view="learning">Learning record</button></div>
          ${employee ? `<div class="employee-summary"><div class="avatar">${esc(initials(employee.name))}</div><div><strong>${esc(employee.name)}</strong><small>${esc(employee.jobTitle)} · ${esc(employee.id)}</small></div></div><div class="divider"></div><div class="pill-list"><span class="pill">${esc(departmentName(employee.department))}</span><span class="pill">${esc(employee.status)}</span><span class="pill">Supervisor: ${esc(employee.supervisor)}</span></div>` : '<div class="empty-state">No active employee selected.</div>'}
          <div class="divider"></div><div class="progress-row"><small>Course completion across all staff</small><strong>${data.completionRate}%</strong><div class="bar" style="grid-column:1/-1"><span style="width:${data.completionRate}%"></span></div></div><div class="progress-row"><small>Skills needing support</small><strong>${data.skillsNeedingSupport}</strong></div>
        </section>
      </div>
      <section class="panel"><div class="panel-header"><div><h2>Role-based learning paths</h2><p>Core customer-care learning applies across departments. Additional modules support specialist responsibilities.</p></div><button class="button button-primary button-small" data-view="courses">Browse courses</button></div>
        <div class="three-column"><div><span class="course-tag">CORE · ALL TEAMS</span><h3>Customer experience foundations</h3><p class="muted">Empathy, verification, CRM accuracy and end-to-end resolution.</p></div><div><span class="course-tag">CHANNEL · ROLE-BASED</span><h3>Voice and digital handling</h3><p class="muted">Channel behaviours for voice, email, chat and social care.</p></div><div><span class="course-tag">SPECIALIST · DEPARTMENT</span><h3>Operational capability</h3><p class="muted">QA, workforce, systems support, knowledge and leadership.</p></div></div>
      </section>`;
  }
  function renderCourses() {
    return `
      <section class="panel"><div class="panel-header"><div><h2>Assign learning</h2><p>One learner or a whole department can be assigned a course. Existing open duplicates are skipped.</p></div></div>
        <form id="assign-form" class="form-grid"><div class="field-row three"><div class="field"><label for="assign-course">Course</label><select id="assign-course" name="courseId" required>${courseOptions('cx-foundations')}</select></div><div class="field"><label for="assign-target">Assignment target</label><select id="assign-target" name="target">${employeeOptions(selectedEmployeeId)}<option value="__department__">Assign by department…</option></select></div><div class="field hidden" id="assign-department-wrap"><label for="assign-department">Department</label><select id="assign-department" name="department">${departmentOptions('all', true)}</select></div><div class="field"><label for="assign-due">Due date</label><input id="assign-due" name="dueDate" type="date" min="${today}" value="${addDays(today, 7)}" required></div></div><div class="field-row"><div class="field"><label for="assign-by">Assigned by</label><input id="assign-by" name="assignedBy" value="Learning Team" maxlength="100" required></div><div class="field"><label>Course scope</label><div class="field-help" id="course-scope-note">Select a course to review its team availability and skills.</div></div></div><div><button class="button button-primary" type="submit">Create assignment</button></div></form>
      </section>
      <section class="panel"><div class="panel-header"><div><h2>Course catalogue</h2><p>${API.COURSES.length} structured courses · Each assessment requires every lesson to be completed · pass mark ${API.PASS_MARK}%.</p></div><select id="course-filter" class="inline-select" style="max-width:180px"><option value="all">All categories</option><option>Core</option><option>Channel</option><option>Specialist</option><option>Leadership</option></select></div><div class="course-grid" id="course-grid">${courseCards('all')}</div></section>`;
  }
  function courseCards(filter) {
    return API.COURSES.filter((course) => filter === 'all' || course.category === filter).map((course) => {
      const skills = course.skills.map((id) => API.SKILLS.find((skill) => skill.id === id).label).join(' · ');
      const target = course.departments.includes('all') ? 'All departments' : course.departments.map(departmentName).join(', ');
      return `<article class="course-card" data-course-category="${esc(course.category)}"><span class="course-tag">${esc(course.category)} · ${esc(course.level)}</span><h3>${esc(course.title)}</h3><p>${esc(skills)}</p><div class="course-meta"><span>${course.durationMinutes} min</span><span>${course.lessons.length} lessons</span><span>${course.quiz.length} questions</span></div><div class="field-help">Eligible: ${esc(target)}</div><div class="course-actions"><button class="button button-primary button-small" data-action="quick-assign" data-id="${esc(course.id)}">Assign selected employee</button></div></article>`;
    }).join('') || '<div class="empty-state">No courses match this filter.</div>';
  }
  function renderLearning() {
    const employee = selectedEmployee();
    if (!employee) return '<div class="empty-state">Select an active employee to review learning records.</div>';
    const records = API.getEmployeeLearning(state, employee.id);
    const rows = records.map((record) => {
      const status = record.overdue ? 'Overdue' : record.status;
      const cert = record.certification ? `${record.certification.issuedAt} → ${record.certification.expiresAt}` : '—';
      const action = record.status === 'Failed' ? `<button class="button button-outline button-small" data-action="retake" data-id="${esc(record.id)}">Retake</button>` : `<button class="button button-outline button-small" data-action="open-learning" data-id="${esc(record.id)}">${record.status === 'Completed' ? 'Review' : 'Open'}</button>`;
      return `<tr><td><strong>${esc(record.course.title)}</strong><br><span class="muted">${record.course.durationMinutes} min · ${record.course.category}</span></td><td>${statusBadge(status)}</td><td>${esc(record.dueDate)}</td><td>${record.latestScore == null ? '—' : `${record.latestScore}%`}</td><td>${record.attempts}</td><td>${esc(cert)}</td><td>${action}</td></tr>`;
    }).join('');
    const total = records.length;
    const complete = records.filter((item) => item.status === 'Completed').length;
    return `<section class="panel"><div class="panel-header"><div><h2>${esc(employee.name)} · Learning history</h2><p>${esc(employee.jobTitle)} · ${esc(departmentName(employee.department))} · ${complete}/${total} assignments completed</p></div><button class="button button-outline button-small" data-view="courses">Assign another course</button></div>
      ${rows ? `<div class="table-wrap"><table><thead><tr><th>Course</th><th>Status</th><th>Due date</th><th>Score</th><th>Attempts</th><th>Certification</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty-state">No learning assignments for this employee. Browse the catalogue to assign a role-relevant course.</div>'}
    </section>
    <section class="panel"><div class="panel-header"><div><h2>Certification register</h2><p>Certificates are created only after the course assessment pass mark is met.</p></div></div>${renderCertificatesForEmployee(employee.id)}</section>`;
  }
  function renderCertificatesForEmployee(employeeId) {
    const items = API.getCertificationStatus(state, today).filter((item) => item.employee && item.employee.id === employeeId);
    if (!items.length) return '<div class="empty-state">No course certifications recorded for this employee.</div>';
    return `<div class="table-wrap"><table><thead><tr><th>Certification</th><th>Issued</th><th>Expires</th><th>Validity</th></tr></thead><tbody>${items.map((item) => `<tr><td><strong>${esc(item.course.title)}</strong></td><td>${esc(item.certification.issuedAt)}</td><td>${esc(item.certification.expiresAt)}</td><td>${statusBadge(item.status)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function renderCompetencies() {
    const employee = selectedEmployee();
    if (!employee) return '<div class="empty-state">Select an employee to review competencies.</div>';
    const matrix = API.getSkillMatrix(state, employee.id);
    const rows = matrix.map((item) => `<tr><td><strong>${esc(item.skill.label)}</strong><br><span class="muted">${esc(item.skill.category)}</span></td><td>${statusBadge(item.rating)}</td><td>${item.assessment ? esc(item.assessment.assessedAt) : '—'}</td><td>${item.assessment ? esc(item.assessment.assessedBy) : '—'}</td><td>${item.assessment ? esc(item.assessment.evidence) : 'No evidence recorded'}</td></tr>`).join('');
    return `<div class="two-column"><section class="panel"><div class="panel-header"><div><h2>Record observed competency</h2><p>Assessment must be based on observed work or a documented practical demonstration.</p></div></div>
      <form id="competency-form" class="form-grid"><div class="field"><label for="skill-id">Competency</label><select name="skillId" id="skill-id" required>${skillOptions('customer-empathy')}</select></div><div class="field"><label for="skill-rating">Assessment outcome</label><select name="rating" id="skill-rating" required><option>Competent</option><option>Needs support</option><option>Not observed</option></select></div><div class="field"><label for="assessor">Assessor</label><input id="assessor" name="assessedBy" value="${esc(employee.supervisor || 'Team Lead')}" maxlength="100" required></div><div class="field"><label for="evidence">Observable evidence</label><textarea id="evidence" name="evidence" minlength="12" maxlength="600" placeholder="Describe the behaviour observed, the task or scenario, and any follow-up required." required></textarea><span class="field-help">Do not enter real customer personal data. Use synthetic case references only.</span></div><button class="button button-primary" type="submit">Save competency assessment</button></form>
    </section><section class="panel"><div class="panel-header"><div><h2>Skill coverage</h2><p>Latest recorded outcome for each capability.</p></div></div>${renderSkillSummary(matrix)}</section></div>
    <section class="panel"><div class="panel-header"><div><h2>${esc(employee.name)} · Competency matrix</h2><p>Latest assessment appears for each capability. Historical evidence remains in the full record.</p></div></div><div class="table-wrap"><table><thead><tr><th>Skill</th><th>Latest outcome</th><th>Assessed</th><th>Assessor</th><th>Evidence</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }
  function renderSkillSummary(matrix) {
    const competent = matrix.filter((item) => item.rating === 'Competent').length;
    const support = matrix.filter((item) => item.rating === 'Needs support').length;
    const pending = matrix.filter((item) => item.rating === 'Not assessed' || item.rating === 'Not observed').length;
    return `<div class="metric-card"><div class="metric-label">Competent skills</div><div class="metric-value">${competent}/${matrix.length}</div><div class="bar"><span style="width:${Math.round(competent / matrix.length * 100)}%"></span></div></div><div class="progress-row"><small>Needs support</small><strong>${support}</strong></div><div class="progress-row"><small>Not assessed / not observed</small><strong>${pending}</strong></div><div class="warning-box">A course pass gives evidence for one mapped skill. It does not replace a manager’s broader workplace observation or sign-off.</div>`;
  }
  function renderBriefings() {
    const sessions = state.sessions.slice().sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    const sessionOptions = sessions.filter((session) => session.status !== 'Cancelled').map((session) => `<option value="${esc(session.id)}">${esc(session.date)} · ${esc(session.time)} · ${esc(session.topic)}</option>`).join('');
    const cards = sessions.map((session) => {
      const attendance = state.sessionAttendance.filter((item) => item.sessionId === session.id);
      const attended = attendance.filter((item) => item.status === 'Attended').length;
      return `<article class="briefing-card"><div class="briefing-time">${esc(session.time)}</div><div class="briefing-info"><h3>${esc(session.topic)}</h3><p>${esc(session.date)} · ${esc(session.trainer)} · ${session.audience === 'all' ? 'All teams' : esc(departmentName(session.audience))} · ${attended} attended / ${attendance.length} recorded</p>${session.summary ? `<p>${esc(session.summary)}</p>` : ''}</div><div>${statusBadge(session.status)}<br><button class="button button-outline button-small" style="margin-top:7px" data-action="session-attendance" data-id="${esc(session.id)}">Record attendance</button></div></article>`;
    }).join('');
    return `<div class="two-column"><section class="panel"><div class="panel-header"><div><h2>Schedule a team briefing</h2><p>Two standard briefing windows are available each day.</p></div></div>
      <form id="briefing-form" class="form-grid"><div class="field-row"><div class="field"><label for="briefing-date">Date</label><input type="date" min="${today}" id="briefing-date" name="date" value="${today}" required></div><div class="field"><label for="briefing-time">Briefing time</label><select id="briefing-time" name="time"><option value="07:30">7:30 AM · Morning</option><option value="14:00">2:00 PM · Afternoon</option></select></div></div><div class="field"><label for="briefing-topic">Topic / service update</label><input id="briefing-topic" name="topic" maxlength="140" placeholder="Product change, service notice or process update" required></div><div class="field-row"><div class="field"><label for="briefing-trainer">Trainer / facilitator</label><input id="briefing-trainer" name="trainer" maxlength="100" value="Training Team" required></div><div class="field"><label for="briefing-audience">Audience</label><select id="briefing-audience" name="audience">${departmentOptions('all', true)}</select></div></div><div class="field"><label for="briefing-course">Related course (optional)</label><select id="briefing-course" name="courseId"><option value="">No linked course</option>${courseOptions('')}</select></div><div class="field"><label for="briefing-summary">Key points / required employee action</label><textarea id="briefing-summary" name="summary" maxlength="800" placeholder="What changed, when it takes effect, and what staff must do."></textarea></div><button class="button button-primary" type="submit">Schedule briefing</button></form>
    </section><section class="panel"><div class="panel-header"><div><h2>Record attendance</h2><p>Attendance is separate from course completion and skill sign-off.</p></div></div><form id="attendance-form" class="form-grid"><div class="field"><label for="attendance-session">Briefing</label><select id="attendance-session" name="sessionId" required>${sessionOptions || '<option value="">No scheduled briefings</option>'}</select></div><div class="field"><label for="attendance-employee">Employee</label><select id="attendance-employee" name="employeeId">${employeeOptions(selectedEmployeeId)}</select></div><div class="field"><label for="attendance-status">Attendance result</label><select id="attendance-status" name="status"><option>Attended</option><option>Absent</option><option>Excused</option></select></div><div class="field"><label for="attendance-note">Attendance note</label><input id="attendance-note" name="note" maxlength="240" placeholder="Optional note"></div><button class="button button-primary" type="submit" ${sessionOptions ? '' : 'disabled'}>Save attendance</button></form><div class="divider"></div><div class="warning-box">Attendance can be recorded once per employee per briefing. A separate follow-up may be assigned to employees who missed a mandatory service update.</div></section></div>
      <section class="panel"><div class="panel-header"><div><h2>Briefing calendar</h2><p>Scheduled and historical service update sessions.</p></div><span class="pill">${sessions.length} sessions</span></div>${cards || '<div class="empty-state">No briefings scheduled. Create the first session above.</div>'}</section>`;
  }
  function renderPlayer() {
    const record = state.learning.find((item) => item.id === currentLearningId);
    if (!record) return '<div class="empty-state">Learning assignment not found. Return to learning records.</div>';
    const course = API.courseById(record.courseId);
    const employee = API.employeeById(state, record.employeeId);
    const lessons = course.lessons.map((lesson, index) => {
      const done = record.completedLessons.includes(index);
      return `<article class="lesson-card ${done ? 'done' : ''}"><div class="panel-header"><h3>Lesson ${index + 1} · ${esc(lesson.title)}</h3>${statusBadge(done ? 'Completed' : 'Assigned')}</div><p>${esc(lesson.body)}</p><button class="button ${done ? 'button-outline' : 'button-primary'} button-small" data-action="complete-lesson" data-index="${index}" ${done || record.status === 'Completed' ? 'disabled' : ''}>${done ? 'Lesson completed' : 'Mark lesson complete'}</button></article>`;
    }).join('');
    const allLessons = record.completedLessons.length === course.lessons.length;
    const quiz = record.status === 'Failed' ? `<section class="panel">${renderLastFeedback()}<div class="warning-box">The assessment attempt is closed. Start an explicit retake to reset lesson progress before trying again.</div><button class="button button-primary" data-action="retake-current">Start course retake</button></section>` : allLessons ? `<section class="panel"><div class="panel-header"><div><h2>Knowledge check</h2><p>${course.quiz.length} questions · pass mark ${API.PASS_MARK}% · attempt ${record.attempts + 1}</p></div></div><form id="assessment-form">${course.quiz.map((question, index) => `<fieldset class="question-card"><legend>${index + 1}. ${esc(question.q)}</legend>${question.options.map((option, optionIndex) => `<label class="option-row"><input type="radio" name="q${index}" value="${optionIndex}" required><span>${esc(option)}</span></label>`).join('')}</fieldset>`).join('')}<button class="button button-primary" type="submit">Submit assessment</button></form>${renderLastFeedback()}</section>` : `<section class="panel"><div class="warning-box">Complete all ${course.lessons.length} lessons to unlock the assessment. ${record.completedLessons.length}/${course.lessons.length} completed.</div></section>`;
    return `<div class="panel"><div class="panel-header"><div><span class="course-tag">${esc(course.category)} · ${esc(course.level)}</span><h2 style="margin-top:10px">${esc(course.title)}</h2><p>${esc(employee ? employee.name : record.employeeId)} · Due ${esc(record.dueDate)} · ${course.durationMinutes} minutes</p></div><button class="button button-outline button-small" data-action="back-learning">Back to records</button></div><div class="progress-row"><small>Lesson progress</small><strong>${record.completedLessons.length}/${course.lessons.length}</strong><div class="bar" style="grid-column:1/-1"><span style="width:${record.completedLessons.length / course.lessons.length * 100}%"></span></div></div>${record.status === 'Completed' ? `<div class="success-box">Course passed with ${record.latestScore}%. Certification issued ${esc(record.certification ? record.certification.issuedAt : record.completedAt)}.</div>` : ''}${lessons}</div>${record.status !== 'Completed' ? quiz : ''}`;
  }
  function renderLastFeedback() {
    if (!lastFeedback) return '';
    const details = lastFeedback.feedback.map((item, index) => `<li>Question ${index + 1}: ${item.correct ? 'Correct' : 'Incorrect'} — ${esc(item.explanation)}</li>`).join('');
    return `<div class="feedback ${lastFeedback.passed ? 'good' : 'bad'}"><strong>${lastFeedback.passed ? 'Assessment passed' : 'Assessment not passed'} · ${lastFeedback.score}%</strong><p>${lastFeedback.correct}/${lastFeedback.total} correct. ${lastFeedback.passed ? 'A course certification has been issued.' : 'Review the lessons and retake the assessment.'}</p><ul>${details}</ul></div>`;
  }
  function departmentName(id) { const found = API.DEPARTMENTS.find((item) => item.id === id); return found ? found.name : id; }
  function initials(name) { return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }
  function bindDynamicControls() {
    const assignForm = document.getElementById('assign-form');
    if (assignForm) {
      const target = document.getElementById('assign-target');
      const deptWrap = document.getElementById('assign-department-wrap');
      const courseSelect = document.getElementById('assign-course');
      const scopeNote = document.getElementById('course-scope-note');
      function updateAssignForm() {
        deptWrap.classList.toggle('hidden', target.value !== '__department__');
        const course = API.courseById(courseSelect.value);
        scopeNote.textContent = course ? `Applies to: ${course.departments.includes('all') ? 'all departments' : course.departments.map(departmentName).join(', ')}. Skills: ${course.skills.map((id) => API.SKILLS.find((skill) => skill.id === id).label).join(', ')}.` : '';
      }
      target.addEventListener('change', updateAssignForm);
      courseSelect.addEventListener('change', updateAssignForm);
      updateAssignForm();
    }
    const filter = document.getElementById('course-filter');
    if (filter) filter.addEventListener('change', () => { document.getElementById('course-grid').innerHTML = courseCards(filter.value); bindCourseButtons(); });
    bindCourseButtons();
  }
  function bindCourseButtons() {
    document.querySelectorAll('[data-action="quick-assign"]').forEach((button) => {
      button.addEventListener('click', () => {
        const courseId = button.dataset.id;
        const course = API.courseById(courseId);
        const target = selectedEmployee();
        if (!target) return showNotice('Select an employee first.', 'error');
        if (!course.departments.includes('all') && !course.departments.includes(target.department)) return showNotice('This course is not mapped to the selected employee’s department. Use a suitable role course.', 'error');
        try {
          API.assignCourse(state, { employeeId: target.id, courseId, dueDate: addDays(today, 7), assignedBy: 'Learning Team' }, today);
          saveAndRender(`${course.title} assigned to ${target.name}.`, 'success');
        } catch (error) { showNotice(error.message, 'error'); }
      });
    });
  }

  document.addEventListener('click', (event) => {
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) {
      currentView = viewButton.dataset.view;
      lastFeedback = null;
      render();
      return;
    }
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'open-learning') {
      currentLearningId = button.dataset.id;
      lastFeedback = null;
      currentView = 'player';
      render();
    } else if (action === 'back-learning') {
      currentView = 'learning';
      render();
    } else if (action === 'complete-lesson') {
      try {
        const result = API.completeLesson(state, currentLearningId, Number(button.dataset.index), today);
        store.save(state);
        render();
        showNotice(`Lesson completed (${result.completed}/${result.total}).`, 'success');
      } catch (error) { showNotice(error.message, 'error'); }
    } else if (action === 'retake' || action === 'retake-current') {
      try {
        const record = API.retakeCourse(state, button.dataset.id || currentLearningId, today);
        currentLearningId = record.id;
        lastFeedback = null;
        store.save(state);
        currentView = 'player';
        render();
        showNotice('Retake opened. Complete each lesson before the next assessment.', 'success');
      } catch (error) { showNotice(error.message, 'error'); }
    } else if (action === 'session-attendance') {
      currentView = 'briefings';
      render();
      const sessionSelect = document.getElementById('attendance-session');
      if (sessionSelect) { sessionSelect.value = button.dataset.id; sessionSelect.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }
  });

  document.addEventListener('submit', (event) => {
    const form = event.target;
    event.preventDefault();
    const data = new FormData(form);
    if (form.id === 'assign-form') {
      const dueDate = data.get('dueDate');
      try {
        if (data.get('target') === '__department__') {
          const result = API.assignDepartmentCourse(state, { courseId: data.get('courseId'), department: data.get('department'), dueDate, assignedBy: data.get('assignedBy') }, today);
          saveAndRender(`${result.assigned} assignments created; ${result.skipped} duplicate open assignments skipped.`, 'success');
        } else {
          const record = API.assignCourse(state, { employeeId: data.get('target'), courseId: data.get('courseId'), dueDate, assignedBy: data.get('assignedBy') }, today);
          saveAndRender(`Course assigned. Due ${record.dueDate}.`, 'success');
        }
      } catch (error) { showNotice(error.message, 'error'); }
    } else if (form.id === 'competency-form') {
      try {
        API.assessCompetency(state, { employeeId: selectedEmployeeId, skillId: data.get('skillId'), rating: data.get('rating'), assessedBy: data.get('assessedBy'), evidence: data.get('evidence'), source: 'Observed assessment' }, today);
        saveAndRender('Competency assessment saved.', 'success');
      } catch (error) { showNotice(error.message, 'error'); }
    } else if (form.id === 'briefing-form') {
      try {
        const session = API.scheduleBriefing(state, { date: data.get('date'), time: data.get('time'), topic: data.get('topic'), trainer: data.get('trainer'), audience: data.get('audience'), courseId: data.get('courseId'), summary: data.get('summary') }, today);
        saveAndRender(`Briefing scheduled for ${session.date} at ${session.time}.`, 'success');
      } catch (error) { showNotice(error.message, 'error'); }
    } else if (form.id === 'attendance-form') {
      try {
        API.recordBriefingAttendance(state, { sessionId: data.get('sessionId'), employeeId: data.get('employeeId'), status: data.get('status'), note: data.get('note') }, today);
        saveAndRender('Briefing attendance recorded.', 'success');
      } catch (error) { showNotice(error.message, 'error'); }
    } else if (form.id === 'assessment-form') {
      const record = state.learning.find((item) => item.id === currentLearningId);
      const course = record && API.courseById(record.courseId);
      if (!course) return showNotice('Course assignment could not be loaded.', 'error');
      const answers = course.quiz.map((_, index) => {
        const choice = form.querySelector(`input[name="q${index}"]:checked`);
        return choice ? Number(choice.value) : NaN;
      });
      if (answers.some((answer) => !Number.isInteger(answer))) return showNotice('Answer every question before submitting.', 'error');
      try {
        lastFeedback = API.submitAssessment(state, currentLearningId, answers, today);
        store.save(state);
        render();
        showNotice(lastFeedback.passed ? `Assessment passed: ${lastFeedback.score}%.` : `Assessment score: ${lastFeedback.score}%. Review and retake.`, lastFeedback.passed ? 'success' : 'error');
      } catch (error) { showNotice(error.message, 'error'); }
    }
  });

  employeeSelect.addEventListener('change', () => {
    selectedEmployeeId = employeeSelect.value;
    if (currentView === 'player') currentView = 'learning';
    lastFeedback = null;
    render();
  });

  document.getElementById('import-people').addEventListener('click', () => {
    try {
      const raw = window.localStorage.getItem(API.PEOPLE_KEY);
      if (!raw) throw new Error('No People Operations v5.0 snapshot found in this browser and origin. Open People Operations first, then retry the import.');
      const peopleState = JSON.parse(raw);
      const result = API.importPeopleSnapshot(state, peopleState, today);
      if (!state.employees.some((item) => item.id === selectedEmployeeId)) selectedEmployeeId = state.employees[0] ? state.employees[0].id : '';
      saveAndRender(`Employee snapshot imported: ${result.added} added, ${result.updated} refreshed.`, 'success');
    } catch (error) { showNotice(error.message || 'Employee import failed.', 'error'); }
  });

  document.getElementById('export-report').addEventListener('click', () => {
    const rows = state.learning.map((record) => {
      const employee = API.employeeById(state, record.employeeId);
      const course = API.courseById(record.courseId);
      return {
        employeeId: record.employeeId, employeeName: employee ? employee.name : '', department: employee ? departmentName(employee.department) : '',
        course: course ? course.title : record.courseId, status: record.status, assignedAt: record.assignedAt, dueDate: record.dueDate,
        attempts: record.attempts, latestScore: record.latestScore == null ? '' : record.latestScore,
        completedAt: record.completedAt || '', certificationExpires: record.certification ? record.certification.expiresAt : ''
      };
    });
    const csv = API.exportCsv(rows, [
      { key: 'employeeId', label: 'Employee ID' }, { key: 'employeeName', label: 'Employee name' }, { key: 'department', label: 'Department' },
      { key: 'course', label: 'Course' }, { key: 'status', label: 'Status' }, { key: 'assignedAt', label: 'Assigned at' },
      { key: 'dueDate', label: 'Due date' }, { key: 'attempts', label: 'Attempts' }, { key: 'latestScore', label: 'Latest score' },
      { key: 'completedAt', label: 'Completed at' }, { key: 'certificationExpires', label: 'Certification expiry' }
    ]);
    downloadCsv(csv, `calloria-learning-report-${today}.csv`);
  });

  function downloadCsv(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  render();
})();
