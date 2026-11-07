import {
  CONTACT_STATUS, createInboundQueue, sortQueuedContacts, nextQueuedContact,
  transitionContact, addInteractionEvent, countQueuedContacts, queueMetrics,
  addSuppression, isContactSuppressed, scheduleCallback, completeActiveCallback
} from './operations-engine.js';
import { DEPARTMENTS, SYSTEMS, briefingFor, recordBriefingAttendance, promotionEligibility, recordPromotionExam, recordCrossSell, recordCommendation, createSystemEvent } from './workforce-engine.js';
import { AGENT_STATES, createShiftRecord, recordAgentState, calculateShiftAdherence, expectedShiftMode, nextScheduledBreak, closeShift, createCoachingRecord } from './shift-engine.js';
import { speechRecognitionAvailable, mediaRecordingAvailable, createVoiceSession, appendVoiceTranscript, finishVoiceSession, sanitizeTranscript } from './voice-engine.js';
import { DIGITAL_CHANNELS, DIGITAL_STATUS, DIGITAL_SCENARIOS, createDigitalQueue, sortDigitalQueue, findDigitalContact, acceptDigitalContact, recordDigitalReply, deliverDigitalFollowUp, completeDigitalContact, digitalQueueMetrics, appendDigitalEvent } from './multichannel-engine.js';
import { ORGANIZATION_ROLES, DEFAULT_ORG_POLICY, ensureOrganizationWorkspace, createOrganization, createOrganizationMember, setOrganizationMemberStatus, updateOrganizationPolicy, getActiveOrganization, getOrganizationSnapshot } from './organization-engine.js';

let THREE = null;

const STORAGE_KEY = 'calloria.save.v1';
const LEGACY_STORAGE_KEY = 'floorshift3d.save.v1';
const $ = (selector, root = document) => root.querySelector(selector);
const viewRoot = $('#viewRoot');
const toastHost = $('#toastHost');

const initialState = () => ({
  applicantName: '',
  selectedTrack: 'banking',
  stage: 'applicant', // applicant | assessment | offer | employee
  assessmentIndex: 0,
  assessmentAnswers: [],
  assessmentPhase: 'aptitude',
  practicalIndex: 0,
  practicalAnswers: [],
  hired: false,
  roleTitle: 'Customer Experience Associate',
  department: 'Banking Operations',
  shiftActive: false,
  currentView: 'overview',
  currentCall: null,
  activeOutbound: null,
  callQueue: 6,
  inboundQueueItems: [],
  queueSequence: 0,
  callbacks: [],
  supervisorRequests: [],
  interactionTimeline: [],
  outboundSuppressions: [],
  outboundAttempts: [],
  wrapUp: null,
  totalWaitSeconds: 0,
  acceptedContacts: 0,
  contactsWithinSla: 0,
  totalACWSeconds: 0,
  acwCount: 0,
  outboundDone: [],
  cases: [],
  callsHandled: 0,
  outboundCalls: 0,
  resolutions: 0,
  sales: 0,
  totalQA: 0,
  qaCount: 0,
  totalCSAT: 0,
  csatCount: 0,
  totalHandleMinutes: 0,
  incidents: 0,
  shiftMinutes: 0,
  salary: 185000,
  bonus: 0,
  level: 1,
  experience: 0,
  applicationSubmitted: false,
  day: 1,
  nameInitials: 'AP',
  viewedArticle: null,
  workforceDepartment: 'inbound',
  shiftRecord: null, shiftElapsedMinutes: 0, agentStatus: 'offline', shiftHistory: [], coachingSessions: [], simulationClockSeconds: 7 * 3600, lastShiftDay: 0,
  briefingAttendance: [], promotionAttempts: [], crossSellRecords: [], commendations: [], systemEvents: [], digitalQueue: [], digitalSequence: 0, digitalActiveId: null, digitalChannelFilter: 'all', digitalEvents: [], organizationWorkspace: null
});

