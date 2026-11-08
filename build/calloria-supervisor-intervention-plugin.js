const WORLD_TARGET = '/js/production-world.js';
const READY_ANCHOR = 'let customerWorldLayer = null;';
const UPDATE_ANCHOR = 'customerWorldLayer?.update?.(delta);';
const DISPOSE_ANCHOR = 'customerWorldLayer?.dispose?.();';
const MARKER = '__CALLORIA_SUPERVISOR_INTERVENTION_V19__';
const IMPORT_LINE = "import { attachCalloriaSupervisorIntervention } from './supervisor-intervention.js';";

function occurrences(source, anchor) {
  return source.split(anchor).length - 1;
}
function requireOnce(context, source, anchor, label) {
  const count = occurrences(source, anchor);
  if (count !== 1) context.error(`CALLORIA supervisor intervention expected exactly one ${label} anchor (${count} found). Refusing a partial transform.`);
}

export function calloriaSupervisorInterventionPlugin() {
  return {
    name: 'calloria-supervisor-intervention-v1-9',
    enforce: 'post',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (!normalizedId.endsWith(WORLD_TARGET)) return null;
      const normalizedSource = String(source).replace(/\r\n?/g, '\n');
      if (normalizedSource.includes(MARKER)) return null;
      if (!normalizedSource.includes('__CALLORIA_RECEPTION_CUSTOMER_WORLD_V16__')) {
        this.error('CALLORIA supervisor intervention requires the existing customer-world integration plugin to run first.');
      }
      requireOnce(this, normalizedSource, READY_ANCHOR, 'customer-world initialisation');
      requireOnce(this, normalizedSource, UPDATE_ANCHOR, 'customer-world update');
      requireOnce(this, normalizedSource, DISPOSE_ANCHOR, 'customer-world disposal');

      let code = `${IMPORT_LINE}\nconst ${MARKER} = true;\n${normalizedSource}`;
      code = code.replace(READY_ANCHOR, `${READY_ANCHOR}\n  let supervisorInterventionLayer = null;\n  let supervisorInterventionDisposed = false;\n  void attachCalloriaSupervisorIntervention({ scene, tier }).then((layer) => {\n    if (supervisorInterventionDisposed) { layer?.dispose?.(); return; }\n    supervisorInterventionLayer = layer;\n    callbacks.onSupervisorInterventionReady?.(layer?.status || { available: false, reason: 'Supervisor layer unavailable', tier });\n    renderStill();\n  }).catch((error) => {\n    console.warn('CALLORIA supervisor GLB unavailable; customer service remains operational.', error);\n    callbacks.onSupervisorInterventionReady?.({ available: false, reason: String(error?.message || error), tier });\n  });`);
      code = code.replace(UPDATE_ANCHOR, `${UPDATE_ANCHOR}\n    supervisorInterventionLayer?.update?.(delta);`);
      code = code.replace(DISPOSE_ANCHOR, `${DISPOSE_ANCHOR}\n      supervisorInterventionDisposed = true;\n      supervisorInterventionLayer?.dispose?.();`);
      return { code, map: null };
    }
  };
}
