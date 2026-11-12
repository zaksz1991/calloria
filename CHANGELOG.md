# v6.13 changelog

- Replaced the office GLB runtime with a diagnostic, independently loading asset pipeline.
- Preserved v2.9/v3.8 Vite transform anchors and production-world API.
- Added tier-aware office asset validation policy in a separate testable module.
- Added precise asset and placement diagnostics through `calloria:office-glb-status`.
- Kept primitive fallbacks visible until their real GLB replacements are successfully placed.
- Added duplicate-initialization protection and parallel independent asset loading.
