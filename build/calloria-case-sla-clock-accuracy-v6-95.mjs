/**
 * CALLORIA v6.95 — simulated case follow-up SLA clock integrity.
 *
 * Composes the v6.94 transactional closure guard with a correction to the
 * pending-customer due-time calculation. The case engine is transformed only
 * at a uniquely verified source anchor; otherwise the build fails closed.
 */
import { transformCaseLifecycleV694 } from './calloria-case-resolution-transaction-guard-v6-94.mjs';

const TARGET = '/js/case-lifecycle-engine.js';
const MARKER = '__CALLORIA_CASE_SLA_CLOCK_ACCURACY_V695__';

function occurrences(source, anchor) {
  return String(source).split(anchor).length - 1;
}

function replaceExactlyOnce(source, anchor, replacement, label) {
  const found = occurrences(source, anchor);
  if (found !== 1) {
    throw new Error(`CALLORIA v6.95 source rebase failed: ${label}; expected exactly one anchor, found ${found}. No partial transform was applied.`);
  }
  return String(source).replace(anchor, replacement);
}

export function transformCaseLifecycleV695(source) {
  const original = String(source ?? '');
  if (original.includes(MARKER)) return original;

  // Always carry the v6.94 guard, even when the standalone v6.94 plugin has
  // not been registered in vite.config.js. Its marker makes this composition
  // idempotent when v6.94 is also registered earlier in the plugin chain.
  let code = transformCaseLifecycleV694(original);

  const anchor = [
    "  } else if (outcome === 'pending_customer') {",
    '    const due = fromAbsoluteMinute(absoluteMinute(clock) + 1440);',
    "    followUp.status = 'open';",
    "    followUp.claimedBy = '';",
    '    followUp.claimedAt = null;',
    '    followUp.dueDay = due.day;',
    '    followUp.dueMinute = 600;'
  ].join('\n');

  const replacement = [
    "  } else if (outcome === 'pending_customer') {",
    '    // Pending customer responses are due at 10:00 on the next simulated workday.',
    '    // Keep the day rollover and clock time consistent instead of mixing +24h with a fixed 10:00.',
    '    const due = { day: clock.day + 1, minutes: 600 };',
    "    followUp.status = 'open';",
    "    followUp.claimedBy = '';",
    '    followUp.claimedAt = null;',
    '    followUp.dueDay = due.day;',
    '    followUp.dueMinute = due.minutes;'
  ].join('\n');

  code = replaceExactlyOnce(code, anchor, replacement, 'pending-customer SLA due-time calculation');
  return `/* ${MARKER} */\n${code}`;
}

export function calloriaCaseSlaClockAccuracyPluginV695() {
  return {
    name: 'calloria-case-sla-clock-accuracy-v6-95',
    enforce: 'post',
    transform(code, id) {
      const normalized = String(id || '').replace(/\\/g, '/').replace(/[?#].*$/, '');
      if (!normalized.endsWith(TARGET) || String(code).includes(MARKER)) return null;
      try {
        return { code: transformCaseLifecycleV695(code), map: null };
      } catch (error) {
        this.error(error.message || String(error));
      }
    }
  };
}
