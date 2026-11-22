import { createCustomerContinuityState, normalizeCustomerContinuityState, recordCustomerInteraction, getCustomerContinuityContext, customerContinuityMetrics } from './customer-continuity-engine.js';
function renderCustomerContinuityPanel(customer, channel, identity = {}) {
  const context = getCustomerContinuityContext(state.customerContinuity, { customer, customerRef: identity.customerRef || identity.customerId });
  const metrics = customerContinuityMetrics(state.customerContinuity);
  const last = context.lastInteraction;
  const matchLabel = context.matchBasis === 'reference' ? 'Shared synthetic customer reference' : 'Synthetic display-name match';
  const history = context.interactions.map(item => `<div>${escapeHTML(item.title)}</div>`).join('');
  const openCases = context.openCases.slice(0, 3).map(item => `<div>${escapeHTML(item.caseReference || item.reference || 'Open follow-up')}</div>`).join('');
  return `<section class="panel customer-continuity-panel">${history}${openCases}<p class="muted-note">Match basis: ${escapeHTML(matchLabel)}.
</p></section>`;
}
