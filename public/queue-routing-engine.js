(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CalloriaQueueRoutingEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '6.8.0';
  const STORAGE_KEY = 'calloria.queue-routing.v68';
  const CHANNELS = ['Voice', 'Email', 'Live chat', 'Social', 'SMS', 'In-app'];
  const PRODUCTS = [
    { id: 'general', name: 'General customer care' },
    { id: 'ruffneck-lms', name: 'RuffNeck LMS' },
    { id: 'ruffneck-prospector', name: 'RuffNeck Prospector' },
    { id: 'ruffneck-connect', name: 'RuffNeck Connect' },
    { id: 'ruffneck-social-hub', name: 'RuffNeck Social Hub' },
    { id: 'kano-run', name: 'Kano Run' },
    { id: 'kano-keke', name: 'Kano Keke' }
  ];
  const LEVELS = Object.freeze({ 1: 'Basic', 2: 'Working', 3: 'Advanced' });
  const TEAM_PRESETS = {
    'Customer Care': { channels: { Voice: 3, Email: 2, 'Live chat': 2, Social: 2, SMS: 2, 'In-app': 2 }, products: { general: 3 } },
    'Digital Support': { channels: { Voice: 1, Email: 3, 'Live chat': 3, Social: 3, SMS: 3, 'In-app': 3 }, products: {} },
    'Player Support': { channels: { Voice: 2, Email: 2, 'Live chat': 3, Social: 2, SMS: 2, 'In-app': 3 }, products: { 'kano-run': 3, 'kano-keke': 3 } },
    'Technical Support': { channels: { Voice: 2, Email: 3, 'Live chat': 3, Social: 2, SMS: 2, 'In-app': 3 }, products: { 'ruffneck-lms': 3, 'ruffneck-prospector': 3, 'ruffneck-connect': 3, 'ruffneck-social-hub': 3 } },
    'Service Recovery': { channels: { Voice: 3, Email: 3, 'Live chat': 3, Social: 2, SMS: 3, 'In-app': 2 }, products: {} },
    'General Enquiries': { channels: {}, products: { general: 3 } }
  };

  function clean(value, max = 120) {
    return String(value == null ? '' : value).replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function identityKey(identity) {
    const name = clean(identity && identity.name || 'Agent Trainee', 80).toLowerCase();
    const team = clean(identity && identity.team || 'Customer Care', 80).toLowerCase();
    return `${name}::${team}`;
  }
  function createDefaultProfile(identity) {
    const team = clean(identity && identity.team || 'Customer Care', 80);
    const preset = TEAM_PRESETS[team] || TEAM_PRESETS['General Enquiries'];
    const channelSkills = {};
    const productSkills = {};
    CHANNELS.forEach((channel) => { channelSkills[channel] = Number(preset.channels[channel]) || 2; });
    PRODUCTS.forEach((product) => { productSkills[product.id] = Number(preset.products[product.id]) || 2; });
    return { version: VERSION, team, channelSkills, productSkills, updatedAt: null };
  }
  function normaliseProfile(raw, identity) {
    const fallback = createDefaultProfile(identity);
    if (!raw || typeof raw !== 'object') return fallback;
    const channelSkills = {};
    const productSkills = {};
    CHANNELS.forEach((channel) => {
      const value = Number(raw.channelSkills && raw.channelSkills[channel]);
      channelSkills[channel] = Number.isInteger(value) && value >= 1 && value <= 3 ? value : fallback.channelSkills[channel];
    });
    PRODUCTS.forEach((product) => {
      const value = Number(raw.productSkills && raw.productSkills[product.id]);
      productSkills[product.id] = Number.isInteger(value) && value >= 1 && value <= 3 ? value : fallback.productSkills[product.id];
    });
    return { version: VERSION, team: clean(identity && identity.team || raw.team || fallback.team, 80), channelSkills, productSkills, updatedAt: raw.updatedAt || null };
  }
  function loadProfiles(storage) {
    if (!storage || typeof storage.getItem !== 'function') return {};
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
      return parsed && parsed.version === VERSION && parsed.profiles && typeof parsed.profiles === 'object' ? parsed.profiles : {};
    } catch (_) { return {}; }
  }
  function loadProfile(storage, identity) {
    const profiles = loadProfiles(storage);
    return normaliseProfile(profiles[identityKey(identity)], identity);
  }
  function saveProfile(storage, identity, profile, at) {
    if (!storage || typeof storage.setItem !== 'function') return false;
    const profiles = loadProfiles(storage);
    profiles[identityKey(identity)] = { ...normaliseProfile(profile, identity), updatedAt: (at instanceof Date ? at : new Date(at || Date.now())).toISOString() };
    try { storage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, profiles })); return true; }
    catch (_) { return false; }
  }
  function updateSkill(profile, kind, id, value) {
    const level = Number(value);
    if (![1, 2, 3].includes(level)) throw new Error('Choose a valid skill level.');
    const next = normaliseProfile(profile, { team: profile && profile.team });
    if (kind === 'channel' && CHANNELS.includes(id)) next.channelSkills[id] = level;
    else if (kind === 'product' && PRODUCTS.some((item) => item.id === id)) next.productSkills[id] = level;
    else throw new Error('Choose a valid channel or product skill.');
    return next;
  }
  function priorityRank(priority) {
    const match = String(priority || '').match(/^P([1-4])/i);
    return match ? Number(match[1]) : 4;
  }
  function scoreContact(contact, profile, now) {
    const current = now instanceof Date ? now : new Date(now || Date.now());
    const created = new Date(contact && contact.createdAt || current);
    const due = new Date(contact && contact.slaDueAt || current);
    const waitingMinutes = Number.isFinite(created.getTime()) ? Math.max(0, (current.getTime() - created.getTime()) / 60000) : 0;
    const slaRemainingMinutes = Number.isFinite(due.getTime()) ? (due.getTime() - current.getTime()) / 60000 : Infinity;
    const slaState = slaRemainingMinutes <= 0 ? 'BREACHED' : slaRemainingMinutes <= 15 ? 'DUE SOON' : slaRemainingMinutes <= 60 ? 'AT RISK' : 'WITHIN SLA';
    const priority = priorityRank(contact && contact.priority);
    const priorityPoints = ({ 1: 1000, 2: 700, 3: 400, 4: 100 })[priority];
    const slaPoints = slaRemainingMinutes <= 0 ? 320 + Math.min(120, Math.abs(slaRemainingMinutes))
      : slaRemainingMinutes <= 15 ? 270
        : slaRemainingMinutes <= 30 ? 220
          : slaRemainingMinutes <= 60 ? 160
            : slaRemainingMinutes <= 240 ? 80 : 20;
    const agePoints = Math.min(100, Math.floor(waitingMinutes / 3));
    const channelSkill = Number(profile && profile.channelSkills && profile.channelSkills[contact && contact.channel]) || 1;
    const productSkill = Number(profile && profile.productSkills && profile.productSkills[contact && contact.productId]) || 1;
    const skillPoints = channelSkill * 12 + productSkill * 10;
    const score = priorityPoints + slaPoints + agePoints + skillPoints;
    const reasons = [];
    if (priority === 1) reasons.push('Urgent P1 priority');
    else if (priority === 2) reasons.push('High P2 priority');
    if (slaState === 'BREACHED') reasons.push('response target already breached');
    else if (slaState === 'DUE SOON') reasons.push('response target due within 15 minutes');
    else if (slaState === 'AT RISK') reasons.push('response target due within one hour');
    if (channelSkill === 3) reasons.push(`advanced ${contact.channel} skill match`);
    if (productSkill === 3) reasons.push(`advanced ${PRODUCTS.find((item) => item.id === contact.productId)?.name || 'product'} knowledge`);
    if (!reasons.length) reasons.push('balanced priority, waiting time and skill fit');
    return {
      id: contact.id, score, priority, priorityPoints, slaPoints, agePoints, skillPoints,
      channelSkill, productSkill, skillMatch: channelSkill >= 2 && productSkill >= 2,
      skillFitPct: Math.round(((channelSkill + productSkill) / 6) * 100),
      waitingMinutes: Math.round(waitingMinutes), slaRemainingMinutes: Number.isFinite(slaRemainingMinutes) ? Math.round(slaRemainingMinutes) : null,
      slaState, reasons, reason: reasons.slice(0, 3).join(' · ')
    };
  }
  function sortEntries(entries, mode) {
    if (mode === 'oldest') return entries.sort((a, b) => b.waitingMinutes - a.waitingMinutes || a.priority - b.priority);
    if (mode === 'priority') return entries.sort((a, b) => a.priority - b.priority || a.slaRemainingMinutes - b.slaRemainingMinutes || b.waitingMinutes - a.waitingMinutes);
    return entries.sort((a, b) => b.score - a.score || b.waitingMinutes - a.waitingMinutes || a.priority - b.priority);
  }
  function routeQueue(contacts, profile, options) {
    const opts = options || {};
    const now = opts.now instanceof Date ? opts.now : new Date(opts.now || Date.now());
    const mode = ['smart', 'oldest', 'priority'].includes(opts.mode) ? opts.mode : 'smart';
    const ranked = (Array.isArray(contacts) ? contacts : []).filter((contact) => contact && contact.status === 'Queued')
      .map((contact) => ({ contact, ...scoreContact(contact, profile, now) }));
    return sortEntries(ranked, mode);
  }
  function findRoute(contacts, profile, contactId, options) {
    return routeQueue(contacts, profile, options).find((item) => item.id === contactId) || null;
  }
  function formatSla(route) {
    if (!route) return 'SLA unavailable';
    if (route.slaState === 'BREACHED') return `${Math.abs(route.slaRemainingMinutes || 0)}m overdue`;
    return `${route.slaRemainingMinutes == null ? '—' : route.slaRemainingMinutes + 'm'} remaining`;
  }

  return Object.freeze({
    VERSION, STORAGE_KEY, CHANNELS, PRODUCTS, LEVELS, TEAM_PRESETS,
    clean, identityKey, createDefaultProfile, normaliseProfile, loadProfiles, loadProfile, saveProfile, updateSkill,
    priorityRank, scoreContact, routeQueue, findRoute, formatSla
  });
});
