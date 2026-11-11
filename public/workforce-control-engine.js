(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CalloriaWorkforceEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'calloria.workforce-control.v48';
  const VERSION = 48;
  const INTERVAL_MINUTES = 30;
  const CHANNELS = ['Voice', 'Live chat', 'Email', 'Social'];
  const WORKING_STATUSES = ['Available', 'On contact', 'Wrap-up'];
  const ACTUAL_STATUSES = ['Available', 'On contact', 'Wrap-up', 'Break', 'Lunch', 'Training', 'Offline'];
  const AHT_SECONDS = { Voice: 360, 'Live chat': 240, Email: 300, Social: 270 };

  const seedAgents = [
    { id: 'ag-104', name: 'Amina Yusuf', team: 'General CX', skills: ['Voice', 'Email'], supervisor: 'Maryam Bello' },
    { id: 'ag-108', name: 'Daniel Okafor', team: 'Retail Support', skills: ['Voice', 'Live chat'], supervisor: 'Maryam Bello' },
    { id: 'ag-112', name: 'Chiamaka Nwosu', team: 'Telecom Care', skills: ['Live chat', 'Social'], supervisor: 'Samuel Garba' },
    { id: 'ag-119', name: 'Ibrahim Musa', team: 'General CX', skills: ['Voice', 'Email'], supervisor: 'Samuel Garba' },
    { id: 'ag-123', name: 'Fatima Abdullahi', team: 'Utilities Desk', skills: ['Voice', 'Live chat'], supervisor: 'Maryam Bello' },
    { id: 'ag-127', name: 'Yusuf Sani', team: 'General CX', skills: ['Email', 'Social'], supervisor: 'Samuel Garba' },
    { id: 'ag-131', name: 'Ngozi Eze', team: 'Retail Support', skills: ['Voice', 'Live chat', 'Email'], supervisor: 'Maryam Bello' },
    { id: 'ag-136', name: 'Musa Bello', team: 'Telecom Care', skills: ['Voice', 'Social'], supervisor: 'Samuel Garba' }
  ];

  const seedShifts = [
    { id: 'sh-1001', agentId: 'ag-104', date: '2026-11-11', channel: 'Voice', start: '08:00', end: '16:00', breakStart: '10:30', breakEnd: '10:45', status: 'Published' },
    { id: 'sh-1002', agentId: 'ag-108', date: '2026-11-11', channel: 'Live chat', start: '08:00', end: '16:00', breakStart: '10:45', breakEnd: '11:00', status: 'Published' },
    { id: 'sh-1003', agentId: 'ag-112', date: '2026-11-11', channel: 'Live chat', start: '09:00', end: '17:00', breakStart: '11:00', breakEnd: '11:15', status: 'Published' },
    { id: 'sh-1004', agentId: 'ag-119', date: '2026-11-11', channel: 'Voice', start: '09:00', end: '17:00', breakStart: '10:15', breakEnd: '10:30', status: 'Published' },
    { id: 'sh-1005', agentId: 'ag-123', date: '2026-11-11', channel: 'Voice', start: '10:00', end: '18:00', breakStart: '12:30', breakEnd: '12:45', status: 'Published' },
    { id: 'sh-1006', agentId: 'ag-127', date: '2026-11-11', channel: 'Email', start: '08:00', end: '16:00', breakStart: '11:30', breakEnd: '11:45', status: 'Published' },
    { id: 'sh-1007', agentId: 'ag-131', date: '2026-11-11', channel: 'Voice', start: '09:00', end: '17:00', breakStart: '13:00', breakEnd: '13:15', status: 'Published' },
    { id: 'sh-1008', agentId: 'ag-136', date: '2026-11-11', channel: 'Social', start: '12:00', end: '20:00', breakStart: '15:00', breakEnd: '15:15', status: 'Draft' }
  ];

  const seedForecast = [
    { time: '08:00', voice: 7, chat: 8, email: 6, social: 2 },
    { time: '08:30', voice: 8, chat: 10, email: 7, social: 3 },
    { time: '09:00', voice: 10, chat: 11, email: 8, social: 3 },
    { time: '09:30', voice: 11, chat: 12, email: 9, social: 4 },
    { time: '10:00', voice: 12, chat: 13, email: 9, social: 4 },
    { time: '10:30', voice: 13, chat: 14, email: 10, social: 4 },
    { time: '11:00', voice: 12, chat: 13, email: 10, social: 4 },
    { time: '11:30', voice: 11, chat: 12, email: 9, social: 3 },
    { time: '12:00', voice: 9, chat: 10, email: 8, social: 3 },
    { time: '12:30', voice: 8, chat: 9, email: 7, social: 3 },
    { time: '13:00', voice: 9, chat: 10, email: 8, social: 3 },
    { time: '13:30', voice: 10, chat: 11, email: 8, social: 3 },
    { time: '14:00', voice: 12, chat: 13, email: 9, social: 4 },
    { time: '14:30', voice: 13, chat: 14, email: 10, social: 4 },
    { time: '15:00', voice: 12, chat: 13, email: 9, social: 4 },
    { time: '15:30', voice: 10, chat: 11, email: 8, social: 3 }
  ];

  const seedActual = {
    'ag-104': 'Available', 'ag-108': 'On contact', 'ag-112': 'Available', 'ag-119': 'Wrap-up',
    'ag-123': 'Available', 'ag-127': 'On contact', 'ag-131': 'Available', 'ag-136': 'Offline'
  };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function timeToMinutes(value) {
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN;
    const parts = value.split(':').map(Number);
    return parts[0] * 60 + parts[1];
  }
  function minutesToTime(minutes) {
    const safe = Math.max(0, Math.min(1439, Math.round(minutes)));
    return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
  }
  function createInitialState(date) {
    const today = new Date();
    const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : localToday;
    return {
      version: VERSION,
      date: selectedDate,
      simulatedTime: '10:30',
      occupancyTarget: 0.82,
      agents: clone(seedAgents),
      shifts: clone(seedShifts).map((shift) => ({ ...shift, date: selectedDate })),
      forecast: clone(seedForecast),
      actualStates: clone(seedActual),
      activity: [
        { id: 'wf-act-1', time: '10:19', text: 'Intraday review flagged a planned break overlap in the voice queue.' },
        { id: 'wf-act-2', time: '09:45', text: 'Retail Support demand uplift reviewed by the duty supervisor.' },
        { id: 'wf-act-3', time: '08:00', text: 'Morning staffing plan opened for the day.' }
      ],
      publishedAt: '08:00'
    };
  }

  function getShiftForAgent(state, agentId, date) {
    return (state.shifts || []).find((shift) => shift.agentId === agentId && shift.date === (date || state.date)) || null;
  }

  function getPlannedStatus(shift, time) {
    if (!shift) return 'Off duty';
    const now = timeToMinutes(time);
    const start = timeToMinutes(shift.start);
    const end = timeToMinutes(shift.end);
    const breakStart = timeToMinutes(shift.breakStart);
    const breakEnd = timeToMinutes(shift.breakEnd);
    if ([now, start, end].some(Number.isNaN)) return 'Off duty';
    if (now < start || now >= end) return 'Off duty';
    if (Number.isFinite(breakStart) && Number.isFinite(breakEnd) && now >= breakStart && now < breakEnd) return 'Break';
    return 'Working';
  }

  function isWorkingStatus(status) { return WORKING_STATUSES.includes(status); }
  function isAdherent(planned, actual) {
    if (planned === 'Working') return isWorkingStatus(actual);
    if (planned === 'Break') return actual === 'Break';
    return actual === 'Offline' || actual === 'Off duty';
  }

  function calculateRequiredAgents(interval, occupancyTarget) {
    const target = Number.isFinite(Number(occupancyTarget)) ? Math.max(0.5, Math.min(0.95, Number(occupancyTarget))) : 0.82;
    const workloadSeconds = (Number(interval.voice) || 0) * AHT_SECONDS.Voice
      + (Number(interval.chat) || 0) * AHT_SECONDS['Live chat']
      + (Number(interval.email) || 0) * AHT_SECONDS.Email
      + (Number(interval.social) || 0) * AHT_SECONDS.Social;
    const availableSeconds = INTERVAL_MINUTES * 60 * target;
    return Math.ceil(workloadSeconds / availableSeconds);
  }

  function calculateIntervalCoverage(state, intervalOrTime) {
    const interval = typeof intervalOrTime === 'string'
      ? (state.forecast || []).find((item) => item.time === intervalOrTime)
      : intervalOrTime;
    if (!interval) return { required: 0, scheduled: 0, available: 0, gap: 0, status: 'No forecast' };
    const required = calculateRequiredAgents(interval, state.occupancyTarget);
    const time = interval.time;
    const scheduledAgents = (state.agents || []).filter((agent) => getPlannedStatus(getShiftForAgent(state, agent.id), time) !== 'Off duty');
    const availableAgents = scheduledAgents.filter((agent) => getPlannedStatus(getShiftForAgent(state, agent.id), time) !== 'Break');
    const scheduled = scheduledAgents.length;
    const available = availableAgents.length;
    const gap = Math.max(0, required - available);
    return { required, scheduled, available, gap, status: gap > 0 ? 'Under-covered' : available > required + 2 ? 'Over-covered' : 'Covered' };
  }

  function deriveIntraday(state, time) {
    const selectedTime = time || state.simulatedTime;
    const roster = (state.agents || []).map((agent) => {
      const shift = getShiftForAgent(state, agent.id);
      const planned = getPlannedStatus(shift, selectedTime);
      const actual = state.actualStates && state.actualStates[agent.id] || 'Offline';
      return { ...agent, shift, planned, actual, adherent: isAdherent(planned, actual) };
    });
    const scheduled = roster.filter((agent) => agent.planned !== 'Off duty').length;
    const working = roster.filter((agent) => agent.planned === 'Working').length;
    const onBreak = roster.filter((agent) => agent.planned === 'Break').length;
    const adherent = roster.filter((agent) => agent.adherent).length;
    const adherence = roster.length ? Math.round((adherent / roster.length) * 100) : 100;
    const interval = (state.forecast || []).find((item) => item.time === selectedTime);
    const coverage = calculateIntervalCoverage(state, interval);
    const exceptions = roster.filter((agent) => !agent.adherent);
    return { time: selectedTime, roster, scheduled, working, onBreak, adherence, exceptions, coverage };
  }

  function validateShift(input, shifts, agents) {
    const errors = [];
    if (!input || !input.agentId || !input.date || !input.channel) errors.push('Agent, date and channel are required.');
    const agent = (agents || seedAgents).find((item) => item.id === input.agentId);
    if (!agent) errors.push('The selected agent does not exist in the roster.');
    if (input && !CHANNELS.includes(input.channel)) errors.push('Choose a supported contact channel.');
    if (agent && input && !agent.skills.includes(input.channel)) errors.push(`${agent.name} is not marked as skilled for ${input.channel}.`);
    const start = timeToMinutes(input && input.start);
    const end = timeToMinutes(input && input.end);
    const breakStart = timeToMinutes(input && input.breakStart);
    const breakEnd = timeToMinutes(input && input.breakEnd);
    if (![start, end, breakStart, breakEnd].every(Number.isFinite)) errors.push('Shift and break times must use valid 24-hour times.');
    if ([start, end].every(Number.isFinite)) {
      const duration = end - start;
      if (duration < 60 || duration > 720) errors.push('A shift must be between 1 and 12 hours and cannot cross midnight.');
      if ([breakStart, breakEnd].every(Number.isFinite) && (breakStart < start || breakEnd > end || breakEnd <= breakStart)) errors.push('The break must sit inside the shift and end after it starts.');
      if ([breakStart, breakEnd].every(Number.isFinite) && breakEnd - breakStart < 15) errors.push('The planned break must be at least 15 minutes.');
      if (duration > 360 && [breakStart, breakEnd].every(Number.isFinite) && breakEnd - breakStart > 60) errors.push('A single planned break cannot exceed 60 minutes.');
    }
    (shifts || []).filter((shift) => shift.agentId === (input && input.agentId) && shift.date === (input && input.date) && shift.id !== input.id).forEach((shift) => {
      const existingStart = timeToMinutes(shift.start);
      const existingEnd = timeToMinutes(shift.end);
      if ([start, end, existingStart, existingEnd].every(Number.isFinite) && start < existingEnd && end > existingStart) errors.push('This agent already has an overlapping shift on that date.');
    });
    return { valid: errors.length === 0, errors };
  }

  function addShift(state, input) {
    const validation = validateShift(input, state.shifts, state.agents);
    if (!validation.valid) return { ok: false, errors: validation.errors };
    const shift = { ...input, id: input.id || `sh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, status: 'Draft' };
    state.shifts.push(shift);
    return { ok: true, shift };
  }

  function updateActualStatus(state, agentId, status) {
    if (!(state.agents || []).some((agent) => agent.id === agentId)) return { ok: false, error: 'Agent not found.' };
    if (!ACTUAL_STATUSES.includes(status)) return { ok: false, error: 'Unsupported agent status.' };
    state.actualStates[agentId] = status;
    return { ok: true, agentId, status };
  }

  function updateForecast(state, time, values) {
    const row = (state.forecast || []).find((item) => item.time === time);
    if (!row) return { ok: false, error: 'Forecast interval not found.' };
    for (const key of ['voice', 'chat', 'email', 'social']) {
      if (values[key] === undefined) continue;
      const value = Number(values[key]);
      if (!Number.isInteger(value) || value < 0 || value > 500) return { ok: false, error: `The ${key} forecast must be a whole number from 0 to 500.` };
      row[key] = value;
    }
    return { ok: true, interval: row };
  }

  function publishSchedule(state) {
    const dayShifts = state.shifts.filter((shift) => shift.date === state.date);
    if (!dayShifts.length) return { ok: false, error: 'There are no shifts to publish for this date.' };
    dayShifts.forEach((shift) => { shift.status = 'Published'; });
    state.publishedAt = new Date().toISOString();
    return { ok: true, count: dayShifts.length };
  }

  function addActivity(state, text, time) {
    state.activity.unshift({ id: `wf-act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: String(text) });
    state.activity = state.activity.slice(0, 30);
  }

  function loadState(storage) {
    const source = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!source) return createInitialState();
    try {
      const raw = source.getItem(STORAGE_KEY);
      if (!raw) return createInitialState();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.agents) || !Array.isArray(parsed.shifts) || !Array.isArray(parsed.forecast)) return createInitialState();
      return {
        ...createInitialState(parsed.date),
        ...parsed,
        actualStates: parsed.actualStates && typeof parsed.actualStates === 'object' ? parsed.actualStates : clone(seedActual),
        activity: Array.isArray(parsed.activity) ? parsed.activity : []
      };
    } catch (_) { return createInitialState(); }
  }

  function saveState(state, storage) {
    const target = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!target) return false;
    try { target.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
    catch (_) { return false; }
  }

  function toCsv(state) {
    const rows = [['Date', 'Agent ID', 'Agent', 'Team', 'Channel', 'Start', 'End', 'Break start', 'Break end', 'Status']];
    state.shifts.filter((shift) => shift.date === state.date).forEach((shift) => {
      const agent = state.agents.find((item) => item.id === shift.agentId) || {};
      rows.push([shift.date, shift.agentId, agent.name || '', agent.team || '', shift.channel, shift.start, shift.end, shift.breakStart, shift.breakEnd, shift.status]);
    });
    return rows.map((row) => row.map((value) => `"${String(value == null ? '' : value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  }

  return {
    STORAGE_KEY, VERSION, INTERVAL_MINUTES, CHANNELS, ACTUAL_STATUSES, AHT_SECONDS,
    createInitialState, timeToMinutes, minutesToTime, getPlannedStatus, calculateRequiredAgents,
    calculateIntervalCoverage, deriveIntraday, validateShift, addShift, updateActualStatus,
    updateForecast, publishSchedule, addActivity, loadState, saveState, toCsv
  };
});
