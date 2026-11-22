/** CALLORIA v7.28 — digital workforce career evidence bridge. */
const V727_MARKER = '/* CALLORIA_V727_DIGITAL_FOLLOWUP_COACHING_CHECKPOINTS */';
const V728_MARKER = '/* CALLORIA_V728_DIGITAL_CAREER_EVIDENCE */';
const CHECKPOINT_IMPORT = "import { digitalFollowUpCoachingCheckpointBoard, scheduleDigitalFollowUpCoachingCheckpoints, recordDigitalFollowUpCoachingCheckpoint } from './digital-followup-coaching-checkpoints-engine-v727.js';";
const CHECKPOINT_PANEL_CALL = '  const digitalFollowUpCoachingCheckpointPanel = renderDigitalFollowUpCoachingCheckpointPanelV727(state.digitalFollowUpCoachingPlans, digitalFollowUpPerformanceForOutcomes, Date.now());';
const CHECKPOINT_TEMPLATE_ANCHOR = '    ${digitalFollowUpCoachingCheckpointPanel}';
const ACTION_ANCHOR = "    case 'request-digital-supervisor':requestDigitalSupervisor(event.contactId);break;";
const ACTION_DISPATCH_ANCHOR = 'handleAction(action.dataset.action,{callbackId:action.dataset.callbackId,requestId:action.dataset.requestId,commitmentId:action.dataset.commitmentId,caseReference:action.dataset.caseReference,system:action.dataset.system,text:action.dataset.text,contactId:action.dataset.contactId,memberId:action.dataset.memberId,nextStatus:action.dataset.nextStatus,mode:action.dataset.mode,optionId:action.dataset.optionId,section:action.dataset.assessmentSection,index:action.dataset.assessmentIndex});return;}';
const SUBMIT_ANCHOR = "document.addEventListener('submit',async e=>{";
const RENDER_ANCHOR = 'function renderSupervisor(){';
const MAIN_SUFFIX = '/js/main.js';

function normaliseId(id) { return String(id || '').split('?')[0].replace(/\\/g, '/'); }
function count(source, value) { return source.split(value).length - 1; }

