# CALLORIA v6.87 verification

Date: 21 November 2026

## Automated regression suite

- Total tests: 48
- Passed: 48
- Failed: 0
- Skipped: 0

Coverage includes:
- v6.81 GLB path recovery
- v6.82 runtime health reporting
- v6.83 diagnostics panel consolidation
- v6.84 non-blocking workplace startup
- v6.85 third-person transform compatibility
- v6.86 RuffNeck catalogue, redaction, scenario scoring, case creation and case updates
- v6.87 tolerant applicant-default anchors and direct System activity heading insertion

## Syntax and archive checks

- RuffNeck service-operations plugin: PASS
- Updated regression test: PASS
- Carried-forward GLB/world plugins: PASS
- ZIP integrity: PASS

## Not run

- Full `npm run build` against the complete CALLORIA repository
- Vercel deployment
- Real desktop/phone browser verification
- Actual GLB download and placed-model verification

The package is verified as a targeted source patch and regression suite, not as a confirmed production deployment.
