import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CalloriaGLBAssetLoader, disposeGLTFResources, inspectGLTFAsset } from './glb-asset-loader.js';
import { GLB_ASSET_REGISTRY } from './glb-asset-registry.js';

const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat('en-NG').format(Math.round(value || 0));
const formatBytes = (bytes) => {
  if (!bytes) return 'Not reported';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes, unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(unit >= 2 ? 2 : 1)} ${units[unit]}`;
};
const complexityLabel = (triangles) => triangles < 25000 ? 'Light geometry' : triangles < 100000 ? 'Moderate geometry' : triangles < 250000 ? 'Heavy geometry' : 'Very heavy geometry';
const initialState = () => ({ filter: 'All', query: '', selectedId: '', scan: {}, reports: {} });
const storageKey = 'calloria.glb-inspector.v1';
let state = initialState();
try { state = { ...state, ...JSON.parse(localStorage.getItem(storageKey) || '{}') }; } catch { /* Local inspection history is optional. */ }
if (!Array.isArray(state.approvedAssetIds)) state.approvedAssetIds = [];
const loader = new CalloriaGLBAssetLoader();
const reportMap = new Map(Object.entries(state.reports || {}));
let renderer;
let scene;
let camera;
let controls;
let previewRoot = null;
let activeGLTF = null;
let activeMixer = null;
let animationFrame = 0;
let clock = new THREE.Clock();
let activeScanId = 0;

function persist() {
  state.reports = Object.fromEntries(reportMap.entries());
  try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* Storage quotas do not block inspection. */ }
}

function setScanStatus(title, text, percent = 0) {
  $('#scanStatusTitle').textContent = title;
  $('#scanStatusText').textContent = text;
  $('#scanProgress').style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

function createViewer() {
  const host = $('#previewHost');
  try {
    renderer = new THREE.WebGLRenderer({ antialias: window.innerWidth > 760, alpha: false, powerPreference: 'low-power', stencil: false });
  } catch (error) {
    host.innerHTML = `<div class="preview-placeholder"><strong>WebGL preview unavailable</strong><small>${escapeHTML(error.message || 'This browser could not initialise WebGL.')}</small></div>`;
    return false;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth <= 760 ? 1.15 : 1.45));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setClearColor('#0a1b29', 1);
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D GLB preview. Drag to rotate, scroll to zoom.');
  host.replaceChildren(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#0c1e2c');
  camera = new THREE.PerspectiveCamera(38, 1, 0.05, 1000);
  camera.position.set(4.1, 2.6, 5.0);
  scene.add(new THREE.HemisphereLight(0xddeeff, 0x39434b, 2.0));
  const key = new THREE.DirectionalLight(0xfff2df, 3.0);
  key.position.set(4, 7, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x82bdce, 1.2);
  fill.position.set(-5, 3, -3);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.4);
  rim.position.set(0, 5, -6);
  scene.add(rim);
  const grid = new THREE.GridHelper(12, 24, '#416678', '#284454');
  grid.position.y = 0.002;
  scene.add(grid);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(5.2, 64), new THREE.MeshStandardMaterial({ color: '#172a37', roughness: 0.94, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  scene.add(floor);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = 1.4;
  controls.maxDistance = 18;
  controls.target.set(0, 1.25, 0);
  controls.update();
  resizeViewer();
  renderer.setAnimationLoop(() => {
    const delta = Math.min(clock.getDelta(), 0.05);
    if (activeMixer) activeMixer.update(delta);
    controls.update();
    renderer.render(scene, camera);
  });
  window.addEventListener('resize', resizeViewer);
  $('#resetCameraButton').disabled = false;
  return true;
}

function resizeViewer() {
  if (!renderer || !camera) return;
  const rect = $('#previewHost').getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function visibleAssets() {
  const query = state.query.trim().toLowerCase();
  return GLB_ASSET_REGISTRY.filter((asset) => {
    const categoryMatch = state.filter === 'All' || asset.category === state.filter;
    const queryMatch = !query || `${asset.name} ${asset.group} ${asset.role} ${asset.path}`.toLowerCase().includes(query);
    return categoryMatch && queryMatch;
  });
}

function renderAssetList() {
  const assets = visibleAssets();
  $('#visibleCount').textContent = String(assets.length);
  $('#assetList').innerHTML = assets.map((asset) => {
    const scan = state.scan?.[asset.id];
    const status = scan?.status === 'loaded' ? 'LOADED' : scan?.status === 'failed' ? 'FAILED' : scan?.status === 'scanning' ? 'SCANNING' : 'UNTESTED';
    const stateClass = scan?.status || '';
    return `<button class="asset-item ${state.selectedId === asset.id ? 'active' : ''}" data-asset-id="${escapeHTML(asset.id)}"><span class="asset-name">${escapeHTML(asset.name)}</span><span class="asset-state ${stateClass}">${status}</span><span class="asset-group">${escapeHTML(asset.group)} · ${escapeHTML(asset.path)}</span></button>`;
  }).join('') || '<p class="empty-report">No models match this search.</p>';
  for (const button of $('#assetList').querySelectorAll('[data-asset-id]')) {
    button.addEventListener('click', () => void selectAsset(button.dataset.assetId));
  }
}

function setPreviewStatus(status, message = '') {
  const node = $('#previewStatus');
  node.className = `status-pill ${status}`;
  node.textContent = message || status.toUpperCase();
}

function clearPreview() {
  if (activeMixer) { activeMixer.stopAllAction(); activeMixer = null; }
  if (previewRoot) {
    scene.remove(previewRoot);
    disposeGLTFResources(activeGLTF);
    previewRoot = null;
    activeGLTF = null;
  }
  $('#animationSelect').innerHTML = '<option value="">No animation loaded</option>';
  $('#animationSelect').disabled = true;
  $('#playAnimationButton').disabled = true;
  $('#playAnimationButton').textContent = 'Play';
}

function fitModel(sceneObject, bounds, size) {
  const center = bounds.getCenter(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z, 0.001);
  const scale = 3.2 / maxDimension;
  const wrapper = new THREE.Group();
  wrapper.name = 'calloria-inspector-normalised-preview';
  wrapper.add(sceneObject);
  sceneObject.position.sub(center);
  wrapper.scale.setScalar(scale);
  wrapper.position.y = -(bounds.min.y - center.y) * scale;
  scene.add(wrapper);
  previewRoot = wrapper;
  camera.position.set(3.9, Math.max(2.1, size.y * scale * 0.82), 4.8);
  controls.target.set(0, Math.max(0.85, size.y * scale * 0.46), 0);
  controls.minDistance = 1.0;
  controls.maxDistance = 15;
  controls.update();
}

function textureDimensionSummary(report) {
  const dimensions = (report.textures || []).map((texture) => Math.max(texture.width, texture.height)).filter(Boolean);
  if (!dimensions.length) return 'Texture dimensions unavailable';
  return `${Math.max(...dimensions)} px maximum edge`;
}

function buildWarnings(report) {
  const warnings = [];
  if (!report.hasRig && report.category === 'Characters') warnings.push(['warning-item', 'No skinned mesh / skeleton was detected. This character may be static or may use a different animation setup.']);
  if (report.hasRig && !report.animationCount) warnings.push(['warning-item', 'A skeleton was detected, but no embedded animation clips were found. External animation retargeting may be required.']);
  if (report.animationCount) warnings.push(['warning-item good', `${report.animationCount} animation clip(s) detected. Each clip still needs visual review for usable poses and transitions.`]);
  if (report.triangleCount > 250000) warnings.push(['warning-item error', 'Very high triangle count. Do not place repeated copies in the live scene before optimisation and mobile profiling.']);
  else if (report.triangleCount > 100000) warnings.push(['warning-item', 'High geometry cost. Limit simultaneous instances and profile on a mid-range phone.']);
  else if (report.triangleCount > 0) warnings.push(['warning-item good', `${complexityLabel(report.triangleCount)} by CALLORIA's provisional inspection bands. This is not a runtime performance guarantee.`]);
  if (report.textures.some((texture) => Math.max(texture.width, texture.height) > 4096)) warnings.push(['warning-item error', 'At least one texture exceeds 4096 px on an edge. Create a mobile-appropriate texture variant.']);
  if (report.requiredExtensions.includes('KHR_draco_mesh_compression')) warnings.push(['warning-item', 'This model requires Draco decoding. Add and configure the matching DRACOLoader decoder before production use.']);
  if (report.requiredExtensions.includes('EXT_meshopt_compression')) warnings.push(['warning-item', 'This model requires meshopt decoding. Configure MeshoptDecoder before production use.']);
  if (report.dimensions && (report.dimensions.y <= 0 || !Number.isFinite(report.dimensions.y))) warnings.push(['warning-item error', 'The model has invalid or degenerate vertical bounds.']);
  if (!warnings.length) warnings.push(['warning-item', 'No obvious technical warning was found. Visual suitability, licensing, scale and device performance still require approval.']);
  return warnings;
}

