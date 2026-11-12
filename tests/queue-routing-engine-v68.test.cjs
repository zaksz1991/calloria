const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../public/queue-routing-engine.js');
const baseTime = new Date('2026-11-12T09:00:00.000Z');
function contact(id, overrides = {}) {
  return {
    id, reference: id, status: 'Queued', channel: 'Voice', productId: 'general', priority: 'P3 - Normal',
    createdAt: '2026-11-12T08:00:00.000Z', slaDueAt: '2026-11-12T10:00:00.000Z', ...overrides
  };
}
function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => map.has(key) ? map.get(key) : null, setItem: (key, value) => map.set(key, value), removeItem: (key) => map.delete(key) };
}

test('engine exports the v6.8 queue-routing contract', () => {
  assert.equal(Q.VERSION, '6.8.0');
  assert.equal(Q.STORAGE_KEY, 'calloria.queue-routing.v68');
  assert.deepEqual(Q.CHANNELS, ['Voice', 'Email', 'Live chat', 'Social', 'SMS', 'In-app']);
  assert.equal(Q.PRODUCTS.length, 7);
});

test('team defaults adapt channel expertise to assigned department', () => {
  const digital = Q.createDefaultProfile({ name: 'Ada', team: 'Digital Support' });
  assert.equal(digital.channelSkills.Email, 3);
  assert.equal(digital.channelSkills.Social, 3);
  assert.equal(digital.channelSkills.Voice, 1);
  const player = Q.createDefaultProfile({ name: 'Ada', team: 'Player Support' });
  assert.equal(player.productSkills['kano-run'], 3);
  assert.equal(player.productSkills['kano-keke'], 3);
});

test('profile normalisation clamps invalid skill levels to team defaults', () => {
  const profile = Q.normaliseProfile({ channelSkills: { Voice: 9, Email: 1 }, productSkills: { general: 0 } }, { team: 'Customer Care' });
  assert.equal(profile.channelSkills.Voice, 3);
  assert.equal(profile.channelSkills.Email, 1);
  assert.equal(profile.productSkills.general, 3);
});

test('agent skill profiles save and load separately for each employee and team', () => {
  const storage = memoryStorage();
  const ada = { name: 'Ada', team: 'Customer Care' };
  const ben = { name: 'Ben', team: 'Customer Care' };
  const profile = Q.updateSkill(Q.createDefaultProfile(ada), 'channel', 'Social', 3);
  assert.equal(Q.saveProfile(storage, ada, profile, baseTime), true);
  assert.equal(Q.loadProfile(storage, ada).channelSkills.Social, 3);
  assert.notEqual(Q.loadProfile(storage, ben).channelSkills.Social, 3);
});

test('skill updates reject unknown channels, products and levels', () => {
  const profile = Q.createDefaultProfile({ team: 'Customer Care' });
  assert.throws(() => Q.updateSkill(profile, 'channel', 'Fax', 2), /valid channel or product/);
  assert.throws(() => Q.updateSkill(profile, 'product', 'unknown', 2), /valid channel or product/);
  assert.throws(() => Q.updateSkill(profile, 'channel', 'Voice', 4), /valid skill level/);
});

test('priority and SLA urgency outrank lower-priority queue work', () => {
  const profile = Q.createDefaultProfile({ team: 'Customer Care' });
  const queue = [
    contact('low', { priority: 'P4 - Low', slaDueAt: '2026-11-12T12:00:00.000Z' }),
    contact('urgent', { priority: 'P1 - Urgent', slaDueAt: '2026-11-12T12:00:00.000Z' }),
    contact('near-sla', { priority: 'P2 - High', slaDueAt: '2026-11-12T09:05:00.000Z' })
  ];
  const ranked = Q.routeQueue(queue, profile, { now: baseTime, mode: 'smart' });
  assert.equal(ranked[0].id, 'urgent');
  assert.ok(ranked.find((item) => item.id === 'near-sla').score > ranked.find((item) => item.id === 'low').score);
});

test('SLA status identifies breached, due-soon, at-risk and safe contacts', () => {
  const profile = Q.createDefaultProfile({ team: 'Customer Care' });
  const statuses = [
    contact('breached', { slaDueAt: '2026-11-12T08:59:00.000Z' }),
    contact('soon', { slaDueAt: '2026-11-12T09:10:00.000Z' }),
    contact('risk', { slaDueAt: '2026-11-12T09:45:00.000Z' }),
    contact('safe', { slaDueAt: '2026-11-12T12:00:00.000Z' })
  ].map((item) => Q.scoreContact(item, profile, baseTime));
  assert.deepEqual(statuses.map((item) => item.slaState), ['BREACHED', 'DUE SOON', 'AT RISK', 'WITHIN SLA']);
});