let state = loadState();
ensureOrganizationWorkspace(state);
let selectedAnswer = null;
let threeWorld = null;
let productionWorld = null;
let voiceConsent = false;
let voiceStatus = 'inactive';
let voiceTranscript = '';
let voiceSession = null;
let speechRecognition = null;
let voiceMediaStream = null;
let voiceRecorder = null;
let voiceChunks = [];
let voiceAudioUrl = null;
let voiceRecordingTimer = null;
let simulationClockTicker = 7 * 3600;
let lastShiftSaveBucket = 0;

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!stored) return initialState();
    const parsed = JSON.parse(stored);
    const migrated = { ...initialState(), ...parsed };
    for (const key of ['inboundQueueItems','callbacks','supervisorRequests','interactionTimeline','outboundSuppressions','outboundAttempts','cases','outboundDone','briefingAttendance','promotionAttempts','crossSellRecords','commendations','systemEvents','shiftHistory','coachingSessions','digitalQueue','digitalEvents']) { if (!Array.isArray(migrated[key])) migrated[key] = []; }
    if (!Number.isFinite(migrated.callQueue)) migrated.callQueue = 6;
    if (migrated.shiftActive && (!migrated.shiftRecord || migrated.shiftRecord.status !== 'active')) migrated.shiftRecord = createShiftRecord({ day: migrated.day || 1 });
    if (!Number.isFinite(migrated.shiftElapsedMinutes)) migrated.shiftElapsedMinutes = 0;
    if (!Number.isFinite(migrated.lastShiftDay)) migrated.lastShiftDay = 0;
    if (!Number.isFinite(migrated.digitalSequence)) migrated.digitalSequence = 0;
    if (!['all', ...Object.keys(DIGITAL_CHANNELS)].includes(migrated.digitalChannelFilter)) migrated.digitalChannelFilter = 'all';
    if (migrated.digitalActiveId && !migrated.digitalQueue.some(item => item.id === migrated.digitalActiveId && [DIGITAL_STATUS.ACTIVE, DIGITAL_STATUS.AWAITING_CUSTOMER].includes(item.status))) migrated.digitalActiveId = null;
    if (!AGENT_STATES.includes(migrated.agentStatus)) migrated.agentStatus = migrated.shiftActive ? 'available' : 'offline';
    if (!localStorage.getItem(STORAGE_KEY)) localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return initialState();
  }
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage may be disabled */ }
}
function syncQueueCount() {
  state.callQueue = countQueuedContacts(state.inboundQueueItems);
  $('#inboundCount').textContent = state.callQueue;
}
function pushOperationEvent(type, reference, message, status = 'recorded', details = {}) {
  return addInteractionEvent(state.interactionTimeline, { type, reference, message, status, details });
}
function ensureInboundQueue(count = 6) {
  if (!Array.isArray(state.inboundQueueItems)) state.inboundQueueItems = [];
  const waiting = countQueuedContacts(state.inboundQueueItems);
  if (waiting === 0 && state.callQueue > 0 && state.inboundQueueItems.length === 0) {
    const items = createInboundQueue(inboundScenarios, Math.min(30, state.callQueue), { sequence: state.queueSequence });
    state.inboundQueueItems.push(...items);
    state.queueSequence += items.length;
  } else if (waiting === 0 && count > 0 && state.inboundQueueItems.length === 0) {
    const items = createInboundQueue(inboundScenarios, count, { sequence: state.queueSequence });
    state.inboundQueueItems.push(...items);
    state.queueSequence += items.length;
  }
  syncQueueCount();
}
function findQueueContact(contactId) {
  return state.inboundQueueItems.find(item => item.id === contactId) || null;
}
function addCallTimeline(call, event, details = {}) {
  const contact = call?.queueContactId ? findQueueContact(call.queueContactId) : null;
  if (contact) { contact.timeline = Array.isArray(contact.timeline) ? contact.timeline : []; contact.timeline.push({ at: new Date().toISOString(), event, status: contact.status, ...details }); }
  pushOperationEvent('call', contact?.id || call?.scenarioId || '', event, contact?.status || 'recorded', details);
}
function formatWait(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
function makeCallReference(prefix = 'CALL') {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
}
function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
}
function initials(name) {
  return name.trim().split(/\s+/).slice(0,2).map(p => p[0]?.toUpperCase() || '').join('') || 'AP';
}
function money(value) { return '₦' + Math.round(value).toLocaleString('en-NG'); }
function average(sum, count, fallback = 0) { return count ? sum / count : fallback; }
function toast(message, type = 'info') {
  const node = document.createElement('div');
  node.className = 'toast';
  node.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '!' : '•'}</span> ${escapeHTML(message)}`;
  toastHost.append(node);
  setTimeout(() => node.remove(), 3600);
}
function setHeader() {
  $('#profileName').textContent = state.applicantName || 'Applicant';
  $('#profileRole').textContent = state.hired ? state.roleTitle : state.stage === 'assessment' ? 'Candidate assessment' : 'Candidate';
  $('#profileInitials').textContent = state.nameInitials || 'AP';
  $('#headerStatus').textContent = state.hired ? (state.shiftActive ? 'ON SHIFT · LIVE OPERATIONS' : 'EMPLOYEE WORKSPACE') : state.stage === 'assessment' ? 'RECRUITMENT ASSESSMENT' : state.stage === 'offer' ? 'EMPLOYMENT OFFER' : 'RECRUITMENT PORTAL';
  $('#worldHeading').textContent = state.hired ? (state.shiftActive ? 'Your floor. Your customers. Your shift.' : 'Welcome to the operations floor.') : 'Your next shift starts here.';
  $('#worldSubheading').textContent = state.hired ? `${state.department} · ${state.roleTitle} · Day ${state.day}` : 'Enter the contact centre, earn the role and take ownership of real-to-life simulated customer interactions.';
  const disabled = !state.hired;
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    const view = btn.dataset.view;
    btn.disabled = disabled && view !== 'overview';
    btn.classList.toggle('active', view === state.currentView);
  });
  $('#inboundCount').textContent = state.callQueue;
}

const recruitmentQuestions = [
  {
    category: 'CUSTOMER COMMUNICATION',
    question: 'A customer is upset and begins speaking before you finish your greeting. What is the strongest first response?',
    help: 'Choose the response that protects the relationship while allowing you to understand the issue.',
    options: [
      { label: 'Interrupt and explain that the customer must follow the call process.', points: 0 },
      { label: 'Allow the customer to explain, acknowledge the concern and guide the conversation calmly.', points: 1 },
      { label: 'Transfer the customer immediately to avoid escalating the situation.', points: 0 },
      { label: 'Promise an immediate refund before checking the complaint.', points: 0 }
    ]
  },
  {
    category: 'CUSTOMER INFORMATION SECURITY',
    question: 'A caller says they are in a hurry and asks you to skip identity verification. What should you do?',
    help: 'This is a mandatory security decision. Consider the risk before choosing.',
    critical: true,
    options: [
      { label: 'Continue because the caller knows the account holder’s name.', points: 0, breach: true },
      { label: 'Ask the caller to provide their PIN or one-time password.', points: 0, breach: true },
      { label: 'Follow the approved authentication process before disclosing or changing account information.', points: 1 },
      { label: 'Give only the account balance, because it is not a sensitive detail.', points: 0, breach: true }
    ]
  },
  {
    category: 'LISTENING & COMPREHENSION',
    question: 'A customer says: “My card was charged twice for one purchase, but the merchant says they received one payment.” What is the primary issue to establish?',
    help: 'Identify the customer’s reported problem before selecting an investigation path.',
    options: [
      { label: 'A possible duplicate debit requiring transaction review.', points: 1 },
      { label: 'A request to increase the card withdrawal limit.', points: 0 },
      { label: 'A request to close the customer’s account.', points: 0 },
      { label: 'A request to dispute an unrelated cash withdrawal.', points: 0 }
    ]
  },
  {
    category: 'WORKPLACE JUDGEMENT',
    question: 'You cannot resolve a technical issue within your authorised access. What is the appropriate action?',
    help: 'Think about ownership, accurate records and escalation boundaries.',
    options: [
      { label: 'Make an undocumented change to the customer’s profile.', points: 0 },
      { label: 'Tell the customer the system will certainly be fixed in one hour.', points: 0 },
      { label: 'Record the evidence, explain the next step and escalate through the approved route.', points: 1 },
      { label: 'Close the interaction and ask the customer to call again.', points: 0 }
    ]
  },
  {
    category: 'DIGITAL WORKPLACE SKILLS',
    question: 'You need to document a customer interaction while keeping the conversation organised. Which practice is best?',
    help: 'Consider accuracy and the ability of another agent to understand the record later.',
    options: [
      { label: 'Write brief, factual notes with the issue, checks performed, actions and agreed next step.', points: 1 },
      { label: 'Write only “customer called” to save time.', points: 0 },
      { label: 'Record personal opinions about the customer.', points: 0 },
      { label: 'Wait several days and reconstruct the details from memory.', points: 0 }
    ]
  },
  {
    category: 'OUTBOUND CONTACT',
    question: 'You call a customer for an authorised product campaign. The customer says they do not want marketing calls. What should you do?',
    help: 'The customer’s contact preference must be respected and recorded through the approved process.',
    critical: true,
    options: [
      { label: 'Continue the pitch because the campaign has a target.', points: 0, breach: true },
      { label: 'End politely and record the opt-out request using the approved process.', points: 1 },
      { label: 'Call again from a different number.', points: 0, breach: true },
      { label: 'Ask another agent to continue the same sales call.', points: 0, breach: true }
    ]
  },
  {
    category: 'REASONING & PRIORITISATION',
    question: 'You have two waiting interactions: a routine balance enquiry and a customer reporting a suspected account takeover. Which should receive priority under the appropriate risk procedure?',
    help: 'Consider potential customer harm and the need for prompt protective action.',
    options: [
      { label: 'The routine balance enquiry because it is quicker.', points: 0 },
      { label: 'The suspected account takeover, following the applicable priority and security process.', points: 1 },
      { label: 'Neither; both should remain unattended until a supervisor arrives.', points: 0 },
      { label: 'The interaction from the customer who sounds most impatient.', points: 0 }
    ]
  }
];

const inboundScenarios = [
  {
    id:'atm-no-cash', category:'BANKING · ATM DISPUTE', customer:'Chinwe Okafor', initials:'CO', profile:'Retail customer · Current account', tag:'ATM DISPENSE ERROR', reference:'ATM-482197', issue:'Account debited but ATM did not dispense cash', amount:'₦40,000', location:'Wuse 2, Abuja',
    opening:'I tried to withdraw ₦40,000. The machine did not give me any cash, but I received a debit alert. I need my money back.',
    steps:[
      {label:'CUSTOMER AUTHENTICATION',prompt:'Before accessing or discussing the account, what should you do?',context:'The caller is frustrated and wants an immediate reversal.',options:[
        {text:'Complete the approved identity-verification steps before account-specific assistance.',score:2,feedback:'You protected the customer and followed the authentication boundary.'},
        {text:'Ask the customer to read their card PIN and OTP so you can confirm ownership.',score:-5,breach:true,feedback:'A PIN or one-time password must not be requested. This is a critical security failure.'},
        {text:'Proceed because the customer knows the transaction amount.',score:-2,feedback:'Transaction knowledge alone does not establish identity.'}
      ]},
      {label:'INVESTIGATION',prompt:'The customer is authenticated. Which investigation is most relevant?',context:'The transaction details show a debit at an ATM at the stated time. The customer reports no cash received.',options:[
        {text:'Capture the transaction reference, date, time, amount and ATM location, then follow the approved ATM dispute workflow.',score:2,feedback:'The details support a traceable ATM investigation.'},
        {text:'Tell the customer to contact the ATM manufacturer directly.',score:-1,feedback:'The bank or service provider must follow its approved dispute route.'},
        {text:'Immediately promise that the money will be reversed today.',score:-2,feedback:'Do not promise a resolution time that has not been verified.'}
      ]},
      {label:'RESOLUTION & DOCUMENTATION',prompt:'The transaction requires a formal investigation. What should you do next?',context:'No confirmed reversal is visible in the simulated system.',options:[
        {text:'Log a complete ATM dispute, provide the case reference and explain the approved follow-up process without inventing a timeline.',score:2,feedback:'You created a traceable case and set an accurate expectation.'},
        {text:'Close the call and tell the customer to keep checking their balance.',score:-1,feedback:'The complaint remains unrecorded and unresolved.'},
        {text:'Mark the dispute as resolved to improve your first-contact resolution score.',score:-4,breach:true,feedback:'Falsifying a resolution is a serious conduct and quality failure.'}
      ]}
    ]
  },
  {
    id:'failed-transfer',category:'BANKING · DIGITAL PAYMENTS',customer:'Tunde Adebayo',initials:'TA',profile:'Retail customer · Savings account',tag:'FAILED TRANSFER',reference:'TRF-905314',issue:'Transfer debited but beneficiary has not received funds',amount:'₦25,500',location:'Surulere, Lagos',
    opening:'I transferred ₦25,500 this morning. My account was debited, but the person I sent it to has not received anything.',
    steps:[
      {label:'CUSTOMER AUTHENTICATION',prompt:'What is the correct starting point?',context:'The caller can provide the transaction reference and beneficiary bank.',options:[
        {text:'Authenticate the customer through the approved process before accessing account details.',score:2,feedback:'You established identity before account-specific assistance.'},
        {text:'Ask for the customer’s mobile banking password.',score:-5,breach:true,feedback:'Never request passwords or authentication secrets.'},
        {text:'Ask the beneficiary to call you instead.',score:-1,feedback:'The account holder who initiated the complaint should be assisted through the approved process.'}
      ]},
      {label:'TRANSACTION TRACE',prompt:'Which details should guide the initial investigation?',context:'The customer is authenticated and has the transfer receipt.',options:[
        {text:'Transaction reference, date/time, amount, destination details and current transaction status.',score:2,feedback:'These details enable a structured transaction trace.'},
        {text:'Only the customer’s preferred reversal date.',score:-1,feedback:'A preferred date does not establish the transaction status.'},
        {text:'The beneficiary’s social media profile.',score:-2,feedback:'Social media information is not a valid transaction investigation record.'}
      ]},
      {label:'CUSTOMER UPDATE',prompt:'The simulated switch status is “pending investigation”. What should you communicate?',context:'The payment has not been confirmed as successful or reversed.',options:[
        {text:'Explain the recorded status, log or update the case and provide the valid reference and next step.',score:2,feedback:'You explained what is known without overstating the outcome.'},
        {text:'Confirm that the beneficiary has received the funds.',score:-3,feedback:'That statement conflicts with the unconfirmed transaction status.'},
        {text:'Guarantee an instant reversal.',score:-2,feedback:'A guaranteed outcome or timing must not be invented.'}
      ]}
    ]
  },
  {
    id:'card-decline',category:'BANKING · CARD SERVICES',customer:'Amina Yusuf',initials:'AY',profile:'Retail customer · Debit card',tag:'CARD DECLINED',reference:'CRD-174208',issue:'Card declined at a merchant terminal',amount:'₦18,700',location:'Kano, Nigeria',
    opening:'My debit card keeps declining at shops. There is money in my account, and I need to make a payment today.',
    steps:[
      {label:'AUTHENTICATION',prompt:'How should you begin the account-specific enquiry?',context:'The customer is at a point of sale and wants a quick answer.',options:[
        {text:'Use the approved customer-authentication workflow before discussing card or account details.',score:2,feedback:'You maintained the security process even under time pressure.'},
        {text:'Ask the customer to send a photo of both sides of the card through chat.',score:-5,breach:true,feedback:'Do not solicit full card details or security codes through an unapproved channel.'},
        {text:'Read out the available balance without verification.',score:-4,breach:true,feedback:'Account information must not be disclosed before authentication.'}
      ]},
      {label:'DIAGNOSIS',prompt:'Which checks are appropriate for a declined card?',context:'The account is active. The customer has not yet confirmed whether the decline occurs at all merchants.',options:[
        {text:'Check card status and applicable restrictions, then establish the decline pattern and error message.',score:2,feedback:'This identifies whether the issue is card-specific, merchant-specific or channel-related.'},
        {text:'Assume the card is permanently damaged and order a replacement.',score:-1,feedback:'The cause has not been established.'},
        {text:'Ask the customer to repeat the transaction many times.',score:-1,feedback:'Repeated attempts may create additional declines or risk controls.'}
      ]},
      {label:'NEXT ACTION',prompt:'The simulated record shows a temporary restriction requiring an approved review. What is appropriate?',context:'The agent role does not have permission to remove the restriction.',options:[
        {text:'Explain the restriction at the permitted level and refer the case through the approved card-support route.',score:2,feedback:'You respected access controls and selected the correct support path.'},
        {text:'Use another employee’s login to remove it.',score:-5,breach:true,feedback:'Credential sharing and unauthorised changes are prohibited.'},
        {text:'Tell the customer the card will work in ten minutes.',score:-2,feedback:'You cannot promise an unverified restoration time.'}
      ]}
    ]
  },
  {
    id:'app-login',category:'DIGITAL BANKING · FIRST-LINE SUPPORT',customer:'Emeka Nwosu',initials:'EN',profile:'Digital customer · Mobile banking',tag:'APP ACCESS',reference:'DIG-330817',issue:'Customer cannot sign in to the mobile application',amount:'Not applicable',location:'Enugu, Nigeria',
    opening:'I changed my phone and now I cannot sign in to my mobile banking app. I need to make a transfer.',
    steps:[
      {label:'IDENTITY & CHANNEL',prompt:'What should you establish before giving account-specific guidance?',context:'The customer is using a new device.',options:[
        {text:'Authenticate through the approved process and confirm the app version and device-change context.',score:2,feedback:'You established identity and gathered relevant troubleshooting context.'},
        {text:'Ask the customer to disclose their one-time password.',score:-5,breach:true,feedback:'One-time passwords must never be requested by an agent.'},
        {text:'Ask the customer to disable all security controls.',score:-3,breach:true,feedback:'Security controls must not be bypassed.'}
      ]},
      {label:'TROUBLESHOOTING',prompt:'Which is the safest initial support path?',context:'The customer confirms they installed the official application but changed devices.',options:[
        {text:'Use the approved device re-registration and access-recovery guidance; do not collect secrets.',score:2,feedback:'You selected a controlled recovery route and protected credentials.'},
        {text:'Ask the customer to install an unknown remote-access application.',score:-4,breach:true,feedback:'Unapproved remote access creates a serious security risk.'},
        {text:'Ask the customer to share their screen and reveal their password.',score:-5,breach:true,feedback:'An agent must not request passwords or expose secrets.'}
      ]},
      {label:'FOLLOW-UP',prompt:'The customer must complete a secure self-service verification step. How do you close?',context:'The agent cannot complete that security step on behalf of the customer.',options:[
        {text:'Explain the verified steps, confirm the customer understands and record the support interaction.',score:2,feedback:'You gave controlled guidance and completed the interaction record.'},
        {text:'Offer to complete the verification using the customer’s credentials.',score:-5,breach:true,feedback:'Agents must not take possession of customer authentication credentials.'},
        {text:'Close without explaining what the customer should do next.',score:-1,feedback:'The customer needs a clear next step.'}
      ]}
    ]
  },
  {
    id:'suspicious-activity',category:'BANKING · FRAUD SUPPORT',customer:'Bola Adeyemi',initials:'BA',profile:'Retail customer · Account security',tag:'SUSPICIOUS ACTIVITY',reference:'SEC-660219',issue:'Customer reports an unfamiliar transaction and possible account compromise',amount:'₦72,000',location:'Ibadan, Nigeria',
    opening:'I have received an alert for a transaction I did not make. Someone also called me asking for a code. I am worried my account has been compromised.',
    steps:[
      {label:'URGENT SECURITY RESPONSE',prompt:'What should you prioritise?',context:'The customer says they did not authorise the transaction and may have disclosed a security code.',options:[
        {text:'Follow the approved compromised-account procedure immediately, authenticate safely and avoid asking for any security code.',score:3,feedback:'You prioritised account protection and maintained secure authentication.'},
        {text:'Ask the customer to send the code they received so you can investigate.',score:-6,breach:true,feedback:'Requesting a one-time code is a critical security breach.'},
        {text:'Treat it as a routine balance enquiry and close the call.',score:-3,feedback:'A suspected compromise requires prompt action under the security procedure.'}
      ]},
      {label:'INCIDENT CAPTURE',prompt:'What information should be documented?',context:'The customer has been guided through the applicable immediate protective steps.',options:[
        {text:'Reported transaction details, time, contact attempt, customer statement, actions taken and escalation reference.',score:2,feedback:'You created a useful factual incident record.'},
        {text:'Only the amount, without noting the reported compromise.',score:-1,feedback:'The incident context and actions are essential to investigation.'},
        {text:'Your personal opinion about who committed the fraud.',score:-2,feedback:'Records must distinguish customer statements and verified facts from assumptions.'}
      ]},
      {label:'ESCALATION',prompt:'What is the correct close-out approach?',context:'The case meets the simulation’s fraud escalation criteria.',options:[
        {text:'Escalate to the designated fraud/security channel, provide the case reference and explain approved follow-up.',score:2,feedback:'You used the correct escalation boundary and set a clear expectation.'},
        {text:'Promise that all funds will be recovered.',score:-2,feedback:'Recovery cannot be guaranteed.'},
        {text:'Tell the customer to contact the suspected caller to ask for a refund.',score:-3,feedback:'That could expose the customer to further harm.'}
      ]}
    ]
  }
];


// Additional inbound industry packs for the cross-industry operations queue.
function buildIndustryScenario(data) {
  return {
    ...data,
    steps: [
      {label:'CUSTOMER CONTEXT & VERIFICATION',prompt:'What should you establish before accessing protected customer or service information?',context:'The customer is concerned and wants an immediate answer.',options:[
        {text:'Follow the approved identity or account-verification process and clarify the customer’s immediate concern.',score:2,feedback:'You established the right to access the record and identified the customer need.'},
        {text:'Ask for a password, PIN or one-time passcode to speed things up.',score:-5,breach:true,feedback:'Authentication secrets must never be requested.'},
        {text:'Open a record based only on the caller’s name.',score:-2,feedback:'A name alone is not sufficient authority to disclose protected information.'}
      ]},
      {label:'INVESTIGATION & DIAGNOSIS',prompt:data.investigationPrompt,context:data.investigationContext,options:[
        {text:data.investigationAction,score:2,feedback:data.investigationFeedback},
        {text:'Assume the cause without checking the relevant service, order or account record.',score:-2,feedback:'An assumption is not an investigation and can lead to incorrect advice.'},
        {text:'Blame another team or provider before establishing the facts.',score:-1,feedback:'Keep the interaction factual and use the approved investigation route.'}
      ]},
      {label:'RESOLUTION & CASE OWNERSHIP',prompt:data.resolutionPrompt,context:'You have completed the checks available to your role. What should happen next?',options:[
        {text:data.resolutionAction,score:2,feedback:data.resolutionFeedback},
        {text:'Mark the issue as resolved even though the customer’s problem remains open.',score:-4,breach:true,feedback:'A false resolution corrupts operational records and quality reporting.'},
        {text:'Promise a specific result or time that has not been confirmed.',score:-2,feedback:'Never invent a guaranteed outcome or resolution time.'}
      ]}
    ]
  };
}
inboundScenarios.push(
  buildIndustryScenario({id:'telecom-data',category:'TELECOMMUNICATIONS · DATA SUPPORT',customer:'Kehinde Balogun',initials:'KB',profile:'Mobile subscriber · Data services',tag:'DATA NOT WORKING',reference:'TEL-731904',issue:'Customer purchased a data bundle but mobile data is unavailable',amount:'Data bundle',location:'Ikeja, Lagos',opening:'I bought a data bundle this morning. I received a confirmation message, but I still cannot browse.',investigationPrompt:'Which checks are relevant to diagnosing the service issue?',investigationContext:'The customer confirms the device shows mobile signal but websites are not loading.',investigationAction:'Check the bundle status and validity, service provisioning indicators and basic device/network troubleshooting steps.',investigationFeedback:'You checked both the service entitlement and the most relevant connection factors.',resolutionPrompt:'The simulated account shows the bundle is active, but provisioning has not completed.',resolutionAction:'Explain the verified status, raise a network/provisioning ticket and provide the case reference and approved follow-up.',resolutionFeedback:'You avoided inventing a fix and routed the unresolved technical issue correctly.'}),
  buildIndustryScenario({id:'ecommerce-delivery',category:'E-COMMERCE · ORDER SUPPORT',customer:'Rita Ekanem',initials:'RE',profile:'Online shopper · Delivery enquiry',tag:'DELIVERY NOT RECEIVED',reference:'ECM-182641',issue:'Order marked delivered but customer says it was not received',amount:'Order #MS-4821',location:'Lekki, Lagos',opening:'My order says delivered, but nothing has arrived at my address. I need someone to investigate this.',investigationPrompt:'What should you check first?',investigationContext:'The order status is marked delivered in the simulated commerce platform.',investigationAction:'Review the order record, delivery timestamp, proof-of-delivery details and the approved carrier investigation path.',investigationFeedback:'You used the order and delivery evidence rather than assuming the customer or courier was wrong.',resolutionPrompt:'The proof-of-delivery record does not clearly identify the recipient.',resolutionAction:'Open a delivery investigation, record the customer’s statement, provide a reference and explain the next update route.',resolutionFeedback:'You recorded a traceable complaint and preserved a clear follow-up path.'}),
  buildIndustryScenario({id:'utility-token',category:'UTILITIES · PREPAID SERVICE',customer:'Musa Garba',initials:'MG',profile:'Utility customer · Prepaid meter',tag:'TOKEN NOT RECEIVED',reference:'UTL-408225',issue:'Customer paid for electricity units but has not received a token',amount:'₦15,000 payment',location:'Kaduna, Nigeria',opening:'I paid for electricity units, but the token has not come through. The payment went out of my account.',investigationPrompt:'Which details should guide the initial check?',investigationContext:'The customer has a payment reference and a meter number.',investigationAction:'Verify the permitted customer and meter details, payment reference, vending status and token-delivery record.',investigationFeedback:'You connected the payment and vending records using the relevant references.',resolutionPrompt:'The payment is visible but the token generation status is pending.',resolutionAction:'Create a vending support case, communicate the confirmed pending status and provide the correct case reference.',resolutionFeedback:'You accurately explained the status and escalated the operational issue.'}),
  buildIndustryScenario({id:'insurance-claim',category:'INSURANCE · POLICY SERVICE',customer:'Nneka Obi',initials:'NO',profile:'Policyholder · Claims enquiry',tag:'CLAIM STATUS',reference:'INS-991735',issue:'Customer wants an update on a submitted insurance claim',amount:'Claim reference CL-22091',location:'Port Harcourt, Nigeria',opening:'I submitted my claim two weeks ago and have not received an update. Can you tell me what is happening?',investigationPrompt:'What is the appropriate first review?',investigationContext:'The agent can view claim milestones but cannot approve or reject claims.',investigationAction:'Check the claim reference, recorded milestones, outstanding information and the authorised claims-team update.',investigationFeedback:'You checked the claim’s actual status and stayed within the agent’s authority.',resolutionPrompt:'The record shows one required document is still outstanding.',resolutionAction:'Explain the exact outstanding item from the approved record, state the accepted submission route and log the contact.',resolutionFeedback:'You provided a specific next step without implying that the claim was approved.'}),
  buildIndustryScenario({id:'travel-booking',category:'TRAVEL · RESERVATION SUPPORT',customer:'Peter Mensah',initials:'PM',profile:'Traveller · Booking support',tag:'BOOKING CHANGE',reference:'TRV-503118',issue:'Customer wants to change a travel booking',amount:'Booking BK-9052',location:'Accra, Ghana',opening:'I need to change the date on my booking. I want to know what options are available before I make a decision.',investigationPrompt:'What should you verify before discussing options?',investigationContext:'The customer has a booking reference and a preferred alternative date.',investigationAction:'Review the booking conditions, availability, applicable change rules and any verified fees before quoting options.',investigationFeedback:'You checked the actual booking terms and availability instead of guessing about fees or options.',resolutionPrompt:'The alternative date is available, but a verified change fee applies.',resolutionAction:'Explain the available option and confirmed fee, obtain the customer’s decision and record the request without changing the booking prematurely.',resolutionFeedback:'You gave transparent information and preserved customer authorisation.'}),
  buildIndustryScenario({id:'logistics-tracking',category:'LOGISTICS · SHIPMENT SUPPORT',customer:'Fatima Sule',initials:'FS',profile:'Recipient · Parcel tracking',tag:'SHIPMENT DELAY',reference:'LOG-663820',issue:'Customer reports a shipment has not moved for several days',amount:'Shipment SH-18823',location:'Jos, Nigeria',opening:'My parcel has been showing the same tracking update for four days. I need to know where it is.',investigationPrompt:'Which investigation is relevant?',investigationContext:'The tracking timeline has not updated since the shipment reached a sorting centre.',investigationAction:'Review scan history, last confirmed location, service-level status and the carrier’s trace/escalation route.',investigationFeedback:'You used verified tracking events and the correct shipment investigation route.',resolutionPrompt:'The shipment requires a depot trace and no new delivery date is confirmed.',resolutionAction:'Open a trace request, give the case reference and explain that a new delivery date will be shared only when confirmed.',resolutionFeedback:'You communicated the known facts and did not invent a delivery commitment.'})
);

const outboundCampaigns = [
  {id:'welcome',type:'ONBOARDING',title:'New customer welcome',customer:'David Eze',initials:'DE',context:'A new customer has opened a service account. Your task is to welcome them, confirm they can access the service and explain where to find approved support.',objective:'Complete the welcome and identify any onboarding support need.',script:[
    {label:'INTRODUCTION & PERMISSION',prompt:'The customer answers. How should you open the call?',options:[
      {text:'Introduce yourself and the organisation, confirm you are speaking to the intended customer using approved checks, then ask whether it is a convenient time.',score:2,feedback:'Professional, transparent opening with permission to continue.'},
      {text:'Immediately ask for their full account password.',score:-5,breach:true,feedback:'Passwords must never be requested.'},
      {text:'Start reading the full product terms without checking availability.',score:-1,feedback:'First establish identity and whether the customer can talk.'}
    ]},
    {label:'CUSTOMER NEED',prompt:'The customer says they have not received an activation message. What is the best response?',options:[
      {text:'Acknowledge the issue, check the approved onboarding status and explain the verified next step.',score:2,feedback:'You connected the call objective to a real customer need.'},
      {text:'Tell the customer to create another account immediately.',score:-1,feedback:'Duplicate account creation should not be suggested without an approved process.'},
      {text:'Say the system is always delayed and end the call.',score:-1,feedback:'You did not investigate or provide useful guidance.'}
    ]},
    {label:'DISPOSITION',prompt:'The customer understands the next step and has no further question. How should you finish?',options:[
      {text:'Summarise the agreed next step, invite final questions and record the correct call outcome.',score:2,feedback:'You closed clearly and completed the interaction record.'},
      {text:'Mark the customer as fully activated even though activation is pending.',score:-3,feedback:'The disposition must reflect the actual outcome.'},
      {text:'End the call without a closing statement.',score:-1,feedback:'A professional close confirms the outcome and next step.'}
    ]}
  ]},
  {id:'retention',type:'RETENTION',title:'Service retention follow-up',customer:'Ngozi Umeh',initials:'NU',context:'A customer previously reported repeated service interruptions and requested cancellation. Your task is to understand the reason and explore an appropriate resolution without pressuring them.',objective:'Resolve the concern where possible or record the customer’s decision accurately.',script:[
    {label:'INTRODUCTION & CONSENT',prompt:'How should you begin?',options:[
      {text:'Identify yourself, state the purpose honestly and ask whether the customer is willing to discuss the service issue.',score:2,feedback:'You made the purpose transparent and respected the customer’s choice.'},
      {text:'Pretend to be calling about a mandatory account security check.',score:-5,breach:true,feedback:'Misrepresenting the purpose of a call is unacceptable.'},
      {text:'Begin with a discount offer before acknowledging the previous complaint.',score:-1,feedback:'The unresolved customer concern should be understood first.'}
    ]},
    {label:'OBJECTION HANDLING',prompt:'The customer says, “I am tired of complaining. Nobody fixes this.” What is the best response?',options:[
      {text:'Acknowledge the repeated experience, ask what remains unresolved and check the case history before discussing options.',score:2,feedback:'You listened, showed accountability and avoided a premature sales pitch.'},
      {text:'Tell the customer they are exaggerating.',score:-2,feedback:'Dismissive language damages trust and does not establish the facts.'},
      {text:'Offer an unrelated product to change the subject.',score:-2,feedback:'An unrelated offer does not address the stated issue.'}
    ]},
    {label:'CUSTOMER DECISION',prompt:'The customer still wants to cancel and confirms the request. What should you do?',options:[
      {text:'Respect the decision, explain the approved cancellation process and record the outcome.',score:2,feedback:'You respected the customer’s decision and followed the correct process.'},
      {text:'Keep the customer on the line until they agree to stay.',score:-3,feedback:'Pressure tactics are not an appropriate retention method.'},
      {text:'Mark the customer as retained without their agreement.',score:-4,breach:true,feedback:'Misreporting retention results is a serious integrity failure.'}
    ]}
  ]},
  {id:'payment-reminder',type:'PAYMENT REMINDER',title:'Payment reminder campaign',customer:'Ibrahim Sani',initials:'IS',context:'An authorised service campaign requires a courteous reminder about an upcoming payment. Do not disclose sensitive information before the required verification.',objective:'Deliver an accurate reminder or record a callback/decline preference.',script:[
    {label:'IDENTITY & PURPOSE',prompt:'The customer answers. What is the correct approach?',options:[
      {text:'Introduce yourself, verify the intended customer using approved rules and explain the general purpose of the call.',score:2,feedback:'You maintained privacy and made the purpose clear.'},
      {text:'Announce the customer’s outstanding amount to whoever answers.',score:-4,breach:true,feedback:'Sensitive account or payment details must not be disclosed to an unverified person.'},
      {text:'Ask the customer to share their PIN to confirm identity.',score:-5,breach:true,feedback:'PINs must never be requested.'}
    ]},
    {label:'CUSTOMER RESPONSE',prompt:'The customer confirms identity and asks for the due date. What should you do?',options:[
      {text:'Check the approved record, provide only the verified due-date information and answer questions within your remit.',score:2,feedback:'You provided accurate information within your authority.'},
      {text:'Invent a due date to keep the call short.',score:-3,feedback:'Payment information must be accurate and verified.'},
      {text:'Threaten immediate service termination.',score:-3,feedback:'Do not make threats or claims that are not supported by the approved policy.'}
    ]},
    {label:'DISPOSITION & PREFERENCE',prompt:'The customer requests no further reminder calls. What is the correct action?',options:[
      {text:'Record the preference through the approved contact-management process and confirm the next step.',score:2,feedback:'You respected the preference and documented it.'},
      {text:'Ignore the request because the campaign is still active.',score:-4,breach:true,feedback:'Contact preferences and applicable restrictions must be respected.'},
      {text:'Move the customer to a different campaign list.',score:-3,feedback:'That would bypass the customer’s stated preference.'}
    ]}
  ]}
];


outboundCampaigns.push(
  {id:'product-offer',type:'AUTHORISED SALES',title:'Customer product offer',customer:'Oluwaseun Akin',initials:'OA',context:'An existing customer is on an approved contact list for a product-information campaign. Your task is to establish interest and explain a suitable offer accurately, without pressure.',objective:'Qualify customer interest and record the true outcome.',script:[
    {label:'TRANSPARENT INTRODUCTION',prompt:'How should you introduce the call?',options:[
      {text:'Identify yourself and the organisation, state the campaign purpose and ask whether the customer is willing to hear the information.',score:2,feedback:'You disclosed the purpose and asked permission to continue.'},
      {text:'Pretend the call is about a mandatory account problem.',score:-5,breach:true,feedback:'Misrepresenting a sales call is unacceptable.'},
      {text:'Start quoting benefits before confirming the customer can talk.',score:-1,feedback:'Establish permission and availability before the pitch.'}
    ]},
    {label:'NEED & PRODUCT FIT',prompt:'The customer agrees to listen but says they are unsure what they need. What is best?',options:[
      {text:'Ask relevant discovery questions and describe only features, eligibility and charges verified in the approved material.',score:2,feedback:'You linked the offer to customer needs and used verified information.'},
      {text:'Claim that approval is guaranteed for every customer.',score:-3,feedback:'Eligibility and approval must never be misrepresented.'},
      {text:'Hide the applicable charges until after the customer accepts.',score:-4,breach:true,feedback:'Material product charges must not be concealed.'}
    ]},
    {label:'DECISION & DISPOSITION',prompt:'The customer declines the offer. What should you do?',options:[
      {text:'Accept the decision, end professionally and record the decline accurately.',score:2,feedback:'You respected the customer’s decision and recorded the real outcome.'},
      {text:'Keep pressing until the customer agrees.',score:-2,feedback:'Pressure is not appropriate sales practice.'},
      {text:'Record a sale to meet the campaign target.',score:-4,breach:true,feedback:'Falsifying a sale is a serious integrity failure.'}
    ]}
  ]},
  {id:'satisfaction-survey',type:'CUSTOMER FEEDBACK',title:'Post-service satisfaction survey',customer:'Grace Ofori',initials:'GO',context:'A customer recently completed a service interaction. Your role is to request feedback, listen to the customer and record any unresolved issue.',objective:'Capture genuine feedback and identify any follow-up required.',script:[
    {label:'PURPOSE & PERMISSION',prompt:'How should you open the survey call?',options:[
      {text:'Identify yourself, explain that the call is for brief feedback about a recent service interaction and ask whether the customer can participate.',score:2,feedback:'You explained the purpose and respected the customer’s time.'},
      {text:'Say the survey is compulsory when it is voluntary.',score:-3,breach:true,feedback:'Do not misrepresent voluntary participation.'},
      {text:'Begin asking personal questions unrelated to the service.',score:-1,feedback:'Keep the survey relevant and proportionate.'}
    ]},
    {label:'FEEDBACK & LISTENING',prompt:'The customer says the agent was polite but the issue remains unresolved. What is appropriate?',options:[
      {text:'Acknowledge the feedback and offer to record or route the unresolved issue through the proper process.',score:2,feedback:'You preserved the feedback and identified a service recovery need.'},
      {text:'Change the rating to satisfied so the team score improves.',score:-4,breach:true,feedback:'Customer feedback must never be altered.'},
      {text:'Tell the customer not to mention the unresolved issue.',score:-2,feedback:'The survey must reflect the customer’s genuine experience.'}
    ]},
    {label:'RECORD & CLOSE',prompt:'How should you complete the interaction?',options:[
      {text:'Record the customer’s actual feedback, capture any follow-up request and close courteously.',score:2,feedback:'You completed an accurate survey record and follow-up.'},
      {text:'Submit a positive response without recording the customer’s words.',score:-3,feedback:'The record must reflect what the customer actually said.'},
      {text:'Close without recording the interaction.',score:-1,feedback:'The survey result and any service issue would be lost.'}
    ]}
  ]},
  {id:'appointment-confirm',type:'APPOINTMENT SERVICE',title:'Appointment confirmation',customer:'Samuel Nwankwo',initials:'SN',context:'A service team has an authorised list of customers with scheduled appointments. Confirm attendance, capture any change request and update the appointment record.',objective:'Confirm, reschedule through the approved route or record cancellation accurately.',script:[
    {label:'IDENTIFY & EXPLAIN',prompt:'How should you start the call?',options:[
      {text:'Identify yourself, explain the appointment-confirmation purpose and use the approved checks before disclosing protected booking details.',score:2,feedback:'You were transparent and protected customer information.'},
      {text:'Read out the full appointment details to anyone who answers.',score:-3,breach:true,feedback:'Protected booking information should not be disclosed to an unverified person.'},
      {text:'Ask for the customer’s password to confirm the appointment.',score:-5,breach:true,feedback:'Passwords are not appointment verification credentials.'}
    ]},
    {label:'CUSTOMER RESPONSE',prompt:'The customer asks to move the appointment to another day. What should you do?',options:[
      {text:'Check permitted availability and the approved change process before confirming a new slot.',score:2,feedback:'You checked the actual options before making a commitment.'},
      {text:'Confirm a date without checking availability.',score:-2,feedback:'An unverified booking promise can create an operational failure.'},
      {text:'Cancel the original appointment without customer authorisation.',score:-3,breach:true,feedback:'Do not alter a booking without the required authorisation.'}
    ]},
    {label:'UPDATE & DISPOSITION',prompt:'The customer accepts a verified new time. What is the correct close?',options:[
      {text:'Update the record through the approved workflow, repeat the confirmed details and record the outcome.',score:2,feedback:'You confirmed the change and completed a traceable record.'},
      {text:'Leave the old time in the system and rely on the conversation.',score:-2,feedback:'The booking record must reflect the agreed outcome.'},
      {text:'Mark the customer as unreachable.',score:-3,feedback:'The call disposition must reflect what happened.'}
    ]}
  ]}
);

const knowledgeArticles = [
  {id:'call-control',icon:'◉',category:'CONTACT OPERATIONS',title:'Professional call control',summary:'Structure an interaction from opening through closure.',body:'<h4>Call structure</h4><ul><li>Open with the approved greeting and identify the organisation.</li><li>Authenticate before account-specific disclosures or changes.</li><li>Use open questions to understand the customer’s actual concern.</li><li>Explain the next step in plain language and check understanding.</li><li>Record accurate notes and close professionally.</li></ul><p>Never trade a mandatory security or compliance step for speed.</p>'},
  {id:'security',icon:'◇',category:'SECURITY',title:'Customer information protection',summary:'Safe handling of credentials, personal data and account details.',body:'<h4>Security principles</h4><ul><li>Use only the approved authentication workflow.</li><li>Never ask a customer to disclose a PIN, password or one-time password.</li><li>Do not use another employee’s credentials.</li><li>Do not disclose personal or account information to an unverified person.</li><li>Escalate suspected compromise through the designated route.</li></ul><p>Use current organisation-approved procedures for exact verification steps and permitted disclosures.</p>'},
  {id:'crm',icon:'▤',category:'CASE MANAGEMENT',title:'Writing useful CRM notes',summary:'Create records that another agent can understand and action.',body:'<h4>Useful case notes</h4><ul><li>Record the customer’s issue in neutral, factual language.</li><li>Include relevant transaction or service references.</li><li>Record checks performed and the result of each check.</li><li>Document actions taken, escalation destination and case reference.</li><li>State the customer’s agreed next step and any promised follow-up.</li></ul><p>Do not record speculation, unnecessary sensitive data or personal opinions.</p>'},
  {id:'outbound',icon:'↗',category:'OUTBOUND SERVICES',title:'Responsible outbound calling',summary:'Transparent introductions, customer permission and accurate dispositions.',body:'<h4>Outbound call standards</h4><ul><li>Use an authorised contact list and approved campaign purpose.</li><li>Identify yourself and the organisation honestly.</li><li>Complete required identity checks before sharing protected information.</li><li>Respect refusal, opt-out and callback preferences.</li><li>Record the actual result; never fabricate a sale, collection or retention.</li></ul><p>Applicable consent, contact-hour and do-not-contact rules must be configured for each organisation and jurisdiction.</p>'},
  {id:'complaints',icon:'◎',category:'COMPLAINTS',title:'Complaint ownership & escalation',summary:'Investigate, document and route unresolved customer issues.',body:'<h4>Complaint handling</h4><ul><li>Listen and acknowledge the impact of the problem.</li><li>Clarify the expected outcome and relevant events.</li><li>Check only the systems and records within your permission.</li><li>Resolve within your authority or escalate to the designated team.</li><li>Give a valid reference and an accurate next step.</li></ul><p>Never promise an outcome or resolution time that has not been confirmed.</p>'},
  {id:'qa',icon:'⌁',category:'QUALITY',title:'Quality and performance',summary:'Balance accuracy, customer experience, compliance and efficiency.',body:'<h4>Quality behaviours</h4><ul><li>Follow verification and privacy requirements.</li><li>Understand the reason for contact before choosing a solution.</li><li>Provide correct information and explain it clearly.</li><li>Complete the record before moving on.</li><li>Use hold, transfer and escalation procedures correctly.</li></ul><p>Actual scorecards, weightings and pass thresholds are organisation-configurable and must come from approved QA standards.</p>'}
];

function renderOverview() {
  if (state.stage === 'assessment') return renderAssessment();
  if (state.stage === 'offer') return renderOffer();
  if (!state.hired) {
    viewRoot.innerHTML = `
      <div class="grid two">
        <section class="panel welcome-card">
          <div class="subtle-label">MERIDIAN SERVICE GROUP · CAREER OPPORTUNITY</div>
          <h3>${state.stage==='failed' ? 'Your assessment needs to be retaken.' : state.applicationSubmitted ? 'Your application is ready for assessment.' : 'Build a career on the contact-centre floor.'}</h3>
          <p>${state.stage==='failed' ? 'The recruitment result did not meet the required standard. Retake the aptitude and practical call stages to continue.' : state.applicationSubmitted ? 'Your candidate profile has been created. Complete the recruitment assessment to qualify for an agent appointment.' : 'Apply for a role, demonstrate your aptitude and communication skills, then begin a working career across customer operations.'}</p>
          <button class="btn primary" data-action="${state.applicationSubmitted ? 'begin-assessment' : 'open-application'}">${state.applicationSubmitted ? 'Begin recruitment assessment →' : 'Apply for a position →'}</button>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h3>Recruitment pathway</h3><p>Progress through the hiring process.</p></div><span class="pill amber">${state.applicationSubmitted ? 'APPLICATION READY' : 'NOT STARTED'}</span></div>
          <div class="step-list">
            ${[['01','Candidate application','Profile and role selection'],['02','Aptitude & judgement','Reasoning, listening and security'],['03','Practical call assessment','Customer interaction simulation'],['04','Interview & appointment','Employment decision']].map((s,i)=>`<div class="step-row ${state.applicationSubmitted&&i===0?'done':i===1&&state.applicationSubmitted?'active':''}"><div class="step-number">${state.applicationSubmitted&&i===0?'✓':s[0]}</div><div class="step-copy"><strong>${s[1]}</strong><small>${s[2]}</small></div><span class="step-state">${state.applicationSubmitted&&i===0?'COMPLETE':i===1&&state.applicationSubmitted?'NEXT':'PENDING'}</span></div>`).join('')}
          </div>
        </section>
      </div>
      <div class="grid three" style="margin-top:14px">
        <div class="panel metric-card"><div class="metric-top"><span class="metric-label">AVAILABLE CAREER TRACKS</span><span class="metric-icon">♙</span></div><div class="metric-value">04</div><div class="metric-foot">Banking · Service · Technical · Sales</div></div>
        <div class="panel metric-card"><div class="metric-top"><span class="metric-label">CUSTOMER CHANNELS</span><span class="metric-icon">◉</span></div><div class="metric-value">05</div><div class="metric-foot">Voice · Email · Chat · Social · Back office</div></div>
        <div class="panel metric-card"><div class="metric-top"><span class="metric-label">CAREER PATHS</span><span class="metric-icon">↗</span></div><div class="metric-value">10+</div><div class="metric-foot">Agent to operations leadership</div></div>
      </div>
      <div class="panel" style="margin-top:14px"><div class="panel-head"><div><h3>What happens after hiring?</h3><p>The main experience is operational work, not a classroom course.</p></div><span class="pill green">CAREER SIMULATION</span></div><div class="grid three"><div><div class="subtle-label">01 · RECEIVE CONTACTS</div><p class="muted-note">Answer inbound calls, chats and messages or start approved outbound campaigns.</p></div><div><div class="subtle-label">02 · OPERATE SYSTEMS</div><p class="muted-note">Use simulated CRM, customer records, ticketing and service applications to complete work.</p></div><div><div class="subtle-label">03 · BUILD YOUR CAREER</div><p class="muted-note">Meet service, quality and compliance expectations to earn progression and specialist roles.</p></div></div></div>`;
  } else {
    const qa = Math.round(average(state.totalQA,state.qaCount,0));
    const csat = average(state.totalCSAT,state.csatCount,0);
    viewRoot.innerHTML = `
      <div class="grid two">
        <section class="panel welcome-card"><div class="subtle-label">${escapeHTML(state.department.toUpperCase())} · DAY ${state.day}</div><h3>${state.shiftActive ? 'You are on shift. The queue is moving.' : 'Your workstation is ready.'}</h3><p>${state.shiftActive ? 'Take the next customer interaction, complete an outbound assignment or review your active service cases.' : 'Start your shift to receive inbound contacts and assigned outbound work.'}</p><button class="btn primary" data-action="${state.shiftActive?'open-inbound':'start-shift'}">${state.shiftActive?'Open inbound desk →':'Start shift →'}</button></section>
        <section class="panel"><div class="panel-head"><div><h3>Shift control</h3><p>Today’s operational snapshot.</p></div><span class="pill ${state.shiftActive?'green':'amber'}">${state.shiftActive?'ON SHIFT':'NOT STARTED'}</span></div><div class="data-list"><div class="data-row"><span>Assigned department</span><strong>${escapeHTML(state.department)}</strong></div><div class="data-row"><span>Inbound contacts waiting</span><strong>${state.callQueue}</strong></div><div class="data-row"><span>Calls completed</span><strong>${state.callsHandled}</strong></div><div class="data-row"><span>Cases logged</span><strong>${state.cases.length}</strong></div><div class="data-row"><span>Shift activity</span><strong>${Math.floor(state.shiftMinutes/60)}h ${state.shiftMinutes%60}m</strong></div></div></section>
      </div>
      <div class="grid three" style="margin-top:14px">
        ${metricCard('CALLS HANDLED',state.callsHandled,'Total inbound contacts','↙')}
        ${metricCard('QUALITY SCORE',qa?qa+'%':'—',qa?'Average simulated QA':'Pending first call','⌁')}
        ${metricCard('CUSTOMER SATISFACTION',csat?csat.toFixed(1)+'/5':'—',csat?'Average simulated CSAT':'Pending feedback','☆')}
      </div>
      <div class="grid two" style="margin-top:14px">
        <section class="panel"><div class="panel-head"><div><h3>Available work</h3><p>Choose the next operational activity.</p></div></div><div class="case-item"><div class="case-symbol">↙</div><div class="case-copy"><strong>Inbound customer queue</strong><small>${state.callQueue} simulated contacts waiting</small></div><button class="btn small secondary" data-action="open-inbound">Open</button></div><div class="case-item"><div class="case-symbol">↗</div><div class="case-copy"><strong>Outbound campaign desk</strong><small>Customer onboarding, retention and payment reminders</small></div><button class="btn small secondary" data-action="open-outbound">Open</button></div><div class="case-item"><div class="case-symbol">✉</div><div class="case-copy"><strong>Digital support desk</strong><small>Email, live chat and social media</small></div><button class="btn small secondary" data-action="open-digital">Open</button></div><div class="case-item"><div class="case-symbol">▤</div><div class="case-copy"><strong>Open CRM cases</strong><small>${state.cases.length} records in your case history</small></div><button class="btn small secondary" data-action="open-crm">Open</button></div></section>
        <section class="panel"><div class="panel-head"><div><h3>Workplace briefing</h3><p>Current role expectations.</p></div><span class="pill green">ACTIVE ROLE</span></div><p class="muted-note">Handle each customer contact with accuracy, privacy and professional judgement. Use the approved knowledge base, record the actual outcome and escalate beyond your authority. Speed never overrides security or correct resolution.</p><div class="data-list"><div class="data-row"><span>Employment status</span><strong>Active employee</strong></div><div class="data-row"><span>Monthly base salary</span><strong>${money(state.salary)}</strong></div><div class="data-row"><span>Career level</span><strong>Level ${state.level}</strong></div></div></section>
      </div>`;
  }
}
function metricCard(label,value,foot,icon) { return `<div class="panel metric-card"><div class="metric-top"><span class="metric-label">${label}</span><span class="metric-icon">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-foot">${foot}</div></div>`; }

