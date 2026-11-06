let THREE = null;

const STORAGE_KEY = 'floorshift3d.save.v1';
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
  viewedArticle: null
});

let state = loadState();
let selectedAnswer = null;
let threeWorld = null;
let productionWorld = null;

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...initialState(), ...JSON.parse(stored) } : initialState();
  } catch {
    return initialState();
  }
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage may be disabled */ }
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
        <section class="panel"><div class="panel-head"><div><h3>Available work</h3><p>Choose the next operational activity.</p></div></div><div class="case-item"><div class="case-symbol">↙</div><div class="case-copy"><strong>Inbound customer queue</strong><small>${state.callQueue} simulated contacts waiting</small></div><button class="btn small secondary" data-action="open-inbound">Open</button></div><div class="case-item"><div class="case-symbol">↗</div><div class="case-copy"><strong>Outbound campaign desk</strong><small>Customer onboarding, retention and payment reminders</small></div><button class="btn small secondary" data-action="open-outbound">Open</button></div><div class="case-item"><div class="case-symbol">▤</div><div class="case-copy"><strong>Open CRM cases</strong><small>${state.cases.length} records in your case history</small></div><button class="btn small secondary" data-action="open-crm">Open</button></div></section>
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

function renderInbound() {
  if (!state.shiftActive) {
    viewRoot.innerHTML = `<div class="panel empty-state"><div class="empty-icon">◷</div><h3>Your shift has not started</h3><p>Start your workday before answering customer contacts. This keeps shift activity and performance records consistent.</p><button class="btn primary" data-action="start-shift">Start shift</button></div>`; return;
  }
  if (!state.currentCall) {
    viewRoot.innerHTML = `<div class="grid two"><section class="panel"><div class="panel-head"><div><h3>Inbound contact queue</h3><p>Simulated calls routed to ${escapeHTML(state.department)}.</p></div><span class="pill green"><span class="live-dot"></span> QUEUE OPEN</span></div><div class="metric-value" style="font-size:31px">${state.callQueue}</div><div class="metric-foot">Contacts waiting in this simulation</div><div class="article-box"><h4>Queue handling</h4><p>Answer the next customer, complete authentication, investigate the request and record the actual outcome. Scenarios are simulated and do not connect to real customer accounts.</p></div><button class="btn primary" style="margin-top:13px" data-action="answer-call" ${state.callQueue===0?'disabled':''}>Answer next call ↙</button></section><section class="panel"><div class="panel-head"><div><h3>Recently handled</h3><p>Your latest customer interactions.</p></div><button class="btn small outline" data-action="open-crm">View CRM</button></div>${state.cases.length?state.cases.slice(-4).reverse().map(caseRow).join(''):'<div class="empty-state"><p>No calls logged during this shift yet.</p></div>'}</section></div>`; return;
  }
  const call = state.currentCall;
  const scenario = inboundScenarios.find(x=>x.id===call.scenarioId);
  const step = scenario.steps[call.stepIndex];
  viewRoot.innerHTML = `<div class="call-layout"><section class="panel call-console"><div class="call-console-head"><div><strong>INBOUND VOICE CONTACT</strong><small>Connected · ${escapeHTML(scenario.category)} · Ref ${scenario.reference}</small></div><span class="pill green">CALL ACTIVE</span></div><div class="call-console-body"><div class="customer-strip"><div class="customer-avatar">${scenario.initials}</div><div class="customer-info"><strong>${scenario.customer}</strong><small>${scenario.profile}</small></div><div class="customer-tags"><span class="pill">${scenario.tag}</span><span class="pill amber">${scenario.amount}</span></div></div><div class="subtle-label">CUSTOMER STATEMENT</div><p class="call-prompt">“${scenario.opening}”</p><p class="call-context">${call.stepIndex===0?'The customer has just connected. Begin with the correct service procedure.':'Continue the interaction based on the case information and previous action.'}</p><div class="panel-head" style="margin:16px 0 11px"><div><div class="question-kicker">STEP ${call.stepIndex+1} OF ${scenario.steps.length} · ${step.label}</div><h3 class="call-prompt" style="margin-top:8px">${step.prompt}</h3><p class="call-context" style="margin:5px 0 0">${step.context}</p></div></div><div class="call-options">${step.options.map((opt,j)=>`<button class="call-option" data-call-choice="${j}" ${call.feedback?'disabled':''}><span>${String.fromCharCode(65+j)}</span><span>${opt.text}</span></button>`).join('')}</div>${call.feedback?`<div class="call-feedback ${call.feedbackType}">${escapeHTML(call.feedback)}</div><div class="assessment-footer"><small>${call.feedbackType==='bad'?'A quality or compliance deduction may apply.':'Decision recorded. Continue the interaction.'}</small><button class="btn primary" data-action="${call.stepIndex===scenario.steps.length-1?'complete-call':'next-call-step'}">${call.stepIndex===scenario.steps.length-1?'Complete & log case':'Continue →'}</button></div>`:''}</div></section><aside class="call-side-stack"><section class="panel"><div class="panel-head"><div><h3>Customer record</h3><p>Simulated CRM profile.</p></div><span class="pill">CRM</span></div><div class="data-list"><div class="data-row"><span>Customer</span><strong>${scenario.customer}</strong></div><div class="data-row"><span>Case reference</span><strong>${scenario.reference}</strong></div><div class="data-row"><span>Reported issue</span><strong>${scenario.issue}</strong></div><div class="data-row"><span>Location</span><strong>${scenario.location}</strong></div><div class="data-row"><span>Amount / value</span><strong>${scenario.amount}</strong></div><div class="data-row"><span>Case status</span><strong>${call.feedback?'In progress':'New contact'}</strong></div></div></section><section class="panel"><div class="panel-head"><div><h3>Interaction controls</h3><p>Agent workstation tools.</p></div></div><div class="case-item"><div class="case-symbol">▤</div><div class="case-copy"><strong>CRM case record</strong><small>Auto-created when interaction closes</small></div></div><div class="case-item"><div class="case-symbol">◈</div><div class="case-copy"><strong>Knowledge base</strong><small>Approved guidance and procedures</small></div><button class="btn small outline" data-action="open-knowledge">Open</button></div><button class="btn outline" style="width:100%;margin-top:12px" data-action="end-call">End interaction</button></section></aside></div>`;
}
function renderOutbound() {
  if (!state.shiftActive) { viewRoot.innerHTML = `<div class="panel empty-state"><div class="empty-icon">◷</div><h3>Start your shift first</h3><p>Outbound campaigns are available during an active simulated shift.</p><button class="btn primary" data-action="start-shift">Start shift</button></div>`; return; }
  if (state.activeOutbound) {
    const task = outboundCampaigns.find(x=>x.id===state.activeOutbound.campaignId);
    const step = task.script[state.activeOutbound.stepIndex];
    viewRoot.innerHTML = `<div class="call-layout"><section class="panel call-console"><div class="call-console-head"><div><strong>OUTBOUND CAMPAIGN CONTACT</strong><small>${escapeHTML(task.type)} · ${escapeHTML(task.title)}</small></div><span class="pill green">SIMULATED DIAL</span></div><div class="call-console-body"><div class="customer-strip"><div class="customer-avatar">${task.initials}</div><div class="customer-info"><strong>${task.customer}</strong><small>Campaign contact · ${task.type}</small></div><span class="pill">OUTBOUND</span></div><div class="subtle-label">CAMPAIGN OBJECTIVE</div><p class="call-prompt">${task.objective}</p><p class="call-context">${task.context}</p><div class="question-kicker">STEP ${state.activeOutbound.stepIndex+1} OF ${task.script.length} · ${step.label}</div><h3 class="call-prompt" style="margin:9px 0 14px">${step.prompt}</h3><div class="call-options">${step.options.map((opt,j)=>`<button class="call-option" data-outbound-choice="${j}" ${state.activeOutbound.feedback?'disabled':''}><span>${String.fromCharCode(65+j)}</span><span>${opt.text}</span></button>`).join('')}</div>${state.activeOutbound.feedback?`<div class="call-feedback ${state.activeOutbound.feedbackType}">${escapeHTML(state.activeOutbound.feedback)}</div><div class="assessment-footer"><small>Record the actual result of this campaign interaction.</small><button class="btn primary" data-action="${state.activeOutbound.stepIndex===task.script.length-1?'complete-outbound-step':'next-outbound-step'}">${state.activeOutbound.stepIndex===task.script.length-1?'Finish contact':'Continue →'}</button></div>`:''}</div></section><aside class="call-side-stack"><section class="panel"><div class="panel-head"><div><h3>Campaign record</h3><p>Authorised simulated contact.</p></div></div><div class="data-list"><div class="data-row"><span>Campaign</span><strong>${task.title}</strong></div><div class="data-row"><span>Contact</span><strong>${task.customer}</strong></div><div class="data-row"><span>Purpose</span><strong>${task.type}</strong></div><div class="data-row"><span>Objective</span><strong>${task.objective}</strong></div></div></section><section class="panel"><div class="panel-head"><div><h3>Contact compliance</h3></div><span class="pill amber">REQUIRED</span></div><p class="muted-note">Identify yourself honestly, observe the approved contact rules, respect refusal and opt-out preferences, and record the true outcome. No real calls are placed.</p><button class="btn outline" style="width:100%" data-action="end-outbound">End contact</button></section></aside></div>`; return;
  }
  viewRoot.innerHTML = `<div class="panel"><div class="panel-head"><div><h3>Outbound campaign desk</h3><p>Choose an assigned contact activity. Each campaign has a different customer objective.</p></div><span class="pill green">${state.outboundDone.length} COMPLETED</span></div><div class="grid three">${outboundCampaigns.map(c=>`<div class="panel" style="padding:15px;background:#fbfcfd"><div class="subtle-label">${c.type}</div><h3 style="font:700 13px Manrope;margin:9px 0 6px">${c.title}</h3><p class="muted-note">${c.context}</p><div class="data-row"><span>Contact</span><strong>${c.customer}</strong></div><button class="btn primary" style="width:100%;margin-top:12px" data-start-campaign="${c.id}" ${state.outboundDone.includes(c.id)?'disabled':''}>${state.outboundDone.includes(c.id)?'Completed':'Start simulated call →'}</button></div>`).join('')}</div><p class="muted-note" style="margin-top:14px">Campaign lists are fictional. Real-world outbound contact requires verified consent, lawful contact basis and organisation-approved suppression controls.</p></div>`;
}
function caseRow(c) { return `<div class="case-item"><div class="case-symbol">${c.channel==='Outbound'?'↗':'↙'}</div><div class="case-copy"><strong>${escapeHTML(c.title)}</strong><small>${escapeHTML(c.customer)} · ${escapeHTML(c.reference)}</small></div><span class="pill ${c.status==='Resolved'?'green':'amber'}">${escapeHTML(c.status)}</span></div>`; }
function renderCRM() {
  viewRoot.innerHTML = `<div class="panel"><div class="panel-head"><div><h3>CRM & case management</h3><p>All completed simulated customer interactions are recorded here.</p></div><span class="pill">${state.cases.length} TOTAL RECORDS</span></div>${state.cases.length?`<div class="table-wrap"><table><thead><tr><th>Case reference</th><th>Customer</th><th>Channel</th><th>Issue / campaign</th><th>Outcome</th><th>Quality</th></tr></thead><tbody>${state.cases.slice().reverse().map(c=>`<tr><td><strong>${escapeHTML(c.reference)}</strong></td><td>${escapeHTML(c.customer)}</td><td>${c.channel}</td><td>${escapeHTML(c.title)}</td><td><span class="status-dot"></span>${escapeHTML(c.status)}</td><td>${c.qa}%</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state"><div class="empty-icon">▤</div><h3>No cases recorded yet</h3><p>Complete an inbound or outbound interaction and its case record will appear here.</p><button class="btn secondary" data-action="open-inbound">Go to inbound desk</button></div>'}</div>`;
}
function renderKnowledge() {
  if (state.viewedArticle) {
    const a = knowledgeArticles.find(x=>x.id===state.viewedArticle);
    if (a) { viewRoot.innerHTML = `<div class="panel"><button class="btn small outline" data-action="back-knowledge">← All articles</button><div class="subtle-label" style="margin-top:18px">${a.category}</div><h3 style="font:800 19px Manrope;margin:7px 0">${a.title}</h3><p class="muted-note">${a.summary}</p><div class="article-box">${a.body}</div><p class="muted-note" style="margin-top:14px">Prototype reference material only. Organisation-specific policies, systems and mandatory requirements must be supplied and approved by the relevant organisation.</p></div>`; return; }
  }
  viewRoot.innerHTML = `<div class="panel"><div class="panel-head"><div><h3>Agent knowledge base</h3><p>Quick-reference material for day-to-day contact-centre operations.</p></div><span class="pill green">REFERENCE DESK</span></div><div class="kb-grid">${knowledgeArticles.map(a=>`<div class="kb-card" data-article="${a.id}"><div class="kb-icon">${a.icon}</div><div class="subtle-label">${a.category}</div><strong style="margin-top:6px">${a.title}</strong><small>${a.summary}</small></div>`).join('')}</div></div>`;
}
function renderPerformance() {
  const qa = average(state.totalQA,state.qaCount,0), csat=average(state.totalCSAT,state.csatCount,0), aht=average(state.totalHandleMinutes,state.callsHandled,0);
  const fcr = state.callsHandled ? Math.round(state.resolutions/state.callsHandled*100) : 0;
  const conversion = state.outboundCalls ? Math.round(state.sales/state.outboundCalls*100) : 0;
  viewRoot.innerHTML = `<div class="grid three">${metricCard('AVERAGE QA',qa?Math.round(qa)+'%':'—','Simulated call-quality score','⌁')}${metricCard('FIRST CONTACT RESOLUTION',state.callsHandled?fcr+'%':'—','Completed inbound contacts','✓')}${metricCard('CUSTOMER SATISFACTION',csat?csat.toFixed(1)+'/5':'—','Post-contact simulation rating','☆')}${metricCard('AVERAGE HANDLE TIME',aht?aht.toFixed(1)+' min':'—','Simulated inbound handling time','◷')}${metricCard('OUTBOUND CONVERSION',state.outboundCalls?conversion+'%':'—','Campaign interactions completed','↗')}${metricCard('SECURITY INCIDENTS',state.incidents,'Critical simulation errors','◇')}</div><div class="grid two" style="margin-top:14px"><section class="panel"><div class="panel-head"><div><h3>Performance dimensions</h3><p>Prototype metrics. Real organisations can configure targets and weighting.</p></div></div>${[['Quality assurance',qa],['First-contact resolution',fcr],['Customer satisfaction',csat?csat*20:0],['Outbound conversion',conversion]].map(([l,v])=>`<div style="margin:15px 0"><div class="data-row"><span>${l}</span><strong>${v?Math.round(v)+'%':'Pending'}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,Math.max(0,v))}%"></div></div></div>`).join('')}</section><section class="panel"><div class="panel-head"><div><h3>Performance rules</h3><p>How the simulator treats quality.</p></div></div><div class="article-box"><h4>Quality before speed</h4><p>Fast handling does not compensate for a security breach, an inaccurate record or a false resolution. Critical failures reduce the quality score and may trigger a formal review.</p></div><div class="article-box"><h4>Role-specific targets</h4><p>Sales, banking support, technical support and complaints roles require different targets. This prototype uses one baseline scorecard; production targets must be configurable by role and institution.</p></div></section></div>`;
}
function renderCareer() {
  const progress=Math.min(100,state.experience%100);
  viewRoot.innerHTML = `<div class="career-banner"><div class="career-avatar">${state.nameInitials}</div><div class="career-copy"><div class="subtle-label" style="color:#9be8dc">EMPLOYEE PROFILE · MERIDIAN SERVICE GROUP</div><h3>${escapeHTML(state.applicantName)}</h3><p>${escapeHTML(state.roleTitle)} · ${escapeHTML(state.department)}</p></div><div class="career-level"><strong>LVL ${state.level}</strong><small>CAREER GRADE</small></div></div><div class="grid two" style="margin-top:14px"><section class="panel"><div class="panel-head"><div><h3>Career progression</h3><p>Progress is earned through experience and reliable performance.</p></div><span class="pill green">LEVEL ${state.level}</span></div><div class="data-row"><span>Experience points</span><strong>${state.experience} XP</strong></div><div class="bar-track" style="margin:9px 0 14px"><div class="bar-fill" style="width:${progress}%"></div></div><p class="muted-note">${100-progress} XP to the next career level. Complete interactions accurately and maintain professional standards.</p><div class="step-list" style="margin-top:14px">${[['Contact Centre Agent','Entry appointment'],['Senior Contact Centre Agent','Consistent service performance'],['Subject Matter Expert','Advanced product and system capability'],['Team Leader','Coaching and queue management'],['Supervisor','Operational oversight'],['Operations Manager','Department-level responsibility']].map((r,i)=>`<div class="step-row ${i<state.level?'done':i===state.level?'active':''}"><div class="step-number">${i<state.level?'✓':i+1}</div><div class="step-copy"><strong>${r[0]}</strong><small>${r[1]}</small></div><span class="step-state">${i<state.level?'UNLOCKED':i===state.level?'NEXT':'FUTURE'}</span></div>`).join('')}</div></section><section class="panel"><div class="panel-head"><div><h3>Employment summary</h3><p>Simulated employee information.</p></div></div><div class="data-list"><div class="data-row"><span>Employment status</span><strong>Active</strong></div><div class="data-row"><span>Department</span><strong>${escapeHTML(state.department)}</strong></div><div class="data-row"><span>Monthly base salary</span><strong>${money(state.salary)}</strong></div><div class="data-row"><span>Performance bonus</span><strong>${money(state.bonus)}</strong></div><div class="data-row"><span>Days simulated</span><strong>${state.day}</strong></div><div class="data-row"><span>Inbound calls</span><strong>${state.callsHandled}</strong></div><div class="data-row"><span>Outbound contacts</span><strong>${state.outboundCalls}</strong></div></div><p class="muted-note" style="margin-top:14px">Salary and bonuses are fictional gameplay values. They are not a real employment offer or market salary benchmark.</p><button class="btn outline small" data-action="reset-simulation">Reset local simulation data</button></section></div>`;
}

