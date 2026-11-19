/**
 * CALLORIA v6.82 — non-obstructive runtime GLB health panel.
 * It reports real loader attempts emitted by the v6.81 path resolver and the
 * final staff/office integration summary. It never fabricates a successful load.
 */
const PANEL_ID = 'calloria-glb-health-panel-v682';
const BUTTON_ID = 'calloria-glb-health-toggle-v682';
const STYLE_ID = 'calloria-glb-health-style-v682';
const MAX_ATTEMPTS = 40;

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function listOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

export function summarizeCalloriaGLBHealth(status = {}, attempts = []) {
  const attemptList = listOrEmpty(attempts);
  const failedPaths = attemptList.filter((item) => item?.status === 'failed').length;
  const loadedPaths = attemptList.filter((item) => item?.status === 'loaded').length;
  const loadingPaths = attemptList.filter((item) => item?.status === 'loading').length;
  const staffLoaded = numberOrZero(status.staffLoaded ?? status.loaded);
  const officePlaced = numberOrZero(status.officePlaced ?? status.placed);
  const staffFallback = numberOrZero(status.fallback);
  const staffFailed = numberOrZero(status.staffFailed ?? status.failed);
  const officeErrors = listOrEmpty(status.officeErrors ?? status.errors);
  const staffErrors = listOrEmpty(status.staffErrors);
  const declaredProblems = staffFailed + officeErrors.length + staffErrors.length;

  return {
    staffLoaded,
    staffFallback,
    officePlaced,
    staffFailed,
    officeErrorCount: officeErrors.length,
    staffErrorCount: staffErrors.length,
    failedPaths,
    loadedPaths,
    loadingPaths,
    declaredProblems,
    totalAttempts: attemptList.length,
    worldReady: Boolean(status.worldReady ?? status.ready),
    tier: String(status.tier || 'unknown'),
  };
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function statusClass(status) {
  if (status === 'loaded') return 'is-loaded';
  if (status === 'loading') return 'is-loading';
  return 'is-failed';
}

function renderAttempt(item) {
  const title = item.assetName || item.assetId || item.kind || 'GLB asset';
  const message = item.message ? `<p class="calloria-glb-error">${escapeHTML(item.message)}</p>` : '';
  return `<article class="calloria-glb-attempt">
    <div class="calloria-glb-attempt-head">
      <strong>${escapeHTML(title)}</strong>
      <span class="calloria-glb-badge ${statusClass(item.status)}">${escapeHTML(item.status || 'unknown')}</span>
    </div>
    <div class="calloria-glb-meta">${escapeHTML(item.kind || 'asset')} · ${escapeHTML(item.path || item.url || 'path unavailable')}</div>
    ${message}
  </article>`;
}

function styleText() {
  return `
    #${BUTTON_ID}, #${PANEL_ID}, #${PANEL_ID} * { box-sizing: border-box; }
    #${BUTTON_ID} {
      position: fixed; z-index: 9998;
      top: calc(env(safe-area-inset-top, 0px) + 12px); left: 12px;
      min-height: 38px; padding: 8px 12px;
      border: 1px solid rgba(98,220,207,.52); border-radius: 999px;
      background: rgba(5,24,34,.92); color: #dffbf5;
      box-shadow: 0 5px 18px rgba(0,0,0,.22);
      font: 800 10px/1.1 system-ui,sans-serif; letter-spacing: .09em;
      cursor: pointer; touch-action: manipulation;
    }
    #${BUTTON_ID}:focus-visible, #${PANEL_ID} button:focus-visible, #${PANEL_ID} a:focus-visible {
      outline: 3px solid #76e4d0; outline-offset: 3px;
    }
    #${PANEL_ID} {
      position: fixed; z-index: 9999;
      top: calc(env(safe-area-inset-top, 0px) + 58px); left: 12px;
      width: min(390px, calc(100vw - 24px));
      max-height: min(68dvh, 620px); overflow: hidden;
      color: #e9f4f4; background: rgba(5,19,29,.97);
      border: 1px solid rgba(105,204,195,.48); border-radius: 15px;
      box-shadow: 0 18px 48px rgba(0,0,0,.38);
      font: 12px/1.45 system-ui,sans-serif;
    }
    #${PANEL_ID}[hidden] { display: none !important; }
    #${PANEL_ID} .calloria-glb-head {
      display:flex; align-items:flex-start; justify-content:space-between; gap:12px;
      padding:13px 14px; border-bottom:1px solid rgba(160,205,210,.16);
    }
    #${PANEL_ID} h2 { margin:0; font-size:13px; letter-spacing:.05em; }
    #${PANEL_ID} .calloria-glb-sub { margin:4px 0 0; color:#a8c1c6; font-size:10px; }
    #${PANEL_ID} .calloria-glb-close {
      min-width:34px; min-height:34px; border:1px solid rgba(180,220,220,.24);
      border-radius:9px; background:#122b36; color:#fff; font-size:18px; cursor:pointer;
    }
    #${PANEL_ID} .calloria-glb-content { overflow:auto; max-height:calc(min(68dvh, 620px) - 62px); overscroll-behavior:contain; }
    #${PANEL_ID} .calloria-glb-summary {
      display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; padding:10px 12px;
    }
    #${PANEL_ID} .calloria-glb-stat {
      min-width:0; padding:9px; border:1px solid rgba(160,205,210,.16);
      border-radius:10px; background:rgba(255,255,255,.035);
    }
    #${PANEL_ID} .calloria-glb-value { display:block; font-size:20px; line-height:1.1; font-weight:850; color:#fff; }
    #${PANEL_ID} .calloria-glb-label { display:block; margin-top:4px; color:#a8c1c6; font-size:9px; text-transform:uppercase; letter-spacing:.06em; }
    #${PANEL_ID} .calloria-glb-notice { margin:0 12px 10px; padding:9px 10px; border-radius:9px; background:rgba(217,155,66,.11); border:1px solid rgba(217,155,66,.3); color:#f2d6a5; }
    #${PANEL_ID} .calloria-glb-section { margin:0; padding:10px 12px 6px; border-top:1px solid rgba(160,205,210,.16); color:#c7e2df; font-size:10px; letter-spacing:.08em; text-transform:uppercase; }
    #${PANEL_ID} .calloria-glb-list { padding:0 12px 12px; }
    #${PANEL_ID} .calloria-glb-attempt { padding:9px 0; border-bottom:1px solid rgba(160,205,210,.12); overflow-wrap:anywhere; }
    #${PANEL_ID} .calloria-glb-attempt-head { display:flex; justify-content:space-between; gap:8px; align-items:center; }
    #${PANEL_ID} .calloria-glb-attempt-head strong { font-size:11px; }
    #${PANEL_ID} .calloria-glb-badge { flex:0 0 auto; padding:3px 7px; border-radius:99px; font-size:9px; font-weight:800; text-transform:uppercase; }
    #${PANEL_ID} .is-loaded { background:rgba(45,190,127,.16); color:#8ce8b8; }
    #${PANEL_ID} .is-loading { background:rgba(226,177,74,.16); color:#f4d38b; }
    #${PANEL_ID} .is-failed { background:rgba(220,98,98,.16); color:#ffaaaa; }
    #${PANEL_ID} .calloria-glb-meta { margin-top:4px; color:#96b1b7; font-size:10px; }
    #${PANEL_ID} .calloria-glb-error { margin:5px 0 0; color:#ffc0ad; font-size:10px; }
    #${PANEL_ID} .calloria-glb-empty { padding:12px 0; color:#9db7bd; }
    #${PANEL_ID} .calloria-glb-footer { padding:10px 12px; border-top:1px solid rgba(160,205,210,.16); color:#88a5ac; font-size:10px; }
    #${PANEL_ID} .calloria-glb-footer a { color:#8be2d5; }
    @media (max-width: 520px) {
      #${BUTTON_ID} { min-height:36px; padding:8px 10px; font-size:9px; }
      #${PANEL_ID} { width:calc(100vw - 24px); max-height:68dvh; }
      #${PANEL_ID} .calloria-glb-content { max-height:calc(68dvh - 62px); }
      #${PANEL_ID} .calloria-glb-value { font-size:18px; }
    }
  `;
}

export function createCalloriaGLBHealthPanel({ tier = 'unknown' } = {}) {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { update() {}, dispose() {} };
  }

  document.getElementById(BUTTON_ID)?.remove();
  document.getElementById(PANEL_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();

  const state = {
    status: { tier, worldReady: false },
    attempts: [],
    expanded: false,
    lastUpdated: null,
  };

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = styleText();
  document.head.appendChild(style);

  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.type = 'button';
  button.textContent = '3D ASSET STATUS';
  button.setAttribute('aria-controls', PANEL_ID);
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', 'Open 3D asset loading status');

  const panel = document.createElement('section');
  panel.id = PANEL_ID;
  panel.hidden = true;
  panel.setAttribute('aria-label', 'CALLORIA 3D asset loading status');
  panel.setAttribute('aria-live', 'polite');
  document.body.append(button, panel);

  function render() {
    const summary = summarizeCalloriaGLBHealth(state.status, state.attempts);
    const warning = !summary.worldReady
      ? 'The workplace asset integration has not reported completion yet.'
      : summary.staffLoaded === 0 && summary.officePlaced === 0
        ? 'The integration completed but placed no GLB staff or office objects. Review the attempted file paths below.'
        : summary.declaredProblems || summary.failedPaths
          ? 'Some asset paths or model integrations failed. The details below show what the browser actually attempted.'
          : '';
    const attempts = [...state.attempts].slice(-18).reverse();
    panel.innerHTML = `
      <header class="calloria-glb-head">
        <div><h2>3D ASSET LOADING REPORT</h2><p class="calloria-glb-sub">Live browser attempts · ${escapeHTML(summary.tier)} graphics tier · ${escapeHTML(state.lastUpdated || 'waiting')}</p></div>
        <button class="calloria-glb-close" type="button" data-close aria-label="Close report">×</button>
      </header>
      <div class="calloria-glb-content">
        <div class="calloria-glb-summary">
          <div class="calloria-glb-stat"><span class="calloria-glb-value">${summary.staffLoaded}</span><span class="calloria-glb-label">Staff GLBs loaded</span></div>
          <div class="calloria-glb-stat"><span class="calloria-glb-value">${summary.officePlaced}</span><span class="calloria-glb-label">Office objects placed</span></div>
          <div class="calloria-glb-stat"><span class="calloria-glb-value">${summary.staffFallback}</span><span class="calloria-glb-label">Local staff fallbacks</span></div>
          <div class="calloria-glb-stat"><span class="calloria-glb-value">${summary.failedPaths}</span><span class="calloria-glb-label">Failed file paths</span></div>
        </div>
        ${warning ? `<p class="calloria-glb-notice">${escapeHTML(warning)}</p>` : ''}
        <h3 class="calloria-glb-section">Actual model file attempts (${summary.totalAttempts})</h3>
        <div class="calloria-glb-list">${attempts.length ? attempts.map(renderAttempt).join('') : '<p class="calloria-glb-empty">No GLB load attempts have been recorded. This can mean the GLB integration did not run, or the asset modules have not started loading.</p>'}</div>
        <h3 class="calloria-glb-section">Integration errors</h3>
        <div class="calloria-glb-list">${[...listOrEmpty(state.status.staffErrors), ...listOrEmpty(state.status.officeErrors)].length
          ? [...listOrEmpty(state.status.staffErrors), ...listOrEmpty(state.status.officeErrors)].map((error) => `<p class="calloria-glb-error">${escapeHTML(error?.message || error)}</p>`).join('')
          : '<p class="calloria-glb-empty">No integration-level error was reported.</p>'}</div>
        <footer class="calloria-glb-footer">A successful HTTP/GLB load is not the same as a visible placement. Counts above come from the workplace integration status. <a href="/asset-inspector.html">Open full asset inspector</a>.</footer>
      </div>`;
    panel.querySelector('[data-close]')?.addEventListener('click', close);
  }

  function open() {
    state.expanded = true;
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    render();
  }
  function close() {
    state.expanded = false;
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  }
  function update(status = {}) {
    state.status = { ...state.status, ...status, worldReady: true };
    state.lastUpdated = new Date().toLocaleTimeString();
    render();
  }
  function handleAttempt(event) {
    const detail = event?.detail || {};
    const key = `${detail.kind || ''}|${detail.assetId || ''}|${detail.url || detail.path || ''}`;
    const index = state.attempts.findIndex((item) => item._key === key);
    const item = { ...detail, _key: key };
    if (index >= 0) state.attempts[index] = item;
    else state.attempts.push(item);
    if (state.attempts.length > MAX_ATTEMPTS) state.attempts.splice(0, state.attempts.length - MAX_ATTEMPTS);
    state.lastUpdated = new Date().toLocaleTimeString();
    if (state.expanded) render();
  }
  function handleReady(event) {
    update(event?.detail || {});
  }
  function handleKey(event) {
    if (event.key === 'Escape' && state.expanded) close();
  }

  button.addEventListener('click', () => state.expanded ? close() : open());
  window.addEventListener('calloria:glb-load-attempt', handleAttempt);
  window.addEventListener('calloria:glb-world-assets-ready', handleReady);
  window.addEventListener('keydown', handleKey);

  return {
    update,
    open,
    close,
    dispose() {
      window.removeEventListener('calloria:glb-load-attempt', handleAttempt);
      window.removeEventListener('calloria:glb-world-assets-ready', handleReady);
      window.removeEventListener('keydown', handleKey);
      button.remove();
      panel.remove();
      style.remove();
    },
  };
}
