/**
 * CALLORIA first-shift mission HUD.
 * Progress is driven by real application events: workstation access, briefing
 * attendance, shift start, inbound connection and saved case wrap-up.
 */
export const FIRST_SHIFT_STEPS = Object.freeze([
  {
    id: 'reach-station',
    eyebrow: 'FIRST SHIFT · 1/6',
    title: 'Reach an agent workstation',
    detail: 'Use MOVE to walk. Drag the scene to look around. RUN moves faster. Approach a desk until USE becomes available.',
    controls: 'MOVE = walk  ·  DRAG = look  ·  RUN = sprint  ·  USE = workstation'
  },
  {
    id: 'access-station',
    eyebrow: 'FIRST SHIFT · 2/6',
    title: 'Access your workstation',
    detail: 'You are close enough to a desk. Tap USE to open its workstation menu.',
    controls: 'The USE control activates when you are beside a station.'
  },
  {
    id: 'choose-inbound',
    eyebrow: 'FIRST SHIFT · 3/6',
    title: 'Choose Inbound Desk',
    detail: 'Select Inbound desk in the workstation panel. This starts the first customer-service workflow.',
    controls: 'Other stations remain available for digital support, CRM, campaigns and supervisor work.'
  },
  {
    id: 'start-shift',
    eyebrow: 'FIRST SHIFT · 4/6',
    title: 'Attend briefing and start your shift',
    detail: 'If the shift did not start, open Workforce. Attend the active 07:30 or 14:00 briefing, then start the shift during the 08:00–17:00 shift window.',
    controls: 'Briefing attendance and shift start are recorded by the existing workforce system.'
  },
  {
    id: 'accept-customer',
    eyebrow: 'FIRST SHIFT · 5/6',
    title: 'Accept your first customer',
    detail: 'Return to Inbound Desk and accept the next waiting caller. Listen carefully and follow the call-handling steps.',
    controls: 'Use the call flow, verify identity, consult approved knowledge and avoid unsupported promises.'
  },
  {
    id: 'handle-customer',
    eyebrow: 'FIRST SHIFT · 6/6',
    title: 'Complete after-contact work',
    detail: 'Choose the correct disposition, write factual case notes and save the interaction record. Escalate when required.',
    controls: 'Your case outcome and QA score come from the real interaction record.'
  }
]);

export function transitionFirstShiftMission(current, type, detail = {}) {
  const state = {
    step: Number.isInteger(current?.step) ? Math.max(0, Math.min(6, current.step)) : 0,
    stationId: current?.stationId ?? null,
    stationLabel: current?.stationLabel ?? '',
    operation: current?.operation ?? '',
    shiftStarted: Boolean(current?.shiftStarted),
    briefingAttended: Boolean(current?.briefingAttended),
    customer: current?.customer ?? '',
    caseReference: current?.caseReference ?? '',
    disposition: current?.disposition ?? '',
    qa: Number.isFinite(Number(current?.qa)) ? Number(current.qa) : null,
    resolved: current?.resolved === true,
    assetStatus: current?.assetStatus ?? null
  };

  switch (type) {
    case 'nearest-station':
      if (detail.station) {
        state.stationId = detail.station.id ?? state.stationId;
        state.stationLabel = detail.station.label || state.stationLabel || 'Agent workstation';
        if (state.step < 1) state.step = 1;
      }
      break;
    case 'station-panel-opened':
      if (detail.hired === false && state.step < 6) state.step = 0;
      break;
    case 'employment-accepted':
      if (state.step < 1) state.step = 0;
      break;
    case 'station-accessed':
      state.stationId = detail.id ?? state.stationId;
      state.stationLabel = detail.label || state.stationLabel || 'Agent workstation';
      if (state.step < 2) state.step = 2;
      break;
    case 'operation-selected':
      state.operation = String(detail.view || '');
      if (state.operation === 'inbound') {
        if (detail.shiftActive) {
          state.shiftStarted = true;
          if (state.step < 4) state.step = 4;
        } else if (state.step < 3) state.step = 3;
      } else if (state.step < 2) {
        state.step = 2;
      }
      break;
    case 'briefing-attended':
      state.briefingAttended = true;
      if (state.step < 3) state.step = 3;
      break;
    case 'shift-started':
      state.shiftStarted = true;
      if (state.step < 4) state.step = 4;
      break;
    case 'call-connected':
      state.customer = String(detail.customer || 'Customer');
      if (state.step < 5) state.step = 5;
      break;
    case 'case-saved':
      state.caseReference = String(detail.reference || '');
      state.disposition = String(detail.disposition || 'recorded');
      state.qa = Number.isFinite(Number(detail.qa)) ? Number(detail.qa) : null;
      state.resolved = detail.resolved === true;
      state.step = 6;
      break;
    case 'assets-ready':
      state.assetStatus = {
        staff: Math.max(0, Number(detail.staff) || 0),
        office: Math.max(0, Number(detail.office) || 0),
        failures: Math.max(0, Number(detail.failures) || 0),
        loading: Boolean(detail.loading),
        tier: String(detail.tier || 'unknown')
      };
      break;
    default:
      break;
  }
  return state;
}

