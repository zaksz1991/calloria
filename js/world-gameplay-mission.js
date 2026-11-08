/**
 * CALLORIA first-shift objective overlay.
 * Works with the existing Three.js world and existing workstation action panel.
 */
export function createCalloriaWorldMission({ host } = {}) {
  if (!host || typeof document === 'undefined' || typeof window === 'undefined') {
    return { dispose() {} };
  }

  const previousPosition = host.style.position;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

  const card = document.createElement('aside');
  card.className = 'calloria-world-mission';
  card.setAttribute('role', 'status');
  card.setAttribute('aria-live', 'polite');
  card.innerHTML = `
    <div class="calloria-world-mission__eyebrow">FIRST SHIFT · STEP 1 OF 3</div>
    <div class="calloria-world-mission__title">Your workstation is ready</div>
    <div class="calloria-world-mission__detail">You are starting at Agent Station 11. Tap USE to open your workstation and choose an operation.</div>
  `;

  let style = document.querySelector('style[data-calloria-world-mission="true"]');
  const ownsStyle = !style;
  if (!style) {
    style = document.createElement('style');
    style.dataset.calloriaWorldMission = 'true';
    style.textContent = `
      .calloria-world-mission{
        display:none;position:absolute;z-index:28;top:12px;left:12px;
        width:min(286px,calc(100% - 24px));box-sizing:border-box;
        padding:11px 13px;border:1px solid rgba(124,220,210,.48);
        border-left:4px solid #36c8ad;border-radius:13px;
        background:rgba(5,19,29,.94);box-shadow:0 9px 26px rgba(0,0,0,.30);
        color:#eff8f6;pointer-events:none;backdrop-filter:blur(9px);
        font:inherit;line-height:1.35
      }
      body.calloria-immersive .calloria-world-mission{display:block}
      .calloria-world-mission__eyebrow{font-size:9px;letter-spacing:.15em;font-weight:900;color:#7ce2d0;margin-bottom:5px}
      .calloria-world-mission__title{font-size:14px;line-height:1.22;font-weight:850}
      .calloria-world-mission__detail{font-size:11px;line-height:1.38;color:#c3d6d7;margin-top:5px}
      @media(max-width:420px){
        .calloria-world-mission{top:9px;left:9px;width:min(256px,calc(100% - 18px));padding:9px 11px}
        .calloria-world-mission__title{font-size:13px}
        .calloria-world-mission__detail{font-size:10px}
      }
    `;
    document.head.append(style);
  }

  host.append(card);

  const setCopy = (eyebrow, title, detail) => {
    const eyebrowNode = card.querySelector('.calloria-world-mission__eyebrow');
    const titleNode = card.querySelector('.calloria-world-mission__title');
    const detailNode = card.querySelector('.calloria-world-mission__detail');
    if (eyebrowNode) eyebrowNode.textContent = eyebrow;
    if (titleNode) titleNode.textContent = title;
    if (detailNode) detailNode.textContent = detail;
  };

  const onNearest = (event) => {
    const station = event.detail;
    if (station) {
      setCopy(
        'FIRST SHIFT · STEP 1 COMPLETE',
        station.label || 'Agent workstation',
        'Workstation in range. Tap USE to open the operation menu.'
      );
    } else {
      setCopy(
        'FIRST SHIFT · STEP 1 OF 3',
        'Report to your workstation',
        'Move towards the agent desks. Your workstation is marked by the USE prompt when you are close.'
      );
    }
  };

  const onAccessed = (event) => {
    const station = event.detail || {};
    setCopy(
      'FIRST SHIFT · STEP 2 OF 3',
      station.label || 'Workstation opened',
      'Choose Inbound Desk to start your shift and receive your first customer.'
    );
  };

  const onImmersive = (event) => {
    const active = Boolean(event.detail?.active);
    card.dataset.active = active ? 'true' : 'false';
  };

  const onOperation = (event) => {
    const button = event.target?.closest?.('[data-station-action]');
    if (!button) return;
    const action = String(button.dataset.stationAction || '');
    const labels = {
      inbound: 'Inbound Desk',
      outbound: 'Outbound Campaigns',
      digital: 'Digital Support',
      crm: 'CRM & Cases',
      queue: 'Queue Management',
      supervisor: 'Supervisor Desk',
      knowledge: 'Knowledge Base',
      recruitment: 'Recruitment'
    };
    const label = labels[action];
    if (!label) return;
    setCopy(
      'FIRST SHIFT · STEP 3 OF 3',
      `${label} selected`,
      action === 'inbound'
        ? 'The inbound service workspace is opening. Begin handling the customer queue there.'
        : 'The selected operations workspace is opening. Your 3D floor remains available when you return.'
    );
  };

  window.addEventListener('calloria:world-nearest-station', onNearest);
  window.addEventListener('calloria:world-station-accessed', onAccessed);
  window.addEventListener('calloria:world-immersive', onImmersive);
  document.addEventListener('click', onOperation, true);

  return {
    dispose() {
      window.removeEventListener('calloria:world-nearest-station', onNearest);
      window.removeEventListener('calloria:world-station-accessed', onAccessed);
      window.removeEventListener('calloria:world-immersive', onImmersive);
      document.removeEventListener('click', onOperation, true);
      card.remove();
      if (previousPosition === '' && host.isConnected) host.style.position = '';
      else if (previousPosition && host.isConnected) host.style.position = previousPosition;
      if (ownsStyle && style?.isConnected) style.remove();
    }
  };
}
