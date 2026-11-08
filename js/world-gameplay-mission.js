/** A small in-world objective card so the mobile player has a clear first action. */
export function createCalloriaWorldMission({ host } = {}) {
  if (!host || typeof document === 'undefined') return { dispose() {} };
  const previousPosition = host.style.position;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const card = document.createElement('aside');
  card.className = 'calloria-world-mission';
  card.setAttribute('aria-live', 'polite');
  card.innerHTML = `
    <div class="calloria-world-mission__eyebrow">SHIFT OBJECTIVE</div>
    <div class="calloria-world-mission__title">Report to your workstation</div>
    <div class="calloria-world-mission__detail">Move to a desk. When USE becomes active, tap it to open customer operations.</div>
  `;
  const style = document.createElement('style');
  style.dataset.calloriaWorldMission = 'true';
  style.textContent = `
    .calloria-world-mission{display:none;position:absolute;z-index:18;top:12px;left:12px;width:min(244px,calc(100% - 150px));padding:10px 12px;border:1px solid rgba(124,220,210,.45);border-left:3px solid #36c8ad;border-radius:12px;background:rgba(5,19,29,.88);box-shadow:0 8px 24px rgba(0,0,0,.24);color:#eff8f6;pointer-events:none;backdrop-filter:blur(8px);font:inherit;}
    body.calloria-immersive .calloria-world-mission{display:block;}
    .calloria-world-mission__eyebrow{font-size:9px;letter-spacing:.18em;font-weight:800;color:#7ce2d0;margin-bottom:5px;}
    .calloria-world-mission__title{font-size:13px;line-height:1.25;font-weight:800;}
    .calloria-world-mission__detail{font-size:10px;line-height:1.35;color:#bfd0d1;margin-top:5px;}
    @media(max-width:420px){.calloria-world-mission{width:min(218px,calc(100% - 142px));padding:8px 10px}.calloria-world-mission__title{font-size:12px}.calloria-world-mission__detail{font-size:9px}}
  `;
  host.append(card);
  if (!document.querySelector('style[data-calloria-world-mission="true"]')) document.head.append(style);

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
      setCopy('WORKSTATION IN RANGE', station.label || 'Agent workstation', 'Tap USE to access inbound calls, digital support, CRM and other operations.');
    } else {
      setCopy('SHIFT OBJECTIVE', 'Report to your workstation', 'Move towards the desks. The USE control activates when you are close enough.');
    }
  };
  const onAccessed = (event) => {
    const station = event.detail || {};
    setCopy('WORKSTATION ACCESSED', station.label || 'Agent workstation', 'Choose an operation in the workstation panel to begin customer service.');
  };
  const onImmersive = (event) => {
    card.dataset.active = event.detail?.active ? 'true' : 'false';
  };
  window.addEventListener('calloria:world-nearest-station', onNearest);
  window.addEventListener('calloria:world-station-accessed', onAccessed);
  window.addEventListener('calloria:world-immersive', onImmersive);
  return {
    dispose() {
      window.removeEventListener('calloria:world-nearest-station', onNearest);
      window.removeEventListener('calloria:world-station-accessed', onAccessed);
      window.removeEventListener('calloria:world-immersive', onImmersive);
      card.remove();
      if (previousPosition === '' && host.isConnected) host.style.position = '';
      else if (previousPosition && host.isConnected) host.style.position = previousPosition;
      if (style.dataset.calloriaWorldMission === 'true' && style.isConnected && document.querySelectorAll('style[data-calloria-world-mission="true"]').length <= 1) style.remove();
    }
  };
}