export function createCalloriaWorldMission({ host, tier = 'balanced' } = {}) {
  if (!host || typeof document === 'undefined') return { dispose() {} };

  const previousPosition = host.style.position;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

  let state = {
    step: 0, stationId: null, stationLabel: '', operation: '',
    shiftStarted: false, briefingAttended: false, customer: '',
    caseReference: '', disposition: '', qa: null, resolved: false,
    assetStatus: null
  };

  try {
    const saved = sessionStorage.getItem('calloria.first-shift-mission.v23');
    if (saved) {
      const restored = JSON.parse(saved);
      if (restored && typeof restored === 'object' && Number.isInteger(restored.step) && restored.step >= 0 && restored.step <= 6) {
        state = { ...state, ...restored };
        state.stationLabel = typeof state.stationLabel === 'string' ? state.stationLabel : '';
        state.operation = typeof state.operation === 'string' ? state.operation : '';
        state.customer = typeof state.customer === 'string' ? state.customer : '';
        state.caseReference = typeof state.caseReference === 'string' ? state.caseReference : '';
        state.disposition = typeof state.disposition === 'string' ? state.disposition : '';
        state.resolved = state.resolved === true;
      }
    }
  } catch { /* Session storage is optional. */ }

  const card = document.createElement('aside');
  card.className = 'calloria-world-mission-v23';
  card.setAttribute('aria-live', 'polite');
  card.innerHTML = `
    <div class="calloria-world-mission-v23__top">
      <span data-eyebrow>FIRST SHIFT · 1/6</span>
      <strong data-count>0/6</strong>
    </div>
    <div class="calloria-world-mission-v23__bar"><i data-progress></i></div>
    <h3 data-title></h3>
    <p data-detail></p>
    <div class="calloria-world-mission-v23__controls" data-controls></div>
    <div class="calloria-world-mission-v23__assets" data-assets></div>
  `;

  const style = document.createElement('style');
  style.dataset.calloriaFirstShift = 'v23';
  style.textContent = `
    .calloria-world-mission-v23{display:none;position:absolute;z-index:24;top:max(10px,env(safe-area-inset-top));left:10px;width:min(306px,calc(100% - 22px));padding:11px 13px 10px;border:1px solid rgba(103,211,198,.38);border-left:3px solid #39cbb2;border-radius:12px;background:rgba(4,18,28,.91);box-shadow:0 8px 26px rgba(0,0,0,.30);color:#eff8f6;pointer-events:none;backdrop-filter:blur(9px);font:inherit;}
    body.calloria-immersive .calloria-world-mission-v23{display:block;}
    .calloria-world-mission-v23__top{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:9px;letter-spacing:.15em;font-weight:850;color:#83dfd1;}
    .calloria-world-mission-v23__top strong{font-size:10px;color:#eaf8f4;letter-spacing:.06em;}
    .calloria-world-mission-v23__bar{height:4px;margin:8px 0 9px;background:rgba(255,255,255,.13);border-radius:999px;overflow:hidden;}
    .calloria-world-mission-v23__bar i{display:block;width:0;height:100%;background:#40d0b8;border-radius:999px;transition:width .25s ease;}
    .calloria-world-mission-v23 h3{margin:0;font-size:14px;line-height:1.25;font-weight:850;}
    .calloria-world-mission-v23 p{margin:5px 0 0;color:#c4d5d7;font-size:10px;line-height:1.4;}
    .calloria-world-mission-v23__controls{margin-top:7px;padding-top:6px;border-top:1px solid rgba(255,255,255,.10);color:#83dfd1;font-size:9px;line-height:1.35;font-weight:700;}
    .calloria-world-mission-v23__assets{margin-top:5px;color:#91a9b2;font-size:8px;line-height:1.3;letter-spacing:.04em;}
    .calloria-world-mission-v23[data-complete="true"]{border-left-color:#d7b36b;}
    @media(max-width:520px){.calloria-world-mission-v23{top:8px;left:8px;width:min(246px,calc(100% - 16px));padding:9px 10px 8px}.calloria-world-mission-v23 h3{font-size:12px}.calloria-world-mission-v23 p{font-size:9px}.calloria-world-mission-v23__controls{font-size:8px}.calloria-world-mission-v23__assets{font-size:7px}}
  `;

  host.append(card);
  if (!document.querySelector('style[data-calloria-first-shift="v23"]')) document.head.append(style);

  const nodes = {
    eyebrow: card.querySelector('[data-eyebrow]'),
    count: card.querySelector('[data-count]'),
    progress: card.querySelector('[data-progress]'),
    title: card.querySelector('[data-title]'),
    detail: card.querySelector('[data-detail]'),
    controls: card.querySelector('[data-controls]'),
    assets: card.querySelector('[data-assets]')
  };

  function render() {
    const index = Math.min(state.step, 5);
    const step = FIRST_SHIFT_STEPS[index];
    const complete = state.step >= 6;
    if (complete) {
      nodes.eyebrow.textContent = 'FIRST SHIFT · COMPLETED';
      nodes.count.textContent = '6/6';
      nodes.progress.style.width = '100%';
      nodes.title.textContent = 'First customer interaction recorded';
      const outcome = state.resolved ? 'Resolved' : state.disposition.replaceAll('_', ' ') || 'Recorded for review';
      const qaText = state.qa === null ? 'QA pending' : `QA ${state.qa}%`;
      nodes.detail.textContent = `${outcome} · ${qaText}. Case ${state.caseReference || 'recorded'}. Continue serving the queue and review your performance after the shift.`;
      nodes.controls.textContent = 'Your result comes from the saved case record; escalation and callback outcomes are not counted as resolved.';
      card.dataset.complete = 'true';
    } else {
      nodes.eyebrow.textContent = step.eyebrow;
      nodes.count.textContent = `${state.step}/6`;
      nodes.progress.style.width = `${Math.round((state.step / 6) * 100)}%`;
      nodes.title.textContent = step.title;
      nodes.detail.textContent = step.detail;
      nodes.controls.textContent = step.controls;
      card.dataset.complete = 'false';
    }

    if (state.assetStatus) {
      const { staff, office, failures, loading, tier: assetTier } = state.assetStatus;
      const total = staff + office;
      nodes.assets.textContent = total
        ? `CONFIRMED GLB: ${staff} STAFF · ${office} OFFICE OBJECTS · ${assetTier.toUpperCase()}${failures ? ` · ${failures} LOAD ERRORS` : ''}`
        : loading
          ? `GLB ASSETS LOADING · ${assetTier.toUpperCase()} DEVICE PROFILE`
          : `NO GLB MODELS CONFIRMED · PROCEDURAL FALLBACK · ${failures} LOAD ERRORS`;
    } else {
      nodes.assets.textContent = `DEVICE PROFILE: ${tier.toUpperCase()} · GLB COUNTS WILL APPEAR AFTER THE ASSET CHECK`;
    }
  }

  function dispatch(type, detail) {
    state = transitionFirstShiftMission(state, type, detail || {});
    try { sessionStorage.setItem('calloria.first-shift-mission.v23', JSON.stringify(state)); } catch { /* Optional. */ }
    render();
  }

  const onNearest = (event) => dispatch('nearest-station', { station: event.detail || null });
  const onStation = (event) => dispatch('station-accessed', event.detail || {});
  const onStationPanel = (event) => dispatch('station-panel-opened', event.detail || {});
  const onEmployment = (event) => dispatch('employment-accepted', event.detail || {});
  const onOperation = (event) => dispatch('operation-selected', event.detail || {});
  const onBriefing = (event) => dispatch('briefing-attended', event.detail || {});
  const onShift = (event) => dispatch('shift-started', event.detail || {});
  const onCall = (event) => dispatch('call-connected', event.detail || {});
  const onCase = (event) => dispatch('case-saved', event.detail || {});
  const onAssets = (event) => dispatch('assets-ready', event.detail || {});
  const onImmersive = () => render();

  const listeners = [
    ['calloria:world-nearest-station', onNearest],
    ['calloria:world-station-accessed', onStation],
    ['calloria:game-station-panel-opened', onStationPanel],
    ['calloria:game-employment-accepted', onEmployment],
    ['calloria:game-operation-selected', onOperation],
    ['calloria:game-briefing-attended', onBriefing],
    ['calloria:game-shift-started', onShift],
    ['calloria:game-call-connected', onCall],
    ['calloria:game-case-saved', onCase],
    ['calloria:glb-assets-ready', onAssets],
    ['calloria:world-immersive', onImmersive]
  ];
  for (const [type, handler] of listeners) window.addEventListener(type, handler);
  render();

  return {
    get state() { return { ...state }; },
    dispose() {
      for (const [type, handler] of listeners) window.removeEventListener(type, handler);
      card.remove();
      if (host.isConnected) host.style.position = previousPosition;
      if (style.isConnected && document.querySelectorAll('style[data-calloria-first-shift="v23"]').length <= 1) style.remove();
    }
  };
}
