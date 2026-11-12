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
  import('/live-floor-engine.js'),
  import('/office-routine-engine.js'),
  import('three'),
  import('three/addons/loaders/GLTFLoader.js'),
  import('three/addons/utils/SkeletonUtils.js')
]).then(([, , , THREE, loaderModule, skeletonUtils]) => {
  if (!window.CalloriaOfficeFloorEngine || !window.CalloriaLiveFloorEngine || !window.CalloriaOfficeRoutineEngine) throw new Error('A CALLORIA floor or office routine engine file did not load.');
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
  const activityMarkers = new Map();
  const mixers = [];
  const clock = new THREE.Clock();
  const held = new Set();
  let nearest = null;
  let nearestActivity = null;
  let selected = null;
  let selectedActivity = null;
  let pointerLocked = false;
  let dragging = false;
  let lastPointer = null;
  let assetStatus = {};
  let assets = {};
  let movementSpeed = 4.5;
  let snapshot = E.getFloorSnapshot(window.localStorage);
  const R = window.CalloriaOfficeRoutineEngine;
  const F = window.CalloriaLiveFloorEngine;
  if (!R || !F) throw new Error('The office routine or live shift engine did not load.');

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

  function createActivityMarkers() {
    E.ACTIVITIES.forEach((activity) => {
      const group = new THREE.Group();
      group.position.set(activity.x, 0.018, activity.z);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1.22, 40), new THREE.MeshBasicMaterial({ color: 0xc59bf7, transparent: true, opacity: 0.17, side: THREE.DoubleSide, depthWrite: false }));
      disc.rotation.x = -Math.PI / 2;
      group.add(disc);
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.08, 1.14, 40), new THREE.MeshBasicMaterial({ color: 0xd2b0ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.009;
      group.add(ring);
      const label = createTextLabel(activity.name.toUpperCase(), THREE);
      label.position.set(0, 2.25, 0.1);
      label.scale.set(3.2, 0.5, 1);
      group.add(label);
      scene.add(group);
      activityMarkers.set(activity.id, { group, disc, ring });
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
    if (role === 'agent' || role === 'supervisor' || role === 'receptionist') scale = 1.68 / Math.max(size.y, 0.01);
    else if (role === 'desk') scale = Math.min(2.5 / Math.max(size.x, 0.01), 1.15 / Math.max(size.y, 0.01), 1.35 / Math.max(size.z, 0.01));
    else if (role === 'computer') scale = Math.min(0.92 / Math.max(size.x, 0.01), 0.78 / Math.max(size.y, 0.01), 0.72 / Math.max(size.z, 0.01));
    else if (role === 'receptionDesk') scale = Math.min(2.8 / Math.max(size.x, 0.01), 1.35 / Math.max(size.y, 0.01), 1.6 / Math.max(size.z, 0.01));
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
    } else if (role === 'receptionDesk') {
      object.position.x += station.x;
      object.position.z += station.z;
      object.rotation.y = -Math.PI / 2;
    } else if (role === 'receptionist') {
      object.position.x += station.x + 1.25;
      object.position.z += station.z - 0.35;
      object.rotation.y = Math.PI / 2;
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
    const reception = E.ACTIVITIES.find((item) => item.id === 'reception');
    if (reception && assets.receptionDesk && assets.receptionDesk.loaded) addModel(assets.receptionDesk.source, 'receptionDesk', null, reception);
    if (reception && assets.receptionist && assets.receptionist.loaded) addModel(assets.receptionist.source, 'receptionist', null, reception);
  }

  function renderDirectory() {
    $('#station-directory').innerHTML = E.STATIONS.map((station) => {
      const usable = E.stationIsUsable(assetStatus);
      return `<div class="directory-item"><span class="directory-dot" style="background:${usable ? '#59cda0' : '#cb8a79'}"></span><span><strong>${escapeHtml(station.name)}</strong><small>${escapeHtml(station.channel)}</small></span><b>${escapeHtml(station.id)}</b></div>`;
    }).join('');
  }

  function showStation(station) {
    selected = station;
    selectedActivity = null;
    $('#activity-card').classList.add('hidden');
    const status = stationGroups.get(station.id);
    const modelsReady = E.stationIsUsable(assetStatus) && !!(status && status.desk && status.computer);
    const shift = F.load(window.localStorage);
    const alreadyOnShift = F.isOnShift(shift) && shift.shift.team === station.team;
    const identity = currentIdentity();
    const checkedIn = !!(identity && R.isClockedIn(window.localStorage, identity));
    const teamMatches = !!(identity && identity.team === station.team);
    const canEnter = modelsReady && (alreadyOnShift || (checkedIn && teamMatches));
    $('#station-ref').textContent = `WORKSTATION ${station.id}`;
    $('#station-name').textContent = station.name;
    $('#station-description').textContent = `${station.role} · ${station.channel}. Workstation entry opens the interactive customer shift.`;
    $('#station-channel').textContent = station.channel.toUpperCase();
    const availability = !modelsReady ? 'MODEL ASSET MISSING' : alreadyOnShift ? 'SHIFT READY' : !checkedIn ? 'CLOCK IN AT RECEPTION' : !teamMatches ? 'ASSIGNED TEAM MISMATCH' : 'READY';
    $('#station-availability').textContent = availability;
    $('#station-availability').style.color = canEnter ? '#70d6ad' : '#e9a49a';
    $('#enter-workstation').disabled = !canEnter;
    $('#enter-workstation').textContent = canEnter ? (alreadyOnShift ? 'RESUME CUSTOMER SHIFT' : 'ENTER CUSTOMER SHIFT') : 'WORKSTATION UNAVAILABLE';
    $('#interaction-card').classList.remove('hidden');
    $('#proximity-hint').textContent = canEnter ? `${station.id} selected. Enter the workstation to handle customer contacts.` : !modelsReady ? 'Desk and computer GLB assets must load before this workstation can be used.' : !checkedIn ? 'Visit Staff Reception to clock in before entering a workstation.' : 'Choose the workstation assigned to your team.';
  }

  function interact() {
    const activityFirst = nearestActivity && (!nearest || nearestActivity.distance <= nearest.distance);
    if (activityFirst) {
      showActivity(nearestActivity);
      return;
    }
    if (nearest) {
      showStation(nearest);
      return;
    }
    if (nearestActivity) showActivity(nearestActivity);
    else if (selected) showStation(selected);
    else if (selectedActivity) showActivity(selectedActivity);
  }

  function showActivity(activity) {
    selectedActivity = activity;
    selected = null;
    $('#interaction-card').classList.add('hidden');
    $('#activity-ref').textContent = `STAFF ACTIVITY · ${activity.id.toUpperCase()}`;
    $('#activity-name').textContent = activity.name;
    $('#activity-description').textContent = activity.action;
    $('#activity-identity-fields').classList.toggle('hidden', activity.kind !== 'reception');
    $('#activity-request-fields').classList.toggle('hidden', activity.kind !== 'supervisor');
    $('#activity-status').textContent = 'CHECKING';
    $('#activity-status').style.color = '#aabbd2';
    $('#activity-action').disabled = true;
    $('#activity-action').textContent = 'NOT AVAILABLE';
    const identity = currentIdentity();
    const shift = F.load(window.localStorage);
    const onShift = F.isOnShift(shift);
    const due = onShift ? F.dueEvent(shift) : null;
    const today = identity && identity.date || R.localDate(new Date());
    if (activity.kind === 'reception') {
      const status = identity && R.getAttendanceStatus(window.localStorage, { name: identity.name, team: identity.team, date: today });
      const shiftEnded = !!(shift && shift.shift && shift.shift.status === 'Ended');
      const profile = identity || R.getLastIdentity(window.localStorage, new Date());
      if (profile) {
        $('#activity-employee-name').value = profile.name;
        $('#activity-employee-team').value = profile.team;
      }
      if (status === 'Clocked out') {
        $('#activity-status').textContent = 'CLOCKED OUT · SHIFT CLOSED';
        $('#activity-action').textContent = 'ATTENDANCE CLOSED';
        $('#activity-action').disabled = true;
      } else if (status === 'Clocked in' && shiftEnded) {
        $('#activity-status').textContent = 'SHIFT ENDED · CLOCK OUT AVAILABLE';
        $('#activity-action').textContent = 'CLOCK OUT';
        $('#activity-action').disabled = false;
      } else if (status === 'Clocked in') {
        $('#activity-status').textContent = onShift ? 'CLOCKED IN · ON SHIFT' : 'CLOCKED IN · WORKSTATION PENDING';
        $('#activity-action').textContent = 'ALREADY CLOCKED IN';
        $('#activity-action').disabled = true;
      } else {
        $('#activity-status').textContent = 'NOT CLOCKED IN';
        $('#activity-action').textContent = 'CLOCK IN';
        $('#activity-action').disabled = false;
      }
    } else if (activity.kind === 'briefing' || activity.kind === 'break') {
      const expected = activity.kind;
      if (!onShift) {
        $('#activity-status').textContent = 'START YOUR SHIFT FIRST';
        $('#activity-action').textContent = 'SHIFT NOT ACTIVE';
      } else if (due && due.type === expected) {
        const actionKey = due.id;
        const token = identity && R.hasEventToken(window.localStorage, { name: shift.shift.agentName, team: shift.shift.team, date: shift.shift.date }, actionKey);
        $('#activity-status').textContent = token ? 'ATTENDANCE RECORDED · RETURN TO WORKSTATION' : `${due.time} · ${due.title.toUpperCase()} DUE`;
        $('#activity-action').textContent = token ? 'RECORDED' : (expected === 'briefing' ? 'ATTEND BRIEFING' : `TAKE ${due.duration}-MINUTE BREAK`);
        $('#activity-action').disabled = !!token;
        $('#activity-description').textContent = `${due.description} After recording attendance here, return to the Live Floor to complete the scheduled event.`;
      } else if (due) {
        $('#activity-status').textContent = `${due.time} · ${due.title.toUpperCase()} DUE`;
        $('#activity-action').textContent = 'VISIT THE CORRECT AREA';
      } else {
        $('#activity-status').textContent = 'NO SCHEDULED ACTIVITY DUE';
        $('#activity-action').textContent = 'NOT DUE';
      }
    } else if (activity.kind === 'supervisor') {
      const hasIdentity = !!(identity && onShift && !shift.active);
      $('#activity-status').textContent = hasIdentity ? 'SUPERVISOR SUPPORT AVAILABLE' : shift.active ? 'FINISH CURRENT CONTACT FIRST' : 'AVAILABLE DURING A SHIFT';
      $('#activity-action').textContent = 'REQUEST SUPERVISOR';
      $('#activity-action').disabled = !hasIdentity;
    }
    $('#activity-card').classList.remove('hidden');
    $('#proximity-hint').textContent = `${activity.name} selected. Follow the on-screen staff activity.`;
  }

  function handleActivityAction() {
    if (!selectedActivity) return;
    const now = new Date();
    try {
      if (E.distanceXZ(player, selectedActivity) > 2.8) throw new Error('Move back inside this staff activity area before confirming the action.');
      const shift = F.load(window.localStorage);
      const identity = currentIdentity();
      if (selectedActivity.kind === 'reception') {
        const shiftEnded = !!(shift && shift.shift && shift.shift.status === 'Ended');
        if (shiftEnded && identity && R.isClockedIn(window.localStorage, { ...identity, date: shift.shift.date })) {
          R.clockOut(window.localStorage, { ...identity, date: shift.shift.date }, now, true);
          updateHud();
          showActivity(selectedActivity);
          $('#activity-status').textContent = 'CLOCKED OUT · SHIFT CLOSED';
          $('#activity-action').textContent = 'CLOCK-OUT RECORDED';
          $('#activity-action').disabled = true;
          return;
        }
        const name = $('#activity-employee-name').value;
        const team = $('#activity-employee-team').value;
        R.clockIn(window.localStorage, { name, team }, now);
        updateHud();
        showActivity(selectedActivity);
        $('#activity-status').textContent = 'CLOCKED IN · SELECT YOUR TEAM WORKSTATION';
        $('#activity-action').textContent = 'CLOCK-IN RECORDED';
        $('#activity-action').disabled = true;
        $('#proximity-hint').textContent = 'Clock-in saved. Move to a workstation for your assigned team.';
        return;
      }
      if (selectedActivity.kind === 'briefing' || selectedActivity.kind === 'break') {
        const due = F.dueEvent(shift);
        if (!identity || !due) throw new Error('No scheduled activity is currently due.');
        R.attendEvent(window.localStorage, { name: shift.shift.agentName, team: shift.shift.team, date: shift.shift.date }, due.id, due, now);
        showActivity(selectedActivity);
        $('#activity-status').textContent = 'ATTENDANCE RECORDED';
        $('#activity-action').textContent = 'RECORDED · RETURN TO WORKSTATION';
        $('#activity-action').disabled = true;
        $('#proximity-hint').textContent = 'Attendance recorded. Return to the Live Floor and complete the scheduled event.';
        return;
      }
      if (selectedActivity.kind === 'supervisor') {
        const request = R.requestSupervisor(
          window.localStorage,
          { name: shift.shift.agentName, team: shift.shift.team, date: shift.shift.date },
          $('#activity-request-type').value,
          $('#activity-request-note').value,
          now,
          F.isOnShift(shift)
        );
        $('#activity-status').textContent = `REQUEST ${request.id} LOGGED`;
        $('#activity-action').textContent = 'REQUEST SUBMITTED';
        $('#activity-action').disabled = true;
        $('#proximity-hint').textContent = 'Supervisor assistance request saved in this browser. It is not a live notification.';
      }
    } catch (error) {
      $('#activity-status').textContent = 'ACTION NOT COMPLETED';
      $('#activity-action').disabled = false;
      $('#proximity-hint').textContent = error.message;
    }
  }

  function enterWorkstation() {
    if (!selected) return;
    if (E.distanceXZ(player, selected) > 2.8) {
      $('#proximity-hint').textContent = 'Move back inside the workstation area before entering.';
      return;
    }
    const status = stationGroups.get(selected.id);
    if (!E.stationIsUsable(assetStatus) || !status || !status.desk || !status.computer) return;
    const shift = F.load(window.localStorage);
    const active = F.isOnShift(shift) && shift.shift.team === selected.team;
    const identity = currentIdentity();
    if (!active && (!identity || !R.isClockedIn(window.localStorage, identity) || identity.team !== selected.team)) {
      $('#proximity-hint').textContent = !identity || !R.isClockedIn(window.localStorage, identity) ? 'Clock in at Staff Reception before entering a workstation.' : `Your assigned team is ${identity.team}. Select a matching workstation.`;
      return;
    }
    try { window.localStorage.setItem('calloria.office-floor.lastStation', JSON.stringify({ id: selected.id, name: selected.name, team: selected.team, enteredAt: new Date().toISOString() })); } catch (_) { /* local storage is optional for navigation */ }
    window.location.href = `/live-floor.html?fromOffice=1&station=${encodeURIComponent(selected.id)}&team=${encodeURIComponent(selected.team)}`;
  }

  function currentIdentity() {
    const shift = F.load(window.localStorage);
    if (shift && shift.shift && shift.shift.agentName && shift.shift.team) {
      const previous = { name: shift.shift.agentName, team: shift.shift.team, date: shift.shift.date };
      if (F.isOnShift(shift) || R.isClockedIn(window.localStorage, previous) || shift.shift.date === R.localDate(new Date())) return previous;
    }
    return R.getLastIdentity(window.localStorage, new Date());
  }

  function updateHud() {
    snapshot = E.getFloorSnapshot(window.localStorage);
    const identity = currentIdentity();
    $('#player-name').textContent = snapshot.agentName || identity && identity.name || 'Guest employee';
    $('#player-team').textContent = snapshot.team || identity && identity.team || 'Clock in at Staff Reception';
    const attendance = identity ? R.getAttendanceStatus(window.localStorage, identity) : 'Not clocked in';
    const hudStatus = snapshot.status === 'Not signed in' && attendance === 'Clocked in' ? 'Clocked in' : snapshot.status;
    $('#hud-shift').textContent = hudStatus.toUpperCase();
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
  }

  function setNearestActivity(activity) {
    nearestActivity = activity;
    activityMarkers.forEach((marker, id) => {
      const active = !!activity && activity.id === id;
      marker.disc.material.color.set(active ? 0x69d6b2 : 0xc59bf7);
      marker.disc.material.opacity = active ? 0.29 : 0.17;
      marker.ring.material.color.set(active ? 0x7ce7c1 : 0xd2b0ff);
      marker.ring.material.opacity = active ? 1 : 0.85;
    });
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
    const closestActivity = E.nearestPoint(E.ACTIVITIES, player, 2.75);
    if ((closest && (!nearest || closest.id !== nearest.id)) || (!closest && nearest)) setNearestStation(closest);
    if ((closestActivity && (!nearestActivity || closestActivity.id !== nearestActivity.id)) || (!closestActivity && nearestActivity)) setNearestActivity(closestActivity);
    const activityFirst = closestActivity && (!closest || closestActivity.distance <= closest.distance);
    if ($('#activity-card').classList.contains('hidden') && $('#interaction-card').classList.contains('hidden')) {
      if (activityFirst) $('#proximity-hint').textContent = `${closestActivity.name} — press E or USE for staff activity.`;
      else if (closest) $('#proximity-hint').textContent = `${closest.id} · ${closest.name} — press E or USE to inspect workstation.`;
      else $('#proximity-hint').textContent = 'Explore the floor. Visit Staff Reception, Briefing Room, Staff Lounge or Supervisor Hub.';
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
    $('#close-activity').addEventListener('click', () => { selectedActivity = null; $('#activity-card').classList.add('hidden'); });
    $('#activity-action').addEventListener('click', handleActivityAction);
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
    const roles = ['desk', 'computer', 'agentFemale', 'agentMale', 'supervisor', 'receptionDesk', 'receptionist'];
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
  createActivityMarkers();
  loadAllAssets().catch((error) => {
    showFatal(`The workplace scene could not finish loading: ${error && error.message ? error.message : 'unknown error'}`);
  });
  requestAnimationFrame(animate);

  window.CalloriaOfficeFloor = {
    getPlayer: () => ({ ...player }),
    getAssetStatus: () => ({ ...assetStatus }),
    getSnapshot: () => E.getFloorSnapshot(window.localStorage),
    getNearestStation: () => nearest,
    inspectStation: (id) => { const station = E.STATIONS.find((item) => item.id === id); if (station) showStation(station); },
    inspectActivity: (id) => { const activity = E.ACTIVITIES.find((item) => item.id === id); if (activity) showActivity(activity); }
  };
}
