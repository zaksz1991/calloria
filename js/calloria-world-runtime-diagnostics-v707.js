/**
 * CALLORIA v7.07 — read-only 3D runtime inspector.
 * Scene traversal runs only while the existing GLB asset panel is open.
 */
const GLB_ROOT_PREFIX = 'calloria-glb-';
const STAFF_ROOT_PREFIX = 'calloria-glb-staff-';

function finite(value) {
  return Number.isFinite(Number(value));
}

function effectiveVisibility(object) {
  for (let current = object; current; current = current.parent) {
    if (current.visible === false) return false;
  }
  return true;
}

function geometryTriangles(object) {
  const geometry = object?.geometry;
  const vertexCount = Number(geometry?.index?.count ?? geometry?.getAttribute?.('position')?.count ?? 0);
  const multiplier = object?.isInstancedMesh ? Math.max(0, Number(object.count) || 0) : 1;
  return Math.floor(Math.max(0, vertexCount) / 3) * multiplier;
}

function isRenderableMesh(object) {
  return Boolean(object && (object.isMesh || object.isSkinnedMesh || object.isInstancedMesh) && object.geometry);
}

function findSourceAsset(root) {
  let source = root?.userData?.calloriaSourceAsset || '';
  if (source) return String(source);
  root?.traverse?.((node) => {
    if (!source && node?.userData?.calloriaSourceAsset) source = String(node.userData.calloriaSourceAsset);
  });
  if (source) return source;
  if (String(root?.name || '').startsWith(STAFF_ROOT_PREFIX)) {
    return String(root.name).slice(STAFF_ROOT_PREFIX.length).replace(/-\d+$/, '');
  }
  return 'not-labelled';
}

function readBounds(THREE, root, camera) {
  if (!THREE?.Box3 || !THREE?.Vector3) return { valid: false, inCameraFrustum: null, size: null, centre: null };
  try {
    root?.updateWorldMatrix?.(true, true);
    const box = new THREE.Box3().setFromObject(root);
    const empty = typeof box.isEmpty === 'function'
      ? box.isEmpty()
      : !(box.min && box.max && box.max.x >= box.min.x && box.max.y >= box.min.y && box.max.z >= box.min.z);
    if (empty || ![box.min?.x, box.min?.y, box.min?.z, box.max?.x, box.max?.y, box.max?.z].every(finite)) {
      return { valid: false, inCameraFrustum: null, size: null, centre: null };
    }
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    let inCameraFrustum = null;
    if (camera && THREE.Frustum && THREE.Matrix4 && camera.projectionMatrix && camera.matrixWorldInverse) {
      camera.updateMatrixWorld?.(true);
      const projectionView = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const frustum = new THREE.Frustum().setFromProjectionMatrix(projectionView);
      inCameraFrustum = Boolean(frustum.intersectsBox(box));
    }
    return {
      valid: true,
      inCameraFrustum,
      size: { x: size.x, y: size.y, z: size.z },
      centre: { x: centre.x, y: centre.y, z: centre.z }
    };
  } catch {
    return { valid: false, inCameraFrustum: null, size: null, centre: null };
  }
}

function sceneChildrenCount(scene) {
  return Array.isArray(scene?.children) ? scene.children.length : 0;
}

