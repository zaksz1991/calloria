const PLUGIN_NAME = 'calloria-qa-quality-intelligence-v6-98';
const MARKER = 'CALLORIA_V6_98_QA_QUALITY_INTELLIGENCE';

function count(text, needle) {
  return text.split(needle).length - 1;
}

function findSingleLine(source, prefix) {
  const lines = source.split('\n');
  const matches = lines.filter(line => line.includes(prefix));
  return matches.length === 1 ? matches[0] : null;
}

export function calloriaQAQualityIntelligencePluginV698() {
  return {
    name: PLUGIN_NAME,
    enforce: 'post',
    transform(code, id) {
      const cleanId = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (!cleanId.endsWith('/js/main.js') && cleanId !== 'js/main.js') return null;
      if (code.includes(MARKER)) return null;

      const qaImport = "import { DEFAULT_QA_SCORECARD, createScorecard, createHumanQAReview, createQADispute, resolveQADispute, createCalibrationSession, humanQAMetrics } from './qa-workspace-engine.js';";
      const importAnchorCount = count(code, qaImport);
      const calibratableLine = findSingleLine(code, 'const calibratable = [...new Set(reviews.filter(');
      const reportInsertion = '     <div class="grid two qa-workspace-grid" style="margin-top:14px">\n       <section class="panel"><div class="panel-head"><div><h3>Agent score dispute';
      const reportAnchorCount = count(code, reportInsertion);

      const mismatches = [];
      if (importAnchorCount !== 1) mismatches.push(`human QA engine import expected once, found ${importAnchorCount}`);
      if (!calibratableLine) mismatches.push('reviewer calibration group anchor was missing or ambiguous');
      if (reportAnchorCount !== 1) mismatches.push(`QA dispute/calibration panel insertion point expected once, found ${reportAnchorCount}`);
      if (mismatches.length) {
        this.warn(`[${PLUGIN_NAME}] skipped safely: ${mismatches.join('; ')}. No source changes were applied.`);
        return null;
      }

      let output = code;
      output = output.replace(qaImport, `${qaImport}\nimport { renderQAQualityIntelligence } from './qa-quality-intelligence-v698.js';\nimport './qa-quality-intelligence-v698.css'; // ${MARKER}_IMPORT`);
      output = output.replace(calibratableLine, `${calibratableLine}\n  const qaQualityIntelligenceMarkup = renderQAQualityIntelligence({ reviews, calibrations, disputes }); // ${MARKER}_DATA`);
      output = output.replace(reportInsertion, `       <!-- ${MARKER}_PANEL -->\n       ${'${qaQualityIntelligenceMarkup}'}\n${reportInsertion}`);
      output += `\n// ${MARKER}_V698`;
      return { code: output, map: null };
    }
  };
}
