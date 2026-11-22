# Changelog — CALLORIA v7.14

## Simulated Callback Clock Integrity

### Fixed
- Removed artificial callback worklist timestamp backdating during outbound callback resume.
- Removed the arbitrary `Date.now() + 60 seconds` worklist due timestamp from callback promise creation and retry scheduling.
- Prevented campaign worklist eligibility from rejecting a callback already validated against the simulated shift clock.
- Prevented the campaign callback completion validator from comparing a simulated commitment deadline against the real system clock.
- Preserved callback attempt outcomes: contact reached, no-answer, busy, voicemail, cancellation before contact, interruption after connection and return to queue.

### Preserved
- Outbound suppression checks.
- Active-shift and available-agent requirements.
- Maximum-attempt protections for ordinary campaign retries.
- Campaign worklist status validation.
- Customer promise due date and commitment engine classification.
- Existing local save schema and synthetic gameplay model.

### Compatibility
- Runs after the existing Vite source transforms.
- Supports a source already transformed by the earlier v7.13 callback-attempt plugin without applying its lifecycle replacements twice.
- Uses strict source anchors. A changed source shape fails the build with the exact unmatched anchor name rather than silently applying a partial repair.
