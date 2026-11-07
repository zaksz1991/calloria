/**
 * CALLORIA AI-assist client boundary.
 * API credentials never enter the browser. Requests are sent only to the
 * authenticated CALLORIA Supabase Edge Function after explicit transcript consent.
 */

export const AI_MODEL_OPTIONS = Object.freeze([
  Object.freeze({ id: 'openai/gpt-oss-20b', label: 'Groq · GPT-OSS 20B · fast review' }),
  Object.freeze({ id: 'openai/gpt-oss-120b', label: 'Groq · GPT-OSS 120B · deeper analysis' })
]);

const clean = value => String(value ?? '').trim();

const CUSTOMER_LAB_ISSUES = new Set(['duplicate-debit', 'mobile-access', 'suspected-fraud', 'failed-transfer', 'service-information', 'repeat-complaint']);
const CUSTOMER_LAB_PERSONAS = new Set(['calm', 'angry', 'confused', 'elderly', 'technical', 'suspicious', 'repeat', 'business']);
const CUSTOMER_LAB_CHANNELS = new Set(['voice', 'email', 'live chat', 'social media']);
const SYNTHETIC_SOURCE = 'calloria_customer_lab_synthetic';

export function isSyntheticCustomerLabInteraction(interaction) {
  const validLegacyId = /^CIL-[A-Z0-9]+$/i.test(clean(interaction?.id));
  const validOrigin = interaction?.dataOrigin === SYNTHETIC_SOURCE || validLegacyId;
  return Boolean(
    validOrigin && validLegacyId &&
    CUSTOMER_LAB_ISSUES.has(clean(interaction?.issueId)) &&
    CUSTOMER_LAB_PERSONAS.has(clean(interaction?.personaId)) &&
    CUSTOMER_LAB_CHANNELS.has(clean(interaction?.channel).toLocaleLowerCase()) &&
    ['completed', 'escalated'].includes(clean(interaction?.status)) &&
    Array.isArray(interaction?.aiTranscript || interaction?.transcript) && (interaction.aiTranscript || interaction.transcript).length > 0
  );
}

export function validateAIAssistSettings(input = {}) {
  const model = clean(input.model || 'openai/gpt-oss-20b');
  if (!AI_MODEL_OPTIONS.some(option => option.id === model)) {
    throw new TypeError('Select a supported CALLORIA AI model.');
  }
  const dailyRequestLimit = Number(input.dailyRequestLimit ?? input.daily_request_limit ?? 100);
  if (!Number.isInteger(dailyRequestLimit) || dailyRequestLimit < 1 || dailyRequestLimit > 5000) {
    throw new RangeError('The daily AI request limit must be between 1 and 5,000.');
  }
  return {
    enabled: input.enabled === true,
    model,
    dailyRequestLimit,
    redactionRequired: true
  };
}