function canApproveForWorkplace(report) {
  if (!report || report.category !== 'Characters' || report.group !== 'Agents') return false;
  if (!report.hasRig || report.animationCount < 1 || report.triangleCount > 150000) return false;
  if (!report.dimensions || report.dimensions.y < 1 || report.dimensions.y > 2.6) return false;
  return report.animations.some((clip) => /idle|stand|standing|rest|breath|listen|talk|conversation|sit|sitting|seated|typing|type|computer|desk|work/i.test(clip.name));
}

function updateApprovalButton(report) {
  const button = $('#approveModelButton');
  if (!button) return;
  const approved = state.approvedAssetIds.includes(report?.id);
  button.disabled = !canApproveForWorkplace(report);
  button.textContent = approved ? 'Approved · remove' : 'Approve for workplace';
  button.setAttribute('aria-pressed', approved ? 'true' : 'false');
  button.title = canApproveForWorkplace(report)
    ? 'Visual approval is your decision. Only approved, rigged agent models with animation clips can enter the live workplace.'
    : 'Approval requires an agent character, a skeleton, at least one suitable animation, human-scale dimensions and no more than 150,000 triangles.';
}

function renderReport(report) {
  $('#metricTriangles').textContent = money(report.triangleCount);
  $('#triangleRating').textContent = complexityLabel(report.triangleCount);
  $('#metricMeshes').textContent = money(report.meshCount);
  $('#metricSkinned').textContent = `Skinned meshes: ${report.skinnedMeshCount}`;
  $('#metricMaterials').textContent = `${report.materialCount} / ${report.textureCount}`;
  $('#metricTextureSize').textContent = textureDimensionSummary(report);
  $('#metricRig').textContent = report.hasRig ? 'RIGGED' : 'NO RIG';
  $('#metricBoneCount').textContent = `Skeletons: ${report.skeletonCount} · Bones: ${report.boneCount}`;
  $('#metricAnimations').textContent = String(report.animationCount);
  $('#metricAnimationNames').textContent = report.animations.map((clip) => clip.name).join(', ') || 'No embedded clips';
  $('#metricDimensions').textContent = report.dimensions ? `${report.dimensions.x.toFixed(2)} × ${report.dimensions.y.toFixed(2)} × ${report.dimensions.z.toFixed(2)}` : 'Unavailable';
  $('#metricFileSize').textContent = `File size: ${formatBytes(report.fileBytes)}`;
  $('#reportClass').textContent = complexityLabel(report.triangleCount);

  const items = [
    ['ASSET ID', report.id], ['FILE URL', report.url], ['MESHES', `${report.meshCount} (${report.instancedMeshCount} instanced)`],
    ['GEOMETRIES / VERTICES', `${report.geometryCount} / ${money(report.vertexCount)}`], ['MATERIALS', report.materialCount],
    ['TEXTURES', `${report.textureCount} · ${textureDimensionSummary(report)}`], ['SKELETON', report.hasRig ? 'Skinned skeleton detected' : 'No skinned skeleton'],
    ['ANIMATION CLIPS', report.animations.map((clip) => `${clip.name} (${clip.durationSeconds.toFixed(2)}s)`).join(' · ') || 'None'],
    ['GLTF EXTENSIONS', report.extensions.join(', ') || 'None declared'], ['REQUIRED EXTENSIONS', report.requiredExtensions.join(', ') || 'None declared'],
    ['INSPECTED AT', new Date(report.inspectedAt).toLocaleString()]
  ];
  $('#reportDetails').innerHTML = items.map(([label, value]) => `<div class="report-item"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`).join('');
  $('#warningList').innerHTML = buildWarnings(report).map(([className, message]) => `<div class="${className}">${escapeHTML(message)}</div>`).join('');
  $('#downloadReportButton').disabled = reportMap.size === 0;
  updateApprovalButton(report);
  updateSummary();
}