function renderView() {
  setHeader();
  const config = {
    overview:['CAREER ENTRY',state.hired?'Your shift overview':state.stage==='assessment'?'Recruitment assessment':state.stage==='offer'?'Employment offer':'Start your application',state.hired?'Your daily operations, performance and available work.':'Complete recruitment before starting agent operations.'],
    inbound:['CUSTOMER OPERATIONS','Inbound desk','Answer, investigate and resolve incoming customer contacts.'],
    outbound:['CUSTOMER OPERATIONS','Outbound campaigns','Work authorised simulated campaigns and record true outcomes.'],
    crm:['WORKSTATION','CRM & cases','Review accurate records of completed simulated interactions.'],
    knowledge:['AGENT RESOURCES','Knowledge base','Reference the principles and procedures relevant to your role.'],
    performance:['PERFORMANCE INTELLIGENCE','Performance dashboard','Review quality, resolution and service performance.'],
    career:['CAREER MANAGEMENT','Career profile','Track employment details, experience and progression.']
  };
  const [eyebrow,title,desc] = config[state.currentView] || config.overview;
  $('#pageEyebrow').textContent = eyebrow; $('#pageTitle').textContent = title; $('#pageDescription').textContent = desc;
  $('#pageActions').innerHTML = state.hired && state.currentView!=='overview' ? `<span class="pill ${state.shiftActive?'green':'amber'}">${state.shiftActive?'SHIFT ACTIVE':'OFF SHIFT'}</span>` : '';
  switch(state.currentView){
    case 'overview': renderOverview(); break;
    case 'inbound': renderInbound(); break;
    case 'outbound': renderOutbound(); break;
    case 'crm': renderCRM(); break;
    case 'knowledge': renderKnowledge(); break;
    case 'performance': renderPerformance(); break;
    case 'career': renderCareer(); break;
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
function acceptOffer(){state.stage='employee';state.hired=true;state.shiftActive=false;state.level=1;state.experience=0;state.currentView='overview';saveState();toast('Employment accepted. Welcome to the operations floor.','success');renderView();}
function startShift(){state.shiftActive=true;state.shiftMinutes=0;state.day=state.day||1;state.currentView='overview';toast('Shift started. Customer operations are open.','success');renderView();}
function startInboundCall(){
  if(state.callQueue<=0){toast('No more queued contacts. Complete an outbound task or finish the shift.');return;}
  const available=inboundScenarios.filter(s=>!state.lastScenario || s.id!==state.lastScenario);
  const scenario=available[Math.floor(Math.random()*available.length)]||inboundScenarios[0];
  state.lastScenario=scenario.id;state.currentCall={scenarioId:scenario.id,stepIndex:0,score:0,feedback:null,feedbackType:'neutral',breach:false,startedAt:Date.now()};
  renderView();
}
function applyCallChoice(index){
  const call=state.currentCall;const scenario=inboundScenarios.find(s=>s.id===call.scenarioId);const option=scenario.steps[call.stepIndex].options[index];if(!option)return;
  call.score+=option.score;call.feedback=option.feedback;call.feedbackType=option.breach||option.score<0?'bad':option.score>0?'good':'neutral';call.breach=call.breach||!!option.breach;
  if(option.breach)state.incidents++;
  saveState();renderView();
}
function completeInbound(){
  const call=state.currentCall;const scenario=inboundScenarios.find(s=>s.id===call.scenarioId);const qa=Math.max(0,Math.min(100,Math.round(70+call.score*5-(call.breach?35:0))));
  const resolved=call.score>=4&&!call.breach;const status=resolved?'Resolved':'Escalation / review required';
  state.callsHandled++;state.callQueue=Math.max(0,state.callQueue-1);state.totalQA+=qa;state.qaCount++;state.totalCSAT+=resolved?4.6:call.score>=0?3.4:2.2;state.csatCount++;state.totalHandleMinutes+=4.5+Math.random()*3.2;if(resolved)state.resolutions++;
  const record={reference:scenario.reference,customer:scenario.customer,title:scenario.issue,channel:'Inbound',status,qa,createdAt:new Date().toISOString()};state.cases.push(record);state.experience+=resolved?14:7;state.bonus+=resolved?350:0;state.shiftMinutes+=7;state.currentCall=null;levelCheck();state.currentView='inbound';saveState();toast(`Interaction logged · ${status} · QA ${qa}%`,resolved?'success':'info');renderView();
}
function levelCheck(){const newLevel=1+Math.floor(state.experience/100);if(newLevel>state.level){state.level=newLevel;toast(`Career progression: Level ${state.level} achieved.`,'success');}}
function startOutbound(id){state.activeOutbound={campaignId:id,stepIndex:0,score:0,feedback:null,feedbackType:'neutral',breach:false,startedAt:Date.now()};renderView();}
function applyOutboundChoice(index){const active=state.activeOutbound;const task=outboundCampaigns.find(x=>x.id===active.campaignId);const opt=task.script[active.stepIndex].options[index];if(!opt)return;active.score+=opt.score;active.feedback=opt.feedback;active.feedbackType=opt.breach||opt.score<0?'bad':opt.score>0?'good':'neutral';active.breach=active.breach||!!opt.breach;if(opt.breach)state.incidents++;saveState();renderView();}
function completeOutbound(){
  const active=state.activeOutbound;const task=outboundCampaigns.find(x=>x.id===active.campaignId);const qa=Math.max(0,Math.min(100,Math.round(70+active.score*5-(active.breach?35:0))));const good=active.score>=4&&!active.breach;
  state.outboundCalls++;state.totalQA+=qa;state.qaCount++;state.totalCSAT+=good?4.5:active.score>=0?3.3:2.1;state.csatCount++;if(good&&task.id==='product-offer')state.sales++;state.outboundDone.push(task.id);state.cases.push({reference:'OUT-'+Math.floor(100000+Math.random()*899999),customer:task.customer,title:task.title,channel:'Outbound',status:good?'Completed':'Review required',qa,createdAt:new Date().toISOString()});state.experience+=good?12:6;state.bonus+=good?250:0;state.shiftMinutes+=6;state.activeOutbound=null;levelCheck();state.currentView='outbound';saveState();toast(`Outbound contact recorded · QA ${qa}%`,good?'success':'info');renderView();
}

function handleAction(action){
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
    case 'open-inbound':state.currentView='inbound';renderView();break;
    case 'open-outbound':state.currentView='outbound';renderView();break;
    case 'open-crm':state.currentView='crm';renderView();break;
    case 'open-knowledge':state.currentView='knowledge';state.viewedArticle=null;renderView();break;
    case 'answer-call':startInboundCall();break;
    case 'next-call-step':state.currentCall.stepIndex++;state.currentCall.feedback=null;renderView();break;
    case 'complete-call':completeInbound();break;
    case 'end-call':state.currentCall=null;renderView();toast('Interaction ended. No case was completed.');break;
    case 'next-outbound-step':state.activeOutbound.stepIndex++;state.activeOutbound.feedback=null;renderView();break;
    case 'complete-outbound-step':completeOutbound();break;
    case 'end-outbound':state.activeOutbound=null;renderView();toast('Outbound simulation ended.');break;
    case 'reset-simulation':{const modal=openModal('<div class="subtle-label">LOCAL SAVE RESET</div><h3>Reset this simulation?</h3><p>This removes the candidate, employment and local performance data stored in this browser. It does not affect any online account because this prototype has no server-side save system.</p><div class="modal-actions"><button class="btn outline" data-close>Cancel</button><button class="btn danger" id="confirmReset">Reset simulation</button></div>');$('[data-close]',modal).onclick=()=>modal.remove();$('#confirmReset',modal).onclick=()=>{localStorage.removeItem(STORAGE_KEY);location.reload();};break;}
    case 'back-knowledge':state.viewedArticle=null;renderView();break;
  }
}

document.addEventListener('click',e=>{
  const nav=e.target.closest('.nav-item[data-view]');if(nav){if(nav.disabled){toast('Complete recruitment and accept an offer to unlock agent operations.');return;}state.currentView=nav.dataset.view;renderView();return;}
  const action=e.target.closest('[data-action]');if(action){handleAction(action.dataset.action);return;}
  const answer=e.target.closest('[data-answer]');if(answer){const i=state.assessmentIndex;state.assessmentAnswers[i]=Number(answer.dataset.answer);renderView();return;}
  const practicalAnswer=e.target.closest('[data-practical-answer]');if(practicalAnswer){state.practicalAnswers[state.practicalIndex]=Number(practicalAnswer.dataset.practicalAnswer);renderView();return;}
  const callChoice=e.target.closest('[data-call-choice]');if(callChoice){applyCallChoice(Number(callChoice.dataset.callChoice));return;}
  const outChoice=e.target.closest('[data-outbound-choice]');if(outChoice){applyOutboundChoice(Number(outChoice.dataset.outboundChoice));return;}
  const campaign=e.target.closest('[data-start-campaign]');if(campaign){startOutbound(campaign.dataset.startCampaign);return;}
  const article=e.target.closest('[data-article]');if(article){state.viewedArticle=article.dataset.article;renderView();return;}
});

function initClock(){let tick=8*3600;setInterval(()=>{tick=(tick+1)%86400;const h=String(Math.floor(tick/3600)).padStart(2,'0'),m=String(Math.floor((tick%3600)/60)).padStart(2,'0'),s=String(tick%60).padStart(2,'0');$('#shiftClock').textContent=`${h}:${m}:${s}`;},1000);}

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
        if(station){hint.classList.remove('hidden');hint.innerHTML=`<span class="prompt-key">E</span><span>Access <strong>${escapeHTML(station.label)}</strong></span>`;}
        else hint.classList.add('hidden');
      },
      onStation:station=>open3dStationPanel(station),
      onPointerUnlock:()=>{
        const note=$('#mouseLookNote');
        if(note&&productionWorld?.immersive)note.classList.remove('hidden');
      }
    });
    const enterButton=$('#enterFloorButton');if(enterButton)enterButton.disabled=false;
  }catch(error){
    console.error('FLOORSHIFT 3D world initialisation failed:',error);
    host.innerHTML='<div class="world-fallback">The 3D environment could not be initialised. Check WebGL 2 and the Three.js CDN connection.</div>';
  }
}

