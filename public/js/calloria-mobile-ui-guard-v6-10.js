/* CALLORIA v6.10 — viewport and assessment Continue-button safety. */
(() => {
  'use strict';

  const ROOT_SELECTOR = '#viewRoot';
  const ACTION_SELECTOR = 'button[data-action="assessment-next"], button[data-action="practical-next"]';
  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  let observedRoot = null;
  let rootObserver = null;
  let pendingFrame = 0;

  function syncVisibleViewport() {
    const visualHeight = Number(window.visualViewport?.height || window.innerHeight || 0);
    const visualWidth = Number(window.visualViewport?.width || window.innerWidth || 0);
    if (visualHeight > 0) document.documentElement.style.setProperty('--calloria-visible-height-v610', `${Math.round(visualHeight)}px`);
    if (visualWidth > 0) document.documentElement.style.setProperty('--calloria-visible-width-v610', `${Math.round(visualWidth)}px`);
  }

  function assessmentFooter() {
    const root = document.querySelector(ROOT_SELECTOR);
    if (!root) return null;
    const button = [...root.querySelectorAll(ACTION_SELECTOR)].find((item) => !item.disabled && item.getAttribute('aria-disabled') !== 'true');
    return button ? { button, footer: button.closest('.assessment-footer') || button } : null;
  }

  function revealEnabledContinue() {
    if (pendingFrame) cancelAnimationFrame(pendingFrame);
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = 0;
        const found = assessmentFooter();
        if (!found) return;
        const { button, footer } = found;
        if (button.dataset.calloriaMobileReveal === 'done') return;
        button.dataset.calloriaMobileReveal = 'done';
        document.documentElement.classList.add('calloria-mobile-assessment-active');
        // The sticky action row is offset above the mobile navigation dock.
        // Scrolling it into view after a response makes Continue reachable
        // without changing the application's delegated click handlers.
        const bounds = footer.getBoundingClientRect();
        const availableBottom = window.innerHeight - 84;
        if (bounds.bottom > availableBottom || bounds.top > window.innerHeight * 0.78) {
          footer.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
        }
      });
    });
  }

  function attachRootObserver() {
    const root = document.querySelector(ROOT_SELECTOR);
    if (!root || root === observedRoot) return;
    rootObserver?.disconnect();
    observedRoot = root;
    rootObserver = new MutationObserver(() => {
      const active = Boolean(root.querySelector(ACTION_SELECTOR));
      document.documentElement.classList.toggle('calloria-mobile-assessment-active', active);
      if (active) revealEnabledContinue();
    });
    rootObserver.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'aria-disabled'] });
    document.documentElement.classList.toggle('calloria-mobile-assessment-active', Boolean(root.querySelector(ACTION_SELECTOR)));
    revealEnabledContinue();
  }

  function boot() {
    syncVisibleViewport();
    attachRootObserver();
    const discovery = new MutationObserver(attachRootObserver);
    discovery.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('resize', syncVisibleViewport, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(syncVisibleViewport, 120), { passive: true });
    window.visualViewport?.addEventListener('resize', syncVisibleViewport, { passive: true });
    window.visualViewport?.addEventListener('scroll', syncVisibleViewport, { passive: true });
    window.addEventListener('pageshow', () => { syncVisibleViewport(); attachRootObserver(); }, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
