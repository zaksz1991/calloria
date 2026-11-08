/**
 * CALLORIA customer visitors for the production 3D workplace.
 * Reuses the production world's existing Three.js scene and render loop.
 * Approved customer GLBs now follow a reception queue, service, escalation
 * and departure journey driven by Customer Intelligence events.
 */
import * as THREE from 'three';
import { CalloriaGLBAssetLoader, inspectGLTFAsset } from './glb-asset-loader.js';
import { chooseApprovedCustomerAssets, validateCustomerRigMetrics, getCustomerMotionProfile } from './customer-avatar-profile.js';
import { CustomerReceptionJourney, CUSTOMER_JOURNEY_STATES } from './customer-reception-journey.js';

const APPROVAL_KEY = 'calloria.glb-inspector.v1';
const REACTION_EVENT = 'calloria:customer-reaction';
const COMMAND_EVENT = 'calloria:customer-world-command';
const STATE_EVENT = 'calloria:customer-world-state';
const SUPERVISOR_EVENT = 'calloria:customer-supervisor-requested';
const loader = new CalloriaGLBAssetLoader();

function approvedIds() {
  try {
    const state = JSON.parse(localStorage.getItem(APPROVAL_KEY) || '{}');
    return Array.isArray(state.approvedAssetIds) ? state.approvedAssetIds : [];
  } catch {
    return [];
  }
}

function makeRig(root) {
  const bones = { head: null, neck: null, spine: null, leftArm: null, rightArm: null, leftLeg: null, rightLeg: null };
  const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const side = (name) => name.includes('left') || name.startsWith('l') || name.endsWith('l')
    ? 'left'
    : name.includes('right') || name.startsWith('r') || name.endsWith('r') ? 'right' : '';
  root.traverse((object) => {
    if (!object.isBone) return;
    const name = normalize(object.name);
    if (!bones.head && name.includes('head')) bones.head = object;
    if (!bones.neck && name.includes('neck')) bones.neck = object;
    if (!bones.spine && /(upperchest|chest|spine2|spine1|spine)/.test(name)) bones.spine = object;
    if (/(upperarm|shoulder|arm)/.test(name)) {
      const which = side(name);
      if (which === 'left' && !bones.leftArm) bones.leftArm = object;
      if (which === 'right' && !bones.rightArm) bones.rightArm = object;
    }
    if (/(upleg|upperleg|thigh)/.test(name)) {
      const which = side(name);
      if (which === 'left' && !bones.leftLeg) bones.leftLeg = object;
      if (which === 'right' && !bones.rightLeg) bones.rightLeg = object;
    }
  });
  const save = (bone) => bone ? { bone, x: bone.rotation.x, y: bone.rotation.y, z: bone.rotation.z } : null;
  return {
    head: save(bones.head), neck: save(bones.neck), spine: save(bones.spine),
    leftArm: save(bones.leftArm), rightArm: save(bones.rightArm),
    leftLeg: save(bones.leftLeg), rightLeg: save(bones.rightLeg)
  };
}

function matchingClip(clips, emotion = 'calm', moving = false) {
  if (moving) {
    const walk = clips.find((clip) => /walk|walking|locomotion|run/i.test(String(clip.name || '')));
    if (walk) return walk;
  }
  const patterns = {
    angry: /angry|frustrat|complain|argue/i,
    hostile: /angry|frustrat|complain|argue/i,
    happy: /happy|smile|joy/i,
    playful: /happy|wave|talk|gesture/i,
    confused: /confus|think|question/i,
    anxious: /nervous|worried|anxious/i,
    distressed: /sad|cry|distress|worried/i,
    suspicious: /guard|skeptic|question/i,
    skeptical: /guard|skeptic|question/i,
    urgent: /urgent|impatient|talk|speak/i,
    talkative: /talk|speak|conversation/i
  };
  const preferred = patterns[emotion] || /idle|stand|wait|listen/i;
  return clips.find((clip) => preferred.test(String(clip.name || '')))
    || clips.find((clip) => /idle|stand|wait|listen|talk|conversation/i.test(String(clip.name || '')))
    || null;
}

function dimensionsOf(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  return { box, size: { x: size.x, y: size.y, z: size.z } };
}