function resetMetrics() {
  for (const id of ['metricTriangles', 'metricMeshes', 'metricMaterials', 'metricRig', 'metricAnimations', 'metricDimensions']) $(`#${id}`).textContent = '—';
  $('#triangleRating').textContent = 'Not inspected';
  $('#metricSkinned').textContent = 'Skinned meshes: —';
  $('#metricTextureSize').textContent = 'Texture count: —';
  $('#metricBoneCount').textContent = 'Bone count: —';
  $('#metricAnimationNames').textContent = 'No clips inspected';
  $('#metricFileSize').textContent = 'File size: —';
  $('#reportClass').textContent = 'Awaiting model';
  $('#approveModelButton').disabled = true;
  $('#approveModelButton').textContent = 'Approve for workplace';
  $('#reportDetails').innerHTML = '<p class="empty-report">Load a model to populate its technical report.</p>';
  $('#warningList').replaceChildren();
}

function updateSummary() {
  const reports = [...reportMap.values()];
  $('#loadedTotal').textContent = String(reports.length);
  $('#riggedTotal').textContent = reports.filter((report) => report.hasRig).length;
  $('#animatedTotal').textContent = reports.filter((report) => report.animationCount > 0).length;
  $('#downloadReportButton').disabled = reports.length === 0;
}

