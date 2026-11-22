# Changelog — CALLORIA v7.15

## Digital Response Quality Coach

- Added channel-aware live coaching to active digital interactions.
- Added deterministic checks for acknowledgement, ownership, next step, privacy and factual restraint.
- Added a hard send guard for requests for passwords, PINs, OTPs, CVV/security codes, unmasked payment-card numbers and public social requests for personal/account identifiers.
- Added a private-channel exception for social support requests explicitly routed to an official, secure, verified or private message/channel.
- Added non-blocking warnings for missing response-quality dimensions and unsupported outcome promises.
- Added accessible live feedback and responsive reduced-motion-aware styling.
- Added a Vite transform with exact source-anchor validation, no partial injection and idempotency protection.

## Behavioural boundaries

- The coach does not change the native `evaluateDigitalReply()` score.
- It does not modify digital contact records, CRM cases, customer sentiment, shift metrics or saved employee progress.
- It blocks only the listed safety issues. Other coaching criteria are advisory.
- It does not send external messages; the existing CALLORIA simulated reply workflow remains responsible for recording replies.