function applyProfile(rig, profile, elapsed, phase, moving = false) {
  const breath = Math.sin(elapsed * 1.45 + phase) * 0.006;
  const attention = Math.sin(elapsed * 0.72 + phase + 0.6);
  const gait = moving ? Math.sin(elapsed * 8.2 + phase) : 0;
  const apply = (entry, dx = 0, dy = 0, dz = 0) => {
    if (!entry?.bone) return;
    entry.bone.rotation.set(entry.x + dx, entry.y + dy, entry.z + dz);
  };
  apply(rig.head, profile.headForward + Math.sin(elapsed * 1.1 + phase) * 0.009, attention * 0.022, 0);
  apply(rig.neck, 0, attention * 0.009, 0);
  apply(rig.spine, profile.spine + breath + (moving ? Math.abs(gait) * 0.012 : 0), 0, breath * 0.35);
  apply(rig.leftArm, moving ? gait * 0.16 : 0, 0, profile.leftArm + breath * 0.8);
  apply(rig.rightArm, moving ? -gait * 0.16 : 0, 0, profile.rightArm - breath * 0.8);
  apply(rig.leftLeg, moving ? -gait * 0.34 : 0, 0, 0);
  apply(rig.rightLeg, moving ? gait * 0.34 : 0, 0, 0);
}

function getCustomerCount(tier) {
  if (tier === 'low') return 1;
  if (tier === 'high') return 2;
  return 1;
}

