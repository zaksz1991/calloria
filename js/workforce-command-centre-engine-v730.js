/**
 * CALLORIA v7.30 — Workforce Intelligence Command Centre.
 *
 * This is a read-only planning and supervision layer over retained local
 * simulation evidence. It only creates department comparisons when an exact
 * employee-to-department mapping is present. Capacity scenarios are backlog
 * stress tests, not time-series forecasts or live staffing recommendations.
 */
import { workforceIntelligenceBoard } from './workforce-intelligence-engine-v729.js';

export const WORKFORCE_COMMAND_CENTRE_VERSION = '7.30.0';
const CHANNELS = Object.freeze([
  { id: 'email', label: 'Email' },
  { id: 'live_chat', label: 'Live Chat' },
  { id: 'social', label: 'Social' }
]);
const UNASSIGNED_IDS = new Set(['', 'UNASSIGNED', 'ALL_AGENTS']);
const SCENARIOS = Object.freeze([
  { id: 'lower', label: 'Lower load', multiplier: 0.8 },
  { id: 'baseline', label: 'Current backlog', multiplier: 1 },
  { id: 'surge', label: 'Demand surge', multiplier: 1.3 }
]);

function finite(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function count(value) {
  const parsed = finite(value, 0);
  return Math.max(0, Math.floor(parsed));
}
function clean(value, max = 100) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}
function round(value, places = 1) {
  if (!Number.isFinite(Number(value))) return null;
  const factor = 10 ** places;
  return Math.round(Number(value) * factor) / factor;
}
function normaliseId(value) {
  return clean(value, 100).toUpperCase();
}
function employeeId(row) {
  return normaliseId(row?.employeeId ?? row?.agentId ?? row?.staffId ?? row?.userId ?? row?.id);
}
function departmentLabel(row, directory) {
  const rawDirect = row?.departmentName ?? row?.department ?? row?.teamName ?? row?.team;
  const direct = (typeof rawDirect === 'string' || typeof rawDirect === 'number') ? clean(rawDirect, 100) : '';
  if (direct) return direct;
  const id = clean(row?.departmentId ?? row?.teamId, 100);
  return id ? directory.get(id.toUpperCase()) || `Department ${id}` : '';
}
function departmentDirectory(state) {
  const result = new Map();
  const rows = Array.isArray(state?.departments) ? state.departments : [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const id = clean(row.id ?? row.departmentId ?? row.code, 100).toUpperCase();
    const name = clean(row.name ?? row.departmentName ?? row.title, 100);
    if (id && name) result.set(id, name);
  }
  return result;
}
function rosterDepartmentMap(state, directory) {
  const result = new Map();
  const initials = clean(state?.nameInitials, 30).toUpperCase();
  const currentDepartment = clean(state?.department, 100);
  if (initials && currentDepartment) result.set(`EMP-${initials}`, currentDepartment);
  const sources = [state?.workforceRoster, state?.staff, state?.employees];
  for (const rows of sources) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const id = employeeId(row);
      const department = departmentLabel(row, directory);
      if (id && !UNASSIGNED_IDS.has(id) && department) result.set(id, department);
    }
  }
  return result;
}
function normaliseChannelMetrics(raw = {}) {
  const completed = count(raw.completed);
  const met = Math.min(completed, count(raw.met));
  return {
    total: count(raw.total),
    completed,
    met,
    late: count(raw.late),
    open: count(raw.open),
    overdue: count(raw.overdue),
    responseTargetRate: completed ? Math.round((met / completed) * 100) : null
  };
}
function addChannel(target, source) {
  target.total += source.total;
  target.completed += source.completed;
  target.met += source.met;
  target.late += source.late;
  target.open += source.open;
  target.overdue += source.overdue;
}
function emptyChannel() {
  return { total: 0, completed: 0, met: 0, late: 0, open: 0, overdue: 0, responseTargetRate: null };
}
function buildDepartmentComparisons(state, performance, digitalAgents, now) {
  const directory = departmentDirectory(state);
  const roster = rosterDepartmentMap(state, directory);
  const rawRows = Array.isArray(performance?.agents) ? performance.agents : [];
  const baseById = new Map(digitalAgents.map(row => [normaliseId(row.agentId), row]));
  const groups = new Map();
  const seenAgentIds = new Set();
  let mappedAgentCount = 0;

  for (const raw of rawRows) {
    if (!raw || typeof raw !== 'object') continue;
    const id = employeeId(raw);
    if (!id || UNASSIGNED_IDS.has(id)) continue;
    const base = baseById.get(id);
    if (!base || seenAgentIds.has(id)) continue;
    const department = departmentLabel(raw, directory) || roster.get(id) || '';
    if (!department) continue;
    seenAgentIds.add(id);
    mappedAgentCount += 1;
    if (!groups.has(department)) {
      groups.set(department, {
        department,
        agents: 0,
        completed: 0,
        met: 0,
        open: 0,
        overdue: 0,
        atRisk: 0,
        totalCycles: 0
      });
    }
    const group = groups.get(department);
    group.agents += 1;
    group.completed += count(base.completed);
    group.met += Math.min(count(base.completed), count(raw.met));
    group.open += count(base.open);
    group.overdue += count(base.overdue);
    group.atRisk += count(base.atRisk);
    group.totalCycles += count(base.totalCycles);
  }
  const rows = [...groups.values()].map(row => ({
    ...row,
    responseTargetRate: row.completed ? Math.round((row.met / row.completed) * 100) : null,
    openPerAgent: row.agents ? round(row.open / row.agents, 1) : null
  })).sort((a, b) => b.overdue - a.overdue || b.atRisk - a.atRisk
    || (a.responseTargetRate ?? 101) - (b.responseTargetRate ?? 101)
    || a.department.localeCompare(b.department));
  const totalIdentified = digitalAgents.length;
  return {
    rows,
    mappedAgentCount,
    identifiedAgentCount: totalIdentified,
    coveragePercent: totalIdentified ? Math.round(mappedAgentCount / totalIdentified * 100) : 0,
    available: rows.length > 0,
    evaluatedAt: new Date(now).toISOString(),
    source: 'Explicit department fields or exact employee-ID roster mapping only.'
  };
}
function buildWorkstreams(state, performance, baseBoard) {
  const totals = Object.fromEntries(CHANNELS.map(channel => [channel.id, emptyChannel()]));
  const agents = Array.isArray(performance?.agents) ? performance.agents : [];
  for (const agent of agents) {
    if (!agent || typeof agent !== 'object') continue;
    const id = employeeId(agent);
    if (!id || UNASSIGNED_IDS.has(id)) continue;
    for (const channel of CHANNELS) {
      const raw = agent.byChannel?.[channel.id];
      if (!raw || typeof raw !== 'object') continue;
      addChannel(totals[channel.id], normaliseChannelMetrics(raw));
    }
  }
  const digital = CHANNELS.map(channel => {
    const row = totals[channel.id];
    row.responseTargetRate = row.completed ? Math.round(row.met / row.completed * 100) : null;
    return { id: channel.id, label: channel.label, ...row, available: row.total > 0 };
  });
  const identifiedAgents = baseBoard.digitalAgents;
  const attributedOpen = digital.reduce((sum, row) => sum + row.open, 0);
  const identifiedOpen = identifiedAgents.reduce((sum, row) => sum + count(row.open), 0);
  const unattributedOpen = Math.max(0, identifiedOpen - attributedOpen);
  const attributedCompleted = digital.reduce((sum, row) => sum + row.completed, 0);
  const identifiedCompleted = identifiedAgents.reduce((sum, row) => sum + count(row.completed), 0);
  const unattributedCompleted = Math.max(0, identifiedCompleted - attributedCompleted);
  if (unattributedOpen > 0 || unattributedCompleted > 0) {
    digital.push({ id: 'unmapped', label: 'Channel not recorded', total: unattributedOpen + unattributedCompleted, completed: unattributedCompleted, met: 0, late: 0, open: unattributedOpen, overdue: 0, responseTargetRate: null, available: true, scope: 'Agent totals with missing channel attribution' });
  }
  const voice = baseBoard.profile.voice;
  const voiceRow = {
    id: 'voice', label: 'Voice', available: voice.totalInteractions > 0,
    total: voice.totalInteractions, completed: voice.totalInteractions,
    met: null, late: null, open: null, overdue: null,
    responseTargetRate: null, resolutionRate: voice.resolutionRate,
    inboundHandled: voice.inboundHandled, outboundHandled: voice.outboundHandled,
    scope: 'Current local employee profile only'
  };
  return {
    rows: [voiceRow, ...digital],
    digitalBacklog: identifiedOpen,
    digitalOverdue: digital.reduce((sum, row) => sum + row.overdue, 0),
    digitalCompleted: identifiedCompleted,
    digitalTotalCycles: digital.reduce((sum, row) => sum + row.total, 0),
    unattributedOpen,
    unattributedCompleted
  };
}
function buildCapacityScenarios(backlog, assumptions) {
  const targetRaw = finite(assumptions?.maxOpenItemsPerSeat, 5);
  const maxOpenItemsPerSeat = Math.min(50, Math.max(1, Math.round(targetRaw ?? 5)));
  const plannedRaw = finite(assumptions?.plannedSeats, null);
  const plannedSeats = plannedRaw === null ? null : Math.min(10000, Math.max(0, Math.floor(plannedRaw)));
  const scenarios = SCENARIOS.map(item => {
    const projectedBacklog = Math.ceil(backlog * item.multiplier);
    const requiredSeats = projectedBacklog ? Math.ceil(projectedBacklog / maxOpenItemsPerSeat) : 0;
    const gap = plannedSeats === null ? null : requiredSeats - plannedSeats;
    return {
      ...item,
      projectedBacklog,
      requiredSeats,
      plannedSeats,
      staffingGap: gap,
      status: gap === null ? 'Add planned seats to compare' : gap > 0 ? `${gap} seat(s) short` : gap < 0 ? `${Math.abs(gap)} seat(s) above modelled need` : 'At modelled requirement'
    };
  });
  return {
    method: 'Backlog stress test: current open digital follow-up cycles multiplied by a scenario factor, then divided by the chosen open-items-per-seat planning assumption.',
    backlog,
    maxOpenItemsPerSeat,
    plannedSeats,
    scenarios,
    isForecast: false
  };
}
function priorityFor(agent) {
  if (agent.overdue > 0) return { label: 'Overdue work', action: 'Rebalance overdue follow-ups and confirm named owners.', severity: 'high' };
  if (agent.atRisk > 0) return { label: 'At-risk work', action: 'Review due-time risk and protect response capacity.', severity: 'medium' };
  if (agent.responseTargetRate !== null && agent.responseTargetRate < 80) return { label: 'Low response target rate', action: 'Review missed targets and identify workflow blockers.', severity: 'medium' };
  return { label: 'Monitor', action: 'Continue routine workload monitoring.', severity: 'low' };
}

