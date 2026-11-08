import * as THREE from 'three';
import { CalloriaGLBAssetLoader, inspectGLTFAsset } from './glb-asset-loader.js';
import { validateCustomerRigMetrics } from './customer-avatar-profile.js';
import {
  SUPERVISOR_PHASES,
  createSupervisorQueue,
  enqueueSupervisorEscalation,
  beginNextSupervisorIntervention,
  setSupervisorPhase,
  finishSupervisorIntervention,
  disposeSupervisorQueue
} from './supervisor-intervention-core.js';
import '../styles/calloria-supervisor-intervention.css';

const APPROVAL_KEY = 'calloria.glb-inspector.v1';
const REACTION_EVENT = 'calloria:customer-reaction';
const COMMAND_EVENT = 'calloria:supervisor-command';
const STATE_EVENT = 'calloria:supervisor-intervention-state';
const PREFERRED_SUPERVISORS = ['office-female-supervisor', 'bad-supervisor'];

const OFFICE_START = { x: 13.1, y: 0, z: 0.65 };
const OFFICE_TO_RECEPTION = [
  { x: 9.0, y: 0, z: 2.0 },
  { x: 8.7, y: 0, z: 8.8 },
  { x: 1.0, y: 0, z: 9.1 },
  { x: -8.0, y: 0, z: 9.1 },
  { x: -12.1, y: 0, z: 10.6 },
  { x: -15.9, y: 0, z: 12.8 },
  { x: -17.0, y: 0, z: 13.2 }
];
const RECEPTION_TO_OFFICE = [...OFFICE_TO_RECEPTION.slice(0, -1).reverse(), OFFICE_START];
const WALK_SPEED = 2.15;

function readApprovals() {
  try {
    const state = JSON.parse(localStorage.getItem(APPROVAL_KEY) || '{}');
    return Array.isArray(state.approvedAssetIds) ? state.approvedAssetIds : [];
  } catch {
    return [];
  }
}

function emit(type, detail) {
  if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') return;
  window.dispatchEvent(new CustomEvent(type, { detail }));
}

function findRig(root) {
  const bones = { head: null, spine: null, leftLeg: null, rightLeg: null };
  const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const side = (name) => name.includes('left') || name.startsWith('l') ? 'left'
    : name.includes('right') || name.startsWith('r') ? 'right' : '';
  root.traverse((object) => {
    if (!object.isBone) return;
    const name = normalize(object.name);
    if (!bones.head && name.includes('head')) bones.head = object;
    if (!bones.spine && /(spine|chest|upperchest)/.test(name)) bones.spine = object;
    if (/(thigh|upleg|upperleg|leg)/.test(name)) {
      const which = side(name);
      if (which === 'left' && !bones.leftLeg) bones.leftLeg = object;
      if (which === 'right' && !bones.rightLeg) bones.rightLeg = object;
    }
  });
  return Object.fromEntries(Object.entries(bones).map(([key, bone]) => [key, bone ? {
    bone, x: bone.rotation.x, y: bone.rotation.y, z: bone.rotation.z
  } : null]));
}

function chooseClip(clips, pattern) {
  return (clips || []).find((clip) => pattern.test(String(clip.name || ''))) || null;
}

function safeDisposeClone(root) {
  // Geometry/material/texture resources are owned by the shared loader cache.
  // Only detach the cloned hierarchy here; loader.disposeAll() releases source resources.
  root?.parent?.remove(root);
}