function renderAssessment() {
  if (state.assessmentPhase === 'practical') return renderPracticalAssessment();
  const i = state.assessmentIndex;
  const q = recruitmentQuestions[i];
  if (!q) return renderAssessmentResult();
  const answer = state.assessmentAnswers[i];
  viewRoot.innerHTML = `<div class="grid two"><section class="panel assessment-card"><div class="panel-head"><div><div class="question-kicker">RECRUITMENT ASSESSMENT · ${q.category}</div><h3 style="margin-top:7px">Candidate screening</h3></div><span class="pill">QUESTION ${i+1} OF ${recruitmentQuestions.length}</span></div><div class="progress-track"><div class="progress-fill" style="width:${((i)/recruitmentQuestions.length)*100}%"></div></div><div class="question-title">${q.question}</div><p class="question-help">${q.help}</p><div class="answer-list">${q.options.map((o,j)=>`<button class="answer-option ${answer===j?'selected':''}" data-answer="${j}"><span class="answer-letter">${String.fromCharCode(65+j)}</span><span>${o.label}</span></button>`).join('')}</div><div class="assessment-footer"><small>Responses are evaluated for role readiness and critical security judgement.</small><button class="btn primary" data-action="assessment-next" ${answer===undefined?'disabled':''}>${i===recruitmentQuestions.length-1?'Submit assessment':'Continue →'}</button></div></section><aside class="panel"><div class="panel-head"><div><h3>Assessment stages</h3><p>Recruitment requirements for ${escapeHTML(state.department)}.</p></div></div><div class="step-list">${['Communication and listening','Customer information security','Service comprehension','Workplace judgement','Digital work skills','Outbound contact ethics','Reasoning and prioritisation'].map((x,j)=>`<div class="step-row ${j<i?'done':j===i?'active':''}"><div class="step-number">${j<i?'✓':String(j+1).padStart(2,'0')}</div><div class="step-copy"><strong>${x}</strong><small>${j<i?'Response recorded':j===i?'Current section':'Awaiting response'}</small></div><span class="step-state">${j<i?'DONE':j===i?'NOW':'LOCKED'}</span></div>`).join('')}</div><div class="article-box"><h4>Assessment integrity</h4><p>Some security and customer-consent decisions are critical. A critical breach can prevent appointment even where the overall score is high.</p></div></aside></div>`;
}
const practicalCallSteps = [
  {label:'OPENING THE CALL',prompt:'A customer says: “I have been trying to reach someone all morning. My transfer has not arrived.” How do you open?',options:[
    {label:'Use the approved greeting, identify yourself and the organisation, then invite the customer to explain the issue.',points:1},
    {label:'Tell the customer to calm down before you will help.',points:0},
    {label:'Promise an immediate reversal before checking anything.',points:0}
  ]},
  {label:'LISTENING & PROBING',prompt:'The customer explains that the account was debited. What should you establish next?',options:[
    {label:'Ask focused questions for the transaction reference, date, amount and beneficiary details, while following authentication requirements.',points:1},
    {label:'Ask for the customer’s PIN and one-time password.',points:0,breach:true},
    {label:'Assume the beneficiary bank is responsible and end the call.',points:0}
  ]},
  {label:'SETTING EXPECTATIONS',prompt:'The simulated transaction status is still under investigation. What should you say?',options:[
    {label:'Explain the verified status, document the complaint, provide a valid case reference and describe the next approved step.',points:1},
    {label:'Guarantee that the funds will be available within ten minutes.',points:0},
    {label:'Tell the customer the issue is resolved even though it is still pending.',points:0,breach:true}
  ]}
];

function renderPracticalAssessment() {
  const i=state.practicalIndex;const step=practicalCallSteps[i];const answer=state.practicalAnswers[i];
  if(!step)return renderAssessmentResult();
  viewRoot.innerHTML=`<div class="grid two"><section class="panel assessment-card"><div class="panel-head"><div><div class="question-kicker">RECRUITMENT · PRACTICAL CALL ASSESSMENT</div><h3 style="margin-top:7px">Customer roleplay simulation</h3></div><span class="pill">CALL STEP ${i+1} OF ${practicalCallSteps.length}</span></div><div class="progress-track"><div class="progress-fill" style="width:${(i/practicalCallSteps.length)*100}%"></div></div><div class="customer-strip"><div class="customer-avatar">SO</div><div class="customer-info"><strong>Sola Oladipo</strong><small>Recruitment roleplay · Inbound banking enquiry</small></div><span class="pill amber">PRACTICAL TEST</span></div><div class="question-kicker">${step.label}</div><div class="question-title">${step.prompt}</div><p class="question-help">Choose how you would handle this moment in a real customer conversation. The assessment evaluates judgement, not memorised product facts.</p><div class="answer-list">${step.options.map((o,j)=>`<button class="answer-option ${answer===j?'selected':''}" data-practical-answer="${j}"><span class="answer-letter">${String.fromCharCode(65+j)}</span><span>${o.label}</span></button>`).join('')}</div><div class="assessment-footer"><small>Complete all three call stages. A critical security breach prevents a pass.</small><button class="btn primary" data-action="practical-next" ${answer===undefined?'disabled':''}>${i===practicalCallSteps.length-1?'Submit practical assessment':'Continue →'}</button></div></section><aside class="panel"><div class="panel-head"><div><h3>Recruitment scorecard</h3><p>Practical contact-centre readiness.</p></div></div><div class="step-list">${['Opening and professionalism','Listening and focused questions','Expectation setting and ownership'].map((x,j)=>`<div class="step-row ${j<i?'done':j===i?'active':''}"><div class="step-number">${j<i?'✓':String(j+1).padStart(2,'0')}</div><div class="step-copy"><strong>${x}</strong><small>${j<i?'Response recorded':j===i?'Current call stage':'Awaiting response'}</small></div><span class="step-state">${j<i?'DONE':j===i?'NOW':'PENDING'}</span></div>`).join('')}</div><div class="article-box"><h4>What is being assessed?</h4><p>Greeting, active listening, relevant questioning, safe handling of customer information, accurate expectation setting and professional call ownership.</p></div></aside></div>`;
}

function renderAssessmentResult() {
  const correct = state.assessmentAnswers.reduce((sum,ans,i)=>sum+(recruitmentQuestions[i]?.options[ans]?.points||0),0);
  const practicalScore=state.practicalAnswers.reduce((sum,ans,i)=>sum+(practicalCallSteps[i]?.options[ans]?.points||0),0);
  const breached = state.assessmentAnswers.some((ans,i)=>recruitmentQuestions[i]?.options[ans]?.breach) || state.practicalAnswers.some((ans,i)=>practicalCallSteps[i]?.options[ans]?.breach);
  const passed = correct >= 5 && practicalScore >= 2 && !breached;
  state.stage = passed ? 'offer' : 'failed';
  state.assessmentScore = correct;
  state.practicalScore = practicalScore;
  state.assessmentPassed = passed;
  saveState();
  setHeader();
  $('#pageEyebrow').textContent='RECRUITMENT DECISION';
  $('#pageTitle').textContent=passed?'Assessment passed':'Assessment not passed';
  $('#pageDescription').textContent='Recruitment screening and practical customer-call evaluation.';
  if (passed) return renderOffer();
  viewRoot.innerHTML = `<div class="panel assessment-card"><span class="pill red">ASSESSMENT NOT PASSED</span><h3 style="font:800 20px Manrope;margin:15px 0 6px">Your application requires further development.</h3><p class="muted-note">Aptitude score: ${correct} / ${recruitmentQuestions.length}. Practical call score: ${practicalScore} / ${practicalCallSteps.length}. ${breached?'A critical security or contact-preference breach was recorded.':'The required assessment standard was not achieved.'} Review the recruitment standards and retake both stages.</p><div class="grid three" style="margin:18px 0">${metricCard('APTITUDE SCORE',`${correct}/${recruitmentQuestions.length}`,'Recruitment screening','◈')}${metricCard('PRACTICAL CALL',`${practicalScore}/${practicalCallSteps.length}`,'Customer roleplay','☎')}${metricCard('CRITICAL BREACH',breached?'RECORDED':'NONE','Security and customer protection','!')}</div><button class="btn primary" data-action="retake-assessment">Retake assessment</button></div>`;
}
function renderOffer() {
  viewRoot.innerHTML = `<div class="grid two"><section class="panel welcome-card"><div class="subtle-label">MERIDIAN SERVICE GROUP · PEOPLE & OPERATIONS</div><h3>Employment offer approved.</h3><p>Your recruitment assessment has been passed. You have been selected for the ${escapeHTML(state.department)} team. Accept the appointment to enter the operations floor and start your first shift.</p><button class="btn primary" data-action="accept-offer">Accept employment offer →</button></section><section class="panel"><div class="panel-head"><div><h3>Appointment details</h3><p>Simulated employment contract summary.</p></div><span class="pill green">APPROVED</span></div><div class="data-list"><div class="data-row"><span>Candidate</span><strong>${escapeHTML(state.applicantName)}</strong></div><div class="data-row"><span>Position</span><strong>${escapeHTML(state.roleTitle)}</strong></div><div class="data-row"><span>Department</span><strong>${escapeHTML(state.department)}</strong></div><div class="data-row"><span>Monthly base salary</span><strong>${money(state.salary)}</strong></div><div class="data-row"><span>Aptitude assessment</span><strong>${state.assessmentScore}/7</strong></div><div class="data-row"><span>Practical call assessment</span><strong>${state.practicalScore}/3 · Passed</strong></div><div class="data-row"><span>Employment status</span><strong>Offer pending acceptance</strong></div></div></section></div>`;
}

function renderVoicePractice(call, customerPrompt) {
  const recording = voiceStatus === 'recording';
  const transcribing = voiceStatus === 'transcribing';
  const busy = recording || transcribing;
  const supportedRecord = mediaRecordingAvailable();
  const supportedSpeech = speechRecognitionAvailable();
  return `<section class="voice-practice-panel">
    <div class="panel-head"><div><h3>Voice practice & customer audio</h3><p>Optional local microphone practice for this simulated interaction.</p></div><span class="pill ${busy?'amber':voiceStatus==='ready'?'green':''}">${voiceStatus.toUpperCase()}</span></div>
    <button class="btn small outline" type="button" data-action="play-customer-prompt" data-text="${escapeHTML(customerPrompt)}">Play customer statement</button>
    <label class="voice-consent"><input type="checkbox" id="voiceConsent" ${voiceConsent?'checked':''}> I consent to microphone use for this practice interaction. I understand browser speech recognition may be processed by the browser's speech service.</label>
    <div class="button-row">
      <button class="btn primary" type="button" data-action="start-voice-recording" ${!voiceConsent||!supportedRecord||busy?'disabled':''}>Record a local voice sample</button>
      <button class="btn outline" type="button" data-action="stop-voice-recording" ${!recording?'disabled':''}>Stop recording</button>
      ${supportedSpeech?`<button class="btn secondary" type="button" data-action="start-voice-transcription" ${!voiceConsent||busy?'disabled':''}>Start live transcription</button><button class="btn outline" type="button" data-action="stop-voice-transcription" ${!transcribing?'disabled':''}>Stop transcription</button>`:''}
    </div>
    ${voiceAudioUrl?`<audio class="voice-audio-player" controls preload="none" src="${voiceAudioUrl}">Your browser cannot play this recording.</audio>`:''}
    <div class="form-field"><label for="voiceTranscriptText">TEMPORARY PRACTICE TRANSCRIPT</label><div class="voice-transcript" id="voiceTranscriptText">${escapeHTML(voiceTranscript||'No transcript captured yet.')}</div></div>
    <form id="voiceFallbackForm" class="form-stack"><label class="form-field">Text fallback<input name="utterance" maxlength="1200" placeholder="Type what you would say to the customer…" autocomplete="off"></label><button class="btn outline" type="submit">Record text response</button></form>
    <div class="voice-privacy-note">Recording stays in this page's memory and is not uploaded or written to the employment save. Clear it before leaving a shared device. Never speak or enter a PIN, password, one-time code or full payment-card number.</div>
    <button class="btn small outline" type="button" data-action="clear-voice-practice">Clear microphone sample and transcript</button>
  </section>`;
}

