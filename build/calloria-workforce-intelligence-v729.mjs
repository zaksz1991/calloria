/** CALLORIA v7.29 — workforce performance intelligence read-only panel. */
const V728_MARKER = '/* CALLORIA_V728_DIGITAL_CAREER_EVIDENCE */';
const V729_MARKER = '/* CALLORIA_V729_WORKFORCE_INTELLIGENCE */';
const CAREER_IMPORT = "import { digitalCareerEvidenceBoard, createDigitalCareerReviewPacket, reviewDigitalCareerReviewPacket } from './digital-career-evidence-engine-v728.js';";
const CAREER_PANEL_CALL = '  const digitalCareerEvidencePanel = renderDigitalCareerEvidencePanelV728(digitalFollowUpPerformanceForOutcomes, state.digitalFollowUpCoachingPlans, state.digitalCareerReviewPackets, Date.now());';
const CAREER_TEMPLATE_ANCHOR = '    ${digitalCareerEvidencePanel}';
const RENDER_ANCHOR = 'function renderSupervisor(){';
const MAIN_SUFFIX = '/js/main.js';

function normaliseId(id) { return String(id || '').split('?')[0].replace(/\\/g, '/'); }
function count(source, value) { return source.split(value).length - 1; }

function panelSource() {
  return [
    V729_MARKER,
    'function renderWorkforceIntelligencePanelV729(stateSnapshot, digitalPerformance, coachingPlans, careerPackets, now) {',
    '  const board = workforceIntelligenceBoard(stateSnapshot, digitalPerformance, coachingPlans, careerPackets, now);',
    '  const profile = board.profile;',
    '  const fmt = value => value === null || value === undefined ? "—" : String(value);',
    '  const pct = value => value === null || value === undefined ? "—" : `${Math.round(Number(value))}%`;',
    '  const score = board.profile.serviceIndex.value === null ? "NOT RATED" : `${board.profile.serviceIndex.value}/100`;',
    '  const scoreTone = board.profile.serviceIndex.value === null ? "muted" : board.profile.serviceIndex.value >= 85 ? "green" : board.profile.serviceIndex.value >= 70 ? "blue" : "amber";',
    '  const career = profile.career ? `<div class="workforce-intel-career"><span>Digital career evidence</span><strong>${escapeHTML(profile.career.readinessLabel)}</strong><small>${profile.career.readinessScore}/100 · human review only</small></div>` : \'<div class="workforce-intel-career"><span>Digital career evidence</span><strong>Not matched</strong><small>Employee ID has no corresponding digital agent record.</small></div>\';',
    '  const sources = board.sources.map(item => `<div class="workforce-intel-source"><span class="${item.available ? "available" : "missing"}">${item.available ? "●" : "○"}</span><div><strong>${escapeHTML(item.label)}</strong><small>${item.available ? `${item.samples} retained sample(s)` : "No source evidence"}</small></div></div>`).join("");',
    '  const agentRows = board.digitalAgents.slice(0, 10).map(agent => `<tr><td><strong>${escapeHTML(agent.agentId)}</strong><small>${escapeHTML(agent.careerStatus)}</small></td><td>${agent.completed}</td><td>${pct(agent.responseTargetRate)}</td><td>${agent.overdue}</td><td>${agent.atRisk}</td></tr>`).join("");',
    '  const agentTable = agentRows ? `<div class="workforce-intel-table-wrap"><table class="workforce-intel-table"><thead><tr><th>Digital agent</th><th>Replies</th><th>On target</th><th>Overdue</th><th>At risk</th></tr></thead><tbody>${agentRows}</tbody></table></div>` : \'<p class="muted-note">Digital agent scorecards appear after attributed customer responses are recorded.</p>\';',
    '  const b = board.digitalOperations;',
    '  return `<section class="panel workforce-intel-panel"><div class="panel-head"><div><h3>Workforce performance intelligence</h3><p>Cross-channel evidence view with source coverage, employee-level metrics and a separate digital operations board.</p></div><span class="pill blue">v7.29 · READ ONLY</span></div>',
    '  <div class="workforce-intel-overview"><div><span>Voice operations · current profile</span><strong>${profile.voice.totalInteractions}</strong><small>${profile.voice.inboundHandled} inbound · ${profile.voice.outboundHandled} outbound</small></div><div><span>Digital replies · all attributed agents</span><strong>${b.completedReplies}</strong><small>${b.agents} digital agent(s) · ${b.totalCycles} response cycles</small></div><div><span>Digital risks · all agents</span><strong>${b.overdue + b.atRisk}</strong><small>${b.overdue} overdue · ${b.atRisk} at risk</small></div><div><span>Career review packets</span><strong>${b.pendingCareerPackets}</strong><small>${b.agentsWithCareerReviewReadiness} agents ready for human review</small></div></div>',
    '  <div class="workforce-intel-profile"><div class="workforce-intel-profile-head"><div><span class="subtle-label">CURRENT LOCAL EMPLOYEE PROFILE</span><h4>${escapeHTML(profile.displayName)}</h4><small>${escapeHTML(profile.employeeId)} · ${profile.hasEvidence ? "retained performance evidence" : "no completed performance evidence"}</small></div><span class="pill ${scoreTone}">${score}</span></div>',
    '  <div class="workforce-intel-metrics"><div><span>Quality assurance</span><strong>${profile.quality.averageScore === null ? "—" : `${profile.quality.averageScore}%`}</strong><small>${profile.quality.samples} sample(s)</small></div><div><span>Customer satisfaction</span><strong>${profile.satisfaction.averageScore === null ? "—" : `${profile.satisfaction.averageScore}/5`}</strong><small>${profile.satisfaction.samples} sample(s)</small></div><div><span>Shift adherence</span><strong>${pct(profile.shifts.averageAdherence)}</strong><small>${profile.shifts.completedShifts} completed shift(s)</small></div><div><span>Digital target rate</span><strong>${pct(profile.digital.responseTargetRate)}</strong><small>${profile.digital.matched ? `${profile.digital.completed} replies for matched ID` : "No exact employee-ID match"}</small></div><div><span>Inbound resolution</span><strong>${pct(profile.voice.resolutionRate)}</strong><small>${profile.voice.resolutions} of ${profile.voice.inboundHandled} inbound contacts</small></div><div><span>Compliance register</span><strong>${escapeHTML(profile.compliance.status)}</strong><small>${fmt(profile.compliance.incidentCount)} incident(s) · ${profile.compliance.criticalVoiceFlags} critical flag(s)</small></div></div>',
    '  <div class="workforce-intel-index-note"><strong>${escapeHTML(profile.serviceIndex.label)}: ${score}</strong><span>${profile.serviceIndex.coveragePercent}% weighted evidence coverage · ${profile.serviceIndex.dimensionsAvailable}/4 dimensions available. At least two dimensions are required; this index is not a promotion rating.</span></div>${career}</div>',
    '  <div class="workforce-intel-lower"><div><h4>Evidence source coverage · ${board.sourceCoverage.percent}%</h4><div class="workforce-intel-sources">${sources}</div></div><div><h4>Digital agent performance</h4>${agentTable}</div></div>',
    '  <p class="muted-note workforce-intel-boundary">${board.boundaries.map(item => escapeHTML(item)).join(" ")} This view is generated from retained local simulation records; it is not connected to an external ACD, payroll, biometric attendance or HRIS system.</p></section>`;',
    '}'
  ].join('\n') + '\n';
}

