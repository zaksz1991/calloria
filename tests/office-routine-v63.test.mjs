import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Routine from '../public/office-routine-engine.js';
import Floor from '../public/office-floor-engine.js';

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
}

const date = new Date(2026, 10, 12, 7, 20, 0);
const identity = { name: 'Amina Yusuf', team: 'Customer Care' };
const storage = () => new MemoryStorage();

test('routine engine exposes v6.3 version and stable storage keys', () => {
  assert.equal(Routine.VERSION, '6.3.0');
  assert.equal(Routine.STORAGE_KEY, 'calloria.office-routine.v63');
  assert.equal(Routine.EVENT_KIND.morningBriefing, 'briefing');
  assert.equal(Routine.EVENT_KIND.lunchBreak, 'break');
});

test('cleaning strips markup and control characters from staff input', () => {
  assert.equal(Routine.clean('  <Amina>\nYusuf\u0000  ', 40), 'Amina Yusuf');
});

test('clock-in records employee, team and local date', () => {
  const db = storage();
  const record = Routine.clockIn(db, identity, date);
  assert.equal(record.employeeName, 'Amina Yusuf');
  assert.equal(record.team, 'Customer Care');
  assert.equal(record.date, '2026-11-12');
  assert.equal(Routine.isClockedIn(db, { ...identity, date: '2026-11-12' }), true);
  assert.deepEqual(Routine.getLastIdentity(db, date), { name: 'Amina Yusuf', team: 'Customer Care', date: '2026-11-12' });
});

test('clock-in rejects missing identity and repeat check-in', () => {
  const db = storage();
  assert.throws(() => Routine.clockIn(db, { name: '', team: 'Customer Care' }, date), /name and assigned team/);
  Routine.clockIn(db, identity, date);
  assert.throws(() => Routine.clockIn(db, identity, date), /already clocked in/);
});

test('new shift start is blocked until staff reception check-in', () => {
  const db = storage();
  assert.equal(Routine.validateShiftStart(db, identity, date), false);
  Routine.clockIn(db, identity, date);
  assert.equal(Routine.validateShiftStart(db, identity, date), true);
});

test('different teams have separate staff attendance records', () => {
  const db = storage();
  Routine.clockIn(db, identity, date);
  assert.equal(Routine.isClockedIn(db, { name: 'Amina Yusuf', team: 'Digital Support', date: '2026-11-12' }), false);
});

test('briefing attendance requires a matching due event', () => {
  const db = storage();
  Routine.clockIn(db, identity, date);
  const current = { ...identity, date: '2026-11-12' };
  assert.throws(() => Routine.attendEvent(db, current, 'morningBriefing', null, date), /not currently due/);
  assert.throws(() => Routine.attendEvent(db, current, 'morningBriefing', { id: 'morningBreak', type: 'break' }, date), /not currently due/);
  const token = Routine.attendEvent(db, current, 'morningBriefing', { id: 'morningBriefing', type: 'briefing' }, date);
  assert.ok(token.attendedAt);
});

test('break attendance requires an active checked-in profile and correct activity type', () => {
  const db = storage();
  assert.throws(() => Routine.attendEvent(db, { ...identity, date: '2026-11-12' }, 'morningBreak', { id: 'morningBreak', type: 'break' }, date), /Clock in/);
  Routine.clockIn(db, identity, date);
  assert.throws(() => Routine.attendEvent(db, { ...identity, date: '2026-11-12' }, 'lunchBreak', { id: 'lunchBreak', type: 'briefing' }, date), /not currently due/);
  assert.ok(Routine.attendEvent(db, { ...identity, date: '2026-11-12' }, 'lunchBreak', { id: 'lunchBreak', type: 'break' }, date).attendedAt);
});

test('event token can be consumed only once by the live shift', () => {
  const db = storage();
  Routine.clockIn(db, identity, date);
  const current = { ...identity, date: '2026-11-12' };
  Routine.attendEvent(db, current, 'morningBriefing', { id: 'morningBriefing', type: 'briefing' }, date);
  assert.equal(Routine.hasEventToken(db, current, 'morningBriefing'), true);
  assert.equal(Routine.consumeEventToken(db, current, 'morningBriefing', new Date(2026, 10, 12, 7, 35)), true);
  assert.equal(Routine.hasEventToken(db, current, 'morningBriefing'), false);
  assert.equal(Routine.consumeEventToken(db, current, 'morningBriefing', date), false);
});

test('duplicate attendance for the same scheduled event is rejected', () => {
  const db = storage();
  Routine.clockIn(db, identity, date);
  const current = { ...identity, date: '2026-11-12' };
  const due = { id: 'afternoonBriefing', type: 'briefing' };
  Routine.attendEvent(db, current, due.id, due, date);
  assert.throws(() => Routine.attendEvent(db, current, due.id, due, date), /already been recorded/);
});

test('legacy on-shift records can be migrated without duplicate profiles', () => {
  const db = storage();
  const current = { name: 'Amina Yusuf', team: 'Customer Care', date: '2026-11-12' };
  const first = Routine.importExistingShift(db, current, new Date(2026, 10, 12, 7, 30));
  const again = Routine.importExistingShift(db, current, new Date(2026, 10, 12, 7, 30));
  assert.equal(first.legacy, true);
  assert.equal(again.key, first.key);
  assert.equal(Routine.isClockedIn(db, current), true);
});

