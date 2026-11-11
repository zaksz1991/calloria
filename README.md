# CALLORIA v5.5 — Omnichannel Agent Workbench

An additive public-page module that brings the synthetic contact queue, customer 360, case records and published knowledge into one frontline workflow.

## What is included

- Inbound work queue for Voice, Email, Live chat, Social, SMS and In-app.
- Agent shift start/end and Available, Break and Offline presence controls.
- One active contact per agent, priority-sorted queue, channel filters and text search.
- Contact transcript, simulated agent replies with deterministic scripted customer follow-up turns, private internal notes and specialist transfer.
- Per-contact handling cues to guide investigation, safe verification and expectation setting.
- Customer 360 profile, contact permissions, and that customer's open cases.
- Search of published, unexpired v5.2 knowledge articles, limited to relevant product plus general guidance.
- Awareness strip for published v5.2 notices and active v5.3 incidents.
- Mandatory contact disposition and outcome summary.
- Wrap-up can create a new v5.4 case, append an interaction to an existing open case, or record a customer note where no case is required.
- Selected knowledge references are linked to the case when a case is attached.
- Agent contact history and CSV export.
- Responsive layout for desktop and mobile.

## Installation

This is an overlay patch, not a full CALLORIA repository export. It expects the v5.4 Customer 360 & Case Management module to already exist in the deployment.

Copy these four files from this package's `public/` folder into the repository's existing `public/` folder:

- `agent-workbench.html`
- `agent-workbench.css`
- `agent-workbench.js`
- `agent-workbench-engine.js`

Do not overwrite or remove the existing `customer-journey-engine.js`, knowledge, reliability, OJT, game, or Vite files.

After the copy is committed and deployed, the page route is:

`https://calloria.vercel.app/agent-workbench.html`

## Basic use

1. Open the page and set the agent name and team.
2. Start the shift. Presence becomes Available.
3. Select a queued contact and accept it.
4. Review the customer profile and any existing cases.
5. Search only approved, unexpired knowledge. Select **Use in case** to attach an article reference to the active interaction.
6. Send simulated channel responses, add internal notes, or transfer the contact to a specialist team.
7. Wrap up with a disposition and an outcome summary. Link an existing customer case, create a new case, or select note-only when a case is not required.
8. End the shift after all active contacts are completed or transferred.

## Data and integration behaviour

The workbench stores its local queue, transcript and shift metrics under `calloria.agent-workbench.v55` in browser local storage.

Wrap-up uses the existing v5.4 Customer Journey engine and storage key `calloria.customer-journey.v54`. When the agent completes a contact, the workbench writes a case interaction and customer note to that customer's v5.4 record. A case is created only when the agent selects that action. Article references are attached to the selected case. A failed customer-record save prevents the agent contact from being marked complete.

The knowledge and incident panels read v5.2 and v5.3 browser-local registers. They do not publish knowledge or alter incident records.

## Important limits

- The queue contains synthetic demonstration contacts. It does not receive actual customer calls, email, social messages, SMS or app contacts.
- Voice is a text/transcript simulation. There is no audio, SIP, dialler, carrier or telephony connection.
- Agent shift presence and metrics are local to one browser. There is no shared agent account, central CRM service, live multi-agent queue or server-side audit ledger.
- Customer and case integration works only when v5.4 uses the same browser origin and its engine file is present.
- Incident and knowledge awareness reads browser-local v5.3/v5.2 data. It does not guarantee the latest production incident or article state.
- The module does not use Groq or any external AI service.

Do not use local demonstration records to store real confidential customer, authentication, payment or health information.
