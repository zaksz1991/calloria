/**
 * Adds approved GLB customers to the existing production-world scene and
 * forwards synthetic Customer Intelligence Lab reactions to those visitors.
 * Does not replace main.js or production-world.js.
 */
const WORLD_TARGET = '/js/production-world.js';
const ENGINE_TARGET = '/js/customer-intelligence-engine.js';
const WORLD_IMPORT = "import { attachCalloriaWorldCustomers } from './customer-world-integration.js';";
const WORLD_READY = "  callbacks.onRenderStatus?.({ state: 'ready', tier, stations: stations.length, staff: staff.length });";
const WORLD_UPDATE = '    updatePlayer(delta);';
const WORLD_DISPOSE = 'scene.traverse((object) => {';
const ENGINE_CREATE = '  const id = `CIL-${Math.abs(Math.floor(Number(seed) || Date.now())).toString(36).toUpperCase()}`;';
const ENGINE_SUBMIT = '  return { result, scenario };';
const WORLD_MARKER = '__CALLORIA_RECEPTION_CUSTOMER_WORLD_V16__';
const ENGINE_MARKER = '__CALLORIA_CUSTOMER_REACTION_BRIDGE_V16__';

function count(source, anchor) {
  return source.split(anchor).length - 1;
}
function requireOnce(context, source, anchor, label) {
  const occurrences = count(source, anchor);
  if (occurrences !== 1) context.error(`CALLORIA customer-world integration expected exactly one ${label} anchor (${occurrences} found). Refusing a partial transform.`);
}

export function calloriaCustomerWorldPlugin() {
  return {
    name: 'calloria-customer-world-integration-v1-6',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');
      const normalizedSource = String(source).replace(/\r\n?/g, '\n');

      if (normalizedId.endsWith(WORLD_TARGET)) {
        if (normalizedSource.includes(WORLD_MARKER)) return null;
        requireOnce(this, normalizedSource, WORLD_READY, 'production-world ready callback');
        requireOnce(this, normalizedSource, WORLD_UPDATE, 'production-world animation update');
        requireOnce(this, normalizedSource, WORLD_DISPOSE, 'production-world disposal');
        let code = `${WORLD_IMPORT}\nconst ${WORLD_MARKER} = true;\n${normalizedSource}`;
        code = code.replace(WORLD_READY, `  let customerWorldLayer = null;\n  let customerWorldDisposed = false;\n  void attachCalloriaWorldCustomers({ scene, tier }).then((layer) => {\n    if (customerWorldDisposed) { layer?.dispose?.(); return; }\n    customerWorldLayer = layer;\n    callbacks.onCustomerWorldReady?.(layer?.status || { loaded: 0, reason: 'Customer layer unavailable', tier });\n    renderStill();\n  }).catch((error) => {\n    console.warn('CALLORIA reception customer GLBs unavailable; the workplace remains operational.', error);\n    callbacks.onCustomerWorldReady?.({ loaded: 0, reason: String(error?.message || error), tier });\n  });\n${WORLD_READY}`);
        code = code.replace(WORLD_UPDATE, `${WORLD_UPDATE}\n    customerWorldLayer?.update?.(delta);`);
        code = code.replace(WORLD_DISPOSE, `      customerWorldDisposed = true;\n      customerWorldLayer?.dispose?.();\n${WORLD_DISPOSE}`);
        return { code, map: null };
      }

      if (normalizedId.endsWith(ENGINE_TARGET)) {
        if (normalizedSource.includes(ENGINE_MARKER)) return null;
        requireOnce(this, normalizedSource, ENGINE_CREATE, 'customer scenario creation');
        requireOnce(this, normalizedSource, ENGINE_SUBMIT, 'customer turn result');
        let code = `const ${ENGINE_MARKER} = true;\n${normalizedSource}`;
        const notify = (detail) => `  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {\n    window.dispatchEvent(new CustomEvent('calloria:customer-reaction', { detail: ${detail} }));\n  }`;
        code = code.replace(ENGINE_CREATE, `${ENGINE_CREATE}\n${notify(`{ scenarioId: id, personaId: persona.id, emotion: persona.emotion, reaction: 'steady', patience: persona.patience, turn: 0, status: 'active' }`)}`);
        code = code.replace(ENGINE_SUBMIT, `${notify(`{ scenarioId: scenario.id, personaId: scenario.persona?.id, emotion: scenario.persona?.emotion, reaction: result.customerReaction, patience: result.customerPatience, turn: scenario.turn, status: scenario.status }`)}\n${ENGINE_SUBMIT}`);
        return { code, map: null };
      }
      return null;
    }
  };
}
