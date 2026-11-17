/**
 * CALLORIA v6.62 — unified digital-agent workload and concurrency rules.
 * All capacity decisions apply only to synthetic local simulator work. This
 * module does not connect to a real contact-centre routing or workforce system.
 */
import { DIGITAL_CHANNELS, DIGITAL_STATUS } from './multichannel-engine.js';

export const AGENT_WORKLOAD_VERSION = '6.62.0';

export const DEFAULT_AGENT_WORKLOAD_POLICY = Object.freeze({
  maxConcurrentDigital: 3,
  channelCapacity: Object.freeze({
    email: 2,
    live_chat: 2,
    social: 1
  })
});

const OPEN_STATUSES = new Set([DIGITAL_STATUS.ACTIVE, DIGITAL_STATUS.AWAITING_CUSTOMER]);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeCapacity(value, fallback) {
  return Math.min(12, Math.max(0, Math.floor(finite(value, fallback))));
}

function safePolicy(policy = DEFAULT_AGENT_WORKLOAD_POLICY) {
  const source = policy && typeof policy === 'object' ? policy : DEFAULT_AGENT_WORKLOAD_POLICY;
  const channels = source.channelCapacity && typeof source.channelCapacity === 'object'
    ? source.channelCapacity : DEFAULT_AGENT_WORKLOAD_POLICY.channelCapacity;
  return {
    maxConcurrentDigital: safeCapacity(source.maxConcurrentDigital, DEFAULT_AGENT_WORKLOAD_POLICY.maxConcurrentDigital),
    channelCapacity: Object.fromEntries(Object.keys(DIGITAL_CHANNELS).map(channel => [
      channel,
      safeCapacity(channels[channel], DEFAULT_AGENT_WORKLOAD_POLICY.channelCapacity[channel])
    ]))
  };
}

function isOpenAssigned(contact, agentId) {
  return Boolean(contact && OPEN_STATUSES.has(contact.status)
    && (!agentId || contact.assignedTo === agentId));
}

/** All active and customer-waiting digital work assigned to this agent. */
export function assignedDigitalWorkItems(queue, agentId) {
  return (Array.isArray(queue) ? queue : [])
    .filter(contact => isOpenAssigned(contact, agentId))
    .slice()
    .sort((a, b) => {
      const aAt = Date.parse(a.acceptedAt || a.receivedAt || 0) || 0;
      const bAt = Date.parse(b.acceptedAt || b.receivedAt || 0) || 0;
      return aAt - bAt || String(a.id).localeCompare(String(b.id));
    });
}

/**
 * Snapshot active concurrency separately from assigned items awaiting the
 * customer's next response. Awaiting-customer items remain visible on the
 * worklist but do not consume an active response slot.
 */
export function agentWorkloadSnapshot(queue, agentId, policy = DEFAULT_AGENT_WORKLOAD_POLICY) {
  const limits = safePolicy(policy);
  const assigned = assignedDigitalWorkItems(queue, agentId);
  const active = assigned.filter(item => item.status === DIGITAL_STATUS.ACTIVE);
  const awaitingCustomer = assigned.filter(item => item.status === DIGITAL_STATUS.AWAITING_CUSTOMER);
  const activeByChannel = Object.fromEntries(Object.keys(DIGITAL_CHANNELS).map(channel => [
    channel, active.filter(item => item.channel === channel).length
  ]));
  const assignedByChannel = Object.fromEntries(Object.keys(DIGITAL_CHANNELS).map(channel => [
    channel, assigned.filter(item => item.channel === channel).length
  ]));
  const maxConcurrent = limits.maxConcurrentDigital;
  const activeCount = active.length;
  return {
    version: AGENT_WORKLOAD_VERSION,
    agentId: String(agentId || ''),
    assignedCount: assigned.length,
    activeCount,
    awaitingCustomerCount: awaitingCustomer.length,
    maxConcurrentDigital: maxConcurrent,
    availableSlots: Math.max(0, maxConcurrent - activeCount),
    atCapacity: activeCount >= maxConcurrent,
    activeByChannel,
    assignedByChannel,
    channelCapacity: { ...limits.channelCapacity },
    assignedContactIds: assigned.map(item => item.id),
    activeContactIds: active.map(item => item.id),
    awaitingCustomerContactIds: awaitingCustomer.map(item => item.id)
  };
}

function assessWorkItem({
  queue,
  contactId,
  agentId,
  status,
  shiftActive,
  inShiftWindow,
  agentStatus,
  currentCall,
  activeOutbound,
  wrapUp,
  policy
} = {}) {
  const item = (Array.isArray(queue) ? queue : []).find(contact => contact?.id === contactId);
  const workload = agentWorkloadSnapshot(queue, agentId, policy);
  const reject = reason => ({ allowed: false, reason, workload, contact: item || null });
  if (!shiftActive) return reject('Start an active shift before accepting digital work.');
  if (!inShiftWindow) return reject('The scheduled shift window has ended.');
  if (currentCall || activeOutbound || wrapUp) return reject('Complete the active voice or outbound interaction first.');
  if (!item) return reject('The digital contact was not found.');
  if (item.status !== status) return reject(status === DIGITAL_STATUS.QUEUED
    ? 'Only a waiting digital contact can be accepted.'
    : 'This contact is not waiting for a customer response.');
  if (status === DIGITAL_STATUS.AWAITING_CUSTOMER && item.assignedTo !== agentId) {
    return reject('Only the assigned agent can resume this customer conversation.');
  }
  if (!Object.hasOwn(DIGITAL_CHANNELS, item.channel)) return reject('This digital channel is not supported.');
  if (workload.maxConcurrentDigital < 1) return reject('Digital concurrency is disabled by the workload policy.');
  if (workload.activeCount >= workload.maxConcurrentDigital) return reject(`Digital capacity is full (${workload.activeCount}/${workload.maxConcurrentDigital}). Finish an active response before accepting more work.`);
  const channelLimit = workload.channelCapacity[item.channel] ?? 0;
  if (workload.activeByChannel[item.channel] >= channelLimit) {
    return reject(`${DIGITAL_CHANNELS[item.channel].label} capacity is full (${workload.activeByChannel[item.channel]}/${channelLimit}).`);
  }
  const hasActiveDigital = workload.activeCount > 0;
  if (agentStatus !== 'available' && !(agentStatus === 'busy' && hasActiveDigital)) {
    return reject(`Your agent status is ${String(agentStatus || 'offline')}. Return to Available before accepting work.`);
  }
  return { allowed: true, reason: '', workload, contact: item };
}

export function canAcceptDigitalContact(options = {}) {
  return assessWorkItem({ ...options, status: DIGITAL_STATUS.QUEUED });
}

export function canResumeDigitalFollowUp(options = {}) {
  return assessWorkItem({ ...options, status: DIGITAL_STATUS.AWAITING_CUSTOMER });
}