function createControlPanel() {
  if (typeof document === 'undefined' || !document.body) return { show() {}, hide() {}, dispose() {} };
  const panel = document.createElement('section');
  panel.className = 'calloria-supervisor-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'status');
  panel.setAttribute('aria-live', 'polite');
  const title = document.createElement('strong');
  title.className = 'calloria-supervisor-panel__title';
  title.textContent = 'SUPERVISOR ASSISTANCE';
  const message = document.createElement('p');
  message.className = 'calloria-supervisor-panel__message';
  const actions = document.createElement('div');
  actions.className = 'calloria-supervisor-panel__actions';
  const resolve = document.createElement('button');
  resolve.type = 'button';
  resolve.textContent = 'Record supervisor review';
  resolve.dataset.supervisorAction = 'resolve';
  const resume = document.createElement('button');
  resume.type = 'button';
  resume.textContent = 'Return case to agent';
  resume.dataset.supervisorAction = 'resume';
  const inspector = document.createElement('a');
  inspector.href = '/asset-inspector.html';
  inspector.textContent = 'Review supervisor model';
  inspector.hidden = true;
  actions.append(resolve, resume);
  panel.append(title, message, actions, inspector);
  document.body.append(panel);
  let scenarioId = null;
  const click = (event) => {
    const button = event.target.closest('button[data-supervisor-action]');
    if (!button || !scenarioId) return;
    button.disabled = true;
    emit(COMMAND_EVENT, { scenarioId, action: button.dataset.supervisorAction });
  };
  panel.addEventListener('click', click);
  return {
    show(detail) {
      scenarioId = detail.scenarioId || null;
      panel.hidden = false;
      message.textContent = detail.state === 'unavailable'
        ? 'A compatible approved supervisor GLB is required. Approve Office Female Supervisor in the Asset Inspector.'
        : detail.state === 'arrived'
          ? 'Supervisor has arrived at reception. Select the next action.'
          : detail.message || 'Supervisor intervention is in progress.';
      inspector.hidden = detail.state !== 'unavailable';
      resolve.disabled = false;
      resume.disabled = false;
      actions.hidden = detail.state === 'unavailable';
    },
    hide() {
      scenarioId = null;
      panel.hidden = true;
      resolve.disabled = false;
      resume.disabled = false;
      actions.hidden = false;
    },
    dispose() {
      panel.removeEventListener('click', click);
      panel.remove();
      scenarioId = null;
    }
  };
}