/** Pure snapshot collector. `THREE` is injected from the active world instance. */
export function collectCalloriaWorldRuntimeSnapshot({
  THREE,
  scene,
  camera,
  renderer,
  tier = 'unknown',
  environment = globalThis
} = {}) {
  if (!scene || typeof scene.traverse !== 'function') {
    return { ready: false, error: 'The active Three.js scene is unavailable.' };
  }

  try { scene.updateMatrixWorld?.(true); } catch { /* Snapshot remains best-effort. */ }
  try { camera?.updateMatrixWorld?.(true); } catch { /* Frustum data may be unavailable. */ }

  let meshCount = 0;
  let visibleMeshCount = 0;
  let sceneTriangles = 0;
  const roots = [];
  scene.traverse((object) => {
    if (isRenderableMesh(object)) {
      meshCount += 1;
      if (effectiveVisibility(object)) visibleMeshCount += 1;
      sceneTriangles += geometryTriangles(object);
    }
    if (String(object?.name || '').startsWith(GLB_ROOT_PREFIX)) roots.push(object);
  });

  const placements = roots.map((root) => {
    let meshes = 0;
    let visibleMeshes = 0;
    let triangles = 0;
    root.traverse?.((object) => {
      if (!isRenderableMesh(object)) return;
      meshes += 1;
      if (effectiveVisibility(object)) visibleMeshes += 1;
      triangles += geometryTriangles(object);
    });
    const bounds = readBounds(THREE, root, camera);
    return {
      name: String(root.name || 'unnamed-glb-root'),
      type: String(root.name || '').startsWith(STAFF_ROOT_PREFIX) ? 'staff' : 'office',
      sourceAsset: findSourceAsset(root),
      visible: effectiveVisibility(root) && visibleMeshes > 0,
      meshes,
      visibleMeshes,
      triangles,
      boundsValid: bounds.valid,
      inCameraFrustum: bounds.inCameraFrustum,
      size: bounds.size,
      centre: bounds.centre
    };
  });

  const staff = placements.filter((entry) => entry.type === 'staff');
  const office = placements.filter((entry) => entry.type === 'office');
  const renderInfo = renderer?.info?.render || {};
  const memoryInfo = renderer?.info?.memory || {};
  const canvas = renderer?.domElement || null;
  let contextLost = null;
  try { contextLost = Boolean(renderer?.getContext?.()?.isContextLost?.()); } catch { contextLost = null; }

  return {
    ready: true,
    tier: String(tier || 'unknown'),
    viewport: {
      width: Math.max(0, Number(environment?.innerWidth) || 0),
      height: Math.max(0, Number(environment?.innerHeight) || 0),
      devicePixelRatio: Math.max(0, Number(environment?.devicePixelRatio) || 0),
      coarsePointer: Boolean(environment?.matchMedia?.('(pointer: coarse)')?.matches)
    },
    canvas: canvas ? {
      cssWidth: Math.max(0, Number(canvas.clientWidth) || 0),
      cssHeight: Math.max(0, Number(canvas.clientHeight) || 0),
      backingWidth: Math.max(0, Number(canvas.width) || 0),
      backingHeight: Math.max(0, Number(canvas.height) || 0),
      pixelRatio: Number(renderer?.getPixelRatio?.()) || 0
    } : null,
    webgl: { contextLost },
    scene: {
      topLevelObjects: sceneChildrenCount(scene),
      meshes: meshCount,
      visibleMeshes: visibleMeshCount,
      triangles: sceneTriangles
    },
    renderer: {
      drawCalls: Math.max(0, Number(renderInfo.calls) || 0),
      triangles: Math.max(0, Number(renderInfo.triangles) || 0),
      geometries: Math.max(0, Number(memoryInfo.geometries) || 0),
      textures: Math.max(0, Number(memoryInfo.textures) || 0)
    },
    glb: {
      totalRoots: placements.length,
      visibleRoots: placements.filter((entry) => entry.visible).length,
      inCameraFrustum: placements.filter((entry) => entry.visible && entry.inCameraFrustum === true).length,
      staffRoots: staff.length,
      officeRoots: office.length,
      staffVisible: staff.filter((entry) => entry.visible).length,
      officeVisible: office.filter((entry) => entry.visible).length,
      placements: placements.slice(0, 16)
    }
  };
}

