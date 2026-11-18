import {
  CONTACT_STATUS, createInboundQueue, sortQueuedContacts, nextQueuedContact,
  transitionContact, addInteractionEvent, countQueuedContacts, queueMetrics,
  addSuppression, isContactSuppressed, scheduleCallback, completeActiveCallback
} from './operations-engine.js';
import {
  createLiveQueueState, normalizeLiveQueueState, stampInboundQueue,
  advanceLiveQueue, liveQueueSnapshot, addManualDemandSurge
} from './live-queue-engine.js';
import {
  createSupervisorQueueControl, normalizeSupervisorQueueControl, updateSupervisorQueueControl,
  triageInboundContact, triageDigitalContact, supervisorQueueBoard,
  SUPERVISOR_INTAKE_MODES, SUPERVISOR_PRIORITIES, SUPERVISOR_ROUTE_GROUPS
} from './supervisor-queue-engine.js';
import { DEPARTMENTS, SYSTEMS, briefingFor, recordBriefingAttendance, promotionEligibility, recordPromotionExam, recordCrossSell, recordCommendation, createSystemEvent } from './workforce-engine.js';
import { AGENT_STATES, createShiftRecord, recordAgentState, calculateShiftAdherence, expectedShiftMode, nextScheduledBreak, closeShift, createCoachingRecord } from './shift-engine.js';
import { speechRecognitionAvailable, mediaRecordingAvailable, createVoiceSession, appendVoiceTranscript, finishVoiceSession, sanitizeTranscript } from './voice-engine.js';
import { DIGITAL_CHANNELS, DIGITAL_STATUS, DIGITAL_SCENARIOS, createDigitalQueue, sortDigitalQueue, findDigitalContact, acceptDigitalContact, recordDigitalReply, deliverDigitalFollowUp, completeDigitalContact, digitalQueueMetrics, appendDigitalEvent } from './multichannel-engine.js';
import { createDigitalLiveQueueState, normalizeDigitalLiveQueueState, advanceDigitalLiveQueue, digitalLiveQueueSnapshot, setDigitalQueueDemandMultiplier } from './digital-live-queue-engine.js';
import { agentWorkloadSnapshot, assignedDigitalWorkItems, canAcceptDigitalContact, canResumeDigitalFollowUp } from './agent-workload-engine.js';
import { assessDigitalSla, digitalSlaDisplay, advanceDigitalSlaMonitor, digitalSlaMetrics } from './digital-sla-engine.js';
import { ensureDigitalCustomerBehaviour, evaluateDigitalCustomerReaction, deliverAdaptiveDigitalCustomerResponse, digitalCustomerBehaviourSnapshot, digitalCustomerBehaviourMetrics } from './digital-customer-behaviour-engine.js';
import { VOICE_CUSTOMER_BEHAVIOUR_POLICY, ensureVoiceCustomerBehaviour, evaluateVoiceCustomerTurn, evaluateVoiceAgentUtterance, resolveVoiceCustomerDecision, voiceCustomerBehaviourSnapshot, voiceCustomerOutcome, sanitizeVoiceCustomerText } from './voice-customer-behaviour-engine.js';
import { createOutboundConversation, submitOutboundTurn, outboundConversationSummary } from './outbound-campaign-engine.js';
import { CAMPAIGN_OPERATIONS_VERSION, RETRY_DELAYS_MS, createCampaignWorklist, normalizeCampaignWorklist, findCampaignContact, campaignContactEligibility, startCampaignContact, resolveDialAttempt, finishCampaignContact, campaignWorklistMetrics, campaignContactStatusLabel } from './campaign-operations-engine.js';
import { createCustomerContinuityState, normalizeCustomerContinuityState, recordCustomerInteraction, getCustomerContinuityContext, customerContinuityMetrics } from './customer-continuity-engine.js';
import { ORGANIZATION_ROLES, DEFAULT_ORG_POLICY, ensureOrganizationWorkspace, createOrganization, createOrganizationMember, setOrganizationMemberStatus, updateOrganizationPolicy, getActiveOrganization, getOrganizationSnapshot } from './organization-engine.js';
import { initializeCloudPlatform, getCloudPlatformState, getCloudSupabaseClient, canCloudRole, createCloudOrganization, createCloudInvitation, updateCloudPolicy, setCloudMemberStatus, selectCloudOrganization } from './cloud-platform.js';
import { validateCloudPolicy } from './cloud-security.js';
import { CUSTOMER_PERSONAS, CUSTOMER_ISSUES, createCustomerScenario, submitCustomerTurn, finalizeCustomerScenario, customerIntelligenceMetrics } from './customer-intelligence-engine.js';
import { DEFAULT_QA_SCORECARD, createScorecard, createHumanQAReview, createQADispute, resolveQADispute, createCalibrationSession, humanQAMetrics } from './qa-workspace-engine.js';
import { AI_MODEL_OPTIONS, loadTenantAIAssistSettings, saveTenantAIAssistSettings, requestAIAssist } from './ai-assist-engine.js';
import { startPublicGameServices, refreshPublicGameStats } from './game-platform.js';
import { configureCloudEmploymentSync, markCloudEmploymentSyncReady, loadCloudEmploymentSnapshot, scheduleCloudEmploymentSave, flushCloudEmploymentSave } from './cloud-employment-sync.js';
import { normalizeCaseLifecycle, caseReopenEligibility, reopenCase, caseFollowUpRisk, startCaseFollowUp, completeCaseFollowUp, reviewCaseFollowUp, caseFollowUpMetrics, formatCaseClock } from './case-lifecycle-engine.js';
import { normalizeSupervisorRequests, assessSupervisorEscalation, claimSupervisorEscalation, reassignSupervisorEscalation, resolveSupervisorEscalation, closeLinkedSupervisorEscalation, supervisorEscalationMetrics } from './supervisor-escalation-engine.js';

let THREE = null;

const STORAGE_KEY = 'calloria.save.v1';
let activeStorageKey = STORAGE_KEY;
let cloudScopedSave = false;
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
  supervisorQueueControl: createSupervisorQueueControl(),
  supervisorQueueAudit: [],
  interactionTimeline: [],
  outboundSuppressions: [],
  outboundAttempts: [],
  outboundWorklist: [],
  wrapUp: null,
  totalWaitSeconds: 0,
  acceptedContacts: 0,
  contactsWithinSla: 0,
  totalACWSeconds: 0,
  acwCount: 0,
  outboundDone: [],
  cases: [],
  crmSelectedCaseReference: '',
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
  shiftRecord: null, shiftElapsedMinutes: 0, shiftSimulationEpochMs: null, liveQueueSimulation: null, agentStatus: 'offline', shiftHistory: [], coachingSessions: [], simulationClockSeconds: 7 * 3600, lastShiftDay: 0,
  briefingAttendance: [], promotionAttempts: [], crossSellRecords: [], commendations: [], systemEvents: [], digitalQueue: [], digitalSequence: 0, digitalLiveQueueSimulation: null, digitalActiveId: null, digitalActiveIds: [], digitalChannelFilter: 'all', digitalEvents: [], customerLabSession: null, customerQaHistory: [], qaScorecards: [], humanQaReviews: [], qaDisputes: [], qaCalibrations: [], aiQaSuggestions: [], qaSelectedInteractionId: '', qaSelectedScorecardId: '', organizationWorkspace: null, customerContinuity: createCustomerContinuityState(), customerCommitments: globalThis.CalloriaCommitmentEngine?.createState?.() || { version: '6.9.0', commitments: [], activity: [] }
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
let aiSettingsOrgId = '';
let aiSettingsLoading = false;
let aiSettingsLoaded = false;
let aiSettingsError = '';
let aiTenantSettings = null;
let aiAssistBusy = false;
let selectedCommitmentId = '';
const CommitmentEngine = globalThis.CalloriaCommitmentEngine;
const PromiseControlEngine = globalThis.CalloriaPromiseControlEngine;

function loadState() {
  try {
    const stored = localStorage.getItem(activeStorageKey) || (!cloudScopedSave ? localStorage.getItem(LEGACY_STORAGE_KEY) : null);
    if (!stored) return initialState();
    const parsed = JSON.parse(stored);
    const migrated = { ...initialState(), ...parsed };
    migrated.customerContinuity = normalizeCustomerContinuityState(migrated.customerContinuity);
    migrated.customerCommitments = globalThis.CalloriaCommitmentEngine?.normaliseState?.(migrated.customerCommitments) || { version: '6.9.0', commitments: [], activity: [] };
    migrated.cases = Array.isArray(migrated.cases) ? migrated.cases.map(row => { try { return normalizeCaseLifecycle(row); } catch (_) { return row; } }) : [];
    if (typeof migrated.crmSelectedCaseReference !== 'string') migrated.crmSelectedCaseReference = '';
    for (const key of ['inboundQueueItems','callbacks','supervisorRequests','interactionTimeline','outboundSuppressions','outboundAttempts','outboundWorklist','cases','outboundDone','briefingAttendance','promotionAttempts','crossSellRecords','commendations','systemEvents','shiftHistory','coachingSessions','digitalQueue','digitalEvents','customerQaHistory','qaScorecards','humanQaReviews','qaDisputes','qaCalibrations','aiQaSuggestions','supervisorQueueAudit']) { if (!Array.isArray(migrated[key])) migrated[key] = []; }
    migrated.supervisorRequests = normalizeSupervisorRequests(migrated.supervisorRequests);
    if (!Number.isFinite(migrated.callQueue)) migrated.callQueue = 6;
    migrated.supervisorQueueControl = normalizeSupervisorQueueControl(migrated.supervisorQueueControl);
    if (migrated.shiftActive && (!migrated.shiftRecord || migrated.shiftRecord.status !== 'active')) migrated.shiftRecord = createShiftRecord({ day: migrated.day || 1 });
    if (!Number.isFinite(migrated.shiftElapsedMinutes)) migrated.shiftElapsedMinutes = 0;
    if (migrated.shiftActive) {
      if (!Number.isFinite(migrated.shiftSimulationEpochMs)) migrated.shiftSimulationEpochMs = Date.now() - migrated.shiftElapsedMinutes * 60_000;
      migrated.liveQueueSimulation = normalizeLiveQueueState(migrated.liveQueueSimulation, {
        day: migrated.day || 1,
        elapsedMinute: migrated.shiftElapsedMinutes,
        seed: migrated.queueSequence || 1
      });
      migrated.liveQueueSimulation.paused = migrated.supervisorQueueControl.paused;
      migrated.liveQueueSimulation.arrivalIntervalMultiplier = SUPERVISOR_INTAKE_MODES[migrated.supervisorQueueControl.mode].multiplier;
    } else if (migrated.liveQueueSimulation && typeof migrated.liveQueueSimulation === 'object') {
      migrated.liveQueueSimulation = { ...migrated.liveQueueSimulation, active: false };
    }
    if (!Number.isFinite(migrated.lastShiftDay)) migrated.lastShiftDay = 0;
    if (!Number.isFinite(migrated.digitalSequence)) migrated.digitalSequence = 0;
    if (migrated.shiftActive) {
      migrated.digitalLiveQueueSimulation = normalizeDigitalLiveQueueState(migrated.digitalLiveQueueSimulation, { day: migrated.day || 1, elapsedMinute: migrated.shiftElapsedMinutes, seed: migrated.digitalSequence + (migrated.day || 1) * 31 });
      const mode = SUPERVISOR_INTAKE_MODES[migrated.supervisorQueueControl.mode] || SUPERVISOR_INTAKE_MODES.normal;
      migrated.digitalLiveQueueSimulation = setDigitalQueueDemandMultiplier(migrated.digitalLiveQueueSimulation, mode.multiplier);
    } else if (migrated.digitalLiveQueueSimulation && typeof migrated.digitalLiveQueueSimulation === 'object') {
      migrated.digitalLiveQueueSimulation = { ...migrated.digitalLiveQueueSimulation, active: false };
    }
    if (!migrated.qaScorecards.length) migrated.qaScorecards = [JSON.parse(JSON.stringify(DEFAULT_QA_SCORECARD))];
    if (!migrated.qaSelectedScorecardId) migrated.qaSelectedScorecardId = migrated.qaScorecards.find(item => item.active !== false)?.id || DEFAULT_QA_SCORECARD.id;
    if (!['all', ...Object.keys(DIGITAL_CHANNELS)].includes(migrated.digitalChannelFilter)) migrated.digitalChannelFilter = 'all';
    // Rebuild the multi-contact worklist from existing assigned queue records.
    // This migrates v6.58-v6.61 saves without discarding the legacy selected ID.
    const migratedAgentId = `EMP-${migrated.nameInitials || 'AGENT'}`;
    const migratedAssignments = assignedDigitalWorkItems(migrated.digitalQueue, migratedAgentId);
    const migratedIds = migratedAssignments.map(item => item.id);
    if (Array.isArray(migrated.digitalActiveIds)) {
      migrated.digitalActiveIds = [...new Set(migrated.digitalActiveIds.filter(id => migratedIds.includes(id)))];
      for (const id of migratedIds) if (!migrated.digitalActiveIds.includes(id)) migrated.digitalActiveIds.push(id);
    } else {
      migrated.digitalActiveIds = migratedIds;
    }
    if (!migrated.digitalActiveId || !migratedIds.includes(migrated.digitalActiveId)) migrated.digitalActiveId = migratedIds[0] || null;
    if (!AGENT_STATES.includes(migrated.agentStatus)) migrated.agentStatus = migrated.shiftActive ? 'available' : 'offline';
    if (!localStorage.getItem(activeStorageKey)) localStorage.setItem(activeStorageKey, JSON.stringify(migrated));
    return migrated;
  } catch {
    return initialState();
  }
}
function saveState() {
  try { localStorage.setItem(activeStorageKey, JSON.stringify(state)); } catch { /* storage may be disabled */ }
  scheduleCloudEmploymentSave(state);
}
function syncQueueCount() {
  state.callQueue = countQueuedContacts(state.inboundQueueItems);
  $('#inboundCount').textContent = state.callQueue;
  const commitmentCount = CommitmentEngine ? CommitmentEngine.listForAgent(state.customerCommitments, { name: state.applicantName }, commitmentShiftSnapshot()).length : 0;
  const commitmentBadge = $('#commitmentCount');
  if (commitmentBadge) commitmentBadge.textContent = commitmentCount;
}
function queueSimulationNowMs() {
  const epoch = Number(state.shiftSimulationEpochMs);
  if (state.shiftActive && Number.isFinite(epoch)) return epoch + Math.max(0, Number(state.shiftElapsedMinutes) || 0) * 60_000;
  return Date.now();
}
function currentLiveQueueSnapshot() {
  if (!state.liveQueueSimulation) return { arrivals: 0, openingContacts: 0, manualContacts: 0, totalArrivals: 0, abandoned: 0, overflowed: 0, nextArrivalInMinutes: null, active: false, paused: false, arrivalIntervalMultiplier: 1 };
  return liveQueueSnapshot(state.liveQueueSimulation, state.shiftElapsedMinutes);
}
function pushOperationEvent(type, reference, message, status = 'recorded', details = {}) {
  return addInteractionEvent(state.interactionTimeline, { type, reference, message, status, details });
}

function recordCustomerContinuityFromCase(record, identity = {}) {
  if (!record || typeof record !== 'object') return;
  state.customerContinuity = recordCustomerInteraction(state.customerContinuity, {
    customer: record.customer,
    customerRef: identity.customerRef || record.customerRef || record.customerReference,
    channel: record.continuityChannel || record.channel || 'unknown',
    direction: String(record.channel || '').toLowerCase() === 'outbound' ? 'outbound' : 'inbound',
    interactionId: record.reference || record.contactId || `${record.customer}:${record.createdAt}`,
    reference: record.reference || record.contactId,
    caseReference: record.reference || record.contactId,
    title: record.title || 'Customer interaction',
    status: record.status || 'Recorded',
    disposition: record.disposition || '',
    occurredAt: record.createdAt || new Date().toISOString(),
    qa: record.qa,
    sentiment: Number.isFinite(Number(record.customerSentiment)) ? Number(record.customerSentiment) * (Number(record.customerSentiment) <= 5 ? 20 : 1) : null
  });
}