/**
 * Build a read-only command centre from v7.29 evidence and v7.24 channel rows.
 * Options are session-only planning assumptions entered by a supervisor.
 */
export function workforceCommandCentreBoard(state = {}, digitalPerformance = {}, assumptions = {}, now = Date.now()) {
  const source = state && typeof state === 'object' ? state : {};
  const performance = digitalPerformance && typeof digitalPerformance === 'object' ? digitalPerformance : {};
  const safeNow = Math.max(0, finite(now, Date.now()));
  const baseBoard = workforceIntelligenceBoard(
    source,
    performance,
    source.digitalFollowUpCoachingPlans,
    source.digitalCareerReviewPackets,
    safeNow
  );
  const workstreams = buildWorkstreams(source, performance, baseBoard);
  const departments = buildDepartmentComparisons(source, performance, baseBoard.digitalAgents, safeNow);
  const riskAgents = baseBoard.digitalAgents
    .map(agent => ({ ...agent, priority: priorityFor(agent) }))
    .filter(agent => agent.overdue > 0 || agent.atRisk > 0
      || (agent.responseTargetRate !== null && agent.responseTargetRate < 80))
    .sort((a, b) => b.overdue - a.overdue || b.atRisk - a.atRisk
      || (a.responseTargetRate ?? 101) - (b.responseTargetRate ?? 101)
      || b.open - a.open || a.agentId.localeCompare(b.agentId))
    .slice(0, 8);
  const capacity = buildCapacityScenarios(workstreams.digitalBacklog, assumptions);
  const totalOpen = workstreams.digitalBacklog;
  const totalOverdue = baseBoard.digitalOperations.overdue;
  const availableChannels = workstreams.rows.filter(row => ['email', 'live_chat', 'social'].includes(row.id) && row.available).length;
  return {
    version: WORKFORCE_COMMAND_CENTRE_VERSION,
    evaluatedAt: new Date(safeNow).toISOString(),
    summary: {
      digitalAgents: baseBoard.digitalOperations.agents,
      completedReplies: workstreams.digitalCompleted,
      openDigitalWork: totalOpen,
      overdueDigitalWork: totalOverdue,
      atRiskDigitalWork: baseBoard.digitalOperations.atRisk,
      responseTargetRate: baseBoard.digitalOperations.responseTargetRate,
      workstreamsAvailable: availableChannels,
      departmentsAvailable: departments.rows.length,
      agentsNeedingSupervisorAttention: riskAgents.length
    },
    workstreams,
    departments,
    riskAgents,
    capacity,
    career: {
      pendingReviewPackets: baseBoard.digitalOperations.pendingCareerPackets,
      readyForHumanReview: baseBoard.digitalOperations.agentsWithCareerReviewReadiness,
      developmentRequired: baseBoard.digitalOperations.developmentRequired,
      sustainmentPending: baseBoard.digitalOperations.sustainmentPending
    },
    boundaries: [
      'Voice figures describe the current local employee profile only; they are not organisation-wide voice totals.',
      'Email, Live Chat and Social comparisons use retained per-agent channel cycles, not live provider queues or real-time agent presence.',
      'Department comparisons appear only where explicit department fields or an exact employee-ID workforce roster mapping exists. Unmapped agents are not guessed into departments.',
      'Capacity scenarios stress-test the current digital backlog. They are not arrival-rate forecasts, schedules, occupancy measurements or live staffing instructions.',
      'This command centre is read-only. It does not reassign work, change shifts, alter staffing, modify employee records or make HR decisions.'
    ]
  };
}

export function workforceCommandCentreCsv(board = {}) {
  const rows = [['section', 'name', 'agents', 'completed', 'on_target_percent', 'open', 'overdue', 'at_risk']];
  for (const row of board.workstreams?.rows || []) {
    rows.push(['workstream', row.label, '', row.completed ?? '', row.responseTargetRate ?? '', row.open ?? '', row.overdue ?? '', '']);
  }
  for (const row of board.departments?.rows || []) {
    rows.push(['department', row.department, row.agents, row.completed, row.responseTargetRate ?? '', row.open, row.overdue, row.atRisk]);
  }
  for (const row of board.riskAgents || []) {
    rows.push(['agent_risk', row.agentId, 1, row.completed, row.responseTargetRate ?? '', row.open, row.overdue, row.atRisk]);
  }
  return rows.map(row => row.map(value => {
    const text = String(value ?? '');
    const safe = /^[=+@\t\r-]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
}