export function formatCalloriaWorldRuntimeSnapshot(snapshot = {}) {
  if (!snapshot.ready) return snapshot.error || '3D runtime snapshot unavailable.';
  const canvas = snapshot.canvas || {};
  const scene = snapshot.scene || {};
  const renderer = snapshot.renderer || {};
  const glb = snapshot.glb || {};
  const webglText = snapshot.webgl?.contextLost === true
    ? 'CONTEXT LOST'
    : snapshot.webgl?.contextLost === false ? 'ACTIVE' : 'STATUS UNKNOWN';
  const rows = [
    `WEBGL CONTEXT: ${webglText}`,
    `GRAPHICS TIER: ${snapshot.tier || 'unknown'} · COARSE POINTER: ${snapshot.viewport?.coarsePointer ? 'yes' : 'no'}`,
    `VIEWPORT: ${snapshot.viewport?.width || 0} × ${snapshot.viewport?.height || 0} · DPR ${Number(snapshot.viewport?.devicePixelRatio || 0).toFixed(2)}`,
    `CANVAS: ${canvas.cssWidth || 0} × ${canvas.cssHeight || 0} CSS · ${canvas.backingWidth || 0} × ${canvas.backingHeight || 0} GPU · ratio ${Number(canvas.pixelRatio || 0).toFixed(2)}`,
    `SCENE: ${scene.meshes || 0} meshes · ${scene.visibleMeshes || 0} visible · ${Number(scene.triangles || 0).toLocaleString()} triangles`,
    `RENDERER: ${renderer.drawCalls || 0} draw calls · ${Number(renderer.triangles || 0).toLocaleString()} rendered triangles · ${renderer.geometries || 0} geometries · ${renderer.textures || 0} textures`,
    `GLB ROOTS: ${glb.totalRoots || 0} total · ${glb.visibleRoots || 0} visible · ${glb.inCameraFrustum || 0} in camera frustum`,
    `STAFF: ${glb.staffRoots || 0} loaded roots · ${glb.staffVisible || 0} visible · OFFICE: ${glb.officeRoots || 0} roots · ${glb.officeVisible || 0} visible`
  ];
  const placements = Array.isArray(glb.placements) ? glb.placements : [];
  if (placements.length) {
    rows.push('PLACEMENTS:');
    for (const item of placements) {
      const view = item.inCameraFrustum === null ? 'frustum unknown' : item.inCameraFrustum ? 'in camera' : 'outside camera';
      rows.push(`• ${item.type.toUpperCase()} · ${item.sourceAsset} · ${item.visible ? 'visible' : 'hidden'} · ${item.visibleMeshes}/${item.meshes} meshes · ${view} · ${item.name}`);
    }
  } else {
    rows.push('PLACEMENTS: no named calloria-glb-* roots were found in the active scene.');
  }
  rows.push('Note: camera-frustum intersection is not a guarantee against occlusion; this report does not modify or force model visibility.');
  return rows.join('\n');
}

export function attachCalloriaWorldRuntimeDiagnostics({
  THREE,
  scene,
  camera,
  renderer,
  tier = 'unknown',
  panelId = 'calloria-glb-health-panel-v682',
  documentRef = globalThis.document,
  windowRef = globalThis.window
} = {}) {
  if (!documentRef?.body || !windowRef) return { refresh() {}, dispose() {} };
  let disposed = false;
  let observer = null;
  let interval = null;
  let section = null;
  let reportNode = null;

  const ensureSection = () => {
    const panel = documentRef.getElementById(panelId);
    const content = panel?.querySelector?.('.calloria-glb-content');
    if (!content) return null;
    let current = content.querySelector?.('[data-calloria-world-runtime-diagnostics]');
    if (!current) {
      current = documentRef.createElement('section');
      current.dataset.calloriaWorldRuntimeDiagnostics = 'true';
      current.setAttribute('aria-label', 'Live 3D scene diagnostics');
      const heading = documentRef.createElement('h3');
      heading.className = 'calloria-glb-section';
      heading.textContent = 'LIVE 3D SCENE & VISIBILITY DIAGNOSTICS';
      reportNode = documentRef.createElement('pre');
      reportNode.className = 'calloria-glb-list';
      reportNode.style.cssText = 'margin:0;padding:10px 12px 14px;white-space:pre-wrap;overflow-wrap:anywhere;font:10px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;color:#d2e5e9;';
      current.append(heading, reportNode);
      content.append(current);
    } else {
      reportNode = current.querySelector?.('pre') || reportNode;
    }
    section = current;
    return current;
  };

  const refresh = () => {
    if (disposed) return null;
    const panel = documentRef.getElementById(panelId);
    if (!panel || panel.hidden) return null;
    ensureSection();
    if (!reportNode) return null;
    const snapshot = collectCalloriaWorldRuntimeSnapshot({ THREE, scene, camera, renderer, tier, environment: windowRef });
    reportNode.textContent = formatCalloriaWorldRuntimeSnapshot(snapshot);
    return snapshot;
  };

  ensureSection();
  if (typeof windowRef.MutationObserver === 'function') {
    observer = new windowRef.MutationObserver(() => {
      if (!disposed) ensureSection();
    });
    observer.observe(documentRef.body, { childList: true, subtree: true });
  }
  if (typeof windowRef.setInterval === 'function') interval = windowRef.setInterval(refresh, 1400);
  windowRef.addEventListener?.('calloria:glb-world-assets-ready', refresh);

  return {
    refresh,
    dispose() {
      if (disposed) return;
      disposed = true;
      observer?.disconnect?.();
      if (interval !== null) windowRef.clearInterval?.(interval);
      windowRef.removeEventListener?.('calloria:glb-world-assets-ready', refresh);
      section?.remove?.();
      section = null;
      reportNode = null;
    }
  };
}