test('clock-out requires an ended shift and closes attendance once', () => {
  const db = storage();
  Routine.clockIn(db, identity, date);
  const current = { ...identity, date: '2026-11-12' };
  assert.throws(() => Routine.clockOut(db, current, date, false), /Finish the customer shift/);
  const closed = Routine.clockOut(db, current, new Date(2026, 10, 12, 16, 5), true);
  assert.ok(closed.clockOutAt);
  assert.equal(Routine.isClockedIn(db, current), false);
  assert.throws(() => Routine.clockOut(db, current, date, true), /no open staff attendance/);
  assert.throws(() => Routine.clockIn(db, identity, date), /already been closed/);
});

test('supervisor request requires active shift, an approved type and a note', () => {
  const db = storage();
  Routine.clockIn(db, identity, date);
  const current = { ...identity, date: '2026-11-12' };
  assert.throws(() => Routine.requestSupervisor(db, current, 'Customer escalation', 'Need help', date, false), /active shift/);
  assert.throws(() => Routine.requestSupervisor(db, current, 'Invented category', 'Need help', date, true), /valid supervisor assistance category/);
  assert.throws(() => Routine.requestSupervisor(db, current, 'Customer escalation', '', date, true), /short description/);
  const request = Routine.requestSupervisor(db, current, 'Customer escalation', 'Customer has requested a supervisor callback.', date, true);
  assert.match(request.id, /^SUP-20261112-001$/);
  assert.equal(request.status, 'Requested');
});

test('malformed storage fails closed and does not throw', () => {
  const db = storage();
  db.setItem(Routine.STORAGE_KEY, '{broken');
  assert.deepEqual(Routine.load(db).profiles, {});
  assert.equal(Routine.isClockedIn(db, { ...identity, date: '2026-11-12' }), false);
});

test('floor engine defines four separated staff activities and location lookup', () => {
  assert.equal(Floor.ACTIVITIES.length, 4);
  assert.deepEqual(Floor.ACTIVITIES.map((item) => item.kind), ['reception', 'briefing', 'break', 'supervisor']);
  const reception = Floor.ACTIVITIES.find((item) => item.id === 'reception');
  assert.equal(Floor.nearestPoint(Floor.ACTIVITIES, { x: reception.x, z: reception.z }, 2.8).id, 'reception');
  assert.equal(Floor.nearestPoint(Floor.ACTIVITIES, { x: 0, z: 0 }, 1), null);
});

test('reception GLB candidates point to the existing asset folders', () => {
  const desk = Floor.getAssetPaths('receptionDesk');
  const person = Floor.getAssetPaths('receptionist');
  assert.ok(desk.some((path) => path.includes('/office/reception/reception-desk/')));
  assert.ok(person.some((path) => path.includes('/receptionists/lady_in_a_trenchcoat/')));
});

test('office page includes routine engine, all staff areas and interactive activity controls', async () => {
  const html = await readFile(new URL('../public/office-floor.html', import.meta.url), 'utf8');
  for (const marker of ['activity-card', 'activity-employee-name', 'activity-action']) {
    assert.ok(html.includes(marker), `Missing ${marker}`);
  }
  const renderer = await readFile(new URL('../public/office-floor.js', import.meta.url), 'utf8');
  assert.match(renderer, /import\('\/live-floor-engine\.js'\)/);
  assert.match(renderer, /import\('\/office-routine-engine\.js'\)/);
});

test('live floor requires reception check-in and 3D activity token before clearing shift events', async () => {
  const js = await readFile(new URL('../public/live-floor.js', import.meta.url), 'utf8');
  assert.match(js, /R\.validateShiftStart\(realStorage, startIdentity/);
  assert.match(js, /R\.hasEventToken\(realStorage, identity, due\.id\)/);
  assert.match(js, /R\.consumeEventToken\(realStorage, identity, due\.id/);
  assert.match(js, /office-floor\.html/);
});


test('activity actions require the player to remain inside the physical interaction radius', async () => {
  const js = await readFile(new URL('../public/office-floor.js', import.meta.url), 'utf8');
  assert.match(js, /distanceXZ\(player, selectedActivity\) > 2\.8/);
  assert.match(js, /distanceXZ\(player, selected\) > 2\.8/);
});

test('all static office and live-floor JavaScript selectors resolve to HTML IDs', async () => {
  const cases = [
    ['office-floor.js', 'office-floor.html'],
    ['live-floor.js', 'live-floor.html']
  ];
  for (const [jsName, htmlName] of cases) {
    const js = await readFile(new URL(`../public/${jsName}`, import.meta.url), 'utf8');
    const html = await readFile(new URL(`../public/${htmlName}`, import.meta.url), 'utf8');
    const refs = new Set([...js.matchAll(/\$\(['"]#([A-Za-z0-9_-]+)['"]\)/g)].map((match) => match[1]));
    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
    const missing = [...refs].filter((id) => !ids.has(id));
    assert.deepEqual(missing, [], `${jsName} references missing HTML IDs`);
  }
});

test('live-floor loads the routine engine before the application controller', async () => {
  const html = await readFile(new URL('../public/live-floor.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('/office-routine-engine.js') < html.indexOf('/live-floor.js'));
});
