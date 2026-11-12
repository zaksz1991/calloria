(function () {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const E = window.CalloriaAgentWorkbenchEngine;
  const C = window.CalloriaCustomerJourneyEngine;
  const F = window.CalloriaLiveFloorEngine;
  const P = window.CalloriaCareerProgressionEngine;
  const R = window.CalloriaOfficeRoutineEngine;
  const D = window.CalloriaCustomerDynamics;
  const V = window.CalloriaVoiceCallEngine;
  const G = window.CalloriaDigitalChannelEngine;
  const S = window.CalloriaSocialMessagingEngine;
  const Q = window.CalloriaQueueRoutingEngine;
  const realStorage = window.localStorage;
  const toast = $('#toast');
  let toastTimer = null;
  let selectedChannel = '';
  let articleQuery = '';

  if (!E || !C || !F || !P || !R || !D || !V || !G || !S || !Q) {
    document.body.innerHTML = '<main style="max-width:700px;margin:60px auto;padding:24px;font:14px system-ui"><h1>CALLORIA Live Floor could not start</h1><p>Required simulation engine files are missing. Copy the v6.8 Intelligent Routing overlay and keep the matching v6.7 through v6.0 Live Floor dependencies in the public folder, then reload this page.</p></main>';
    return;
  }

  if (!D.install(F)) {
    document.body.innerHTML = '<main style="max-width:700px;margin:60px auto;padding:24px;font:14px system-ui"><h1>CALLORIA customer dynamics could not start</h1><p>The adaptive customer engine could not connect to the live-floor engine. Restore the matching v6.3 engine dependency and reload.</p></main>';
    return;
  }

  const storageProxy = {
    getItem(key) { return key === E.STORAGE_KEY ? realStorage.getItem(F.AGENT_STORAGE_KEY) : realStorage.getItem(key); },
    setItem(key, value) { return key === E.STORAGE_KEY ? realStorage.setItem(F.AGENT_STORAGE_KEY, value) : realStorage.setItem(key, value); },
    removeItem(key) { return key === E.STORAGE_KEY ? realStorage.removeItem(F.AGENT_STORAGE_KEY) : realStorage.removeItem(key); }
  };

  let state = F.load(realStorage);
  if (state.shift && state.shift.status === 'On shift' && state.shift.agentName && state.shift.team) {
    try { R.importExistingShift(realStorage, { name: state.shift.agentName, team: state.shift.team, date: state.shift.date }, state.shift.startedAt); } catch (_) { /* preserve the running shift if legacy attendance cannot be migrated */ }
  }
  let progress = P.load(realStorage);
  let agentState = E.load(storageProxy);
  let routingIdentity = {
    name: state.shift && state.shift.agentName || $('#agent-name').value || 'Agent Trainee',
    team: state.shift && state.shift.team || $('#agent-team').value || 'Customer Care'
  };
  let routingIdentityKey = Q.identityKey(routingIdentity);
  let routingProfile = Q.loadProfile(realStorage, routingIdentity);
  let queueSortMode = 'smart';
  if (state.active) {
    const restoredContact = E.getActiveContact(agentState);
    if (restoredContact && String(restoredContact.channel).toLowerCase() === 'voice') {
      state.active.voiceSession = V.normaliseSession(state.active.voiceSession, restoredContact);
    }
    if (restoredContact && G.isDigital(restoredContact)) {
      state.active.digitalSession = G.normaliseSession(state.active.digitalSession, restoredContact, state.shift.minutes, new Date());
    }
    if (restoredContact && S.isSupported(restoredContact)) {
      state.active.socialMessagingSession = S.normaliseSession(state.active.socialMessagingSession, restoredContact, new Date());
    }
  }
  E.save(agentState, storageProxy);
  F.save(state, realStorage);
  P.syncFromFloor(progress, state);
  P.save(progress, realStorage);

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }
  function notify(message, error) {
    toast.textContent = message;
    toast.classList.toggle('error', !!error);
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2500);
  }
  function persist() {
    const agentSaved = E.save(agentState, storageProxy);
    const floorSaved = F.save(state, realStorage);
    const progressSaved = P.save(progress, realStorage);
    if (!agentSaved || !floorSaved || !progressSaved) notify('Browser storage could not save the current shift. Check available site storage.', true);
  }
  function productLabel(productId) {
    return (E.PRODUCTS.find((item) => item.id === productId) || E.PRODUCTS[0]).name;
  }
  function priorityClass(priority) {
    if (String(priority).startsWith('P1')) return 'p1';
    if (String(priority).startsWith('P2')) return 'p2';
    if (String(priority).startsWith('P3')) return 'p3';
    return 'p4';
  }
  function activeRoutingIdentity() {
    return {
      name: state.shift && state.shift.agentName || $('#agent-name').value || 'Agent Trainee',
      team: state.shift && state.shift.team || $('#agent-team').value || 'Customer Care'
    };
  }
  function syncRoutingProfile() {
    const identity = activeRoutingIdentity();
    const key = Q.identityKey(identity);
    if (key !== routingIdentityKey) {
      routingIdentity = identity;
      routingIdentityKey = key;
      routingProfile = Q.loadProfile(realStorage, routingIdentity);
    }
    return routingProfile;
  }
  function getQueue() {
    syncRoutingProfile();
    const contacts = E.queuedContacts(agentState, selectedChannel ? { channel: selectedChannel } : {});
    return Q.routeQueue(contacts, routingProfile, { mode: queueSortMode, now: new Date() });
  }
  function renderRoutingProfile() {
    const profile = syncRoutingProfile();
    const controls = $('#routing-profile-controls');
    const channelRows = Q.CHANNELS.map((channel) => `
      <label class="routing-skill-row"><span>${escapeHtml(channel)}</span><select data-routing-skill-kind="channel" data-routing-skill-id="${escapeHtml(channel)}" aria-label="${escapeHtml(channel)} skill level">
        ${[1, 2, 3].map((level) => `<option value="${level}" ${profile.channelSkills[channel] === level ? 'selected' : ''}>${Q.LEVELS[level]}</option>`).join('')}
      </select></label>`).join('');
    const productRows = Q.PRODUCTS.map((product) => `
      <label class="routing-skill-row"><span>${escapeHtml(product.name)}</span><select data-routing-skill-kind="product" data-routing-skill-id="${escapeHtml(product.id)}" aria-label="${escapeHtml(product.name)} skill level">
        ${[1, 2, 3].map((level) => `<option value="${level}" ${profile.productSkills[product.id] === level ? 'selected' : ''}>${Q.LEVELS[level]}</option>`).join('')}
      </select></label>`).join('');
    controls.innerHTML = `<div class="routing-skill-section"><strong>Channel handling</strong>${channelRows}</div><div class="routing-skill-section"><strong>Product knowledge</strong>${productRows}</div>`;
    $('#routing-profile-saved').textContent = `Profile: ${routingIdentity.team} · saved on this device`;
  }
  function renderQueue() {
    const queue = getQueue();
    const allQueue = E.queuedContacts(agentState);
    const allRanked = Q.routeQueue(allQueue, routingProfile, { mode: 'smart', now: new Date() });
    const due = F.dueEvent(state);
    const blocked = !F.isOnShift(state) || !!due || !!state.active;
    $('#queue-count').textContent = String(queue.length);
    $('#routing-mode-badge').textContent = queueSortMode === 'smart' ? 'SMART ROUTING' : queueSortMode === 'priority' ? 'PRIORITY FIRST' : 'OLDEST WAITING';
    const recommended = queue[0];
    if (recommended) {
      $('#routing-next-title').textContent = `${recommended.contact.reference} · ${recommended.contact.subject}`;
      $('#routing-next-reason').textContent = `${recommended.reason}. ${Q.formatSla(recommended)} · ${recommended.skillFitPct}% skill fit.`;
    } else {
      $('#routing-next-title').textContent = F.isOnShift(state) ? 'No queued contacts in this view' : 'Queue recommendation appears after sign-in';
      $('#routing-next-reason').textContent = 'Routing considers priority, response deadlines, waiting time and your team skills.';
    }
    $('#routing-sla-count').textContent = `${allRanked.filter((item) => ['BREACHED', 'DUE SOON', 'AT RISK'].includes(item.slaState)).length} SLA at risk`;
    $('#routing-skill-count').textContent = `${allRanked.filter((item) => item.skillMatch).length} skill matches`;
    renderRoutingProfile();
    const list = $('#queue-list');
    if (!queue.length) {
      list.innerHTML = `<div class="empty-note">${F.isOnShift(state) ? 'No queued contacts remain. End the shift when floor events are complete.' : 'Sign in to load your shift queue.'}</div>`;
      return;
    }
    list.innerHTML = queue.map((route) => {
      const contact = route.contact;
      const slaClass = route.slaState === 'BREACHED' ? 'breached' : route.slaState === 'WITHIN SLA' ? 'within' : 'risk';
      return `
      <button type="button" class="queue-item queue-item-v68" data-contact-id="${escapeHtml(contact.id)}" ${blocked ? 'disabled' : ''}>
        <span class="queue-line"><strong>${escapeHtml(contact.reference)}</strong><span class="priority-chip ${priorityClass(contact.priority)}">${escapeHtml(contact.priority.split(' - ')[0])}</span></span>
        <p>${escapeHtml(contact.subject)}</p>
        <span class="queue-meta"><span>${escapeHtml(contact.channel)} · ${escapeHtml(productLabel(contact.productId))}</span><span>${escapeHtml(contact.customerTone || 'Customer')}</span></span>
        <span class="routing-contact-meta"><span class="routing-sla-chip ${slaClass}">${escapeHtml(route.slaState)} · ${escapeHtml(Q.formatSla(route))}</span><span class="routing-fit-chip ${route.skillMatch ? 'matched' : 'review'}">${route.skillFitPct}% skill fit</span></span>
        <small class="routing-reason">${escapeHtml(route.reason)}</small>
      </button>`;
    }).join('');
    list.querySelectorAll('[data-contact-id]').forEach((button) => button.addEventListener('click', () => acceptContact(button.dataset.contactId)));
  }
  function openCasesForCustomer(customerId) {
    const db = C.load(realStorage);
    return (db.cases || []).filter((item) => item.customerId === customerId && !['Resolved', 'Closed'].includes(item.status));
  }
  function renderMetrics() {
    const count = state.metrics.completed;
    $('#metric-handled').textContent = String(count);
    $('#metric-qa').textContent = count ? `${Math.round(state.metrics.qaTotal / count)}%` : '—';
    $('#metric-csat').textContent = count ? `${(state.metrics.csatTotal / count).toFixed(1)} / 5` : '—';
    $('#metric-fcr').textContent = count ? `${Math.round(state.metrics.fcr / count * 100)}%` : '—';
    $('#metric-breaches').textContent = String(state.metrics.complianceBreaches);
    $('#metric-knowledge').textContent = String(state.metrics.knowledgeUses);
  }
  function renderClockAndStatus() {
    $('#shift-clock').textContent = F.clockLabel(state.shift.minutes);
    $('#shift-status').textContent = state.shift.status.toUpperCase();
    const onShift = F.isOnShift(state);
    $('#start-panel').classList.toggle('hidden', onShift);
    $('#end-shift').disabled = !onShift || !!state.active;
    const status = $('#work-status');
    status.textContent = state.active ? 'CUSTOMER ACTIVE' : onShift ? (F.dueEvent(state) ? 'FLOOR EVENT DUE' : 'AVAILABLE') : state.shift.status.toUpperCase();
    status.className = `status-tag${state.active ? ' active' : onShift ? ' ready' : ''}`;
    $('#work-title').textContent = state.active ? 'Customer interaction in progress' : onShift ? 'Customer desk ready' : state.shift.status === 'Ended' ? 'Shift complete' : 'Ready for your shift';
    $('#work-empty').classList.toggle('hidden', !!state.active);
    $('#active-work').classList.toggle('hidden', !state.active);
    if (!state.active) {
      if (state.shift.status === 'Ended') {
        $('#work-empty-title').textContent = 'Shift complete';
        $('#work-empty-copy').textContent = 'Your shift report is available below. Start another shift to run a fresh customer queue.';
      } else if (onShift && F.dueEvent(state)) {
        $('#work-empty-title').textContent = 'Scheduled floor event';
        $('#work-empty-copy').textContent = `Complete the ${F.dueEvent(state).title.toLowerCase()} shown above before accepting the next customer.`;
      } else if (onShift) {
        $('#work-empty-title').textContent = 'Your customer desk is ready';
        $('#work-empty-copy').textContent = 'Select the next queued customer on the left. Each interaction has three service decisions and a required wrap-up.';
      } else {
        $('#work-empty-title').textContent = 'Your customer desk is waiting';
        $('#work-empty-copy').textContent = 'Clock in at Staff Reception in the 3D Workplace, enter your assigned workstation and attend the 7:30 AM briefing before accepting contacts.';
      }
    }
  }
  function renderQueue() {
    const queue = getQueue();
    const due = F.dueEvent(state);
    const blocked = !F.isOnShift(state) || !!due || !!state.active;
    $('#queue-count').textContent = String(queue.length);
    const list = $('#queue-list');
    if (!queue.length) {
      list.innerHTML = `<div class="empty-note">${F.isOnShift(state) ? 'No queued contacts remain. End the shift when floor events are complete.' : 'Sign in to load your shift queue.'}</div>`;
      return;
    }
    list.innerHTML = queue.map((contact) => `
      <button type="button" class="queue-item" data-contact-id="${escapeHtml(contact.id)}" ${blocked ? 'disabled' : ''}>
        <span class="queue-line"><strong>${escapeHtml(contact.reference)}</strong><span class="priority-chip ${priorityClass(contact.priority)}">${escapeHtml(contact.priority.split(' - ')[0])}</span></span>
        <p>${escapeHtml(contact.subject)}</p>
        <span class="queue-meta"><span>${escapeHtml(contact.channel)} · ${escapeHtml(productLabel(contact.productId))}</span><span>${escapeHtml(contact.customerTone || 'Customer')}</span></span>
      </button>`).join('');
    list.querySelectorAll('[data-contact-id]').forEach((button) => button.addEventListener('click', () => acceptContact(button.dataset.contactId)));
  }
  function renderCareer() {
    const summary = P.getSummary(progress, state.shift.agentName, state.shift.team);
    const rank = summary.rank;
    $('#career-rank').textContent = rank.name.toUpperCase();
    $('#career-xp').textContent = summary.totalXp.toLocaleString();
    $('#career-next-rank').textContent = summary.nextRank ? summary.nextRank.name : 'Maximum gameplay rank';
    $('#career-xp-to-next').textContent = summary.nextRank ? `${summary.xpToNext.toLocaleString()} XP remaining` : 'Top gameplay rank reached';
    $('#career-progress-bar').style.width = `${summary.progressPct}%`;
    $('#career-progress-bar').setAttribute('aria-valuenow', String(summary.progressPct));
    $('#career-copy').textContent = `${rank.description} ${summary.totalShifts} shifts completed · ${summary.totalContacts} customer contacts handled.`;
    const objectives = P.getShiftObjectives(state);
    $('#career-objectives-list').innerHTML = objectives.map((item) => `
      <div class="career-objective ${item.done ? 'done' : item.blocked ? 'blocked' : ''}">
        <span class="career-objective-mark">${item.done ? '✓' : item.blocked ? '!' : '○'}</span>
        <span class="career-objective-copy"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></span>
        <span class="career-objective-status">${escapeHtml(item.status)}</span>
      </div>`).join('');
    const earned = new Map(summary.badges.map((badge) => [badge.id, badge]));
    $('#career-badge-count').textContent = `${earned.size} / ${P.BADGES.length} earned`;
    $('#career-badges-list').innerHTML = P.BADGES.map((badge) => {
      const unlocked = earned.get(badge.id);
      return `<div class="career-badge ${unlocked ? 'unlocked' : 'locked'}"><span class="career-badge-mark">${unlocked ? '★' : '◇'}</span><span><strong>${escapeHtml(badge.name)}</strong><small>${escapeHtml(unlocked ? `Unlocked ${unlocked.unlockedAt || 'during a shift'}` : badge.description)}</small></span></div>`;
    }).join('');
  }
  function currentShiftIdentity() {
    return P.shiftIdentity({
      date: state.shift.date, agentName: state.shift.agentName, team: state.shift.team,
      startedAt: state.shift.startedAt, endedAt: state.shift.endedAt,
      report: F.getShiftReport(state)
    });
  }
  function syncCareerProgress() {
    const result = P.syncFromFloor(progress, state);
    P.save(progress, realStorage);
    return result;
  }

  function renderEvent() {
    const due = F.dueEvent(state);
    const panel = $('#event-panel');
    panel.classList.toggle('hidden', !due);
    if (!due) return;
    const copy = due.id === 'morningBriefing'
      ? 'Today’s focus: verify customers safely, check existing cases before opening duplicates, use approved product guidance and record clear next steps. Every department contributes to customer care.'
      : due.id === 'afternoonBriefing'
        ? 'Afternoon update: confirm outstanding customer commitments, review service-impact notices, name each handover owner and record the next update before leaving a case pending.'
        : due.description;
    $('#event-time').textContent = `${due.time} · ${due.type === 'briefing' ? 'TEAM BRIEFING' : 'SCHEDULED BREAK'}`;
    $('#event-title').textContent = due.title;
    const activityArea = due.type === 'briefing' ? 'the Team Briefing Room' : 'the Staff Lounge';
    $('#event-description').textContent = `${copy} Go to ${activityArea} in the 3D Workplace and record your attendance before completing this event here.`;
    $('#event-icon').textContent = due.type === 'briefing' ? 'B' : 'Ⅱ';
    $('#complete-event').textContent = due.type === 'briefing' ? 'Complete via Briefing Room' : `Complete via Staff Lounge`;
  }
  function renderRoutine() {
    const mapping = [
      ['routine-morning', 'morningBriefing'],
      ['routine-break', 'morningBreak'],
      ['routine-lunch', 'lunchBreak'],
      ['routine-afternoon', 'afternoonBriefing']
    ];
    mapping.forEach(([id, key]) => {
      const node = document.getElementById(id);
      const done = state.events[key];
      node.textContent = done ? 'DONE' : F.isOnShift(state) && F.dueEvent(state) && F.dueEvent(state).id === key ? 'DUE' : 'UPCOMING';
      node.classList.toggle('done', !!done);
    });
  }
  function customerName(customer) {
    return customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() : 'Customer profile unavailable';
  }
  function renderCustomer(contact) {
    const db = C.load(realStorage);
    const customer = C.getCustomer(db, contact.customerId);
    const cases = openCasesForCustomer(contact.customerId);
    if (!customer) {
      $('#customer-card').innerHTML = '<div class="empty-note">No matching customer profile is available.</div>';
      return;
    }
    const initials = `${customer.firstName?.[0] || ''}${customer.lastName?.[0] || ''}`.toUpperCase();
    $('#customer-card').innerHTML = `
      <div class="customer-head"><span class="avatar">${escapeHtml(initials)}</span><div><strong>${escapeHtml(customerName(customer))}</strong><small>${escapeHtml(customer.segment || 'Customer')} · ${escapeHtml(customer.id)}</small></div></div>
      <div class="customer-fields">
        <div><span>EMAIL</span><strong>${escapeHtml(customer.email || 'Not recorded')}</strong></div>
        <div><span>PHONE</span><strong>${escapeHtml(customer.phone || 'Not recorded')}</strong></div>
        <div><span>PREFERRED CHANNEL</span><strong>${escapeHtml(customer.preferredChannel || 'Not set')}</strong></div>
        <div><span>PRODUCT</span><strong>${escapeHtml(productLabel(contact.productId))}</strong></div>
      </div>
      <div class="case-list"><strong>OPEN CUSTOMER CASES (${cases.length})</strong>${cases.length ? cases.slice(0, 3).map((item) => `<div class="case-item"><b>${escapeHtml(item.reference)} · ${escapeHtml(item.status)}</b>${escapeHtml(item.subject)}</div>`).join('') : '<div class="empty-note">No open case on this customer record.</div>'}</div>`;
  }
  function renderKnowledge(contact) {
    const results = E.searchKnowledge(realStorage, articleQuery, contact ? contact.productId : 'all', new Date());
    const list = $('#knowledge-list');
    if (!contact) {
      list.innerHTML = '<div class="empty-note">Accept a customer to see relevant published guidance.</div>';
      return;
    }
    if (!results.length) {
      list.innerHTML = '<div class="empty-note">No published article matched this search. Use the scenario guidance and avoid inventing product behaviour.</div>';
      return;
    }
    list.innerHTML = results.map((article) => `
      <article class="article-card"><strong>${escapeHtml(article.title)}</strong><p>${escapeHtml(article.summary)}</p>
      ${article.steps && article.steps.length ? `<details class="article-steps"><summary>View steps</summary><ol>${article.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol></details>` : ''}
      <button type="button" data-article-id="${escapeHtml(article.id)}">Use this guidance</button></article>`).join('');
    list.querySelectorAll('[data-article-id]').forEach((button) => button.addEventListener('click', () => {
      try {
        F.markKnowledgeUsed(state, button.dataset.articleId, new Date());
        const active = E.getActiveContact(agentState);
        if (active) {
          active.knowledgeReferences = Array.isArray(active.knowledgeReferences) ? active.knowledgeReferences : [];
          if (!active.knowledgeReferences.includes(button.dataset.articleId)) active.knowledgeReferences.push(button.dataset.articleId);
        }
        persist();
        notify('Published knowledge article attached to this interaction.');
        renderMetrics();
      } catch (error) { notify(error.message, true); }
    }));
  }
  function renderConversation(contact) {
    const conversation = $('#conversation');
    conversation.innerHTML = (contact.messages || []).map((message) => `
      <div class="message ${message.direction === 'Outbound' ? 'outbound' : 'inbound'}">
        <div class="message-head"><span>${escapeHtml(message.author || (message.direction === 'Outbound' ? 'Agent' : 'Customer'))}</span><span>${escapeHtml(message.direction || '')}</span></div>
        ${escapeHtml(message.body)}
      </div>`).join('');
    conversation.scrollTop = conversation.scrollHeight;
  }
  function renderDigitalQuality(node, review, fallback) {
    if (!review) {
      node.className = 'digital-quality';
      node.textContent = fallback;
      return;
    }
    node.className = `digital-quality ${review.canSend ? 'good' : 'bad'}`;
    const items = review.checks.map((item) => `<li class="${item.passed ? 'pass' : 'fail'}">${item.passed ? '✓' : '○'} ${escapeHtml(item.label)}</li>`).join('');
    node.innerHTML = `<strong>${review.score}/100 · ${escapeHtml(review.feedback)}</strong><ul>${items}</ul>`;
  }
  function renderDigitalPanel(contact) {
    const panel = $('#digital-channel-panel');
    const active = state.active;
    const digital = active && active.digitalSession;
    const messaging = active && active.socialMessagingSession;
    if (contact && messaging && S.isSupported(contact)) {
      panel.classList.remove('hidden');
      $('#digital-channel-eyebrow').textContent = S.channelOf(contact).toUpperCase() + ' CONTACT';
      $('#digital-channel-title').textContent = S.channelOf(contact) === 'Social' ? 'Social response & privacy workspace' : S.channelOf(contact) === 'SMS' ? 'SMS service-response workspace' : 'In-app guided-support workspace';
      $('#digital-channel-status').textContent = active.stageIndex >= 3 ? 'READY TO WRAP' : 'CUSTOMER RESPONSE REQUIRED';
      $('#digital-email-workspace').classList.add('hidden');
      $('#digital-chat-workspace').classList.add('hidden');
      $('#social-messaging-workspace').classList.remove('hidden');
      const stage = active.stageIndex;
      const prepared = stage < 3 && S.hasPreparedReply(messaging, stage);
      const visibility = S.visibilityFor(messaging.channel, stage);
      const limit = S.characterLimit(messaging.channel, stage, messaging.stageDrafts[stage] || '');
      const sentCount = Object.keys(messaging.stageSentAt || {}).length;
      const body = $('#social-message-body');
      $('#social-message-stage').textContent = stage >= 3 ? 'COMPLETE' : `${stage + 1} OF 3${prepared ? ' · PREPARED' : ''}`;
      $('#social-message-visibility').textContent = visibility === 'PUBLIC' ? 'PUBLIC REPLY' : visibility === 'PRIVATE' ? 'PRIVATE FOLLOW-UP' : visibility === 'SMS' ? 'SERVICE SMS' : 'IN-APP RESPONSE';
      $('#social-message-sent').textContent = `${sentCount} / 3`;
      $('#social-message-label').textContent = messaging.channel === 'Social'
        ? (visibility === 'PUBLIC' ? 'Public social reply' : 'Private social follow-up')
        : messaging.channel === 'SMS' ? 'Customer service SMS' : 'In-app guided-support response';
      $('#social-message-guidance').textContent = stage >= 3
        ? 'All three customer-facing channel responses are recorded. Complete the contact wrap-up.'
        : messaging.channel === 'Social'
          ? visibility === 'PUBLIC'
            ? 'This first reply is public. Acknowledge the issue without exposing names, phone numbers, email addresses, account details or case references. Move account-specific checks to a private message.'
            : 'Continue privately. Confirm only the minimum details needed through the platform’s private support route; never request passwords, PINs or one-time codes.'
          : messaging.channel === 'SMS'
            ? `Keep this to the customer's service request. Limit: ${limit} characters. Multiple SMS segments may be counted; promotional messages are blocked unless marketing consent is verified.`
            : 'Give clear steps the customer can follow inside the product. Use a menu path or action, then explain what result to report. Avoid asking for passwords or one-time codes.';
      if (document.activeElement !== body) body.value = stage < 3 ? (messaging.stageDrafts[stage] || '') : '';
      body.maxLength = limit;
      body.disabled = stage >= 3 || prepared;
      $('#social-message-character-count').textContent = `${body.value.length} / ${limit} characters`;
      $('#social-message-prepare').disabled = stage >= 3 || prepared;
      $('#social-message-prepare').textContent = prepared ? 'Response prepared' : messaging.channel === 'Social' ? (visibility === 'PUBLIC' ? 'Prepare public reply' : 'Prepare private follow-up') : messaging.channel === 'SMS' ? 'Prepare service SMS' : 'Prepare in-app response';
      const review = messaging.stageReviews && messaging.stageReviews[stage];
      renderDigitalQuality($('#social-message-quality'), prepared && review ? { ...review, canSend: true, feedback: 'Prepared. Select the service action to record this reply.' } : review, stage >= 3 ? 'All channel responses are recorded.' : 'Prepare a safe customer-facing response before choosing the service action.');
      return;
    }
    if (!contact || !digital || !G.isDigital(contact)) {
      panel.classList.add('hidden');
      return;
    }
    panel.classList.remove('hidden');
    $('#social-messaging-workspace').classList.add('hidden');
    $('#digital-channel-eyebrow').textContent = digital.channel.toUpperCase() + ' CONTACT';
    $('#digital-channel-title').textContent = digital.channel === 'Email' ? 'Email response workspace' : 'Live chat response workspace';
    $('#digital-channel-status').textContent = digital.channel === 'Live chat' && active.stageIndex >= 3 ? 'READY TO WRAP' : String(digital.status || 'ACTIVE').replace(/_/g, ' ');
    const email = digital.channel === 'Email';
    $('#digital-email-workspace').classList.toggle('hidden', !email);
    $('#digital-chat-workspace').classList.toggle('hidden', email);
    if (email) {
      const sla = G.emailSlaSnapshot(digital, state.shift.minutes);
      $('#digital-email-sla').textContent = sla.status;
      $('#digital-email-sla').className = sla.breached ? 'sla-breached' : 'sla-good';
      $('#digital-email-remaining').textContent = digital.status === 'SENT'
        ? `${sla.elapsedMinutes} / ${sla.targetMinutes} shift minutes`
        : `${sla.remainingMinutes} shift minutes`;
      const ready = !!active.readyToWrap;
      $('#digital-email-instruction').textContent = digital.status === 'SENT'
        ? 'The simulated email reply is recorded. Complete the case disposition and wrap-up.'
        : ready
          ? 'The investigation is complete. Prepare a professional reply with the action taken and a clear next step.'
          : 'Complete the three customer-care decisions first. The email composer unlocks when investigation and resolution are complete.';
      const subject = $('#digital-email-subject');
      const body = $('#digital-email-body');
      if (document.activeElement !== subject) subject.value = digital.draftSubject || digital.subject;
      if (document.activeElement !== body && digital.draftBody != null && digital.status !== 'SENT') body.value = digital.draftBody;
      if (digital.status === 'SENT') body.value = digital.body || body.value;
      subject.disabled = !ready || digital.status === 'SENT';
      body.disabled = !ready || digital.status === 'SENT';
      subject.readOnly = digital.status === 'SENT';
      body.readOnly = digital.status === 'SENT';
      $('#digital-email-scaffold').disabled = !ready || digital.status === 'SENT';
      $('#digital-email-review').disabled = !ready || digital.status === 'SENT';
      $('#digital-email-send').disabled = !ready || digital.status === 'SENT' || !(digital.draftReview && digital.draftReview.canSend);
      $('#digital-email-send').textContent = digital.status === 'SENT' ? 'Email reply recorded' : 'Send simulated email reply';
      renderDigitalQuality($('#digital-email-quality'), digital.quality || digital.draftReview, digital.status === 'SENT' ? 'Email sent.' : ready ? 'Review the response before sending.' : 'The composer unlocks after all three service decisions.');
    } else {
      const stage = active.stageIndex;
      const hasDraft = stage < 3 && G.hasPreparedChatReply(digital, stage);
      const sentCount = Object.keys(digital.stageSentAt || {}).length;
      $('#digital-chat-stage').textContent = stage >= 3 ? 'COMPLETE' : `${stage + 1} OF 3${hasDraft ? ' · PREPARED' : ''}`;
      $('#digital-chat-response-time').textContent = digital.responseSeconds.length ? `${digital.responseSeconds[digital.responseSeconds.length - 1]} sec` : '—';
      $('#digital-chat-replies').textContent = `${sentCount} / 3`;
      $('#digital-chat-instruction').textContent = stage >= 3
        ? 'All three customer-facing chat replies have been recorded. Finish the contact wrap-up.'
        : hasDraft
          ? 'Response prepared. Select the service action below to send this message and receive the next customer turn.'
          : 'Write a customer-facing response for this stage. Prepare it before selecting the service action below.';
      const input = $('#digital-chat-body');
      if (document.activeElement !== input) input.value = hasDraft ? digital.stageDrafts[stage] : '';
      input.disabled = stage >= 3 || hasDraft;
      $('#digital-chat-prepare').disabled = stage >= 3 || hasDraft;
      $('#digital-chat-prepare').textContent = hasDraft ? 'Response prepared' : 'Prepare chat response';
      $('#digital-chat-character-count').textContent = `${input.value.length} / 700 characters`;
      const response = hasDraft ? digital.stageDrafts[stage] : '';
      const quality = response ? { canSend: true, score: Math.min(100, Math.round(response.length / 2) + 50), feedback: 'Prepared. Choose the service action to send this reply.', checks: [
        { label: 'Customer-facing response prepared', passed: true },
        { label: 'Credential request safety check', passed: !G.unsafeCredentialRequest(response) }
      ] } : null;
      renderDigitalQuality($('#digital-chat-quality'), quality, 'A customer response is required before choosing the service action.');
    }
  }
  function fillExistingCases(contact) {
    const select = $('#existing-case');
    const cases = openCasesForCustomer(contact.customerId);
    select.innerHTML = cases.length
      ? cases.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.reference)} · ${escapeHtml(item.subject)}</option>`).join('')
      : '<option value="">No open case found</option>';
    $('#case-action').value = cases.length ? 'existing' : 'create';
    $('#wrap-disposition').value = cases.length ? 'Information provided' : 'Case created';
    $('#existing-case-field').classList.toggle('hidden', !cases.length);
    $('#case-subject-field').classList.toggle('hidden', $('#case-action').value !== 'create');
  }
  function renderWrapUp(contact) {
    const panel = $('#wrapup-panel');
    const wasHidden = panel.classList.contains('hidden');
    const ready = !!(state.active && state.active.readyToWrap);
    panel.classList.toggle('hidden', !ready);
    $('#decision-area').classList.toggle('hidden', ready);
    if (!ready || !wasHidden) return;
    fillExistingCases(contact);
    $('#wrap-summary').value = '';
    $('#case-subject').value = contact.subject;
    $('#case-priority').value = contact.priority;
    $('#wrap-feedback').textContent = '';
  }
  function renderCustomerDynamics(active) {
    const panel = $('#customer-dynamics');
    if (!active) { panel.classList.add('hidden'); return; }
    const contact = E.getActiveContact(agentState);
    const d = D.snapshot(active, contact);
    if (!d) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');
    $('#dynamics-profile').textContent = d.archetype;
    $('#dynamics-mood').textContent = d.emotion.toUpperCase();
    $('#dynamics-mood').className = `dynamics-mood ${d.emotion.toLowerCase().replace(/[^a-z]+/g, '-')}`;
    $('#dynamics-rapport-value').textContent = `${d.rapport} / 100`;
    $('#dynamics-patience-value').textContent = `${d.patience} / 100`;
    $('#dynamics-trust-value').textContent = `${d.trust} / 100`;
    $('#dynamics-rapport-bar').style.width = `${d.rapport}%`;
    $('#dynamics-patience-bar').style.width = `${d.patience}%`;
    $('#dynamics-trust-bar').style.width = `${d.trust}%`;
    $('#dynamics-rapport-track').setAttribute('aria-valuenow', String(d.rapport));
    $('#dynamics-patience-track').setAttribute('aria-valuenow', String(d.patience));
    $('#dynamics-trust-track').setAttribute('aria-valuenow', String(d.trust));
    $('#dynamics-needs').textContent = d.needs;
    $('#dynamics-reaction').textContent = d.lastReaction;
    $('#dynamics-coaching').textContent = d.coachingCue;
    $('#request-supervisor').disabled = !!d.supervisorSuggested;
    $('#request-supervisor').textContent = d.supervisorSuggested ? 'Support request recorded' : 'Request floor-supervisor support';
    $('#supervisor-request-status').textContent = d.supervisorSuggested
      ? `Local simulation record created: ${state.active.supervisorSupport && state.active.supervisorSupport.reason || 'Support requested'}. No live supervisor is connected.`
      : 'Use this when a complaint is escalating, policy guidance is needed or the customer asks for a supervisor.';
  }

  function activeVoiceSession(contact) {
    if (!contact || String(contact.channel || '').toLowerCase() !== 'voice' || !state.active) return null;
    if (!state.active.voiceSession) state.active.voiceSession = V.createSession(contact, state.active.startedAt || new Date());
    else state.active.voiceSession = V.normaliseSession(state.active.voiceSession, contact);
    return state.active.voiceSession;
  }
  function renderVoicePanel(contact) {
    const panel = $('#voice-call-panel');
    const isVoice = !!(contact && String(contact.channel || '').toLowerCase() === 'voice');
    panel.classList.toggle('hidden', !isVoice);
    if (!isVoice) return;
    const session = activeVoiceSession(contact);
    const snap = V.snapshot(session, new Date());
    $('#voice-call-state').textContent = snap.status;
    $('#voice-call-state').className = `voice-call-state ${snap.status.toLowerCase().replace(/[^a-z]+/g, '-')}`;
    $('#voice-call-duration').textContent = V.formatSeconds(snap.durationSeconds);
    $('#voice-hold-duration').textContent = `Hold ${V.formatSeconds(snap.holdSeconds)} · ${snap.holdCount} hold${snap.holdCount === 1 ? '' : 's'}`;
    $('#voice-hold-button').classList.toggle('hidden', snap.status !== V.STATES.CONNECTED);
    $('#voice-resume-button').classList.toggle('hidden', ![V.STATES.ON_HOLD, V.STATES.CONSULTING].includes(snap.status));
    $('#voice-mute-button').classList.toggle('hidden', snap.status !== V.STATES.CONNECTED);
    $('#voice-mute-button').textContent = snap.muted ? 'Unmute microphone' : 'Mute microphone';
    $('#voice-mute-button').classList.toggle('is-muted', snap.muted);
    $('#voice-consult-start').classList.toggle('hidden', snap.status !== V.STATES.CONNECTED);
    $('#voice-consult-complete').classList.toggle('hidden', snap.status !== V.STATES.CONSULTING);
    $('#voice-consult-start').disabled = snap.status !== V.STATES.CONNECTED;
    if (session.consult) {
      $('#voice-consult-guidance').textContent = `${session.consult.status}: ${session.consult.guidance}`;
    } else {
      $('#voice-consult-guidance').textContent = 'The customer is not connected to a real supervisor. This is a scripted consultation exercise.';
    }
    const transferred = snap.status === V.STATES.TRANSFERRED;
    $('#voice-transfer-status').textContent = transferred ? `Transferred to ${session.transfer.destination}` : state.active.readyToWrap ? 'Ready' : 'Available at wrap-up';
    $('#voice-transfer-button').disabled = !state.active.readyToWrap || snap.status !== V.STATES.CONNECTED || transferred;
    $('#voice-transfer-button').textContent = transferred ? 'Warm transfer completed' : 'Complete simulated warm transfer';
    $('#voice-transfer-feedback').textContent = transferred
      ? `Handover completed to ${session.transfer.destination}. Set the wrap-up disposition to “Escalated to specialist” and document the agreed next step.`
      : state.active.readyToWrap
        ? 'The customer triage is complete. Provide a clear handover before routing the call.'
        : 'Warm transfer becomes available after the three service decisions are complete.';
    if (transferred) $('#voice-transfer-details').open = true;
  }
  function updateVoiceClock() {
    if (!state.active) return;
    const contact = E.getActiveContact(agentState);
    if (!contact || String(contact.channel || '').toLowerCase() !== 'voice' || !state.active.voiceSession) return;
    const snap = V.snapshot(state.active.voiceSession, new Date());
    $('#voice-call-duration').textContent = V.formatSeconds(snap.durationSeconds);
    $('#voice-hold-duration').textContent = `Hold ${V.formatSeconds(snap.holdSeconds)} · ${snap.holdCount} hold${snap.holdCount === 1 ? '' : 's'}`;
  }

  function renderActive() {
    const active = F.getActiveScenario(state, agentState, E);
    if (!active) {
      $('#customer-card').innerHTML = '<div class="empty-note">Customer information appears when a contact is accepted.</div>';
      $('#customer-dynamics').classList.add('hidden');
      $('#digital-channel-panel').classList.add('hidden');
      $('#knowledge-list').innerHTML = '<div class="empty-note">Accept a customer to see relevant guidance.</div>';
      return;
    }
    const { contact, scenario, stage } = active;
    $('#contact-reference').textContent = contact.reference;
    $('#contact-channel').textContent = contact.channel.toUpperCase();
    $('#contact-priority').textContent = contact.priority.toUpperCase();
    $('#contact-priority').className = `priority-chip ${priorityClass(contact.priority)}`;
    $('#contact-subject').textContent = contact.subject;
    $('#contact-focus').textContent = `${scenario.focus} · ${contact.customerTone || 'Customer'} customer`;
    renderVoicePanel(contact);
    renderCustomerDynamics(state.active);
    renderConversation(contact);
    renderDigitalPanel(contact);
    renderCustomer(contact);
    renderKnowledge(contact);
    renderWrapUp(contact);
    if (state.active.readyToWrap) return;
    $('#decision-step').textContent = `STEP ${state.active.stageIndex + 1} OF 3`;
    $('#decision-heading').textContent = stage.title;
    $('#decision-prompt').textContent = stage.prompt;
    const decisionHint = state.active.digitalSession && state.active.digitalSession.channel === 'Live chat'
      ? 'Select the internal service action; your prepared chat message is the customer-facing reply.'
      : state.active.digitalSession && state.active.digitalSession.channel === 'Email'
        ? 'Select the investigation or resolution action. Send one complete email after all checks are finished.'
        : state.active.socialMessagingSession
          ? 'Select the internal service action; your prepared Social, SMS or In-app message is the customer-facing reply.'
          : 'Select the response you would deliver to the customer.';
    $('#decision-options').innerHTML = stage.options.map((option, index) => `
      <button type="button" class="decision-option" data-choice-id="${escapeHtml(option.id)}">
        <span class="option-index">${String.fromCharCode(65 + index)}</span><span><strong>${escapeHtml(option.label)}</strong><small>${escapeHtml(decisionHint)}</small></span>
      </button>`).join('');
    $('#decision-options').querySelectorAll('[data-choice-id]').forEach((button) => button.addEventListener('click', () => chooseDecision(button.dataset.choiceId)));
    const voiceSession = activeVoiceSession(contact);
    if (voiceSession && voiceSession.status !== V.STATES.CONNECTED) {
      $('#decision-options').querySelectorAll('button').forEach((button) => { button.disabled = true; });
      $('#decision-prompt').textContent = `${stage.prompt} Resume the voice call before selecting a customer response.`;
    }
    const digital = state.active.digitalSession;
    if (digital && digital.channel === 'Live chat' && !G.hasPreparedChatReply(digital, state.active.stageIndex)) {
      $('#decision-options').querySelectorAll('button').forEach((button) => { button.disabled = true; });
      $('#decision-prompt').textContent = `${stage.prompt} Prepare a customer-facing chat reply in the workspace above before selecting your service action.`;
    }
    const messaging = state.active.socialMessagingSession;
    if (messaging && !S.hasPreparedReply(messaging, state.active.stageIndex)) {
      $('#decision-options').querySelectorAll('button').forEach((button) => { button.disabled = true; });
      $('#decision-prompt').textContent = `${stage.prompt} Prepare a safe ${messaging.channel} customer response in the workspace above before selecting your service action.`;
    }
  }
  function renderCompleted() {
    const records = state.completedContacts;
    $('#completed-count').textContent = String(records.length);
    const body = $('#completed-table');
    if (!records.length) {
      body.innerHTML = '<tr><td colspan="7" class="empty-table">No customer contacts completed yet.</td></tr>';
      return;
    }
    body.innerHTML = records.map((item) => `
      <tr><td><strong>${escapeHtml(item.reference)}</strong></td><td>${escapeHtml(item.channel)}</td><td>${escapeHtml(item.subject)}</td>
      <td class="${item.qa >= 85 ? 'score-good' : item.qa >= 65 ? 'score-mid' : 'score-low'}">${item.qa}%</td><td>${item.csat}/5</td><td>${escapeHtml(item.disposition)}</td><td>${item.voiceMetrics ? `${escapeHtml(V.formatSeconds(item.voiceMetrics.durationSeconds))} talk · ${escapeHtml(V.formatSeconds(item.voiceMetrics.holdSeconds))} hold · ${item.voiceMetrics.muteCount} mutes${item.voiceMetrics.consultCount ? ` · ${item.voiceMetrics.consultCount} consults` : ''}${item.voiceMetrics.transferred ? ` · to ${escapeHtml(item.voiceMetrics.transferDestination)}` : ''}` : item.digitalMetrics ? (item.digitalMetrics.channel === 'Email' ? `Email quality ${item.digitalMetrics.qualityScore}/100 · ${item.digitalMetrics.slaBreached ? 'SLA missed' : 'SLA met'}` : `${item.digitalMetrics.replies} chat replies · ${item.digitalMetrics.averageResponseSeconds}s avg first response`) : item.messagingMetrics ? `${item.messagingMetrics.channel} · ${item.messagingMetrics.replies} replies · ${item.messagingMetrics.averageResponseSeconds}s avg · ${item.messagingMetrics.averageQuality}/100 quality` : '—'}${item.routingMetrics ? ` · ${item.routingMetrics.mode} route · ${item.routingMetrics.waitingMinutes}m queue wait` : ''}</td></tr>`).join('');
  }
  function renderActivity() {
    const latest = state.activity.slice(0, 3).map((item) => item.message).join(' · ');
    $('#activity-log').textContent = latest || 'No activity recorded.';
  }
  function renderReport() {
    const show = state.shift.status === 'Ended';
    $('#shift-report').classList.toggle('hidden', !show);
    if (!show) return;
    const report = F.getShiftReport(state);
    const voiceRecords = state.completedContacts.filter((item) => item.voiceMetrics);
    const avgVoiceSeconds = voiceRecords.length ? Math.round(voiceRecords.reduce((sum, item) => sum + item.voiceMetrics.durationSeconds, 0) / voiceRecords.length) : 0;
    const totalHoldSeconds = voiceRecords.reduce((sum, item) => sum + item.voiceMetrics.holdSeconds, 0);
    const warmTransfers = voiceRecords.filter((item) => item.voiceMetrics.transferred).length;
    const muteActivations = voiceRecords.reduce((sum, item) => sum + item.voiceMetrics.muteCount, 0);
    const consultCount = voiceRecords.reduce((sum, item) => sum + item.voiceMetrics.consultCount, 0);
    const emailRecords = state.completedContacts.filter((item) => item.digitalMetrics && item.digitalMetrics.channel === 'Email');
    const chatRecords = state.completedContacts.filter((item) => item.digitalMetrics && item.digitalMetrics.channel === 'Live chat');
    const emailQuality = emailRecords.filter((item) => Number.isFinite(item.digitalMetrics.qualityScore));
    const avgEmailQuality = emailQuality.length ? Math.round(emailQuality.reduce((sum, item) => sum + item.digitalMetrics.qualityScore, 0) / emailQuality.length) : 0;
    const totalChatReplies = chatRecords.reduce((sum, item) => sum + item.digitalMetrics.replies, 0);
    const chatTimes = chatRecords.flatMap((item) => item.digitalMetrics.responseSeconds || []);
    const avgChatResponse = chatTimes.length ? Math.round(chatTimes.reduce((sum, value) => sum + value, 0) / chatTimes.length) : 0;
    const messagingRecords = state.completedContacts.filter((item) => item.messagingMetrics);
    const messagingReplies = messagingRecords.reduce((sum, item) => sum + item.messagingMetrics.replies, 0);
    const messagingTimes = messagingRecords.flatMap((item) => item.messagingMetrics.responseSeconds || []);
    const avgMessagingResponse = messagingTimes.length ? Math.round(messagingTimes.reduce((sum, value) => sum + value, 0) / messagingTimes.length) : 0;
    const socialRecords = messagingRecords.filter((item) => item.messagingMetrics.channel === 'Social');
    const smsRecords = messagingRecords.filter((item) => item.messagingMetrics.channel === 'SMS');
    const inAppRecords = messagingRecords.filter((item) => item.messagingMetrics.channel === 'In-app');
    const items = [
      ['Contacts handled', report.completed], ['Overall shift score', `${report.score}%`], ['Average QA', `${report.averageQa}%`], ['Average CSAT', `${report.averageCsat}/5`],
      ['First contact resolution', `${report.fcrRate}%`], ['Compliance breaches', report.complianceBreaches], ['Knowledge references', report.knowledgeUses], ['Average handle time', `${report.averageHandleMinutes} min`],
      ['Voice calls handled', voiceRecords.length], ['Average voice talk time', voiceRecords.length ? V.formatSeconds(avgVoiceSeconds) : '—'], ['Total voice hold time', V.formatSeconds(totalHoldSeconds)], ['Warm transfers', warmTransfers], ['Mute activations', muteActivations], ['Supervisor consultations', consultCount],
      ['Email replies sent', emailRecords.length], ['Average email quality', emailRecords.length ? `${avgEmailQuality}/100` : '—'], ['Email SLA misses', emailRecords.filter((item) => item.digitalMetrics.slaBreached).length],
      ['Live chats handled', chatRecords.length], ['Live chat replies', totalChatReplies], ['Average chat reply time', chatTimes.length ? `${avgChatResponse}s` : '—'],
      ['Social contacts handled', socialRecords.length], ['SMS contacts handled', smsRecords.length], ['In-app contacts handled', inAppRecords.length],
      ['Social / SMS / In-app replies', messagingReplies], ['Average messaging response time', messagingTimes.length ? `${avgMessagingResponse}s` : '—'],
      ['SMS segments used', smsRecords.reduce((sum, item) => sum + (item.messagingMetrics.smsSegments || 0), 0)]
    ];
    const routedRecords = state.completedContacts.filter((item) => item.routingMetrics);
    const averageQueueWait = routedRecords.length ? Math.round(routedRecords.reduce((sum, item) => sum + item.routingMetrics.waitingMinutes, 0) / routedRecords.length) : 0;
    items.push(
      ['Contacts routed with skills profile', routedRecords.length],
      ['Average queue waiting time', routedRecords.length ? `${averageQueueWait} min` : '—'],
      ['SLA breached at acceptance', routedRecords.filter((item) => item.routingMetrics.slaStateAtAcceptance === 'BREACHED').length],
      ['Average routing skill fit', routedRecords.length ? `${Math.round(routedRecords.reduce((sum, item) => sum + item.routingMetrics.skillFitPct, 0) / routedRecords.length)}%` : '—']
    );
    $('#report-grid').innerHTML = items.map(([label, value]) => `<div class="report-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
    $('#report-note').textContent = `Briefings: morning ${report.attendedMorningBriefing ? 'attended' : 'missed'}, afternoon ${report.attendedAfternoonBriefing ? 'attended' : 'not due'}. Scheduled breaks ${report.attendedBreaks ? 'completed' : 'not both completed'}. This is a simulated performance record, not an employment decision.`;
    const summary = P.getSummary(progress, state.shift.agentName, state.shift.team);
    const award = summary.lastAward;
    const awardPanel = $('#career-award');
    const isCurrentAward = award && award.shiftId === currentShiftIdentity();
    awardPanel.classList.toggle('hidden', !isCurrentAward);
    if (isCurrentAward) {
      const badges = award.unlockedBadges && award.unlockedBadges.length ? ` New achievements: ${award.unlockedBadges.map((badge) => badge.name).join(', ')}.` : '';
      const rankChange = award.rankUp ? ` Rank advanced: ${award.rankBefore} → ${award.rankAfter}.` : '';
      awardPanel.innerHTML = `<strong>Career reward: +${award.earnedXp} XP</strong><span>${escapeHtml(award.reason)}${escapeHtml(badges)}${escapeHtml(rankChange)}</span>`;
    }
  }
  function renderAll() {
    renderClockAndStatus(); renderMetrics(); renderEvent(); renderRoutine(); renderQueue();
    if (state.active) renderActive();
    else {
      $('#customer-card').innerHTML = '<div class="empty-note">Customer information appears when a contact is accepted.</div>';
      $('#customer-dynamics').classList.add('hidden');
      $('#knowledge-list').innerHTML = '<div class="empty-note">Accept a customer to see relevant guidance.</div>';
    }
    renderCompleted(); renderActivity(); renderReport(); renderCareer();
  }
  function acceptContact(contactId) {
    try {
      $('#decision-feedback').classList.add('hidden');
      syncRoutingProfile();
      const route = Q.findRoute(E.queuedContacts(agentState), routingProfile, contactId, { mode: queueSortMode, now: new Date() });
      const contact = F.beginContact(state, agentState, E, contactId, new Date());
      if (route) contact.routingSnapshot = {
        mode: queueSortMode, score: route.score, reason: route.reason,
        waitingMinutes: route.waitingMinutes, slaState: route.slaState,
        slaRemainingMinutes: route.slaRemainingMinutes, skillFitPct: route.skillFitPct,
        channelSkill: route.channelSkill, productSkill: route.productSkill,
        assignedAgent: state.shift.agentName, assignedTeam: state.shift.team,
        acceptedAt: new Date().toISOString()
      };
      if (String(contact.channel || '').toLowerCase() === 'voice') state.active.voiceSession = V.createSession(contact, new Date());
      if (G.isDigital(contact)) state.active.digitalSession = G.createSession(contact, state.shift.minutes, new Date());
      if (S.isSupported(contact)) state.active.socialMessagingSession = S.createSession(contact, new Date());
      persist(); renderAll(); notify(String(contact.channel).toLowerCase() === 'voice' ? 'Voice call connected. Use hold, mute and supervisor consultation controls as needed.' : G.isDigital(contact) ? `${G.canonicalChannel(contact)} workspace opened. Follow the channel-specific response steps.` : S.isSupported(contact) ? `${S.channelOf(contact)} workspace opened. Prepare a safe customer-facing response before choosing each service action.` : 'Customer contact accepted. Begin with the first service decision.');
    } catch (error) { notify(error.message, true); }
  }
  function chooseDecision(choiceId) {
    try {
      const activeContact = E.getActiveContact(agentState);
      const voice = activeContact && String(activeContact.channel || '').toLowerCase() === 'voice' ? activeVoiceSession(activeContact) : null;
      if (voice && voice.status !== V.STATES.CONNECTED) throw new Error('Resume the customer call before selecting the next service response.');
      const digital = state.active && state.active.digitalSession;
      const digitalStage = state.active ? state.active.stageIndex : -1;
      if (digital && digital.channel === 'Live chat' && !G.hasPreparedChatReply(digital, digitalStage)) throw new Error('Prepare a customer-facing chat response before selecting the service action.');
      const messaging = state.active && state.active.socialMessagingSession;
      if (messaging && !S.hasPreparedReply(messaging, digitalStage)) throw new Error(`Prepare a safe ${messaging.channel} response before selecting the service action.`);
      const messageStart = activeContact && Array.isArray(activeContact.messages) ? activeContact.messages.length : 0;
      const simulatedRepliesBefore = activeContact ? (Number(activeContact.simulatedReplies) || 0) : 0;
      const chatBody = digital && digital.channel === 'Live chat' ? digital.stageDrafts[digitalStage] : null;
      const messagingBody = messaging ? messaging.stageDrafts[digitalStage] : null;
      const result = F.chooseResponse(state, agentState, E, choiceId, new Date());
      if (digital && digital.channel === 'Email') {
        const generatedMessages = activeContact.messages.slice(messageStart);
        const generatedOutbound = generatedMessages.filter((message) => message.direction === 'Outbound').length;
        activeContact.messages.splice(messageStart, generatedMessages.length);
        activeContact.replyCount = Math.max(0, (Number(activeContact.replyCount) || 0) - generatedOutbound);
        if (agentState.metrics) agentState.metrics.replies = Math.max(0, (Number(agentState.metrics.replies) || 0) - generatedOutbound);
        activeContact.simulatedReplies = simulatedRepliesBefore;
      }
      if (digital && digital.channel === 'Live chat') {
        const newlyAdded = activeContact.messages.slice(messageStart);
        const scriptedOutbound = newlyAdded.find((message) => message.direction === 'Outbound');
        if (!scriptedOutbound) throw new Error('The chat reply could not be written to the interaction transcript.');
        scriptedOutbound.body = chatBody;
        scriptedOutbound.simulatedDigitalReply = true;
        G.commitChatReply(digital, digitalStage, new Date());
        if (state.active.stageIndex < 3) G.advanceChatStage(digital, state.active.stageIndex, new Date());
      }
      if (messaging) {
        const newlyAdded = activeContact.messages.slice(messageStart);
        const scriptedOutbound = newlyAdded.find((message) => message.direction === 'Outbound');
        if (!scriptedOutbound) throw new Error('The channel reply could not be written to the interaction transcript.');
        const committed = S.commitReply(messaging, digitalStage, new Date());
        scriptedOutbound.body = messagingBody;
        scriptedOutbound.simulatedDigitalReply = true;
        scriptedOutbound.messagingVisibility = committed.visibility;
        scriptedOutbound.socialMessagingChannel = messaging.channel;
        if (state.active.stageIndex < 3) S.advanceStage(messaging, state.active.stageIndex, new Date());
      }
      const feedback = $('#decision-feedback');
      feedback.classList.remove('hidden', 'bad');
      const severe = result.result.complianceBreach;
      feedback.classList.toggle('bad', severe || result.result.score < 50);
      feedback.textContent = `${result.result.note}${severe ? ' This is a critical failure and will affect the shift record.' : ''}`;
      persist(); renderAll();
      if (result.complete) notify('All three service decisions completed. Record the wrap-up.');
      else if (result.dueEvent) notify(`${result.dueEvent.title} will be due after this interaction is wrapped up.`);
    } catch (error) { notify(error.message, true); }
  }
  function prepareLiveChatReply() {
    const contact = E.getActiveContact(agentState);
    const digital = state.active && state.active.digitalSession;
    if (!contact || !digital || digital.channel !== 'Live chat') return;
    try {
      const stage = state.active.stageIndex;
      const result = G.prepareChatReply(digital, stage, $('#digital-chat-body').value, new Date());
      persist(); renderDigitalPanel(contact);
      $('#decision-options').querySelectorAll('button').forEach((button) => { button.disabled = false; });
      const activeScenario = F.getActiveScenario(state, agentState, E);
      if (activeScenario) $('#decision-prompt').textContent = `${activeScenario.stage.prompt} Your response is prepared. Select the service action that best resolves the customer's issue.`;
      notify(`Chat response prepared (${result.characterCount} characters). Select the service action to send it.`);
    } catch (error) { notify(error.message, true); }
  }
  function prepareSocialMessagingReply() {
    const contact = E.getActiveContact(agentState);
    const messaging = state.active && state.active.socialMessagingSession;
    if (!contact || !messaging || !S.isSupported(contact)) return;
    try {
      const stage = state.active.stageIndex;
      const result = S.prepareReply(messaging, stage, $('#social-message-body').value, new Date());
      persist(); renderDigitalPanel(contact);
      if (!result.canSend) {
        notify(result.feedback, true);
        return;
      }
      $('#decision-options').querySelectorAll('button').forEach((button) => { button.disabled = false; });
      const activeScenario = F.getActiveScenario(state, agentState, E);
      if (activeScenario) $('#decision-prompt').textContent = `${activeScenario.stage.prompt} Your ${messaging.channel} reply is prepared. Select the service action that best resolves the customer's issue.`;
      notify(`${messaging.channel} response prepared (${result.characterCount} characters). Select the service action to record it.`);
    } catch (error) { notify(error.message, true); }
  }
  function reviewEmailDraft() {
    const digital = state.active && state.active.digitalSession;
    if (!digital || digital.channel !== 'Email') return;
    digital.draftReview = G.emailReview($('#digital-email-subject').value, $('#digital-email-body').value);
    renderDigitalQuality($('#digital-email-quality'), digital.draftReview, 'Review the draft.');
    $('#digital-email-send').disabled = !state.active.readyToWrap || digital.status === 'SENT' || !digital.draftReview.canSend;
    persist();
  }
  function insertEmailScaffold() {
    const digital = state.active && state.active.digitalSession;
    if (!digital || digital.channel !== 'Email' || !state.active.readyToWrap) return;
    const agentName = clean(state.shift.agentName || 'Customer Care Team', 80);
    $('#digital-email-subject').value = digital.subject;
    $('#digital-email-subject').dataset.userEdited = '0';
    $('#digital-email-body').value = `Dear customer,\n\nThank you for contacting us about your enquiry. I understand the concern and appreciate the details you have provided.\n\nI have reviewed the information available and recorded the action taken on your request. [Add the confirmed finding or action; do not make an unverified promise.]\n\nNext step: [Explain the action owner and when the customer will receive the next update]. We will update you once the next check is complete.\n\nKind regards,\n${agentName}`;
    digital.draftSubject = $('#digital-email-subject').value;
    digital.draftBody = $('#digital-email-body').value;
    reviewEmailDraft();
  }
  function sendEmailReply() {
    const contact = E.getActiveContact(agentState);
    const digital = state.active && state.active.digitalSession;
    if (!contact || !digital || digital.channel !== 'Email') return;
    try {
      if (!state.active.readyToWrap) throw new Error('Complete the three customer-care decisions before sending the final email reply.');
      const sent = G.sendEmail(digital, { subject: $('#digital-email-subject').value, body: $('#digital-email-body').value }, state.shift.minutes, new Date());
      const message = E.sendReply(agentState, contact.id, `${sent.subject}\n\n${sent.body}`, new Date());
      message.body = `${sent.subject}\n\n${sent.body}`;
      message.digitalChannel = 'Email';
      digital.draftReview = null;
      digital.draftBody = sent.body; digital.draftSubject = sent.subject;
      persist(); renderAll();
      notify(`Email response recorded. Quality ${sent.quality.score}/100 · ${sent.sla.status}. No external email was sent.`);
    } catch (error) { notify(error.message, true); }
  }
  function updateCaseActionFields() {
    const action = $('#case-action').value;
    $('#existing-case-field').classList.toggle('hidden', action !== 'existing');
    $('#case-subject-field').classList.toggle('hidden', action !== 'create');
    if (action === 'create' && $('#wrap-disposition').value !== 'Case created') $('#wrap-disposition').value = 'Case created';
    if (action === 'skip' && $('#wrap-disposition').value === 'Case created') $('#wrap-disposition').value = 'Guidance provided';
    if (action === 'existing' && $('#wrap-disposition').value === 'Case created') $('#wrap-disposition').value = 'Information provided';
    if (action === 'existing' && !$('#existing-case').value) $('#wrap-feedback').textContent = 'Select an open case for this customer, or choose create a new case.';
    else $('#wrap-feedback').textContent = '';
  }
  function withActiveVoice(action) {
    const contact = E.getActiveContact(agentState);
    const session = activeVoiceSession(contact);
    if (!session) throw new Error('There is no active voice call.');
    const result = action(session, contact);
    persist(); renderAll();
    return result;
  }
  function placeVoiceOnHold() {
    try {
      withActiveVoice((session) => V.placeOnHold(session, $('#voice-hold-reason').value, new Date()));
      notify('Customer placed on hold. Resume the call before continuing the conversation.');
    } catch (error) { notify(error.message, true); }
  }
  function resumeVoiceCall() {
    try {
      withActiveVoice((session) => V.resume(session, new Date()));
      notify('Customer call resumed.');
    } catch (error) { notify(error.message, true); }
  }
  function toggleVoiceMute() {
    try {
      const muted = withActiveVoice((session) => V.toggleMute(session, new Date()));
      notify(muted ? 'Microphone muted in the simulation.' : 'Microphone unmuted in the simulation.');
    } catch (error) { notify(error.message, true); }
  }
  function startVoiceConsult() {
    try {
      const context = $('#voice-consult-context').value;
      const consult = withActiveVoice((session) => V.beginConsult(session, { reason: $('#voice-consult-reason').value, context }, new Date()));
      const contact = E.getActiveContact(agentState);
      if (contact) E.addInternalNote(agentState, contact.id, `Simulated supervisor consultation started: ${consult.reason}. ${context}`, new Date());
      persist(); renderAll();
      notify('Customer held while the simulated supervisor consultation is in progress.');
    } catch (error) { notify(error.message, true); }
  }
  function completeVoiceConsult() {
    try {
      const result = withActiveVoice((session) => V.completeConsult(session, new Date()));
      const contact = E.getActiveContact(agentState);
      if (contact) E.addInternalNote(agentState, contact.id, `Simulated supervisor guidance: ${result.guidance}`, new Date());
      persist(); renderAll();
      notify('Consultation recorded. Customer call resumed.');
    } catch (error) { notify(error.message, true); }
  }
  function completeVoiceTransfer() {
    try {
      if (!state.active || !state.active.readyToWrap) throw new Error('Complete the three customer-care decisions before transferring the call.');
      const input = {
        destination: $('#voice-transfer-destination').value,
        reason: $('#voice-transfer-reason').value,
        handover: $('#voice-transfer-handover').value
      };
      const transfer = withActiveVoice((session) => V.warmTransfer(session, input, new Date()));
      const contact = E.getActiveContact(agentState);
      if (contact) E.addInternalNote(agentState, contact.id, `Simulated warm transfer completed to ${transfer.destination}. Reason: ${transfer.reason}. Handover: ${transfer.handover}`, new Date());
      persist(); renderAll();
      notify(`Simulated warm handoff completed to ${transfer.destination}. Finish the case wrap-up.`);
    } catch (error) { notify(error.message, true); }
  }

  function submitWrapUp(event) {
    event.preventDefault();
    const contact = E.getActiveContact(agentState);
    if (!contact) return;
    const caseAction = $('#case-action').value;
    if (caseAction === 'existing' && !$('#existing-case').value) {
      $('#wrap-feedback').textContent = 'No open case is available. Select create a new case or customer note only.';
      return;
    }
    const disposition = $('#wrap-disposition').value;
    const activeContact = E.getActiveContact(agentState);
    let voiceMetrics = null;
    let voiceSessionToFinalise = null;
    const voiceSession = activeContact && String(activeContact.channel || '').toLowerCase() === 'voice' ? activeVoiceSession(activeContact) : null;
    if (voiceSession) {
      if ([V.STATES.ON_HOLD, V.STATES.CONSULTING].includes(voiceSession.status)) {
        $('#wrap-feedback').textContent = 'Resume the customer before saving the voice contact wrap-up.';
        return;
      }
      if (disposition === 'Escalated to specialist' && voiceSession.status !== V.STATES.TRANSFERRED) {
        $('#wrap-feedback').textContent = 'Complete the simulated warm transfer before using the Escalated to specialist disposition.';
        return;
      }
      if (voiceSession.status === V.STATES.TRANSFERRED && disposition !== 'Escalated to specialist') {
        $('#wrap-feedback').textContent = 'The call was transferred. Use Escalated to specialist as the wrap-up disposition.';
        return;
      }
      try { voiceMetrics = V.snapshot(voiceSession, new Date()); voiceSessionToFinalise = voiceSession; }
      catch (error) { $('#wrap-feedback').textContent = error.message; return; }
    }
    if (disposition === 'Case created' && !['create', 'existing'].includes(caseAction)) {
      $('#wrap-feedback').textContent = 'A case-created disposition requires a linked case.';
      return;
    }
    const input = {
      disposition,
      summary: $('#wrap-summary').value,
      caseAction,
      existingCaseId: $('#existing-case').value,
      category: $('#case-category').value,
      priority: $('#case-priority').value,
      caseSubject: $('#case-subject').value
    };
    const digitalSession = state.active && state.active.digitalSession;
    if (digitalSession && digitalSession.channel === 'Email' && digitalSession.status !== 'SENT') {
      $('#wrap-feedback').textContent = 'Send the customer email reply before saving the wrap-up.';
      return;
    }
    if (digitalSession && digitalSession.channel === 'Live chat' && Object.keys(digitalSession.stageSentAt || {}).length !== 3) {
      $('#wrap-feedback').textContent = 'All three live-chat customer responses must be recorded before wrap-up.';
      return;
    }
    const messagingSession = state.active && state.active.socialMessagingSession;
    if (messagingSession && Object.keys(messagingSession.stageSentAt || {}).length !== 3) {
      $('#wrap-feedback').textContent = `All three ${messagingSession.channel} customer responses must be recorded before wrap-up.`;
      return;
    }
    try {
      const digitalMetrics = digitalSession ? G.finalise(digitalSession, state.shift.minutes, new Date()) : null;
      const messagingMetrics = messagingSession ? S.finalise(messagingSession, new Date()) : null;
      const routingSnapshot = contact.routingSnapshot || null;
      const result = F.finishContact(state, agentState, E, C, realStorage, input, new Date());
      if (routingSnapshot) result.record.routingMetrics = {
        mode: routingSnapshot.mode,
        score: routingSnapshot.score,
        waitingMinutes: routingSnapshot.waitingMinutes,
        slaStateAtAcceptance: routingSnapshot.slaState,
        skillFitPct: routingSnapshot.skillFitPct,
        channelSkill: routingSnapshot.channelSkill,
        productSkill: routingSnapshot.productSkill,
        assignedTeam: routingSnapshot.assignedTeam
      };
      if (voiceSessionToFinalise) voiceMetrics = V.finalise(voiceSessionToFinalise, new Date());
      if (voiceMetrics) result.record.voiceMetrics = voiceMetrics;
      if (digitalMetrics) result.record.digitalMetrics = digitalMetrics;
      if (messagingMetrics) result.record.messagingMetrics = messagingMetrics;
      persist(); articleQuery = ''; $('#knowledge-query').value = '';
      renderAll();
      notify(`${result.completed.reference} saved. QA ${result.record.qa}% · CSAT ${result.record.csat}/5.`);
    } catch (error) { $('#wrap-feedback').textContent = error.message; }
  }
  function requestSupervisorAssistance() {
    const contact = E.getActiveContact(agentState);
    if (!contact || !state.active) return;
    const reason = $('#supervisor-reason').value;
    try {
      const snapshot = D.requestSupervisor(state.active, reason, contact);
      E.addInternalNote(agentState, contact.id, `Floor-supervisor assistance requested: ${reason}. This is a local simulation record; no live supervisor was notified.`, new Date());
      state.active.supervisorSupport = { reason, requestedAt: new Date().toISOString(), status: 'Recorded locally' };
      persist(); renderAll();
      notify(`Supervisor support request recorded. Customer mood: ${snapshot.emotion}. No live supervisor was notified.`);
    } catch (error) { notify(error.message, true); }
  }

  function doShiftEvent() {
    const due = F.dueEvent(state);
    if (!due) return;
    try {
      const identity = { name: state.shift.agentName, team: state.shift.team, date: state.shift.date };
      if (!R.hasEventToken(realStorage, identity, due.id)) {
        notify(due.type === 'briefing' ? 'Attend the scheduled briefing in the 3D Briefing Room first.' : 'Take the scheduled break in the 3D Staff Lounge first.', true);
        window.location.href = '/office-floor.html';
        return;
      }
      F.attendEvent(state, due.id, new Date());
      if (!R.consumeEventToken(realStorage, identity, due.id, new Date())) throw new Error('The office attendance record could not be consumed. Refresh and check the activity record.');
      persist(); renderAll();
      notify(`${due.title} completed from your 3D workplace attendance record.`);
    } catch (error) { notify(error.message, true); }
  }
  function finishShift() {
    try {
      F.endShift(state, agentState, E, new Date());
      syncCareerProgress();
      persist(); renderAll();
      notify('Shift ended. Performance report is ready.');
    } catch (error) { notify(error.message, true); }
  }

  const officeParams = new URLSearchParams(window.location.search);
  if (officeParams.get('fromOffice') === '1') {
    const requestedTeam = officeParams.get('team');
    const teamSelect = $('#agent-team');
    if (requestedTeam && Array.from(teamSelect.options).some((option) => option.value === requestedTeam || option.textContent === requestedTeam)) {
      teamSelect.value = requestedTeam;
    }
    const checkedInIdentity = R.getLastIdentity(realStorage, new Date());
    if (checkedInIdentity) {
      $('#agent-name').value = checkedInIdentity.name;
      if (Array.from(teamSelect.options).some((option) => option.value === checkedInIdentity.team || option.textContent === checkedInIdentity.team)) teamSelect.value = checkedInIdentity.team;
    } else {
      const previousShift = F.load(realStorage);
      if (previousShift.shift && previousShift.shift.agentName && previousShift.shift.agentName !== 'Agent Trainee') $('#agent-name').value = previousShift.shift.agentName;
    }
  }

  $('#start-form').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const startIdentity = { name: $('#agent-name').value, team: $('#agent-team').value };
      const resuming = F.isOnShift(state) && state.shift.agentName === startIdentity.name && state.shift.team === startIdentity.team;
      if (!resuming && !R.validateShiftStart(realStorage, startIdentity, new Date())) throw new Error('Clock in at Staff Reception in the 3D Workplace before starting your shift.');
      F.startShift(state, agentState, E, startIdentity, new Date());
      syncCareerProgress();
      persist(); renderAll(); notify('Shift started. Attend the 07:30 briefing before accepting contacts.');
    } catch (error) { notify(error.message, true); }
  });
  $('#complete-event').addEventListener('click', doShiftEvent);
  $('#request-supervisor').addEventListener('click', requestSupervisorAssistance);
  $('#end-shift').addEventListener('click', finishShift);
  $('#queue-channel').addEventListener('change', (event) => { selectedChannel = event.target.value; renderQueue(); });
  $('#queue-sort').addEventListener('change', (event) => { queueSortMode = ['smart', 'priority', 'oldest'].includes(event.target.value) ? event.target.value : 'smart'; renderQueue(); });
  $('#routing-profile-controls').addEventListener('change', (event) => {
    const select = event.target.closest('[data-routing-skill-kind]');
    if (!select) return;
    try {
      routingProfile = Q.updateSkill(routingProfile, select.dataset.routingSkillKind, select.dataset.routingSkillId, select.value);
      if (!Q.saveProfile(realStorage, routingIdentity, routingProfile, new Date())) throw new Error('The routing profile could not be saved in browser storage.');
      renderQueue();
      notify('Routing skill profile saved. Queue recommendations updated.');
    } catch (error) { notify(error.message, true); }
  });
  $('#routing-profile-reset').addEventListener('click', () => {
    routingProfile = Q.createDefaultProfile(routingIdentity);
    if (!Q.saveProfile(realStorage, routingIdentity, routingProfile, new Date())) { notify('The default skill profile could not be saved.', true); return; }
    renderQueue();
    notify('Team routing skill defaults restored.');
  });
  $('#agent-name').addEventListener('change', renderQueue);
  $('#agent-team').addEventListener('change', renderQueue);
  $('#knowledge-query').addEventListener('input', (event) => { articleQuery = event.target.value; const contact = state.active && E.getActiveContact(agentState); if (contact) renderKnowledge(contact); });
  $('#knowledge-search-button').addEventListener('click', () => { articleQuery = $('#knowledge-query').value; const contact = state.active && E.getActiveContact(agentState); if (contact) renderKnowledge(contact); });
  $('#case-action').addEventListener('change', updateCaseActionFields);
  $('#wrapup-form').addEventListener('submit', submitWrapUp);
  $('#voice-hold-button').addEventListener('click', placeVoiceOnHold);
  $('#voice-resume-button').addEventListener('click', resumeVoiceCall);
  $('#voice-mute-button').addEventListener('click', toggleVoiceMute);
  $('#voice-consult-start').addEventListener('click', startVoiceConsult);
  $('#voice-consult-complete').addEventListener('click', completeVoiceConsult);
  $('#voice-transfer-button').addEventListener('click', completeVoiceTransfer);
  $('#digital-chat-prepare').addEventListener('click', prepareLiveChatReply);
  $('#digital-chat-body').addEventListener('input', () => { $('#digital-chat-character-count').textContent = `${$('#digital-chat-body').value.length} / 700 characters`; });
  $('#social-message-prepare').addEventListener('click', prepareSocialMessagingReply);
  $('#social-message-body').addEventListener('input', () => {
    const contact = E.getActiveContact(agentState);
    const messaging = state.active && state.active.socialMessagingSession;
    if (!contact || !messaging) return;
    try {
      const stage = state.active.stageIndex;
      const saved = S.saveDraft(messaging, stage, $('#social-message-body').value);
      $('#social-message-body').maxLength = saved.limit;
      $('#social-message-character-count').textContent = `${saved.characterCount} / ${saved.limit} characters`;
      persist();
    } catch (_) { /* a prepared/sent stage is locked; renderDigitalPanel restores the saved response */ }
  });
  $('#digital-email-body').addEventListener('input', () => { const digital = state.active && state.active.digitalSession; if (digital) { digital.draftBody = $('#digital-email-body').value; digital.draftReview = null; persist(); } $('#digital-email-send').disabled = true; });
  $('#digital-email-subject').addEventListener('input', () => { const digital = state.active && state.active.digitalSession; if (digital) { digital.draftSubject = $('#digital-email-subject').value; digital.draftReview = null; persist(); } $('#digital-email-send').disabled = true; });
  $('#digital-email-scaffold').addEventListener('click', insertEmailScaffold);
  $('#digital-email-review').addEventListener('click', reviewEmailDraft);
  $('#digital-email-send').addEventListener('click', sendEmailReply);
  setInterval(updateVoiceClock, 1000);
  setInterval(() => {
    const profilePanel = $('#routing-profile-panel');
    const editingProfile = profilePanel && profilePanel.contains(document.activeElement);
    if (!state.active && !editingProfile) renderQueue();
  }, 30000);
  renderAll();
  window.CalloriaLiveFloor = { getState: () => state, getAgentState: () => agentState, getCareerProgress: () => progress, getRoutingProfile: () => routingProfile, refresh: renderAll, engine: F, progressionEngine: P, digitalChannelEngine: G, socialMessagingEngine: S, queueRoutingEngine: Q };
})();
