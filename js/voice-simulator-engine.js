const SCENARIOS = [
  {
    id: 'learn-course-access', title: 'RuffNeck Learn — course access', group: 'RuffNeck platforms', platform: 'RuffNeck Learn', department: 'RuffNeck Products and Platform Support', persona: 'Confused learner', emotion: 'confused', language: 'en-NG',
    opening: "Hello. I enrolled in a digital skills course, but I cannot find where to continue my lessons. I am not very comfortable with these apps.",
    issue: 'The learner needs calm, step-by-step navigation help. Do not claim to see their account or payment status.', needsVerification: true, crisis: false, requestedRecommendation: false, marketingConsentOnAsk: false,
    discovery: "The learner is using a phone and is unsure whether they signed in with the same email they used when enrolling.",
    guidance: 'Guide them to open RuffNeck Learn, sign in with the account used for enrolment, open their learning area and select the enrolled course. If it is still missing, use the platform support route for an account-level check.',
    replies: { empathy: 'Thank you for being patient with me. I was worried I had lost the course.', probe: 'I used a different email address on my phone before. I am not sure which one I used.', explain: 'I understand. Please do not share your password or any sign-in code with me.', guide: 'I can follow one step at a time. I can see the learning area now.', confirm: 'Yes, I can see the course list. I understand what to do next.' }
  },
  {
    id: 'prospector-lead-workflow', title: 'RuffNeck Prospector — lead workflow', group: 'RuffNeck platforms', platform: 'RuffNeck Prospector', department: 'RuffNeck Products and Platform Support', persona: 'Small business owner', emotion: 'neutral', language: 'en-NG',
    opening: 'I am trying to organise prospects for my small business. I need to understand how Prospector can help me prioritise who to contact.',
    issue: 'Explain the product at a high level; distinguish prospecting support from guaranteed sales results.', needsVerification: false, crisis: false, requestedRecommendation: true, marketingConsentOnAsk: false,
    discovery: 'The caller needs a simple workflow and wants to know whether using the tool guarantees customers.',
    guidance: 'Explain that Prospector supports lead discovery, prospect scoring and pipeline organisation. Recommend reviewing each lead and validating fit; do not promise conversion, revenue or lead accuracy without current evidence.',
    replies: { empathy: 'I appreciate that. I do not want to waste time chasing the wrong people.', probe: 'I mainly need a way to keep the prospects organised and decide who to approach first.', explain: 'That makes sense. I understand it helps organise the work, but it cannot guarantee a sale.', guide: 'A simple prioritised list and a follow-up routine would help me.', confirm: 'That is clear. I understand what the platform is for.' }
  },
  {
    id: 'connect-community', title: 'RuffNeck Connect — community participation', group: 'RuffNeck platforms', platform: 'RuffNeck Connect', department: 'RuffNeck Products and Platform Support', persona: 'First-time community member', emotion: 'uncertain', language: 'en-NG',
    opening: 'I found RuffNeck Connect. I want to join a community, but I am not sure how to participate safely or what I should post.',
    issue: 'Explain community participation and privacy-conscious conduct without guaranteeing moderation outcomes.', needsVerification: false, crisis: false, requestedRecommendation: false, marketingConsentOnAsk: false,
    discovery: 'The caller wants to connect around shared interests and is worried about oversharing personal information.',
    guidance: 'Explain that Connect is for community, collaboration and purposeful conversations. Encourage them to read community rules, share only appropriate information and use platform reporting or support tools for concerns.',
    replies: { empathy: 'I just want to meet useful people without exposing too much about myself.', probe: 'I am interested in learning and collaboration, not random messages.', explain: 'That sounds more appropriate. I will check the rules before posting.', guide: 'I can start with a short introduction and avoid sharing private details.', confirm: 'Good. I know how to get started more carefully.' }
  },
  {
    id: 'social-hub-campaign', title: 'RuffNeck Social Hub — campaign operations', group: 'RuffNeck platforms', platform: 'RuffNeck Social Hub', department: 'RuffNeck Products and Platform Support', persona: 'Marketing coordinator', emotion: 'neutral', language: 'en-NG',
    opening: 'Our team is considering Social Hub to coordinate work across our social media brands. What should we understand before we start?',
    issue: 'Describe the workspace accurately at a high level. Do not imply every network feature or permission is available to every account.', needsVerification: false, crisis: false, requestedRecommendation: true, marketingConsentOnAsk: true,
    discovery: 'The organisation has multiple brands and needs role discipline, approval controls and clarity about connected-provider limits.',
    guidance: 'Describe Social Hub as an organisation social-operations workspace for managing supported social workflows. Advise the caller to check provider connections, permissions, supported channels and plan limits in their own workspace before committing to a workflow.',
    replies: { empathy: 'We need consistency because several people work on different brands.', probe: 'Approvals and access permissions matter more to us than simply posting quickly.', explain: 'That is useful. We should verify the connected platforms and user roles first.', guide: 'I will make an internal checklist for channels, roles, approval and access.', confirm: 'That gives me a sensible evaluation process.' }
  },
  {
    id: 'kano-run-performance', title: 'Kano Run — gameplay performance', group: 'RuffNeck games', platform: 'Kano Run / Kano Life', department: 'Technical Support and IT', persona: 'Frustrated player', emotion: 'angry', language: 'en-NG',
    opening: 'I keep getting frame drops and blurry signs when I play Kano Run on my phone. It is ruining the experience.',
    issue: 'Acknowledge frustration, isolate device/browser conditions and offer reversible troubleshooting. Do not promise a fix.', needsVerification: false, crisis: false, requestedRecommendation: false, marketingConsentOnAsk: false,
    discovery: 'The caller is on a mobile browser. The issue may relate to device load, browser settings, network or graphics quality.',
    guidance: 'Ask them to close heavy background tabs, refresh the game, check browser updates, try a stable connection and compare the available graphics quality settings. Record the device/browser and reproduction steps through the approved support path.',
    replies: { empathy: 'Thank you for taking it seriously. I have tried refreshing several times.', probe: 'It happens more when traffic and pedestrians appear. The phone also gets warm.', explain: 'I understand that performance can vary by device and scene. I should not promise an instant fix.', guide: 'I can test with fewer background apps and note whether the issue changes.', confirm: 'That is manageable. I will report the device and the exact scene if it continues.' }
  },
  {
    id: 'kano-keke-controls', title: 'Kano Keke — controls and route guidance', group: 'RuffNeck games', platform: 'Kano Keke', department: 'RuffNeck Products and Platform Support', persona: 'New player', emotion: 'confused', language: 'en-NG',
    opening: 'I just started Kano Keke. I can move the keke, but I do not understand the route and shift controls.',
    issue: 'Provide basic orientation and direct the player to in-game instructions. Do not invent controls not visible in the current build.', needsVerification: false, crisis: false, requestedRecommendation: false, marketingConsentOnAsk: false,
    discovery: 'The caller is a new player and may be using touch controls rather than a keyboard.',
    guidance: 'Ask whether they are on touch or keyboard. Direct them to the on-screen control hints and pause/help area. Explain one control at a time and ask them to test in a safe, low-pressure part of the game.',
    replies: { empathy: 'I am new to it. I just need someone to explain it slowly.', probe: 'I am using a touchscreen phone, not a keyboard.', explain: 'Okay, the on-screen hints should match my device.', guide: 'I can see the control guide now. I will try each control one at a time.', confirm: 'That is much clearer. I can start learning the route.' }
  },
  {
    id: 'learn-course-access-hausa', title: 'Hausa practice — RuffNeck Learn support', group: 'Nigerian languages', platform: 'RuffNeck Learn', department: 'RuffNeck Products and Platform Support', persona: 'Mai koyon sana’a', emotion: 'confused', language: 'ha-NG',
    opening: 'Sannu. Na yi rajista a RuffNeck Learn, amma ban ga kwas din da zan ci gaba da shi ba. Don Allah, me zan yi?',
    issue: 'Hausa-language role-play for calm course-navigation support. Verify through the official secure route and never ask for secrets.', needsVerification: true, crisis: false, requestedRecommendation: false, marketingConsentOnAsk: false,
    discovery: 'The learner may have used a different account on the phone. Do not ask them to type an email, password or one-time code into the practice chat.',
    guidance: 'A Hausa, a hankali: buɗe RuffNeck Learn, shiga da asusun da aka yi amfani da shi wajen rajista, sannan a duba jerin kwasa-kwasai. Idan kwas din bai bayyana ba, a bi hanyar tallafin dandamali domin a duba asusun ta hanya mai tsaro.',
    replies: { empathy: 'Na gode da ka saurare ni. Na damu ne kada kwas din ya bace.', probe: 'Wata kila na yi amfani da wani asusun daban a wayata.', safe_verify: 'Na fahimta. Za mu yi amfani da hanyar tabbatarwa ta hukuma; ba zan ba ka kalmar sirri ko lambar OTP ba.', explain: 'Ba zan iya ganin asusunka kai tsaye ba. Za mu bi matakan duba asusun da aka yi rajista da shi.', guide: 'Na ga inda zan duba kwasa-kwasan yanzu. Zan gwada wannan hanyar.', confirm: 'Na fahimta. Na gode da bayanin a hankali.' }
  },
  {
    id: 'prospector-enquiry-yoruba', title: 'Yoruba practice — Prospector enquiry', group: 'Nigerian languages', platform: 'RuffNeck Prospector', department: 'Sales and Service Enquiries', persona: 'Oniṣòwò kékeré', emotion: 'uncertain', language: 'yo-NG',
    opening: 'Ẹ káàsán. Mo fẹ́ mọ bí RuffNeck Prospector ṣe lè ràn mí lọ́wọ́ láti ṣètò àwọn ẹni tí mo fẹ́ bá ṣiṣẹ́ pọ̀.',
    issue: 'Yoruba-language product enquiry. Explain lead discovery and pipeline organisation without promising sales or conversion.', needsVerification: false, crisis: false, requestedRecommendation: true, marketingConsentOnAsk: false,
    discovery: 'The caller wants to prioritise prospects and organise follow-up, not receive a guarantee of sales.',
    guidance: 'Ṣàlàyé pé Prospector ń ṣe ìrànlọ́wọ́ fún wíwá àwọn oníbàárà tó lè nífẹ̀ẹ́ sí iṣẹ́, fífi wọ́n sí ipò àkọ́kọ́ àti ṣíṣètò ìbáṣepọ̀. Kò sí ìlérí pé gbogbo ẹni yóò rà.',
    replies: { empathy: 'Mo dúpẹ́ pé o ń gbọ́ ohun tí mo nílò. Mi ò fẹ́ fi àkókò ṣòfò.', probe: 'Mo fẹ́ mọ ẹni tí mo yẹ kí n kọ́kọ́ bá sọ̀rọ̀ àti bí mo ṣe lè tọ́pa ìbáṣepọ̀.', explain: 'Ó yé mi. Ó ń ran mi lọ́wọ́ láti ṣètò iṣẹ́, ṣùgbọ́n kò ṣe ìlérí títà.', guide: 'Mo lè bẹ̀rẹ̀ pẹ̀lú àkójọ tó ní ìtòlẹ́sẹẹsẹ àti ètò ìtẹ̀lé.', confirm: 'Mo ti lóye ohun tí mo lè lò ó fún. Ẹ ṣé.' }
  },
  {
    id: 'connect-enquiry-igbo', title: 'Igbo practice — Connect community support', group: 'Nigerian languages', platform: 'RuffNeck Connect', department: 'RuffNeck Products and Platform Support', persona: 'Onye otu ọhụrụ', emotion: 'uncertain', language: 'ig-NG',
    opening: 'Ndewo. Achọrọ m isonye n’obodo dị na RuffNeck Connect, mana amaghị m otu m ga-esi malite.',
    issue: 'Igbo-language community support. Explain safe participation and privacy; do not promise moderation outcomes.', needsVerification: false, crisis: false, requestedRecommendation: false, marketingConsentOnAsk: false,
    discovery: 'The caller wants purposeful learning and collaboration and is concerned about exposing private information.',
    guidance: 'Kọwaa na Connect bụ maka obodo, imekọ ihe ọnụ na mkparịta ụka bara uru. Gụọ iwu obodo ahụ, kesaa naanị ozi kwesịrị ekwesị, ma jiri ụzọ mkpesa nke ikpo okwu ma ọ bụrụ na nsogbu bilie.',
    replies: { empathy: 'Aghọtara m. Achọrọ m iso ndị nwere mmasị n’ịmụ ihe na imekọ ihe ọnụ.', probe: 'Achọghị m ikesa ozi nkeonwe nke ukwuu.', explain: 'Ọ dị mma. Aga m ebu ụzọ gụọ iwu obodo ahụ.', guide: 'Aga m amalite site n’okwu mmeghe dị mkpirikpi ma chekwaa ozi nkeonwe.', confirm: 'Ugbu a amatala m otu m ga-esi malite nke ọma. Daalụ.' }
  },
  {
    id: 'kano-run-support-pidgin', title: 'Pidgin practice — Kano Run performance complaint', group: 'Nigerian languages', platform: 'Kano Run / Kano Life', department: 'Technical Support and IT', persona: 'Mobile gamer', emotion: 'frustrated', language: 'en-NG',
    opening: 'Abeg, Kano Run dey slow for my phone. Once plenty traffic show, the game dey drop frame and signs dey blur.',
    issue: 'Nigerian Pidgin role-play for troubleshooting. Isolate device/browser conditions and offer reversible steps without guaranteeing a fix.', needsVerification: false, crisis: false, requestedRecommendation: false, marketingConsentOnAsk: false,
    discovery: 'The player says the phone gets hot and slowdowns are worse in crowded scenes.',
    guidance: 'Ask the player to close heavy apps and browser tabs, refresh the game, check browser updates, test a stable connection and compare the available graphics setting. Record the exact device and scene through the approved support path.',
    replies: { empathy: 'I hear you. That kind thing fit spoil the whole play.', probe: 'E dey worse when traffic and people enter. My phone dey hot too.', explain: 'The game performance fit depend on phone, browser and wetin dey happen for the scene. I no go promise say one step go fix am.', guide: 'I go close heavy apps, refresh the game and test the graphics setting again.', confirm: 'I go test am like that and note the scene if e still happen.' }
  },
  {
    id: 'outbound-case-callback', title: 'Outbound callback — complaint update', group: 'Outbound and complaints', platform: 'General', department: 'Complaints and Service Recovery', persona: 'Waiting customer', emotion: 'frustrated', language: 'en-NG', direction: 'outbound',
    opening: 'Hello. I was expecting your callback about the issue I reported. Can you tell me what is happening?',
    issue: 'Practise an outbound service callback: introduce the organisation and purpose, use approved safe verification before discussing case details, and never invent a status or resolution date.', needsVerification: true, crisis: false, requestedRecommendation: false, marketingConsentOnAsk: false,
    discovery: 'The customer wants a truthful update and does not want to repeat the complaint. The agent must check the authorised case record before sharing case-specific information.',
    guidance: 'Explain only the case status visible in the approved Case Desk. If no verified update is available, say so, record the callback attempt and set a realistic follow-up through the approved process. Do not invent a technician update or completion date.',
    replies: { empathy: 'I appreciate you calling back. I have been waiting and I do not want another empty promise.', probe: 'I just need to know whether anyone has actually reviewed the earlier case.', safe_verify: 'I understand. I will use the official secure verification process and will not read out any password or code.', explain: 'Thank you for checking. Please tell me only what is confirmed in the case record.', guide: 'That is better than guessing. Please record what is still outstanding and what the next confirmed action is.', confirm: 'I understand the status and the next step. Please make sure the follow-up is recorded.' }
  },
  {
    id: 'suspicious-otp-request', title: 'Security — suspicious OTP request', group: 'Security and complaints', platform: 'General', department: 'Safeguarding and Trained Human Support', persona: 'Suspicious caller', emotion: 'worried', language: 'en-NG',
    opening: 'Someone claiming to be support asked me to read out a one-time code. They said my account would be blocked if I refused.',
    issue: 'Protect the customer. Never request the code, password, PIN, card information or remote access. Give safe immediate steps and escalate.', needsVerification: false, crisis: true, requestedRecommendation: false, marketingConsentOnAsk: false,
    discovery: 'The caller may have disclosed a code already. Establish only whether they shared it; do not ask them to repeat it.',
    guidance: 'Tell the customer not to share any code. End contact with the suspicious party, use the official platform or bank channel typed independently, secure the affected account and report the incident. If a financial account may be affected, contact the bank through its official channel immediately.',
    replies: { empathy: 'I was frightened. I did not know whether it was real.', probe: 'I have not read the code to them, but they are still calling me.', safety_escalate: 'Thank you. I will end that call and contact support using the official app or website.', confirm: 'I understand. I will not share the code or follow links they sent.' }
  },
  {
    id: 'repeat-complaint', title: 'Complaint — repeated unresolved issue', group: 'Security and complaints', platform: 'General', department: 'Complaints and Service Recovery', persona: 'Repeat complainant', emotion: 'angry', language: 'en-NG',
    opening: 'This is the third time I am explaining the same problem. Every time I am told it will be fixed, but nothing changes.',
    issue: 'Own the interaction, acknowledge repeat contact, avoid defensive language and make a verifiable handoff. Do not invent a case update.', needsVerification: false, crisis: false, requestedRecommendation: false, marketingConsentOnAsk: false,
    discovery: 'The caller wants continuity and a named next action, not another unsupported assurance.',
    guidance: 'Acknowledge the repeat contact, summarise the unresolved issue, check the existing case reference through the approved Case Desk, and give only a confirmed next step and timeframe. Escalate if the service target is already missed.',
    replies: { empathy: 'I want someone to take ownership instead of making another promise.', probe: 'I have a previous case reference. I do not want to repeat all the details again.', explain: 'That is fair. Please check the earlier case rather than guessing.', guide: 'I can provide the reference through the secure case form.', confirm: 'I want a proper update, even if the issue is not fixed yet.' }
  },
  {
    id: 'relationship-boundaries', title: 'Personal guidance — relationship boundaries', group: 'Personal guidance', platform: 'General', department: 'Personal Development and Wellbeing Information', persona: 'Concerned adult', emotion: 'sad', language: 'en-NG',
    opening: 'I am having repeated arguments with someone close to me. I want advice on how to communicate without making things worse.',
    issue: 'Offer reflective, non-clinical guidance. Do not diagnose either person or direct someone to remain in an unsafe relationship.', needsVerification: false, crisis: false, requestedRecommendation: false, marketingConsentOnAsk: false,
    discovery: 'The caller wants practical communication habits and has not described immediate danger.',
    guidance: 'Encourage calm timing, specific observations rather than insults, listening and boundaries. Ask about safety if warning signs emerge. For abuse, threats or immediate danger, prioritise safety and qualified local support.',
    replies: { empathy: 'I do not want another argument. I want us to understand one another.', probe: 'The arguments usually start when we discuss responsibilities.', explain: 'I can focus on the issue rather than attacking the person.', guide: 'I can try a calm conversation and agree on one practical change.', confirm: 'That is useful. I can try it without expecting everything to change overnight.' }
  },
  {
    id: 'parenting-routine', title: 'Personal guidance — parenting routine', group: 'Personal guidance', platform: 'General', department: 'Personal Development and Wellbeing Information', persona: 'Parent', emotion: 'tired', language: 'en-NG',
    opening: 'My child struggles with routines. I keep getting frustrated, and I want a calmer way to handle it.',
    issue: 'Provide general, age-aware, non-clinical suggestions without harsh discipline or diagnosis.', needsVerification: false, crisis: false, requestedRecommendation: false, marketingConsentOnAsk: false,
    discovery: 'The caller wants consistency and calm, not punishment or a clinical assessment.',
    guidance: 'Suggest one predictable routine at a time, clear simple expectations, age-appropriate choices, praise for effort and calm follow-through. Avoid physical punishment. Encourage a qualified child-development professional for persistent or concerning difficulties.',
    replies: { empathy: 'I care about my child, but I feel worn out by the daily struggle.', probe: 'The difficult time is usually getting ready in the morning.', explain: 'Starting with one routine sounds less overwhelming.', guide: 'I can prepare things the night before and use a simple visual checklist.', confirm: 'That is a practical first step.' }
  },
  {
    id: 'career-growth', title: 'Personal guidance — career development', group: 'Personal guidance', platform: 'General', department: 'Learning and Career Development', persona: 'Early-career professional', emotion: 'uncertain', language: 'en-NG',
    opening: 'I want to grow professionally, but I am not sure whether to focus on communication, technical skills or leadership first.',
    issue: 'Help the caller clarify goals and choose a practical learning plan. Avoid guaranteeing employment or promotion.', needsVerification: false, crisis: false, requestedRecommendation: true, marketingConsentOnAsk: false,
    discovery: 'The caller needs a goal-linked plan and a way to measure progress.',
    guidance: 'Start with the role or opportunity they want, identify two or three skill gaps, select one practical learning activity, build a small portfolio of evidence and review progress monthly. RuffNeck Learn may be mentioned because the caller asked for learning options; do not guarantee job outcomes.',
    replies: { empathy: 'I want to make progress without trying to learn everything at once.', probe: 'I am aiming for a team-lead role in the future.', explain: 'I need communication, problem-solving and evidence that I can support others.', guide: 'A monthly plan with one skill and one practical task makes sense.', confirm: 'I can measure progress with examples of work, not just certificates.' }
  }
];

