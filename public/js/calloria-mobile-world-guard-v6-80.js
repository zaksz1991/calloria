/* CALLORIA v6.80 — mobile 3D viewport guard. Loaded before the main module. */
(() => {
  'use strict';

  if (window.__CALLORIA_MOBILE_WORLD_GUARD_V680__) return;
  window.__CALLORIA_MOBILE_WORLD_GUARD_V680__ = true;

  const touchDevice = Boolean(
    window.matchMedia?.('(pointer: coarse)').matches ||
    navigator.maxTouchPoints > 0 ||
    window.innerWidth <= 760
  );
  if (!touchDevice) return;

  const nativeIntersectionObserver = window.IntersectionObserver;
  const mobileWorldObservers = new Set();
  if (nativeIntersectionObserver) {
    try {
      window.IntersectionObserver = class CalloriaMobileIntersectionObserver extends nativeIntersectionObserver {
        constructor(callback, options) {
          super((entries, observer) => {
            const immersive = document.body?.classList.contains('calloria-immersive');
            const corrected = entries.map((entry) => {
              if (entry.target?.id !== 'worldCanvas' || !immersive || entry.isIntersecting) {
                return entry;
              }
              return new Proxy(entry, {
                get(target, property) {
                  if (property === 'isIntersecting') return true;
                  if (property === 'intersectionRatio') return 1;
                  return Reflect.get(target, property, target);
                },
              });
            });
            callback(corrected, observer);
          }, options);
          this.__calloriaCallback = callback;
          this.__calloriaTargets = new Set();
          mobileWorldObservers.add(this);
        }

        observe(target) {
          this.__calloriaTargets.add(target);
          return super.observe(target);
        }

        unobserve(target) {
          this.__calloriaTargets.delete(target);
          return super.unobserve(target);
        }

        disconnect() {
          this.__calloriaTargets.clear();
          mobileWorldObservers.delete(this);
          return super.disconnect();
        }
      };
    } catch (error) {
      console.warn('[CALLORIA v6.80] Intersection observer guard unavailable:', error);
    }
  }

  function notifyWorldIntersection(host) {
    for (const observer of mobileWorldObservers) {
      if (!observer.__calloriaTargets?.has(host)) continue;
      try {
        observer.__calloriaCallback?.([{ target: host, isIntersecting: true, intersectionRatio: 1 }], observer);
      } catch (error) {
        console.warn('[CALLORIA v6.80] Could not wake the mobile 3D render loop:', error);
      }
    }
  }

  const root = document.documentElement;
  const body = document.body;
  let syncFrame = 0;

  function updateVisibleHeight() {
    const height = Math.max(1, Math.round(window.visualViewport?.height || window.innerHeight || 1));
    root.style.setProperty('--calloria-v680-visible-height', `${height}px`);
    root.style.setProperty('--calloria-visible-height-v610', `${height}px`);
  }

  function syncWorldViewport() {
    cancelAnimationFrame(syncFrame);
    syncFrame = requestAnimationFrame(() => {
      updateVisibleHeight();
      if (!body.classList.contains('calloria-immersive')) return;

      const panel = document.querySelector('.world-panel');
      const host = document.getElementById('worldCanvas');
      if (!panel || !host) return;

      panel.classList.add('is-immersive');
      const height = Math.max(1, Math.round(window.visualViewport?.height || window.innerHeight || 1));
      panel.style.setProperty('height', `${height}px`, 'important');
      panel.style.setProperty('min-height', '0', 'important');
      host.style.setProperty('width', '100vw', 'important');
      host.style.setProperty('height', `${height}px`, 'important');
      host.style.setProperty('min-height', '0', 'important');

      const canvas = host.querySelector('canvas');
      if (canvas) {
        canvas.style.setProperty('width', '100vw', 'important');
        canvas.style.setProperty('height', `${height}px`, 'important');
        canvas.style.setProperty('display', 'block', 'important');
      }

      // Force the engine's existing ResizeObserver / window resize path to
      // recalculate the canvas after Chrome's address bar changes the viewport.
      void host.getBoundingClientRect();
      notifyWorldIntersection(host);
      window.dispatchEvent(new Event('resize'));
      requestAnimationFrame(() => notifyWorldIntersection(host));
    });
  }

  const stateObserver = new MutationObserver((records) => {
    if (records.some((record) => record.attributeName === 'class')) syncWorldViewport();
  });
  stateObserver.observe(body, { attributes: true, attributeFilter: ['class'] });

  window.addEventListener('resize', syncWorldViewport, { passive: true });
  window.addEventListener('orientationchange', syncWorldViewport, { passive: true });
  window.visualViewport?.addEventListener('resize', syncWorldViewport, { passive: true });
  window.visualViewport?.addEventListener('scroll', syncWorldViewport, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncWorldViewport();
  });

  updateVisibleHeight();
  syncWorldViewport();
})();
