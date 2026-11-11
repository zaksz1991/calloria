(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CalloriaPerformanceCareer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'calloria.performance-career.v49';
  const QA_STORAGE_KEY = 'calloria.supervisor-qa.v47';
  const VERSION = 49;
  const CUSTOMER_CARE_MINIMUM = Object.freeze({ hours: 8, contacts: 20 });
  const PROMOTION_RULES = Object.freeze({
    minimumMonthsAtLevel: 6,
    minimumKpi: 80,
    minimumQa: 85,
    minimumCompliance: 90,
    minimumAttendance: 95,
    minimumTraining: 90,
    maximumReviewAgeMonths: 2,
    examPassMark: 75,
    maximumAnnualAttempts: 3
  });

  const LEVELS = [
    { id: 'associate', title: 'Customer Service Associate', short: 'Associate', scope: 'Core customer care, contact handling and accurate CRM records.' },
    { id: 'agent', title: 'Customer Service Agent', short: 'Agent', scope: 'Independent multi-channel customer service and reliable case ownership.' },
    { id: 'senior', title: 'Senior Customer Service Agent', short: 'Senior agent', scope: 'Complex cases, peer support, quality discipline and specialist knowledge.' },
    { id: 'team-lead', title: 'Team Lead', short: 'Team lead', scope: 'Daily floor support, queue coordination, coaching and escalation control.' },
    { id: 'supervisor', title: 'Supervisor', short: 'Supervisor', scope: 'Performance management, quality calibration, staffing and customer outcomes.' },
    { id: 'operations-manager', title: 'Operations Manager', short: 'Operations manager', scope: 'Multi-team service delivery, workforce planning, risk and operational improvement.' }
  ];

  const DEPARTMENTS = [
    { id: 'general-cx', name: 'General Customer Experience', specialty: 'General enquiries, complaints and customer journey ownership' },
    { id: 'voice', name: 'Voice Operations', specialty: 'Inbound and outbound voice service' },
    { id: 'email', name: 'Email Operations', specialty: 'Written case handling and response management' },
    { id: 'social', name: 'Social Media Care', specialty: 'Public response, private messaging and reputation care' },
    { id: 'it', name: 'IT & Systems Support', specialty: 'Service desk, access issues and technology support' },
    { id: 'quality', name: 'Quality Assurance', specialty: 'Contact evaluation, calibration and service standards' },
    { id: 'workforce', name: 'Workforce Management', specialty: 'Scheduling, intraday control and capacity coordination' },
    { id: 'crm', name: 'CRM & Customer Data', specialty: 'Customer records, data accuracy and workflow integrity' },
    { id: 'training', name: 'Training & Knowledge', specialty: 'Onboarding, learning delivery and knowledge operations' },
    { id: 'operations', name: 'Operations & Escalations', specialty: 'Service recovery, complaints and cross-team coordination' },
    { id: 'sales', name: 'Sales & Retention', specialty: 'Customer needs, suitable offers and retention' }
  ];

  const KPI_WEIGHTS = Object.freeze([
    { id: 'qa', label: 'Quality assurance', weight: 25 },
    { id: 'csat', label: 'Customer satisfaction', weight: 20 },
    { id: 'fcr', label: 'First contact resolution', weight: 15 },
    { id: 'adherence', label: 'Schedule adherence', weight: 10 },
    { id: 'productivity', label: 'Productivity attainment', weight: 10 },
    { id: 'attendance', label: 'Attendance', weight: 10 },
    { id: 'compliance', label: 'Policy & compliance', weight: 10 }
  ]);

  const EXAM_WEIGHTS = Object.freeze([
    { id: 'customerHandling', label: 'Customer handling scenarios', weight: 20 },
    { id: 'crmAccuracy', label: 'CRM and case documentation', weight: 20 },
    { id: 'policyKnowledge', label: 'Policy and compliance knowledge', weight: 20 },
    { id: 'problemSolving', label: 'Investigation and problem solving', weight: 15 },
    { id: 'roleReadiness', label: 'Target-role readiness', weight: 15 },
    { id: 'customerCareDuty', label: 'Frontline customer-care practice', weight: 10 }
  ]);

  const seedStaff = [
    { id: 'ag-104', name: 'Amina Yusuf', department: 'general-cx', level: 'agent', levelSince: '2025-04-01', supervisor: 'Maryam Bello', status: 'Active', skills: ['Voice', 'Email'] },
    { id: 'ag-108', name: 'Daniel Okafor', department: 'sales', level: 'agent', levelSince: '2026-03-01', supervisor: 'Maryam Bello', status: 'Active', skills: ['Voice', 'Live chat'] },
    { id: 'ag-112', name: 'Chiamaka Nwosu', department: 'voice', level: 'senior', levelSince: '2024-07-01', supervisor: 'Samuel Garba', status: 'Active', skills: ['Voice', 'Live chat'] },
    { id: 'ag-119', name: 'Ibrahim Musa', department: 'operations', level: 'agent', levelSince: '2023-11-01', supervisor: 'Samuel Garba', status: 'Active', skills: ['Voice', 'Email'] },
    { id: 'ag-123', name: 'Fatima Abdullahi', department: 'email', level: 'agent', levelSince: '2025-01-15', supervisor: 'Maryam Bello', status: 'Active', skills: ['Email', 'Live chat'] },
    { id: 'ag-127', name: 'Yusuf Sani', department: 'social', level: 'senior', levelSince: '2024-02-01', supervisor: 'Samuel Garba', status: 'Active', skills: ['Social', 'Email'] },
    { id: 'ag-131', name: 'Ngozi Eze', department: 'quality', level: 'senior', levelSince: '2024-09-01', supervisor: 'Maryam Bello', status: 'Active', skills: ['Voice', 'Email', 'Live chat'] },
    { id: 'ag-136', name: 'Musa Bello', department: 'workforce', level: 'agent', levelSince: '2025-06-01', supervisor: 'Samuel Garba', status: 'Active', skills: ['Voice', 'Social'] },
    { id: 'ag-140', name: 'Maryam Bello', department: 'it', level: 'supervisor', levelSince: '2023-01-10', supervisor: 'Head of Operations', status: 'Active', skills: ['Voice', 'Email'] },
    { id: 'ag-144', name: 'Samuel Garba', department: 'training', level: 'team-lead', levelSince: '2024-05-18', supervisor: 'Head of Operations', status: 'Active', skills: ['Voice', 'Live chat', 'Email'] }
  ];

  const seedReviews = [
    { id: 'rv-26010', agentId: 'ag-104', period: '2026-10', reviewer: 'Maryam Bello', metrics: { qa: 92, csat: 94, fcr: 88, adherence: 96, productivity: 91, attendance: 98, compliance: 97, trainingCompletion: 100, customerCareHours: 12, customerCareContacts: 34 }, notes: 'Consistent customer ownership and clear case notes.' },
    { id: 'rv-26011', agentId: 'ag-108', period: '2026-10', reviewer: 'Maryam Bello', metrics: { qa: 78, csat: 80, fcr: 72, adherence: 88, productivity: 90, attendance: 96, compliance: 92, trainingCompletion: 95, customerCareHours: 10, customerCareContacts: 28 }, notes: 'Improve investigation quality and first-contact resolution.' },
    { id: 'rv-26012', agentId: 'ag-112', period: '2026-10', reviewer: 'Samuel Garba', metrics: { qa: 94, csat: 92, fcr: 90, adherence: 97, productivity: 89, attendance: 99, compliance: 98, trainingCompletion: 100, customerCareHours: 14, customerCareContacts: 42 }, notes: 'Strong complex-case ownership and peer support.' },
    { id: 'rv-26013', agentId: 'ag-119', period: '2026-10', reviewer: 'Samuel Garba', metrics: { qa: 68, csat: 74, fcr: 65, adherence: 82, productivity: 78, attendance: 91, compliance: 84, trainingCompletion: 82, customerCareHours: 6, customerCareContacts: 15 }, notes: 'Formal improvement plan required.' },
    { id: 'rv-26014', agentId: 'ag-123', period: '2026-10', reviewer: 'Maryam Bello', metrics: { qa: 90, csat: 91, fcr: 86, adherence: 95, productivity: 88, attendance: 97, compliance: 96, trainingCompletion: 96, customerCareHours: 9, customerCareContacts: 25 }, notes: 'Eligible profile pending annual exam.' },
    { id: 'rv-26015', agentId: 'ag-127', period: '2026-10', reviewer: 'Samuel Garba', metrics: { qa: 88, csat: 89, fcr: 84, adherence: 94, productivity: 87, attendance: 96, compliance: 95, trainingCompletion: 98, customerCareHours: 4, customerCareContacts: 11 }, notes: 'Frontline customer-care rotation incomplete this month.' },
    { id: 'rv-26016', agentId: 'ag-131', period: '2026-10', reviewer: 'Maryam Bello', metrics: { qa: 96, csat: 95, fcr: 91, adherence: 98, productivity: 93, attendance: 99, compliance: 99, trainingCompletion: 100, customerCareHours: 8, customerCareContacts: 21 }, notes: 'Quality specialist maintains frontline service practice.' },
    { id: 'rv-26017', agentId: 'ag-136', period: '2026-10', reviewer: 'Samuel Garba', metrics: { qa: 89, csat: 90, fcr: 85, adherence: 96, productivity: 91, attendance: 97, compliance: 96, trainingCompletion: 94, customerCareHours: 8, customerCareContacts: 22 }, notes: 'Strong intraday coordination with customer-care coverage.' },
    { id: 'rv-26018', agentId: 'ag-140', period: '2026-10', reviewer: 'Head of Operations', metrics: { qa: 93, csat: 94, fcr: 92, adherence: 97, productivity: 90, attendance: 99, compliance: 99, trainingCompletion: 100, customerCareHours: 8, customerCareContacts: 20 }, notes: 'IT leadership maintains required frontline rotation.' },
    { id: 'rv-26019', agentId: 'ag-144', period: '2026-10', reviewer: 'Head of Operations', metrics: { qa: 91, csat: 93, fcr: 90, adherence: 96, productivity: 92, attendance: 98, compliance: 98, trainingCompletion: 100, customerCareHours: 10, customerCareContacts: 30 }, notes: 'Training team remains active in live customer care.' }
  ];

  const seedExamHistory = [
    { id: 'px-2024-127', agentId: 'ag-127', targetLevel: 'team-lead', year: 2024, score: 68, outcome: 'Failed', date: '2024-11-14', assessor: 'Samuel Garba' },
    { id: 'px-2025-127', agentId: 'ag-127', targetLevel: 'team-lead', year: 2025, score: 72, outcome: 'Failed', date: '2025-11-12', assessor: 'Samuel Garba' },
    { id: 'px-2025-119', agentId: 'ag-119', targetLevel: 'senior', year: 2025, score: 61, outcome: 'Failed', date: '2025-11-20', assessor: 'Maryam Bello' }
  ];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function clampScore(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(100, number));
  }
  function departmentById(id) { return DEPARTMENTS.find((item) => item.id === id) || null; }
  function levelById(id) { return LEVELS.find((item) => item.id === id) || null; }
  function getNextLevel(levelId) {
    const index = LEVELS.findIndex((item) => item.id === levelId);
    return index >= 0 ? (LEVELS[index + 1] || null) : null;
  }
  function monthsBetween(startDate, endDate) {
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return 0;
    let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
    if (end.getUTCDate() < start.getUTCDate()) months -= 1;
    return Math.max(0, months);
  }
  function currentDateString(date) {
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  function createInitialState(date) {
    const today = currentDateString(date);
    return {
      version: VERSION,
      asOfDate: today,
      period: today.slice(0, 7),
      staff: clone(seedStaff),
      reviews: clone(seedReviews),
      exams: clone(seedExamHistory),
      developmentPlans: [
        { id: 'dp-104', agentId: 'ag-104', focus: 'Advanced complaint ownership', owner: 'Maryam Bello', due: '2026-12-15', status: 'In progress' },
        { id: 'dp-119', agentId: 'ag-119', focus: 'QA recovery, attendance and compliance', owner: 'Samuel Garba', due: '2026-11-30', status: 'At risk' },
        { id: 'dp-127', agentId: 'ag-127', focus: 'Frontline customer-care rotation and team-lead readiness', owner: 'Samuel Garba', due: '2026-12-20', status: 'In progress' }
      ],
      activity: [
        { id: 'pc-act-1', time: '09:25', text: 'October performance reviews published for all demo staff.' },
        { id: 'pc-act-2', time: '09:10', text: 'Customer-care duty threshold applied to every department.' },
        { id: 'pc-act-3', time: '08:45', text: 'Annual promotion cycle opened for 2026.' }
      ],
      evidenceSync: { lastSyncAt: null, importedEvaluations: 0, source: 'Supervisor QA v4.7' }
    };
  }

  function calculatePerformanceScore(metrics) {
    const source = metrics || {};
    const normalized = {};
    KPI_WEIGHTS.forEach((item) => { normalized[item.id] = clampScore(source[item.id]); });
    const score = KPI_WEIGHTS.reduce((sum, item) => sum + normalized[item.id] * item.weight / 100, 0);
    return { score: Math.round(score * 10) / 10, grade: score >= 90 ? 'Exceptional' : score >= 80 ? 'Strong' : score >= 70 ? 'Developing' : 'At risk', normalized };
  }

  function createReview(input) {
    if (!input || !input.agentId) throw new Error('A staff member is required.');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(input.period || ''))) throw new Error('Review period must use YYYY-MM format.');
    const metrics = input.metrics || {};
    const required = KPI_WEIGHTS.map((item) => item.id).concat(['trainingCompletion', 'customerCareHours', 'customerCareContacts']);
    required.forEach((key) => {
      const value = Number(metrics[key]);
      if (!Number.isFinite(value) || value < 0 || (key !== 'customerCareHours' && key !== 'customerCareContacts' && value > 100)) {
        throw new Error(`Invalid review metric: ${key}.`);
      }
    });
    if (Number(metrics.customerCareHours) > 744 || Number(metrics.customerCareContacts) > 10000) throw new Error('Customer-care duty value is outside the accepted range.');
    const result = calculatePerformanceScore(metrics);
    return {
      id: input.id || `rv-${String(input.period).replace('-', '')}-${String(input.agentId).replace(/[^a-z0-9]/gi, '').slice(-4)}`,
      agentId: input.agentId,
      period: input.period,
      reviewer: String(input.reviewer || 'Operations Manager').trim(),
      metrics: { ...result.normalized, trainingCompletion: clampScore(metrics.trainingCompletion), customerCareHours: Number(metrics.customerCareHours), customerCareContacts: Number(metrics.customerCareContacts) },
      score: result.score,
      grade: result.grade,
      notes: String(input.notes || '').trim(),
      source: input.source || 'Manual review',
      linkedEvaluations: 0
    };
  }

  function attachCalculatedFields(review) {
    const score = calculatePerformanceScore(review.metrics || {});
    return { ...review, score: score.score, grade: score.grade };
  }

  function getLatestReview(state, agentId, year) {
    return (state.reviews || [])
      .filter((review) => review.agentId === agentId && (!year || review.period.startsWith(String(year))))
      .sort((a, b) => String(b.period).localeCompare(String(a.period)))[0] || null;
  }

  function getPromotionEligibility(state, agentId, year, date) {
    const staff = (state.staff || []).find((item) => item.id === agentId);
    if (!staff) return { eligible: false, reasons: ['Staff record not found.'], staff: null, targetLevel: null, attempts: 0, remainingAttempts: 0, latestReview: null };
    const targetLevel = getNextLevel(staff.level);
    const cycleYear = Number(year) || Number(String(state.asOfDate || currentDateString()).slice(0, 4));
    const asOf = date || `${cycleYear}-12-31`;
    const history = (state.exams || []).filter((item) => item.agentId === agentId && targetLevel && item.targetLevel === targetLevel.id);
    const attempts = history.length;
    const attemptedThisYear = history.some((item) => Number(item.year) === cycleYear);
    const remainingAttempts = Math.max(0, PROMOTION_RULES.maximumAnnualAttempts - attempts);
    const reasons = [];
    if (!targetLevel) reasons.push('The highest career level has been reached.');
    if (staff.status !== 'Active') reasons.push('Only active staff can enter the promotion cycle.');
    const monthsInLevel = monthsBetween(staff.levelSince, asOf);
    if (monthsInLevel < PROMOTION_RULES.minimumMonthsAtLevel) reasons.push(`Requires at least ${PROMOTION_RULES.minimumMonthsAtLevel} months at current level; recorded ${monthsInLevel}.`);
    if (attempts >= PROMOTION_RULES.maximumAnnualAttempts) reasons.push('Three annual attempts have been used for this promotion level.');
    if (attemptedThisYear) reasons.push(`An exam attempt for ${cycleYear} is already recorded.`);
    const review = targetLevel ? getLatestReview(state, agentId, cycleYear) : null;
    if (!review) reasons.push(`A ${cycleYear} performance review is required.`);
    if (review) {
      const reviewAgeMonths = monthsBetween(`${review.period}-01`, `${String(cycleYear).padStart(4, '0')}-${String(new Date(`${asOf}T00:00:00Z`).getUTCMonth() + 1).padStart(2, '0')}-01`);
      if (reviewAgeMonths > PROMOTION_RULES.maximumReviewAgeMonths) reasons.push(`The latest review is ${reviewAgeMonths} months old; a review no older than ${PROMOTION_RULES.maximumReviewAgeMonths} months is required.`);
      const metrics = review.metrics || {};
      const score = calculatePerformanceScore(metrics).score;
      if (score < PROMOTION_RULES.minimumKpi) reasons.push(`KPI score must be at least ${PROMOTION_RULES.minimumKpi}; current score is ${score.toFixed(1)}.`);
      if (Number(metrics.qa) < PROMOTION_RULES.minimumQa) reasons.push(`QA must be at least ${PROMOTION_RULES.minimumQa}%.`);
      if (Number(metrics.compliance) < PROMOTION_RULES.minimumCompliance) reasons.push(`Compliance must be at least ${PROMOTION_RULES.minimumCompliance}%.`);
      if (Number(metrics.attendance) < PROMOTION_RULES.minimumAttendance) reasons.push(`Attendance must be at least ${PROMOTION_RULES.minimumAttendance}%.`);
      if (Number(metrics.trainingCompletion) < PROMOTION_RULES.minimumTraining) reasons.push(`Mandatory training completion must be at least ${PROMOTION_RULES.minimumTraining}%.`);
      if (Number(metrics.customerCareHours) < CUSTOMER_CARE_MINIMUM.hours) reasons.push(`Department-wide customer-care duty requires ${CUSTOMER_CARE_MINIMUM.hours} frontline hours per review month.`);
      if (Number(metrics.customerCareContacts) < CUSTOMER_CARE_MINIMUM.contacts) reasons.push(`Department-wide customer-care duty requires ${CUSTOMER_CARE_MINIMUM.contacts} customer contacts per review month.`);
    }
    return {
      eligible: reasons.length === 0,
      reasons,
      staff,
      targetLevel,
      attempts,
      remainingAttempts,
      attemptedThisYear,
      monthsInLevel,
      latestReview: review,
      kpiScore: review ? calculatePerformanceScore(review.metrics).score : null
    };
  }

  function calculateExamScore(scores) {
    const source = scores || {};
    const normalized = {};
    EXAM_WEIGHTS.forEach((item) => { normalized[item.id] = clampScore(source[item.id]); });
    const score = EXAM_WEIGHTS.reduce((sum, item) => sum + normalized[item.id] * item.weight / 100, 0);
    return { score: Math.round(score * 10) / 10, passed: score >= PROMOTION_RULES.examPassMark, normalized };
  }

  function recordPromotionExam(state, input) {
    if (!state || !Array.isArray(state.staff) || !input) throw new Error('A valid performance state and exam record are required.');
    const year = Number(input.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2200) throw new Error('A valid exam year is required.');
    const eligibility = getPromotionEligibility(state, input.agentId, year, input.date || `${year}-12-31`);
    if (!eligibility.eligible) throw new Error(`Promotion exam blocked: ${eligibility.reasons.join(' ')}`);
    const exam = calculateExamScore(input.scores);
    const record = {
      id: input.id || `px-${year}-${String(input.agentId).replace(/[^a-z0-9]/gi, '')}-${(state.exams || []).length + 1}`,
      agentId: input.agentId,
      targetLevel: eligibility.targetLevel.id,
      year,
      score: exam.score,
      outcome: exam.passed ? 'Passed' : 'Failed',
      date: input.date || currentDateString(),
      assessor: String(input.assessor || 'Promotion Panel').trim(),
      scores: exam.normalized,
      notes: String(input.notes || '').trim()
    };
    state.exams = Array.isArray(state.exams) ? state.exams : [];
    state.exams.unshift(record);
    if (exam.passed) {
      eligibility.staff.level = eligibility.targetLevel.id;
      eligibility.staff.levelSince = record.date;
      state.activity = Array.isArray(state.activity) ? state.activity : [];
      state.activity.unshift({ id: `pc-act-${Date.now()}`, time: record.date, text: `${eligibility.staff.name} promoted to ${eligibility.targetLevel.title}.` });
    } else {
      state.activity = Array.isArray(state.activity) ? state.activity : [];
      state.activity.unshift({ id: `pc-act-${Date.now()}`, time: record.date, text: `${eligibility.staff.name} did not pass the ${eligibility.targetLevel.short} promotion exam (${exam.score.toFixed(1)}%).` });
    }
    state.activity = state.activity.slice(0, 40);
    return { record, promoted: exam.passed, eligibility };
  }

  function getCustomerCareCompliance(review) {
    const metrics = review && review.metrics || {};
    const hours = Number(metrics.customerCareHours) || 0;
    const contacts = Number(metrics.customerCareContacts) || 0;
    return {
      hours,
      contacts,
      requiredHours: CUSTOMER_CARE_MINIMUM.hours,
      requiredContacts: CUSTOMER_CARE_MINIMUM.contacts,
      compliant: hours >= CUSTOMER_CARE_MINIMUM.hours && contacts >= CUSTOMER_CARE_MINIMUM.contacts,
      hoursMet: hours >= CUSTOMER_CARE_MINIMUM.hours,
      contactsMet: contacts >= CUSTOMER_CARE_MINIMUM.contacts
    };
  }

  function deriveDashboardMetrics(state, year) {
    const activeStaff = (state.staff || []).filter((item) => item.status === 'Active');
    const scorecards = activeStaff.map((staff) => ({ staff, review: getLatestReview(state, staff.id, year) })).filter((item) => item.review);
    const scores = scorecards.map((item) => calculatePerformanceScore(item.review.metrics).score);
    const eligible = activeStaff.filter((staff) => getPromotionEligibility(state, staff.id, year, state.asOfDate).eligible).length;
    const careCompliant = scorecards.filter((item) => getCustomerCareCompliance(item.review).compliant).length;
    const atRisk = scorecards.filter((item) => calculatePerformanceScore(item.review.metrics).score < 70).length;
    return {
      headcount: activeStaff.length,
      reviewed: scorecards.length,
      averageKpi: scores.length ? Math.round(scores.reduce((sum, item) => sum + item, 0) / scores.length * 10) / 10 : 0,
      promotionEligible: eligible,
      careCompliant,
      careComplianceRate: scorecards.length ? Math.round(careCompliant / scorecards.length * 100) : 0,
      atRisk,
      examAttempts: (state.exams || []).filter((item) => Number(item.year) === Number(year)).length
    };
  }

  function getDepartmentSummary(state, year) {
    return DEPARTMENTS.map((department) => {
      const staff = (state.staff || []).filter((item) => item.department === department.id && item.status === 'Active');
      const reviews = staff.map((item) => ({ staff: item, review: getLatestReview(state, item.id, year) })).filter((item) => item.review);
      const scores = reviews.map((item) => calculatePerformanceScore(item.review.metrics).score);
      const compliant = reviews.filter((item) => getCustomerCareCompliance(item.review).compliant).length;
      return {
        ...department,
        headcount: staff.length,
        reviewed: reviews.length,
        averageKpi: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length * 10) / 10 : null,
        careCompliant: compliant,
        careComplianceRate: reviews.length ? Math.round(compliant / reviews.length * 100) : 0,
        universalDuty: true,
        requiredCareHours: CUSTOMER_CARE_MINIMUM.hours,
        requiredCareContacts: CUSTOMER_CARE_MINIMUM.contacts
      };
    }).filter((item) => item.headcount > 0);
  }

  function addStaff(state, input) {
    if (!input || !String(input.name || '').trim()) throw new Error('A staff name is required.');
    if (!departmentById(input.department)) throw new Error('Select a valid department.');
    if (!levelById(input.level)) throw new Error('Select a valid career level.');
    const id = String(input.id || `ag-${Date.now().toString().slice(-6)}`).trim();
    if (state.staff.some((item) => item.id === id)) throw new Error('That staff ID already exists.');
    const record = {
      id,
      name: String(input.name).trim(),
      department: input.department,
      level: input.level,
      levelSince: input.levelSince || currentDateString(),
      supervisor: String(input.supervisor || 'Unassigned').trim(),
      status: 'Active',
      skills: Array.isArray(input.skills) ? input.skills : ['Voice']
    };
    state.staff.push(record);
    return record;
  }

  function syncSupervisorQaEvidence(state, storage) {
    const source = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!source) return { imported: 0, updatedStaff: 0, available: false };
    let qaState;
    try {
      const raw = source.getItem(QA_STORAGE_KEY);
      if (!raw) return { imported: 0, updatedStaff: 0, available: false };
      qaState = JSON.parse(raw);
    } catch (_) {
      return { imported: 0, updatedStaff: 0, available: false };
    }
    if (!qaState || qaState.version !== 47 || !Array.isArray(qaState.evaluations)) return { imported: 0, updatedStaff: 0, available: false };
    let imported = 0;
    let updatedStaff = 0;
    const currentYear = String(state.asOfDate || currentDateString()).slice(0, 4);
    (state.staff || []).forEach((staff) => {
      const matches = qaState.evaluations.filter((item) => item.agentId === staff.id && Number.isFinite(Number(item.score)) && (!item.date || String(item.date).slice(0, 4) === currentYear));
      if (!matches.length) return;
      const review = getLatestReview(state, staff.id, currentYear);
      if (!review) return;
      const average = matches.reduce((sum, item) => sum + clampScore(item.score), 0) / matches.length;
      review.metrics.qa = Math.round(average * 10) / 10;
      review.source = 'Manual review + Supervisor QA v4.7';
      review.linkedEvaluations = matches.length;
      const calculated = calculatePerformanceScore(review.metrics);
      review.score = calculated.score;
      review.grade = calculated.grade;
      imported += matches.length;
      updatedStaff += 1;
    });
    state.evidenceSync = { lastSyncAt: new Date().toISOString(), importedEvaluations: imported, source: 'Supervisor QA v4.7' };
    return { imported, updatedStaff, available: true };
  }

  function loadState(storage) {
    const source = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!source) return createInitialState();
    try {
      const raw = source.getItem(STORAGE_KEY);
      if (!raw) return createInitialState();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.staff) || !Array.isArray(parsed.reviews) || !Array.isArray(parsed.exams)) return createInitialState();
      return {
        ...createInitialState(parsed.asOfDate),
        ...parsed,
        staff: parsed.staff,
        reviews: parsed.reviews,
        exams: parsed.exams,
        developmentPlans: Array.isArray(parsed.developmentPlans) ? parsed.developmentPlans : [],
        activity: Array.isArray(parsed.activity) ? parsed.activity : [],
        evidenceSync: parsed.evidenceSync || { lastSyncAt: null, importedEvaluations: 0, source: 'Supervisor QA v4.7' }
      };
    } catch (_) {
      return createInitialState();
    }
  }

  function saveState(state, storage) {
    const target = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!target) return false;
    try {
      target.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (_) {
      return false;
    }
  }

  function addActivity(state, text, time) {
    state.activity = Array.isArray(state.activity) ? state.activity : [];
    state.activity.unshift({ id: `pc-act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time: time || currentDateString(), text: String(text) });
    state.activity = state.activity.slice(0, 40);
  }

  return {
    STORAGE_KEY, QA_STORAGE_KEY, VERSION, CUSTOMER_CARE_MINIMUM, PROMOTION_RULES,
    LEVELS, DEPARTMENTS, KPI_WEIGHTS, EXAM_WEIGHTS,
    createInitialState, calculatePerformanceScore, createReview, getLatestReview,
    getNextLevel, getPromotionEligibility, calculateExamScore, recordPromotionExam,
    getCustomerCareCompliance, deriveDashboardMetrics, getDepartmentSummary,
    addStaff, syncSupervisorQaEvidence, loadState, saveState, addActivity, monthsBetween
  };
});
