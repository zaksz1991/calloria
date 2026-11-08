/**
 * CALLORIA customer-avatar stage integration.
 *
 * Fixes the v1.4 build failure by making source matching independent of CRLF/LF
 * line endings and by locating the render-function closing brace structurally,
 * rather than requiring one exact multi-line whitespace sequence.
 *
 * Also serializes added customer dialogue with JSON.stringify so dialogue
 * containing line breaks remains valid JavaScript source.
 */
const MAIN_TARGET = '/js/main.js';
const CUSTOMER_ENGINE_TARGET = '/js/customer-intelligence-engine.js';
const CUSTOMER_IMPORT = "import { CUSTOMER_PERSONAS, CUSTOMER_ISSUES, createCustomerScenario, submitCustomerTurn, finalizeCustomerScenario, customerIntelligenceMetrics } from './customer-intelligence-engine.js';";
const MAIN_IMPORT = "import { mountCalloriaCustomerAvatar } from './customer-avatar-stage.js';";
const LATEST_ANCHOR = '    const latest = session.scorecards?.at(-1);';
const STRIP_ANCHOR = '<span class="pill">TURN ${session.turn}/3</span></div><div class="article-box"><div class="subtle-label">CUSTOMER STATEMENT</div>';
const NEXT_FUNCTION_ANCHOR = 'function activeAICloudContext() {';
const AVATAR_STAGE_DECLARATION = "    const avatarStageMarkup = `<div class=\"calloria-customer-stage\" data-calloria-customer-stage data-persona=\"${escapeHTML(session.persona.id)}\" data-emotion=\"${escapeHTML(session.persona.emotion)}\" data-reaction=\"${escapeHTML(latest?.customerReaction || 'steady')}\" data-customer=\"${escapeHTML(session.customer)}\" data-session=\"${escapeHTML(session.id)}\"><div class=\"calloria-customer-stage-loading\">Preparing synthetic customer view…</div><div class=\"calloria-customer-stage-caption\"><span>3D CUSTOMER VIEW · SYNTHETIC PRACTICE</span><b>${escapeHTML(session.persona.label)}</b></div></div>`;";
const PERSONA_ANCHOR = "  { id: 'business', label: 'Business customer under time pressure', patience: 35, emotion: 'urgent', style: 'concise' }";
const CALM_FOLLOWUP_ANCHOR = "    calm: ['Thank you. What should I expect after this conversation?', 'That is clear. Please confirm the reference and next step.']";
const MAIN_MARKER = '__CALLORIA_CUSTOMER_AVATAR_STAGE_V14__';
const ENGINE_MARKER = '__CALLORIA_CUSTOMER_PERSONA_EXPANSION_V14__';

const EXTRA_PERSONAS = [
  { id: 'happy', label: 'Happy and appreciative', patience: 94, emotion: 'happy', style: 'warm and positive' },
  { id: 'playful', label: 'Playful and chatty', patience: 76, emotion: 'playful', style: 'light-hearted and joking' },
  { id: 'impatient', label: 'Impatient and demanding', patience: 22, emotion: 'urgent', style: 'pressing and concise' },
  { id: 'anxious', label: 'Anxious and worried', patience: 36, emotion: 'anxious', style: 'reassurance-seeking' },
  { id: 'skeptical', label: 'Skeptical and questioning', patience: 38, emotion: 'skeptical', style: 'evidence-seeking' },
  { id: 'sarcastic', label: 'Sarcastic but conversational', patience: 30, emotion: 'sarcastic', style: 'indirect and ironic' },
  { id: 'distressed', label: 'Distressed and overwhelmed', patience: 24, emotion: 'distressed', style: 'needs a slower pace' },
  { id: 'hostile', label: 'Hostile and verbally abusive', patience: 12, emotion: 'hostile', style: 'boundary-testing' },
  { id: 'talkative', label: 'Talkative and easily distracted', patience: 62, emotion: 'talkative', style: 'long and digressive' }
];