async function startVoiceRecording() {
  if (!voiceConsent) { toast('Give explicit microphone consent before recording.','warning'); return; }
  if (!mediaRecordingAvailable()) { toast('Local microphone recording is not supported in this browser. Use the text fallback.','warning'); return; }
  if (voiceStatus==='recording'||voiceStatus==='transcribing') return;
  try {
    voiceMediaStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if(document.visibilityState==='hidden'||!voiceConsent){stopVoiceTracks();voiceStatus='inactive';return;}
    voiceChunks = [];
    voiceSession = createVoiceSession({ interactionRef: state.currentCall?.queueContactId || 'PRACTICE', consent: true });
    const options = {};
    if (MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')) options.mimeType = 'audio/webm;codecs=opus';
    voiceRecorder = new MediaRecorder(voiceMediaStream, options);
    voiceRecorder.ondataavailable = event => { if (event.data?.size) voiceChunks.push(event.data); };
    voiceRecorder.onerror = () => { voiceStatus='error'; stopVoiceTracks(); renderView(); toast('Microphone recording failed.','error'); };
    voiceRecorder.onstop = () => {
      clearTimeout(voiceRecordingTimer);voiceRecordingTimer=null;
      const mimeType = voiceRecorder?.mimeType || voiceChunks[0]?.type || 'audio/webm';
      if (voiceChunks.length) {
        const blob = new Blob(voiceChunks, { type: mimeType });
        if (voiceAudioUrl) URL.revokeObjectURL(voiceAudioUrl);
        voiceAudioUrl = URL.createObjectURL(blob);
      }
      finishVoiceSession(voiceSession);
      stopVoiceTracks();
      voiceStatus='ready';
      voiceRecorder=null;
      renderView();
    };
    voiceRecorder.start(250);
    voiceRecordingTimer=setTimeout(()=>{if(voiceRecorder&&voiceRecorder.state!=='inactive')voiceRecorder.stop();},30000);
    voiceStatus='recording';
    renderView();
  } catch (error) {
    stopVoiceTracks();
    voiceStatus='error';
    toast(error?.name==='NotAllowedError'?'Microphone permission was denied. Use the text fallback.':'Microphone could not be opened. Check browser permissions and device availability.','error');
    renderView();
  }
}

function stopVoiceTracks() {
  voiceMediaStream?.getTracks?.().forEach(track=>track.stop());
  voiceMediaStream=null;
}

function stopVoiceRecording() {
  if (voiceRecorder && voiceRecorder.state!=='inactive') voiceRecorder.stop();
  else { stopVoiceTracks(); voiceStatus=voiceAudioUrl?'ready':'inactive'; renderView(); }
}

function startVoiceTranscription() {
  if (!voiceConsent) { toast('Give explicit microphone consent before transcription.','warning'); return; }
  if (!speechRecognitionAvailable()) { toast('Live speech recognition is unavailable. Use the text fallback.','warning'); return; }
  if (voiceStatus==='recording'||voiceStatus==='transcribing') return;
  try {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    speechRecognition = new Recognition();
    const recognitionInstance = speechRecognition;
    const session = createVoiceSession({ interactionRef: state.currentCall?.queueContactId || 'PRACTICE', consent: true });
    voiceSession = session;
    speechRecognition.lang = 'en-NG';
    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;
    speechRecognition.onresult = event => {
      if(voiceSession!==session||speechRecognition!==recognitionInstance)return;
      let finalText='';
      for(let i=event.resultIndex;i<event.results.length;i++) if(event.results[i].isFinal) finalText += `${event.results[i][0]?.transcript||''} `;
      if(finalText.trim()) {
        appendVoiceTranscript(session, finalText.trim());
        voiceTranscript=session.transcript;
        renderView();
      }
    };
    speechRecognition.onerror = event => {
      if(voiceSession!==session)return;
      voiceStatus='error';
      try { recognitionInstance.stop(); } catch {}
      if(speechRecognition===recognitionInstance) speechRecognition=null;
      finishVoiceSession(session);
      toast(`Speech recognition: ${event.error||'unavailable'}. Use the text fallback.`, 'warning');
      renderView();
    };
    speechRecognition.onend = () => {
      if(voiceSession!==session)return;
      if(voiceStatus==='transcribing') voiceStatus='ready';
      finishVoiceSession(session);
      renderView();
    };
    voiceStatus='transcribing';
    speechRecognition.start();
    renderView();
  } catch (error) {
    try { speechRecognition?.stop?.(); } catch {}
    speechRecognition=null;
    if(voiceSession)finishVoiceSession(voiceSession);
    voiceStatus='error';
    toast('Speech recognition could not start. Use the text fallback.','warning');
    renderView();
  }
}

function stopVoiceTranscription() {
  if (speechRecognition) {
    voiceStatus='ready';
    try { speechRecognition.stop(); } catch {}
    speechRecognition=null;
  }
  if (voiceSession) finishVoiceSession(voiceSession);
  renderView();
}

function speakCustomerPrompt(textValue) {
  if (!('speechSynthesis' in window) || !textValue) { toast('Customer audio playback is unavailable in this browser.','warning'); return; }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(String(textValue).slice(0,1000));
  utterance.lang='en-NG'; utterance.rate=.94; utterance.pitch=1;
  window.speechSynthesis.speak(utterance);
}

function clearVoicePractice() {
  window.speechSynthesis?.cancel?.();
  clearTimeout(voiceRecordingTimer);voiceRecordingTimer=null;
  if (speechRecognition) { try { speechRecognition.stop(); } catch {} speechRecognition=null; }
  if (voiceRecorder && voiceRecorder.state!=='inactive') { voiceRecorder.onstop=null;try { voiceRecorder.stop(); } catch {} }
  voiceRecorder=null;stopVoiceTracks();
  if (voiceAudioUrl) URL.revokeObjectURL(voiceAudioUrl);
  voiceAudioUrl=null;voiceChunks=[];voiceSession=null;voiceTranscript='';voiceConsent=false;voiceStatus='inactive';
  renderView();
}

function stopVoiceTools() {
  window.speechSynthesis?.cancel?.();
  clearTimeout(voiceRecordingTimer);voiceRecordingTimer=null;
  if (speechRecognition) { try { speechRecognition.stop(); } catch {} speechRecognition=null; }
  if (voiceRecorder && voiceRecorder.state!=='inactive') { voiceRecorder.onstop=null;try { voiceRecorder.stop(); } catch {} }
  voiceRecorder=null;stopVoiceTracks();
  if (voiceAudioUrl) URL.revokeObjectURL(voiceAudioUrl);
  voiceAudioUrl=null;voiceChunks=[];voiceSession=null;voiceTranscript='';voiceConsent=false;voiceStatus='inactive';
}

function renderInbound() {
  if (state.wrapUp?.type==='inbound') return renderWrapUp();
  if (!state.shiftActive) {
    viewRoot.innerHTML = renderShiftEntryPanel('Your shift has not started','Start your workday before accepting inbound contacts. Queue routing and service-level records begin with the shift.'); return;
  }
  if (!state.currentCall) {
    ensureInboundQueue(6);
    const queue=sortQueuedContacts(state.inboundQueueItems);
    const metrics=queueMetrics(state.inboundQueueItems);
    const callbackRows=state.callbacks.filter(item=>item.status==='scheduled'&&item.type!=='outbound').slice().sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt));
    viewRoot.innerHTML = `<div class="ops-summary-grid">${metricCard('WAITING CONTACTS',metrics.waiting,'Prioritised inbound queue','↙')}${metricCard('LONGEST WAIT',formatWait(metrics.longestWaitSeconds),'Current oldest queued contact','◷')}${metricCard('WITHIN 60-SECOND TARGET',metrics.waiting?Math.round(metrics.withinServiceLevel/metrics.waiting*100)+'%':'—','Queue snapshot, not a contractual SLA','⌁')}</div><div class="grid two" style="margin-top:14px"><section class="panel"><div class="panel-head"><div><h3>Prioritised inbound queue</h3><p>Urgent security and fraud contacts are prioritised ahead of routine enquiries.</p></div><span class="pill ${shiftTimeAvailable()?'green':'amber'}"><span class="live-dot"></span> ${shiftTimeAvailable()?'ROUTING OPEN':'SHIFT WINDOW CLOSED'}</span></div>${queue.length?`<div class="queue-contact-list">${queue.slice(0,8).map(item=>`<div class="queue-contact-row"><span class="priority-mark ${item.priority}"></span><div class="queue-contact-main"><strong>${escapeHTML(item.customer)}</strong><small>${escapeHTML(item.issue)} · ${escapeHTML(item.routeGroup)}</small></div><span class="queue-wait">${formatWait(item.waitSeconds)}</span><span class="pill ${item.priority==='critical'?'red':item.priority==='high'?'amber':''}">${item.priority.toUpperCase()}</span></div>`).join('')}</div><button class="btn primary" style="margin-top:14px" data-action="answer-call" ${state.agentStatus==='available'&&shiftTimeAvailable()?'':'disabled'}>Accept highest-priority contact ↙</button>`:`<div class="empty-state"><h3>No waiting contacts</h3><p>Generate another batch of simulated arrivals to continue this shift.</p><button class="btn primary" data-action="refresh-queue">Load next arrivals</button></div>`}</section><section class="panel"><div class="panel-head"><div><h3>Callbacks due</h3><p>Customer-requested return contacts scheduled during earlier interactions.</p></div><span class="pill">${callbackRows.length} SCHEDULED</span></div>${callbackRows.length?callbackRows.map(item=>`<div class="case-item"><div class="case-symbol">◷</div><div class="case-copy"><strong>${escapeHTML(item.customer)}</strong><small>${escapeHTML(item.issue)} · Due ${new Date(item.dueAt).toLocaleString()}</small></div><button class="btn small secondary" data-action="return-callback-to-queue" data-callback-id="${escapeHTML(item.id)}" ${Date.parse(item.dueAt)<=Date.now()?'':'disabled'}>${Date.parse(item.dueAt)<=Date.now()?'Queue callback':'Not due yet'}</button></div>`).join(''):'<div class="empty-state"><p>No callbacks are scheduled.</p></div>'}<div class="panel-head" style="margin-top:18px"><div><h3>Recently handled</h3><p>Your latest customer interactions.</p></div><button class="btn small outline" data-action="open-crm">View cases</button></div>${state.cases.length?state.cases.slice(-3).reverse().map(caseRow).join(''):'<p class="muted-note">No completed interactions yet.</p>'}</section></div>`; return;
  }
  const call=state.currentCall;
  const scenario=inboundScenarios.find(item=>item.id===call.scenarioId);
  if(!scenario){toast('Active contact scenario unavailable.','error');return;}
  const step=scenario.steps[call.stepIndex];
  const contact=findQueueContact(call.queueContactId);
  const supervisorOpen=state.supervisorRequests.some(item=>item.contactId===call.queueContactId&&item.status==='open');
  viewRoot.innerHTML = `<div class="call-layout"><section class="panel call-console"><div class="call-console-head"><div><strong>INBOUND VOICE CONTACT</strong><small>Connected · ${escapeHTML(scenario.category)} · Ref ${escapeHTML(scenario.reference)}</small></div><span class="pill ${call.held?'amber':'green'}">${call.held?'ON HOLD':'CONNECTED'}</span></div><div class="call-console-body"><div class="customer-strip"><div class="customer-avatar">${scenario.initials}</div><div class="customer-info"><strong>${escapeHTML(scenario.customer)}</strong><small>${escapeHTML(scenario.profile)}</small></div><div class="customer-tags"><span class="pill">${scenario.tag}</span><span class="pill amber">${scenario.amount}</span></div></div>${call.held?`<div class="call-feedback neutral"><strong>Customer is on hold.</strong> Resume the conversation before selecting another call action.</div>`:`<div class="subtle-label">CUSTOMER STATEMENT</div><p class="call-prompt">“${scenario.opening}”</p><p class="call-context">${call.stepIndex===0?'The customer has just connected. Begin with the correct service procedure.':'Continue the interaction based on the case information and previous action.'}</p><div class="panel-head" style="margin:16px 0 11px"><div><div class="question-kicker">STEP ${call.stepIndex+1} OF ${scenario.steps.length} · ${step.label}</div><h3 class="call-prompt" style="margin-top:8px">${step.prompt}</h3><p class="call-context" style="margin:5px 0 0">${step.context}</p></div></div><div class="call-options">${step.options.map((opt,j)=>`<button class="call-option" data-call-choice="${j}" ${call.feedback?'disabled':''}><span>${String.fromCharCode(65+j)}</span><span>${opt.text}</span></button>`).join('')}</div>${call.feedback?`<div class="call-feedback ${call.feedbackType}">${escapeHTML(call.feedback)}</div><div class="assessment-footer"><small>${call.feedbackType==='bad'?'A quality or compliance deduction may apply.':'Decision recorded. Continue the interaction.'}</small><button class="btn primary" data-action="${call.stepIndex===scenario.steps.length-1?'complete-call':'next-call-step'}">${call.stepIndex===scenario.steps.length-1?'Move to after-contact work':'Continue →'}</button></div>`:''}${renderVoicePractice(call,scenario.opening)}</div>`}</div></section><aside class="call-side-stack"><section class="panel"><div class="panel-head"><div><h3>Customer record</h3><p>Simulated CRM profile.</p></div><span class="pill">CRM</span></div><div class="data-list"><div class="data-row"><span>Customer</span><strong>${scenario.customer}</strong></div><div class="data-row"><span>Case reference</span><strong>${scenario.reference}</strong></div><div class="data-row"><span>Reported issue</span><strong>${scenario.issue}</strong></div><div class="data-row"><span>Location</span><strong>${scenario.location}</strong></div><div class="data-row"><span>Queue route</span><strong>${contact?escapeHTML(contact.routeGroup):'General'}</strong></div><div class="data-row"><span>Queue wait</span><strong>${formatWait(call.waitSeconds||0)}</strong></div></div></section><section class="panel"><div class="panel-head"><div><h3>Interaction controls</h3><p>Contact lifecycle management.</p></div></div><div class="ops-control-stack"><button class="btn outline" data-action="toggle-call-hold">${call.held?'Resume customer':'Place on hold'}</button><button class="btn outline" data-action="request-supervisor" ${supervisorOpen?'disabled':''}>${supervisorOpen?'Supervisor requested':'Request supervisor assistance'}</button><label class="subtle-label" for="transferTarget">TRANSFER DESTINATION</label><select id="transferTarget"><option>Specialist Support</option><option>Fraud & Security</option><option>Cards & Payments</option><option>Technical Support</option><option>Complaints Management</option></select><button class="btn secondary" data-action="transfer-call" ${call.held?'disabled':''}>Transfer to specialist</button><button class="btn outline" data-action="return-call-to-queue">Return contact to queue</button></div><p class="muted-note" style="margin-top:12px">Hold, transfer, assistance and queue return are recorded in the simulated interaction timeline.</p></section></aside></div>`;
}

function ensureDigitalQueue(count = 6) {
  if (!Array.isArray(state.digitalQueue)) state.digitalQueue = [];
  const waiting = state.digitalQueue.filter(item => item.status === DIGITAL_STATUS.QUEUED).length;
  if (state.digitalQueue.length === 0 || (waiting === 0 && count > 0)) {
    const items = createDigitalQueue(DIGITAL_SCENARIOS, count, { sequence: state.digitalSequence, slaMinutesOverride: getActiveOrganization(state.organizationWorkspace)?.policy?.digitalResponseTargetMinutes });
    state.digitalQueue.push(...items);
    state.digitalSequence += items.length;
  }
  return state.digitalQueue;
}

function digitalReplyTemplates(channel) {
  const templates = {
    email: [
      ['acknowledge', 'Thank you for contacting us. I understand your concern and will review the available details before confirming the next step.'],
      ['investigation', 'I appreciate your patience. We will review the relevant record and provide an update with the case reference and confirmed next step.'],
      ['privacy', 'For your protection, do not include passwords, PINs, one-time codes or full card details in email. We will use the approved secure process for any permitted verification.']
    ],
    live_chat: [
      ['acknowledge', 'I understand the difficulty this has caused. I will check the available information and guide you through the approved next step.'],
      ['secure-help', 'For your security, I will not ask for your password, PIN or one-time code. Please describe the error message without sharing sensitive details.'],
      ['follow-up', 'Thank you for confirming. I will review this and provide the next update or specialist route available to us.']
    ],
    social: [
      ['public-acknowledgement', 'We are sorry to hear about this and understand your concern. Please contact us through our verified private support channel so we can review the case and explain the next step. Do not post personal or account details publicly.'],
      ['service-feedback', 'Thank you for raising this. We appreciate the feedback and will refer it to the appropriate service team for review. Please use our verified private channel for any account-specific assistance.']
    ]
  };
  return templates[channel] || templates.email;
}