export async function attachCalloriaWorldCustomers({ scene, tier = 'balanced' } = {}) {
  if (!scene?.add || !scene?.remove) throw new TypeError('CALLORIA customer visitors require the existing production Three.js scene.');
  const approved = approvedIds();
  const candidates = chooseApprovedCustomerAssets(approved, `reception-${Date.now()}`);
  const maxCustomers = getCustomerCount(tier);
  const customerModels = [];
  const visitors = [];
  const rejected = [];
  const bufferedReactions = [];
  let disposed = false;
  let elapsed = 0;
  let reactionListener = null;
  let commandListener = null;
  let journey = null;
  let currentReaction = { emotion: 'calm', reaction: 'steady' };

  if (!candidates.length) {
    const status = {
      loaded: 0,
      reason: 'No customer/visitor model has been approved in the GLB Asset Inspector.',
      mode: 'existing-reception-without-unapproved-customers',
      tier
    };
    return { status, update() {}, dispose() {} };
  }

  function publishState(detail) {
    window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail }));
  }

  function playVisitorAnimation(visitor) {
    if (!visitor.mixer) return;
    const entry = customerModels.find((item) => item.assetId === visitor.assetId);
    const moving = visitor.state === CUSTOMER_JOURNEY_STATES.APPROACHING || visitor.state === CUSTOMER_JOURNEY_STATES.DEPARTING;
    const clip = matchingClip(entry?.loaded.animations || [], visitor.emotion, moving);
    if (!clip || visitor.action?.getClip?.() === clip) return;
    const nextAction = visitor.mixer.clipAction(clip);
    nextAction.reset().play();
    if (visitor.action) nextAction.crossFadeFrom(visitor.action, 0.3, false);
    visitor.action = nextAction;
    visitor.animationName = clip.name || 'Unnamed customer clip';
  }

  function updateVisitorReaction(visitor, detail) {
    const status = String(detail.status || 'active').toLowerCase();
    let emotion = String(detail.emotion || 'calm').toLowerCase();
    let reaction = String(detail.reaction || 'steady').toLowerCase();
    if (status === 'escalated') {
      emotion = 'angry';
      reaction = 'deteriorating';
    } else if (status === 'completed' && reaction === 'improving') {
      emotion = 'happy';
    }
    visitor.emotion = emotion;
    visitor.reaction = reaction;
    visitor.patience = detail.patience ?? visitor.patience;
    visitor.profile = getCustomerMotionProfile(emotion, reaction);
    playVisitorAnimation(visitor);
  }

  function setReaction(detail = {}) {
    if (disposed) return;
    currentReaction = {
      emotion: String(detail.emotion || 'calm').toLowerCase(),
      reaction: String(detail.reaction || 'steady').toLowerCase()
    };
    if (journey) {
      journey.handleReaction(detail);
      const visitor = journey.snapshot.find((item) => item.scenarioId === detail.scenarioId);
      const liveVisitor = visitors.find((item) => item.scenarioId === detail.scenarioId);
      if (liveVisitor) updateVisitorReaction(liveVisitor, detail);
    } else {
      bufferedReactions.push(detail);
      if (bufferedReactions.length > 24) bufferedReactions.shift();
    }
  }

  reactionListener = (event) => setReaction(event?.detail || {});
  commandListener = (event) => journey?.handleCommand(event?.detail || {});
  window.addEventListener(REACTION_EVENT, reactionListener);
  window.addEventListener(COMMAND_EVENT, commandListener);

  for (const assetId of candidates.slice(0, maxCustomers)) {
    try {
      const loaded = await loader.load(assetId);
      const report = inspectGLTFAsset(loaded);
      const metrics = {
        size: report.dimensions || {},
        meshCount: report.meshCount,
        skinnedMeshCount: report.skinnedMeshCount,
        skeletonCount: report.skeletonCount,
        boneCount: report.boneCount,
        triangleCount: report.triangleCount,
        maxTextureEdge: Math.max(0, ...(report.textures || []).flatMap((item) => [item.width || 0, item.height || 0]))
      };
      const validation = validateCustomerRigMetrics(metrics);
      if (!validation.compatible) {
        rejected.push({ assetId, reasons: validation.reasons });
        continue;
      }
      customerModels.push({ assetId, loaded, report });
    } catch (error) {
      rejected.push({ assetId, reasons: [String(error?.message || error)] });
    }
  }

  if (!customerModels.length) {
    window.removeEventListener(REACTION_EVENT, reactionListener);
    window.removeEventListener(COMMAND_EVENT, commandListener);
    loader.disposeAll();
    return {
      status: { loaded: 0, rejected, reason: 'No approved customer models passed runtime validation.', tier },
      update() {},
      dispose() {}
    };
  }

  const visibleCount = Math.min(maxCustomers, customerModels.length, 2);
  for (let index = 0; index < visibleCount; index += 1) {
    const entry = customerModels[index];
    const source = loader.clone(entry.assetId);
    const { size } = dimensionsOf(source);
    const originalHeight = Math.max(0.001, size.y);
    source.scale.multiplyScalar(1.66 / originalHeight);
    source.updateMatrixWorld(true);
    const scaled = new THREE.Box3().setFromObject(source);
    const center = scaled.getCenter(new THREE.Vector3());
    source.position.x -= center.x;
    source.position.z -= center.z;
    source.position.y -= scaled.min.y;

    const wrapper = new THREE.Group();
    wrapper.name = `calloria-reception-customer-${entry.assetId}-${index + 1}`;
    wrapper.add(source);
    scene.add(wrapper);

    const mixer = entry.loaded.animations.length ? new THREE.AnimationMixer(source) : null;
    const visitor = {
      assetId: entry.assetId,
      wrapper,
      source,
      mixer,
      action: null,
      rig: makeRig(source),
      emotion: currentReaction.emotion,
      reaction: currentReaction.reaction,
      profile: getCustomerMotionProfile(currentReaction.emotion, currentReaction.reaction),
      phase: index * 1.9,
      animationName: 'CALLORIA bone-aware waiting idle',
      patience: null,
      turn: 0,
      scenarioId: null,
      state: CUSTOMER_JOURNEY_STATES.WAITING
    };
    visitors.push(visitor);
  }

  journey = new CustomerReceptionJourney(visitors, {
    onStateChange: (detail, visitor) => {
      if (visitor) playVisitorAnimation(visitor);
      publishState(detail);
    },
    onEscalation: (detail) => {
      window.dispatchEvent(new CustomEvent(SUPERVISOR_EVENT, { detail }));
    }
  });

  for (const detail of bufferedReactions) {
    journey.handleReaction(detail);
    const visitor = visitors.find((item) => item.scenarioId === detail.scenarioId);
    if (visitor) updateVisitorReaction(visitor, detail);
  }
  bufferedReactions.length = 0;

  const status = {
    loaded: visitors.length,
    assetsInUse: [...new Set(visitors.map((visitor) => visitor.assetId))],
    animationsInUse: visitors.map((visitor) => ({ assetId: visitor.assetId, clip: visitor.animationName })),
    rejected,
    tier,
    journey: 'queue-approach-service-supervisor-escalation-departure',
    mode: 'approved-customer-glbs-in-production-reception'
  };
  window.dispatchEvent(new CustomEvent('calloria:customer-world-ready', { detail: status }));

  return {
    status,
    update(delta) {
      if (disposed) return;
      const step = Math.max(0, Math.min(Number(delta) || 0, 0.05));
      if (!step) return;
      elapsed += step;
      journey?.update(step);
      for (const visitor of visitors) {
        visitor.mixer?.update(step);
        const moving = visitor.state === CUSTOMER_JOURNEY_STATES.APPROACHING || visitor.state === CUSTOMER_JOURNEY_STATES.DEPARTING;
        applyProfile(visitor.rig, visitor.profile, elapsed, visitor.phase, moving);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (reactionListener) window.removeEventListener(REACTION_EVENT, reactionListener);
      if (commandListener) window.removeEventListener(COMMAND_EVENT, commandListener);
      journey?.dispose();
      for (const visitor of visitors) {
        visitor.mixer?.stopAllAction();
        scene.remove(visitor.wrapper);
      }
      visitors.length = 0;
      loader.disposeAll();
    }
  };
}
