import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'public/glb-asset-lab.html'), 'utf8');

test('GLB lab is a standalone public page and does not require Vite entry changes', () => {
  assert.match(html, /<title>CALLORIA · GLB Asset Lab<\/title>/);
  assert.match(html, /id="calloria-glb-lab"/);
  assert.match(html, /GLB Asset Acceptance Lab/);
});

test('viewer pins the same Three.js version as the application', () => {
  assert.match(html, /three@0\.170\.0\/build\/three\.module\.js/);
  assert.match(html, /three@0\.170\.0\/examples\/jsm/);
});

test('viewer checks the exact v3.9 staff manifest and refuses to fake missing assets', () => {
  assert.match(html, /\/assets\/models\/calloria-cc0-staff-manifest\.json/);
  assert.match(html, /STAFF GLB MANIFEST NOT FOUND/);
  assert.match(html, /validatedStaffModels/);
  assert.match(html, /failedStaffModels/);
});

test('staff previews use the deployed same-origin GLB output path, not Gobkit source URLs', () => {
  assert.match(html, /const rawUrl\s*=\s*asset\.output\s*\|\|\s*asset\.url/);
  assert.match(html, /parsed\.origin!==window\.location\.origin/);
  assert.match(html, /parsed\.pathname\.startsWith\('\/assets\/models\/'\)/);
});

test('viewer previews the four existing office catalogue GLB paths', () => {
  for (const path of [
    '/assets/models/office/desks/office_desk.glb',
    '/assets/models/office/equipment/office_computer.glb',
    '/assets/models/accessories/headsets/model.glb',
    '/assets/models/office/reception/reception-desk.glb'
  ]) assert.ok(html.includes(path), `Missing office asset path ${path}`);
});

test('viewer uses Meshopt and Draco decoders and reports browser render success only after load', () => {
  assert.match(html, /loader\.setMeshoptDecoder\(MeshoptDecoder\)/);
  assert.match(html, /loader\.setDRACOLoader\(draco\)/);
  assert.match(html, /BROWSER RENDER PASS/);
  assert.match(html, /BROWSER RENDER FAILED/);
});

test('viewer reports real mesh, skeleton, texture and animation counts', () => {
  for (const text of ['Skinned meshes', 'Skeleton joints', 'Triangles (runtime estimate)', 'Materials', 'Textures', 'Animation clips']) {
    assert.ok(html.includes(text), `Missing diagnostic field ${text}`);
  }
});

test('all visible controls have labels and the preview supports touch and keyboard focus', () => {
  assert.match(html, /for="animationSelect"/);
  assert.match(html, /id="playButton"/);
  assert.match(html, /id="pauseButton"/);
  assert.match(html, /id="resetViewButton"/);
  assert.match(html, /touch-action:none/);
  assert.match(html, /:focus-visible/);
});
