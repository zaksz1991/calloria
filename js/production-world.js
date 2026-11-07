/*
 * CALLORIA — 3D workplace world rebuild, Phase 3
 * Complete replacement for js/production-world.js.
 *
 * Design goals:
 * - A legible, full-floor Nigerian contact-centre environment with distinct
 *   reception, training, operations, QA, supervisor, IT and staff-lounge zones.
 * - Articulated, locally generated staff (no external model downloads).
 * - Instanced furniture and architectural repeats to control draw calls.
 * - Guest-first compatibility: this module owns presentation only and keeps
 *   the existing onStation/onNearestStation/enter/exit contract.
 * - Touch input is not treated as a low-performance device diagnosis.
 */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const isInput = (target) => Boolean(target && (target.isContentEditable || /INPUT|TEXTAREA|SELECT|BUTTON/.test(target.tagName)));

export async function initProductionWorld(THREE, host, callbacks = {}) {
  if (!THREE || !host) throw new Error('CALLORIA 3D world requires Three.js and a canvas host.');

  const coarsePointer = Boolean(window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);
  const mobile = coarsePointer || window.innerWidth <= 760;
  const memory = Number(navigator.deviceMemory || 0);
  const cores = Number(navigator.hardwareConcurrency || 0);
  const saveData = Boolean(navigator.connection?.saveData);
  const lowTier = saveData || (memory > 0 && memory <= 2) || (cores > 0 && cores <= 2);
  const highTier = !lowTier && memory >= 8 && cores >= 8;
  const tier = lowTier ? 'low' : highTier ? 'high' : 'balanced';
  const tierDefaults = {
    low:      { ratio: mobile ? 0.98 : 1.0, minRatio: 0.78, fps: mobile ? 24 : 30, anisotropy: 2, people: 6, antialias: false },
    balanced: { ratio: mobile ? 1.2 : 1.28, minRatio: mobile ? 0.92 : 0.98, fps: mobile ? 30 : 45, anisotropy: 4, people: 9, antialias: true },
    high:     { ratio: mobile ? 1.38 : 1.55, minRatio: 1.05, fps: mobile ? 40 : 60, anisotropy: 8, people: 12, antialias: true }
  }[tier];

  let profile = 'auto';
  const profileKey = 'calloria.graphics-profile.v1';
  try {
    const saved = localStorage.getItem(profileKey);
    if (['auto', 'smooth', 'balanced', 'sharp'].includes(saved)) profile = saved;
  } catch { /* Storage can be unavailable in private browsing. */ }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#91a5ae');
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 150);
  const renderer = new THREE.WebGLRenderer({
    antialias: tierDefaults.antialias,
    alpha: false,
    powerPreference: highTier ? 'high-performance' : 'default',
    stencil: false,
    depth: true,
    failIfMajorPerformanceCaveat: false
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.shadowMap.enabled = false;
  renderer.setPixelRatio(Math.min(tierDefaults.ratio, window.devicePixelRatio || 1, mobile ? 1.55 : 1.85));
  renderer.domElement.className = 'production-world-canvas';
  renderer.domElement.setAttribute('aria-label', 'Interactive CALLORIA contact-centre floor. Use WASD or the touch joystick to move and approach a workstation.');
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;outline:none;touch-action:none;';
  host.replaceChildren(renderer.domElement);

  const geometries = [];
  const materials = [];
  const textures = [];
  const shared = (geometry) => { geometries.push(geometry); return geometry; };
  const boxGeo = shared(new THREE.BoxGeometry(1, 1, 1));
  const sphereGeo = shared(new THREE.SphereGeometry(1, 18, 14));
  const smallSphereGeo = shared(new THREE.SphereGeometry(1, 12, 10));
  const cylinderGeo = shared(new THREE.CylinderGeometry(1, 1, 1, 16));
  const lowCylinderGeo = shared(new THREE.CylinderGeometry(1, 1, 1, 10));
  const planeGeo = shared(new THREE.PlaneGeometry(1, 1));
  const torusGeo = shared(new THREE.TorusGeometry(0.24, 0.022, 6, 20, Math.PI));
  const capsuleGeo = shared(new THREE.CapsuleGeometry(0.11, 0.3, 4, 8));

  const mat = (name, color, roughness = 0.78, metalness = 0, extra = {}) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    value.name = name;
    materials.push(value);
    return value;
  };
  const mats = {
    floor: mat('floor-concrete', '#aeb9b8', 0.94),
    carpet: mat('operations-carpet', '#314a55', 0.98),
    wall: mat('warm-wall', '#d5ddda', 0.88),
    wallLight: mat('partition-light', '#e6ece9', 0.82),
    wallDark: mat('navy-panels', '#173344', 0.74),
    teal: mat('calloria-teal', '#16b99f', 0.44, 0.08),
    tealLight: mat('teal-trim', '#75ddc8', 0.5),
    blue: mat('operations-blue', '#386b8b', 0.65),
    blueDark: mat('deep-blue', '#203f56', 0.68),
    wood: mat('wood', '#946c4d', 0.72),
    woodLight: mat('wood-edge', '#c49a6f', 0.67),
    metal: mat('brushed-metal', '#8e9da2', 0.42, 0.34),
    darkMetal: mat('dark-metal', '#263b49', 0.45, 0.2),
    glass: mat('glass', '#83bec5', 0.25, 0.08, { transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }),
    white: mat('warm-white', '#f1f2ec', 0.72),
    black: mat('rubber-black', '#111c25', 0.8),
    chair: mat('chair-upholstery', '#254d61', 0.92),
    chairAccent: mat('chair-stitch', '#4a7b89', 0.88),
    screenFrame: mat('monitor-frame', '#101c26', 0.32, 0.16),
    screen: null,
    keyboard: mat('keyboard', '#1b2b35', 0.62),
    skinA: mat('skin-deep', '#70442f', 0.86),
    skinB: mat('skin-medium', '#986247', 0.86),
    skinC: mat('skin-warm', '#bd8260', 0.84),
    shirtA: mat('uniform-teal', '#176b68', 0.82),
    shirtB: mat('uniform-blue', '#315b82', 0.82),
    shirtC: mat('uniform-burgundy', '#744354', 0.82),
    shirtD: mat('uniform-sand', '#b59a73', 0.85),
    trousers: mat('trousers', '#253847', 0.92),
    hair: mat('hair', '#211d1b', 0.94),
    scarfA: mat('hijab-sage', '#588b80', 0.9),
    scarfB: mat('hijab-plum', '#80566e', 0.9),
    scarfC: mat('hijab-sand', '#c4a879', 0.9),
    headset: mat('headset', '#101b23', 0.46, 0.22),
    eye: mat('eye', '#161b20', 0.42),
    eyeWhite: mat('eye-white', '#f1eee6', 0.58),
    lip: mat('lip-muted', '#653c3c', 0.86),
    badge: mat('staff-badge', '#eff5f1', 0.48, 0.04),
    shoe: mat('shoes', '#121e27', 0.75),
    plant: mat('plant-green', '#3e7958', 0.95),
    plantLight: mat('plant-leaf-light', '#73a86a', 0.94),
    gold: mat('warm-accent', '#d0a15f', 0.58, 0.12),
    emissive: mat('light-diffuser', '#fff6d8', 0.38, 0, { emissive: '#fff1c9', emissiveIntensity: 0.42 }),
    statusGreen: mat('status-green', '#21c69e', 0.45, 0.05, { emissive: '#0b7d65', emissiveIntensity: 0.35 }),
    safetyRed: mat('safety-red', '#c64d42', 0.58, 0.04),
    safetyWhite: mat('safety-white', '#f2f1e8', 0.7),
    equipmentBlue: mat('equipment-blue', '#316c82', 0.62, 0.12),
    rubber: mat('rubber', '#1c2b34', 0.9),
    paper: mat('paper', '#e6e9df', 0.94),
    plantPot: mat('planter-ceramic', '#857363', 0.48, 0.04)
  };

  function makeCanvasTexture(draw, width = 1024, height = 640) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    draw(ctx, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(tierDefaults.anisotropy, renderer.capabilities.getMaxAnisotropy());
    textures.push(texture);
    return texture;
  }

  const floorTexture = makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#aeb9b8'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 64) {
      for (let x = 0; x < w; x += 64) {
        ctx.fillStyle = ((x + y) / 64) % 2 ? 'rgba(255,255,255,.08)' : 'rgba(33,56,62,.045)';
        ctx.fillRect(x + 1, y + 1, 62, 62);
      }
    }
    ctx.strokeStyle = 'rgba(42,62,68,.10)'; ctx.lineWidth = 2;
    for (let x = 0; x <= w; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y <= h; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }, 512, 512);
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(12, 10);
  mats.floor.map = floorTexture; mats.floor.needsUpdate = true;

  // Phase 3 surface pass: low-frequency, tileable textures add material
  // definition without adding more mesh submissions or remote asset requests.
  const woodTexture = makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 180; i++) {
      const y = (i * 29) % h;
      const x = (i * 83) % w;
      const length = w * (0.28 + ((i * 17) % 66) / 100);
      ctx.strokeStyle = i % 4 === 0 ? 'rgba(55,31,17,.16)' : 'rgba(255,238,211,.16)';
      ctx.lineWidth = i % 5 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + length * .22, y - 3, x + length * .72, y + 3, x + length, y);
      ctx.stroke();
    }
    for (let i = 0; i < 14; i++) {
      ctx.strokeStyle = 'rgba(75,44,24,.11)'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse((i * 67) % w, (i * 91) % h, 10 + (i % 4) * 5, 3 + (i % 3), .08, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, 512, 512);
  woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping;
  woodTexture.repeat.set(2.2, 1.3);
  mats.wood.map = woodTexture; mats.wood.needsUpdate = true;
  mats.woodLight.map = woodTexture; mats.woodLight.needsUpdate = true;

  const carpetTexture = makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      ctx.fillStyle = y % 6 ? 'rgba(255,255,255,.035)' : 'rgba(8,25,34,.075)';
      ctx.fillRect(0, y, w, 1);
    }
    for (let x = 0; x < w; x += 3) {
      ctx.fillStyle = x % 6 ? 'rgba(255,255,255,.025)' : 'rgba(8,25,34,.06)';
      ctx.fillRect(x, 0, 1, h);
    }
    for (let i = 0; i < 900; i++) {
      const x = (i * 73 + i * i * 3) % w, y = (i * 137 + i * i * 5) % h;
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.08)' : 'rgba(10,25,32,.07)';
      ctx.fillRect(x, y, 1, 1);
    }
  }, 512, 512);
  carpetTexture.wrapS = carpetTexture.wrapT = THREE.RepeatWrapping;
  carpetTexture.repeat.set(9, 7);
  mats.carpet.map = carpetTexture; mats.carpet.needsUpdate = true;

  const plasterTexture = makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const x = (i * 71 + i * i * 11) % w, y = (i * 149 + i * i * 7) % h;
      ctx.fillStyle = i % 3 ? 'rgba(40,61,65,.025)' : 'rgba(255,255,255,.08)';
      ctx.fillRect(x, y, 1 + (i % 2), 1 + (i % 2));
    }
  }, 512, 512);
  plasterTexture.wrapS = plasterTexture.wrapT = THREE.RepeatWrapping;
  plasterTexture.repeat.set(3, 1.5);
  mats.wall.map = plasterTexture; mats.wall.needsUpdate = true;
  mats.wallLight.map = plasterTexture; mats.wallLight.needsUpdate = true;

  const screenTexture = makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#0b1f2d'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#123c4a'; ctx.fillRect(0, 0, w, 76);
    ctx.fillStyle = '#7be2ca'; ctx.font = 'bold 30px Arial'; ctx.fillText('CALLORIA  /  CUSTOMER OPERATIONS', 34, 50);
    ctx.fillStyle = '#e4f0ec'; ctx.font = 'bold 25px Arial'; ctx.fillText('CUSTOMER PROFILE', 38, 128);
    ctx.fillStyle = '#829fa9'; ctx.font = '18px Arial'; ctx.fillText('VERIFIED SERVICE RECORD', 38, 160);
    ctx.fillStyle = '#163949'; ctx.fillRect(34, 187, 580, 250);
    ctx.fillStyle = '#8aa9b2';
    for (let i = 0; i < 6; i++) { ctx.fillRect(58, 218 + i * 32, 250 + (i % 3) * 58, 8); ctx.fillRect(355, 218 + i * 32, 205, 8); }
    ctx.fillStyle = '#0a7069'; ctx.fillRect(655, 187, 330, 250);
    ctx.fillStyle = '#b5f6e6'; ctx.font = 'bold 44px Arial'; ctx.fillText('READY', 700, 270);
    ctx.font = '20px Arial'; ctx.fillText('SERVICE DESK', 700, 312);
    ctx.fillStyle = '#204457'; ctx.fillRect(34, 470, 952, 112);
    ctx.fillStyle = '#6fdac5'; ctx.font = 'bold 18px Arial'; ctx.fillText('QUEUE  •  CRM  •  KNOWLEDGE  •  QUALITY', 58, 520);
  });
  mats.screen = new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false });
  materials.push(mats.screen);

  function addBox(parent, name, size, position, material, rotationY = 0, extraRotation = null) {
    const mesh = new THREE.Mesh(boxGeo, material);
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.scale.set(size[0], size[1], size[2]);
    mesh.rotation.y = rotationY;
    if (extraRotation) mesh.rotation.set(extraRotation[0], extraRotation[1], extraRotation[2]);
    mesh.castShadow = false; mesh.receiveShadow = false;
    parent.add(mesh);
    return mesh;
  }
  function addSphere(parent, name, position, scale, material, geometry = sphereGeo) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.position.set(...position); mesh.scale.set(...scale);
    parent.add(mesh); return mesh;
  }
  function addCylinder(parent, name, position, scale, material, geometry = cylinderGeo, rotation = null) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.position.set(...position); mesh.scale.set(...scale);
    if (rotation) mesh.rotation.set(...rotation);
    parent.add(mesh); return mesh;
  }

  // Staff anatomy is composed once, then merged into vertex-coloured batches.
  // This keeps the richer characters while avoiding a separate draw call for
  // every eye, shoe, badge and limb component.
  const staffCompositeMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff', vertexColors: true, roughness: 0.84, metalness: 0.015
  });
  staffCompositeMaterial.name = 'calloria-staff-composite';
  materials.push(staffCompositeMaterial);
  function mergeStaffParts(group) {
    const parts = group.children.filter(child => child.isMesh && child.geometry && child.material && !child.userData.keepSeparate);
    if (parts.length < 2) return null;
    const positions = [], normals = [], colors = [];
    for (const part of parts) {
      part.updateMatrix();
      const transformed = part.geometry.clone();
      transformed.applyMatrix4(part.matrix);
      const flat = transformed.index ? transformed.toNonIndexed() : transformed;
      const position = flat.getAttribute('position');
      const normal = flat.getAttribute('normal');
      const tint = part.material.color?.clone?.() || new THREE.Color('#ffffff');
      for (let i = 0; i < position.count; i++) {
        positions.push(position.getX(i), position.getY(i), position.getZ(i));
        if (normal) normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
        colors.push(tint.r, tint.g, tint.b);
      }
      if (flat !== transformed) flat.dispose();
      transformed.dispose();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (normals.length === positions.length) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    else geometry.computeVertexNormals();
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();
    geometry.name = `${group.name || 'staff'}-merged-geometry`;
    geometries.push(geometry);
    for (const part of parts) group.remove(part);
    const merged = new THREE.Mesh(geometry, staffCompositeMaterial);
    merged.name = `${group.name || 'staff'}-merged-mesh`;
    merged.castShadow = false; merged.receiveShadow = false;
    group.add(merged);
    return merged;
  }
  function addInstances(name, geometry, material, transforms) {
    if (!transforms.length) return null;
    const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
    mesh.name = name; mesh.count = transforms.length;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const dummy = new THREE.Object3D();
    transforms.forEach((item, index) => {
      dummy.position.set(item.x, item.y, item.z);
      dummy.rotation.set(item.rx || 0, item.ry || 0, item.rz || 0);
      dummy.scale.set(item.sx ?? 1, item.sy ?? 1, item.sz ?? 1);
      dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
      if (item.color && mesh.setColorAt) mesh.setColorAt(index, new THREE.Color(item.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = true; scene.add(mesh); return mesh;
  }

  // Soft local illumination. No real-time shadow maps are used; contact decals
  // provide grounding without the heavy shadow-map cost on mobile browsers.
  scene.add(new THREE.HemisphereLight('#f1fbff', '#35444a', 1.85));
  const keyLight = new THREE.DirectionalLight('#fff0d7', 2.15);
  keyLight.position.set(-14, 22, 16); scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight('#b7e5f0', 0.8);
  fillLight.position.set(16, 12, -18); scene.add(fillLight);
  const warmLight = new THREE.PointLight('#ffd8a2', 0.85, 22, 2);
  warmLight.position.set(-13, 3.4, 9); scene.add(warmLight);
  const coolLight = new THREE.PointLight('#8de3d0', 0.62, 24, 2);
  coolLight.position.set(11, 3.8, -7); scene.add(coolLight);

  // Core architecture: open roof keeps the preview legible and avoids a ceiling
  // slab obscuring the player camera. The outer structure still reads as a room.
  addBox(scene, 'main-floor', [40, 0.28, 34], [0, -0.17, 0], mats.floor);
  addBox(scene, 'operations-carpet', [25, 0.025, 21], [1, -0.005, 0], mats.carpet);
  addBox(scene, 'rear-wall', [40, 4.4, 0.36], [0, 2.18, -17.05], mats.wall);
  addBox(scene, 'left-wall', [0.36, 4.4, 34], [-19.82, 2.18, 0], mats.wall);
  addBox(scene, 'right-wall', [0.36, 4.4, 34], [19.82, 2.18, 0], mats.wall);
  addBox(scene, 'front-left-wall', [9.2, 4.4, 0.36], [-15.4, 2.18, 17.05], mats.wall);
  addBox(scene, 'front-right-wall', [9.2, 4.4, 0.36], [15.4, 2.18, 17.05], mats.wall);
  addBox(scene, 'rear-navy-band', [39.5, 0.82, 0.08], [0, 3.55, -16.83], mats.wallDark);
  addBox(scene, 'left-navy-band', [0.08, 0.82, 33], [-19.62, 3.55, 0], mats.wallDark);
  addBox(scene, 'right-navy-band', [0.08, 0.82, 33], [19.62, 3.55, 0], mats.wallDark);

  const columns = [];
  for (const x of [-18.7, 18.7]) for (const z of [-14, -5, 5, 14]) columns.push({ x, y: 2.0, z, sx: 0.48, sy: 4.0, sz: 0.48 });
  addInstances('architectural-columns', boxGeo, mats.wallLight, columns);

  // Perimeter glazing and light diffusers create readable depth in the open-roof room.
  for (const z of [-11.5, -3.5, 4.5, 12.5]) {
    addBox(scene, `left-window-${z}`, [0.06, 1.9, 4.4], [-19.58, 2.15, z], mats.glass);
    addBox(scene, `right-window-${z}`, [0.06, 1.9, 4.4], [19.58, 2.15, z], mats.glass);
  }
  const ceilingLights = [];
  for (const x of [-12, -4, 4, 12]) for (const z of [-12, -4, 4, 12]) ceilingLights.push({ x, y: 4.18, z, sx: 2.9, sy: 0.08, sz: 0.72 });
  addInstances('ceiling-light-diffusers', boxGeo, mats.emissive, ceilingLights);

  // Branded architectural signs are high-resolution canvas textures, not tiny 3D text.
  function signTexture(title, subtitle, accent = '#24c3a9') {
    return makeCanvasTexture((ctx, w, h) => {
      ctx.fillStyle = '#102b3b'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = accent; ctx.fillRect(0, 0, 18, h);
      ctx.fillStyle = '#f2f7f4'; ctx.font = 'bold 76px Arial'; ctx.fillText(title, 58, 100);
      ctx.fillStyle = '#91b4bb'; ctx.font = 'bold 28px Arial'; ctx.fillText(subtitle, 62, 150);
    }, 1024, 200);
  }
  function addSign(title, subtitle, position, size, rotationY = 0, accent) {
    const texture = signTexture(title, subtitle, accent);
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide });
    materials.push(material);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), material);
    geometries.push(mesh.geometry); mesh.position.set(...position); mesh.rotation.y = rotationY; scene.add(mesh);
    return mesh;
  }
  addSign('CALLORIA', 'EVERY CALL  ·  EVERY CUSTOMER  ·  EVERY CAREER', [0, 3.15, -16.82], [9.4, 1.85]);
  addSign('CUSTOMER OPERATIONS', 'AGENT FLOOR  /  12 LIVE WORKSTATIONS', [0, 3.25, -2.1], [8.2, 1.45], 0, '#1f9a91');
  addSign('RECEPTION', 'VISITOR CHECK-IN  /  STAFF ACCESS', [-15.1, 2.65, 14.7], [4.2, 0.9], Math.PI, '#d4a35f');
  addSign('TRAINING', 'LEARNING  /  BRIEFINGS  /  COACHING', [-13.3, 2.62, -14.45], [5.0, 0.86], 0, '#3e86a4');
  addSign('QUALITY ASSURANCE', 'CALL REVIEW  /  CALIBRATION', [13.0, 2.62, -14.45], [5.0, 0.86], 0, '#8d6f9b');

  // Distinct departmental rooms and flooring.
  addBox(scene, 'training-zone-floor', [7.2, 0.055, 6.3], [-13.1, 0.0, -11.15], mats.blueDark);
  addBox(scene, 'qa-zone-floor', [7.2, 0.055, 6.3], [13.1, 0.0, -11.15], mats.blueDark);
  addBox(scene, 'supervisor-zone-floor', [7.2, 0.055, 6.4], [13.1, 0.0, -1.7], mats.blue);
  addBox(scene, 'it-zone-floor', [7.2, 0.055, 6.3], [13.1, 0.0, 8.2], mats.blueDark);
  addBox(scene, 'lounge-zone-floor', [7.2, 0.055, 6.3], [-13.1, 0.0, 1.9], mats.blue);

  // Training room: facilitator desk, display, rows of chairs and a low glass divider.
  addBox(scene, 'training-back-wall', [7.5, 2.75, 0.16], [-13.1, 1.38, -14.55], mats.wallLight);
  addBox(scene, 'training-side-wall', [0.16, 2.75, 6.4], [-16.7, 1.38, -11.2], mats.wallLight);
  addBox(scene, 'training-display-frame', [3.2, 1.75, 0.16], [-13.1, 2.25, -14.38], mats.screenFrame);
  addBox(scene, 'training-display-screen', [2.98, 1.52, 0.025], [-13.1, 2.25, -14.27], mats.screenFrame);
  addBox(scene, 'training-trainer-desk', [3.5, 0.16, 1.2], [-13.1, 0.86, -12.9], mats.wood);
  const trainingChairs = [];
  for (const z of [-10.6, -9.2]) for (const x of [-15.25, -13.1, -10.95]) trainingChairs.push({ x, y: 0.55, z, sx: 0.72, sy: 0.12, sz: 0.72 });
  addInstances('training-chair-seats', boxGeo, mats.chair, trainingChairs);

  // QA room: glass-fronted listening booths and review monitors.
  addBox(scene, 'qa-back-wall', [7.5, 2.75, 0.16], [13.1, 1.38, -14.55], mats.wallLight);
  addBox(scene, 'qa-side-wall', [0.16, 2.75, 6.4], [16.7, 1.38, -11.2], mats.wallLight);
  addBox(scene, 'qa-glass-front', [7.15, 2.5, 0.055], [13.1, 1.27, -7.98], mats.glass);
  addBox(scene, 'qa-review-desk', [4.4, 0.14, 1.35], [13.1, 0.86, -10.0], mats.wood);

  // Supervisor office, visible through a glass partition.
  addBox(scene, 'supervisor-rear-partition', [7.4, 2.65, 0.12], [13.1, 1.33, -5.0], mats.wallLight);
  addBox(scene, 'supervisor-left-glass', [0.06, 2.55, 6.3], [9.45, 1.27, -1.8], mats.glass);
  addBox(scene, 'supervisor-right-glass', [0.06, 2.55, 6.3], [16.75, 1.27, -1.8], mats.glass);
  addBox(scene, 'supervisor-desk', [3.7, 0.16, 1.45], [13.1, 0.86, -1.15], mats.wood);
  addSign('SUPERVISOR', 'TEAM LEAD  /  LIVE ASSISTANCE', [13.1, 2.68, -4.9], [4.1, 0.82], 0, '#d4a35f');

  // IT and systems bay with server cabinets and service counter.
  addBox(scene, 'it-back-wall', [7.5, 2.7, 0.16], [13.1, 1.35, 11.25], mats.wallLight);
  addBox(scene, 'it-side-wall', [0.16, 2.7, 6.4], [16.7, 1.35, 8.1], mats.wallLight);
  const serverCases = [];
  for (const x of [10.6, 12.2, 13.8, 15.4]) serverCases.push({ x, y: 1.28, z: 10.05, sx: 1.05, sy: 2.4, sz: 0.72 });
  addInstances('it-server-cabinets', boxGeo, mats.darkMetal, serverCases);
  const serverLights = [];
  for (const x of [10.6, 12.2, 13.8, 15.4]) for (const y of [0.7, 1.1, 1.5, 1.9]) serverLights.push({ x: x - 0.22, y, z: 9.67, sx: 0.08, sy: 0.08, sz: 0.025 });
  addInstances('it-server-status-lights', boxGeo, mats.statusGreen, serverLights);
  addSign('IT & SYSTEMS', 'HARDWARE  /  NETWORK  /  PLATFORM', [13.1, 2.65, 11.17], [4.8, 0.76], Math.PI, '#3e86a4');
  addSign('STAFF LOUNGE', 'REST  /  REFRESH  /  RESET', [-13.1, 2.58, 4.96], [4.3, 0.78], Math.PI, '#d4a35f');

  // Staff lounge with seating, tables and plants.
  addBox(scene, 'lounge-rear-wall', [7.5, 2.65, 0.16], [-13.1, 1.33, 5.05], mats.wallLight);
  addBox(scene, 'lounge-side-wall', [0.16, 2.65, 6.4], [-16.7, 1.33, 1.9], mats.wallLight);
  addBox(scene, 'lounge-sofa-base', [3.7, 0.42, 1.1], [-13.1, 0.48, 2.6], mats.chair);
  addBox(scene, 'lounge-sofa-back', [3.7, 0.9, 0.28], [-13.1, 1.0, 3.05], mats.chair);
  addBox(scene, 'lounge-coffee-table', [2.4, 0.12, 1.0], [-13.1, 0.52, 0.7], mats.wood);
  addCylinder(scene, 'lounge-plant-pot', [-15.7, 0.5, -0.25], [0.38, 0.5, 0.38], mats.wood);
  addSphere(scene, 'lounge-plant-crown', [-15.7, 1.45, -0.25], [0.65, 0.95, 0.62], mats.plant);
  addSphere(scene, 'lounge-plant-highlight', [-15.2, 1.35, 0.0], [0.35, 0.6, 0.32], mats.plantLight);

  // Reception: substantial curved-looking counter, visitor chairs and access posts.
  addBox(scene, 'reception-counter-top', [5.2, 0.18, 1.35], [-15.0, 1.08, 11.85], mats.woodLight);
  addBox(scene, 'reception-counter-front', [5.05, 0.82, 0.16], [-15.0, 0.57, 12.5], mats.wallDark);
  addBox(scene, 'reception-counter-accent', [4.65, 0.07, 0.035], [-15.0, 0.82, 12.39], mats.teal);
  addBox(scene, 'reception-checkin-screen', [1.1, 0.82, 0.09], [-15.0, 1.55, 11.35], mats.screenFrame);
  const bollards = [];
  for (const x of [-17.7, -12.3]) bollards.push({ x, y: 0.52, z: 14.4, sx: 0.16, sy: 1.0, sz: 0.16 });
  addInstances('reception-access-posts', cylinderGeo, mats.gold, bollards);

  // Central workstations: 12 fixed, addressable stations, repeated parts instanced.
  const xPositions = [-8.5, -2.8, 2.9, 8.6];
  const zPositions = [-6.4, -0.4, 5.6];
  const stations = [];
  const deskTops = [], deskAprons = [], deskLegs = [], dividers = [];
  const monitorFrames = [], monitorScreens = [], monitorStands = [], keyboards = [], mice = [];
  const chairSeats = [], chairBacks = [], chairPosts = [], chairBases = [], statusLamps = [];
  let id = 1;
  for (let row = 0; row < zPositions.length; row++) {
    for (let col = 0; col < xPositions.length; col++) {
      const x = xPositions[col], z = zPositions[row];
      stations.push({ id, x, z, row, col, label: `Agent Station ${String(id).padStart(2, '0')}`, department: 'Customer Operations' });
      deskTops.push({ x, y: 0.84, z, sx: 2.75, sy: 0.15, sz: 1.34 });
      deskAprons.push({ x, y: 0.66, z: z - 0.44, sx: 2.42, sy: 0.25, sz: 0.07 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) deskLegs.push({ x: x + sx * 1.22, y: 0.39, z: z + sz * 0.55, sx: 0.075, sy: 0.78, sz: 0.075 });
      dividers.push({ x, y: 1.34, z: z - 0.71, sx: 2.72, sy: 0.78, sz: 0.075 });
      for (const mx of [-0.52, 0.52]) {
        const monitorX = x + mx, monitorZ = z - 0.44;
        monitorFrames.push({ x: monitorX, y: 1.51, z: monitorZ, sx: 0.91, sy: 0.58, sz: 0.075 });
        monitorScreens.push({ x: monitorX, y: 1.51, z: monitorZ + 0.043, sx: 0.83, sy: 0.49, sz: 0.012 });
        monitorStands.push({ x: monitorX, y: 1.17, z: monitorZ, sx: 0.08, sy: 0.32, sz: 0.08 });
      }
      keyboards.push({ x, y: 0.94, z: z + 0.12, sx: 0.78, sy: 0.055, sz: 0.28 });
      mice.push({ x: x + 0.62, y: 0.94, z: z + 0.12, sx: 0.11, sy: 0.06, sz: 0.17 });
      chairSeats.push({ x, y: 0.57, z: z + 1.36, sx: 0.82, sy: 0.16, sz: 0.82 });
      chairBacks.push({ x, y: 1.03, z: z + 1.72, sx: 0.82, sy: 0.82, sz: 0.16 });
      chairPosts.push({ x, y: 0.31, z: z + 1.36, sx: 0.075, sy: 0.54, sz: 0.075 });
      chairBases.push({ x, y: 0.1, z: z + 1.36, sx: 0.82, sy: 0.07, sz: 0.82 });
      statusLamps.push({ x: x - 1.12, y: 1.01, z: z - 0.35, sx: 0.12, sy: 0.12, sz: 0.035 });
      id++;
    }
  }
  addInstances('agent-desk-surfaces', boxGeo, mats.wood, deskTops);
  addInstances('agent-desk-aprons', boxGeo, mats.darkMetal, deskAprons);
  addInstances('agent-desk-legs', boxGeo, mats.metal, deskLegs);
  addInstances('desk-acoustic-dividers', boxGeo, mats.blueDark, dividers);
  addInstances('monitor-bezels', boxGeo, mats.screenFrame, monitorFrames);
  addInstances('monitor-active-screens', boxGeo, mats.screen, monitorScreens);
  addInstances('monitor-stands', boxGeo, mats.metal, monitorStands);
  addInstances('keyboards', boxGeo, mats.keyboard, keyboards);
  addInstances('pointing-devices', sphereGeo, mats.darkMetal, mice);
  addInstances('chair-seats', boxGeo, mats.chair, chairSeats);
  addInstances('chair-backs', boxGeo, mats.chair, chairBacks);
  addInstances('chair-posts', cylinderGeo, mats.darkMetal, chairPosts);
  addInstances('chair-bases', boxGeo, mats.darkMetal, chairBases);
  const lampMesh = addInstances('station-presence-lights', sphereGeo, mats.statusGreen, statusLamps);

  // A subtle, shared ground shadow keeps people and furniture visually anchored.
  const shadowTexture = makeCanvasTexture((ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 5, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(8,17,24,.34)'); g.addColorStop(0.55, 'rgba(8,17,24,.14)'); g.addColorStop(1, 'rgba(8,17,24,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }, 128, 128);
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, toneMapped: false });
  materials.push(shadowMat);
  const shadowGeo = shared(new THREE.PlaneGeometry(1, 1));
  const personShadows = [];

  // Locally-generated staff with torso, neck, face, hair/hijab, headset, arms,
  // forearms and visible legs. These are articulated meshes, not single blobs.
  const skinMaterials = [mats.skinA, mats.skinB, mats.skinC];
  const shirtMaterials = [mats.shirtA, mats.shirtB, mats.shirtC, mats.shirtD];
  const scarfMaterials = [mats.scarfA, mats.scarfB, mats.scarfC];
  const staff = [];
  function buildStaff(station, index, seated = true, walking = !seated) {
    const root = new THREE.Group();
    root.name = `staff-${String(index + 1).padStart(2, '0')}`;
    root.position.set(station.x, 0, station.z + (seated ? 1.36 : 0));
    root.rotation.y = Math.PI; // Character faces the workstation / central floor.
    const skin = skinMaterials[index % skinMaterials.length];
    const shirt = shirtMaterials[(index * 3 + 1) % shirtMaterials.length];
    const scarf = scarfMaterials[(index + 1) % scarfMaterials.length];
    const isHijab = index % 4 === 1 || index % 4 === 3;

    // Tailored torso, collar, placket, lanyard and employee ID badge.
    addSphere(root, 'uniform-torso', [0, 1.04, 0], [0.32, 0.4, 0.2], shirt);
    addSphere(root, 'uniform-collar-left', [-0.085, 1.355, 0.095], [0.095, 0.105, 0.12], mats.white, smallSphereGeo);
    addSphere(root, 'uniform-collar-right', [0.085, 1.355, 0.095], [0.095, 0.105, 0.12], mats.white, smallSphereGeo);
    addCylinder(root, 'neck', [0, 1.47, 0.01], [0.105, 0.18, 0.105], skin, lowCylinderGeo);
    addBox(root, 'shirt-placket', [0.026, 0.23, 0.018], [0, 1.15, 0.198], mats.white);
    addBox(root, 'staff-lanyard', [0.018, 0.28, 0.018], [0.12, 1.235, 0.203], mats.gold, 0, [0, 0, -0.22]);
    addBox(root, 'staff-id-card', [0.145, 0.18, 0.028], [0.17, 1.105, 0.205], mats.badge);
    addBox(root, 'staff-id-card-accent', [0.105, 0.026, 0.032], [0.17, 1.16, 0.224], mats.teal);

    // Head pivot allows subtle listening, speaking and attention shifts.
    const headPivot = new THREE.Group();
    headPivot.name = 'staff-head-pivot';
    headPivot.position.set(0, 1.73, 0.015);
    root.add(headPivot);
    addSphere(headPivot, 'head', [0, 0, 0], [0.235, 0.29, 0.22], skin);
    if (isHijab) {
      addSphere(headPivot, 'hijab-crown', [0, 0.085, -0.005], [0.265, 0.32, 0.245], scarf);
      addSphere(root, 'hijab-drape', [0, 1.48, -0.005], [0.29, 0.34, 0.22], scarf);
    } else {
      addSphere(headPivot, 'hair-cap', [0, 0.18, -0.015], [0.245, 0.17, 0.225], mats.hair);
      addSphere(headPivot, 'hair-back', [0, -0.01, -0.12], [0.24, 0.27, 0.16], mats.hair);
    }
    for (const side of [-1, 1]) {
      addSphere(headPivot, 'ear', [side * 0.226, -0.005, 0.005], [0.045, 0.065, 0.05], skin, smallSphereGeo);
      addSphere(headPivot, 'eye-white', [side * 0.082, 0.025, 0.202], [0.034, 0.028, 0.018], mats.eyeWhite, smallSphereGeo);
      addSphere(headPivot, 'eye-iris', [side * 0.082, 0.023, 0.218], [0.017, 0.019, 0.009], mats.eye, smallSphereGeo);
      addBox(headPivot, 'eyebrow', [0.068, 0.012, 0.014], [side * 0.082, 0.073, 0.201], mats.hair, 0, [0, 0, side * 0.06]);
      addSphere(headPivot, 'headset-earcup', [side * 0.255, -0.005, 0.015], [0.065, 0.085, 0.06], mats.headset, smallSphereGeo);
    }
    addSphere(headPivot, 'nose', [0, -0.035, 0.224], [0.035, 0.055, 0.04], skin, smallSphereGeo);
    addBox(headPivot, 'mouth', [0.064, 0.012, 0.014], [0, -0.105, 0.207], mats.lip);
    const headband = new THREE.Mesh(torusGeo, mats.headset);
    headband.name = 'headset-headband'; headband.position.set(0, 0.12, -0.015); headband.rotation.z = Math.PI; headPivot.add(headband);
    addCylinder(headPivot, 'headset-microphone', [0.18, -0.085, 0.18], [0.018, 0.18, 0.018], mats.headset, lowCylinderGeo, [0, 0, -0.65]);
    mergeStaffParts(headPivot);

    // Seated and standing legs use separate pivots so walking staff do not slide.
    const legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.name = side < 0 ? 'staff-left-leg' : 'staff-right-leg';
      if (seated) {
        leg.position.set(side * 0.13, 0.67, 0.0);
        addSphere(leg, 'thigh', [0, -0.035, 0.16], [0.13, 0.15, 0.30], mats.trousers);
        addSphere(leg, 'lower-leg', [0, -0.30, 0.41], [0.105, 0.25, 0.11], mats.trousers);
        addBox(leg, 'shoe', [0.19, 0.11, 0.31], [0, -0.55, 0.49], mats.shoe);
      } else {
        leg.position.set(side * 0.13, 0.70, 0);
        addSphere(leg, 'standing-leg', [0, -0.22, 0], [0.12, 0.34, 0.13], mats.trousers);
        addBox(leg, 'standing-shoe', [0.2, 0.11, 0.3], [0, -0.58, 0.07], mats.shoe);
      }
      mergeStaffParts(leg);
      root.add(leg); legs.push(leg);
    }

    // Arms are merged per pivot but remain articulated for typing and walking.
    const arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.name = side < 0 ? 'staff-left-arm' : 'staff-right-arm';
      arm.position.set(side * 0.29, seated ? 1.32 : 1.30, -0.005);
      if (seated) {
        const upper = new THREE.Mesh(capsuleGeo, shirt);
        upper.name = 'upper-arm'; upper.position.set(0, -0.13, 0.22); upper.rotation.x = 0.9; arm.add(upper);
        const lower = new THREE.Mesh(capsuleGeo, shirt);
        lower.name = 'forearm'; lower.scale.set(0.8, 0.78, 0.8); lower.position.set(0, -0.245, 0.59); lower.rotation.x = 1.08; arm.add(lower);
        addSphere(arm, 'hand', [0, -0.30, 0.90], [0.085, 0.055, 0.095], skin, smallSphereGeo);
        for (let finger = 0; finger < 3; finger++) {
          addSphere(arm, 'finger', [(finger - 1) * 0.035, -0.318, 0.985], [0.018, 0.018, 0.06], skin, smallSphereGeo);
        }
      } else {
        const upper = new THREE.Mesh(capsuleGeo, shirt);
        upper.name = 'upper-arm'; upper.position.set(0, -0.16, 0); upper.rotation.x = 0.06; arm.add(upper);
        const lower = new THREE.Mesh(capsuleGeo, shirt);
        lower.name = 'forearm'; lower.scale.set(0.8, 0.78, 0.8); lower.position.set(0, -0.39, 0.015); lower.rotation.x = 0.02; arm.add(lower);
        addSphere(arm, 'hand', [0, -0.60, 0.04], [0.085, 0.055, 0.095], skin, smallSphereGeo);
      }
      mergeStaffParts(arm);
      root.add(arm); arms.push(arm);
    }

    // Merge all remaining torso and clothing parts into one draw call.
    mergeStaffParts(root);
    scene.add(root);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(station.x, 0.006, station.z + (seated ? 1.36 : 0));
    shadow.scale.set(1.6, 1.1, 1); scene.add(shadow); personShadows.push(shadow);
    staff.push({
      root, arms, legs, headPivot, shadow, seated, walking,
      baseX: root.position.x, baseZ: root.position.z,
      pathRadiusX: seated ? 0 : (walking ? 1.15 : 0),
      pathRadiusZ: seated ? 0 : (walking ? 0.68 : 0),
      phase: index * 1.73, index
    });
    return root;
  }

  const occupied = Array.from({ length: 12 }, (_, index) => index).slice(0, tierDefaults.people);
  occupied.forEach((stationIndex, index) => buildStaff(stations[stationIndex], index, true, false));
  const roamingPosts = [
    { id: 0, x: -14.9, z: 9.0 },
    { id: 0, x: 5.5, z: -11.0 }
  ];
  roamingPosts.forEach((post, index) => buildStaff(post, occupied.length + index, false, true));
  // Department support personnel are present on balanced/high profiles without
  // crowding the floor on constrained phones.
  const supportPosts = tier === 'high'
    ? [{ x: 12.6, z: -1.0 }, { x: 13.2, z: 8.0 }, { x: -12.4, z: -9.0 }, { x: 12.7, z: -8.9 }]
    : tier === 'balanced'
      ? [{ x: 12.6, z: -1.0 }, { x: 13.2, z: 8.0 }]
      : [];
  supportPosts.forEach((post, index) => buildStaff(post, occupied.length + roamingPosts.length + index, false, false));

  // A few small props reinforce the contact-centre setting without filling the floor.
  const planters = [];
  for (const x of [-18.1, -8.7, 8.8, 18.1]) for (const z of [-15.0, 15.0]) planters.push({ x, y: 0.45, z, sx: 0.72, sy: 0.9, sz: 0.72 });
  addInstances('planter-pots', cylinderGeo, mats.wood, planters);
  for (const [x, z] of [[-18.1, -15], [-8.7, 15], [8.8, -15], [18.1, 15]]) {
    addSphere(scene, 'planter-foliage', [x, 1.28, z], [0.55, 0.8, 0.55], mats.plant);
    addSphere(scene, 'planter-leaf', [x + 0.22, 1.36, z - 0.16], [0.29, 0.55, 0.3], mats.plantLight, smallSphereGeo);
  }

  // -----------------------------------------------------------------------
  // PHASE 3 — architectural finish, workstation equipment and lived-in detail
  // -----------------------------------------------------------------------
  // Repeated elements are instanced. The open ceiling remains intentional so
  // the launch preview retains a clear view into the full office floor.

  // Window frames and sills make the perimeter glazing read as fitted windows.
  const windowFrames = [];
  for (const side of [-1, 1]) {
    const x = side * 19.43;
    for (const z of [-11.5, -3.5, 4.5, 12.5]) {
      windowFrames.push({ x, y: 2.15, z: z - 2.18, sx: 0.12, sy: 2.02, sz: 0.09 });
      windowFrames.push({ x, y: 2.15, z: z + 2.18, sx: 0.12, sy: 2.02, sz: 0.09 });
      windowFrames.push({ x, y: 1.17, z, sx: 0.16, sy: 0.11, sz: 4.42 });
      windowFrames.push({ x, y: 3.13, z, sx: 0.16, sy: 0.11, sz: 4.42 });
      windowFrames.push({ x: side * 19.34, y: 2.15, z, sx: 0.13, sy: 2.02, sz: 0.075 });
    }
  }
  addInstances('perimeter-window-frames', boxGeo, mats.metal, windowFrames);

  // Acoustic ceiling rafts, service rails and HVAC units add scale overhead
  // without placing a roof over the camera or increasing shadow-map cost.
  const acousticRafts = [], serviceRails = [], ventSlats = [];
  for (const x of [-10.4, -5.2, 0, 5.2, 10.4]) {
    for (const z of [-8.0, -2.8, 2.4, 7.6, 12.8]) {
      acousticRafts.push({ x, y: 4.43, z, sx: 3.65, sy: 0.075, sz: 0.12 });
    }
  }
  for (const z of [-15.8, -8, 0, 8, 15.8]) {
    serviceRails.push({ x: 0, y: 4.52, z, sx: 38.0, sy: 0.055, sz: 0.055 });
  }
  for (const x of [-13.6, -6.8, 6.8, 13.6]) {
    // Small linear HVAC diffusers mounted above the side rooms.
    for (const z of [-11.2, -1.8, 8.0]) {
      ventSlats.push({ x, y: 4.16, z, sx: 1.5, sy: 0.07, sz: 0.52 });
    }
  }
  addInstances('acoustic-ceiling-rafter-panels', boxGeo, mats.wallDark, acousticRafts);
  addInstances('ceiling-service-rails', boxGeo, mats.metal, serviceRails);
  addInstances('hvac-diffuser-cassettes', boxGeo, mats.white, ventSlats);
  const ventLines = [];
  for (const x of [-13.6, -6.8, 6.8, 13.6]) {
    for (const z of [-11.2, -1.8, 8.0]) {
      for (let i = -2; i <= 2; i++) ventLines.push({ x: x + i * 0.22, y: 4.115, z, sx: 0.025, sy: 0.018, sz: 0.42 });
    }
  }
  addInstances('hvac-vent-slats', boxGeo, mats.darkMetal, ventLines);

  // Clear pedestrian routes and department boundaries use thin flush inlays.
  const floorInlays = [];
  for (const x of [-10.25, 10.25]) {
    floorInlays.push({ x, y: 0.012, z: 0, sx: 0.065, sy: 0.018, sz: 29.4 });
  }
  for (const z of [-8.5, 8.6]) {
    floorInlays.push({ x: 0, y: 0.013, z, sx: 19.6, sy: 0.018, sz: 0.055 });
  }
  for (const z of [-13.9, -11.8, -9.7, -7.6, -5.5, -3.4, -1.3, 0.8, 2.9, 5.0, 7.1, 9.2, 11.3, 13.4]) {
    floorInlays.push({ x: 0, y: 0.01, z, sx: 0.9, sy: 0.014, sz: 0.035 });
  }
  addInstances('floor-wayfinding-inlays', boxGeo, mats.gold, floorInlays);

  // Desk equipment gives each live station a recognisable contact-centre setup.
  const cpuCases = [], cpuFronts = [], cpuLights = [], cableTrays = [];
  const phoneBases = [], phoneDisplays = [], phoneKeys = [], deskMats = [], webcams = [];
  const cupBases = [], paperStacks = [];
  for (const station of stations) {
    const { x, z } = station;
    cpuCases.push({ x: x - 1.12, y: 0.37, z: z - 0.22, sx: 0.34, sy: 0.59, sz: 0.48 });
    cpuFronts.push({ x: x - 1.12, y: 0.38, z: z + 0.027, sx: 0.23, sy: 0.42, sz: 0.018 });
    cpuLights.push({ x: x - 1.12, y: 0.55, z: z + 0.041, sx: 0.045, sy: 0.035, sz: 0.012 });
    cableTrays.push({ x, y: 0.58, z: z - 0.42, sx: 1.75, sy: 0.07, sz: 0.16 });
    phoneBases.push({ x: x + 1.02, y: 0.96, z: z + 0.12, sx: 0.37, sy: 0.06, sz: 0.25 });
    phoneDisplays.push({ x: x + 1.02, y: 1.005, z: z + 0.015, sx: 0.19, sy: 0.035, sz: 0.012 });
    for (let key = 0; key < 6; key++) {
      phoneKeys.push({ x: x + 0.91 + (key % 3) * 0.105, y: 0.999, z: z + 0.12 + Math.floor(key / 3) * 0.075, sx: 0.045, sy: 0.018, sz: 0.035 });
    }
    deskMats.push({ x, y: 0.927, z: z + 0.19, sx: 1.05, sy: 0.018, sz: 0.47 });
    webcams.push({ x: x - 0.52, y: 1.82, z: z - 0.39, sx: 0.13, sy: 0.055, sz: 0.07 });
    webcams.push({ x: x + 0.52, y: 1.82, z: z - 0.39, sx: 0.13, sy: 0.055, sz: 0.07 });
    cupBases.push({ x: x - 1.02, y: 1.06, z: z + 0.24, sx: 0.14, sy: 0.14, sz: 0.14 });
    paperStacks.push({ x: x + 0.43, y: 0.985, z: z + 0.24, sx: 0.34, sy: 0.045, sz: 0.24 });
  }
  addInstances('workstation-computer-towers', boxGeo, mats.darkMetal, cpuCases);
  addInstances('workstation-computer-front-panels', boxGeo, mats.black, cpuFronts);
  addInstances('workstation-computer-activity-lights', boxGeo, mats.statusGreen, cpuLights);
  addInstances('workstation-cable-management-trays', boxGeo, mats.darkMetal, cableTrays);
  addInstances('workstation-desk-phones', boxGeo, mats.screenFrame, phoneBases);
  addInstances('workstation-phone-displays', boxGeo, mats.statusGreen, phoneDisplays);
  addInstances('workstation-phone-keypads', boxGeo, mats.metal, phoneKeys);
  addInstances('workstation-writing-mats', boxGeo, mats.blueDark, deskMats);
  addInstances('monitor-webcams', boxGeo, mats.black, webcams);
  addInstances('workstation-mugs', cylinderGeo, mats.white, cupBases);
  addInstances('workstation-paper-stacks', boxGeo, mats.paper, paperStacks);

  // Training seating becomes complete furniture instead of floating seat pads.
  const trainingBacks = [], trainingLegs = [];
  for (const z of [-10.6, -9.2]) for (const x of [-15.25, -13.1, -10.95]) {
    trainingBacks.push({ x, y: 0.91, z: z + 0.28, sx: 0.72, sy: 0.68, sz: 0.12 });
    for (const sx of [-0.25, 0.25]) {
      for (const sz of [-0.23, 0.23]) trainingLegs.push({ x: x + sx, y: 0.27, z: z + sz, sx: 0.055, sy: 0.52, sz: 0.055 });
    }
  }
  addInstances('training-chair-backrests', boxGeo, mats.chair, trainingBacks);
  addInstances('training-chair-legs', boxGeo, mats.metal, trainingLegs);
  addBox(scene, 'training-facilitator-platform', [4.4, 0.16, 0.72], [-13.1, 0.13, -13.55], mats.woodLight);
  addSign('STAFF DEVELOPMENT', 'PRODUCT KNOWLEDGE  /  CUSTOMER CARE  /  COMPLIANCE', [-13.1, 2.98, -12.9], [4.9, 0.82], 0, '#3e86a4');

  // QA and supervisor worktops receive review consoles and readable display faces.
  const reviewScreens = [], reviewBases = [], supervisorScreens = [], supervisorBases = [];
  for (const x of [11.55, 14.65]) {
    reviewBases.push({ x, y: 1.18, z: -10.18, sx: 0.10, sy: 0.48, sz: 0.10 });
    reviewScreens.push({ x, y: 1.59, z: -10.18, sx: 1.25, sy: 0.74, sz: 0.07 });
  }
  for (const x of [12.35, 13.85]) {
    supervisorScreens.push({ x, y: 1.48, z: -1.3, sx: 0.92, sy: 0.55, sz: 0.06 });
    supervisorBases.push({ x, y: 1.16, z: -1.3, sx: 0.08, sy: 0.34, sz: 0.08 });
  }
  addInstances('qa-review-monitor-stands', boxGeo, mats.metal, reviewBases);
  addInstances('qa-review-monitor-bezels', boxGeo, mats.screenFrame, reviewScreens);
  addInstances('supervisor-console-monitor-stands', boxGeo, mats.metal, supervisorBases);
  addInstances('supervisor-console-monitors', boxGeo, mats.screenFrame, supervisorScreens);
  const reviewScreenFaces = reviewScreens.map((item) => ({ ...item, z: item.z + 0.041, sx: 1.12, sy: 0.62, sz: 0.012 }));
  const supervisorScreenFaces = supervisorScreens.map((item) => ({ ...item, z: item.z + 0.036, sx: 0.82, sy: 0.45, sz: 0.012 }));
  addInstances('qa-review-screen-faces', boxGeo, mats.screen, reviewScreenFaces);
  addInstances('supervisor-screen-faces', boxGeo, mats.screen, supervisorScreenFaces);

  // A compact helpdesk counter and printer make the IT bay read as an actual unit.
  addBox(scene, 'it-service-counter-top', [3.8, 0.13, 0.84], [13.1, 0.93, 7.2], mats.woodLight);
  addBox(scene, 'it-service-counter-front', [3.75, 0.82, 0.12], [13.1, 0.48, 7.58], mats.wallDark);
  addBox(scene, 'it-printer-base', [0.78, 0.56, 0.62], [15.1, 1.18, 7.15], mats.white);
  addBox(scene, 'it-printer-top', [0.86, 0.09, 0.68], [15.1, 1.51, 7.15], mats.darkMetal);
  addBox(scene, 'it-printer-output', [0.48, 0.035, 0.28], [15.1, 1.57, 7.0], mats.paper);
  addBox(scene, 'it-network-wall-panel', [2.25, 1.35, 0.12], [11.1, 2.2, 11.12], mats.darkMetal);
  const networkPorts = [];
  for (let row = 0; row < 4; row++) for (let col = 0; col < 6; col++) {
    networkPorts.push({ x: 10.35 + col * 0.29, y: 1.78 + row * 0.22, z: 11.04, sx: 0.07, sy: 0.07, sz: 0.025 });
  }
  addInstances('it-network-port-indicators', boxGeo, mats.statusGreen, networkPorts);

  // Staff lounge: water dispenser, kitchenette, cups and soft seating details.
  addBox(scene, 'lounge-kitchen-counter', [3.6, 0.16, 0.72], [-13.1, 0.92, 0.05], mats.woodLight);
  addBox(scene, 'lounge-kitchen-base', [3.5, 0.82, 0.58], [-13.1, 0.43, 0.17], mats.wallDark);
  addBox(scene, 'lounge-water-dispenser-base', [0.48, 0.78, 0.48], [-16.0, 0.53, 0.08], mats.white);
  addCylinder(scene, 'lounge-water-bottle', [-16.0, 1.35, 0.08], [0.19, 0.46, 0.19], mats.equipmentBlue, lowCylinderGeo);
  addBox(scene, 'lounge-water-tap-panel', [0.31, 0.24, 0.035], [-16.0, 0.94, 0.335], mats.darkMetal);
  addBox(scene, 'lounge-coffee-machine', [0.52, 0.56, 0.42], [-12.2, 1.28, 0.04], mats.darkMetal);
  addBox(scene, 'lounge-coffee-machine-display', [0.25, 0.13, 0.025], [-12.2, 1.37, 0.263], mats.statusGreen);
  const sofaPillows = [];
  for (const x of [-14.25, -13.1, -11.95]) sofaPillows.push({ x, y: 1.11, z: 3.0, sx: 0.78, sy: 0.42, sz: 0.22 });
  addInstances('lounge-sofa-cushions', boxGeo, mats.blue, sofaPillows);

  // Reception waiting area and controlled staff access.
  const waitingSeats = [], waitingBacks = [], waitingLegs = [], accessScanners = [];
  for (const x of [-17.65, -15.0, -12.35]) {
    waitingSeats.push({ x, y: 0.54, z: 15.55, sx: 0.9, sy: 0.16, sz: 0.78 });
    waitingBacks.push({ x, y: 1.02, z: 15.91, sx: 0.9, sy: 0.78, sz: 0.14 });
    for (const dx of [-0.32, 0.32]) for (const dz of [-0.24, 0.24]) {
      waitingLegs.push({ x: x + dx, y: 0.26, z: 15.55 + dz, sx: 0.06, sy: 0.52, sz: 0.06 });
    }
  }
  for (const x of [-17.8, -12.2]) accessScanners.push({ x, y: 1.12, z: 13.8, sx: 0.32, sy: 0.72, sz: 0.25 });
  addInstances('reception-waiting-seats', boxGeo, mats.chair, waitingSeats);
  addInstances('reception-waiting-seat-backs', boxGeo, mats.chair, waitingBacks);
  addInstances('reception-waiting-seat-legs', boxGeo, mats.metal, waitingLegs);
  addInstances('reception-access-control-readers', boxGeo, mats.darkMetal, accessScanners);
  const accessReaderLights = accessScanners.map((item) => ({ x: item.x, y: 1.36, z: item.z + 0.135, sx: 0.14, sy: 0.07, sz: 0.02 }));
  addInstances('reception-access-reader-indicators', boxGeo, mats.statusGreen, accessReaderLights);

  // Safety and operational wall fittings: fire points, exit markers and a
  // service clock. These are static local meshes, not external dependencies.
  for (const x of [-19.48, 19.48]) {
    addBox(scene, 'wall-mounted-fire-extinguisher', [0.28, 0.76, 0.24], [x, 0.66, 0.0], mats.safetyRed);
    addBox(scene, 'fire-extinguisher-label', [0.18, 0.23, 0.018], [x, 0.74, 0.132], mats.safetyWhite);
  }
  // Two narrow posts support the exit marker across the open reception threshold.
  addBox(scene, 'exit-marker-left-support', [0.10, 3.6, 0.10], [-1.05, 1.8, 16.82], mats.metal);
  addBox(scene, 'exit-marker-right-support', [0.10, 3.6, 0.10], [1.05, 1.8, 16.82], mats.metal);
  addBox(scene, 'main-exit-sign-panel', [2.1, 0.48, 0.08], [0, 3.84, 16.82], mats.statusGreen);
  addSign('EMERGENCY EXIT', 'KEEP ACCESS CLEAR', [0, 3.84, 16.76], [1.95, 0.42], Math.PI, '#1d9c79');
  addBox(scene, 'operations-values-board-frame', [5.6, 1.62, 0.14], [0, 2.05, -16.77], mats.woodLight);
  addSign('SERVICE  •  RESPECT  •  RESOLUTION', 'LISTEN CAREFULLY  /  TAKE OWNERSHIP  /  CLOSE THE LOOP', [0, 2.07, -16.68], [5.25, 1.34], 0, '#b78b53');
  addBox(scene, 'staff-noticeboard-frame', [3.2, 1.8, 0.14], [-8.4, 2.0, -16.77], mats.woodLight);
  addSign('TEAM BRIEFINGS', '07:30  MORNING  •  14:00  AFTERNOON', [-8.4, 2.0, -16.68], [2.94, 1.42], 0, '#3e86a4');
  addBox(scene, 'staff-noticeboard-frame-right', [3.2, 1.8, 0.14], [8.4, 2.0, -16.77], mats.woodLight);
  addSign('QUALITY STANDARD', 'ACCURACY  /  EMPATHY  /  COMPLIANCE', [8.4, 2.0, -16.68], [2.94, 1.42], 0, '#8d6f9b');

  // Small acoustic wall panels break up the long blank wall surfaces.
  const wallPanels = [];
  for (const x of [-16, -11, -6, 0, 6, 11, 16]) {
    wallPanels.push({ x, y: 1.95, z: -16.72, sx: 2.1, sy: 1.0, sz: 0.045 });
  }
  addInstances('rear-wall-acoustic-panels', boxGeo, mats.blueDark, wallPanels);
  const wallPanelAccents = [];
  for (const x of [-16, -11, -6, 0, 6, 11, 16]) {
    wallPanelAccents.push({ x, y: 1.42, z: -16.685, sx: 1.65, sy: 0.035, sz: 0.018 });
  }
  addInstances('rear-wall-panel-accent-lines', boxGeo, mats.teal, wallPanelAccents);

  // Visual wayfinding signs mark the floor and department entrances.
  addSign('EMAIL & BACK OFFICE', 'WRITTEN CUSTOMER SUPPORT', [-9.9, 2.58, 8.3], [4.3, 0.76], Math.PI, '#3e86a4');
  addSign('SOCIAL & DIGITAL', 'CHAT  /  SOCIAL CARE  /  MESSAGING', [-9.9, 2.58, -1.4], [4.3, 0.76], Math.PI, '#1f9a91');
  addSign('EMAIL & BACK OFFICE', 'WRITTEN CUSTOMER SUPPORT', [-19.54, 2.55, 8.25], [4.0, 0.72], Math.PI / 2, '#3e86a4');
  addSign('SOCIAL & DIGITAL', 'CHAT  /  SOCIAL CARE  /  MESSAGING', [-19.54, 2.55, -7.5], [3.25, 0.72], Math.PI / 2, '#1f9a91');

  // Preview camera and first-person controller.
  const preview = { azimuth: 0.52, elevation: 0.43, radius: 40.5, target: new THREE.Vector3(0, 1.25, -0.35) };
  const player = { x: 0, z: 15.0, yaw: 0, pitch: -0.04, speed: 4.35 };
  const keys = new Set();
  const touchMove = { x: 0, y: 0, pointerId: null, sprinting: false };
  let immersive = false;
  let dragging = false;
  let lastPointer = { x: 0, y: 0 };
  let nearestStation = null;
  let lastNearestId = null;
  let agentActivity = 'offline';
  let frameId = 0;
  let loopActive = false;
  let lastFrameAt = 0;
  let avgFrameMs = 0;
  let perfLastUi = 0;
  let lowFpsStreak = 0;
  let headroomStreak = 0;
  let currentRatio = renderer.getPixelRatio();
  let ratioCap = currentRatio;
  let disposed = false;
  let contextLost = false;
  let statusTimer = 0;
  let hostInView = true;
  const listeners = [];
  const listen = (target, type, handler, options) => {
    target?.addEventListener(type, handler, options);
    listeners.push(() => target?.removeEventListener(type, handler, options));
  };

  function setPreviewCamera() {
    const horizontal = Math.cos(preview.elevation) * preview.radius;
    camera.position.set(
      preview.target.x + Math.sin(preview.azimuth) * horizontal,
      preview.target.y + Math.sin(preview.elevation) * preview.radius,
      preview.target.z + Math.cos(preview.azimuth) * horizontal
    );
    camera.lookAt(preview.target);
  }
  function resize() {
    const width = Math.max(1, host.clientWidth || 1);
    const height = Math.max(1, host.clientHeight || 1);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    renderer.setPixelRatio(currentRatio);
    renderer.setSize(width, height, false);
    if (!immersive) renderStill();
  }
  function renderStill() {
    if (!disposed && !contextLost && !document.hidden && host.clientWidth > 0 && host.clientHeight > 0) {
      renderer.render(scene, camera);
      updatePerfPanel();
    }
  }
  function applyProfile(next, persist = true) {
    if (!['auto', 'smooth', 'balanced', 'sharp'].includes(next)) return;
    profile = next;
    if (persist) { try { localStorage.setItem(profileKey, next); } catch { /* Ignore storage errors. */ } }
    const dpr = window.devicePixelRatio || 1;
    if (next === 'smooth') { ratioCap = Math.min(mobile ? 0.98 : 1.05, dpr); qualityFps = Math.min(tierDefaults.fps, 30); }
    else if (next === 'balanced') { ratioCap = Math.min(mobile ? 1.18 : 1.28, dpr); qualityFps = Math.min(tierDefaults.fps, 45); }
    else if (next === 'sharp') { ratioCap = Math.min(mobile ? 1.42 : 1.65, dpr); qualityFps = Math.min(tierDefaults.fps, 60); }
    else { ratioCap = Math.min(tierDefaults.ratio, dpr, mobile ? 1.55 : 1.85); qualityFps = tierDefaults.fps; }
    currentRatio = Math.max(tierDefaults.minRatio, ratioCap);
    renderer.setPixelRatio(currentRatio); resize();
    if (profileSelect) profileSelect.value = profile;
  }
  let qualityFps = tierDefaults.fps;

  // Performance Lab is deliberately compact and optional; it does not obscure the floor.
  const panelRoot = host.closest('.world-panel') || host.parentElement || document.body;
  const perfButton = document.createElement('button');
  perfButton.type = 'button'; perfButton.textContent = 'GRAPHICS'; perfButton.setAttribute('aria-expanded', 'false');
  perfButton.style.cssText = 'position:absolute;z-index:12;right:14px;top:14px;padding:8px 11px;border:1px solid rgba(160,220,216,.42);border-radius:8px;background:rgba(8,27,39,.84);color:#dff9f2;font:700 10px system-ui;letter-spacing:.12em;cursor:pointer;';
  const perfPanel = document.createElement('section');
  perfPanel.hidden = true;
  perfPanel.style.cssText = 'position:absolute;z-index:12;right:14px;top:50px;width:min(260px,calc(100% - 28px));padding:13px;border:1px solid rgba(160,220,216,.28);border-radius:10px;background:rgba(7,22,33,.94);color:#e8f3f1;font:11px/1.55 system-ui;box-shadow:0 14px 36px rgba(0,0,0,.28);';
  perfPanel.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong style="letter-spacing:.1em">PERFORMANCE LAB</strong><button type="button" data-close style="background:none;border:0;color:#fff;font-size:18px">×</button></div><label for="calloria-graphics-profile" style="display:block;color:#8fb5bb;margin-bottom:4px">GRAPHICS PROFILE</label><select id="calloria-graphics-profile" style="width:100%;padding:7px;background:#183445;color:#fff;border:1px solid #42616c;border-radius:6px"><option value="auto">Automatic</option><option value="smooth">Smooth</option><option value="balanced">Balanced</option><option value="sharp">Sharp</option></select><div data-stats style="margin-top:10px;color:#bcd2d3">Preparing render metrics…</div>`;
  panelRoot.append(perfButton, perfPanel);
  const profileSelect = perfPanel.querySelector('#calloria-graphics-profile');
  perfButton.addEventListener('click', () => {
    perfPanel.hidden = !perfPanel.hidden;
    perfButton.setAttribute('aria-expanded', String(!perfPanel.hidden));
    if (!perfPanel.hidden) updatePerfPanel(true);
  });
  perfPanel.querySelector('[data-close]')?.addEventListener('click', () => { perfPanel.hidden = true; perfButton.setAttribute('aria-expanded', 'false'); });
  profileSelect?.addEventListener('change', () => applyProfile(profileSelect.value, true));
  function updatePerfPanel(force = false) {
    if (perfPanel.hidden) return;
    const now = performance.now();
    if (!force && now - perfLastUi < 450) return;
    perfLastUi = now;
    const info = renderer.info;
    const stats = perfPanel.querySelector('[data-stats]');
    if (stats) stats.innerHTML = `FPS: <b>${avgFrameMs ? (1000 / avgFrameMs).toFixed(1) : '—'}</b><br>Draw calls: <b>${info.render.calls}</b><br>Triangles: <b>${info.render.triangles.toLocaleString()}</b><br>Geometry / textures: <b>${info.memory.geometries} / ${info.memory.textures}</b><br>Pixel ratio: <b>${currentRatio.toFixed(2)}×</b><br>Device profile: <b>${tier.toUpperCase()}</b>`;
  }

  if (profile !== 'auto') applyProfile(profile, false);
  else { profileSelect.value = 'auto'; }
  setPreviewCamera();
  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (resizeObserver) resizeObserver.observe(host); else listen(window, 'resize', resize, { passive: true });
  resize();

  function isBlocked(x, z) {
    if (x < -19.0 || x > 19.0 || z < -16.0 || z > 16.0) return true;
    // Station desks are solid; the approach side (z + 1.8 to +2.8) stays open.
    for (const station of stations) {
      if (Math.abs(x - station.x) < 1.3 && z > station.z - 0.98 && z < station.z + 0.78) return true;
    }
    // Fixed room walls, leaving each entrance open toward the central aisle.
    if (x > 9.2 && x < 17.0 && z < -7.75 && z > -14.7) return true;
    if (x < -9.2 && x > -17.0 && z < -14.0 && z > -14.8) return true;
    if (x > 16.65 && x < 17.3 && z > -4.8 && z < 4.9) return true;
    if (x > 16.65 && x < 17.3 && z > 5.1 && z < 11.2) return true;
    return false;
  }
  function updatePlayer(delta) {
    const forwardInput = clamp((keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - touchMove.y, -1, 1);
    const sideInput = clamp((keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + touchMove.x, -1, 1);
    if (forwardInput || sideInput) {
      const length = Math.hypot(forwardInput, sideInput) || 1;
      const forward = forwardInput / length;
      const side = sideInput / length;
      const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') || touchMove.sprinting;
      const speed = player.speed * (sprint ? 1.55 : 1);
      const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
      const dx = (side * cos - forward * sin) * speed * delta;
      const dz = (side * sin - forward * cos) * speed * delta;
      if (!isBlocked(player.x + dx, player.z)) player.x += dx;
      if (!isBlocked(player.x, player.z + dz)) player.z += dz;
    }
    camera.position.set(player.x, 1.68, player.z);
    camera.rotation.order = 'YXZ'; camera.rotation.set(player.pitch, player.yaw, 0);
    let closest = Infinity, next = null;
    for (const station of stations) {
      const distance = Math.hypot(player.x - station.x, player.z - (station.z + 2.05));
      if (distance < closest) { closest = distance; next = station; }
    }
    nearestStation = closest <= 2.9 ? next : null;
    const interact = document.getElementById('touchInteractButton');
    if (interact) interact.disabled = !nearestStation;
    if ((nearestStation?.id || null) !== lastNearestId) {
      lastNearestId = nearestStation?.id || null;
      callbacks.onNearestStation?.(nearestStation ? { id: nearestStation.id, label: nearestStation.label, department: nearestStation.department } : null);
    }
  }

  function updateStaff(delta, elapsed) {
    for (const person of staff) {
      const phase = person.phase;
      if (person.headPivot) {
        person.headPivot.rotation.y = Math.sin(elapsed * 0.74 + phase) * (person.seated ? 0.045 : 0.085);
        person.headPivot.rotation.x = Math.sin(elapsed * 1.12 + phase * 0.7) * 0.018;
      }
      if (person.seated) {
        const typing = Math.sin(elapsed * 5.2 + phase);
        person.arms[0].rotation.x = -0.05 + typing * 0.065;
        person.arms[1].rotation.x = -0.05 - typing * 0.06;
        person.arms[0].rotation.z = 0.04 + Math.sin(elapsed * 2.4 + phase) * 0.025;
        person.arms[1].rotation.z = -0.04 - Math.sin(elapsed * 2.4 + phase) * 0.025;
        person.root.position.y = Math.sin(elapsed * 1.7 + phase) * 0.006;
        person.legs[0].rotation.x = Math.sin(elapsed * 1.45 + phase) * 0.018;
        person.legs[1].rotation.x = -Math.sin(elapsed * 1.45 + phase) * 0.018;
      } else if (person.walking) {
        const stride = elapsed * 0.72 + phase;
        const wave = Math.sin(stride);
        person.root.position.x = person.baseX + Math.sin(stride) * person.pathRadiusX;
        person.root.position.z = person.baseZ + Math.cos(stride * 0.72) * person.pathRadiusZ;
        const velocityX = Math.cos(stride) * person.pathRadiusX;
        const velocityZ = -Math.sin(stride * 0.72) * 0.72 * person.pathRadiusZ;
        person.root.rotation.y = Math.atan2(velocityX, velocityZ);
        person.legs[0].rotation.x = wave * 0.30;
        person.legs[1].rotation.x = -wave * 0.30;
        person.arms[0].rotation.x = -wave * 0.20;
        person.arms[1].rotation.x = wave * 0.20;
        if (person.shadow) {
          person.shadow.position.x = person.root.position.x;
          person.shadow.position.z = person.root.position.z;
        }
      } else {
        // Stationary supervisors and support staff look around and gesture subtly.
        const gesture = Math.sin(elapsed * 1.8 + phase);
        person.arms[0].rotation.x = -0.04 + gesture * 0.045;
        person.arms[1].rotation.x = -0.04 - gesture * 0.045;
        person.arms[0].rotation.z = 0.02 + gesture * 0.018;
        person.arms[1].rotation.z = -0.02 - gesture * 0.018;
      }
    }
  }

  function startLoop() {
    if (loopActive || disposed || contextLost || document.hidden || !immersive || !hostInView) return;
    loopActive = true; lastFrameAt = 0; frameId = requestAnimationFrame(animate);
  }
  function stopLoop() {
    loopActive = false; if (frameId) cancelAnimationFrame(frameId); frameId = 0;
  }
  function adaptResolution(frameMs, timestamp) {
    avgFrameMs = avgFrameMs ? avgFrameMs * 0.84 + frameMs * 0.16 : frameMs;
    if (!adaptResolution.lastCheck) { adaptResolution.lastCheck = timestamp; return; }
    if (timestamp - adaptResolution.lastCheck < 2600) return;
    adaptResolution.lastCheck = timestamp;
    const target = 1000 / qualityFps;
    if (avgFrameMs > target * 1.28) { lowFpsStreak++; headroomStreak = 0; }
    else if (avgFrameMs < target * 1.04) { headroomStreak++; lowFpsStreak = Math.max(0, lowFpsStreak - 1); }
    else { lowFpsStreak = Math.max(0, lowFpsStreak - 1); headroomStreak = 0; }
    let next = currentRatio;
    if (lowFpsStreak >= 2) { next = Math.max(tierDefaults.minRatio, currentRatio - 0.08); lowFpsStreak = 0; }
    else if (headroomStreak >= 3) { next = Math.min(ratioCap, currentRatio + 0.035); headroomStreak = 0; }
    if (Math.abs(next - currentRatio) >= 0.02) { currentRatio = Number(next.toFixed(2)); renderer.setPixelRatio(currentRatio); renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight), false); }
  }
  function animate(timestamp) {
    if (!loopActive || disposed || contextLost) return;
    if (document.hidden || !immersive) { stopLoop(); return; }
    const interval = 1000 / qualityFps;
    if (lastFrameAt && timestamp - lastFrameAt < interval) { frameId = requestAnimationFrame(animate); return; }
    const frameMs = lastFrameAt ? timestamp - lastFrameAt : interval;
    const delta = Math.min(frameMs / 1000, 0.05);
    lastFrameAt = timestamp;
    updatePlayer(delta);
    if (!animate.lastStaffAt || timestamp - animate.lastStaffAt >= (tier === 'low' ? 65 : mobile ? 45 : 32)) {
      updateStaff(delta, timestamp / 1000); animate.lastStaffAt = timestamp;
    }
    renderer.render(scene, camera);
    adaptResolution(frameMs, timestamp);
    updatePerfPanel();
    frameId = requestAnimationFrame(animate);
  }

  function useNearestStation() {
    if (!immersive || !nearestStation) return;
    callbacks.onStation?.({ id: nearestStation.id, label: nearestStation.label, department: nearestStation.department });
  }
  function setImmersive(value) {
    if (disposed) return;
    immersive = Boolean(value);
    host.closest('.world-panel')?.classList.toggle('is-immersive', immersive);
    document.body.classList.toggle('calloria-immersive', immersive);
    if (immersive) {
      player.x = 0; player.z = 15.0; player.yaw = 0; player.pitch = -0.04;
      touchMove.x = 0; touchMove.y = 0; touchMove.sprinting = false;
      const stick = document.getElementById('touchStick'); if (stick) stick.style.transform = 'translate(0px, 0px)';
      camera.position.set(player.x, 1.68, player.z); camera.rotation.order = 'YXZ'; camera.rotation.set(player.pitch, player.yaw, 0);
      startLoop();
    } else {
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
      stopLoop(); keys.clear(); touchMove.x = 0; touchMove.y = 0; touchMove.sprinting = false; touchMove.pointerId = null;
      nearestStation = null; lastNearestId = null;
      const interact = document.getElementById('touchInteractButton'); if (interact) interact.disabled = true;
      callbacks.onNearestStation?.(null); setPreviewCamera(); renderStill();
    }
    callbacks.onImmersiveChange?.(immersive);
  }
  function enter() {
    if (disposed) return;
    setImmersive(true);
    if (!coarsePointer) { try { renderer.domElement.requestPointerLock?.(); } catch { /* Optional capability. */ } }
  }
  function exit() { setImmersive(false); }
  function setAgentActivity(status) { agentActivity = String(status || 'offline'); renderStill(); }

  const canvas = renderer.domElement;
  const renderStatusHost = host.closest('.world-panel') || host.parentElement || document.body;
  const renderStatus = document.createElement('div');
  renderStatus.setAttribute('role', 'status'); renderStatus.setAttribute('aria-live', 'polite');
  renderStatus.style.cssText = 'position:absolute;z-index:13;left:50%;top:15px;transform:translateX(-50%);max-width:80%;padding:7px 12px;border:1px solid rgba(140,210,205,.25);border-radius:8px;background:rgba(7,22,33,.88);color:#dff8f0;font:11px system-ui;text-align:center;pointer-events:none;';
  renderStatus.hidden = true; renderStatusHost.append(renderStatus);
  function showStatus(message, autoHide = false) {
    clearTimeout(statusTimer); renderStatus.textContent = message || ''; renderStatus.hidden = !message;
    if (message && autoHide) statusTimer = window.setTimeout(() => { renderStatus.hidden = true; }, 1900);
  }

  listen(canvas, 'webglcontextlost', (event) => {
    event.preventDefault(); contextLost = true; stopLoop(); keys.clear();
    showStatus('Graphics paused — restoring the 3D workplace…');
    callbacks.onRenderStatus?.({ state: 'context-lost' });
  });
  listen(canvas, 'webglcontextrestored', () => {
    contextLost = false; renderer.resetState?.(); renderer.setPixelRatio(currentRatio);
    renderer.setSize(Math.max(1, host.clientWidth || 1), Math.max(1, host.clientHeight || 1), false);
    showStatus('3D workplace restored', true); callbacks.onRenderStatus?.({ state: 'restored' });
    if (immersive) startLoop(); else renderStill();
  });
  listen(canvas, 'pointerdown', (event) => {
    if (immersive && !coarsePointer && document.pointerLockElement !== canvas) {
      try { canvas.requestPointerLock?.(); } catch { /* Mouse drag remains available. */ }
    }
    dragging = true; lastPointer = { x: event.clientX, y: event.clientY };
    try { canvas.setPointerCapture?.(event.pointerId); } catch { /* Pointer capture is optional. */ }
  });
  listen(canvas, 'pointermove', (event) => {
    if (immersive && document.pointerLockElement === canvas) return;
    if (!dragging) return;
    const dx = event.clientX - lastPointer.x, dy = event.clientY - lastPointer.y;
    if (immersive) {
      player.yaw -= dx * (coarsePointer ? 0.0045 : 0.0038);
      player.pitch = clamp(player.pitch - dy * 0.0030, -0.68, 0.42);
      camera.rotation.order = 'YXZ'; camera.rotation.set(player.pitch, player.yaw, 0);
    } else {
      preview.azimuth -= dx * 0.0037;
      preview.elevation = clamp(preview.elevation + dy * 0.0024, 0.08, 0.76);
      setPreviewCamera(); renderStill();
    }
    lastPointer = { x: event.clientX, y: event.clientY };
  });
  const endDrag = () => { dragging = false; };
  listen(canvas, 'pointerup', endDrag); listen(canvas, 'pointercancel', endDrag); listen(canvas, 'lostpointercapture', endDrag);
  listen(canvas, 'wheel', (event) => {
    if (immersive) return;
    event.preventDefault(); preview.radius = clamp(preview.radius + Math.sign(event.deltaY) * 1.35, 27, 52);
    setPreviewCamera(); renderStill();
  }, { passive: false });
  listen(document, 'pointermove', (event) => {
    if (immersive && document.pointerLockElement === canvas) {
      player.yaw -= (event.movementX || 0) * 0.0028;
      player.pitch = clamp(player.pitch - (event.movementY || 0) * 0.0022, -0.68, 0.42);
      camera.rotation.order = 'YXZ'; camera.rotation.set(player.pitch, player.yaw, 0);
    }
  });
  listen(document, 'keydown', (event) => {
    if (!immersive || isInput(event.target)) return;
    if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(event.code)) event.preventDefault();
    if (event.code === 'Escape') { if (document.pointerLockElement === canvas) document.exitPointerLock?.(); else exit(); }
    if (event.code === 'KeyE') useNearestStation();
    keys.add(event.code);
  });
  listen(document, 'keyup', (event) => keys.delete(event.code));
  listen(document, 'pointerlockchange', () => {
    if (immersive && document.pointerLockElement !== canvas && !coarsePointer) callbacks.onPointerUnlock?.();
  });
  listen(document, 'visibilitychange', () => {
    if (document.hidden) { stopLoop(); keys.clear(); resetJoystick(); touchMove.sprinting = false; }
    else if (immersive) startLoop(); else renderStill();
  });

  const joystick = document.getElementById('touchJoystick');
  const joystickKnob = document.getElementById('touchStick');
  const sprintButton = document.getElementById('touchSprintButton');
  const interactButton = document.getElementById('touchInteractButton');
  function joystickRadius() { return Math.max(24, (joystick?.clientWidth || 116) * 0.34); }
  function updateJoystick(event) {
    if (!joystick) return;
    const rect = joystick.getBoundingClientRect();
    const dx0 = event.clientX - rect.left - rect.width / 2;
    const dy0 = event.clientY - rect.top - rect.height / 2;
    const radius = joystickRadius(), distance = Math.hypot(dx0, dy0) || 1;
    const dx = distance > radius ? dx0 / distance * radius : dx0;
    const dy = distance > radius ? dy0 / distance * radius : dy0;
    touchMove.x = clamp(dx / radius, -1, 1); touchMove.y = clamp(dy / radius, -1, 1);
    if (joystickKnob) joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  function resetJoystick() {
    touchMove.x = 0; touchMove.y = 0; touchMove.pointerId = null;
    if (joystickKnob) joystickKnob.style.transform = 'translate(0px, 0px)';
  }
  listen(joystick, 'pointerdown', (event) => {
    if (!immersive) return; event.preventDefault(); touchMove.pointerId = event.pointerId;
    try { joystick.setPointerCapture?.(event.pointerId); } catch { /* Optional. */ }
    updateJoystick(event);
  });
  listen(joystick, 'pointermove', (event) => { if (immersive && touchMove.pointerId === event.pointerId) updateJoystick(event); });
  ['pointerup','pointercancel','lostpointercapture'].forEach((type) => listen(joystick, type, resetJoystick));
  listen(sprintButton, 'pointerdown', (event) => {
    if (immersive) { event.preventDefault(); touchMove.sprinting = true; try { sprintButton.setPointerCapture?.(event.pointerId); } catch { /* Optional. */ } }
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach((type) => listen(sprintButton, type, () => { touchMove.sprinting = false; }));
  listen(interactButton, 'click', useNearestStation);
  listen(window, 'pagehide', stopLoop);
  const visibilityObserver = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((entries) => {
    hostInView = entries.some((entry) => entry.isIntersecting);
    if (immersive && hostInView) startLoop();
    else if (!hostInView) stopLoop();
    else if (!immersive) renderStill();
  }, { threshold: 0.01 }) : null;
  visibilityObserver?.observe(host);

  document.body.classList.toggle('touch-device', coarsePointer);
  if (interactButton) interactButton.disabled = true;
  callbacks.onAssetsReady?.({ loaded: 0, fallback: staff.length, mode: 'merged-articulated-local-staff', tier });
  callbacks.onRenderStatus?.({ state: 'ready', tier, stations: stations.length, staff: staff.length });
  renderStill();

  return {
    scene, camera, renderer, stations,
    enter, exit, setImmersive, setAgentActivity,
    get agentActivity() { return agentActivity; },
    get immersive() { return immersive; },
    get nearestStation() { return nearestStation; },
    get assetMessage() { return 'CALLORIA 3D workplace and draw-call-merged articulated staff ready'; },
    get lowEndDevice() { return lowTier; },
    get pixelRatio() { return currentRatio; },
    get assetsReady() { return true; },
    get qualityTier() { return tier; },
    get graphicsProfile() { return profile; },
    dispose() {
      if (disposed) return;
      disposed = true; stopLoop(); visibilityObserver?.disconnect(); resizeObserver?.disconnect();
      listeners.forEach((remove) => remove()); perfButton.remove(); perfPanel.remove(); renderStatus.remove();
      clearTimeout(statusTimer);
      document.body.classList.remove('touch-device', 'calloria-immersive');
      scene.traverse((object) => {
        if (object.isMesh || object.isInstancedMesh) {
          // Geometries/materials are disposed from the shared registries below.
          object.parent?.remove(object);
        }
      });
      textures.forEach((texture) => texture.dispose?.());
      materials.forEach((material) => material.dispose?.());
      geometries.forEach((geometry) => geometry.dispose?.());
      renderer.dispose(); host.replaceChildren();
    }
  };
}
