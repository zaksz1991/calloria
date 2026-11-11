import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { __calloriaV44Test as plugin } from '../build/calloria-first-working-shift-v4-4-plugin.mjs';

const source = `
${plugin.IMPORT_ANCHOR}
function renderInbound() {
  if (!state.shiftActive) return;
  const call=state.currentCall;
  const scenario=inboundScenarios.find(item=>item.id===call.scenarioId);
  const contact=findQueueContact(call.queueContactId);
  const supervisorOpen=false;
  viewRoot.innerHTML = \`<div class="call-layout"><section>Legacy multiple-choice call panel</section></div>\`;
}
function ensureDigitalQueue() {}
function startInboundCall(){
  const scenario=inboundScenarios[0];
  const contact={id:'CONTACT-1'};
  const acceptedAt=Date.now();
${plugin.CALL_START_ANCHOR}
}
function beginInboundWrapUp(transferred=false){
  const call=state.currentCall;
  const wrap={${plugin.DEFAULT_DISPOSITION_ANCHOR}};
  const qa=Math.max(0,Math.min(100,Math.round(70+call.score*5-(call.breach?35:0))));
}
function renderWrapUp(){
  const allowed = inbound\n    ? ((wrap.breach || wrap.transferred) ? [['escalated','Escalate to specialist / quality review']] : [['resolved','Resolved'],['escalated','Escalated to specialist'],['callback','Callback required']]) : [];
}
function saveWrapUp(){
  const allowedDispositions=inbound\n    ? ((wrap.breach||wrap.transferred)?['escalated']:['resolved','escalated','callback']):[];
  const record={reference:wrap.reference,owner:state.applicantName||'Agent',${plugin.CASE_RECORD_ANCHOR}
}
function handleAction(action){
  switch(action){
${plugin.ACTION_ANCHOR}
  }
}
${plugin.SUBMIT_ANCHOR}
  if(e.target.id==='otherForm') return;
});
`;

function callTransform(input=source,warnings=[]) {
  return plugin.transformMain({warn:message=>warnings.push(String(message))},input);
}

test('replaces the inbound quiz panel with a conversational live-shift workspace', () => {
  const result=callTransform();
  assert.ok(result?.code);
  assert.match(result.code,/YOUR RESPONSE TO THE CUSTOMER/);
  assert.match(result.code,/v44-transcript/);
  assert.doesNotMatch(result.code,/Legacy multiple-choice call panel/);
});

test('initialises the conversation when an actual queued inbound contact is accepted', () => {
  const result=callTransform();
  assert.match(result.code,/state\.currentCall\.conversation=createOperationalConversation\(\{id:contact\.id,scenario,seed:acceptedAt\}\)/);
  assert.match(result.code,/operational-conversation-engine\.js/);
});

test('intercepts only the live call response form and records operational metrics', () => {
  const result=callTransform();
  assert.match(result.code,/operationalCallReplyForm/);
  assert.match(result.code,/active\.operationalQa=summary\.averageScore/);
  assert.match(result.code,/state\.incidents\+=result\.evaluation\.criticalBreaches\.length/);
  assert.match(result.code,/addCallTimeline\(active/);
});

test('preserves the existing CRM case lifecycle and saves transcript evidence', () => {
  const result=callTransform();
  assert.match(result.code,/conversation:state\.currentCall\?\.conversation/);
  assert.match(result.code,/type:item\.speaker,text:item\.text,at:item\.at/);
  assert.match(result.code,/timeline:contact\.timeline\.slice\(\)/);
});

test('uses the interaction QA result for the production case rather than the old quiz score', () => {
  const result=callTransform();
  assert.match(result.code,/Number\.isFinite\(call\.operationalQa\)/);
  assert.match(result.code,/call\.conversation\?\.dispositionHint==='escalated'/);
  assert.match(result.code,/wrap\.defaultDisposition==='escalated'/);
  assert.match(result.code,/wrap\.defaultDisposition==='escalated'\)\?\['escalated'\]/);
});

test('refuses a partial transform when any required upstream anchor has changed', () => {
  const warnings=[];
  const result=callTransform(source.replace(plugin.CALL_START_ANCHOR,'state.currentCall = {}'),warnings);
  assert.equal(result,null);
  assert.equal(warnings.length,1);
  assert.match(warnings[0],/skipped the live inbound integration safely/);
});

test('transform is idempotent and does not inject the live interaction twice', () => {
  const once=callTransform();
  const twice=callTransform(once.code);
  assert.equal(twice,null);
  assert.equal(once.code.split(plugin.MARKER).length-1,1);
});

test('adds responsive live-contact styles to the existing application document', () => {
  const html=plugin.transformHtml('<html><head></head><body></body></html>');
  assert.match(html,/v44-transcript/);
  assert.match(html,/@media\(max-width:760px\)/);
  assert.equal(plugin.transformHtml(html),html);
});

test('transformed main module remains syntactically valid JavaScript', () => {
  const result=callTransform();
  const dir=mkdtempSync(join(tmpdir(),'calloria-v44-'));
  const file=join(dir,'transformed.mjs');
  try {
    writeFileSync(file,result.code);
    const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    assert.equal(checked.status,0,checked.stderr||checked.stdout);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
