/**
 * CALLORIA customer-avatar stage integration.
 * Version-checked Vite transforms keep the existing main.js and customer
 * intelligence engine intact while wiring an approved GLB avatar into the
 * synthetic Customer Intelligence Lab.
 */
const MAIN_TARGET = '/js/main.js';
const CUSTOMER_ENGINE_TARGET = '/js/customer-intelligence-engine.js';

const CUSTOMER_IMPORT = "import { CUSTOMER_PERSONAS, CUSTOMER_ISSUES, createCustomerScenario, submitCustomerTurn, finalizeCustomerScenario, customerIntelligenceMetrics } from './customer-intelligence-engine.js';";
const MAIN_IMPORT = "import { mountCalloriaCustomerAvatar } from './customer-avatar-stage.js';";
const LATEST_ANCHOR = "    const latest = session.scorecards?.at(-1);";
const STRIP_ANCHOR = '<span class="pill">TURN ${session.turn}/3</span></div><div class="article-box"><div class="subtle-label">CUSTOMER STATEMENT</div>';
const CUSTOMER_LAB_END_ANCHOR = '\n}\n\nfunction activeAICloudContext() {';
const AVATAR_STAGE_DECLARATION = "    const avatarStageMarkup = `<div class=\"calloria-customer-stage\" data-calloria-customer-stage data-persona=\"${escapeHTML(session.persona.id)}\" data-emotion=\"${escapeHTML(session.persona.emotion)}\" data-reaction=\"${escapeHTML(latest?.customerReaction || 'steady')}\" data-customer=\"${escapeHTML(session.customer)}\" data-session=\"${escapeHTML(session.id)}\"><div class=\"calloria-customer-stage-loading\">Preparing synthetic customer view…</div><div class=\"calloria-customer-stage-caption\"><span>3D CUSTOMER VIEW · SYNTHETIC PRACTICE</span><b>${escapeHTML(session.persona.label)}</b></div></div>`;";
const PERSONA_ANCHOR = "  { id: 'business', label: 'Business customer under time pressure', patience: 35, emotion: 'urgent', style: 'concise' }";
const CALM_FOLLOWUP_ANCHOR = "    calm: ['Thank you. What should I expect after this conversation?', 'That is clear. Please confirm the reference and next step.']";
const MAIN_MARKER = '__CALLORIA_CUSTOMER_AVATAR_STAGE_V14__';
const ENGINE_MARKER = '__CALLORIA_CUSTOMER_PERSONA_EXPANSION_V14__';

function count(source, needle) {
  return source.split(needle).length - 1;
}
function requireOnce(context, source, anchor, label) {
  const occurrences = count(source, anchor);
  if (occurrences !== 1) {
    context.error(`CALLORIA customer-avatar integration expected exactly one ${label} anchor (${occurrences} found). Refusing a partial transform.`);
  }
}

