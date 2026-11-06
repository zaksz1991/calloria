export const DEPARTMENTS = [
  { id:'inbound', name:'Inbound Voice', specialty:'Voice service, authentication and resolution' },
  { id:'outbound', name:'Outbound Voice', specialty:'Authorised campaigns, retention and follow-up' },
  { id:'email', name:'Email Support', specialty:'Written enquiries, complaints and case updates' },
  { id:'social', name:'Social Media', specialty:'Public and private social customer care' },
  { id:'chat', name:'Live Chat', specialty:'Real-time digital customer support' },
  { id:'it', name:'IT Support', specialty:'Access, workstation and service-desk support' },
  { id:'qa', name:'Quality Assurance', specialty:'Interaction reviews, coaching and compliance' },
  { id:'cx', name:'Customer Experience', specialty:'Journey improvement, feedback and complaints' },
  { id:'fraud', name:'Fraud & Security', specialty:'Suspicious activity and protective escalation' },
  { id:'backoffice', name:'Back Office', specialty:'Investigations, fulfilment and case processing' }
];

export const SYSTEMS = [
  { id:'icc', name:'ICC', purpose:'Interaction control, queue events and customer satisfaction' },
  { id:'crm', name:'CRM', purpose:'Customer profile, interaction history and cases' },
  { id:'finacle', name:'Finacle', purpose:'Simulated account and transaction inquiry' },
  { id:'firstmobile', name:'FirstMobile', purpose:'Digital banking support scenarios' },
  { id:'ussd', name:'USSD', purpose:'Mobile short-code support scenarios' },
  { id:'postilion', name:'Postilion', purpose:'Card and payment switching investigation' },
  { id:'jira', name:'JIRA', purpose:'Technical incidents and service requests' },
  { id:'fcqa', name:'FCQA', purpose:'Quality evaluation and call review' }
];

export function briefingFor(date = new Date()) {
  const hour = date.getHours(), minute = date.getMinutes();
  const minutes = hour * 60 + minute;
  const morning = minutes >= 450 && minutes < 510;
  const afternoon = minutes >= 840 && minutes < 900;
  const slot = morning ? 'morning' : afternoon ? 'afternoon' : null;
  if (!slot) return null;
  return {
    id: `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}-${slot}`,
    slot, title: morning ? 'Morning operations briefing' : 'Afternoon operations briefing',
    scheduled: morning ? '07:30' : '14:00',
    topics: morning
      ? ['Product and service changes','Policy, process and security notices','Queue priorities and service targets']
      : ['New information and amendments','Open customer-impacting issues','Knowledge check and shift handover']
  };
}

export function recordBriefingAttendance(records, briefing, employeeId = 'PLAYER', now = Date.now()) {
  if (!briefing?.id) throw new TypeError('A valid briefing is required.');
  const list = Array.isArray(records) ? records : [];
  const existing = list.find(x => x.briefingId === briefing.id && x.employeeId === employeeId);
  if (existing) return existing;
  const item = { briefingId: briefing.id, employeeId, slot: briefing.slot, scheduled: briefing.scheduled, attendedAt: new Date(now).toISOString(), status:'attended', source:'simulation' };
  list.push(item); return item;
}

export function promotionScore(metrics = {}) {
  const weights = { kpi:30, qa:20, csat:15, knowledge:15, compliance:10, leadership:10 };
  const score = Object.entries(weights).reduce((sum,[key,weight]) => {
    const value = Math.max(0,Math.min(100,Number(metrics[key] ?? 0)));
    return sum + value * weight / 100;
  },0);
  return Math.round(score * 10) / 10;
}

export function promotionEligibility({ metrics = {}, attempts = [], year = new Date().getFullYear(), minimumScore = 75 } = {}) {
  const used = attempts.filter(x => Number(x.year) === Number(year)).length;
  const total = attempts.length;
  const score = promotionScore(metrics);
  return { score, eligible: total < 3 && used < 1 && score >= minimumScore, attemptsThisYear:used, totalAttempts:total, attemptsRemaining:Math.max(0,3-total), minimumScore };
}

export function recordPromotionExam(attempts, result, now = Date.now()) {
  const list = Array.isArray(attempts) ? attempts : [];
  const year = new Date(now).getFullYear();
  const eligibility = promotionEligibility({ metrics:result.metrics, attempts:list, year, minimumScore:result.minimumScore ?? 75 });
  if (!eligibility.eligible) throw new Error('Promotion examination is not currently available.');
  const passed = Number(result.examScore) >= 70;
  const item = { id:`PROM-${year}-${list.length+1}`, year, examScore:Math.max(0,Math.min(100,Number(result.examScore)||0)), performanceScore:eligibility.score, passed, recordedAt:new Date(now).toISOString(), status:passed?'passed':'not_passed' };
  list.push(item); return item;
}

export function recordCrossSell(records, offer, now = Date.now()) {
  if (!offer?.product || !offer?.customerId) throw new TypeError('Product and simulated customer reference are required.');
  const item = { id:`XS-${now}-${(records?.length||0)+1}`, product:String(offer.product), customerId:String(offer.customerId), relevant:!!offer.relevant, eligible:!!offer.eligible, consent:!!offer.consent, outcome:offer.consent && offer.relevant && offer.eligible ? 'qualified_interest' : 'not_converted', recordedAt:new Date(now).toISOString(), source:'simulation' };
  (Array.isArray(records) ? records : []).push(item); return item;
}

export function recordCommendation(records, input, now = Date.now()) {
  if (!input?.customerId || !input?.message) throw new TypeError('Customer reference and commendation details are required.');
  const item = { id:`COM-${now}-${(records?.length||0)+1}`, customerId:String(input.customerId), message:String(input.message).slice(0,500), route:'official_customer_relations', privateBenefitAccepted:false, status:'referred_for_review', recordedAt:new Date(now).toISOString() };
  (Array.isArray(records) ? records : []).push(item); return item;
}

export function createSystemEvent(events, systemId, action, reference, now = Date.now()) {
  if (!SYSTEMS.some(x => x.id === systemId)) throw new TypeError('Unknown simulated system.');
  const item = { id:`SYS-${now}-${(events?.length||0)+1}`, systemId, action:String(action), reference:String(reference||'SIM-RECORD'), at:new Date(now).toISOString(), dataClass:'synthetic', status:'simulated_only' };
  (Array.isArray(events) ? events : []).push(item); return item;
}
