/**
 * Version-checked production transform for CALLORIA's current GLB loaders.
 * Registers Three.js MeshoptDecoder and routes loads through the optimized
 * asset manifest, retaining the committed original GLB as a safe fallback.
 */
const LOADER_TARGET = '/js/glb-asset-loader.js';
const WORLD_TARGET = '/js/glb-world-integration.js';
const GLTF_IMPORT = "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';";
const MESHOPT_IMPORT = "import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';";
const RUNTIME_IMPORT = "import { loadCalloriaGLTFWithOptimizedFallback } from './glb-optimized-asset-runtime.js';";
const LOADER_CONSTRUCTOR = '    this.loader = new GLTFLoader(manager);';
const LOADER_LOAD = '    const task = this.loader.loadAsync(asset.url, (event) => {';
const WORLD_CONSTRUCTOR = '  const loader = new GLTFLoader();';
const WORLD_LOAD = '      const gltf = await loader.loadAsync(asset.url);';
const OLD_EXTENSION_GUARD = "      const extensionsValid = !requiredExtensions.some((extension) => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression'].includes(extension));";
const LOADER_MARKER = '__CALLORIA_OPTIMIZED_GLB_LOADER_V2__';
const WORLD_MARKER = '__CALLORIA_OPTIMIZED_GLB_WORLD_V2__';

function count(source, needle) {
  return source.split(needle).length - 1;
}

function requireExactlyOnce(context, source, anchor, label) {
  const occurrences = count(source, anchor);
  if (occurrences !== 1) {
    context.error(`CALLORIA optimized GLB runtime expected exactly one ${label} anchor (${occurrences} found). Refusing a partial build transform.`);
  }
}

function addImports(source, marker) {
  return source.replace(
    GLTF_IMPORT,
    `${GLTF_IMPORT}\n${MESHOPT_IMPORT}\n${RUNTIME_IMPORT}\nconst ${marker} = true;`
  );
}

export function calloriaOptimizedGLBRuntimePlugin() {
  return {
    name: 'calloria-optimized-glb-runtime-v2',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');

      if (normalizedId.endsWith(LOADER_TARGET)) {
        if (source.includes(LOADER_MARKER)) return null;
        requireExactlyOnce(this, source, GLTF_IMPORT, 'shared loader import');
        requireExactlyOnce(this, source, LOADER_CONSTRUCTOR, 'shared loader constructor');
        requireExactlyOnce(this, source, LOADER_LOAD, 'shared loader load');

        let code = addImports(source, LOADER_MARKER);
        code = code.replace(
          LOADER_CONSTRUCTOR,
          `${LOADER_CONSTRUCTOR}\n    this.loader.setMeshoptDecoder(MeshoptDecoder);`
        );
        code = code.replace(
          LOADER_LOAD,
          '    const task = loadCalloriaGLTFWithOptimizedFallback(this.loader, asset, (event) => {'
        );
        return { code, map: null };
      }

      if (normalizedId.endsWith(WORLD_TARGET)) {
        if (source.includes(WORLD_MARKER)) return null;
        requireExactlyOnce(this, source, GLTF_IMPORT, 'workplace loader import');
        requireExactlyOnce(this, source, WORLD_CONSTRUCTOR, 'workplace loader constructor');
        requireExactlyOnce(this, source, WORLD_LOAD, 'workplace loader load');
        requireExactlyOnce(this, source, OLD_EXTENSION_GUARD, 'Meshopt extension guard');

        let code = addImports(source, WORLD_MARKER);
        code = code.replace(
          WORLD_CONSTRUCTOR,
          `${WORLD_CONSTRUCTOR}\n  loader.setMeshoptDecoder(MeshoptDecoder);`
        );
        code = code.replace(
          WORLD_LOAD,
          '      const gltf = await loadCalloriaGLTFWithOptimizedFallback(loader, asset);'
        );
        code = code.replace(
          OLD_EXTENSION_GUARD,
          "      // Meshopt and WebP are supported by the configured Three.js GLTFLoader. Draco remains unsupported.\n      const extensionsValid = !requiredExtensions.includes('KHR_draco_mesh_compression');"
        );
        return { code, map: null };
      }

      return null;
    }
  };
}