const REDACTION_PATTERNS = [
  { pattern: /\b(pin|otp|one[- ]time password|password|passcode|security code)\s*[:#= -]?\s*\d{3,12}\b/gi, replacement: '$1: [REDACTED CREDENTIAL]' },
  { pattern: /\b(?:account|acct|card)\s*(?:number|no\.?|#)?\s*[:#= -]?\s*\d{6,19}\b/gi, replacement: '[REDACTED ACCOUNT OR CARD NUMBER]' },
  { pattern: /\b\d{10,19}\b/g, replacement: '[REDACTED LONG NUMBER]' },
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: '[REDACTED EMAIL]' }
];

export function redactTranscriptForAI(transcript) {
  if (!Array.isArray(transcript) || transcript.length < 1 || transcript.length > 40) {
    throw new RangeError('Select an interaction containing 1 to 40 transcript lines.');
  }
  let total = 0;
  const safeTranscript = transcript.map((line, index) => {
    const speaker = clean(line?.speaker || 'unknown').slice(0, 24);
    let text = clean(line?.text);
    if (!text) throw new TypeError(`Transcript line ${index + 1} is empty.`);
    if (text.length > 700) text = text.slice(0, 700);
    for (const rule of REDACTION_PATTERNS) text = text.replace(rule.pattern, rule.replacement);
    total += text.length;
    return { speaker, text };
  });
  if (total > 9000) throw new RangeError('This interaction is too long for one AI review.');
  return safeTranscript;
}

export function validateAIAssistResult(input, transcript = []) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('The AI service returned an invalid analysis.');
  const sentiments = ['positive', 'neutral', 'negative', 'distressed', 'mixed'];
  const sentiment = sentiments.includes(input.sentiment) ? input.sentiment : 'neutral';
  const safeLines = redactTranscriptForAI(transcript);
  const lineTexts = safeLines.map(line => line.text.toLocaleLowerCase());
  const suggestions = (Array.isArray(input.qaSuggestions) ? input.qaSuggestions : []).slice(0, 8).map(item => {
    const quote = clean(item?.evidenceQuote).slice(0, 700);
    const evidenceVerified = Boolean(quote) && lineTexts.some(text => text.includes(quote.toLocaleLowerCase()));
    const rating = Number(item?.suggestedRating);
    return {
      criterion: clean(item?.criterion).slice(0, 100) || 'Unspecified criterion',
      suggestedRating: Number.isInteger(rating) ? Math.min(5, Math.max(0, rating)) : null,
      rationale: clean(item?.rationale).slice(0, 500),
      evidenceQuote: quote,
      evidenceVerified
    };
  });
  return {
    sentiment,
    customerIntent: clean(input.customerIntent).slice(0, 300),
    interactionSummary: clean(input.interactionSummary).slice(0, 1200),
    riskFlags: (Array.isArray(input.riskFlags) ? input.riskFlags : []).map(value => clean(value).slice(0, 160)).filter(Boolean).slice(0, 8),
    qaSuggestions: suggestions,
    coachingRecommendations: (Array.isArray(input.coachingRecommendations) ? input.coachingRecommendations : []).map(value => clean(value).slice(0, 400)).filter(Boolean).slice(0, 8),
    followUpChecklist: (Array.isArray(input.followUpChecklist) ? input.followUpChecklist : []).map(value => clean(value).slice(0, 300)).filter(Boolean).slice(0, 8),
    humanApprovalRequired: true,
    disclaimer: 'AI-generated practice guidance. Not an official QA score, employment decision, compliance finding or substitute for a human reviewer.'
  };
}

export async function loadTenantAIAssistSettings(client, organizationId) {
  if (!client || !organizationId) throw new TypeError('An authenticated organisation client is required.');
  const { data, error } = await client.from('calloria_ai_settings')
    .select('organization_id,enabled,model,daily_request_limit,redaction_required,updated_at')
    .eq('organization_id', organizationId).maybeSingle();
  if (error) throw error;
  if (!data) return { enabled: false, model: 'openai/gpt-oss-20b', dailyRequestLimit: 100, redactionRequired: true, configured: false };
  return { ...validateAIAssistSettings(data), redactionRequired: data.redaction_required !== false, configured: true, updatedAt: data.updated_at || null };
}

export async function saveTenantAIAssistSettings(client, organizationId, userId, input) {
  if (!client || !organizationId || !userId) throw new TypeError('An authenticated organisation administrator is required.');
  const settings = validateAIAssistSettings(input);
  const payload = {
    organization_id: organizationId,
    enabled: settings.enabled,
    model: settings.model,
    daily_request_limit: settings.dailyRequestLimit,
    redaction_required: true,
    updated_by: userId,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await client.from('calloria_ai_settings').upsert(payload, { onConflict: 'organization_id' }).select('organization_id,enabled,model,daily_request_limit,redaction_required,updated_at').single();
  if (error) throw error;
  return { ...validateAIAssistSettings(data), redactionRequired: data.redaction_required !== false, configured: true, updatedAt: data.updated_at || null };
}

export async function requestAIAssist(client, { organizationId, interaction }) {
  if (!client || !organizationId) throw new TypeError('Sign in to an active organisation workspace before using AI assistance.');
  if (!interaction?.id) throw new TypeError('Select a completed practice interaction.');
  if (!isSyntheticCustomerLabInteraction(interaction)) throw new TypeError('AI assistance accepts only completed CALLORIA Customer Lab synthetic practice records.');
  const transcript = redactTranscriptForAI(interaction.aiTranscript || interaction.transcript);
  const { data, error } = await client.functions.invoke('calloria-ai-assist', {
    body: {
      organizationId,
      syntheticTrainingData: true,
      interaction: {
        id: clean(interaction.id).slice(0, 100),
        dataOrigin: SYNTHETIC_SOURCE,
        status: clean(interaction.status),
        issueId: clean(interaction.issueId).slice(0, 80),
        personaId: clean(interaction.personaId).slice(0, 80),
        channel: clean(interaction.channel).slice(0, 40),
        transcript
      }
    }
  });
  if (error) throw new Error(error.message || 'The AI service could not complete the request.');
  const analysis = validateAIAssistResult(data?.analysis, transcript);
  return {
    id: `AIA-${Date.now().toString(36).toUpperCase()}`,
    interactionId: interaction.id,
    model: clean(data?.model || 'Configured organisation model').slice(0, 80),
    createdAt: new Date().toISOString(),
    usageRemaining: Number.isFinite(Number(data?.usageRemaining)) ? Number(data.usageRemaining) : null,
    analysis
  };
}
