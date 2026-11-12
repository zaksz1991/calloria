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

test('v6.24 adds explicit production and natural-scale preview modes', () => {
  assert.match(html, /id="fitMode"/);
  assert.match(html, /value="production" selected>Production fit/);
  assert.match(html, /value="natural">Natural asset size/);
  assert.match(html, /value="staff">Standing staff · 1\.72 m/);
  assert.match(html, /fitMode'\)\.addEventListener\('change'/);
});

test('office preview fit targets mirror the production GLB placement envelopes', () => {
  for (const target of [
    "'office-desk':Object.freeze({x:2.60,y:0.98,z:1.28})",
    "'office-computer':Object.freeze({x:0.88,y:0.78,z:0.48})",
    "'headset-model':Object.freeze({x:0.30,y:0.30,z:0.30})",
    "'reception-desk':Object.freeze({x:5.05,y:1.42,z:1.45})"
  ]) assert.ok(html.includes(target), `Missing production fit target ${target}`);
  assert.match(html, /Math\.min\(target\.x\/Math\.max\(size\.x/);
});

test('preview reports original and fitted dimensions without changing deployment assets', () => {
  assert.match(html, /Original dimensions/);
  assert.match(html, /Preview dimensions/);
  assert.match(html, /Scale factor/);
  assert.match(html, /Fit rule/);
  assert.match(html, /does not alter gameplay/);
});