function renderCustomerContinuityPanel(customer, channel, identity = {}) {
  const context = getCustomerContinuityContext(state.customerContinuity, { customer, customerRef: identity.customerRef || identity.customerId });
  const metrics = customerContinuityMetrics(state.customerContinuity);
  const last = context.lastInteraction;
  const matchLabel = context.matchBasis === 'reference' ? 'Shared synthetic customer reference' : 'Synthetic display-name match';
  const history = context.interactions.map(item => `<div class="data-row"><span>${escapeHTML(item.title)}<small>${escapeHTML(item.channel.replaceAll('_', ' '))} · ${new Date(item.occurredAt).toLocaleString()}</small></span><strong>${escapeHTML(item.status)}</strong></div>`).join('');
  const openCases = context.openCases.slice(0, 3).map(item => `<div class="data-row"><span>${escapeHTML(item.caseReference || item.reference || 'Open follow-up')}<small>${escapeHTML(item.title)}</small></span><strong>${escapeHTML(item.status)}</strong></div>`).join('');
  return `<section class="panel customer-continuity-panel"><div class="panel-head"><div><h3>Customer 360 continuity</h3><p>Previous contacts across voice, email, live chat and social.</p></div><span class="pill ${context.repeatCustomer ? 'amber' : 'green'}">${context.repeatCustomer ? 'RETURNING CUSTOMER' : context.found ? 'PREVIOUS CONTACT' : 'FIRST RECORDED CONTACT'}</span></div><div class="data-list"><div class="data-row"><span>Recorded interactions</span><strong>${context.profile?.totalInteractions || 0}</strong></div><div class="data-row"><span>Previous channels</span><strong>${context.previousChannels.length ? context.previousChannels.map(item => escapeHTML(item.replaceAll('_', ' '))).join(', ') : 'None recorded'}</strong></div><div class="data-row"><span>Open follow-ups</span><strong>${context.openCases.length}</strong></div><div class="data-row"><span>Last contact</span><strong>${last ? new Date(last.occurredAt).toLocaleString() : 'No history'}</strong></div></div>${openCases ? `<h4 style="margin:14px 0 7px">Outstanding customer work</h4>${openCases}` : ''}${history ? `<h4 style="margin:14px 0 7px">Recent interaction history</h4>${history}` : '<p class="muted-note">No earlier customer interaction is recorded in this local simulation.</p>'}<p class="muted-note">Match basis: ${escapeHTML(matchLabel)}. This is synthetic game history, not real-world identity verification. Current channel: ${escapeHTML(String(channel || 'unknown').replaceAll('_', ' '))}. Registry: ${metrics.customers} customers · ${metrics.crossChannelCustomers} with cross-channel history.</p></section>`;
}
function ensureInboundQueue(count = 6) {
  if (!Array.isArray(state.inboundQueueItems)) state.inboundQueueItems = [];
  if (state.shiftActive && !state.liveQueueSimulation) {
    state.liveQueueSimulation = createLiveQueueState({ day: state.day || 1, elapsedMinute: state.shiftElapsedMinutes, seed: state.queueSequence + 1 });
  }
  const queueCanSeed = state.shiftActive && state.liveQueueSimulation?.active !== false;
  const waiting = countQueuedContacts(state.inboundQueueItems);
  if (queueCanSeed && waiting === 0 && state.inboundQueueItems.length === 0) {
    const requested = state.callQueue > 0 ? Math.min(30, state.callQueue) : count;
    if (requested > 0) {
      const now = queueSimulationNowMs();
      const items = createInboundQueue(inboundScenarios, requested, { sequence: state.queueSequence, now });
      stampInboundQueue(items, { now, elapsedMinute: state.shiftElapsedMinutes, source: 'opening_queue' });
      state.inboundQueueItems.push(...items);
      state.queueSequence += items.length;
      if (state.liveQueueSimulation) state.liveQueueSimulation.openingContacts += items.length;
    }
  }
  syncQueueCount();
}
function findQueueContact(contactId) {
  return state.inboundQueueItems.find(item => item.id === contactId) || null;
}
function addCallTimeline(call, event, details = {}) {
  const contact = call?.queueContactId ? findQueueContact(call.queueContactId) : null;
  if (contact) { contact.timeline = Array.isArray(contact.timeline) ? contact.timeline : []; contact.timeline.push({ at: new Date(queueSimulationNowMs()).toISOString(), event, status: contact.status, ...details }); }
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
  const commitmentCount = CommitmentEngine ? CommitmentEngine.listForAgent(state.customerCommitments, { name: state.applicantName }, commitmentShiftSnapshot()).length : 0;
  const commitmentBadge = $('#commitmentCount');
  if (commitmentBadge) commitmentBadge.textContent = commitmentCount;
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
  const decisionPending = !!call?.voiceBehaviour?.pendingDecision;
  const turnLimitReached = (Number(call?.voiceBehaviour?.turns) || 0) >= VOICE_CUSTOMER_BEHAVIOUR_POLICY.maxAgentTurns;
  const supportedRecord = mediaRecordingAvailable();
  const supportedSpeech = speechRecognitionAvailable();
  return `<section class="voice-practice-panel voice-live-response">
    <div class="panel-head"><div><h3>Live voice conversation</h3><p>Speak, transcribe or type what you would say. The simulated customer reacts to your words, ownership and next step.</p></div><span class="pill ${busy?'amber':voiceStatus==='ready'?'green':''}">${voiceStatus.toUpperCase()}</span></div>
    <button class="btn small outline" type="button" data-action="play-customer-prompt" data-text="${escapeHTML(customerPrompt)}">Play latest customer statement</button>
    <label class="voice-consent"><input type="checkbox" id="voiceConsent" ${voiceConsent?'checked':''}> I consent to microphone use. Browser speech recognition may be processed by the browser's speech service. CALLORIA does not upload the recording or transcript to a telephone provider.</label>
    <div class="button-row">
      <button class="btn primary" type="button" data-action="start-voice-recording" ${decisionPending||turnLimitReached||!voiceConsent||!supportedRecord||busy||call?.held?'disabled':''}>Record local audio sample</button>
      <button class="btn outline" type="button" data-action="stop-voice-recording" ${!recording?'disabled':''}>Stop recording</button>
      ${supportedSpeech?`<button class="btn secondary" type="button" data-action="start-voice-transcription" ${decisionPending||turnLimitReached||!voiceConsent||busy||call?.held?'disabled':''}>Start speech-to-text</button><button class="btn outline" type="button" data-action="stop-voice-transcription" ${!transcribing?'disabled':''}>Stop transcription</button>`:''}
    </div>
    ${voiceAudioUrl?`<audio class="voice-audio-player" controls preload="none" src="${voiceAudioUrl}">Your browser cannot play this recording.</audio>`:''}
    <div class="form-field"><label for="voiceTranscriptText">TEMPORARY SPEECH TRANSCRIPT</label><div class="voice-transcript" id="voiceTranscriptText">${escapeHTML(voiceTranscript||'No speech captured yet.')}</div></div>
    <form id="voiceFallbackForm" class="form-stack"><label class="form-field" for="voiceReplyText">YOUR RESPONSE TO THE CUSTOMER<textarea id="voiceReplyText" name="utterance" rows="3" maxlength="1200" ${decisionPending||turnLimitReached||call?.held?'disabled':''} placeholder="Acknowledge the concern, take ownership, explain the secure process and agree the next step…">${escapeHTML(voiceTranscript)}</textarea></label><button class="btn primary" type="submit" ${busy||decisionPending||turnLimitReached||call?.held?'disabled':''}>Send response to customer</button></form>
    ${turnLimitReached?'<div class="customer-supervisor-warning"><strong>Conversation turn limit reached.</strong><small>Complete after-contact work or request supervisor support before another contact is accepted.</small></div>':''}
    <div class="voice-privacy-note">Only the sanitised response is added to the simulated interaction record. Recording remains in page memory and is discarded when cleared or when the page closes. Never request a password, PIN, one-time code or full payment-card detail.</div>
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
        const replyField=$('#voiceReplyText');if(replyField)replyField.value=voiceTranscript;
        const transcriptNode=$('#voiceTranscriptText');if(transcriptNode)transcriptNode.textContent=voiceTranscript;
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
    const queueNow = queueSimulationNowMs();
    const queue=sortQueuedContacts(state.inboundQueueItems, queueNow);
    const metrics=queueMetrics(state.inboundQueueItems, queueNow);
    const liveQueue = currentLiveQueueSnapshot();
    const nextArrivalLabel = liveQueue.paused ? 'Paused' : liveQueue.nextArrivalInMinutes === null ? 'Stopped' : `${Math.ceil(liveQueue.nextArrivalInMinutes)} simulated min`;
    const callbackRows=state.callbacks.filter(item=>item.status==='scheduled'&&item.type!=='outbound').slice().sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt));
    viewRoot.innerHTML = `<div class="ops-summary-grid">${metricCard('WAITING CONTACTS',metrics.waiting,'Prioritised inbound queue','↙')}${metricCard('LONGEST WAIT',formatWait(metrics.longestWaitSeconds),'Current oldest queued contact','◷')}${metricCard('WITHIN 60-SECOND TARGET',metrics.waiting?Math.round(metrics.withinServiceLevel/metrics.waiting*100)+'%':'—','Queue snapshot, not a contractual SLA','⌁')}${metricCard('CUSTOMERS ABANDONED',liveQueue.abandoned,'Exceeded simulated patience','↗')}</div><div class="panel" style="margin-top:14px;padding:12px 16px"><div class="data-list"><div class="data-row"><span>Automatic arrivals this shift</span><strong>${liveQueue.arrivals}</strong></div><div class="data-row"><span>Opening queue contacts</span><strong>${liveQueue.openingContacts}</strong></div><div class="data-row"><span>Manual surge contacts</span><strong>${liveQueue.manualContacts}</strong></div><div class="data-row"><span>Next expected contact</span><strong>${escapeHTML(nextArrivalLabel)}</strong></div><div class="data-row"><span>Demand overflow events</span><strong>${liveQueue.overflowed}</strong></div></div><p class="muted-note">Live queue simulation · all contacts and patience outcomes are fictional gameplay events.</p></div><div class="grid two" style="margin-top:14px"><section class="panel"><div class="panel-head"><div><h3>Prioritised inbound queue</h3><p>New synthetic contacts arrive during the shift. Waiting customers may abandon when their patience expires.</p></div><span class="pill ${shiftTimeAvailable()?'green':'amber'}"><span class="live-dot"></span> ${shiftTimeAvailable()?'ROUTING OPEN':'SHIFT WINDOW CLOSED'}</span></div>${queue.length?`<div class="queue-contact-list">${queue.slice(0,8).map(item=>`<div class="queue-contact-row"><span class="priority-mark ${item.priority}"></span><div class="queue-contact-main"><strong>${escapeHTML(item.customer)}</strong><small>${escapeHTML(item.issue)} · ${escapeHTML(item.routeGroup)}</small></div><span class="queue-wait">${formatWait(item.waitSeconds)}</span><span class="pill ${item.priority==='critical'?'red':item.priority==='high'?'amber':''}">${item.priority.toUpperCase()}</span></div>`).join('')}</div><button class="btn primary" style="margin-top:14px" data-action="answer-call" ${state.agentStatus==='available'&&shiftTimeAvailable()?'':'disabled'}>Accept highest-priority contact ↙</button>`:`<div class="empty-state"><h3>No waiting contacts</h3><p>Automatic arrivals continue during an active shift. Add a controlled demand surge when needed.</p><button class="btn primary" data-action="refresh-queue">Simulate demand surge (+6)</button></div>`}</section><section class="panel"><div class="panel-head"><div><h3>Callbacks due</h3><p>Customer-requested return contacts scheduled during earlier interactions.</p></div><span class="pill">${callbackRows.length} SCHEDULED</span></div>${callbackRows.length?callbackRows.map(item=>`<div class="case-item"><div class="case-symbol">◷</div><div class="case-copy"><strong>${escapeHTML(item.customer)}</strong><small>${escapeHTML(item.issue)} · Due ${new Date(item.dueAt).toLocaleString()}</small></div><button class="btn small secondary" data-action="return-callback-to-queue" data-callback-id="${escapeHTML(item.id)}" ${callbackIsDue(item)?'':'disabled'}>${callbackIsDue(item)?'Queue callback':'Not due yet'}</button></div>`).join(''):'<div class="empty-state"><p>No callbacks are scheduled.</p></div>'}<div class="panel-head" style="margin-top:18px"><div><h3>Recently handled</h3><p>Your latest customer interactions.</p></div><button class="btn small outline" data-action="open-crm">View cases</button></div>${state.cases.length?state.cases.slice(-3).reverse().map(caseRow).join(''):'<p class="muted-note">No completed interactions yet.</p>'}</section></div>`; return;
  }
  const call=state.currentCall;
  const scenario=inboundScenarios.find(item=>item.id===call.scenarioId);
  if(!scenario){toast('Active contact scenario unavailable.','error');return;}
  const step=scenario.steps[call.stepIndex];
  const contact=findQueueContact(call.queueContactId);
  if(!contact){toast('Active inbound customer record is missing.','error');return;}
  ensureVoiceCustomerBehaviour(call,contact,scenario,queueSimulationNowMs());
  const continuityPanel = renderCustomerContinuityPanel(contact.customer || scenario.customer, 'inbound_voice', { customerRef: contact.customerRef });
  const voiceBehaviour=voiceCustomerBehaviourSnapshot(call.voiceBehaviour);
  const turnLimitReached=(Number(voiceBehaviour?.turns)||0)>=VOICE_CUSTOMER_BEHAVIOUR_POLICY.maxAgentTurns;
  const transcript=voiceBehaviour?.transcript||[];
  const latestCustomerMessage=[...transcript].reverse().find(item=>item.speaker==='customer')?.text||scenario.opening;
  const pendingDecision=call.voiceBehaviour?.pendingDecision||null;
  const supervisorOpen=state.supervisorRequests.some(item=>item.contactId===call.queueContactId&&item.status==='open');
  const dialogueRows=transcript.slice(-8).map(message=>`<div class="voice-dialogue-line ${message.speaker==='agent'?'agent':'customer'} ${['interruption','security_objection','unsupported_commitment','negotiation_request'].includes(message.type)?'interruption':''}"><span>${message.speaker==='agent'?'YOU':message.type==='interruption'?'CUSTOMER INTERRUPTED':'CUSTOMER'}</span><p>${escapeHTML(message.text)}</p></div>`).join('');
  const dialoguePanel=transcript.length>1?`<section class="voice-live-dialogue" aria-live="polite"><div class="panel-head"><div><h3>Live call transcript</h3><p>Latest customer and agent turns · PINs, passwords, one-time codes and payment-card data are redacted.</p></div><span class="pill">${voiceBehaviour.turns}/${VOICE_CUSTOMER_BEHAVIOUR_POLICY.maxAgentTurns} AGENT TURNS</span></div>${dialogueRows}<button class="btn small outline" type="button" data-action="play-customer-response" data-text="${escapeHTML(latestCustomerMessage)}">Play latest customer response</button></section>`:'';
  const decisionPanel=pendingDecision?`<section class="panel voice-decision-panel" aria-live="assertive"><div class="panel-head"><div><div class="question-kicker">CUSTOMER RESPONSE REQUIRED</div><h3>${escapeHTML(pendingDecision.title)}</h3><p>${escapeHTML(pendingDecision.prompt)}</p></div><span class="pill amber">PAUSED FOR RESPONSE</span></div><div class="voice-decision-options">${pendingDecision.options.map(option=>`<button class="voice-decision-option" type="button" data-action="resolve-voice-decision" data-option-id="${escapeHTML(option.id)}"><strong>${escapeHTML(option.label)}</strong><small>${escapeHTML(option.description)}</small></button>`).join('')}</div><p class="muted-note">Resolve this customer interruption or service-recovery negotiation before continuing the call.</p></section>`:'';
  const voiceMonitor=voiceBehaviour?`<section class="panel voice-customer-monitor"><div class="panel-head"><div><h3>Live customer behaviour</h3><p>Customer emotion and escalation risk react to agent handling.</p></div><span class="pill ${voiceBehaviour.needsSupervisor?'amber':'green'}">${voiceBehaviour.needsSupervisor?'SUPERVISOR RISK':'LIVE'}</span></div><div class="customer-behaviour-head"><div><span class="subtle-label">CUSTOMER PERSONA</span><strong>${escapeHTML(voiceBehaviour.personaLabel)}</strong><small>${escapeHTML(voiceBehaviour.tone)}</small></div><div class="customer-mood-badge ${escapeHTML(voiceBehaviour.emotion)}">${escapeHTML(voiceBehaviour.emotion.toUpperCase())}</div></div><div class="customer-behaviour-stats"><div><span>Sentiment</span><strong>${voiceBehaviour.sentiment}/100</strong><div class="bar-track"><div class="bar-fill" style="width:${voiceBehaviour.sentiment}%"></div></div></div><div><span>Patience</span><strong>${voiceBehaviour.patience}/100</strong><div class="bar-track"><div class="bar-fill" style="width:${voiceBehaviour.patience}%"></div></div></div></div><div class="data-row"><span>Customer interruptions</span><strong>${voiceBehaviour.interruptionCount}/2</strong></div><div class="data-row"><span>Service-recovery requests</span><strong>${voiceBehaviour.negotiationCount}</strong></div><div class="data-row"><span>Voice quality flags</span><strong>${voiceBehaviour.qualityFlags.length}</strong></div><div class="data-row"><span>Voice QA estimate</span><strong>${Math.max(0,Math.min(100,76-voiceBehaviour.qualityFlags.length*12+Math.round((voiceBehaviour.sentiment-50)/10)))}%</strong></div>${voiceBehaviour.needsSupervisor?`<div class="customer-supervisor-warning"><strong>Supervisor intervention recommended</strong><small>${escapeHTML(voiceBehaviour.supervisorReason)}</small></div>`:''}${voiceBehaviour.qualityFlags.length?`<div class="customer-supervisor-warning"><strong>Quality review flags</strong><small>${voiceBehaviour.qualityFlags.map(escapeHTML).join(' · ')}</small></div>`:''}</section>`:'';
  const callOptions=`<div class="call-options">${step.options.map((opt,j)=>`<button class="call-option" data-call-choice="${j}" ${call.feedback||pendingDecision||turnLimitReached?'disabled':''}><span>${String.fromCharCode(65+j)}</span><span>${escapeHTML(opt.text)}</span></button>`).join('')}</div>`;
  const wrapUpReady=call.stepIndex===scenario.steps.length-1||turnLimitReached;
  const feedbackPanel=call.feedback?`<div class="call-feedback ${call.feedbackType}">${escapeHTML(call.feedback)}</div><div class="assessment-footer"><small>${pendingDecision?'Resolve the customer response before advancing.':turnLimitReached?'Conversation turn limit reached. Complete after-contact work or request supervisor support.':call.feedbackType==='bad'?'A quality or compliance deduction may apply.':'Decision recorded. Continue the interaction.'}</small><button class="btn primary" data-action="${wrapUpReady?'complete-call':'next-call-step'}" ${pendingDecision?'disabled':''}>${wrapUpReady?'Move to after-contact work':'Continue →'}</button></div>`:'';
  viewRoot.innerHTML=`<div class="call-layout"><section class="panel call-console"><div class="call-console-head"><div><strong>INBOUND VOICE CONTACT</strong><small>Connected · ${escapeHTML(scenario.category)} · Ref ${escapeHTML(scenario.reference)}</small></div><span class="pill ${call.held?'amber':'green'}">${call.held?'ON HOLD':'CONNECTED'}</span></div><div class="call-console-body"><div class="customer-strip"><div class="customer-avatar">${escapeHTML(scenario.initials)}</div><div class="customer-info"><strong>${escapeHTML(scenario.customer)}</strong><small>${escapeHTML(scenario.profile)}</small></div><div class="customer-tags"><span class="pill">${escapeHTML(scenario.tag)}</span><span class="pill amber">${escapeHTML(scenario.amount)}</span></div></div>${call.held?`<div class="call-feedback neutral"><strong>Customer is on hold.</strong> Resume the conversation before selecting another call action.</div>`:`<div class="subtle-label">CUSTOMER'S LATEST STATEMENT</div><p class="call-prompt">“${escapeHTML(latestCustomerMessage)}”</p>${dialoguePanel}<p class="call-context">${call.stepIndex===0?'The customer has just connected. Begin with the correct service procedure.':'Continue the interaction based on the case information and previous action.'}</p><div class="panel-head" style="margin:16px 0 11px"><div><div class="question-kicker">STEP ${call.stepIndex+1} OF ${scenario.steps.length} · ${escapeHTML(step.label)}</div><h3 class="call-prompt" style="margin-top:8px">${escapeHTML(step.prompt)}</h3><p class="call-context" style="margin:5px 0 0">${escapeHTML(step.context)}</p></div></div>${decisionPanel}${callOptions}${feedbackPanel}${renderVoicePractice(call,latestCustomerMessage)}</div>`}</div></section><aside class="call-side-stack">${voiceMonitor}${continuityPanel}<section class="panel"><div class="panel-head"><div><h3>Customer record</h3><p>Simulated CRM profile.</p></div><span class="pill">CRM</span></div><div class="data-list"><div class="data-row"><span>Customer</span><strong>${escapeHTML(scenario.customer)}</strong></div><div class="data-row"><span>Case reference</span><strong>${escapeHTML(scenario.reference)}</strong></div><div class="data-row"><span>Reported issue</span><strong>${escapeHTML(scenario.issue)}</strong></div><div class="data-row"><span>Location</span><strong>${escapeHTML(scenario.location)}</strong></div><div class="data-row"><span>Queue route</span><strong>${escapeHTML(contact.routeGroup||'General')}</strong></div><div class="data-row"><span>Queue wait</span><strong>${formatWait(call.waitSeconds||0)}</strong></div></div></section><section class="panel"><div class="panel-head"><div><h3>Interaction controls</h3><p>Contact lifecycle management.</p></div></div><div class="ops-control-stack"><button class="btn outline" data-action="toggle-call-hold">${call.held?'Resume customer':'Place on hold'}</button><button class="btn outline" data-action="request-supervisor" ${supervisorOpen?'disabled':''}>${supervisorOpen?'Supervisor requested':'Request supervisor assistance'}</button><label class="subtle-label" for="transferTarget">TRANSFER DESTINATION</label><select id="transferTarget"><option>Specialist Support</option><option>Fraud & Security</option><option>Cards & Payments</option><option>Technical Support</option><option>Complaints Management</option></select><button class="btn secondary" data-action="transfer-call" ${call.held?'disabled':''}>Transfer to specialist</button><button class="btn outline" data-action="return-call-to-queue">Return contact to queue</button></div><p class="muted-note" style="margin-top:12px">Hold, transfer, assistance and queue return are recorded in the simulated interaction timeline.</p></section></aside></div>`;
}

function ensureDigitalQueue(count = 6) {
  if (!Array.isArray(state.digitalQueue)) state.digitalQueue = [];
  const waiting = state.digitalQueue.filter(item => item.status === DIGITAL_STATUS.QUEUED).length;
  if (state.shiftActive && state.digitalLiveQueueSimulation && !state.digitalLiveQueueSimulation.openingBatchSeeded) {
    if (waiting === 0 && count > 0) {
      const items = createDigitalQueue(DIGITAL_SCENARIOS, count, { sequence: state.digitalSequence, now: queueSimulationNowMs(), slaMinutesOverride: getActiveOrganization(state.organizationWorkspace)?.policy?.digitalResponseTargetMinutes });
      state.digitalQueue.push(...items);
      state.digitalSequence += items.length;
    }
    state.digitalLiveQueueSimulation.openingBatchSeeded = true;
  } else if (!state.shiftActive && state.digitalQueue.length === 0 && count > 0) {
    const items = createDigitalQueue(DIGITAL_SCENARIOS, count, { sequence: state.digitalSequence, now: Date.now(), slaMinutesOverride: getActiveOrganization(state.organizationWorkspace)?.policy?.digitalResponseTargetMinutes });
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

function currentAgentReference() {
  return `EMP-${state.nameInitials || 'AGENT'}`;
}

function currentAgentDigitalWork() {
  return assignedDigitalWorkItems(state.digitalQueue, currentAgentReference());
}

function currentAgentWorkload() {
  return agentWorkloadSnapshot(state.digitalQueue, currentAgentReference());
}

function syncDigitalWorkSelection(preferredId = null) {
  const work = currentAgentDigitalWork();
  state.digitalActiveIds = work.map(item => item.id);
  if (preferredId && state.digitalActiveIds.includes(preferredId)) state.digitalActiveId = preferredId;
  else if (!state.digitalActiveIds.includes(state.digitalActiveId)) state.digitalActiveId = state.digitalActiveIds[0] || null;
  return work;
}

function syncAgentStateWithDigitalWork(reason = 'Digital workload updated') {
  if (!state.shiftActive || state.currentCall || state.activeOutbound || state.wrapUp) return;
  const workload = currentAgentWorkload();
  const nextStatus = workload.activeCount > 0 ? 'busy' : 'available';
  if (state.agentStatus !== nextStatus) setAgentState(nextStatus, reason);
}

function digitalWorkloadDecision(contactId, mode = 'accept') {
  const common = {
    queue: state.digitalQueue,
    contactId,
    agentId: currentAgentReference(),
    shiftActive: state.shiftActive,
    inShiftWindow: shiftTimeAvailable(),
    agentStatus: state.agentStatus,
    currentCall: state.currentCall,
    activeOutbound: state.activeOutbound,
    wrapUp: state.wrapUp
  };
  return mode === 'resume' ? canResumeDigitalFollowUp(common) : canAcceptDigitalContact(common);
}

function renderDigitalWorkTabs(work, selectedId, disabled = false, now = queueSimulationNowMs()) {
  if (!work.length) return '';
  return `<section class="panel digital-worklist-panel"><div class="panel-head"><div><h3>My assigned digital work</h3><p>Keep asynchronous customer threads open while handling other eligible digital contacts.</p></div><span class="pill green">${work.length} OPEN</span></div><div class="digital-work-tabs">${work.map(item => {
    const channel = DIGITAL_CHANNELS[item.channel];
    const waiting = item.status === DIGITAL_STATUS.AWAITING_CUSTOMER;
    const sla = assessDigitalSla(item, now);
    return `<button type="button" class="digital-work-tab ${item.id === selectedId ? 'selected' : ''}" data-action="select-digital" data-contact-id="${escapeHTML(item.id)}" ${disabled ? 'disabled' : ''}><span class="channel-label ${item.channel}">${channel.icon} ${channel.label.toUpperCase()}</span><strong>${escapeHTML(item.subject)}</strong><small>${escapeHTML(item.customer)} · ${waiting ? 'AWAITING CUSTOMER' : 'ACTIVE WORK'}</small><span class="digital-sla-pill ${sla.status}">${escapeHTML(digitalSlaDisplay(sla))}</span></button>`;
  }).join('')}</div></section>`;
}

function renderDigital() {
  if (!state.shiftActive) {
    viewRoot.innerHTML = renderShiftEntryPanel('Digital support is not active', 'Start your shift before receiving email, live-chat and social-media assignments. Digital queues are simulated and do not connect to real accounts.');
    return;
  }
  ensureDigitalQueue(6);
  const digitalNow = queueSimulationNowMs();
  const metrics = digitalQueueMetrics(state.digitalQueue, digitalNow);
  const slaMetrics = digitalSlaMetrics(state.digitalQueue, digitalNow);
  const customerMetrics = digitalCustomerBehaviourMetrics(state.digitalQueue);
  const digitalLive = digitalLiveQueueSnapshot(state.digitalLiveQueueSimulation, state.shiftElapsedMinutes);
  const workload = currentAgentWorkload();
  const work = syncDigitalWorkSelection();
  const selected = state.digitalActiveId ? findDigitalContact(state.digitalQueue, state.digitalActiveId) : null;
  const active = selected && [DIGITAL_STATUS.ACTIVE, DIGITAL_STATUS.AWAITING_CUSTOMER].includes(selected.status) ? selected : null;
  const customerBehaviour = active ? digitalCustomerBehaviourSnapshot(ensureDigitalCustomerBehaviour(active)) : null;
  const continuityPanel = active ? renderCustomerContinuityPanel(active.customer, active.channel, { customerRef: active.customerRef }) : '';
  const interactiveBlocked = Boolean(state.currentCall || state.activeOutbound || state.wrapUp);
  const tabs = renderDigitalWorkTabs(work, active?.id || null, interactiveBlocked, digitalNow);
  const quickQueue = sortDigitalQueue(state.digitalQueue, { channel: state.digitalChannelFilter || 'all', now: digitalNow }).slice(0, 5);

  if (active) {
    const channel = DIGITAL_CHANNELS[active.channel];
    const messageRows = active.messages.map(message => `<div class="digital-message ${message.type === 'agent' ? 'agent' : 'customer'}"><div class="digital-message-meta"><strong>${message.type === 'agent' ? 'YOU · AGENT' : escapeHTML(active.customer)}</strong><time>${new Date(message.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div><p>${escapeHTML(message.text)}</p>${message.quality ? `<small>Rule-based practice check: ${message.quality.score}%</small>` : ''}</div>`).join('');
    const waitingForCustomer = active.status === DIGITAL_STATUS.AWAITING_CUSTOMER;
    const activeSla = assessDigitalSla(active, digitalNow);
    const activeSlaClass = activeSla.status === 'breached' ? 'breached' : activeSla.status === 'at_risk' ? 'at-risk' : activeSla.status === 'met' ? 'met' : 'on-track';
    const resumeDecision = waitingForCustomer ? digitalWorkloadDecision(active.id, 'resume') : { allowed: false, reason: '' };
    const queuePanel = `<section class="panel digital-available-queue"><div class="panel-head"><div><h3>Waiting digital queue</h3><p>Accept additional work while response capacity remains available.</p></div><span class="pill ${workload.availableSlots > 0 ? 'green' : 'amber'}">${workload.availableSlots} SLOTS AVAILABLE</span></div>${quickQueue.length ? `<div class="digital-queue-list">${quickQueue.map(item => { const decision = digitalWorkloadDecision(item.id); return `<article class="digital-queue-row"><span class="digital-queue-priority ${item.priority}"></span><div class="digital-queue-main"><span class="channel-label ${item.channel}">${DIGITAL_CHANNELS[item.channel].icon} ${DIGITAL_CHANNELS[item.channel].label.toUpperCase()}</span><strong>${escapeHTML(item.subject)}</strong><small>${escapeHTML(item.customer)} · ${escapeHTML(item.preview)}</small></div><div class="digital-queue-meta"><span class="pill ${item.priority === 'critical' ? 'red' : item.priority === 'high' ? 'amber' : ''}">${item.priority.toUpperCase()}</span><span class="digital-sla-pill ${assessDigitalSla(item, digitalNow).status}">${escapeHTML(digitalSlaDisplay(assessDigitalSla(item, digitalNow)))}</span><small>${Math.floor(item.waitSeconds / 60)}m ${item.waitSeconds % 60}s</small><button class="btn small primary" data-action="accept-digital" data-contact-id="${escapeHTML(item.id)}" ${decision.allowed ? '' : 'disabled'} title="${escapeHTML(decision.reason || 'Accept contact')}">Accept</button></div></article>`; }).join('')}</div>` : '<p class="muted-note">No waiting digital contacts are available.</p>'}</section>`;
    viewRoot.innerHTML = `${tabs}${queuePanel}<div class="digital-workspace">
      <section class="panel digital-thread-panel">
        <div class="digital-topbar"><div><span class="channel-label ${active.channel}">${channel.icon} ${channel.label.toUpperCase()}</span><h3>${escapeHTML(active.subject)}</h3><p>${escapeHTML(active.customer)} · ${escapeHTML(active.routeGroup)} · ${escapeHTML(active.id)}</p></div><span class="pill ${active.priority === 'critical' ? 'red' : active.priority === 'high' ? 'amber' : 'green'}">${active.priority.toUpperCase()}</span></div>
        <div class="digital-sla-banner ${activeSlaClass}"><div><strong>FIRST-RESPONSE SERVICE LEVEL</strong><small>${activeSla.responded ? `First response ${activeSla.responseMinutes} simulated minutes after receipt` : `Target ${activeSla.targetMinutes} simulated minutes · ${activeSla.label}`}</small></div><span>${escapeHTML(digitalSlaDisplay(activeSla))}</span></div>
        <div class="digital-thread">${messageRows}</div>
        ${waitingForCustomer && customerBehaviour?.hasPendingResponse ? `<div class="digital-followup"><div><p>Customer has replied based on the tone, clarity and next step in your last response.</p><small>${escapeHTML(customerBehaviour.personaLabel)} · ${escapeHTML(customerBehaviour.mood)} · ${customerBehaviour.sentiment}/100 sentiment</small>${!resumeDecision.allowed ? `<small>${escapeHTML(resumeDecision.reason)}</small>` : ''}</div><button class="btn outline" data-action="deliver-digital-followup" ${resumeDecision.allowed ? '' : 'disabled'}>Receive customer response</button></div>` : waitingForCustomer ? `<div class="digital-awaiting-note">${customerBehaviour?.exhausted ? 'The customer has no further scripted response. Complete the contact, record a pending outcome or escalate it.' : 'Awaiting the next customer response. This thread remains assigned without consuming an active response slot.'}</div>` : ''}
        ${active.status === DIGITAL_STATUS.ACTIVE ? `<div class="digital-template-row"><span>REPLY STARTERS</span>${digitalReplyTemplates(active.channel).map(([id,text])=>`<button type="button" class="digital-template-button" data-digital-template="${id}" ${interactiveBlocked ? 'disabled' : ''}>${id.replaceAll('-',' ')}</button>`).join('')}</div><form id="digitalReplyForm" class="digital-composer"><label class="form-field">AGENT RESPONSE<textarea name="reply" rows="4" minlength="12" maxlength="1200" required placeholder="Write a clear, professional response. Do not request passwords, PINs, one-time codes or full payment-card numbers." ${interactiveBlocked ? 'disabled' : ''}></textarea></label><div class="digital-composer-foot"><small>Maximum 1,200 characters. Replies are stored in this browser's local simulation save.</small><button class="btn primary" type="submit" ${interactiveBlocked ? 'disabled' : ''}>Record and send simulated reply</button></div></form>` : `<div class="digital-awaiting-note">Awaiting the scripted customer follow-up. This assigned thread remains on your worklist but does not consume an active response slot.</div>`}
        <form id="digitalCloseForm" class="digital-close-form"><div class="digital-close-heading"><div><strong>AFTER-CONTACT WORK</strong><small>Record a clear disposition and factual CRM note.</small></div><span class="pill amber">WRAP-UP</span></div><div class="grid two"><label class="form-field">DISPOSITION<select name="disposition" ${interactiveBlocked ? 'disabled' : ''}><option value="resolved">Resolved</option><option value="pending_customer">Pending customer response</option><option value="escalated">Escalated to specialist team</option></select></label><label class="form-field">CASE NOTES<textarea name="notes" rows="3" minlength="12" maxlength="1200" required placeholder="Issue, checks, action, owner and agreed next step." ${interactiveBlocked ? 'disabled' : ''}></textarea></label></div><button class="btn secondary" type="submit" ${interactiveBlocked ? 'disabled' : ''}>Save disposition & return to queue</button></form>
      </section>
      <aside class="digital-side-stack">
        <section class="panel"><div class="panel-head"><div><h3>Agent workload capacity</h3><p>Active conversations consume response capacity; customer-waiting threads stay assigned without occupying a live slot.</p></div><span class="pill ${workload.atCapacity ? 'amber' : 'green'}">${workload.activeCount}/${workload.maxConcurrentDigital} ACTIVE</span></div><div class="data-list"><div class="data-row"><span>Available digital slots</span><strong>${workload.availableSlots}</strong></div><div class="data-row"><span>Assigned open threads</span><strong>${workload.assignedCount}</strong></div><div class="data-row"><span>Awaiting customer</span><strong>${workload.awaitingCustomerCount}</strong></div><div class="data-row"><span>Live chat capacity</span><strong>${workload.activeByChannel.live_chat}/${workload.channelCapacity.live_chat}</strong></div><div class="data-row"><span>Email capacity</span><strong>${workload.activeByChannel.email}/${workload.channelCapacity.email}</strong></div><div class="data-row"><span>Social capacity</span><strong>${workload.activeByChannel.social}/${workload.channelCapacity.social}</strong></div></div></section>
        <section class="panel"><div class="panel-head"><div><h3>Channel handling guide</h3><p>${channel.description}</p></div><span class="pill">${channel.slaMinutes} MIN TARGET</span></div><div class="digital-guidance-list">${active.guidance.map((item,index)=>`<div><span>${index + 1}</span><p>${escapeHTML(item)}</p></div>`).join('')}</div></section>
        <section class="panel digital-customer-behaviour"><div class="panel-head"><div><h3>Customer behaviour monitor</h3><p>Customer mood changes in response to the agent's communication and ownership.</p></div><span class="pill ${customerBehaviour?.needsSupervisor ? 'amber' : 'green'}">${customerBehaviour?.needsSupervisor ? 'SUPERVISOR RISK' : 'LIVE REACTION'}</span></div><div class="customer-behaviour-head"><div><span class="subtle-label">CUSTOMER PERSONA</span><strong>${escapeHTML(customerBehaviour?.personaLabel || 'Unassigned')}</strong><small>${escapeHTML(customerBehaviour?.tone || '')}</small></div><div class="customer-mood-badge ${escapeHTML(customerBehaviour?.mood || 'calm')}">${escapeHTML((customerBehaviour?.mood || 'calm').replaceAll('_',' ').toUpperCase())}</div></div><div class="customer-behaviour-stats"><div><span>Sentiment</span><strong>${customerBehaviour?.sentiment ?? '—'}/100</strong><div class="bar-track"><div class="bar-fill" style="width:${customerBehaviour?.sentiment ?? 0}%"></div></div></div><div><span>Patience</span><strong>${customerBehaviour?.patience ?? '—'}/100</strong><div class="bar-track"><div class="bar-fill" style="width:${customerBehaviour?.patience ?? 0}%"></div></div></div></div><div class="data-row"><span>Conversation turns</span><strong>${customerBehaviour?.turns ?? 0}/${customerBehaviour?.maxTurns ?? 3}</strong></div><div class="data-row"><span>Last reaction</span><strong>${escapeHTML(customerBehaviour?.lastReaction || 'Initial')}</strong></div>${customerBehaviour?.needsSupervisor ? `<div class="customer-supervisor-warning"><strong>Supervisor intervention recommended</strong><small>${escapeHTML(customerBehaviour.supervisorReason)}</small></div><button class="btn small secondary" data-action="request-digital-supervisor" data-contact-id="${escapeHTML(active.id)}" ${state.supervisorRequests.some(item => item.contactId === active.id && item.status === 'open') ? 'disabled' : ''}>${state.supervisorRequests.some(item => item.contactId === active.id && item.status === 'open') ? 'Supervisor request open' : 'Request supervisor assistance'}</button>` : ''}</section>
        ${continuityPanel}
        <section class="panel"><div class="panel-head"><div><h3>Customer and routing</h3><p>Synthetic customer record only.</p></div><span class="pill green">SIMULATED CRM</span></div><div class="data-list"><div class="data-row"><span>Customer</span><strong>${escapeHTML(active.customer)}</strong></div><div class="data-row"><span>Channel</span><strong>${channel.label}</strong></div><div class="data-row"><span>Priority</span><strong>${active.priority.toUpperCase()}</strong></div><div class="data-row"><span>Specialist route</span><strong>${escapeHTML(active.routeGroup)}</strong></div><div class="data-row"><span>Agent replies</span><strong>${active.replyCount}</strong></div><div class="data-row"><span>Current practice QA</span><strong>${active.qaScore === null ? 'Pending' : `${active.qaScore}%`}</strong></div></div><p class="muted-note" style="margin-top:12px">Never collect credentials or sensitive payment information through email, chat or social messages. Use organisation-approved secure verification channels.</p></section>
      </aside>
    </div>`;
    return;
  }

  const queue = sortDigitalQueue(state.digitalQueue, { channel: state.digitalChannelFilter || 'all', now: digitalNow });
  const recent = state.digitalQueue.filter(item => [DIGITAL_STATUS.RESOLVED, DIGITAL_STATUS.ESCALATED, DIGITAL_STATUS.PENDING_CUSTOMER].includes(item.status)).slice(-5).reverse();
  const channels = Object.entries(DIGITAL_CHANNELS).map(([key,item]) => `<div class="digital-channel-card"><span class="channel-label ${key}">${item.icon} ${item.label.toUpperCase()}</span><strong>${metrics.channelCounts[key].waiting}</strong><small>waiting · ${digitalLive.arrivalsByChannel[key] || 0} new this shift · ${metrics.channelCounts[key].resolved} resolved</small></div>`).join('');
  const acceptable = state.shiftActive && shiftTimeAvailable() && !state.currentCall && !state.activeOutbound && !state.wrapUp;
  viewRoot.innerHTML = `${tabs}<div class="ops-summary-grid">${metricCard('DIGITAL CONTACTS WAITING',metrics.waiting,'Email, live chat and social','✉')}${metricCard('ACTIVE INTERACTIONS',metrics.active,'Currently in progress','◉')}${metricCard('SLA AT RISK',slaMetrics.atRisk,'First response is due soon','⌁')}${metricCard('CUSTOMER ESCALATION RISK',customerMetrics.supervisorRecommended,'Open digital contacts needing intervention','!')}${metricCard('AVAILABLE DIGITAL SLOTS',workload.availableSlots,`${workload.activeCount}/${workload.maxConcurrentDigital} active · ${workload.awaitingCustomerCount} awaiting customer`,'↔')}</div>
    <div class="digital-channel-grid">${channels}</div>
    <section class="panel digital-live-intake-panel"><div class="panel-head"><div><h3>Live digital demand</h3><p>New synthetic email, live-chat and social contacts continue arriving during the shift.</p></div><span class="pill ${digitalLive.active ? 'green' : 'amber'}">${digitalLive.active ? 'AUTOMATIC INTAKE' : 'INTAKE CLOSED'}</span></div><div class="digital-live-summary"><div><span>Total new contacts</span><strong>${digitalLive.arrivals}</strong></div><div><span>Queue overflow</span><strong>${digitalLive.overflowed}</strong></div><div><span>SLA breaches</span><strong>${slaMetrics.breached}</strong></div><div><span>First-response target rate</span><strong>${slaMetrics.firstResponseTargetRate === null ? 'Pending' : `${slaMetrics.firstResponseTargetRate}%`}</strong></div><div><span>Next arrival</span><strong>${digitalLive.nextArrivalInMinutes === null ? 'Stopped' : `${Math.max(0, Math.ceil(digitalLive.nextArrivalInMinutes))} sim min`}</strong></div></div><p class="muted-note">Arrival demand follows the supervisor's Standard, Busy period or Recovery profile. When a channel reaches its waiting capacity, additional demand is recorded as overflow instead of creating an unbounded queue.</p></section>
    <div class="grid two" style="margin-top:14px"><section class="panel"><div class="panel-head"><div><h3>Digital contact queue</h3><p>Priority-first routing with channel-specific concurrency limits.</p></div><span class="pill ${acceptable && workload.availableSlots > 0 ? 'green' : 'amber'}">${acceptable && workload.availableSlots > 0 ? 'CAPACITY AVAILABLE' : 'CAPACITY / SHIFT BLOCKED'}</span></div>
      <label class="form-field digital-filter">FILTER CHANNEL<select id="digitalChannelFilter"><option value="all" ${state.digitalChannelFilter==='all'?'selected':''}>All channels</option><option value="email" ${state.digitalChannelFilter==='email'?'selected':''}>Email</option><option value="live_chat" ${state.digitalChannelFilter==='live_chat'?'selected':''}>Live chat</option><option value="social" ${state.digitalChannelFilter==='social'?'selected':''}>Social media</option></select></label>
      ${queue.length ? `<div class="digital-queue-list">${queue.map(item => { const decision = digitalWorkloadDecision(item.id); return `<article class="digital-queue-row"><span class="digital-queue-priority ${item.priority}"></span><div class="digital-queue-main"><span class="channel-label ${item.channel}">${DIGITAL_CHANNELS[item.channel].icon} ${DIGITAL_CHANNELS[item.channel].label.toUpperCase()}</span><strong>${escapeHTML(item.subject)}</strong><small>${escapeHTML(item.customer)} · ${escapeHTML(item.preview)}</small><em>${escapeHTML(item.routeGroup)}</em></div><div class="digital-queue-meta"><span class="pill ${item.priority==='critical'?'red':item.priority==='high'?'amber':''}">${item.priority.toUpperCase()}</span><span class="digital-sla-pill ${assessDigitalSla(item, digitalNow).status}">${escapeHTML(digitalSlaDisplay(assessDigitalSla(item, digitalNow)))}</span><small>${Math.floor(item.waitSeconds/60)}m ${item.waitSeconds%60}s waiting</small><button class="btn small primary" data-action="accept-digital" data-contact-id="${escapeHTML(item.id)}" ${decision.allowed ? '' : 'disabled'} title="${escapeHTML(decision.reason || `Accept ${DIGITAL_CHANNELS[item.channel].label}`)}">Accept</button></div></article>`; }).join('')}</div>` : `<div class="empty-state"><h3>No contacts in this channel filter</h3><p>Load another controlled batch of synthetic digital enquiries.</p></div>`}
      <button class="btn outline" style="margin-top:14px" data-action="refresh-digital-queue" ${acceptable ? '' : 'disabled'}>Load next simulated batch</button>
    </section><section class="panel"><div class="panel-head"><div><h3>Digital service performance</h3><p>Separate channel workloads and case outcomes.</p></div><span class="pill green">LOCAL SIMULATION</span></div><div class="data-list"><div class="data-row"><span>Email default first-response target</span><strong>4 hours · illustrative</strong></div><div class="data-row"><span>Live chat default response target</span><strong>2 minutes · illustrative</strong></div><div class="data-row"><span>Social default acknowledgement target</span><strong>20 minutes · illustrative</strong></div><div class="data-row"><span>Average first response</span><strong>${slaMetrics.averageFirstResponseMinutes ? `${slaMetrics.averageFirstResponseMinutes} min` : 'Pending'}</strong></div><div class="data-row"><span>First responses within target</span><strong>${slaMetrics.firstResponsesMet} / ${slaMetrics.firstResponses}</strong></div><div class="data-row"><span>First responses late</span><strong>${slaMetrics.firstResponsesLate}</strong></div><div class="data-row"><span>Open responses at risk / breached</span><strong>${slaMetrics.atRisk} / ${slaMetrics.breached}</strong></div><div class="data-row"><span>Completed digital contacts</span><strong>${metrics.resolved}</strong></div><div class="data-row"><span>Escalated digital contacts</span><strong>${metrics.escalated}</strong></div><div class="data-row"><span>Pending customer response</span><strong>${metrics.awaitingCustomer}</strong></div></div><p class="muted-note" style="margin-top:12px">Targets are example gameplay values, not contractual service levels or regulatory requirements. Actual targets must be configured by the organisation.</p><h4 style="margin:16px 0 8px">Recent digital outcomes</h4>${recent.length ? recent.map(item=>`<div class="case-item"><div class="case-symbol">${DIGITAL_CHANNELS[item.channel].icon}</div><div class="case-copy"><strong>${escapeHTML(item.subject)}</strong><small>${escapeHTML(item.customer)} · ${escapeHTML(item.channelLabel)}</small></div><span class="pill ${item.status===DIGITAL_STATUS.RESOLVED?'green':'amber'}">${item.status.replaceAll('_',' ').toUpperCase()}</span></div>`).join('') : '<p class="muted-note">No digital interactions completed yet.</p>'}</section></div>`;
}

function renderQueue(){
  if(!state.shiftActive){viewRoot.innerHTML=renderShiftEntryPanel('Queue control is not active','Start your shift to open contact routing.');return;}
  ensureInboundQueue(6);
  const queueNow = queueSimulationNowMs();
  const queue=sortQueuedContacts(state.inboundQueueItems, queueNow);
  const metrics=queueMetrics(state.inboundQueueItems, queueNow);
  const liveQueue = currentLiveQueueSnapshot();
  const nextArrivalLabel = liveQueue.paused ? 'Paused' : liveQueue.nextArrivalInMinutes === null ? 'Stopped' : `${Math.ceil(liveQueue.nextArrivalInMinutes)} simulated min`;
  const callbacks=state.callbacks.filter(item=>(item.status==='scheduled'||item.status==='queued')&&item.type!=='outbound');
  viewRoot.innerHTML=`<div class="ops-summary-grid">${metricCard('IN QUEUE',metrics.waiting,'Queued voice contacts','↙')}${metricCard('AVERAGE WAIT',formatWait(metrics.averageWaitSeconds),'Across waiting contacts','◷')}${metricCard('ACCEPTED THIS SHIFT',state.acceptedContacts,'Includes completed and active contacts','✓')}${metricCard('ABANDONED',liveQueue.abandoned,'Customers who exceeded patience','↗')}</div><section class="panel" style="margin-top:14px"><div class="panel-head"><div><h3>Queue supervisor</h3><p>Automatic arrivals, priority routing, customer patience and live wait-age.</p></div><button class="btn small secondary" data-action="refresh-queue">Simulate demand surge (+6)</button></div><div class="data-list" style="margin-bottom:14px"><div class="data-row"><span>Automatic arrivals</span><strong>${liveQueue.arrivals}</strong></div><div class="data-row"><span>Opening queue contacts</span><strong>${liveQueue.openingContacts}</strong></div><div class="data-row"><span>Manual surge contacts</span><strong>${liveQueue.manualContacts}</strong></div><div class="data-row"><span>Next expected arrival</span><strong>${escapeHTML(nextArrivalLabel)}</strong></div><div class="data-row"><span>Overflow events</span><strong>${liveQueue.overflowed}</strong></div></div>${queue.length?`<div class="table-wrap"><table><thead><tr><th>Priority</th><th>Customer</th><th>Issue</th><th>Route group</th><th>Wait</th><th>Status</th></tr></thead><tbody>${queue.map(item=>`<tr><td><span class="priority-label ${item.priority}">${item.priority.toUpperCase()}</span></td><td>${escapeHTML(item.customer)}</td><td>${escapeHTML(item.issue)}</td><td>${escapeHTML(item.routeGroup)}</td><td>${formatWait(item.waitSeconds)}</td><td><span class="pill green">QUEUED</span></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state"><h3>Queue clear</h3><p>No inbound contacts are waiting.</p></div>'}</section><section class="panel" style="margin-top:14px"><div class="panel-head"><div><h3>Scheduled callbacks</h3><p>Only customer-requested callbacks are listed.</p></div><span class="pill">${callbacks.length}</span></div>${callbacks.length?callbacks.map(item=>`<div class="case-item"><div class="case-symbol">◷</div><div class="case-copy"><strong>${escapeHTML(item.customer)}</strong><small>${escapeHTML(item.issue)} · ${new Date(item.dueAt).toLocaleString()}</small></div><button class="btn small secondary" data-action="return-callback-to-queue" data-callback-id="${escapeHTML(item.id)}" ${item.status==='queued'||!callbackIsDue(item)?'disabled':''}>${item.status==='queued'?'In queue':!callbackIsDue(item)?'Not due yet':'Queue callback'}</button></div>`).join(''):'<p class="muted-note">No callbacks are scheduled.</p>'}</section>`;
}

function supervisorEscalationCard(request, actor, now = new Date()) {
  const risk = assessSupervisorEscalation(request, now);
  const escalation = request.escalation;
  const ownedByActor = escalation.assignedTo && escalation.assignedTo.toLowerCase() === String(actor || '').toLowerCase();
  const priorityTone = risk.priority === 'critical' ? 'red' : risk.priority === 'high' ? 'amber' : 'green';
  const riskTone = risk.state === 'overdue' ? 'red' : risk.state === 'due_soon' ? 'amber' : 'green';
  const owner = escalation.assignedTo ? `Owner: ${escapeHTML(escalation.assignedTo)}` : 'Unassigned';
  const response = risk.state === 'overdue' ? `OVERDUE · ${risk.elapsedMinutes} min elapsed` : risk.state === 'due_soon' ? `DUE SOON · ${risk.remainingMinutes} min left` : `${risk.remainingMinutes} min response target`;
  let actionMarkup = '';
  if (!escalation.assignedTo) {
    actionMarkup = `<button class="btn small primary" data-action="claim-supervisor-escalation" data-request-id="${escapeHTML(request.id)}">Claim request</button>`;
  } else if (!ownedByActor) {
    actionMarkup = `<span class="pill amber">Owned by ${escapeHTML(escalation.assignedTo)}</span>`;
  } else if (request.caseReference) {
    actionMarkup = `<button class="btn small primary" data-action="open-case-followup" data-case-reference="${escapeHTML(request.caseReference)}">Open CRM case review</button>`;
  } else if (request.commitmentId) {
    actionMarkup = `<button class="btn small primary" data-action="open-promise-control">Open promise review</button>`;
  } else {
    actionMarkup = `<form class="supervisor-escalation-resolution" data-supervisor-escalation-resolve data-request-id="${escapeHTML(request.id)}"><label><span>Decision</span><select name="outcome"><option value="action_taken">Action taken</option><option value="referred">Referred to specialist</option><option value="no_action_required">No further action required</option></select></label><label class="evidence"><span>Supervisor action and evidence · 30+ characters</span><textarea name="evidence" rows="2" minlength="30" maxlength="1000" required placeholder="Record the intervention, checks performed, advice given and next owner or outcome."></textarea></label><button class="btn small primary" type="submit">Record decision</button></form>`;
  }
  const reassignMarkup = ownedByActor ? `<details class="supervisor-escalation-reassign"><summary>Reassign ownership</summary><form data-supervisor-escalation-reassign data-request-id="${escapeHTML(request.id)}"><label><span>Next supervisor</span><input name="newOwner" required minlength="2" maxlength="100" placeholder="Supervisor name"></label><label><span>Reason</span><input name="reason" required minlength="8" maxlength="300" placeholder="Reason for handover"></label><button class="btn small outline" type="submit">Transfer ownership</button></form></details>` : '';
  return `<article class="supervisor-escalation-card ${risk.priority}"><div class="supervisor-escalation-main"><div class="supervisor-escalation-head"><strong>${escapeHTML(request.customer || 'Synthetic customer')} · ${escapeHTML(request.reference || request.contactId || 'Supervisor request')}</strong><span class="pill ${priorityTone}">${risk.priority.toUpperCase()}</span><span class="pill ${riskTone}">${escapeHTML(response)}</span></div><p>${escapeHTML(request.reason || 'Agent assistance requested.')}</p><div class="supervisor-escalation-meta"><span>${escapeHTML(request.channel || 'Customer contact')}</span><span>${owner}</span><span>${escalation.stage.replaceAll('_', ' ').toUpperCase()}</span><span>Raised ${new Date(request.createdAt).toLocaleString()}</span></div>${actionMarkup}${reassignMarkup}</div></article>`;
}

function renderSupervisor(){
  const control=normalizeSupervisorQueueControl(state.supervisorQueueControl);
  state.supervisorQueueControl=control;
  const nowVoice=queueSimulationNowMs();
  const digitalLive=digitalLiveQueueSnapshot(state.digitalLiveQueueSimulation,state.shiftElapsedMinutes);
  const board=supervisorQueueBoard({
    inboundQueue:state.inboundQueueItems,
    digitalQueue:state.digitalQueue,
    supervisorRequests:state.supervisorRequests,
    cases:state.cases,
    currentCall:state.currentCall,
    activeOutbound:state.activeOutbound,
    digitalActiveId:state.digitalActiveId,
    voiceNow:nowVoice,
    digitalNow:nowVoice
  });
  const live=currentLiveQueueSnapshot();
  const activeVoiceContact=state.currentCall?.queueContactId?findQueueContact(state.currentCall.queueContactId):null;
  const activeVoiceBehaviour=state.currentCall?.voiceBehaviour?voiceCustomerBehaviourSnapshot(state.currentCall.voiceBehaviour):null;
  const activeVoiceFlags=activeVoiceBehaviour?.qualityFlags||[];
  const voiceSecurityRisk=activeVoiceFlags.includes('prohibited_secret_request')||activeVoiceFlags.includes('critical_handling_breach');
  const voiceBehaviourMetrics={
    supervisorRecommended:activeVoiceBehaviour?.needsSupervisor?1:0,
    interruptions:activeVoiceBehaviour?.interruptionCount||0,
    securityBreaches:voiceSecurityRisk?1:0
  };
  const voiceRiskRows=activeVoiceBehaviour?.needsSupervisor&&activeVoiceContact?`<div class="case-item customer-risk-row voice-risk-row"><div class="case-symbol">!</div><div class="case-copy"><strong>${escapeHTML(activeVoiceContact.customer)} · ${escapeHTML(activeVoiceContact.issue)}</strong><small>Voice · ${escapeHTML(activeVoiceBehaviour.personaLabel)} · ${escapeHTML(activeVoiceBehaviour.emotion)} · sentiment ${activeVoiceBehaviour.sentiment}/100 · patience ${activeVoiceBehaviour.patience}/100 · ${escapeHTML(activeVoiceBehaviour.supervisorReason)}</small></div><span class="pill ${voiceSecurityRisk?'red':'amber'}">${voiceSecurityRisk?'SECURITY REVIEW':'INTERVENTION'}</span></div>`:'';
  const active=state.shiftActive&&shiftTimeAvailable();
  const modes=Object.entries(SUPERVISOR_INTAKE_MODES).map(([key,item])=>`<button type="button" class="supervisor-mode-button ${control.mode===key?'active':''}" data-action="supervisor-intake-mode" data-mode="${key}" ${active?'':'disabled'}><strong>${item.label}</strong><small>${key==='busy'?'Shorter arrival gaps':key==='recovery'?'Longer arrival gaps':'Baseline arrival gaps'}</small></button>`).join('');
  const voiceRows=board.voice.slice(0,8).map(item=>`<form class="supervisor-triage-row" data-supervisor-triage="voice" data-contact-id="${escapeHTML(item.id)}"><div class="supervisor-contact-copy"><strong>${escapeHTML(item.customer)}</strong><small>${escapeHTML(item.issue)} · ${formatWait(item.waitSeconds)} waiting</small></div><label><span>Priority</span><select name="priority">${SUPERVISOR_PRIORITIES.map(value=>`<option value="${value}" ${item.priority===value?'selected':''}>${value.toUpperCase()}</option>`).join('')}</select></label><label><span>Route</span><select name="routeGroup">${[...new Set([item.routeGroup,...SUPERVISOR_ROUTE_GROUPS])].map(value=>`<option value="${escapeHTML(value)}" ${item.routeGroup===value?'selected':''}>${escapeHTML(value)}</option>`).join('')}</select></label><label class="supervisor-reason"><span>Reason</span><input name="reason" maxlength="160" minlength="4" required placeholder="Triage reason"></label><button class="btn small secondary" type="submit">Save</button><span class="pill ${item.slaAtRisk?'red':item.priority==='critical'?'amber':'green'}">${item.slaAtRisk?'SLA RISK':item.priority.toUpperCase()}</span></form>`).join('');
  const digitalRows=board.digital.slice(0,8).map(item=>`<form class="supervisor-triage-row digital" data-supervisor-triage="digital" data-contact-id="${escapeHTML(item.id)}"><div class="supervisor-contact-copy"><strong>${escapeHTML(item.subject)}</strong><small>${escapeHTML(item.customer)} · ${escapeHTML(item.channelLabel||item.channel)} · ${formatWait(item.waitSeconds)} waiting</small></div><label><span>Priority</span><select name="priority">${SUPERVISOR_PRIORITIES.map(value=>`<option value="${value}" ${item.priority===value?'selected':''}>${value.toUpperCase()}</option>`).join('')}</select></label><label><span>Route</span><select name="routeGroup">${[...new Set([item.routeGroup,...SUPERVISOR_ROUTE_GROUPS])].map(value=>`<option value="${escapeHTML(value)}" ${item.routeGroup===value?'selected':''}>${escapeHTML(value)}</option>`).join('')}</select></label><label class="supervisor-reason"><span>Reason</span><input name="reason" maxlength="160" minlength="4" required placeholder="Triage reason"></label><button class="btn small secondary" type="submit">Save</button><span class="digital-sla-pill ${item.slaStatus}">${escapeHTML(item.slaDisplay || item.priority.toUpperCase())}</span></form>`).join('');
  state.supervisorRequests=normalizeSupervisorRequests(state.supervisorRequests);
  const escalationNow=new Date();
  const escalationMetrics=supervisorEscalationMetrics(state.supervisorRequests,escalationNow);
  const supervisorActor=state.applicantName||'Floor Supervisor';
  const open=state.supervisorRequests.filter(item=>item&&item.status==='open').sort((a,b)=>{const rank={critical:0,high:1,normal:2};return (rank[a.escalation?.priority]??3)-(rank[b.escalation?.priority]??3)||Date.parse(a.createdAt||0)-Date.parse(b.createdAt||0);});
  const escalationRows=open.map(item=>supervisorEscalationCard(item,supervisorActor,escalationNow)).join('');
  const customerRiskRows=(board.customerRiskItems||[]).map(item=>`<div class="case-item customer-risk-row"><div class="case-symbol">!</div><div class="case-copy"><strong>${escapeHTML(item.customer)} · ${escapeHTML(item.subject||'Digital contact')}</strong><small>${escapeHTML(item.channel)} · ${escapeHTML(item.mood)} · sentiment ${item.sentiment}/100 · ${escapeHTML(item.reason)}</small></div><span class="pill amber">INTERVENTION</span></div>`).join('');
  const audit=[...(control.history||[]).map(item=>({...item,kind:'intake'})),...(state.supervisorQueueAudit||[])].sort((a,b)=>Date.parse(b.at||0)-Date.parse(a.at||0)).slice(0,12);
  const auditRows=audit.map(item=>`<div class="timeline-row"><time>${new Date(item.at).toLocaleTimeString()}</time><div><strong>${escapeHTML(item.message||`${item.action||'Queue triage'}: ${item.from||''} → ${item.to||''}`)}</strong><small>${escapeHTML(item.reference||item.reason||'Supervisor control')} · ${escapeHTML(item.actor||'Supervisor')}</small></div></div>`).join('');
  viewRoot.innerHTML=`
    <div class="ops-summary-grid">${metricCard('VOICE WAITING',board.voiceWaiting,'Simulated inbound calls','↙')}${metricCard('DIGITAL WAITING',board.digitalWaiting,'Email, live chat and social','✉')}${metricCard('SLA AT RISK',board.slaAtRisk,'Open voice and digital contacts near or beyond target','⌁')}${metricCard('DIGITAL SLA BREACHES',board.digitalSlaBreached,'Open digital work beyond first-response target','!')}${metricCard('CUSTOMER ESCALATION RISK',board.customerEscalationRecommended+voiceBehaviourMetrics.supervisorRecommended,'Digital and voice conversations needing intervention','⚑')}${metricCard('AVG DIGITAL SENTIMENT',board.averageCustomerSentiment===null?'—':`${board.averageCustomerSentiment}/100`,'Open synthetic digital relationships','◉')}${metricCard('VOICE CUSTOMER RISK',voiceBehaviourMetrics.supervisorRecommended,'Live voice conversations needing intervention','☎')}${metricCard('VOICE INTERRUPTIONS',voiceBehaviourMetrics.interruptions,'Customer interruptions during live calls','↯')}${metricCard('VOICE SECURITY BREACHES',voiceBehaviourMetrics.securityBreaches,'Prohibited requests flagged in simulation','!')}${metricCard('ACTIVE DIGITAL WORK',board.activeDigital,'Concurrent agent response threads','↔')}</div>
    <section class="panel supervisor-control-panel" style="margin-top:14px">
      <div class="panel-head"><div><h3>Queue intake controls</h3><p>Pause/resume affects automatic voice arrivals; demand profiles adjust future voice and digital arrivals. These controls do not affect real providers.</p></div><span class="pill ${!state.shiftActive?'amber':control.paused?'amber':'green'}">${!state.shiftActive?'OFF SHIFT':control.paused?'INTAKE PAUSED':'INTAKE OPEN'}</span></div>
      <div class="supervisor-control-grid"><div class="supervisor-control-status"><span class="subtle-label">CURRENT INTAKE MODE</span><strong>${SUPERVISOR_INTAKE_MODES[control.mode].label}</strong><small>${SUPERVISOR_INTAKE_MODES[control.mode].description}</small><button class="btn ${control.paused?'primary':'outline'}" data-action="supervisor-toggle-intake" ${active?'':'disabled'}>${control.paused?'Resume new arrivals':'Pause new arrivals'}</button></div><div class="supervisor-mode-wrap"><span class="subtle-label">DEMAND PROFILE</span><div class="supervisor-mode-list">${modes}</div></div></div><label class="supervisor-control-reason"><span>SUPERVISOR CHANGE REASON · REQUIRED</span><input id="supervisorControlReason" maxlength="160" minlength="4" placeholder="For example: protect service levels while team clears backlog" ${active?'':'disabled'}></label>
      <div class="supervisor-intake-metrics"><div><span>Voice arrivals</span><strong>${live.arrivals}</strong></div><div><span>Voice abandoned</span><strong>${live.abandoned}</strong></div><div><span>Voice overflow</span><strong>${live.overflowed}</strong></div><div><span>Next voice arrival</span><strong>${control.paused?'Paused':live.nextArrivalInMinutes===null?'Stopped':`${Math.ceil(live.nextArrivalInMinutes)} min`}</strong></div><div><span>Voice queue ceiling</span><strong>24 waiting</strong></div><div><span>Digital arrivals</span><strong>${digitalLive.arrivals}</strong></div><div><span>Digital overflow</span><strong>${digitalLive.overflowed}</strong></div><div><span>Next digital arrival</span><strong>${digitalLive.nextArrivalInMinutes===null?'Stopped':`${Math.ceil(digitalLive.nextArrivalInMinutes)} min`}</strong></div></div>
      <p class="muted-note">Pausing stops new automatic voice arrivals but does not freeze waiting-customer patience. Existing customers may still abandon. Digital email, live-chat and social arrivals continue independently. Standard, Busy period and Recovery profiles adjust future voice and digital arrival intervals.</p>
    </section>
    <div class="grid two supervisor-queue-grid" style="margin-top:14px">
      <section class="panel"><div class="panel-head"><div><h3>Voice queue triage</h3><p>Change priority or destination for waiting calls. Every change requires a reason and is audited.</p></div><span class="pill">${board.voiceWaiting} WAITING</span></div>${voiceRows||'<div class="empty-state"><p>No inbound voice contacts are waiting.</p></div>'}</section>
      <section class="panel"><div class="panel-head"><div><h3>Digital queue triage</h3><p>Review waiting email, live-chat and social contacts against first-response deadlines.</p></div><span class="pill">${board.digitalWaiting} WAITING</span></div>${digitalRows||'<div class="empty-state"><p>No digital contacts are waiting.</p></div>'}</section>
    </div>
    <section class="panel" style="margin-top:14px"><div class="panel-head"><div><h3>Customer emotion watch</h3><p>Open voice and digital conversations where sentiment, patience or repeated dissatisfaction recommends supervisor intervention.</p></div><span class="pill ${(board.customerEscalationRecommended+voiceBehaviourMetrics.supervisorRecommended)?'amber':'green'}">${board.customerEscalationRecommended+voiceBehaviourMetrics.supervisorRecommended} AT RISK</span></div>${voiceRiskRows}${customerRiskRows||(!voiceRiskRows?'<div class="empty-state"><p>No open voice or digital conversations currently require customer-emotion intervention.</p></div>':'')}</section>
    <section class="panel supervisor-escalation-desk" style="margin-top:14px"><div class="panel-head"><div><h3>Supervisor escalation &amp; assistance desk</h3><p>Claim each request, work it under named ownership, track its response target and record evidence before closure.</p></div><span class="pill ${open.length?'amber':'green'}">${open.length} OPEN</span></div><div class="supervisor-escalation-metrics"><div><span>Unassigned</span><strong>${escalationMetrics.unassigned}</strong></div><div><span>Critical</span><strong>${escalationMetrics.critical}</strong></div><div><span>Overdue</span><strong>${escalationMetrics.overdue}</strong></div><div><span>Due soon</span><strong>${escalationMetrics.dueSoon}</strong></div><div><span>In progress</span><strong>${escalationMetrics.inProgress}</strong></div></div><p class="muted-note">Default response targets are illustrative local-simulation controls: critical 5 minutes, high 15 minutes and normal 30 minutes. They are not contractual SLAs. Each request retains its original channel and linked CRM/promise workflow.</p>${open.length?escalationRows:'<div class="empty-state"><h3>No open requests</h3><p>Agent assistance and case escalations will appear here during operations.</p></div>'}</section>
    <div class="grid two" style="margin-top:14px"><section class="panel"><div class="panel-head"><div><h3>Escalated and review cases</h3><p>Cases requiring specialist or QA attention.</p></div><span class="pill">${board.escalatedCases}</span></div>${board.escalatedCaseItems.length?board.escalatedCaseItems.slice().reverse().map(caseRow).join(''):'<p class="muted-note">No escalated cases recorded.</p>'}</section><section class="panel"><div class="panel-head"><div><h3>Supervisor audit trail</h3><p>Recent intake changes and queue triage decisions.</p></div><span class="pill">${audit.length} EVENTS</span></div>${auditRows||'<p class="muted-note">No supervisor control changes recorded.</p>'}</section></div>
    <section class="panel" style="margin-top:14px"><div class="panel-head"><div><h3>Operations activity</h3><p>Recent call, digital, queue and shift events.</p></div><span class="pill">${board.activeWork} ACTIVE WORK</span></div>${state.interactionTimeline.slice(-10).reverse().map(item=>`<div class="timeline-row"><time>${new Date(item.at).toLocaleTimeString()}</time><div><strong>${escapeHTML(item.message)}</strong><small>${escapeHTML(item.reference)} · ${escapeHTML(item.status)}</small></div></div>`).join('')||'<p class="muted-note">No operations events have been recorded.</p>'}</section>`;
}

function ensureOutboundWorklist() {
  const needsCreation = !Array.isArray(state.outboundWorklist) || state.outboundWorklist.length === 0;
  state.outboundWorklist = normalizeCampaignWorklist(state.outboundWorklist, outboundCampaigns, {
    day: state.day || 1,
    seed: state.queueSequence || 1,
    now: Date.now(),
    contactsPerCampaign: 8,
    maxAttempts: 3
  });
  if (needsCreation) {
    for (const campaign of outboundCampaigns) {
      const first = findCampaignContact(state.outboundWorklist, `CMP-${campaign.id}-001`);
      if (!first) continue;
      const legacyCallback = state.callbacks.find(item => item.type === 'outbound' && item.campaignId === campaign.id && item.customer === campaign.customer && item.status === 'scheduled');
      const legacyAttempt = state.outboundAttempts.find(item => item.campaignId === campaign.id && item.customer === campaign.customer);
      const legacySuppressed = isContactSuppressed(first.customer, state.outboundSuppressions);
      if (legacySuppressed || legacyAttempt?.suppressed || legacyAttempt?.suppressionRequested) {
        first.status = 'suppressed';
        first.lastOutcome = 'opt_out';
        first.attempts = Math.max(1, Number(legacyAttempt?.attempts) || 1);
      } else if (legacyCallback) {
        first.status = 'callback_scheduled';
        first.callbackDueAt = legacyCallback.dueAt;
        first.attempts = Math.max(1, Number(legacyAttempt?.attempts) || 1);
        legacyCallback.campaignContactId = first.id;
      } else if (legacyAttempt || state.outboundDone.includes(campaign.id)) {
        first.status = legacyAttempt?.outcome === 'Review required' ? 'review_required' : 'completed';
        first.lastOutcome = legacyAttempt?.outcome || 'completed';
        first.attempts = Math.max(1, Number(legacyAttempt?.attempts) || 1);
      }
    }
    saveState();
  }
  return state.outboundWorklist;
}

function activeOutboundTask(active = state.activeOutbound) {
  if (!active) return null;
  const template = outboundCampaigns.find(item => item.id === active.campaignId);
  if (!template) return null;
  const snapshot = active.contactSnapshot || {};
  return { ...template, customer: snapshot.customer || template.customer, initials: snapshot.initials || template.initials, campaignContactId: active.campaignContactId || snapshot.campaignContactId || null };
}

function ensureActiveOutboundWorkItem(active, template) {
  if (!active || !template) return null;
  const worklist = ensureOutboundWorklist();
  let item = findCampaignContact(worklist, active.campaignContactId);
  if (!item) item = worklist.find(contact => contact.campaignId === template.id && contact.customer === (active.contactSnapshot?.customer || template.customer));
  if (!item) return null;
  if (item.status !== 'in_progress') {
    try { startCampaignContact(worklist, item.id, { attemptId: active.attemptId, agentName: state.applicantName || 'Customer Experience Agent', now: active.startedAt || Date.now(), shiftOpen: true, agentAvailable: true }); }
    catch (error) { if (item.status === 'ready') throw error; }
  }
  active.campaignContactId = item.id;
  active.contactSnapshot = { customer: item.customer, initials: item.initials, campaignContactId: item.id };
  active.attemptNumber = active.attemptNumber || item.attempts || 1;
  active.maxAttempts = item.maxAttempts || 3;
  active.connectionOutcome = active.connectionOutcome || 'answered';
  return item;
}

function renderOutbound() {
  if(state.wrapUp?.type==='outbound')return renderWrapUp();
  if (!state.shiftActive) { viewRoot.innerHTML = renderShiftEntryPanel('Start your shift first','Outbound campaigns are available during an active simulated shift.'); return; }
  if (state.activeOutbound) {
    const active=state.activeOutbound;
    const campaignTemplate=outboundCampaigns.find(item => item.id === active.campaignId);
    if(campaignTemplate)ensureActiveOutboundWorkItem(active,campaignTemplate);
    const task=activeOutboundTask(active);
    if(!task){viewRoot.innerHTML='<div class="panel empty-state"><h3>Campaign record unavailable</h3><p>The active outbound interaction has not been silently closed.</p><button class="btn secondary" data-action="end-outbound">End simulated attempt safely</button></div>';return;}
    const continuityPanel = renderCustomerContinuityPanel(task.customer, 'outbound_voice', { customerRef: task.customerRef });
    if (active.connectionOutcome && active.connectionOutcome !== 'answered') {
      const contact = findCampaignContact(state.outboundWorklist, active.campaignContactId);
      const resultLabel = active.connectionOutcome === 'no_answer' ? 'No answer' : active.connectionOutcome === 'busy' ? 'Line busy' : 'Voicemail reached';
      const retryDelay = RETRY_DELAYS_MS[active.connectionOutcome] || 0;
      viewRoot.innerHTML = `<div class="panel dialler-result-panel"><div class="call-console-head"><div><strong>OUTBOUND DIALLER · ATTEMPT RESULT</strong><small>${escapeHTML(task.title)} · ${escapeHTML(task.customer)} · ${escapeHTML(active.attemptId)}</small></div><span class="pill amber">${escapeHTML(resultLabel.toUpperCase())}</span></div><div class="call-console-body"><div class="subtle-label">CUSTOMER CONNECTION RESULT</div><h2>${escapeHTML(resultLabel)}</h2><p>${active.connectionOutcome==='no_answer'?'The contact did not answer. No customer conversation was opened.':active.connectionOutcome==='busy'?'The line was busy. No customer conversation was opened.':'The call reached voicemail. No customer conversation was opened.'}</p><div class="ops-summary-grid">${metricCard('ATTEMPT',`${active.attemptNumber}/${contact?.maxAttempts||3}`,'Recorded campaign attempt','↗')}${metricCard('CONTACT STATUS','After-contact work','Disposition required','▤')}${metricCard('RETRY POLICY',`${Math.round(retryDelay/60000)} min`,'Simulated cooling-off period','◷')}</div><p class="muted-note">Record the dial result accurately. The worklist enforces the maximum attempt count and retry delay; it will not create an immediate redial.</p><div class="assessment-footer"><small>All dial outcomes are deterministic fictional simulation events.</small><button class="btn primary" data-action="complete-outbound-step">Record attempt outcome →</button><button class="btn outline" data-action="end-outbound">End attempt for review</button></div></div></div>`;
      return;
    }
    if(!active.conversation||active.conversation.type!=='outbound_campaign_conversation'){
      active.conversation=createOutboundConversation({id:active.attemptId,campaign:active.callbackId?{...task,contactPreference:'callback'}:task,agentName:state.applicantName||'Customer Experience Agent',seed:active.attemptId,now:queueSimulationNowMs()});
      active.suppressionRequested=!!active.conversation.suppressionRequested;
      active.disposition=active.conversation.dispositionHint||active.disposition||null;
      if(active.suppressionRequested&&!isContactSuppressed(task.customer,state.outboundSuppressions)){
        addSuppression(state.outboundSuppressions,task.customer,'Customer requested no further campaign contact',queueSimulationNowMs());
        pushOperationEvent('campaign',active.attemptId,'Customer do-not-contact request added to suppression register.','suppressed',{campaignId:task.id,campaignContactId:active.campaignContactId});
      }
      saveState();
    }
    const conversation=active.conversation;
    const summary=outboundConversationSummary(conversation);
    active.score=summary.averageScore===null?0:(summary.averageScore/100)*6;
    active.breach=summary.criticalBreaches.length>0;
    active.suppressionRequested=summary.suppressionRequested;
    active.disposition=conversation.dispositionHint||active.disposition||null;
    const messages=conversation.messages.map(item=>`<article class="outbound-live-message ${item.speaker==='customer'?'customer':'agent'}"><header><strong>${item.speaker==='customer'?escapeHTML(task.customer):'YOU · AGENT'}</strong><time>${escapeHTML(new Date(item.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))}</time></header><p>${escapeHTML(item.text)}</p></article>`).join('');
    const latest=[...conversation.messages].reverse().find(item=>item.speaker==='customer');
    const ready=conversation.status==='ready_for_wrap_up'||conversation.status==='escalated';
    const supervisorOpen=state.supervisorRequests.some(item=>item.contactId===active.attemptId&&item.status==='open');
    const stateLabel=conversation.status==='escalated'?'SUPERVISOR / COMPLIANCE REVIEW':summary.suppressionRequested?'DO NOT CONTACT · SUPPRESSION REQUIRED':summary.callbackRequested?'CUSTOMER CALLBACK REQUESTED':ready?'READY FOR AFTER-CONTACT WORK':summary.permissionToContinue?'CUSTOMER AGREED TO CONTINUE':'INTRODUCTION & PERMISSION';
    const responseForm=ready?'':`<form id="outboundCampaignReplyForm" class="outbound-live-reply"><label for="outboundAgentReply">YOUR RESPONSE TO THE CUSTOMER</label><textarea id="outboundAgentReply" name="reply" rows="3" minlength="12" maxlength="1000" required placeholder="Respond in your own words. Identify yourself, explain the actual purpose, ask permission and address the customer's concern."></textarea><div class="outbound-live-reply-foot"><small>Live simulated campaign contact. Respect refusal and opt-out immediately. Never request PINs, passwords, OTPs or full payment-card details.</small><button class="btn primary" type="submit">Send response →</button></div></form>`;
    const outcome=ready?`<div class="call-feedback ${conversation.status==='escalated'?'bad':summary.suppressionRequested?'neutral':'good'}"><strong>${escapeHTML(stateLabel)}</strong><p>${escapeHTML(String(conversation.dispositionHint||'review').replaceAll('_',' '))}</p><small>Complete factual notes and select only the permitted final disposition.</small></div>`:'';
    viewRoot.innerHTML=`<div class="call-layout outbound-live-layout"><section class="panel call-console"><div class="call-console-head"><div><strong>OUTBOUND CAMPAIGN · LIVE CUSTOMER CONVERSATION</strong><small>${escapeHTML(task.type)} · ${escapeHTML(task.title)} · ${escapeHTML(active.attemptId)} · Attempt ${active.attemptNumber||1}</small></div><span class="pill ${ready?'amber':'green'}">${ready?'WRAP-UP READY':'SIMULATED CONTACT'}</span></div><div class="call-console-body"><div class="customer-strip"><div class="customer-avatar">${escapeHTML(task.initials||'CX')}</div><div class="customer-info"><strong>${escapeHTML(task.customer)}</strong><small>Fictional campaign contact · ${escapeHTML(task.type)} · ${escapeHTML(active.campaignContactId||'LEGACY CONTACT')}</small></div><span class="pill">OUTBOUND</span></div><div class="subtle-label">CONTACT PURPOSE</div><p class="call-prompt">${escapeHTML(task.objective||task.title)}</p><p class="call-context">${escapeHTML(task.context||'Approved synthetic campaign scenario.')}</p><div class="outbound-live-metrics"><span>Customer preference <b>${escapeHTML(summary.preference.replaceAll('_',' '))}</b></span><span>Patience <b>${conversation.patience}%</b></span><span>Turns <b>${summary.turns}</b></span><span>Interaction QA <b>${summary.averageScore===null?'PENDING':summary.averageScore+'%'}</b></span></div><section class="outbound-live-transcript" aria-label="Outbound customer conversation">${messages}</section>${outcome}${responseForm}<div class="outbound-live-actions"><button class="btn outline" data-action="play-outbound-customer" ${latest?'':'disabled'}>Play customer voice</button><button class="btn outline" data-action="request-outbound-supervisor" ${supervisorOpen?'disabled':''}>${supervisorOpen?'Supervisor requested':'Request supervisor'}</button>${ready?'<button class="btn primary" data-action="complete-outbound-step">Proceed to after-contact work</button>':''}</div></div></section><aside class="call-side-stack">${continuityPanel}<section class="panel"><div class="panel-head"><div><h3>Campaign & customer record</h3><p>Outbound contact context.</p></div><span class="pill">SIMULATED CRM</span></div><div class="data-list"><div class="data-row"><span>Campaign</span><strong>${escapeHTML(task.title)}</strong></div><div class="data-row"><span>Contact</span><strong>${escapeHTML(task.customer)}</strong></div><div class="data-row"><span>Campaign contact ID</span><strong>${escapeHTML(active.campaignContactId||'Legacy')}</strong></div><div class="data-row"><span>Attempt</span><strong>${active.attemptNumber||1} of ${active.maxAttempts||3}</strong></div><div class="data-row"><span>Permission to continue</span><strong>${summary.permissionToContinue?'Recorded':'Not established'}</strong></div><div class="data-row"><span>Callback request</span><strong>${summary.callbackRequested?'Requested':'None recorded'}</strong></div><div class="data-row"><span>Suppression</span><strong>${summary.suppressionRequested?'Required':'Not requested'}</strong></div><div class="data-row"><span>Compliance flags</span><strong>${summary.criticalBreaches.length}</strong></div></div></section><section class="panel"><div class="panel-head"><div><h3>Outbound contact rules</h3><p>Required conduct throughout the contact.</p></div></div><ul class="outbound-live-policy"><li>Identify yourself and the organisation honestly.</li><li>State the real reason for the call.</li><li>Ask whether the customer can speak now.</li><li>Respect refusal and do-not-contact requests immediately.</li><li>Never request PINs, passwords, OTPs or full card details.</li><li>Record callbacks only when the customer requests or agrees.</li></ul><p class="muted-note">This is a synthetic game simulation. It does not place calls or establish legal consent for real campaigns.</p><button class="btn outline" style="width:100%" data-action="end-outbound">End attempt without completion credit</button></section></aside></div>`;
    return;
  }
  const worklist=ensureOutboundWorklist();
  const now=Date.now();
  const suppressed=state.outboundSuppressions||[];
  const metrics=campaignWorklistMetrics(worklist,{now});
  const outboundCallbacks=state.callbacks.filter(item=>item.type==='outbound'&&item.status==='scheduled').sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt));
  const dueCallbacks=outboundCallbacks.filter(item=>Date.parse(item.dueAt)<=now&&!isContactSuppressed(item.customer,suppressed));
  const agentReady=state.agentStatus==='available'&&shiftTimeAvailable();
  const campaignCards=outboundCampaigns.map(c=>{
    const contacts=worklist.filter(item=>item.campaignId===c.id).sort((a,b)=>a.sequence-b.sequence);
    const rows=contacts.map(contact=>{
      const blocked=isContactSuppressed(contact.customer,suppressed)||contact.status==='suppressed';
      const eligibility=campaignContactEligibility(contact,{now,suppressed:blocked,shiftOpen:true,agentAvailable:true});
      const startAllowed=eligibility.allowed&&agentReady&&contact.status!=='callback_scheduled';
      const status=campaignContactStatusLabel(contact,now);
      const statusClass=blocked||contact.status==='review_required'?'blocked':startAllowed?'ready':contact.status==='completed'?'complete':'waiting';
      const action=startAllowed?`<button class="btn small primary" data-start-campaign="${escapeHTML(c.id)}" data-contact-id="${escapeHTML(contact.id)}">Dial</button>`:`<span class="campaign-contact-state ${statusClass}">${escapeHTML(status)}</span>`;
      return `<div class="campaign-contact-row"><div><strong>${escapeHTML(contact.customer)}</strong><small>${escapeHTML(contact.id)} · ${contact.attempts}/${contact.maxAttempts} attempts</small></div><div class="campaign-contact-right"><span class="campaign-contact-state ${statusClass}">${escapeHTML(status)}</span>${action}</div></div>`;
    }).join('');
    const campaignDone=contacts.filter(item=>['completed','suppressed','review_required','exhausted'].includes(item.status)).length;
    const campaignEligible=contacts.filter(item=>campaignContactEligibility(item,{now,suppressed:isContactSuppressed(item.customer,suppressed),shiftOpen:true,agentAvailable:true}).allowed).length;
    return `<section class="panel campaign-card"><div class="subtle-label">${escapeHTML(c.type)}</div><h3>${escapeHTML(c.title)}</h3><p class="muted-note">${escapeHTML(c.context)}</p><div class="campaign-contact-summary"><span>${contacts.length} synthetic contacts</span><span>${campaignEligible} eligible</span><span>${campaignDone} closed</span></div><div class="campaign-contact-list">${rows}</div></section>`;
  }).join('');
  viewRoot.innerHTML = `<div class="panel"><div class="panel-head"><div><h3>Outbound campaign dialler</h3><p>Campaign worklists, eligible retries, customer-requested callbacks and compliance suppression.</p></div><span class="pill green">${metrics.total} CONTACTS IN POOL</span></div><div class="ops-summary-grid">${metricCard('ELIGIBLE TO DIAL',metrics.eligible,'Ready, retry due or callback due','↗')}${metricCard('TOTAL ATTEMPTS',metrics.attempts,'All recorded campaign attempts','☎')}${metricCard('CALLBACKS DUE',metrics.callbacksDue,'Customer-requested returns','◷')}${metricCard('COMPLETED',metrics.completed,'Contacts closed with an outcome','✓')}</div><div class="ops-summary-grid" style="margin-top:10px">${metricCard('SUPPRESSED',metrics.suppressed,'Do-not-contact register','⊘')}${metricCard('REVIEW REQUIRED',metrics.reviewRequired,'Supervisor / compliance attention','!')}${metricCard('RETRY WAITING',metrics.retryWaiting,'Cooling-off period not complete','◷')}${metricCard('ATTEMPT LIMIT',metrics.exhausted,'Maximum attempts reached','—')}</div><div class="grid two" style="margin-top:14px">${campaignCards}</div><p class="muted-note" style="margin-top:14px">All worklist contacts and dial outcomes are fictional game records. The default simulated contact window is 08:00–17:00 Africa/Lagos. Real outbound contact needs organisation-approved lawful basis, consent, suppression and contact-window rules.</p>${suppressed.length?`<div class="article-box"><h4>Suppression register</h4>${suppressed.map(item=>`<div class="data-row"><span>${escapeHTML(item.contactKey)}</span><strong>${escapeHTML(item.reason)}</strong></div>`).join('')}</div>`:''}<div class="article-box"><h4>Scheduled outbound callbacks</h4>${outboundCallbacks.length?outboundCallbacks.map(item=>{const due=callbackIsDue(item);const blocked=isContactSuppressed(item.customer,suppressed);return `<div class="case-item"><div class="case-symbol">◷</div><div class="case-copy"><strong>${escapeHTML(item.customer)}</strong><small>${escapeHTML(item.issue)} · Due ${new Date(item.dueAt).toLocaleString()}</small></div><button class="btn small secondary" data-action="resume-outbound-callback" data-callback-id="${escapeHTML(item.id)}" ${due&&!blocked&&agentReady?'':'disabled'}>${blocked?'Suppressed':due?'Call back':'Scheduled'}</button></div>`;}).join(''):'<p class="muted-note">No outbound callbacks scheduled.</p>'}</div><div class="article-box"><h4>Recent outbound outcomes</h4>${state.outboundAttempts.length?state.outboundAttempts.slice(-8).reverse().map(item=>`<div class="data-row"><span>${escapeHTML(item.customer)}<small>${escapeHTML(item.id)} · ${escapeHTML(item.campaignId)} · ${escapeHTML(item.connectionOutcome||'answered')}</small></span><strong>${escapeHTML(item.outcome)}</strong></div>`).join(''):'<p class="muted-note">No outbound attempts recorded yet.</p>'}</div></div>`;
}

function caseRow(c) { return `<div class="case-item"><div class="case-symbol">${c.channel==='Outbound'?'↗':['Email','Live chat','Social media'].includes(c.channel)?'✉':'↙'}</div><div class="case-copy"><strong>${escapeHTML(c.title)}</strong><small>${escapeHTML(c.customer)} · ${escapeHTML(c.reference)}</small></div><span class="pill ${c.status==='Resolved'?'green':'amber'}">${escapeHTML(c.status)}</span></div>`; }

function renderCommitments(){
  const items=CommitmentEngine.listForAgent(commitmentStore(),{name:state.applicantName},commitmentShiftSnapshot());
  const due=items.filter(item=>['Due','Overdue'].includes(item.timing.state)).length;
  const overdue=items.filter(item=>item.timing.state==='Overdue').length;
  const review=items.filter(item=>item.timing.state==='Needs review').length;
  if(!items.some(item=>item.id===selectedCommitmentId))selectedCommitmentId=items[0]?.id||'';
  const selected=items.find(item=>item.id===selectedCommitmentId)||null;
  const rows=items.map(item=>{
    const selectedClass=item.id===selectedCommitmentId?' selected':'';
    const statusClass=item.timing.state==='Overdue'||item.timing.state==='Needs review'?'red':item.timing.state==='Due'?'amber':'green';
    return `<button type="button" class="commitment-row${selectedClass}" data-commitment-id="${escapeHTML(item.id)}"><span class="commitment-row-main"><strong>${escapeHTML(item.customerName)} · ${escapeHTML(item.contactReference)}</strong><small>${escapeHTML(item.commitment)}</small><small>${escapeHTML(item.dueDate)} · ${CommitmentEngine.formatClock(item.dueMinutes)} · ${escapeHTML(item.preferredChannel)} · ${item.attempts} attempt(s)</small></span><span class="pill ${statusClass}">${escapeHTML(item.timing.state.toUpperCase())}</span></button>`;
  }).join('');
  let actionPanel='<div class="empty-state"><h3>No callback selected</h3><p>Select an outstanding customer promise to review its due time and recorded history.</p></div>';
  if(selected){
    const history=(selected.history||[]).map(entry=>`<div class="timeline-row"><time>${new Date(entry.at).toLocaleString()}</time><div><strong>${escapeHTML(entry.outcome||'Attempt')}</strong><small>${escapeHTML(entry.summary||entry.reviewer||'No additional detail')}</small></div></div>`).join('');
    if(selected.timing.state==='Needs review'){
      actionPanel=`<div class="commitment-detail"><div class="panel-head"><div><h3>${escapeHTML(selected.customerName)}</h3><p>${escapeHTML(selected.caseId||selected.contactReference)} · ${escapeHTML(selected.owner)}</p></div><span class="pill red">INDEPENDENT REVIEW REQUIRED</span></div><div class="article-box"><h4>Customer promise</h4><p>${escapeHTML(selected.commitment)}</p><p>Due ${escapeHTML(selected.dueDate)} · ${CommitmentEngine.formatClock(selected.dueMinutes)} · Attempts ${selected.attempts}/${CommitmentEngine.MAX_ATTEMPTS}</p><p>Last outcome: ${escapeHTML(selected.lastSummary||'No summary recorded.')}</p></div><form id="commitmentReviewForm"><div class="form-field"><label>INDEPENDENT SUPERVISOR / MANAGER</label><input name="reviewer" required minlength="2" maxlength="100" placeholder="Enter reviewer name"></div><div class="form-field"><label>REVIEW DECISION · MINIMUM 20 CHARACTERS</label><textarea name="summary" required minlength="20" maxlength="500" rows="3" placeholder="Explain the review decision and the next operational owner."></textarea></div><button class="btn primary" type="submit">Close after independent review</button></form><div class="commitment-history">${history}</div></div>`;
    }else if(['Due','Overdue'].includes(selected.timing.state)){
      const linked=state.callbacks.find(row=>row.commitmentId===selected.id&&['scheduled','queued','in_progress'].includes(row.status));
      const linkedLabel=linked?.status==='queued'?'Callback is already in the inbound queue':linked?.status==='in_progress'?'Callback is currently being handled':'Open the appropriate agent desk to place the promised return contact.';
      actionPanel=`<div class="commitment-detail"><div class="panel-head"><div><h3>${escapeHTML(selected.customerName)}</h3><p>${escapeHTML(selected.caseId||selected.contactReference)} · ${escapeHTML(selected.preferredChannel)} · Owner ${escapeHTML(selected.owner)}</p></div><span class="pill ${selected.timing.state==='Overdue'?'red':'amber'}">${escapeHTML(selected.timing.state.toUpperCase())}</span></div><div class="article-box"><h4>Promised customer outcome</h4><p>${escapeHTML(selected.commitment)}</p><p>Due ${escapeHTML(selected.dueDate)} · ${CommitmentEngine.formatClock(selected.dueMinutes)} · ${selected.timing.deltaMinutes<0?`${Math.abs(selected.timing.deltaMinutes)} simulated minutes overdue`:`${selected.timing.deltaMinutes} simulated minutes remaining`}</p></div><div class="article-box"><h4>Operational next step</h4><p>${escapeHTML(linkedLabel)}</p>${linked?`<button class="btn primary" data-action="open-commitment-callback" data-callback-id="${escapeHTML(linked.id)}" ${linked.status==='in_progress'?'disabled':''}>${linked.status==='queued'?'Open inbound queue':linked.type==='outbound'?'Open outbound callback desk':'Open inbound callback desk'}</button>`:'<p class="muted-note">No live callback task is linked. Review the case and supervisor assignment before recording any customer contact.</p>'}</div><div class="commitment-history">${history}</div></div>`;
    }else{
      actionPanel=`<div class="commitment-detail"><div class="panel-head"><div><h3>${escapeHTML(selected.customerName)}</h3><p>${escapeHTML(selected.caseId||selected.contactReference)} · ${escapeHTML(selected.owner)}</p></div><span class="pill green">${escapeHTML(selected.timing.state.toUpperCase())}</span></div><div class="article-box"><h4>Customer promise</h4><p>${escapeHTML(selected.commitment)}</p><p>Due ${escapeHTML(selected.dueDate)} · ${CommitmentEngine.formatClock(selected.dueMinutes)}</p>${selected.timing.state==='Due soon'?`<p>${selected.timing.deltaMinutes} simulated minutes until due.</p>`:'<p>Wait until the agreed due time before recording a callback attempt.</p>'}</div><div class="commitment-history">${history}</div></div>`;
    }
  }
  viewRoot.innerHTML=`<div class="ops-summary-grid">${metricCard('OPEN PROMISES',items.length,'Assigned to this employee','◷')}${metricCard('DUE NOW',due,'Ready for callback outcome','!')}${metricCard('OVERDUE',overdue,'Past agreed simulated due time','⌛')}${metricCard('SUPERVISOR REVIEW',review,'Attempt limit reached','⚑')}</div><div class="grid two commitment-workspace" style="margin-top:14px"><section class="panel"><div class="panel-head"><div><h3>My customer commitments</h3><p>Every callback promise has a named owner, explicit due time and outcome history.</p></div><span class="pill">${items.length} OPEN</span></div><div class="commitment-list">${rows||'<div class="empty-state"><h3>No outstanding promises</h3><p>When a customer asks for a callback, record the commitment during after-contact work. It will appear here with a clear due time.</p></div>'}</div></section><section class="panel">${actionPanel}</section></div><section class="panel" style="margin-top:14px"><div class="panel-head"><div><h3>Commitment operating rules</h3><p>Callbacks are measured against the accelerated simulated shift clock, not the computer wall clock.</p></div><span class="pill green">AUDITABLE</span></div><div class="grid three"><div class="article-box"><h4>Named ownership</h4><p>Each customer promise is assigned to the employee who made it. The employee cannot independently sign off a review after repeated unsuccessful attempts.</p></div><div class="article-box"><h4>Due-time controls</h4><p>Same-shift, next-working-day and two-working-day plans use the simulator calendar and skip weekends for working-day commitments.</p></div><div class="article-box"><h4>Attempt governance</h4><p>Two unsuccessful attempts move the commitment to independent supervisor review. Each attempt requires factual notes.</p></div></div></section>`;
}


function renderPromiseControl(){
  if(!PromiseControlEngine||!CommitmentEngine){viewRoot.innerHTML='<div class="empty-state"><h3>Promise control is unavailable</h3><p>Reload the application to initialise the customer promise engines.</p></div>';return;}
  const dashboard=PromiseControlEngine.buildPortfolio(commitmentStore(),commitmentShiftSnapshot(),state.callbacks,state.supervisorRequests);
  const metrics=dashboard.metrics;
  const riskLabels={critical:'CRITICAL',urgent:'DUE NOW',at_risk:'AT RISK',watch:'WATCH',normal:'SCHEDULED'};
  const riskClass={critical:'red',urgent:'amber',at_risk:'amber',watch:'',normal:'green'};
  const rows=dashboard.rows.map(item=>{
    const risk=item.control.risk;
    const timing=item.timing;
    const dueText=`${item.dueDate} · ${CommitmentEngine.formatClock(item.dueMinutes)}`;
    const delta=timing.deltaMinutes;
    const deltaText=delta===null?'No active simulated shift':delta<0?`${Math.abs(delta)} simulated minutes late`:delta===0?'Due now':`${delta} simulated minutes remaining`;
    const callbackText=item.control.linkedCallback?item.control.callbackStatus.replaceAll('_',' '):item.control.missingCallbackTask?'No live callback task':'Not yet due';
    const escalationText=item.control.escalationOpen?'Supervisor action open':'No escalation';
    const canRaise=!item.control.escalationOpen&&['critical','urgent','at_risk'].includes(risk);
    return `<tr class="promise-risk-row ${risk}"><td><strong>${escapeHTML(item.customerName)}</strong><small>${escapeHTML(item.contactReference)} · ${escapeHTML(item.caseId||'No case reference')}</small></td><td><strong>${escapeHTML(item.owner)}</strong><small>${escapeHTML(item.team||'Customer Care')} · ${escapeHTML(item.preferredChannel||'Voice')}</small></td><td>${escapeHTML(item.commitment)}<small>${escapeHTML(item.subject||'Customer callback commitment')}</small></td><td><strong>${escapeHTML(dueText)}</strong><small>${escapeHTML(deltaText)}</small></td><td><span class="pill ${riskClass[risk]}">${riskLabels[risk]}</span><small>${escapeHTML(timing.state)}</small></td><td><span class="promise-task-state ${item.control.missingCallbackTask?'missing':''}">${escapeHTML(callbackText)}</span><small>${escapeHTML(escalationText)}</small></td><td><div class="promise-row-actions"><button class="btn small outline" type="button" data-commitment-id="${escapeHTML(item.id)}">Open promise</button>${canRaise?`<button class="btn small primary" type="button" data-action="raise-promise-escalation" data-commitment-id="${escapeHTML(item.id)}">Escalate</button>`:''}</div></td></tr>`;
  }).join('');
  const ownerRows=dashboard.owners.map(owner=>`<tr><td><strong>${escapeHTML(owner.owner)}</strong></td><td>${owner.total}</td><td class="${owner.critical?'text-danger':''}">${owner.critical}</td><td>${owner.urgent}</td><td>${owner.atRisk}</td><td>${owner.needsCallbackTask}</td></tr>`).join('');
  const openEscalations=state.supervisorRequests.filter(item=>item&&item.status==='open'&&item.commitmentId);
  const currentSupervisor=state.applicantName||'Floor Supervisor';
  const escalationCards=openEscalations.map(item=>{normalizeSupervisorEscalation(item);const assigned=item.escalation.assignedTo;const isOwner=assigned&&assigned.toLowerCase()===currentSupervisor.toLowerCase();if(!isOwner)return `<article class="promise-escalation-card"><div class="promise-escalation-head"><div><strong>${escapeHTML(item.customer||'Customer')}</strong><small>${escapeHTML(item.reference||item.contactId||'')} · Assigned ${escapeHTML(assigned||'unassigned')} · ${escapeHTML(item.promiseRisk||'Review')}</small></div><span class="pill amber">OWNERSHIP REQUIRED</span></div><p>${escapeHTML(item.reason)}</p><p class="muted-note">${assigned?'Only the assigned supervisor can record the recovery action.':'Claim this request from the Supervisor desk before reviewing it.'}</p><button class="btn small outline" type="button" data-action="open-supervisor">Open Supervisor desk</button></article>`;return `<form class="promise-escalation-card" id="promiseEscalationReviewForm" data-request-id="${escapeHTML(item.id)}"><div class="promise-escalation-head"><div><strong>${escapeHTML(item.customer||'Customer')}</strong><small>${escapeHTML(item.reference||item.contactId||'')} · Assigned ${escapeHTML(assigned)} · ${escapeHTML(item.promiseRisk||'Review')}</small></div><span class="pill red">SUPERVISOR ACTION REQUIRED</span></div><p>${escapeHTML(item.reason)}</p><div class="form-grid two"><label class="form-field"><span>REVIEWING SUPERVISOR</span><input name="reviewer" required minlength="2" maxlength="100" value="${escapeHTML(currentSupervisor)}" readonly></label><label class="form-field"><span>RECOVERY ACTION / DECISION · 20+ CHARACTERS</span><textarea name="actionTaken" rows="2" required minlength="20" maxlength="500" placeholder="Document the owner, customer update or next operational step."></textarea></label></div><button class="btn primary" type="submit">Record review and action</button><small class="muted-note">Reviewing this escalation does not close the callback promise. The customer outcome must still be recorded from the linked agent callback workflow.</small></form>`;}).join('');
  viewRoot.innerHTML=`
    <div class="ops-summary-grid promise-control-metrics">${metricCard('OPEN PROMISES',metrics.open,'All employee-owned simulated commitments','◷')}${metricCard('OVERDUE / REVIEW',metrics.critical,'Past due by more than 30 minutes or awaiting independent review','!')}${metricCard('DUE NOW',metrics.dueNow,'Callback window reached','⌛')}${metricCard('AT RISK',metrics.atRisk,'Due within the next 30 simulated minutes','⚑')}${metricCard('MISSING CALLBACK TASK',metrics.missingCallbackTask,'Due promises without an active callback record','↗')}${metricCard('OPEN ESCALATIONS',metrics.escalated,'Supervisor action still outstanding','!')}</div>
    <section class="panel promise-control-panel" style="margin-top:14px"><div class="panel-head"><div><h3>Customer promise risk portfolio</h3><p>Portfolio view of outstanding employee commitments, simulated due times, active callback tasks and escalation status.</p></div><span class="pill ${metrics.critical||metrics.dueNow?'red':metrics.atRisk?'amber':'green'}">${metrics.open} OPEN</span></div><div class="table-wrap promise-control-table"><table><thead><tr><th>Customer / reference</th><th>Owner / team</th><th>Promised outcome</th><th>Agreed due time</th><th>Risk</th><th>Callback task</th><th>Action</th></tr></thead><tbody>${rows||'<tr><td colspan="7"><div class="empty-state"><h3>No open customer promises</h3><p>Callback commitments created during after-contact work will appear here for supervisory monitoring.</p></div></td></tr>'}</tbody></table></div><p class="muted-note">Timing uses the accelerated simulated shift calendar. Risk indicators are operational game rules, not a real-world SLA or guarantee that a callback has been placed.</p></section>
    <div class="grid two" style="margin-top:14px"><section class="panel"><div class="panel-head"><div><h3>Owner workload and exposure</h3><p>Outstanding commitments grouped by their recorded owner.</p></div><span class="pill">${dashboard.owners.length} OWNERS</span></div><div class="table-wrap"><table><thead><tr><th>Owner</th><th>Open</th><th>Critical</th><th>Due</th><th>At risk</th><th>No task</th></tr></thead><tbody>${ownerRows||'<tr><td colspan="6">No owner workload recorded.</td></tr>'}</tbody></table></div></section><section class="panel"><div class="panel-head"><div><h3>Promise-control rules</h3><p>Escalation supports recovery; it does not falsely close a customer promise.</p></div><span class="pill green">AUDIT TRAIL</span></div><div class="article-box"><h4>Risk windows</h4><p>Overdue and independent-review items are critical. Due-now commitments are urgent. Promises due within 30 simulated minutes are at risk.</p></div><div class="article-box"><h4>Supervisor accountability</h4><p>Escalations require a reason and a reviewer different from the original owner. The recovery action is recorded against the supervisor request.</p></div><div class="article-box"><h4>Closure boundary</h4><p>Reviewing an escalation does not mark the callback complete. Only the agent callback workflow or independent review of an attempt-limited promise can close it.</p></div></section></div>
    <section class="panel" style="margin-top:14px"><div class="panel-head"><div><h3>Supervisor promise escalations</h3><p>Record the recovery action, responsible supervisor and documented next step.</p></div><span class="pill ${openEscalations.length?'amber':'green'}">${openEscalations.length} OPEN</span></div>${escalationCards||'<div class="empty-state"><h3>No promise escalations awaiting review</h3><p>Escalate a due or at-risk commitment when a supervisor decision is required.</p></div>'}</section>`;
}

function openPromiseEscalationModal(commitmentId){
  const item=CommitmentEngine.getCommitment(commitmentStore(),commitmentId);
  if(!item){toast('Customer promise was not found.','warning');return;}
  const modal=openModal(`<div class="subtle-label">CUSTOMER PROMISE CONTROL</div><h3>Raise supervisor escalation</h3><p>${escapeHTML(item.customerName)} · ${escapeHTML(item.contactReference)} · Owner ${escapeHTML(item.owner)}</p><div class="article-box"><strong>${escapeHTML(item.commitment)}</strong><p>Due ${escapeHTML(item.dueDate)} · ${CommitmentEngine.formatClock(item.dueMinutes)}</p></div><form id="promiseEscalationRaiseForm" data-commitment-id="${escapeHTML(item.id)}"><div class="form-field"><label>WHY DOES THIS PROMISE NEED SUPERVISOR ACTION? · 20+ CHARACTERS</label><textarea name="reason" rows="4" required minlength="20" maxlength="500" placeholder="Explain the customer impact, missed deadline or recovery decision required."></textarea></div><div class="modal-actions"><button class="btn outline" type="button" data-close>Cancel</button><button class="btn primary" type="submit">Raise escalation</button></div></form>`);
  modal.querySelector('[data-close]')?.addEventListener('click',()=>modal.remove());
}

function caseLifecycleClock(){return {day:Math.max(1,Number(state.day)||1),minutes:simulationMinuteNow(),active:shiftTimeAvailable()};}
function renderCaseFollowUpPanel(caseRecord){
  const lifecycle=normalizeCaseLifecycle(caseRecord).lifecycle;
  const followUp=lifecycle.followUp;
  const eligibility=caseReopenEligibility(caseRecord);
  if(!followUp&&eligibility.eligible){
    return `<section class="case-followup-panel"><div class="case-followup-heading"><strong>Reopen this case</strong><span class="pill amber">RESOLUTION CHALLENGED</span></div><p class="muted-note">Use this when the customer reports the issue is unresolved, a previous action was incorrect, or new information changes the case. Reopening creates owned follow-up work; it does not erase the original case history.</p><form id="caseReopenForm" data-case-reference="${escapeHTML(caseRecord.reference)}"><div class="form-grid two"><label class="form-field"><span>REOPENING REASON</span><select name="category" required>${[['customer-says-unresolved','Customer says issue remains unresolved'],['incorrect-resolution','Incorrect previous resolution'],['new-information','New information received'],['repeat-contact','Repeat contact for same issue'],['service-failure','Service failure / missed action']].map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><label class="form-field"><span>FOLLOW-UP PRIORITY</span><select name="priority"><option value="normal">Normal · due in 120 simulated minutes</option><option value="urgent">Urgent · due in 30 simulated minutes</option></select></label></div><label class="form-field"><span>WHY IS THE CASE BEING REOPENED? · 20+ CHARACTERS</span><textarea name="reason" rows="2" required minlength="20" maxlength="500" placeholder="Record the customer's explanation and what was not resolved."></textarea></label><button class="btn primary" type="submit" ${shiftTimeAvailable()?'':'disabled'}>Reopen case & create follow-up</button><small class="muted-note">Reopening is available during an active shift. Follow-up due times use the accelerated CALLORIA workday clock.</small></form></section>`;
  }
  if(!followUp)return `<p class="muted-note">${escapeHTML(eligibility.reason||'This case is not currently eligible for reopening.')}</p>`;
  const risk=caseFollowUpRisk(caseRecord,caseLifecycleClock());
  const riskLabels={overdue:'OVERDUE',due_soon:'DUE SOON',on_track:'ON TRACK',paused_off_shift:'CLOCK PAUSED OFF SHIFT',supervisor_review:'SUPERVISOR REVIEW',complete:'FOLLOW-UP COMPLETE',clock_unavailable:'CLOCK UNAVAILABLE'};
  const history=(followUp.history||[]).slice(0,6).map(entry=>`<div class="timeline-row"><time>${entry.at?new Date(entry.at).toLocaleString():'—'}</time><div><strong>${escapeHTML(String(entry.action||'activity').replaceAll('_',' '))}</strong><small>${escapeHTML(entry.actor||entry.reviewer||'')}${entry.summary?` · ${escapeHTML(entry.summary)}`:''}</small></div></div>`).join('');
  let action='';
  if(followUp.status==='open'){
    action=`<p>Assigned to <strong>${escapeHTML(followUp.owner||'Unassigned')}</strong>. Reason: ${escapeHTML(followUp.reason)}</p><button class="btn primary" data-action="case-followup-start" data-case-reference="${escapeHTML(caseRecord.reference)}" ${shiftTimeAvailable()?'':'disabled'}>Claim & start follow-up</button>`;
  }else if(followUp.status==='in_progress'){
    action=`<p>Being handled by <strong>${escapeHTML(followUp.claimedBy||'Agent')}</strong>. Record factual work and the actual customer outcome.</p><form id="caseFollowUpCompleteForm" data-case-reference="${escapeHTML(caseRecord.reference)}"><label class="form-field"><span>FOLLOW-UP OUTCOME</span><select name="outcome"><option value="resolved">Resolved — customer confirmed</option><option value="pending_customer">Awaiting customer response</option><option value="escalated">Escalate for supervisor decision</option></select></label><label class="case-confirm-check"><input type="checkbox" name="customerConfirmed" value="yes"><span>Customer explicitly confirmed the issue is resolved</span></label><label class="form-field"><span>FOLLOW-UP EVIDENCE / ACTIONS · 30+ CHARACTERS</span><textarea name="summary" rows="3" required minlength="30" maxlength="1000" placeholder="Record checks performed, action taken, customer response and next step."></textarea></label><button class="btn primary" type="submit">Save follow-up outcome</button></form>`;
  }else if(followUp.status==='supervisor_review'){
    action=`<p>Supervisor review is required. The employee cannot close this follow-up themselves.</p><form id="caseFollowUpReviewForm" data-case-reference="${escapeHTML(caseRecord.reference)}"><label class="form-field"><span>SUPERVISOR DECISION</span><select name="decision"><option value="return_to_agent">Return to agent for further action</option><option value="close_after_review">Close after independent verification</option></select></label><label class="form-field"><span>REVIEWING SUPERVISOR</span><input name="reviewer" required minlength="2" maxlength="100" value="${escapeHTML(state.applicantName||'')}" placeholder="Supervisor name"></label><label class="case-confirm-check"><input type="checkbox" name="customerConfirmed" value="yes"><span>Customer explicitly confirmed resolution (required to close)</span></label><label class="form-field"><span>SUPERVISOR REVIEW EVIDENCE · 30+ CHARACTERS</span><textarea name="summary" rows="3" required minlength="30" maxlength="1000" placeholder="Document the decision, evidence checked and responsible next step."></textarea></label><button class="btn primary" type="submit">Record independent review</button></form>`;
  }else{
    action=`<div class="case-resolution-evidence"><strong>Resolution evidence</strong><p>${escapeHTML(followUp.resolutionEvidence||followUp.lastSummary||'No evidence retained.')}</p><small>${followUp.customerConfirmed?'Customer confirmation recorded.':'Supervisor verification recorded.'} ${followUp.completedAt?`Closed ${new Date(followUp.completedAt).toLocaleString()}`:''}</small></div>`;
  }
  return `<section class="case-followup-panel"><div class="case-followup-heading"><strong>Reopened case follow-up</strong><span class="pill ${risk.state==='overdue'||risk.state==='supervisor_review'?'red':risk.state==='complete'?'green':'amber'}">${riskLabels[risk.state]||risk.state.toUpperCase()}</span></div><div class="case-followup-facts"><div><span>FOLLOW-UP ID</span><strong>${escapeHTML(followUp.id)}</strong></div><div><span>OWNER</span><strong>${escapeHTML(followUp.owner||'Unassigned')}</strong></div><div><span>PRIORITY</span><strong>${escapeHTML(followUp.priority.toUpperCase())}</strong></div><div><span>DUE</span><strong>Day ${followUp.dueDay} · ${formatCaseClock(followUp.dueMinute)}</strong></div><div><span>REOPEN COUNT</span><strong>${lifecycle.reopenCount}/${5}</strong></div><div><span>ATTEMPTS</span><strong>${followUp.attempts}</strong></div></div>${action}${history?`<div class="case-followup-history"><strong>Follow-up history</strong>${history}</div>`:''}</section>`;
}
function renderCRM(){
  const recent=state.interactionTimeline.slice(-18).reverse();
  state.cases=(Array.isArray(state.cases)?state.cases:[]).map(row=>{try{return normalizeCaseLifecycle(row);}catch(_){return row;}});
  const followUpMetrics=caseFollowUpMetrics(state.cases,caseLifecycleClock());
  const followUpCards=followUpMetrics.rows.map(({caseRecord,followUp,risk})=>{
    const label={overdue:'OVERDUE',due_soon:'DUE SOON',on_track:'ON TRACK',paused_off_shift:'PAUSED OFF SHIFT',supervisor_review:'SUPERVISOR REVIEW',clock_unavailable:'CLOCK UNAVAILABLE'}[risk.state]||risk.state.toUpperCase();
    const tone=['overdue','supervisor_review'].includes(risk.state)?'red':risk.state==='due_soon'?'amber':'green';
    return `<div class="case-followup-queue-row"><div class="case-followup-queue-copy"><strong>${escapeHTML(caseRecord.customer)} · ${escapeHTML(caseRecord.reference)}</strong><small>${escapeHTML(caseRecord.title)} · ${escapeHTML(followUp.owner||'Unassigned')} · Day ${followUp.dueDay} ${formatCaseClock(followUp.dueMinute)}</small></div><span class="pill ${tone}">${label}</span><button class="btn small outline" data-action="open-case-followup" data-case-reference="${escapeHTML(caseRecord.reference)}">Open case</button></div>`;
  }).join('');
  const caseDetails=state.cases.slice(-12).reverse().map(c=>`<details class="case-detail" ${state.crmSelectedCaseReference===c.reference?'open':''}><summary><strong>${escapeHTML(c.reference)}</strong><span>${escapeHTML(c.customer)} · ${escapeHTML(c.status)}</span></summary><div class="case-detail-body"><p><strong>Issue:</strong> ${escapeHTML(c.title)}</p><p><strong>Disposition:</strong> ${escapeHTML(String(c.disposition||'—').replaceAll('_',' '))}</p><p><strong>Owner:</strong> ${escapeHTML(c.owner||'Agent')}</p><p><strong>Notes:</strong> ${escapeHTML(c.notes||'No wrap-up notes retained.')}</p>${renderCaseFollowUpPanel(c)}${Array.isArray(c.messages)&&c.messages.length?`<div class="crm-digital-transcript"><strong>Interaction transcript</strong>${c.messages.map(message=>`<p><b>${message.type==='agent'?'Agent':'Customer'}:</b> ${escapeHTML(message.text)}</p>`).join('')}</div>`:''}<p><strong>Recorded:</strong> ${c.createdAt?new Date(c.createdAt).toLocaleString():'—'}</p></div></details>`).join('');
  viewRoot.innerHTML=`<div class="ops-summary-grid case-followup-metrics">${metricCard('OPEN FOLLOW-UPS',followUpMetrics.open,'Reopened cases awaiting action','↻')}${metricCard('OVERDUE',followUpMetrics.overdue,'Past the simulated follow-up target','!')}${metricCard('DUE SOON',followUpMetrics.dueSoon,'Due within 15 simulated minutes','⌛')}${metricCard('SUPERVISOR REVIEW',followUpMetrics.supervisorReview,'Follow-ups requiring independent decision','⚑')}</div><section class="panel case-followup-queue" style="margin-top:14px"><div class="panel-head"><div><h3>Reopened case follow-up worklist</h3><p>Cases reopened after a challenged or incomplete resolution. Follow-up has an owner, priority and simulated due time.</p></div><span class="pill ${followUpMetrics.overdue||followUpMetrics.supervisorReview?'amber':'green'}">${followUpMetrics.open} ACTIVE</span></div>${followUpCards||'<div class="empty-state"><h3>No reopened cases awaiting action</h3><p>Reopen a previously resolved CRM case when a customer reports that the issue remains unresolved or new information changes the outcome.</p></div>'}</section><div class="panel" style="margin-top:14px"><div class="panel-head"><div><h3>CRM & case management</h3><p>Completed customer interactions, factual wrap-up notes, cross-channel history and auditable case follow-up.</p></div><span class="pill">${state.cases.length} TOTAL RECORDS</span></div>${state.cases.length?`<div class="table-wrap"><table><thead><tr><th>Case reference</th><th>Customer</th><th>Channel</th><th>Issue / campaign</th><th>Disposition</th><th>Outcome</th><th>Quality</th></tr></thead><tbody>${state.cases.slice().reverse().map(c=>`<tr><td><strong>${escapeHTML(c.reference)}</strong></td><td>${escapeHTML(c.customer)}</td><td>${escapeHTML(c.channel)}</td><td>${escapeHTML(c.title)}</td><td>${escapeHTML(String(c.disposition||'—').replaceAll('_',' '))}</td><td><span class="status-dot"></span>${escapeHTML(c.status)}</td><td>${Number(c.qa)||0}%</td></tr>`).join('')}</tbody></table></div><div class="case-detail-list">${caseDetails}</div>`:'<div class="empty-state"><div class="empty-icon">▤</div><h3>No cases recorded yet</h3><p>Complete an inbound, outbound or digital interaction and its after-contact work to create a case record.</p><button class="btn secondary" data-action="open-inbound">Go to inbound desk</button></div>'}</div><section class="panel" style="margin-top:14px"><div class="panel-head"><div><h3>Interaction timeline</h3><p>Queue, call, transfer, supervisor and case events.</p></div><span class="pill">${state.interactionTimeline.length} EVENTS</span></div>${recent.length?recent.map(item=>`<div class="timeline-row"><time>${new Date(item.at).toLocaleString()}</time><div><strong>${escapeHTML(item.message)}</strong><small>${escapeHTML(item.reference)} · ${escapeHTML(item.status)}</small></div></div>`).join(''):'<p class="muted-note">No interaction events have been recorded yet.</p>'}</section>`;
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
  const digital=digitalQueueMetrics(state.digitalQueue || [], state.shiftActive ? queueSimulationNowMs() : Date.now());
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
function commitmentShiftSnapshot(){
  const date=simulationDateNow();
  return {date:CommitmentEngine?.dateText?.(date)||date.toISOString().slice(0,10),minutes:simulationMinuteNow()};
}
function commitmentStore(){
  if(!CommitmentEngine)throw new Error('Callback commitment engine is unavailable. Reload the application before recording this promise.');
  if(!state.customerCommitments||!Array.isArray(state.customerCommitments.commitments))state.customerCommitments=CommitmentEngine.createState();
  return state.customerCommitments;
}
function commitmentDateTimeISO(dateText,minutes){
  const [year,month,day]=String(dateText).split('-').map(Number);
  const minute=Math.max(0,Math.min(1439,Math.floor(Number(minutes)||0)));
  return new Date(year,month-1,day,Math.floor(minute/60),minute%60,0,0).toISOString();
}
function callbackIsDue(callback){
  if(callback?.commitmentId&&CommitmentEngine){
    const item=CommitmentEngine.getCommitment(commitmentStore(),callback.commitmentId);
    if(item)return ['Due','Overdue'].includes(CommitmentEngine.classify(item,commitmentShiftSnapshot()).state);
  }
  const due=Date.parse(callback?.dueAt||'');
  return Number.isFinite(due)&&due<=Date.now();
}
function prepareCallbackCommitment(wrap,contact,task,planId,commitmentText){
  const input={
    planId,
    customerId:String(contact?.customerRef||task?.customerRef||contact?.id||task?.id||wrap.contactId),
    customerName:contact?.customer||task?.customer||wrap.customer,
    contactReference:String(contact?.id||wrap.contactId),
    caseId:wrap.reference,
    subject:wrap.title,
    productId:String(contact?.platform||task?.productId||state.selectedTrack||'general-service'),
    preferredChannel:'Voice',
    owner:state.applicantName||'Customer Experience Agent',
    team:state.department||'Customer Care',
    commitment:commitmentText
  };
  const shift=commitmentShiftSnapshot();
  const fields=CommitmentEngine.validateCreation(input,shift);
  return {input,fields,shift};
}
function createCallbackRecordFromCommitment(commitment,source){
  const dueAt=commitmentDateTimeISO(commitment.dueDate,commitment.dueMinutes);
  const record={
    id:makeCallReference('CBK'),
    type:source.type||'inbound',
    contactId:source.contactId,
    campaignContactId:source.campaignContactId||null,
    customer:source.customer||commitment.customerName,
    campaignId:source.campaignId||null,
    scenarioId:source.scenarioId||null,
    issue:source.issue||commitment.subject||commitment.commitment,
    dueAt,
    commitmentId:commitment.id,
    status:'scheduled',
    createdAt:new Date().toISOString()
  };
  state.callbacks.push(record);
  return record;
}
function recordCommitmentOutcome(commitmentId,outcome,summary,context={}){
  if(!commitmentId||!CommitmentEngine)return null;
  try{
    const result=CommitmentEngine.recordOutcome(commitmentStore(),commitmentId,{outcome,summary},commitmentShiftSnapshot(),new Date());
    const item=result.item;
    const caseRecord=state.cases.find(row=>row.reference===item.caseId||row.contactId===item.contactReference);
    if(caseRecord){
      caseRecord.commitmentStatus=item.status;
      caseRecord.commitmentLastOutcome=item.lastOutcome;
      caseRecord.commitmentUpdatedAt=new Date().toISOString();
      caseRecord.status=item.status==='Complete'?'Callback promise fulfilled':item.status==='Needs review'?'Callback requires supervisor review':'Callback follow-up rescheduled';
      caseRecord.notes=`${caseRecord.notes||''}\n\nCallback outcome: ${summary}`.trim().slice(0,1800);
    }
    if(result.requiresReview){
      const exists=state.supervisorRequests.some(row=>row.commitmentId===item.id&&row.status==='open');
      if(!exists)state.supervisorRequests.push({id:makeCallReference('SUP'),commitmentId:item.id,contactId:item.contactReference,reference:item.caseId||item.contactReference,customer:item.customerName,reason:'Customer callback promise reached its attempt limit and requires independent supervisor review.',status:'open',createdAt:new Date().toISOString(),channel:'Callback commitment'});
      pushOperationEvent('commitment',item.id,`Callback promise requires supervisor review after ${item.attempts} attempts.`,'review_required',{caseId:item.caseId,owner:item.owner});
    }else{
      pushOperationEvent('commitment',item.id,`Callback commitment outcome recorded: ${outcome}.`,item.status.toLowerCase().replaceAll(' ','_'),{caseId:item.caseId,owner:item.owner,dueDate:item.dueDate,dueMinutes:item.dueMinutes});
      if(item.status==='Open'&&context.retrySource)scheduleRetryForCommitment(item,context.retrySource);
    }
    return result;
  }catch(error){toast(error.message||'Callback commitment outcome could not be recorded.','error');return null;}
}
function scheduleRetryForCommitment(item,source){
  if(!item||item.status!=='Open')return null;
  const existing=state.callbacks.find(row=>row.commitmentId===item.id&&['scheduled','queued','in_progress'].includes(row.status));
  if(existing)return existing;
  let retrySource={...source};
  if(retrySource.type!=='outbound'){
    let contact=findQueueContact(retrySource.contactId);
    if(contact&&![CONTACT_STATUS.CALLBACK,CONTACT_STATUS.QUEUED].includes(contact.status)){
      const scenario=inboundScenarios.find(row=>row.id===contact.scenarioId);
      if(scenario){
        const now=queueSimulationNowMs();
        const created=createInboundQueue([scenario],1,{sequence:state.queueSequence,now});
        const retry=created[0];
        if(retry){
          retry.customer=contact.customer;retry.customerRef=contact.customerRef||null;retry.issue=contact.issue;retry.priority=contact.priority;retry.routeGroup=contact.routeGroup;retry.source='callback_commitment_retry';
          stampInboundQueue([retry],{now,elapsedMinute:state.shiftElapsedMinutes,source:'callback_commitment_retry'});
          state.inboundQueueItems.push(retry);state.queueSequence+=1;
          retrySource.contactId=retry.id;
          pushOperationEvent('callback',retry.id,`A new inbound work item was created for commitment ${item.id}.`,'queued',{originContactId:contact.id,commitmentId:item.id});
        }
      }
    }
    contact=findQueueContact(retrySource.contactId);
    if(contact&&contact.status===CONTACT_STATUS.QUEUED){
      try{transitionContact(contact,CONTACT_STATUS.CALLBACK,'Callback commitment rescheduled after an unsuccessful attempt',queueSimulationNowMs(),{dueAt:commitmentDateTimeISO(item.dueDate,item.dueMinutes)});}catch{}
    }
  }
  const callback=createCallbackRecordFromCommitment(item,retrySource);
  if(callback.type==='outbound'){
    const workItem=findCampaignContact(state.outboundWorklist,callback.campaignContactId);
    if(workItem){workItem.status='callback_scheduled';workItem.nextEligibleAt=null;workItem.callbackDueAt=new Date(Date.now()+60_000).toISOString();}
  }
  pushOperationEvent('callback',callback.id,`Callback retry scheduled for ${callback.customer} under commitment ${item.id}.`,'scheduled',{commitmentId:item.id,dueDate:item.dueDate,dueMinutes:item.dueMinutes});
  return callback;
}
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
        <div class="data-list"><div class="data-row"><span>Shift status</span><strong>${state.shiftActive?'ACTIVE':'CLOSED'}</strong></div><div class="data-row"><span>Elapsed simulation time</span><strong>${Math.floor(state.shiftElapsedMinutes)} minutes</strong></div><div class="data-row"><span>Inbound arrivals this shift</span><strong>${currentLiveQueueSnapshot().totalArrivals}</strong></div><div class="data-row"><span>Customer abandonments</span><strong>${currentLiveQueueSnapshot().abandoned}</strong></div><div class="data-row"><span>Live schedule adherence</span><strong>${state.shiftRecord?.status==='active'?calculateShiftAdherence(state.shiftRecord,state.shiftElapsedMinutes).adherence+'%':'—'}</strong></div><div class="data-row"><span>Shift hours</span><strong>08:00–17:00</strong></div></div>
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
  const cloud = getCloudPlatformState();
  if (cloud.configured) { renderCloudOrganizationWorkspace(cloud); return; }
  const org = getActiveOrganization(state.organizationWorkspace);
  if (!org) { viewRoot.innerHTML = '<div class="panel empty-state"><h3>No organisation workspace</h3><p>Create an organisation workspace to begin.</p></div>'; return; }
  const snapshot = getOrganizationSnapshot(state.organizationWorkspace, org.id);
  const active = snapshot.members.filter(member => member.status === 'active').length;
  const invited = snapshot.members.filter(member => member.status === 'invited').length;
  const suspended = snapshot.members.filter(member => member.status === 'suspended').length;
  const departments = org.policy.departments;
  viewRoot.innerHTML = `
    <div class="cloud-demo-warning"><strong>LOCAL DEMONSTRATION MODE</strong><span>Supabase is not configured. These organisation records, staff roles and policies exist only in this browser and are not a security boundary.</span></div>
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

function renderCloudOrganizationWorkspace(cloud) {
  if (cloud.mode !== 'active' || !cloud.activeOrganization) {
    viewRoot.innerHTML = '<section class="panel"><span class="pill amber">CLOUD ACCESS</span><h3>Organisation workspace not selected</h3><p>Sign in and select an active organisation membership to manage its tenant records.</p></section>';
    return;
  }
  const org = cloud.activeOrganization, policy = cloud.policy;
  const role = cloud.membership?.role || 'trainee';
  const canManageMembers = canCloudRole(role, 'members:manage');
  const canManagePolicies = canCloudRole(role, 'policies:manage');
  const canReadAudit = canCloudRole(role, 'audit:read');
  const active = cloud.members.filter(member => member.status === 'active').length;
  const suspended = cloud.members.filter(member => member.status === 'suspended').length;
  const pending = cloud.invitations.filter(invite => invite.status === 'pending').length;
  const auditMarkup = canReadAudit
    ? cloud.audit.slice(0, 15).map(entry => `<div class="data-row"><span>${escapeHTML(entry.event_type.replaceAll('-', ' '))}<small>${new Date(entry.created_at).toLocaleString()}</small></span><strong>${escapeHTML(entry.details?.email || entry.details?.name || entry.actor_user_id || 'SYSTEM')}</strong></div>`).join('') || '<p class="muted-note">No administrative events recorded.</p>'
    : '<p class="muted-note">Audit history is restricted to authorised management roles.</p>';
  viewRoot.innerHTML = `
    <div class="cloud-tenant-banner"><div><span class="pill green">SERVER-BACKED TENANT</span><strong>${escapeHTML(org.name)}</strong><small>Authenticated as ${escapeHTML(cloud.user?.email)} · ${escapeHTML(ORGANIZATION_ROLES[role]?.label || role)}</small></div><span class="cloud-tenant-state">TENANT-SCOPED ACCESS</span></div>
    <div class="ops-summary-grid org-summary-grid">
      <article class="metric-card"><span>YOUR ORGANISATIONS</span><strong>${cloud.organizations.length}</strong><small>Verified memberships for this account</small></article>
      <article class="metric-card"><span>ACTIVE STAFF</span><strong>${active}</strong><small>${suspended} suspended · ${pending} pending invitations</small></article>
      <article class="metric-card"><span>DEPARTMENTS</span><strong>${policy.departments.length}</strong><small>Tenant-specific policy</small></article>
      <article class="metric-card"><span>AUDIT EVENTS</span><strong>${canReadAudit ? cloud.audit.length : '—'}</strong><small>${canReadAudit ? 'Server-side event history' : 'Restricted by role'}</small></article>
    </div>
    <div class="grid two org-grid">
      <section class="panel">
        <div class="panel-head"><div><h3>Organisation workspace</h3><p>Organisation identity and membership are stored in Supabase.</p></div><span class="pill green">${escapeHTML(role.toUpperCase())}</span></div>
        <label class="form-field">Active organisation<select id="cloudOrgSelect">${cloud.organizations.map(item=>`<option value="${escapeHTML(item.id)}" ${item.id===org.id?'selected':''}>${escapeHTML(item.name)}</option>`).join('')}</select></label>
        <div class="data-list"><div class="data-row"><span>Organisation name</span><strong>${escapeHTML(org.name)}</strong></div><div class="data-row"><span>Industry</span><strong>${escapeHTML(org.industry)}</strong></div><div class="data-row"><span>Your department</span><strong>${escapeHTML(cloud.membership?.department || 'Customer Experience')}</strong></div><div class="data-row"><span>Tenant ID</span><strong class="mono-value">${escapeHTML(org.id)}</strong></div></div>
        <form id="cloudOrgCreateForm" class="org-form"><h4>Create another organisation</h4><div class="form-field"><label>ORGANISATION NAME</label><input name="name" required minlength="2" maxlength="80" placeholder="e.g. Northern Customer Services"></div><div class="form-field"><label>INDUSTRY</label><select name="industry"><option>Banking and financial services</option><option>Telecommunications</option><option>E-commerce and retail</option><option>Insurance</option><option>Healthcare administration</option><option>Travel and hospitality</option><option>Logistics and utilities</option><option>General customer service</option></select></div><button class="btn primary" type="submit">Create tenant workspace</button></form>
      </section>
      <section class="panel">
        <div class="panel-head"><div><h3>Server-backed staff directory</h3><p>Staff records are retrieved through organisation membership policies.</p></div><span class="pill">${cloud.members.length} RECORDS</span></div>
        <div class="org-member-list">${cloud.members.map(member=>`<article class="org-member"><div class="org-member-avatar">${escapeHTML(initials(member.name))}</div><div class="org-member-copy"><strong>${escapeHTML(member.name)}</strong><small>${escapeHTML(member.email || member.userId)} · ${escapeHTML(member.department)}</small><small>${escapeHTML(ORGANIZATION_ROLES[member.role]?.label || member.role)}</small></div><div class="org-member-actions"><span class="pill ${member.status==='active'?'green':'red'}">${escapeHTML(member.status.toUpperCase())}</span>${canManageMembers && member.role!=='owner' && member.userId!==cloud.user?.id ? `<button class="btn small outline" data-action="cloud-member-status" data-member-id="${escapeHTML(member.id)}" data-next-status="${member.status==='suspended'?'active':'suspended'}">${member.status==='suspended'?'Reactivate':'Suspend'}</button>`:''}</div></article>`).join('') || '<p class="muted-note">No member records are visible to this role.</p>'}</div>
        ${canManageMembers ? `<form id="cloudInviteForm" class="org-form"><h4>Invite a staff member</h4><div class="org-form-grid"><div class="form-field"><label>WORK EMAIL</label><input name="email" type="email" required maxlength="254"></div><div class="form-field"><label>ACCESS ROLE</label><select name="role">${Object.entries(ORGANIZATION_ROLES).filter(([name])=>name!=='owner').map(([name,info])=>`<option value="${name}">${escapeHTML(info.label)}</option>`).join('')}</select></div><div class="form-field"><label>DEPARTMENT</label><select name="department">${policy.departments.map(dept=>`<option>${escapeHTML(dept)}</option>`).join('')}</select></div></div><button class="btn primary" type="submit">Create secure invitation</button><p class="muted-note">Creates a pending server invitation. It does not send email. The recipient must sign up with this address, confirm it and accept the invitation.</p></form>` : '<p class="muted-note">Member management is not included in your role permissions.</p>'}
        <h4 style="margin-top:18px">Pending and recent invitations</h4>${cloud.invitations.slice(0,8).map(invite=>`<div class="data-row"><span>${escapeHTML(invite.email)}<small>${escapeHTML(invite.department)} · ${escapeHTML(ORGANIZATION_ROLES[invite.role]?.label || invite.role)}</small></span><strong>${escapeHTML(invite.status.toUpperCase())}</strong></div>`).join('') || '<p class="muted-note">No invitation records.</p>'}
      </section>
      <section class="panel">
        <div class="panel-head"><div><h3>Organisation policies</h3><p>These settings are stored in the server-side tenant record.</p></div><span class="pill green">SERVER POLICY</span></div>
        ${canManagePolicies ? `<form id="cloudPolicyForm" class="org-form"><div class="org-policy-grid">
          <div class="form-field"><label>VOICE RESPONSE TARGET · SECONDS</label><input name="voiceResponseTargetSeconds" type="number" min="5" max="600" value="${policy.voiceResponseTargetSeconds}" required></div>
          <div class="form-field"><label>DIGITAL RESPONSE TARGET · MINUTES</label><input name="digitalResponseTargetMinutes" type="number" min="1" max="1440" value="${policy.digitalResponseTargetMinutes}" required></div>
          <div class="form-field"><label>QA PASS MARK · %</label><input name="qaPassMark" type="number" min="0" max="100" value="${policy.qaPassMark}" required></div>
          <div class="form-field"><label>PROMOTION THRESHOLD · %</label><input name="promotionThreshold" type="number" min="0" max="100" value="${policy.promotionThreshold}" required></div>
          <div class="form-field"><label>MAX CONCURRENT CHATS</label><input name="maxConcurrentChats" type="number" min="1" max="10" value="${policy.maxConcurrentChats}" required></div>
          <div class="form-field"><label>DATA RETENTION · DAYS</label><input name="dataRetentionDays" type="number" min="1" max="3650" value="${policy.dataRetentionDays}" required></div>
        </div><div class="form-field"><label>DEPARTMENTS · ONE PER LINE</label><textarea name="departments" rows="5" required>${escapeHTML(policy.departments.join('\n'))}</textarea></div><button class="btn primary" type="submit">Save tenant policy</button></form>` : `<p class="muted-note">Policy editing is restricted to organisation owners and administrators.</p><div class="data-list">${Object.entries(policy).map(([key,value])=>`<div class="data-row"><span>${escapeHTML(key)}</span><strong>${escapeHTML(Array.isArray(value)?value.join(', '):value)}</strong></div>`).join('')}</div>`}
      </section>
      <section class="panel"><div class="panel-head"><div><h3>Administrative audit history</h3><p>Server-side records for tenant administration.</p></div><span class="pill">${canReadAudit?'AUDIT ACCESS':'RESTRICTED'}</span></div><div class="data-list">${auditMarkup}</div></section>
    </div>
    <div class="cloud-local-progress-note"><strong>Data boundary</strong><span>Authentication, organisation membership, organisation policies, invitations and audit records are server-backed. Gameplay progress, customer interaction practice records, voice samples and simulation performance remain in browser storage, scoped to this user and selected organisation. They are not yet synchronised to PostgreSQL.</span></div>`;
}

function renderCustomerIntelligence() {
  const history = Array.isArray(state.customerQaHistory) ? state.customerQaHistory : [];
  const metrics = customerIntelligenceMetrics(history);
  const session = state.customerLabSession;
  const personaOptions = CUSTOMER_PERSONAS.map(item => `<option value="${item.id}">${escapeHTML(item.label)}</option>`).join('');
  const issueOptions = CUSTOMER_ISSUES.map(item => `<option value="${item.id}">${escapeHTML(item.title)} · ${escapeHTML(item.risk.toUpperCase())}</option>`).join('');
  const metricsMarkup = `<div class="ops-summary-grid">${metricCard('PRACTICE INTERACTIONS',metrics.interactions,'Finalised customer simulations','◉')}${metricCard('AVERAGE PRACTICE QA',metrics.averageQA===null?'—':`${metrics.averageQA}%`,'Deterministic evidence-based score','⌁')}${metricCard('COACHING RECORDS',metrics.coaching,'Interactions requiring development','↗')}${metricCard('MANDATORY REVIEWS',metrics.mandatoryReview,'Critical conduct or security flags','!')}</div>`;
  const startPanel = !session ? `<section class="panel"><div class="panel-head"><div><h3>Generate a customer interaction</h3><p>Choose a customer profile and issue, or leave the defaults to generate a mixed scenario.</p></div><span class="pill green">SYNTHETIC DATA</span></div><div class="grid two"><div class="form-field"><label for="customerPersona">CUSTOMER PERSONALITY</label><select id="customerPersona"><option value="">Random profile</option>${personaOptions}</select></div><div class="form-field"><label for="customerIssue">CUSTOMER ISSUE</label><select id="customerIssue"><option value="">Random issue</option>${issueOptions}</select></div><div class="form-field"><label for="customerChannel">CONTACT CHANNEL</label><select id="customerChannel"><option>Voice</option><option>Email</option><option>Live chat</option><option>Social media</option></select></div></div><button class="btn primary" data-action="start-customer-lab">Start customer simulation →</button></section>` : '';
  let activePanel = '';
  if (session) {
    const transcript = (session.transcript||[]).map(item=>`<div class="digital-message ${item.speaker==='agent'?'agent':'customer'}"><div class="digital-message-meta"><strong>${item.speaker==='agent'?'YOU · AGENT':escapeHTML(session.customer)}</strong><time>${new Date(item.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</time></div><p>${escapeHTML(item.text)}</p>${item.qa?`<small>Practice QA: ${item.qa.score}% · ${escapeHTML(item.qa.label.replaceAll('_',' '))}</small>`:''}</div>`).join('');
    const latest = session.scorecards?.at(-1);
    const feedback = latest ? `<div class="article-box"><h4>Practice QA · ${latest.score}%</h4><p>Customer reaction: <strong>${escapeHTML(latest.customerReaction)}</strong> · Remaining patience: ${latest.customerPatience}%</p><ul>${latest.recommendations.map(item=>`<li>${escapeHTML(item)}</li>`).join('')||'<li>Current response met the evaluated practice checks.</li>'}</ul>${latest.criticalBreaches.length?'<span class="pill red">MANDATORY REVIEW</span>':''}</div>` : '';
    const active = session.status==='active';
    activePanel = `<section class="panel"><div class="panel-head"><div><h3>${escapeHTML(session.issue.title)}</h3><p>${escapeHTML(session.issue.category)} · ${escapeHTML(session.channel)} · ${escapeHTML(session.id)}</p></div><span class="pill ${session.issue.risk==='critical'?'red':session.issue.risk==='high'?'amber':'green'}">${escapeHTML(session.issue.risk.toUpperCase())} RISK</span></div><div class="customer-strip"><div class="customer-avatar">${escapeHTML(initials(session.customer))}</div><div class="customer-info"><strong>${escapeHTML(session.customer)}</strong><small>${escapeHTML(session.persona.label)}</small></div><span class="pill">TURN ${session.turn}/3</span></div><div class="article-box"><div class="subtle-label">CUSTOMER STATEMENT</div><p class="call-prompt">“${escapeHTML(session.statement)}”</p><p class="muted-note">Customer patience: ${session.patience}% · Branch: ${escapeHTML(session.branch.replaceAll('_',' '))}</p></div>${transcript}${feedback}${active?`<form id="customerLabReplyForm"><div class="form-field"><label for="customerLabReply">AGENT RESPONSE</label><textarea id="customerLabReply" name="reply" rows="4" minlength="12" maxlength="1200" required placeholder="Write the response you would give this customer."></textarea><small class="muted-note">Do not request PINs, passwords, OTPs, full card details or other authentication secrets.</small></div><button class="btn primary" type="submit">Submit response for practice review →</button></form>`:`<div class="assessment-footer"><span class="pill ${session.status==='escalated'?'red':'green'}">${session.status==='escalated'?'ESCALATED FOR REVIEW':'INTERACTION COMPLETE'}</span><button class="btn primary" data-action="finalize-customer-lab">Finalise QA record</button><button class="btn outline" data-action="clear-customer-lab">New interaction</button></div>`}</section>`;
  }
  const recent = history.slice(-8).reverse().map(item=>`<div class="data-row"><span>${escapeHTML(item.issueId)} · ${escapeHTML(item.personaId)}<small style="display:block;color:var(--muted)">${new Date(item.completedAt).toLocaleString()}</small></span><strong>${item.averageScore}% · ${escapeHTML(item.outcome.replaceAll('_',' ').toUpperCase())}</strong></div>`).join('') || '<div class="empty-state"><p>No customer intelligence records yet.</p></div>';
  viewRoot.innerHTML = `${metricsMarkup}<div class="grid two" style="margin-top:14px">${startPanel}${activePanel}<section class="panel"><div class="panel-head"><div><h3>Customer intelligence model</h3><p>Scenario behaviour and quality evidence.</p></div><span class="pill">RULE-BASED</span></div><div class="data-list"><div class="data-row"><span>Customer profiles</span><strong>${CUSTOMER_PERSONAS.length}</strong></div><div class="data-row"><span>Issue templates</span><strong>${CUSTOMER_ISSUES.length}</strong></div><div class="data-row"><span>Adaptive conversation turns</span><strong>Up to 3</strong></div><div class="data-row"><span>Critical breach handling</span><strong>Immediate review</strong></div></div><div class="article-box"><h4>Scoring boundary</h4><p>Practice QA checks observable wording for acknowledgement, ownership, probing, next-step clarity and safety. It is a transparent deterministic evaluator, not an AI language model, a certified organisational scorecard or a replacement for human QA.</p></div></section><section class="panel"><div class="panel-head"><div><h3>Recent practice history</h3><p>Locally stored synthetic practice records.</p></div><span class="pill">${history.length} RECORDS</span></div><div class="data-list">${recent}</div></section></div>`;
}


function activeAICloudContext() {
  const cloud = getCloudPlatformState();
  if (cloud.mode !== 'active' || !cloud.ready || !cloud.user?.id || !cloud.activeOrganization?.id) return null;
  return cloud;
}

async function ensureAIAssistSettingsLoaded(force = false) {
  const cloud = activeAICloudContext();
  if (!cloud) {
    aiSettingsOrgId = '';
    aiSettingsLoaded = false;
    aiSettingsLoading = false;
    aiSettingsError = '';
    aiTenantSettings = null;
    return;
  }
  const orgId = cloud.activeOrganization.id;
  if (!force && aiSettingsOrgId === orgId && (aiSettingsLoaded || aiSettingsLoading)) return;
  aiSettingsOrgId = orgId;
  aiSettingsLoading = true;
  aiSettingsLoaded = false;
  aiSettingsError = '';
  try {
    const client = await getCloudSupabaseClient();
    aiTenantSettings = await loadTenantAIAssistSettings(client, orgId);
    aiSettingsLoaded = true;
  } catch (error) {
    aiTenantSettings = null;
    aiSettingsError = String(error?.message || error).slice(0, 360);
    aiSettingsLoaded = true;
  } finally {
    aiSettingsLoading = false;
    if (state.currentView === 'qa') renderQAWorkspace();
  }
}

function renderAIAssistPanel(reviewable) {
  const cloud = activeAICloudContext();
  if (!cloud) return `<section class="panel ai-assist-panel"><div class="panel-head"><div><h3>AI-assisted customer intelligence</h3><p>Tenant-controlled analysis, suggested QA observations and coaching.</p></div><span class="pill amber">CLOUD REQUIRED</span></div><p class="muted-note">Sign in to a Supabase organisation workspace before using AI assistance. Local demo mode never sends transcripts to an external service.</p></section>`;
  if (aiSettingsLoading || (aiSettingsOrgId !== cloud.activeOrganization.id && !aiSettingsLoaded)) return `<section class="panel ai-assist-panel"><div class="panel-head"><div><h3>AI-assisted customer intelligence</h3><p>Loading organisation AI policy…</p></div><span class="pill">LOADING</span></div></section>`;
  if (aiSettingsError) return `<section class="panel ai-assist-panel"><div class="panel-head"><div><h3>AI-assisted customer intelligence</h3><p>Tenant AI settings could not be loaded.</p></div><span class="pill red">SETUP REQUIRED</span></div><p class="muted-note">${escapeHTML(aiSettingsError)}. Apply Supabase migration 003 and redeploy the CALLORIA AI Edge Function.</p></section>`;
  const settings = aiTenantSettings || { enabled:false, model:'openai/gpt-oss-20b', dailyRequestLimit:100, configured:false };
  const canManage = canCloudRole(cloud.membership?.role, 'policies:manage');
  const modelOptions = AI_MODEL_OPTIONS.map(item => `<option value="${escapeHTML(item.id)}" ${settings.model===item.id?'selected':''}>${escapeHTML(item.label)}</option>`).join('');
  const interactionOptions = reviewable.map(item => `<option value="${escapeHTML(item.id)}" ${item.id===state.qaSelectedInteractionId?'selected':''}>${escapeHTML(item.id)} · ${escapeHTML(item.issueId)} · ${escapeHTML(item.channel)}</option>`).join('');
  const latest = (state.aiQaSuggestions || []).slice().reverse().find(item => item.organizationId === cloud.activeOrganization.id);
  const result = latest?.analysis;
  const resultMarkup = result ? `<div class="ai-result-block"><div class="ai-result-heading"><div><span class="subtle-label">MODEL-GENERATED DRAFT</span><h4>${escapeHTML(latest.interactionId)} · ${escapeHTML(latest.model)}</h4></div><span class="pill amber">HUMAN APPROVAL REQUIRED</span></div><div class="ai-result-meta"><span>SENTIMENT <b>${escapeHTML(result.sentiment.toUpperCase())}</b></span><span>INTENT <b>${escapeHTML(result.customerIntent || 'Not established')}</b></span></div><p>${escapeHTML(result.interactionSummary)}</p>${result.riskFlags.length?`<div class="ai-risk-flags"><strong>Potential risks to verify</strong>${result.riskFlags.map(item=>`<span>${escapeHTML(item)}</span>`).join('')}</div>`:''}<h5>Suggested QA observations</h5><div class="ai-suggestion-list">${result.qaSuggestions.map(item=>`<article><div><b>${escapeHTML(item.criterion)}</b><strong>${item.suggestedRating===null?'—':`${item.suggestedRating}/5`}</strong></div><p>${escapeHTML(item.rationale)}</p><small class="${item.evidenceVerified?'evidence-good':'evidence-warning'}">${item.evidenceVerified?'Transcript quote matched':'Evidence not verified against transcript'}${item.evidenceQuote?` · “${escapeHTML(item.evidenceQuote)}”`:''}</small></article>`).join('')||'<p class="muted-note">No criterion-level suggestions were returned.</p>'}</div>${result.coachingRecommendations.length?`<h5>Coaching ideas</h5><ul>${result.coachingRecommendations.map(item=>`<li>${escapeHTML(item)}</li>`).join('')}</ul>`:''}${result.followUpChecklist.length?`<h5>Suggested follow-up checks</h5><ul>${result.followUpChecklist.map(item=>`<li>${escapeHTML(item)}</li>`).join('')}</ul>`:''}<p class="ai-disclaimer">${escapeHTML(result.disclaimer)}${latest.usageRemaining!==null?` · Daily requests remaining: ${latest.usageRemaining}`:''}</p></div>`:'';
  return `<section class="panel ai-assist-panel"><div class="panel-head"><div><h3>AI-assisted customer intelligence</h3><p>Transcript analysis, sentiment, intent, QA observations and coaching suggestions.</p></div><span class="pill ${settings.enabled?'green':'amber'}">${settings.enabled?'TENANT AI ENABLED':'TENANT AI DISABLED'}</span></div><div class="ai-boundary"><strong>Data and decision boundary</strong><span>Use synthetic training transcripts only. You must explicitly approve each transcript transfer. Credentials and common identifiers are redacted before transmission. Audio is never sent. AI suggestions are not official QA results and cannot automatically change a score, employee record or promotion decision.</span></div>${canManage?`<form id="aiAssistSettingsForm" class="ai-settings-form"><div class="form-field"><label><input type="checkbox" name="enabled" ${settings.enabled?'checked':''}> ENABLE AI ASSISTANCE FOR THIS ORGANISATION</label></div><div class="ai-settings-grid"><label class="form-field"><span>MODEL</span><select name="model">${modelOptions}</select></label><label class="form-field"><span>DAILY REQUEST LIMIT · ORGANISATION</span><input name="dailyRequestLimit" type="number" min="1" max="5000" required value="${settings.dailyRequestLimit}"></label></div><p class="muted-note">Provider credentials stay in Supabase Edge Function secrets. They are never stored in this browser or tenant settings. Redaction is mandatory and cannot be disabled.</p><button class="btn outline" type="submit">Save tenant AI policy</button></form>`:`<div class="ai-status-line"><span>Organisation AI policy</span><strong>${settings.enabled?'Enabled':'Disabled'} · ${escapeHTML(settings.model)} · ${settings.dailyRequestLimit} requests/day</strong></div>`}${settings.enabled?`<form id="aiAssistRunForm" class="ai-run-form"><div class="form-field"><label for="aiInteractionSelect">COMPLETED INTERACTION TO ANALYSE</label><select id="aiInteractionSelect" name="interactionId" required ${reviewable.length?'':'disabled'}>${interactionOptions||'<option value="">No completed transcript available</option>'}</select></div><label class="ai-consent"><input type="checkbox" name="consent" required><span>I authorise CALLORIA to send this redacted synthetic transcript to the organisation-configured AI provider for this one analysis.</span></label><button class="btn primary" type="submit" ${!reviewable.length||aiAssistBusy?'disabled':''}>${aiAssistBusy?'Analysing transcript…':'Analyse transcript with AI'}</button></form>`:`<p class="muted-note">An organisation owner or administrator must enable AI assistance and configure the provider secret before this feature can run.</p>`}${aiSettingsLoaded && settings.configured===false && !aiSettingsError?'<p class="muted-note">No tenant AI policy exists yet. Save one above to initialise the setting.</p>':''}${resultMarkup}</section>`;
}

function renderQAWorkspace() {
  if (!Array.isArray(state.qaScorecards)) state.qaScorecards = [];
  if (!state.qaScorecards.length) state.qaScorecards.push(JSON.parse(JSON.stringify(DEFAULT_QA_SCORECARD)));
  const activeScorecards = state.qaScorecards.filter(item => item.active !== false);
  const selectedScorecard = activeScorecards.find(item => item.id === state.qaSelectedScorecardId) || activeScorecards[0];
  if (selectedScorecard) state.qaSelectedScorecardId = selectedScorecard.id;
  const reviewable = (state.customerQaHistory || []).filter(item => Array.isArray(item.transcript) && item.transcript.length);
  const selectedInteraction = reviewable.find(item => item.id === state.qaSelectedInteractionId) || reviewable.at(-1) || null;
  if (selectedInteraction) state.qaSelectedInteractionId = selectedInteraction.id;
  const reviews = state.humanQaReviews || [];
  const disputes = state.qaDisputes || [];
  const calibrations = state.qaCalibrations || [];
  const metrics = humanQAMetrics(reviews, disputes, calibrations);
  const scorecardOptions = activeScorecards.map(item => `<option value="${escapeHTML(item.id)}" ${item.id === selectedScorecard?.id ? 'selected' : ''}>${escapeHTML(item.name)} · v${item.version || 1}</option>`).join('');
  const interactionOptions = reviewable.map(item => `<option value="${escapeHTML(item.id)}" ${item.id === selectedInteraction?.id ? 'selected' : ''}>${escapeHTML(item.id)} · ${escapeHTML(item.issueId)} · ${escapeHTML(item.channel)}</option>`).join('');
  const transcriptLines = selectedInteraction?.transcript || [];
  const evidenceOptions = transcriptLines.map((line, index) => `<option value="${index}">${escapeHTML(String(line.speaker || 'unknown').toUpperCase())}: ${escapeHTML(line.text)}</option>`).join('');
  const criterionRows = selectedScorecard?.criteria.map(item => `<div class="qa-criterion-row"><div class="qa-criterion-copy"><strong>${escapeHTML(item.label)}</strong><small>${item.weight}% of total · ${escapeHTML(item.guidance || 'Evaluate against the interaction evidence.')}</small></div><label>RATING<select name="rating_${escapeHTML(item.id)}" required><option value="">Choose</option>${[0,1,2,3,4,5].map(n=>`<option value="${n}">${n} / 5</option>`).join('')}</select></label><label class="qa-evidence-field">TRANSCRIPT EVIDENCE<select name="evidence_${escapeHTML(item.id)}" required><option value="">Select an exact transcript line</option>${evidenceOptions}</select></label></div>`).join('') || '<p class="muted-note">Create or activate a scorecard to begin a review.</p>';
  const reviewCards = reviews.slice().reverse().slice(0,15).map(review => `<article class="qa-review-card"><div class="qa-review-head"><div><strong>${escapeHTML(review.interactionId)} · ${escapeHTML(review.reviewer)}</strong><small>${escapeHTML(review.scorecardName)} v${review.scorecardVersion} · ${new Date(review.createdAt).toLocaleString()}</small></div><div class="qa-review-score"><b>${review.score}%</b><span class="pill ${review.status==='pass'?'green':review.status==='mandatory_review'?'red':'amber'}">${escapeHTML(review.status.replaceAll('_',' ').toUpperCase())}</span></div></div><div class="qa-review-evidence">${review.criteria.map(item=>`<div><span>${escapeHTML(item.label)} · ${item.rating}/5</span><small>“${escapeHTML(item.evidence.quote)}”</small></div>`).join('')}</div>${review.notes?`<p class="muted-note">Reviewer notes: ${escapeHTML(review.notes)}</p>`:''}${review.coaching?.length?`<div class="qa-coaching-list"><strong>Evidence-linked coaching actions</strong>${review.coaching.map(item=>`<p><b>${escapeHTML(item.criterion)}</b> — ${escapeHTML(item.action)}<small>Evidence: “${escapeHTML(item.evidence)}”</small></p>`).join('')}</div>`:''}</article>`).join('') || '<div class="empty-state"><p>No human QA reviews have been recorded.</p></div>';
  const openDisputes = disputes.filter(item => item.status === 'open');
  const disputeRows = disputes.slice().reverse().map(item => `<div class="data-row"><span>${escapeHTML(item.id)} · ${escapeHTML(item.raisedBy)}<small>${escapeHTML(item.reason)}</small></span><strong>${escapeHTML(item.status.toUpperCase())}</strong></div>`).join('') || '<p class="muted-note">No QA disputes recorded.</p>';
  const calibratable = [...new Set(reviews.filter(item => reviews.some(other => other.id !== item.id && other.interactionId === item.interactionId && other.scorecardId === item.scorecardId)).map(item => `${item.interactionId}::${item.scorecardId}`))];
  viewRoot.innerHTML = `
    <div class="ops-summary-grid">${metricCard('HUMAN QA REVIEWS',metrics.reviews,'Completed reviewer scorecards','▤')}${metricCard('AVERAGE HUMAN SCORE',metrics.averageScore===null?'—':`${metrics.averageScore}%`,'Weighted score across completed reviews','⌁')}${metricCard('OPEN DISPUTES',metrics.openDisputes,'Awaiting independent resolution','!')}${metricCard('CALIBRATIONS',metrics.calibrations,'Reviewer comparison sessions','⇄')}</div>
    <div class="qa-boundary-note"><strong>Human review workspace · synthetic training records</strong><span>Reviewers select evidence from the saved practice transcript. These records are training workflow data, not a certified scorecard or a live employee-performance decision. The current reviewer identity is entered manually; shared supervisor permissions are not enforced by this local workspace.</span></div>
    ${renderAIAssistPanel(reviewable)}
    <div class="grid two qa-workspace-grid">
      <section class="panel"><div class="panel-head"><div><h3>Review an interaction</h3><p>Score each criterion and attach an exact transcript line as evidence.</p></div><span class="pill green">EVIDENCE REQUIRED</span></div>
        ${reviewable.length ? `<form id="humanQaReviewForm"><div class="form-field"><label>COMPLETED CUSTOMER INTERACTION</label><select id="qaInteractionSelect" name="interactionId">${interactionOptions}</select></div><div class="form-field"><label>QA SCORECARD</label><select id="qaScorecardSelect" name="scorecardId">${scorecardOptions}</select></div><div class="form-field"><label>REVIEWER NAME</label><input name="reviewer" minlength="2" maxlength="80" required value="${escapeHTML(state.applicantName || '')}" placeholder="Reviewer name"></div><div class="qa-criteria-list">${criterionRows}</div><div class="form-field"><label>REVIEWER NOTES</label><textarea name="notes" rows="3" maxlength="2000" placeholder="Record factual observations and context."></textarea></div><div class="form-field"><label>COACHING ACTION FOR LOW-RATED CRITERIA</label><textarea name="coachingAction" rows="2" maxlength="500" placeholder="Specific action the agent should practise."></textarea></div><button class="btn primary" type="submit" ${selectedInteraction && selectedScorecard ? '' : 'disabled'}>Save human QA review</button></form>` : '<div class="empty-state"><h3>No reviewable interaction</h3><p>Complete and finalise a Customer Lab interaction first. New records retain their synthetic transcript for evidence review.</p></div>'}
      </section>
      <section class="panel"><div class="panel-head"><div><h3>Scorecard configuration</h3><p>Create a weighted version for this practice workspace. Weights must total 100%.</p></div><span class="pill">VERSIONED</span></div>
        <div class="data-list">${activeScorecards.map(item=>`<div class="data-row"><span>${escapeHTML(item.name)}<small>Version ${item.version || 1} · ${item.criteria.length} criteria</small></span><strong>${item.criteria.reduce((sum,c)=>sum+c.weight,0)}%</strong></div>`).join('')}</div>
        <form id="qaScorecardForm" class="qa-scorecard-form"><div class="form-field"><label>SCORECARD NAME</label><input name="name" required minlength="3" maxlength="80" placeholder="e.g. Banking voice QA standard"></div><div class="qa-weight-grid">${selectedScorecard.criteria.map(item=>`<label><span>${escapeHTML(item.label)}</span><input type="number" name="weight_${escapeHTML(item.id)}" min="1" max="100" required value="${item.weight}"></label>`).join('')}</div><p class="muted-note">The six criterion labels remain aligned to the standard template in this release. Configure their relative weights; the total must equal exactly 100.</p><button class="btn outline" type="submit">Create new scorecard version</button></form>
      </section>
    </div>
    <section class="panel" style="margin-top:14px"><div class="panel-head"><div><h3>Human QA review register</h3><p>Scores, transcript evidence and linked coaching recommendations.</p></div><span class="pill">${reviews.length} REVIEWS</span></div><div class="qa-review-list">${reviewCards}</div></section>
    <div class="grid two qa-workspace-grid" style="margin-top:14px">
      <section class="panel"><div class="panel-head"><div><h3>Agent score dispute</h3><p>Submit a reasoned challenge to a completed human review.</p></div><span class="pill">DUE PROCESS</span></div>
        ${reviews.length?`<form id="qaDisputeForm"><div class="form-field"><label>REVIEW TO DISPUTE</label><select name="reviewId">${reviews.slice().reverse().map(item=>`<option value="${escapeHTML(item.id)}">${escapeHTML(item.interactionId)} · ${item.score}% · ${escapeHTML(item.reviewer)}</option>`).join('')}</select></div><div class="form-field"><label>PERSON RAISING DISPUTE</label><input name="raisedBy" required minlength="2" maxlength="80" value="${escapeHTML(state.applicantName || '')}"></div><div class="form-field"><label>REASON · MINIMUM 20 CHARACTERS</label><textarea name="reason" required minlength="20" maxlength="2000"></textarea></div><button class="btn outline" type="submit">Submit QA dispute</button></form>`:'<p class="muted-note">A human review is required before a dispute can be raised.</p>'}
        <h4 class="qa-subheading">Dispute register</h4><div class="data-list">${disputeRows}</div>
        ${openDisputes.length?`<form id="qaResolveDisputeForm" class="qa-resolve-form"><h4>Independent dispute resolution</h4><div class="form-field"><label>OPEN DISPUTE</label><select name="disputeId">${openDisputes.map(item=>`<option value="${escapeHTML(item.id)}">${escapeHTML(item.id)} · ${escapeHTML(item.raisedBy)}</option>`).join('')}</select></div><div class="form-field"><label>RESOLVING REVIEWER</label><input name="reviewer" required minlength="2" maxlength="80"></div><div class="form-field"><label>DECISION</label><select name="decision"><option value="upheld">Original score upheld</option><option value="adjusted">Score adjusted</option></select></div><div class="form-field"><label>ADJUSTED SCORE · IF APPLICABLE</label><input name="adjustedScore" type="number" min="0" max="100"></div><div class="form-field"><label>RESOLUTION RATIONALE · MINIMUM 20 CHARACTERS</label><textarea name="resolution" required minlength="20" maxlength="2000"></textarea></div><button class="btn primary" type="submit">Record dispute decision</button></form>`:''}
      </section>
      <section class="panel"><div class="panel-head"><div><h3>Reviewer calibration</h3><p>Compare independent scores for the same interaction and scorecard.</p></div><span class="pill">CONSISTENCY</span></div>
        ${calibratable.length?`<form id="qaCalibrationForm"><div class="form-field"><label>INTERACTION / SCORECARD GROUP</label><select name="group">${calibratable.map(key=>{const [interactionId,scorecardId]=key.split('::');const item=reviews.find(row=>row.interactionId===interactionId&&row.scorecardId===scorecardId);return `<option value="${escapeHTML(key)}">${escapeHTML(interactionId)} · ${escapeHTML(item?.scorecardName || scorecardId)}</option>`;}).join('')}</select></div><div class="form-field"><label>FACILITATOR</label><input name="facilitator" required minlength="2" maxlength="80"></div><div class="form-field"><label>CALIBRATION NOTES</label><textarea name="notes" rows="3" maxlength="2000"></textarea></div><button class="btn primary" type="submit">Compare reviewer scores</button></form>`:'<div class="empty-state"><p>At least two reviewers must independently score the same interaction using the same scorecard before calibration is available.</p></div>'}
        <div class="data-list" style="margin-top:12px">${calibrations.slice().reverse().map(item=>`<div class="data-row"><span>${escapeHTML(item.interactionId)}<small>${escapeHTML(item.reviewers.join(' · '))} · score spread ${item.scoreSpread} points</small></span><strong class="${item.requiresDiscussion?'text-warning':''}">${item.requiresDiscussion?'DISCUSS':'ALIGNED'}</strong></div>`).join('') || '<p class="muted-note">No calibration sessions recorded.</p>'}</div>
      </section>
    </div>`;
  void ensureAIAssistSettingsLoaded();
}

function renderView() {
  setHeader();
  const config = {
    overview:['CAREER ENTRY',state.hired?'Your shift overview':state.stage==='assessment'?'Recruitment assessment':state.stage==='offer'?'Employment offer':'Start your application',state.hired?'Your daily operations, performance and available work.':'Complete recruitment before starting agent operations.'],
    inbound:['CUSTOMER OPERATIONS','Inbound desk','Answer, investigate, resolve, transfer and document incoming customer contacts.'],
    queue:['OPERATIONS CONTROL','Queue management','Inspect priority, routing groups, waiting contacts and scheduled callbacks.'],
    supervisor:['SUPERVISOR DESK','Live operations command centre','Control synthetic queue intake, triage waiting work, monitor service risk and review escalations across voice and digital channels.'],
    promiseControl:['SUPERVISOR DESK','Customer promise control','Monitor due and at-risk callbacks across employees, raise service-recovery escalations and record independent supervisor actions.'],
    outbound:['CUSTOMER OPERATIONS','Outbound campaigns','Work authorised simulated campaigns and record true outcomes.'],
    digital:['CUSTOMER OPERATIONS','Multi-channel support','Handle simulated email, live-chat and social-media conversations with channel-specific privacy and service standards.'],
    commitments:['CUSTOMER PROMISE CONTROL','Callback commitments','Own scheduled customer promises, monitor due times, record callback attempts and route repeated failures for independent review.'],
    customerIntel:['CUSTOMER INTELLIGENCE','Customer behaviour & practice QA','Practise adaptive customer conversations and review transparent quality evidence across customer personalities.'],
    crm:['WORKSTATION','CRM & cases','Review accurate records of completed simulated interactions.'],
    knowledge:['AGENT RESOURCES','Knowledge base','Reference the principles and procedures relevant to your role.'],
    performance:['PERFORMANCE INTELLIGENCE','Performance dashboard','Review quality, resolution and service performance.'],
    career:['CAREER MANAGEMENT','Career profile','Track employment details, experience and progression.'],
    workforce:['WORKFORCE INTELLIGENCE','People & enterprise operations','Briefings, departments, promotion, customer recognition and simulated enterprise systems.'],
    organization:['ENTERPRISE ADMINISTRATION','Organisation workspaces','Manage local organisation profiles, staff directory, access roles, policies and audit history.'],
    qa:['QUALITY ASSURANCE','Human QA & calibration','Review synthetic interaction evidence, coach agents, calibrate reviewers and resolve score disputes.']
  };
  const [eyebrow,title,desc] = config[state.currentView] || config.overview;
  $('#pageEyebrow').textContent = eyebrow; $('#pageTitle').textContent = title; $('#pageDescription').textContent = desc;
  $('#pageActions').innerHTML = `<button type="button" class="btn outline return-to-game-btn" data-action="return-to-game">RETURN TO 3D GAME</button>${state.hired && state.currentView!=='overview' ? `<span class="pill ${state.shiftActive?'green':'amber'}">${state.shiftActive?'SHIFT ACTIVE':'OFF SHIFT'}</span>` : ''}`;
  switch(state.currentView){
    case 'overview': renderOverview(); break;
    case 'inbound': renderInbound(); break;
    case 'queue': renderQueue(); break;
    case 'supervisor': renderSupervisor(); break;
    case 'promiseControl': renderPromiseControl(); break;
    case 'outbound': renderOutbound(); break;
    case 'digital': renderDigital(); break;
    case 'commitments': renderCommitments(); break;
    case 'customerIntel': renderCustomerIntelligence(); break;
    case 'qa': renderQAWorkspace(); break;
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
  state.shiftSimulationEpochMs = Date.now() - state.shiftElapsedMinutes * 60_000;
  state.liveQueueSimulation = createLiveQueueState({ day: state.day, elapsedMinute: state.shiftElapsedMinutes, seed: state.queueSequence + state.day * 17 });
  state.digitalLiveQueueSimulation = createDigitalLiveQueueState({ day: state.day, elapsedMinute: state.shiftElapsedMinutes, seed: state.digitalSequence + state.day * 31 });
  state.digitalActiveIds = [];
  state.digitalActiveId = null;
  state.supervisorQueueControl = normalizeSupervisorQueueControl(state.supervisorQueueControl);
  state.supervisorQueueControl.paused = false;
  state.supervisorQueueControl.mode = 'normal';
  state.liveQueueSimulation.paused = false;
  state.liveQueueSimulation.arrivalIntervalMultiplier = SUPERVISOR_INTAKE_MODES.normal.multiplier;
  state.digitalLiveQueueSimulation.arrivalIntervalMultiplier = SUPERVISOR_INTAKE_MODES.normal.multiplier;
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
  if(!state.shiftActive||state.currentCall||state.activeOutbound||state.wrapUp||currentAgentDigitalWork().length){toast('Finish the current interaction before taking a break.','warning');return;}
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
  if(state.currentCall||state.activeOutbound||state.wrapUp||currentAgentDigitalWork().length){toast('Complete or safely close the active customer interaction before ending the shift.','warning');return;}
  setAgentState('offline','Shift ended by employee');
  const completed=closeShift(state.shiftRecord,Date.now(),state.shiftElapsedMinutes);
  state.shiftHistory.push({id:completed.id,day:completed.day,startedAt:completed.startedAt,endedAt:completed.endedAt,elapsedMinutes:completed.elapsedMinutes,adherence:completed.adherence?.adherence??0,status:completed.status});
  state.shiftHistory=state.shiftHistory.slice(-20);
  state.lastShiftDay=state.day;
  state.shiftActive=false;state.agentStatus='offline';
  if (state.liveQueueSimulation) state.liveQueueSimulation.active = false;
  if (state.digitalLiveQueueSimulation) state.digitalLiveQueueSimulation.active = false;
  pushOperationEvent('shift',completed.id,`Shift ended. Adherence ${completed.adherence?.adherence??0}%.`,'completed');
  saveState();renderView();toast(`Shift closed · ${completed.adherence?.adherence??0}% adherence.`,'success');
}
function advanceWorkday(){
  if(!state.hired){toast('Employment is required before advancing a workday.','warning');return;}
  if(state.shiftActive||state.currentCall||state.activeOutbound||state.wrapUp||currentAgentDigitalWork().length){toast('Close the current shift and customer interactions before advancing the workday.','warning');return;}
  if(state.lastShiftDay!==state.day&&simulationMinuteNow()<17*60){toast('The current workday has not ended. Finish or close this shift before advancing.','warning');return;}
  state.day=Math.max(1,Number(state.day)||1)+1;
  state.simulationClockSeconds=7*3600;
  simulationClockTicker=7*3600;
  lastShiftSaveBucket=0;
  state.shiftElapsedMinutes=0;
  state.shiftSimulationEpochMs=null;
  state.liveQueueSimulation=null;
  state.digitalLiveQueueSimulation=null;
  state.inboundQueueItems=[];
  state.callQueue=6;
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
  const queueNow = queueSimulationNowMs();
  const queued = nextQueuedContact(state.inboundQueueItems, queueNow);
  if(!queued){syncQueueCount();toast('No eligible contacts are waiting.');return;}
  const contact = findQueueContact(queued.id);
  const scenario = inboundScenarios.find(item=>item.id===contact?.scenarioId);
  if(!contact || !scenario){toast('The queued scenario could not be loaded. Refresh the queue.','error');return;}
  const acceptedAt = Date.now();
  const queueAcceptedAt = queueSimulationNowMs();
  transitionContact(contact, CONTACT_STATUS.OFFERED, 'Contact offered to the agent', queueAcceptedAt, { routeGroup: contact.routeGroup });
  transitionContact(contact, CONTACT_STATUS.CONNECTED, 'Agent accepted the inbound contact', queueAcceptedAt, { agent: state.applicantName || 'Agent' });
  const linkedCallback=state.callbacks.find(item=>item.contactId===contact.id&&item.status==='queued');
  if(linkedCallback){linkedCallback.status='in_progress';linkedCallback.acceptedAt=new Date(acceptedAt).toISOString();}
  const waitSeconds = Math.max(0, Math.floor((queueAcceptedAt - Date.parse(contact.queuedAt)) / 1000));
  state.totalWaitSeconds += waitSeconds;
  state.acceptedContacts++;
  if(waitSeconds<=60)state.contactsWithinSla++;
  state.currentCall={scenarioId:scenario.id,queueContactId:contact.id,stepIndex:0,score:0,behaviourScore:0,feedback:null,feedbackType:'neutral',breach:false,held:false,startedAt:acceptedAt,waitSeconds,commitmentId:linkedCallback?.commitmentId||null};
  ensureVoiceCustomerBehaviour(state.currentCall,contact,scenario,queueAcceptedAt);
  setAgentState('busy','Inbound customer contact accepted');
  voiceConsent=false;voiceStatus='inactive';voiceTranscript='';
  syncQueueCount();
  pushOperationEvent('call',contact.id,`Inbound contact connected · ${scenario.issue}`,'connected',{customer:scenario.customer,routeGroup:contact.routeGroup,priority:contact.priority,waitSeconds});
  saveState();renderView();
}

function ensureVoiceSupervisorRequest(call,contact,reason='Customer interaction requires supervisor review'){
  if(!call||!contact)return null;
  const existing=state.supervisorRequests.find(item=>item.contactId===contact.id&&item.status==='open');
  if(existing)return existing;
  const request={id:makeCallReference('SUP'),contactId:contact.id,reference:contact.reference||contact.id,customer:contact.customer,reason,status:'open',createdAt:new Date().toISOString(),channel:'Inbound voice'};
  state.supervisorRequests.push(request);
  pushOperationEvent('supervisor',contact.id,'Adaptive voice behaviour raised a supervisor intervention request.','open',{reason,channel:'Inbound voice'});
  return request;
}

function recordInboundVoiceResult(call,contact,result,source='guided_action'){
  const behaviour=result?.behaviour;
  if(!behaviour)throw new Error('The customer response could not be evaluated.');
  const snapshot=voiceCustomerBehaviourSnapshot(behaviour);
  const critical=result.criticalBreach===true||result.breach===true||snapshot.qualityFlags.includes('prohibited_secret_request')||snapshot.qualityFlags.includes('critical_handling_breach');
  if(critical&&!call.voiceCriticalBreachRecorded){
    call.voiceCriticalBreachRecorded=true;
    call.breach=true;
    state.incidents++;
  }
  call.behaviourScore=Math.max(-8,Math.min(8,(Number(call.behaviourScore)||0)+(Number(result.scoreDelta)||0)));
  call.voiceReplyRequired=!!result.pendingDecision;
  addCallTimeline(call,source==='free_response'?'Agent spoke or typed a live response to the customer.':'Agent selected a guided voice-handling response.',{
    voiceTurn:behaviour.turns,
    customerEmotion:snapshot.emotion,
    customerSentiment:snapshot.sentiment,
    customerPatience:snapshot.patience,
    customerInterrupted:result.interrupted===true,
    pendingCustomerDecision:behaviour.pendingDecision?.type||null,
    securityBreach:critical,
    negotiationCount:snapshot.negotiationCount,
    needsSupervisor:snapshot.needsSupervisor,
    qualityFlags:snapshot.qualityFlags,
    voiceSource:source
  });
  if(snapshot.needsSupervisor){
    ensureVoiceSupervisorRequest(call,contact,snapshot.supervisorReason||'Customer emotion or voice quality requires supervisor review.');
  }
  pushOperationEvent('voice-customer',contact.id,`Customer reacted: ${snapshot.emotion} · sentiment ${snapshot.sentiment}/100.`,critical?'security_review':snapshot.needsSupervisor?'customer_escalation_risk':result.interrupted?'customer_interruption':'customer_reaction',{
    customer:contact.customer,persona:snapshot.personaLabel,sentiment:snapshot.sentiment,patience:snapshot.patience,
    interruptions:snapshot.interruptionCount,negotiations:snapshot.negotiationCount,qualityFlags:snapshot.qualityFlags
  });
  return result;
}

function recordInboundVoiceTurn(call,contact,utterance,source='free_response',guidedOption=null){
  if(!call||!contact)throw new Error('The active inbound voice contact is unavailable.');
  const scenario=inboundScenarios.find(item=>item.id===call.scenarioId);
  if(!scenario)throw new Error('The active inbound scenario is unavailable.');
  const now=queueSimulationNowMs();
  ensureVoiceCustomerBehaviour(call,contact,scenario,now);
  const result=source==='free_response'
    ? evaluateVoiceAgentUtterance(call.voiceBehaviour,utterance,{scenario,stepIndex:call.stepIndex,now})
    : evaluateVoiceCustomerTurn(call.voiceBehaviour,{
        text:guidedOption?.text||String(utterance||''),feedback:guidedOption?.feedback||'',score:Number(guidedOption?.score)||0,breach:!!guidedOption?.breach
      },{scenario,stepIndex:call.stepIndex,now});
  return recordInboundVoiceResult(call,contact,result,source);
}

function submitInboundVoiceResponse(value){
  const call=state.currentCall;
  const contact=call?.queueContactId?findQueueContact(call.queueContactId):null;
  if(!call||!contact){toast('There is no connected inbound customer to respond to.','warning');return false;}
  if(call.held){toast('Resume the customer call before sending a response.','warning');return false;}
  if(call.voiceBehaviour?.pendingDecision){toast('Resolve the customer interruption or service-recovery decision before speaking again.','warning');return false;}
  if(voiceStatus==='recording'||voiceStatus==='transcribing'){toast('Stop microphone capture or transcription before sending the response.','warning');return false;}
  try{
    const safe=sanitizeVoiceCustomerText(String(value||''));
    const result=recordInboundVoiceTurn(call,contact,safe,'free_response');
    call.feedback=result.customerMessage||'Customer response recorded. Continue the call.';
    call.feedbackType=result.criticalBreach||result.unsupportedPromise||result.qualityFlag?'bad':Number(result.scoreDelta)>0?'good':'neutral';
    voiceTranscript='';
    saveState();renderView();
    const message=result.criticalBreach?'Security breach recorded. Stop the prohibited request and involve a supervisor.':result.pendingDecision?.type==='interruption'?'The customer interrupted. Choose how to respond before continuing.':result.pendingDecision?.type==='negotiation'?'The customer requested a concrete remedy. Choose an authorised service-recovery response.':'Customer response recorded in the live call.';
    toast(message,result.needsSupervisor||result.criticalBreach?'warning':'success');
    return true;
  }catch(error){toast(error.message||'The voice response could not be recorded.','warning');return false;}
}

function resolveInboundVoiceDecision(optionId){
  const call=state.currentCall;
  const contact=call?.queueContactId?findQueueContact(call.queueContactId):null;
  if(!call||!contact||!call.voiceBehaviour?.pendingDecision){toast('There is no customer interruption or negotiation awaiting a response.','warning');return;}
  try{
    const result=resolveVoiceCustomerDecision(call.voiceBehaviour,optionId,{now:queueSimulationNowMs()});
    call.behaviourScore=Math.max(-8,Math.min(8,(Number(call.behaviourScore)||0)+(Number(result.scoreDelta)||0)));
    if(result.qualityFlag){call.behaviourScore=Math.max(-8,call.behaviourScore-1);}
    const snapshot=voiceCustomerBehaviourSnapshot(call.voiceBehaviour);
    call.voiceReplyRequired=!!call.voiceBehaviour.pendingDecision;
    if(snapshot.needsSupervisor)ensureVoiceSupervisorRequest(call,contact,snapshot.supervisorReason);
    addCallTimeline(call,`Agent resolved customer ${result.event.type.replace('_resolved','').replaceAll('_',' ')}: ${result.option.label}.`,{
      voiceDecision:result.option.id,customerEmotion:snapshot.emotion,customerSentiment:snapshot.sentiment,
      customerPatience:snapshot.patience,pendingCustomerDecision:call.voiceBehaviour.pendingDecision?.type||null,
      needsSupervisor:snapshot.needsSupervisor,qualityFlag:result.qualityFlag||null
    });
    pushOperationEvent('voice-customer',contact.id,`Customer response decision recorded: ${result.option.label}.`,snapshot.needsSupervisor?'customer_escalation_risk':'customer_decision_resolved',{
      decision:result.option.id,sentiment:snapshot.sentiment,patience:snapshot.patience,needsSupervisor:snapshot.needsSupervisor
    });
    saveState();renderView();
    toast(result.pendingDecision?'Customer has moved to a further service-recovery decision.':'Customer response recorded. Continue the call.',snapshot.needsSupervisor?'warning':'success');
  }catch(error){toast(error.message||'The customer decision could not be resolved.','warning');}
}

function applyCallChoice(index){
  const call=state.currentCall;const scenario=inboundScenarios.find(s=>s.id===call?.scenarioId);const option=scenario?.steps?.[call.stepIndex]?.options?.[index];if(!option)return;
  if(call.voiceBehaviour?.pendingDecision){toast('Resolve the customer response before selecting another call action.','warning');return;}
  if((Number(call.voiceBehaviour?.turns)||0)>=VOICE_CUSTOMER_BEHAVIOUR_POLICY.maxAgentTurns){toast('The voice conversation reached its turn limit. Complete wrap-up or request supervisor support.','warning');return;}
  const contact=findQueueContact(call.queueContactId);
  call.score+=option.score;call.feedback=option.feedback;call.feedbackType=option.breach||option.score<0?'bad':option.score>0?'good':'neutral';call.breach=call.breach||!!option.breach;
  if(contact){try{recordInboundVoiceTurn(call,contact,option.text,'guided_choice',option);}catch(error){toast(error.message,'warning');}}
  addCallTimeline(call,`Agent selected: ${option.text}`,{scoreDelta:option.score,breach:!!option.breach});
  saveState();renderView();
}
function beginInboundWrapUp(transferred = false){
  const call=state.currentCall;
  if(!call)return;
  if(call.held){toast('Resume the call before moving it to wrap-up.','warning');return;}
  if(call.voiceBehaviour?.pendingDecision){toast('Resolve the customer interruption or outstanding service-recovery question before closing the conversation.','warning');return;}
  const scenario=inboundScenarios.find(item=>item.id===call.scenarioId);
  const contact=findQueueContact(call.queueContactId);
  if(!scenario||!contact){toast('The active contact record is missing.','error');return;}
  if(contact.status==='connected')transitionContact(contact,CONTACT_STATUS.WRAP_UP,'Customer conversation completed; after-contact work started',queueSimulationNowMs());
  else if(contact.status==='transferred')transitionContact(contact,CONTACT_STATUS.WRAP_UP,'Transferred interaction entered after-contact work',queueSimulationNowMs());
  const finalVoiceBehaviour=voiceCustomerBehaviourSnapshot(call.voiceBehaviour);
  const finalVoiceOutcome=voiceCustomerOutcome(call.voiceBehaviour);
  const voiceQualityScore=finalVoiceBehaviour?Math.max(0,Math.min(100,Math.round(78+(finalVoiceBehaviour.sentiment-50)*0.30+(finalVoiceBehaviour.patience-50)*0.12-finalVoiceBehaviour.qualityFlags.length*13-finalVoiceBehaviour.interruptionCount*3))):null;
  if(finalVoiceBehaviour)finalVoiceBehaviour.qualityScore=voiceQualityScore;
  const voiceRequiresEscalation=transferred||call.breach||finalVoiceOutcome.defaultDisposition==='escalated';
  const qa=Math.max(0,Math.min(100,Math.round(70+call.score*5+(Number(call.behaviourScore)||0)*2+(Number(voiceQualityScore??76)-76)*0.35-(call.breach?35:0))));
  stopVoiceTools();
  setAgentState('wrap-up','Inbound call entered after-contact work');
  state.wrapUp={type:'inbound',contactId:contact.id,scenarioId:scenario.id,reference:scenario.reference,customer:scenario.customer,title:scenario.issue,channel:'Inbound',qa,score:call.score,behaviourScore:Number(call.behaviourScore)||0,voiceBehaviour:finalVoiceBehaviour,voiceOutcome:finalVoiceOutcome,voiceRequiresEscalation,breach:call.breach,transferred:!!transferred,transferTarget:call.transferredTo||'',startedAt:Date.now(),defaultDisposition:voiceRequiresEscalation?'escalated':'resolved'};
  pushOperationEvent('wrap-up',contact.id,'After-contact work started.','wrap_up',{qa,breach:call.breach});
  saveState();renderView();
}
function beginOutboundWrapUp(){
  const active=state.activeOutbound;
  if(!active)return;
  const task=activeOutboundTask(active);
  if(!task)return;
  const noConnect=['no_answer','busy','voicemail'].includes(active.connectionOutcome);
  const summary=active.conversation?outboundConversationSummary(active.conversation):null;
  if(summary){
    active.score=summary.averageScore===null?0:(summary.averageScore/100)*6;
    active.breach=summary.criticalBreaches.length>0;
    active.suppressionRequested=summary.suppressionRequested;
    active.disposition=active.conversation.dispositionHint||active.disposition||null;
  }
  const qa=noConnect?90:(summary?.averageScore??Math.max(0,Math.min(100,Math.round(70+active.score*5-(active.breach?35:0)))));
  const fallbackDisposition=noConnect?active.connectionOutcome:active.breach?'review':summary?.callbackRequested?'callback':summary?.status==='ready_for_wrap_up'?'completed':'review';
  const defaultDisposition=active.suppressionRequested?'opt_out':active.disposition||fallbackDisposition;
  setAgentState('wrap-up','Outbound call entered after-contact work');
  state.wrapUp={type:'outbound',contactId:active.attemptId,reference:active.attemptId,customer:task.customer,title:task.title,channel:'Outbound',qa,score:active.score,breach:active.breach,startedAt:Date.now(),defaultDisposition,suppressionRequested:!!active.suppressionRequested,campaignId:task.id,campaignContactId:active.campaignContactId||null,attemptNumber:active.attemptNumber||1,connectionOutcome:active.connectionOutcome||'answered',conversationSummary:summary?{...summary,customerDecision:active.conversation.customerDecision,disposition:active.conversation.dispositionHint}:null};
  pushOperationEvent('wrap-up',active.attemptId,noConnect?'Outbound dial attempt entered after-contact work.':'Outbound contact entered after-contact work.','wrap_up',{qa,breach:active.breach,disposition:defaultDisposition,connectionOutcome:active.connectionOutcome||'answered',attemptNumber:active.attemptNumber||1});
  saveState();renderView();
}
function renderWrapUp(){
  const wrap=state.wrapUp;
  if(!wrap)return;
  const inbound=wrap.type==='inbound';
  const noConnectOutcome = !inbound && ['no_answer','busy','voicemail'].includes(wrap.connectionOutcome);
  const noConnectLabel = wrap.connectionOutcome === 'no_answer' ? 'No answer — retry policy applied' : wrap.connectionOutcome === 'busy' ? 'Line busy — retry policy applied' : 'Voicemail — retry policy applied';
  const allowed = inbound
    ? ((wrap.breach || wrap.transferred || wrap.voiceRequiresEscalation) ? [['escalated','Escalate to specialist / quality review']] : [['resolved','Resolved'],['escalated','Escalated to specialist'],['callback','Callback required']])
    : noConnectOutcome ? [[wrap.connectionOutcome,noConnectLabel]]
      : (wrap.breach ? [['review','Compliance / quality review']] : [['completed','Completed'],['callback','Customer requested callback'],['declined','Customer declined'],...(wrap.defaultDisposition==='review'?[['review','Review required / specialist follow-up']]:[]),...(wrap.suppressionRequested?[['opt_out','Do not contact — suppression required']]:[])]);
  const defaultDisposition=allowed.some(([value])=>value===wrap.defaultDisposition)?wrap.defaultDisposition:allowed[0][0];
  const contact=findQueueContact(wrap.contactId);
  const transferLine=wrap.transferTarget?`<div class="data-row"><span>Transfer destination</span><strong>${escapeHTML(wrap.transferTarget)}</strong></div>`:'';
  viewRoot.innerHTML=`<div class="wrapup-layout"><section class="panel assessment-card"><div class="panel-head"><div><div class="question-kicker">${inbound?'INBOUND':'OUTBOUND'} · AFTER-CONTACT WORK</div><h3 style="margin-top:7px">Complete the interaction record</h3></div><span class="pill amber">WRAP-UP</span></div><div class="customer-strip"><div class="customer-avatar">${escapeHTML(initials(wrap.customer))}</div><div class="customer-info"><strong>${escapeHTML(wrap.customer)}</strong><small>${escapeHTML(wrap.title)} · ${escapeHTML(wrap.reference)}</small></div><span class="pill">QA ${wrap.qa}%</span></div><div class="form-field" style="margin-top:18px"><label for="wrapDisposition">FINAL DISPOSITION</label><select id="wrapDisposition">${allowed.map(([value,label])=>`<option value="${value}" ${value===defaultDisposition?'selected':''}>${label}</option>`).join('')}</select></div><div class="form-field callback-commitment-fields" id="callbackDueWrap" style="display:none"><label for="callbackPlan">AGREED CALLBACK WINDOW</label><select id="callbackPlan"><option value="30-min">Within 30 simulated minutes</option><option value="60-min">Within 60 simulated minutes</option><option value="next-day">Next working day · 09:00</option><option value="two-days">Two working days · 10:00</option></select><label for="commitmentDescription" style="margin-top:8px">WHAT ARE WE PROMISING THE CUSTOMER?</label><textarea id="commitmentDescription" rows="2" minlength="10" maxlength="180" placeholder="For example: Confirm the investigation outcome and explain the next step."></textarea><small class="muted-note" id="callbackDuePreview">Choose a callback window to preview the due time.</small></div><div class="form-field"><label for="wrapNotes">FACTUAL CASE NOTES</label><textarea id="wrapNotes" rows="5" minlength="12" maxlength="1200" placeholder="Record the customer's issue, checks performed, action taken and agreed next step. A minimum of 12 characters is required.">${escapeHTML(wrap.transferred?`Transferred to ${wrap.transferTarget}. `:'')}</textarea><small class="muted-note">Do not enter PINs, passwords, one-time codes or unnecessary sensitive information.</small></div><div class="article-box"><h4>After-contact checklist</h4><p>Confirm the disposition, document the actual action, set a callback only when requested, and route unresolved or security-sensitive cases correctly.</p></div><div class="assessment-footer"><small>${wrap.breach?'A critical breach requires escalation or review.':'Saving this record updates the queue, case history and performance metrics.'}</small><button class="btn primary" data-action="save-wrap-up">Save record & finish →</button></div></section><aside class="panel"><div class="panel-head"><div><h3>Interaction summary</h3><p>Operational event data.</p></div><span class="pill green">RECORDED ACTIVITY</span></div><div class="data-list"><div class="data-row"><span>Customer</span><strong>${escapeHTML(wrap.customer)}</strong></div><div class="data-row"><span>Channel</span><strong>${wrap.channel}</strong></div><div class="data-row"><span>Reference</span><strong>${escapeHTML(wrap.reference)}</strong></div><div class="data-row"><span>Quality estimate</span><strong>${wrap.qa}%</strong></div>${wrap.voiceBehaviour?`<div class="data-row"><span>Customer sentiment</span><strong>${wrap.voiceBehaviour.sentiment}/100 · ${escapeHTML(wrap.voiceBehaviour.emotion)}</strong></div><div class="data-row"><span>Interruptions</span><strong>${wrap.voiceBehaviour.interruptionCount}</strong></div><div class="data-row"><span>Voice QA</span><strong>${wrap.voiceBehaviour.qualityScore}%</strong></div><div class="data-row"><span>Negotiation status</span><strong>${escapeHTML((wrap.voiceBehaviour.negotiationResolved?'resolved':wrap.voiceBehaviour.negotiationCount?'review required':'not started').replaceAll('_',' '))}</strong></div><div class="data-row"><span>Call outcome</span><strong>${escapeHTML(wrap.voiceOutcome?.label||'Not assessed')}</strong></div>`:''}<div class="data-row"><span>Contact priority</span><strong>${contact?escapeHTML(contact.priority.toUpperCase()):'STANDARD'}</strong></div>${transferLine}</div><p class="muted-note" style="margin-top:14px">After-contact work is part of handling time and must be completed before the next contact is accepted.</p></aside></div>`;
  const disposition=$('#wrapDisposition');
  const callbackWrap=$('#callbackDueWrap');
  const plan=$('#callbackPlan');
  const updatePreview=()=>{
    if(!plan||!$('#callbackDuePreview')||!CommitmentEngine)return;
    try{const due=CommitmentEngine.makeDue(commitmentShiftSnapshot(),plan.value);$('#callbackDuePreview').textContent=`Due ${due.dueDate} · ${CommitmentEngine.formatClock(due.dueMinutes)} on the simulated shift calendar.`;}
    catch(error){$('#callbackDuePreview').textContent=error.message;}
  };
  const updateCallback=()=>{if(callbackWrap)callbackWrap.style.display=disposition?.value==='callback'?'block':'none';updatePreview();};
  disposition?.addEventListener('change',updateCallback);plan?.addEventListener('change',updatePreview);updateCallback();
}
function saveWrapUp(){
  const wrap=state.wrapUp;if(!wrap)return;
  const notes=$('#wrapNotes')?.value.trim()||'';
  const disposition=$('#wrapDisposition')?.value||wrap.defaultDisposition;
  if(notes.length<12){toast('Add factual case notes of at least 12 characters.','error');return;}
  const inbound=wrap.type==='inbound';
  const noConnectOutcome=!inbound&&['no_answer','busy','voicemail'].includes(wrap.connectionOutcome);
  const allowedDispositions=inbound
    ? ((wrap.breach||wrap.transferred||wrap.voiceRequiresEscalation)?['escalated']:['resolved','escalated','callback'])
    : noConnectOutcome?[wrap.connectionOutcome]
      : (wrap.breach?['review']:['completed','callback','declined',...(wrap.defaultDisposition==='review'?['review']:[]),...(wrap.suppressionRequested?['opt_out']:[])]);
  if(!allowedDispositions.includes(disposition)){toast('Choose a permitted final disposition for this interaction.','error');return;}
  const createdAt=new Date().toISOString();
  let contact=inbound?findQueueContact(wrap.contactId):null;
  const activeForCommitment=!inbound?state.activeOutbound:null;
  const taskForCommitment=!inbound?activeOutboundTask(activeForCommitment):null;
  if(inbound&&!contact){toast('Contact record missing; wrap-up was not saved.','error');return;}
  let callbackDraft=null;
  let callbackDueISO=null;
  let worklistCallbackDueISO=null;
  if(disposition==='callback'){
    const planId=$('#callbackPlan')?.value||'30-min';
    const commitmentText=$('#commitmentDescription')?.value?.trim()||'';
    try{
      callbackDraft=prepareCallbackCommitment(wrap,contact,taskForCommitment,planId,commitmentText);
      callbackDueISO=commitmentDateTimeISO(callbackDraft.fields.dueDate,callbackDraft.fields.dueMinutes);
      // The dialler keeps a wall-clock compatibility timestamp; actual eligibility is governed by the simulated commitment clock.
      worklistCallbackDueISO=new Date(Date.now()+60_000).toISOString();
    }catch(error){toast(error.message||'Customer callback promise could not be validated.','error');return;}
  }
  const started=wrap.startedAt||Date.now();
  const acwSeconds=Math.max(1,Math.round((Date.now()-started)/1000));
  let createdCommitment=null;
  if(inbound){
    let scheduledCallback=null;
    // Complete the previous callback attempt only after the new promise has passed validation.
    completeActiveCallback(state.callbacks,{contactId:contact.id},Date.now());
    if(disposition==='callback'){
      createdCommitment=CommitmentEngine.createCommitment(commitmentStore(),callbackDraft.input,callbackDraft.shift,new Date(createdAt));
      scheduledCallback=createCallbackRecordFromCommitment(createdCommitment,{type:'inbound',contactId:contact.id,customer:contact.customer,scenarioId:contact.scenarioId,issue:contact.issue});
    }
    if(disposition==='callback'){
      transitionContact(contact,CONTACT_STATUS.CALLBACK,'Customer callback scheduled',queueSimulationNowMs(),{dueAt:callbackDueISO});
    }else if(disposition==='escalated'){
      transitionContact(contact,CONTACT_STATUS.ESCALATED,'Case escalated after wrap-up',queueSimulationNowMs());
    }else{
      transitionContact(contact,CONTACT_STATUS.COMPLETED,'Interaction completed after wrap-up',queueSimulationNowMs());
    }
    const resolved=disposition==='resolved'&&!wrap.breach;
    const status=disposition==='resolved'?'Resolved':disposition==='callback'?'Callback scheduled':disposition==='escalated'?'Escalated / review required':'Transferred / review required';
    const elapsedMinutes=Math.max(0.1,Math.round((((wrap.startedAt||Date.now())-(state.currentCall?.startedAt||wrap.startedAt||Date.now()))/60000)*10)/10);
    const voiceSentiment=Number(wrap.voiceBehaviour?.sentiment);
    const simulatedCsat=Number.isFinite(Number(wrap.voiceOutcome?.customerSatisfaction))?Number(wrap.voiceOutcome.customerSatisfaction):(Number.isFinite(voiceSentiment)?Math.max(1,Math.min(5,Math.round(voiceSentiment/20*10)/10)):(resolved?4.6:wrap.breach?2.1:3.4));
    state.callsHandled++;state.totalQA+=wrap.qa;state.qaCount++;state.totalCSAT+=simulatedCsat;state.csatCount++;state.totalHandleMinutes+=elapsedMinutes;
    if(resolved)state.resolutions++;
    const voiceFlags=wrap.voiceBehaviour?.qualityFlags||[];
    const record={reference:wrap.reference,contactId:wrap.contactId,customer:wrap.customer,title:wrap.title,channel:'Inbound',status,disposition,notes,qa:wrap.qa,csat:simulatedCsat,customerSentiment:Number.isFinite(voiceSentiment)?voiceSentiment:null,customerEmotion:wrap.voiceBehaviour?.emotion||null,customerMood:wrap.voiceBehaviour?.emotion||null,customerPersona:wrap.voiceBehaviour?.personaLabel||null,customerInterruptions:wrap.voiceBehaviour?.interruptionCount||0,customerEscalationRisk:wrap.voiceBehaviour?.needsSupervisor===true,voiceNegotiationStatus:wrap.voiceBehaviour?.negotiationResolved?'resolved':wrap.voiceBehaviour?.negotiationCount?'review_required':'not_started',voiceQualityScore:wrap.voiceBehaviour?.qualityScore??null,voiceSecurityBreach:voiceFlags.includes('prohibited_secret_request')||voiceFlags.includes('critical_handling_breach'),voiceQualityFlags:voiceFlags,voiceSupervisorReason:wrap.voiceBehaviour?.supervisorReason||null,voiceOutcome:wrap.voiceOutcome?.outcome||'not_recorded',voiceTranscript:wrap.voiceBehaviour?.transcript||[],acwSeconds,createdAt,owner:state.applicantName||'Agent',timeline:contact.timeline.slice()};
    state.cases.push(record);recordCustomerContinuityFromCase(record,{customerRef:contact?.customerRef});state.experience+=resolved?14:7;state.bonus+=resolved?350:0;state.shiftMinutes+=Math.max(1,Math.round(elapsedMinutes+acwSeconds/60));
    const fulfilledInboundCommitment=state.currentCall?.commitmentId;
    if(fulfilledInboundCommitment){
      const outcome=disposition==='escalated'?'further-action':'completed';
      recordCommitmentOutcome(fulfilledInboundCommitment,outcome,`Inbound callback handled. Disposition: ${disposition}. ${notes}`,{retrySource:{type:'inbound',contactId:contact.id,customer:contact.customer,scenarioId:contact.scenarioId,issue:contact.issue}});
    }
    if((disposition==='escalated'||wrap.breach)&&!state.supervisorRequests.some(item=>item.contactId===wrap.contactId&&item.status==='open')){state.supervisorRequests.push({id:makeCallReference('SUP'),contactId:wrap.contactId,reference:wrap.reference,customer:wrap.customer,reason:wrap.breach?'Critical compliance / security review':'Specialist escalation',status:'open',createdAt,channel:'Inbound voice'});}
    pushOperationEvent('case',wrap.reference,`Inbound case saved · ${status}`,'saved',{disposition,qa:wrap.qa,acwSeconds});
    state.currentCall=null;
  }else{
    const active=state.activeOutbound;
    const task=activeOutboundTask(active);
    if(!active||!task){toast('Outbound campaign record missing; wrap-up was not saved.','error');return;}
    const workItem=ensureActiveOutboundWorkItem(active,outboundCampaigns.find(item=>item.id===wrap.campaignId));
    if(!workItem){toast('Outbound campaign worklist record is missing; wrap-up was not saved.','error');return;}
    const noConnectOutcome=['no_answer','busy','voicemail'].includes(wrap.connectionOutcome);
    const outboundOutcome=noConnectOutcome?wrap.connectionOutcome:disposition;
    // Validate the callback date before changing the campaign worklist or customer preference.
    const outboundCallback=null;
    if(disposition==='opt_out'&&!wrap.suppressionRequested){toast('The customer has not requested suppression in this scenario.','error');return;}
    let worklistResult;
    try{
      worklistResult=finishCampaignContact(state.outboundWorklist,workItem.id,{
        attemptId:active.attemptId,
        outcome:outboundOutcome,
        now:Date.now(),
        callbackDueAt:worklistCallbackDueISO
      });
    }catch(error){toast(error.message||'Campaign contact outcome could not be recorded.','error');return;}
    if(disposition==='opt_out'){
      addSuppression(state.outboundSuppressions,task.customer,'Customer requested no further campaign contact',Date.now());
    }
    completeActiveCallback(state.callbacks,{callbackId:active.callbackId},Date.now());
    if(disposition==='callback'){
      createdCommitment=CommitmentEngine.createCommitment(commitmentStore(),callbackDraft.input,callbackDraft.shift,new Date(createdAt));
      createCallbackRecordFromCommitment(createdCommitment,{type:'outbound',contactId:wrap.contactId,campaignContactId:workItem.id,customer:task.customer,campaignId:task.id,issue:task.title});
      workItem.status='callback_scheduled';workItem.nextEligibleAt=null;workItem.callbackDueAt=worklistCallbackDueISO;
    }
    const conversation=active.conversation||null;
    const conversationSummary=conversation?outboundConversationSummary(conversation):null;
    const conversationHasExplicitOfferAcceptance=task.id!=='product-offer'||conversation?.customerDecision==='accepted';
    const good=!noConnectOutcome&&disposition==='completed'&&!active.breach&&conversationHasExplicitOfferAcceptance&&(conversationSummary?Number(conversationSummary.averageScore)>=67:active.score>=4);
    state.outboundCalls++;
    state.totalQA+=wrap.qa;state.qaCount++;
    if(!noConnectOutcome){state.totalCSAT+=good?4.5:active.breach?2.1:disposition==='declined'?3.8:3.3;state.csatCount++;}
    if(good&&task.id==='product-offer'&&conversation?.customerDecision==='accepted')state.sales++;
    const status=noConnectOutcome
      ? (worklistResult.status==='exhausted'?`${wrap.connectionOutcome.replaceAll('_',' ')} — attempt limit reached`:`${wrap.connectionOutcome.replaceAll('_',' ')} — retry scheduled`)
      : disposition==='opt_out'?'Opt-out recorded':disposition==='callback'?'Callback scheduled':disposition==='declined'?'Customer declined':disposition==='review'?'Review required':good?'Completed':'Review required';
    const transcript=Array.isArray(conversation?.messages)?conversation.messages.map(item=>({type:item.speaker==='agent'?'agent':'customer',text:item.text,at:item.at})):[];
    const scorecards=Array.isArray(conversation?.scorecards)?conversation.scorecards.map(item=>({...item})):[];
    const attemptRecord={id:wrap.contactId,customer:task.customer,campaignId:task.id,campaignContactId:workItem.id,attemptNumber:active.attemptNumber||workItem.attempts,outcome:status,disposition:outboundOutcome,connectionOutcome:wrap.connectionOutcome||'answered',createdAt,suppressed:disposition==='opt_out',customerPreference:conversation?.preference||null,customerDecision:conversation?.customerDecision||null,callbackRequested:!!conversation?.callbackRequested,suppressionRequested:!!conversation?.suppressionRequested,criticalBreaches:[...(conversation?.criticalBreaches||[])],attemptsRemaining:worklistResult.attemptsRemaining,nextEligibleAt:worklistResult.nextEligibleAt||worklistResult.callbackDueAt||null,messages:transcript,scorecards};
    const outboundCase={reference:wrap.reference,contactId:wrap.contactId,campaignContactId:workItem.id,attemptNumber:active.attemptNumber||workItem.attempts,customer:task.customer,title:task.title,channel:'Outbound',status,disposition:outboundOutcome,connectionOutcome:wrap.connectionOutcome||'answered',notes,qa:wrap.qa,acwSeconds,createdAt,owner:state.applicantName||'Agent',customerPreference:conversation?.preference||null,customerDecision:conversation?.customerDecision||null,callbackRequested:!!conversation?.callbackRequested,suppressionRequested:!!conversation?.suppressionRequested,criticalBreaches:[...(conversation?.criticalBreaches||[])],messages:transcript,scorecards,attemptsRemaining:worklistResult.attemptsRemaining,nextEligibleAt:worklistResult.nextEligibleAt||worklistResult.callbackDueAt||null};
    state.cases.push(outboundCase);recordCustomerContinuityFromCase(outboundCase,{customerRef:task.customerRef});
    state.outboundAttempts.push(attemptRecord);
    if(active.commitmentId){
      if(noConnectOutcome){
        const result=recordCommitmentOutcome(active.commitmentId,'no-answer',`Outbound callback attempt ${active.attemptNumber||1} ended: ${wrap.connectionOutcome}. ${notes}`);
        if(result?.item?.status==='Open')scheduleRetryForCommitment(result.item,{type:'outbound',contactId:wrap.contactId,campaignContactId:workItem.id,customer:task.customer,campaignId:task.id,issue:task.title});
      }else{
        recordCommitmentOutcome(active.commitmentId,'completed',`Customer reached through the promised outbound callback. Disposition: ${disposition}. ${notes}`);
      }
    }
    if(disposition==='review'&&!state.supervisorRequests.some(item=>item.contactId===wrap.contactId&&item.status==='open'))state.supervisorRequests.push({id:makeCallReference('SUP'),contactId:wrap.contactId,reference:wrap.reference,customer:task.customer,reason:'Outbound campaign conversation requires supervisor / compliance review',status:'open',createdAt,channel:'Outbound voice'});
    const campaignContacts=state.outboundWorklist.filter(item=>item.campaignId===task.id);
    if(campaignContacts.length&&campaignContacts.every(item=>['completed','suppressed','review_required','exhausted'].includes(item.status))&&!state.outboundDone.includes(task.id))state.outboundDone.push(task.id);
    state.experience+=good?12:noConnectOutcome?1:6;state.bonus+=good?250:0;state.shiftMinutes+=Math.max(1,Math.round(acwSeconds/60))+2;
    pushOperationEvent('campaign',wrap.reference,`Outbound case saved · ${status}`,'saved',{campaignId:task.id,campaignContactId:workItem.id,attemptNumber:active.attemptNumber||workItem.attempts,disposition:outboundOutcome,connectionOutcome:wrap.connectionOutcome||'answered',qa:wrap.qa,conversationTurns:conversationSummary?.turns||0,customerPreference:conversation?.preference||null,customerDecision:conversation?.customerDecision||null,criticalBreaches:conversation?.criticalBreaches||[],nextEligibleAt:worklistResult.nextEligibleAt||worklistResult.callbackDueAt||null});
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
    transitionContact(contact,CONTACT_STATUS.ON_HOLD,'Agent placed the customer on hold',queueSimulationNowMs());call.held=true;
    pushOperationEvent('call',contact.id,'Customer placed on hold.','on_hold');
  }else if(contact.status==='on_hold'){
    transitionContact(contact,CONTACT_STATUS.CONNECTED,'Agent resumed the customer conversation',queueSimulationNowMs());call.held=false;
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
function requestDigitalSupervisor(contactId){
  const contact=findDigitalContact(state.digitalQueue,contactId);
  if(!contact||![DIGITAL_STATUS.ACTIVE,DIGITAL_STATUS.AWAITING_CUSTOMER].includes(contact.status)){toast('The digital customer interaction is no longer active.','warning');return;}
  if(state.supervisorRequests.some(item=>item.contactId===contact.id&&item.status==='open')){toast('A supervisor request is already open for this contact.');return;}
  const behaviour=ensureDigitalCustomerBehaviour(contact);
  const reason=behaviour.supervisorReason||'Agent requested supervisor assistance during a digital interaction';
  state.supervisorRequests.push({id:makeCallReference('SUP'),contactId:contact.id,reference:contact.id,customer:contact.customer,reason,status:'open',createdAt:new Date().toISOString(),channel:contact.channelLabel||contact.channel,customerSentiment:behaviour.sentiment});
  pushOperationEvent('supervisor',contact.id,'Agent requested supervisor assistance for a digital customer interaction.','open',{customerSentiment:behaviour.sentiment,customerMood:behaviour.mood});
  saveState();toast('Supervisor assistance requested.','success');renderView();
}
function transferInboundCall(){
  const call=state.currentCall;if(!call)return;
  const contact=findQueueContact(call.queueContactId);if(!contact)return;
  const target=$('#transferTarget')?.value||'Specialist Support';
  if(!['connected','on_hold'].includes(contact.status)){toast('This contact cannot be transferred from its current state.','error');return;}
  transitionContact(contact,CONTACT_STATUS.TRANSFERRED,`Contact transferred to ${target}`,queueSimulationNowMs(),{target});
  call.transferredTo=target;call.held=false;
  pushOperationEvent('transfer',contact.id,`Transferred to ${target}.`,'transferred',{target});
  beginInboundWrapUp(true);
}
function returnCallToQueue(){
  const call=state.currentCall;if(!call)return;
  const contact=findQueueContact(call.queueContactId);if(!contact)return;
  if(['connected','on_hold'].includes(contact.status)){const queueNow=queueSimulationNowMs();transitionContact(contact,CONTACT_STATUS.QUEUED,'Contact returned to inbound queue',queueNow);contact.queuedAt=new Date(queueNow).toISOString();}
  state.currentCall=null;stopVoiceTools();if(state.shiftActive)setAgentState('available','Contact returned to queue');syncQueueCount();pushOperationEvent('call',contact.id,'Contact returned to queue without a completed interaction.','queued');saveState();renderView();toast('Contact returned to the inbound queue.');
}
function returnCallbackToQueue(callbackId){
  const callback=state.callbacks.find(item=>item.id===callbackId&&item.status==='scheduled'&&item.type!=='outbound');
  if(!callback){toast('Scheduled callback was not found.','error');return;}
  if(!callbackIsDue(callback)){toast('This callback is not due yet on the simulated shift calendar. Keep it scheduled until the agreed time.','warning');return;}
  const contact=findQueueContact(callback.contactId);
  if(contact&&contact.status===CONTACT_STATUS.CALLBACK){const queueNow=queueSimulationNowMs();transitionContact(contact,CONTACT_STATUS.QUEUED,'Scheduled callback returned to the inbound queue',queueNow);contact.queuedAt=new Date(queueNow).toISOString();}
  callback.status='queued';callback.queuedAt=new Date().toISOString();syncQueueCount();pushOperationEvent('callback',callback.id,`Callback for ${callback.customer} moved to queue.`,'queued');saveState();renderView();toast('Callback returned to the inbound queue.','success');
}
function changeSupervisorIntake(action){
  if(!state.shiftActive||!state.liveQueueSimulation?.active){toast('Start an active shift before changing queue intake.','warning');return;}
  try{
    const reason=$('#supervisorControlReason')?.value?.trim()||'';
    const result=updateSupervisorQueueControl(state.supervisorQueueControl,action,{actor:state.applicantName||'Floor Supervisor',reason});
    state.supervisorQueueControl=result.control;
    if(result.changed){
      state.liveQueueSimulation.paused=result.control.paused;
      state.liveQueueSimulation.arrivalIntervalMultiplier=SUPERVISOR_INTAKE_MODES[result.control.mode].multiplier;
      state.digitalLiveQueueSimulation=setDigitalQueueDemandMultiplier(state.digitalLiveQueueSimulation,SUPERVISOR_INTAKE_MODES[result.control.mode].multiplier);
      const message=result.event.action==='intake_paused'?'Supervisor paused new inbound arrivals.':result.event.action==='intake_resumed'?'Supervisor resumed inbound arrivals.':`Supervisor changed intake mode to ${SUPERVISOR_INTAKE_MODES[result.control.mode].label}.`;
      pushOperationEvent('supervisor-queue','INBOUND',message,result.event.action,{mode:result.control.mode,paused:result.control.paused,actor:result.event.actor,reason:result.event.reason});
      saveState();
      toast(message,'success');
    }
    renderView();
  }catch(error){toast(error.message||'Queue control could not be updated.','error');}
}

function saveSupervisorTriage(form){
  const kind=form.dataset.supervisorTriage;
  const contactId=form.dataset.contactId;
  const values=new FormData(form);
  const patch={priority:values.get('priority'),routeGroup:values.get('routeGroup'),reason:values.get('reason')};
  try{
    const result=kind==='digital'
      ?triageDigitalContact(state.digitalQueue,contactId,patch,{actor:state.applicantName||'Floor Supervisor',now:Date.now()})
      :triageInboundContact(state.inboundQueueItems,contactId,patch,{actor:state.applicantName||'Floor Supervisor',now:queueSimulationNowMs()});
    if(!result.changed){toast('No queue change was required.','warning');return;}
    const event={id:`${kind}-${contactId}-${Date.now()}`,at:result.event.at,actor:result.event.actor,reference:contactId,reason:patch.reason,message:`${kind==='digital'?'Digital':'Voice'} contact triaged: ${Object.entries(result.event.changes).map(([key,value])=>`${key} ${value.from} → ${value.to}`).join('; ')}.`};
    state.supervisorQueueAudit=Array.isArray(state.supervisorQueueAudit)?state.supervisorQueueAudit:[];
    state.supervisorQueueAudit.push(event);state.supervisorQueueAudit=state.supervisorQueueAudit.slice(-100);
    pushOperationEvent('supervisor-triage',contactId,event.message,'triaged',{channel:kind,reason:patch.reason,changes:result.event.changes,actor:event.actor});
    saveState();renderView();toast('Supervisor triage decision saved and audited.','success');
  }catch(error){toast(error.message||'Queue triage could not be saved.','error');}
}

function claimSupervisorRequest(requestId){
  const actor=state.applicantName||'Floor Supervisor';
  try{
    const request=claimSupervisorEscalation(state.supervisorRequests,requestId,actor,new Date());
    pushOperationEvent('supervisor',request.reference,`Supervisor escalation claimed by ${actor}.`,'in_progress',{requestId,priority:request.escalation.priority,owner:actor});
    saveState();renderView();toast('Supervisor request claimed and assigned to you.','success');
  }catch(error){toast(error.message||'Supervisor request could not be claimed.','warning');}
}
function reassignSupervisorRequest(requestId,values){
  const actor=state.applicantName||'Floor Supervisor';
  try{
    const request=reassignSupervisorEscalation(state.supervisorRequests,requestId,actor,{newOwner:String(values.get('newOwner')||''),reason:String(values.get('reason')||'')},new Date());
    pushOperationEvent('supervisor',request.reference,`Escalation ownership transferred from ${actor} to ${request.escalation.assignedTo}.`,'reassigned',{requestId,reason:String(values.get('reason')||'')});
    saveState();renderView();toast('Supervisor ownership transferred and audited.','success');
  }catch(error){toast(error.message||'Supervisor reassignment could not be saved.','warning');}
}
function resolveSupervisorRequest(requestId,values){
  const actor=state.applicantName||'Floor Supervisor';
  try{
    const request=resolveSupervisorEscalation(state.supervisorRequests,requestId,actor,{outcome:String(values.get('outcome')||''),evidence:String(values.get('evidence')||'')},new Date());
    pushOperationEvent('supervisor',request.reference,`Supervisor escalation resolved by ${actor}: ${request.resolution}.`,'resolved',{requestId,priority:request.escalation.priority,evidence:request.escalation.resolutionEvidence});
    saveState();renderView();toast('Supervisor decision and supporting evidence recorded.','success');
  }catch(error){toast(error.message||'Supervisor decision could not be recorded.','warning');}
}
function resumeOutboundCallback(callbackId){
  const callback=state.callbacks.find(item=>item.id===callbackId&&item.type==='outbound'&&item.status==='scheduled');
  if(!callback){toast('Outbound callback was not found.','error');return;}
  if(!callbackIsDue(callback)){toast('This callback is not due yet on the simulated shift calendar. Keep it scheduled until the agreed time.','warning');return;}
  if(!shiftTimeAvailable()||state.agentStatus!=='available'){toast('An active shift within 08:00–17:00 and Available agent status are required for this callback.','warning');return;}
  if(isContactSuppressed(callback.customer,state.outboundSuppressions)){toast('Contact suppression is active; callback is blocked.','error');return;}
  const worklist=ensureOutboundWorklist();
  let workItem=findCampaignContact(worklist,callback.campaignContactId);
  if(!workItem)workItem=worklist.find(item=>item.campaignId===callback.campaignId&&item.customer===callback.customer);
  if(!workItem){toast('The callback worklist contact could not be found.','error');return;}
  if(workItem.status==='ready'&&workItem.attempts>0){workItem.status='callback_scheduled';workItem.callbackDueAt=new Date(Date.now()-1000).toISOString();}
  if(workItem.status==='callback_scheduled')workItem.callbackDueAt=new Date(Date.now()-1000).toISOString();
  callback.campaignContactId=workItem.id;
  callback.status='in_progress';callback.attemptedAt=new Date().toISOString();
  startOutbound(callback.campaignId,workItem.id,callbackId);
}
function cancelOutbound(){
  const active=state.activeOutbound;if(!active)return;
  const workItem=findCampaignContact(state.outboundWorklist,active.campaignContactId);
  if(workItem&&workItem.status==='in_progress'){
    try{finishCampaignContact(state.outboundWorklist,workItem.id,{attemptId:active.attemptId,outcome:'abandoned',now:Date.now()});}catch{}
  }
  if(active.callbackId){const callback=state.callbacks.find(item=>item.id===active.callbackId);if(callback)callback.status='completed';}
  pushOperationEvent('campaign',active.attemptId,'Outbound simulation attempt ended before wrap-up; contact referred for review.','abandoned',{campaignContactId:active.campaignContactId,attemptNumber:active.attemptNumber||1});
  state.activeOutbound=null;if(state.shiftActive)setAgentState('available','Outbound interaction cancelled');saveState();renderView();toast('Outbound attempt ended and routed for review; no completion credit was recorded.');
}
function beginOutboundDial(id,contactId){
  const task=outboundCampaigns.find(item=>item.id===id);if(!task)return;
  const worklist=ensureOutboundWorklist();
  const now=Date.now();
  let contact=findCampaignContact(worklist,contactId);
  if(!contact){contact=worklist.find(item=>item.campaignId===id&&campaignContactEligibility(item,{now,suppressed:isContactSuppressed(item.customer,state.outboundSuppressions),shiftOpen:true,agentAvailable:true}).allowed);}
  if(!contact){toast('No eligible contact is currently available in this campaign. Check retry times, callbacks, suppression and attempt limits.','warning');return;}
  const eligibility=campaignContactEligibility(contact,{now,suppressed:isContactSuppressed(contact.customer,state.outboundSuppressions),shiftOpen:shiftTimeAvailable(),agentAvailable:state.agentStatus==='available'});
  if(!eligibility.allowed){toast(eligibility.reason,'warning');return;}
  startOutbound(id,contact.id);
}
function levelCheck(){const newLevel=1+Math.floor(state.experience/100);if(newLevel>state.level){state.level=newLevel;toast(`Career progression: Level ${state.level} achieved.`,'success');}}
function startOutbound(id,contactId,callbackId=null){
  const task=outboundCampaigns.find(item=>item.id===id);if(!task)return;
  if(!shiftTimeAvailable()||state.agentStatus!=='available'){toast('An active shift within 08:00–17:00 and Available agent status are required before an outbound contact.','warning');return;}
  const worklist=ensureOutboundWorklist();
  const contact=findCampaignContact(worklist,contactId);
  if(!contact){toast('Campaign contact not found in the worklist.','error');return;}
  const suppressed=isContactSuppressed(contact.customer,state.outboundSuppressions);
  if(suppressed){toast('Contact suppression is active. Campaign blocked.','error');return;}
  const attemptId=makeCallReference(callbackId?'OUT-CBK':'OUT');
  let started;
  try{
    started=startCampaignContact(worklist,contact.id,{attemptId,agentName:state.applicantName||'Customer Experience Agent',now:Date.now(),suppressed,shiftOpen:shiftTimeAvailable(),agentAvailable:state.agentStatus==='available'});
  }catch(error){toast(error.message||'The campaign contact could not be started.','warning');return;}
  const dialResult=resolveDialAttempt(contact,{attemptNumber:started.attemptNumber,seed:state.day||1});
  const linkedCommitment=callbackId?state.callbacks.find(item=>item.id===callbackId)?.commitmentId||null:null;
  state.activeOutbound={commitmentId:linkedCommitment,campaignId:id,campaignContactId:contact.id,contactSnapshot:{customer:contact.customer,initials:contact.initials,campaignContactId:contact.id},attemptId,attemptNumber:started.attemptNumber,maxAttempts:contact.maxAttempts,connectionOutcome:dialResult.outcome,callbackId,stepIndex:0,score:0,feedback:null,feedbackType:'neutral',breach:false,startedAt:Date.now(),suppressionRequested:false,disposition:null};
  if(callbackId){const callback=state.callbacks.find(item=>item.id===callbackId);if(callback){callback.status='in_progress';callback.attemptedAt=new Date().toISOString();callback.campaignContactId=contact.id;}}
  setAgentState('busy',callbackId?'Scheduled outbound callback started':'Outbound campaign contact started');
  pushOperationEvent('campaign',attemptId,`Outbound dial attempt ${started.attemptNumber}/${contact.maxAttempts} · ${task.title} · ${contact.customer}`,'dialling',{campaignId:id,campaignContactId:contact.id,attemptNumber:started.attemptNumber,connectionOutcome:dialResult.outcome});
  saveState();renderView();
}
function completeOutbound(){beginOutboundWrapUp();}

function acceptDigital(contactId) {
  const decision = digitalWorkloadDecision(contactId);
  if (!decision.allowed) { toast(decision.reason, 'warning'); return; }
  try {
    const contact = acceptDigitalContact(state.digitalQueue, contactId, currentAgentReference(), queueSimulationNowMs());
    ensureDigitalCustomerBehaviour(contact);
    syncDigitalWorkSelection(contact.id);
    if (state.agentStatus !== 'busy') setAgentState('busy', `${DIGITAL_CHANNELS[contact.channel].label} customer interaction`);
    appendDigitalEvent(state.digitalEvents, { contactId: contact.id, channel: contact.channel, type: 'accepted', message: `Accepted ${contact.channelLabel} contact`, status: 'active' });
    pushOperationEvent('digital', contact.id, `${contact.channelLabel} contact accepted: ${contact.subject}.`, 'active');
    saveState();
    state.currentView = 'digital';
    renderView();
  } catch (error) { toast(error.message, 'error'); }
}

function recordDigitalSlaTransitions(result) {
  if (!result) return false;
  let changed = false;
  for (const entry of result.newlyAtRisk || []) {
    const { contact, assessment } = entry;
    appendDigitalEvent(state.digitalEvents, { contactId: contact.id, channel: contact.channel, type: 'sla-at-risk', message: `${contact.channelLabel || DIGITAL_CHANNELS[contact.channel].label} first-response SLA entered its risk window.`, status: 'sla_at_risk' }, Date.parse(contact.slaLastEvaluatedAt) || queueSimulationNowMs());
    pushOperationEvent('digital-sla', contact.id, `${contact.channelLabel || DIGITAL_CHANNELS[contact.channel].label} first-response SLA at risk: ${assessment.targetMinutes}-minute target.`, 'sla_at_risk', { customer: contact.customer, targetMinutes: assessment.targetMinutes });
    changed = true;
  }
  for (const entry of result.newlyBreached || []) {
    const { contact, assessment } = entry;
    const message = assessment.responded
      ? `${contact.channelLabel || DIGITAL_CHANNELS[contact.channel].label} first response missed its target by ${Math.ceil(assessment.overdueMs / 60000)} simulated minute(s).`
      : `${contact.channelLabel || DIGITAL_CHANNELS[contact.channel].label} contact exceeded its first-response target while waiting.`;
    appendDigitalEvent(state.digitalEvents, { contactId: contact.id, channel: contact.channel, type: 'sla-breached', message, status: 'sla_breached' }, Date.parse(contact.slaBreachRecordedAt) || queueSimulationNowMs());
    pushOperationEvent('digital-sla', contact.id, message, 'sla_breached', { customer: contact.customer, targetMinutes: assessment.targetMinutes, overdueMs: assessment.overdueMs });
    changed = true;
  }
  for (const entry of result.newlyMet || []) {
    const { contact, assessment } = entry;
    appendDigitalEvent(state.digitalEvents, { contactId: contact.id, channel: contact.channel, type: 'sla-met', message: 'First agent response met the simulated channel target.', status: 'sla_met' }, Date.parse(contact.firstResponseAt) || queueSimulationNowMs());
    pushOperationEvent('digital-sla', contact.id, `${contact.channelLabel || DIGITAL_CHANNELS[contact.channel].label} first-response target met.`, 'sla_met', { customer: contact.customer, targetMinutes: assessment.targetMinutes, responseMinutes: assessment.responseMinutes });
    changed = true;
  }
  return changed;
}

function submitDigitalReply(form) {
  const contact = state.digitalActiveId ? findDigitalContact(state.digitalQueue, state.digitalActiveId) : null;
  if (!contact) { toast('There is no active digital interaction.', 'error'); return; }
  if (state.currentCall || state.activeOutbound || state.wrapUp) { toast('Finish the active voice or outbound interaction before replying to a digital thread.', 'warning'); return; }
  const reply = new FormData(form).get('reply');
  try {
    const now = queueSimulationNowMs();
    const result = recordDigitalReply(state.digitalQueue, contact.id, reply, currentAgentReference(), now);
    const customerReaction = evaluateDigitalCustomerReaction(contact, result.quality, String(reply || ''), now);
    contact.followUpDelivered = false;
    contact.followUp = customerReaction.pendingResponse || contact.followUp || '';
    recordDigitalSlaTransitions(advanceDigitalSlaMonitor(state.digitalQueue, now));
    appendDigitalEvent(state.digitalEvents, { contactId: contact.id, channel: contact.channel, type: 'reply', message: 'Agent reply recorded in the simulated thread.', status: 'sent' });
    pushOperationEvent('digital', contact.id, `${contact.channelLabel} reply recorded.`, 'sent', { qaScore: result.quality.score });
    syncAgentStateWithDigitalWork('Digital reply sent; active workload capacity recalculated');
    saveState(); renderView(); toast(`Reply recorded · practice QA ${result.quality.score}% · customer reaction ${customerReaction.behaviour.lastReaction}.`, 'success');
  } catch (error) { toast(error.message, 'warning'); }
}

function finishDigitalContact(form) {
  const contact = state.digitalActiveId ? findDigitalContact(state.digitalQueue, state.digitalActiveId) : null;
  if (!contact) { toast('There is no active digital interaction.', 'error'); return; }
  if (state.currentCall || state.activeOutbound || state.wrapUp) { toast('Finish the active voice or outbound interaction before completing digital after-contact work.', 'warning'); return; }
  const values = new FormData(form);
  const disposition = String(values.get('disposition') || '');
  try {
    const completed = completeDigitalContact(state.digitalQueue, contact.id, { disposition, notes: values.get('notes') }, queueSimulationNowMs());
    const statusLabel = disposition === 'resolved' ? 'Resolved' : disposition === 'escalated' ? 'Escalated' : 'Pending customer';
    const reference = `DIG-${contact.id}`;
    const customerOutcome = digitalCustomerBehaviourSnapshot(ensureDigitalCustomerBehaviour(contact));
    const digitalCase = { reference, customer: contact.customer, customerRef: contact.customerRef || null, title: contact.subject, channel: contact.channelLabel, continuityChannel: contact.channel, disposition, status: statusLabel, qa: contact.qaScore ?? 0, customerSentiment: customerOutcome.sentiment, customerMood: customerOutcome.mood, customerPersona: customerOutcome.personaLabel, supervisorRecommended: customerOutcome.needsSupervisor, owner: state.applicantName || 'Agent', notes: completed.notes, createdAt: completed.completedAt, messages: contact.messages.map(message => ({ type: message.type, text: message.text, at: message.at })) };
    state.cases.push(digitalCase);recordCustomerContinuityFromCase(digitalCase,{customerRef:contact.customerRef});
    state.cases = state.cases.slice(-200);
    appendDigitalEvent(state.digitalEvents, { contactId: contact.id, channel: contact.channel, type: 'disposition', message: `Digital interaction ${disposition.replaceAll('_',' ')}.`, status: disposition });
    pushOperationEvent('digital', contact.id, `${contact.channelLabel} interaction ${disposition.replaceAll('_',' ')}.`, disposition, { qaScore: contact.qaScore });
    state.digitalActiveIds = (state.digitalActiveIds || []).filter(id => id !== contact.id);
    state.digitalActiveId = null;
    syncDigitalWorkSelection();
    syncAgentStateWithDigitalWork('Digital interaction completed; remaining capacity recalculated');
    saveState(); renderView(); toast(`${statusLabel} · CRM case ${reference} created.`, 'success');
  } catch (error) { toast(error.message, 'warning'); }
}

function receiveDigitalFollowUp() {
  const contact = state.digitalActiveId ? findDigitalContact(state.digitalQueue, state.digitalActiveId) : null;
  if (!contact) return;
  if (state.currentCall || state.activeOutbound || state.wrapUp) { toast('Finish the active voice or outbound interaction before resuming this digital thread.', 'warning'); return; }
  const decision = digitalWorkloadDecision(contact.id, 'resume');
  if (!decision.allowed) { toast(decision.reason, 'warning'); return; }
  try {
    const customerBehaviour = ensureDigitalCustomerBehaviour(contact);
    if (customerBehaviour.pendingResponse) deliverAdaptiveDigitalCustomerResponse(contact, queueSimulationNowMs());
    else deliverDigitalFollowUp(state.digitalQueue, contact.id, queueSimulationNowMs());
    appendDigitalEvent(state.digitalEvents, { contactId: contact.id, channel: contact.channel, type: 'customer-follow-up', message: 'Adaptive simulated customer response received.', status: 'active' });
    pushOperationEvent('digital', contact.id, `${contact.channelLabel} customer follow-up received.`, 'active');
    syncDigitalWorkSelection(contact.id);
    syncAgentStateWithDigitalWork('Customer reply received; digital concurrency recalculated');
    saveState(); renderView();
  } catch (error) { toast(error.message, 'warning'); }
}

function handleAction(action,event={}){
  switch(action){
    case 'return-to-game': enter3dFloor(); break;
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
    case 'resolve-voice-decision':resolveInboundVoiceDecision(event.optionId);break;
    case 'play-customer-prompt':speakCustomerPrompt(event.text||'');break;
    case 'play-customer-response':speakCustomerPrompt(event.text||'');break;
    case 'play-outbound-customer':{const latest=[...(state.activeOutbound?.conversation?.messages||[])].reverse().find(item=>item.speaker==='customer');if(latest)speakCustomerPrompt(latest.text);break;}
    case 'request-outbound-supervisor':{const active=state.activeOutbound;if(!active)break;const open=state.supervisorRequests.some(item=>item.contactId===active.attemptId&&item.status==='open');if(!open){const task=activeOutboundTask(active);state.supervisorRequests.push({id:makeCallReference('SUP'),contactId:active.attemptId,reference:active.attemptId,customer:task?.customer||'Synthetic customer',reason:'Outbound campaign assistance requested',status:'open',createdAt:new Date().toISOString(),channel:'Outbound voice'});pushOperationEvent('supervisor',active.attemptId,'Agent requested supervisor assistance during outbound contact.','open',{channel:'Outbound voice',campaignContactId:active.campaignContactId});saveState();toast('Outbound supervisor assistance requested.','success');}renderView();break;}
    case 'clear-voice-practice':clearVoicePractice();break;
    case 'refresh-queue':{if(!shiftTimeAvailable()){toast('The demand queue is closed for this shift.','warning');break;}const now=queueSimulationNowMs();const result=addManualDemandSurge({queue:state.inboundQueueItems,scenarios:inboundScenarios,count:6,day:state.day,elapsedMinute:state.shiftElapsedMinutes,now,sequence:state.queueSequence,queueState:state.liveQueueSimulation});state.liveQueueSimulation=result.queueState;state.queueSequence=result.nextSequence;syncQueueCount();pushOperationEvent('queue','INBOUND',`Demand surge requested 6 contacts; ${result.admitted} admitted and ${result.overflowed} rejected at queue capacity.`,'queued',{source:'manual_demand_surge',admitted:result.admitted,overflowed:result.overflowed});saveState();renderView();toast(`${result.admitted} contacts added; ${result.overflowed} demand overflow.`,result.overflowed?'warning':'success');break;}
    case 'toggle-call-hold':toggleCallHold();break;
    case 'request-supervisor':requestSupervisor();break;
    case 'request-digital-supervisor':requestDigitalSupervisor(event.contactId);break;
    case 'transfer-call':transferInboundCall();break;
    case 'return-call-to-queue':returnCallToQueue();break;
    case 'save-wrap-up':saveWrapUp();break;
    case 'open-commitment-callback':{const callback=state.callbacks.find(item=>item.id===event.callbackId);if(!callback)break;state.currentView=callback.type==='outbound'?'outbound':'inbound';renderView();break;}
    case 'return-callback-to-queue':returnCallbackToQueue(event.callbackId);break;
    case 'resume-outbound-callback':resumeOutboundCallback(event.callbackId);break;
    case 'claim-supervisor-escalation':claimSupervisorRequest(event.requestId);break;
    case 'resolve-supervisor':resolveSupervisorRequest(event.requestId,new FormData());break;
    case 'open-promise-control':state.currentView='promiseControl';renderView();break;
    case 'open-supervisor':state.currentView='supervisor';renderView();break;
    case 'raise-promise-escalation':openPromiseEscalationModal(event.commitmentId);break;
    case 'supervisor-toggle-intake':changeSupervisorIntake(state.supervisorQueueControl?.paused?'resume':'pause');break;
    case 'supervisor-intake-mode':changeSupervisorIntake(`mode:${event.mode}`);break;
    case 'open-inbound':state.currentView='inbound';renderView();break;
    case 'open-outbound':state.currentView='outbound';renderView();break;
    case 'open-digital':state.currentView='digital';renderView();break;
    case 'accept-digital':acceptDigital(event.contactId);break;
    case 'select-digital':{const item=findDigitalContact(state.digitalQueue,event.contactId);if(item&&[DIGITAL_STATUS.ACTIVE,DIGITAL_STATUS.AWAITING_CUSTOMER].includes(item.status)){state.digitalActiveId=item.id;saveState();renderView();}break;}
    case 'deliver-digital-followup':receiveDigitalFollowUp();break;
    case 'refresh-digital-queue':{if(!state.shiftActive||!shiftTimeAvailable()||state.currentCall||state.activeOutbound||state.wrapUp){toast('A running shift without a voice wrap-up is required to load another batch.','warning');break;}const items=createDigitalQueue(DIGITAL_SCENARIOS,6,{sequence:state.digitalSequence,now:queueSimulationNowMs(),slaMinutesOverride:getActiveOrganization(state.organizationWorkspace)?.policy?.digitalResponseTargetMinutes});state.digitalQueue.push(...items);state.digitalSequence+=items.length;appendDigitalEvent(state.digitalEvents,{type:'queue-refresh',message:'Six synthetic digital contacts added.',status:'queued'});saveState();renderView();toast('Six simulated digital contacts added.','success');break;}
    case 'open-crm':state.currentView='crm';renderView();break;
    case 'open-case-followup':state.crmSelectedCaseReference=event.caseReference||'';state.currentView='crm';renderView();break;
    case 'case-followup-start':{const caseRecord=state.cases.find(row=>row.reference===event.caseReference);if(!caseRecord){toast('CRM case not found.','warning');break;}try{const followUp=startCaseFollowUp(caseRecord,{actor:state.applicantName||'Agent'},caseLifecycleClock(),{now:new Date()});pushOperationEvent('case-follow-up',caseRecord.reference,`Reopened case follow-up claimed by ${followUp.claimedBy}.`,'in_progress',{followUpId:followUp.id,priority:followUp.priority});saveState();renderView();toast('Reopened case follow-up started.','success');}catch(error){toast(error.message,'warning');}break;}
    case 'open-knowledge':state.currentView='knowledge';state.viewedArticle=null;renderView();break;
    case 'answer-call':startInboundCall();break;
    case 'next-call-step':if(state.currentCall?.held)return;if(state.currentCall?.voiceBehaviour?.pendingDecision){toast('Resolve the customer interruption or service-recovery decision before continuing.','warning');return;}if((Number(state.currentCall?.voiceBehaviour?.turns)||0)>=VOICE_CUSTOMER_BEHAVIOUR_POLICY.maxAgentTurns){toast('The voice conversation reached its turn limit. Complete wrap-up or request supervisor support.','warning');return;}state.currentCall.stepIndex=Math.min(state.currentCall.stepIndex+1,(inboundScenarios.find(item=>item.id===state.currentCall.scenarioId)?.steps.length||1)-1);state.currentCall.feedback=null;addCallTimeline(state.currentCall,'Agent progressed to the next call-handling step.');saveState();renderView();break;
    case 'complete-call':beginInboundWrapUp(false);break;
    case 'end-call':returnCallToQueue();break;
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
    case 'start-customer-lab':{const personaId=$('#customerPersona')?.value||null;const issueId=$('#customerIssue')?.value||null;const channel=$('#customerChannel')?.value||'Voice';state.customerLabSession=createCustomerScenario({seed:Date.now(),personaId,issueId,channel});saveState();renderView();break;}
    case 'finalize-customer-lab':{try{const report=finalizeCustomerScenario(state.customerLabSession);state.customerQaHistory.push(report);if(state.customerQaHistory.length>100)state.customerQaHistory.splice(0,state.customerQaHistory.length-100);pushOperationEvent('customer-intelligence',report.id,`Customer practice QA finalised: ${report.averageScore}% · ${report.outcome}.`,report.outcome);state.customerLabSession=null;saveState();renderView();toast('Customer practice QA record saved.','success');}catch(error){toast(error.message,'error');}break;}
    case 'clear-customer-lab':{state.customerLabSession=null;saveState();renderView();break;}
    case 'qa-open':{state.currentView='qa';renderView();break;}
    case 'reset-simulation':{const modal=openModal('<div class="subtle-label">LOCAL SAVE RESET</div><h3>Reset this simulation?</h3><p>This removes the candidate, employment and local performance data for the currently selected browser profile. It does not delete your Supabase login or server-side organisation records.</p><div class="modal-actions"><button class="btn outline" data-close>Cancel</button><button class="btn danger" id="confirmReset">Reset simulation</button></div>');$('[data-close]',modal).onclick=()=>modal.remove();$('#confirmReset',modal).onclick=()=>{localStorage.removeItem(activeStorageKey);location.reload();};break;}
    case 'back-knowledge':state.viewedArticle=null;renderView();break;
  }
}

document.addEventListener('click',e=>{
  const commitmentButton=e.target.closest('[data-commitment-id]:not([data-action])');
  if(commitmentButton){selectedCommitmentId=commitmentButton.dataset.commitmentId;state.currentView='commitments';renderView();return;}
  const template=e.target.closest('[data-digital-template]');if(template){const field=$('#digitalReplyForm textarea[name="reply"]');if(field){const channel=state.digitalActiveId?findDigitalContact(state.digitalQueue,state.digitalActiveId)?.channel:'email';const selected=digitalReplyTemplates(channel).find(item=>item[0]===template.dataset.digitalTemplate);if(selected){field.value=selected[1];field.focus();}}return;}
  const nav=e.target.closest('.nav-item[data-view]');if(nav){if(nav.disabled){toast('Complete recruitment and accept an offer to unlock agent operations.');return;}if(nav.dataset.view!=='inbound'&&voiceStatus!=='inactive')stopVoiceTools();state.currentView=nav.dataset.view;renderView();return;}
  const action=e.target.closest('[data-action]');if(action){if(action.dataset.action==='cloud-member-status'){setCloudMemberStatus(action.dataset.memberId,action.dataset.nextStatus).then(()=>{renderView();toast('Server-side staff access updated.','success');}).catch(error=>toast(error.message,'error'));return;}handleAction(action.dataset.action,{callbackId:action.dataset.callbackId,requestId:action.dataset.requestId,commitmentId:action.dataset.commitmentId,caseReference:action.dataset.caseReference,system:action.dataset.system,text:action.dataset.text,contactId:action.dataset.contactId,memberId:action.dataset.memberId,nextStatus:action.dataset.nextStatus,mode:action.dataset.mode,optionId:action.dataset.optionId});return;}
  const answer=e.target.closest('[data-answer]');
if(answer){const i=state.assessmentIndex;state.assessmentAnswers[i]=Number(answer.dataset.answer);renderView();return;}
  const practicalAnswer=e.target.closest('[data-practical-answer]');if(practicalAnswer){state.practicalAnswers[state.practicalIndex]=Number(practicalAnswer.dataset.practicalAnswer);renderView();return;}
  const callChoice=e.target.closest('[data-call-choice]');if(callChoice){applyCallChoice(Number(callChoice.dataset.callChoice));return;}
  const campaign=e.target.closest('[data-start-campaign]');if(campaign){beginOutboundDial(campaign.dataset.startCampaign,campaign.dataset.contactId);return;}
  const article=e.target.closest('[data-article]');if(article){state.viewedArticle=article.dataset.article;renderView();return;}
});


document.addEventListener('change',e=>{
  if(e.target?.id==='departmentSelect'){state.workforceDepartment=e.target.value;saveState();renderView();}
  if(e.target?.id==='digitalChannelFilter'){state.digitalChannelFilter=e.target.value;saveState();renderView();}
  if(e.target?.id==='activeOrganizationSelect'){if(state.organizationWorkspace.organizations.some(org=>org.id===e.target.value)){state.organizationWorkspace.activeOrganizationId=e.target.value;saveState();renderView();}}
  if(e.target?.id==='cloudOrgSelect'){selectCloudOrganization(e.target.value).then(()=>renderView()).catch(error=>toast(error.message,'error'));}
  if(e.target?.id==='qaInteractionSelect'){state.qaSelectedInteractionId=e.target.value;saveState();renderView();}
  if(e.target?.id==='qaScorecardSelect'){state.qaSelectedScorecardId=e.target.value;saveState();renderView();}
});
document.addEventListener('submit',async e=>{
  if(e.target.matches('[data-supervisor-escalation-resolve]')){e.preventDefault();resolveSupervisorRequest(e.target.dataset.requestId,new FormData(e.target));return;}
  if(e.target.matches('[data-supervisor-escalation-reassign]')){e.preventDefault();reassignSupervisorRequest(e.target.dataset.requestId,new FormData(e.target));return;}
  if(e.target.id==='promiseEscalationRaiseForm'){
    e.preventDefault();
    const form=e.target;
    try{
      const request=PromiseControlEngine.raiseEscalation({commitmentId:form.dataset.commitmentId,reason:String(new FormData(form).get('reason')||'')},{commitmentState:commitmentStore(),shift:commitmentShiftSnapshot(),supervisorRequests:state.supervisorRequests,actor:state.applicantName||'Floor Supervisor',now:new Date()});
      pushOperationEvent('customer-promise',request.reference,`Supervisor escalation raised for ${request.customer}; callback promise remains open.`,'escalated',{commitmentId:request.commitmentId,owner:request.owner,risk:request.promiseRisk});
      form.closest('.modal-backdrop')?.remove();saveState();renderView();toast('Customer promise escalation raised. The callback remains open.','success');
    }catch(error){toast(error.message||'Promise escalation could not be raised.','error');}
    return;
  }
  if(e.target.id==='promiseEscalationReviewForm'){
    e.preventDefault();
    const form=e.target;
    try{
      const values=new FormData(form);
      const reviewer=String(values.get('reviewer')||'');
      const actionTaken=String(values.get('actionTaken')||'');
      const existingRequest=state.supervisorRequests.find(row=>row.id===form.dataset.requestId&&row.status==='open');
      if(!existingRequest)throw new Error('Open customer-promise escalation was not found.');
      normalizeSupervisorEscalation(existingRequest);
      if(!existingRequest.escalation.assignedTo||existingRequest.escalation.assignedTo.toLowerCase()!==reviewer.trim().toLowerCase())throw new Error('Claim this request from the Supervisor desk before recording the recovery action.');
      const request=PromiseControlEngine.resolveEscalation(state.supervisorRequests,form.dataset.requestId,{reviewer,actionTaken},{commitmentState:commitmentStore(),now:new Date()});
      closeLinkedSupervisorEscalation(request,{actor:reviewer,evidence:actionTaken},new Date());
      pushOperationEvent('customer-promise',request.reference,`Supervisor recovery action recorded by ${request.resolvedBy}; the customer callback commitment remains open.`,'recovery-reviewed',{commitmentId:request.commitmentId,requestId:request.id});
      saveState();renderView();toast('Supervisor recovery action recorded. The customer promise is still open until the callback outcome is completed.','success');
    }catch(error){toast(error.message||'Promise escalation review could not be saved.','error');}
    return;
  }
  if(e.target.id==='caseReopenForm'){
    e.preventDefault();
    const form=e.target;
    const caseRecord=state.cases.find(row=>row.reference===form.dataset.caseReference);
    if(!caseRecord){toast('CRM case not found.','warning');return;}
    const values=new FormData(form);
    try{
      const result=reopenCase(caseRecord,{actor:state.applicantName||'Agent',category:String(values.get('category')||''),priority:String(values.get('priority')||'normal'),reason:String(values.get('reason')||'')},caseLifecycleClock(),{now:new Date()});
      state.crmSelectedCaseReference=caseRecord.reference;
      pushOperationEvent('case-follow-up',caseRecord.reference,`Case reopened by ${state.applicantName||'Agent'}; ${result.followUp.priority} follow-up due Day ${result.due.day} ${formatCaseClock(result.due.minutes)}.`,'reopened',{followUpId:result.followUp.id,reasonCategory:result.followUp.reasonCategory,priority:result.followUp.priority});
      saveState();renderView();toast('Case reopened and added to the follow-up worklist.','success');
    }catch(error){toast(error.message||'Case could not be reopened.','warning');}
    return;
  }
  if(e.target.id==='caseFollowUpCompleteForm'){
    e.preventDefault();
    const form=e.target;
    const caseRecord=state.cases.find(row=>row.reference===form.dataset.caseReference);
    if(!caseRecord){toast('CRM case not found.','warning');return;}
    const values=new FormData(form);
    try{
      const result=completeCaseFollowUp(caseRecord,{actor:state.applicantName||'Agent',outcome:String(values.get('outcome')||''),customerConfirmed:values.get('customerConfirmed')==='yes',summary:String(values.get('summary')||'')},caseLifecycleClock(),{now:new Date()});
      if(result.outcome==='escalated'){
        const exists=state.supervisorRequests.some(item=>item.caseReference===caseRecord.reference&&item.status==='open');
        if(!exists)state.supervisorRequests.push({id:makeCallReference('SUP'),caseReference:caseRecord.reference,contactId:caseRecord.contactId||caseRecord.reference,reference:caseRecord.reference,customer:caseRecord.customer,reason:'Reopened case requires independent supervisor decision: '+result.followUp.reviewReason,status:'open',createdAt:new Date().toISOString(),channel:'Case follow-up'});
      }
      pushOperationEvent('case-follow-up',caseRecord.reference,`Reopened case follow-up outcome recorded: ${result.outcome.replaceAll('_',' ')}.` ,result.followUp.status,{followUpId:result.followUp.id,attempts:result.followUp.attempts,customerConfirmed:result.followUp.customerConfirmed===true});
      saveState();renderView();toast(result.outcome==='resolved'?'Customer-confirmed case resolution recorded.':result.outcome==='escalated'?'Case routed to supervisor review.':'Customer response pending; follow-up was rescheduled.','success');
    }catch(error){toast(error.message||'Follow-up outcome could not be saved.','warning');}
    return;
  }
  if(e.target.id==='caseFollowUpReviewForm'){
    e.preventDefault();
    const form=e.target;
    const caseRecord=state.cases.find(row=>row.reference===form.dataset.caseReference);
    if(!caseRecord){toast('CRM case not found.','warning');return;}
    const values=new FormData(form);
    try{
      const reviewer=String(values.get('reviewer')||'');
      const reviewEvidence=String(values.get('summary')||'');
      const linkedRequests=state.supervisorRequests.filter(item=>item.caseReference===caseRecord.reference&&item.status==='open');
      for(const request of linkedRequests){normalizeSupervisorEscalation(request);if(!request.escalation.assignedTo)throw new Error('Claim this case escalation from the Supervisor desk before completing its review.');if(request.escalation.assignedTo.toLowerCase()!==reviewer.trim().toLowerCase())throw new Error(`This escalation is assigned to ${request.escalation.assignedTo}; that supervisor must complete the linked review.`);}
      const result=reviewCaseFollowUp(caseRecord,{reviewer,decision:String(values.get('decision')||''),customerConfirmed:values.get('customerConfirmed')==='yes',summary:reviewEvidence,returnTo:caseRecord.lifecycle?.followUp?.owner},caseLifecycleClock(),{now:new Date()});
      for(const request of linkedRequests)closeLinkedSupervisorEscalation(request,{actor:reviewer,evidence:reviewEvidence},new Date());
      pushOperationEvent('case-follow-up',caseRecord.reference,`Supervisor ${result.decision.replaceAll('_',' ')} recorded by ${String(values.get('reviewer')||'Supervisor')}.`,result.followUp.status,{followUpId:result.followUp.id,customerConfirmed:result.followUp.customerConfirmed===true});
      saveState();renderView();toast(result.decision==='close_after_review'?'Independent resolution verification recorded.':'Case returned to the agent follow-up queue.','success');
    }catch(error){toast(error.message||'Supervisor case review could not be saved.','warning');}
    return;
  }
  if(e.target.id==='commitmentOutcomeForm'){
    e.preventDefault();
    const item=CommitmentEngine.getCommitment(commitmentStore(),selectedCommitmentId);
    if(!item){toast('Select an open customer commitment first.','warning');return;}
    const f=new FormData(e.target);
    const outcome=String(f.get('outcome')||'');
    const summary=String(f.get('summary')||'').trim();
    const result=recordCommitmentOutcome(item.id,outcome,summary);
    if(result){saveState();renderView();toast(result.requiresReview?'Attempt limit reached. Independent supervisor review is required.':'Callback outcome recorded.','success');}
    return;
  }
  if(e.target.id==='commitmentReviewForm'){
    e.preventDefault();
    const item=CommitmentEngine.getCommitment(commitmentStore(),selectedCommitmentId);
    if(!item){toast('Select a commitment requiring review.','warning');return;}
    const f=new FormData(e.target);
    try{
      const reviewer=String(f.get('reviewer')||'');
      const reviewEvidence=String(f.get('summary')||'');
      const linkedRequests=state.supervisorRequests.filter(row=>row.commitmentId===item.id&&row.status==='open');
      for(const request of linkedRequests){normalizeSupervisorEscalation(request);if(!request.escalation.assignedTo)throw new Error('Claim this callback escalation from the Supervisor desk before completing its review.');if(request.escalation.assignedTo.toLowerCase()!==reviewer.trim().toLowerCase())throw new Error(`This escalation is assigned to ${request.escalation.assignedTo}; that supervisor must complete the linked review.`);}
      CommitmentEngine.closeAfterReview(commitmentStore(),item.id,reviewer,reviewEvidence,new Date(),state.applicantName||'');
      const linkedCase=state.cases.find(row=>row.reference===item.caseId||row.contactId===item.contactReference);
      if(linkedCase){linkedCase.commitmentStatus='Complete';linkedCase.status='Callback closed after supervisor review';}
      for(const request of linkedRequests)closeLinkedSupervisorEscalation(request,{actor:reviewer,evidence:reviewEvidence},new Date());
      pushOperationEvent('commitment',item.id,`Independent callback review completed by ${String(f.get('reviewer')||'Supervisor')}.`,'reviewed',{caseId:item.caseId});
      saveState();renderView();toast('Independent callback review recorded.','success');
    }catch(error){toast(error.message||'Supervisor review could not be saved.','error');}
    return;
  }
  if(e.target.matches('[data-supervisor-triage]')){e.preventDefault();saveSupervisorTriage(e.target);return;}
  if(e.target.id==='outboundCampaignReplyForm'){
    e.preventDefault();
    const active=state.activeOutbound;
    const task=activeOutboundTask(active);
    if(!active||!task||!active.conversation){toast('The active outbound conversation is unavailable.','warning');return;}
    try{
      const utterance=String(new FormData(e.target).get('reply')||'');
      const previousBreaches=active.conversation.criticalBreaches?.length||0;
      const result=submitOutboundTurn(active.conversation,utterance,queueSimulationNowMs());
      const summary=outboundConversationSummary(active.conversation);
      const newBreaches=Math.max(0,summary.criticalBreaches.length-previousBreaches);
      if(newBreaches)state.incidents+=newBreaches;
      active.score=summary.averageScore===null?0:(summary.averageScore/100)*6;
      active.breach=summary.criticalBreaches.length>0;
      active.suppressionRequested=summary.suppressionRequested;
      active.disposition=result.disposition||active.conversation.dispositionHint||null;
      if(result.suppressionRequested&&!isContactSuppressed(task.customer,state.outboundSuppressions)){
        addSuppression(state.outboundSuppressions,task.customer,'Customer requested no further campaign contact',queueSimulationNowMs());
        pushOperationEvent('campaign',active.attemptId,'Customer do-not-contact request recorded and added to suppression register.','suppressed',{campaignId:task.id,campaignContactId:active.campaignContactId});
      }
      pushOperationEvent('campaign',active.attemptId,`Outbound customer conversation turn recorded · QA ${summary.averageScore??'pending'}% · ${summary.status}.`,active.breach?'review':summary.callbackRequested?'callback_requested':summary.suppressionRequested?'suppressed':'in_progress',{turn:summary.turns,preference:summary.preference,permissionToContinue:summary.permissionToContinue,callbackRequested:summary.callbackRequested,suppressionRequested:summary.suppressionRequested,customerDecision:active.conversation.customerDecision,criticalBreaches:summary.criticalBreaches});
      saveState();renderView();
      if(summary.criticalBreaches.length)toast('Outbound compliance breach recorded. Stop the campaign discussion and complete supervisor review.','error');
      else if(result.suppressionRequested)toast('Customer do-not-contact request recorded. No further campaign contact is permitted.','warning');
      else if(result.callbackRequested)toast('Customer callback requested. Complete wrap-up and record the agreed future time.','success');
      else if(result.status==='ready_for_wrap_up')toast('Outbound conversation complete. Record the truthful outcome.','success');
    }catch(error){toast(error.message||'Outbound response could not be recorded.','warning');}
    return;
  }
  if(e.target.id==='customerLabReplyForm'){e.preventDefault();const value=new FormData(e.target).get('reply');try{submitCustomerTurn(state.customerLabSession,String(value||''));if(state.customerLabSession.status==='escalated')pushOperationEvent('customer-intelligence',state.customerLabSession.id,'Critical practice QA breach triggered mandatory review.','escalated');saveState();renderView();}catch(error){toast(error.message,'warning');}return;}
  if(e.target.id==='qaScorecardForm'){
    e.preventDefault();try{const f=new FormData(e.target);const base=state.qaScorecards.find(item=>item.id===state.qaSelectedScorecardId)||state.qaScorecards.find(item=>item.active!==false)||DEFAULT_QA_SCORECARD;const criteria=base.criteria.map(item=>({...item,weight:Number(f.get(`weight_${item.id}`))}));const created=createScorecard(state.qaScorecards,{name:f.get('name'),criteria});state.qaSelectedScorecardId=created.id;saveState();renderView();toast('New QA scorecard version created.','success');}catch(error){toast(error.message,'warning');}return;
  }
  if(e.target.id==='humanQaReviewForm'){
    e.preventDefault();try{const f=new FormData(e.target);const interaction=(state.customerQaHistory||[]).find(item=>item.id===f.get('interactionId'));const scorecard=state.qaScorecards.find(item=>item.id===f.get('scorecardId'));if(!interaction||!scorecard)throw new Error('Select a valid interaction and scorecard.');const ratings=scorecard.criteria.map(item=>({criterionId:item.id,rating:Number(f.get(`rating_${item.id}`))}));const evidence=scorecard.criteria.map(item=>{const lineIndex=Number(f.get(`evidence_${item.id}`));const line=interaction.transcript?.[lineIndex];return {criterionId:item.id,quote:line?.text||''};});const review=createHumanQAReview({interaction,scorecard,ratings,evidence,reviewer:f.get('reviewer'),notes:f.get('notes'),coachingAction:f.get('coachingAction')});state.humanQaReviews.push(review);state.humanQaReviews=state.humanQaReviews.slice(-300);pushOperationEvent('human-qa',review.id,`Human QA review completed: ${review.score}% · ${review.status}.`,review.status,{interactionId:review.interactionId,scorecardId:review.scorecardId});saveState();renderView();toast(`Human QA review saved: ${review.score}%.`,'success');}catch(error){toast(error.message,'warning');}return;
  }
  if(e.target.id==='qaDisputeForm'){
    e.preventDefault();try{const f=new FormData(e.target);const review=state.humanQaReviews.find(item=>item.id===f.get('reviewId'));const dispute=createQADispute(state.qaDisputes,review,{raisedBy:f.get('raisedBy'),reason:f.get('reason')});pushOperationEvent('qa-dispute',dispute.id,'Agent submitted a human QA score dispute.','open',{reviewId:dispute.reviewId});saveState();renderView();toast('QA dispute submitted.','success');}catch(error){toast(error.message,'warning');}return;
  }
  if(e.target.id==='qaResolveDisputeForm'){
    e.preventDefault();try{const f=new FormData(e.target);const dispute=state.qaDisputes.find(item=>item.id===f.get('disputeId'));resolveQADispute(dispute,{reviewer:f.get('reviewer'),decision:f.get('decision'),adjustedScore:f.get('adjustedScore')===''?null:Number(f.get('adjustedScore')),resolution:f.get('resolution')});pushOperationEvent('qa-dispute',dispute.id,`QA dispute resolved: ${dispute.status}.`,dispute.status);saveState();renderView();toast('QA dispute resolution recorded.','success');}catch(error){toast(error.message,'warning');}return;
  }
  if(e.target.id==='qaCalibrationForm'){
    e.preventDefault();try{const f=new FormData(e.target);const [interactionId,scorecardId]=String(f.get('group')).split('::');const matched=state.humanQaReviews.filter(item=>item.interactionId===interactionId&&item.scorecardId===scorecardId);const calibration=createCalibrationSession(matched,{facilitator:f.get('facilitator'),notes:f.get('notes')});state.qaCalibrations.push(calibration);state.qaCalibrations=state.qaCalibrations.slice(-100);pushOperationEvent('qa-calibration',calibration.id,`Reviewer calibration completed. Score spread: ${calibration.scoreSpread}.`,calibration.requiresDiscussion?'discussion_required':'aligned');saveState();renderView();toast('Reviewer calibration saved.','success');}catch(error){toast(error.message,'warning');}return;
  }
  if(e.target.id==='aiAssistSettingsForm'){
    e.preventDefault();
    const cloud=activeAICloudContext();
    if(!cloud||!canCloudRole(cloud.membership?.role,'policies:manage')){toast('Only organisation owners and administrators can change tenant AI settings.','error');return;}
    const f=new FormData(e.target);
    try{
      const client=await getCloudSupabaseClient();
      aiTenantSettings=await saveTenantAIAssistSettings(client,cloud.activeOrganization.id,cloud.user.id,{enabled:f.get('enabled')==='on',model:f.get('model'),dailyRequestLimit:Number(f.get('dailyRequestLimit'))});
      aiSettingsLoaded=true;aiSettingsError='';renderView();toast('Organisation AI policy saved.','success');
    }catch(error){toast(error.message,'error');}
    return;
  }
  if(e.target.id==='aiAssistRunForm'){
    e.preventDefault();
    if(!e.target.elements.consent?.checked){toast('Explicit transcript-transfer consent is required.','warning');return;}
    const cloud=activeAICloudContext();
    const interaction=(state.customerQaHistory||[]).find(item=>item.id===e.target.elements.interactionId?.value);
    if(!cloud||!interaction){toast('Select a completed interaction in an authenticated organisation workspace.','error');return;}
    if(!aiTenantSettings?.enabled){toast('AI assistance is disabled by this organisation.','warning');return;}
    aiAssistBusy=true;renderView();
    try{
      const client=await getCloudSupabaseClient();
      const result=await requestAIAssist(client,{organizationId:cloud.activeOrganization.id,interaction});
      state.aiQaSuggestions=Array.isArray(state.aiQaSuggestions)?state.aiQaSuggestions:[];
      state.aiQaSuggestions.push({...result,organizationId:cloud.activeOrganization.id});
      state.aiQaSuggestions=state.aiQaSuggestions.slice(-40);
      saveState();toast('AI practice analysis completed. It remains advisory until reviewed by a human.','success');
    }catch(error){toast(error.message,'error');}
    finally{aiAssistBusy=false;renderView();}
    return;
  }
  if(e.target.id==='cloudOrgCreateForm'){
    e.preventDefault();const f=new FormData(e.target);createCloudOrganization({name:f.get('name'),industry:f.get('industry')}).then(()=>renderView()).catch(error=>toast(error.message,'error'));return;
  }
  if(e.target.id==='cloudInviteForm'){
    e.preventDefault();const f=new FormData(e.target);createCloudInvitation({email:f.get('email'),role:f.get('role'),department:f.get('department')}).then(()=>{renderView();toast('Server invitation recorded. No email was sent.','success');}).catch(error=>toast(error.message,'error'));return;
  }
  if(e.target.id==='cloudPolicyForm'){
    e.preventDefault();const f=new FormData(e.target);const policy=Object.fromEntries(f.entries());policy.departments=String(policy.departments||'').split(/\r?\n/).map(value=>value.trim()).filter(Boolean);try{validateCloudPolicy(policy);updateCloudPolicy(policy).then(()=>{renderView();toast('Tenant policy saved to Supabase.','success');}).catch(error=>toast(error.message,'error'));}catch(error){toast(error.message,'error');}return;
  }
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
    if(!String(textValue||'').trim()){toast('Enter or transcribe the response first.','warning');return;}
    if(state.currentCall){submitInboundVoiceResponse(textValue);return;}
    voiceTranscript=sanitizeTranscript(String(textValue));
    toast('Text fallback captured in temporary practice memory.','success');renderView();
  }
});

document.addEventListener('change',e=>{if(e.target?.id==='voiceConsent'){voiceConsent=!!e.target.checked;if(!voiceConsent&&voiceStatus!=='inactive')stopVoiceTools();renderView();}});
window.addEventListener('pagehide',()=>{stopVoiceTools();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&voiceStatus!=='inactive')stopVoiceTools();});

function initClock(){
  const savedTick=Number(state.simulationClockSeconds);
  simulationClockTicker=Number.isFinite(savedTick)?Math.max(0,Math.min(86399,savedTick)):7*3600;
  lastShiftSaveBucket=Math.floor((Number(state.shiftElapsedMinutes)||0)/15);
  setInterval(()=>{
    simulationClockTicker=(simulationClockTicker+30)%86400;
    state.simulationClockSeconds=simulationClockTicker;
    const h=String(Math.floor(simulationClockTicker/3600)).padStart(2,'0');
    const m=String(Math.floor((simulationClockTicker%3600)/60)).padStart(2,'0');
    const sec=String(simulationClockTicker%60).padStart(2,'0');
    $('#shiftClock').textContent=`${h}:${m}:${sec}`;
    if(state.shiftActive&&state.shiftRecord?.status==='active'){
      state.shiftElapsedMinutes=Math.min(540,state.shiftElapsedMinutes+.5);
      let queueChanged=false;
      if(state.liveQueueSimulation?.active){
        const result=advanceLiveQueue({
          queueState:state.liveQueueSimulation,
          queue:state.inboundQueueItems,
          scenarios:inboundScenarios,
          day:state.day,
          elapsedMinute:state.shiftElapsedMinutes,
          now:queueSimulationNowMs(),
          sequence:state.queueSequence
        });
        const previousOverflow = state.liveQueueSimulation.overflowed || 0;
        state.liveQueueSimulation=result.queueState;
        state.queueSequence=result.nextSequence;
        if (result.queueState.overflowed > previousOverflow) {
          pushOperationEvent('queue','INBOUND','Inbound queue reached its capacity; additional synthetic demand was not admitted.','overflowed',{overflowEvents:result.queueState.overflowed - previousOverflow});
          queueChanged=true;
        }
        for(const contact of result.arrivals){
          pushOperationEvent('queue',contact.id,`New inbound contact arrived: ${contact.issue}.`,'queued',{customer:contact.customer,priority:contact.priority,routeGroup:contact.routeGroup,source:'live_arrival'});
          queueChanged=true;
        }
        for(const contact of result.abandonments){
          const lastEvent=contact.timeline?.at(-1);
          pushOperationEvent('queue',contact.id,`Customer abandoned after waiting ${Math.round(Number(lastEvent?.waitMinutes||0))} simulated minutes.`,'abandoned',{customer:contact.customer,priority:contact.priority,source:'patience_expired'});
          queueChanged=true;
        }
        if(queueChanged){syncQueueCount();saveState();}
      }
      let digitalQueueChanged=false;
      if(state.digitalLiveQueueSimulation?.active){
        const digitalResult=advanceDigitalLiveQueue({
          queueState:state.digitalLiveQueueSimulation,
          queue:state.digitalQueue,
          scenarios:DIGITAL_SCENARIOS,
          day:state.day,
          elapsedMinute:state.shiftElapsedMinutes,
          now:queueSimulationNowMs(),
          sequence:state.digitalSequence,
          slaMinutesOverride:getActiveOrganization(state.organizationWorkspace)?.policy?.digitalResponseTargetMinutes
        });
        state.digitalLiveQueueSimulation=digitalResult.queueState;
        state.digitalSequence=digitalResult.nextSequence;
        for(const contact of digitalResult.arrivals){
          appendDigitalEvent(state.digitalEvents,{contactId:contact.id,channel:contact.channel,type:'automatic-arrival',message:`New automatic ${contact.channelLabel} contact arrived: ${contact.subject}.`,status:'queued'},queueSimulationNowMs());
          pushOperationEvent('digital-queue',contact.id,`New ${contact.channelLabel} contact arrived: ${contact.subject}.`,'queued',{customer:contact.customer,priority:contact.priority,routeGroup:contact.routeGroup,source:'automatic_shift_arrival'});
          digitalQueueChanged=true;
        }
        for(const overflow of digitalResult.overflows){
          appendDigitalEvent(state.digitalEvents,{channel:overflow.channel,type:'demand-overflow',message:`${overflow.channelLabel} queue reached its waiting capacity (${overflow.capacity}).`,status:'overflowed'},queueSimulationNowMs());
          pushOperationEvent('digital-queue',overflow.channel,`${overflow.channelLabel} demand overflow: waiting queue capacity ${overflow.capacity} reached.`,'overflowed',{channel:overflow.channel,capacity:overflow.capacity});
          digitalQueueChanged=true;
        }
      }
      if(recordDigitalSlaTransitions(advanceDigitalSlaMonitor(state.digitalQueue, queueSimulationNowMs()))) digitalQueueChanged = true;
      if(queueChanged||digitalQueueChanged)saveState();
      const digitalEditorFocused = Boolean(document.activeElement?.closest?.('#digitalReplyForm textarea, #digitalCloseForm textarea'));
      const safeToRefreshWorkView = !state.digitalActiveId || state.currentView !== 'digital' || !digitalEditorFocused;
      if((queueChanged||digitalQueueChanged)&&!state.currentCall&&!state.activeOutbound&&!state.wrapUp&&safeToRefreshWorkView&&['overview','inbound','queue','supervisor','digital','performance'].includes(state.currentView))renderView();
      const bucket=Math.floor(state.shiftElapsedMinutes/15);
      if(bucket!==lastShiftSaveBucket){lastShiftSaveBucket=bucket;saveState();}
    }else if(Math.floor(simulationClockTicker/30)%30===0)saveState();
  },1000);
}

// Production-style 3D workplace. The scene is isolated from business logic so it can
// evolve independently without disturbing recruitment, calls, CRM or career records.
async function initWorld(){
  const host=$('#worldCanvas');
  try{
    const module=await import('./production-world.js');
    productionWorld=await module.initProductionWorld(THREE,host,{
      onAssetsReady:result=>{
        const label=result.loaded?`${result.loaded} 3D STAFF ASSETS READY`:'OPTIMISED LOCAL STAFF MODELS ACTIVE';
        const status=$('#assetStatus');if(status)status.textContent=label;
      },
      onImmersiveChange:active=>{
        $('#immersiveHud')?.classList.toggle('hidden',!active);
        $('#stationPanel')?.classList.add('hidden');
        if(active){
          $('#headerStatus').textContent='LIVE WORKPLACE · FLOOR 04';
          $('#enterFloorButton')?.classList.add('hidden');
          document.body.classList.add('calloria-game-playing');
        }else{
          $('#headerStatus').textContent=state.hired?'EMPLOYEE WORKSPACE':'RECRUITMENT PORTAL';
          $('#enterFloorButton')?.classList.remove('hidden');
          document.body.classList.remove('calloria-game-playing');
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
    const playButton=$('#launchPlayButton');if(playButton){playButton.disabled=false;playButton.querySelector('span').textContent='PLAY NOW';}
  }catch(error){
    console.error('CALLORIA world initialisation failed:',error);
    host.innerHTML='<div class="world-fallback">The 3D floor is unavailable on this browser or device. You can still use the Operations Desk.</div>';
    const playButton=$('#launchPlayButton');if(playButton){playButton.disabled=true;playButton.querySelector('span').textContent='3D UNAVAILABLE';}
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
function enter3dFloor(){ if(productionWorld){startPublicGameServices();$('#mouseLookNote')?.classList.add('hidden');document.body.classList.add('calloria-game-launch','calloria-game-playing');productionWorld.enter();} }
function exit3dFloor(){ close3dStationPanel();productionWorld?.exit();document.body.classList.remove('calloria-game-playing'); }
function open3dWorkView(view){
  close3dStationPanel();
  document.body.classList.remove('calloria-game-launch','calloria-game-playing');
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

window.addEventListener('pagehide',()=>{ void flushCloudEmploymentSave(); });
$('#enterFloorButton')?.addEventListener('click',enter3dFloor);
$('#launchPlayButton')?.addEventListener('click',enter3dFloor);
$('#launchDeskButton')?.addEventListener('click',()=>{startPublicGameServices();document.body.classList.remove('calloria-game-launch','calloria-game-playing');state.currentView='overview';renderView();});
$('#exitFloorButton')?.addEventListener('click',exit3dFloor);
$('#mouseLookNote')?.addEventListener('click',()=>{try{document.querySelector('#worldCanvas canvas')?.requestPointerLock?.();$('#mouseLookNote').classList.add('hidden');}catch{}});
document.addEventListener('click',event=>{
  const close=event.target.closest('[data-station-close]');if(close){close3dStationPanel();return;}
  const action=event.target.closest('[data-station-action]');if(action){open3dWorkView(action.dataset.stationAction);return;}
});

window.addEventListener('calloria:cloud-context', async event=>{
  const detail=event.detail||{};
  if(detail.signedOut){
    aiSettingsOrgId='';aiSettingsLoaded=false;aiSettingsLoading=false;aiSettingsError='';aiTenantSettings=null;aiAssistBusy=false;
    configureCloudEmploymentSync(null);
    cloudScopedSave=false;activeStorageKey=STORAGE_KEY;state=loadState();ensureOrganizationWorkspace(state);setHeader();renderView();return;
  }
  if(detail.userId&&detail.organizationId){
    aiSettingsOrgId='';aiSettingsLoaded=false;aiSettingsLoading=false;aiSettingsError='';aiTenantSettings=null;aiAssistBusy=false;
    cloudScopedSave=true;
    activeStorageKey=`calloria.save.cloud.${detail.userId}.${detail.organizationId}.v1`;
    state=loadState();
    const cloud=getCloudPlatformState();
    const cloudOrg=cloud.activeOrganization;
    state.organizationWorkspace={activeOrganizationId:detail.organizationId,organizations:[{
      id:detail.organizationId,name:cloudOrg?.name||detail.organizationName||'Organisation',industry:cloudOrg?.industry||'General customer service',status:'active',createdAt:cloudOrg?.createdAt||new Date().toISOString(),policy:structuredClone(detail.policy||DEFAULT_ORG_POLICY),
      members:[],audit:[]
    }]};
    state.applicantName=state.applicantName||cloud.user?.user_metadata?.full_name||cloud.user?.email?.split('@')[0]||'CALLORIA user';
    state.nameInitials=initials(state.applicantName);
    configureCloudEmploymentSync({userId:detail.userId,organizationId:detail.organizationId});
    try {
      const cloudSnapshot=await loadCloudEmploymentSnapshot();
      if(cloudSnapshot&&typeof cloudSnapshot==='object'){
        state={...initialState(),...cloudSnapshot};
        state.organizationWorkspace={activeOrganizationId:detail.organizationId,organizations:[{
          id:detail.organizationId,name:cloudOrg?.name||detail.organizationName||'Organisation',industry:cloudOrg?.industry||'General customer service',status:'active',createdAt:cloudOrg?.createdAt||new Date().toISOString(),policy:structuredClone(detail.policy||DEFAULT_ORG_POLICY),members:[],audit:[]
        }]};
        for(const key of ['inboundQueueItems','callbacks','supervisorRequests','interactionTimeline','outboundSuppressions','outboundAttempts','cases','outboundDone','briefingAttendance','promotionAttempts','crossSellRecords','commendations','systemEvents','shiftHistory','coachingSessions','digitalQueue','digitalEvents','customerQaHistory','qaScorecards','humanQaReviews','qaDisputes','qaCalibrations','aiQaSuggestions','supervisorQueueAudit']) if(!Array.isArray(state[key])) state[key]=[];
        markCloudEmploymentSyncReady();
      } else {
        // One-time migration of this user's already-scoped browser save into the tenant record.
        markCloudEmploymentSyncReady();
        scheduleCloudEmploymentSave(state);
        await flushCloudEmploymentSave();
      }
    } catch(error) {
      console.error('CALLORIA employment cloud sync could not load:',error);
      toast('Cloud employment records could not be loaded. Local progress remains available; cloud saving is paused until the connection is restored.','error');
      configureCloudEmploymentSync(null);
    }
    setHeader();renderView();
  }
});

const cloudInit = initializeCloudPlatform();
initClock();renderView();
void refreshPublicGameStats();
cloudInit.then(()=>{if(getCloudPlatformState().mode==='active')renderView();}).catch(error=>console.error('CALLORIA cloud initialisation failed:',error));
import('three').then(module=>{THREE=module;initWorld();}).catch(error=>{console.warn('Three.js could not be loaded; keeping the operational interface available.',error);$('#worldCanvas').innerHTML='<div class="world-fallback">3D preview could not load. The operational workspace remains available.</div>';});
