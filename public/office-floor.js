const root = document.getElementById('world-root');
const loading = document.getElementById('loading-screen');
const loadingDetail = document.getElementById('loading-detail');
const loadingProgress = document.getElementById('loading-progress');
const fatal = document.getElementById('fatal-message');

function showFatal(message) {
  fatal.textContent = message;
  fatal.classList.remove('hidden');
  loading.classList.add('done');
}

Promise.all([
  import('/office-floor-engine.js'),
  import('three'),
  import('three/addons/loaders/GLTFLoader.js'),
  import('three/addons/utils/SkeletonUtils.js')
]).then(([THREE, loaderModule, skeletonUtils]) => {
  if (!window.CalloriaOfficeFloorEngine) throw new Error('The CALLORIA office-floor engine file did not load.');
  startOffice(THREE, loaderModule.GLTFLoader, skeletonUtils.clone);
}).catch((error) => {
  showFatal(`The 3D renderer could not start. Check the connection to the pinned Three.js module files and reload. Technical detail: ${error && error.message ? error.message : 'module load failed'}`);
});

function startOffice(THREE, GLTFLoader, cloneSkeleton) {
  'use strict';
  const E = window.CalloriaOfficeFloorEngine;
  const $ = (selector) => document.querySelector(selector);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101d2b);
  scene.fog = new THREE.Fog(0x101d2b, 20, 48);

  const camera = new THREE.PerspectiveCamera(66, 1, 0.1, 90);
  const player = { x: 0, z: 10.5, yaw: 0, pitch: -0.04, height: 1.68 };
  camera.position.set(player.x, player.height, player.z);
  camera.rotation.order = 'YXZ';

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
  renderer.setSize(root.clientWidth || window.innerWidth, root.clientHeight || window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.setAttribute('aria-label', 'Three-dimensional CALLORIA contact-centre floor. Use WASD to walk, mouse to look and E near a workstation.');
  root.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xc8dfff, 0x293545, 1.65));
  const keyLight = new THREE.DirectionalLight(0xffe4c1, 1.55);
  keyLight.position.set(-7, 12, 6);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0x7eaee8, 0.72);
  fillLight.position.set(8, 8, -9);
  scene.add(fillLight);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 28),
    new THREE.MeshStandardMaterial({ color: 0x263545, roughness: 0.92, metalness: 0.03 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.035;
  scene.add(floor);

  const centralWalkway = new THREE.Mesh(
    new THREE.PlaneGeometry(38, 3.1),
    new THREE.MeshStandardMaterial({ color: 0x354657, roughness: 0.86, metalness: 0.02 })
  );
  centralWalkway.rotation.x = -Math.PI / 2;
  centralWalkway.position.set(0, -0.018, 5.2);
  scene.add(centralWalkway);

  const grid = new THREE.GridHelper(38, 38, 0x53687e, 0x3b4d61);
  grid.position.y = -0.012;
  grid.material.transparent = true;
  grid.material.opacity = 0.18;
  scene.add(grid);

  function addBoundary(points, color = 0x5d7894, opacity = 0.54) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    return line;
  }
  addBoundary([[-18, 0.015, -12], [18, 0.015, -12], [18, 0.015, 12], [-18, 0.015, 12], [-18, 0.015, -12]], 0x6688aa, 0.6);
  addBoundary([[-18, 0.02, 1.1], [18, 0.02, 1.1]], 0x7995b0, 0.34);
  addBoundary([[-18, 0.02, 7.2], [18, 0.02, 7.2]], 0x7995b0, 0.24);

  const stationGroups = new Map();
  const stationMarkers = new Map();
  const mixers = [];
  const clock = new THREE.Clock();
  const held = new Set();
  let nearest = null;
  let selected = null;
  let pointerLocked = false;
  let dragging = false;
  let lastPointer = null;
  let assetStatus = {};
  let assets = {};
  let movementSpeed = 4.5;
  let snapshot = E.getFloorSnapshot(window.localStorage);

  const loader = new GLTFLoader();
  loader.setCrossOrigin('anonymous');

  function materialForMarker(active = false) {
    return new THREE.MeshBasicMaterial({
      color: active ? 0x65e6b2 : 0x6ca4ea,
      transparent: true,
      opacity: active ? 0.24 : 0.13,
      side: THREE.DoubleSide,
      depthWrite: false
    });
  }

  function createStationMarkers() {
    E.STATIONS.forEach((station) => {
      const group = new THREE.Group();
      group.position.set(station.x, 0.012, station.z);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1.65, 48), materialForMarker(false));
      disc.rotation.x = -Math.PI / 2;
      group.add(disc);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.42, 1.47, 48),
        new THREE.MeshBasicMaterial({ color: 0x78aeea, transparent: true, opacity: 0.72, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.008;
      group.add(ring);
      const label = createTextLabel(`${station.id}  ·  ${station.name.toUpperCase()}`, THREE);
      label.position.set(0, 2.6, 0.15);
      group.add(label);
      scene.add(group);
      stationMarkers.set(station.id, { group, disc, ring });
    });
  }

  function createTextLabel(text, THREERef) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 80;
    const context = canvas.getContext('2d');
    context.fillStyle = 'rgba(8, 18, 31, 0.78)';
    roundRect(context, 5, 8, 502, 64, 15);
    context.fill();
    context.strokeStyle = 'rgba(139, 184, 237, 0.65)';
    context.lineWidth = 2;
    roundRect(context, 5, 8, 502, 64, 15);
    context.stroke();
    context.font = '800 22px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#e7f0ff';
    context.fillText(text, 256, 40, 470);
    const texture = new THREERef.CanvasTexture(canvas);
    texture.colorSpace = THREERef.SRGBColorSpace;
    const material = new THREERef.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREERef.Sprite(material);
    sprite.scale.set(3.55, 0.56, 1);
    return sprite;
  }
  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  function addModel(source, role, target, station) {
    if (!source || !source.scene) return null;
    const object = cloneSkeleton(source.scene);
    object.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = false;
        node.receiveShadow = false;
        if (node.material) {
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach((material) => { material.needsUpdate = true; });
        }
      }
    });
    object.updateMatrixWorld(true);
    const initial = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    initial.getSize(size);
    const maxDimension = Math.max(size.x, size.y, size.z, 0.001);
    let scale = 1;
    if (role === 'agent' || role === 'supervisor') scale = 1.68 / Math.max(size.y, 0.01);
    else if (role === 'desk') scale = Math.min(2.5 / Math.max(size.x, 0.01), 1.15 / Math.max(size.y, 0.01), 1.35 / Math.max(size.z, 0.01));
    else if (role === 'computer') scale = Math.min(0.92 / Math.max(size.x, 0.01), 0.78 / Math.max(size.y, 0.01), 0.72 / Math.max(size.z, 0.01));
    scale = Math.max(0.0005, Math.min(scale, 30));
    object.scale.setScalar(scale);
    object.updateMatrixWorld(true);
    const fitted = new THREE.Box3().setFromObject(object);
    const center = new THREE.Vector3();
    fitted.getCenter(center);
    object.position.x -= center.x;
    object.position.z -= center.z;
    object.position.y -= fitted.min.y;

    if (role === 'desk') {
      object.position.x += station.x;
      object.position.z += station.z;
      object.rotation.y = Math.PI;
    } else if (role === 'computer') {
      object.position.x += station.x + 0.18;
      object.position.z += station.z - 0.18;
      object.position.y += 0.72;
    } else if (role === 'agent') {
      object.position.x += station.x;
      object.position.z += station.z - 1.3;
      object.rotation.y = Math.PI;
    } else if (role === 'supervisor') {
      object.position.x += 0;
      object.position.z -= 8.9;
      object.rotation.y = Math.PI;
    }
    scene.add(object);
    if (source.animations && source.animations.length) {
      const mixer = new THREE.AnimationMixer(object);
      const idle = source.animations.find((clip) => /idle|stand|breath/i.test(clip.name)) || source.animations[0];
      mixer.clipAction(idle).play();
      mixers.push(mixer);
    }
    return object;
  }

  function loadFirstAvailable(role, paths) {
    return new Promise((resolve) => {
      let index = 0;
      const failed = [];
      const tryNext = () => {
        if (index >= paths.length) {
          resolve({ loaded: false, path: null, source: null, message: `No matching model found. Tried ${failed.length} paths.`, failed });
          return;
        }
        const path = paths[index++];
        loader.load(path, (gltf) => {
          resolve({ loaded: true, path, source: gltf, message: 'Loaded', failed });
        }, undefined, () => {
          failed.push(path);
          tryNext();
        });
      };
      tryNext();
    });
  }

  function setLoadingProgress(value, detail) {
    loadingProgress.style.width = `${Math.max(0, Math.min(100, value))}%`;
    if (detail) loadingDetail.textContent = detail;
  }

  function updateAssetPanel() {
    const summary = E.assetSummary(assetStatus);
    $('#asset-count').textContent = `${summary.loaded} / ${summary.total}`;
    $('#asset-progress').style.width = `${summary.total ? summary.loaded / summary.total * 100 : 0}%`;
    $('#asset-log').innerHTML = Object.entries(assetStatus).map(([role, status]) => {
      const label = status.loaded ? `Loaded · ${status.path}` : `Missing · ${status.message}`;
      return `<p class="${status.loaded ? 'ok' : 'fail'}"><strong>${escapeHtml(role)}</strong>: ${escapeHtml(label)}</p>`;
    }).join('');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  function placeWorkstations() {
    E.STATIONS.forEach((station) => {
      const group = new THREE.Group();
      const desk = assets.desk && assets.desk.loaded ? addModel(assets.desk.source, 'desk', null, station) : null;
      const computer = assets.computer && assets.computer.loaded ? addModel(assets.computer.source, 'computer', null, station) : null;
      const characterAsset = assets[station.model];
      const person = characterAsset && characterAsset.loaded ? addModel(characterAsset.source, 'agent', null, station) : null;
      if (desk || computer || person) group.userData.loadedModels = [desk, computer, person].filter(Boolean).length;
      stationGroups.set(station.id, { group, desk, computer, person, station });
    });
    if (assets.supervisor && assets.supervisor.loaded) addModel(assets.supervisor.source, 'supervisor', null, null);
  }

  function renderDirectory() {
    $('#station-directory').innerHTML = E.STATIONS.map((station) => {
      const usable = E.stationIsUsable(assetStatus);
      return `<div class="directory-item"><span class="directory-dot" style="background:${usable ? '#59cda0' : '#cb8a79'}"></span><span><strong>${escapeHtml(station.name)}</strong><small>${escapeHtml(station.channel)}</small></span><b>${escapeHtml(station.id)}</b></div>`;
    }).join('');
  }

  function showStation(station) {
    selected = station;
    const status = stationGroups.get(station.id);
    const usable = E.stationIsUsable(assetStatus) && !!(status && status.desk && status.computer);
    $('#station-ref').textContent = `WORKSTATION ${station.id}`;
    $('#station-name').textContent = station.name;
    $('#station-description').textContent = `${station.role} · ${station.channel}. Walk-up access opens the interactive customer shift.`;
    $('#station-channel').textContent = station.channel.toUpperCase();
    $('#station-availability').textContent = usable ? 'READY' : 'MODEL ASSET MISSING';
    $('#station-availability').style.color = usable ? '#70d6ad' : '#e9a49a';
    $('#enter-workstation').disabled = !usable;
    $('#enter-workstation').textContent = usable ? (snapshot.status === 'On shift' ? 'RESUME CUSTOMER SHIFT' : 'ENTER CUSTOMER SHIFT') : 'WORKSTATION UNAVAILABLE';
    $('#interaction-card').classList.remove('hidden');
    $('#proximity-hint').textContent = usable ? `${station.id} selected. Enter the workstation to handle customer contacts.` : 'This station is disabled until its desk and computer GLB models are found.';
  }

  function interact() {
    if (nearest) {
      showStation(nearest);
      return;
    }
    if (selected) showStation(selected);
  }

  function enterWorkstation() {
    if (!selected) return;
    const status = stationGroups.get(selected.id);
    if (!E.stationIsUsable(assetStatus) || !status || !status.desk || !status.computer) return;
    try { window.localStorage.setItem('calloria.office-floor.lastStation', JSON.stringify({ id: selected.id, name: selected.name, team: selected.team, enteredAt: new Date().toISOString() })); } catch (_) { /* local storage is optional for navigation */ }
    window.location.href = `/live-floor.html?fromOffice=1&station=${encodeURIComponent(selected.id)}&team=${encodeURIComponent(selected.team)}`;
  }

  function updateHud() {
    snapshot = E.getFloorSnapshot(window.localStorage);
    $('#player-name').textContent = snapshot.agentName || 'Guest employee';
    $('#player-team').textContent = snapshot.team || 'Choose a workstation to start';
    $('#hud-shift').textContent = snapshot.status.toUpperCase();
    $('#hud-rank').textContent = snapshot.rank.toUpperCase();
    $('#hud-xp').textContent = snapshot.xp.toLocaleString();
  }

  function setNearestStation(station) {
    nearest = station;
    stationMarkers.forEach((marker, id) => {
      const active = !!station && station.id === id;
      marker.disc.material = materialForMarker(active);
      marker.ring.material.color.set(active ? 0x73e2b5 : 0x78aeea);
      marker.ring.material.opacity = active ? 1 : 0.72;
    });
    if (station) {
      $('#proximity-hint').textContent = `${station.id} · ${station.name} — press E or USE to inspect workstation.`;
    } else if ($('#interaction-card').classList.contains('hidden')) {
      $('#proximity-hint').textContent = 'Explore the floor. Move towards a workstation.';
    }
  }

  function updateMovement(delta) {
    if (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const forwardInput = (held.has('KeyW') || held.has('ArrowUp') || held.has('forward') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') || held.has('back') ? 1 : 0);
    const sideInput = (held.has('KeyD') || held.has('ArrowRight') || held.has('right') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') || held.has('left') ? 1 : 0);
    if (!forwardInput && !sideInput) return;
    const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const direction = forward.multiplyScalar(forwardInput).add(right.multiplyScalar(sideInput));
    if (direction.lengthSq() > 0) direction.normalize();
    const step = movementSpeed * Math.min(delta, 0.05);
    player.x = Math.max(-17.6, Math.min(17.6, player.x + direction.x * step));
    player.z = Math.max(-11.2, Math.min(11.2, player.z + direction.z * step));
  }

  function animate(timestamp) {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    updateMovement(delta);
    camera.position.set(player.x, player.height, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
    mixers.forEach((mixer) => mixer.update(delta));
    const closest = E.nearestStation(E.STATIONS, player, 2.75);
    if ((closest && (!nearest || closest.id !== nearest.id)) || (!closest && nearest)) setNearestStation(closest);
    if (closest && $('#interaction-card').classList.contains('hidden')) {
      $('#proximity-hint').textContent = `${closest.id} · ${closest.name} — press E or USE to inspect workstation.`;
    }
    renderer.render(scene, camera);
  }

  function requestWalkMode() {
    if (renderer.domElement.requestPointerLock) renderer.domElement.requestPointerLock();
    else $('#proximity-hint').textContent = 'Use the mouse or touch-and-drag to look around.';
  }

  function bindControls() {
    const keyMap = new Map([
      ['w', 'KeyW'], ['a', 'KeyA'], ['s', 'KeyS'], ['d', 'KeyD'],
      ['ArrowUp', 'ArrowUp'], ['ArrowLeft', 'ArrowLeft'], ['ArrowDown', 'ArrowDown'], ['ArrowRight', 'ArrowRight']
    ]);
    window.addEventListener('keydown', (event) => {
      const key = keyMap.get(event.key) || (event.key.length === 1 ? keyMap.get(event.key.toLowerCase()) : null);
      if (key) { held.add(key); event.preventDefault(); }
      if (event.key.toLowerCase() === 'e' && !event.repeat) interact();
    });
    window.addEventListener('keyup', (event) => {
      const key = keyMap.get(event.key) || (event.key.length === 1 ? keyMap.get(event.key.toLowerCase()) : null);
      if (key) held.delete(key);
    });
    window.addEventListener('blur', () => held.clear());
    document.addEventListener('pointerlockchange', () => { pointerLocked = document.pointerLockElement === renderer.domElement; });
    document.addEventListener('mousemove', (event) => {
      if (pointerLocked) {
        player.yaw -= event.movementX * 0.0024;
        player.pitch = Math.max(-1.05, Math.min(0.82, player.pitch - event.movementY * 0.002));
      }
    });
    renderer.domElement.addEventListener('pointerdown', (event) => {
      if (pointerLocked) return;
      dragging = true;
      lastPointer = { x: event.clientX, y: event.clientY };
      renderer.domElement.setPointerCapture && renderer.domElement.setPointerCapture(event.pointerId);
    });
    renderer.domElement.addEventListener('pointermove', (event) => {
      if (!dragging || pointerLocked || !lastPointer) return;
      const dx = event.clientX - lastPointer.x;
      const dy = event.clientY - lastPointer.y;
      player.yaw -= dx * 0.003;
      player.pitch = Math.max(-1.05, Math.min(0.82, player.pitch - dy * 0.0024));
      lastPointer = { x: event.clientX, y: event.clientY };
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((name) => renderer.domElement.addEventListener(name, () => { dragging = false; lastPointer = null; }));
    $('#walk-mode').addEventListener('click', requestWalkMode);
    $('#close-interaction').addEventListener('click', () => { selected = null; $('#interaction-card').classList.add('hidden'); });
    $('#enter-workstation').addEventListener('click', enterWorkstation);
    $('#mobile-interact').addEventListener('click', interact);
    document.querySelectorAll('[data-move]').forEach((button) => {
      const key = button.dataset.move;
      button.addEventListener('pointerdown', (event) => { event.preventDefault(); held.add(key); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((name) => button.addEventListener(name, () => held.delete(key)));
    });
    renderer.domElement.addEventListener('dblclick', requestWalkMode);
  }

  function onResize() {
    const width = Math.max(1, root.clientWidth);
    const height = Math.max(1, root.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
  }

  async function loadAllAssets() {
    const roles = ['desk', 'computer', 'agentFemale', 'agentMale', 'supervisor'];
    let finished = 0;
    setLoadingProgress(8, 'Loading local office and staff GLB assets…');
    await Promise.all(roles.map(async (role) => {
      const result = await loadFirstAvailable(role, E.getAssetPaths(role));
      finished += 1;
      setLoadingProgress(8 + finished / roles.length * 76, `Checked ${finished} of ${roles.length} GLB asset groups…`);
      assets[role] = result;
      assetStatus[role] = { loaded: result.loaded, path: result.path, message: result.message };
      updateAssetPanel();
      return result;
    }));
    placeWorkstations();
    renderDirectory();
    const summary = E.assetSummary(assetStatus);
    setLoadingProgress(100, `${summary.loaded} of ${summary.total} GLB asset groups loaded.`);
    if (!E.stationIsUsable(assetStatus)) {
      $('#proximity-hint').textContent = 'Desk or computer models were not found. Open GLB Asset Check to see the exact paths tried.';
    }
    setTimeout(() => loading.classList.add('done'), 450);
  }

  bindControls();
  updateHud();
  onResize();
  window.addEventListener('resize', onResize);
  createStationMarkers();
  loadAllAssets().catch((error) => {
    showFatal(`The workplace scene could not finish loading: ${error && error.message ? error.message : 'unknown error'}`);
  });
  requestAnimationFrame(animate);

  window.CalloriaOfficeFloor = {
    getPlayer: () => ({ ...player }),
    getAssetStatus: () => ({ ...assetStatus }),
    getSnapshot: () => E.getFloorSnapshot(window.localStorage),
    getNearestStation: () => nearest,
    inspectStation: (id) => { const station = E.STATIONS.find((item) => item.id === id); if (station) showStation(station); }
  };
}