function open3dStationPanel(station){
  const panel=$('#stationPanel');
  if(!panel)return;
  const id=String(station.id).padStart(2,'0');
  if(!state.hired){
    panel.innerHTML=`<div class="station-panel-top"><div><span class="panel-kicker">EMPLOYEE ACCESS CONTROL</span><h3>Station ${id} is secured</h3></div><button type="button" class="station-close" data-station-close aria-label="Close">×</button></div><p>Contact-centre operations unlock after the recruitment assessment is passed and the employment offer is accepted.</p><div class="station-panel-actions"><button class="station-action primary" type="button" data-station-action="recruitment">Continue recruitment</button><button class="station-action" type="button" data-station-close>Return to floor</button></div>`;
  }else{
    panel.innerHTML=`<div class="station-panel-top"><div><span class="panel-kicker">AGENT WORKSTATION · STATION ${id}</span><h3>Choose an operation</h3></div><button type="button" class="station-close" data-station-close aria-label="Close">×</button></div><p>Open a simulated service application. Your actions are recorded in this browser's local employment profile.</p><div class="station-grid"><button class="station-action primary" type="button" data-station-action="inbound"><span>↙</span><b>Inbound desk</b><small>Receive and resolve customer calls</small></button><button class="station-action" type="button" data-station-action="outbound"><span>↗</span><b>Outbound campaigns</b><small>Make authorised customer calls</small></button><button class="station-action" type="button" data-station-action="crm"><span>▤</span><b>CRM & cases</b><small>Review customer records and cases</small></button><button class="station-action" type="button" data-station-action="knowledge"><span>◈</span><b>Knowledge base</b><small>Consult approved service guidance</small></button></div>`;
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
  if((view==='inbound'||view==='outbound')&&!state.shiftActive){state.shiftActive=true;state.shiftMinutes=0;state.day=state.day||1;}
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
