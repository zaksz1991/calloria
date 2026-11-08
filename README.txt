CALLORIA GLB ASSET AUDIT + OPTIMIZATION KIT

Contents:
- tools/glb-audit.mjs: dependency-free GLB container and scene-complexity audit
- tools/glb-optimize.mjs: conservative optimization, preserves originals, rejects unsafe/ineffective outputs
- .github/workflows/calloria-glb-asset-optimization.yml: manual GUI-triggered workflow
- tests/glb-audit-contract.test.mjs: parser contract tests
- GLB-OPTIMIZATION-WORKFLOW.md: installation and GitHub Actions instructions

This is an analysis pipeline only. It does not wire GLB models into the production renderer.
