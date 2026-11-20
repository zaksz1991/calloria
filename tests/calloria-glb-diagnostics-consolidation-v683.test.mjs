import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCalloriaGLBHealthPanel,
  summarizeCalloriaGLBHealth,
} from '../js/glb-asset-health-panel.js';

class FakeClassList {
  constructor(values = []) { this.values = new Set(values); }
  contains(value) { return this.values.has(value); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  toggle(value, force) {
    if (force === undefined) force = !this.values.has(value);
    if (force) this.values.add(value); else this.values.delete(value);
    return force;
  }
}

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.hidden = false;
    this.parentNode = null;
    this.textContent = '';
    this.innerHTML = '';
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  append(...items) {
    for (const item of items) {
      item.parentNode = this;
      this.children.push(item);
    }
  }
  appendChild(item) { this.append(item); return item; }
  addEventListener(type, handler) {
    const group = this.listeners.get(type) ?? new Set();
    group.add(handler);
    this.listeners.set(type, group);
  }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  dispatch(type, event = {}) {
    for (const handler of this.listeners.get(type) ?? []) handler({ type, target: this, ...event });
  }
  querySelector() { return null; }
  remove() {
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((item) => item !== this);
    this.parentNode = null;
    this.removed = true;
  }
  click() { this.dispatch('click'); }
}

class FakeDocument {
  constructor(bodyClasses = []) {
    this.head = new FakeElement('head');
    this.body = new FakeElement('body');
    this.body.classList = new FakeClassList(bodyClasses);
  }
  createElement(tagName) { return new FakeElement(tagName); }
  getElementById(id) {
    const walk = (node) => {
      if (node.id === id) return node;
      for (const child of node.children) {
        const result = walk(child);
        if (result) return result;
      }
      return null;
    };
    return walk(this.head) || walk(this.body);
  }
}

class FakeWindow {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, handler) {
    const group = this.listeners.get(type) ?? new Set();
    group.add(handler);
    this.listeners.set(type, group);
  }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  dispatchEvent(event) {
    for (const handler of this.listeners.get(event.type) ?? []) handler(event);
    return true;
  }
  listenerCount(type) { return this.listeners.get(type)?.size ?? 0; }
}

class FakeMutationObserver {
  static instances = [];
  constructor(callback) { this.callback = callback; this.disconnected = false; FakeMutationObserver.instances.push(this); }
  observe(target, options) { this.target = target; this.options = options; }
  disconnect() { this.disconnected = true; }
  trigger() { if (!this.disconnected) this.callback([]); }
}

async function withDom(bodyClasses, run) {
  const prior = {
    document: globalThis.document,
    window: globalThis.window,
    MutationObserver: globalThis.MutationObserver,
  };
  const document = new FakeDocument(bodyClasses);
  const window = new FakeWindow();
  FakeMutationObserver.instances = [];
  globalThis.document = document;
  globalThis.window = window;
  globalThis.MutationObserver = FakeMutationObserver;
  try {
    await run({ document, window, observers: FakeMutationObserver.instances });
  } finally {
    if (prior.document === undefined) delete globalThis.document; else globalThis.document = prior.document;
    if (prior.window === undefined) delete globalThis.window; else globalThis.window = prior.window;
    if (prior.MutationObserver === undefined) delete globalThis.MutationObserver;
    else globalThis.MutationObserver = prior.MutationObserver;
  }
}

test('asset summary preserves the real loaded/placed/fallback counts', () => {
  const summary = summarizeCalloriaGLBHealth(
    { staffLoaded: 2, officePlaced: 5, fallback: 7, worldReady: true, tier: 'balanced' },
    [{ status: 'loaded' }, { status: 'failed' }, { status: 'loading' }],
  );
  assert.equal(summary.staffLoaded, 2);
  assert.equal(summary.officePlaced, 5);
  assert.equal(summary.staffFallback, 7);
  assert.equal(summary.loadedPaths, 1);
  assert.equal(summary.failedPaths, 1);
  assert.equal(summary.loadingPaths, 1);
});

