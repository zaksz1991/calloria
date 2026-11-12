/* CALLORIA v6.11 — mobile viewport, assessment CTA and scroll hardening. */
(() => {
  'use strict';

  const ROOT_SELECTOR = '#viewRoot';
  const ACTION_SELECTOR = 'button[data-action="assessment-next"], button[data-action="practical-next"]';
  const DOCK_ID = 'calloriaMobileAssessmentDockV611';
  const isMobile = () => Boolean(
    window.matchMedia?.('(pointer: coarse)').matches ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia?.('(max-width: 760px)').matches
  );

  let observedRoot = null;
  let rootObserver = null;
  let discoveryObserver = null;
  let rafOne = 0;
  let rafTwo = 0;
  let currentOriginal = null;
  let currentFooter = null;
  let dock = null;
  let proxyButton = null;
  let hint = null;

  function syncViewportMetrics() {
    const viewport = window.visualViewport;
    const height = Number(viewport?.height || window.innerHeight || 0);
    const width = Number(viewport?.width || window.innerWidth || 0);
    const offsetTop = Number(viewport?.offsetTop || 0);
    const hiddenBottom = Math.max(0, Number(window.innerHeight || 0) - (height + offsetTop));
    if (height > 0) document.documentElement.style.setProperty('--calloria-v611-visual-height', `${Math.round(height)}px`);
    if (width > 0) document.documentElement.style.setProperty('--calloria-v611-visual-width', `${Math.round(width)}px`);
    document.documentElement.style.setProperty('--calloria-v611-browser-bottom-inset', `${Math.round(hiddenBottom)}px`);
  }

  function createDock() {
    if (dock?.isConnected) return;
    dock = document.getElementById(DOCK_ID);
    if (dock) {
      proxyButton = dock.querySelector('button');
      hint = dock.querySelector('[data-calloria-hint]');
      return;
    }

    dock = document.createElement('section');
    dock.id = DOCK_ID;
    dock.hidden = true;
    dock.setAttribute('role', 'group');
    dock.setAttribute('aria-label', 'Recruitment assessment navigation');
    dock.innerHTML = '<span data-calloria-hint aria-live="polite">Select an answer to continue.</span><button type="button" data-calloria-proxy-continue disabled>Choose an answer</button>';
    document.body.append(dock);
    proxyButton = dock.querySelector('[data-calloria-proxy-continue]');
    hint = dock.querySelector('[data-calloria-hint]');
    proxyButton.addEventListener('click', () => {
      const target = currentOriginal;
      if (!target?.isConnected || target.disabled || target.getAttribute('aria-disabled') === 'true') return;
      // Trigger the application's original delegated click handler. The game
      // remains the sole owner of assessment scoring and question progression.
      target.click();
    });
  }

  function restoreOriginalFooter() {
    if (currentFooter?.isConnected) {
      currentFooter.removeAttribute('data-calloria-mobile-proxy-hidden-v611');
      currentFooter.removeAttribute('aria-hidden');
    }
    if (currentOriginal?.isConnected) {
      currentOriginal.removeAttribute('data-calloria-proxied-v611');
      currentOriginal.removeAttribute('aria-hidden');
      currentOriginal.removeAttribute('tabindex');
    }
    currentOriginal = null;
    currentFooter = null;
  }

  function hideDock() {
    restoreOriginalFooter();
    document.documentElement.classList.remove('calloria-mobile-assessment-active-v611');
    if (dock) dock.hidden = true;
  }

  function getAssessmentAction(root) {
    if (!root) return null;
    return [...root.querySelectorAll(ACTION_SELECTOR)].find((button) => {
      return button.isConnected && Boolean(button.closest('.assessment-card'));
    }) || null;
  }

  function refreshAssessmentDock() {
    syncViewportMetrics();
    const root = document.querySelector(ROOT_SELECTOR);
    const active = isMobile() && !document.body.classList.contains('calloria-immersive');
    const original = active ? getAssessmentAction(root) : null;
    if (!original) {
      hideDock();
      return;
    }

    createDock();
    if (currentOriginal !== original) {
      restoreOriginalFooter();
      currentOriginal = original;
      currentFooter = original.closest('.assessment-footer');
    }

    if (currentFooter?.isConnected) {
      currentFooter.setAttribute('data-calloria-mobile-proxy-hidden-v611', '');
      currentFooter.setAttribute('aria-hidden', 'true');
    }
    original.setAttribute('data-calloria-proxied-v611', '');
    original.setAttribute('aria-hidden', 'true');
    original.setAttribute('tabindex', '-1');

    const disabled = Boolean(original.disabled || original.getAttribute('aria-disabled') === 'true');
    proxyButton.disabled = disabled;
    proxyButton.textContent = (original.textContent || 'Continue').trim().replace(/\s+/g, ' ');
    proxyButton.setAttribute('aria-label', proxyButton.textContent);
    const sourceHint = currentFooter?.querySelector('small')?.textContent?.trim();
    hint.textContent = sourceHint || (disabled ? 'Choose one response above to unlock the next question.' : 'Continue to the next assessment question.');

    dock.hidden = false;
    document.documentElement.classList.add('calloria-mobile-assessment-active-v611');
  }

  function scheduleRefresh() {
    if (rafOne) cancelAnimationFrame(rafOne);
    if (rafTwo) cancelAnimationFrame(rafTwo);
    rafOne = requestAnimationFrame(() => {
      rafOne = 0;
      rafTwo = requestAnimationFrame(() => {
        rafTwo = 0;
        refreshAssessmentDock();
      });
    });
  }

  function attachRootObserver() {
    const root = document.querySelector(ROOT_SELECTOR);
    if (!root || root === observedRoot) {
      scheduleRefresh();
      return;
    }
    rootObserver?.disconnect();
    observedRoot = root;
    rootObserver = new MutationObserver(scheduleRefresh);
    rootObserver.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: ['disabled', 'aria-disabled', 'class']
    });
    scheduleRefresh();
  }

  function onDocumentClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('.answer-option[data-answer], .answer-option[data-practical-answer]')) scheduleRefresh();
  }

  function boot() {
    syncViewportMetrics();
    createDock();
    attachRootObserver();
    discoveryObserver = new MutationObserver(attachRootObserver);
    discoveryObserver.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('click', onDocumentClick, { passive: true });
    window.addEventListener('resize', scheduleRefresh, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(scheduleRefresh, 160), { passive: true });
    window.visualViewport?.addEventListener('resize', scheduleRefresh, { passive: true });
    window.visualViewport?.addEventListener('scroll', syncViewportMetrics, { passive: true });
    window.addEventListener('pageshow', scheduleRefresh, { passive: true });
    window.addEventListener('calloria:world-immersive', scheduleRefresh);
    window.addEventListener('calloria:workstation-resumed', scheduleRefresh);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