async function fileSize(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (!response.ok) return 0;
    return Number(response.headers.get('content-length') || 0);
  } catch { return 0; }
}

async function selectAsset(id) {
  const asset = GLB_ASSET_REGISTRY.find((item) => item.id === id);
  if (!asset || !renderer) return;
  state.selectedId = id;
  persist();
  renderAssetList();
  $('#previewTitle').textContent = asset.name;
  $('#previewPath').textContent = asset.url;
  setPreviewStatus('neutral', 'LOADING');
  setScanStatus('Loading model', `${asset.name} · downloading and parsing GLB`, 0);
  clearPreview();
  resetMetrics();
  try {
    let transferredBytes = 0;
    const loaded = await loader.load(asset, { cache: false, onProgress: (progress) => {
      transferredBytes = Math.max(transferredBytes, progress.total || progress.loaded || 0);
      const percent = progress.total ? (progress.loaded / progress.total) * 100 : 0;
      setScanStatus('Loading model', `${asset.name} · ${formatBytes(progress.loaded)} transferred`, percent);
    }});
    if (state.selectedId !== id) { disposeGLTFResources(loaded.gltf); return; }
    activeGLTF = loaded.gltf;
    const bounds = new THREE.Box3().setFromObject(loaded.scene);
    const size = bounds.getSize(new THREE.Vector3());
    fitModel(loaded.scene, bounds, size);
    const bytes = transferredBytes || await fileSize(asset.url);
    const report = inspectGLTFAsset(loaded, bytes);
    reportMap.set(id, report);
    state.scan ||= {};
    state.scan[id] = { status: 'loaded', inspectedAt: report.inspectedAt };
    renderReport(report);
    $('#animationSelect').innerHTML = '<option value="">Choose animation clip</option>' + report.animations.map((clip, index) => `<option value="${index}">${escapeHTML(clip.name)}</option>`).join('');
    $('#animationSelect').disabled = report.animationCount === 0;
    $('#playAnimationButton').disabled = report.animationCount === 0;
    setPreviewStatus('loaded', 'GLB LOADED');
    setScanStatus('Model loaded successfully', `${asset.name} · ${money(report.triangleCount)} triangles · ${report.hasRig ? 'rig detected' : 'no rig detected'}`, 100);
    persist();
    renderAssetList();
  } catch (error) {
    state.scan ||= {};
    state.scan[id] = { status: 'failed', error: String(error?.message || error), inspectedAt: new Date().toISOString() };
    setPreviewStatus('failed', 'LOAD FAILED');
    $('#previewHost').innerHTML = `<div class="preview-placeholder"><strong>Could not load ${escapeHTML(asset.name)}</strong><small>${escapeHTML(error?.message || 'Unknown GLB loading error')}</small></div>`;
    $('#reportDetails').innerHTML = `<p class="empty-report">${escapeHTML(error?.message || 'GLB load failed')}</p>`;
    $('#warningList').innerHTML = '<div class="warning-item error">Check the deployed asset URL, file presence, GLB validity and any required compression decoder.</div>';
    setScanStatus('Model could not be loaded', `${asset.name} · ${error?.message || 'Unknown error'}`, 0);
    persist();
    renderAssetList();
  }
}

