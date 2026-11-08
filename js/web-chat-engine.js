export const WEB_CHAT_CHANNEL = 'live_chat';
export const WEB_CHAT_LANGUAGES = Object.freeze(['en', 'ha', 'yo', 'ig', 'pcm']);
export const WEB_CHAT_INTENTS = Object.freeze([
  'platform_support', 'account_access', 'technical_support', 'sales_enquiry',
  'complaint', 'personal_guidance', 'safeguarding', 'learning_career',
  'social_media', 'general'
]);

const INTENT_POLICY = Object.freeze({
  platform_support: { department: 'RuffNeck Products and Platform Support', skill: 'platform_support', priority: 'normal' },
  account_access: { department: 'RuffNeck Products and Platform Support', skill: 'account_access', priority: 'normal' },
  technical_support: { department: 'Technical Support and IT', skill: 'technical_support', priority: 'normal' },
  sales_enquiry: { department: 'Sales and Service Enquiries', skill: 'sales', priority: 'normal' },
  complaint: { department: 'Complaints and Service Recovery', skill: 'complaints', priority: 'high' },
  personal_guidance: { department: 'Personal Development and Wellbeing Information', skill: 'personal_guidance', priority: 'normal' },
  safeguarding: { department: 'Safeguarding and Trained Human Support', skill: 'safeguarding', priority: 'urgent' },
  learning_career: { department: 'Learning and Career Development', skill: 'learning_advice', priority: 'normal' },
  social_media: { department: 'Social Media Support', skill: 'social_support', priority: 'normal' },
  general: { department: 'General Customer Care', skill: 'general_customer_care', priority: 'normal' }
});

const PRODUCT_CATALOGUE = Object.freeze({
  'ruffneck-learn': { name: 'RuffNeck Learn', url: 'https://ruffneck-lms.vercel.app/', help: [
    { title: 'Find a course', steps: ['Open the course library.', 'Review the course subject, level and description.', 'Sign in or create an account where required.', 'Follow the enrolment instructions shown on the current course page.'] },
    { title: 'Choose a learning pathway', steps: ['Clarify your goal and current skill level.', 'Compare it with the subjects and levels shown in the course library.', 'Confirm current availability and pricing on the live course page.'] }
  ] },
  'ruffneck-prospector': { name: 'RuffNeck Prospector', url: 'https://ruffneck-prospector.vercel.app/', help: [
    { title: 'Discover potential customers', steps: ['Open Discover.', 'Enter a service niche and relevant search intent.', 'Review source context and relevance.', 'Save suitable results and review them in Prospects or Pipeline.'] },
    { title: 'Generate a prospect asset', steps: ['Choose a prospect or campaign context.', 'Open Generate.', 'Choose an available PDF guide or slide deck.', 'Review accuracy before sharing.'] }
  ] },
  'ruffneck-connect': { name: 'RuffNeck Connect', url: 'https://ruffneck-connect.vercel.app/', help: [
    { title: 'Find a community', steps: ['Open the platform and choose Get started or sign in.', 'Explore communities by interest, location or goal.', 'Open a relevant community and follow its join instructions.'] },
    { title: 'Post a need or offer', steps: ['Open a relevant community or posting area.', 'Describe the need or contribution clearly.', 'Include practical details and the expected next step.', 'Continue through the platform conversation tools.'] }
  ] },
  'ruffneck-social-hub': { name: 'RuffNeck Social Hub', url: 'https://ruffneck-social-hub.vercel.app/', help: [
    { title: 'Access an organisation workspace', steps: ['Open the platform and select Sign in.', 'Use the account associated with the organisation.', 'Ask the organisation administrator to verify membership and role if access is denied.', 'Never share passwords, access tokens or one-time codes with support.'] }
  ] },
  'kano-run': { name: 'Kano Run / Kano Life', url: 'https://kano-run.vercel.app/', help: [
    { title: 'Start playing', steps: ['Choose a route, driver and mode.', 'Select Start Driving.', 'Use A/D or the arrow keys, or use touch controls to change lanes.', 'Use gas and brake controls. Slow almost completely at pickup and drop-off pads.'] },
    { title: 'Resolve a performance issue', steps: ['Pause the game.', 'Check browser compatibility and available device memory.', 'Reload if the session becomes unresponsive.', 'Report the device, browser, game mode and exact issue if it persists.'] }
  ] },
  'kano-keke': { name: 'Kano Keke', url: 'https://kano-keke.vercel.app/', help: [
    { title: 'Start a shift', steps: ['Select a driver.', 'Choose a Kano route, keke, road and game mode.', 'Review the tutorial if needed.', 'Select Start Shift.'] },
    { title: 'Garage and rewards', steps: ['Open the daily reward area to review the available reward.', 'Open Garajin Keke Shop to review the options currently displayed.', 'Confirm availability and any current costs in the live game.'] }
  ] }
});

