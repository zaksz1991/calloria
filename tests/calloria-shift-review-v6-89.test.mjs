import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readShiftMetrics,
  summariseShift,
  buildShiftReportHTML,
  installShiftReviewRuntime
} from '../js/calloria-shift-review-v6-89.mjs';

test('readShiftMetrics normalises absent collections and counters', () => {
  const result = readShiftMetrics({ day: 0, callsHandled: '4', cases: null });
  assert.equal(result.callsHandled, 4);
  assert.equal(result.cases, 0);
  assert.equal(result.day, 1);
  assert.equal(result.commitments, 0);
});

test('summariseShift calculates shift deltas and averages from new QA/CSAT records', () => {
  const before = {
    callsHandled: 5, outboundCalls: 2, resolutions: 4, sales: 1,
    cases: [{ reference: 'C-1' }],
    customerCommitments: { commitments: [{ id: 'P-1' }] },
    totalQA: 80, qaCount: 1, totalCSAT: 4, csatCount: 1,
    day: 3, shiftElapsedMinutes: 0
  };
  const after = {
    callsHandled: 8, outboundCalls: 4, resolutions: 6, sales: 2,
    cases: [{ reference: 'C-1' }, { reference: 'C-2' }],
    customerCommitments: { commitments: [{ id: 'P-1' }, { id: 'P-2' }] },
    totalQA: 260, qaCount: 3, totalCSAT: 13, csatCount: 3,
    day: 3, shiftElapsedMinutes: 510,
    shiftRecord: {
      startedAt: '2026-11-21T08:00:00.000Z',
      endedAt: '2026-11-21T16:30:00.000Z',
      elapsedMinutes: 510,
      adherence: { adherence: 94 }
    }
  };
  const result = summariseShift(before, after);
  assert.equal(result.inbound, 3);
  assert.equal(result.outbound, 2);
  assert.equal(result.resolutions, 2);
  assert.equal(result.sales, 1);
  assert.equal(result.newCases, 1);
  assert.equal(result.newCommitments, 1);
  assert.equal(result.qaAverage, 90);
  assert.equal(result.csatAverage, 4.5);
  assert.equal(result.adherence, 94);
  assert.equal(result.elapsedMinutes, 510);
});

test('summariseShift prevents negative deltas and reports missing score data as null', () => {
  const result = summariseShift(
    { callsHandled: 9, totalQA: 90, qaCount: 1, totalCSAT: 5, csatCount: 1 },
    { callsHandled: 2, totalQA: 0, qaCount: 0, totalCSAT: 0, csatCount: 0 }
  );
  assert.equal(result.inbound, 0);
  assert.equal(result.qaAverage, null);
  assert.equal(result.csatAverage, null);
});

test('buildShiftReportHTML escapes interpolated labels and clearly marks partial tracking', () => {
  const html = buildShiftReportHTML({
    day: '<img src=x>', partial: true, startedAt: null, endedAt: null,
    elapsedMinutes: 40, inbound: 1, outbound: 0, resolutions: 1,
    sales: 0, newCases: 1, newCommitments: 0,
    qaAverage: null, csatAverage: null, adherence: null
  });
  assert.match(html, /&lt;img src=x&gt;/);
  assert.match(html, /Tracking resumed after a page reload/);
  assert.match(html, /SHIFT ADHERENCE/);
});

class FakeStorage {
  constructor() { this.data = new Map(); }
  get length() { return this.data.size; }
  key(index) { return [...this.data.keys()][index] ?? null; }
  getItem(key) { return this.data.has(String(key)) ? this.data.get(String(key)) : null; }
  setItem(key, value) { this.data.set(String(key), String(value)); }
  removeItem(key) { this.data.delete(String(key)); }
}

function fakeDocument() {
  const appended = [];
  const body = { append: element => appended.push(element) };
  const document = {
    body,
    activeElement: null,
    appended,
    createElement() {
      const dialog = {
        isConnected: true,
        focus() {},
        addEventListener() {},
        querySelector() { return { focus() {} }; },
        querySelectorAll() { return []; },
        remove() { this.isConnected = false; }
      };
      return {
        firstElementChild: dialog,
        set innerHTML(value) { this.html = value; dialog.html = value; }
      };
    },
    addEventListener() {},
    removeEventListener() {}
  };
  return document;
}

test('runtime detects a saved active-to-closed shift transition and opens one report', () => {
  const localStorage = new FakeStorage();
  const sessionStorage = new FakeStorage();
  const document = fakeDocument();
  const window = {
    localStorage,
    sessionStorage,
    Storage: FakeStorage,
    setTimeout(callback) { callback(); return 1; },
    addEventListener() {},
    removeEventListener() {}
  };
  const restore = installShiftReviewRuntime(window, document);
  const key = 'calloria.save.v1';
  localStorage.setItem(key, JSON.stringify({ shiftActive: false, callsHandled: 2, day: 1 }));
  localStorage.setItem(key, JSON.stringify({ shiftActive: true, callsHandled: 2, day: 1, shiftRecord: { startedAt: '2026-11-21T08:00:00.000Z' } }));
  localStorage.setItem(key, JSON.stringify({ shiftActive: false, callsHandled: 5, outboundCalls: 1, day: 1, shiftElapsedMinutes: 300, shiftRecord: { startedAt: '2026-11-21T08:00:00.000Z', endedAt: '2026-11-21T13:00:00.000Z', elapsedMinutes: 300, adherence: { adherence: 90 } } }));
  assert.equal(document.appended.length, 1);
  assert.match(document.appended[0].html, /4 customer contacts handled/);
  assert.match(document.appended[0].html, /SHIFT ADHERENCE/);
  restore();
});

test('runtime does not show a report for ordinary non-shift saves', () => {
  const localStorage = new FakeStorage();
  const document = fakeDocument();
  const window = {
    localStorage,
    sessionStorage: new FakeStorage(),
    Storage: FakeStorage,
    setTimeout(callback) { callback(); return 1; },
    addEventListener() {},
    removeEventListener() {}
  };
  const restore = installShiftReviewRuntime(window, document);
  localStorage.setItem('calloria.save.v1', JSON.stringify({ shiftActive: false, day: 1 }));
  localStorage.setItem('calloria.save.v1', JSON.stringify({ shiftActive: false, callsHandled: 3, day: 1 }));
  assert.equal(document.appended.length, 0);
  restore();
});

test('runtime resumes an already active shift with a clearly partial baseline', () => {
  const localStorage = new FakeStorage();
  const sessionStorage = new FakeStorage();
  const key = 'calloria.save.org.test';
  localStorage.setItem(key, JSON.stringify({ shiftActive: true, callsHandled: 8, day: 2 }));
  const document = fakeDocument();
  const window = {
    localStorage,
    sessionStorage,
    Storage: FakeStorage,
    setTimeout(callback) { callback(); return 1; },
    addEventListener() {},
    removeEventListener() {}
  };
  const restore = installShiftReviewRuntime(window, document);
  localStorage.setItem(key, JSON.stringify({ shiftActive: false, callsHandled: 9, day: 2, shiftRecord: { elapsedMinutes: 90 } }));
  assert.equal(document.appended.length, 1);
  assert.match(document.appended[0].html, /Tracking resumed after a page reload/);
  restore();
});
