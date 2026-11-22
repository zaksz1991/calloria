# CALLORIA v7.23 — Digital Follow-up SLA Supervision

## Added

- Supervisor dashboard panel for unanswered second-and-later customer messages across email, live chat and social support.
- Separate counts for overdue follow-ups, due-soon follow-ups, already-open supervisor requests and alerts not yet escalated.
- Prioritised alert rows showing the customer, subject, channel, assigned agent, follow-up sequence and response deadline state.
- Supervisor shortcut to open the relevant digital thread.
- Explicit supervisor-intervention action for an alert that remains valid at click time.
- Duplicate protection: a contact with an existing open supervisor request cannot create another follow-up request.
- Mobile-responsive alert and action layout.

## Controls and boundaries

- First-response SLA remains owned by the existing v7.15 engine.
- v7.21 follow-up response cycles remain the source of follow-up timing.
- v7.23 only surfaces unanswered cycles that are at-risk or overdue.
- Escalation is a deliberate supervisor action, not an automatic side effect of rendering or advancing the clock.
- Before creating a request, the handler rechecks the contact, cycle, current simulated time and existing open requests.
- No live inboxes, social accounts, provider APIs, Supabase tables, external notifications or real customer data are connected.

## Compatibility

- Builds on the current public `main` configuration with `calloriaDigitalExperienceSuitePluginV722()` registered.
- Keeps the v7.22 suite as the preceding transform and registers v7.23 after it.
- No package dependency, database migration, environment variable, secret, GLB file or customer-save schema change is required.