const ACTIONS = ['greet','empathy','probe','safe_verify','explain','guide','confirm','ask_marketing_consent','requested_recommendation','proactive_cross_sell','safety_escalate','specialist_transfer','close'];
const ACTION_LABELS = {
  greet: 'Professional greeting', empathy: 'Acknowledge and empathise', probe: 'Ask an open discovery question', safe_verify: 'Use safe verification',
  explain: 'Explain accurately', guide: 'Give step-by-step guidance', confirm: 'Check understanding and outcome',
  ask_marketing_consent: 'Ask separate marketing permission', requested_recommendation: 'Answer requested product enquiry',
  proactive_cross_sell: 'Offer proactive cross-sell', safety_escalate: 'Escalate safeguarding concern',
  specialist_transfer: 'Arrange specialist hand-off', close: 'Close the conversation'
};
const DISPOSITIONS = ['resolved','self_service_guided','specialist_referral','safeguarding_escalation','follow_up_required','unresolved'];

export function listScenarios() {
  return SCENARIOS.map(({ id, title, group, platform, department, persona, emotion, issue, direction, language }) => ({ id, title, group, platform, department, persona, emotion, issue, direction: direction || 'inbound', language: language || 'en-NG' }));
}
export function getScenario(id) { return SCENARIOS.find(item => item.id === id) || null; }
export function getActionLabels() { return { ...ACTION_LABELS }; }
export function createCallSession(scenarioId, now = Date.now()) {
  const scenario = getScenario(scenarioId);
  if (!scenario) throw new Error('Choose a valid practice scenario.');
  return {
    id: `practice-${now}-${Math.random().toString(36).slice(2,8)}`, scenarioId, status: 'active', direction: scenario.direction || 'inbound', currentEmotion: scenario.emotion, emotionIntensity: ({ angry:78, frustrated:72, worried:68, sad:62, tired:58, confused:58, uncertain:52, neutral:30 })[scenario.emotion] ?? 45,
    startedAt: now, heldAt: null, totalHoldSeconds: 0, actions: [], messages: [{ speaker: 'customer', text: scenario.opening, at: now }],
    discovered: false, empathyShown: false, safeVerification: false, explanationGiven: false, guidanceGiven: false,
    outcomeConfirmed: false, marketingConsent: false, marketingConsentAsked: false, requestedRecommendationGiven: false,
    safetyEscalated: false, specialistTransfer: false, criticalFailures: [], disposition: null, freeResponse: ''
  };
}
function customerReply(scenario, action, state) {
  if (scenario.replies[action]) {
    const base = scenario.replies[action];
    if ((scenario.emotion === 'angry' || scenario.emotion === 'frustrated') && !state.empathyShown && action !== 'empathy') return `I am still feeling frustrated. ${base}`;
    if (state.empathyShown && (action === 'guide' || action === 'explain')) return `Thank you for listening. ${base}`;
    return base;
  }
  if (action === 'safe_verify') return scenario.needsVerification
    ? 'Thank you for explaining why verification matters. I will use the official secure process and will not share any secret code.'
    : 'I appreciate the care. You do not need to collect unnecessary identity information for this question.';
  if (action === 'ask_marketing_consent') return scenario.marketingConsentOnAsk
    ? 'Yes. I agree to receive relevant product information for that purpose. Please keep it separate from service messages.'
    : 'No, thank you. Please just help me with the request I called about.';
  if (action === 'requested_recommendation') return scenario.requestedRecommendation
    ? 'That is the kind of information I asked for. Please explain the option and any limits clearly.'
    : 'I did not ask for another product. Please stay with my original request.';
  if (action === 'proactive_cross_sell') return state.marketingConsent
    ? 'You have checked my permission. Please explain why this is relevant and do not pressure me.'
    : 'I called about my current issue. I do not want an unrelated sales pitch.';
  if (action === 'safety_escalate') return scenario.crisis
    ? 'Thank you for taking this seriously. Please connect me to the right trained support.'
    : 'I do not think this is a safeguarding emergency, but a specialist may help.';
  if (action === 'specialist_transfer') return 'Please explain who will take over and what information will be passed on. I do not want to start again.';
  if (action === 'close') return state.outcomeConfirmed || state.safetyEscalated || state.specialistTransfer
    ? 'Thank you for explaining the next step. I know what happens from here.'
    : 'I am not sure my request has been resolved yet.';
  return 'I am listening. Please help me understand the next step.';
}
function containsUnsafeRequest(text) {
  const value = String(text || '').toLowerCase();
  return /(?:tell me|send me|read(?: out)?(?: to me)?|share|provide|give me|confirm|state|repeat)\s+(?:your\s+)?(?:password|passcode|one[ -]?time (?:code|password)|otp|pin|cvv|card number|security code)/i.test(value)
    || /(?:password|passcode|one[ -]?time (?:code|password)|otp|pin|cvv|card number|security code).{0,35}(?:to me|with me|over the phone|in this chat)/i.test(value);
}
function appendMessage(state, speaker, text, now) { state.messages.push({ speaker, text, at: now }); }
export function applyAgentAction(state, action, responseText = '', now = Date.now()) {
  if (!state || state.status !== 'active') throw new Error('The practice interaction is not active.');
  if (!ACTIONS.includes(action)) throw new Error('Unsupported practice action.');
  const scenario = getScenario(state.scenarioId);
  if (!scenario) throw new Error('Practice scenario is unavailable.');
  if (containsUnsafeRequest(responseText)) {
    state.criticalFailures.push('requested_prohibited_secret');
    appendMessage(state, 'agent', responseText, now);
    appendMessage(state, 'system', 'Critical failure: CALLORIA staff must never request passwords, OTPs, PINs, CVVs or full payment-card details.', now);
    return { state, reply: 'I cannot continue with that wording. Rephrase using the official secure verification route; never ask the customer to disclose a secret.' };
  }
  if (action === 'safe_verify') state.safeVerification = true;
  if ((action === 'explain' || action === 'guide') && scenario.needsVerification && !state.safeVerification) state.criticalFailures.push('disclosure_before_verification');
  if (action === 'empathy') state.empathyShown = true;
  if (action === 'probe') state.discovered = true;
  if (action === 'explain') state.explanationGiven = true;
  if (action === 'guide') state.guidanceGiven = true;
  if (action === 'confirm') state.outcomeConfirmed = state.guidanceGiven || state.explanationGiven || state.safetyEscalated || state.specialistTransfer;
  if (action === 'ask_marketing_consent') {
    state.marketingConsentAsked = true;
    state.marketingConsent = scenario.marketingConsentOnAsk;
  }
  if (action === 'requested_recommendation') state.requestedRecommendationGiven = scenario.requestedRecommendation;
  if (action === 'proactive_cross_sell') {
    if (!state.marketingConsent) state.criticalFailures.push('unconsented_marketing');
    if (!state.outcomeConfirmed) state.criticalFailures.push('premature_cross_sell');
  }
  if (action === 'safety_escalate') {
    if (scenario.crisis) state.safetyEscalated = true;
    else state.criticalFailures.push('inappropriate_safeguarding_escalation');
  }
  if (action === 'specialist_transfer') state.specialistTransfer = true;
  if (action === 'empathy') state.emotionIntensity = Math.max(10, state.emotionIntensity - 24);
  else if (action === 'probe') state.emotionIntensity = Math.max(8, state.emotionIntensity - (state.empathyShown ? 8 : 2));
  else if (action === 'explain' || action === 'guide') state.emotionIntensity = Math.max(5, state.emotionIntensity - (state.discovered ? 10 : 3));
  if (action === 'proactive_cross_sell' && !state.marketingConsent) state.emotionIntensity = Math.min(100, state.emotionIntensity + 20);
  if (action === 'safety_escalate' && scenario.crisis) state.emotionIntensity = Math.max(12, state.emotionIntensity - 16);
  state.currentEmotion = state.emotionIntensity >= 76 ? 'highly upset' : state.emotionIntensity >= 58 ? 'concerned' : state.emotionIntensity >= 35 ? 'settling' : 'reassured';
  const reply = customerReply(scenario, action, state);
  if (responseText.trim()) appendMessage(state, 'agent', responseText.trim().slice(0, 500), now);
  else appendMessage(state, 'agent', ACTION_LABELS[action], now);
  appendMessage(state, 'customer', reply, now);
  state.actions.push(action);
  return { state, reply };
}
export function setFreeResponse(state, text) {
  if (!state || state.status !== 'active') throw new Error('The practice interaction is not active.');
  const clean = String(text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0,500);
  state.freeResponse = clean;
  if (containsUnsafeRequest(clean) && !state.criticalFailures.includes('requested_prohibited_secret')) state.criticalFailures.push('requested_prohibited_secret');
  return clean;
}
export function holdCall(state, now = Date.now()) {
  if (!state || state.status !== 'active') throw new Error('Only an active practice call can be placed on hold.');
  state.status = 'on_hold'; state.heldAt = now; return state;
}
export function resumeCall(state, now = Date.now()) {
  if (!state || state.status !== 'on_hold') throw new Error('Only a held practice call can be resumed.');
  state.totalHoldSeconds += Math.max(0, Math.floor((now - state.heldAt) / 1000)); state.heldAt = null; state.status = 'active'; return state;
}
export function moveToAfterContactWork(state, disposition) {
  if (!state || state.status !== 'active') throw new Error('An active practice call is required.');
  if (!DISPOSITIONS.includes(disposition)) throw new Error('Choose a valid practice disposition.');
  state.status = 'after_contact_work'; state.disposition = disposition; return state;
}
export function setPracticeDisposition(state, disposition) {
  if (!state || state.status !== 'after_contact_work') throw new Error('After-contact work must be active before changing the disposition.');
  if (!DISPOSITIONS.includes(disposition)) throw new Error('Choose a valid practice disposition.');
  state.disposition = disposition;
  return state;
}
export function completeCall(state, summary, now = Date.now()) {
  if (!state || state.status !== 'after_contact_work') throw new Error('Complete after-contact work before closing the practice call.');
  const clean = String(summary || '').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,400);
  if (clean.length < 12) throw new Error('Write a short, non-sensitive outcome summary of at least 12 characters.');
  if (containsUnsafeRequest(clean)) throw new Error('Remove any request for passwords, OTPs, PINs, CVVs or payment-card details.');
  state.status = 'completed'; state.completedAt = now; state.practiceSummary = clean;
  return { state, score: scoreCall(state, now) };
}
export function scoreCall(state, now = Date.now()) {
  const scenario = getScenario(state.scenarioId);
  if (!scenario) throw new Error('Practice scenario is unavailable.');
  const criteria = [
    { key:'professional_opening', label:'Professional opening', weight:10, passed:state.actions.includes('greet') },
    { key:'empathy', label:'Empathy and respect', weight:15, passed:state.empathyShown },
    { key:'discovery', label:'Needs analysis', weight:15, passed:state.discovered },
    { key:'privacy_security', label:'Privacy and safe handling', weight:25, passed:!state.criticalFailures.includes('requested_prohibited_secret') && !state.criticalFailures.includes('disclosure_before_verification') && (!scenario.needsVerification || state.safeVerification) },
    { key:'knowledge_guidance', label:'Accurate information and guidance', weight:15, passed:state.explanationGiven || state.guidanceGiven || state.safetyEscalated || state.specialistTransfer },
    { key:'resolution_check', label:'Confirmation and professional close', weight:10, passed:(state.outcomeConfirmed && state.actions.includes('close')) || state.safetyEscalated || (state.specialistTransfer && state.actions.includes('close')) },
    { key:'consent_and_suitability', label:'Consent and suitability', weight:10, passed:!state.criticalFailures.includes('unconsented_marketing') && !state.criticalFailures.includes('inappropriate_safeguarding_escalation') && (!state.actions.includes('proactive_cross_sell') || state.marketingConsent) }
  ];
  const raw = criteria.reduce((sum, criterion) => sum + (criterion.passed ? criterion.weight : 0), 0);
  const gateFailed = state.criticalFailures.length > 0 || (scenario.crisis && !state.safetyEscalated);
  const score = gateFailed ? Math.min(raw, 49) : raw;
  const elapsedSeconds = Math.max(0, Math.floor(((state.completedAt || now) - state.startedAt - state.totalHoldSeconds * 1000) / 1000));
  const passed = !gateFailed && score >= 80;
  const recommendations = criteria.filter(item => !item.passed).map(item => item.label);
  if (scenario.crisis && !state.safetyEscalated) recommendations.push('Safeguarding hand-off');
  if (!state.actions.includes('close') && !state.safetyEscalated) recommendations.push('Clear closing and next-step confirmation');
  return { score, passed, gateFailed, criteria, recommendations, elapsedSeconds, holdSeconds:state.totalHoldSeconds, criticalFailures:[...new Set(state.criticalFailures)] };
}
export function buildPracticeRecord(state, score) {
  const scenario = getScenario(state.scenarioId);
  return {
    id: state.id, completedAt: state.completedAt, scenarioId: state.scenarioId, scenarioTitle: scenario?.title || 'Practice scenario',
    platform: scenario?.platform || 'General', score: score.score, passed: score.passed, gateFailed: score.gateFailed,
    disposition: state.disposition, elapsedSeconds: score.elapsedSeconds, competencyGaps: score.recommendations,
    criticalFailures: score.criticalFailures
  };
}
export const VOICE_ACTIONS = ACTIONS;
