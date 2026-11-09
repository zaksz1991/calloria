/**
 * CALLORIA first-shift gameplay event bridge.
 *
 * Connects existing recruitment, briefing, shift, inbound-call and wrap-up
 * flows to the in-world tutorial. It does not change business rules or mutate
 * application state directly.
 *
 * GLB telemetry is attached to the actual onAssetsReady callback in main.js.
 * The previous v2.3 implementation looked for furniture-loading internals in
 * main.js, although those internals live in the production-world transform.
 */
const MAIN_TARGET = '/js/main.js';
const MARKER = '__CALLORIA_FIRST_SHIFT_GAMEPLAY_EVENTS_V231__';

const RULES = [
  {
    name: 'employment accepted',
    anchor: "function acceptOffer(){state.stage='employee';state.hired=true;state.shiftActive=false;",
    replacement: "function acceptOffer(){state.stage='employee';state.hired=true;state.shiftActive=false;window.dispatchEvent(new CustomEvent('calloria:game-employment-accepted',{detail:{role:state.roleTitle,department:state.department}}));"
  },
  {
    name: 'shift started',
    anchor: "  pushOperationEvent('shift','SHIFT-'+state.day,'Shift started; inbound routing opened.','active');",
    replacement: "  pushOperationEvent('shift','SHIFT-'+state.day,'Shift started; inbound routing opened.','active');\n  window.dispatchEvent(new CustomEvent('calloria:game-shift-started',{detail:{day:state.day,department:state.department}}));"
  },
  {
    name: 'inbound customer connected',
    anchor: "  pushOperationEvent('call',contact.id,`Inbound contact connected · ${scenario.issue}`,'connected',{customer:scenario.customer,routeGroup:contact.routeGroup,priority:contact.priority,waitSeconds});",
    replacement: "  pushOperationEvent('call',contact.id,`Inbound contact connected · ${scenario.issue}`,'connected',{customer:scenario.customer,routeGroup:contact.routeGroup,priority:contact.priority,waitSeconds});\n  window.dispatchEvent(new CustomEvent('calloria:game-call-connected',{detail:{contactId:contact.id,customer:scenario.customer,issue:scenario.issue,priority:contact.priority}}));"
  },
  {
    name: 'inbound case saved',
    anchor: "    pushOperationEvent('case',wrap.reference,`Inbound case saved · ${status}`,'saved',{disposition,qa:wrap.qa,acwSeconds});",
    replacement: "    pushOperationEvent('case',wrap.reference,`Inbound case saved · ${status}`,'saved',{disposition,qa:wrap.qa,acwSeconds});\n    window.dispatchEvent(new CustomEvent('calloria:game-case-saved',{detail:{reference:wrap.reference,disposition,qa:wrap.qa,breach:Boolean(wrap.breach),resolved:disposition==='resolved'&&!wrap.breach,status}}));"
  },
  {
    name: 'briefing attended',
    anchor: "      pushOperationEvent('briefing',briefing.id,`${briefing.title} attended and acknowledged.`);",
    replacement: "      pushOperationEvent('briefing',briefing.id,`${briefing.title} attended and acknowledged.`);\n      window.dispatchEvent(new CustomEvent('calloria:game-briefing-attended',{detail:{briefingId:briefing.id,slot:briefing.slot,title:briefing.title}}));"
  },
  {
    name: 'workstation operation selected',
    anchor: "  if((view==='inbound'||view==='outbound'||view==='digital')&&!state.shiftActive)startShift();\n  state.currentView=view;\n  saveState();\n  exit3dFloor();",
    replacement: "  if((view==='inbound'||view==='outbound'||view==='digital')&&!state.shiftActive)startShift();\n  state.currentView=view;\n  saveState();\n  window.dispatchEvent(new CustomEvent('calloria:game-operation-selected',{detail:{view,shiftActive:Boolean(state.shiftActive),agentStatus:state.agentStatus}}));\n  exit3dFloor();"
  },
  {
    name: 'station panel opened',
    anchor: "function open3dStationPanel(station){\n  const panel=$('#stationPanel');",
    replacement: "function open3dStationPanel(station){\n  window.dispatchEvent(new CustomEvent('calloria:game-station-panel-opened',{detail:{hired:Boolean(state.hired),stationId:station?.id||null,label:station?.label||''}}));\n  const panel=$('#stationPanel');"
  },
  {
    name: 'GLB asset status callback',
    // This is the real callback in main.js. The previous anchor incorrectly
    // referenced result.furnitureErrors inside main.js; those details belong
    // to the production-world/GLB integration layer instead.
    anchor: "      onAssetsReady:result=>{\n        const label=result.loaded?`${result.loaded} 3D STAFF ASSETS READY`:'OPTIMISED LOCAL STAFF MODELS ACTIVE';\n        const status=$('#assetStatus');if(status)status.textContent=label;\n      },",
    replacement: "      onAssetsReady:result=>{\n        const staffCount=Math.max(0,Number(result?.staffLoaded??result?.loaded??0));\n        const officeCount=Math.max(0,Number(result?.officePlaced??0));\n        const failureCount=(Array.isArray(result?.officeErrors)?result.officeErrors.length:0)+(Array.isArray(result?.rejected)?result.rejected.length:0);\n        const tier=String(result?.tier||'unknown');\n        const status=$('#assetStatus');\n        if(status)status.textContent=`GLB STAFF: ${staffCount} · OFFICE GLB OBJECTS: ${officeCount}`+(failureCount?` · REVIEW: ${failureCount}`:'')+` · ${tier.toUpperCase()}`;\n        window.dispatchEvent(new CustomEvent('calloria:glb-assets-ready',{detail:{staff:staffCount,office:officeCount,failures:failureCount,loading:false,tier}}));\n      },"
  }
];

function count(source, needle) {
  return source.split(needle).length - 1;
}

function transformMain(context, source) {
  if (source.includes(MARKER)) return null;
  let code = `/* ${MARKER} */\n${source}`;
  for (const rule of RULES) {
    const occurrences = count(code, rule.anchor);
    if (occurrences !== 1) {
      context.error(`CALLORIA first-shift gameplay integration expected exactly one ${rule.name} anchor (${occurrences} found). Refusing a partial transform.`);
    }
    code = code.replace(rule.anchor, rule.replacement);
  }
  return { code, map: null };
}

export function calloriaFirstShiftGameplayPlugin() {
  return {
    name: 'calloria-first-shift-gameplay-v2-3-1',
    enforce: 'post',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (normalizedId.endsWith(MAIN_TARGET)) return transformMain(this, source);
      return null;
    }
  };
}

export const __firstShiftPluginTest = Object.freeze({ MAIN_TARGET, MARKER, RULES, transformMain });
