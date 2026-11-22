const CHECKLIST_LIMIT = 48;
const checklistByContact = new Map();
let listenerBound = false;

const ESCAPE = Object.freeze({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' });
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ESCAPE[character]);
const clean = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 420);
const words = value => clean(value).toLowerCase();

const PLAYBOOKS = Object.freeze({
  security: {
    label: 'Security-sensitive contact',
    objective: 'Protect the customer first. Stop unsafe requests and use the approved security route.',
    priority: 'critical',
    focus: [
      ['Pause sensitive activity', 'Do not continue an action that could expose an account or personal data.'],
      ['Use safe verification', 'Never request passwords, PINs, one-time codes or full payment-card details.'],
      ['Explain the secure route', 'Tell the customer which approved, verified channel or process to use.'],
      ['Escalate and document', 'Request the appropriate security specialist and record facts, not assumptions.']
    ],
    phrase: 'I want to protect your information. Please do not share any password, PIN or one-time code with me. I will use the approved security process and involve the appropriate specialist where needed.',
    guardrail: 'Do not attempt account recovery, reverse a transaction or confirm identity outside the approved security procedure.'
  },
  payment: {
    label: 'Payment or transaction enquiry',
    objective: 'Establish the exact transaction facts before explaining the status or available remedy.',
    priority: 'high',
    focus: [
      ['Acknowledge the impact', 'Recognise the inconvenience without assuming the transaction outcome.'],
      ['Clarify the transaction', 'Confirm the date, amount, channel and reference available to the customer.'],
      ['Check an approved source', 'Use the relevant system or knowledge article; distinguish pending from confirmed outcomes.'],
      ['Agree the next step', 'Explain the responsible team, case reference and verified update window.']
    ],
    phrase: 'I understand why this transaction matters. Let me confirm the date, amount and reference first, then I will explain the status shown by the approved record and the next step.',
    guardrail: 'Never promise a refund, reversal, settlement or fixed completion time unless the approved record confirms it.'
  },
  technical: {
    label: 'Technical support contact',
    objective: 'Reproduce the problem safely and guide the customer through one verified step at a time.',
    priority: 'normal',
    focus: [
      ['Clarify the symptom', 'Ask what the customer was trying to do and the exact error or behaviour observed.'],
      ['Confirm the environment', 'Identify the product, device, browser or app version only where relevant.'],
      ['Check previous attempts', 'Avoid repeating steps the customer has already completed.'],
      ['Test one safe action', 'Use the approved knowledge article, then record the result and escalation evidence.']
    ],
    phrase: 'I can work through this with you. Please describe the exact message you see and tell me what you were doing immediately before it appeared. I will guide you one step at a time.',
    guardrail: 'Do not ask the customer to disclose credentials or install unapproved software, and do not claim the issue is fixed until it is tested.'
  },
  complaint: {
    label: 'Complaint or service recovery',
    objective: 'Acknowledge the experience, understand the outcome the customer wants and establish clear ownership.',
    priority: 'high',
    focus: [
      ['Acknowledge the experience', 'Let the customer explain the impact without arguing or assigning blame.'],
      ['Confirm the desired outcome', 'Restate what the customer wants reviewed or corrected.'],
      ['Set realistic ownership', 'Explain what you can do, what needs specialist review and who owns the next action.'],
      ['Close the loop', 'Confirm the case reference and only a verified update time.']
    ],
    phrase: 'I am sorry this has caused difficulty. I want to make sure I have understood the outcome you are seeking. I will explain what I can resolve now and what needs a tracked follow-up.',
    guardrail: 'Do not blame another team, dismiss the complaint or guarantee an outcome before the investigation is complete.'
  },
  service: {
    label: 'General customer service',
    objective: 'Understand the request, resolve what is within scope and make the next action clear.',
    priority: 'normal',
    focus: [
      ['Listen and acknowledge', 'Allow the customer to explain the reason for contact and recognise the impact.'],
      ['Clarify the request', 'Ask a focused question and restate the issue in plain language.'],
      ['Use verified guidance', 'Check the approved knowledge source and stay within your role permissions.'],
      ['Confirm understanding', 'Summarise the action, owner and next step before ending the contact.']
    ],
    phrase: 'Thank you for explaining that. Let me repeat the issue to make sure I have understood correctly, then I will check the available guidance and confirm the next step.',
    guardrail: 'Do not guess policy, fees, eligibility, timelines or product capabilities. Use the approved knowledge base.'
  }
});

