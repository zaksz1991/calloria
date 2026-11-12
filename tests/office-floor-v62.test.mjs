import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const E = require(path.join(root, 'public', 'office-floor-engine.js'));
const html = await readFile(path.join(root, 'public', 'office-floor.html'), 'utf8');
const officeJs = await readFile(path.join(root, 'public', 'office-floor.js'), 'utf8');
const liveHtml = await readFile(path.join(root, 'public', 'live-floor.html'), 'utf8');
const liveJs = await readFile(path.join(root, 'public', 'live-floor.js'), 'utf8');

function storage(values = {}) {
  return { getItem(key) { return Object.hasOwn(values, key) ? values[key] : null; } };
}

test('v6.2 engine reports its version and reads the v6.0/v6.1 storage keys', () => {
  assert.equal(E.VERSION, '6.2.0');
  assert.equal(E.FLOOR_STORAGE_KEY, 'calloria.live-floor.v60');
  assert.equal(E.CAREER_STORAGE_KEY, 'calloria.career-progression.v61');
});

test('five GLB asset roles have ordered, local asset candidates', () => {
  for (const role of ['desk', 'computer', 'agentFemale', 'agentMale', 'supervisor']) {
    const paths = E.getAssetPaths(role);
    assert.ok(paths.length >= 3, `${role} should have multiple filename candidates`);
    assert.ok(paths.every((entry) => entry.startsWith('/assets/models/')));
  }
});

test('asset path lookup rejects unknown roles', () => {
  assert.deepEqual(E.getAssetPaths('unknown'), []);
});

test('workplace directory has four distinct customer-care stations', () => {
  assert.equal(E.STATIONS.length, 4);
  assert.equal(new Set(E.STATIONS.map((station) => station.id)).size, 4);
  assert.deepEqual(E.STATIONS.map((station) => station.team), ['Customer Care', 'Digital Support', 'Technical Support', 'Service Recovery']);
});

test('station coordinates remain inside the floor walking boundary', () => {
  for (const station of E.STATIONS) {
    assert.ok(Math.abs(station.x) < 17.6);
    assert.ok(Math.abs(station.z) < 11.2);
  }
});

test('empty browser storage returns a safe guest snapshot', () => {
  const snapshot = E.getFloorSnapshot(storage());
  assert.equal(snapshot.installed, false);
  assert.equal(snapshot.status, 'Not signed in');
  assert.equal(snapshot.rank, 'New Starter');
  assert.equal(snapshot.contacts, 0);
});

test('stored v6.0 shift is read without modifying the source record', () => {
  const shift = { status: 'On shift', agentName: 'Nora Agent', team: 'Digital Support', minutes: 615, date: '2026-11-12' };
  const record = { shift, metrics: { completed: 7 }, active: null };
  const snapshot = E.getFloorSnapshot(storage({ [E.FLOOR_STORAGE_KEY]: JSON.stringify(record) }));
  assert.equal(snapshot.installed, true);
  assert.equal(snapshot.agentName, 'Nora Agent');
  assert.equal(snapshot.team, 'Digital Support');
  assert.equal(snapshot.clock, '10:15');
  assert.equal(snapshot.contacts, 7);
  assert.equal(record.shift.minutes, 615);
});

test('malformed shift JSON is handled without throwing', () => {
  const snapshot = E.getFloorSnapshot(storage({ [E.FLOOR_STORAGE_KEY]: '{invalid' }));
  assert.equal(snapshot.installed, false);
});

test('career rank is matched to the current employee and team profile', () => {
  const agentName = 'Nora Agent';
  const team = 'Digital Support';
  const key = E.profileKey(agentName, team);
  const career = { version: 61, profiles: { [key]: { totalXp: 820 } } };
  const floor = { shift: { status: 'On shift', agentName, team, minutes: 500 }, metrics: {}, active: null };
  const snapshot = E.getFloorSnapshot(storage({
    [E.FLOOR_STORAGE_KEY]: JSON.stringify(floor),
    [E.CAREER_STORAGE_KEY]: JSON.stringify(career)
  }));
  assert.equal(snapshot.rank, 'Skilled Associate');
  assert.equal(snapshot.xp, 820);
});

test('a profile from another employee does not leak into the current floor HUD', () => {
  const career = { version: 61, profiles: { [E.profileKey('Other Person', 'Customer Care')]: { totalXp: 9000 } } };
  const floor = { shift: { status: 'Off duty', agentName: 'Nora Agent', team: 'Digital Support', minutes: 450 }, metrics: {}, active: null };
  const snapshot = E.getFloorSnapshot(storage({ [E.FLOOR_STORAGE_KEY]: JSON.stringify(floor), [E.CAREER_STORAGE_KEY]: JSON.stringify(career) }));
  assert.equal(snapshot.rank, 'New Starter');
  assert.equal(snapshot.xp, 0);
});

