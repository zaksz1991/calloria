(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CalloriaOfficeRoutineEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '6.3.0';
  const STORAGE_KEY = 'calloria.office-routine.v63';
  const LAST_IDENTITY_KEY = 'calloria.office-routine.last-identity.v63';
  const EVENT_KIND = Object.freeze({
    morningBriefing: 'briefing',
    afternoonBriefing: 'briefing',
    morningBreak: 'break',
    lunchBreak: 'break'
  });
  const REQUEST_TYPES = Object.freeze([
    'Customer escalation',
    'Policy or knowledge guidance',
    'System or workstation issue',
    'Customer safety or vulnerability',
    'Queue or workload support'
  ]);

  function clean(value, max = 100) {
    return String(value == null ? '' : value)
      .replace(/[<>]/g, '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  }

  function localDate(value) {
    const date = value instanceof Date ? value : new Date(value == null ? Date.now() : value);
    if (Number.isNaN(date.getTime())) throw new Error('A valid local date is required.');
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function identityParts(identity, fallbackDate) {
    const name = clean(identity && identity.name, 80);
    const team = clean(identity && identity.team, 80);
    const dateValue = identity && identity.date ? identity.date : fallbackDate instanceof Date ? localDate(fallbackDate) : (fallbackDate || localDate());
    const date = clean(dateValue, 10);
    if (!name || !team) throw new Error('Employee name and assigned team are required.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('The shift date is invalid.');
    return { name, team, date };
  }

  function profileKey(identity) {
    const part = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'employee';
    return `${identity.date}::${part(identity.name)}::${part(identity.team)}`;
  }

  function emptyStore() {
    return { version: VERSION, profiles: {}, lastIdentity: null };
  }

  function load(storage) {
    if (!storage || typeof storage.getItem !== 'function') return emptyStore();
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
      if (!parsed || typeof parsed !== 'object' || !parsed.profiles || typeof parsed.profiles !== 'object') return emptyStore();
      return { version: VERSION, profiles: parsed.profiles, lastIdentity: parsed.lastIdentity || null };
    } catch (_) {
      return emptyStore();
    }
  }

  function save(storage, state) {
    if (!storage || typeof storage.setItem !== 'function') return false;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({
        version: VERSION,
        profiles: state && state.profiles && typeof state.profiles === 'object' ? state.profiles : {},
        lastIdentity: state && state.lastIdentity ? state.lastIdentity : null
      }));
      if (state && state.lastIdentity) storage.setItem(LAST_IDENTITY_KEY, JSON.stringify(state.lastIdentity));
      return true;
    } catch (_) { return false; }
  }

  function findProfile(state, identity) {
    return state && state.profiles ? state.profiles[profileKey(identity)] || null : null;
  }

  function getLastIdentity(storage, at) {
    if (!storage || typeof storage.getItem !== 'function') return null;
    try {
      const raw = storage.getItem(LAST_IDENTITY_KEY);
      if (!raw) return null;
      const identity = JSON.parse(raw);
      if (!identity || !identity.name || !identity.team) return null;
      const date = localDate(at || new Date());
      return identity.date === date ? { name: clean(identity.name, 80), team: clean(identity.team, 80), date } : null;
    } catch (_) { return null; }
  }

  function getProfile(storage, identity) {
    const state = load(storage);
    const parts = identityParts(identity, identity && identity.date);
    return findProfile(state, parts);
  }

  function isClockedIn(storage, identity) {
    const profile = getProfile(storage, identity);
    return !!(profile && profile.clockInAt && !profile.clockOutAt);
  }

  function clockIn(storage, identity, at) {
    const now = at instanceof Date ? at : new Date(at == null ? Date.now() : at);
    const parts = identityParts(identity, now);
    const state = load(storage);
    const key = profileKey(parts);
    const existing = state.profiles[key];
    if (existing && existing.clockInAt && !existing.clockOutAt) throw new Error('You are already clocked in for this shift.');
    if (existing && existing.clockOutAt) throw new Error('A shift has already been closed for this employee today.');
    const profile = {
      key,
      date: parts.date,
      employeeName: parts.name,
      team: parts.team,
      clockInAt: now.toISOString(),
      clockOutAt: null,
      legacy: false,
      events: {},
      supervisorRequests: []
    };
    state.profiles[key] = profile;
    state.lastIdentity = { name: parts.name, team: parts.team, date: parts.date };
    if (!save(storage, state)) throw new Error('Browser storage could not save your staff check-in.');
    return profile;
  }

  function importExistingShift(storage, identity, startedAt) {
    const parts = identityParts(identity, identity && identity.date);
    const state = load(storage);
    const key = profileKey(parts);
    if (state.profiles[key]) return state.profiles[key];
    const started = startedAt instanceof Date ? startedAt : new Date(startedAt || `${parts.date}T07:30:00`);
    const profile = {
      key,
      date: parts.date,
      employeeName: parts.name,
      team: parts.team,
      clockInAt: Number.isNaN(started.getTime()) ? new Date().toISOString() : started.toISOString(),
      clockOutAt: null,
      legacy: true,
      events: {},
      supervisorRequests: []
    };
    state.profiles[key] = profile;
    state.lastIdentity = { name: parts.name, team: parts.team, date: parts.date };
    if (!save(storage, state)) throw new Error('Browser storage could not save the existing shift record.');
    return profile;
  }

  function validateShiftStart(storage, identity, at) {
    const parts = identityParts(identity, at || new Date());
    return isClockedIn(storage, parts);
  }

  function attendEvent(storage, identity, eventId, dueEvent, at) {
    const now = at instanceof Date ? at : new Date(at == null ? Date.now() : at);
    const parts = identityParts(identity, identity && identity.date || now);
    const expectedKind = EVENT_KIND[eventId];
    if (!expectedKind) throw new Error('This scheduled event cannot be completed at the office activity point.');
    if (!dueEvent || dueEvent.id !== eventId || dueEvent.type !== expectedKind) throw new Error('That briefing or break is not currently due.');
    const state = load(storage);
    const profile = findProfile(state, parts);
    if (!profile || !profile.clockInAt || profile.clockOutAt) throw new Error('Clock in at Staff Reception before attending shift activities.');
    const previous = profile.events[eventId];
    if (previous && previous.attendedAt) throw new Error('This activity has already been recorded.');
    profile.events[eventId] = { attendedAt: now.toISOString(), consumedAt: null };
    if (!save(storage, state)) throw new Error('Browser storage could not save this activity.');
    return profile.events[eventId];
  }

  function hasEventToken(storage, identity, eventId) {
    try {
      const parts = identityParts(identity, identity && identity.date);
      const profile = findProfile(load(storage), parts);
      const token = profile && profile.events && profile.events[eventId];
      return !!(token && token.attendedAt && !token.consumedAt);
    } catch (_) { return false; }
  }

  function consumeEventToken(storage, identity, eventId, at) {
    const now = at instanceof Date ? at : new Date(at == null ? Date.now() : at);
    const parts = identityParts(identity, identity && identity.date || now);
    const state = load(storage);
    const profile = findProfile(state, parts);
    const token = profile && profile.events && profile.events[eventId];
    if (!token || !token.attendedAt || token.consumedAt) return false;
    token.consumedAt = now.toISOString();
    return save(storage, state);
  }

  function clockOut(storage, identity, at, shiftEnded) {
    if (shiftEnded !== true) throw new Error('Finish the customer shift before clocking out at reception.');
    const now = at instanceof Date ? at : new Date(at == null ? Date.now() : at);
    const parts = identityParts(identity, identity && identity.date || now);
    const state = load(storage);
    const profile = findProfile(state, parts);
    if (!profile || !profile.clockInAt || profile.clockOutAt) throw new Error('There is no open staff attendance record to close.');
    profile.clockOutAt = now.toISOString();
    if (!save(storage, state)) throw new Error('Browser storage could not save your clock-out record.');
    return profile;
  }

  function requestSupervisor(storage, identity, requestType, note, at, shiftActive) {
    if (shiftActive !== true) throw new Error('Supervisor assistance is available during an active shift.');
    const type = clean(requestType, 80);
    if (!REQUEST_TYPES.includes(type)) throw new Error('Choose a valid supervisor assistance category.');
    const text = clean(note, 400);
    if (!text) throw new Error('Add a short description so the supervisor knows what support is needed.');
    const now = at instanceof Date ? at : new Date(at == null ? Date.now() : at);
    const parts = identityParts(identity, identity && identity.date || now);
    const state = load(storage);
    const profile = findProfile(state, parts);
    if (!profile || !profile.clockInAt || profile.clockOutAt) throw new Error('Clock in before requesting floor support.');
    const request = {
      id: `SUP-${parts.date.replace(/-/g, '')}-${String(profile.supervisorRequests.length + 1).padStart(3, '0')}`,
      type,
      note: text,
      requestedAt: now.toISOString(),
      status: 'Requested'
    };
    profile.supervisorRequests.push(request);
    if (!save(storage, state)) throw new Error('Browser storage could not save the supervisor request.');
    return request;
  }

  function getAttendanceStatus(storage, identity) {
    const profile = getProfile(storage, identity);
    if (!profile || !profile.clockInAt) return 'Not clocked in';
    return profile.clockOutAt ? 'Clocked out' : 'Clocked in';
  }

  return Object.freeze({
    VERSION,
    STORAGE_KEY,
    LAST_IDENTITY_KEY,
    EVENT_KIND,
    REQUEST_TYPES,
    clean,
    localDate,
    identityParts,
    profileKey,
    load,
    save,
    getProfile,
    getLastIdentity,
    isClockedIn,
    getAttendanceStatus,
    clockIn,
    importExistingShift,
    validateShiftStart,
    attendEvent,
    hasEventToken,
    consumeEventToken,
    clockOut,
    requestSupervisor
  });
});
