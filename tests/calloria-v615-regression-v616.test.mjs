import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../js/glb-office-world-integration.js', import.meta.url), 'utf8');

test('v6.15 Draco loader remains configured after chair activation', () => {
  assert.match(source, /import \{ DRACOLoader \} from 'three\/addons\/loaders\/DRACOLoader\.js'/);
  assert.match(source, /dracoLoader\.setDecoderPath\(dracoDecoderPath\)/);
  assert.match(source, /dracoLoader\.setDecoderConfig\(\{ type: 'wasm' \}\)/);
  assert.match(source, /loader\.setDRACOLoader\(dracoLoader\)/);
});

test('v6.15 Meshopt decoder remains configured', () => {
  assert.match(source, /import \{ MeshoptDecoder \} from 'three\/addons\/libs\/meshopt_decoder\.module\.js'/);
  assert.equal([...source.matchAll(/loader\.setMeshoptDecoder\(MeshoptDecoder\)/g)].length, 1);
});

test('office asset placement plan and legacy Vite transform source anchors remain unchanged', () => {
  assert.match(source, /const preferred = safeTier === 'low' \? \[10\] : safeTier === 'high' \? \[8, 9, 10, 11\] : \[9, 10\]/);
  assert.match(source, /headsetStationIndexes: safeTier === 'low' \? \[\] : \[\.\.\.deskStationIndexes\]/);
  assert.match(source, /includeReceptionDesk: safeTier !== 'low'/);
  assert.match(source, /officeObjectsPlaced: officePlacedCount/);
});