async function runFullScan() {
  if (!renderer) return;
  const scanId = ++activeScanId;
  const assets = [...GLB_ASSET_REGISTRY];
  const confirmed = window.confirm(`Compatibility scanning will download all ${assets.length} GLB files sequentially. The model files total several megabytes. Continue?`);
  if (!confirmed) return;
  $('#scanAllButton').disabled = true;
  const successful = [];
  const failed = [];
  try {
    for (let index = 0; index < assets.length; index += 1) {
      if (scanId !== activeScanId) break;
      const asset = assets[index];
      state.scan ||= {};
      state.scan[asset.id] = { status: 'scanning' };
      renderAssetList();
      setScanStatus(`Scanning ${index + 1} of ${assets.length}`, `${asset.name} · sequential file validation`, (index / assets.length) * 100);
      let loaded;
      try {
        let bytes = 0;
        loaded = await loader.load(asset, { cache: false, onProgress: (progress) => { bytes = Math.max(bytes, progress.total || progress.loaded || 0); } });
        const report = inspectGLTFAsset(loaded, bytes || await fileSize(asset.url));
        reportMap.set(asset.id, report);
        state.scan[asset.id] = { status: 'loaded', inspectedAt: report.inspectedAt };
        successful.push(report);
      } catch (error) {
        const failure = { id: asset.id, name: asset.name, url: asset.url, error: String(error?.message || error), inspectedAt: new Date().toISOString() };
        state.scan[asset.id] = { status: 'failed', error: failure.error, inspectedAt: failure.inspectedAt };
        failed.push(failure);
      } finally {
        if (loaded?.gltf) disposeGLTFResources(loaded.gltf);
      }
      setScanStatus(`Scanning ${index + 1} of ${assets.length}`, `${asset.name} · ${successful.length} loaded · ${failed.length} failed`, ((index + 1) / assets.length) * 100);
      persist();
      renderAssetList();
    }
    if (scanId === activeScanId) {
      const summary = { scanned: successful.length + failed.length, loaded: successful.length, failed: failed.length, completedAt: new Date().toISOString() };
      localStorage.setItem('calloria.glb-inspector.last-scan', JSON.stringify(summary));
      setScanStatus('Compatibility scan complete', `${summary.loaded} loaded · ${summary.failed} failed · ${summary.scanned} checked. Select any row to inspect its full technical report.`, 100);
      if (state.selectedId) {
        const selectedReport = reportMap.get(state.selectedId);
        if (selectedReport) renderReport(selectedReport);
      }
    }
  } finally {
    $('#scanAllButton').disabled = false;
    updateSummary();
  }
}