test('active customer interaction is reflected in the office HUD snapshot', () => {
  const floor = { shift: { status: 'On shift', agentName: 'Amina', team: 'Customer Care', minutes: 480 }, metrics: { completed: 1 }, active: { contactId: 'CT-1' } };
  const snapshot = E.getFloorSnapshot(storage({ [E.FLOOR_STORAGE_KEY]: JSON.stringify(floor) }));
  assert.equal(snapshot.activeContact, true);
});

test('rank calculation handles top rank and XP below zero', () => {
  assert.equal(E.getRank(99999).current.name, 'Leadership Ready');
  assert.equal(E.getRank(-10).totalXp, 0);
});

test('nearest workstation is selected only inside the interaction radius', () => {
  const first = E.STATIONS[0];
  assert.equal(E.nearestStation(E.STATIONS, { x: first.x, z: first.z }, 2.75).id, first.id);
  assert.equal(E.nearestStation(E.STATIONS, { x: 0, z: 11 }, 2.75), null);
});

test('nearest workstation returns distance and selects the closest of two', () => {
  const result = E.nearestStation(E.STATIONS, { x: -4.5, z: -1.8 }, 3);
  assert.equal(result.id, 'DS-02');
  assert.equal(result.distance, 2.1);
});

test('XZ distance ignores camera height', () => {
  assert.equal(E.distanceXZ({ x: 0, z: 0, y: 100 }, { x: 3, z: 4, y: -100 }), 5);
});

test('workstation cannot open without both physical desk and computer GLBs', () => {
  assert.equal(E.stationIsUsable({ desk: true, computer: true }), true);
  assert.equal(E.stationIsUsable({ desk: { loaded: true }, computer: { loaded: true } }), true);
  assert.equal(E.stationIsUsable({ desk: { loaded: true }, computer: { loaded: false } }), false);
  assert.equal(E.stationIsUsable({ desk: { loaded: false }, computer: { loaded: true } }), false);
  assert.equal(E.stationIsUsable({ desk: true, computer: false }), false);
  assert.equal(E.stationIsUsable({ desk: false, computer: true }), false);
  assert.equal(E.stationIsUsable({ desk: false, computer: false }), false);
});

test('asset summary counts only confirmed loaded models', () => {
  const summary = E.assetSummary({ desk: { loaded: true }, computer: { loaded: true }, agent: { loaded: false } });
  assert.deepEqual(summary, { loaded: 2, total: 3, complete: false });
});

test('office page pins the Three.js version and uses GLTFLoader plus skeleton-safe cloning', () => {
  assert.match(html, /three@0\.170\.0/);
  assert.match(officeJs, /GLTFLoader/);
  assert.match(officeJs, /cloneSkeleton/);
  assert.match(officeJs, /loader\.load\(path/);
});

test('office page links to the playable Live Floor route', () => {
  assert.match(html, /href="\/live-floor\.html"/);
  assert.match(officeJs, /\/live-floor\.html\?fromOffice=1/);
});

test('Live Floor provides a return route to the 3D workplace', () => {
  assert.match(liveHtml, /href="\/office-floor\.html"/);
  assert.match(liveHtml, /BUILD 6\.2/);
});

test('Live Floor preselects the team supplied by the workstation', () => {
  assert.match(liveJs, /officeParams\.get\('fromOffice'\)/);
  assert.match(liveJs, /officeParams\.get\('team'\)/);
  assert.match(liveJs, /teamSelect\.value = requestedTeam/);
});

test('office floor does not create primitive human placeholder characters', () => {
  assert.doesNotMatch(officeJs, /new THREE\.(BoxGeometry|CapsuleGeometry|CylinderGeometry).*agent/i);
  assert.match(officeJs, /assets\[station\.model\]/);
});

test('workstation access is blocked if the required GLB furniture failed to load', () => {
  assert.match(officeJs, /stationIsUsable\(assetStatus\)/);
  assert.match(officeJs, /WORKSTATION UNAVAILABLE/);
});

test('desktop and mobile movement controls are provided', () => {
  assert.match(html, /data-move="forward"/);
  assert.match(html, /id="mobile-interact"/);
  assert.match(officeJs, /requestPointerLock/);
  assert.match(officeJs, /pointermove/);
});

test('office page references the new CSS and renderer modules', () => {
  assert.match(html, /href="\/office-floor\.css"/);
  assert.match(html, /src="\/office-floor\.js"/);
  assert.match(html, /id="world-root"/);
});

test('both updated HTML pages have unique element IDs', () => {
  for (const page of [html, liveHtml]) {
    const ids = [...page.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, 'duplicate ID detected');
  }
});
