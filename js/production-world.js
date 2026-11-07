/*
 * CALLORIA — immersive contact-centre environment
 *
 * Art direction: premium cinematic corporate realism.
 * Environment: authored real-scale architectural scene, PBR-style materials,
 * detailed modular workstations, 3D signage, equipment and real humanoid assets.
 * Character sources are CC0 assets loaded from their publishers; a detailed local
 * character fallback keeps the scene populated if the external asset host is down.
 */

const ASSET_URLS = {
  businessman: 'https://grab3d.com/dl/businessman-rigged/businessman-rigged.glb',
  woman: 'https://grab3d.com/dl/woman-rigged/woman-rigged.glb',
  reception: 'https://files.innerscene.com/library/welcome-160-reception-desk-21c678a3/f1eb0f421afd2bd57e25/reception-desk.glb'
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export async function initProductionWorld(THREE, host, callbacks = {}) {
  let RoundedBoxGeometry = null;
  let GLTFLoader = null;
  let SkeletonUtils = null;
  let mergeGeometries = null;

  const helperResults = await Promise.allSettled([
    import('three/addons/geometries/RoundedBoxGeometry.js'),
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/utils/SkeletonUtils.js'),
    import('three/addons/utils/BufferGeometryUtils.js')
  ]);
  if (helperResults[0].status === 'fulfilled') RoundedBoxGeometry = helperResults[0].value.RoundedBoxGeometry;
  else console.warn('Rounded box helper unavailable; standard box geometry will be used.', helperResults[0].reason);
  if (helperResults[1].status === 'fulfilled') GLTFLoader = helperResults[1].value.GLTFLoader;
  else console.warn('GLTFLoader unavailable; local character fallbacks will be used.', helperResults[1].reason);
  if (helperResults[2].status === 'fulfilled') SkeletonUtils = helperResults[2].value;
  else console.warn('Skinned model cloning helper unavailable; rigged duplicates will be reduced.', helperResults[2].reason);
  if (helperResults[3].status === 'fulfilled') mergeGeometries = helperResults[3].value.mergeGeometries;
  else console.warn('Geometry merge helper unavailable; workstation meshes will remain separate.', helperResults[3].reason);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d7e1e4');
  scene.fog = new THREE.Fog('#d7e1e4', 38, 78);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.08, 120);
  const touchDevice = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const renderer = new THREE.WebGLRenderer({ antialias: !touchDevice, alpha: false, powerPreference: 'high-performance' });
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touchDevice ? 1 : window.innerWidth < 900 ? 1.1 : 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.setClearColor('#d7e1e4', 1);
  renderer.domElement.className = 'production-world-canvas';
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D contact centre floor. Use WASD to move and E to interact.');
  host.replaceChildren(renderer.domElement);

  const materialCache = new Map();
  const mat = (color, roughness = 0.65, metalness = 0, extra = {}) => {
    const key = `${String(color)}|${roughness}|${metalness}|${JSON.stringify(extra)}`;
    if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }));
    return materialCache.get(key);
  };
  const materials = {
    wall: mat('#d7dfe1', 0.92),
    wallDark: mat('#142a3a', 0.78),
    wallPanel: mat('#243d4d', 0.7),
    floor: mat('#243746', 0.94),
    concrete: mat('#c8d1d2', 0.82),
    metal: mat('#788a91', 0.32, 0.82),
    darkMetal: mat('#1b2833', 0.38, 0.72),
    glass: new THREE.MeshPhysicalMaterial({ color: '#b9d9df', roughness: 0.08, metalness: 0.06, transmission: 0.78, transparent: true, opacity: 0.34, thickness: 0.05, ior: 1.4, depthWrite: false }),
    glassDark: new THREE.MeshPhysicalMaterial({ color: '#7eb2be', roughness: 0.13, metalness: 0.08, transparent: true, opacity: 0.24, depthWrite: false }),
    wood: mat('#76543b', 0.42, 0.08),
    woodEdge: mat('#38291f', 0.42, 0.1),
    fabric: mat('#253e50', 0.93),
    fabricLight: mat('#405c6b', 0.92),
    chair: mat('#101e29', 0.7, 0.12),
    white: mat('#e8eeee', 0.4, 0.04),
    black: mat('#101b23', 0.28, 0.25),
    screen: new THREE.MeshStandardMaterial({ color: '#08131c', roughness: 0.22, metalness: 0.12, emissive: '#071c28', emissiveIntensity: 0.42 }),
    teal: mat('#0c9d91', 0.38, 0.18),
    gold: mat('#b88c53', 0.28, 0.72),
    plant: mat('#326e59', 0.82),
    plantLight: mat('#5e9876', 0.84),
    skin: mat('#8a5745', 0.82),
    shirt: mat('#e2e8e7', 0.78),
    suit: mat('#233747', 0.72),
    trousers: mat('#1b2b39', 0.78),
    shoe: mat('#171d22', 0.42, 0.08)
  };

  function roundedBox(w, h, d, radius, material, segments = 4) {
    const geometry = RoundedBoxGeometry
      ? new RoundedBoxGeometry(w, h, d, segments, Math.min(radius, Math.min(w, h, d) * 0.45))
      : new THREE.BoxGeometry(w, h, d, 2, 2, 2);
    return new THREE.Mesh(geometry, material);
  }

  function addMesh(parent, mesh, x, y, z, cast = true, receive = true) {
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    parent.add(mesh);
    return mesh;
  }

  function makeTexture(draw, width = 1024, height = 1024, repeat = [1, 1]) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    draw(context, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
    texture.anisotropy = Math.min(8, maxAnisotropy);
    texture.needsUpdate = true;
    return texture;
  }

  const carpetTexture = makeTexture((ctx, w, h) => {
    ctx.fillStyle = '#263b4a'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 28000; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const a = 0.025 + Math.random() * 0.07;
      ctx.fillStyle = Math.random() > 0.5 ? `rgba(210,225,224,${a})` : `rgba(4,12,18,${a})`;
      ctx.fillRect(x, y, 1 + Math.random() * 2, 1);
    }
    ctx.strokeStyle = 'rgba(180,205,208,.055)'; ctx.lineWidth = 2;
    for (let x = 0; x <= w; x += 128) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y <= h; y += 128) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }, 1024, 1024, [12, 11]);
  const woodTexture = makeTexture((ctx, w, h) => {
    ctx.fillStyle = '#78583e'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 420; i++) {
      const y = Math.random() * h;
      ctx.strokeStyle = `rgba(${Math.random() > .5 ? '35,20,12' : '226,185,139'},${.025 + Math.random() * .1})`;
      ctx.lineWidth = .5 + Math.random() * 2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(w * .25, y + Math.random() * 25 - 12, w * .7, y + Math.random() * 18 - 9, w, y + Math.random() * 12 - 6); ctx.stroke();
    }
  }, 1024, 512, [2, 1]);
  const fabricTexture = makeTexture((ctx, w, h) => {
    ctx.fillStyle = '#243b4b'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 52000; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const a = Math.random() * .1;
      ctx.fillStyle = i % 2 ? `rgba(230,240,240,${a})` : `rgba(0,0,0,${a})`;
      ctx.fillRect(x, y, 2, 1);
    }
  }, 512, 512, [2, 2]);
  const plasterTexture = makeTexture((ctx, w, h) => {
    ctx.fillStyle = '#d9e0df'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 18000; i++) {
      const v = Math.random() > .5 ? 255 : 70;
      ctx.fillStyle = `rgba(${v},${v},${v},${Math.random() * .035})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  }, 512, 512, [4, 3]);
  materials.floor.map = carpetTexture;
  materials.fabric.map = fabricTexture;
  materials.fabricLight.map = fabricTexture;
  materials.wood.map = woodTexture;
  materials.wall.map = plasterTexture;
  materials.floor.needsUpdate = materials.fabric.needsUpdate = materials.wood.needsUpdate = materials.wall.needsUpdate = true;

  function makeScreenTexture(id, mode = 'crm') {
    return makeTexture((ctx, w, h) => {
      ctx.fillStyle = '#071723'; ctx.fillRect(0, 0, w, h);
      const cyan = '#37c7b1', muted = '#7892a2', pale = '#e1edf0';
      ctx.fillStyle = '#102a3a'; ctx.fillRect(0, 0, w, 52);
      ctx.fillStyle = cyan; ctx.fillRect(0, 0, 7, h);
      ctx.fillStyle = pale; ctx.font = '700 20px Arial'; ctx.fillText(mode === 'queue' ? 'CALLORIA · QUEUE CONTROL' : 'CALLORIA · AGENT DESK', 28, 33);
      ctx.fillStyle = muted; ctx.font = '13px Arial'; ctx.fillText(`STATION ${String(id).padStart(2, '0')}   •   SECURE SESSION`, w - 250, 33);
      ctx.fillStyle = '#0f2635'; ctx.fillRect(24, 72, w - 48, 64);
      ctx.fillStyle = cyan; ctx.font = '700 14px Arial'; ctx.fillText(mode === 'queue' ? 'LIVE INTERACTION QUEUE' : 'CUSTOMER OVERVIEW', 42, 96);
      ctx.fillStyle = pale; ctx.font = '12px Arial'; ctx.fillText(mode === 'queue' ? 'Inbound: 06   Priority: 02   Callbacks: 03' : 'Customer record   •   Verification required', 42, 119);
      const blocks = [[24,154, w*.58, h-180],[w*.62,154,w*.33,88],[w*.62,254,w*.33,h-280]];
      blocks.forEach(([x,y,bw,bh], index) => {
        ctx.fillStyle = '#0d202e'; ctx.fillRect(x,y,bw,bh);
        ctx.strokeStyle = '#274456'; ctx.strokeRect(x,y,bw,bh);
        ctx.fillStyle = index === 0 ? cyan : muted; ctx.font = '700 13px Arial'; ctx.fillText(['INTERACTION TIMELINE','SERVICE LEVEL','CASE STATUS'][index],x+16,y+23);
        const lines = Math.max(2, Math.floor((bh-48)/26));
        for(let j=0;j<lines;j++){
          ctx.fillStyle = j===0 ? '#b5c8cf' : '#617c8d';
          ctx.fillRect(x+16,y+39+j*24,bw*(.42+((j*13+id*7)%45)/100),5);
          if(index===0 && j<3){ctx.fillStyle = j===1 ? '#2f9689' : '#d0a66a';ctx.fillRect(x+16,y+50+j*24,8,8);}
        }
      });
      ctx.fillStyle = '#123c43'; ctx.fillRect(w-165,h-38,130,22);
      ctx.fillStyle = '#85e1cf'; ctx.font='700 11px Arial';ctx.fillText('SYSTEM ONLINE',w-151,h-23);
    }, 768, 432, [1,1]);
  }

  // Architectural shell.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 30), materials.floor);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.04, 0); floor.receiveShadow = true; scene.add(floor);
  const baseboardMat = mat('#536a73', .55, .28);
  const wallBack = roundedBox(34, 5.8, .32, .08, materials.wall, 4);
  addMesh(scene, wallBack, 0, 2.9, -15.1);
  const wallLeft = roundedBox(.32, 5.8, 30, .08, materials.wall, 4);
  addMesh(scene, wallLeft, -17, 2.9, 0);
  const wallRight = roundedBox(.32, 5.8, 30, .08, materials.wall, 4);
  addMesh(scene, wallRight, 17, 2.9, 0);
  addMesh(scene, roundedBox(33.8, .16, .12, .04, baseboardMat), 0, .1, -14.89, false);
  addMesh(scene, roundedBox(.12, .16, 29.8, .04, baseboardMat), -16.8, .1, 0, false);
  addMesh(scene, roundedBox(.12, .16, 29.8, .04, baseboardMat), 16.8, .1, 0, false);

  // Large daylight glazing across the rear wall with mullions and blinds.
  const windowFrame = mat('#8b9da1', .27, .66);
  const windowGlass = new THREE.MeshPhysicalMaterial({ color: '#b9dbe2', roughness: .08, metalness: .04, transmission: .72, transparent: true, opacity: .52, thickness: .06, depthWrite: false });
  for (let i = 0; i < 7; i++) {
    const x = -13.6 + i * 4.55;
    addMesh(scene, roundedBox(4.24, 2.7, .06, .025, windowGlass), x, 3.25, -14.88, false, false);
    addMesh(scene, roundedBox(.065, 2.85, .13, .018, windowFrame), x - 2.13, 3.25, -14.8, false, false);
    addMesh(scene, roundedBox(.065, 2.85, .13, .018, windowFrame), x + 2.13, 3.25, -14.8, false, false);
    addMesh(scene, roundedBox(4.28, .06, .13, .018, windowFrame), x, 1.9, -14.8, false, false);
    addMesh(scene, roundedBox(4.28, .06, .13, .018, windowFrame), x, 4.6, -14.8, false, false);
    for (let slat = 0; slat < 7; slat++) addMesh(scene, roundedBox(4.05, .018, .045, .008, mat('#dbe3df', .62)), x, 4.28 - slat * .12, -14.73, false, false);
  }

  // Ceiling, beams and luminous panels.
  const ceiling = roundedBox(34, .24, 30, .08, mat('#e7ecea', .88));
  addMesh(scene, ceiling, 0, 5.72, 0, false, false);
  for (let x = -15; x <= 15; x += 5) {
    const beam = roundedBox(.12, .28, 29.8, .025, mat('#aab7b7', .52, .25));
    addMesh(scene, beam, x, 5.52, 0, false, false);
  }
  const lightPanels = [];
  for (let x = -12; x <= 12; x += 12) for (let z = -8; z <= 8; z += 8) {
    const panel = roundedBox(2.7, .045, 1.25, .08, new THREE.MeshStandardMaterial({ color: '#fffdf2', emissive: '#fff0c6', emissiveIntensity: 1.1, roughness: .18 }));
    addMesh(scene, panel, x, 5.56, z, false, false);
    const glow = new THREE.PointLight('#fff0d3', 4.4, 8, 1.8); glow.position.set(x, 5.12, z); scene.add(glow); lightPanels.push(glow);
  }

  // Structural columns, acoustic wall panels and room markers.
  for (const [x,z] of [[-16,-13], [16,-13], [-16,13], [16,13], [-16,0], [16,0]]) {
    const column = roundedBox(.54, 5.5, .54, .08, mat('#aebbb9', .54, .2));
    addMesh(scene, column, x, 2.74, z);
    const foot = roundedBox(.7, .18, .7, .05, mat('#607782', .42, .28)); addMesh(scene, foot, x, .13, z);
  }
  for (let i=0;i<5;i++) {
    const panel=roundedBox(2.2,1.45,.12,.06, i%2?materials.wallPanel:mat('#496575',.88));
    addMesh(scene,panel,-13.7+i*5.1,3.25,-14.72,false,false);
  }

  // Brand wall and display.
  const brandPanel = roundedBox(10.4, 1.5, .2, .08, materials.wallDark);
  addMesh(scene, brandPanel, 0, 4.93, -14.65, false, false);
  const brandTex = makeTexture((ctx,w,h)=>{
    ctx.fillStyle='#102738';ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#49d3bb';ctx.fillRect(35,40,10,h-80);
    ctx.fillStyle='#ecf5f4';ctx.font='800 65px Arial';ctx.fillText('CALLORIA',78,118);
    ctx.fillStyle='#78a4ad';ctx.font='600 25px Arial';ctx.fillText('CUSTOMER OPERATIONS  •  FLOOR 04',82,160);
    ctx.fillStyle='#36c7b1';ctx.fillRect(w-170,58,105,8);
    ctx.fillStyle='#7898a3';ctx.font='700 18px Arial';ctx.fillText('LIVE',w-170,105);
  }, 1024, 220);
  const brandSign=roundedBox(9.9,1.16,.035,.03,new THREE.MeshBasicMaterial({map:brandTex}));
  addMesh(scene,brandSign,0,4.92,-14.51,false,false);

  // Modular glass supervisor / QA suites on the right hand side.
  const suiteX = 12.7, suiteZ = -11.3;
  const suiteFloor = roundedBox(6.2,.12,6.4,.03,mat('#b1c3c5',.48,.14)); addMesh(scene,suiteFloor,suiteX,.05,suiteZ);
  const suiteGlass = new THREE.MeshPhysicalMaterial({ color:'#b5d7dd', roughness:.08, metalness:.05, transparent:true, opacity:.21, transmission:.66, depthWrite:false });
  for (const [x,z,w,d] of [[suiteX-3.1,suiteZ, .08,6.4],[suiteX+3.1,suiteZ,.08,6.4],[suiteX,suiteZ-3.2,6.2,.08]]) {
    addMesh(scene,roundedBox(w,3.2,d,.02,suiteGlass),x,1.65,z,false,false);
  }
  for (const [x,z] of [[suiteX-3.1,suiteZ-3.2],[suiteX+3.1,suiteZ-3.2],[suiteX-3.1,suiteZ+3.2],[suiteX+3.1,suiteZ+3.2]]) {
    addMesh(scene,roundedBox(.09,3.25,.09,.02,windowFrame),x,1.65,z,false,false);
  }
  const suiteHeader = roundedBox(3.9,.42,.13,.05,materials.wallDark); addMesh(scene,suiteHeader,suiteX,3.55,suiteZ-3.08,false,false);
  const suiteHeaderText = makeTexture((ctx,w,h)=>{ctx.fillStyle='#102b3c';ctx.fillRect(0,0,w,h);ctx.fillStyle='#72ddc9';ctx.font='700 32px Arial';ctx.textAlign='center';ctx.fillText('SUPERVISION  /  QA',w/2,54);},512,80);
  const suiteLabel=roundedBox(3.78,.32,.03,.015,new THREE.MeshBasicMaterial({map:suiteHeaderText}));addMesh(scene,suiteLabel,suiteX,3.55,suiteZ-3.0,false,false);

  // Supervisor desk and meeting table.
  const managerDesk = new THREE.Group(); scene.add(managerDesk); managerDesk.position.set(suiteX,0,suiteZ-.2);
  addMesh(managerDesk,roundedBox(3.2,.14,1.4,.08,materials.wood),0,.85,-.3);
  for(const x of [-1.35,1.35])for(const z of [-.82,.22])addMesh(managerDesk,roundedBox(.09,.82,.09,.025,materials.metal),x,.42,z);
  addMesh(managerDesk,roundedBox(1.3,.06,.7,.03,materials.black),0,.98,-.52);
  addMesh(managerDesk,roundedBox(1.22,.72,.055,.025,materials.black),0,1.38,-.83);
  const managerScreen=roundedBox(1.11,.61,.012,.012,new THREE.MeshBasicMaterial({map:makeScreenTexture(99,'queue')}));addMesh(managerDesk,managerScreen,0,1.38,-.79,false,false);

  // Reception desk asset: the authored CC0 PBR model is loaded below; this local stand-in is only used if the publisher is unreachable.
  const receptionGroup = new THREE.Group(); scene.add(receptionGroup); receptionGroup.position.set(-12.6,0,10.2); receptionGroup.rotation.y = .12;
  addMesh(receptionGroup,roundedBox(3.5,1.12,1.1,.14,materials.wallDark),0,.56,0);
  addMesh(receptionGroup,roundedBox(3.58,.12,1.16,.06,materials.wood),0,1.12,0);
  addMesh(receptionGroup,roundedBox(2.3,.55,.035,.025,materials.teal),0,.6,.57,false,false);
  const receptionLabel=makeTexture((ctx,w,h)=>{ctx.fillStyle='#112d3d';ctx.fillRect(0,0,w,h);ctx.fillStyle='#6be2ce';ctx.font='800 58px Arial';ctx.textAlign='center';ctx.fillText('CALLORIA',w/2,76);ctx.fillStyle='#d6e7e7';ctx.font='500 22px Arial';ctx.fillText('WELCOME  •  EMPLOYEE SERVICES',w/2,116);},512,150);
  const receptionSign=roundedBox(2.18,.48,.025,.02,new THREE.MeshBasicMaterial({map:receptionLabel}));addMesh(receptionGroup,receptionSign,0,.62,.595,false,false);

  // Floor wayfinding and circulation paths.
  const routeMat = new THREE.MeshStandardMaterial({ color:'#5b7885', roughness:.8, metalness:.08, transparent:true, opacity:.4 });
  for (const z of [-10,-4,2,8]) addMesh(scene,roundedBox(31,.008,.025,.005,routeMat),0,.006,z,false,false);
  const aisle = roundedBox(3.4,.012,27,.01,mat('#3b5968',.92)); addMesh(scene,aisle,0,.002,0,false,false);
  for (let z=-12;z<13;z+=1.2) {
    addMesh(scene,roundedBox(.035,.012,.46,.01,mat('#a5c5c4',.7,.05)),0,.014,z,false,false);
  }

  // Workstation display texture / materials.
  const dividerFabric = new THREE.MeshStandardMaterial({ color:'#2b4b5b', map:fabricTexture, roughness:.88 });
  const screenFrame = mat('#121f28', .3, .3);
  const keyMat = mat('#b6c2c3', .56, .12);
  const keyDark = mat('#283b47', .44, .2);
  const keyboardBaseMat = mat('#192a35', .38, .24);
  const phoneBaseMat = mat('#243844', .35, .24);
  const workstationData = [];
  const stations = [];

  function createChair(parent, x, z, colorIndex=0) {
    const chair = new THREE.Group(); parent.add(chair); chair.position.set(x,0,z);
    const upholstery = colorIndex%2 ? materials.fabricLight : materials.fabric;
    const back = roundedBox(.74,1.02,.17,.12,upholstery); back.position.set(0,1.17,-.08); back.rotation.x=-.09; chair.add(back);
    const backInset=roundedBox(.58,.75,.035,.08,mat('#172c3b',.96));backInset.position.set(0,1.18,.015);chair.add(backInset);
    const lumbar=roundedBox(.58,.12,.045,.05,materials.teal);lumbar.position.set(0,.87,.035);chair.add(lumbar);
    const seat=roundedBox(.8,.19,.74,.14,upholstery);seat.position.set(0,.67,.37);chair.add(seat);
    const seatPad=roundedBox(.68,.04,.58,.09,materials.fabricLight);seatPad.position.set(0,.78,.37);chair.add(seatPad);
    for(const side of [-1,1]){
      const armStem=roundedBox(.07,.38,.07,.025,materials.darkMetal);armStem.position.set(side*.43,.79,.18);chair.add(armStem);
      const arm=roundedBox(.14,.11,.57,.045,materials.chair);arm.position.set(side*.46,1.0,.32);chair.add(arm);
      const armPad=roundedBox(.12,.035,.5,.015,mat('#263c4d',.72));armPad.position.set(side*.46,1.07,.32);chair.add(armPad);
    }
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(.055,.07,.47,24),materials.darkMetal);stem.position.set(0,.35,.37);chair.add(stem);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.12,.14,.08,24),materials.darkMetal);hub.position.set(0,.12,.37);chair.add(hub);
    for(let i=0;i<5;i++){
      const a=(Math.PI*2*i)/5;
      const spoke=roundedBox(.55,.07,.085,.025,materials.darkMetal);spoke.position.set(Math.sin(a)*.27,.11,.37+Math.cos(a)*.27);spoke.rotation.y=a;chair.add(spoke);
      const wheel=new THREE.Mesh(new THREE.TorusGeometry(.075,.035,10,18),materials.black);wheel.rotation.x=Math.PI/2;wheel.position.set(Math.sin(a)*.52,.075,.37+Math.cos(a)*.52);chair.add(wheel);
    }
    return chair;
  }

  function createKeyboard(parent, x, y, z) {
    const group = new THREE.Group(); parent.add(group); group.position.set(x,y,z);
    const base=roundedBox(1.18,.055,.38,.045,keyboardBaseMat);group.add(base);
    const keyGeometry = RoundedBoxGeometry ? new RoundedBoxGeometry(.072,.025,.07,2,.009) : new THREE.BoxGeometry(.072,.025,.07);
    const inst = new THREE.InstancedMesh(keyGeometry,keyMat,54);
    const dummy=new THREE.Object3D();let idx=0;
    for(let row=0;row<5;row++)for(let col=0;col<11;col++){
      dummy.position.set(-.51+col*.102,.043,-.145+row*.064);dummy.scale.set(1,1,1);dummy.updateMatrix();inst.setMatrixAt(idx++,dummy.matrix);
    }
    inst.count=idx;inst.instanceMatrix.needsUpdate=true;group.add(inst);
    const space=roundedBox(.5,.025,.055,.01,mat('#82959a',.5,.1));space.position.set(0,.045,.19);group.add(space);
    return group;
  }

  function createHeadset(parent,x,y,z,scale=1) {
    const g=new THREE.Group();parent.add(g);g.position.set(x,y,z);g.scale.setScalar(scale);
    const arc=new THREE.Mesh(new THREE.TorusGeometry(.19,.026,12,44,Math.PI),materials.black);arc.rotation.z=Math.PI;arc.position.y=.17;g.add(arc);
    const cupMat=mat('#1a2a36',.34,.18);
    for(const side of [-1,1]){
      const cup=roundedBox(.13,.2,.08,.045,cupMat);cup.position.set(side*.185,.14,0);g.add(cup);
      const pad=roundedBox(.045,.13,.08,.035,mat('#657b82',.78));pad.position.set(side*.255,.14,0);g.add(pad);
    }
    const micCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.16,.04,0),new THREE.Vector3(-.22,-.04,.03),new THREE.Vector3(-.2,-.11,.08)]);
    const micStem=new THREE.Mesh(new THREE.TubeGeometry(micCurve,20,.014,8,false),materials.black);g.add(micStem);
    const mic=roundedBox(.06,.035,.045,.015,materials.black);mic.position.set(-.2,-.11,.08);g.add(mic);
    return g;
  }

  function createPhone(parent,x,y,z) {
    const g=new THREE.Group();parent.add(g);g.position.set(x,y,z);
    addMesh(g,roundedBox(.38,.075,.28,.05,phoneBaseMat),0,0,0);
    addMesh(g,roundedBox(.22,.11,.05,.015,materials.black),0,.052,-.065,false,false);
    addMesh(g,roundedBox(.18,.07,.04,.01,new THREE.MeshBasicMaterial({color:'#8ce1d0',emissive:'#1c8f84'})),0,.115,-.065,false,false);
    for(let r=0;r<3;r++)for(let c=0;c<4;c++){
      const b=roundedBox(.045,.025,.04,.009,keyMat);b.position.set(-.11+c*.072,.055,.005+r*.064);g.add(b);
    }
    const handset=new THREE.Mesh(new THREE.CapsuleGeometry(.04,.29,3,10),materials.black);handset.rotation.z=Math.PI/2;handset.position.set(0,.16,.105);g.add(handset);
    return g;
  }

  function createMonitor(parent, x, z, id, mode='crm') {
    const monitor=new THREE.Group();parent.add(monitor);monitor.position.set(x,0,z);
    addMesh(monitor,roundedBox(1.18,.76,.11,.055,screenFrame),0,1.62,0);
    const texture=makeScreenTexture(id,mode);
    const screen=roundedBox(1.08,.65,.012,.025,new THREE.MeshBasicMaterial({map:texture, toneMapped:false}));addMesh(monitor,screen,0,1.62,.06,false,false);
    addMesh(monitor,roundedBox(.12,.42,.12,.035,materials.darkMetal),0,1.2,0);
    addMesh(monitor,roundedBox(.52,.045,.28,.025,materials.metal),0,.98,.02);
    addMesh(monitor,roundedBox(.95,.035,.18,.025,materials.black),0,.94,.015);
    // Webcam and status LED.
    addMesh(monitor,new THREE.Mesh(new THREE.SphereGeometry(.028,12,10),materials.black),0,2.015,.07,false,false);
    addMesh(monitor,new THREE.Mesh(new THREE.SphereGeometry(.012,10,8),new THREE.MeshBasicMaterial({color:'#46d9bb'})),.065,2.015,.076,false,false);
    return monitor;
  }

  function buildWorkstation(x,z,id,index) {
    const station = new THREE.Group(); scene.add(station); station.position.set(x,0,z);
    // Desk top, layered edge, metal structure and modesty panel.
    const top=roundedBox(2.9,.11,1.42,.075,materials.wood);top.material=materials.wood;addMesh(station,top,0,.82,0);
    const edge=roundedBox(2.94,.045,1.45,.04,materials.woodEdge);addMesh(station,edge,0,.765,0,false);
    const inlay=roundedBox(2.55,.018,1.12,.03,new THREE.MeshStandardMaterial({color:'#9a7655',map:woodTexture,roughness:.44}));addMesh(station,inlay,0,.885,0,false);
    for(const sx of [-1.28,1.28]){
      for(const sz of [-.52,.52])addMesh(station,roundedBox(.075,.79,.075,.025,materials.metal),sx,.4,sz);
      addMesh(station,roundedBox(.12,.13,.82,.025,materials.darkMetal),sx,.13,0);
    }
    addMesh(station,roundedBox(2.2,.52,.07,.025,mat('#263c49',.78)),0,.42,-.57);
    // Side drawer pedestal.
    const pedestalX=-1.06;
    addMesh(station,roundedBox(.47,.64,.58,.055,mat('#6d7c7f',.48,.2)),pedestalX,.36,.27);
    for(let drawer=0;drawer<3;drawer++){
      addMesh(station,roundedBox(.39,.15,.025,.018,mat('#a4b0b0',.48,.22)),pedestalX,.54-drawer*.18,.57,false,false);
      addMesh(station,roundedBox(.1,.018,.025,.01,materials.darkMetal),pedestalX,.55-drawer*.18,.59,false,false);
    }
    addMesh(station,roundedBox(.28,.045,.32,.025,materials.darkMetal),.94,.67,-.44);
    // Dual professional displays.
    createMonitor(station,-.53,-.49,id,'crm');
    createMonitor(station,.65,-.49,id+20,'queue');
    // Keyboard, mouse, phone and headset.
    createKeyboard(station,-.18,.91,.34);
    const mouse=roundedBox(.13,.07,.2,.055,mat('#202d37',.35,.2));mouse.position.set(.68,.94,.36);station.add(mouse);
    const mouseCable=new THREE.CatmullRomCurve3([new THREE.Vector3(.68,.99,.36),new THREE.Vector3(.63,1.05,.19),new THREE.Vector3(.55,1.05,.1)]);station.add(new THREE.Mesh(new THREE.TubeGeometry(mouseCable,18,.008,7,false),materials.black));
    createPhone(station,.99,.93,.18);
    createHeadset(station,-.96,1.0,.35,.78);
    // Personal objects and nameplate.
    const mug=roundedBox(.13,.17,.13,.04,mat('#d3d9d4',.28,.05));mug.position.set(1.12,.99,-.02);station.add(mug);
    const mugHandle=new THREE.Mesh(new THREE.TorusGeometry(.055,.018,8,18),mat('#b9c4bf',.35));mugHandle.position.set(1.2,1.0,-.02);mugHandle.rotation.y=Math.PI/2;station.add(mugHandle);
    addMesh(station,roundedBox(.48,.12,.035,.02,materials.wallDark),.93,.96,.65,false,false);
    const tagTexture=makeTexture((ctx,w,h)=>{ctx.fillStyle='#102c3c';ctx.fillRect(0,0,w,h);ctx.fillStyle='#69d9c2';ctx.font='800 38px Arial';ctx.textAlign='center';ctx.fillText(`STATION ${String(id).padStart(2,'0')}`,w/2,46);},256,64);
    const tag=roundedBox(.43,.1,.018,.008,new THREE.MeshBasicMaterial({map:tagTexture}));addMesh(station,tag,.93,.97,.675,false,false);
    // Acoustic divider returns.
    const sideA=roundedBox(.08,.76,1.48,.035,dividerFabric);addMesh(station,sideA,-1.48,1.17,0);
    const sideB=roundedBox(.08,.76,1.48,.035,dividerFabric);addMesh(station,sideB,1.48,1.17,0);
    const backDivider=roundedBox(2.9,.75,.09,.04,dividerFabric);addMesh(station,backDivider,0,1.16,-.72);
    addMesh(station,roundedBox(2.82,.035,.08,.02,materials.teal),0,1.56,-.72,false,false);
    // Cable trays and equipment under desk.
    addMesh(station,roundedBox(1.45,.09,.26,.025,materials.darkMetal),.15,.59,-.37);
    const cpu=roundedBox(.22,.48,.45,.045,materials.black);addMesh(station,cpu,1.12,.3,-.45);
    addMesh(station,roundedBox(.06,.12,.02,.01,materials.teal),1.12,.34,-.218,false,false);
    // Chair on the customer-facing side; agents face into the monitors.
    const chair=createChair(station,0,1.76,index);
    // Station identification panel.
    const stationData={ id, position:new THREE.Vector3(x,0,z), group:station, chair, x, z };
    stations.push(stationData);
    workstationData.push(stationData);
    return station;
  }

  // Twelve staffed workstations in three operational pods.
  const xPositions=[-9,-3,3,9];
  const zPositions=[-7,-1,5];
  let stationId=1;
  for(let r=0;r<zPositions.length;r++)for(let c=0;c<xPositions.length;c++)buildWorkstation(xPositions[c],zPositions[r],stationId++,r*4+c);

  // Merge static workstation meshes by shared material. The keyboard keycaps stay
  // instanced; screen textures stay separate. This sharply reduces draw calls.
  function optimiseWorkstationMeshes() {
    if (!mergeGeometries) return;
    const buckets = new Map();
    stations.forEach(({ group }) => {
      group.updateMatrixWorld(true);
      group.traverse(object => {
        if (!object.isMesh || object.isInstancedMesh || !object.geometry?.isBufferGeometry || Array.isArray(object.material)) return;
        const material = object.material;
        const key = `${material.uuid}|${object.castShadow ? 1 : 0}|${object.receiveShadow ? 1 : 0}`;
        if (!buckets.has(key)) buckets.set(key, { material, castShadow: object.castShadow, receiveShadow: object.receiveShadow, geometries: [], originals: [] });
        const geometry = object.geometry.clone();
        geometry.applyMatrix4(object.matrixWorld);
        buckets.get(key).geometries.push(geometry);
        buckets.get(key).originals.push(object);
      });
    });
    let mergedCount = 0;
    for (const bucket of buckets.values()) {
      if (bucket.geometries.length < 2) continue;
      let geometry = null;
      try { geometry = mergeGeometries(bucket.geometries, false); } catch (error) { console.warn('Workstation mesh merge skipped for one material group.', error); }
      if (!geometry) continue;
      geometry.computeBoundingSphere();
      const merged = new THREE.Mesh(geometry, bucket.material);
      merged.castShadow = bucket.castShadow;
      merged.receiveShadow = bucket.receiveShadow;
      scene.add(merged);
      bucket.originals.forEach(object => { object.parent?.remove(object); object.geometry.dispose(); });
      bucket.geometries.forEach(item => item.dispose());
      mergedCount += bucket.originals.length;
    }
    if (mergedCount) console.info(`CALLORIA: merged ${mergedCount} static workstation meshes into ${buckets.size} material groups.`);
  }
  optimiseWorkstationMeshes();

  // Plants and decorative objects use curved stems and leaf meshes rather than placeholder cones.
  function addPlant(x,z,scale=1) {
    const g=new THREE.Group();scene.add(g);g.position.set(x,0,z);g.scale.setScalar(scale);
    const pot=roundedBox(.58,.5,.58,.11,mat('#8b9b94',.72,.04));addMesh(g,pot,0,.25,0);
    const soil=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.04,24),mat('#372b24',1));soil.position.y=.51;g.add(soil);
    for(let i=0;i<9;i++){
      const angle=i*2.399;
      const stemCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,.52,0),new THREE.Vector3(Math.cos(angle)*.16,.95,Math.sin(angle)*.16),new THREE.Vector3(Math.cos(angle)*.32,1.55+(i%3)*.12,Math.sin(angle)*.32)]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(stemCurve,16,.018,7,false),mat('#386f52',.88)));
      const leaf=new THREE.Mesh(new THREE.SphereGeometry(.12,18,14),i%2?materials.plant:materials.plantLight);
      leaf.scale.set(.32,1.6,.42);leaf.position.set(Math.cos(angle)*.29,1.42+(i%3)*.1,Math.sin(angle)*.29);leaf.rotation.z=Math.cos(angle)*.55;leaf.rotation.x=Math.sin(angle)*.45;g.add(leaf);
    }
    return g;
  }
  addPlant(-15,12.5,.85);addPlant(15,12.5,.85);addPlant(-14,-11,1.15);addPlant(15,-13,1.0);addPlant(-13,2,.85);addPlant(15,2,.9);

  // Decorative wall display: live operations board.
  const board = roundedBox(5.7,2.25,.18,.07,materials.wallDark);addMesh(scene,board,-11.1,3.45,-14.72,false,false);
  const boardTexture=makeTexture((ctx,w,h)=>{
    ctx.fillStyle='#0c2030';ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#59d5bd';ctx.font='800 30px Arial';ctx.fillText('CUSTOMER OPERATIONS  /  LIVE',28,42);
    const cards=[['QUEUE','06','INBOUND'],['AVAILABLE','18','AGENTS'],['SERVICE','92%','LEVEL'],['CSAT','4.7','TODAY']];
    cards.forEach((card,i)=>{const x=24+i*235;ctx.fillStyle='#17394a';ctx.fillRect(x,72,210,105);ctx.fillStyle='#7da8b3';ctx.font='600 18px Arial';ctx.fillText(card[0],x+18,100);ctx.fillStyle='#ecf4f1';ctx.font='800 38px Arial';ctx.fillText(card[1],x+18,144);ctx.fillStyle='#4bd1b7';ctx.font='600 14px Arial';ctx.fillText(card[2],x+110,143);});
    ctx.fillStyle='#7898a2';ctx.font='14px Arial';ctx.fillText('SIMULATED OPERATIONAL FEED  •  FLOOR 04',28,h-18);
  }, 1024, 240);
  const boardScreen=roundedBox(5.44,1.98,.025,.02,new THREE.MeshBasicMaterial({map:boardTexture,toneMapped:false}));addMesh(scene,boardScreen,-11.1,3.45,-14.61,false,false);

  // Meeting area in the back-left corner.
  const meetingArea = new THREE.Group(); scene.add(meetingArea); meetingArea.position.set(11,0,10.2);
  addMesh(meetingArea,roundedBox(4.8,.13,2.2,.12,materials.wood),0,.78,0);
  for(const x of [-2,2])for(const z of [-.82,.82])addMesh(meetingArea,roundedBox(.09,.72,.09,.025,materials.metal),x,.38,z);
  for(let i=0;i<6;i++){
    const angle=(Math.PI*2*i)/6;
    const chair=new THREE.Group();meetingArea.add(chair);chair.position.set(Math.cos(angle)*3.1,0,Math.sin(angle)*1.65);
    addMesh(chair,roundedBox(.68,.15,.7,.1,materials.fabric),0,.58,0);
    const back=roundedBox(.66,.88,.13,.1,materials.fabric);addMesh(chair,back,0,1.05,-.3);
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,.52,16),materials.darkMetal);leg.position.y=.27;chair.add(leg);
  }

  // Window-side light and interior illumination.
  scene.add(new THREE.HemisphereLight('#e2f0f2','#1d2f3b',1.75));
  const keyLight=new THREE.DirectionalLight('#fff4dd',4.2);keyLight.position.set(-11,17,11);keyLight.castShadow=true;keyLight.shadow.mapSize.set(touchDevice ? 1024 : 2048,touchDevice ? 1024 : 2048);keyLight.shadow.camera.left=-22;keyLight.shadow.camera.right=22;keyLight.shadow.camera.top=22;keyLight.shadow.camera.bottom=-22;keyLight.shadow.bias=-.00018;keyLight.shadow.normalBias=.025;scene.add(keyLight);
  const fillLight=new THREE.DirectionalLight('#b2d5e4',1.35);fillLight.position.set(14,9,-9);scene.add(fillLight);
  const warmAccent=new THREE.PointLight('#55cdbb',18,22,2);warmAccent.position.set(-11,3.4,-10);scene.add(warmAccent);
  const receptionGlow=new THREE.PointLight('#e8b76c',11,11,2);receptionGlow.position.set(-11,3,10);scene.add(receptionGlow);

  // Camera and interaction state.
  const preview = { azimuth: .43, elevation: .22, radius: 27, target: new THREE.Vector3(0,1.5,-.4) };
  const player = { x: 0, z: 12.3, yaw: 0, pitch: -.025, speed: 4.4 };
  const keys = new Set();
  if (touchDevice) document.body.classList.add('touch-device');
  const touchMove = { x: 0, y: 0, pointerId: null, sprinting: false };
  let immersive = false;
  let dragging = false;
  let lastPointer = { x: 0, y: 0 };
  let nearestStation = null;
  let currentStation = null;
  let frameId = 0;
  const clock = new THREE.Clock();
  const mixers = [];
  const walkers = [];
  const deskActors = [];
  let agentActivity = 'offline';
  const loader = GLTFLoader ? new GLTFLoader() : null;
  const fallbackCharacters = [];

  function createFallbackEmployee(seed=0) {
    const root=new THREE.Group();
    const skinPalette=['#704635','#8a5b45','#a16b52','#634032'];
    const jacketPalette=['#203d52','#344d63','#654638','#1c4c49'];
    const skin=mat(skinPalette[seed%skinPalette.length],.82);
    const jacket=mat(jacketPalette[seed%jacketPalette.length],.74);
    const shirt=mat('#e7e9e4',.75);
    const trouser=mat('#1d2d3d',.8);
    const hair=mat(seed%2?'#171b20':'#2a1e19',.9);
    function loft(points, material, segments=36) {
      return new THREE.Mesh(new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(p[0],p[1])),segments),material);
    }
    // Tailored torso and trousers are lofted meshes, with separate lapels and seams.
    const torso=loft([[.22,.48],[.25,.62],[.31,.9],[.4,1.23],[.48,1.42],[.41,1.5],[.3,1.54],[.12,1.54]],jacket,40);root.add(torso);
    const shirtFront=roundedBox(.22,.74,.035,.04,shirt);shirtFront.position.set(0,1.16,.27);root.add(shirtFront);
    const tie=loft([[.025,.88],[.045,1.05],[.035,1.43],[.022,1.5]],materials.gold,16);tie.position.z=.30;root.add(tie);
    for(const side of [-1,1]){
      const lapel=new THREE.Shape();lapel.moveTo(0,0);lapel.lineTo(.12,.34);lapel.lineTo(.08,.48);lapel.lineTo(.23,.29);lapel.lineTo(.17,0);
      const mesh=new THREE.Mesh(new THREE.ShapeGeometry(lapel),mat('#3e5667',.72));mesh.position.set(side*.05,1.24,.31);mesh.scale.x=side;root.add(mesh);
      const leg=loft([[.11,0],[.115,.08],[.14,.4],[.14,.78],[.1,.9]],trouser,24);leg.position.set(side*.16,0,.01);root.add(leg);
      (root.userData.legParts ||= []).push({leg,side});
      const shoe=roundedBox(.19,.12,.34,.055,materials.shoe);shoe.position.set(side*.16,.08,.12);root.add(shoe);
      // Shoulder, sleeve and hand, with visible cuffs.
      const upper=new THREE.Mesh(new THREE.CylinderGeometry(.105,.14,.45,24,1),jacket);upper.rotation.z=side*.28;upper.position.set(side*.42,1.25,.02);root.add(upper);
      const fore=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,.43,24,1),jacket);fore.rotation.z=side*.12;fore.position.set(side*.54,.91,.08);root.add(fore);
      (root.userData.armParts ||= []).push({upper,fore,side});
      const cuff=roundedBox(.14,.09,.14,.035,shirt);cuff.position.set(side*.55,.69,.08);root.add(cuff);
      const hand=loft([[.035,.64],[.06,.69],[.065,.75],[.045,.8]],skin,18);hand.position.set(side*.55,0,.08);root.add(hand);
    }
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,.2,24),skin);neck.position.y=1.59;root.add(neck);
    const head=loft([[.0,1.6],[.12,1.62],[.17,1.71],[.205,1.84],[.19,1.97],[.12,2.04],[0,2.06]],skin,40);root.add(head);
    const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.2,32,20,0,Math.PI*2,0,Math.PI*.62),hair);hairCap.position.set(0,1.97,-.008);root.add(hairCap);
    for(const side of [-1,1]){
      const ear=new THREE.Mesh(new THREE.SphereGeometry(.043,18,14),skin);ear.position.set(side*.19,1.82,0);root.add(ear);
      const eyeWhite=roundedBox(.052,.035,.025,.015,mat('#f0eee8',.42));eyeWhite.position.set(side*.07,1.85,.174);root.add(eyeWhite);
      const iris=new THREE.Mesh(new THREE.SphereGeometry(.018,14,10),mat('#332a24',.3));iris.position.set(side*.07,1.85,.193);root.add(iris);
      const brow=roundedBox(.08,.018,.025,.009,hair);brow.position.set(side*.07,1.91,.17);root.add(brow);
    }
    const nose=new THREE.Mesh(new THREE.ConeGeometry(.045,.11,16),skin);nose.rotation.x=-Math.PI/2;nose.position.set(0,1.81,.205);root.add(nose);
    const mouth=roundedBox(.075,.012,.012,.005,mat('#6b3732',.7));mouth.position.set(0,1.72,.184);root.add(mouth);
    // ID badge and lanyard.
    const lanyard=new THREE.Mesh(new THREE.TorusGeometry(.12,.012,8,32,Math.PI),mat('#51c9b3',.55));lanyard.rotation.x=Math.PI/2;lanyard.position.set(0,1.42,.3);root.add(lanyard);
    const badge=roundedBox(.12,.16,.025,.02,materials.white);badge.position.set(.15,1.11,.31);root.add(badge);
    const badgeLine=roundedBox(.065,.012,.008,.004,materials.teal);badgeLine.position.set(.15,1.13,.328);root.add(badgeLine);
    root.userData.fallback=true;root.userData.seed=seed;
    return root;
  }

  function addFallbackStaff() {
    const points=[[-9,6.75],[-3,.75],[3,.75],[9,-5.25]];
    points.forEach((p,i)=>{
      const character=createFallbackEmployee(i);character.position.set(p[0],0,p[1]);character.rotation.y=Math.PI;scene.add(character);
      fallbackCharacters.push({root:character,phase:i*1.7,base:p,desk:true});
    });
  }

  function normalizeCharacter(root, targetHeight=1.78) {
    root.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(root);
    const height=bounds.max.y-bounds.min.y;
    if(height>0){const scale=targetHeight/height;root.scale.multiplyScalar(scale);root.position.y-=bounds.min.y*scale;}
  }

  function cloneSkinned(source) {
    if(SkeletonUtils && SkeletonUtils.clone) return SkeletonUtils.clone(source);
    return source.clone(true);
  }

  function addWalker(root, route, clip, speed=1.0, offset=0) {
    root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material){o.material.side=THREE.FrontSide;}}});
    scene.add(root);
    const mixer=new THREE.AnimationMixer(root);
    if(clip){const action=mixer.clipAction(clip);action.play();action.timeScale=.78;}
    mixers.push(mixer);
    const curve=new THREE.CatmullRomCurve3(route.map(p=>new THREE.Vector3(p[0],0,p[1])),true,'catmullrom',.18);
    walkers.push({root,mixer,curve,speed,offset,progress:offset});
  }

  async function loadCharacter(url, count, seedOffset=0) {
    if(!loader) throw new Error('GLTFLoader unavailable');
    const gltf=await loader.loadAsync(url);
    const source=gltf.scene;
    source.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material){o.material.envMapIntensity=0.72;}}});
    normalizeCharacter(source,1.78);
    const walkClip=gltf.animations.find(c=>/walk/i.test(c.name)) || gltf.animations[0] || null;
    const routes=[
      [[-12,-3],[-11,1],[-7,3],[-1,3],[5,3],[11,2],[12,-2],[9,-5],[2,-5],[-5,-5]],
      [[10,9],[11,6],[11,0],[10,-5],[8,-9],[4,-10],[0,-10],[-4,-9],[-8,-7],[-11,-5]],
      [[-12,8],[-10,5],[-7,4],[-4,4],[-1,5],[2,7],[5,8],[8,8],[11,7]]
    ];
    for(let i=0;i<count;i++){
      const actor=cloneSkinned(source);
      if(i===0){
        const station=stations[seedOffset===0?2:9];
        actor.position.set(station.x+.72,0,station.z+1.2);
        actor.rotation.y=Math.PI;
        actor.scale.multiplyScalar(.94);
        actor.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
        scene.add(actor);
        const actorMixer=new THREE.AnimationMixer(actor);
        const actions=gltf.animations.map(clip=>({clip,action:actorMixer.clipAction(clip)}));
        const idle=actions.find(item=>/idle|sit|seated|rest/i.test(item.clip.name));
        if(idle) idle.action.play();
        if(actions.length) mixers.push(actorMixer);
        deskActors.push({root:actor,phase:seedOffset*.8,mixer:actorMixer,actions,activeAction:idle?.action||null});
      }else{
        const route=routes[(i+seedOffset)%routes.length];
        addWalker(actor,route,walkClip,.035+(i%2)*.009,(i/count)*.72+seedOffset*.16);
      }
    }
    return count;
  }

  async function loadExternalAssets() {
    const results=[];
    if(!loader){addFallbackStaff();return {loaded:0, fallback:4};}
    const staffPerModel = window.innerWidth < 900 || (navigator.deviceMemory && navigator.deviceMemory <= 4) ? 1 : 2;
    try {
      const count=await loadCharacter(ASSET_URLS.businessman,staffPerModel,0);results.push(count);
    } catch(error) { console.warn('Business character asset did not load; local employee meshes will be used.',error); }
    try {
      const count=await loadCharacter(ASSET_URLS.woman,staffPerModel,1);results.push(count);
    } catch(error) { console.warn('Woman character asset did not load; local employee meshes will be used.',error); }
    let loaded=results.reduce((a,b)=>a+b,0);
    if(loaded<4){
      for(let i=0;i<4-loaded;i++){
        const actor=createFallbackEmployee(i+loaded);const lane=i%2?1:-1;
        actor.position.set(lane*10,0,5-i*3);actor.rotation.y=Math.PI;scene.add(actor);
        fallbackCharacters.push({root:actor,phase:i*.9,base:[lane*10,5-i*3]});
      }
    }
    try {
      const receptionGltf=await loader.loadAsync(ASSET_URLS.reception);
      const model=receptionGltf.scene;model.scale.setScalar(1.12);model.position.set(-12.6,0,10.2);model.rotation.y=.12;
      model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
      scene.add(model);receptionGroup.visible=false;
    } catch(error){console.warn('Reception asset unavailable; detailed local reception model remains active.',error);}
    return {loaded,fallback:4-loaded};
  }

  // Small interactive station status lights.
  stations.forEach((station,i)=>{
    const glow=new THREE.Mesh(new THREE.SphereGeometry(.05,14,10),new THREE.MeshBasicMaterial({color:i%4===0?'#e8b76b':'#58d6be'}));
    glow.position.set(station.x,1.62,station.z-.72);scene.add(glow);
    station.glow=glow;
  });

  let assetsReady=false;
  let assetMessage='Loading high-detail employee models';
  loadExternalAssets().then(result=>{
    assetsReady=true;
    assetMessage=result.loaded?`${result.loaded} high-detail staff models loaded`:'Staff model fallback active';
    if(callbacks.onAssetsReady)callbacks.onAssetsReady(result);
  }).catch(error=>{
    assetsReady=true;assetMessage='Local staff models active';
    console.warn('3D employee asset loader failed:',error);
    addFallbackStaff();
    if(callbacks.onAssetsReady)callbacks.onAssetsReady({loaded:0,fallback:4});
  });

  // Preview camera controls.
  function setPreviewCamera(){
    const e=preview.elevation,a=preview.azimuth,r=preview.radius;
    camera.position.set(preview.target.x+Math.sin(a)*Math.cos(e)*r,preview.target.y+Math.sin(e)*r,preview.target.z+Math.cos(a)*Math.cos(e)*r);
    camera.lookAt(preview.target);
  }
  setPreviewCamera();

  const resize=()=>{
    const w=Math.max(1,host.clientWidth||900),h=Math.max(1,host.clientHeight||380);
    camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
  };
  const resizeObserver='ResizeObserver' in window?new ResizeObserver(resize):null;
  if(resizeObserver)resizeObserver.observe(host);else window.addEventListener('resize',resize);
  resize();

  function setImmersive(value) {
    immersive=Boolean(value);
    host.closest('.world-panel')?.classList.toggle('is-immersive',immersive);
    document.body.classList.toggle('calloria-immersive',immersive);
    if(immersive){
      player.x=0;player.z=12.2;player.yaw=0;player.pitch=-.035;
      touchMove.x=0;touchMove.y=0;touchMove.sprinting=false;
      const stick=document.getElementById('touchStick');
      if(stick)stick.style.transform='translate(0px,0px)';
      camera.position.set(player.x,1.68,player.z);camera.rotation.order='YXZ';camera.rotation.set(player.pitch,player.yaw,0);
      if(callbacks.onImmersiveChange)callbacks.onImmersiveChange(true);
    }else{
      if(document.pointerLockElement===renderer.domElement)document.exitPointerLock?.();
      keys.clear();touchMove.x=0;touchMove.y=0;touchMove.sprinting=false;touchMove.pointerId=null;
      nearestStation=null;currentStation=null;setPreviewCamera();
      if(callbacks.onImmersiveChange)callbacks.onImmersiveChange(false);
    }
  }

  function enter(){
    setImmersive(true);
    if(!touchDevice){try{renderer.domElement.requestPointerLock?.();}catch(error){console.warn('Pointer lock not available.',error);}}
  }
  function exit(){setImmersive(false);}

  renderer.domElement.addEventListener('pointerdown',event=>{
    if(immersive){
      if(!touchDevice && document.pointerLockElement!==renderer.domElement){
        try{renderer.domElement.requestPointerLock?.();}catch(error){console.warn('Pointer lock resume failed.',error);}
      }
      if(touchDevice || document.pointerLockElement!==renderer.domElement){
        dragging=true;lastPointer={x:event.clientX,y:event.clientY};
        renderer.domElement.setPointerCapture?.(event.pointerId);
      }
      return;
    }
    dragging=true;lastPointer={x:event.clientX,y:event.clientY};
    renderer.domElement.setPointerCapture?.(event.pointerId);
  });
  renderer.domElement.addEventListener('pointermove',event=>{
    if(immersive&&document.pointerLockElement===renderer.domElement)return;
    if(!dragging)return;
    if(immersive){
      player.yaw-=(event.clientX-lastPointer.x)*.004;
      player.pitch=clamp(player.pitch-(event.clientY-lastPointer.y)*.003,-.68,.48);
      camera.rotation.order='YXZ';camera.rotation.set(player.pitch,player.yaw,0);
    }else{
      preview.azimuth-=(event.clientX-lastPointer.x)*.004;
      preview.elevation=clamp(preview.elevation+(event.clientY-lastPointer.y)*.002,-.08,.62);
      setPreviewCamera();
    }
    lastPointer={x:event.clientX,y:event.clientY};
  });
  renderer.domElement.addEventListener('pointerup',()=>dragging=false);
  renderer.domElement.addEventListener('pointercancel',()=>dragging=false);
  renderer.domElement.addEventListener('wheel',event=>{
    if(immersive)return;
    preview.radius=clamp(preview.radius+event.deltaY*.014,18,37);setPreviewCamera();
  },{passive:true});
  document.addEventListener('mousemove',event=>{
    if(!immersive||document.pointerLockElement!==renderer.domElement)return;
    player.yaw-=event.movementX*.00215;
    player.pitch=clamp(player.pitch-event.movementY*.0018,-.68,.48);
    camera.rotation.order='YXZ';camera.rotation.set(player.pitch,player.yaw,0);
  });
  document.addEventListener('keydown',event=>{
    if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','KeyE','Escape'].includes(event.code)&&immersive){
      if(!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))event.preventDefault();
    }
    if(event.code==='Escape'&&immersive){exit();return;}
    if(immersive)keys.add(event.code);
    if(immersive&&event.code==='KeyE'&&!event.repeat){
      if(nearestStation&&callbacks.onStation)callbacks.onStation({id:nearestStation.id,label:`Station ${String(nearestStation.id).padStart(2,'0')}`,department:'Customer Operations'});
    }
  });
  document.addEventListener('keyup',event=>keys.delete(event.code));
  const joystick=document.getElementById('touchJoystick');
  const joystickKnob=document.getElementById('touchStick');
  const sprintButton=document.getElementById('touchSprintButton');
  const interactButton=document.getElementById('touchInteractButton');
  const joystickRadius=()=>Math.max(24,(joystick?.clientWidth||116)*.34);
  function updateTouchJoystick(event){
    if(!joystick)return;
    const rect=joystick.getBoundingClientRect();
    const centerX=rect.left+rect.width/2,centerY=rect.top+rect.height/2;
    const radius=joystickRadius();
    let dx=event.clientX-centerX,dy=event.clientY-centerY;
    const length=Math.hypot(dx,dy);
    if(length>radius){dx=dx/length*radius;dy=dy/length*radius;}
    touchMove.x=clamp(dx/radius,-1,1);
    touchMove.y=clamp(dy/radius,-1,1);
    if(joystickKnob)joystickKnob.style.transform=`translate(${dx}px, ${dy}px)`;
  }
  function resetTouchJoystick(){
    touchMove.x=0;touchMove.y=0;touchMove.pointerId=null;
    if(joystickKnob)joystickKnob.style.transform='translate(0px, 0px)';
  }
  joystick?.addEventListener('pointerdown',event=>{
    if(!immersive)return;
    event.preventDefault();touchMove.pointerId=event.pointerId;
    joystick.setPointerCapture?.(event.pointerId);updateTouchJoystick(event);
  });
  joystick?.addEventListener('pointermove',event=>{
    if(immersive && touchMove.pointerId===event.pointerId){event.preventDefault();updateTouchJoystick(event);}
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>joystick?.addEventListener(type,event=>{
    if(touchMove.pointerId===event.pointerId)resetTouchJoystick();
  }));
  sprintButton?.addEventListener('pointerdown',event=>{if(immersive){event.preventDefault();touchMove.sprinting=true;sprintButton.setPointerCapture?.(event.pointerId);}});
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>sprintButton?.addEventListener(type,()=>{touchMove.sprinting=false;}));
  function useNearestStation(){
    if(immersive && nearestStation && callbacks.onStation){
      callbacks.onStation({id:nearestStation.id,label:`Station ${String(nearestStation.id).padStart(2,'0')}`,department:'Customer Operations'});
    }
  }
  interactButton?.addEventListener('click',useNearestStation);
  document.addEventListener('pointerlockchange',()=>{
    if(immersive&&document.pointerLockElement!==renderer.domElement&&!touchDevice&&callbacks.onPointerUnlock)callbacks.onPointerUnlock();
  });

  function blocked(x,z){
    // Desk and fixed-suite collision; circulation lanes remain open.
    if(x<-16||x>16||z<-14||z>14)return true;
    for(const station of stations){
      const dx=Math.abs(x-station.x),dz=Math.abs(z-station.z);
      if(dx<1.56&&dz<.88)return true;
    }
    if(x>9.4&&x<16.0&&z>-14.7&&z<-8.0)return true;
    return false;
  }

  let lastNearestId = null;
  function updatePlayer(delta){
    if(!immersive)return;
    const forward=clamp((keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-touchMove.y,-1,1);
    const strafe=clamp((keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+touchMove.x,-1,1);
    if(forward||strafe){
      const length=Math.hypot(forward,strafe)||1;
      const speed=player.speed*((keys.has('ShiftLeft')||keys.has('ShiftRight')||touchMove.sprinting)?1.52:1);
      const dx=(Math.sin(player.yaw)*forward+Math.cos(player.yaw)*strafe)*speed*delta/length;
      const dz=(-Math.cos(player.yaw)*forward+Math.sin(player.yaw)*strafe)*speed*delta/length;
      if(!blocked(player.x+dx,player.z))player.x+=dx;
      if(!blocked(player.x,player.z+dz))player.z+=dz;
    }
    camera.position.set(player.x,1.68,player.z);
    camera.rotation.order='YXZ';camera.rotation.set(player.pitch,player.yaw,0);
    nearestStation=null;let nearest=Infinity;
    stations.forEach(station=>{
      const dx=player.x-station.x,dz=player.z-(station.z+2.05),distance=Math.hypot(dx,dz);
      if(distance<nearest){nearest=distance;nearestStation=station;}
      station.glow.material.color.set(distance<2.75?'#f0bf70':(station.id%4===0?'#e8b76b':'#58d6be'));
      station.glow.scale.setScalar(distance<2.75?1.7:1);
    });
    if(nearest>2.9)nearestStation=null;
    if(interactButton)interactButton.disabled=!nearestStation;
    const nearestId=nearestStation?.id??null;
    if(nearestId!==lastNearestId){lastNearestId=nearestId;if(callbacks.onNearestStation)callbacks.onNearestStation(nearestStation?{id:nearestStation.id,label:`Station ${String(nearestStation.id).padStart(2,'0')}`}:null);}
  }

  function updateWalkers(delta, elapsed){
    mixers.forEach(mixer=>mixer.update(delta));
    walkers.forEach((walker,i)=>{
      walker.progress=(walker.progress+delta*walker.speed)%1;
      const point=walker.curve.getPointAt(walker.progress);
      const ahead=walker.curve.getPointAt((walker.progress+.003)%1);
      walker.root.position.set(point.x,0,point.z);
      walker.root.rotation.y=Math.atan2(ahead.x-point.x,ahead.z-point.z);
    });
    deskActors.forEach(({root,phase})=>{root.position.y=.006+Math.sin(elapsed*1.15+phase)*.008;root.rotation.y=Math.PI+Math.sin(elapsed*.26+phase)*.025;});
    fallbackCharacters.forEach(({root,phase,base,desk})=>{
      root.position.x=base[0]+(desk?0:Math.sin(elapsed*.35+phase)*.26);
      root.position.z=base[1]+(desk?0:Math.cos(elapsed*.28+phase)*.22);
      root.rotation.y=Math.PI+(desk?Math.sin(elapsed*.22+phase)*.035:Math.sin(elapsed*.35+phase)*.18);
      root.position.y=desk?Math.abs(Math.sin(elapsed*1.1+phase))*.006:Math.abs(Math.sin(elapsed*2.2+phase))*.014;
      root.userData.armParts?.forEach(({upper,fore,side})=>{
        const working=desk && ['busy','wrap-up'].includes(agentActivity);
        const listening=desk && agentActivity==='available';
        upper.rotation.x=(working?.34:listening?.12:.04)*Math.sin(elapsed*(working?3.2:1.1)+phase+side);
        fore.rotation.x=working?.34*Math.cos(elapsed*3.0+phase+side):.06*Math.cos(elapsed*1.2+phase+side);
      });
      root.userData.legParts?.forEach(({leg,side})=>{leg.rotation.x=desk?0:.16*Math.sin(elapsed*2.2+phase+side);});
    });
  }

  function setAgentActivity(status='available'){
    agentActivity=['available','busy','wrap-up','break','offline'].includes(status)?status:'available';
    const pattern=agentActivity==='busy'?/type|typing|work|keyboard/i:agentActivity==='wrap-up'?/type|write|work|idle|sit/i:agentActivity==='break'?/idle|sit|rest/i:/idle|sit|listen/i;
    deskActors.forEach(actor=>{
      const match=actor.actions.find(item=>pattern.test(item.clip.name)) || actor.actions.find(item=>/idle|sit|rest/i.test(item.clip.name));
      if(!match || match.action===actor.activeAction)return;
      match.action.reset().fadeIn(.22).play();
      actor.actions.forEach(item=>{if(item.action!==match.action)item.action.fadeOut(.22);});
      actor.activeAction=match.action;
    });
  }

  function animate(){
    frameId=requestAnimationFrame(animate);
    const delta=Math.min(clock.getDelta(),.045),elapsed=clock.elapsedTime;
    updateWalkers(delta,elapsed);updatePlayer(delta);
    if(!immersive){
      camera.position.lerp(new THREE.Vector3(
        preview.target.x+Math.sin(preview.azimuth)*Math.cos(preview.elevation)*preview.radius,
        preview.target.y+Math.sin(preview.elevation)*preview.radius,
        preview.target.z+Math.cos(preview.azimuth)*Math.cos(preview.elevation)*preview.radius
      ),.035);
      camera.lookAt(preview.target);
    }
    renderer.render(scene,camera);
  }
  animate();

  return {
    scene,camera,renderer,stations,
    enter,exit,setAgentActivity,
    get agentActivity(){return agentActivity;},
    get immersive(){return immersive;},
    get nearestStation(){return nearestStation;},
    get assetMessage(){return assetMessage;},
    dispose(){cancelAnimationFrame(frameId);resizeObserver?.disconnect();window.removeEventListener('resize',resize);document.body.classList.remove('touch-device','calloria-immersive');renderer.dispose();host.replaceChildren();}
  };
}
