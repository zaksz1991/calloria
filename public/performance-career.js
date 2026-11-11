(function () {
  'use strict';
  const Engine = window.CalloriaPerformanceCareer;
  if (!Engine) return;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const state = Engine.loadState();
  let toastTimer;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }
  function localDate() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function cycleYear() { return Number(state.asOfDate.slice(0, 4)); }
  function currentDepartment(staff) { return Engine.DEPARTMENTS.find((item) => item.id === staff.department)?.name || 'Unassigned'; }
  function currentLevel(staff) { return Engine.LEVELS.find((item) => item.id === staff.level)?.title || 'Unassigned'; }
  function initials(name) { return String(name || '').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase(); }
  function save() { Engine.saveState(state); }
  function notify(message, error) {
    const node = $('#toast');
    node.textContent = message;
    node.classList.toggle('error', !!error);
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('show'), 3000);
  }
  function showView(name) {
    $$('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${name}`));
    $$('.nav-link').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
    $('#sidebar').classList.remove('open');
    if (name === 'scorecards') renderScorecards();
    if (name === 'promotions') renderPromotions();
    if (name === 'departments') renderDepartments();
  }
  function escapeLevelLabel(id) { return escapeHtml(Engine.LEVELS.find((level) => level.id === id)?.short || '—'); }
  function latestReviewForCycle(staff) {
    return Engine.getLatestReview(state, staff.id, cycleYear()) || Engine.getLatestReview(state, staff.id);
  }
  function getScore(review) { return review ? Engine.calculatePerformanceScore(review.metrics).score : null; }
  function careLabel(review) {
    const care = Engine.getCustomerCareCompliance(review);
    return care.compliant ? 'MET' : `${care.hours}/${care.requiredHours}h · ${care.contacts}/${care.requiredContacts}`;
  }
  function gradeClass(grade) { return String(grade || '').toLowerCase().replace(/\s+/g, '-'); }
  function formatScore(value) { return value == null ? '—' : `${Number(value).toFixed(1)}%`; }
  function populateSharedControls() {
    $('#cycle-date').value = state.asOfDate || localDate();
    $('#cycle-label').textContent = `${cycleYear()} PERFORMANCE CYCLE`;
    $('#promotion-year-label').textContent = `${cycleYear()} ANNUAL CYCLE`;
    $('#review-cycle-tag').textContent = `CYCLE ${cycleYear()}`;
    $('#review-period').value = state.period || state.asOfDate.slice(0, 7);
    const departments = Engine.DEPARTMENTS.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
    $('#department-filter').innerHTML = '<option value="All">All departments</option>' + departments;
    $('#review-agent').innerHTML = state.staff.map((staff) => `<option value="${escapeHtml(staff.id)}">${escapeHtml(staff.name)} · ${escapeHtml(currentDepartment(staff))}</option>`).join('');
    const periods = [...new Set(state.reviews.map((review) => review.period))].sort().reverse();
    $('#review-period-filter').innerHTML = '<option value="All">Latest in cycle year</option>' + periods.map((period) => `<option value="${escapeHtml(period)}">${escapeHtml(period)}</option>`).join('');
  }
  function renderOverview() {
    const metrics = Engine.deriveDashboardMetrics(state, cycleYear());
    $('#metric-headcount').textContent = metrics.headcount;
    $('#metric-average').textContent = `${metrics.averageKpi.toFixed(1)}%`;
    $('#metric-eligible').textContent = metrics.promotionEligible;
    $('#metric-care').textContent = `${metrics.careComplianceRate}%`;
    $('#metric-care-foot').textContent = `${metrics.careCompliant} of ${metrics.reviewed} reviewed staff met the monthly frontline duty minimum`;
    const leaderboard = state.staff.map((staff) => ({ staff, review: latestReviewForCycle(staff) })).filter((item) => item.review)
      .sort((a, b) => getScore(b.review) - getScore(a.review)).slice(0, 5);
    $('#leaderboard').innerHTML = leaderboard.map((item, index) => {
      const score = getScore(item.review);
      return `<div class="leader-row"><span class="rank">${index + 1}</span><div class="leader-name"><b>${escapeHtml(item.staff.name)}</b><small>${escapeHtml(currentDepartment(item.staff))}</small></div><div class="bar-track"><i style="width:${Math.max(0, Math.min(100, score))}%"></i></div><strong class="leader-score">${score.toFixed(1)}</strong></div>`;
    }).join('') || '<div class="empty">No current-year reviews are recorded.</div>';

    const attention = [];
    state.staff.forEach((staff) => {
      const review = Engine.getLatestReview(state, staff.id, cycleYear());
      if (!review) {
        attention.push({ tone: 'orange', title: `${staff.name} · no current-year review`, detail: `${currentDepartment(staff)} needs a documented performance review.` });
        return;
      }
      const score = getScore(review);
      const care = Engine.getCustomerCareCompliance(review);
      if (score < 70) attention.push({ tone: 'red', title: `${staff.name} · KPI at risk (${score.toFixed(1)}%)`, detail: 'Manager review and a documented improvement plan are required.' });
      else if (!care.compliant) attention.push({ tone: 'orange', title: `${staff.name} · frontline duty incomplete`, detail: `Recorded ${care.hours} hours and ${care.contacts} contacts; minimum is 8 hours and 20 contacts.` });
      else if (Number(review.metrics.trainingCompletion) < 90) attention.push({ tone: 'orange', title: `${staff.name} · mandatory training outstanding`, detail: `${review.metrics.trainingCompletion}% complete; promotion threshold is 90%.` });
    });
    $('#attention-count').textContent = `${attention.length} OPEN`;
    $('#attention-list').innerHTML = attention.slice(0, 5).map((item) => `<div class="attention-row"><span class="attention-mark ${item.tone}">${item.tone === 'red' ? '!' : '•'}</span><div class="attention-copy"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.detail)}</small></div></div>`).join('') || '<div class="attention-row"><span class="attention-mark green">✓</span><div class="attention-copy"><b>No immediate performance alerts</b><small>All reviewed staff are above the critical performance threshold.</small></div></div>';

    const examCounts = state.exams.filter((item) => Number(item.year) === cycleYear());
    const eligible = metrics.promotionEligible;
    $('#promotion-summary').innerHTML = `<div class="promotion-mini"><strong>${eligible}</strong><small>ELIGIBLE FOR EXAM</small></div><div class="promotion-mini"><strong>${examCounts.length}</strong><small>ATTEMPTS THIS YEAR</small></div><div class="promotion-mini"><strong>${examCounts.filter((item) => item.outcome === 'Passed').length}</strong><small>PROMOTIONS PASSED</small></div>`;
    $('#activity-list').innerHTML = (state.activity || []).slice(0, 5).map((item) => `<div class="activity-row"><time>${escapeHtml(item.time)}</time><span>${escapeHtml(item.text)}</span></div>`).join('') || '<div class="empty">No people activity recorded.</div>';
    $('#nav-staff-count').textContent = state.staff.filter((item) => item.status === 'Active').length;
    $('#nav-promotion-count').textContent = eligible;
  }

  function getFilteredStaff() {
    const query = $('#staff-search').value.trim().toLowerCase();
    const department = $('#department-filter').value;
    const selectedPeriod = $('#review-period-filter').value;
    return state.staff.filter((staff) => {
      const review = selectedPeriod === 'All' ? latestReviewForCycle(staff) : state.reviews.find((item) => item.agentId === staff.id && item.period === selectedPeriod);
      const matchQuery = !query || [staff.name, staff.id, currentDepartment(staff), currentLevel(staff)].some((value) => String(value).toLowerCase().includes(query));
      const matchDepartment = department === 'All' || staff.department === department;
      return matchQuery && matchDepartment && (!!review || selectedPeriod === 'All');
    });
  }
  function renderScorecards() {
    const staffRows = getFilteredStaff();
    $('#review-count').textContent = staffRows.length;
    $('#scorecard-table').innerHTML = staffRows.map((staff) => {
      const period = $('#review-period-filter').value;
      const review = period === 'All' ? latestReviewForCycle(staff) : state.reviews.find((item) => item.agentId === staff.id && item.period === period);
      if (!review) return `<tr data-staff="${escapeHtml(staff.id)}"><td><div class="identity"><span class="identity-avatar">${escapeHtml(initials(staff.name))}</span><span class="identity-name"><b>${escapeHtml(staff.name)}</b><small>${escapeHtml(staff.id)}</small></span></div></td><td>${escapeHtml(currentDepartment(staff))}</td><td>${escapeHtml(escapeLevelLabel(staff.level))}</td><td>—</td><td>—</td><td>—</td><td>—</td><td><span class="care-pill missed">NO REVIEW</span></td><td>—</td></tr>`;
      const score = getScore(review);
      const care = Engine.getCustomerCareCompliance(review);
      const grade = Engine.calculatePerformanceScore(review.metrics).grade;
      return `<tr data-staff="${escapeHtml(staff.id)}"><td><div class="identity"><span class="identity-avatar">${escapeHtml(initials(staff.name))}</span><span class="identity-name"><b>${escapeHtml(staff.name)}</b><small>${escapeHtml(staff.id)} · ${escapeHtml(review.period)}</small></span></div></td><td>${escapeHtml(currentDepartment(staff))}</td><td><span class="level-pill">${escapeHtml(escapeLevelLabel(staff.level))}</span></td><td><b class="score-pill">${score.toFixed(1)}%</b></td><td>${Number(review.metrics.qa).toFixed(0)}%</td><td>${Number(review.metrics.csat).toFixed(0)}%</td><td>${Number(review.metrics.attendance).toFixed(0)}%</td><td><span class="care-pill ${care.compliant ? 'met' : 'missed'}">${care.compliant ? 'MET' : 'INCOMPLETE'}</span></td><td><span class="grade ${gradeClass(grade)}">${escapeHtml(grade.toUpperCase())}</span></td></tr>`;
    }).join('') || '<tr><td colspan="9" class="table-empty">No staff records match the selected filters.</td></tr>';
    $$('#scorecard-table tr[data-staff]').forEach((row) => row.addEventListener('click', () => {
      const staff = state.staff.find((item) => item.id === row.dataset.staff);
      const review = Engine.getLatestReview(state, staff.id, cycleYear()) || Engine.getLatestReview(state, staff.id);
      $('#review-agent').value = staff.id;
      if (review) {
        $('#review-period').value = review.period;
        const m = review.metrics;
        $('#review-qa').value = m.qa; $('#review-csat').value = m.csat; $('#review-fcr').value = m.fcr;
        $('#review-adherence').value = m.adherence; $('#review-productivity').value = m.productivity;
        $('#review-attendance').value = m.attendance; $('#review-compliance').value = m.compliance;
        $('#review-training').value = m.trainingCompletion; $('#review-care-hours').value = m.customerCareHours;
        $('#review-care-contacts').value = m.customerCareContacts; $('#review-notes').value = review.notes || '';
      }
      $('#review-agent').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
  }

  function getEligibilityRows() {
    return state.staff.filter((staff) => staff.status === 'Active').map((staff) => ({ staff, eligibility: Engine.getPromotionEligibility(state, staff.id, cycleYear(), state.asOfDate) }));
  }
  function renderPromotions() {
    const rows = getEligibilityRows();
    const eligibleRows = rows.filter((item) => item.eligibility.eligible);
    $('#eligible-tag').textContent = `${eligibleRows.length} ELIGIBLE`;
    $('#promotion-table').innerHTML = rows.map(({ staff, eligibility }) => {
      const target = eligibility.targetLevel ? eligibility.targetLevel.short : 'Career ceiling';
      const attempts = `${eligibility.attempts}/3`;
      const score = eligibility.kpiScore == null ? '—' : `${eligibility.kpiScore.toFixed(1)}%`;
      const decision = eligibility.eligible ? '<span class="decision eligible">ELIGIBLE</span>' : `<span class="decision blocked">${eligibility.attempts >= 3 ? 'ATTEMPTS EXHAUSTED' : 'NOT ELIGIBLE'}</span>`;
      const action = eligibility.eligible ? `<button class="mini-action" data-select-exam="${escapeHtml(staff.id)}">Assess →</button>` : '<span class="muted-action">—</span>';
      return `<tr><td><div class="identity"><span class="identity-avatar">${escapeHtml(initials(staff.name))}</span><span class="identity-name"><b>${escapeHtml(staff.name)}</b><small>${escapeHtml(staff.id)} · ${escapeHtml(currentDepartment(staff))}</small></span></div></td><td>${escapeHtml(escapeLevelLabel(staff.level))}</td><td>${escapeHtml(target)}</td><td><b>${score}</b></td><td>${attempts}</td><td>${decision}</td><td>${action}</td></tr>`;
    }).join('') || '<tr><td colspan="7" class="table-empty">No active staff are in the promotion register.</td></tr>';
    $('#exam-agent').innerHTML = eligibleRows.length ? eligibleRows.map((item) => `<option value="${escapeHtml(item.staff.id)}">${escapeHtml(item.staff.name)} · ${escapeHtml(item.eligibility.targetLevel.short)}</option>`).join('') : '<option value="">No eligible employees</option>';
    $('#exam-agent').disabled = !eligibleRows.length;
    $('#submit-exam').disabled = !eligibleRows.length;
    updateExamTarget();
    $$('#promotion-table [data-select-exam]').forEach((button) => button.addEventListener('click', () => {
      $('#exam-agent').value = button.dataset.selectExam;
      updateExamTarget();
      $('#exam-agent').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
    $('#exam-history-table').innerHTML = state.exams.slice().sort((a, b) => Number(b.year) - Number(a.year) || String(b.date).localeCompare(String(a.date))).map((exam) => {
      const staff = state.staff.find((item) => item.id === exam.agentId);
      const target = Engine.LEVELS.find((item) => item.id === exam.targetLevel);
      return `<tr><td><b>${exam.year}</b></td><td>${escapeHtml(staff?.name || exam.agentId)}</td><td>${escapeHtml(target?.title || exam.targetLevel)}</td><td><b>${Number(exam.score).toFixed(1)}%</b></td><td><span class="decision ${exam.outcome === 'Passed' ? 'eligible' : 'blocked'}">${escapeHtml(exam.outcome.toUpperCase())}</span></td><td>${escapeHtml(exam.assessor || '—')}</td><td>${escapeHtml(exam.date || '—')}</td></tr>`;
    }).join('') || '<tr><td colspan="7" class="table-empty">No promotion examinations have been recorded.</td></tr>';
  }
  function updateExamTarget() {
    const staff = state.staff.find((item) => item.id === $('#exam-agent').value);
    if (!staff) { $('#exam-target').textContent = 'No eligible employee is currently available for assessment.'; return; }
    const eligibility = Engine.getPromotionEligibility(state, staff.id, cycleYear(), state.asOfDate);
    $('#exam-target').textContent = `${currentLevel(staff)} → ${eligibility.targetLevel?.title || 'No next level'} · ${eligibility.remainingAttempts} annual attempt${eligibility.remainingAttempts === 1 ? '' : 's'} remaining after prior attempts.`;
  }
  function renderDepartments() {
    const summary = Engine.getDepartmentSummary(state, cycleYear());
    $('#department-grid').innerHTML = summary.map((item) => {
      const rate = item.careComplianceRate;
      return `<article class="department-card"><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.specialty)}</p><div class="department-stats"><div><strong>${item.headcount}</strong><small>HEADCOUNT</small></div><div><strong>${item.averageKpi == null ? '—' : item.averageKpi.toFixed(1)}</strong><small>AVG KPI</small></div><div><strong>${item.careCompliant}/${item.reviewed}</strong><small>CARE DUTY MET</small></div></div><div class="care-progress"><i style="width:${rate}%"></i></div><div class="department-foot"><span>Frontline duty compliance</span><b>${rate}%</b></div></article>`;
    }).join('') || '<div class="empty">No departments have active staff.</div>';
  }
  function renderFramework() {
    $('#career-ladder').innerHTML = Engine.LEVELS.map((level, index) => `<div class="career-level"><span class="career-level-index">${String(index + 1).padStart(2, '0')}</span><div><b>${escapeHtml(level.title)}</b><p>${escapeHtml(level.scope)}</p></div><small>${index === 0 ? 'ENTRY' : index === Engine.LEVELS.length - 1 ? 'CAREER CEILING' : 'NEXT LEVEL'}</small></div>`).join('');
    const policies = [
      ['Six-month role tenure', 'Employee must complete at least six months at the current career level.'],
      ['Current-year performance review', 'A documented review for the active annual cycle is mandatory.'],
      ['Minimum KPI of 80%', 'Weighted KPI score must reach 80%, with QA ≥85%, compliance ≥90% and attendance ≥95%.'],
      ['Mandatory learning at 90%', 'Required product, policy, systems and role training must be complete.'],
      ['Frontline duty for every unit', 'Each employee must complete at least 8 customer-care hours and 20 customer contacts in the reviewed month.'],
      ['Annual exam and three attempts', 'One attempt is allowed per calendar year, with a maximum of three attempts for each target level.'],
      ['75% exam pass mark', 'A pass advances the employee exactly one career level and resets the next level tenure clock.']
    ];
    $('#policy-list').innerHTML = policies.map((item) => `<div class="policy-row"><span class="policy-check">✓</span><div><b>${escapeHtml(item[0])}</b><small>${escapeHtml(item[1])}</small></div></div>`).join('');
    $('#weight-bars').innerHTML = Engine.KPI_WEIGHTS.map((item) => `<div class="weight-row"><span>${escapeHtml(item.label)}</span><div class="weight-track"><i style="width:${item.weight * 4}%"></i></div><b>${item.weight}%</b></div>`).join('');
  }
  function renderAll() {
    populateSharedControls();
    renderOverview();
    renderScorecards();
    renderPromotions();
    renderDepartments();
    renderFramework();
  }
  function csvDownload(filename, rows) {
    const text = rows.map((row) => row.map((cell) => `"${String(cell == null ? '' : cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${text}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }

  $$('.nav-link').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
  $$('[data-go]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.go)));
  $('#mobile-menu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#cycle-date').addEventListener('change', () => {
    if (!$('#cycle-date').value) return;
    state.asOfDate = $('#cycle-date').value;
    state.period = state.asOfDate.slice(0, 7);
    save(); renderAll();
  });
  ['#staff-search', '#department-filter', '#review-period-filter'].forEach((selector) => $(selector).addEventListener(selector === '#staff-search' ? 'input' : 'change', renderScorecards));

  $('#review-form').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const agentId = $('#review-agent').value;
      const metrics = {
        qa: $('#review-qa').value, csat: $('#review-csat').value, fcr: $('#review-fcr').value,
        adherence: $('#review-adherence').value, productivity: $('#review-productivity').value,
        attendance: $('#review-attendance').value, compliance: $('#review-compliance').value,
        trainingCompletion: $('#review-training').value, customerCareHours: $('#review-care-hours').value,
        customerCareContacts: $('#review-care-contacts').value
      };
      const review = Engine.createReview({ agentId, period: $('#review-period').value, reviewer: $('#reviewer-name').value, metrics, notes: $('#review-notes').value });
      const existingIndex = state.reviews.findIndex((item) => item.agentId === agentId && item.period === review.period);
      if (existingIndex >= 0) { review.id = state.reviews[existingIndex].id; state.reviews[existingIndex] = review; }
      else state.reviews.push(review);
      const staff = state.staff.find((item) => item.id === agentId);
      Engine.addActivity(state, `${staff.name} performance review saved for ${review.period} (${review.score.toFixed(1)}%).`);
      state.period = review.period;
      save(); renderAll(); notify(`Performance review saved · KPI ${review.score.toFixed(1)}%`);
    } catch (error) { notify(error.message, true); }
  });

  $('#exam-agent').addEventListener('change', updateExamTarget);
  ['#exam-customer', '#exam-crm', '#exam-policy', '#exam-problem', '#exam-role', '#exam-care'].forEach((selector) => $(selector).addEventListener('input', () => {
    const result = Engine.calculateExamScore({ customerHandling: $('#exam-customer').value, crmAccuracy: $('#exam-crm').value, policyKnowledge: $('#exam-policy').value, problemSolving: $('#exam-problem').value, roleReadiness: $('#exam-role').value, customerCareDuty: $('#exam-care').value });
    $('#exam-estimated').textContent = `${result.score.toFixed(1)}%`;
    $('#exam-estimated-status').textContent = result.passed ? 'Pass threshold met · 75%' : 'Below pass threshold · 75%';
    $('#exam-estimated-status').style.color = result.passed ? '#258262' : '#ba7b2f';
  }));
  $('#exam-form').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const scores = { customerHandling: $('#exam-customer').value, crmAccuracy: $('#exam-crm').value, policyKnowledge: $('#exam-policy').value, problemSolving: $('#exam-problem').value, roleReadiness: $('#exam-role').value, customerCareDuty: $('#exam-care').value };
      const result = Engine.recordPromotionExam(state, { agentId: $('#exam-agent').value, year: cycleYear(), date: state.asOfDate, scores, assessor: $('#exam-assessor').value, notes: $('#exam-notes').value });
      save(); renderAll();
      notify(result.promoted ? `${result.eligibility.staff.name} promoted to ${result.eligibility.targetLevel.title}.` : `Exam recorded: ${result.record.score.toFixed(1)}%. Promotion not awarded.`);
    } catch (error) { notify(error.message, true); }
  });

  $('#sync-qa').addEventListener('click', () => {
    const result = Engine.syncSupervisorQaEvidence(state, window.localStorage);
    if (!result.available) { notify('No compatible v4.7 supervisor QA records were found in this browser.', true); return; }
    save(); renderAll();
    notify(`Imported ${result.imported} QA evaluations across ${result.updatedStaff} staff records.`);
  });
  $('#export-reviews').addEventListener('click', () => {
    const rows = [['Staff ID', 'Employee', 'Department', 'Career level', 'Period', 'KPI', 'QA', 'CSAT', 'FCR', 'Adherence', 'Productivity', 'Attendance', 'Compliance', 'Training completion', 'Care hours', 'Care contacts', 'Reviewer', 'Notes']];
    state.reviews.forEach((review) => {
      const staff = state.staff.find((item) => item.id === review.agentId);
      if (!staff) return;
      const m = review.metrics;
      rows.push([staff.id, staff.name, currentDepartment(staff), currentLevel(staff), review.period, getScore(review), m.qa, m.csat, m.fcr, m.adherence, m.productivity, m.attendance, m.compliance, m.trainingCompletion, m.customerCareHours, m.customerCareContacts, review.reviewer, review.notes]);
    });
    csvDownload('calloria-performance-reviews.csv', rows);
  });
  $('#export-promotions').addEventListener('click', () => {
    const rows = [['Year', 'Staff ID', 'Employee', 'Target level', 'Score', 'Outcome', 'Assessor', 'Date', 'Notes']];
    state.exams.forEach((exam) => {
      const staff = state.staff.find((item) => item.id === exam.agentId);
      const level = Engine.LEVELS.find((item) => item.id === exam.targetLevel);
      rows.push([exam.year, exam.agentId, staff?.name || '', level?.title || exam.targetLevel, exam.score, exam.outcome, exam.assessor, exam.date, exam.notes || '']);
    });
    csvDownload('calloria-promotion-history.csv', rows);
  });

  renderAll();
})();