test('older contacts gain queue-age points and remain visible in the ranked list', () => {
  const profile = Q.createDefaultProfile({ team: 'Customer Care' });
  const newer = Q.scoreContact(contact('newer', { createdAt: '2026-11-12T08:50:00.000Z' }), profile, baseTime);
  const older = Q.scoreContact(contact('older', { createdAt: '2026-11-12T07:00:00.000Z' }), profile, baseTime);
  assert.ok(older.waitingMinutes > newer.waitingMinutes);
  assert.ok(older.agePoints > newer.agePoints);
});

test('channel and product skill levels contribute transparently to fit score', () => {
  const low = Q.createDefaultProfile({ team: 'General Enquiries' });
  low.channelSkills.Voice = 1;
  low.productSkills.general = 1;
  const high = Q.createDefaultProfile({ team: 'Customer Care' });
  const item = contact('skill-match');
  assert.ok(Q.scoreContact(item, high, baseTime).score > Q.scoreContact(item, low, baseTime).score);
  assert.equal(Q.scoreContact(item, high, baseTime).skillMatch, true);
  assert.equal(Q.scoreContact(item, low, baseTime).skillMatch, false);
});

test('smart routing produces a human-readable explanation and skill-fit percentage', () => {
  const profile = Q.createDefaultProfile({ team: 'Customer Care' });
  const route = Q.scoreContact(contact('urgent', { priority: 'P1 - Urgent', slaDueAt: '2026-11-12T09:05:00.000Z' }), profile, baseTime);
  assert.match(route.reason, /Urgent P1 priority/);
  assert.match(route.reason, /response target/);
  assert.equal(route.skillFitPct, 100);
  assert.ok(route.score > 1000);
});

test('manual sorting modes preserve their intended ordering', () => {
  const profile = Q.createDefaultProfile({ team: 'Customer Care' });
  const list = [
    contact('recent', { createdAt: '2026-11-12T08:55:00.000Z', priority: 'P3 - Normal' }),
    contact('oldest', { createdAt: '2026-11-12T07:00:00.000Z', priority: 'P4 - Low' }),
    contact('urgent', { priority: 'P1 - Urgent', createdAt: '2026-11-12T08:50:00.000Z' })
  ];
  assert.equal(Q.routeQueue(list, profile, { now: baseTime, mode: 'oldest' })[0].id, 'oldest');
  assert.equal(Q.routeQueue(list, profile, { now: baseTime, mode: 'priority' })[0].id, 'urgent');
});

test('queued contacts only are ranked and contact lookup uses the selected strategy', () => {
  const profile = Q.createDefaultProfile({ team: 'Customer Care' });
  const list = [contact('active', { status: 'Active', priority: 'P1 - Urgent' }), contact('queued')];
  assert.equal(Q.routeQueue(list, profile, { now: baseTime }).length, 1);
  assert.equal(Q.findRoute(list, profile, 'queued', { now: baseTime }).id, 'queued');
  assert.equal(Q.findRoute(list, profile, 'missing', { now: baseTime }), null);
});

test('SLA display clearly distinguishes breached from remaining time', () => {
  const profile = Q.createDefaultProfile({ team: 'Customer Care' });
  const breached = Q.scoreContact(contact('late', { slaDueAt: '2026-11-12T08:55:00.000Z' }), profile, baseTime);
  const active = Q.scoreContact(contact('open', { slaDueAt: '2026-11-12T09:30:00.000Z' }), profile, baseTime);
  assert.match(Q.formatSla(breached), /overdue/);
  assert.match(Q.formatSla(active), /remaining/);
});

test('routing profile storage gracefully handles invalid JSON and unavailable storage', () => {
  const broken = { getItem: () => '{bad', setItem: () => { throw new Error('full'); } };
  assert.equal(Q.loadProfile(broken, { team: 'Customer Care' }).team, 'Customer Care');
  assert.equal(Q.saveProfile(broken, { team: 'Customer Care' }, Q.createDefaultProfile({ team: 'Customer Care' })), false);
  assert.equal(Q.loadProfile(null, { team: 'Customer Care' }).channelSkills.Voice, 3);
});
