import test from 'node:test';
import assert from 'node:assert/strict';
import { getCustomerMotionProfile, chooseApprovedCustomerAsset, chooseApprovedCustomerAssets, validateCustomerRigMetrics } from '../js/customer-avatar-profile.js';

test('customer expression responds to emotion and agent outcome', () => {
  const calm = getCustomerMotionProfile('happy', 'improving');
  const angry = getCustomerMotionProfile('angry', 'deteriorating');
  assert.ok(angry.headForward > calm.headForward);
  assert.ok(angry.energy > 0);
  assert.ok(Number.isFinite(calm.leftArm));
});

test('customer asset selection requires explicit inspector approval', () => {
  assert.equal(chooseApprovedCustomerAsset([], 'CIL-123'), null);
  const ordered = chooseApprovedCustomerAssets(['robbert-visitor', 'ribbert-customer'], 'CIL-123');
  assert.equal(ordered.length, 2);
  assert.ok(['robbert-visitor', 'ribbert-customer'].includes(chooseApprovedCustomerAsset(['robbert-visitor', 'ribbert-customer'], 'CIL-123')));
});

test('customer rig metrics reject heavy, unrigged and non-human-scale assets', () => {
  const good = validateCustomerRigMetrics({
    size: { x: 0.55, y: 1.72, z: 0.42 }, skinnedMeshCount: 1,
    skeletonCount: 1, boneCount: 52, triangleCount: 42000,
    meshCount: 18, maxTextureEdge: 2048
  });
  assert.equal(good.compatible, true);
  const bad = validateCustomerRigMetrics({
    size: { x: 0.55, y: 1.72, z: 0.42 }, skinnedMeshCount: 0,
    skeletonCount: 0, boneCount: 0, triangleCount: 240000,
    meshCount: 140, maxTextureEdge: 8192
  });
  assert.equal(bad.compatible, false);
  assert.ok(bad.reasons.length >= 3);
});
