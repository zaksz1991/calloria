/** CALLORIA v7.23 — ordered supervisor follow-up SLA visibility integration. */
const importAnchor = "import { assessDigitalResponseCycles, digitalResponseCycleDisplay } from './digital-response-cycle-engine-v721.js';";
const renderSupervisorAnchor = 'function renderSupervisor(){';
const digitalLiveAnchor = '  const digitalLive=digitalLiveQueueSnapshot(state.digitalLiveQueueSimulation,state.shiftElapsedMinutes);';
const escalationPanelAnchor = '    <section class="panel supervisor-escalation-desk"';
const actionAnchor = "    case 'request-digital-supervisor':requestDigitalSupervisor(event.contactId);break;";
const V721_MARKER = '/* CALLORIA_V721_DIGITAL_RESPONSE_CYCLE */';
const V723_MARKER = '/* CALLORIA_V723_DIGITAL_FOLLOWUP_SUPERVISOR */';
const MAIN_SUFFIX = '/js/main.js';

function normaliseId(id) {
  return String(id || '').split('?')[0].replace(/\\/g, '/');
}
function count(source, value) {
  return source.split(value).length - 1;
}
function panelFunctionSource() {
  return [
    V723_MARKER,
    'function renderDigitalFollowUpSupervisorPanelV723(queue, requests, now) {',
    '  const board = digitalFollowUpSupervisorBoard(queue, requests, now);',
    '  const rows = board.rows.slice(0, 10).map(item => {',
    "    const overdue = item.status === 'breached';",
    "    const stateLabel = overdue ? `OVERDUE · ${item.overdueMinutes}m` : `DUE SOON · ${item.remainingMinutes}m LEFT`;",
    "    const owner = item.assignedTo || 'Unassigned';",
    "    const requestDisabled = item.hasOpenRequest ? 'disabled' : '';",
    "    const requestLabel = item.hasOpenRequest ? 'Supervisor request open' : 'Raise intervention';",
    '    return `<article class="digital-followup-alert-row ${overdue ? \'overdue\' : \'at-risk\'}"><div class="digital-followup-alert-copy"><strong>${escapeHTML(item.subject)}</strong><small>${escapeHTML(item.customer)} · ${escapeHTML(item.channel)} · Owner ${escapeHTML(owner)}</small><small>Follow-up #${item.sequence} · ${stateLabel} · Target ${item.targetMinutes}m</small></div><span class="pill ${overdue ? \'red\' : \'amber\'}">${overdue ? \'OVERDUE\' : \'DUE SOON\'}</span><div class="digital-followup-alert-actions"><button type="button" class="btn small outline" data-action="open-digital-followup" data-contact-id="${escapeHTML(item.contactId)}">Open thread</button><button type="button" class="btn small secondary" data-action="raise-digital-followup-escalation" data-contact-id="${escapeHTML(item.contactId)}" data-cycle-id="${escapeHTML(item.cycleId)}" ${requestDisabled}>${requestLabel}</button></div></article>`;',
    '  }).join(\'\');',
    '  const empty = `<div class="empty-state"><p>No unanswered digital follow-up is currently at risk or overdue.</p></div>`;',
    '  return `<section class="panel digital-followup-supervisor-panel"><div class="panel-head"><div><h3>Digital follow-up SLA watch</h3><p>Second and later customer messages awaiting an agent reply. First-response timers remain separate.</p></div><span class="pill ${board.overdue ? \'red\' : board.dueSoon ? \'amber\' : \'green\'}">${board.total} OPEN ALERTS</span></div><div class="digital-followup-supervisor-metrics"><div><span>Overdue</span><strong>${board.overdue}</strong></div><div><span>Due soon</span><strong>${board.dueSoon}</strong></div><div><span>Supervisor requests open</span><strong>${board.alreadyEscalated}</strong></div><div><span>Not yet escalated</span><strong>${board.unraised}</strong></div></div><div class="digital-followup-alert-list">${rows || empty}</div><p class="muted-note">Raise intervention only after reviewing the thread. This is a local simulation alert, not a live provider SLA or automatic customer notification.</p></section>`;',
    '}'
  ].join('\n') + '\n';
}
function actionCasesSource() {
  return [
    "    case 'open-digital-followup': {",
    '      const contact = findDigitalContact(state.digitalQueue, event.contactId);',
    "      if (!contact || ![DIGITAL_STATUS.ACTIVE, DIGITAL_STATUS.AWAITING_CUSTOMER].includes(contact.status)) { toast('This digital thread is no longer open.', 'warning'); break; }",
    '      state.digitalActiveId = contact.id;',
    "      state.currentView = 'digital';",
    '      saveState(); renderView(); break;',
    '    }',
    "    case 'raise-digital-followup-escalation': {",
    '      const alert = findDigitalFollowUpSupervisorAlert(state.digitalQueue, state.supervisorRequests, event.contactId, event.cycleId, queueSimulationNowMs());',
    "      if (!alert) { toast('The follow-up is no longer at risk or overdue. Refresh the Supervisor view.', 'warning'); break; }",
    "      if (alert.hasOpenRequest || state.supervisorRequests.some(item => item.contactId === alert.contactId && item.status === 'open')) { toast('An open supervisor request already exists for this digital contact.', 'warning'); break; }",
    '      const contact = findDigitalContact(state.digitalQueue, alert.contactId);',
    "      if (!contact) { toast('The digital contact could not be found.', 'warning'); break; }",
    "      const urgency = alert.status === 'breached' ? 'overdue' : 'at risk';",
    '      const reason = `Digital case follow-up response SLA ${urgency}: customer follow-up ${alert.sequence} is awaiting an agent reply.`;',
    "      state.supervisorRequests.push({ id: makeCallReference('SUP'), contactId: contact.id, reference: contact.id, customer: contact.customer, reason, status: 'open', createdAt: new Date().toISOString(), channel: `${contact.channelLabel || contact.channel} follow-up`, priority: 'high', followUpCycleId: alert.cycleId });",
    "      pushOperationEvent('supervisor', contact.id, 'Supervisor intervention raised for a digital follow-up response SLA.', 'open', { channel: contact.channel, followUpCycleId: alert.cycleId, responseSla: alert.status, targetMinutes: alert.targetMinutes });",
    "      saveState(); toast('Digital follow-up intervention added to the Supervisor escalation desk.', 'success'); renderView(); break;",
    '    }',
    actionAnchor
  ].join('\n');
}

