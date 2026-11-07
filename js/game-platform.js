import { resolveSupabaseConfig } from './cloud-security.js';

const config = resolveSupabaseConfig(import.meta.env || {});
const VISITOR_KEY = 'calloria.public-visitor.v1';
const uuid = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.random() * 16 | 0;
    return (char === 'x' ? random : (random & 0x3 | 0x8)).toString(16);
  });
};

function storedId(storage, key) {
  try {
    if (!storage) return uuid();
    const existing = storage.getItem(key);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const created = uuid();
    storage.setItem(key, created);
    return created;
  } catch {
    return uuid();
  }
}

const safeLocalStorage = (() => { try { return globalThis.localStorage; } catch { return null; } })();
const visitorId = storedId(safeLocalStorage, VISITOR_KEY);
// A new page/game session is created on each page load; visitorId stays stable per browser profile.
const sessionId = uuid();
const deviceCategory = (() => {
  const coarse = globalThis.matchMedia?.('(pointer: coarse)')?.matches || navigator.maxTouchPoints > 0;
  if (!coarse) return 'desktop';
  return Math.min(screen.width || innerWidth, screen.height || innerHeight) >= 700 ? 'tablet' : 'mobile';
})();
const endpoint = config.mode === 'cloud' ? `${config.url}/functions/v1/calloria-game-telemetry` : '';
let heartbeatTimer = null;
let statsTimer = null;
let started = false;
let currentSponsor = null;
let onStatsChange = () => {};

async function invoke(payload, { keepalive = false, timeoutMs = 4500 } = {}) {
  if (!endpoint || !config.key) throw new Error('Public game telemetry is not configured.');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: config.key },
    body: JSON.stringify(payload),
    keepalive,
    signal: AbortSignal.timeout(timeoutMs)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Telemetry request failed (${response.status}).`);
  return data;
}

function numberOrDash(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number.toLocaleString() : '—';
}

function renderStats(stats, error = false) {
  const root = document.getElementById('gameStatsBar');
  if (!root) return;
  if (!stats) {
    root.innerHTML = `<div class="game-stat"><strong>—</strong><span>LIVE PLAYERS</span></div><div class="game-stat"><strong>—</strong><span title="Unique anonymous browser profiles counted by CALLORIA, not verified unique people.">TOTAL PLAYERS*</span></div><div class="game-stat"><strong>—</strong><span>GAME SESSIONS</span></div><div class="game-stat-status">${error ? 'LIVE STATISTICS UNAVAILABLE' : 'CONNECTING TO LIVE STATISTICS'}</div>`;
    return;
  }
  root.innerHTML = `<div class="game-stat"><strong>${numberOrDash(stats.livePlayers)}</strong><span>LIVE PLAYERS</span></div><div class="game-stat"><strong>${numberOrDash(stats.totalPlayers)}</strong><span title="Unique anonymous browser profiles counted by CALLORIA, not verified unique people.">TOTAL PLAYERS*</span></div><div class="game-stat"><strong>${numberOrDash(stats.totalSessions)}</strong><span>GAME SESSIONS</span></div><div class="game-stat-status">LIVE · UPDATED ${new Date(stats.updatedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
}

function renderSponsor(campaign) {
  const slot = document.getElementById('gameSponsorSlot');
  if (!slot) return;
  currentSponsor = campaign || null;
  slot.replaceChildren();
  slot.classList.toggle('has-sponsor', Boolean(campaign));
  const label = document.createElement('span');
  label.className = 'sponsor-label';
  label.textContent = campaign ? `SPONSORED · ${campaign.advertiser_name}` : 'BRAND PARTNERSHIPS';
  const headline = document.createElement('strong');
  headline.textContent = campaign?.creative_headline || 'Company placements inside the CALLORIA world';
  const detail = document.createElement('small');
  detail.textContent = campaign?.creative_text || 'Approved companies can sponsor in-world billboards, departments and training scenarios. No campaign is currently scheduled.';
  slot.append(label, headline, detail);
  if (campaign?.image_url) {
    const image = document.createElement('img');
    image.src = campaign.image_url;
    image.alt = `${campaign.advertiser_name} campaign artwork`;
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => image.remove(), { once: true });
    slot.prepend(image);
  }
  if (campaign?.destination_url && /^https:\/\//i.test(campaign.destination_url)) {
    const link = document.createElement('a');
    link.href = campaign.destination_url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer sponsored nofollow';
    link.textContent = 'LEARN MORE ↗';
    link.addEventListener('click', () => { void recordSponsorEvent('click'); });
    slot.append(link);
  }
  if (campaign?.id) void recordSponsorEvent('impression');
}

async function recordSponsorEvent(eventType) {
  if (!currentSponsor?.id) return;
  try {
    await invoke({ action: 'sponsor-event', visitorId, sessionId, campaignId: currentSponsor.id, eventType });
  } catch (error) {
    console.warn('CALLORIA sponsor event was not recorded:', error.message);
  }
}

async function refreshStats() {
  try {
    const result = await invoke({ action: 'stats' });
    renderStats(result.stats || null, false);
    renderSponsor(result.sponsor || null);
    onStatsChange(result.stats || null);
    return result.stats || null;
  } catch (error) {
    renderStats(null, true);
    console.info('CALLORIA live statistics are unavailable until migration 004 and the telemetry Edge Function are deployed.', error.message);
    return null;
  }
}

function presence(presenceAction, options = {}) {
  return invoke({ action: 'presence', presenceAction, visitorId, sessionId, deviceCategory }, options).catch(error => {
    console.info(`CALLORIA ${presenceAction} presence was not recorded:`, error.message);
  });
}

export function refreshPublicGameStats() {
  if (!endpoint || !config.key) { renderStats(null, true); renderSponsor(null); return Promise.resolve(null); }
  return refreshStats();
}

export function startPublicGameServices({ onStats = () => {} } = {}) {
  onStatsChange = onStats;
  renderStats(null, false);
  if (started || !endpoint || !config.key) {
    renderStats(null, !endpoint);
    renderSponsor(null);
    return { enabled: false, refreshStats };
  }
  started = true;
  void presence('start').then(() => refreshStats());
  heartbeatTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void presence('heartbeat');
  }, 60_000);
  statsTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void refreshStats();
  }, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void presence('heartbeat');
      void refreshStats();
    }
  });
  window.addEventListener('pagehide', () => {
    void presence('end', { keepalive: true, timeoutMs: 1800 });
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (statsTimer) clearInterval(statsTimer);
  }, { once: true });
  return { enabled: true, refreshStats };
}

export function getPublicGameSession() {
  return { visitorId, sessionId, deviceCategory };
}
