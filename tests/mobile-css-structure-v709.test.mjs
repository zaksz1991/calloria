import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../calloria-first-shift-mentor-v709.css', import.meta.url), 'utf8');
test('mentor stylesheet has balanced braces and mobile breakpoints', () => {
  let depth = 0;
  for (const char of css) {
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    assert.ok(depth >= 0, 'unexpected closing brace');
  }
  assert.equal(depth, 0, 'unclosed CSS block');
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /@media\s*\(max-width:\s*360px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /min-height:\s*46px/);
});

test('mentor panel is responsive and avoids forced page-width overflow', () => {
  assert.match(css, /min-width:\s*0/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
});