export function calloriaCustomerAvatarPlugin() {
  return {
    name: 'calloria-customer-avatar-stage-v1-4',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');

      if (normalizedId.endsWith(CUSTOMER_ENGINE_TARGET)) {
        if (source.includes(ENGINE_MARKER)) return null;
        requireOnce(this, source, PERSONA_ANCHOR, 'customer persona catalogue');
        requireOnce(this, source, CALM_FOLLOWUP_ANCHOR, 'customer follow-up map');
        let code = source.replace(
          PERSONA_ANCHOR,
          `${PERSONA_ANCHOR},\n  { id: 'happy', label: 'Happy and appreciative', patience: 94, emotion: 'happy', style: 'warm and positive' },\n  { id: 'playful', label: 'Playful and chatty', patience: 76, emotion: 'playful', style: 'light-hearted and joking' },\n  { id: 'impatient', label: 'Impatient and demanding', patience: 22, emotion: 'urgent', style: 'pressing and concise' },\n  { id: 'anxious', label: 'Anxious and worried', patience: 36, emotion: 'anxious', style: 'reassurance-seeking' },\n  { id: 'skeptical', label: 'Skeptical and questioning', patience: 38, emotion: 'skeptical', style: 'evidence-seeking' },\n  { id: 'sarcastic', label: 'Sarcastic but conversational', patience: 30, emotion: 'sarcastic', style: 'indirect and ironic' },\n  { id: 'distressed', label: 'Distressed and overwhelmed', patience: 24, emotion: 'distressed', style: 'needs a slower pace' },\n  { id: 'hostile', label: 'Hostile and verbally abusive', patience: 12, emotion: 'hostile', style: 'boundary-testing' },\n  { id: 'talkative', label: 'Talkative and easily distracted', patience: 62, emotion: 'talkative', style: 'long and digressive' }`
        );
        code = code.replace(
          CALM_FOLLOWUP_ANCHOR,
          `${CALM_FOLLOWUP_ANCHOR},\n    happy: ['Thank you, I appreciate your help. Is there anything else I should know?', 'That is reassuring. Please confirm the next step for me.'],\n    playful: ['You sound serious today. I am only joking, but I do need this sorted.', 'Let me ask one more thing before I let you go.'],\n    anxious: ['I am worried I may lose access. Can you guide me one step at a time?', 'Please confirm what I should do first so I do not make a mistake.'],\n    skeptical: ['How can I verify that this is the correct process?', 'What evidence or reference will show that the request has been recorded?'],\n    sarcastic: ['Well, that is a different explanation. What actually happens next?', 'I have heard that before. What specific action can I expect?'],\n    distressed: ['I am overwhelmed. Please slow down and tell me the first thing I should do.', 'I need you to explain that again in smaller steps.'],\n    hostile: ['I am very unhappy with this service. I need a clear answer, not another excuse.', 'Do not talk over me. Explain the action you are taking.'],\n    talkative: ['That reminds me of another issue I had last month. Let me explain.', 'Before we finish, there is one other thing I wanted to mention.']`
        );
        code = code.replace(
          'export const CUSTOMER_PERSONAS = Object.freeze([',
          `export const CUSTOMER_PERSONAS = Object.freeze([\n  // ${ENGINE_MARKER}`
        );
        return { code, map: null };
      }

      if (normalizedId.endsWith(MAIN_TARGET)) {
        if (source.includes(MAIN_MARKER)) return null;
        requireOnce(this, source, CUSTOMER_IMPORT, 'customer intelligence import');
        requireOnce(this, source, LATEST_ANCHOR, 'active customer scorecard');
        requireOnce(this, source, STRIP_ANCHOR, 'customer profile strip');
        requireOnce(this, source, CUSTOMER_LAB_END_ANCHOR, 'Customer Intelligence Lab function boundary');

        let code = source.replace(
          CUSTOMER_IMPORT,
          `${CUSTOMER_IMPORT}\n${MAIN_IMPORT}\nconst ${MAIN_MARKER} = true;`
        );
        code = code.replace(
          LATEST_ANCHOR,
          `${LATEST_ANCHOR}\n${AVATAR_STAGE_DECLARATION}`
        );
        code = code.replace(
          STRIP_ANCHOR,
          `<span class="pill">TURN \u0024{session.turn}/3</span></div>\u0024{avatarStageMarkup}<div class="article-box"><div class="subtle-label">CUSTOMER STATEMENT</div>`
        );
        code = code.replace(
          CUSTOMER_LAB_END_ANCHOR,
          `\n  const customerAvatarHost = viewRoot.querySelector('[data-calloria-customer-stage]');\n  void mountCalloriaCustomerAvatar(customerAvatarHost).catch(error => console.warn('CALLORIA customer avatar preview failed; customer training remains available.', error));\n}\n\nfunction activeAICloudContext() {`
        );
        return { code, map: null };
      }
      return null;
    }
  };
}
