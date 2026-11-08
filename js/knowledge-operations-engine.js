export const KNOWLEDGE_TYPES = ['article', 'platform', 'service'];
export const KNOWLEDGE_STATUSES = ['draft', 'in_review', 'changes_requested', 'approved', 'published', 'rejected', 'retired'];
export const PRODUCT_IDS = ['ruffneck-learn', 'ruffneck-prospector', 'ruffneck-connect', 'ruffneck-social-hub', 'kano-run', 'kano-keke'];
export const CATEGORIES = ['platform_support','product_knowledge','service_enquiry','complaint_recovery','personal_development','relationships','parenting','psychology','wellbeing','career_development','emotional_intelligence','ethics','safeguarding','security','general'];
const clean = (value, max = 600) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const list = (value, maxItems = 40, maxLength = 180) => (Array.isArray(value) ? value : String(value ?? '').split('\n')).map(v => clean(v, maxLength)).filter(Boolean).slice(0, maxItems);
export function normalizePayload(type, raw) {
  if (!KNOWLEDGE_TYPES.includes(type)) throw new TypeError('Choose article, platform or service knowledge.');
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  if (type === 'article') {
    const body = String(value.body ?? '').trim().slice(0, 12000);
    if (body.length < 30) throw new TypeError('Knowledge article body must contain at least 30 characters.');
    return { category: clean(value.category || 'general', 80), body, tags: list(value.tags), audience: ['customer','staff','both'].includes(value.audience) ? value.audience : 'customer' };
  }
  if (type === 'service') {
    const description = clean(value.description, 5000), name = clean(value.name, 180);
    if (name.length < 3 || description.length < 20) throw new TypeError('Service name and a useful description are required.');
    return { name, description, category: clean(value.category || 'service', 80), active: value.active !== false };
  }
  const name = clean(value.name, 180), url = clean(value.url, 400), purpose = clean(value.purpose, 1600);
  if (name.length < 3 || !/^https:\/\//i.test(url) || purpose.length < 20) throw new TypeError('Platform name, HTTPS URL and purpose are required.');
  const selfService = (Array.isArray(value.self_service) ? value.self_service : []).slice(0, 30).map(item => ({ task: clean(item?.task, 180), steps: list(item?.steps, 20, 500) })).filter(item => item.task && item.steps.length);
  return { name, url, purpose, features: list(value.features), support_topics: list(value.support_topics), self_service: selfService, limitations: clean(value.limitations, 1800), active: value.active !== false };
}
export function validateKnowledgeDraft(input) {
  const type = clean(input?.record_type, 20);
  const key = clean(input?.record_key, 100).toLowerCase();
  const title = clean(input?.title, 180);
  const category = clean(input?.category || 'general', 80);
  const changeSummary = clean(input?.change_summary, 600);
  if (!KNOWLEDGE_TYPES.includes(type)) throw new TypeError('Unsupported knowledge record type.');
  if (!/^[a-z0-9][a-z0-9-]{1,99}$/.test(key)) throw new TypeError('Use a lowercase slug containing letters, numbers and hyphens.');
  if (title.length < 2) throw new TypeError('A clear title is required.');
  if (changeSummary.length < 3) throw new TypeError('Describe what changed and why.');
  const sourceUrl = clean(input?.source_url, 400);
  if (sourceUrl) { try { const url = new URL(sourceUrl); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); } catch { throw new TypeError('Source URL must be a valid HTTPS address without embedded credentials.'); } }
  const sourceVerifiedAt = input?.source_verified_at ? new Date(input.source_verified_at).toISOString() : null;
  return { record_type: type, record_key: key, title, category, payload: normalizePayload(type, input?.payload), change_summary: changeSummary, source_url: sourceUrl || null, source_verified_at: sourceVerifiedAt };
}
export function sourceIsRequired(record) {
  if (record.record_type === 'platform' || record.record_type === 'service') return true;
  return ['psychology','wellbeing','parenting','safeguarding','security','health','legal','financial','product_knowledge','platform_support','service_enquiry','complaint_recovery','pricing','plans'].includes(clean(record.category, 80).toLowerCase());
}
export function sourceFresh(record, now = Date.now(), maxAgeDays = 180) {
  if (!sourceIsRequired(record)) return true;
  if (!record.source_url || !record.source_verified_at) return false;
  const timestamp = new Date(record.source_verified_at).getTime();
  return Number.isFinite(timestamp) && timestamp <= now && now - timestamp <= maxAgeDays * 86400000;
}
export function canReview(record, reviewerId) { return Boolean(record && reviewerId && record.authored_by !== reviewerId && ['in_review'].includes(record.status)); }
export function normaliseRecord(row) {
  if (!row || typeof row !== 'object') return null;
  return { id: clean(row.id, 60), record_type: clean(row.record_type, 20), record_key: clean(row.record_key, 100), title: clean(row.title, 180), category: clean(row.category, 80), payload: row.payload && typeof row.payload === 'object' ? row.payload : {}, status: KNOWLEDGE_STATUSES.includes(row.status) ? row.status : 'draft', version: Math.max(1, Number(row.version) || 1), change_summary: clean(row.change_summary, 600), source_url: clean(row.source_url, 400), source_verified_at: row.source_verified_at || null, authored_by: clean(row.authored_by, 60), reviewed_by: clean(row.reviewed_by, 60), updated_at: row.updated_at || null };
}
export function formatKnowledgeType(type) { return ({ article: 'Knowledge article', platform: 'RuffNeck platform', service: 'RuffNeck service' })[type] || 'Knowledge record'; }
export function formatStatus(status) { return ({ draft: 'Draft', in_review: 'Awaiting review', changes_requested: 'Changes requested', approved: 'Approved for publication', published: 'Published', rejected: 'Rejected', retired: 'Retired' })[status] || 'Unknown'; }