export function calloriaWorkforceIntelligencePluginV729() {
  return {
    name: 'calloria-workforce-intelligence-v7-29',
    enforce: 'post',
    transform(source, id) {
      if (!normaliseId(id).endsWith(MAIN_SUFFIX) || source.includes(V729_MARKER)) return null;
      const checks = [
        [V728_MARKER, 'v7.28 career evidence marker'],
        [CAREER_IMPORT, 'v7.28 career evidence engine import'],
        [CAREER_PANEL_CALL, 'v7.28 career evidence render call'],
        [CAREER_TEMPLATE_ANCHOR, 'v7.28 supervisor panel template insertion'],
        [RENDER_ANCHOR, 'Supervisor render function']
      ];
      const missing = checks.filter(([anchor]) => count(source, anchor) !== 1).map(([, label]) => label);
      if (missing.length) {
        this.warn(`CALLORIA v7.29 skipped safely: ${missing.join(', ')} did not match exactly once. No partial transform was applied.`);
        return null;
      }
      let code = source.replace(
        CAREER_IMPORT,
        `${CAREER_IMPORT}\nimport { workforceIntelligenceBoard } from './workforce-intelligence-engine-v729.js';\nimport '../styles/calloria-workforce-intelligence-v729.css';`
      );
      code = code.replace(RENDER_ANCHOR, `${panelSource()}\n${RENDER_ANCHOR}`);
      code = code.replace(
        CAREER_PANEL_CALL,
        `${CAREER_PANEL_CALL}\n  const workforceIntelligencePanel = renderWorkforceIntelligencePanelV729(state, digitalFollowUpPerformanceForOutcomes, state.digitalFollowUpCoachingPlans, state.digitalCareerReviewPackets, Date.now());`
      );
      code = code.replace(CAREER_TEMPLATE_ANCHOR, `${CAREER_TEMPLATE_ANCHOR}\n    \${workforceIntelligencePanel}`);
      return { code, map: null };
    }
  };
}