function renderDigital() {
  if (!state.shiftActive) {
    viewRoot.innerHTML = renderShiftEntryPanel('Digital support is not active', 'Start your shift before receiving email, live-chat and social-media assignments. Digital queues are simulated and do not connect to real accounts.');
    return;
  }
  ensureDigitalQueue(6);
  const metrics = digitalQueueMetrics(state.digitalQueue);
  const active = state.digitalActiveId ? findDigitalContact(state.digitalQueue, state.digitalActiveId) : null;
  if (active && [DIGITAL_STATUS.ACTIVE, DIGITAL_STATUS.AWAITING_CUSTOMER].includes(active.status)) {
    const channel = DIGITAL_CHANNELS[active.channel];
    const messageRows = active.messages.map(message => `<div class="digital-message ${message.type === 'agent' ? 'agent' : 'customer'}"><div class="digital-message-meta"><strong>${message.type === 'agent' ? 'YOU · AGENT' : escapeHTML(active.customer)}</strong><time>${new Date(message.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div><p>${escapeHTML(message.text)}</p>${message.quality ? `<small>Rule-based practice check: ${message.quality.score}%</small>` : ''}</div>`).join('');
    const waitingForCustomer = active.status === DIGITAL_STATUS.AWAITING_CUSTOMER;
    viewRoot.innerHTML = `<div class="digital-workspace">
      <section class="panel digital-thread-panel">
        <div class="digital-topbar"><div><span class="channel-label ${active.channel}">${channel.icon} ${channel.label.toUpperCase()}</span><h3>${escapeHTML(active.subject)}</h3><p>${escapeHTML(active.customer)} · ${escapeHTML(active.routeGroup)} · ${escapeHTML(active.id)}</p></div><span class="pill ${active.priority === 'critical' ? 'red' : active.priority === 'high' ? 'amber' : 'green'}">${active.priority.toUpperCase()}</span></div>
        <div class="digital-thread">${messageRows}</div>
        ${waitingForCustomer && !active.followUpDelivered && active.followUp ? `<div class="digital-followup"><p>Customer response is pending in the simulation.</p><button class="btn outline" data-action="deliver-digital-followup">Receive simulated customer reply</button></div>` : ''}
        ${active.status === DIGITAL_STATUS.ACTIVE ? `<div class="digital-template-row"><span>REPLY STARTERS</span>${digitalReplyTemplates(active.channel).map(([id,text])=>`<button type="button" class="digital-template-button" data-digital-template="${id}">${id.replaceAll('-',' ')}</button>`).join('')}</div><form id="digitalReplyForm" class="digital-composer"><label class="form-field">AGENT RESPONSE<textarea name="reply" rows="4" minlength="12" maxlength="1200" required placeholder="Write a clear, professional response. Do not request passwords, PINs, one-time codes or full payment-card numbers."></textarea></label><div class="digital-composer-foot"><small>Maximum 1,200 characters. Replies are stored in this browser's local simulation save.</small><button class="btn primary" type="submit">Record and send simulated reply</button></div></form>` : `<div class="digital-awaiting-note">Awaiting the scripted customer follow-up. You may complete the interaction based on the information already available.</div>`}
        <form id="digitalCloseForm" class="digital-close-form"><div class="digital-close-heading"><div><strong>AFTER-CONTACT WORK</strong><small>Record a clear disposition and factual CRM note.</small></div><span class="pill amber">WRAP-UP</span></div><div class="grid two"><label class="form-field">DISPOSITION<select name="disposition"><option value="resolved">Resolved</option><option value="pending_customer">Pending customer response</option><option value="escalated">Escalated to specialist team</option></select></label><label class="form-field">CASE NOTES<textarea name="notes" rows="3" minlength="12" maxlength="1200" required placeholder="Issue, checks, action, owner and agreed next step."></textarea></label></div><button class="btn secondary" type="submit">Save disposition & return to queue</button></form>
      </section>
      <aside class="digital-side-stack">
        <section class="panel"><div class="panel-head"><div><h3>Channel handling guide</h3><p>${channel.description}</p></div><span class="pill">${channel.slaMinutes < 10 ? `${channel.slaMinutes} MIN` : `${channel.slaMinutes} MIN`} TARGET</span></div><div class="digital-guidance-list">${active.guidance.map((item,index)=>`<div><span>${index + 1}</span><p>${escapeHTML(item)}</p></div>`).join('')}</div></section>
        <section class="panel"><div class="panel-head"><div><h3>Customer and routing</h3><p>Synthetic customer record only.</p></div><span class="pill green">SIMULATED CRM</span></div><div class="data-list"><div class="data-row"><span>Customer</span><strong>${escapeHTML(active.customer)}</strong></div><div class="data-row"><span>Channel</span><strong>${channel.label}</strong></div><div class="data-row"><span>Priority</span><strong>${active.priority.toUpperCase()}</strong></div><div class="data-row"><span>Specialist route</span><strong>${escapeHTML(active.routeGroup)}</strong></div><div class="data-row"><span>Agent replies</span><strong>${active.replyCount}</strong></div><div class="data-row"><span>Current practice QA</span><strong>${active.qaScore === null ? 'Pending' : `${active.qaScore}%`}</strong></div></div><p class="muted-note" style="margin-top:12px">Never collect credentials or sensitive payment information through email, chat or social messages. Use organisation-approved secure verification channels.</p></section>
      </aside>
    </div>`;
    return;
  }
  state.digitalActiveId = null;
  const queue = sortDigitalQueue(state.digitalQueue, { channel: state.digitalChannelFilter || 'all' });
  const recent = state.digitalQueue.filter(item => [DIGITAL_STATUS.RESOLVED, DIGITAL_STATUS.ESCALATED, DIGITAL_STATUS.PENDING_CUSTOMER].includes(item.status)).slice(-5).reverse();
  const channels = Object.entries(DIGITAL_CHANNELS).map(([key,item]) => `<div class="digital-channel-card"><span class="channel-label ${key}">${item.icon} ${item.label.toUpperCase()}</span><strong>${metrics.channelCounts[key].waiting}</strong><small>waiting · ${metrics.channelCounts[key].resolved} resolved</small></div>`).join('');
  viewRoot.innerHTML = `<div class="ops-summary-grid">${metricCard('DIGITAL CONTACTS WAITING',metrics.waiting,'Email, live chat and social','✉')}${metricCard('ACTIVE INTERACTIONS',metrics.active,'Currently in progress','◉')}${metricCard('SLA RESPONSE RISK',metrics.slaAtRisk,'Waiting beyond channel target','⌁')}${metricCard('AVERAGE DIGITAL QA',metrics.averageQA === null ? '—' : `${metrics.averageQA}%`,'Rule-based practice check','✓')}</div>
    <div class="digital-channel-grid">${channels}</div>
    <div class="grid two" style="margin-top:14px"><section class="panel"><div class="panel-head"><div><h3>Digital contact queue</h3><p>Priority-first routing across the three supported digital channels.</p></div><span class="pill ${state.agentStatus === 'available' && shiftTimeAvailable() ? 'green' : 'amber'}">${state.agentStatus === 'available' && shiftTimeAvailable() ? 'READY TO ACCEPT' : 'AGENT NOT AVAILABLE'}</span></div>
      <label class="form-field digital-filter">FILTER CHANNEL<select id="digitalChannelFilter"><option value="all" ${state.digitalChannelFilter==='all'?'selected':''}>All channels</option><option value="email" ${state.digitalChannelFilter==='email'?'selected':''}>Email</option><option value="live_chat" ${state.digitalChannelFilter==='live_chat'?'selected':''}>Live chat</option><option value="social" ${state.digitalChannelFilter==='social'?'selected':''}>Social media</option></select></label>
      ${queue.length ? `<div class="digital-queue-list">${queue.map(item => `<article class="digital-queue-row"><span class="digital-queue-priority ${item.priority}"></span><div class="digital-queue-main"><span class="channel-label ${item.channel}">${DIGITAL_CHANNELS[item.channel].icon} ${DIGITAL_CHANNELS[item.channel].label.toUpperCase()}</span><strong>${escapeHTML(item.subject)}</strong><small>${escapeHTML(item.customer)} · ${escapeHTML(item.preview)}</small><em>${escapeHTML(item.routeGroup)}</em></div><div class="digital-queue-meta"><span class="pill ${item.priority==='critical'?'red':item.priority==='high'?'amber':''}">${item.priority.toUpperCase()}</span><small>${Math.floor(item.waitSeconds/60)}m ${item.waitSeconds%60}s waiting</small><button class="btn small primary" data-action="accept-digital" data-contact-id="${escapeHTML(item.id)}" ${state.agentStatus==='available' && shiftTimeAvailable() && !state.currentCall && !state.activeOutbound && !state.wrapUp ? '' : 'disabled'}>Accept</button></div></article>`).join('')}</div>` : `<div class="empty-state"><h3>No contacts in this channel filter</h3><p>Load another controlled batch of synthetic digital enquiries.</p></div>`}
      <button class="btn outline" style="margin-top:14px" data-action="refresh-digital-queue" ${state.agentStatus==='available' && shiftTimeAvailable() ? '' : 'disabled'}>Load next simulated batch</button>
    </section><section class="panel"><div class="panel-head"><div><h3>Digital service performance</h3><p>Separate channel workloads and case outcomes.</p></div><span class="pill green">LOCAL SIMULATION</span></div><div class="data-list"><div class="data-row"><span>Email first-response target</span><strong>4 hours · illustrative</strong></div><div class="data-row"><span>Live chat response target</span><strong>2 minutes · illustrative</strong></div><div class="data-row"><span>Social acknowledgement target</span><strong>20 minutes · illustrative</strong></div><div class="data-row"><span>Average first response</span><strong>${metrics.averageFirstResponseMinutes ? `${metrics.averageFirstResponseMinutes} min` : 'Pending'}</strong></div><div class="data-row"><span>Completed digital contacts</span><strong>${metrics.resolved}</strong></div><div class="data-row"><span>Escalated digital contacts</span><strong>${metrics.escalated}</strong></div><div class="data-row"><span>Pending customer response</span><strong>${metrics.awaitingCustomer}</strong></div></div><p class="muted-note" style="margin-top:12px">Targets are example gameplay values, not contractual service levels or regulatory requirements. Actual targets must be configured by the organisation.</p><h4 style="margin:16px 0 8px">Recent digital outcomes</h4>${recent.length ? recent.map(item=>`<div class="case-item"><div class="case-symbol">${DIGITAL_CHANNELS[item.channel].icon}</div><div class="case-copy"><strong>${escapeHTML(item.subject)}</strong><small>${escapeHTML(item.customer)} · ${escapeHTML(item.channelLabel)}</small></div><span class="pill ${item.status===DIGITAL_STATUS.RESOLVED?'green':'amber'}">${item.status.replaceAll('_',' ').toUpperCase()}</span></div>`).join('') : '<p class="muted-note">No digital interactions completed yet.</p>'}</section></div>`;
}

function renderQueue(){
  if(!state.shiftActive){viewRoot.innerHTML=renderShiftEntryPanel('Queue control is not active','Start your shift to open contact routing.');return;}
  ensureInboundQueue(6);
  const queue=sortQueuedContacts(state.inboundQueueItems);
  const metrics=queueMetrics(state.inboundQueueItems);
  const callbacks=state.callbacks.filter(item=>(item.status==='scheduled'||item.status==='queued')&&item.type!=='outbound');
  viewRoot.innerHTML=`<div class="ops-summary-grid">${metricCard('IN QUEUE',metrics.waiting,'Queued voice contacts','↙')}${metricCard('AVERAGE WAIT',formatWait(metrics.averageWaitSeconds),'Across waiting contacts','◷')}${metricCard('ACCEPTED THIS SHIFT',state.acceptedContacts,'Includes completed and active contacts','✓')}</div><section class="panel" style="margin-top:14px"><div class="panel-head"><div><h3>Queue supervisor</h3><p>Priority, routing group and live wait-age snapshot.</p></div><button class="btn small secondary" data-action="refresh-queue">Add six arrivals</button></div>${queue.length?`<div class="table-wrap"><table><thead><tr><th>Priority</th><th>Customer</th><th>Issue</th><th>Route group</th><th>Wait</th><th>Status</th></tr></thead><tbody>${queue.map(item=>`<tr><td><span class="priority-label ${item.priority}">${item.priority.toUpperCase()}</span></td><td>${escapeHTML(item.customer)}</td><td>${escapeHTML(item.issue)}</td><td>${escapeHTML(item.routeGroup)}</td><td>${formatWait(item.waitSeconds)}</td><td><span class="pill green">QUEUED</span></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state"><h3>Queue clear</h3><p>No inbound contacts are waiting.</p></div>'}</section><section class="panel" style="margin-top:14px"><div class="panel-head"><div><h3>Scheduled callbacks</h3><p>Only customer-requested callbacks are listed.</p></div><span class="pill">${callbacks.length}</span></div>${callbacks.length?callbacks.map(item=>`<div class="case-item"><div class="case-symbol">◷</div><div class="case-copy"><strong>${escapeHTML(item.customer)}</strong><small>${escapeHTML(item.issue)} · ${new Date(item.dueAt).toLocaleString()}</small></div><button class="btn small secondary" data-action="return-callback-to-queue" data-callback-id="${escapeHTML(item.id)}" ${item.status==='queued'||Date.parse(item.dueAt)>Date.now()?'disabled':''}>${item.status==='queued'?'In queue':Date.parse(item.dueAt)>Date.now()?'Not due yet':'Queue callback'}</button></div>`).join(''):'<p class="muted-note">No callbacks are scheduled.</p>'}</section>`;
}

function renderSupervisor(){
  const open=state.supervisorRequests.filter(item=>item.status==='open');
  const escalated=state.cases.filter(item=>/Escalated|review|required/i.test(item.status));
  viewRoot.innerHTML=`<div class="ops-summary-grid">${metricCard('OPEN ASSISTANCE REQUESTS',open.length,'Agent requests awaiting supervisor review','!')}${metricCard('ESCALATED CASES',escalated.length,'Cases requiring specialist or QA attention','↗')}${metricCard('TOTAL INTERACTIONS',state.interactionTimeline.length,'Recorded operational events','◷')}</div><section class="panel" style="margin-top:14px"><div class="panel-head"><div><h3>Supervisor assistance desk</h3><p>Review live requests and close the assistance loop.</p></div><span class="pill ${open.length?'amber':'green'}">${open.length} OPEN</span></div>${open.length?open.map(item=>`<div class="case-item"><div class="case-symbol">!</div><div class="case-copy"><strong>${escapeHTML(item.customer)} · ${escapeHTML(item.reason)}</strong><small>${escapeHTML(item.reference)} · ${new Date(item.createdAt).toLocaleString()}</small></div><button class="btn small primary" data-action="resolve-supervisor" data-request-id="${escapeHTML(item.id)}">Mark reviewed</button></div>`).join(''):'<div class="empty-state"><h3>No open requests</h3><p>New assistance requests and escalations will appear here.</p></div>'}</section><section class="panel" style="margin-top:14px"><div class="panel-head"><div><h3>Escalated and review cases</h3><p>Open quality and specialist follow-up records.</p></div></div>${escalated.length?escalated.slice().reverse().map(caseRow).join(''):'<p class="muted-note">No escalated cases recorded.</p>'}</section><section class="panel" style="margin-top:14px"><div class="panel-head"><div><h3>Recent operations timeline</h3><p>Queue and interaction lifecycle events.</p></div></div>${state.interactionTimeline.slice(-12).reverse().map(item=>`<div class="timeline-row"><time>${new Date(item.at).toLocaleTimeString()}</time><div><strong>${escapeHTML(item.message)}</strong><small>${escapeHTML(item.reference)} · ${escapeHTML(item.status)}</small></div></div>`).join('')||'<p class="muted-note">No operations events have been recorded.</p>'}</section>`;
}

function renderOutbound() {
  if(state.wrapUp?.type==='outbound')return renderWrapUp();
  if (!state.shiftActive) { viewRoot.innerHTML = renderShiftEntryPanel('Start your shift first','Outbound campaigns are available during an active simulated shift.'); return; }
  if (state.activeOutbound) {
    const task = outboundCampaigns.find(x=>x.id===state.activeOutbound.campaignId);
    const step = task?.script[state.activeOutbound.stepIndex];
    if(!task||!step){viewRoot.innerHTML='<div class="panel empty-state"><h3>Campaign step unavailable</h3><button class="btn secondary" data-action="open-outbound">Return to campaigns</button></div>';return;}
    viewRoot.innerHTML = `<div class="call-layout"><section class="panel call-console"><div class="call-console-head"><div><strong>OUTBOUND CAMPAIGN CONTACT</strong><small>${escapeHTML(task.type)} · ${escapeHTML(task.title)} · ${escapeHTML(state.activeOutbound.attemptId)}</small></div><span class="pill green">SIMULATED DIAL</span></div><div class="call-console-body"><div class="customer-strip"><div class="customer-avatar">${task.initials}</div><div class="customer-info"><strong>${task.customer}</strong><small>Campaign contact · ${task.type}</small></div><span class="pill">OUTBOUND</span></div><div class="subtle-label">CAMPAIGN OBJECTIVE</div><p class="call-prompt">${task.objective}</p><p class="call-context">${task.context}</p><div class="question-kicker">STEP ${state.activeOutbound.stepIndex+1} OF ${task.script.length} · ${step.label}</div><h3 class="call-prompt" style="margin:9px 0 14px">${step.prompt}</h3><div class="call-options">${step.options.map((opt,j)=>`<button class="call-option" data-outbound-choice="${j}" ${state.activeOutbound.feedback?'disabled':''}><span>${String.fromCharCode(65+j)}</span><span>${opt.text}</span></button>`).join('')}</div>${state.activeOutbound.feedback?`<div class="call-feedback ${state.activeOutbound.feedbackType}">${escapeHTML(state.activeOutbound.feedback)}</div><div class="assessment-footer"><small>Record the actual customer response and outcome.</small><button class="btn primary" data-action="${state.activeOutbound.stepIndex===task.script.length-1?'complete-outbound-step':'next-outbound-step'}">${state.activeOutbound.stepIndex===task.script.length-1?'Move to after-contact work':'Continue →'}</button></div>`:''}</div></section><aside class="call-side-stack"><section class="panel"><div class="panel-head"><div><h3>Campaign record</h3><p>Authorised simulated contact.</p></div></div><div class="data-list"><div class="data-row"><span>Campaign</span><strong>${task.title}</strong></div><div class="data-row"><span>Contact</span><strong>${task.customer}</strong></div><div class="data-row"><span>Purpose</span><strong>${task.type}</strong></div><div class="data-row"><span>Attempt ID</span><strong>${state.activeOutbound.attemptId}</strong></div></div></section><section class="panel"><div class="panel-head"><div><h3>Contact compliance</h3></div><span class="pill amber">REQUIRED</span></div><p class="muted-note">Identify yourself honestly, observe approved contact rules, respect refusal and opt-out preferences, and record the true outcome. No real calls are placed.</p><button class="btn outline" style="width:100%" data-action="end-outbound">End contact and return to campaign desk</button></section></aside></div>`; return;
  }
  const suppressed=state.outboundSuppressions||[];
  const outboundCallbacks=state.callbacks.filter(item=>item.type==='outbound'&&item.status==='scheduled');
  viewRoot.innerHTML = `<div class="panel"><div class="panel-head"><div><h3>Outbound campaign dialler</h3><p>Campaign contacts are simulated. Suppressed contacts are blocked before dialling.</p></div><span class="pill green">${state.outboundDone.length} COMPLETED</span></div><div class="ops-summary-grid">${metricCard('CAMPAIGN ATTEMPTS',state.outboundAttempts.length,'Recorded simulated dial attempts','↗')}${metricCard('SUPPRESSED CONTACTS',suppressed.length,'Do-not-contact preferences recorded','⊘')}${metricCard('CALLBACKS',state.callbacks.filter(item=>item.status==='scheduled').length,'Scheduled return contacts','◷')}</div><div class="grid three" style="margin-top:14px">${outboundCampaigns.map(c=>{const blocked=isContactSuppressed(c.customer,suppressed);return `<div class="panel campaign-card"><div class="subtle-label">${escapeHTML(c.type)}</div><h3>${escapeHTML(c.title)}</h3><p class="muted-note">${escapeHTML(c.context)}</p><div class="data-row"><span>Contact</span><strong>${escapeHTML(c.customer)}</strong></div><div class="campaign-status ${blocked?'blocked':''}">${blocked?'CONTACT SUPPRESSED':state.outboundDone.includes(c.id)?'ATTEMPT COMPLETED':'READY TO DIAL'}</div><button class="btn ${blocked?'outline':'primary'}" style="width:100%;margin-top:12px" data-start-campaign="${c.id}" ${blocked||state.outboundDone.includes(c.id)||state.agentStatus!=='available'||!shiftTimeAvailable()?'disabled':''}>${blocked?'Suppressed':state.outboundDone.includes(c.id)?'Completed':'Start simulated dial →'}</button></div>`;}).join('')}</div><p class="muted-note" style="margin-top:14px">Campaign lists are fictional. Real-world outbound contact requires verified consent, lawful contact basis and organisation-approved suppression controls.</p>${suppressed.length?`<div class="article-box"><h4>Suppression register</h4>${suppressed.map(item=>`<div class="data-row"><span>${escapeHTML(item.contactKey)}</span><strong>${escapeHTML(item.reason)}</strong></div>`).join('')}</div>`:''}<div class="article-box"><h4>Scheduled outbound callbacks</h4>${outboundCallbacks.length?outboundCallbacks.map(item=>{const due=Date.parse(item.dueAt)<=Date.now();return `<div class="case-item"><div class="case-symbol">◷</div><div class="case-copy"><strong>${escapeHTML(item.customer)}</strong><small>${escapeHTML(item.issue)} · ${new Date(item.dueAt).toLocaleString()}</small></div><button class="btn small secondary" data-action="resume-outbound-callback" data-callback-id="${escapeHTML(item.id)}" ${due?'':'disabled'}>${due?'Call back':'Scheduled'}</button></div>`;}).join(''):'<p class="muted-note">No outbound callbacks scheduled.</p>'}</div></div>`;
}
function caseRow(c) { return `<div class="case-item"><div class="case-symbol">${c.channel==='Outbound'?'↗':['Email','Live chat','Social media'].includes(c.channel)?'✉':'↙'}</div><div class="case-copy"><strong>${escapeHTML(c.title)}</strong><small>${escapeHTML(c.customer)} · ${escapeHTML(c.reference)}</small></div><span class="pill ${c.status==='Resolved'?'green':'amber'}">${escapeHTML(c.status)}</span></div>`; }
function renderCRM() {
  const recent=state.interactionTimeline.slice(-18).reverse();
  viewRoot.innerHTML = `<div class="panel"><div class="panel-head"><div><h3>CRM & case management</h3><p>Completed customer interactions, wrap-up notes and operational event history.</p></div><span class="pill">${state.cases.length} TOTAL RECORDS</span></div>${state.cases.length?`<div class="table-wrap"><table><thead><tr><th>Case reference</th><th>Customer</th><th>Channel</th><th>Issue / campaign</th><th>Disposition</th><th>Outcome</th><th>Quality</th></tr></thead><tbody>${state.cases.slice().reverse().map(c=>`<tr><td><strong>${escapeHTML(c.reference)}</strong></td><td>${escapeHTML(c.customer)}</td><td>${escapeHTML(c.channel)}</td><td>${escapeHTML(c.title)}</td><td>${escapeHTML(String(c.disposition||'—').replaceAll('_',' '))}</td><td><span class="status-dot"></span>${escapeHTML(c.status)}</td><td>${c.qa}%</td></tr>`).join('')}</tbody></table></div><div class="case-detail-list">${state.cases.slice(-8).reverse().map(c=>`<details class="case-detail"><summary><strong>${escapeHTML(c.reference)}</strong><span>${escapeHTML(c.customer)} · ${escapeHTML(c.status)}</span></summary><div class="case-detail-body"><p><strong>Issue:</strong> ${escapeHTML(c.title)}</p><p><strong>Disposition:</strong> ${escapeHTML(String(c.disposition||'—').replaceAll('_',' '))}</p><p><strong>Owner:</strong> ${escapeHTML(c.owner||'Agent')}</p><p><strong>Notes:</strong> ${escapeHTML(c.notes||'No wrap-up notes retained.')}</p>${Array.isArray(c.messages)&&c.messages.length?`<div class="crm-digital-transcript"><strong>Interaction transcript</strong>${c.messages.map(message=>`<p><b>${message.type==='agent'?'Agent':'Customer'}:</b> ${escapeHTML(message.text)}</p>`).join('')}</div>`:''}<p><strong>Recorded:</strong> ${new Date(c.createdAt).toLocaleString()}</p></div></details>`).join('')}</div>`:'<div class="empty-state"><div class="empty-icon">▤</div><h3>No cases recorded yet</h3><p>Complete an inbound, outbound or digital interaction and its after-contact work to create a case record.</p><button class="btn secondary" data-action="open-inbound">Go to inbound desk</button></div>'}</div><section class="panel" style="margin-top:14px"><div class="panel-head"><div><h3>Interaction timeline</h3><p>Queue, call, transfer, supervisor and case events.</p></div><span class="pill">${state.interactionTimeline.length} EVENTS</span></div>${recent.length?recent.map(item=>`<div class="timeline-row"><time>${new Date(item.at).toLocaleString()}</time><div><strong>${escapeHTML(item.message)}</strong><small>${escapeHTML(item.reference)} · ${escapeHTML(item.status)}</small></div></div>`).join(''):'<p class="muted-note">No interaction events have been recorded yet.</p>'}</section>`;
}
function renderKnowledge() {
  if (state.viewedArticle) {
    const a = knowledgeArticles.find(x=>x.id===state.viewedArticle);
    if (a) { viewRoot.innerHTML = `<div class="panel"><button class="btn small outline" data-action="back-knowledge">← All articles</button><div class="subtle-label" style="margin-top:18px">${a.category}</div><h3 style="font:800 19px Manrope;margin:7px 0">${a.title}</h3><p class="muted-note">${a.summary}</p><div class="article-box">${a.body}</div><p class="muted-note" style="margin-top:14px">Prototype reference material only. Organisation-specific policies, systems and mandatory requirements must be supplied and approved by the relevant organisation.</p></div>`; return; }
  }
  viewRoot.innerHTML = `<div class="panel"><div class="panel-head"><div><h3>Agent knowledge base</h3><p>Quick-reference material for day-to-day contact-centre operations.</p></div><span class="pill green">REFERENCE DESK</span></div><div class="kb-grid">${knowledgeArticles.map(a=>`<div class="kb-card" data-article="${a.id}"><div class="kb-icon">${a.icon}</div><div class="subtle-label">${a.category}</div><strong style="margin-top:6px">${a.title}</strong><small>${a.summary}</small></div>`).join('')}</div></div>`;
}
function renderPerformance() {
  const qa=average(state.totalQA,state.qaCount,0),csat=average(state.totalCSAT,state.csatCount,0),aht=average(state.totalHandleMinutes,state.callsHandled,0);
  const fcr=state.callsHandled?Math.round(state.resolutions/state.callsHandled*100):0;
  const conversion=state.outboundCalls?Math.round(state.sales/state.outboundCalls*100):0;
  const avgWait=state.acceptedContacts?Math.round(state.totalWaitSeconds/state.acceptedContacts):0;
  const acw=state.acwCount?Math.round(state.totalACWSeconds/state.acwCount):0;
  const sla=state.acceptedContacts?Math.round(state.contactsWithinSla/state.acceptedContacts*100):0;
  const digital=digitalQueueMetrics(state.digitalQueue || []);
  viewRoot.innerHTML=`<div class="grid three">${metricCard('AVERAGE QA',qa?Math.round(qa)+'%':'—','Simulated call-quality score','⌁')}${metricCard('FIRST CONTACT RESOLUTION',state.callsHandled?fcr+'%':'—','Completed inbound contacts','✓')}${metricCard('CUSTOMER SATISFACTION',csat?csat.toFixed(1)+'/5':'—','Post-contact simulation rating','☆')}${metricCard('AVERAGE HANDLE TIME',aht?aht.toFixed(1)+' min':'—','Simulated inbound handling time','◷')}${metricCard('AVERAGE WAIT',state.acceptedContacts?formatWait(avgWait):'—','Before the agent accepted a contact','⌛')}${metricCard('AFTER-CONTACT WORK',state.acwCount?formatWait(acw):'—','Average wrap-up time','▤')}${metricCard('SERVICE LEVEL ≤ 60 SEC',state.acceptedContacts?sla+'%':'—','Accepted contacts within simulation target','⌁')}${metricCard('OUTBOUND CONVERSION',state.outboundCalls?conversion+'%':'—','Campaign interactions completed','↗')}${metricCard('SECURITY INCIDENTS',state.incidents,'Critical simulation errors','◇')}${metricCard('DIGITAL CONTACTS',digital.resolved,'Email, live chat and social resolved','✉')}${metricCard('DIGITAL QA',digital.averageQA===null?'—':`${digital.averageQA}%`,'Rule-based channel practice score','✓')}${metricCard('DIGITAL SLA RISK',digital.slaAtRisk,'Open digital contacts beyond target','⌁')}</div><div class="grid two" style="margin-top:14px"><section class="panel"><div class="panel-head"><div><h3>Performance dimensions</h3><p>Prototype metrics. Real organisations can configure targets and weighting.</p></div></div>${[['Quality assurance',qa],['First-contact resolution',fcr],['Customer satisfaction',csat?csat*20:0],['Service level',sla],['Outbound conversion',conversion]].map(([label,value])=>`<div style="margin:15px 0"><div class="data-row"><span>${label}</span><strong>${value?Math.round(value)+'%':'Pending'}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,Math.max(0,value))}%"></div></div></div>`).join('')}</section><section class="panel"><div class="panel-head"><div><h3>Operational quality rules</h3><p>How the simulator treats queue and case activity.</p></div></div><div class="article-box"><h4>Queue service level</h4><p>Current prototype target: accept inbound contacts within 60 seconds of queue entry. This is a gameplay benchmark, not a contractual service-level promise.</p></div><div class="article-box"><h4>After-contact work</h4><p>Every completed or escalated interaction requires factual notes and an explicit disposition before the agent can continue.</p></div><div class="article-box"><h4>Role-specific targets</h4><p>Sales, banking support, technical support and complaints roles require different scorecards. Production targets must be configured from organisation-approved standards.</p></div></section></div>`;
}
function renderCareer() {
  const progress=Math.min(100,state.experience%100);
  viewRoot.innerHTML = `<div class="career-banner"><div class="career-avatar">${state.nameInitials}</div><div class="career-copy"><div class="subtle-label" style="color:#9be8dc">EMPLOYEE PROFILE · MERIDIAN SERVICE GROUP</div><h3>${escapeHTML(state.applicantName)}</h3><p>${escapeHTML(state.roleTitle)} · ${escapeHTML(state.department)}</p></div><div class="career-level"><strong>LVL ${state.level}</strong><small>CAREER GRADE</small></div></div><div class="grid two" style="margin-top:14px"><section class="panel"><div class="panel-head"><div><h3>Career progression</h3><p>Progress is earned through experience and reliable performance.</p></div><span class="pill green">LEVEL ${state.level}</span></div><div class="data-row"><span>Experience points</span><strong>${state.experience} XP</strong></div><div class="bar-track" style="margin:9px 0 14px"><div class="bar-fill" style="width:${progress}%"></div></div><p class="muted-note">${100-progress} XP to the next career level. Complete interactions accurately and maintain professional standards.</p><div class="step-list" style="margin-top:14px">${[['Contact Centre Agent','Entry appointment'],['Senior Contact Centre Agent','Consistent service performance'],['Subject Matter Expert','Advanced product and system capability'],['Team Leader','Coaching and queue management'],['Supervisor','Operational oversight'],['Operations Manager','Department-level responsibility']].map((r,i)=>`<div class="step-row ${i<state.level?'done':i===state.level?'active':''}"><div class="step-number">${i<state.level?'✓':i+1}</div><div class="step-copy"><strong>${r[0]}</strong><small>${r[1]}</small></div><span class="step-state">${i<state.level?'UNLOCKED':i===state.level?'NEXT':'FUTURE'}</span></div>`).join('')}</div></section><section class="panel"><div class="panel-head"><div><h3>Employment summary</h3><p>Simulated employee information.</p></div></div><div class="data-list"><div class="data-row"><span>Employment status</span><strong>Active</strong></div><div class="data-row"><span>Department</span><strong>${escapeHTML(state.department)}</strong></div><div class="data-row"><span>Monthly base salary</span><strong>${money(state.salary)}</strong></div><div class="data-row"><span>Performance bonus</span><strong>${money(state.bonus)}</strong></div><div class="data-row"><span>Days simulated</span><strong>${state.day}</strong></div><div class="data-row"><span>Inbound calls</span><strong>${state.callsHandled}</strong></div><div class="data-row"><span>Outbound contacts</span><strong>${state.outboundCalls}</strong></div></div><p class="muted-note" style="margin-top:14px">Salary and bonuses are fictional gameplay values. They are not a real employment offer or market salary benchmark.</p><button class="btn outline small" data-action="reset-simulation">Reset local simulation data</button></section></div>`;
}


function simulationSecondsNow(){const stored=Number(state.simulationClockSeconds);return Number.isFinite(stored)?Math.max(0,Math.min(86399,stored)):7*3600;}
function simulationMinuteNow(){return Math.floor(simulationSecondsNow()/60);}
function shiftTimeAvailable(){return state.shiftActive&&Number(state.shiftElapsedMinutes)<540;}
function simulationDateNow(){const date=new Date();date.setDate(date.getDate()+Math.max(0,(Number(state.day)||1)-1));const seconds=simulationSecondsNow();date.setHours(Math.floor(seconds/3600),Math.floor((seconds%3600)/60),seconds%60,0);return date;}
function renderShiftEntryPanel(title, description){const next=state.lastShiftDay===state.day||simulationMinuteNow()>=17*60;return `<div class="panel empty-state"><div class="empty-icon">◷</div><h3>${escapeHTML(title)}</h3><p>${escapeHTML(description)}</p><button class="btn primary" data-action="${next?'advance-workday':'start-shift'}">${next?'Advance to next workday':'Start shift'}</button></div>`;}

