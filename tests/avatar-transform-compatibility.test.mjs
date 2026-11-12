import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'js/world-player-avatar.js'), 'utf8');
const anchors = new Map([
  ['animation pattern map', '  run: /run|running|sprint/i\n});'],
  ['run clip lookup', '  const runClip = findClip(clips, CLIP_PATTERNS.run);'],
  ['update signature', "    update({ x = 0, z = 0, yaw = 0, moving = false, sprinting = false, delta = 0 } = {}) {"],
  ['animation selection expression', '        const desired = moving ? (sprinting && runClip ? runClip : walkClip || runClip || idleClip) : (idleClip || (walkClip ? null : clips[0]));']
]);

test('v2.5 workstation transform anchors each occur exactly once', () => {
  for (const [label, anchor] of anchors) {
    const count = source.split(anchor).length - 1;
    assert.equal(count, 1, `${label}: expected 1 anchor, found ${count}`);
  }
});

test('restored player module retains a complete avatar factory', () => {
  assert.match(source, /export async function createCalloriaPlayerAvatar\(/);
  assert.match(source, /return \{/);
  assert.match(source, /dispose\(\)/);
});
