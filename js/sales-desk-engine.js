/**
 * CALLORIA Sales Desk rules. Pure functions only; commercial decisions remain
 * subject to current product-owner confirmation and explicit customer consent.
 */
export const SALES_STAGES = Object.freeze({
  new: Object.freeze(['discovery', 'closed_no_interest']),
  discovery: Object.freeze(['recommended', 'closed_no_interest']),
  recommended: Object.freeze(['customer_interested', 'referred_to_platform', 'closed_no_interest']),
  customer_interested: Object.freeze(['referred_to_platform', 'closed_no_interest']),
  referred_to_platform: Object.freeze(['follow_up_due', 'closed_no_interest']),
  follow_up_due: Object.freeze(['referred_to_platform', 'closed_no_interest']),
  closed_no_interest: Object.freeze([])
});

export const NEED_CATEGORIES = Object.freeze([
  'learning_development', 'business_growth', 'community_collaboration',
  'social_media_operations', 'entertainment', 'career_development',
  'customer_care_consultation', 'technical_support', 'product_access', 'cross_platform'
]);

const PRODUCT_FIT = Object.freeze({
  'ruffneck-learn': ['learning_development', 'career_development', 'cross_platform'],
  'ruffneck-prospector': ['business_growth', 'cross_platform'],
  'ruffneck-connect': ['community_collaboration', 'cross_platform'],
  'ruffneck-social-hub': ['social_media_operations', 'business_growth', 'cross_platform'],
  'kano-run': ['entertainment', 'cross_platform'],
  'kano-keke': ['entertainment', 'cross_platform']
});

const clean = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

export function redactSalesSummary(value, maxLength = 700) {
  let text = clean(value).slice(0, maxLength);
  text = text
    .replace(/\b(pin|otp|one[- ]time password|password|passcode|security code)\s*[:#= -]?\s*[a-z0-9-]{3,20}\b/gi, '$1: [REDACTED]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED EMAIL]')
    .replace(/(?:\+?234|0)[ -]?(?:\d[ -]?){9,11}/g, '[REDACTED PHONE]')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, '[REDACTED FINANCIAL NUMBER]');
  return text.slice(0, maxLength);
}

export function validateOpportunity(input = {}) {
  const department = clean(input.department);
  const allowedDepartments = Array.isArray(input.allowedDepartments) ? input.allowedDepartments : [];
  if (!allowedDepartments.includes('*') && !allowedDepartments.includes(department)) {
    throw new Error('The selected department is outside your staff permission scope.');
  }
  const needCategory = clean(input.needCategory);
  if (!NEED_CATEGORIES.includes(needCategory)) throw new TypeError('Select a valid customer need category.');
  const summary = redactSalesSummary(input.needSummary);
  if (summary.length < 12) throw new RangeError('Describe the customer need in at least 12 characters.');
  const sourceChannel = clean(input.sourceChannel);
  if (!['voice', 'email', 'live_chat', 'social', 'whatsapp', 'website', 'portal', 'in_person', 'platform_referral'].includes(sourceChannel)) {
    throw new TypeError('Select a supported enquiry channel.');
  }
  const sourceType = clean(input.sourceType || 'inbound_enquiry');
  if (!['inbound_enquiry', 'customer_requested', 'platform_referral', 'staff_referral'].includes(sourceType)) {
    throw new TypeError('Select a supported opportunity source.');
  }
  return { department, needCategory, needSummary: summary, sourceChannel, sourceType };
}

export function recommendProducts(catalog, needCategory, limit = 3) {
  const products = Array.isArray(catalog?.products) ? catalog.products : [];
  if (!NEED_CATEGORIES.includes(needCategory)) return [];
  const matches = products
    .filter(product => PRODUCT_FIT[product.id]?.includes(needCategory))
    .map(product => ({
      product,
      fitScore: PRODUCT_FIT[product.id].indexOf(needCategory) === 0 ? 96 : 78,
      matchReason: PRODUCT_FIT[product.id].indexOf(needCategory) === 0
        ? 'Direct match to the stated customer need.'
        : 'A related option; confirm suitability with the customer before presenting it.'
    }))
    .sort((a, b) => b.fitScore - a.fitScore || a.product.name.localeCompare(b.product.name));
  return matches.slice(0, Math.max(0, Math.min(3, Math.floor(Number(limit) || 3))));
}

export function canMoveStage(current, next) {
  return Object.hasOwn(SALES_STAGES, current) && SALES_STAGES[current].includes(next);
}

export function getNextStages(stage) {
  return [...(SALES_STAGES[stage] || [])];
}

export function assertRecommendationContext(context, marketingConsent = 'not_recorded') {
  if (!['customer_requested', 'proactive'].includes(context)) throw new TypeError('Select why the recommendation is being presented.');
  if (context === 'proactive' && marketingConsent !== 'granted') {
    throw new Error('Proactive cross-selling is blocked because current marketing consent is not confirmed as granted.');
  }
  return true;
}

export function assertFollowUpConsent(purpose, latestConsent = 'not_recorded') {
  if (!['service_contact', 'marketing'].includes(purpose)) throw new TypeError('Select a valid follow-up purpose.');
  if (latestConsent !== 'granted') throw new Error(`A follow-up cannot be scheduled: current ${purpose.replaceAll('_', ' ')} consent is not recorded as granted.`);
  return true;
}

export function validateFollowUp(input = {}, now = Date.now()) {
  const dueAt = Date.parse(input.dueAt);
  if (!Number.isFinite(dueAt) || dueAt <= now) throw new RangeError('Follow-up must be scheduled for a valid future date and time.');
  if (dueAt > now + 90 * 24 * 60 * 60 * 1000) throw new RangeError('Follow-up must be within the next 90 days.');
  const purpose = clean(input.purpose);
  if (!['service_contact', 'marketing'].includes(purpose)) throw new TypeError('Select a valid follow-up purpose.');
  return { dueAt: new Date(dueAt).toISOString(), purpose };
}