const EXTRA_FOLLOWUPS = {
  happy: [
    'Thank you, I appreciate your help. Is there anything else I should know?',
    'That is reassuring. Please confirm the next step for me.'
  ],
  playful: [
    'You sound serious today. I am only joking, but I do need this sorted.',
    'Let me ask one more thing before I let you go.'
  ],
  urgent: [
    'I have limited time. Please tell me the action you are taking first.',
    'Can you give me the next step and the expected follow-up clearly?'
  ],
  anxious: [
    'I am worried I may lose access.\nCan you guide me one step at a time?',
    'Please confirm what I should do first so I do not make a mistake.'
  ],
  skeptical: [
    'How can I verify that this is the correct process?',
    'What evidence or reference will show that the request has been recorded?'
  ],
  sarcastic: [
    'Well, that is a different explanation. What actually happens next?',
    'I have heard that before. What specific action can I expect?'
  ],
  distressed: [
    'I am overwhelmed.\nPlease slow down and tell me the first thing I should do.',
    'I need you to explain that again in smaller steps.'
  ],
  hostile: [
    'I am very unhappy with this service. I need a clear answer, not another excuse.',
    'Do not talk over me. Explain the action you are taking.'
  ],
  talkative: [
    'That reminds me of another issue I had last month. Let me explain.',
    'Before we finish, there is one other thing I wanted to mention.'
  ]
};

function count(source, needle) {
  return source.split(needle).length - 1;
}

function requireOnce(context, source, anchor, label) {
  const occurrences = count(source, anchor);
  if (occurrences !== 1) {
    context.error(`CALLORIA customer-avatar integration expected exactly one ${label} anchor (${occurrences} found). Refusing a partial transform.`);
  }
}

function insertBeforeRenderFunctionClose(context, source, nextFunctionAnchor, insertion) {
  requireOnce(context, source, nextFunctionAnchor, 'next function declaration');
  const nextFunctionIndex = source.indexOf(nextFunctionAnchor);
  const prefix = source.slice(0, nextFunctionIndex);
  const closingBraceIndex = prefix.lastIndexOf('}');
  if (closingBraceIndex < 0 || !/^\s*$/.test(prefix.slice(closingBraceIndex + 1))) {
    context.error('CALLORIA customer-avatar integration could not safely identify the Customer Intelligence renderer closing brace. Refusing a partial transform.');
  }
  return `${prefix.slice(0, closingBraceIndex)}\n${insertion}\n${prefix.slice(closingBraceIndex)}${source.slice(nextFunctionIndex)}`;
}

export function calloriaCustomerAvatarPlugin() {
  return {
    name: 'calloria-customer-avatar-stage-v1-4',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');
      // Git checkout/platform settings can produce CRLF. Normalize only the
      // in-memory transform input; no repository source file is rewritten.
      const normalizedSource = String(source).replace(/\r\n?/g, '\n');

      if (normalizedId.endsWith(CUSTOMER_ENGINE_TARGET)) {
        if (normalizedSource.includes(ENGINE_MARKER)) return null;
        requireOnce(this, normalizedSource, PERSONA_ANCHOR, 'customer persona catalogue');
        requireOnce(this, normalizedSource, CALM_FOLLOWUP_ANCHOR, 'customer follow-up map');

        const extraPersonas = EXTRA_PERSONAS.map((persona) => `  ${JSON.stringify(persona)}`).join(',\n');
        const extraFollowups = Object.entries(EXTRA_FOLLOWUPS)
          .map(([key, lines]) => `    ${key}: ${JSON.stringify(lines)}`)
          .join(',\n');

        let code = normalizedSource.replace(
          PERSONA_ANCHOR,
          `${PERSONA_ANCHOR},\n${extraPersonas}`
        );
        code = code.replace(
          CALM_FOLLOWUP_ANCHOR,
          `${CALM_FOLLOWUP_ANCHOR},\n${extraFollowups}`
        );
        code = code.replace(
          'export const CUSTOMER_PERSONAS = Object.freeze([',
          `export const CUSTOMER_PERSONAS = Object.freeze([\n  // ${ENGINE_MARKER}`
        );
        return { code, map: null };
      }

      if (normalizedId.endsWith(MAIN_TARGET)) {
        if (normalizedSource.includes(MAIN_MARKER)) return null;
        requireOnce(this, normalizedSource, CUSTOMER_IMPORT, 'customer intelligence import');
        requireOnce(this, normalizedSource, LATEST_ANCHOR, 'active customer scorecard');
        requireOnce(this, normalizedSource, STRIP_ANCHOR, 'customer profile strip');
        requireOnce(this, normalizedSource, NEXT_FUNCTION_ANCHOR, 'Customer Intelligence Lab following function');

        let code = normalizedSource.replace(
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
        const mountStage = "  const customerAvatarHost = viewRoot.querySelector('[data-calloria-customer-stage]');\n  void mountCalloriaCustomerAvatar(customerAvatarHost).catch(error => console.warn('CALLORIA customer avatar preview failed; customer training remains available.', error));";
        code = insertBeforeRenderFunctionClose(this, code, NEXT_FUNCTION_ANCHOR, mountStage);
        return { code, map: null };
      }

      return null;
    }
  };
}
