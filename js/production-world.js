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
  const constrained = saveData || (memory > 0 && memory <= 3) || (cores > 0 && cores <= 4);
  const mobile = coarsePointer || window.innerWidth <= 760;
  const tier = constrained ? 'low' : mobile ? 'balanced' : (memory >= 8 && cores >= 8 ? 'high' : 'balanced');
  const quality = {
    low: { pixelRatio: 0.72, minRatio: 0.58, fps: 24, antialias: false, anisotropy: 1 },
    balanced: { pixelRatio: mobile ? 0.92 : 1.05, minRatio: 0.68, fps: mobile ? 30 : 40, antialias: !mobile, anisotropy: 2 },
    high: { pixelRatio: 1.2, minRatio: 0.78, fps: 50, antialias: true, anisotropy: 4 }
  }[tier];
  const maxAnisotropy = 4;
  const pixelRatioCap = Math.min(quality.pixelRatio, window.devicePixelRatio || 1, maxAnisotropy);
  let currentPixelRatio = pixelRatioCap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#132838');
  scene.fog = new THREE.Fog('#132838', 38, 82);
  const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({
    antialias: quality.antialias,
    alpha: false,
    powerPreference: tier === 'high' ? 'high-performance' : 'low-power',
    stencil: false,
    depth: true,
    failIfMajorPerformanceCaveat: false
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
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
    floor: material('#253b4b', 0.96),
    carpet: material('#304b5c', 0.98),
    wall: material('#d1dcdd', 0.9),
    wallDark: material('#142b3b', 0.82),
    teal: material('#13b99f', 0.48, 0.08),
    tealLight: material('#7ce0c9', 0.52),
    wood: material('#76533a', 0.84),
    woodEdge: material('#3a2b22', 0.82),
    metal: material('#7c929b', 0.48, 0.35),
    darkMetal: material('#182a38', 0.54, 0.2),
    divider: material('#24495a', 0.92),
    chair: material('#142a3a', 0.92),
    screenFrame: material('#101c27', 0.34, 0.12),
    screen: new THREE.MeshBasicMaterial({ map: makeScreenTexture(), toneMapped: false }),
    glass: new THREE.MeshBasicMaterial({ color: '#89b7c0', transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }),
    white: material('#e9eeee', 0.7),
    skin: material('#8d5d49', 0.92),
    jacketA: material('#24475b', 0.92),
    jacketB: material('#6a4b3b', 0.92),
    trousers: material('#182b3b', 0.94),
    hair: material('#211a17', 0.96),
    plant: material('#41815d', 0.95),
    plantLight: material('#71a66f', 0.95),
    gold: material('#c59c62', 0.64, 0.12)
  };

  function makeScreenTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 320;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#0d2130'; ctx.fillRect(0, 0, 512, 320);
    ctx.fillStyle = '#153b4c'; ctx.fillRect(0, 0, 512, 38);
    ctx.fillStyle = '#73dfc8'; ctx.font = 'bold 18px Arial'; ctx.fillText('MERIDIAN  /  CUSTOMER CARE', 18, 25);
    ctx.fillStyle = '#d6e9e8'; ctx.font = 'bold 13px Arial'; ctx.fillText('CUSTOMER PROFILE', 18, 68);
    ctx.fillStyle = '#8eaeb8'; ctx.fillRect(18, 82, 220, 7);
    ctx.fillRect(18, 101, 170, 7);
    ctx.fillRect(18, 120, 250, 7);
    ctx.fillStyle = '#0e756e'; ctx.fillRect(298, 58, 190, 86);
    ctx.fillStyle = '#a5f1de'; ctx.font = 'bold 26px Arial'; ctx.fillText('ACTIVE', 320, 94);
    ctx.font = '12px Arial'; ctx.fillText('SERVICE DESK', 320, 120);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#173344' : '#1c4050';
      ctx.fillRect(18, 162 + i * 27, 470, 20);
      ctx.fillStyle = '#65d6bf'; ctx.fillRect(28, 169 + i * 27, 90 + (i % 3) * 22, 5);
      ctx.fillStyle = '#829faa'; ctx.fillRect(150, 169 + i * 27, 190, 5);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 1;
    return texture;
  }

  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const sphereGeometry = new THREE.SphereGeometry(1, tier === 'low' ? 8 : 10, tier === 'low' ? 6 : 8);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, tier === 'low' ? 8 : 10);
  const planeGeometry = new THREE.PlaneGeometry(1, 1);
  const dummy = new THREE.Object3D();
  function addBox(parent, name, size, position, mat, rotationY = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
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
  addBox(scene, 'rear-wall', [34, 5.6, 0.32], [0, 2.75, -15], mats.wall);
  addBox(scene, 'left-wall', [0.32, 5.6, 30], [-17, 2.75, 0], mats.wall);
  addBox(scene, 'right-wall', [0.32, 5.6, 30], [17, 2.75, 0], mats.wall);
  addBox(scene, 'rear-feature-band', [33.5, 1.0, 0.1], [0, 4.8, -14.78], mats.wallDark);
  addBox(scene, 'brand-board', [7.8, 1.55, 0.12], [-3.9, 3.25, -14.73], mats.wallDark);

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
  brandSign.position.set(-3.9, 3.25, -14.65);
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
  const monitorFrames = [], monitorScreens = [], monitorStands = [], monitorFeet = [], keyboards = [];
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
  addInstances('chair-seats', boxGeometry, mats.chair, chairSeats);
  addInstances('chair-backs', boxGeometry, mats.chair, chairBacks);
  addInstances('chair-posts', cylinderGeometry, mats.metal, chairPosts);
  addInstances('chair-bases', boxGeometry, mats.darkMetal, chairBases);
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

  // Light-weight staff models: shared geometry and materials, limited to six visible actors.
  const staff = [];
  const actorBodyGeometry = new THREE.CapsuleGeometry(0.24, 0.62, tier === 'low' ? 2 : 3, tier === 'low' ? 5 : 7);
  const actorHeadGeometry = new THREE.SphereGeometry(0.17, tier === 'low' ? 8 : 12, tier === 'low' ? 6 : 8);
  const actorLimbGeometry = new THREE.CylinderGeometry(0.065, 0.075, 0.56, tier === 'low' ? 6 : 8);
  const actorLegGeometry = new THREE.CylinderGeometry(0.085, 0.095, 0.66, tier === 'low' ? 6 : 8);
  function createStaff(seed, x, z, seated = false) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    const jacket = seed % 2 ? mats.jacketA : mats.jacketB;
    const torso = new THREE.Mesh(actorBodyGeometry, jacket);
    torso.position.y = seated ? 1.0 : 1.1;
    root.add(torso);
    const head = new THREE.Mesh(actorHeadGeometry, mats.skin);
    head.position.set(0, seated ? 1.68 : 1.82, 0.015);
    root.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.174, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.56), mats.hair);
    hair.position.copy(head.position); hair.position.y += 0.035; root.add(hair);
    const leftArm = new THREE.Group(); leftArm.position.set(-0.25, seated ? 1.28 : 1.38, 0.02);
    const armL = new THREE.Mesh(actorLimbGeometry, jacket); armL.rotation.z = -0.25; armL.position.y = -0.22; leftArm.add(armL); root.add(leftArm);
    const rightArm = new THREE.Group(); rightArm.position.set(0.25, seated ? 1.28 : 1.38, 0.02);
    const armR = new THREE.Mesh(actorLimbGeometry, jacket); armR.rotation.z = 0.25; armR.position.y = -0.22; rightArm.add(armR); root.add(rightArm);
    if (!seated) {
      const leftLeg = new THREE.Mesh(actorLegGeometry, mats.trousers); leftLeg.position.set(-0.12, 0.34, 0); root.add(leftLeg);
      const rightLeg = new THREE.Mesh(actorLegGeometry, mats.trousers); rightLeg.position.set(0.12, 0.34, 0); root.add(rightLeg);
    }
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.14, 0.018), mats.gold);
    badge.position.set(0.12, seated ? 1.04 : 1.15, 0.245); root.add(badge);
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
  const preview = { azimuth: 0.46, elevation: 0.48, radius: 29, target: new THREE.Vector3(0, 1.75, -0.6) };
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
  let averageRenderMs = 0;
  let lastQualityCheck = 0;
  let hostInView = true;
  let disposed = false;
  let assetsReady = true;
  const assetMessage = 'Optimised instanced workplace and local staff ready';
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
  function renderStill() {
    if (!disposed && !document.hidden && host.clientWidth > 0 && host.clientHeight > 0) renderer.render(scene, camera);
  }
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

  function adaptResolution(cost, timestamp) {
    averageRenderMs = averageRenderMs ? averageRenderMs * 0.86 + cost * 0.14 : cost;
    if (!lastQualityCheck) { lastQualityCheck = timestamp; return; }
    if (timestamp - lastQualityCheck < 4000) return;
    lastQualityCheck = timestamp;
    let next = currentPixelRatio;
    if (averageRenderMs > 28) next = Math.max(quality.minRatio, currentPixelRatio - 0.09);
    else if (averageRenderMs < 15) next = Math.min(pixelRatioCap, currentPixelRatio + 0.04);
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
    const delta = lastFrameAt ? Math.min((timestamp - lastFrameAt) / 1000, 0.05) : 1 / quality.fps;
    lastFrameAt = timestamp;
    const elapsed = timestamp / 1000;
    updatePlayer(delta);
    updateStaff(delta, elapsed);
    const started = performance.now();
    renderer.render(scene, camera);
    adaptResolution(performance.now() - started, timestamp);
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
  callbacks.onAssetsReady?.({ loaded: 0, fallback: 6, mode: 'instanced-local' });
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
    dispose() {
      if (disposed) return;
      disposed = true;
      stopRenderLoop(); observer?.disconnect(); resizeObserver?.disconnect();
      listeners.forEach((remove) => remove());
      document.body.classList.remove('touch-device', 'calloria-immersive');
      scene.traverse((object) => {
        if (object.isInstancedMesh || object.isMesh) {
          if (object.geometry && ![boxGeometry, sphereGeometry, cylinderGeometry, planeGeometry, actorBodyGeometry, actorHeadGeometry, actorLimbGeometry, actorLegGeometry].includes(object.geometry)) object.geometry.dispose?.();
        }
        if (object.material && !Array.isArray(object.material) && !Object.values(mats).includes(object.material)) object.material.dispose?.();
      });
      brandTexture.dispose(); mats.screen.map?.dispose?.();
      renderer.dispose(); host.replaceChildren();
    }
  };
}

function mzForLight(z) { return z - 0.48; }
