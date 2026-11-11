(function () {
  'use strict';
  const Engine = window.CalloriaWorkforceEngine;
  if (!Engine) throw new Error('CALLORIA workforce engine did not load.');
  let state = Engine.loadState();
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const escapeHtml = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const currentIntraday = () => Engine.deriveIntraday(state, state.simulatedTime);
  const save = () => Engine.saveState(state);
  const timeLabel = (time) => time;

  function toast(message, error) {
    const node = document.createElement('div');
    node.className = `toast${error ? ' error' : ''}`;
    node.textContent = message;
    $('#toast-stack').appendChild(node);
    window.setTimeout(() => node.remove(), 3400);
  }

  function formatDate(value, long) {
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, long ? { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' } : { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }

  function showView(name) {
    $$('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${name}`));
    $$('.nav-link').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
    $('#sidebar').classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function syncDateControls() {
    $('#top-date').value = state.date;
    $('#schedule-date').value = state.date;
    $('#overview-date').textContent = formatDate(state.date, true).toUpperCase().replace(',', ' ·');
    $('#coverage-date-tag').textContent = formatDate(state.date, false).toUpperCase();
  }

  function selectedDayShifts() {
    return state.shifts.filter((shift) => shift.date === state.date).sort((a, b) => a.start.localeCompare(b.start));
  }

  function renderOverview() {
    const intraday = currentIntraday();
    const dayShifts = selectedDayShifts();
    const published = dayShifts.filter((shift) => shift.status === 'Published').length;
    const coverage = intraday.coverage;
    $('#metric-scheduled').textContent = String(dayShifts.length);
    $('#metric-scheduled-foot').textContent = `${published} published · ${dayShifts.length - published} draft`;
    $('#metric-working').textContent = `${intraday.working} / ${intraday.scheduled}`;
    $('#metric-working-foot').textContent = `${intraday.onBreak} currently on planned break`;
    $('#metric-adherence').textContent = `${intraday.adherence}%`;
    $('#metric-adherence-foot').textContent = `${intraday.exceptions.length} agent status exception${intraday.exceptions.length === 1 ? '' : 's'}`;
    $('#metric-gap').textContent = coverage.gap ? `${coverage.gap} short` : 'Covered';
    $('#metric-gap-foot').textContent = `${coverage.available} available / ${coverage.required} required at ${state.simulatedTime}`;

    $('#coverage-time').textContent = state.simulatedTime;
    $('#coverage-required').textContent = coverage.required;
    $('#coverage-available').textContent = coverage.available;
    $('#coverage-status').textContent = coverage.status;
    $('#coverage-status').className = `coverage-state ${coverage.gap ? 'bad' : 'good'}`;
    const max = Math.max(1, ...state.forecast.map((row) => Engine.calculateRequiredAgents(row, state.occupancyTarget)));
    $('#overview-interval-bars').innerHTML = state.forecast.filter((row) => {
      const minute = Engine.timeToMinutes(row.time);
      return minute >= 8 * 60 && minute <= 15 * 60 + 30;
    }).map((row) => {
      const itemCoverage = Engine.calculateIntervalCoverage(state, row);
      const requiredWidth = Math.max(4, itemCoverage.required / max * 100);
      const availableWidth = Math.max(0, Math.min(100, itemCoverage.available / max * 100));
      const active = row.time === state.simulatedTime ? ' active' : '';
      return `<button class="interval-bar${active}" data-time="${row.time}" title="${row.time}: ${itemCoverage.available} available, ${itemCoverage.required} required"><span>${row.time}</span><i class="bar-required" style="width:${requiredWidth}%"></i><i class="bar-available" style="width:${availableWidth}%"></i><small>${itemCoverage.gap ? `-${itemCoverage.gap}` : 'OK'}</small></button>`;
    }).join('');

    const alerts = [];
    if (coverage.gap > 0) alerts.push({ tone: 'red', title: `${coverage.gap} agent${coverage.gap === 1 ? '' : 's'} below workload requirement`, detail: `${state.simulatedTime} · ${coverage.available} available against ${coverage.required} required`, action: 'Review schedule', view: 'schedule' });
    intraday.exceptions.slice(0, 4).forEach((agent) => alerts.push({ tone: 'orange', title: `${agent.name} status mismatch`, detail: `Planned ${agent.planned.toLowerCase()} · Actual ${agent.actual.toLowerCase()}`, action: 'Open intraday', view: 'intraday' }));
    if (!alerts.length) alerts.push({ tone: 'green', title: 'No workforce exceptions detected', detail: 'The selected interval has no staffing gap or status mismatch.', action: 'Review intraday', view: 'intraday' });
    $('#attention-items').innerHTML = alerts.slice(0, 5).map((alert) => `<div class="attention-row"><i class="attention-dot ${alert.tone}"></i><div><b>${escapeHtml(alert.title)}</b><small>${escapeHtml(alert.detail)}</small></div><button class="mini-link" data-go="${alert.view}">${escapeHtml(alert.action)} →</button></div>`).join('');
    $('#alert-total').textContent = `${alerts.length} ${alerts.length === 1 ? 'ITEM' : 'ITEMS'}`;

    const channelCounts = Engine.CHANNELS.map((channel) => ({ channel, count: dayShifts.filter((shift) => shift.channel === channel).length }));
    $('#channel-summary').innerHTML = channelCounts.map((item) => `<div class="channel-row"><span>${escapeHtml(item.channel)}</span><div class="channel-track"><i style="width:${dayShifts.length ? item.count / Math.max(1, ...channelCounts.map((x) => x.count)) * 100 : 0}%"></i></div><b>${item.count}</b></div>`).join('');
    $('#activity-list').innerHTML = state.activity.slice(0, 5).map((item) => `<div class="activity-row"><time>${escapeHtml(item.time)}</time><span>${escapeHtml(item.text)}</span></div>`).join('') || '<div class="empty">No workforce activity recorded.</div>';
    $('#nav-shift-count').textContent = dayShifts.length;
    $('#nav-exception-count').textContent = intraday.exceptions.length;
    $('#nav-exception-count').classList.toggle('alert', intraday.exceptions.length > 0);
    $('#overview-interval-bars').querySelectorAll('[data-time]').forEach((button) => button.addEventListener('click', () => {
      state.simulatedTime = button.dataset.time;
      $('#simulated-time').value = state.simulatedTime;
      save(); renderAll(); showView('intraday');
    }));
    $('#attention-items').querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.go)));
  }

  function renderSchedule() {
    const shifts = selectedDayShifts();
    const counts = { Published: shifts.filter((item) => item.status === 'Published').length, Draft: shifts.filter((item) => item.status !== 'Published').length };
    $('#schedule-total').textContent = shifts.length;
    $('#schedule-published').textContent = counts.Published;
    $('#schedule-draft').textContent = counts.Draft;
    $('#roster-count').textContent = `${shifts.length} ASSIGNMENTS`;
    $('#schedule-publish-state').textContent = shifts.length && counts.Draft === 0 ? 'PUBLISHED' : 'DRAFT PLAN';
    $('#schedule-publish-state').className = `publish-state${shifts.length && counts.Draft === 0 ? ' published' : ''}`;
    $('#schedule-table').innerHTML = shifts.map((shift) => {
      const agent = state.agents.find((item) => item.id === shift.agentId) || { name: 'Unknown agent', team: 'Unassigned' };
      return `<tr><td><div class="agent-identity"><span class="agent-initial">${escapeHtml(agent.name.split(' ').map((v) => v[0]).slice(0, 2).join(''))}</span><span><b>${escapeHtml(agent.name)}</b><small>${escapeHtml(agent.id)}</small></span></div></td><td>${escapeHtml(agent.team)}</td><td><span class="channel-pill">${escapeHtml(shift.channel)}</span></td><td><b>${escapeHtml(shift.start)} – ${escapeHtml(shift.end)}</b></td><td>${escapeHtml(shift.breakStart)} – ${escapeHtml(shift.breakEnd)}</td><td><span class="status-badge ${shift.status.toLowerCase()}">${escapeHtml(shift.status)}</span></td></tr>`;
    }).join('') || '<tr><td colspan="6" class="table-empty">No shifts are assigned to this date.</td></tr>';
    $('#shift-agent').innerHTML = state.agents.map((agent) => `<option value="${escapeHtml(agent.id)}">${escapeHtml(agent.name)} · ${escapeHtml(agent.team)}</option>`).join('');
    updateSkillHint();
  }

  function updateSkillHint() {
    const agent = state.agents.find((item) => item.id === $('#shift-agent').value);
    const selectedChannel = $('#shift-channel').value;
    if (!agent) return;
    $('#shift-skill-hint').textContent = `Skills: ${agent.skills.join(' · ')}. ${agent.skills.includes(selectedChannel) ? 'Selected channel is supported.' : 'Selected channel is not in this agent’s skill profile.'}`;
    $('#shift-skill-hint').classList.toggle('warning', !agent.skills.includes(selectedChannel));
  }

  function renderIntraday() {
    const data = currentIntraday();
    $('#intra-scheduled').textContent = data.scheduled;
    $('#intra-working').textContent = data.working;
    $('#intra-break').textContent = data.onBreak;
    $('#intra-adherence').textContent = `${data.adherence}%`;
    $('#intra-exceptions').textContent = data.exceptions.length;
    $('#simulated-time').value = state.simulatedTime;
    $('#intraday-table').innerHTML = data.roster.map((agent) => `<tr><td><div class="agent-identity"><span class="agent-initial">${escapeHtml(agent.name.split(' ').map((v) => v[0]).slice(0, 2).join(''))}</span><span><b>${escapeHtml(agent.name)}</b><small>${escapeHtml(agent.team)}</small></span></div></td><td><span class="plan-badge ${agent.planned.toLowerCase().replace(/\s/g, '-')}">${escapeHtml(agent.planned)}</span></td><td><select class="status-select" data-agent="${escapeHtml(agent.id)}">${Engine.ACTUAL_STATUSES.map((status) => `<option${agent.actual === status ? ' selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select></td><td><span class="adherence-badge ${agent.adherent ? 'match' : 'mismatch'}">${agent.adherent ? 'MATCH' : 'EXCEPTION'}</span></td><td>${agent.shift ? `${escapeHtml(agent.shift.start)} – ${escapeHtml(agent.shift.end)}` : '—'}</td></tr>`).join('');
    $('#exception-count').textContent = data.exceptions.length;
    $('#exception-list').innerHTML = data.exceptions.map((agent) => `<div class="exception-row"><span class="exception-avatar">${escapeHtml(agent.name.split(' ').map((v) => v[0]).slice(0, 2).join(''))}</span><div><b>${escapeHtml(agent.name)}</b><small>Planned ${escapeHtml(agent.planned)} · actual ${escapeHtml(agent.actual)}</small></div><span class="exception-mark">!</span></div>`).join('') || '<div class="empty-state"><span>✓</span><b>No adherence exceptions</b><small>Agent status aligns with the current simulated plan.</small></div>';
    $$('.status-select').forEach((select) => select.addEventListener('change', () => {
      const result = Engine.updateActualStatus(state, select.dataset.agent, select.value);
      if (result.ok) {
        const agent = state.agents.find((item) => item.id === select.dataset.agent);
        Engine.addActivity(state, `${agent.name} actual status changed to ${select.value}.`, state.simulatedTime);
        save(); renderAll(); toast(`${agent.name}: ${select.value}`);
      } else toast(result.error, true);
    }));
  }

  function renderForecast() {
    const maxRequired = Math.max(1, ...state.forecast.map((row) => Engine.calculateRequiredAgents(row, state.occupancyTarget)));
    $('#forecast-table').innerHTML = state.forecast.map((row) => {
      const coverage = Engine.calculateIntervalCoverage(state, row);
      const stateClass = coverage.gap ? 'under' : coverage.status === 'Over-covered' ? 'over' : 'covered';
      return `<tr class="forecast-row${row.time === state.simulatedTime ? ' selected' : ''}" data-forecast-time="${row.time}"><td><b>${escapeHtml(row.time)}</b></td><td>${row.voice}</td><td>${row.chat}</td><td>${row.email}</td><td>${row.social}</td><td><div class="required-cell"><b>${coverage.required}</b><i><span style="width:${coverage.required / maxRequired * 100}%"></span></i></div></td><td><span class="forecast-status ${stateClass}">${coverage.status === 'Under-covered' ? `${coverage.gap} short` : coverage.status}</span></td></tr>`;
    }).join('');
    $('#forecast-time').innerHTML = state.forecast.map((row) => `<option value="${row.time}">${row.time}</option>`).join('');
    $('#forecast-time').value = state.forecast.some((row) => row.time === state.simulatedTime) ? state.simulatedTime : state.forecast[0].time;
    loadForecastForm();
    $$('#forecast-table tr').forEach((row) => row.addEventListener('click', () => {
      const time = row.dataset.forecastTime;
      $('#forecast-time').value = time;
      loadForecastForm();
    }));
  }

  function loadForecastForm() {
    const row = state.forecast.find((item) => item.time === $('#forecast-time').value);
    if (!row) return;
    $('#forecast-voice').value = row.voice;
    $('#forecast-chat').value = row.chat;
    $('#forecast-email').value = row.email;
    $('#forecast-social').value = row.social;
  }

  function populateTimeOptions() {
    const options = state.forecast.map((row) => `<option value="${row.time}">${row.time}</option>`).join('');
    $('#simulated-time').innerHTML = options;
    $('#forecast-time').innerHTML = options;
  }

  function renderAll() {
    syncDateControls();
    renderOverview();
    renderSchedule();
    renderIntraday();
    renderForecast();
  }

  function changeDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    state.date = value;
    Engine.addActivity(state, `Operating date changed to ${value}.`);
    save(); renderAll();
  }

  $$('.nav-link').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
  $$('[data-go]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.go)));
  $('#mobile-menu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#top-date').addEventListener('change', (event) => changeDate(event.target.value));
  $('#schedule-date').addEventListener('change', (event) => changeDate(event.target.value));
  $('#shift-agent').addEventListener('change', updateSkillHint);
  $('#shift-channel').addEventListener('change', updateSkillHint);
  $('#simulated-time').addEventListener('change', (event) => {
    state.simulatedTime = event.target.value; save(); renderAll();
  });

  $('#shift-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const shift = {
      agentId: $('#shift-agent').value, date: state.date, channel: $('#shift-channel').value,
      start: $('#shift-start').value, end: $('#shift-end').value,
      breakStart: $('#shift-break-start').value, breakEnd: $('#shift-break-end').value
    };
    const result = Engine.addShift(state, shift);
    if (!result.ok) { toast(result.errors.join(' '), true); return; }
    const agent = state.agents.find((item) => item.id === shift.agentId);
    Engine.addActivity(state, `Draft shift added for ${agent.name} (${shift.start}–${shift.end}).`);
    save(); renderAll(); toast(`Draft shift added for ${agent.name}.`);
  });

  $('#publish-schedule').addEventListener('click', () => {
    const result = Engine.publishSchedule(state);
    if (!result.ok) { toast(result.error, true); return; }
    Engine.addActivity(state, `${result.count} shifts published for ${state.date}.`);
    save(); renderAll(); toast(`${result.count} shifts published for ${state.date}.`);
  });

  $('#export-csv').addEventListener('click', () => {
    const csv = Engine.toCsv(state);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `calloria-workforce-${state.date}.csv`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    toast('Daily roster CSV exported.');
  });

  $('#occupancy-target').addEventListener('change', (event) => {
    state.occupancyTarget = Number(event.target.value); save(); renderAll();
    toast(`Occupancy target set to ${Math.round(state.occupancyTarget * 100)}%.`);
  });

  $('#forecast-time').addEventListener('change', loadForecastForm);
  $('#forecast-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const result = Engine.updateForecast(state, $('#forecast-time').value, {
      voice: $('#forecast-voice').value, chat: $('#forecast-chat').value,
      email: $('#forecast-email').value, social: $('#forecast-social').value
    });
    if (!result.ok) { toast(result.error, true); return; }
    Engine.addActivity(state, `Demand forecast updated for ${result.interval.time}.`);
    save(); renderAll(); toast(`Forecast updated for ${result.interval.time}.`);
  });

  populateTimeOptions();
  $('#occupancy-target').value = String(state.occupancyTarget);
  renderAll();
})();