function careerEvidencePanelSource() {
  return [
    V728_MARKER,
    'function renderDigitalCareerEvidencePanelV728(performance, plans, packets, now) {',
    '  const board = digitalCareerEvidenceBoard(performance, plans, packets, now);',
    '  const rate = value => value === null || value === undefined ? "—" : `${Math.round(Number(value))}%`;',
    '  const cards = board.agents.slice(0, 12).map(agent => {',
    '    const pill = agent.readinessStatus === "ready_for_review" ? "green" : agent.readinessStatus === "sustainment_pending" ? "blue" : agent.readinessStatus === "development_required" ? "amber" : "muted";',
    '    const blockers = agent.blocks.length ? `<ul class="digital-career-evidence-blockers">${agent.blocks.slice(0, 3).map(item => `<li>${escapeHTML(item)}</li>`).join("")}</ul>` : \'<p class="digital-career-evidence-ready-note">Evidence gates met. Supervisor judgement and the existing formal promotion process are still required.</p>\';',
    '    const packet = agent.latestPacket;',
    '    let action = "";',
    '    if (packet?.status === "pending_review") {',
    '      action = `<form class="digital-career-review-form" data-digital-career-review-form data-packet-id="${escapeHTML(packet.id)}"><label>Supervisor decision<select name="decision" required><option value="">Choose a decision</option><option value="refer_to_formal_exam">Refer for formal promotion-exam eligibility review</option><option value="defer">Defer and continue development</option><option value="not_recommended">Not recommended at this review</option></select></label><label>Reviewing supervisor<input name="reviewer" required minlength="2" maxlength="80" autocomplete="name" placeholder="Supervisor name"></label><label>Evidence-based review notes<textarea name="reason" required minlength="20" maxlength="500" rows="2" placeholder="Record the evidence and reason for this decision"></textarea></label><button class="btn small primary" type="submit">Record supervisor decision</button></form>`;',
    '    } else if (packet?.review) {',
    '      action = `<div class="digital-career-evidence-decision"><strong>${escapeHTML(packet.review.label)}</strong><small>${escapeHTML(packet.review.reviewer)} · ${escapeHTML(new Date(packet.review.reviewedAt).toLocaleDateString())}</small><p>${escapeHTML(packet.review.reason)}</p></div>`;',
    '    } else if (agent.canPreparePacket) {',
    '      action = `<button type="button" class="btn small secondary" data-action="prepare-digital-career-review" data-agent-id="${escapeHTML(agent.agentId)}">Prepare career review packet</button>`;',
    '    }',
    '    const completed = agent.completedCycles;',
    '    const sustainment = agent.coaching.reviewedCount ? `${agent.coaching.day30Recorded}/${agent.coaching.reviewedCount} 30-day checks recorded` : "No completed coaching plan requiring a 30-day check";',
    '    return `<article class="digital-career-evidence-card"><div class="digital-career-evidence-top"><div><strong>${escapeHTML(agent.agentId)}</strong><small>${escapeHTML(agent.readinessLabel)}</small></div><span class="pill ${pill}">${agent.readinessScore}/100</span></div><div class="digital-career-evidence-metrics"><div><span>Completed replies</span><b>${completed}</b></div><div><span>On-target rate</span><b>${rate(agent.responseTargetRate)}</b></div><div><span>Overdue</span><b>${agent.overdue}</b></div><div><span>At risk</span><b>${agent.atRisk}</b></div><div><span>Active coaching</span><b>${agent.coaching.activeCount}</b></div><div><span>Coaching completed</span><b>${agent.coaching.completedCount}</b></div></div><small class="digital-career-evidence-sustainment">${escapeHTML(sustainment)} · ${agent.coaching.regressions} regression(s)</small>${blockers}<div class="digital-career-evidence-actions">${action}</div></article>`;',
    '  }).join("");',
    '  const empty = \'<div class="empty-state"><p>Agent-level digital follow-up evidence will appear after customer responses are recorded.</p></div>\';',
    '  return `<section class="panel digital-career-evidence-panel"><div class="panel-head"><div><h3>Workforce career evidence</h3><p>Combines digital response scorecards, coaching outcomes and 30-day sustainment into a traceable supervisor review dossier.</p></div><span class="pill blue">${board.totalAgents} AGENTS</span></div><div class="digital-career-evidence-summary"><div><span>Eligible for review</span><strong>${board.readyForReview}</strong></div><div><span>Development required</span><strong>${board.developmentRequired}</strong></div><div><span>Sustainment pending</span><strong>${board.sustainmentPending}</strong></div><div><span>Insufficient sample</span><strong>${board.insufficientEvidence}</strong></div></div><div class="digital-career-evidence-list">${cards || empty}</div><p class="muted-note">The readiness signal covers retained synthetic digital follow-up activity only. It is not a whole-workforce appraisal, promotion decision or employment action. A referral does not bypass the existing annual promotion eligibility rules, formal exam or three-attempt limit. No salary, role or employment record is changed by this panel.</p></section>`;',
    '}'
  ].join('\n') + '\n';
}

function actionCasesSource() {
  return [
    "    case 'prepare-digital-career-review': {",
    '      const performance = digitalFollowUpPerformanceBoard(state.digitalQueue, queueSimulationNowMs());',
    '      const board = digitalCareerEvidenceBoard(performance, state.digitalFollowUpCoachingPlans, state.digitalCareerReviewPackets, Date.now());',
    '      const evidence = board.agents.find(item => item.agentId === String(event.agentId || ""));',
    '      const previous = Array.isArray(state.digitalCareerReviewPackets) ? state.digitalCareerReviewPackets : [];',
    '      const updated = createDigitalCareerReviewPacket(previous, evidence, { createdBy: state.applicantName || "SUPERVISOR", now: Date.now() });',
    '      if (updated.length === previous.length) { toast("A career review packet requires current evidence readiness and no other pending packet.", "warning"); break; }',
    '      state.digitalCareerReviewPackets = updated;',
    '      const packet = updated[updated.length - 1];',
    '      pushOperationEvent("career-review", packet.id, "Digital career evidence packet prepared for human supervisor review.", "pending_review", { agentId: packet.agentId, evidenceSnapshot: packet.evidenceSnapshot });',
    '      saveState(); toast("Career evidence packet prepared. Record an independent supervisor decision.", "success"); renderView(); break;',
    '    }',
    ACTION_ANCHOR
  ].join('\n');
}

