/**
 * CALLORIA v7.29 — workforce performance intelligence bridge.
 *
 * Combines the current local employee's retained voice, QA, CSAT and shift
 * evidence with digital follow-up evidence only when the employee IDs match.
 * Other digital agents remain explicitly digital-only. Missing source data is
 * left unscored. This is a read-only operational view, never an HR decision.
 */
import { digitalCareerEvidenceBoard } from './digital-career-evidence-engine-v728.js';

export const WORKFORCE_INTELLIGENCE_VERSION = '7.29.0';
const UNASSIGNED_IDS = new Set(['', 'UNASSIGNED', 'ALL_AGENTS']);
const INDEX_WEIGHTS = Object.freeze({ qa: 30, csat: 25, digitalSla: 25, shiftAdherence: 20 });

function finite(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function count(value) {
  const number = finite(value, 0);
  return Math.max(0, Math.floor(number));
}

function safeText(value, fallback = '', max = 100) {
  const text = String(value ?? fallback).trim();
  return text.slice(0, max);
}

function average(total, samples) {
  const n = count(samples);
  const sum = finite(total);
  return n > 0 && sum !== null ? sum / n : null;
}

function rounded(value, places = 1) {
  if (!Number.isFinite(Number(value))) return null;
  const factor = 10 ** places;
  return Math.round(Number(value) * factor) / factor;
}

function scoreIndex(metrics) {
  const entries = Object.entries(INDEX_WEIGHTS)
    .map(([key, weight]) => ({ key, weight, value: finite(metrics[key]) }))
    .filter(row => row.value !== null);
  const availableWeight = entries.reduce((sum, row) => sum + row.weight, 0);
  if (entries.length < 2 || availableWeight === 0) {
    return {
      value: null,
      label: 'Insufficient evidence',
      dimensionsAvailable: entries.length,
      dimensionsRequired: 2,
      coveragePercent: availableWeight,
      availableWeight,
      dimensions: entries
    };
  }
  const weighted = entries.reduce((sum, row) => sum + row.value * row.weight, 0) / availableWeight;
  return {
    value: Math.max(0, Math.min(100, Math.round(weighted))),
    label: 'Service evidence index',
    dimensionsAvailable: entries.length,
    dimensionsRequired: 2,
    coveragePercent: availableWeight,
    availableWeight,
    dimensions: entries
  };
}

function shiftFacts(history) {
  const rows = (Array.isArray(history) ? history : []).filter(row => row && typeof row === 'object');
  const adherence = rows.map(row => finite(row.adherence)).filter(value => value !== null);
  const completed = rows.filter(row => !row.status || ['completed', 'closed'].includes(String(row.status).toLowerCase()));
  return {
    recordedShifts: rows.length,
    completedShifts: completed.length,
    averageAdherence: adherence.length ? rounded(adherence.reduce((sum, value) => sum + value, 0) / adherence.length) : null,
    latestAdherence: adherence.length ? rounded(adherence.at(-1)) : null,
    adherenceSamples: adherence.length
  };
}

function criticalVoiceFlags(cases) {
  return (Array.isArray(cases) ? cases : []).filter(item => {
    if (!item || typeof item !== 'object') return false;
    if (item.voiceSecurityBreach === true || item.criticalComplianceBreach === true) return true;
    const flags = Array.isArray(item.voiceQualityFlags) ? item.voiceQualityFlags : [];
    return flags.some(flag => ['prohibited_secret_request', 'critical_handling_breach'].includes(String(flag)));
  }).length;
}

function digitalAgentRows(performance, careerBoard) {
  const careerById = new Map((careerBoard?.agents || []).map(row => [row.agentId, row]));
  return (Array.isArray(performance?.agents) ? performance.agents : [])
    .filter(row => row && !UNASSIGNED_IDS.has(safeText(row.agentId)))
    .map(row => {
      const career = careerById.get(safeText(row.agentId)) || null;
      return {
        agentId: safeText(row.agentId),
        completed: count(row.completed),
        met: count(row.met),
        totalCycles: count(row.totalCycles),
        responseTargetRate: finite(row.responseTargetRate),
        averageResponseMinutes: finite(row.averageResponseMinutes),
        overdue: count(row.overdue),
        atRisk: count(row.atRisk),
        open: count(row.open),
        late: count(row.late),
        careerStatus: career?.readinessLabel || 'Digital evidence only',
        careerReadinessScore: career?.readinessScore ?? null,
        careerReviewReady: career?.reviewReady === true
      };
    })
    .sort((a, b) => b.overdue - a.overdue || b.atRisk - a.atRisk
      || (a.responseTargetRate ?? 101) - (b.responseTargetRate ?? 101)
      || b.completed - a.completed || a.agentId.localeCompare(b.agentId));
}

/**
 * Build a read-only workforce evidence board from existing local simulation
 * counters and v7.24-v7.28 digital follow-up/coaching evidence.
 */
export function workforceIntelligenceBoard(state = {}, digitalPerformance = {}, coachingPlans = [], careerPackets = [], now = Date.now()) {
  const source = state && typeof state === 'object' ? state : {};
  const performance = digitalPerformance && typeof digitalPerformance === 'object' ? digitalPerformance : {};
  const safeNow = finite(now, Date.now());
  const nameInitials = safeText(source.nameInitials, 'AGENT', 30) || 'AGENT';
  // CALLORIA's own assignment migration uses this exact employee-key convention.
  const employeeId = `EMP-${nameInitials}`;
  const careerBoard = digitalCareerEvidenceBoard(performance, coachingPlans, careerPackets, safeNow);
  const digitalRows = digitalAgentRows(performance, careerBoard);
  const employeeDigital = digitalRows.find(row => row.agentId === employeeId) || null;

  const inboundVoice = count(source.callsHandled);
  const outboundVoice = count(source.outboundCalls);
  const voiceInteractions = inboundVoice + outboundVoice;
  const qaSamples = count(source.qaCount);
  const qaAverage = average(source.totalQA, qaSamples);
  const csatSamples = count(source.csatCount);
  const csatAverage = average(source.totalCSAT, csatSamples);
  const shifts = shiftFacts(source.shiftHistory);
  const incidents = finite(source.incidents);
  const criticalFlags = criticalVoiceFlags(source.cases);
  const digitalCompleted = employeeDigital?.completed ?? null;
  const responseTargetRate = employeeDigital?.responseTargetRate ?? null;
  const resolutionRate = inboundVoice > 0 ? rounded((count(source.resolutions) / inboundVoice) * 100) : null;
  // Sum only individually attributed agents; exclude unassigned/aggregate rows.
  const totalDigitalCompleted = digitalRows.reduce((sum, row) => sum + row.completed, 0);
  const totalDigitalMet = digitalRows.reduce((sum, row) => sum + row.met, 0);
  const totalDigitalCycles = digitalRows.reduce((sum, row) => sum + row.totalCycles, 0);
  const totalDigitalOverdue = digitalRows.reduce((sum, row) => sum + row.overdue, 0);
  const totalDigitalAtRisk = digitalRows.reduce((sum, row) => sum + row.atRisk, 0);
  const totalDigitalOpen = digitalRows.reduce((sum, row) => sum + row.open, 0);
  const attributedDigitalTargetRate = totalDigitalCompleted > 0
    ? Math.round(totalDigitalMet / totalDigitalCompleted * 100)
    : null;
  const totalInteractionsForProfile = voiceInteractions + count(digitalCompleted);
  const interactionsPerShift = shifts.completedShifts > 0
    ? rounded(totalInteractionsForProfile / shifts.completedShifts, 1)
    : null;

  const index = scoreIndex({
    qa: qaAverage,
    csat: csatAverage === null ? null : Math.max(0, Math.min(100, csatAverage * 20)),
    digitalSla: responseTargetRate,
    shiftAdherence: shifts.averageAdherence
  });
  const careerAgent = careerBoard.agents.find(row => row.agentId === employeeId) || null;
  const hasProfileEvidence = voiceInteractions > 0 || qaSamples > 0 || csatSamples > 0
    || shifts.recordedShifts > 0 || Boolean(employeeDigital?.totalCycles);

  const complianceStatus = incidents === null
    ? 'Not available'
    : (incidents > 0 || criticalFlags > 0 ? 'Supervisor review required' : 'No recorded incident');

  const profile = {
    employeeId,
    displayName: safeText(source.applicantName, 'Current employee', 80) || 'Current employee',
    hasEvidence: hasProfileEvidence,
    serviceIndex: index,
    voice: {
      inboundHandled: inboundVoice,
      outboundHandled: outboundVoice,
      totalInteractions: voiceInteractions,
      resolutions: count(source.resolutions),
      resolutionRate,
      averageHandleMinutes: average(source.totalHandleMinutes, inboundVoice)
    },
    digital: employeeDigital ? {
      matched: true,
      completed: employeeDigital.completed,
      totalCycles: employeeDigital.totalCycles,
      responseTargetRate: employeeDigital.responseTargetRate,
      averageResponseMinutes: employeeDigital.averageResponseMinutes,
      overdue: employeeDigital.overdue,
      atRisk: employeeDigital.atRisk,
      open: employeeDigital.open
    } : {
      matched: false,
      completed: null,
      totalCycles: 0,
      responseTargetRate: null,
      averageResponseMinutes: null,
      overdue: null,
      atRisk: null,
      open: null
    },
    quality: { averageScore: qaAverage === null ? null : rounded(qaAverage), samples: qaSamples },
    satisfaction: { averageScore: csatAverage === null ? null : rounded(csatAverage, 2), samples: csatSamples, scale: '1–5' },
    shifts,
    productivity: {
      totalRecordedInteractions: totalInteractionsForProfile,
      interactionsPerCompletedShift: interactionsPerShift,
      completedShifts: shifts.completedShifts
    },
    compliance: {
      incidentCount: incidents,
      criticalVoiceFlags: criticalFlags,
      status: complianceStatus,
      note: 'A zero count means no incident is present in the retained local simulation register; it is not an external audit or certification.'
    },
    career: careerAgent ? {
      readinessStatus: careerAgent.readinessStatus,
      readinessLabel: careerAgent.readinessLabel,
      readinessScore: careerAgent.readinessScore,
      reviewReady: careerAgent.reviewReady,
      blocks: careerAgent.blocks.slice(),
      latestPacketStatus: careerAgent.latestPacket?.status || null
    } : null
  };

  const sources = [
    { id: 'voice', label: 'Voice operations', available: voiceInteractions > 0, samples: voiceInteractions },
    { id: 'digital', label: 'Digital follow-up', available: Boolean(employeeDigital?.totalCycles), samples: count(employeeDigital?.totalCycles) },
    { id: 'qa', label: 'Quality assurance', available: qaSamples > 0, samples: qaSamples },
    { id: 'csat', label: 'Customer satisfaction', available: csatSamples > 0, samples: csatSamples },
    { id: 'shift', label: 'Shift adherence', available: shifts.adherenceSamples > 0, samples: shifts.adherenceSamples },
    { id: 'compliance', label: 'Incident register', available: incidents !== null, samples: incidents ?? 0 }
  ];

  return {
    version: WORKFORCE_INTELLIGENCE_VERSION,
    evaluatedAt: new Date(safeNow).toISOString(),
    profile,
    sources,
    sourceCoverage: {
      available: sources.filter(row => row.available).length,
      total: sources.length,
      percent: Math.round(sources.filter(row => row.available).length / sources.length * 100)
    },
    digitalOperations: {
      agents: digitalRows.length,
      completedReplies: totalDigitalCompleted,
      totalCycles: totalDigitalCycles,
      responseTargetRate: attributedDigitalTargetRate,
      overdue: totalDigitalOverdue,
      atRisk: totalDigitalAtRisk,
      open: totalDigitalOpen,
      agentsWithCareerReviewReadiness: careerBoard.readyForReview,
      developmentRequired: careerBoard.developmentRequired,
      sustainmentPending: careerBoard.sustainmentPending,
      insufficientEvidence: careerBoard.insufficientEvidence,
      pendingCareerPackets: careerBoard.pendingPackets
    },
    digitalAgents: digitalRows,
    boundaries: [
      'Voice, QA, CSAT and shift figures are the current local employee profile counters, not verified organisation-wide aggregates.',
      'Digital agent rows retain exact responding-agent attribution. The current employee profile is joined only when its EMP-<initials> ID matches exactly.',
      'Other agents are digital-only until the same employee IDs are recorded consistently in each channel.',
      'Missing source evidence is unscored. This board does not make hiring, disciplinary, pay, promotion or termination decisions.'
    ]
  };
}
