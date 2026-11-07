/*
 * CALLORIA — performance-first 3D contact-centre world
 *
 * Complete replacement for js/production-world.js.
 * Repeated architectural and workstation parts are GPU-instanced. The launch
 * preview renders on demand instead of continuously drawing an idle scene.
 * No remote models, font downloads, texture packs, or shadow maps are required.
 */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export async function initProductionWorld(THREE, host, callbacks = {}) {
  if (!THREE || !host) throw new Error('CALLORIA 3D world requires Three.js and a canvas host.');

  const coarsePointer = Boolean(window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);
  const memory = Number(navigator.deviceMemory || 0);
  const cores = Number(navigator.hardwareConcurrency || 0);
  const saveData = Boolean(navigator.connection?.saveData);
  const mobile = coarsePointer || window.innerWidth <= 760;
  // Touch input is not a performance diagnosis. Only classify genuinely constrained
  // hardware as low; mid-range phones retain antialiasing and useful render density.
  const constrained = saveData || (memory > 0 && memory <= 2) || (cores > 0 && cores <= 2);
  const highCapability = memory >= 8 && cores >= 8;
  const tier = constrained ? 'low' : highCapability ? 'high' : 'balanced';
  const deviceQuality = {
    low: { pixelRatio: mobile ? 0.88 : 0.94, minRatio: 0.68, fps: 24, antialias: false, anisotropy: 2 },
    balanced: { pixelRatio: mobile ? 1.12 : 1.18, minRatio: mobile ? 0.78 : 0.82, fps: mobile ? 30 : 45, antialias: true, anisotropy: 4 },
    high: { pixelRatio: mobile ? 1.32 : 1.4, minRatio: 0.88, fps: mobile ? 45 : 60, antialias: true, anisotropy: 8 }
  }[tier];
  const maxAnisotropy = 8;
  let quality = { ...deviceQuality };
  let pixelRatioCap = Math.min(quality.pixelRatio, window.devicePixelRatio || 1, mobile ? 1.4 : 1.75, maxAnisotropy);
  let currentPixelRatio = pixelRatioCap;
  const graphicsProfileKey = 'calloria.graphics-profile.v1';
  let graphicsProfile = 'auto';
  try {
    const savedProfile = localStorage.getItem(graphicsProfileKey);
    if (['auto', 'smooth', 'balanced', 'sharp'].includes(savedProfile)) graphicsProfile = savedProfile;
  } catch { /* Private browsing may disable storage. */ }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#132838');
  scene.fog = new THREE.Fog('#142b39', 58, 112);
  const camera = new THREE.PerspectiveCamera(51, 1, 0.1, 120);
  const renderer = new THREE.WebGLRenderer({
    antialias: quality.antialias,
    alpha: false,
    powerPreference: tier === 'high' ? 'high-performance' : 'default',
    stencil: false,
    depth: true,
    failIfMajorPerformanceCaveat: false
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = false;
  renderer.setPixelRatio(currentPixelRatio);
  renderer.domElement.className = 'production-world-canvas';
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D contact centre. Move with WASD or the touch joystick and use a nearby workstation.');
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.style.display = 'block';
  host.replaceChildren(renderer.domElement);

  const materialCache = new Map();
  const material = (color, roughness = 0.78, metalness = 0, extra = {}) => {
    const key = `${color}|${roughness}|${metalness}|${JSON.stringify(extra)}`;
    if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }));
    return materialCache.get(key);
  };
  const mats = {
    floor: material('#ffffff', 0.94),
    carpet: material('#ffffff', 0.98),
    wall: material('#b5c3c5', 0.86),
    wallDark: material('#102635', 0.76),
    teal: material('#13b99f', 0.48, 0.08),
    tealLight: material('#7ce0c9', 0.52),
    wood: material('#ffffff', 0.62),
    woodEdge: material('#3a2b22', 0.62),
    metal: material('#7c929b', 0.48, 0.35),
    darkMetal: material('#182a38', 0.54, 0.2),
    divider: material('#24495a', 0.92),
    chair: material('#183449', 0.72),
    screenFrame: material('#101c27', 0.34, 0.12),
    screen: new THREE.MeshBasicMaterial({ map: makeScreenTexture(), toneMapped: false }),
    glass: new THREE.MeshBasicMaterial({ color: '#89b7c0', transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }),
    white: material('#e9eeee', 0.7),
    skin: material('#a96f55', 0.78),
    shirt: material('#e4e9e8', 0.72),
    headset: material('#182a35', 0.42, 0.32),
    eyeWhite: material('#f1f0e9', 0.42),
    eyeDark: material('#1d2023', 0.35),
    scarf: material('#567e79', 0.82),
    shoe: material('#101d27', 0.7),
    jacketA: material('#24475b', 0.92),
    jacketB: material('#6a4b3b', 0.92),
    trousers: material('#182b3b', 0.94),
    hair: material('#211a17', 0.96),
    plant: material('#41815d', 0.95),
    plantLight: material('#71a66f', 0.95),
    gold: material('#c59c62', 0.64, 0.12)
  };

  // Small deterministic canvas textures make surfaces readable without downloading assets.
  function makeSurfaceTexture(kind, width = 256, height = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (kind === 'wood') {
      ctx.fillStyle = '#765238'; ctx.fillRect(0, 0, width, height);
      for (let i = 0; i < 115; i++) {
        const y = (i * 37) % height;
        const x = (i * 83) % width;
        const length = width * (0.18 + ((i * 17) % 70) / 100);
        ctx.strokeStyle = i % 3 ? 'rgba(226,180,126,0.12)' : 'rgba(35,20,12,0.16)';
        ctx.lineWidth = 1 + (i % 3);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + length * 0.28, y - 2, x + length * 0.7, y + 2, x + length, y); ctx.stroke();
      }
      for (let i = 0; i < 12; i++) {
        ctx.strokeStyle = 'rgba(30,18,12,0.10)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse((i * 47) % width, (i * 71) % height, 10 + (i % 4) * 4, 3 + (i % 3), 0.08, 0, Math.PI * 2); ctx.stroke();
      }
    } else if (kind === 'carpet') {
      ctx.fillStyle = '#536a70'; ctx.fillRect(0, 0, width, height);
      for (let y = 0; y < height; y += 4) {
        ctx.fillStyle = y % 8 ? 'rgba(220,235,235,0.035)' : 'rgba(12,32,40,0.065)';
        ctx.fillRect(0, y, width, 2);
      }
      for (let x = 0; x < width; x += 4) {
        ctx.fillStyle = x % 8 ? 'rgba(220,235,235,0.025)' : 'rgba(12,32,40,0.05)';
        ctx.fillRect(x, 0, 2, height);
      }
    } else {
      ctx.fillStyle = '#79888b'; ctx.fillRect(0, 0, width, height);
      // Deterministic speckle avoids random per-load noise and keeps the texture tileable.
      for (let i = 0; i < 2200; i++) {
        const x = (i * 73 + (i * i * 7)) % width;
        const y = (i * 151 + (i * i * 3)) % height;
        ctx.fillStyle = i % 2 ? 'rgba(235,242,239,0.08)' : 'rgba(18,39,45,0.07)';
        ctx.fillRect(x, y, 1 + (i % 2), 1 + (i % 2));
      }
      for (let y = 0; y < height; y += 64) {
        ctx.strokeStyle = 'rgba(230,240,238,0.06)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = Math.min(quality.anisotropy, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }
  const floorSurfaceTexture = makeSurfaceTexture('floor', 256, 256);
  floorSurfaceTexture.repeat.set(10, 9);
  mats.floor.map = floorSurfaceTexture; mats.floor.bumpMap = floorSurfaceTexture; mats.floor.bumpScale = 0.018; mats.floor.needsUpdate = true;
  const carpetSurfaceTexture = makeSurfaceTexture('carpet', 128, 128);
  carpetSurfaceTexture.repeat.set(18, 16);
  mats.carpet.map = carpetSurfaceTexture; mats.carpet.needsUpdate = true;
  const woodSurfaceTexture = makeSurfaceTexture('wood', 512, 256);
  woodSurfaceTexture.repeat.set(2, 1);
  mats.wood.map = woodSurfaceTexture; mats.wood.bumpMap = woodSurfaceTexture; mats.wood.bumpScale = 0.025; mats.wood.needsUpdate = true;

  function makeScreenTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 640;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#0d2130'; ctx.fillRect(0, 0, 1024, 640);
    ctx.fillStyle = '#153b4c'; ctx.fillRect(0, 0, 1024, 76);
    ctx.fillStyle = '#73dfc8'; ctx.font = 'bold 34px Arial'; ctx.fillText('CALLORIA  /  CUSTOMER OPERATIONS', 36, 52);
    ctx.fillStyle = '#d6e9e8'; ctx.font = 'bold 26px Arial'; ctx.fillText('CUSTOMER PROFILE', 36, 136);
    ctx.fillStyle = '#8eaeb8'; ctx.fillRect(36, 164, 440, 14);
    ctx.fillRect(36, 202, 340, 14);
    ctx.fillRect(36, 240, 500, 14);
    ctx.fillStyle = '#0e756e'; ctx.fillRect(596, 116, 380, 172);
    ctx.fillStyle = '#a5f1de'; ctx.font = 'bold 52px Arial'; ctx.fillText('ACTIVE', 640, 188);
    ctx.font = '24px Arial'; ctx.fillText('SERVICE DESK', 640, 240);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#173344' : '#1c4050';
      ctx.fillRect(36, 324 + i * 54, 940, 40);
      ctx.fillStyle = '#65d6bf'; ctx.fillRect(56, 338 + i * 54, 180 + (i % 3) * 44, 10);
      ctx.fillStyle = '#829faa'; ctx.fillRect(300, 338 + i * 54, 380, 10);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(quality.anisotropy, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  function makeRoundedUnitBox() {
    const shape = new THREE.Shape();
    const r = 0.085;
    shape.moveTo(-0.5 + r, -0.5);
    shape.lineTo(0.5 - r, -0.5); shape.quadraticCurveTo(0.5, -0.5, 0.5, -0.5 + r);
    shape.lineTo(0.5, 0.5 - r); shape.quadraticCurveTo(0.5, 0.5, 0.5 - r, 0.5);
    shape.lineTo(-0.5 + r, 0.5); shape.quadraticCurveTo(-0.5, 0.5, -0.5, 0.5 - r);
    shape.lineTo(-0.5, -0.5 + r); shape.quadraticCurveTo(-0.5, -0.5, -0.5 + r, -0.5);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.88, steps: 1, bevelEnabled: true,
      bevelSegments: 2, bevelSize: 0.025, bevelThickness: 0.035, curveSegments: 5
    });
    geometry.translate(0, 0, -0.44);
    geometry.computeVertexNormals();
    return geometry;
  }
  const boxGeometry = makeRoundedUnitBox();
  function makeRoundedBoxGeometry(width, height, depth) {
    const bevel = Math.min(0.024, depth * 0.12, width * 0.025, height * 0.06);
    const radius = Math.min(0.085, width * 0.08, height * 0.12);
    const w = Math.max(0.001, width - bevel * 2);
    const h = Math.max(0.001, height - bevel * 2);
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + radius, -h / 2);
    shape.lineTo(w / 2 - radius, -h / 2); shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + radius);
    shape.lineTo(w / 2, h / 2 - radius); shape.quadraticCurveTo(w / 2, h / 2, w / 2 - radius, h / 2);
    shape.lineTo(-w / 2 + radius, h / 2); shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - radius);
    shape.lineTo(-w / 2, -h / 2 + radius); shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + radius, -h / 2);
    const coreDepth = Math.max(0.001, depth - bevel * 2);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: coreDepth, steps: 1, bevelEnabled: bevel > 0.001, bevelSegments: 2, bevelSize: bevel, bevelThickness: bevel, curveSegments: 4 });
    geometry.translate(0, 0, -coreDepth / 2);
    geometry.computeVertexNormals();
    return geometry;
  }
  const sphereGeometry = new THREE.SphereGeometry(1, tier === 'low' ? 12 : 20, tier === 'low' ? 8 : 14);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, tier === 'low' ? 12 : 20);
  const planeGeometry = new THREE.PlaneGeometry(1, 1);
  // One shared, soft alpha texture creates inexpensive floor contact shading.
  // This gives desks, chairs and staff visual grounding without shadow-map passes.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128; shadowCanvas.height = 128;
  const shadowContext = shadowCanvas.getContext('2d');
  const shadowGradient = shadowContext.createRadialGradient(64, 64, 8, 64, 64, 62);
  shadowGradient.addColorStop(0, 'rgba(5, 12, 18, 0.48)');
  shadowGradient.addColorStop(0.48, 'rgba(5, 12, 18, 0.24)');
  shadowGradient.addColorStop(1, 'rgba(5, 12, 18, 0)');
  shadowContext.fillStyle = shadowGradient;
  shadowContext.fillRect(0, 0, 128, 128);
  const contactShadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const contactShadowMaterial = new THREE.MeshBasicMaterial({
    map: contactShadowTexture, transparent: true, opacity: 0.78,
    depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1
  });
  const dummy = new THREE.Object3D();
  function addBox(parent, name, size, position, mat, rotationY = 0) {
    const mesh = new THREE.Mesh(makeRoundedBoxGeometry(...size), mat);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.y = rotationY;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parent.add(mesh);
    return mesh;
  }
  function addInstances(name, geometry, mat, transforms) {
    if (!transforms.length) return null;
    const mesh = new THREE.InstancedMesh(geometry, mat, transforms.length);
    mesh.name = name;
    mesh.count = transforms.length;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    transforms.forEach((item, index) => {
      dummy.position.set(item.x, item.y, item.z);
      dummy.rotation.set(item.rx || 0, item.ry || 0, item.rz || 0);
      dummy.scale.set(item.sx ?? 1, item.sy ?? 1, item.sz ?? 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      if (item.color && mesh.setColorAt) mesh.setColorAt(index, new THREE.Color(item.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
    return mesh;
  }

  // Low-cost lighting: one hemisphere and one directional source, no realtime shadows.
  scene.add(new THREE.HemisphereLight('#e2f2f2', '#263847', 2.0));
  const sun = new THREE.DirectionalLight('#fff2d9', 2.1);
  sun.position.set(-9, 16, 11);
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#a8d7e4', 0.72);
  fill.position.set(12, 8, -10);
  scene.add(fill);

  // Open ceiling keeps the entire floor readable in the camera view; repeated parts are instanced.
  addBox(scene, 'main-floor', [34, 0.22, 30], [0, -0.16, 0], mats.floor);
  addBox(scene, 'central-carpet', [26, 0.025, 22], [0, -0.025, 0], mats.carpet);
  addBox(scene, 'rear-wall', [34, 3.35, 0.32], [0, 1.66, -15], mats.wall);
  addBox(scene, 'left-wall', [0.32, 3.35, 30], [-17, 1.66, 0], mats.wall);
  addBox(scene, 'right-wall', [0.32, 3.35, 30], [17, 1.66, 0], mats.wall);
  addBox(scene, 'rear-feature-band', [33.5, 0.68, 0.1], [0, 3.0, -14.78], mats.wallDark);
  addBox(scene, 'brand-board', [7.8, 1.35, 0.12], [-3.9, 2.45, -14.73], mats.wallDark);

  const brandCanvas = document.createElement('canvas');
  brandCanvas.width = 1024; brandCanvas.height = 220;
  const brandCtx = brandCanvas.getContext('2d');
  brandCtx.fillStyle = '#102838'; brandCtx.fillRect(0, 0, 1024, 220);
  brandCtx.fillStyle = '#23c5aa'; brandCtx.fillRect(35, 35, 10, 150);
  brandCtx.fillStyle = '#f0f8f6'; brandCtx.font = '800 76px Arial'; brandCtx.fillText('CALLORIA', 82, 105);
  brandCtx.fillStyle = '#88b2bb'; brandCtx.font = '600 25px Arial'; brandCtx.fillText('CUSTOMER OPERATIONS  ·  FLOOR 04', 86, 151);
  brandCtx.fillStyle = '#71dfc8'; brandCtx.font = '700 21px Arial'; brandCtx.fillText('SERVICE  •  QUALITY  •  CAREER', 86, 190);
  const brandTexture = new THREE.CanvasTexture(brandCanvas);
  brandTexture.colorSpace = THREE.SRGBColorSpace;
  const brandSign = new THREE.Mesh(new THREE.PlaneGeometry(7.45, 1.38), new THREE.MeshBasicMaterial({ map: brandTexture, toneMapped: false }));
  brandSign.position.set(-3.9, 2.45, -14.65);
  scene.add(brandSign);

  // Architectural details and departmental zones.
  const columnPositions = [[-16, -13], [16, -13], [-16, 0], [16, 0], [-16, 13], [16, 13]];
  addInstances('structural-columns', boxGeometry, mats.wall, columnPositions.map(([x, z]) => ({ x, y: 2.6, z, sx: 0.52, sy: 5.2, sz: 0.52 })));
  addBox(scene, 'reception-counter', [4.8, 1.0, 1.05], [-12.7, 0.55, 10.6], mats.wood);
  addBox(scene, 'reception-front', [4.65, 0.58, 0.08], [-12.7, 0.47, 11.15], mats.wallDark);
  addBox(scene, 'reception-accent', [4.4, 0.055, 0.1], [-12.7, 0.88, 11.1], mats.teal);
  addBox(scene, 'qa-room-floor', [6.1, 0.1, 6.3], [12.5, 0.02, -11.0], mats.wallDark);
  addBox(scene, 'qa-room-left-glass', [0.06, 2.7, 6.3], [9.45, 1.38, -11.0], mats.glass);
  addBox(scene, 'qa-room-right-glass', [0.06, 2.7, 6.3], [15.55, 1.38, -11.0], mats.glass);
  addBox(scene, 'qa-room-front-glass', [6.1, 2.7, 0.06], [12.5, 1.38, -7.85], mats.glass);
  addBox(scene, 'qa-room-sign', [3.4, 0.55, 0.08], [12.5, 2.95, -7.78], mats.teal);
  addBox(scene, 'training-room-table', [3.4, 0.12, 1.5], [-12.4, 0.78, -7.0], mats.wood);
  addBox(scene, 'training-room-screen', [2.0, 1.1, 0.08], [-12.4, 2.1, -14.72], mats.screenFrame);

  // Twelve stations are retained. Repeating desk parts, dividers, screens and chairs are instanced.
  const xPositions = [-9, -3, 3, 9];
  const zPositions = [-7, -1, 5];
  const stations = [];
  const deskTops = [], deskEdges = [], deskLegs = [], modestyPanels = [], dividers = [], dividerSides = [];
  const monitorFrames = [], monitorScreens = [], monitorStands = [], monitorFeet = [], keyboards = [], keyboardKeycaps = [], pointingDevices = [], monitorIndicators = [];
  const chairSeats = [], chairBacks = [], chairPosts = [], chairBases = [];
  const stationLights = [];
  let stationId = 1;
  for (let row = 0; row < zPositions.length; row++) {
    for (let col = 0; col < xPositions.length; col++) {
      const x = xPositions[col], z = zPositions[row];
      stations.push({ id: stationId++, x, z, row, col, glowIndex: stations.length });
      deskTops.push({ x, y: 0.84, z, sx: 2.95, sy: 0.12, sz: 1.48 });
      deskEdges.push({ x, y: 0.765, z, sx: 2.98, sy: 0.045, sz: 1.5 });
      modestyPanels.push({ x, y: 0.43, z: z - 0.55, sx: 2.66, sy: 0.64, sz: 0.075 });
      for (const side of [-1, 1]) for (const depth of [-1, 1]) deskLegs.push({ x: x + side * 1.31, y: 0.39, z: z + depth * 0.61, sx: 0.075, sy: 0.76, sz: 0.075 });
      dividers.push({ x, y: 1.25, z: z - 0.77, sx: 2.94, sy: 0.82, sz: 0.09 });
      dividerSides.push({ x: x - 1.51, y: 1.12, z, sx: 0.08, sy: 0.72, sz: 1.55 }, { x: x + 1.51, y: 1.12, z, sx: 0.08, sy: 0.72, sz: 1.55 });
      for (const monitorX of [-0.57, 0.58]) {
        const mx = x + monitorX, mz = z - 0.48;
        monitorFrames.push({ x: mx, y: 1.63, z: mz, sx: 1.05, sy: 0.68, sz: 0.085 });
        monitorScreens.push({ x: mx, y: 1.63, z: mz + 0.048, sx: 0.96, sy: 0.58, sz: 0.012 });
        monitorStands.push({ x: mx, y: 1.21, z: mz, sx: 0.09, sy: 0.44, sz: 0.09 });
        monitorFeet.push({ x: mx, y: 0.99, z: mz + 0.04, sx: 0.48, sy: 0.045, sz: 0.25 });
      }
      keyboards.push({ x, y: 0.94, z: z + 0.39, sx: 1.16, sy: 0.045, sz: 0.32 });
      for (let keyRow = 0; keyRow < 2; keyRow++) {
        for (let keyCol = 0; keyCol < 8; keyCol++) {
          keyboardKeycaps.push({ x: x + (keyCol - 3.5) * 0.125, y: 0.969, z: z + 0.30 + keyRow * 0.13, sx: 0.088, sy: 0.018, sz: 0.075 });
        }
      }
      pointingDevices.push({ x: x + 0.83, y: 0.982, z: z + 0.40, sx: 0.105, sy: 0.045, sz: 0.15 });
      monitorIndicators.push({ x: x - 0.57, y: 1.62, z: z - 0.424, sx: 0.035, sy: 0.025, sz: 0.014, color: '#71e6c7' }, { x: x + 0.58, y: 1.62, z: z - 0.424, sx: 0.035, sy: 0.025, sz: 0.014, color: '#71e6c7' });
      chairSeats.push({ x, y: 0.64, z: z + 1.86, sx: 0.78, sy: 0.15, sz: 0.7 });
      chairBacks.push({ x, y: 1.18, z: z + 2.18, sx: 0.74, sy: 0.94, sz: 0.14 });
      chairPosts.push({ x, y: 0.3, z: z + 1.86, sx: 0.12, sy: 0.54, sz: 0.12 });
      chairBases.push({ x, y: 0.1, z: z + 1.86, sx: 0.76, sy: 0.07, sz: 0.76 });
      stationLights.push({ x, y: 2.08, z: mzForLight(z), sx: 0.095, sy: 0.095, sz: 0.095, color: stationId % 4 === 0 ? '#dcb46e' : '#53d8bd' });
    }
  }
  addInstances('desk-surfaces', boxGeometry, mats.wood, deskTops);
  addInstances('desk-front-edges', boxGeometry, mats.woodEdge, deskEdges);
  addInstances('desk-legs', boxGeometry, mats.metal, deskLegs);
  addInstances('desk-modesty-panels', boxGeometry, mats.wallDark, modestyPanels);
  addInstances('acoustic-divider-backs', boxGeometry, mats.divider, dividers);
  addInstances('acoustic-divider-sides', boxGeometry, mats.divider, dividerSides);
  addInstances('monitor-frames', boxGeometry, mats.screenFrame, monitorFrames);
  addInstances('monitor-displays', boxGeometry, mats.screen, monitorScreens);
  addInstances('monitor-stands', boxGeometry, mats.darkMetal, monitorStands);
  addInstances('monitor-feet', boxGeometry, mats.metal, monitorFeet);
  addInstances('keyboards', boxGeometry, mats.darkMetal, keyboards);
  addInstances('keyboard-keycaps', boxGeometry, material('#82949a', 0.72), keyboardKeycaps);
  addInstances('pointing-devices', sphereGeometry, mats.darkMetal, pointingDevices);
  addInstances('monitor-status-indicators', sphereGeometry, new THREE.MeshBasicMaterial({ color: '#71e6c7' }), monitorIndicators);
  addInstances('chair-seats', boxGeometry, mats.chair, chairSeats);
  addInstances('chair-backs', boxGeometry, mats.chair, chairBacks);
  addInstances('chair-posts', cylinderGeometry, mats.metal, chairPosts);
  addInstances('chair-bases', boxGeometry, mats.darkMetal, chairBases);
  const contactShadowTransforms = [];
  for (const station of stations) {
    contactShadowTransforms.push({ x: station.x, y: -0.004, z: station.z, sx: 2.7, sy: 1.55, sz: 1, rx: -Math.PI / 2 });
    contactShadowTransforms.push({ x: station.x, y: -0.003, z: station.z + 1.86, sx: 1.05, sy: 1.15, sz: 1, rx: -Math.PI / 2 });
  }
  for (const [x, z] of [[-15, 12], [15, 12], [-14, -10], [15, -3], [-12.7, 10.6], [-12.4, -7]]) {
    contactShadowTransforms.push({ x, y: -0.002, z, sx: 1.7, sy: 1.35, sz: 1, rx: -Math.PI / 2 });
  }
  const contactShadowMesh = new THREE.InstancedMesh(planeGeometry, contactShadowMaterial, contactShadowTransforms.length);
  contactShadowMesh.name = 'soft-floor-contact-shadows';
  contactShadowMesh.renderOrder = 1;
  contactShadowMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  contactShadowTransforms.forEach((item, index) => {
    dummy.position.set(item.x, item.y, item.z);
    dummy.rotation.set(item.rx, 0, 0);
    dummy.scale.set(item.sx, item.sy, item.sz);
    dummy.updateMatrix();
    contactShadowMesh.setMatrixAt(index, dummy.matrix);
  });
  contactShadowMesh.instanceMatrix.needsUpdate = true;
  scene.add(contactShadowMesh);
  const glowMaterial = new THREE.MeshBasicMaterial({ color: '#55d7bf' });
  const glowMesh = new THREE.InstancedMesh(sphereGeometry, glowMaterial, stationLights.length);
  glowMesh.name = 'workstation-status-lights';
  glowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  stationLights.forEach((item, index) => {
    dummy.position.set(item.x, item.y, item.z);
    dummy.scale.set(item.sx, item.sy, item.sz);
    dummy.updateMatrix();
    glowMesh.setMatrixAt(index, dummy.matrix);
    glowMesh.setColorAt(index, new THREE.Color(item.color));
  });
  glowMesh.instanceMatrix.needsUpdate = true;
  if (glowMesh.instanceColor) glowMesh.instanceColor.needsUpdate = true;
  scene.add(glowMesh);
  stations.forEach((station) => { station.glow = { mesh: glowMesh, index: station.glowIndex }; });

  // A few restrained plants and noticeboards add depth without expensive detail meshes.
  const potTransforms = [[-15, 0.26, 12], [15, 0.26, 12], [-14, 0.26, -10], [15, 0.26, -3]].map(([x, y, z]) => ({ x, y, z, sx: 0.48, sy: 0.52, sz: 0.48 }));
  addInstances('planters', cylinderGeometry, material('#879b95', 0.86), potTransforms);
  const leaves = [];
  for (const [x, , z] of [[-15, 0, 12], [15, 0, 12], [-14, 0, -10], [15, 0, -3]]) {
    for (let i = 0; i < 5; i++) {
      const a = i * 1.256;
      leaves.push({ x: x + Math.cos(a) * 0.24, y: 1.05 + (i % 2) * 0.13, z: z + Math.sin(a) * 0.24, sx: 0.2, sy: 0.64, sz: 0.2, color: i % 2 ? '#4f9165' : '#76a875' });
    }
  }
  addInstances('plant-canopies', sphereGeometry, mats.plant, leaves);
  const aisleMarks = [];
  for (let z = -12; z <= 12; z += 2.4) aisleMarks.push({ x: 0, y: 0.012, z, sx: 0.045, sy: 0.015, sz: 0.7 });
  addInstances('aisle-wayfinding', boxGeometry, mats.tealLight, aisleMarks);
  const overheadFixtures = [];
  for (const z of [-7, -1, 5]) for (const x of [-9, -3, 3, 9]) {
    overheadFixtures.push({ x, y: 3.16, z: z - 1.1, sx: 2.35, sy: 0.045, sz: 0.22 });
  }
  addInstances('overhead-led-fixtures', boxGeometry, new THREE.MeshBasicMaterial({ color: '#f5f0df', toneMapped: false }), overheadFixtures);

  // Detailed low-poly staff: shared anatomy geometry, articulated arms and legs,
  // facial features, headset equipment and individual uniform/scarf materials.
  const staff = [];
  const bodyGeometry = new THREE.CapsuleGeometry(0.235, 0.54, tier === 'low' ? 3 : 5, tier === 'low' ? 10 : 16);
  const upperArmGeometry = new THREE.CapsuleGeometry(0.073, 0.27, 3, tier === 'low' ? 8 : 12);
  const forearmGeometry = new THREE.CapsuleGeometry(0.062, 0.25, 3, tier === 'low' ? 8 : 12);
  const legGeometry = new THREE.CapsuleGeometry(0.087, 0.39, 3, tier === 'low' ? 8 : 12);
  const headGeometry = new THREE.SphereGeometry(0.158, tier === 'low' ? 14 : 22, tier === 'low' ? 10 : 16);
  const handGeometry = new THREE.SphereGeometry(0.064, 12, 9);
  const shoeGeometry = new THREE.SphereGeometry(0.09, 14, 9);
  const neckGeometry = new THREE.CylinderGeometry(0.07, 0.08, 0.14, 12);
  const noseGeometry = new THREE.ConeGeometry(0.033, 0.082, 8);
  const eyeGeometry = new THREE.SphereGeometry(0.022, 10, 8);
  const irisGeometry = new THREE.SphereGeometry(0.010, 8, 6);
  const hairCapGeometry = new THREE.SphereGeometry(0.166, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62);
  const headsetArcGeometry = new THREE.TorusGeometry(0.17, 0.012, 6, 20, Math.PI);
  const earPadGeometry = new THREE.CylinderGeometry(0.043, 0.043, 0.035, 12);
  const badgeGeometry = makeRoundedUnitBox();
  const waistGeometry = new THREE.CylinderGeometry(0.19, 0.2, 0.19, 14);
  const hairAlt = material('#30251f', 0.88);
  const tieMaterial = material('#b78e50', 0.5);
  const skinLight = material('#bd8768', 0.8);
  const jacketLight = material('#365d70', 0.74);
  const jacketDeep = material('#59443b', 0.78);
  function addStaffMesh(parent, geometry, mat, position, scale = null, rotation = null) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(...position);
    if (scale) mesh.scale.set(...scale);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parent.add(mesh);
    return mesh;
  }
  function createArm(root, side, jacket, seated) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.245, seated ? 1.28 : 1.38, 0.015);
    const upper = addStaffMesh(arm, upperArmGeometry, jacket, [0, -0.16, 0], null, [0, 0, side * -0.12]);
    const elbow = new THREE.Group(); elbow.position.set(0, -0.30, 0.012); arm.add(elbow);
    addStaffMesh(elbow, forearmGeometry, jacket, [0, -0.13, 0.025]);
    addStaffMesh(elbow, handGeometry, mats.skin, [0, -0.30, 0.045], [1.0, 0.9, 1.05]);
    arm.userData = { upper, elbow };
    root.add(arm);
    return arm;
  }
  function createStaff(seed, x, z, seated = false) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    // Staff at desks face their monitor; walking staff face into the floor.
    root.rotation.y = Math.PI;
    const jacket = seed % 3 === 0 ? jacketLight : seed % 2 ? mats.jacketA : jacketDeep;
    const skin = seed % 2 ? mats.skin : skinLight;
    const isScarf = seed % 3 === 1;
    addStaffMesh(root, bodyGeometry, jacket, [0, seated ? 1.03 : 1.12, 0], seated ? [1.0, 0.94, 0.88] : [1, 1.04, 0.9]);
    addStaffMesh(root, waistGeometry, mats.trousers, [0, seated ? 0.69 : 0.72, 0], [1, 1, 0.92]);
    addStaffMesh(root, neckGeometry, skin, [0, seated ? 1.43 : 1.54, 0.005]);
    const head = new THREE.Group(); head.position.set(0, seated ? 1.69 : 1.82, 0.015); root.add(head);
    addStaffMesh(head, headGeometry, skin, [0, 0, 0]);
    // Face is oriented toward local +Z: eyes, bridge, nose and a subtle mouth.
    for (const side of [-1, 1]) {
      addStaffMesh(head, eyeGeometry, mats.eyeWhite, [side * 0.057, 0.018, 0.139]);
      addStaffMesh(head, irisGeometry, mats.eyeDark, [side * 0.057, 0.017, 0.158]);
      const ear = addStaffMesh(head, handGeometry, skin, [side * 0.158, -0.012, 0], [0.48, 0.78, 0.62]);
    }
    addStaffMesh(head, noseGeometry, skin, [0, -0.02, 0.16], [0.78, 0.82, 0.72], [Math.PI / 2, 0, 0]);
    addStaffMesh(head, new THREE.BoxGeometry(0.055, 0.008, 0.012), hairAlt, [0, -0.075, 0.144]);
    if (isScarf) {
      addStaffMesh(head, new THREE.SphereGeometry(0.176, 16, 12), mats.scarf, [0, 0.025, -0.008], [1.14, 1.17, 1.06]);
      addStaffMesh(root, new THREE.CapsuleGeometry(0.17, 0.24, 3, 12), mats.scarf, [0, seated ? 1.43 : 1.56, -0.035], [1.14, 1.05, 0.9]);
      // Keep the facial opening clear over the scarf shell.
      addStaffMesh(head, headGeometry, skin, [0, 0, 0], [0.92, 0.96, 0.98]);
    } else {
      addStaffMesh(head, hairCapGeometry, seed % 2 ? mats.hair : hairAlt, [0, 0.035, -0.008]);
      addStaffMesh(head, new THREE.SphereGeometry(0.12, 14, 9), seed % 2 ? mats.hair : hairAlt, [0, 0.105, -0.045], [1.0, 0.55, 0.9]);
    }
    // Contact-centre headset: ear cups, headband and a short boom microphone.
    addStaffMesh(head, headsetArcGeometry, mats.headset, [0, 0.015, -0.004], [1.02, 1.04, 1], [0, 0, 0]);
    for (const side of [-1, 1]) addStaffMesh(head, earPadGeometry, mats.headset, [side * 0.169, -0.005, 0.004], [1, 1, 1], [Math.PI / 2, 0, 0]);
    const boomCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.16, -0.015, 0.035),
      new THREE.Vector3(-0.19, -0.075, 0.10),
      new THREE.Vector3(-0.14, -0.12, 0.15)
    ]);
    addStaffMesh(head, new THREE.TubeGeometry(boomCurve, 8, 0.009, 5, false), mats.headset, [0, 0, 0]);
    addStaffMesh(root, new THREE.BoxGeometry(0.12, 0.16, 0.018), mats.gold, [0.105, seated ? 1.02 : 1.16, 0.22]);
    // Seated staff retain visible legs and shoes; standing staff have separated legs.
    const legs = [];
    for (const side of [-1, 1]) {
      const legRoot = new THREE.Group();
      legRoot.position.set(side * 0.115, seated ? 0.69 : 0.56, seated ? 0.10 : 0);
      if (seated) {
        addStaffMesh(legRoot, legGeometry, mats.trousers, [0, -0.045, 0.18], [0.92, 0.92, 0.92], [Math.PI / 2, 0, 0]);
        addStaffMesh(legRoot, legGeometry, mats.trousers, [0, -0.30, 0.43], [0.88, 0.86, 0.9]);
        addStaffMesh(legRoot, shoeGeometry, mats.shoe, [0, -0.55, 0.42], [1.2, 0.72, 1.8]);
      } else {
        addStaffMesh(legRoot, legGeometry, mats.trousers, [0, -0.20, 0]);
        addStaffMesh(legRoot, shoeGeometry, mats.shoe, [0, -0.47, 0.045], [1.2, 0.72, 1.8]);
      }
      root.add(legRoot); legs.push(legRoot);
    }
    const leftArm = createArm(root, -1, jacket, seated);
    const rightArm = createArm(root, 1, jacket, seated);
    root.userData = { leftArm, rightArm, seed, seated };
    scene.add(root);
    staff.push({ root, phase: seed * 1.37, baseX: x, baseZ: z, seated, walking: !seated });
    return root;
  }
  const seatedStations = [stations[1], stations[4], stations[6], stations[9]];
  seatedStations.forEach((station, index) => createStaff(index, station.x, station.z + 1.38, true));
  createStaff(5, -1.8, 10.2, false);
  createStaff(6, 2.0, -10.0, false);

  // Preview and first-person movement state.
  const preview = { azimuth: 0.42, elevation: 0.38, radius: 31.5, target: new THREE.Vector3(0, 1.35, -0.8) };
  const player = { x: 0, z: 13.1, yaw: 0, pitch: -0.055, speed: 4.3 };
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
  let averageFrameMs = 0;
  let lastQualityCheck = 0;
  let slowFrameStreak = 0;
  let headroomStreak = 0;
  let hostInView = true;
  let disposed = false;
  let assetsReady = true;
  const assetMessage = 'CALLORIA workplace geometry and articulated local staff ready';
  const interactButton = document.getElementById('touchInteractButton');
  const joystick = document.getElementById('touchJoystick');
  const joystickKnob = document.getElementById('touchStick');
  const sprintButton = document.getElementById('touchSprintButton');
  const listeners = [];
  const listen = (target, type, handler, options) => {
    target?.addEventListener(type, handler, options);
    listeners.push(() => target?.removeEventListener(type, handler, options));
  };

  function setPreviewCamera() {
    const e = preview.elevation, a = preview.azimuth, r = preview.radius;
    camera.position.set(
      preview.target.x + Math.sin(a) * Math.cos(e) * r,
      preview.target.y + Math.sin(e) * r,
      preview.target.z + Math.cos(a) * Math.cos(e) * r
    );
    camera.lookAt(preview.target);
  }
  // Performance Lab: browser-observable metrics only. WebGL does not expose
  // portable GPU milliseconds, so GPU time is explicitly reported as unavailable.
  const perfSamples = [];
  let perfLastUiAt = 0;
  let perfFrames = 0;
  let perfCpuMs = 0;
  let perfPanel = null;
  let perfButton = null;
  let perfVisible = false;
  let sceneMemoryCache = null;
  const perfMetrics = { fps: 0, frameMs: 0, p95Ms: 0, cpuMs: 0, calls: 0, triangles: 0, geometries: 0, textures: 0, heapMb: null };

  function applyGraphicsProfile(profile, persist = false) {
    const allowed = ['auto', 'smooth', 'balanced', 'sharp'];
    const selected = allowed.includes(profile) ? profile : 'auto';
    graphicsProfile = selected;
    const settings = {
      auto: { ratio: deviceQuality.pixelRatio, min: deviceQuality.minRatio, fps: deviceQuality.fps },
      smooth: { ratio: deviceQuality.pixelRatio * 0.78, min: Math.min(deviceQuality.minRatio, 0.62), fps: Math.min(deviceQuality.fps, 30) },
      balanced: { ratio: deviceQuality.pixelRatio * 0.94, min: Math.min(deviceQuality.minRatio, 0.68), fps: Math.min(deviceQuality.fps, mobile ? 30 : 45) },
      sharp: { ratio: deviceQuality.pixelRatio * (mobile ? 1.04 : 1.10), min: deviceQuality.minRatio, fps: mobile ? Math.min(deviceQuality.fps, 30) : Math.min(deviceQuality.fps, 50) }
    }[selected];
    quality = { ...deviceQuality, pixelRatio: settings.ratio, minRatio: settings.min, fps: settings.fps };
    pixelRatioCap = Math.min(quality.pixelRatio, window.devicePixelRatio || 1, mobile ? 1.4 : 1.75, maxAnisotropy);
    currentPixelRatio = Math.max(Math.min(quality.pixelRatio, pixelRatioCap), Math.min(quality.minRatio, pixelRatioCap));
    slowFrameStreak = 0;
    headroomStreak = 0;
    averageFrameMs = 0;
    lastQualityCheck = 0;
    perfSamples.length = 0;
    if (persist) {
      try { localStorage.setItem(graphicsProfileKey, selected); } catch { /* Profile remains active for this page. */ }
    }
    if (typeof renderer !== 'undefined' && renderer) {
      renderer.setPixelRatio(currentPixelRatio);
      renderer.setSize(Math.max(1, host.clientWidth || 1), Math.max(1, host.clientHeight || 1), false);
      if (typeof renderStill === 'function') renderStill();
    }
    const select = perfPanel?.querySelector('#calloria-graphics-profile');
    if (select && select.value !== selected) select.value = selected;
    updatePerformanceLab(true);
  }
  function createPerformanceLab() {
    const panelRoot = host.closest('.world-panel') || host.parentElement || document.body;
    perfButton = document.createElement('button');
    perfButton.type = 'button';
    perfButton.className = 'calloria-perf-toggle';
    perfButton.textContent = 'PERF';
    perfButton.setAttribute('aria-label', 'Toggle Performance Lab');
    perfButton.setAttribute('aria-expanded', 'false');
    perfPanel = document.createElement('section');
    perfPanel.className = 'calloria-perf-panel';
    perfPanel.hidden = true;
    perfPanel.setAttribute('aria-label', 'Performance Lab diagnostics');
    perfPanel.innerHTML = '<div class="calloria-perf-head"><strong>PERFORMANCE LAB</strong><span>F3</span><button type="button" aria-label="Close Performance Lab">×</button></div><div class="calloria-perf-controls"><label for="calloria-graphics-profile">GRAPHICS PROFILE<select id="calloria-graphics-profile"><option value="auto">Automatic · adaptive</option><option value="smooth">Smooth · lower rendering cost</option><option value="balanced">Balanced · everyday quality</option><option value="sharp">Sharp · higher image clarity</option></select></label><small>Profiles adjust render resolution and frame target. Device safety limits remain active.</small></div><div class="calloria-perf-grid"></div><div class="calloria-perf-foot">GPU timing is not exposed by this browser. Memory figures are estimates.</div>';
    panelRoot.append(perfButton, perfPanel);
    perfButton.addEventListener('click', togglePerformanceLab);
    perfPanel.querySelector('.calloria-perf-head button')?.addEventListener('click', () => togglePerformanceLab(false));
    const profileSelect = perfPanel.querySelector('#calloria-graphics-profile');
    if (profileSelect) {
      profileSelect.value = graphicsProfile;
      profileSelect.addEventListener('change', () => applyGraphicsProfile(profileSelect.value, true));
    }
    listen(window, 'keydown', (event) => {
      if (event.code === 'F3') { event.preventDefault(); togglePerformanceLab(); }
    });
    if (new URLSearchParams(location.search).has('perf')) togglePerformanceLab(true);
  }
  function togglePerformanceLab(force) {
    perfVisible = typeof force === 'boolean' ? force : !perfVisible;
    if (perfPanel) perfPanel.hidden = !perfVisible;
    if (perfButton) { perfButton.setAttribute('aria-expanded', String(perfVisible)); perfButton.classList.toggle('is-active', perfVisible); }
    if (perfVisible) updatePerformanceLab(true);
  }
  function estimateSceneMemory() {
    if (sceneMemoryCache) return sceneMemoryCache;
    const geometries = new Set(); const textures = new Set();
    let geometryBytes = 0; let textureBytes = 0;
    scene.traverse((object) => {
      if (object.geometry && !geometries.has(object.geometry)) {
        geometries.add(object.geometry);
        for (const attribute of Object.values(object.geometry.attributes || {})) {
          const array = attribute?.array;
          if (array?.byteLength) geometryBytes += array.byteLength;
        }
        for (const attribute of Object.values(object.geometry.morphAttributes || {})) for (const item of attribute || []) if (item?.array?.byteLength) geometryBytes += item.array.byteLength;
      }
      const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      for (const mat of materials) for (const value of Object.values(mat)) {
        if (value?.isTexture && !textures.has(value)) {
          textures.add(value);
          const image = value.image || value.source?.data;
          const width = image?.width || image?.videoWidth || 0;
          const height = image?.height || image?.videoHeight || 0;
          if (width && height) textureBytes += width * height * 4 * (value.generateMipmaps ? 1.34 : 1);
        }
      }
    });
    sceneMemoryCache = { geometryCount: geometries.size, textureCount: textures.size, estimateMb: (geometryBytes + textureBytes) / 1048576 };
    return sceneMemoryCache;
  }
  function updatePerformanceLab(force = false) {
    if (!perfVisible || !perfPanel) return;
    const now = performance.now();
    if (!force && now - perfLastUiAt < 450) return;
    perfLastUiAt = now;
    const sorted = perfSamples.slice().sort((a, b) => a - b);
    const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0;
    const memory = performance.memory?.usedJSHeapSize;
    const sceneMemory = estimateSceneMemory();
    const info = renderer.info;
    const rows = [
      ['FPS', `${perfMetrics.fps.toFixed(1)} / ${quality.fps} target`],
      ['Frame time', `${perfMetrics.frameMs.toFixed(1)} ms`],
      ['Frame p95', `${p95.toFixed(1)} ms`],
      ['CPU update + render submit', `${perfMetrics.cpuMs.toFixed(1)} ms`],
      ['Draw calls', String(info.render.calls)],
      ['Triangles', info.render.triangles.toLocaleString()],
      ['Geometries / textures', `${info.memory.geometries} / ${info.memory.textures}`],
      ['Scene memory estimate', `${sceneMemory.estimateMb.toFixed(1)} MB`],
      ['JS heap', memory ? `${(memory / 1048576).toFixed(1)} MB` : 'Not exposed'],
      ['Graphics profile', graphicsProfile.toUpperCase()],
      ['Render scale / DPR', `${currentPixelRatio.toFixed(2)} / ${(window.devicePixelRatio || 1).toFixed(2)}`],
      ['Device tier / input', `${tier.toUpperCase()} / ${mobile ? 'MOBILE' : 'DESKTOP'}`],
      ['Staff / stations', `${staff.length} / ${stations.length}`]
    ];
    const grid = perfPanel.querySelector('.calloria-perf-grid');
    if (grid) grid.innerHTML = rows.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('');
  }
  createPerformanceLab();

  function renderStill() {
    if (!disposed && !document.hidden && host.clientWidth > 0 && host.clientHeight > 0) {
      const start = performance.now(); renderer.render(scene, camera); perfCpuMs = performance.now() - start;
      perfMetrics.calls = renderer.info.render.calls; perfMetrics.triangles = renderer.info.render.triangles;
      updatePerformanceLab();
    }
  }
  if (graphicsProfile !== 'auto') applyGraphicsProfile(graphicsProfile, false);
  setPreviewCamera();

  function resize() {
    if (disposed) return;
    const width = Math.max(1, host.clientWidth || window.innerWidth || 900);
    const height = Math.max(1, host.clientHeight || window.innerHeight || 520);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(currentPixelRatio);
    renderer.setSize(width, height, false);
    if (immersive) startRenderLoop(); else renderStill();
  }
  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (resizeObserver) resizeObserver.observe(host);
  else listen(window, 'resize', resize, { passive: true });
  resize();

  function adaptResolution(frameMs, timestamp) {
    averageFrameMs = averageFrameMs ? averageFrameMs * 0.82 + frameMs * 0.18 : frameMs;
    if (!lastQualityCheck) { lastQualityCheck = timestamp; return; }
    if (timestamp - lastQualityCheck < 2600) return;
    lastQualityCheck = timestamp;
    const targetFrameMs = 1000 / quality.fps;
    if (averageFrameMs > targetFrameMs * 1.22) {
      slowFrameStreak++; headroomStreak = 0;
    } else if (averageFrameMs < targetFrameMs * 1.08) {
      headroomStreak++; slowFrameStreak = Math.max(0, slowFrameStreak - 1);
    } else {
      slowFrameStreak = Math.max(0, slowFrameStreak - 1); headroomStreak = 0;
    }
    let next = currentPixelRatio;
    if (slowFrameStreak >= 2) { next = Math.max(quality.minRatio, currentPixelRatio - 0.10); slowFrameStreak = 0; }
    else if (headroomStreak >= 3) { next = Math.min(pixelRatioCap, currentPixelRatio + 0.035); headroomStreak = 0; }
    if (Math.abs(next - currentPixelRatio) >= 0.025) {
      currentPixelRatio = Number(next.toFixed(2));
      renderer.setPixelRatio(currentPixelRatio);
      renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight), false);
    }
  }
  function startRenderLoop() {
    if (loopActive || disposed || document.hidden || !immersive || !hostInView) return;
    loopActive = true;
    lastFrameAt = 0;
    frameId = requestAnimationFrame(animate);
  }
  function stopRenderLoop() {
    loopActive = false;
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
  }

  function blocked(x, z) {
    if (x < -16 || x > 16 || z < -14 || z > 14) return true;
    for (const station of stations) {
      if (Math.abs(x - station.x) < 1.55 && Math.abs(z - station.z) < 0.9) return true;
    }
    if (x > 9.35 && x < 16 && z > -14.5 && z < -7.6) return true;
    return false;
  }
  function highlightStation(station, active) {
    const index = station.glow.index;
    const size = active ? 1.8 : 1;
    dummy.position.set(station.x, 2.08, station.z - 0.48);
    dummy.scale.setScalar(0.095 * size);
    dummy.updateMatrix();
    glowMesh.setMatrixAt(index, dummy.matrix);
    glowMesh.setColorAt(index, new THREE.Color(active ? '#f3c77c' : (station.id % 4 === 0 ? '#dcb46e' : '#55d7bf')));
    glowMesh.instanceMatrix.needsUpdate = true;
    if (glowMesh.instanceColor) glowMesh.instanceColor.needsUpdate = true;
  }
  function updatePlayer(delta) {
    const forward = clamp((keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - touchMove.y, -1, 1);
    const strafe = clamp((keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + touchMove.x, -1, 1);
    if (forward || strafe) {
      const length = Math.hypot(forward, strafe) || 1;
      const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight') || touchMove.sprinting;
      const speed = player.speed * (sprinting ? 1.5 : 1);
      const dx = (Math.sin(player.yaw) * forward + Math.cos(player.yaw) * strafe) * speed * delta / length;
      const dz = (-Math.cos(player.yaw) * forward + Math.sin(player.yaw) * strafe) * speed * delta / length;
      if (!blocked(player.x + dx, player.z)) player.x += dx;
      if (!blocked(player.x, player.z + dz)) player.z += dz;
    }
    camera.position.set(player.x, 1.68, player.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(player.pitch, player.yaw, 0);
    let nearest = Infinity;
    let next = null;
    for (const station of stations) {
      const dx = player.x - station.x;
      const dz = player.z - (station.z + 2.1);
      const distance = Math.hypot(dx, dz);
      if (distance < nearest) { nearest = distance; next = station; }
    }
    nearestStation = nearest <= 3.0 ? next : null;
    if (interactButton) interactButton.disabled = !nearestStation;
    const nearestId = nearestStation?.id ?? null;
    if (nearestId !== lastNearestId) {
      if (lastNearestId) { const previous = stations[lastNearestId - 1]; if (previous) highlightStation(previous, false); }
      if (nearestStation) highlightStation(nearestStation, true);
      lastNearestId = nearestId;
      callbacks.onNearestStation?.(nearestStation ? { id: nearestStation.id, label: `Station ${String(nearestStation.id).padStart(2, '0')}` } : null);
    }
  }
  function updateStaff(delta, elapsed) {
    for (const person of staff) {
      const { root, phase, baseX, baseZ, seated } = person;
      if (seated) {
        const working = ['busy', 'wrap-up'].includes(agentActivity);
        const motion = Math.sin(elapsed * (working ? 2.6 : 1.0) + phase);
        root.userData.leftArm.rotation.x = working ? 0.22 * motion : 0.06 * motion;
        root.userData.rightArm.rotation.x = working ? -0.22 * motion : -0.06 * motion;
        root.position.y = Math.abs(motion) * 0.006;
      } else {
        root.position.x = baseX + Math.sin(elapsed * 0.32 + phase) * 0.58;
        root.position.z = baseZ + Math.cos(elapsed * 0.24 + phase) * 0.42;
        root.rotation.y = Math.sin(elapsed * 0.32 + phase) * 0.55;
        root.userData.leftArm.rotation.x = 0.18 * Math.sin(elapsed * 2.1 + phase);
        root.userData.rightArm.rotation.x = -0.18 * Math.sin(elapsed * 2.1 + phase);
      }
    }
  }
  function animate(timestamp) {
    if (!loopActive || disposed) return;
    if (document.hidden || (!hostInView && !immersive) || !immersive) { stopRenderLoop(); return; }
    const interval = 1000 / quality.fps;
    if (lastFrameAt && timestamp - lastFrameAt < interval) { frameId = requestAnimationFrame(animate); return; }
    const frameMs = lastFrameAt ? timestamp - lastFrameAt : 1000 / quality.fps;
    const delta = Math.min(frameMs / 1000, 0.05);
    lastFrameAt = timestamp;
    const elapsed = timestamp / 1000;
    const cpuStart = performance.now();
    updatePlayer(delta);
    updateStaff(delta, elapsed);
    renderer.render(scene, camera);
    perfCpuMs = performance.now() - cpuStart;
    perfSamples.push(frameMs); if (perfSamples.length > 120) perfSamples.shift();
    perfFrames++;
    if (!perfLastUiAt || timestamp - perfLastUiAt >= 450) {
      const windowMs = perfSamples.reduce((sum, value) => sum + value, 0);
      perfMetrics.fps = windowMs > 0 ? perfSamples.length * 1000 / windowMs : 0;
      perfMetrics.frameMs = perfSamples.length ? windowMs / perfSamples.length : frameMs;
      perfMetrics.cpuMs = perfCpuMs;
      perfMetrics.calls = renderer.info.render.calls;
      perfMetrics.triangles = renderer.info.render.triangles;
      updatePerformanceLab();
    }
    adaptResolution(frameMs, timestamp);
    frameId = requestAnimationFrame(animate);
  }

  function enter() {
    if (disposed) return;
    setImmersive(true);
    if (!coarsePointer) {
      try { renderer.domElement.requestPointerLock?.(); } catch { /* Pointer lock is optional. */ }
    }
  }
  function exit() { setImmersive(false); }
  function setImmersive(value) {
    immersive = Boolean(value);
    host.closest('.world-panel')?.classList.toggle('is-immersive', immersive);
    document.body.classList.toggle('calloria-immersive', immersive);
    if (immersive) {
      player.x = 0; player.z = 13.1; player.yaw = 0; player.pitch = -0.055;
      touchMove.x = 0; touchMove.y = 0; touchMove.sprinting = false;
      if (joystickKnob) joystickKnob.style.transform = 'translate(0px, 0px)';
      camera.position.set(player.x, 1.68, player.z);
      camera.rotation.order = 'YXZ'; camera.rotation.set(player.pitch, player.yaw, 0);
      startRenderLoop();
    } else {
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
      stopRenderLoop(); keys.clear(); touchMove.x = 0; touchMove.y = 0; touchMove.sprinting = false; touchMove.pointerId = null;
      nearestStation = null; lastNearestId = null; setPreviewCamera();
      if (interactButton) interactButton.disabled = true;
      callbacks.onNearestStation?.(null);
      renderStill();
    }
    callbacks.onImmersiveChange?.(immersive);
  }
  function useNearestStation() {
    if (immersive && nearestStation) {
      callbacks.onStation?.({ id: nearestStation.id, label: `Station ${String(nearestStation.id).padStart(2, '0')}`, department: 'Customer Operations' });
    }
  }
  function setAgentActivity(status) {
    agentActivity = String(status || 'offline');
    renderStill();
  }

  const canvas = renderer.domElement;
  listen(canvas, 'pointerdown', (event) => {
    if (immersive && !coarsePointer && document.pointerLockElement !== canvas) {
      try { canvas.requestPointerLock?.(); } catch { /* Optional browser capability. */ }
      return;
    }
    dragging = true;
    lastPointer = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture?.(event.pointerId);
  });
  listen(canvas, 'pointermove', (event) => {
    if (immersive && document.pointerLockElement === canvas) return;
    if (!dragging) return;
    const dx = event.clientX - lastPointer.x;
    const dy = event.clientY - lastPointer.y;
    if (immersive) {
      player.yaw -= dx * 0.0042;
      player.pitch = clamp(player.pitch - dy * 0.0032, -0.72, 0.48);
      camera.rotation.order = 'YXZ'; camera.rotation.set(player.pitch, player.yaw, 0);
    } else {
      preview.azimuth -= dx * 0.004;
      preview.elevation = clamp(preview.elevation + dy * 0.0025, -0.06, 0.78);
      setPreviewCamera();
    }
    lastPointer = { x: event.clientX, y: event.clientY };
    if (!immersive) renderStill();
  });
  const endDrag = () => { dragging = false; };
  listen(canvas, 'pointerup', endDrag);
  listen(canvas, 'pointercancel', endDrag);
  listen(canvas, 'lostpointercapture', endDrag);
  listen(canvas, 'wheel', (event) => {
    if (immersive) return;
    event.preventDefault();
    preview.radius = clamp(preview.radius + Math.sign(event.deltaY) * 1.2, 19, 39);
    setPreviewCamera(); renderStill();
  }, { passive: false });
  listen(document, 'pointermove', (event) => {
    if (immersive && document.pointerLockElement === canvas) {
      player.yaw -= (event.movementX || 0) * 0.0028;
      player.pitch = clamp(player.pitch - (event.movementY || 0) * 0.0024, -0.72, 0.48);
      camera.rotation.order = 'YXZ'; camera.rotation.set(player.pitch, player.yaw, 0);
    }
  });
  listen(document, 'keydown', (event) => {
    if (!immersive) return;
    const target = event.target;
    if (target && (target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(target.tagName))) return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(event.code)) event.preventDefault();
    if (event.code === 'Escape') { if (document.pointerLockElement === canvas) document.exitPointerLock?.(); else exit(); }
    keys.add(event.code);
    if (event.code === 'KeyE') useNearestStation();
  });
  listen(document, 'keyup', (event) => keys.delete(event.code));
  listen(document, 'pointerlockchange', () => {
    if (immersive && document.pointerLockElement !== canvas && !coarsePointer) callbacks.onPointerUnlock?.();
  });
  listen(document, 'visibilitychange', () => {
    if (document.hidden) stopRenderLoop();
    else if (immersive) startRenderLoop();
    else renderStill();
  });

  function joystickRadius() { return Math.max(24, (joystick?.clientWidth || 116) * 0.34); }
  function updateJoystick(event) {
    if (!joystick) return;
    const rect = joystick.getBoundingClientRect();
    const dx0 = event.clientX - (rect.left + rect.width / 2);
    const dy0 = event.clientY - (rect.top + rect.height / 2);
    const radius = joystickRadius();
    const distance = Math.hypot(dx0, dy0) || 1;
    const dx = distance > radius ? dx0 / distance * radius : dx0;
    const dy = distance > radius ? dy0 / distance * radius : dy0;
    touchMove.x = clamp(dx / radius, -1, 1);
    touchMove.y = clamp(dy / radius, -1, 1);
    if (joystickKnob) joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  function resetJoystick() {
    touchMove.x = 0; touchMove.y = 0; touchMove.pointerId = null;
    if (joystickKnob) joystickKnob.style.transform = 'translate(0px, 0px)';
  }
  listen(joystick, 'pointerdown', (event) => {
    if (!immersive) return;
    event.preventDefault(); touchMove.pointerId = event.pointerId; joystick.setPointerCapture?.(event.pointerId); updateJoystick(event);
  });
  listen(joystick, 'pointermove', (event) => {
    if (immersive && touchMove.pointerId === event.pointerId) { event.preventDefault(); updateJoystick(event); }
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => listen(joystick, type, (event) => {
    if (touchMove.pointerId === event.pointerId) resetJoystick();
  }));
  listen(sprintButton, 'pointerdown', (event) => {
    if (immersive) { event.preventDefault(); touchMove.sprinting = true; sprintButton.setPointerCapture?.(event.pointerId); }
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => listen(sprintButton, type, () => { touchMove.sprinting = false; }));
  listen(interactButton, 'click', useNearestStation);
  listen(window, 'pagehide', () => { stopRenderLoop(); });

  const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((entries) => {
    hostInView = entries.some((entry) => entry.isIntersecting);
    if (immersive && hostInView) startRenderLoop();
    else if (!hostInView) stopRenderLoop();
    else if (!immersive) renderStill();
  }, { threshold: 0.01 }) : null;
  observer?.observe(host);

  document.body.classList.toggle('touch-device', coarsePointer);
  callbacks.onAssetsReady?.({ loaded: 0, fallback: 6, mode: 'detailed-local-geometry' });
  renderStill();

  return {
    scene,
    camera,
    renderer,
    stations,
    enter,
    exit,
    setImmersive,
    setAgentActivity,
    get agentActivity() { return agentActivity; },
    get immersive() { return immersive; },
    get nearestStation() { return nearestStation; },
    get assetMessage() { return assetMessage; },
    get lowEndDevice() { return tier === 'low'; },
    get pixelRatio() { return currentPixelRatio; },
    get assetsReady() { return assetsReady; },
    get qualityTier() { return tier; },
    get graphicsProfile() { return graphicsProfile; },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopRenderLoop(); observer?.disconnect(); resizeObserver?.disconnect();
      listeners.forEach((remove) => remove());
      perfButton?.remove(); perfPanel?.remove();
      document.body.classList.remove('touch-device', 'calloria-immersive');
      scene.traverse((object) => {
        if (object.isInstancedMesh || object.isMesh) {
          if (object.geometry && ![boxGeometry, sphereGeometry, cylinderGeometry, planeGeometry, bodyGeometry, upperArmGeometry, forearmGeometry, legGeometry, headGeometry, handGeometry, shoeGeometry, neckGeometry, noseGeometry, eyeGeometry, irisGeometry, hairCapGeometry, headsetArcGeometry, earPadGeometry, waistGeometry].includes(object.geometry)) object.geometry.dispose?.();
        }
        if (object.material && !Array.isArray(object.material) && !Object.values(mats).includes(object.material)) object.material.dispose?.();
      });
      brandTexture.dispose(); mats.screen.map?.dispose?.(); floorSurfaceTexture.dispose(); carpetSurfaceTexture.dispose(); woodSurfaceTexture.dispose(); contactShadowTexture.dispose(); contactShadowMaterial.dispose();
      [boxGeometry, sphereGeometry, cylinderGeometry, planeGeometry, bodyGeometry, upperArmGeometry, forearmGeometry, legGeometry, headGeometry, handGeometry, shoeGeometry, neckGeometry, noseGeometry, eyeGeometry, irisGeometry, hairCapGeometry, headsetArcGeometry, earPadGeometry, waistGeometry].forEach((geometry) => geometry.dispose?.());
      renderer.dispose(); host.replaceChildren();
    }
  };
}

function mzForLight(z) { return z - 0.48; }