export async function attachCalloriaSupervisorIntervention({ scene, tier = 'balanced' } = {}) {
  if (!scene?.add || !scene?.remove) throw new TypeError('Supervisor intervention requires the existing production Three.js scene.');
  const queue = createSupervisorQueue();
  const loader = new CalloriaGLBAssetLoader();
  const panel = createControlPanel();
  const approved = readApprovals();
  const assetId = PREFERRED_SUPERVISORS.find((id) => approved.includes(id)) || null;
  let disposed = false;
  let modelReady = false;
  let loading = true;
  let wrapper = null;
  let mixer = null;
  let activeAction = null;
  let walkClip = null;
  let idleClip = null;
  let rig = null;
  let path = null;
  let pathIndex = 0;
  let gaitPhase = 0;
  let status = { available: false, assetId: null, reason: null, tier };
  const listeners = [];

  const listen = (type, handler) => {
    window.addEventListener(type, handler);
    listeners.push(() => window.removeEventListener(type, handler));
  };

  function publish(state, detail = {}) {
    const payload = {
      state,
      scenarioId: queue.active?.scenarioId || detail.scenarioId || null,
      supervisorAssetId: assetId,
      pendingCount: queue.pending.length,
      ...detail
    };
    emit(STATE_EVENT, payload);
    if (['arrived', 'unavailable'].includes(state)) panel.show(payload);
    if (['returning', 'returned', 'resolved', 'disposed'].includes(state)) panel.hide();
  }

  function activateClip(clip) {
    if (!mixer || !clip || activeAction?.getClip?.() === clip) return;
    const next = mixer.clipAction(clip);
    next.reset().play();
    if (activeAction) next.crossFadeFrom(activeAction, 0.22, false);
    activeAction = next;
  }

  function startPath(points, phase) {
    path = points.map((point) => ({ ...point }));
    pathIndex = 0;
    if (phase === SUPERVISOR_PHASES.WALKING || phase === SUPERVISOR_PHASES.RETURNING) {
      if (walkClip) activateClip(walkClip);
      else { activeAction?.stop?.(); activeAction = null; }
    } else if (idleClip) activateClip(idleClip);
    else { activeAction?.stop?.(); activeAction = null; }
  }

  function beginNext() {
    if (disposed || !modelReady || !wrapper || queue.active) return;
    const active = beginNextSupervisorIntervention(queue);
    if (!active) return;
    wrapper.visible = true;
    wrapper.position.set(OFFICE_START.x, OFFICE_START.y, OFFICE_START.z);
    startPath(OFFICE_TO_RECEPTION, SUPERVISOR_PHASES.WALKING);
    publish('walking', { scenarioId: active.scenarioId, message: 'Supervisor is walking from the supervisor office to reception.' });
  }

  function beginReturn(reason, resolved = false) {
    const active = queue.active;
    if (!active || !wrapper || active.phase === SUPERVISOR_PHASES.RETURNING) return;
    setSupervisorPhase(queue, active.scenarioId, SUPERVISOR_PHASES.RETURNING);
    active.resolved = Boolean(resolved);
    startPath(RECEPTION_TO_OFFICE, SUPERVISOR_PHASES.RETURNING);
    publish(resolved ? 'resolved' : 'returning', { scenarioId: active.scenarioId, message: reason });
  }

  function onReaction(event) {
    const detail = event?.detail || {};
    const statusValue = String(detail.status || '').toLowerCase();
    if (statusValue === 'completed' && typeof detail.scenarioId === 'string') {
      queue.completed.add(detail.scenarioId);
      queue.pending = queue.pending.filter((item) => item.scenarioId !== detail.scenarioId);
    }
    if (statusValue === 'escalated') {
      if (!loading && !status.available) {
        publish('unavailable', { scenarioId: detail.scenarioId, message: status.reason || 'No compatible approved supervisor model is available.' });
        return;
      }
      const result = enqueueSupervisorEscalation(queue, detail);
      if (!result.accepted) return;
      if (modelReady) beginNext();
      if (modelReady && !result.shouldStart) {
        publish('queued', { scenarioId: detail.scenarioId, message: `Supervisor is occupied. This escalation is queued (${queue.pending.length} waiting).` });
      }
      return;
    }
    if (statusValue === 'completed' && queue.active?.scenarioId === detail.scenarioId) {
      beginReturn('Customer interaction was completed; supervisor is returning to the office.', true);
    }
  }

  function onCommand(event) {
    const detail = event?.detail || {};
    if (!queue.active || detail.scenarioId !== queue.active.scenarioId) return;
    const action = String(detail.action || '').toLowerCase();
    if (action === 'resolve') {
      const scenarioId = queue.active.scenarioId;
      beginReturn('Supervisor review recorded. The mandatory customer QA review remains open.', true);
      emit('calloria:supervisor-case-recorded', {
        scenarioId,
        disposition: 'supervisor_review_recorded',
        supervisorAssetId: assetId,
        turn: queue.active?.turn ?? 0
      });
    } else if (action === 'resume' || action === 'dismiss') {
      emit('calloria:supervisor-case-recorded', {
        scenarioId: queue.active.scenarioId,
        disposition: 'returned_to_agent',
        supervisorAssetId: assetId,
        turn: queue.active.turn
      });
      beginReturn('Supervisor returned the interaction to the original agent. Mandatory review remains open.', false);
    }
  }

  listen(REACTION_EVENT, onReaction);
  listen(COMMAND_EVENT, onCommand);

  try {
    if (!assetId) throw new Error('No approved supervisor GLB. Approve Office Female Supervisor in the GLB Asset Inspector.');
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
    if (!validation.compatible) throw new Error(`Approved supervisor model failed runtime checks: ${validation.reasons.join('; ')}`);
    const source = loader.clone(assetId);
    source.updateMatrixWorld(true);
    const originalBounds = new THREE.Box3().setFromObject(source);
    const originalSize = originalBounds.getSize(new THREE.Vector3());
    source.scale.multiplyScalar(1.72 / Math.max(0.001, originalSize.y));
    source.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(source);
    const center = bounds.getCenter(new THREE.Vector3());
    source.position.x -= center.x;
    source.position.z -= center.z;
    source.position.y -= bounds.min.y;
    rig = findRig(source);
    mixer = loaded.animations.length ? new THREE.AnimationMixer(source) : null;
    walkClip = chooseClip(loaded.animations, /walk|walking|locomotion/i);
    idleClip = chooseClip(loaded.animations, /idle|stand|wait|listen/i);
    if (!walkClip && !(rig.leftLeg && rig.rightLeg)) {
      throw new Error('Supervisor model has no walk animation or recognisable leg bones. It cannot be animated safely.');
    }
    wrapper = new THREE.Group();
    wrapper.name = 'calloria-supervisor-intervention-avatar';
    wrapper.position.set(OFFICE_START.x, OFFICE_START.y, OFFICE_START.z);
    wrapper.visible = false;
    wrapper.add(source);
    scene.add(wrapper);
    if (idleClip) activateClip(idleClip);
    status = { available: true, assetId, assetName: loaded.asset?.name || assetId, triangleCount: metrics.triangleCount, boneCount: metrics.boneCount, animationClips: loaded.animations.map((clip) => clip.name), tier };
    modelReady = true;
  } catch (error) {
    status = { available: false, assetId, reason: String(error?.message || error), tier };
    if (wrapper) scene.remove(wrapper);
    wrapper = null;
    loader.disposeAll();
    // Keep the intervention event bridge alive so the UI can explain why no supervisor appeared.
  }

  loading = false;
  if (status.available && queue.pending.length) beginNext();
  else if (!status.available && queue.pending.length) {
    const waiting = queue.pending[0];
    publish('unavailable', { scenarioId: waiting.scenarioId, message: status.reason });
    queue.pending.length = 0;
  }

  return {
    status,
    update(delta) {
      if (disposed || !wrapper?.visible) return;
      const step = Math.max(0, Math.min(Number(delta) || 0, 0.05));
      if (!step) return;
      mixer?.update(step);
      if (!path?.length) return;
      const target = path[pathIndex];
      if (!target) return;
      const position = wrapper.position;
      const dx = target.x - position.x;
      const dz = target.z - position.z;
      const distance = Math.hypot(dx, dz);
      const travel = WALK_SPEED * step;
      if (distance <= travel || distance < 0.0001) {
        position.set(target.x, target.y, target.z);
        pathIndex += 1;
        if (pathIndex >= path.length) {
          path = null;
          if (queue.active?.phase === SUPERVISOR_PHASES.RETURNING) {
            const finished = finishSupervisorIntervention(queue, queue.active.scenarioId, { markCompleted: Boolean(queue.active.resolved) });
            wrapper.visible = false;
            publish('returned', { scenarioId: finished?.scenarioId, message: 'Supervisor returned to the supervisor office.' });
            beginNext();
          } else if (queue.active) {
            setSupervisorPhase(queue, queue.active.scenarioId, SUPERVISOR_PHASES.ASSISTING);
            if (idleClip) activateClip(idleClip);
            else { activeAction?.stop?.(); activeAction = null; }
            if (rig?.leftLeg?.bone) rig.leftLeg.bone.rotation.set(rig.leftLeg.x, rig.leftLeg.y, rig.leftLeg.z);
            if (rig?.rightLeg?.bone) rig.rightLeg.bone.rotation.set(rig.rightLeg.x, rig.rightLeg.y, rig.rightLeg.z);
            publish('arrived', { scenarioId: queue.active.scenarioId, message: 'Supervisor arrived at reception.' });
          }
        }
      } else {
        position.x += (dx / distance) * travel;
        position.z += (dz / distance) * travel;
        wrapper.rotation.y = Math.atan2(dx, dz);
        if (!walkClip && rig) {
          gaitPhase += step * 7.2;
          const gait = Math.sin(gaitPhase) * 0.32;
          if (rig.leftLeg?.bone) rig.leftLeg.bone.rotation.x = rig.leftLeg.x + gait;
          if (rig.rightLeg?.bone) rig.rightLeg.bone.rotation.x = rig.rightLeg.x - gait;
          if (rig.head?.bone) rig.head.bone.rotation.y = rig.head.y + Math.sin(gaitPhase * 0.5) * 0.025;
          if (rig.spine?.bone) rig.spine.bone.rotation.x = rig.spine.x + Math.abs(gait) * 0.025;
        }
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      listeners.forEach((remove) => remove());
      disposeSupervisorQueue(queue);
      mixer?.stopAllAction();
      if (wrapper) {
        safeDisposeClone(wrapper);
        scene.remove(wrapper);
      }
      panel.dispose();
      loader.disposeAll();
      publish('disposed');
    }
  };
}