function downloadReport() {
  const payload = {
    product: 'CALLORIA',
    reportType: 'GLB asset compatibility scan',
    generatedAt: new Date().toISOString(),
    catalogueCount: GLB_ASSET_REGISTRY.length,
    approvedAssetIds: [...state.approvedAssetIds],
    reports: GLB_ASSET_REGISTRY.map((asset) => reportMap.get(asset.id) || {
      id: asset.id, name: asset.name, url: asset.url, status: state.scan?.[asset.id]?.status || 'not_inspected', error: state.scan?.[asset.id]?.error || null
    }),
    note: 'A successful GLTFLoader parse does not certify visual quality, legal licence, retargeting quality or real-device performance.'
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `calloria-glb-audit-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

$('#assetTotal').textContent = String(GLB_ASSET_REGISTRY.length);
$('#assetSearch').addEventListener('input', (event) => { state.query = event.target.value; renderAssetList(); });
$('#categoryFilters').addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  state.filter = button.dataset.filter;
  for (const chip of $('#categoryFilters').querySelectorAll('[data-filter]')) chip.classList.toggle('active', chip === button);
  renderAssetList();
});
$('#scanAllButton').addEventListener('click', () => void runFullScan());
$('#downloadReportButton').addEventListener('click', downloadReport);
$('#approveModelButton').addEventListener('click', () => {
  const report = reportMap.get(state.selectedId);
  if (!canApproveForWorkplace(report)) return;
  const approved = new Set(state.approvedAssetIds);
  if (approved.has(report.id)) approved.delete(report.id);
  else approved.add(report.id);
  state.approvedAssetIds = [...approved];
  persist();
  updateApprovalButton(report);
  setScanStatus(
    approved.has(report.id) ? 'Model approved for workplace integration' : 'Workplace approval removed',
    `${report.name} · this approval is stored in this browser only.`,
    100
  );
});
$('#resetCameraButton').addEventListener('click', () => {
  if (!controls) return;
  camera.position.set(3.9, 2.6, 4.8);
  controls.target.set(0, 1.25, 0);
  controls.update();
});
$('#playAnimationButton').addEventListener('click', () => {
  if (!activeGLTF || !previewRoot || !activeGLTF.animations?.length) return;
  const selectedIndex = Number($('#animationSelect').value);
  if (!Number.isInteger(selectedIndex) || !activeGLTF.animations[selectedIndex]) return;
  if (activeMixer) activeMixer.stopAllAction();
  activeMixer = new THREE.AnimationMixer(activeGLTF.scene);
  activeMixer.clipAction(activeGLTF.animations[selectedIndex]).reset().play();
  $('#playAnimationButton').textContent = 'Playing';
});
$('#animationSelect').addEventListener('change', () => { if (activeMixer) activeMixer.stopAllAction(); activeMixer = null; $('#playAnimationButton').textContent = 'Play'; });

if (createViewer()) {
  renderAssetList();
  updateSummary();
  const preferred = GLB_ASSET_REGISTRY.find((asset) => asset.id === state.selectedId) || GLB_ASSET_REGISTRY.find((asset) => asset.id === 'female-agent') || GLB_ASSET_REGISTRY[0];
  void selectAsset(preferred.id);
} else {
  renderAssetList();
  setScanStatus('WebGL unavailable', 'This browser cannot initialise the 3D preview. File loading can still be checked after WebGL is available.', 0);
}

window.addEventListener('pagehide', () => {
  activeScanId += 1;
  clearPreview();
  renderer?.setAnimationLoop(null);
  controls?.dispose();
  loader.disposeAll();
  renderer?.dispose();
});
