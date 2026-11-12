/**
 * CALLORIA v6.20 — restrained PBR glass finish for named/transparent glazing.
 * Only materials within the validated department-glass GLB are passed here.
 */
const GLASS_LABEL = /(?:^|[\s_.-])(glass|glazing|window|pane|glazed)(?:$|[\s_.-])/i;

function materialLabel(material) {
  const data = material?.userData || {};
  return [material?.name, data.name, data.type, data.materialType, data.category]
    .filter((value) => typeof value === 'string')
    .join(' ');
}

function isGlassLike(material) {
  if (!material) return false;
  const opacity = Number(material.opacity);
  return GLASS_LABEL.test(materialLabel(material))
    || Number(material.transmission) > 0.01
    || (material.transparent === true && Number.isFinite(opacity) && opacity < 0.98);
}

export function applyCalloriaGlassMaterialPolicy(root, { doubleSide = 2, maxOpacity = 0.34 } = {}) {
  const seen = new Set();
  let scannedMaterials = 0;
  let glassMaterialsMatched = 0;
  let glassMaterialsFinished = 0;
  if (!root?.traverse) {
    return { scannedMaterials, glassMaterialsMatched, glassMaterialsFinished };
  }

  root.traverse((object) => {
    if (!(object?.isMesh || object?.isSkinnedMesh || object?.isInstancedMesh)) return;
    const entries = Array.isArray(object.material)
      ? object.material
      : object.material ? [object.material] : [];
    for (const material of entries) {
      if (!material || seen.has(material)) continue;
      seen.add(material);
      scannedMaterials += 1;
      if (!isGlassLike(material)) continue;
      glassMaterialsMatched += 1;

      const originalOpacity = Number(material.opacity);
      material.transparent = true;
      material.opacity = Number.isFinite(originalOpacity)
        ? Math.max(0.08, Math.min(originalOpacity, maxOpacity))
        : maxOpacity;
      material.depthWrite = false;
      material.side = doubleSide;
      if (typeof material.roughness === 'number') material.roughness = Math.min(material.roughness, 0.18);
      if (typeof material.metalness === 'number') material.metalness = Math.min(material.metalness, 0.06);
      if (typeof material.transmission === 'number') material.transmission = Math.max(material.transmission, 0.38);
      if (typeof material.ior === 'number') material.ior = 1.45;
      if (typeof material.thickness === 'number') material.thickness = Math.max(material.thickness, 0.02);
      material.needsUpdate = true;
      glassMaterialsFinished += 1;
    }
  });

  return { scannedMaterials, glassMaterialsMatched, glassMaterialsFinished };
}

export const __calloriaGlassMaterialPolicy = Object.freeze({ isGlassLike, materialLabel, GLASS_LABEL });
