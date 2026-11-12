(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CalloriaCareerProgressionEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 61;
  const STORAGE_KEY = 'calloria.career-progression.v61';
  const RANKS = Object.freeze([
    { id: 'new-starter', name: 'New Starter', minXp: 0, description: 'Learning the floor routine and core customer-care workflow.' },
    { id: 'associate', name: 'Customer Care Associate', minXp: 300, description: 'Building dependable customer-care habits across channels.' },
    { id: 'skilled-associate', name: 'Skilled Associate', minXp: 750, description: 'Handling varied service enquiries with consistent quality.' },
    { id: 'senior-associate', name: 'Senior Associate', minXp: 1500, description: 'Demonstrating reliable service judgement and case ownership.' },
    { id: 'product-specialist', name: 'Product Support Specialist', minXp: 2500, description: 'Applying product knowledge across multiple RuffNeck services.' },
    { id: 'senior-specialist', name: 'Senior Specialist', minXp: 3800, description: 'Sustaining strong quality, safe handling and customer outcomes.' },
    { id: 'team-lead-candidate', name: 'Team Lead Candidate', minXp: 5400, description: 'Ready to build formal leadership and coaching evidence.' },
    { id: 'leadership-ready', name: 'Leadership Ready', minXp: 7200, description: 'A gameplay milestone; formal appointment still requires assessment.' }
  ]);
  const BADGES = Object.freeze([
    { id: 'first-contact', name: 'First Contact', description: 'Completed your first customer interaction.', bonusXp: 40 },
    { id: 'five-contacts', name: 'Five Served', description: 'Completed five customer interactions across your shifts.', bonusXp: 50 },
    { id: 'quality-standard', name: 'Quality Standard', description: 'Scored at least 85% QA on a shift with three or more contacts.', bonusXp: 50 },
    { id: 'customer-champion', name: 'Customer Champion', description: 'Reached average simulated CSAT of 4.2/5 on a shift with three or more contacts.', bonusXp: 50 },
    { id: 'knowledge-seeker', name: 'Knowledge Seeker', description: 'Used approved knowledge guidance in five customer interactions.', bonusXp: 40 },
    { id: 'safe-handling', name: 'Safe Handling', description: 'Completed at least three contacts in a shift without a critical compliance breach.', bonusXp: 50 },
    { id: 'floor-routine', name: 'Floor Discipline', description: 'Attended both briefings and completed both scheduled breaks.', bonusXp: 30 },
    { id: 'fcr-specialist', name: 'First-Contact Resolver', description: 'Achieved at least 70% FCR on a shift with five or more contacts.', bonusXp: 50 }
  ]);

  function clean(value, max = 100) {
    return String(value == null ? '' : value).replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
  function keyPart(value, fallback) {
    const part = clean(value || fallback, 80).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return part || fallback.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }
  function profileKey(agentName, team) { return `${keyPart(agentName, 'agent-trainee')}::${keyPart(team, 'customer-care')}`; }
  function defaultProfile(agentName, team) {
    return {
      agentName: clean(agentName || 'Agent Trainee'), team: clean(team || 'Customer Care'),
      totalXp: 0, totalContacts: 0, totalShifts: 0, totalKnowledgeUses: 0,
      badges: [], processedShiftIds: [], shiftHistory: [], lastAward: null
    };
  }
  function createInitialState() { return { version: VERSION, profiles: {}, updatedAt: null }; }
  function normaliseProfile(raw, agentName, team) {
    const fresh = defaultProfile(agentName, team);
    if (!raw || typeof raw !== 'object') return fresh;
    return {
      ...fresh, ...raw,
      agentName: clean(raw.agentName || agentName || fresh.agentName),
      team: clean(raw.team || team || fresh.team),
      totalXp: Math.max(0, Math.floor(Number(raw.totalXp) || 0)),
      totalContacts: Math.max(0, Math.floor(Number(raw.totalContacts) || 0)),
      totalShifts: Math.max(0, Math.floor(Number(raw.totalShifts) || 0)),
      totalKnowledgeUses: Math.max(0, Math.floor(Number(raw.totalKnowledgeUses) || 0)),
      badges: Array.isArray(raw.badges) ? raw.badges.filter((item) => item && typeof item.id === 'string') : [],
      processedShiftIds: Array.isArray(raw.processedShiftIds) ? raw.processedShiftIds.map(String) : [],
      shiftHistory: Array.isArray(raw.shiftHistory) ? raw.shiftHistory.slice(0, 100) : [],
      lastAward: raw.lastAward && typeof raw.lastAward === 'object' ? raw.lastAward : null
    };
  }
  function normaliseState(raw) {
    if (!raw || typeof raw !== 'object') return createInitialState();
    const profiles = {};
    if (raw.profiles && typeof raw.profiles === 'object' && !Array.isArray(raw.profiles)) {
      Object.entries(raw.profiles).forEach(([key, value]) => { profiles[key] = normaliseProfile(value, value && value.agentName, value && value.team); });
    }
    return { version: VERSION, profiles, updatedAt: raw.updatedAt || null };
  }
  function load(storage) {
    if (!storage || typeof storage.getItem !== 'function') return createInitialState();
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return createInitialState();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== VERSION) return createInitialState();
      return normaliseState(parsed);
    } catch (_) { return createInitialState(); }
  }
  function save(state, storage) {
    if (!storage || typeof storage.setItem !== 'function') return false;
    try {
      state.version = VERSION;
      state.updatedAt = new Date().toISOString();
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (_) { return false; }
  }
  function getProfile(state, agentName, team) {
    const safe = state && typeof state === 'object' ? state : createInitialState();
    safe.profiles = safe.profiles && typeof safe.profiles === 'object' ? safe.profiles : {};
    const key = profileKey(agentName, team);
    safe.profiles[key] = normaliseProfile(safe.profiles[key], agentName, team);
    return safe.profiles[key];
  }
  function rankForXp(totalXp) {
    const xp = Math.max(0, Number(totalXp) || 0);
    let current = RANKS[0], next = null;
    for (let i = 0; i < RANKS.length; i += 1) {
      if (xp >= RANKS[i].minXp) current = RANKS[i];
      else { next = RANKS[i]; break; }
    }
    const progressXp = xp - current.minXp;
    const neededXp = next ? next.minXp - current.minXp : 0;
    return {
      current, next, progressXp, neededXp,
      progressPct: next ? clamp(Math.round(progressXp / neededXp * 100), 0, 100) : 100,
      xpToNext: next ? Math.max(0, next.minXp - xp) : 0
    };
  }
  function shiftIdentity(shift) {
    const item = shift || {};
    return [
      clean(item.date || 'unknown-date', 20),
      keyPart(item.agentName, 'agent-trainee'), keyPart(item.team, 'customer-care'),
      clean(item.startedAt || 'legacy-start', 50), clean(item.endedAt || 'legacy-end', 50)
    ].join('|');
  }
  function reportForCurrentShift(floorState) {
    const completed = Array.isArray(floorState.completedContacts) ? floorState.completedContacts.length : 0;
    const metrics = floorState.metrics || {};
    const averageQa = completed ? Math.round((Number(metrics.qaTotal) || 0) / completed) : 0;
    const averageCsat = completed ? Math.round((Number(metrics.csatTotal) || 0) / completed * 10) / 10 : 0;
    const fcr = completed ? Math.round((Number(metrics.fcr) || 0) / completed * 100) : 0;
    const breaches = Number(metrics.complianceBreaches) || 0;
    const knowledge = Number(metrics.knowledgeUses) || 0;
    const score = completed ? Math.round((((Number(metrics.qaTotal) || 0) / completed) * 0.45) + (((Number(metrics.csatTotal) || 0) / completed) * 20 * 0.35) + (((Number(metrics.fcr) || 0) / completed) * 100 * 0.2) - (breaches * 10)) : 0;
    const events = floorState.events || {};
    return {
      completed, averageQa, averageCsat, fcrRate: fcr, complianceBreaches: breaches,
      knowledgeUses: knowledge,
      score: clamp(score, 0, 100),
      attendedMorningBriefing: !!events.morningBriefing,
      attendedAfternoonBriefing: !!events.afternoonBriefing,
      attendedBreaks: !!(events.morningBreak && events.lunchBreak)
    };
  }
  function calculateShiftXp(report) {
    const source = report || {};
    const completed = Math.max(0, Math.floor(Number(source.completed) || 0));
    const breaches = Math.max(0, Math.floor(Number(source.complianceBreaches) || 0));
    if (completed < 1) return { xp: 0, reason: 'No completed customer contacts; no career XP awarded.' };
    if (breaches > 0) return { xp: 0, reason: 'A critical compliance breach blocked career XP for this shift.' };
    const base = Math.min(180, completed * 12);
    const service = Math.round(clamp(source.score, 0, 100) * 0.45);
    const knowledge = Number(source.knowledgeUses) > 0 ? 10 : 0;
    const briefings = source.attendedMorningBriefing && source.attendedAfternoonBriefing ? 10 : 0;
    const breaks = source.attendedBreaks ? 5 : 0;
    return { xp: Math.min(250, base + service + knowledge + briefings + breaks), reason: 'Career XP earned from completed contacts, service results and shift discipline.' };
  }
  function unlockBadge(profile, badgeId, date, newlyUnlocked) {
    if (profile.badges.some((item) => item.id === badgeId)) return 0;
    const badge = BADGES.find((item) => item.id === badgeId);
    if (!badge) return 0;
    const record = { id: badge.id, name: badge.name, description: badge.description, bonusXp: badge.bonusXp, unlockedAt: date || null };
    profile.badges.push(record);
    newlyUnlocked.push(record);
    return badge.bonusXp;
  }
  function awardShift(profile, shift) {
    const report = shift.report || {};
    const completed = Math.max(0, Math.floor(Number(report.completed) || 0));
    const breaches = Math.max(0, Math.floor(Number(report.complianceBreaches) || 0));
    const baseAward = calculateShiftXp(report);
    const before = rankForXp(profile.totalXp).current;
    profile.totalShifts += 1;
    profile.totalContacts += completed;
    profile.totalKnowledgeUses += Math.max(0, Math.floor(Number(report.knowledgeUses) || 0));
    const unlocked = [];
    let bonusXp = 0;
    if (completed > 0 && breaches === 0) {
      bonusXp += unlockBadge(profile, 'first-contact', shift.date, unlocked);
      if (profile.totalContacts >= 5) bonusXp += unlockBadge(profile, 'five-contacts', shift.date, unlocked);
      if (completed >= 3 && Number(report.averageQa) >= 85) bonusXp += unlockBadge(profile, 'quality-standard', shift.date, unlocked);
      if (completed >= 3 && Number(report.averageCsat) >= 4.2) bonusXp += unlockBadge(profile, 'customer-champion', shift.date, unlocked);
      if (profile.totalKnowledgeUses >= 5) bonusXp += unlockBadge(profile, 'knowledge-seeker', shift.date, unlocked);
      if (completed >= 3) bonusXp += unlockBadge(profile, 'safe-handling', shift.date, unlocked);
      if (report.attendedMorningBriefing && report.attendedAfternoonBriefing && report.attendedBreaks) bonusXp += unlockBadge(profile, 'floor-routine', shift.date, unlocked);
      if (completed >= 5 && Number(report.fcrRate) >= 70) bonusXp += unlockBadge(profile, 'fcr-specialist', shift.date, unlocked);
    }
    const earnedXp = baseAward.xp + bonusXp;
    profile.totalXp += earnedXp;
    const after = rankForXp(profile.totalXp).current;
    const award = {
      shiftId: shiftIdentity(shift), date: shift.date || null,
      agentName: profile.agentName, team: profile.team,
      completed, earnedXp, baseXp: baseAward.xp, badgeBonusXp: bonusXp,
      reason: baseAward.reason,
      unlockedBadges: unlocked,
      rankBefore: before.name, rankAfter: after.name,
      rankUp: before.id !== after.id,
      totalXp: profile.totalXp
    };
    profile.processedShiftIds.push(award.shiftId);
    if (profile.processedShiftIds.length > 400) profile.processedShiftIds = profile.processedShiftIds.slice(-400);
    profile.shiftHistory.unshift(award);
    profile.shiftHistory = profile.shiftHistory.slice(0, 100);
    profile.lastAward = award;
    return award;
  }
  function syncFromFloor(state, floorState) {
    const target = state && typeof state === 'object' ? state : createInitialState();
    const floor = floorState && typeof floorState === 'object' ? floorState : {};
    const candidates = (Array.isArray(floor.pastShifts) ? floor.pastShifts : []).map((item) => ({ ...item, report: item.report || {} }));
    if (floor.shift && floor.shift.status === 'Ended') {
      candidates.push({
        date: floor.shift.date, agentName: floor.shift.agentName, team: floor.shift.team,
        startedAt: floor.shift.startedAt, endedAt: floor.shift.endedAt,
        report: reportForCurrentShift(floor)
      });
    }
    candidates.sort((a, b) => String(a.endedAt || a.date || '').localeCompare(String(b.endedAt || b.date || '')));
    const awarded = [];
    candidates.forEach((shift) => {
      const agentName = clean(shift.agentName || 'Agent Trainee');
      const team = clean(shift.team || 'Customer Care');
      const profile = getProfile(target, agentName, team);
      const id = shiftIdentity(shift);
      if (profile.processedShiftIds.includes(id)) return;
      const award = awardShift(profile, { ...shift, agentName, team });
      awarded.push(award);
    });
    return { imported: awarded.length, awards: awarded, latestAward: awarded[awarded.length - 1] || null };
  }
  function getSummary(state, agentName, team) {
    const profile = getProfile(state, agentName, team);
    const rank = rankForXp(profile.totalXp);
    return {
      agentName: profile.agentName, team: profile.team,
      totalXp: profile.totalXp, totalContacts: profile.totalContacts,
      totalShifts: profile.totalShifts, totalKnowledgeUses: profile.totalKnowledgeUses,
      badges: profile.badges.slice().sort((a, b) => String(a.unlockedAt || '').localeCompare(String(b.unlockedAt || ''))),
      lastAward: profile.lastAward,
      rank: rank.current, nextRank: rank.next,
      progressXp: rank.progressXp, neededXp: rank.neededXp,
      progressPct: rank.progressPct, xpToNext: rank.xpToNext
    };
  }
  function getShiftObjectives(floorState) {
    const floor = floorState || {};
    const active = floor.shift && floor.shift.status === 'On shift';
    const metrics = floor.metrics || {};
    const count = Number(metrics.completed) || 0;
    const qa = count ? Math.round((Number(metrics.qaTotal) || 0) / count) : 0;
    const knowledge = Number(metrics.knowledgeUses) || 0;
    const breaches = Number(metrics.complianceBreaches) || 0;
    const events = floor.events || {};
    const objectives = [
      { id: 'contacts', label: 'Complete 3 customer contacts', done: count >= 3, blocked: false, detail: `${count}/3 completed` },
      { id: 'quality', label: 'Maintain at least 85% average QA', done: count >= 3 && qa >= 85, blocked: count >= 3 && qa < 85, detail: count < 3 ? 'Available after 3 contacts' : `${qa}% average QA` },
      { id: 'knowledge', label: 'Use approved knowledge guidance', done: knowledge >= 1, blocked: false, detail: `${knowledge} references used` },
      { id: 'safety', label: 'Finish without a critical compliance breach', done: breaches === 0 && count >= 3, blocked: breaches > 0, detail: breaches ? `${breaches} critical breach recorded` : 'No critical breach recorded' },
      { id: 'briefings', label: 'Attend both daily briefings', done: !!events.morningBriefing && !!events.afternoonBriefing, blocked: false, detail: `${events.morningBriefing ? 'Morning done' : 'Morning pending'} · ${events.afternoonBriefing ? 'Afternoon done' : 'Afternoon pending'}` },
      { id: 'breaks', label: 'Complete both scheduled breaks', done: !!events.morningBreak && !!events.lunchBreak, blocked: false, detail: `${events.morningBreak ? 'Morning break done' : 'Morning break pending'} · ${events.lunchBreak ? 'Lunch pending'.replace('pending', 'due') : 'Lunch pending'}` }
    ];
    return objectives.map((item) => ({ ...item, status: item.done ? 'Complete' : item.blocked ? 'Blocked' : active ? 'In progress' : 'Not active' }));
  }

  return {
    VERSION, STORAGE_KEY, RANKS, BADGES,
    clean, clamp, profileKey, createInitialState, normaliseState, load, save,
    getProfile, rankForXp, shiftIdentity, calculateShiftXp, syncFromFloor,
    getSummary, getShiftObjectives, reportForCurrentShift
  };
});
