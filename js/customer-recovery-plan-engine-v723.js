/**
 * CALLORIA v7.23 — evidence-led customer recovery planning.
 * Analyses the simulator's existing Customer 360 metadata only.
 * It never changes cases, ownership, customer messages, QA scores or commitments.
 */
export const CUSTOMER_RECOVERY_PLAN_VERSION = '7.23.0';
export const CUSTOMER_RECOVERY_LEVELS = Object.freeze({
  urgent: Object.freeze({ label: 'URGENT REVIEW', priority: 3 }),
  priority: Object.freeze({ label: 'PRIORITY RECOVERY', priority: 2 }),
  watch: Object.freeze({ label: 'CONTINUITY WATCH', priority: 1 }),
  standard: Object.freeze({ label: 'STANDARD HANDLING', priority: 0 })
});

const DEFAULT_REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000;
const OPEN_RISK = /(?:escalat|review required|action required|overdue|unresolved|reopened)/i;
const CLOSED = /(?:resolved|completed|closed|declined|opt[ -]?out|suppressed|no further action)/i;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function safeText(value, limit = 120) {
  return String(value ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}
function timeOf(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
}
function safeInteractions(context) {
  const profileItems = Array.isArray(context?.profile?.interactions) ? context.profile.interactions : [];
  const contextItems = Array.isArray(context?.interactions) ? context.interactions : [];
  const source = profileItems.length ? profileItems : contextItems;
  const seen = new Set();
  return source.filter(item => {
    if (!item || typeof item !== 'object') return false;
    const id = safeText(item.id || item.reference || `${item.title}:${item.occurredAt}`, 160);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return timeOf(item.occurredAt) !== null;
  }).slice(-50).sort((a, b) => timeOf(b.occurredAt) - timeOf(a.occurredAt));
}
function safeOpenCases(context) {
  const source = Array.isArray(context?.openCases) ? context.openCases : [];
  const seen = new Set();
  return source.filter(item => {
    if (!item || typeof item !== 'object') return false;
    const status = safeText(item.status, 80);
    if (!status || CLOSED.test(status)) return false;
    const ref = safeText(item.caseReference || item.reference || item.id, 120);
    const key = ref || `${safeText(item.title)}:${status}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);
}
function latestValidScore(interactions, field) {
  for (const item of interactions) {
    const value = Number(item?.[field]);
    if (item?.[field] !== null && item?.[field] !== undefined && item?.[field] !== '' && Number.isFinite(value)) {
      return Math.max(0, Math.min(100, value));
    }
  }
  return null;
}

/**
 * Build a recovery plan from Customer 360 history.
 * `now` must use the caller's clock; the current shift view passes the simulated clock.
 */
export function assessCustomerRecoveryPlan(context, {
  channel = 'unknown',
  now = Date.now(),
  repeatWindowMs = DEFAULT_REPEAT_WINDOW_MS
} = {}) {
  const safeNow = Math.max(0, finite(now, Date.now()));
  const safeWindow = Math.min(30 * 24 * 60 * 60 * 1000, Math.max(60 * 60 * 1000, finite(repeatWindowMs, DEFAULT_REPEAT_WINDOW_MS)));
  const interactions = safeInteractions(context);
  const openCases = safeOpenCases(context);
  const currentChannel = safeText(channel, 40).toLowerCase().replace(/[\s-]+/g, '_') || 'unknown';
  const recent = interactions.filter(item => {
    const at = timeOf(item.occurredAt);
    return at !== null && at <= safeNow && safeNow - at <= safeWindow;
  });
  const crossChannel = interactions.some(item => {
    const prior = safeText(item.channel, 40).toLowerCase().replace(/[\s-]+/g, '_');
    return prior && prior !== 'unknown' && currentChannel !== 'unknown' && prior !== currentChannel;
  });
  const lastQa = latestValidScore(interactions, 'qa');
  const lastSentiment = latestValidScore(interactions, 'sentiment');
  const urgentOpenCases = openCases.filter(item => OPEN_RISK.test(safeText(item.status, 80)));
  const reasons = [];
  const actions = [];
  const add = (list, value) => { if (!list.includes(value)) list.push(value); };

  if (urgentOpenCases.length) {
    reasons.push(`${urgentOpenCases.length} outstanding item(s) show escalation or review risk.`);
    add(actions, 'Check the existing escalation or review owner before offering a new resolution.');
  }
  if (openCases.length) {
    reasons.push(`${openCases.length} customer follow-up(s) remain open.`);
    add(actions, 'Open the existing case and continue its recorded next step instead of creating a duplicate.');
  }
  if (recent.length) {
    reasons.push(`${recent.length} earlier contact(s) occurred within the repeat-contact window.`);
    add(actions, 'Acknowledge that the customer has contacted the service before and confirm what remains unresolved.');
  }
  if (crossChannel) {
    reasons.push('The customer has used more than one support channel.');
    add(actions, 'Check the previous channel history so the customer does not need to repeat the full story.');
  }
  if (lastQa !== null && lastQa < 70) {
    reasons.push(`The latest recorded QA result was ${Math.round(lastQa)}%.`);
    add(actions, 'Review the previous handling notes and address any quality gap before making a commitment.');
  }
  if (lastSentiment !== null && lastSentiment < 40) {
    reasons.push('The latest recorded customer sentiment was low.');
    add(actions, 'Use a calm recovery approach, acknowledge the impact and agree a clear next update.');
  }

  let level = 'standard';
  if (urgentOpenCases.length || openCases.length >= 2 || (recent.length >= 3 && (lastQa !== null && lastQa < 70 || lastSentiment !== null && lastSentiment < 40))) {
    level = 'urgent';
  } else if (openCases.length || recent.length || (lastQa !== null && lastQa < 70) || (lastSentiment !== null && lastSentiment < 40)) {
    level = 'priority';
  } else if (context?.repeatCustomer || interactions.length > 0 || crossChannel) {
    level = 'watch';
  }

  if (level === 'standard') {
    actions.push('Confirm the issue, use the approved handling route and record the agreed next step.');
  } else if (level === 'watch') {
    actions.push('Confirm whether this contact relates to an earlier issue before opening a new case.');
  }
  if (level === 'urgent') {
    add(actions, 'Keep the customer updated while the named owner or supervisor reviews the outstanding work.');
  }
  if (!reasons.length && interactions.length) reasons.push('Previous customer history is available; no active recovery risk was identified.');

  return {
    version: CUSTOMER_RECOVERY_PLAN_VERSION,
    level,
    label: CUSTOMER_RECOVERY_LEVELS[level].label,
    priority: CUSTOMER_RECOVERY_LEVELS[level].priority,
    customerFound: context?.found === true || interactions.length > 0,
    interactionCount: Math.max(interactions.length, Math.trunc(finite(context?.profile?.totalInteractions, interactions.length))),
    recentRepeatCount: recent.length,
    openFollowUpCount: openCases.length,
    urgentOpenCount: urgentOpenCases.length,
    crossChannel,
    previousChannelCount: new Set(interactions.map(item => safeText(item.channel, 40)).filter(Boolean)).size,
    lastQa,
    lastSentiment,
    reasons: reasons.slice(0, 5),
    actions: actions.slice(0, 5),
    generatedAt: new Date(safeNow).toISOString(),
    isReadOnly: true
  };
}
