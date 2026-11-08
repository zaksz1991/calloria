/** Pure rules for CALLORIA skills-based contact routing. No network or browser APIs. */
export const DEPARTMENTS = Object.freeze([
  'RuffNeck Products and Platform Support', 'Sales and Service Enquiries',
  'Complaints and Service Recovery', 'Personal Development and Wellbeing Information',
  'General Customer Care', 'Email and Written Support', 'Social Media Support',
  'Technical Support and IT', 'Quality Assurance and Customer Experience',
  'Safeguarding and Trained Human Support', 'Learning and Career Development'
]);
export const CHANNELS = Object.freeze(['voice','email','live_chat','social','whatsapp','sms','website','portal','game','back_office']);
export const LANGUAGES = Object.freeze(['en','ha','yo','ig','pcm']);
export const PRIORITIES = Object.freeze(['low','normal','high','urgent']);
export const PLATFORMS = Object.freeze([
  { id:'ruffneck-learn', name:'RuffNeck Learn', url:'https://ruffneck-lms.vercel.app/' },
  { id:'ruffneck-prospector', name:'RuffNeck Prospector', url:'https://ruffneck-prospector.vercel.app/' },
  { id:'ruffneck-connect', name:'RuffNeck Connect', url:'https://ruffneck-connect.vercel.app/' },
  { id:'ruffneck-social-hub', name:'RuffNeck Social Hub', url:'https://ruffneck-social-hub.vercel.app/' },
  { id:'kano-run', name:'Kano Run / Kano Life', url:'https://kano-run.vercel.app/' },
  { id:'kano-keke', name:'Kano Keke', url:'https://kano-keke.vercel.app/' }
]);
export const INTENTS = Object.freeze({
  platform_support: { department:DEPARTMENTS[0], skill:'platform_support', priority:'normal', title:'RuffNeck product or platform support' },
  account_access: { department:DEPARTMENTS[0], skill:'account_access', priority:'normal', title:'Account access and sign-in' },
  technical_support: { department:DEPARTMENTS[7], skill:'technical_support', priority:'normal', title:'Technical support' },
  sales_enquiry: { department:DEPARTMENTS[1], skill:'sales', priority:'normal', title:'Products, services and pricing enquiry' },
  complaint: { department:DEPARTMENTS[2], skill:'complaints', priority:'high', title:'Complaint or service recovery' },
  personal_guidance: { department:DEPARTMENTS[3], skill:'personal_guidance', priority:'normal', title:'Personal development and general guidance' },
  safeguarding: { department:DEPARTMENTS[9], skill:'safeguarding', priority:'urgent', title:'Safety or safeguarding support' },
  learning_career: { department:DEPARTMENTS[10], skill:'learning_advice', priority:'normal', title:'Learning and career development' },
  social_media: { department:DEPARTMENTS[6], skill:'social_support', priority:'normal', title:'Social media support' },
  general: { department:DEPARTMENTS[4], skill:'general_customer_care', priority:'normal', title:'General customer care' }
});
const SENSITIVE = [
  [/\b(pin|otp|one[- ]time password|password|passcode|security code)\s*[:#= -]?\s*[a-z0-9-]{3,20}\b/gi, '$1: [REDACTED]'],
  [/\b(account|acct|bank account|card)\s*(number)?\s*[:#= -]?\s*\d{6,19}\b/gi, '$1 number: [REDACTED]'],
  [/\b(api[_ -]?key|access[_ -]?token|authorization|bearer)\s*[:#= -]?\s*[A-Za-z0-9._~+/-]{12,}\b/gi, '$1: [REDACTED]'],
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED EMAIL]'],
  [/(?:\+?234|0)[ -]?(?:\d[ -]?){9,11}/g, '[REDACTED PHONE]'],
  [/\b(?:\d[ -]?){13,19}\b/g, '[REDACTED FINANCIAL NUMBER]']
];
export function cleanText(value, max = 600) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
export function redactSensitive(value) {
  return SENSITIVE.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), cleanText(value, 600));
}
export function validateCustomerRequest(input = {}) {
  const platformId = cleanText(input.platformId, 40);
  const intent = cleanText(input.intent, 40);
  const language = cleanText(input.language, 8);
  const subject = cleanText(input.subject, 140);
  const summary = redactSensitive(input.summary);
  if (!Object.hasOwn(INTENTS, intent)) throw new Error('Choose the type of help you need.');
  if (platformId && !PLATFORMS.some(item => item.id === platformId)) throw new Error('Choose a valid RuffNeck platform or game.');
  if (!LANGUAGES.includes(language)) throw new Error('Choose a supported language.');
  if (subject.length < 4) throw new Error('Enter a short subject of at least four characters.');
  if (summary.length < 12) throw new Error('Describe the request in at least twelve characters.');
  const selected = INTENTS[intent];
  return {
    platformId:platformId || null, intent, language, subject, summary,
    department:selected.department, requiredSkills:[selected.skill], priority:selected.priority,
    channel:platformId === 'kano-run' || platformId === 'kano-keke' ? 'game' : 'portal'
  };
}
export function priorityRank(priority) {
  const index = PRIORITIES.indexOf(priority);
  return index < 0 ? PRIORITIES.indexOf('normal') : index;
}
export function effectivePriority(priority, createdAt, now = Date.now()) {
  const base = priorityRank(priority);
  if (priority === 'urgent') return 0;
  const ageMinutes = Math.max(0, (now - new Date(createdAt).getTime()) / 60000);
  if (!Number.isFinite(ageMinutes)) return base;
  // Waiting non-urgent items rise over time but can never outrank urgent safeguarding work.
  const agingSteps = Math.floor(ageMinutes / 30);
  return Math.max(1, base - agingSteps);
}
export function scoreAgentForRoute(agent, route, activeCount = 0, now = Date.now()) {
  if (!agent || agent.enabled === false) return null;
  if (!Array.isArray(agent.departments) || !agent.departments.includes(route.department)) return null;
  if (!Array.isArray(agent.channels) || !agent.channels.includes(route.channel)) return null;
  if (!Array.isArray(agent.languages) || !agent.languages.includes(route.language)) return null;
  const required = Array.isArray(route.required_skills) ? route.required_skills : [];
  const skills = Array.isArray(agent.skills) ? agent.skills : [];
  if (required.some(skill => !skills.includes(skill))) return null;
  const capacity = Math.max(1, Math.min(10, Number(agent.maxConcurrency) || 1));
  if (activeCount >= capacity) return null;
  const skillBreadth = skills.length;
  const waitSeconds = Math.max(0, (now - new Date(agent.lastAssignedAt || 0).getTime()) / 1000);
  const skillSpecificity = required.length ? required.length * 4 : 0;
  return {
    agentId:agent.id,
    score: (capacity - activeCount) * 100 + Math.min(waitSeconds / 60, 60) - skillBreadth * 0.25 + skillSpecificity,
    remainingCapacity:capacity - activeCount
  };
}
export function selectBestAgent(route, agents, activeCounts = {}, now = Date.now()) {
  return (agents || []).map(agent => scoreAgentForRoute(agent, route, activeCounts[agent.id] || 0, now))
    .filter(Boolean).sort((a,b) => b.score - a.score || a.agentId.localeCompare(b.agentId))[0] || null;
}
export function queueMetrics(items = [], now = Date.now()) {
  const counts = Object.fromEntries(PRIORITIES.map(priority => [priority, 0]));
  let oldest = null;
  const channels = {};
  for (const item of items) {
    if (item.status !== 'queued') continue;
    counts[PRIORITIES.includes(item.priority) ? item.priority : 'normal'] += 1;
    channels[item.channel] = (channels[item.channel] || 0) + 1;
    const entered = new Date(item.created_at).getTime();
    if (Number.isFinite(entered) && (oldest === null || entered < oldest)) oldest = entered;
  }
  return {
    queued: Object.values(counts).reduce((sum, count) => sum + count, 0),
    counts, channels,
    oldestWaitSeconds: oldest === null ? null : Math.max(0, Math.floor((now - oldest) / 1000))
  };
}