function submitHandlerSource() {
  return [
    SUBMIT_ANCHOR,
    '  if (e.target.matches("[data-digital-career-review-form]")) {',
    '    e.preventDefault();',
    '    const values = new FormData(e.target);',
    '    const previous = Array.isArray(state.digitalCareerReviewPackets) ? state.digitalCareerReviewPackets : [];',
    '    try {',
    '      const updated = reviewDigitalCareerReviewPacket(previous, e.target.dataset.packetId, { decision: values.get("decision"), reviewer: values.get("reviewer"), reason: values.get("reason") }, { now: Date.now() });',
    '      state.digitalCareerReviewPackets = updated;',
    '      const packet = updated.find(item => item && item.id === e.target.dataset.packetId);',
    '      pushOperationEvent("career-review", packet.id, `Career evidence review decision recorded: ${packet.review.label}.`, packet.status, { agentId: packet.agentId, reviewer: packet.review.reviewer, reason: packet.review.reason, decision: packet.review.decision });',
    '      saveState(); renderView(); toast(packet.review.label, "success");',
    '    } catch (error) { toast(error.message || "Career review decision could not be recorded.", "warning"); }',
    '    return;',
    '  }'
  ].join('\n');
}

export function calloriaDigitalCareerEvidencePluginV728() {
  return {
    name: 'calloria-digital-career-evidence-v7-28',
    enforce: 'post',
    transform(source, id) {
      if (!normaliseId(id).endsWith(MAIN_SUFFIX) || source.includes(V728_MARKER)) return null;
      const checks = [
        [V727_MARKER, 'v7.27 checkpoint marker'],
        [CHECKPOINT_IMPORT, 'v7.27 checkpoint engine import'],
        [CHECKPOINT_PANEL_CALL, 'v7.27 checkpoint panel render call'],
        [CHECKPOINT_TEMPLATE_ANCHOR, 'v7.27 checkpoint template insertion'],
        [ACTION_ANCHOR, 'Supervisor action dispatch'],
        [ACTION_DISPATCH_ANCHOR, 'delegated action dataset bridge'],
        [SUBMIT_ANCHOR, 'document submit handler'],
        [RENDER_ANCHOR, 'Supervisor render function']
      ];
      const missing = checks.filter(([anchor]) => count(source, anchor) !== 1).map(([, label]) => label);
      if (missing.length) {
        this.warn(`CALLORIA v7.28 skipped safely: ${missing.join(', ')} did not match exactly once. No partial transform was applied.`);
        return null;
      }

      let code = source.replace(
        CHECKPOINT_IMPORT,
        `${CHECKPOINT_IMPORT}\nimport { digitalCareerEvidenceBoard, createDigitalCareerReviewPacket, reviewDigitalCareerReviewPacket } from './digital-career-evidence-engine-v728.js';\nimport '../styles/calloria-digital-career-evidence-v728.css';`
      );
      code = code.replace(RENDER_ANCHOR, `${careerEvidencePanelSource()}\n${RENDER_ANCHOR}`);
      code = code.replace(
        CHECKPOINT_PANEL_CALL,
        `${CHECKPOINT_PANEL_CALL}\n  state.digitalCareerReviewPackets ||= [];\n  const digitalCareerEvidencePanel = renderDigitalCareerEvidencePanelV728(digitalFollowUpPerformanceForOutcomes, state.digitalFollowUpCoachingPlans, state.digitalCareerReviewPackets, Date.now());`
      );
      code = code.replace(CHECKPOINT_TEMPLATE_ANCHOR, `${CHECKPOINT_TEMPLATE_ANCHOR}\n    \${digitalCareerEvidencePanel}`);
      code = code.replace(ACTION_ANCHOR, actionCasesSource());
      code = code.replace(
        ACTION_DISPATCH_ANCHOR,
        ACTION_DISPATCH_ANCHOR.replace('index:action.dataset.assessmentIndex}', 'index:action.dataset.assessmentIndex,agentId:action.dataset.agentId,packetId:action.dataset.packetId}')
      );
      code = code.replace(SUBMIT_ANCHOR, submitHandlerSource());
      return { code, map: null };
    }
  };
}
