/**
 * CALLORIA v6.99 — aggregate operations capacity outlook.
 * Pure forecast calculations from the existing Operations Intelligence snapshot.
 * This is a directional simulator report, not a staffing or contractual SLA model.
 */
const finite = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function cleanCount(value) {
  return Math.max(0, finite(value, 0));
}

function validDay(value) {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

function normaliseDailyRows(rows) {
  const byDay = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== 'object' || !validDay(row.day)) continue;
    byDay.set(row.day, {
      day: row.day,
      received: cleanCount(row.received),
      resolved: cleanCount(row.resolved)
    });
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

function average(rows, key) {
  if (!rows.length) return null;
  return rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
}

/**
 * Build a seven-day operating outlook.
 * Forecasts use the latest seven valid daily observations. At least three are
 * required; zeros are retained because a zero-volume day is meaningful data.
 */
export function buildCapacityOutlook(snapshot, { horizonDays = 7 } = {}) {
  const safeHorizon = Math.min(30, Math.max(1, Math.floor(finite(horizonDays, 7))));
  const daily = normaliseDailyRows(snapshot?.daily);
  const overview = snapshot?.overview && typeof snapshot.overview === 'object' ? snapshot.overview : {};
  const backlog = cleanCount(overview.active_work);
  const baseline = daily.slice(-7);

  if (baseline.length < 3) {
    return {
      ready: false,
      reason: 'At least three valid daily observations are required before a capacity outlook can be calculated.',
      observations: baseline.length,
      backlog,
      horizonDays: safeHorizon
    };
  }

  const averageReceivedPerDay = average(baseline, 'received');
  const averageResolvedPerDay = average(baseline, 'resolved');
  const netBacklogChangePerDay = averageReceivedPerDay - averageResolvedPerDay;
  const requiredResolutionsPerDay = averageReceivedPerDay + (backlog / safeHorizon);
  const dailyResolutionGap = requiredResolutionsPerDay - averageResolvedPerDay;
  const projectedBacklog = [1, 3, safeHorizon]
    .filter((day, index, list) => day <= safeHorizon && list.indexOf(day) === index)
    .map(day => ({
      day,
      work: Math.max(0, Math.round((backlog + netBacklogChangePerDay * day) * 10) / 10)
    }));

  let status = 'stable';
  if (backlog === 0 && netBacklogChangePerDay <= 0) status = 'clear';
  else if (netBacklogChangePerDay > 0.25) status = 'growing';
  else if (netBacklogChangePerDay < -0.25) status = 'recovering';

  const previous = daily.length >= 14 ? daily.slice(-14, -7) : [];
  const previousReceived = average(previous, 'received');
  const demandTrendPercent = previousReceived > 0
    ? ((averageReceivedPerDay - previousReceived) / previousReceived) * 100
    : null;
  const estimatedClearDays = netBacklogChangePerDay < -0.01
    ? backlog / Math.abs(netBacklogChangePerDay)
    : null;
  const upliftPercent = averageResolvedPerDay > 0
    ? Math.max(0, (requiredResolutionsPerDay / averageResolvedPerDay - 1) * 100)
    : (requiredResolutionsPerDay > 0 ? null : 0);

  return {
    ready: true,
    observations: baseline.length,
    firstObservedDay: baseline[0].day,
    lastObservedDay: baseline.at(-1).day,
    backlog,
    horizonDays: safeHorizon,
    averageReceivedPerDay: round1(averageReceivedPerDay),
    averageResolvedPerDay: round1(averageResolvedPerDay),
    netBacklogChangePerDay: round1(netBacklogChangePerDay),
    requiredResolutionsPerDay: round1(requiredResolutionsPerDay),
    dailyResolutionGap: round1(dailyResolutionGap),
    upliftPercent: upliftPercent === null ? null : round1(upliftPercent),
    demandTrendPercent: demandTrendPercent === null ? null : round1(demandTrendPercent),
    estimatedClearDays: estimatedClearDays === null ? null : round1(estimatedClearDays),
    projectedBacklog,
    status
  };
}

function round1(value) {
  return Math.round(value * 10) / 10;
}
