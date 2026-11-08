const INTENTS = ['platform_support','account_access','technical_support','sales_enquiry','complaint','personal_guidance','safeguarding','learning_career','social_media','general'];
const LANGUAGES = ['en','ha','yo','ig','pcm'];
const POLICIES: Record<string,{department:string;requiredSkill:string;priority:string}> = {
  platform_support:{department:'RuffNeck Products and Platform Support',requiredSkill:'platform_support',priority:'normal'},
  account_access:{department:'RuffNeck Products and Platform Support',requiredSkill:'account_access',priority:'normal'},
  technical_support:{department:'Technical Support and IT',requiredSkill:'technical_support',priority:'normal'},
  sales_enquiry:{department:'Sales and Service Enquiries',requiredSkill:'sales',priority:'normal'},
  complaint:{department:'Complaints and Service Recovery',requiredSkill:'complaints',priority:'high'},
  personal_guidance:{department:'Personal Development and Wellbeing Information',requiredSkill:'personal_guidance',priority:'normal'},
  safeguarding:{department:'Safeguarding and Trained Human Support',requiredSkill:'safeguarding',priority:'urgent'},
  learning_career:{department:'Learning and Career Development',requiredSkill:'learning_advice',priority:'normal'},
  social_media:{department:'Social Media Support',requiredSkill:'social_support',priority:'normal'},
  general:{department:'General Customer Care',requiredSkill:'general_customer_care',priority:'normal'}
};
const SAFETY = /\b(?:suicid(?:e|al)|self[ -]?harm|kill myself|hurt myself|end my life|want to die|i wan kill myself|i wan harm myself|zan kashe kaina|mo fe pa ara mi|achoro m igbu onwe m|ana duka na|ana-eti m ihe|abuse|rape|sexual assault|violence|being threatened|not safe|in immediate danger)\b/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE = /(?:\+?234[\s().-]?)?(?:0?\d[\s().-]?){9,11}\b/g;
const SECRET = /\b(password|passcode|otp|one[ -]?time code|pin|cvv|cvc|api[ _-]?key|access token|recovery code)\s*(?::|=|\bis\b)?\s*[^\s,;]+/gi;
const LONG_NUMBER = /\b(?:\d[ -]?){13,19}\b/g;
export function cleanChatText(value: unknown, maximum = 3000): string {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,' ').replace(/\r\n?/g,'\n').trim().slice(0,maximum);
}
export function redactChatText(value: unknown): string {
  return cleanChatText(value,3000).replace(SECRET,'$1: [removed for your safety]').replace(EMAIL,'[email removed]').replace(PHONE,'[phone removed]').replace(LONG_NUMBER,'[long number removed]');
}
export function classifyChatIntent(requestedIntent: string, message = '') {
  const safeguarding = SAFETY.test(cleanChatText(message,3000));
  const intent = safeguarding ? 'safeguarding' : INTENTS.includes(requestedIntent) ? requestedIntent : 'general';
  const policy = POLICIES[intent];
  return {intent,department:policy.department,requiredSkill:policy.requiredSkill,priority:safeguarding?'urgent':policy.priority,safeguardingEscalation:safeguarding};
}
export function validatePublicChatInput(input: any) {
  const platformId = cleanChatText(input?.platformId,40);
  const intent = cleanChatText(input?.intent,40);
  const language = cleanChatText(input?.language,8);
  const message = redactChatText(input?.message);
  if (!['ruffneck-learn','ruffneck-prospector','ruffneck-connect','ruffneck-social-hub','kano-run','kano-keke'].includes(platformId)) throw new Error('This website is not configured for CALLORIA web chat.');
  if (!INTENTS.includes(intent)) throw new Error('Choose a valid support topic.');
  if (!LANGUAGES.includes(language)) throw new Error('Choose a supported language.');
  if (message.length < 8) throw new Error('Enter a little more detail so the support team can understand your request.');
  if (input?.consent !== true) throw new Error('Consent is required before a chat can be stored.');
  return {platformId,intent,language,message};
}
