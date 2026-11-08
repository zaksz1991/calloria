import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canReuseCustomerAvatarStage,
  readCustomerAvatarState,
  interpolateCustomerMotion
} from '../js/customer-avatar-lifecycle.js';

test('reuses the existing renderer only for the same selected model', () => {
  const stage = {
    disposed: false,
    renderer: {},
    model: {},
    assetId: 'robbert-visitor'
  };
  assert.equal(canReuseCustomerAvatarStage(stage, ['robbert-visitor', 'ribbert-customer']), true);
  assert.equal(canReuseCustomerAvatarStage(stage, ['ribbert-customer', 'robbert-visitor']), false);
  assert.equal(canReuseCustomerAvatarStage({ ...stage, disposed: true }, ['robbert-visitor']), false);
  assert.equal(canReuseCustomerAvatarStage({ ...stage, renderer: null }, ['robbert-visitor']), false);
});

test('normalizes avatar state from stage data attributes', () => {
  const state = readCustomerAvatarState({
    emotion: '  HOSTILE ',
    reaction: 'Deteriorating',
    persona: 'Irate',
    customer: 'Synthetic Customer',
    session: 'CIL-123'
  });
  assert.deepEqual(state, {
    emotion: 'hostile',
    reaction: 'deteriorating',
    persona: 'irate',
    customer: 'Synthetic Customer',
    session: 'CIL-123'
  });
});

test('supplies safe defaults for missing stage data', () => {
  assert.deepEqual(readCustomerAvatarState({}), {
    emotion: 'calm',
    reaction: 'steady',
    persona: 'calm',
    customer: 'Simulated customer',
    session: ''
  });
});

test('smooth motion interpolation advances toward a changed reaction profile', () => {
  const current = { headForward: 0, headTilt: 0, spine: 0, leftArm: 0, rightArm: 0, energy: 0.5 };
  const target = { headForward: 0.08, headTilt: 0.04, spine: 0.03, leftArm: 0.05, rightArm: 0.05, energy: 0.9 };
  const next = interpolateCustomerMotion(current, target, 1 / 30);
  assert.ok(next.headForward > current.headForward);
  assert.ok(next.headForward < target.headForward);
  assert.ok(next.energy > current.energy);
  assert.ok(next.energy < target.energy);
});

test('interpolation clamps large frame deltas and preserves finite values', () => {
  const current = { headForward: 0, headTilt: 0, spine: 0, leftArm: 0, rightArm: 0, energy: 0.5 };
  const target = { headForward: 0.1, headTilt: 0.1, spine: 0.1, leftArm: 0.1, rightArm: 0.1, energy: 1 };
  const next = interpolateCustomerMotion(current, target, 10);
  for (const value of Object.values(next)) assert.ok(Number.isFinite(value));
  assert.ok(next.headForward < target.headForward);
});
