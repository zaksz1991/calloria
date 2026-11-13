# CALLORIA v6.44 — Conversation-aware after-contact work

## What changes

- Adds a visible conversation record to inbound after-contact work.
- Shows recorded agent/customer turn counts, customer tone, average dialogue score and communication markers.
- Adds a collapsible, privacy-scrubbed transcript preview (latest eight turns).
- Adds **Build case-note draft from conversation**. It creates editable notes from the latest customer and agent statements; it does not save automatically.
- Saves privacy-scrubbed dialogue text, a concise conversation summary and dialogue quality metrics to the inbound CRM case.
- Redacts PIN/password/OTP-style values, long numeric strings and email addresses from transcript copies.
- Leaves outbound wrap-up and existing case-save/disposition logic unchanged.

## Dependency and order

Requires v6.42 and v6.43. Vite plugin order is v6.42 voice/CRM bridge → v6.43 live customer dialogue → v6.44 conversation-aware wrap-up.

## Boundaries

Customer responses remain scripted by v6.43. This upgrade does not add an AI service, live telephony, external network calls, new database tables or Supabase migrations.
