# CALLORIA v6.25 — Mobile GLB Performance Audit

Adds a batch decoder/performance audit to the existing GLB Asset Acceptance Lab. It checks every available staff GLB from the deployed staff manifest plus the four office GLB paths already registered in the lab. It reports file size, unique geometry-buffer bytes, vertex and triangle counts, estimated draw calls, materials, textures, estimated texture memory, skeletons/bones and animation clips.

The audit defaults to a conservative mobile budget and supports balanced/high profiles. Results can be exported as JSON. The scan is sequential and limits each downloaded model to 32 MB to avoid loading the entire asset set into memory at once. It does not change or optimize GLBs, and it does not claim that assets are present in the live game world.