function renderWorkforce() {
  const currentBriefing = briefingFor(simulationDateNow());
  const metrics = {
    kpi: Math.min(100, Math.round((state.callsHandled + state.outboundCalls) * 5)),
    qa: state.qaCount ? Math.round(state.totalQA/state.qaCount) : 75,
    csat: state.csatCount ? Math.round(state.totalCSAT/state.csatCount) : 75,
    knowledge: Math.min(100, 70 + state.experience),
    compliance: state.incidents ? Math.max(0,100-state.incidents*12) : 95,
    leadership: Math.min(100, 60 + Math.floor(state.level*5))
  };
  const activeOrgPolicy = getActiveOrganization(state.organizationWorkspace)?.policy;
  const eligibility = promotionEligibility({metrics, attempts:state.promotionAttempts, minimumScore:activeOrgPolicy?.promotionThreshold ?? 75});
  const attended = currentBriefing && state.briefingAttendance.some(x=>x.briefingId===currentBriefing.id);
  const dept = DEPARTMENTS.find(x=>x.id===state.workforceDepartment) || DEPARTMENTS[0];
  viewRoot.innerHTML = `
    <div class="ops-summary-grid">
      <article class="metric-card"><span>DEPARTMENT</span><strong>${escapeHTML(dept.name)}</strong><small>Specialist assignment</small></article>
      <article class="metric-card"><span>BRIEFINGS ATTENDED</span><strong>${state.briefingAttendance.length}</strong><small>Recorded locally</small></article>
      <article class="metric-card"><span>PROMOTION SCORE</span><strong>${eligibility.score}%</strong><small>Weighted performance</small></article>
      <article class="metric-card"><span>EXAM ATTEMPTS LEFT</span><strong>${eligibility.attemptsRemaining}/3</strong><small>Maximum career attempts</small></article>
    </div>
    <div class="grid two" style="margin-top:14px">
      <section class="panel">
        <div class="panel-head"><div><h3>Daily operations briefings</h3><p>Product, service, policy and operational updates.</p></div><span class="pill ${attended?'green':'amber'}">${attended?'ATTENDED':currentBriefing?'IN SESSION WINDOW':'SCHEDULED'}</span></div>
        <div class="data-row"><span>Morning briefing</span><strong>07:30</strong></div>
        <div class="data-row"><span>Afternoon briefing</span><strong>14:00</strong></div>
        ${currentBriefing?`<div class="call-card" style="margin-top:12px"><span class="subtle-label">${currentBriefing.slot.toUpperCase()} BRIEFING · ${currentBriefing.scheduled}</span><h3>${currentBriefing.title}</h3><ul class="knowledge-list">${currentBriefing.topics.map(t=>`<li>${escapeHTML(t)}</li>`).join('')}</ul><button class="btn primary" data-action="attend-briefing" ${attended?'disabled':''}>${attended?'Attendance recorded':'Attend and acknowledge briefing'}</button></div>`:`<p class="muted-note" style="margin-top:12px">Briefings follow the in-game clock: morning attendance 07:30–08:30 and afternoon attendance 14:00–15:00. The simulation advances 30 game-seconds per real second.</p>`}
        <h4 style="margin-top:18px">Attendance history</h4>
        ${state.briefingAttendance.slice(-5).reverse().map(x=>`<div class="data-row"><span>${escapeHTML(x.slot)} · ${escapeHTML(x.scheduled)}</span><strong>${new Date(x.attendedAt).toLocaleString()}</strong></div>`).join('')||'<p class="muted-note">No briefing attendance recorded.</p>'}
      </section>
      <section class="panel">
        <div class="panel-head"><div><h3>Department assignment</h3><p>Every specialist remains responsible for customer care.</p></div></div>
        <label class="form-field">Assigned unit<select id="departmentSelect">${DEPARTMENTS.map(d=>`<option value="${d.id}" ${d.id===state.workforceDepartment?'selected':''}>${escapeHTML(d.name)}</option>`).join('')}</select></label>
        <div class="call-card" style="margin-top:12px"><span class="subtle-label">SPECIALIST RESPONSIBILITY</span><h3>${escapeHTML(dept.name)}</h3><p>${escapeHTML(dept.specialty)}</p><p class="muted-note">Core customer-service standards, identity protection, accurate records and respectful communication apply to every unit.</p></div>
        <div class="data-list" style="margin-top:12px">${DEPARTMENTS.map(d=>`<div class="data-row"><span>${escapeHTML(d.name)}</span><small>${escapeHTML(d.specialty)}</small></div>`).join('')}</div>
      </section>
      <section class="panel">
        <div class="panel-head"><div><h3>Agent state, shift adherence and coaching</h3><p>Scheduled shift operations, break adherence and team-leader support.</p></div><span class="pill ${state.shiftActive?'green':'amber'}">${escapeHTML(state.agentStatus.toUpperCase())}</span></div>
        <div class="data-list"><div class="data-row"><span>Shift status</span><strong>${state.shiftActive?'ACTIVE':'CLOSED'}</strong></div><div class="data-row"><span>Elapsed simulation time</span><strong>${Math.floor(state.shiftElapsedMinutes)} minutes</strong></div><div class="data-row"><span>Live schedule adherence</span><strong>${state.shiftRecord?.status==='active'?calculateShiftAdherence(state.shiftRecord,state.shiftElapsedMinutes).adherence+'%':'—'}</strong></div><div class="data-row"><span>Shift hours</span><strong>08:00–17:00</strong></div></div>
        ${state.shiftActive?`<div class="call-card" style="margin-top:12px"><span class="subtle-label">NEXT SCHEDULED BREAK</span>${(()=>{const b=nextScheduledBreak(state.shiftRecord,state.shiftElapsedMinutes);return b?`<h3>${escapeHTML(b.label)} · ${b.startLabel}</h3><p>${b.active?'Current scheduled break window.':`${Math.max(0,Math.ceil(b.startsInMinutes))} simulated minutes remaining.`}</p>`:'<h3>No further scheduled breaks</h3><p>The planned shift schedule has reached its final break window.</p>';})()}<div class="button-row"><button class="btn outline" data-action="take-break" ${expectedShiftMode(state.shiftRecord,state.shiftElapsedMinutes)==='break'&&state.agentStatus!=='break'&&!['busy','wrap-up'].includes(state.agentStatus)?'':'disabled'}>Start scheduled break</button><button class="btn outline" data-action="return-from-break" ${state.agentStatus==='break'?'':'disabled'}>Return from break</button><button class="btn danger" data-action="end-shift" ${state.currentCall||state.activeOutbound||state.wrapUp?'disabled':''}>End shift</button></div></div>`:state.lastShiftDay===state.day||simulationMinuteNow()>=17*60?`<button class="btn primary" style="margin-top:12px" data-action="advance-workday">Advance to next workday</button>`:`<button class="btn primary" style="margin-top:12px" data-action="start-shift">Start a new shift</button>`}
        <h4 style="margin-top:18px">Shift history</h4>
        ${state.shiftHistory.slice(-4).reverse().map(x=>`<div class="data-row"><span>Day ${x.day} · ${new Date(x.startedAt).toLocaleDateString()}</span><strong>${x.adherence}% adherence</strong></div>`).join('')||'<p class="muted-note">No completed shifts recorded.</p>'}
      </section>
      <section class="panel">
        <div class="panel-head"><div><h3>Team leader coaching</h3><p>Document observable feedback, a measurable action plan and follow-up.</p></div></div>
        <form id="coachingForm" class="form-stack"><label class="form-field">Coach / team leader<input name="coach" maxlength="80" required placeholder="Team leader name"></label><label class="form-field">Coaching topic<input name="topic" maxlength="120" required placeholder="Call control, product knowledge, QA, empathy"></label><label class="form-field">Feedback<textarea name="feedback" maxlength="600" placeholder="Specific behaviour observed and its customer impact."></textarea></label><label class="form-field">Action plan<textarea name="actionPlan" maxlength="600" required placeholder="What will change, how it will be measured, and by when."></textarea></label><label class="form-field">Coaching score<select name="score"><option value="5">5 · Strong</option><option value="4">4 · Good</option><option value="3" selected>3 · Meets expectations</option><option value="2">2 · Improvement required</option><option value="1">1 · Critical support required</option></select></label><label class="form-field">Follow-up date<input name="followUpDate" type="date"></label><button class="btn outline" type="submit">Record coaching session</button></form>
        <h4 style="margin-top:16px">Coaching history</h4>${state.coachingSessions.slice(-5).reverse().map(x=>`<div class="case-detail"><strong>${escapeHTML(x.topic)} · ${escapeHTML(x.coach)}</strong><p>${escapeHTML(x.actionPlan)}</p><small>Score ${x.score}/5 · ${new Date(x.recordedAt).toLocaleDateString()} · ${escapeHTML(x.status.replaceAll('_',' '))}</small></div>`).join('')||'<p class="muted-note">No coaching sessions recorded.</p>'}
      </section>
      <section class="panel">
        <div class="panel-head"><div><h3>Promotion and annual examination</h3><p>Three total annual-cycle attempts. One examination per calendar year.</p></div><span class="pill ${eligibility.eligible?'green':'amber'}">${eligibility.eligible?'ELIGIBLE':'NOT ELIGIBLE'}</span></div>
        ${Object.entries(metrics).map(([k,v])=>`<div class="data-row"><span>${k.toUpperCase()}</span><strong>${v}/100</strong></div>`).join('')}
        <div class="bar-track" style="margin:12px 0"><div class="bar-fill" style="width:${eligibility.score}%"></div></div>
        <p class="muted-note">Eligibility threshold: 75%. Exam pass mark: 70%. Actual organisation policies must be configured by an authorised administrator.</p>
        <form id="promotionExamForm" class="form-stack" style="margin-top:12px">
          <label class="form-field">Simulated examination score (0–100)<input name="examScore" type="number" min="0" max="100" required></label>
          <button class="btn primary" type="submit" ${eligibility.eligible?'':'disabled'}>Sit annual promotion examination</button>
        </form>
        <h4 style="margin-top:16px">Examination history</h4>
        ${state.promotionAttempts.map(a=>`<div class="data-row"><span>${a.year} · ${a.examScore}%</span><strong>${a.status.toUpperCase()}</strong></div>`).join('')||'<p class="muted-note">No examination attempts recorded.</p>'}
      </section>
      <section class="panel">
        <div class="panel-head"><div><h3>Customer care, cross-selling and commendations</h3><p>Consent-led recommendations and ethical customer recognition.</p></div></div>
        <form id="crossSellForm" class="form-stack">
          <label class="form-field">Synthetic customer reference<input name="customerId" placeholder="CUS-SIM-001" required></label>
          <label class="form-field">Relevant product or service<input name="product" placeholder="Savings product / card / digital service" required></label>
          <label class="form-field"><span><input name="relevant" type="checkbox"> Relevant to customer need</span></label>
          <label class="form-field"><span><input name="eligible" type="checkbox"> Customer appears eligible (simulated check)</span></label>
          <label class="form-field"><span><input name="consent" type="checkbox"> Customer gave permission for follow-up</span></label>
          <button class="btn outline" type="submit">Record recommendation outcome</button>
        </form>
        <form id="commendationForm" class="form-stack" style="margin-top:16px">
          <label class="form-field">Customer reference<input name="customerId" placeholder="CUS-SIM-001" required></label>
          <label class="form-field">Customer commendation<textarea name="message" maxlength="500" required placeholder="Record the customer's words and context."></textarea></label>
          <p class="muted-note">No private gifts, payments or personal arrangements may be accepted. Refer recognition through official customer-relations channels.</p>
          <button class="btn outline" type="submit">Log and refer commendation</button>
        </form>
        <h4 style="margin-top:16px">Recent records</h4>
        ${[...state.crossSellRecords.slice(-3).map(x=>`<div class="data-row"><span>Cross-sell · ${escapeHTML(x.product)}</span><strong>${x.outcome.replace('_',' ').toUpperCase()}</strong></div>`),...state.commendations.slice(-3).map(x=>`<div class="data-row"><span>Commendation · ${escapeHTML(x.customerId)}</span><strong>REFERRED</strong></div>`)].join('')||'<p class="muted-note">No records yet.</p>'}
      </section>
      <section class="panel" style="grid-column:1/-1">
        <div class="panel-head"><div><h3>Enterprise systems sandbox</h3><p>Connected workflow practice using synthetic records only. No real banking systems or transactions.</p></div><span class="pill green">SIMULATION</span></div>
        <div class="grid three">${SYSTEMS.map(s=>`<article class="campaign-card"><span class="subtle-label">${s.id.toUpperCase()}</span><h3>${escapeHTML(s.name)}</h3><p>${escapeHTML(s.purpose)}</p><button class="btn outline small" data-action="launch-system" data-system="${s.id}">Open simulated system</button></article>`).join('')}</div>
        <h4 style="margin-top:16px">System activity</h4>
        ${state.systemEvents.slice(-8).reverse().map(e=>`<div class="data-row"><span>${e.systemId.toUpperCase()} · ${escapeHTML(e.action)}</span><strong>${escapeHTML(e.reference)} · SIMULATED</strong></div>`).join('')||'<p class="muted-note">No system events recorded.</p>'}
      </section>
    </div>`;
}

function renderOrganizationWorkspace() {
  const org = getActiveOrganization(state.organizationWorkspace);
  if (!org) { viewRoot.innerHTML = '<div class="panel empty-state"><h3>No organisation workspace</h3><p>Create an organisation workspace to begin.</p></div>'; return; }
  const snapshot = getOrganizationSnapshot(state.organizationWorkspace, org.id);
  const active = snapshot.members.filter(member => member.status === 'active').length;
  const invited = snapshot.members.filter(member => member.status === 'invited').length;
  const suspended = snapshot.members.filter(member => member.status === 'suspended').length;
  const departments = org.policy.departments;
  viewRoot.innerHTML = `
    <div class="ops-summary-grid org-summary-grid">
      <article class="metric-card"><span>ORGANISATIONS IN THIS BROWSER</span><strong>${state.organizationWorkspace.organizations.length}</strong><small>Local workspace profiles</small></article>
      <article class="metric-card"><span>STAFF MEMBERS</span><strong>${snapshot.memberCount}</strong><small>${active} active · ${invited} invited · ${suspended} suspended</small></article>
      <article class="metric-card"><span>CONFIGURED DEPARTMENTS</span><strong>${departments.length}</strong><small>Organisation-specific units</small></article>
      <article class="metric-card"><span>AUDIT EVENTS</span><strong>${snapshot.audit.length}</strong><small>Local administrative history</small></article>
    </div>
    <div class="grid two org-grid">
      <section class="panel">
        <div class="panel-head"><div><h3>Organisation workspace</h3><p>Switch between isolated local training workspaces.</p></div><span class="pill green">${escapeHTML(org.status.toUpperCase())}</span></div>
        <label class="form-field">Active organisation<select id="activeOrganizationSelect">${state.organizationWorkspace.organizations.map(item=>`<option value="${escapeHTML(item.id)}" ${item.id===org.id?'selected':''}>${escapeHTML(item.name)}</option>`).join('')}</select></label>
        <div class="data-list"><div class="data-row"><span>Organisation name</span><strong>${escapeHTML(org.name)}</strong></div><div class="data-row"><span>Industry</span><strong>${escapeHTML(org.industry)}</strong></div><div class="data-row"><span>Created</span><strong>${new Date(org.createdAt).toLocaleDateString()}</strong></div><div class="data-row"><span>Workspace ID</span><strong>${escapeHTML(org.id)}</strong></div></div>
        <form id="orgCreateForm" class="org-form"><h4>Create another organisation</h4><div class="form-field"><label for="orgName">ORGANISATION NAME</label><input id="orgName" name="name" required minlength="2" maxlength="80" placeholder="e.g. Northern Customer Services" /></div><div class="form-field"><label for="orgIndustry">INDUSTRY</label><select id="orgIndustry" name="industry"><option>Banking and financial services</option><option>Telecommunications</option><option>E-commerce and retail</option><option>Insurance</option><option>Healthcare administration</option><option>Travel and hospitality</option><option>Logistics and utilities</option><option>General customer service</option></select></div><button class="btn primary" type="submit">Create local workspace</button></form>
      </section>
      <section class="panel">
        <div class="panel-head"><div><h3>Staff directory & access roles</h3><p>Invitations are simulated. No email is sent and no login is created.</p></div><span class="pill">${snapshot.memberCount} RECORDS</span></div>
        <div class="org-member-list">${snapshot.members.map(member=>`<article class="org-member"><div class="org-member-avatar">${escapeHTML(initials(member.name))}</div><div class="org-member-copy"><strong>${escapeHTML(member.name)}</strong><small>${escapeHTML(member.email)} · ${escapeHTML(member.department)}</small><small>${escapeHTML(ORGANIZATION_ROLES[member.role]?.label || member.role)}</small></div><div class="org-member-actions"><span class="pill ${member.status==='active'?'green':member.status==='suspended'?'red':'amber'}">${escapeHTML(member.status.toUpperCase())}</span><button class="btn small outline" data-action="toggle-org-member" data-member-id="${escapeHTML(member.id)}" data-next-status="${member.status==='suspended'?'active':'suspended'}" ${member.role==='owner'?'disabled':''}>${member.status==='suspended'?'Reactivate':'Suspend'}</button></div></article>`).join('')}</div>
        <form id="orgMemberForm" class="org-form"><h4>Invite a staff member</h4><div class="org-form-grid"><div class="form-field"><label for="orgMemberName">FULL NAME</label><input id="orgMemberName" name="name" required minlength="2" maxlength="70" /></div><div class="form-field"><label for="orgMemberEmail">WORK EMAIL</label><input id="orgMemberEmail" name="email" type="email" required maxlength="120" /></div><div class="form-field"><label for="orgMemberRole">ACCESS ROLE</label><select id="orgMemberRole" name="role">${Object.entries(ORGANIZATION_ROLES).filter(([role])=>role!=='owner').map(([role,info])=>`<option value="${role}">${escapeHTML(info.label)}</option>`).join('')}</select></div><div class="form-field"><label for="orgMemberDepartment">DEPARTMENT</label><select id="orgMemberDepartment" name="department">${departments.map(department=>`<option>${escapeHTML(department)}</option>`).join('')}</select></div></div><button class="btn primary" type="submit">Add simulated staff invitation</button></form>
      </section>
      <section class="panel">
        <div class="panel-head"><div><h3>Organisation policies</h3><p>Configure local training targets. These are not official service standards.</p></div><span class="pill amber">SANDBOX POLICY</span></div>
        <form id="orgPolicyForm" class="org-form"><div class="org-policy-grid">
          <div class="form-field"><label for="policyVoice">VOICE RESPONSE TARGET · SECONDS</label><input id="policyVoice" name="voiceResponseTargetSeconds" type="number" min="5" max="600" step="1" value="${org.policy.voiceResponseTargetSeconds}" required /></div>
          <div class="form-field"><label for="policyDigital">DIGITAL RESPONSE TARGET · MINUTES</label><input id="policyDigital" name="digitalResponseTargetMinutes" type="number" min="1" max="1440" step="1" value="${org.policy.digitalResponseTargetMinutes}" required /></div>
          <div class="form-field"><label for="policyQA">QA PASS MARK · %</label><input id="policyQA" name="qaPassMark" type="number" min="0" max="100" step="1" value="${org.policy.qaPassMark}" required /></div>
          <div class="form-field"><label for="policyPromotion">PROMOTION THRESHOLD · %</label><input id="policyPromotion" name="promotionThreshold" type="number" min="0" max="100" step="1" value="${org.policy.promotionThreshold}" required /></div>
          <div class="form-field"><label for="policyChats">MAX CONCURRENT CHATS</label><input id="policyChats" name="maxConcurrentChats" type="number" min="1" max="10" step="1" value="${org.policy.maxConcurrentChats}" required /></div>
          <div class="form-field"><label for="policyRetention">DATA RETENTION · DAYS</label><input id="policyRetention" name="dataRetentionDays" type="number" min="1" max="3650" step="1" value="${org.policy.dataRetentionDays}" required /></div>
        </div><button class="btn primary" type="submit">Save organisation policy</button></form>
        <h4 style="margin-top:18px">Department catalogue</h4><div class="org-department-tags">${departments.map(item=>`<span>${escapeHTML(item)}</span>`).join('')}</div>
      </section>
      <section class="panel">
        <div class="panel-head"><div><h3>Role permission matrix</h3><p>Least-privilege role definitions for the local workspace model.</p></div></div>
        <div class="table-wrap"><table class="org-role-table"><thead><tr><th>Role</th><th>Organisation</th><th>Members</th><th>Cases</th><th>Reports</th><th>Audit</th></tr></thead><tbody>${Object.entries(ORGANIZATION_ROLES).map(([role,info])=>`<tr><td><strong>${escapeHTML(info.label)}</strong></td><td>${info.permissions.some(p=>p.startsWith('org:'))?'Manage':'—'}</td><td>${info.permissions.includes('members:manage')?'Manage':info.permissions.includes('members:read')?'Read':'—'}</td><td>${info.permissions.includes('cases:read')?'Read':info.permissions.includes('cases:own')?'Own':'—'}</td><td>${info.permissions.includes('reports:read')?'Read':'—'}</td><td>${info.permissions.includes('audit:read')?'Read':'—'}</td></tr>`).join('')}</tbody></table></div>
        <p class="org-security-note">Workspace separation is currently enforced only by the local application data model and active-workspace filtering. It is not server-side tenant isolation, authentication, or production access control.</p>
        <h4 style="margin-top:18px">Administrative audit history</h4><div class="org-audit-list">${snapshot.audit.slice(-8).reverse().map(item=>`<div class="org-audit-row"><time>${new Date(item.at).toLocaleString()}</time><div><strong>${escapeHTML(item.type.replaceAll('-',' '))}</strong><small>${escapeHTML(item.detail)} · ${escapeHTML(item.actor)}</small></div></div>`).join('')||'<p class="muted-note">No audit events recorded.</p>'}</div>
      </section>
    </div>
    <div class="org-disclaimer">DEVELOPMENT SIMULATION · Staff invitations, role permissions, organisation policies and audit events are stored in this browser only. No real accounts, emails, server-side tenant boundaries or external integrations are created.</div>`;
}

function renderView() {
  setHeader();
  const config = {
    overview:['CAREER ENTRY',state.hired?'Your shift overview':state.stage==='assessment'?'Recruitment assessment':state.stage==='offer'?'Employment offer':'Start your application',state.hired?'Your daily operations, performance and available work.':'Complete recruitment before starting agent operations.'],
    inbound:['CUSTOMER OPERATIONS','Inbound desk','Answer, investigate, resolve, transfer and document incoming customer contacts.'],
    queue:['OPERATIONS CONTROL','Queue management','Inspect priority, routing groups, waiting contacts and scheduled callbacks.'],
    supervisor:['SUPERVISOR DESK','Assistance & escalations','Review agent assistance requests, escalations and operational activity.'],
    outbound:['CUSTOMER OPERATIONS','Outbound campaigns','Work authorised simulated campaigns and record true outcomes.'],
    digital:['CUSTOMER OPERATIONS','Multi-channel support','Handle simulated email, live-chat and social-media conversations with channel-specific privacy and service standards.'],
    crm:['WORKSTATION','CRM & cases','Review accurate records of completed simulated interactions.'],
    knowledge:['AGENT RESOURCES','Knowledge base','Reference the principles and procedures relevant to your role.'],
    performance:['PERFORMANCE INTELLIGENCE','Performance dashboard','Review quality, resolution and service performance.'],
    career:['CAREER MANAGEMENT','Career profile','Track employment details, experience and progression.'],
    workforce:['WORKFORCE INTELLIGENCE','People & enterprise operations','Briefings, departments, promotion, customer recognition and simulated enterprise systems.'],
    organization:['ENTERPRISE ADMINISTRATION','Organisation workspaces','Manage local organisation profiles, staff directory, access roles, policies and audit history.']
  };
  const [eyebrow,title,desc] = config[state.currentView] || config.overview;
  $('#pageEyebrow').textContent = eyebrow; $('#pageTitle').textContent = title; $('#pageDescription').textContent = desc;
  $('#pageActions').innerHTML = state.hired && state.currentView!=='overview' ? `<span class="pill ${state.shiftActive?'green':'amber'}">${state.shiftActive?'SHIFT ACTIVE':'OFF SHIFT'}</span>` : '';
  switch(state.currentView){
    case 'overview': renderOverview(); break;
    case 'inbound': renderInbound(); break;
    case 'queue': renderQueue(); break;
    case 'supervisor': renderSupervisor(); break;
    case 'outbound': renderOutbound(); break;
    case 'digital': renderDigital(); break;
    case 'crm': renderCRM(); break;
    case 'knowledge': renderKnowledge(); break;
    case 'performance': renderPerformance(); break;
    case 'career': renderCareer(); break;
    case 'workforce': renderWorkforce(); break;
    case 'organization': renderOrganizationWorkspace(); break;
    default: state.currentView='overview'; renderOverview();
  }
  saveState();
}

function openModal(html) {
  const wrap=document.createElement('div'); wrap.className='modal-backdrop'; wrap.innerHTML=`<div class="modal">${html}</div>`;
  wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove();});
  document.body.append(wrap); return wrap;
}
function openApplication() {
  const modal=openModal(`<div class="subtle-label">MERIDIAN SERVICE GROUP · CAREER APPLICATION</div><h3>Candidate application</h3><p>Choose a career track. Your recruitment assessment and initial department will reflect this selection.</p><div class="form-field"><label>FULL NAME</label><input id="candidateName" maxlength="48" placeholder="Enter your name" value="${escapeHTML(state.applicantName)}" /></div><div class="form-field"><label>CAREER TRACK</label><select id="candidateTrack"><option value="banking">Banking Operations & Customer Service</option><option value="service">General Customer Experience</option><option value="technical">Technical Support & Helpdesk</option><option value="sales">Sales, Retention & Campaigns</option></select></div><div class="form-field"><label>WORK PREFERENCE</label><select id="workPreference"><option>Voice and digital channels</option><option>Voice contact centre</option><option>Digital customer support</option></select></div><div class="modal-actions"><button class="btn outline" data-close>Cancel</button><button class="btn primary" id="submitApplication">Submit application →</button></div>`);
  $('#candidateTrack',modal).value=state.selectedTrack;
  $('[data-close]',modal).onclick=()=>modal.remove();
  $('#submitApplication',modal).onclick=()=>{
    const name=$('#candidateName',modal).value.trim(); if(name.length<2){toast('Enter a name with at least two characters.','error');return;}
    state.applicantName=name; state.nameInitials=initials(name); state.selectedTrack=$('#candidateTrack',modal).value;
    const map={banking:['Banking Operations','Customer Experience Associate',185000],service:['Customer Experience','Customer Service Associate',170000],technical:['Technical Support','Technical Support Associate',195000],sales:['Sales & Retention','Customer Engagement Associate',180000]};
    [state.department,state.roleTitle,state.salary]=map[state.selectedTrack];state.applicationSubmitted=true;state.stage='applicant';modal.remove();toast('Application submitted. Recruitment assessment is ready.','success');renderView();
  };
}
function beginAssessment(){state.stage='assessment';state.assessmentPhase='aptitude';state.assessmentIndex=0;state.assessmentAnswers=[];state.practicalIndex=0;state.practicalAnswers=[];selectedAnswer=null;renderView();}
function acceptOffer(){state.stage='employee';state.hired=true;state.shiftActive=false;state.level=1;state.experience=0;state.agentStatus='offline';state.currentView='overview';saveState();toast('Employment accepted. Welcome to the operations floor.','success');renderView();}
function setAgentState(status, reason = '') {
  if (!AGENT_STATES.includes(status)) throw new TypeError('Unknown agent state.');
  if (!state.shiftActive || !state.shiftRecord || state.shiftRecord.status !== 'active') {
    if (status !== 'offline') throw new Error('Start an active shift before changing agent state.');
    state.agentStatus = 'offline';
    productionWorld?.setAgentActivity?.('offline');
    return null;
  }
  const event = recordAgentState(state.shiftRecord, status, state.shiftElapsedMinutes, reason);
  state.agentStatus = status;
  productionWorld?.setAgentActivity?.(status);
  return event;
}
function startShift(){
  if(!state.hired){toast('Complete recruitment and accept the employment offer before starting a shift.','warning');return;}
  if (state.shiftActive) { toast('Your shift is already active.'); return; }
  if(state.lastShiftDay===state.day){toast('You have already completed or closed a shift for this simulated workday. Advance to the next workday.','warning');return;}
  const simulatedMinute=simulationMinuteNow();
  if(simulatedMinute<8*60){toast('The scheduled shift begins at 08:00. Attend the morning briefing before starting.','warning');return;}
  if(simulatedMinute>=17*60){toast('The scheduled shift has ended for today. Start the next simulated workday.','warning');return;}
  state.day=state.day||1;
  state.shiftElapsedMinutes=simulatedMinute-(8*60);
  state.shiftRecord=createShiftRecord({day:state.day,startedAt:Date.now()});
  if(state.shiftElapsedMinutes>0){state.shiftRecord.events=[{status:'offline',elapsedMinute:0,at:new Date().toISOString(),reason:'Before scheduled shift start'}];recordAgentState(state.shiftRecord,'available',state.shiftElapsedMinutes,'Late shift start');}
  state.shiftActive=true;
  state.agentStatus='available';
  productionWorld?.setAgentActivity?.('available');
  state.shiftMinutes=0;
  ensureInboundQueue(6);
  ensureDigitalQueue(6);
  state.currentView='overview';
  pushOperationEvent('shift','SHIFT-'+state.day,'Shift started; inbound routing opened.','active');
  saveState();toast('Shift started. Inbound routing is open.','success');renderView();
}
function takeScheduledBreak(){
  if(!state.shiftActive||state.currentCall||state.activeOutbound||state.wrapUp||state.digitalActiveId){toast('Finish the current interaction before taking a break.','warning');return;}
  if(state.agentStatus==='break'){toast('You are already on a scheduled break.','warning');return;}
  const mode=expectedShiftMode(state.shiftRecord,state.shiftElapsedMinutes);
  if(mode!=='break'){toast('This is not a scheduled break window.','warning');return;}
  setAgentState('break','Scheduled break started');
  pushOperationEvent('workforce',state.shiftRecord.id,'Agent started a scheduled break.','break');
  saveState();renderView();
}
function returnFromBreak(){
  if(state.agentStatus!=='break'){toast('The agent is not currently on break.');return;}
  setAgentState('available','Returned from scheduled break');
  pushOperationEvent('workforce',state.shiftRecord?.id||'SHIFT','Agent returned from break.','available');
  saveState();renderView();
}
function endShift(){
  if(!state.shiftActive||!state.shiftRecord){toast('There is no active shift.');return;}
  if(state.currentCall||state.activeOutbound||state.wrapUp||state.digitalActiveId){toast('Complete or safely close the active customer interaction before ending the shift.','warning');return;}
  setAgentState('offline','Shift ended by employee');
  const completed=closeShift(state.shiftRecord,Date.now(),state.shiftElapsedMinutes);
  state.shiftHistory.push({id:completed.id,day:completed.day,startedAt:completed.startedAt,endedAt:completed.endedAt,elapsedMinutes:completed.elapsedMinutes,adherence:completed.adherence?.adherence??0,status:completed.status});
  state.shiftHistory=state.shiftHistory.slice(-20);
  state.lastShiftDay=state.day;
  state.shiftActive=false;state.agentStatus='offline';
  pushOperationEvent('shift',completed.id,`Shift ended. Adherence ${completed.adherence?.adherence??0}%.`,'completed');
  saveState();renderView();toast(`Shift closed · ${completed.adherence?.adherence??0}% adherence.`,'success');
}
function advanceWorkday(){
  if(!state.hired){toast('Employment is required before advancing a workday.','warning');return;}
  if(state.shiftActive||state.currentCall||state.activeOutbound||state.wrapUp||state.digitalActiveId){toast('Close the current shift and customer interactions before advancing the workday.','warning');return;}
  if(state.lastShiftDay!==state.day&&simulationMinuteNow()<17*60){toast('The current workday has not ended. Finish or close this shift before advancing.','warning');return;}
  state.day=Math.max(1,Number(state.day)||1)+1;
  state.simulationClockSeconds=7*3600;
  simulationClockTicker=7*3600;
  lastShiftSaveBucket=0;
  state.shiftElapsedMinutes=0;
  state.shiftRecord=null;
  state.agentStatus='offline';
  saveState();renderView();
  toast(`Workday ${state.day} is ready. Morning briefing begins at 07:30.`,'success');
}