function classify(context = {}) {
  const scenario = context.scenario || {};
  const text = words([scenario.category, scenario.issue, scenario.tag, scenario.title, scenario.profile].join(' '));
  if (/fraud|scam|phish|unauthori[sz]ed|stolen|lost card|suspicious|security|identity theft|compromis/.test(text)) return 'security';
  if (/payment|transaction|charge|refund|reversal|settlement|debit|credit|card|transfer|balance/.test(text)) return 'payment';
  if (/technical|login|log in|access|error|app|application|device|browser|network|connect|system|software|password reset/.test(text)) return 'technical';
  if (/complaint|complain|dissatisfied|poor service|delay|unhappy|manager|service recovery|escalat/.test(text)) return 'complaint';
  return 'service';
}

function contactKey(context) {
  const call = context.call || {};
  const scenario = context.scenario || {};
  return clean(call.queueContactId || call.id || scenario.reference || scenario.id || 'active-call') || 'active-call';
}

function checklistState(key, total) {
  let set = checklistByContact.get(key);
  if (!set) {
    set = new Set();
    checklistByContact.set(key, set);
    while (checklistByContact.size > CHECKLIST_LIMIT) checklistByContact.delete(checklistByContact.keys().next().value);
  }
  for (const index of [...set]) if (index >= total) set.delete(index);
  return set;
}

export function deriveLiveCallCoachV710(context = {}) {
  const behaviour = context.voiceBehaviour || {};
  const key = classify(context);
  const base = PLAYBOOKS[key];
  const pending = Boolean(context.pendingDecision || behaviour.pendingDecision);
  const supervisor = Boolean(behaviour.needsSupervisor);
  const sentiment = behaviour.sentiment !== null && behaviour.sentiment !== undefined && Number.isFinite(Number(behaviour.sentiment)) ? Number(behaviour.sentiment) : null;
  const patience = behaviour.patience !== null && behaviour.patience !== undefined && Number.isFinite(Number(behaviour.patience)) ? Number(behaviour.patience) : null;
  const lowPatience = patience !== null && patience < 28;
  const lowSentiment = sentiment !== null && sentiment < 32;
  const emotionalRisk = lowPatience || lowSentiment || /angry|frustrat|distress|upset|hostile/.test(words(behaviour.emotion));
  const step = context.step || {};
  const stage = clean(step.label || step.prompt || 'Understand the request');
  let status = base.priority;
  let headline = base.objective;
  let caution = base.guardrail;
  let focus = base.focus;
  if (pending) {
    status = 'paused';
    headline = 'A customer decision is waiting. Resolve the interruption or service-recovery choice before continuing.';
    focus = [['Resolve the visible decision', 'Choose the response that is accurate, authorised and clear.'], ...base.focus.slice(0, 3)];
  } else if (supervisor) {
    status = 'supervisor';
    headline = 'Customer behaviour indicates that supervisor support may be required. Request assistance and explain the hand-off clearly.';
    focus = [['Acknowledge and stabilise', 'Use calm, neutral language and let the customer finish.'], ['Request supervisor support', 'Use the in-call supervisor control; do not delay urgent safety escalation.'], ['Preserve the facts', 'Record the customer concern, actions already taken and requested outcome.'], ['Confirm ownership', 'Explain who will take the next action and how the customer will receive an update.']];
  } else if (emotionalRisk) {
    status = 'de-escalation';
    headline = 'The customer may be losing patience. Slow the conversation, acknowledge the impact and make one clear next step visible.';
    focus = [['Acknowledge impact', 'Name the inconvenience without becoming defensive.'], ['Ask one focused question', 'Avoid making the customer repeat information already provided.'], ['Explain the next action', 'Use short, concrete language and avoid unsupported assurances.'], ['Check understanding', 'Ask whether the proposed next step addresses the immediate concern.']];
  }
  const completed = checklistState(contactKey(context), focus.length);
  return {
    category: key,
    label: base.label,
    objective: base.objective,
    status,
    stage,
    headline,
    focus,
    phrase: base.phrase,
    guardrail: caution,
    completed: completed.size,
    total: focus.length,
    pending,
    supervisor,
    emotionalRisk
  };
}

