import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../js/cc0-office-lobby-integration.js', import.meta.url), 'utf8');
test('retains the named integration used by production-world.js', () => {
  assert.match(source, /export\s+async\s+function\s+integrateCalloriaCC0OfficeLobby\s*\(/);
  assert.match(source, /export\s+const\s+integrateCalloriaCC0Lobby\s*=\s*integrateCalloriaCC0OfficeLobby\s*;/);
});
test('compatibility export aliases the same implementation', () => {
  assert.equal((source.match(/export\s+const\s+integrateCalloriaCC0Lobby\s*=/g) || []).length, 1);
});