function startInboundCall(){
  if(!state.shiftActive){toast('Start your shift before accepting contacts.','warning');return;}
  if(!shiftTimeAvailable()){toast('The scheduled 08:00–17:00 shift window has ended. Close the shift before starting another contact.','warning');return;}
  if(state.agentStatus!=='available'){toast(`Your agent status is ${state.agentStatus}. Return to Available before accepting a contact.`,'warning');return;}
  ensureInboundQueue(6);
  if(state.callQueue<=0){toast('The inbound queue is empty. Load the next simulated arrival batch.');return;}
  const queued = nextQueuedContact(state.inboundQueueItems);
  if(!queued){syncQueueCount();toast('No eligible contacts are waiting.');return;}
  const contact = findQueueContact(queued.id);
  const scenario = inboundScenarios.find(item=>item.id===contact?.scenarioId);
  if(!contact || !scenario){toast('The queued scenario could not be loaded. Refresh the queue.','error');return;}
  const acceptedAt = Date.now();
  transitionContact(contact, CONTACT_STATUS.OFFERED, 'Contact offered to the agent', acceptedAt, { routeGroup: contact.routeGroup });
  transitionContact(contact, CONTACT_STATUS.CONNECTED, 'Agent accepted the inbound contact', acceptedAt, { agent: state.applicantName || 'Agent' });
  const linkedCallback=state.callbacks.find(item=>item.contactId===contact.id&&item.status==='queued');
  if(linkedCallback){linkedCallback.status='in_progress';linkedCallback.acceptedAt=new Date(acceptedAt).toISOString();}
  const waitSeconds = Math.max(0, Math.floor((acceptedAt - Date.parse(contact.queuedAt)) / 1000));
  state.totalWaitSeconds += waitSeconds;
  state.acceptedContacts++;
  if(waitSeconds<=60)state.contactsWithinSla++;
  state.currentCall={scenarioId:scenario.id,queueContactId:contact.id,stepIndex:0,score:0,feedback:null,feedbackType:'neutral',breach:false,held:false,startedAt:acceptedAt,waitSeconds};
  setAgentState('busy','Inbound customer contact accepted');
  voiceConsent=false;voiceStatus='inactive';voiceTranscript='';
  syncQueueCount();
  pushOperationEvent('call',contact.id,`Inbound contact connected · ${scenario.issue}`,'connected',{customer:scenario.customer,routeGroup:contact.routeGroup,priority:contact.priority,waitSeconds});
  saveState();renderView();
}

function applyCallChoice(index){
  const call=state.currentCall;const scenario=inboundScenarios.find(s=>s.id===call.scenarioId);const option=scenario.steps[call.stepIndex].options[index];if(!option)return;
  call.score+=option.score;call.feedback=option.feedback;call.feedbackType=option.breach||option.score<0?'bad':option.score>0?'good':'neutral';call.breach=call.breach||!!option.breach;
  if(option.breach)state.incidents++;
  addCallTimeline(call,`Agent selected: ${option.text}`,{scoreDelta:option.score,breach:!!option.breach});
  saveState();renderView();
}
function beginInboundWrapUp(transferred = false){
  const call=state.currentCall;
  if(!call)return;
  if(call.held){toast('Resume the call before moving it to wrap-up.','warning');return;}
  const scenario=inboundScenarios.find(item=>item.id===call.scenarioId);
  const contact=findQueueContact(call.queueContactId);
  if(!scenario||!contact){toast('The active contact record is missing.','error');return;}
  if(contact.status==='connected')transitionContact(contact,CONTACT_STATUS.WRAP_UP,'Customer conversation completed; after-contact work started',Date.now());
  else if(contact.status==='transferred')transitionContact(contact,CONTACT_STATUS.WRAP_UP,'Transferred interaction entered after-contact work',Date.now());
  const qa=Math.max(0,Math.min(100,Math.round(70+call.score*5-(call.breach?35:0))));
  stopVoiceTools();
  setAgentState('wrap-up','Inbound call entered after-contact work');
  state.wrapUp={type:'inbound',contactId:contact.id,scenarioId:scenario.id,reference:scenario.reference,customer:scenario.customer,title:scenario.issue,channel:'Inbound',qa,score:call.score,breach:call.breach,transferred:!!transferred,transferTarget:call.transferredTo||'',startedAt:Date.now(),defaultDisposition:transferred||call.breach?'escalated':'resolved'};
  pushOperationEvent('wrap-up',contact.id,'After-contact work started.','wrap_up',{qa,breach:call.breach});
  saveState();renderView();
}
function beginOutboundWrapUp(){
  const active=state.activeOutbound;
  if(!active)return;
  const task=outboundCampaigns.find(item=>item.id===active.campaignId);
  if(!task)return;
  const qa=Math.max(0,Math.min(100,Math.round(70+active.score*5-(active.breach?35:0))));
  const good=active.score>=4&&!active.breach;
  setAgentState('wrap-up','Outbound call entered after-contact work');
  state.wrapUp={type:'outbound',contactId:active.attemptId,reference:active.attemptId,customer:task.customer,title:task.title,channel:'Outbound',qa,score:active.score,breach:active.breach,startedAt:Date.now(),defaultDisposition:active.suppressionRequested?'opt_out':active.disposition|| (good?'completed':'review'),suppressionRequested:!!active.suppressionRequested,campaignId:task.id};
  pushOperationEvent('wrap-up',active.attemptId,'Outbound contact entered after-contact work.','wrap_up',{qa,breach:active.breach});
  saveState();renderView();
}
function renderWrapUp(){
  const wrap=state.wrapUp;
  if(!wrap)return;
  const inbound=wrap.type==='inbound';
  const allowed = inbound
    ? ((wrap.breach || wrap.transferred) ? [['escalated','Escalate to specialist / quality review']] : [['resolved','Resolved'],['escalated','Escalated to specialist'],['callback','Callback required']])
    : (wrap.breach ? [['review','Compliance / quality review']] : [['completed','Completed'],['callback','Customer requested callback'],['declined','Customer declined'],...(wrap.suppressionRequested?[['opt_out','Do not contact — suppression required']]:[])]);
  const defaultDisposition=allowed.some(([value])=>value===wrap.defaultDisposition)?wrap.defaultDisposition:allowed[0][0];
  const contact=findQueueContact(wrap.contactId);
  const transferLine=wrap.transferTarget?`<div class="data-row"><span>Transfer destination</span><strong>${escapeHTML(wrap.transferTarget)}</strong></div>`:'';
  viewRoot.innerHTML=`<div class="wrapup-layout"><section class="panel assessment-card"><div class="panel-head"><div><div class="question-kicker">${inbound?'INBOUND':'OUTBOUND'} · AFTER-CONTACT WORK</div><h3 style="margin-top:7px">Complete the interaction record</h3></div><span class="pill amber">WRAP-UP</span></div><div class="customer-strip"><div class="customer-avatar">${escapeHTML(initials(wrap.customer))}</div><div class="customer-info"><strong>${escapeHTML(wrap.customer)}</strong><small>${escapeHTML(wrap.title)} · ${escapeHTML(wrap.reference)}</small></div><span class="pill">QA ${wrap.qa}%</span></div><div class="form-field" style="margin-top:18px"><label for="wrapDisposition">FINAL DISPOSITION</label><select id="wrapDisposition">${allowed.map(([value,label])=>`<option value="${value}" ${value===defaultDisposition?'selected':''}>${label}</option>`).join('')}</select></div><div class="form-field" id="callbackDueWrap" style="display:none"><label for="callbackDueAt">CALLBACK DATE & TIME</label><input id="callbackDueAt" type="datetime-local" /></div><div class="form-field"><label for="wrapNotes">FACTUAL CASE NOTES</label><textarea id="wrapNotes" rows="5" minlength="12" maxlength="1200" placeholder="Record the customer's issue, checks performed, action taken and agreed next step. A minimum of 12 characters is required.">${escapeHTML(wrap.transferred?`Transferred to ${wrap.transferTarget}. `:'')}</textarea><small class="muted-note">Do not enter PINs, passwords, one-time codes or unnecessary sensitive information.</small></div><div class="article-box"><h4>After-contact checklist</h4><p>Confirm the disposition, document the actual action, set a callback only when requested, and route unresolved or security-sensitive cases correctly.</p></div><div class="assessment-footer"><small>${wrap.breach?'A critical breach requires escalation or review.':'Saving this record updates the queue, case history and performance metrics.'}</small><button class="btn primary" data-action="save-wrap-up">Save record & finish →</button></div></section><aside class="panel"><div class="panel-head"><div><h3>Interaction summary</h3><p>Operational event data.</p></div><span class="pill green">RECORDED ACTIVITY</span></div><div class="data-list"><div class="data-row"><span>Customer</span><strong>${escapeHTML(wrap.customer)}</strong></div><div class="data-row"><span>Channel</span><strong>${wrap.channel}</strong></div><div class="data-row"><span>Reference</span><strong>${escapeHTML(wrap.reference)}</strong></div><div class="data-row"><span>Quality estimate</span><strong>${wrap.qa}%</strong></div><div class="data-row"><span>Contact priority</span><strong>${contact?escapeHTML(contact.priority.toUpperCase()):'STANDARD'}</strong></div>${transferLine}</div><p class="muted-note" style="margin-top:14px">After-contact work is part of handling time and must be completed before the next contact is accepted.</p></aside></div>`;
  const disposition=$('#wrapDisposition');
  const callbackWrap=$('#callbackDueWrap');
  const updateCallback=()=>{if(callbackWrap)callbackWrap.style.display=disposition?.value==='callback'?'block':'none';};
  disposition?.addEventListener('change',updateCallback);updateCallback();
  const due=$('#callbackDueAt');if(due){const d=new Date(Date.now()+24*60*60*1000);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());due.value=d.toISOString().slice(0,16);}
}
function saveWrapUp(){
  const wrap=state.wrapUp;if(!wrap)return;
  const notes=$('#wrapNotes')?.value.trim()||'';
  const disposition=$('#wrapDisposition')?.value||wrap.defaultDisposition;
  if(notes.length<12){toast('Add factual case notes of at least 12 characters.','error');return;}
  const inbound=wrap.type==='inbound';
  const allowedDispositions=inbound
    ? ((wrap.breach||wrap.transferred)?['escalated']:['resolved','escalated','callback'])
    : (wrap.breach?['review']:['completed','callback','declined',...(wrap.suppressionRequested?['opt_out']:[])]);
  if(!allowedDispositions.includes(disposition)){toast('Choose a permitted final disposition for this interaction.','error');return;}
  const createdAt=new Date().toISOString();
  let callbackDueISO=null;
  if(disposition==='callback'){
    const dueInput=$('#callbackDueAt')?.value||'';
    const dueMillis=Date.parse(dueInput);
    if(!Number.isFinite(dueMillis)||dueMillis<=Date.now()){
      toast('Choose a valid future callback date and time.','error');return;
    }
    callbackDueISO=new Date(dueMillis).toISOString();
  }
  const started=wrap.startedAt||Date.now();
  const acwSeconds=Math.max(1,Math.round((Date.now()-started)/1000));
  let contact=null;
  if(inbound){
    contact=findQueueContact(wrap.contactId);
    if(!contact){toast('Contact record missing; wrap-up was not saved.','error');return;}
    let scheduledCallback=null;
    if(disposition==='callback'){
      try{scheduledCallback=scheduleCallback(state.callbacks,contact,callbackDueISO,Date.now());}
      catch(error){toast(error.message,'error');return;}
      scheduledCallback.type='inbound';
    }
    // Complete a previous callback only after the new disposition and due time validate.
    completeActiveCallback(state.callbacks,{contactId:contact.id},Date.now());
    if(disposition==='callback'){
      transitionContact(contact,CONTACT_STATUS.CALLBACK,'Customer callback scheduled',Date.now(),{dueAt:callbackDueISO});
    }else if(disposition==='escalated'){
      transitionContact(contact,CONTACT_STATUS.ESCALATED,'Case escalated after wrap-up',Date.now());
    }else{
      transitionContact(contact,CONTACT_STATUS.COMPLETED,'Interaction completed after wrap-up',Date.now());
    }
    const resolved=disposition==='resolved'&&!wrap.breach;
    const status=disposition==='resolved'?'Resolved':disposition==='callback'?'Callback scheduled':disposition==='escalated'?'Escalated / review required':'Transferred / review required';
    const elapsedMinutes=Math.max(0.1,Math.round((((wrap.startedAt||Date.now())-(state.currentCall?.startedAt||wrap.startedAt||Date.now()))/60000)*10)/10);
    state.callsHandled++;state.totalQA+=wrap.qa;state.qaCount++;state.totalCSAT+=resolved?4.6:wrap.breach?2.1:3.4;state.csatCount++;state.totalHandleMinutes+=elapsedMinutes;
    if(resolved)state.resolutions++;
    const record={reference:wrap.reference,contactId:wrap.contactId,customer:wrap.customer,title:wrap.title,channel:'Inbound',status,disposition,notes,qa:wrap.qa,acwSeconds,createdAt,owner:state.applicantName||'Agent',timeline:contact.timeline.slice()};
    state.cases.push(record);state.experience+=resolved?14:7;state.bonus+=resolved?350:0;state.shiftMinutes+=Math.max(1,Math.round(elapsedMinutes+acwSeconds/60));
    if(disposition==='escalated'||wrap.breach){state.supervisorRequests.push({id:makeCallReference('SUP'),contactId:wrap.contactId,reference:wrap.reference,customer:wrap.customer,reason:wrap.breach?'Critical compliance / security review':'Specialist escalation',status:'open',createdAt});}
    pushOperationEvent('case',wrap.reference,`Inbound case saved · ${status}`,'saved',{disposition,qa:wrap.qa,acwSeconds});
    state.currentCall=null;
  }else{
    const active=state.activeOutbound;
    const task=outboundCampaigns.find(item=>item.id===wrap.campaignId);
    if(!active||!task){toast('Outbound campaign record missing; wrap-up was not saved.','error');return;}
    // Validate the callback date before changing a previous attempt or contact preference.
    const outboundCallback=disposition==='callback'?{
      id:makeCallReference('CBK'),type:'outbound',contactId:wrap.contactId,customer:task.customer,
      campaignId:task.id,scenarioId:null,issue:task.title,dueAt:callbackDueISO,status:'scheduled',createdAt
    }:null;
    if(disposition==='opt_out'&&!wrap.suppressionRequested){toast('The customer has not requested suppression in this scenario.','error');return;}
    if(disposition==='opt_out'){
      addSuppression(state.outboundSuppressions,task.customer,'Customer requested no further campaign contact',Date.now());
    }
    completeActiveCallback(state.callbacks,{callbackId:active.callbackId},Date.now());
    if(outboundCallback)state.callbacks.push(outboundCallback);
    const good=disposition==='completed'&&active.score>=4&&!active.breach;
    state.outboundCalls++;state.totalQA+=wrap.qa;state.qaCount++;state.totalCSAT+=good?4.5:active.score>=0?3.3:2.1;state.csatCount++;
    if(good&&task.id==='product-offer')state.sales++;
    if(!state.outboundDone.includes(task.id))state.outboundDone.push(task.id);
    const status=disposition==='opt_out'?'Opt-out recorded':disposition==='callback'?'Callback scheduled':disposition==='declined'?'Customer declined':disposition==='review'?'Review required':good?'Completed':'Review required';
    state.cases.push({reference:wrap.reference,contactId:wrap.contactId,customer:task.customer,title:task.title,channel:'Outbound',status,disposition,notes,qa:wrap.qa,acwSeconds,createdAt,owner:state.applicantName||'Agent'});
    state.outboundAttempts.push({id:wrap.contactId,customer:task.customer,campaignId:task.id,outcome:status,createdAt,suppressed:disposition==='opt_out'});
    state.experience+=good?12:6;state.bonus+=good?250:0;state.shiftMinutes+=6;
    pushOperationEvent('campaign',wrap.reference,`Outbound case saved · ${status}`,'saved',{disposition,qa:wrap.qa});
    state.activeOutbound=null;
  }
  state.totalACWSeconds+=acwSeconds;state.acwCount++;
  state.wrapUp=null;
  if(state.shiftActive)setAgentState('available','After-contact work completed');
  levelCheck();syncQueueCount();saveState();
  state.currentView=inbound?'inbound':'outbound';
  toast(`After-contact work saved · ${disposition.replaceAll('_',' ')}`,'success');renderView();
}
function toggleCallHold(){
  const call=state.currentCall;if(!call)return;
  const contact=findQueueContact(call.queueContactId);if(!contact)return;
  if(contact.status==='connected'){
    stopVoiceTools();
    transitionContact(contact,CONTACT_STATUS.ON_HOLD,'Agent placed the customer on hold',Date.now());call.held=true;
    pushOperationEvent('call',contact.id,'Customer placed on hold.','on_hold');
  }else if(contact.status==='on_hold'){
    transitionContact(contact,CONTACT_STATUS.CONNECTED,'Agent resumed the customer conversation',Date.now());call.held=false;
    pushOperationEvent('call',contact.id,'Customer conversation resumed.','connected');
  }
  saveState();renderView();
}
function requestSupervisor(){
  const call=state.currentCall;if(!call)return;
  const contact=findQueueContact(call.queueContactId);if(!contact)return;
  if(state.supervisorRequests.some(item=>item.contactId===contact.id&&item.status==='open')){toast('A supervisor request is already open for this contact.');return;}
  state.supervisorRequests.push({id:makeCallReference('SUP'),contactId:contact.id,reference:contact.id,customer:contact.customer,reason:'Agent assistance requested during an active contact',status:'open',createdAt:new Date().toISOString()});
  pushOperationEvent('supervisor',contact.id,'Agent requested supervisor assistance.','open');saveState();toast('Supervisor assistance requested.','success');renderView();
}
function transferInboundCall(){
  const call=state.currentCall;if(!call)return;
  const contact=findQueueContact(call.queueContactId);if(!contact)return;
  const target=$('#transferTarget')?.value||'Specialist Support';
  if(!['connected','on_hold'].includes(contact.status)){toast('This contact cannot be transferred from its current state.','error');return;}
  transitionContact(contact,CONTACT_STATUS.TRANSFERRED,`Contact transferred to ${target}`,Date.now(),{target});
  call.transferredTo=target;call.held=false;
  pushOperationEvent('transfer',contact.id,`Transferred to ${target}.`,'transferred',{target});
  beginInboundWrapUp(true);
}
function returnCallToQueue(){
  const call=state.currentCall;if(!call)return;
  const contact=findQueueContact(call.queueContactId);if(!contact)return;
  if(['connected','on_hold'].includes(contact.status)){transitionContact(contact,CONTACT_STATUS.QUEUED,'Contact returned to inbound queue',Date.now());contact.queuedAt=new Date().toISOString();}
  state.currentCall=null;stopVoiceTools();if(state.shiftActive)setAgentState('available','Contact returned to queue');syncQueueCount();pushOperationEvent('call',contact.id,'Contact returned to queue without a completed interaction.','queued');saveState();renderView();toast('Contact returned to the inbound queue.');
}
function returnCallbackToQueue(callbackId){
  const callback=state.callbacks.find(item=>item.id===callbackId&&item.status==='scheduled'&&item.type!=='outbound');
  if(!callback){toast('Scheduled callback was not found.','error');return;}
  if(Date.parse(callback.dueAt)>Date.now()){toast('This callback is not due yet. Keep it scheduled until the requested time.','warning');return;}
  const contact=findQueueContact(callback.contactId);
  if(contact&&contact.status===CONTACT_STATUS.CALLBACK){transitionContact(contact,CONTACT_STATUS.QUEUED,'Scheduled callback returned to the inbound queue',Date.now());contact.queuedAt=new Date().toISOString();}
  callback.status='queued';callback.queuedAt=new Date().toISOString();syncQueueCount();pushOperationEvent('callback',callback.id,`Callback for ${callback.customer} moved to queue.`,'queued');saveState();renderView();toast('Callback returned to the inbound queue.','success');
}
function resolveSupervisorRequest(requestId){
  const request=state.supervisorRequests.find(item=>item.id===requestId&&item.status==='open');
  if(!request)return;
  request.status='resolved';request.resolvedAt=new Date().toISOString();
  pushOperationEvent('supervisor',request.reference,'Supervisor request reviewed and closed.','resolved');saveState();renderView();toast('Supervisor request closed.','success');
}
function resumeOutboundCallback(callbackId){
  const callback=state.callbacks.find(item=>item.id===callbackId&&item.type==='outbound'&&item.status==='scheduled');
  if(!callback){toast('Outbound callback was not found.','error');return;}
  if(Date.parse(callback.dueAt)>Date.now()){toast('This callback is not due yet. Keep it scheduled until the requested time.','warning');return;}
  if(!shiftTimeAvailable()||state.agentStatus!=='available'){toast('An active shift within 08:00–17:00 and Available agent status are required for this callback.','warning');return;}
  if(isContactSuppressed(callback.customer,state.outboundSuppressions)){toast('Contact suppression is active; callback is blocked.','error');return;}
  callback.status='in_progress';callback.attemptedAt=new Date().toISOString();
  const attemptId=makeCallReference('OUT-CBK');
  state.activeOutbound={campaignId:callback.campaignId,attemptId,callbackId,stepIndex:0,score:0,feedback:null,feedbackType:'neutral',breach:false,startedAt:Date.now(),suppressionRequested:false,disposition:null};
  setAgentState('busy','Scheduled outbound callback started');
  pushOperationEvent('campaign',attemptId,`Scheduled outbound callback initiated · ${callback.customer}`,'dialling',{callbackId});saveState();state.currentView='outbound';renderView();
}
function cancelOutbound(){
  const active=state.activeOutbound;if(!active)return;
  if(active.callbackId){const callback=state.callbacks.find(item=>item.id===active.callbackId);if(callback)callback.status='scheduled';}
  pushOperationEvent('campaign',active.attemptId,'Outbound simulation attempt ended before wrap-up.','abandoned');
  state.activeOutbound=null;if(state.shiftActive)setAgentState('available','Outbound interaction cancelled');saveState();renderView();toast('Outbound interaction ended; no completion credit was recorded.');
}
function beginOutboundDial(id){
  const task=outboundCampaigns.find(item=>item.id===id);if(!task)return;
  if(isContactSuppressed(task.customer,state.outboundSuppressions)){toast('This contact is suppressed and cannot be dialled by this campaign.','error');return;}
  startOutbound(id);
}
function levelCheck(){const newLevel=1+Math.floor(state.experience/100);if(newLevel>state.level){state.level=newLevel;toast(`Career progression: Level ${state.level} achieved.`,'success');}}
function startOutbound(id){
  const task=outboundCampaigns.find(item=>item.id===id);if(!task)return;
  if(!shiftTimeAvailable()||state.agentStatus!=='available'){toast('An active shift within 08:00–17:00 and Available agent status are required before an outbound contact.','warning');return;}
  if(isContactSuppressed(task.customer,state.outboundSuppressions)){toast('Contact suppression is active. Campaign blocked.','error');return;}
  const attemptId=makeCallReference('OUT');
  state.activeOutbound={campaignId:id,attemptId,stepIndex:0,score:0,feedback:null,feedbackType:'neutral',breach:false,startedAt:Date.now(),suppressionRequested:false,disposition:null};
  setAgentState('busy','Outbound campaign contact started');
  pushOperationEvent('campaign',attemptId,`Outbound dial initiated · ${task.title}`,'dialling',{customer:task.customer});
  saveState();renderView();
}
function applyOutboundChoice(index){
  const active=state.activeOutbound;const task=outboundCampaigns.find(item=>item.id===active?.campaignId);if(!active||!task)return;
  const step=task.script[active.stepIndex];const opt=step?.options[index];if(!opt)return;
  active.score+=opt.score;active.feedback=opt.feedback;active.feedbackType=opt.breach||opt.score<0?'bad':opt.score>0?'good':'neutral';active.breach=active.breach||!!opt.breach;
  if(opt.breach)state.incidents++;
  pushOperationEvent('campaign',active.attemptId,`Agent selected: ${opt.text}`,active.breach?'review':'in_progress',{scoreDelta:opt.score,breach:!!opt.breach,step:step.label});
  if(task.id==='payment-reminder'&&active.stepIndex===2&&index===0)active.suppressionRequested=true;
  if(task.id==='product-offer'&&active.stepIndex===2&&index===0)active.disposition='declined';
  if(task.id==='retention'&&active.stepIndex===2&&index===0)active.disposition='declined';
  saveState();renderView();
}
function completeOutbound(){beginOutboundWrapUp();}