export function calloriaDigitalFollowUpSupervisorPluginV723() {
  return {
    name: 'calloria-digital-followup-supervisor-v7-23',
    enforce: 'post',
    transform(source, id) {
      if (!normaliseId(id).endsWith(MAIN_SUFFIX)) return null;
      if (source.includes(V723_MARKER)) return null;
      const checks = [
        [V721_MARKER, 'v7.21 response-cycle marker'],
        [importAnchor, 'v7.21 response-cycle import'],
        [renderSupervisorAnchor, 'Supervisor render function'],
        [digitalLiveAnchor, 'Supervisor digital-intake snapshot'],
        [escalationPanelAnchor, 'Supervisor escalation panel insertion point'],
        [actionAnchor, 'digital supervisor action dispatch']
      ];
      const missing = checks.filter(([anchor]) => count(source, anchor) !== 1).map(([, label]) => label);
      if (missing.length) {
        this.warn(`CALLORIA v7.23 skipped safely: ${missing.join(', ')} did not match exactly once. No partial transform was applied.`);
        return null;
      }

      let code = source.replace(
        importAnchor,
        `${importAnchor}\nimport { digitalFollowUpSupervisorBoard, findDigitalFollowUpSupervisorAlert } from './digital-followup-supervisor-engine-v723.js';\nimport '../styles/calloria-digital-followup-supervisor-v723.css';`
      );
      code = code.replace(renderSupervisorAnchor, `${panelFunctionSource()}\n${renderSupervisorAnchor}`);
      code = code.replace(digitalLiveAnchor, `${digitalLiveAnchor}\n  const digitalFollowUpSupervisorPanel = renderDigitalFollowUpSupervisorPanelV723(state.digitalQueue, state.supervisorRequests, nowVoice);`);
      code = code.replace(escalationPanelAnchor, '    ${digitalFollowUpSupervisorPanel}\n' + escalationPanelAnchor);
      code = code.replace(actionAnchor, actionCasesSource());
      return { code, map: null };
    }
  };
}
