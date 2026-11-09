import test from 'node:test';
import assert from 'node:assert/strict';
import {
  __workstationExperienceTest as workstation,
  calloriaWorkstationExperiencePlugin
} from '../build/calloria-workstation-experience-plugin.mjs';
import {
  __thirdPersonPlayerPluginTest as thirdPerson,
  calloriaThirdPersonPlayerPlugin
} from '../build/calloria-third-person-player-plugin.mjs';

const mainFixture = `
function exit3dFloor(){ close3dStationPanel();productionWorld?.exit();document.body.classList.remove('calloria-game-playing'); }
function open3dWorkView(view){
  close3dStationPanel();
  document.body.classList.remove('calloria-game-launch','calloria-game-playing');
  if(view==='recruitment'){
    exit3dFloor();state.currentView='overview';renderView();document.querySelector('.content-wrap')?.scrollIntoView({behavior:'smooth',block:'start'});return;
  }
  if(!state.hired){toast('Complete recruitment and accept an employment offer before handling customer interactions.','warning');return;}
  if((view==='inbound'||view==='outbound'||view==='digital')&&!state.shiftActive)startShift();
  state.currentView=view;
  saveState();
  ${workstation.OPERATION_EVENT}
  exit3dFloor();
  renderView();
  document.querySelector('.content-wrap')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function handleAction(action,event={}){
 switch(action){
    ${workstation.RETURN_ACTION}
 }
}
`;

const avatarFixture = `
const CLIP_PATTERNS = Object.freeze({
  idle: /idle|stand|standing|rest|breath|listen/i,
  walk: /walk|walking|locomotion|move/i,
  run: /run|running|sprint/i
});
  const runClip = findClip(clips, CLIP_PATTERNS.run);
    update({ x = 0, z = 0, yaw = 0, moving = false, sprinting = false, delta = 0 } = {}) {
  if (!visible) return;
  if (mixer) {
        const desired = moving ? (sprinting && runClip ? runClip : walkClip || runClip || idleClip) : (idleClip || (walkClip ? null : clips[0]));
    if (desired) setClip(desired);
  }
}
const status = {
    hasRun: Boolean(runClip),
};
`;

const worldFixture = `
${thirdPerson.READY}
    updatePlayer(delta);
${thirdPerson.DISPOSE}
${thirdPerson.IMMERSIVE}
`;

test('main operations stay inside live 3D workplace', () => {
  const result = workstation.transformMain({ error(message) { throw new Error(message); } }, mainFixture).code;
  assert.match(result, /calloria-game-operation/);
  assert.match(result, /renderView\(\);/);
  assert.doesNotMatch(result, /calloria:game-operation-selected[\s\S]*?exit3dFloor\(\);[\s\S]*?renderView\(\);/);
  assert.match(result, /calloria:workstation-resumed/);
  assert.match(result, /calloria-game-operation','calloria-game-launch/);
});

test('recruitment route retains full-page flow', () => {
  const result = workstation.transformMain({ error(message) { throw new Error(message); } }, mainFixture).code;
  const recruitment = result.slice(result.indexOf("if(view==='recruitment')"), result.indexOf("if(!state.hired)"));
  assert.match(recruitment, /exit3dFloor\(\)/);
  assert.doesNotMatch(recruitment, /calloria-game-operation/);
});

test('player avatar exposes real work/talk animation clips only when embedded', () => {
  const result = workstation.transformAvatar({ error(message) { throw new Error(message); } }, avatarFixture).code;
  assert.match(result, /work: \/sit\|sitting\|seated\|typing/);
  assert.match(result, /talk: \/talk\|talking\|speak/);
  assert.match(result, /activity = 'idle'/);
  assert.match(result, /hasWork: Boolean\(workClip\)/);
  assert.match(result, /hasTalk: Boolean\(talkClip\)/);
});

test('workstation overlay exposes app controls on desktop and mobile', () => {
  assert.match(workstation.WORKSTATION_CSS, /content-wrap \{[\s\S]*display:flex!important/);
  assert.match(workstation.WORKSTATION_CSS, /@media \(max-width:760px\)/);
  assert.match(workstation.WORKSTATION_CSS, /touch-controls \{ display:none!important/);
  const plugin = calloriaWorkstationExperiencePlugin();
  const transformed = plugin.transformIndexHtml('<html><head></head><body></body></html>');
  assert.match(transformed, /CALLORIA_IN_WORLD_WORKSTATION_CSS_V25/);
});

test('third-person frame loop pauses walking while the operations console is open', () => {
  const result = thirdPerson.transformWorld({ error(message) { throw new Error(message); } }, worldFixture).code;
  assert.match(result, /calloriaWorkstationBusy/);
  assert.match(result, /calloria:game-call-connected/);
  assert.match(result, /calloria:game-case-saved/);
  assert.match(result, /calloria:workstation-resumed/);
  assert.match(result, /if \(operationMode\) calloriaClearMovement\(\);\s*else updatePlayer\(delta\);/);
  assert.match(result, /activity: operationMode \? calloriaPlayerActivity/);
  assert.match(result, /removeEventListener\('calloria:game-operation-selected'/);
});

test('duplicate transformations are ignored safely', () => {
  const once = workstation.transformMain({ error(message) { throw new Error(message); } }, mainFixture).code;
  assert.equal(workstation.transformMain({ error(message) { throw new Error(message); } }, once), null);
  const worldOnce = thirdPerson.transformWorld({ error(message) { throw new Error(message); } }, worldFixture).code;
  assert.equal(thirdPerson.transformWorld({ error(message) { throw new Error(message); } }, worldOnce), null);
});

test('Vite plugin registrations are available for the current source tree', () => {
  assert.equal(typeof calloriaThirdPersonPlayerPlugin, 'function');
  assert.equal(typeof calloriaWorkstationExperiencePlugin, 'function');
  assert.match(thirdPerson.TARGET, /production-world\.js/);
});