test('diagnostics button is hidden outside the immersive workplace', async () => {
  await withDom([], ({ document }) => {
    const panel = createCalloriaGLBHealthPanel();
    const button = document.getElementById('calloria-glb-health-toggle-v682');
    const report = document.getElementById('calloria-glb-health-panel-v682');
    assert.ok(button);
    assert.equal(button.hidden, true);
    assert.equal(report.hidden, true);
    panel.open();
    assert.equal(report.hidden, true, 'programmatic open must not expose a panel outside the game');
    panel.dispose();
  });
});

test('the one diagnostics panel appears on immersive entry and closes on exit', async () => {
  await withDom([], ({ document, window }) => {
    const controller = createCalloriaGLBHealthPanel();
    const button = document.getElementById('calloria-glb-health-toggle-v682');
    const report = document.getElementById('calloria-glb-health-panel-v682');
    window.dispatchEvent({ type: 'calloria:world-immersive', detail: { active: true } });
    assert.equal(button.hidden, false);
    button.click();
    assert.equal(report.hidden, false);
    window.dispatchEvent({ type: 'calloria:world-immersive', detail: { active: false } });
    assert.equal(button.hidden, true);
    assert.equal(report.hidden, true);
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    controller.dispose();
  });
});

test('body-class observer is a fallback for missed immersive events', async () => {
  await withDom([], ({ document, observers }) => {
    const controller = createCalloriaGLBHealthPanel();
    const button = document.getElementById('calloria-glb-health-toggle-v682');
    document.body.classList.add('calloria-game-playing');
    observers[0].trigger();
    assert.equal(button.hidden, false);
    document.body.classList.remove('calloria-game-playing');
    observers[0].trigger();
    assert.equal(button.hidden, true);
    controller.dispose();
  });
});

test('legacy auto-expanding GLB card is suppressed so it cannot duplicate the report', async () => {
  await withDom([], ({ document }) => {
    const controller = createCalloriaGLBHealthPanel();
    const style = document.getElementById('calloria-glb-health-style-v682');
    assert.match(style.textContent, /#calloriaGlbAudit\s*\{\s*display:\s*none\s*!important;/);
    assert.match(style.textContent, /#calloria-glb-health-toggle-v682\[hidden\]/);
    controller.dispose();
  });
});

test('world exit closes an open report and the new instance owns one event listener', async () => {
  await withDom(['calloria-game-playing'], ({ document, window }) => {
    const first = createCalloriaGLBHealthPanel();
    const firstButton = document.getElementById('calloria-glb-health-toggle-v682');
    firstButton.click();
    assert.equal(window.listenerCount('calloria:world-immersive'), 1);
    const second = createCalloriaGLBHealthPanel();
    assert.equal(window.listenerCount('calloria:world-immersive'), 1);
    assert.equal(firstButton.removed, true);
    window.dispatchEvent({ type: 'calloria:world-immersive', detail: { active: false } });
    assert.equal(document.getElementById('calloria-glb-health-toggle-v682').hidden, true);
    second.dispose();
    assert.equal(window.listenerCount('calloria:world-immersive'), 0);
    assert.equal(window.listenerCount('calloria:glb-load-attempt'), 0);
  });
});

test('Escape closes the asset report', async () => {
  await withDom(['calloria-game-playing'], ({ document, window }) => {
    const controller = createCalloriaGLBHealthPanel();
    const button = document.getElementById('calloria-glb-health-toggle-v682');
    const report = document.getElementById('calloria-glb-health-panel-v682');
    button.click();
    assert.equal(report.hidden, false);
    window.dispatchEvent({ type: 'keydown', key: 'Escape' });
    assert.equal(report.hidden, true);
    controller.dispose();
  });
});
