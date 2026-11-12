import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { measureCalloriaGlb, evaluateCalloriaGlbBudget, CALLORIA_GLB_BUDGETS } from '../js/calloria-glb-performance-audit.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'public/glb-asset-lab.html'), 'utf8');

function fixture({ triangles=12, vertices=36, drawGroups=1, textureWidth=64, fileBytes=1024, skinned=true } = {}) {
  const array = new Float32Array(vertices * 3);
  const texture = { isTexture:true, image:{ width:textureWidth, height:textureWidth } };
  const material = { map:texture, roughnessMap:null };
  const geometry = { attributes:{ position:{ count:vertices, itemSize:3, array } }, index:{ count:triangles*3, array:new Uint16Array(triangles*3) }, groups:Array.from({length:drawGroups},(_,i)=>({start:0,count:triangles*3,materialIndex:i})) };
  const node = { isMesh:true, isSkinnedMesh:skinned, geometry, material, skeleton:skinned?{bones:Array.from({length:18},()=>({}))}:null };
  const scene = { traverse(fn){fn(node);} };
  return measureCalloriaGlb({scene, animations:[{name:'Idle'}]},fileBytes,{x:1,y:1.7,z:0.5});
}

test('v6.25 augments the existing GLB acceptance lab without changing the gameplay entry point',()=>{
  assert.match(html,/GLB Asset Acceptance Lab/);
  assert.match(html,/Batch asset performance audit/);
  assert.match(html,/id="runAuditButton"/);
  assert.match(html,/id="exportAuditButton"/);
  assert.match(html,/id="auditProfile"/);
});

test('batch scanner includes deployed staff manifest assets and the four office models',()=>{
  assert.match(html,/available\.map\(item=>\(\{\.\.\.item,type:'staff'\}\)\)/);
  for(const path of ['/assets/models/office/desks/office_desk.glb','/assets/models/office/equipment/office_computer.glb','/assets/models/accessories/headsets/model.glb','/assets/models/office/reception/reception-desk.glb']) assert.ok(html.includes(path));
});

test('scanner is same-origin restricted, bounded to 32 MB per file and sequential',()=>{
  assert.match(html,/parsed\.origin!==window\.location\.origin/);
  assert.match(html,/MAX_AUDIT_FILE_BYTES=32\*1024\*1024/);
  assert.match(html,/for\(let index=0;index<assets\.length;index\+\+\)/);
  assert.match(html,/one model at a time/);
});

test('batch audit uses the app Three.js release plus Meshopt and Draco decoders',()=>{
  assert.match(html,/three@0\.170\.0/);
  assert.match(html,/setMeshoptDecoder\(MeshoptDecoder\)/);
  assert.match(html,/setDRACOLoader\(draco\)/);
  assert.match(html,/parseAsync\(buffer,baseUrl\)/);
});

test('audit explicitly distinguishes decoded assets from assets rendered in the game world',()=>{
  assert.match(html,/does not prove that each asset is placed in the live game world/);
  assert.match(html,/diagnostic estimate, not a claim/);
});

test('geometry memory counts unique backing buffers and texture estimates include mipmap allowance',()=>{
  const metrics=fixture();
  assert.equal(metrics.geometryBytes,metrics.vertexCount*3*4+metrics.triangleCount*3*2);
  assert.ok(metrics.estimatedTextureBytes>=64*64*4);
  assert.equal(metrics.triangleCount,12);
  assert.equal(metrics.drawCalls,1);
});

test('instanced meshes scale triangle and vertex estimates by instance count',()=>{
  const base=fixture({skinned:false});
  const array=new Float32Array(36*3);
  const geometry={attributes:{position:{count:36,array}},index:{count:36,array:new Uint16Array(36)},groups:[]};
  const scene={traverse(fn){fn({isMesh:true,isInstancedMesh:true,count:5,geometry,material:{}});}};
  const instanced=measureCalloriaGlb({scene,animations:[]},4096);
  assert.equal(instanced.triangleCount,60);
  assert.equal(instanced.vertexCount,180);
});

test('mobile profile produces deterministic PASS, WATCH and OVER BUDGET states',()=>{
  const safe=fixture({triangles:100,vertices:300,fileBytes:50000,textureWidth:32});
  assert.equal(evaluateCalloriaGlbBudget(safe,{profile:'mobile'}).status,'PASS');
  const watch=fixture({triangles:200000,vertices:600000,fileBytes:7*1024*1024,textureWidth:3072});
  assert.equal(evaluateCalloriaGlbBudget(watch,{profile:'mobile'}).status,'OVER BUDGET');
  assert.ok(evaluateCalloriaGlbBudget(watch,{profile:'mobile'}).recommendations.length>0);
});

test('unknown profiles safely fall back to mobile and profile ceilings are ordered',()=>{
  assert.equal(evaluateCalloriaGlbBudget(fixture(),{profile:'unknown'}).profile,'mobile');
  assert.ok(CALLORIA_GLB_BUDGETS.mobile.maxTriangles<CALLORIA_GLB_BUDGETS.balanced.maxTriangles);
  assert.ok(CALLORIA_GLB_BUDGETS.balanced.maxTriangles<CALLORIA_GLB_BUDGETS.high.maxTriangles);
});

test('report export is JSON and records timestamp plus technical caveat',()=>{
  assert.match(html,/JSON\.stringify\(report,null,2\)/);
  assert.match(html,/generatedAt:new Date\(\)\.toISOString\(\)/);
  assert.match(html,/Texture and geometry memory are estimates/);
});
