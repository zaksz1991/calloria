# v6.22 verification

- 37 regression tests passed, 0 failed. This includes the available v6.13–v6.15 office/staff regression suite and six v6.22 bounds tests.
- `node --check` passed for the replacement build plugin.
- ZIP archive integrity checked after packaging.
- The test suite uses generated GLB fixtures; the live Gobkit model files were not downloaded or visually inspected in this environment.
- A full current-repository Vite production build, Vercel deployment and in-browser GLB rendering were not performed.