const SAFETY_PATTERN = /\b(?:suicid(?:e|al)|self[ -]?harm|kill myself|hurt myself|end my life|want to die|i wan kill myself|i wan harm myself|zan kashe kaina|mo fe pa ara mi|achoro m igbu onwe m|ana duka na|ana-eti m ihe|abuse|rape|sexual assault|violence|being threatened|not safe|in immediate danger)\b/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?:\+?234[\s().-]?)?(?:0?\d[\s().-]?){9,11}\b/g;
const SECRET_PATTERN = /\b(password|passcode|otp|one[ -]?time code|pin|cvv|cvc|api[ _-]?key|access token|recovery code)\s*(?::|=|\bis\b)?\s*[^\s,;]+/gi;
const LONG_NUMBER_PATTERN = /\b(?:\d[ -]?){13,19}\b/g;

export function cleanChatText(value, maximum = 3000) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').replace(/\r\n?/g, '\n').trim().slice(0, maximum);
}

export function redactChatText(value) {
  return cleanChatText(value, 3000)
    .replace(SECRET_PATTERN, '$1: [removed for your safety]')
    .replace(EMAIL_PATTERN, '[email removed]')
    .replace(PHONE_PATTERN, '[phone removed]')
    .replace(LONG_NUMBER_PATTERN, '[long number removed]');
}

export function classifyChatIntent(requestedIntent, message = '') {
  const safeMessage = cleanChatText(message, 3000);
  const safeguarding = SAFETY_PATTERN.test(safeMessage);
  const intent = safeguarding ? 'safeguarding' : WEB_CHAT_INTENTS.includes(requestedIntent) ? requestedIntent : 'general';
  const policy = INTENT_POLICY[intent];
  return Object.freeze({
    intent,
    department: policy.department,
    requiredSkill: policy.skill,
    priority: safeguarding ? 'urgent' : policy.priority,
    safeguardingEscalation: safeguarding
  });
}

export function getProductHelp(platformId) {
  const product = PRODUCT_CATALOGUE[platformId];
  if (!product) return null;
  return { ...product, help: product.help.map(item => ({ ...item, steps: [...item.steps] })) };
}

export function validatePublicChatInput(input) {
  const platformId = cleanChatText(input?.platformId, 40);
  const intent = cleanChatText(input?.intent, 40);
  const language = cleanChatText(input?.language, 8);
  const message = redactChatText(input?.message);
  if (!PRODUCT_CATALOGUE[platformId]) throw new Error('This website is not configured for CALLORIA web chat.');
  if (!WEB_CHAT_INTENTS.includes(intent)) throw new Error('Choose a valid support topic.');
  if (!WEB_CHAT_LANGUAGES.includes(language)) throw new Error('Choose a supported language.');
  if (message.length < 8) throw new Error('Enter a little more detail so the support team can understand your request.');
  if (input?.consent !== true) throw new Error('Consent is required before a chat can be stored.');
  return { platformId, intent, language, message };
}

export const WEB_CHAT_PRODUCTS = Object.freeze(Object.keys(PRODUCT_CATALOGUE));
