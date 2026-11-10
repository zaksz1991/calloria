# CALLORIA v3.9.0 — CC0 Staff GLB Bundle & Activation

## Purpose

The current scene has a procedural-staff fallback, while the production GLB registry expects staff files at paths that are not present in the repository's confirmed asset inventory. This release closes that asset-delivery gap for **standing staff** by acquiring actual rigged human GLBs at Vercel build time, validating them, and placing them under CALLORIA's existing public asset paths.

This is not a new office-decoration release. It directly addresses the repeated `GLB STAFF: 0` problem.

The selected Gobkit characters are explicitly described in the source manifest as **low-poly**. They are actual rigged and animated GLB characters, but they are stylised rather than photorealistic. This release establishes that the production staff-rendering path can use real bundled GLB files; it does not claim final commercial art quality.

## What it does

- Downloads five individually addressed `.glb` character files from Gobkit's published Free Character Pack Vol.1 and Vol.2.
- Uses the source's published CC0 1.0 licence metadata; the models are identified as rigged, low-poly and supplied with named Idle/Walk/Run clips.
- Validates GLB v2 header and declared length, embedded JSON, skin/skeleton joint count, skinned primitive attributes, non-empty Idle and Walk clips, primitive/triangle limits, external buffer/image references and required compression extensions.
- Writes valid files into the exact five character paths already listed in `js/glb-asset-registry.js`.
- Updates `PRIMARY_CANDIDATES` to include only models which passed the build-time validation. This means the low/balanced/high device tiers use their existing 2/3/4 candidate caps without requesting missing model files first.
- Writes `public/assets/models/calloria-cc0-staff-manifest.json`, recording source, licence, output path, SHA-256, byte size, triangle estimate, joint count, animation names and any failure reason.
- Serves the models from CALLORIA's own deployment. The game browser does not request the model files from Gobkit.
- Preserves any existing local GLB that already passes validation. An invalid local file is refreshed from the pinned CC0 source when available.
- If Gobkit is temporarily unavailable, the build continues with explicit warnings and an `unavailable`/`partial` manifest. It never reports a missing model as loaded.

## Staff asset mapping

| Existing CALLORIA registry ID | Source model | Staff use | Destination |
|---|---|---|---|
| `female-agent` | OfficeLady | Agent / support staff | `characters/agents/female-agent.glb` |
| `male-agent` | Accountant | Agent / support staff | `characters/agents/male-agent.glb` |
| `gp5-woman` | Receptionist | Reception / support staff | `characters/agents/gp5woman.glb` |
| `mr-r` | OfficeManager | Team leader / supervisor | `characters/agents/mr-r.glb` |
| `office-lady-character` | SalesRep | Customer experience staff | `characters/agents/office_lady_character.glb` |

The models are used only where the existing renderer has **standing** staff targets and a compatible idle clip. Seated agent positions are intentionally not replaced with standing-only models. They remain on the existing seated implementation until a correctly seated/typing-rigged asset is separately approved. The player's oversized third-person model is not enabled by this release; v3.8.2's first-person-only behaviour is retained.

## Scope boundaries

- This package supplies staff character GLBs. It does **not** claim that office desks, computers, headsets, reception furniture, chairs or the entire floor have been converted to GLB assets.
- It does not alter recruitment, OJT, product/service knowledge, shadowing, supervised call practice, trainer sign-off, shifts, CRM, customer scenarios or career progression.
- It does not add a banking-only employment gate; CALLORIA remains multi-industry.
- This ZIP contains the downloader/validator and config integration, not the binary model files. Vercel retrieves the binaries during the deployment build. The current execution environment cannot download and visually inspect those binary files, so actual Vercel acquisition and browser rendering remain to be verified.

## Runtime verification

After deployment, inspect:

1. `https://calloria.vercel.app/assets/models/calloria-cc0-staff-manifest.json`
   - `status` should be `complete` or `partial`.
   - `validatedStaffModels` should be greater than zero.
   - Entries should show `downloaded-and-validated` or `validated-existing`.
2. In the 3D environment, inspect the existing asset status panel. `GLB STAFF` must report the number of actual replacements, not the number of downloaded files.
3. Confirm that standing characters are visibly different from the old local procedural mannequins and that their idle animation runs.
4. Confirm seated agents remain properly seated and the player view is first-person, without an oversized player body covering the screen.
5. Inspect the browser network panel: staff files should load from `calloria.vercel.app/assets/models/characters/agents/`, not from Gobkit.

A `complete` build manifest proves binary structure passed the build-time checks; it does not prove the browser renderer accepted every model. The live `GLB STAFF` replacement count and visual inspection are still required.