function bindInteractions() {
  if (listenerBound || typeof document === 'undefined') return;
  listenerBound = true;
  document.addEventListener('click', event => {
    const toggle = event.target?.closest?.('[data-call-coach-toggle]');
    if (toggle) {
      const key = toggle.getAttribute('data-call-coach-key') || 'active-call';
      const index = Number(toggle.getAttribute('data-call-coach-toggle'));
      if (!Number.isInteger(index) || index < 0 || index > 8) return;
      const set = checklistState(key, 9);
      if (set.has(index)) set.delete(index); else set.add(index);
      const checked = set.has(index);
      toggle.setAttribute('aria-pressed', String(checked));
      toggle.textContent = checked ? 'Done' : 'Mark';
      const row = toggle.closest('.clcc-step');
      if (row) row.classList.toggle('is-done', checked);
      const panel = toggle.closest('.calloria-live-call-coach-v710');
      if (panel) {
        const completed = panel.querySelectorAll('.clcc-step.is-done').length;
        const total = panel.querySelectorAll('.clcc-step').length;
        const count = panel.querySelector('.clcc-progress strong');
        const bar = panel.querySelector('.clcc-progress-track span');
        if (count) count.textContent = `${completed}/${total}`;
        if (bar) bar.style.width = `${Math.round(completed / Math.max(1, total) * 100)}%`;
      }
      return;
    }
    const insert = event.target?.closest?.('[data-call-coach-insert]');
    if (insert) {
      const phrase = insert.getAttribute('data-call-coach-insert') || '';
      const field = document.querySelector('#voiceReplyText');
      if (!field || field.disabled) return;
      const current = String(field.value || '').trim();
      field.value = current ? `${current}\n${phrase}` : phrase;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.focus();
    }
  });
}

function statusLabel(status) {
  return ({ critical: 'SECURITY PRIORITY', high: 'FOCUSED HANDLING', normal: 'STANDARD FLOW', paused: 'ACTION REQUIRED', supervisor: 'SUPERVISOR SUPPORT', 'de-escalation': 'DE-ESCALATION' })[status] || 'CALL COACH';
}

function panelMarkup(snapshot, key, progress) {
  const rows = snapshot.focus.map((item, index) => {
    const checked = progress.has(index);
    return `<li class="clcc-step ${checked ? 'is-done' : ''}"><div class="clcc-step-copy"><span class="clcc-step-number">${index + 1}</span><div><strong>${escapeHtml(item[0])}</strong><small>${escapeHtml(item[1])}</small></div></div><button type="button" class="clcc-check" data-call-coach-toggle="${index}" data-call-coach-key="${escapeHtml(key)}" aria-pressed="${checked}" aria-label="${checked ? 'Unmark' : 'Mark'} ${escapeHtml(item[0])}">${checked ? 'Done' : 'Mark'}</button></li>`;
  }).join('');
  return `<section class="panel calloria-live-call-coach-v710" aria-label="Live call handling coach"><div class="clcc-head"><div><span class="subtle-label">LIVE CALL PLAYBOOK · ${escapeHtml(snapshot.label.toUpperCase())}</span><h3>Next-best handling guide</h3><p>Current stage: ${escapeHtml(snapshot.stage)}</p></div><span class="pill ${snapshot.status === 'critical' || snapshot.status === 'supervisor' ? 'red' : snapshot.status === 'paused' || snapshot.status === 'de-escalation' ? 'amber' : 'green'}">${escapeHtml(statusLabel(snapshot.status))}</span></div><p class="clcc-objective">${escapeHtml(snapshot.headline)}</p><ol class="clcc-steps">${rows}</ol><div class="clcc-progress" aria-live="polite"><span>Self-check progress</span><strong>${progress.size}/${snapshot.focus.length}</strong></div><div class="clcc-progress-track"><span style="width:${Math.round((progress.size / Math.max(1, snapshot.focus.length)) * 100)}%"></span></div><div class="clcc-phrase"><div><span class="subtle-label">OPTIONAL WORDING · EDIT BEFORE SENDING</span><p>${escapeHtml(snapshot.phrase)}</p></div><button type="button" class="btn small outline" data-call-coach-insert="${escapeHtml(snapshot.phrase)}">Add to response</button></div><div class="clcc-guardrail"><strong>Do not over-promise</strong><p>${escapeHtml(snapshot.guardrail)}</p></div><small class="clcc-footnote">Coaching aid only. Checklist marks are temporary for this page session and do not change QA, compliance outcomes or case records. Follow the approved knowledge base and supervisor instructions.</small></section>`;
}

export function renderCallCoachPanelV710(context = {}) {
  bindInteractions();
  const key = contactKey(context);
  const snapshot = deriveLiveCallCoachV710(context);
  const markup = panelMarkup(snapshot, key, checklistState(key, snapshot.focus.length));
  return markup.replace('<section class="panel calloria-live-call-coach-v710"', '<section data-call-coach-key="' + escapeHtml(key) + '" class="panel calloria-live-call-coach-v710"');
}

export const __liveCallCoachV710Test = Object.freeze({ classify, contactKey, checklistState, panelMarkup, PLAYBOOKS, checklistByContact });
