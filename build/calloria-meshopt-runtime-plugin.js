/**
 * Adds the Three.js Meshopt decoder to CALLORIA's two GLTFLoader paths.
 * This is a narrow, version-checked build transform: source application files
 * remain untouched, and the build fails rather than silently applying a
 * partial transformation if the expected source anchors have changed.
 */
const LOADER_TARGET = '/js/glb-asset-loader.js';
const WORLD_TARGET = '/js/glb-world-integration.js';
const LOADER_IMPORT = "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';";
const MESHOPT_IMPORT = "import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';";
const LOADER_INSTANCE = '    this.loader = new GLTFLoader(manager);';
const WORLD_INSTANCE = '  const loader = new GLTFLoader();';
const OLD_EXTENSION_GUARD = "      const extensionsValid = !requiredExtensions.some((extension) => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression'].includes(extension));";
const LOADER_MARKER = '__CALLORIA_MESHOPT_LOADER_RUNTIME_V1__';
const WORLD_MARKER = '__CALLORIA_MESHOPT_WORLD_RUNTIME_V1__';

function count(source, needle) {
  return source.split(needle).length - 1;
}

function requireExactlyOnce(context, source, anchor) {
  const occurrences = count(source, anchor);
  if (occurrences !== 1) {
    context.error(`CALLORIA Meshopt runtime expected exactly one source anchor (${occurrences} found): ${anchor}`);
  }
}

export function calloriaMeshoptRuntimePlugin() {
  return {
    name: 'calloria-meshopt-runtime-v1',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');

      if (normalizedId.endsWith(LOADER_TARGET)) {
        if (source.includes(LOADER_MARKER)) return null;
        requireExactlyOnce(this, source, LOADER_IMPORT);
        requireExactlyOnce(this, source, LOADER_INSTANCE);

        let code = source.replace(
          LOADER_IMPORT,
          `${LOADER_IMPORT}\n${MESHOPT_IMPORT}\nconst ${LOADER_MARKER} = true;`
        );
        code = code.replace(
          LOADER_INSTANCE,
          `${LOADER_INSTANCE}\n    this.loader.setMeshoptDecoder(MeshoptDecoder);`
        );
        return { code, map: null };
      }

      if (normalizedId.endsWith(WORLD_TARGET)) {
        if (source.includes(WORLD_MARKER)) return null;
        requireExactlyOnce(this, source, LOADER_IMPORT);
        requireExactlyOnce(this, source, WORLD_INSTANCE);
        requireExactlyOnce(this, source, OLD_EXTENSION_GUARD);

        let code = source.replace(
          LOADER_IMPORT,
          `${LOADER_IMPORT}\n${MESHOPT_IMPORT}\nconst ${WORLD_MARKER} = true;`
        );
        code = code.replace(
          WORLD_INSTANCE,
          `  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);`
        );
        code = code.replace(
          OLD_EXTENSION_GUARD,
          "      // Meshopt is decoded by the registered MeshoptDecoder; Draco still needs DRACOLoader.\n      const extensionsValid = !requiredExtensions.includes('KHR_draco_mesh_compression');"
        );
        return { code, map: null };
      }

      return null;
    }
  };
}
