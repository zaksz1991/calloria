# FLOORSHIFT 3D — Third-party 3D asset register

The following assets are referenced by `js/production-world.js`. At this build they load from their original publishers at runtime; they are not embedded in the project archive.

| Asset | Publisher page | Runtime file | Published licence / details | Use in FLOORSHIFT |
|---|---|---|---|---|
| Businessman rigged | https://grab3d.com/models/characters/businessman/ | https://grab3d.com/dl/businessman-rigged/businessman-rigged.glb | CC0 1.0; rigged character; publisher describes 4K PBR textures and walk/run animation | Contact-centre employee / roaming staff |
| Casual woman rigged | https://grab3d.com/models/characters/woman/ | https://grab3d.com/dl/woman-rigged/woman-rigged.glb | CC0 1.0; rigged character; publisher describes 4K PBR textures and walk/run animation | Contact-centre employee / roaming staff |
| Reception desk | https://www.innerscene.com/tools/library/3d-parts/welcome-160-reception-desk-21c678a3 | https://files.innerscene.com/library/welcome-160-reception-desk-21c678a3/f1eb0f421afd2bd57e25/reception-desk.glb | Publisher listing identifies the model as CC0 | Reception area |

## Deployment requirements

1. Re-check each publisher's current licence statement before commercial release and retain a copy of the licence and source page with the release records.
2. Download the approved GLB files and inspect them in Blender or an equivalent 3D viewer. The project authoring environment could not download the files, so the exact binaries have not been independently inspected here.
3. Store approved copies in a first-party, versioned asset bucket or the project's own static asset hosting. Do not rely on a mutable external download URL for a production deployment.
4. Update `ASSET_URLS` in `js/production-world.js` to the pinned first-party paths.
5. Check mesh scale, skeleton compatibility, texture references, animation names, CORS, compression and browser decode performance.
6. Maintain a manifest with source, licence, file hash, version, dimensions, triangle count and approved use.

## Runtime fallback

When GLTF loading or a third-party request fails, the module uses locally generated detailed character geometry and a locally modelled reception desk. The fallback exists to preserve interaction testing; it is not a substitute for the approved final character models in a commercial release.