function acceptDigital(contactId) {
  if (!state.shiftActive || !shiftTimeAvailable() || state.agentStatus !== 'available' || state.currentCall || state.activeOutbound || state.wrapUp || state.digitalActiveId) {
    toast('Finish the active task and make sure your agent status is available before accepting a digital contact.', 'warning');
    return;
  }
  try {
    const contact = acceptDigitalContact(state.digitalQueue, contactId, `EMP-${state.nameInitials || 'AGENT'}`);
    state.digitalActiveId = contact.id;
    setAgentState('busy', `${DIGITAL_CHANNELS[contact.channel].label} customer interaction`);
    appendDigitalEvent(state.digitalEvents, { contactId: contact.id, channel: contact.channel, type: 'accepted', message: `Accepted ${contact.channelLabel} contact`, status: 'active' });
    pushOperationEvent('digital', contact.id, `${contact.channelLabel} contact accepted: ${contact.subject}.`, 'active');
    saveState();
    state.currentView = 'digital';
    renderView();
  } catch (error) { toast(error.message, 'error'); }
}

function submitDigitalReply(form) {
  const contact = state.digitalActiveId ? findDigitalContact(state.digitalQueue, state.digitalActiveId) : null;
  if (!contact) { toast('There is no active digital interaction.', 'error'); return; }
  const reply = new FormData(form).get('reply');
  try {
    const result = recordDigitalReply(state.digitalQueue, contact.id, reply, `EMP-${state.nameInitials || 'AGENT'}`);
    appendDigitalEvent(state.digitalEvents, { contactId: contact.id, channel: contact.channel, type: 'reply', message: 'Agent reply recorded in the simulated thread.', status: 'sent' });
    pushOperationEvent('digital', contact.id, `${contact.channelLabel} reply recorded.`, 'sent', { qaScore: result.quality.score });
    saveState(); renderView(); toast(`Reply recorded · practice QA ${result.quality.score}%.`, 'success');
  } catch (error) { toast(error.message, 'warning'); }
}

function finishDigitalContact(form) {
  const contact = state.digitalActiveId ? findDigitalContact(state.digitalQueue, state.digitalActiveId) : null;
  if (!contact) { toast('There is no active digital interaction.', 'error'); return; }
  const values = new FormData(form);
  const disposition = String(values.get('disposition') || '');
  try {
    const completed = completeDigitalContact(state.digitalQueue, contact.id, { disposition, notes: values.get('notes') });
    const statusLabel = disposition === 'resolved' ? 'Resolved' : disposition === 'escalated' ? 'Escalated' : 'Pending customer';
    const reference = `DIG-${contact.id}`;
    state.cases.push({ reference, customer: contact.customer, title: contact.subject, channel: contact.channelLabel, disposition, status: statusLabel, qa: contact.qaScore ?? 0, owner: state.applicantName || 'Agent', notes: completed.notes, createdAt: completed.completedAt, messages: contact.messages.map(message => ({ type: message.type, text: message.text, at: message.at })) });
    state.cases = state.cases.slice(-200);
    appendDigitalEvent(state.digitalEvents, { contactId: contact.id, channel: contact.channel, type: 'disposition', message: `Digital interaction ${disposition.replaceAll('_',' ')}.`, status: disposition });
    pushOperationEvent('digital', contact.id, `${contact.channelLabel} interaction ${disposition.replaceAll('_',' ')}.`, disposition, { qaScore: contact.qaScore });
    state.digitalActiveId = null;
    setAgentState('available', 'Digital interaction completed; ready for next task');
    saveState(); renderView(); toast(`${statusLabel} · CRM case ${reference} created.`, 'success');
  } catch (error) { toast(error.message, 'warning'); }
}

function receiveDigitalFollowUp() {
  const contact = state.digitalActiveId ? findDigitalContact(state.digitalQueue, state.digitalActiveId) : null;
  if (!contact) return;
  try {
    deliverDigitalFollowUp(state.digitalQueue, contact.id);
    appendDigitalEvent(state.digitalEvents, { contactId: contact.id, channel: contact.channel, type: 'customer-follow-up', message: 'Simulated customer follow-up received.', status: 'active' });
    pushOperationEvent('digital', contact.id, `${contact.channelLabel} customer follow-up received.`, 'active');
    saveState(); renderView();
  } catch (error) { toast(error.message, 'warning'); }
}

function handleAction(action,event={}){
  switch(action){
    case 'open-application':openApplication();break;
    case 'begin-assessment':beginAssessment();break;
    case 'assessment-next':{
      const i=state.assessmentIndex;if(state.assessmentAnswers[i]===undefined)return;state.assessmentIndex++;if(state.assessmentIndex>=recruitmentQuestions.length){state.assessmentPhase='practical';state.practicalIndex=0;}renderView();break;
    }
    case 'practical-next':{
      const i=state.practicalIndex;if(state.practicalAnswers[i]===undefined)return;state.practicalIndex++;if(state.practicalIndex>=practicalCallSteps.length)renderAssessmentResult();else renderView();break;
    }
    case 'retake-assessment':state.stage='applicant';beginAssessment();break;
    case 'accept-offer':acceptOffer();break;
    case 'start-shift':startShift();break;
    case 'advance-workday':advanceWorkday();break;
    case 'take-break':takeScheduledBreak();break;
    case 'return-from-break':returnFromBreak();break;
    case 'end-shift':endShift();break;
    case 'start-voice-recording':startVoiceRecording();break;
    case 'stop-voice-recording':stopVoiceRecording();break;
    case 'start-voice-transcription':startVoiceTranscription();break;
    case 'stop-voice-transcription':stopVoiceTranscription();break;
    case 'play-customer-prompt':speakCustomerPrompt(event.text||'');break;
    case 'clear-voice-practice':clearVoicePractice();break;
    case 'refresh-queue':{const items=createInboundQueue(inboundScenarios,6,{sequence:state.queueSequence});state.inboundQueueItems.push(...items);state.queueSequence+=items.length;syncQueueCount();pushOperationEvent('queue','INBOUND','Six simulated contacts arrived in the queue.','queued');saveState();renderView();toast('Six new simulated contacts added.','success');break;}
    case 'toggle-call-hold':toggleCallHold();break;
    case 'request-supervisor':requestSupervisor();break;
    case 'transfer-call':transferInboundCall();break;
    case 'return-call-to-queue':returnCallToQueue();break;
    case 'save-wrap-up':saveWrapUp();break;
    case 'return-callback-to-queue':returnCallbackToQueue(event.callbackId);break;
    case 'resume-outbound-callback':resumeOutboundCallback(event.callbackId);break;
    case 'resolve-supervisor':resolveSupervisorRequest(event.requestId);break;
    case 'open-inbound':state.currentView='inbound';renderView();break;
    case 'open-outbound':state.currentView='outbound';renderView();break;
    case 'open-digital':state.currentView='digital';renderView();break;
    case 'accept-digital':acceptDigital(event.contactId);break;
    case 'deliver-digital-followup':receiveDigitalFollowUp();break;
    case 'refresh-digital-queue':{if(state.digitalActiveId||state.agentStatus!=='available'){toast('Complete the current interaction before loading another batch.','warning');break;}const items=createDigitalQueue(DIGITAL_SCENARIOS,6,{sequence:state.digitalSequence,slaMinutesOverride:getActiveOrganization(state.organizationWorkspace)?.policy?.digitalResponseTargetMinutes});state.digitalQueue.push(...items);state.digitalSequence+=items.length;appendDigitalEvent(state.digitalEvents,{type:'queue-refresh',message:'Six synthetic digital contacts added.',status:'queued'});saveState();renderView();toast('Six simulated digital contacts added.','success');break;}
    case 'open-crm':state.currentView='crm';renderView();break;
    case 'open-knowledge':state.currentView='knowledge';state.viewedArticle=null;renderView();break;
    case 'answer-call':startInboundCall();break;
    case 'next-call-step':if(state.currentCall?.held)return;state.currentCall.stepIndex++;state.currentCall.feedback=null;addCallTimeline(state.currentCall,'Agent progressed to the next call-handling step.');saveState();renderView();break;
    case 'complete-call':beginInboundWrapUp(false);break;
    case 'end-call':returnCallToQueue();break;
    case 'next-outbound-step':state.activeOutbound.stepIndex++;state.activeOutbound.feedback=null;renderView();break;
    case 'complete-outbound-step':completeOutbound();break;
    case 'end-outbound':cancelOutbound();break;
    case 'attend-briefing': {
      const briefing=briefingFor(simulationDateNow());
      if(!briefing){toast('No briefing is currently in its attendance window.','warning');break;}
      recordBriefingAttendance(state.briefingAttendance,briefing,`EMP-${state.nameInitials}`);
      pushOperationEvent('briefing',briefing.id,`${briefing.title} attended and acknowledged.`);
      saveState();renderView();toast('Briefing attendance recorded.','success');break;
    }
    case 'toggle-org-member': { const org=getActiveOrganization(state.organizationWorkspace); if(!org)break; try{setOrganizationMemberStatus(org,event.memberId,event.nextStatus);saveState();renderView();toast('Staff status updated.','success');}catch(error){toast(error.message,'error');} break;}
    case 'launch-system': {
      const system=SYSTEMS.find(x=>x.id===event.system);
      if(!system)break;
      const reference=`SIM-${system.id.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      createSystemEvent(state.systemEvents,system.id,'Opened synthetic workflow',reference);
      pushOperationEvent('system',reference,`${system.name} simulation opened.`);
      saveState();renderView();toast(`${system.name} sandbox opened. No live data accessed.`,'success');break;
    }
    case 'reset-simulation':{const modal=openModal('<div class="subtle-label">LOCAL SAVE RESET</div><h3>Reset this simulation?</h3><p>This removes the candidate, employment and local performance data stored in this browser. It does not affect any online account because this prototype has no server-side save system.</p><div class="modal-actions"><button class="btn outline" data-close>Cancel</button><button class="btn danger" id="confirmReset">Reset simulation</button></div>');$('[data-close]',modal).onclick=()=>modal.remove();$('#confirmReset',modal).onclick=()=>{localStorage.removeItem(STORAGE_KEY);location.reload();};break;}
    case 'back-knowledge':state.viewedArticle=null;renderView();break;
  }
}

document.addEventListener('click',e=>{
  const template=e.target.closest('[data-digital-template]');if(template){const field=$('#digitalReplyForm textarea[name="reply"]');if(field){const channel=state.digitalActiveId?findDigitalContact(state.digitalQueue,state.digitalActiveId)?.channel:'email';const selected=digitalReplyTemplates(channel).find(item=>item[0]===template.dataset.digitalTemplate);if(selected){field.value=selected[1];field.focus();}}return;}
  const nav=e.target.closest('.nav-item[data-view]');if(nav){if(nav.disabled){toast('Complete recruitment and accept an offer to unlock agent operations.');return;}if(nav.dataset.view!=='inbound'&&voiceStatus!=='inactive')stopVoiceTools();state.currentView=nav.dataset.view;renderView();return;}
  const action=e.target.closest('[data-action]');if(action){handleAction(action.dataset.action,{callbackId:action.dataset.callbackId,requestId:action.dataset.requestId,system:action.dataset.system,text:action.dataset.text,contactId:action.dataset.contactId,memberId:action.dataset.memberId,nextStatus:action.dataset.nextStatus});return;}
  const answer=e.target.closest('[data-answer]');
if(answer){const i=state.assessmentIndex;state.assessmentAnswers[i]=Number(answer.dataset.answer);renderView();return;}
  const practicalAnswer=e.target.closest('[data-practical-answer]');if(practicalAnswer){state.practicalAnswers[state.practicalIndex]=Number(practicalAnswer.dataset.practicalAnswer);renderView();return;}
  const callChoice=e.target.closest('[data-call-choice]');if(callChoice){applyCallChoice(Number(callChoice.dataset.callChoice));return;}
  const outChoice=e.target.closest('[data-outbound-choice]');if(outChoice){applyOutboundChoice(Number(outChoice.dataset.outboundChoice));return;}
  const campaign=e.target.closest('[data-start-campaign]');if(campaign){beginOutboundDial(campaign.dataset.startCampaign);return;}
  const article=e.target.closest('[data-article]');if(article){state.viewedArticle=article.dataset.article;renderView();return;}
});


document.addEventListener('change',e=>{
  if(e.target?.id==='departmentSelect'){state.workforceDepartment=e.target.value;saveState();renderView();}
  if(e.target?.id==='digitalChannelFilter'){state.digitalChannelFilter=e.target.value;saveState();renderView();}
  if(e.target?.id==='activeOrganizationSelect'){if(state.organizationWorkspace.organizations.some(org=>org.id===e.target.value)){state.organizationWorkspace.activeOrganizationId=e.target.value;saveState();renderView();}}
});
document.addEventListener('submit',e=>{
  if(e.target.id==='digitalReplyForm'){e.preventDefault();submitDigitalReply(e.target);}
  if(e.target.id==='digitalCloseForm'){e.preventDefault();finishDigitalContact(e.target);}
  if(e.target.id==='orgCreateForm'){e.preventDefault();const form=e.target;try{const org=createOrganization({name:form.elements.name.value,industry:form.elements.industry.value});state.organizationWorkspace.organizations.push(org);state.organizationWorkspace.activeOrganizationId=org.id;saveState();renderView();toast('Local organisation workspace created.','success');}catch(error){toast(error.message,'error');}}
  if(e.target.id==='orgMemberForm'){e.preventDefault();const form=e.target;const org=getActiveOrganization(state.organizationWorkspace);try{createOrganizationMember(org,{name:form.elements.name.value,email:form.elements.email.value,role:form.elements.role.value,department:form.elements.department.value});saveState();renderView();toast('Simulated staff invitation added. No email was sent.','success');}catch(error){toast(error.message,'error');}}
  if(e.target.id==='orgPolicyForm'){e.preventDefault();const form=e.target;const org=getActiveOrganization(state.organizationWorkspace);try{updateOrganizationPolicy(org,Object.fromEntries(new FormData(form).entries()));saveState();renderView();toast('Organisation policy saved locally.','success');}catch(error){toast(error.message,'error');}}
  if(e.target.id==='promotionExamForm'){
    e.preventDefault();
    const digitalMetricSet=digitalQueueMetrics(state.digitalQueue||[]);const completedDigital=digitalMetricSet.resolved+digitalMetricSet.escalated;const qaCount=state.qaCount+(digitalMetricSet.averageQA===null?0:(state.digitalQueue||[]).filter(x=>Number.isFinite(x.qaScore)).length);const metrics={kpi:Math.min(100,Math.round((state.callsHandled+state.outboundCalls+completedDigital)*5)),qa:qaCount?Math.round(((state.totalQA)+(digitalMetricSet.averageQA||0)*(qaCount-state.qaCount))/qaCount):75,csat:state.csatCount?Math.round(state.totalCSAT/state.csatCount):75,knowledge:Math.min(100,70+state.experience),compliance:state.incidents?Math.max(0,100-state.incidents*12):95,leadership:Math.min(100,60+Math.floor(state.level*5))};
    try{const item=recordPromotionExam(state.promotionAttempts,{metrics,minimumScore:getActiveOrganization(state.organizationWorkspace)?.policy?.promotionThreshold ?? 75,examScore:Number(new FormData(e.target).get('examScore'))});pushOperationEvent('promotion',item.id,`Annual promotion examination ${item.status}.`);saveState();renderView();toast(`Examination ${item.status.replace('_',' ')}.`,'success');}catch(err){toast(err.message,'warning');}
  }
  if(e.target.id==='crossSellForm'){
    e.preventDefault();const f=new FormData(e.target);
    const item=recordCrossSell(state.crossSellRecords,{customerId:f.get('customerId'),product:f.get('product'),relevant:f.has('relevant'),eligible:f.has('eligible'),consent:f.has('consent')});
    pushOperationEvent('cross-sell',item.id,`Recommendation recorded: ${item.outcome}.`);saveState();renderView();toast('Cross-selling outcome recorded.','success');
  }
  if(e.target.id==='commendationForm'){
    e.preventDefault();const f=new FormData(e.target);
    const item=recordCommendation(state.commendations,{customerId:f.get('customerId'),message:f.get('message')});
    pushOperationEvent('commendation',item.id,'Customer commendation referred through official channels.');saveState();renderView();toast('Commendation logged for official review.','success');
  }
  if(e.target.id==='coachingForm'){
    e.preventDefault();const f=new FormData(e.target);
    try{const item=createCoachingRecord(state.coachingSessions,{coach:f.get('coach'),topic:f.get('topic'),feedback:f.get('feedback'),actionPlan:f.get('actionPlan'),score:f.get('score'),followUpDate:f.get('followUpDate')||null});pushOperationEvent('coaching',item.id,`Coaching recorded: ${item.topic}.`);saveState();renderView();toast('Coaching session recorded.','success');}catch(err){toast(err.message,'error');}
  }
  if(e.target.id==='voiceFallbackForm'){
    e.preventDefault();const textValue=new FormData(e.target).get('utterance');
    if(!String(textValue||'').trim()){toast('Enter the practice response first.','warning');return;}
    voiceTranscript=sanitizeTranscript(String(textValue));
    toast('Text fallback captured in temporary practice memory.','success');renderView();
  }
});

document.addEventListener('change',e=>{if(e.target?.id==='voiceConsent'){voiceConsent=!!e.target.checked;if(!voiceConsent&&voiceStatus!=='inactive')stopVoiceTools();renderView();}});
window.addEventListener('pagehide',()=>{stopVoiceTools();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&voiceStatus!=='inactive')stopVoiceTools();});

function initClock(){const savedTick=Number(state.simulationClockSeconds);simulationClockTicker=Number.isFinite(savedTick)?Math.max(0,Math.min(86399,savedTick)):7*3600;lastShiftSaveBucket=Math.floor((Number(state.shiftElapsedMinutes)||0)/15);setInterval(()=>{simulationClockTicker=(simulationClockTicker+30)%86400;state.simulationClockSeconds=simulationClockTicker;const h=String(Math.floor(simulationClockTicker/3600)).padStart(2,'0'),m=String(Math.floor((simulationClockTicker%3600)/60)).padStart(2,'0'),s=String(simulationClockTicker%60).padStart(2,'0');$('#shiftClock').textContent=`${h}:${m}:${s}`;if(state.shiftActive&&state.shiftRecord?.status==='active'){state.shiftElapsedMinutes=Math.min(540,state.shiftElapsedMinutes+.5);const bucket=Math.floor(state.shiftElapsedMinutes/15);if(bucket!==lastShiftSaveBucket){lastShiftSaveBucket=bucket;saveState();}}else if(Math.floor(simulationClockTicker/30)%30===0)saveState();},1000);}

// Production-style 3D workplace. The scene is isolated from business logic so it can
// evolve independently without disturbing recruitment, calls, CRM or career records.
async function initWorld(){
  const host=$('#worldCanvas');
  try{
    const module=await import('./production-world.js');
    productionWorld=await module.initProductionWorld(THREE,host,{
      onAssetsReady:result=>{
        const label=result.loaded?`${result.loaded} 3D STAFF ASSETS READY`:'LOCAL STAFF MODELS ACTIVE';
        const status=$('#assetStatus');if(status)status.textContent=label;
      },
      onImmersiveChange:active=>{
        $('#immersiveHud')?.classList.toggle('hidden',!active);
        $('#stationPanel')?.classList.add('hidden');
        if(active){
          $('#headerStatus').textContent='LIVE WORKPLACE · FLOOR 04';
          $('#enterFloorButton')?.classList.add('hidden');
        }else{
          $('#headerStatus').textContent=state.hired?'EMPLOYEE WORKSPACE':'RECRUITMENT PORTAL';
          $('#enterFloorButton')?.classList.remove('hidden');
        }
      },
      onNearestStation:station=>{
        const hint=$('#stationHint');
        if(!hint)return;
        if(station){
          const touch=window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints>0;
          hint.classList.remove('hidden');
          hint.innerHTML=`<span class="prompt-key">${touch?'USE':'E'}</span><span>Access <strong>${escapeHTML(station.label)}</strong></span>`;
        } else hint.classList.add('hidden');
      },
      onStation:station=>open3dStationPanel(station),
      onPointerUnlock:()=>{
        const note=$('#mouseLookNote');
        if(note&&productionWorld?.immersive)note.classList.remove('hidden');
      }
    });
    productionWorld.setAgentActivity?.(state.agentStatus||'offline');
    const enterButton=$('#enterFloorButton');if(enterButton)enterButton.disabled=false;
  }catch(error){
    console.error('CALLORIA world initialisation failed:',error);
    host.innerHTML='<div class="world-fallback">The 3D environment could not be initialised. Check WebGL 2 support and reload the game assets.</div>';
  }
}

function open3dStationPanel(station){
  const panel=$('#stationPanel');
  if(!panel)return;
  const id=String(station.id).padStart(2,'0');
  if(!state.hired){
    panel.innerHTML=`<div class="station-panel-top"><div><span class="panel-kicker">EMPLOYEE ACCESS CONTROL</span><h3>Station ${id} is secured</h3></div><button type="button" class="station-close" data-station-close aria-label="Close">×</button></div><p>Contact-centre operations unlock after the recruitment assessment is passed and the employment offer is accepted.</p><div class="station-panel-actions"><button class="station-action primary" type="button" data-station-action="recruitment">Continue recruitment</button><button class="station-action" type="button" data-station-close>Return to floor</button></div>`;
  }else{
    panel.innerHTML=`<div class="station-panel-top"><div><span class="panel-kicker">AGENT WORKSTATION · STATION ${id}</span><h3>Choose an operation</h3></div><button type="button" class="station-close" data-station-close aria-label="Close">×</button></div><p>Open a simulated service application. Your actions are recorded in this browser's local employment profile.</p><div class="station-grid"><button class="station-action primary" type="button" data-station-action="inbound"><span>↙</span><b>Inbound desk</b><small>Receive and resolve customer calls</small></button><button class="station-action" type="button" data-station-action="outbound"><span>↗</span><b>Outbound campaigns</b><small>Make authorised customer calls</small></button><button class="station-action" type="button" data-station-action="digital"><span>✉</span><b>Digital support</b><small>Email, live chat and social</small></button><button class="station-action" type="button" data-station-action="crm"><span>▤</span><b>CRM & cases</b><small>Review customer records and cases</small></button><button class="station-action" type="button" data-station-action="queue"><span>☷</span><b>Queue management</b><small>Priorities, wait times and callbacks</small></button><button class="station-action" type="button" data-station-action="supervisor"><span>⌂</span><b>Supervisor desk</b><small>Assistance requests and escalations</small></button><button class="station-action" type="button" data-station-action="knowledge"><span>◈</span><b>Knowledge base</b><small>Consult approved service guidance</small></button></div>`;
  }
  panel.classList.remove('hidden');
}

function close3dStationPanel(){ $('#stationPanel')?.classList.add('hidden'); }
function enter3dFloor(){ if(productionWorld){$('#mouseLookNote')?.classList.add('hidden');productionWorld.enter();} }
function exit3dFloor(){ close3dStationPanel();productionWorld?.exit(); }
function open3dWorkView(view){
  close3dStationPanel();
  if(view==='recruitment'){
    exit3dFloor();state.currentView='overview';renderView();document.querySelector('.content-wrap')?.scrollIntoView({behavior:'smooth',block:'start'});return;
  }
  if(!state.hired){toast('Complete recruitment and accept an employment offer before handling customer interactions.','warning');return;}
  if((view==='inbound'||view==='outbound'||view==='digital')&&!state.shiftActive)startShift();
  state.currentView=view;
  saveState();
  exit3dFloor();
  renderView();
  document.querySelector('.content-wrap')?.scrollIntoView({behavior:'smooth',block:'start'});
}

$('#enterFloorButton')?.addEventListener('click',enter3dFloor);
$('#exitFloorButton')?.addEventListener('click',exit3dFloor);
$('#mouseLookNote')?.addEventListener('click',()=>{try{document.querySelector('#worldCanvas canvas')?.requestPointerLock?.();$('#mouseLookNote').classList.add('hidden');}catch{}});
document.addEventListener('click',event=>{
  const close=event.target.closest('[data-station-close]');if(close){close3dStationPanel();return;}
  const action=event.target.closest('[data-station-action]');if(action){open3dWorkView(action.dataset.stationAction);return;}
});

initClock();renderView();
import('three').then(module=>{THREE=module;initWorld();}).catch(error=>{console.warn('Three.js could not be loaded; keeping the operational interface available.',error);$('#worldCanvas').innerHTML='<div class="world-fallback">3D preview could not load. The operational workspace remains available.</div>';});
