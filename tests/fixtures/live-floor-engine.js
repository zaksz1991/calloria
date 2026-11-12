(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CalloriaLiveFloorEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '6.0.0';
  const STORAGE_KEY = 'calloria.live-floor.v60';
  const AGENT_STORAGE_KEY = 'calloria.live-floor.agent-workbench.v55';
  const START_MINUTES = 7 * 60 + 30;
  const END_MINUTES = 16 * 60;
  const EVENTS = [
    { id: 'morningBriefing', title: 'Morning product & service briefing', due: START_MINUTES, duration: 15, type: 'briefing', time: '07:30', description: 'Service updates, customer-impact notices, safe verification and today’s customer-care priorities.' },
    { id: 'morningBreak', title: 'Morning break', due: 10 * 60 + 30, duration: 15, type: 'break', time: '10:30', description: 'Take the scheduled break. Return to the floor when the break timer completes.' },
    { id: 'lunchBreak', title: 'Lunch break', due: 12 * 60 + 30, duration: 30, type: 'break', time: '12:30', description: 'Take the scheduled lunch period before resuming customer contacts.' },
    { id: 'afternoonBriefing', title: 'Afternoon product & service briefing', due: 14 * 60, duration: 15, type: 'briefing', time: '14:00', description: 'Afternoon updates, open service issues, handovers and customer commitments.' }
  ];

  function clean(value, max = 1000) {
    return String(value == null ? '' : value).replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
  function localDate(value) {
    const d = value instanceof Date ? value : new Date(value == null ? Date.now() : value);
    if (Number.isNaN(d.getTime())) throw new Error('Enter a valid simulation date.');
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function clockLabel(minutes) {
    const value = clamp(minutes, 0, 24 * 60 - 1);
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  }
  function virtualDate(game, realDate) {
    const d = realDate instanceof Date ? new Date(realDate) : new Date(realDate || Date.now());
    const [year, month, day] = game.shift.date.split('-').map(Number);
    d.setFullYear(year, month - 1, day);
    d.setHours(Math.floor(game.shift.minutes / 60), game.shift.minutes % 60, 0, 0);
    return d;
  }

  const SCENARIOS = {
    'CT-55001': {
      focus: 'RuffNeck LMS · Course enrolment',
      stages: [
        { key: 'acknowledge', title: 'Understand the customer', prompt: 'The customer says a course they selected is missing from their learning area.', minutes: 8, options: [
          { id: 'best', label: 'Acknowledge the disruption and confirm the missing course.', text: 'I understand why that is concerning. Let me confirm which course is missing and when you completed the enrolment.', score: 100, qa: 100, note: 'You acknowledged the impact and established the exact issue.' },
          { id: 'neutral', label: 'Ask the customer to repeat the issue.', text: 'I can look into this. Please explain which part of the enrolment is not working.', score: 72, qa: 78, note: 'The question is relevant, but you could have acknowledged the impact first.' },
          { id: 'poor', label: 'Tell the customer to try again later.', text: 'Please try again later. It may appear by itself.', score: 20, qa: 15, note: 'You dismissed the concern and offered no investigation.' }
        ] },
        { key: 'investigate', title: 'Investigate accurately', prompt: 'Establish the enrolment evidence before deciding what happened.', minutes: 10, options: [
          { id: 'best', label: 'Check the course name, enrolment time and confirmation reference.', text: 'Please confirm the course title and approximate enrolment time. I will check the enrolment status against the confirmation.', score: 100, qa: 100, note: 'Focused questions and evidence-based investigation.' },
          { id: 'neutral', label: 'Ask the customer to sign out and back in first.', text: 'Please sign out and back in once, then tell me whether the course appears. I will keep the enrolment issue open while we check.', score: 70, qa: 78, note: 'A reasonable first check, but it does not verify the enrolment record.' },
          { id: 'poor', label: 'Assume the customer did not complete enrolment.', text: 'It sounds like the enrolment was not completed. You should select the course again.', score: 18, qa: 20, note: 'You assumed the cause without checking the confirmation.' }
        ] },
        { key: 'resolve', title: 'Choose a safe resolution', prompt: 'The customer has a confirmation email, but the course is still missing.', minutes: 12, options: [
          { id: 'best', label: 'Record the evidence and route the enrolment mismatch for investigation.', text: 'The confirmation is useful evidence. I will record the course and reference, raise the enrolment mismatch for investigation and confirm the next update point.', score: 100, qa: 100, note: 'You preserved evidence and set a clear follow-up.' },
          { id: 'neutral', label: 'Guide one refresh and explain the next step if it remains missing.', text: 'Please refresh the learning area once. If it remains missing, I will keep the case with the support team and send you the reference.', score: 82, qa: 86, note: 'A reasonable check with a clear fallback.' },
          { id: 'poor', label: 'Promise that the course will appear within an hour.', text: 'It will definitely appear within an hour. There is no need to follow up.', score: 15, qa: 10, note: 'You made an unsupported promise and removed the follow-up route.' }
        ] }
      ]
    },
    'CT-55002': {
      focus: 'Kano Run · Account access',
      stages: [
        { key: 'acknowledge', title: 'Understand the customer', prompt: 'The player is locked out and worried about losing game progress.', minutes: 8, options: [
          { id: 'best', label: 'Acknowledge the impact and reassure without promising recovery.', text: 'I understand how important your account progress is. I will help check the access issue and explain the safe recovery steps.', score: 100, qa: 100, note: 'You acknowledged the impact without guaranteeing an outcome.' },
          { id: 'neutral', label: 'Ask when the sign-in problem began.', text: 'When did the sign-in problem first begin, and what message appears?', score: 78, qa: 82, note: 'Useful diagnostic detail, but acknowledge the concern first.' },
          { id: 'poor', label: 'Tell the player to create another account.', text: 'Just create a new account and start again.', score: 10, qa: 10, note: 'You ignored the risk of losing the existing account and its progress.' }
        ] },
        { key: 'investigate', title: 'Protect account security', prompt: 'Verify the issue without exposing credentials or account security.', minutes: 10, options: [
          { id: 'best', label: 'Ask for the exact error and use the approved account verification route.', text: 'Please describe the exact sign-in message. We will use the approved account verification route; never send me your password or one-time code.', score: 100, qa: 100, note: 'Correct security practice and focused diagnosis.' },
          { id: 'neutral', label: 'Ask the player to retry once and report the error.', text: 'Please retry once and tell me the exact message shown. Do not share any password or code.', score: 80, qa: 85, note: 'Safe, but a more complete verification route is needed.' },
          { id: 'unsafe', label: 'Ask the player to send their password or one-time code.', text: 'Send me your password and one-time code so I can sign in for you.', score: 0, qa: 0, complianceBreach: true, note: 'Critical security failure. Staff must never request passwords or one-time codes.' }
        ] },
        { key: 'resolve', title: 'Choose a safe resolution', prompt: 'The player can confirm the account email but refuses to share credentials.', minutes: 12, options: [
          { id: 'best', label: 'Guide the approved recovery process and escalate if the account remains locked.', text: 'That is the correct approach. Use the official recovery route and keep your credentials private. I will record the access symptoms and route unresolved lockout for a specialist check.', score: 100, qa: 100, note: 'You protected the account and provided a controlled escalation path.' },
          { id: 'neutral', label: 'Send the official sign-in help route and ask for the resulting error.', text: 'Please follow the official sign-in help route and tell us the exact result if access is still blocked.', score: 82, qa: 87, note: 'Safe guidance, though a case handover would improve continuity.' },
          { id: 'poor', label: 'Guarantee the account will be restored immediately.', text: 'Your account will be restored immediately. There is nothing else to do.', score: 12, qa: 10, note: 'Unsupported guarantee and no recovery evidence.' }
        ] }
      ]
    },
    'CT-55003': {
      focus: 'RuffNeck Social Hub · Campaign scheduling',
      stages: [
        { key: 'acknowledge', title: 'Understand the request', prompt: 'The customer wants scheduling guidance and does not want a campaign to publish immediately.', minutes: 8, options: [
          { id: 'best', label: 'Confirm the desired outcome: save as draft, review, then schedule.', text: 'I can walk you through that. You want the campaign saved as a draft first, reviewed, and scheduled only after approval. Is that correct?', score: 100, qa: 100, note: 'You confirmed the customer’s intended workflow.' },
          { id: 'neutral', label: 'Ask which campaign they are preparing.', text: 'Which campaign are you preparing, and what date do you want it considered for?', score: 75, qa: 82, note: 'Useful context, but confirm the no-immediate-publish requirement.' },
          { id: 'poor', label: 'Tell the customer to click Publish.', text: 'Just click Publish when you are ready.', score: 10, qa: 10, note: 'You ignored the customer’s explicit instruction not to publish immediately.' }
        ] },
        { key: 'investigate', title: 'Clarify the workflow', prompt: 'Check whether the customer needs draft, review or scheduling guidance.', minutes: 10, options: [
          { id: 'best', label: 'Establish the current campaign status and review role.', text: 'Is the campaign currently a draft, and does another team member need to review it before a date is scheduled?', score: 100, qa: 100, note: 'You identified the current state and approval dependency.' },
          { id: 'neutral', label: 'Explain the general workflow without checking the current state.', text: 'The usual sequence is prepare the content, review it and confirm the schedule.', score: 78, qa: 82, note: 'Useful overview, but the customer’s current screen remains unknown.' },
          { id: 'poor', label: 'Assume scheduling is already enabled for the customer.', text: 'Your account definitely has automatic scheduling enabled.', score: 12, qa: 15, note: 'You stated an unverified account capability.' }
        ] },
        { key: 'resolve', title: 'Provide controlled guidance', prompt: 'Give guidance without claiming an unverified publish or scheduling event.', minutes: 12, options: [
          { id: 'best', label: 'Keep the content in draft, complete review and confirm the scheduled time.', text: 'Keep the content as a draft, complete the review and verify the chosen date and time before confirming any schedule. Do not use Publish for this request.', score: 100, qa: 100, note: 'Clear steps that protect the customer’s intended outcome.' },
          { id: 'neutral', label: 'Direct the customer to the campaign status and help guidance.', text: 'Check the campaign status first and use the approved scheduling guidance before making changes.', score: 80, qa: 85, note: 'Safe, but not as actionable as step-by-step guidance.' },
          { id: 'poor', label: 'Promise that the campaign cannot publish early.', text: 'It cannot publish early, so you can confirm any option.', score: 10, qa: 10, note: 'Unverified assurance that could cause an unintended publication.' }
        ] }
      ]
    },
    'CT-55004': {
      focus: 'RuffNeck Prospector · Saved workspace',
      stages: [
        { key: 'acknowledge', title: 'Understand the issue', prompt: 'The customer says a saved workspace is showing incomplete results.', minutes: 8, options: [
          { id: 'best', label: 'Acknowledge the missing records and confirm the saved view.', text: 'I understand the missing records are affecting your work. Let us confirm the saved workspace and the records you expected to see.', score: 100, qa: 100, note: 'You acknowledged the impact and focused on the affected view.' },
          { id: 'neutral', label: 'Ask the customer to refresh the page.', text: 'Please refresh the page and check the workspace again.', score: 68, qa: 74, note: 'A basic check, but it skips understanding the missing results.' },
          { id: 'poor', label: 'Blame the customer’s filters.', text: 'You probably set the filters incorrectly.', score: 8, qa: 10, note: 'You blamed the customer without investigating.' }
        ] },
        { key: 'investigate', title: 'Check the relevant details', prompt: 'The customer already checked filters and date range.', minutes: 10, options: [
          { id: 'best', label: 'Capture workspace name, filters, date range and missing record examples.', text: 'Please share the saved workspace name, current filters, date range and one example of a missing record so the team can reproduce the issue.', score: 100, qa: 100, note: 'You gathered reproducible information for investigation.' },
          { id: 'neutral', label: 'Ask the customer to clear all filters.', text: 'Please clear all filters and see whether the records return.', score: 75, qa: 80, note: 'Potentially useful, but it may change the customer’s saved view.' },
          { id: 'poor', label: 'Tell the customer the missing records were deleted.', text: 'Those records have probably been deleted.', score: 8, qa: 10, note: 'You made an unsupported claim about record deletion.' }
        ] },
        { key: 'resolve', title: 'Choose the next step', prompt: 'The filters and date range are correct; records are still missing.', minutes: 12, options: [
          { id: 'best', label: 'Create a technical case with reproduction details and set an update expectation.', text: 'I will record the workspace details and examples for the technical team to investigate. You will receive the case reference and next update expectation.', score: 100, qa: 100, note: 'Appropriate escalation with complete evidence and a customer update.' },
          { id: 'neutral', label: 'Ask the customer to capture a screenshot and keep the case open.', text: 'Please capture the affected view and keep the case open while the team checks it.', score: 82, qa: 85, note: 'Reasonable evidence capture, but ownership and update timing need clarity.' },
          { id: 'poor', label: 'Close the interaction because the filters were checked.', text: 'Since you checked the filters, there is nothing else we can do.', score: 5, qa: 5, note: 'You abandoned an unresolved technical issue.' }
        ] }
      ]
    },
    'CT-55005': {
      focus: 'Kano Keke · Gameplay feedback',
      stages: [
        { key: 'acknowledge', title: 'Receive the feedback', prompt: 'The player enjoyed the game but found one stage confusing.', minutes: 8, options: [
          { id: 'best', label: 'Thank the player and invite specific feedback.', text: 'Thank you for taking the time to explain this. I will record the stage and what made the instruction unclear.', score: 100, qa: 100, note: 'You acknowledged positive feedback and captured the improvement request.' },
          { id: 'neutral', label: 'Ask which stage they mean.', text: 'Which stage did you find confusing?', score: 78, qa: 82, note: 'A relevant question; acknowledging the feedback would improve the interaction.' },
          { id: 'poor', label: 'Tell the player to practise more.', text: 'You probably need more practice on that stage.', score: 8, qa: 8, note: 'You dismissed useful product feedback.' }
        ] },
        { key: 'investigate', title: 'Capture actionable detail', prompt: 'Find the exact stage and what the instructions failed to explain.', minutes: 10, options: [
          { id: 'best', label: 'Ask for the stage, objective and point where the instructions became unclear.', text: 'Please confirm the stage number, the objective you were trying to complete and the point where the instruction stopped being clear.', score: 100, qa: 100, note: 'You captured actionable product feedback.' },
          { id: 'neutral', label: 'Ask for a general description.', text: 'Can you describe what felt confusing?', score: 75, qa: 80, note: 'Useful, but more specific details are needed.' },
          { id: 'poor', label: 'Promise that the next update will change the stage.', text: 'We will definitely change that stage in the next update.', score: 10, qa: 10, note: 'You promised an unapproved product change.' }
        ] },
        { key: 'resolve', title: 'Close the feedback loop', prompt: 'The player identifies stage four and says the next objective was unclear.', minutes: 12, options: [
          { id: 'best', label: 'Record the feedback with the stage and objective; route to product review.', text: 'I have recorded stage four and the unclear next objective for product review. This is feedback for assessment, not a confirmed change commitment.', score: 100, qa: 100, note: 'You recorded evidence and avoided promising an unapproved change.' },
          { id: 'neutral', label: 'Thank the player and record a general comment.', text: 'Thank you. I will record that the stage instructions need review.', score: 78, qa: 82, note: 'Acknowledged, but the exact evidence should be retained.' },
          { id: 'poor', label: 'Mark the feedback as resolved without recording it.', text: 'Thanks. That is all we need.', score: 8, qa: 8, note: 'You failed to preserve the customer’s feedback.' }
        ] }
      ]
    },
    'CT-55006': {
      focus: 'RuffNeck · Advertising & sponsorship enquiry',
      stages: [
        { key: 'acknowledge', title: 'Understand the enquiry', prompt: 'A business contact wants to understand the sponsorship and advertising process.', minutes: 8, options: [
          { id: 'best', label: 'Confirm that they want the proposal process, not a price commitment.', text: 'I can explain the proposal review process. Are you looking to submit an outline for assessment before discussing rates or campaign dates?', score: 100, qa: 100, note: 'You separated an enquiry from a commercial commitment.' },
          { id: 'neutral', label: 'Ask which service they want to advertise.', text: 'Which service or audience are you interested in reaching?', score: 78, qa: 82, note: 'Relevant qualification, but confirm their requested next step.' },
          { id: 'poor', label: 'Quote an assumed advertising rate.', text: 'Our standard sponsorship rate is fixed at this amount.', score: 5, qa: 5, note: 'You invented a price without an approved rate card.' }
        ] },
        { key: 'investigate', title: 'Qualify the opportunity', prompt: 'Gather the information needed for a proper review.', minutes: 10, options: [
          { id: 'best', label: 'Capture organisation, objective, service, audience, timing and contact details.', text: 'Please share your organisation, campaign objective, RuffNeck service of interest, intended audience and proposed timing. No commercial commitment is made at this stage.', score: 100, qa: 100, note: 'You gathered the right qualification details without promising availability.' },
          { id: 'neutral', label: 'Ask for an organisation profile and preferred service.', text: 'Please send your organisation profile and the service you want to discuss.', score: 78, qa: 82, note: 'A useful start, but further qualification will be needed.' },
          { id: 'poor', label: 'Confirm a campaign date before review.', text: 'We can reserve a campaign date for you now.', score: 5, qa: 5, note: 'You committed inventory before review or approval.' }
        ] },
        { key: 'resolve', title: 'Route the opportunity', prompt: 'The organisation wants to submit a proposal first.', minutes: 12, options: [
          { id: 'best', label: 'Record the enquiry and route it to Partnerships for review.', text: 'You may submit the proposal for review. I will record the required details and route it to Partnerships. Rates, placements and dates remain subject to approval.', score: 100, qa: 100, note: 'You explained the process and kept approval controls intact.' },
          { id: 'neutral', label: 'Send the general proposal requirements.', text: 'Please prepare your organisation details, objectives, audience and proposed timing for review.', score: 82, qa: 86, note: 'Safe guidance, but a named handoff would improve ownership.' },
          { id: 'poor', label: 'Guarantee placement and audience reach.', text: 'Your campaign placement and audience reach are guaranteed.', score: 4, qa: 4, note: 'You made an unsupported advertising guarantee.' }
        ] }
      ]
    },
    'CT-55007': {
      focus: 'General Customer Care · Existing complaint',
      stages: [
        { key: 'acknowledge', title: 'Acknowledge the repeat contact', prompt: 'The customer is upset because they have not received an update on an earlier complaint.', minutes: 8, options: [
          { id: 'best', label: 'Recognise the repeat contact and acknowledge the missing update.', text: 'I am sorry you have had to contact us again without an update. I will check the earlier complaint rather than treating this as a new issue.', score: 100, qa: 100, note: 'You recognised the repeat-contact failure and set the right approach.' },
          { id: 'neutral', label: 'Ask for the complaint reference.', text: 'Please share the complaint reference so I can look it up.', score: 78, qa: 82, note: 'The reference is useful; acknowledge the delay as well.' },
          { id: 'poor', label: 'Ask the customer to submit a new complaint.', text: 'Please submit a new complaint so we can start again.', score: 5, qa: 5, note: 'You ignored the existing complaint and risked duplication.' }
        ] },
        { key: 'investigate', title: 'Check existing ownership', prompt: 'The customer thinks the reference may be CASE-54007.', minutes: 10, options: [
          { id: 'best', label: 'Search the existing case and verify status, owner and next update.', text: 'I will check CASE-54007, confirm its current status and owner, and review the next update commitment.', score: 100, qa: 100, note: 'You checked the existing record before creating a duplicate.' },
          { id: 'neutral', label: 'Ask for the customer’s original contact date.', text: 'When did you first contact us about this complaint?', score: 76, qa: 80, note: 'Useful history, but the supplied reference should be checked.' },
          { id: 'poor', label: 'Open a second complaint immediately.', text: 'I will open another complaint now so it gets attention.', score: 5, qa: 5, note: 'You created a duplicate route without checking the existing case.' }
        ] },
        { key: 'resolve', title: 'Set a clear update expectation', prompt: 'The customer mainly wants to know when they will hear back.', minutes: 12, options: [
          { id: 'best', label: 'Confirm the current owner and a specific next update commitment.', text: 'I will keep the earlier reference as the main record, confirm its owner and document the next update commitment. I will not promise an outcome before the investigation is complete.', score: 100, qa: 100, note: 'You maintained continuity and made a controlled commitment.' },
          { id: 'neutral', label: 'Explain that the team is still investigating.', text: 'The team is still investigating. Please wait for the next update.', score: 75, qa: 78, note: 'Accurate but incomplete: no owner or next update point.' },
          { id: 'poor', label: 'Promise the complaint will be resolved today.', text: 'Your complaint will definitely be resolved today.', score: 5, qa: 5, note: 'You promised an outcome without evidence.' }
        ] }
      ]
    },
    'CT-55008': {
      focus: 'RuffNeck Connect · Getting started',
      stages: [
        { key: 'acknowledge', title: 'Understand the starting point', prompt: 'The customer wants help with initial setup and where to get support.', minutes: 8, options: [
          { id: 'best', label: 'Ask which setup screen the customer is currently viewing.', text: 'I can guide you one step at a time. Which setup screen are you viewing now?', score: 100, qa: 100, note: 'You established the customer’s current position.' },
          { id: 'neutral', label: 'Send a general setup overview.', text: 'I can provide the general setup sequence first.', score: 76, qa: 80, note: 'Helpful, but the current step should be confirmed.' },
          { id: 'poor', label: 'Tell the customer to complete every setting.', text: 'Complete all settings and come back if something fails.', score: 8, qa: 8, note: 'You gave broad instructions without understanding the screen.' }
        ] },
        { key: 'investigate', title: 'Guide the correct step', prompt: 'Identify the completed step and what appears next.', minutes: 10, options: [
          { id: 'best', label: 'Confirm the current step and guide only the next action.', text: 'Please tell me the name of the current setup step and whether it shows as complete. I will guide the next action only.', score: 100, qa: 100, note: 'You kept the instruction manageable and verifiable.' },
          { id: 'neutral', label: 'Ask the customer to follow the full checklist.', text: 'Please follow the setup checklist in order and tell me where you stop.', score: 78, qa: 82, note: 'Reasonable, but a single next-step instruction is clearer.' },
          { id: 'poor', label: 'Assume setup is complete and move to advanced settings.', text: 'Skip the current screen and open the advanced settings.', score: 5, qa: 5, note: 'You assumed the previous step had been completed.' }
        ] },
        { key: 'resolve', title: 'Confirm the next action', prompt: 'The customer has completed the current setup step.', minutes: 12, options: [
          { id: 'best', label: 'Confirm completion and identify the next support route.', text: 'Good. Confirm that the step shows as complete, then continue to the next setup section. If the status differs, stop there and contact support with the screen name.', score: 100, qa: 100, note: 'You confirmed progress and gave a clear support fallback.' },
          { id: 'neutral', label: 'Tell the customer to continue through the checklist.', text: 'Continue through the checklist in order and use the help route if you get stuck.', score: 80, qa: 84, note: 'Safe but less specific.' },
          { id: 'poor', label: 'Claim the setup is fully complete.', text: 'Your setup is complete now.', score: 10, qa: 10, note: 'You claimed completion without checking the remaining steps.' }
        ] }
      ]
    },
    'CT-55009': {
      focus: 'RuffNeck Social Hub · Scheduled post',
      stages: [
        { key: 'acknowledge', title: 'Understand the publishing issue', prompt: 'The customer expected a scheduled post to appear but cannot see a status message.', minutes: 8, options: [
          { id: 'best', label: 'Confirm the scheduled time and expected post status.', text: 'I understand you expected the post to appear. Let us check the post reference, scheduled time and status before concluding what happened.', score: 100, qa: 100, note: 'You avoided assuming that a post was published.' },
          { id: 'neutral', label: 'Ask the customer to refresh the page.', text: 'Please refresh the page and check the post again.', score: 70, qa: 76, note: 'A basic check but does not establish the schedule or status.' },
          { id: 'poor', label: 'Tell the customer the post was published.', text: 'It must have published successfully.', score: 5, qa: 5, note: 'You claimed a publish event without evidence.' }
        ] },
        { key: 'investigate', title: 'Verify the post status', prompt: 'Establish the intended schedule and available status evidence.', minutes: 10, options: [
          { id: 'best', label: 'Request the post reference, time zone and visible status.', text: 'Please share the post reference, scheduled time zone and the status currently shown in the campaign area.', score: 100, qa: 100, note: 'You gathered the evidence needed to trace the schedule.' },
          { id: 'neutral', label: 'Ask whether the post was saved as a draft.', text: 'Was the post saved as a draft before scheduling?', score: 76, qa: 80, note: 'Useful context but not enough to trace the event.' },
          { id: 'poor', label: 'Ask the customer to schedule it again immediately.', text: 'Schedule it again now so it goes out.', score: 5, qa: 5, note: 'You risked a duplicate publication.' }
        ] },
        { key: 'resolve', title: 'Protect against duplicate publication', prompt: 'There is no confirmed publish status yet.', minutes: 12, options: [
          { id: 'best', label: 'Record the reference and route a status check; do not re-publish yet.', text: 'I will record the reference and route a status check. Please do not schedule a duplicate until the existing post status is confirmed.', score: 100, qa: 100, note: 'You protected the customer from duplicate publication.' },
          { id: 'neutral', label: 'Ask the customer to wait while checking the status.', text: 'Please wait while we check the current status of the scheduled post.', score: 82, qa: 86, note: 'Safe, but the next update and evidence should be recorded.' },
          { id: 'poor', label: 'Tell the customer to publish again.', text: 'Publish it again now. The first one probably failed.', score: 5, qa: 5, note: 'You risked duplicate content without checking the first post.' }
        ] }
      ]
    },
    'CT-55010': {
      focus: 'RuffNeck · General service information',
      stages: [
        { key: 'acknowledge', title: 'Understand the enquiry', prompt: 'The customer wants official information about RuffNeck services.', minutes: 8, options: [
          { id: 'best', label: 'Ask which services they want to understand.', text: 'I can point you to the official information. Are you mainly looking for the LMS, Connect or another RuffNeck service?', score: 100, qa: 100, note: 'You narrowed the enquiry before sending information.' },
          { id: 'neutral', label: 'List every service immediately.', text: 'RuffNeck has several services. I can list them all for you.', score: 76, qa: 80, note: 'A broad overview may help, but first identify what the customer needs.' },
          { id: 'poor', label: 'Send an unverified link.', text: 'Use this random link for all service information.', score: 5, qa: 5, note: 'You must share approved information only.' }
        ] },
        { key: 'investigate', title: 'Identify the intended information', prompt: 'The customer asks about LMS and Connect.', minutes: 10, options: [
          { id: 'best', label: 'Clarify whether they need features, access or support routes.', text: 'Do you need an overview of what each service does, access information or the official support route?', score: 100, qa: 100, note: 'You identified the purpose of the information request.' },
          { id: 'neutral', label: 'Give a brief description of each service.', text: 'The LMS supports learning workflows, while Connect is a RuffNeck service platform.', score: 80, qa: 84, note: 'A concise overview, but confirm what detail is needed.' },
          { id: 'poor', label: 'Make claims about features you cannot verify.', text: 'Both services include every feature you could need.', score: 5, qa: 5, note: 'You made unsupported product claims.' }
        ] },
        { key: 'resolve', title: 'Provide official guidance', prompt: 'The customer wants service overview and help information.', minutes: 12, options: [
          { id: 'best', label: 'Provide approved service pages and explain the support route.', text: 'I will share the approved service information and support route for each platform. The product pages are the source for current features and availability.', score: 100, qa: 100, note: 'You directed the customer to approved, current sources.' },
          { id: 'neutral', label: 'Summarise the services and offer further help.', text: 'The LMS is focused on learning and Connect is a RuffNeck platform. I can clarify a particular workflow next.', score: 80, qa: 84, note: 'Helpful overview; the official link should also be provided.' },
          { id: 'poor', label: 'Guarantee capabilities and service availability.', text: 'All services are always available and have identical features.', score: 5, qa: 5, note: 'You made broad claims about availability and capabilities.' }
        ] }
      ]
    }
  };

  function scenarioFor(contact) { return SCENARIOS[contact && contact.reference] || SCENARIOS['CT-55010']; }
  function createInitialState(now) {
    return {
      version: VERSION,
      shift: { status: 'Off duty', date: localDate(now), minutes: START_MINUTES, startedAt: null, endedAt: null, agentName: 'Agent Trainee', team: 'Customer Care' },
      events: { morningBriefing: false, morningBreak: false, lunchBreak: false, afternoonBriefing: false },
      active: null,
      completedContacts: [],
      pastShifts: [],
      activity: [{ at: new Date(now == null ? Date.now() : now).toISOString(), message: 'Core contact-centre shift simulator ready.' }],
      metrics: { completed: 0, qaTotal: 0, csatTotal: 0, fcr: 0, complianceBreaches: 0, knowledgeUses: 0, totalHandleMinutes: 0 }
    };
  }
  function normaliseState(raw, now) {
    const fresh = createInitialState(now);
    if (!raw || typeof raw !== 'object') return fresh;
    return {
      ...fresh, ...raw,
      shift: { ...fresh.shift, ...(raw.shift || {}) },
      events: { ...fresh.events, ...(raw.events || {}) },
      active: raw.active && typeof raw.active === 'object' ? raw.active : null,
      completedContacts: Array.isArray(raw.completedContacts) ? raw.completedContacts : [],
      pastShifts: Array.isArray(raw.pastShifts) ? raw.pastShifts : [],
      activity: Array.isArray(raw.activity) ? raw.activity.slice(0, 120) : fresh.activity,
      metrics: { ...fresh.metrics, ...(raw.metrics || {}) }
    };
  }
  function load(storage, now) {
    if (!storage || typeof storage.getItem !== 'function') return createInitialState(now);
    try { return normaliseState(JSON.parse(storage.getItem(STORAGE_KEY) || 'null'), now); }
    catch (_) { return createInitialState(now); }
  }
  function save(state, storage) {
    if (!storage || typeof storage.setItem !== 'function') return false;
    try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch (_) { return false; }
  }
  function log(state, message, at) {
    state.activity.unshift({ at: new Date(at || Date.now()).toISOString(), message: clean(message, 240) });
    state.activity = state.activity.slice(0, 120);
  }
  function isOnShift(state) { return state.shift.status === 'On shift'; }
  function currentContact(agentState, agentEngine) { return agentEngine.getActiveContact(agentState); }
  function dueEvent(state) {
    if (!isOnShift(state) || state.active) return null;
    if (!state.events.morningBriefing) return EVENTS[0];
    if (state.shift.minutes >= EVENTS[1].due && !state.events.morningBreak) return EVENTS[1];
    if (state.shift.minutes >= EVENTS[2].due && !state.events.lunchBreak) return EVENTS[2];
    if (state.shift.minutes >= EVENTS[3].due && !state.events.afternoonBriefing) return EVENTS[3];
    return null;
  }
  function startShift(state, agentState, agentEngine, input, at) {
    if (isOnShift(state)) throw new Error('This simulated shift is already active.');
    if (state.shift.status === 'Ended') {
      state.pastShifts = Array.isArray(state.pastShifts) ? state.pastShifts : [];
      state.pastShifts.unshift({ date: state.shift.date, agentName: state.shift.agentName, report: getShiftReport(state), endedAt: state.shift.endedAt });
      state.pastShifts = state.pastShifts.slice(0, 30);
      Object.assign(agentState, agentEngine.createInitialState(at || new Date()));
    }
    if (!agentEngine || typeof agentEngine.startShift !== 'function') throw new Error('The agent workbench engine is not available.');
    const name = clean(input && input.name, 100), team = clean(input && input.team || 'Customer Care', 100);
    if (name.length < 2) throw new Error('Enter your employee name.');
    if (agentState.activeContactId) throw new Error('Finish the active contact before starting a shift.');
    if (agentState.agent.shiftStartedAt && !agentState.agent.shiftEndedAt) throw new Error('An agent session is already active in this simulation.');
    agentEngine.startShift(agentState, name, team, at || new Date());
    state.shift = { status: 'On shift', date: localDate(at || new Date()), minutes: START_MINUTES, startedAt: new Date(at || Date.now()).toISOString(), endedAt: null, agentName: name, team };
    state.events = { morningBriefing: false, morningBreak: false, lunchBreak: false, afternoonBriefing: false };
    state.active = null;
    state.completedContacts = [];
    state.metrics = { completed: 0, qaTotal: 0, csatTotal: 0, fcr: 0, complianceBreaches: 0, knowledgeUses: 0, totalHandleMinutes: 0 };
    log(state, `${name} signed in to the ${team} floor. The 07:30 briefing is due.`, at);
    return state.shift;
  }
  function attendEvent(state, eventId, at) {
    const due = dueEvent(state);
    if (!due || due.id !== eventId) throw new Error('That floor event is not currently due.');
    state.events[eventId] = true;
    state.shift.minutes += due.duration;
    const message = due.type === 'briefing' ? `${due.time} briefing attended: ${due.title}.` : `${due.title} completed.`;
    log(state, message, at);
    return due;
  }
  function beginContact(state, agentState, agentEngine, contactId, at) {
    if (!isOnShift(state)) throw new Error('Start the shift before accepting a customer.');
    if (dueEvent(state)) throw new Error(`Complete the ${dueEvent(state).title.toLowerCase()} first.`);
    if (state.active) throw new Error('Complete the active customer interaction first.');
    const contact = agentEngine.acceptContact(agentState, contactId, at || new Date());
    state.active = { contactId: contact.id, reference: contact.reference, stageIndex: 0, stageResults: [], usedKnowledge: false, startedAt: new Date(at || Date.now()).toISOString() };
    log(state, `${contact.reference} accepted from the ${contact.channel} queue.`, at);
    return contact;
  }
  function getActiveScenario(state, agentState, agentEngine) {
    const contact = currentContact(agentState, agentEngine);
    if (!contact || !state.active || contact.id !== state.active.contactId) return null;
    return { contact, scenario: scenarioFor(contact), stage: scenarioFor(contact).stages[state.active.stageIndex] || null };
  }
  function chooseResponse(state, agentState, agentEngine, optionId, at) {
    const active = getActiveScenario(state, agentState, agentEngine);
    if (!active || !active.stage) throw new Error('There is no active decision to answer.');
    const option = active.stage.options.find((item) => item.id === optionId);
    if (!option) throw new Error('Choose one of the available customer-care responses.');
    const now = at || new Date();
    agentEngine.sendReply(agentState, active.contact.id, option.text, now);
    const customerReply = agentEngine.simulateCustomerResponse(agentState, active.contact.id, now);
    const result = { stage: active.stage.key, optionId: option.id, score: option.score, qa: option.qa, complianceBreach: !!option.complianceBreach, note: option.note, minutes: active.stage.minutes };
    state.active.stageResults.push(result);
    state.active.stageIndex += 1;
    state.shift.minutes += active.stage.minutes;
    if (result.complianceBreach) {
      state.metrics.complianceBreaches += 1;
      log(state, `Critical compliance breach recorded in ${active.contact.reference}.`, now);
    } else {
      log(state, `${active.contact.reference}: ${active.stage.title} decision recorded.`, now);
    }
    if (state.active.stageIndex >= 3) {
      state.active.readyToWrap = true;
    }
    return { result, customerReply, complete: state.active.readyToWrap, dueEvent: dueEvent(state) };
  }
  function markKnowledgeUsed(state, articleId, at) {
    if (!state.active) throw new Error('Accept a customer contact before using knowledge.');
    if (!articleId) throw new Error('Choose a published knowledge article.');
    state.active.usedKnowledge = true;
    state.active.knowledgeArticleIds = Array.isArray(state.active.knowledgeArticleIds) ? state.active.knowledgeArticleIds : [];
    if (!state.active.knowledgeArticleIds.includes(articleId)) state.active.knowledgeArticleIds.push(articleId);
    log(state, `Published knowledge article ${clean(articleId, 80)} referenced during ${state.active.reference}.`, at);
    return state.active;
  }
  function finishContact(state, agentState, agentEngine, customerEngine, storage, input, at) {
    if (!state.active || !state.active.readyToWrap) throw new Error('Complete the three customer-care decisions before wrapping up.');
    const activeContact = agentEngine.getActiveContact(agentState);
    if (!activeContact || activeContact.id !== state.active.contactId) throw new Error('The active workbench contact could not be found.');
    const summary = clean(input && input.summary, 900);
    if (summary.length < 20) throw new Error('Enter a wrap-up summary of at least 20 characters.');
    const disposition = clean(input && input.disposition, 80);
    const caseAction = input && input.caseAction;
    const wrapInput = {
      disposition,
      summary,
      caseAction,
      existingCaseId: input && input.existingCaseId,
      category: input && input.category || 'Other',
      priority: input && input.priority || activeContact.priority,
      caseSubject: input && input.caseSubject || activeContact.subject
    };
    let linkedCase = null;
    if (caseAction !== 'skip') {
      if (!customerEngine || typeof customerEngine.load !== 'function' || typeof agentEngine.commitToCustomerJourney !== 'function') throw new Error('Customer 360 integration engine is unavailable.');
      linkedCase = agentEngine.commitToCustomerJourney(agentState, activeContact.id, wrapInput, customerEngine, storage, at || new Date());
    } else {
      const customerState = customerEngine.load(storage);
      const customer = customerEngine.getCustomer(customerState, activeContact.customerId);
      if (!customer) throw new Error('Customer profile is unavailable for this interaction.');
      customerEngine.addCustomerNote(customerState, customer.id, `Agent contact ${activeContact.reference}. ${summary}`, state.shift.agentName, at || new Date());
      if (!customerEngine.save(customerState, storage)) throw new Error('Customer note could not be saved.');
    }
    const completed = agentEngine.completeContact(agentState, activeContact.id, { ...wrapInput, linkedCaseId: linkedCase && linkedCase.id || null }, at || new Date());
    const results = state.active.stageResults;
    const rawScore = Math.round(results.reduce((sum, item) => sum + item.score, 0) / Math.max(1, results.length));
    const complianceBreach = results.some((item) => item.complianceBreach);
    const score = complianceBreach ? Math.min(rawScore, 25) : rawScore;
    const rawQa = Math.round(results.reduce((sum, item) => sum + item.qa, 0) / Math.max(1, results.length) + (state.active.usedKnowledge ? 3 : 0));
    const qa = complianceBreach ? 0 : clamp(rawQa, 0, 100);
    const csat = clamp(Math.round(score / 25 + 1), 1, 5);
    const isFcr = !linkedCase && ['Resolved on first contact', 'Information provided', 'Guidance provided'].includes(disposition) && !complianceBreach;
    const totalMinutes = results.reduce((sum, item) => sum + item.minutes, 0) + 5;
    const record = {
      contactId: completed.id, reference: completed.reference, customerId: completed.customerId,
      channel: completed.channel, subject: completed.subject, score, qa, csat,
      complianceBreach, fcr: isFcr, knowledgeUsed: state.active.usedKnowledge,
      disposition, linkedCaseId: linkedCase && linkedCase.id || null,
      completedAt: new Date(at || Date.now()).toISOString(), handleMinutes: totalMinutes,
      decisionNotes: results.map((item) => item.note)
    };
    state.completedContacts.unshift(record);
    state.completedContacts = state.completedContacts.slice(0, 100);
    state.metrics.completed += 1;
    state.metrics.qaTotal += qa;
    state.metrics.csatTotal += csat;
    if (isFcr) state.metrics.fcr += 1;
    if (state.active.usedKnowledge) state.metrics.knowledgeUses += 1;
    state.metrics.totalHandleMinutes += totalMinutes;
    state.active = null;
    state.shift.minutes += 11;
    log(state, `${completed.reference} wrapped up. QA ${qa} · CSAT ${csat}/5${linkedCase ? ` · ${linkedCase.reference}` : ''}.`, at);
    return { completed, record, linkedCase, dueEvent: dueEvent(state) };
  }
  function endShift(state, agentState, agentEngine, at) {
    if (!isOnShift(state)) throw new Error('There is no active shift to end.');
    if (state.active || agentState.activeContactId) throw new Error('Wrap up or transfer the active customer before ending the shift.');
    if (dueEvent(state)) throw new Error(`Attend the ${dueEvent(state).title.toLowerCase()} before ending the shift.`);
    agentEngine.endShift(agentState, at || new Date());
    state.shift.status = 'Ended';
    state.shift.endedAt = new Date(at || Date.now()).toISOString();
    log(state, `${state.shift.agentName} ended the simulated shift.`, at);
    return getShiftReport(state);
  }
  function getShiftReport(state) {
    const completed = state.completedContacts.length;
    return {
      completed,
      averageQa: completed ? Math.round(state.metrics.qaTotal / completed) : 0,
      averageCsat: completed ? Math.round(state.metrics.csatTotal / completed * 10) / 10 : 0,
      fcrRate: completed ? Math.round(state.metrics.fcr / completed * 100) : 0,
      complianceBreaches: state.metrics.complianceBreaches,
      knowledgeUses: state.metrics.knowledgeUses,
      averageHandleMinutes: completed ? Math.round(state.metrics.totalHandleMinutes / completed) : 0,
      score: completed ? Math.round((state.metrics.qaTotal / completed * 0.45) + (state.metrics.csatTotal / completed * 20 * 0.35) + ((state.metrics.fcr / completed) * 100 * 0.2) - (state.metrics.complianceBreaches * 10)) : 0,
      attendedMorningBriefing: !!state.events.morningBriefing,
      attendedAfternoonBriefing: !!state.events.afternoonBriefing,
      attendedBreaks: !!(state.events.morningBreak && state.events.lunchBreak)
    };
  }
  function formatDuration(totalMinutes) {
    const minutes = Math.max(0, Number(totalMinutes) || 0);
    return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
  }

  return {
    VERSION, STORAGE_KEY, AGENT_STORAGE_KEY, START_MINUTES, END_MINUTES, EVENTS, SCENARIOS,
    clean, clamp, localDate, clockLabel, virtualDate, scenarioFor, createInitialState, normaliseState,
    load, save, log, isOnShift, dueEvent, startShift, attendEvent, beginContact,
    getActiveScenario, chooseResponse, markKnowledgeUsed, finishContact, endShift, getShiftReport, formatDuration
  };
});
