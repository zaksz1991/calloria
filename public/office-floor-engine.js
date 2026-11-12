(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CalloriaOfficeFloorEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '6.3.0';
  const FLOOR_STORAGE_KEY = 'calloria.live-floor.v60';
  const CAREER_STORAGE_KEY = 'calloria.career-progression.v61';

  const ASSET_CATALOG = Object.freeze({
    desk: Object.freeze([
      '/assets/models/office/desks/office_desk/model.glb',
      '/assets/models/office/desks/office_desk/office_desk.glb',
      '/assets/models/office/desks/office_desk.glb',
      '/assets/models/office/desks/office_desk/scene.gltf'
    ]),
    computer: Object.freeze([
      '/assets/models/office/equipment/office_computer/model.glb',
      '/assets/models/office/equipment/office_computer/office_computer.glb',
      '/assets/models/office/equipment/office_computer.glb',
      '/assets/models/office/equipment/office_computer/scene.gltf'
    ]),
    agentFemale: Object.freeze([
      '/assets/models/characters/agents/female-agent/model.glb',
      '/assets/models/characters/female-agent/model.glb',
      '/assets/models/characters/female-agent/female-agent.glb',
      '/assets/models/characters/agents/female-agent.glb',
      '/assets/models/characters/agents/archeologist_girl/model.glb',
      '/assets/models/characters/gp5woman/model.glb',
      '/assets/models/characters/office_lady_character/model.glb',
      '/assets/models/characters/office_lady_character/office_lady_character.glb'
    ]),
    agentMale: Object.freeze([
      '/assets/models/characters/agents/male-agent/model.glb',
      '/assets/models/characters/male-agent/model.glb',
      '/assets/models/characters/male-agent/male-agent.glb',
      '/assets/models/characters/agents/male-agent.glb',
      '/assets/models/characters/mr-r/model.glb',
      '/assets/models/characters/mr-r/mr-r.glb'
    ]),
    supervisor: Object.freeze([
      '/assets/models/supervisors/office_female/model.glb',
      '/assets/models/supervisors/office_female/office_female.glb',
      '/assets/models/supervisors/office_female.glb',
      '/assets/models/supervisors/the_bad_supervisor/model.glb',
      '/assets/models/supervisors/the_bad_supervisor/the_bad_supervisor.glb'
    ]),
    receptionDesk: Object.freeze([
      '/assets/models/office/reception/reception-desk/model.glb',
      '/assets/models/office/reception/reception-desk/reception-desk.glb',
      '/assets/models/office/reception/reception-desk.glb',
      '/assets/models/office/reception/reception-desk/scene.gltf'
    ]),
    receptionist: Object.freeze([
      '/assets/models/receptionists/lady_in_a_trenchcoat/model.glb',
      '/assets/models/receptionists/lady_in_a_trenchcoat/lady_in_a_trenchcoat.glb',
      '/assets/models/receptionists/lady_in_a_trenchcoat.glb',
      '/assets/models/receptionists/lady_in_a_trenchcoat/scene.gltf'
    ])
  });

  const STATIONS = Object.freeze([
    Object.freeze({ id: 'CC-01', name: 'Customer Care', team: 'Customer Care', channel: 'Voice & General', x: -7.2, z: -1.8, role: 'Frontline agent', model: 'agentFemale' }),
    Object.freeze({ id: 'DS-02', name: 'Digital Support', team: 'Digital Support', channel: 'Email & Live Chat', x: -2.4, z: -1.8, role: 'Digital agent', model: 'agentMale' }),
    Object.freeze({ id: 'PS-03', name: 'Product Support', team: 'Technical Support', channel: 'Product & Technical', x: 2.4, z: -1.8, role: 'Product specialist', model: 'agentFemale' }),
    Object.freeze({ id: 'SR-04', name: 'Service Recovery', team: 'Service Recovery', channel: 'Complaints & Escalations', x: 7.2, z: -1.8, role: 'Recovery specialist', model: 'agentMale' })
  ]);

  const ACTIVITIES = Object.freeze([
    Object.freeze({ id: 'reception', name: 'Staff Reception', kind: 'reception', x: -14.0, z: 8.2, action: 'Clock in and confirm your assigned team before starting the shift.' }),
    Object.freeze({ id: 'briefing-room', name: 'Team Briefing Room', kind: 'briefing', x: -12.8, z: -8.3, action: 'Attend scheduled product and service updates with your team.' }),
    Object.freeze({ id: 'staff-lounge', name: 'Staff Lounge', kind: 'break', x: 12.8, z: 8.2, action: 'Take the scheduled morning or lunch break.' }),
    Object.freeze({ id: 'supervisor-hub', name: 'Supervisor Hub', kind: 'supervisor', x: 13.0, z: -8.2, action: 'Request guidance, escalation support or help with a floor issue.' })
  ]);

  const RANKS = Object.freeze([
    { name: 'New Starter', minXp: 0 },
    { name: 'Customer Care Associate', minXp: 300 },
    { name: 'Skilled Associate', minXp: 750 },
    { name: 'Senior Associate', minXp: 1500 },
    { name: 'Product Support Specialist', minXp: 2500 },
    { name: 'Senior Specialist', minXp: 3800 },
    { name: 'Team Lead Candidate', minXp: 5400 },
    { name: 'Leadership Ready', minXp: 7200 }
  ]);

  function safeJson(storage, key) {
    if (!storage || typeof storage.getItem !== 'function') return null;
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function clean(value, maxLength = 100) {
    return String(value == null ? '' : value)
      .replace(/[<>]/g, '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
  }

  function profileKey(agentName, team) {
    const part = (value, fallback) => clean(value || fallback, 80).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || fallback;
    return `${part(agentName, 'agent-trainee')}::${part(team, 'customer-care')}`;
  }

  function getRank(xp) {
    const total = Math.max(0, Number(xp) || 0);
    let current = RANKS[0];
    let next = null;
    for (const rank of RANKS) {
      if (total >= rank.minXp) current = rank;
      else { next = rank; break; }
    }
    return { current, next, totalXp: total, xpToNext: next ? next.minXp - total : 0 };
  }

  function getFloorSnapshot(storage) {
    const floor = safeJson(storage, FLOOR_STORAGE_KEY);
    const career = safeJson(storage, CAREER_STORAGE_KEY);
    if (!floor || typeof floor !== 'object' || !floor.shift) {
      return {
        installed: false,
        status: 'Not signed in',
        agentName: '',
        team: '',
        clock: '07:30',
        contacts: 0,
        rank: 'New Starter',
        xp: 0,
        activeContact: false
      };
    }
    const shift = floor.shift || {};
    const agentName = clean(shift.agentName, 100);
    const team = clean(shift.team, 100);
    const metrics = floor.metrics || {};
    const profile = career && career.profiles && career.profiles[profileKey(agentName, team)];
    const rank = getRank(profile && profile.totalXp);
    const minutes = Math.max(0, Math.min(1439, Number(shift.minutes) || 450));
    const clock = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    return {
      installed: true,
      status: clean(shift.status || 'Off duty', 40),
      agentName,
      team,
      clock,
      contacts: Math.max(0, Number(metrics.completed) || 0),
      rank: rank.current.name,
      xp: rank.totalXp,
      activeContact: !!floor.active,
      date: clean(shift.date || '', 20)
    };
  }

  function distanceXZ(a, b) {
    const dx = (Number(a && a.x) || 0) - (Number(b && b.x) || 0);
    const dz = (Number(a && a.z) || 0) - (Number(b && b.z) || 0);
    return Math.sqrt(dx * dx + dz * dz);
  }

  function nearestPoint(points, position, maxDistance = 2.8) {
    if (!Array.isArray(points) || !position) return null;
    let nearest = null;
    let bestDistance = Number(maxDistance);
    for (const point of points) {
      const distance = distanceXZ(point, position);
      if (distance <= bestDistance) {
        bestDistance = distance;
        nearest = { ...point, distance: Math.round(distance * 100) / 100 };
      }
    }
    return nearest;
  }

  function nearestStation(stations, position, maxDistance = 2.8) {
    if (!Array.isArray(stations) || !position) return null;
    let nearest = null;
    let bestDistance = Number(maxDistance);
    for (const station of stations) {
      const distance = distanceXZ(station, position);
      if (distance <= bestDistance) {
        bestDistance = distance;
        nearest = { ...station, distance: Math.round(distance * 100) / 100 };
      }
    }
    return nearest;
  }

  function stationIsUsable(assetStatus) {
    const loaded = (entry) => typeof entry === 'boolean' ? entry : !!(entry && entry.loaded);
    return !!(assetStatus && loaded(assetStatus.desk) && loaded(assetStatus.computer));
  }

  function getAssetPaths(role) {
    return Array.isArray(ASSET_CATALOG[role]) ? [...ASSET_CATALOG[role]] : [];
  }

  function assetSummary(status) {
    const entries = Object.entries(status || {});
    const loaded = entries.filter(([, value]) => value && value.loaded).length;
    return { loaded, total: entries.length, complete: entries.length > 0 && loaded === entries.length };
  }

  return Object.freeze({
    VERSION,
    FLOOR_STORAGE_KEY,
    CAREER_STORAGE_KEY,
    ASSET_CATALOG,
    STATIONS,
    ACTIVITIES,
    RANKS,
    clean,
    profileKey,
    getRank,
    getFloorSnapshot,
    distanceXZ,
    nearestStation,
    nearestPoint,
    stationIsUsable,
    getAssetPaths,
    assetSummary
  });
});
