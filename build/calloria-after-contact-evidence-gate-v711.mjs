const MARKER = '/* CALLORIA_V711_AFTER_CONTACT_EVIDENCE_GATE */';
const MAIN_SUFFIX = '/js/main.js';
function count(source, needle) { return source.split(needle).length - 1; }
function replaceExactlyOnce(source, needle, replacement, label) {
  const found = count(source, needle);
  if (found !== 1) throw new Error(`CALLORIA v7.11 could not safely patch ${label}: expected exactly one anchor, found ${found}. No partial transform was applied.`);
  return source.replace(needle, replacement);
}
export function calloriaAfterContactEvidenceGatePluginV711() {
  return {
    name: 'calloria-after-contact-evidence-gate-v7-11',
    enforce: 'post',
    transform(code, id) {
      const cleanId = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (!cleanId.endsWith(MAIN_SUFFIX)) return null;
      if (code.includes(MARKER)) return null;
      const anchors = [
        ['let THREE = null;', 'main module import location'],
        ['<div class="article-box"><h4>After-contact checklist</h4>', 'after-contact checklist insertion point'],
        ["  if(!allowedDispositions.includes(disposition)){toast('Choose a permitted final disposition for this interaction.','error');return;}\n  const createdAt=new Date().toISOString();", 'after-contact validation point'],
        ['state.cases.push(record);recordCustomerContinuityFromCase(record,', 'inbound case persistence point'],
        ['state.outboundAttempts.push(attemptRecord);', 'outbound attempt persistence point'],
        ['state.cases.push(outboundCase);', 'outbound case persistence point']
      ];
      for (const [needle, label] of anchors) {
        const found = count(code, needle);
        if (found !== 1) throw new Error(`CALLORIA v7.11 source rebase failed: ${label} expected exactly one match, found ${found}. No partial transform was applied.`);
      }
      let transformed = code;
      transformed = replaceExactlyOnce(transformed, 'let THREE = null;',
        `import { renderWrapEvidencePanel, validateWrapEvidence } from './calloria-wrap-evidence-v711.js';\n${MARKER}\nlet THREE = null;`, 'main module import location');
      transformed = replaceExactlyOnce(transformed, '<div class="article-box"><h4>After-contact checklist</h4>',
        '${renderWrapEvidencePanel({ disposition: defaultDisposition, noConnectOutcome })}<div class="article-box"><h4>After-contact checklist</h4>', 'after-contact checklist insertion point');
      const validationAnchor = "  if(!allowedDispositions.includes(disposition)){toast('Choose a permitted final disposition for this interaction.','error');return;}\n  const createdAt=new Date().toISOString();";
      const validationReplacement = `  if(!allowedDispositions.includes(disposition)){toast('Choose a permitted final disposition for this interaction.','error');return;}
  const evidenceCheck=validateWrapEvidence({disposition,noConnectOutcome,values:{category:$('#wrapIssueCategory')?.value||'',rootCause:$('#wrapRootCause')?.value||'',action:$('#wrapPrimaryAction')?.value||'',customerUnderstanding:$('#wrapCustomerUnderstanding')?.value||'',factsConfirmed:$('#wrapFactsConfirmed')?.checked===true},notes});
  if(!evidenceCheck.ok){toast(evidenceCheck.errors[0]||'Complete the case outcome evidence before saving.','warning');document.getElementById(evidenceCheck.focusId||'wrapIssueCategory')?.focus();return;}
  const qualityEvidence=evidenceCheck.evidence;
  const createdAt=new Date().toISOString();`;
      transformed = replaceExactlyOnce(transformed, validationAnchor, validationReplacement, 'after-contact validation point');
      transformed = replaceExactlyOnce(transformed, 'state.cases.push(record);recordCustomerContinuityFromCase(record,',
        'record.wrapEvidence=qualityEvidence;\n     state.cases.push(record);recordCustomerContinuityFromCase(record,', 'inbound case persistence point');
      transformed = replaceExactlyOnce(transformed, 'state.outboundAttempts.push(attemptRecord);',
        'attemptRecord.wrapEvidence=qualityEvidence;\n     state.outboundAttempts.push(attemptRecord);', 'outbound attempt persistence point');
      transformed = replaceExactlyOnce(transformed, 'state.cases.push(outboundCase);',
        'outboundCase.wrapEvidence=qualityEvidence;\n     state.cases.push(outboundCase);', 'outbound case persistence point');
      return { code: transformed, map: null };
    }
  };
}
