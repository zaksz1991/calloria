import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { __calloriaV45Test as plugin } from '../build/calloria-outbound-campaign-v4-5-plugin.mjs';

const source = `
${plugin.V44_IMPORT_ANCHOR}
function renderOutbound() {
  if(state.wrapUp?.type==='outbound')return renderWrapUp();
  if (!state.shiftActive) return;
  if (state.activeOutbound) { return; }
  viewRoot.innerHTML = '<div>Legacy outbound quiz</div>';
}
function caseRow(c) { return c.title; }
function renderWrapUp(){
  const inbound=false;
  const allowed = inbound ? [] ${plugin.WRAP_UI_ANCHOR}
}
function saveWrapUp(){
  const inbound=false;
  const allowedDispositions = inbound ? [] ${plugin.WRAP_SAVE_ANCHOR}
  const active=state.activeOutbound;
  const task=outboundCampaigns.find(item=>item.id===wrap.campaignId);
  ${plugin.CASE_RECORD_ANCHOR}
  ${plugin.ATTEMPT_RECORD_ANCHOR}
  ${plugin.SALES_CREDIT_ANCHOR}
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
function callTransform(input=source,warnings=[]){return plugin.transformMain({warn:message=>warnings.push(String(message))},input);}

test('replaces the outbound multiple-choice interaction with a conversational campaign desk',()=>{
  const result=callTransform();
  assert.ok(result?.code);
  assert.match(result.code,/OUTBOUND CAMPAIGN · CONVERSATIONAL DIALER/);
  assert.match(result.code,/outboundCampaignReplyForm/);
  assert.doesNotMatch(result.code,/Legacy outbound quiz/);
});

test('adds outbound conversation handling and safe supervisor / voice actions',()=>{
  const result=callTransform();
  assert.match(result.code,/createOutboundConversation/);
  assert.match(result.code,/submitOutboundTurn/);
  assert.match(result.code,/play-outbound-customer/);
  assert.match(result.code,/request-outbound-supervisor/);
});

test('persists outbound transcript, contact preference, callbacks and suppression evidence',()=>{
  const result=callTransform();
  assert.match(result.code,/conversation:active\?\.conversation/);
  assert.match(result.code,/callbackRequested/);
  assert.match(result.code,/suppressionRequested/);
  assert.match(result.code,/criticalBreaches/);
  assert.match(result.code,/Review required \/ specialist follow-up/);
  assert.match(result.code,/Outbound campaign outcome requires supervisor review/);
  assert.match(result.code,/active\.conversation\?\.customerDecision==='accepted'/);
  assert.match(result.code,/addSuppression\(state.outboundSuppressions,task.customer/);
});

test('fails safely when v4.4 integration or outbound save anchors have changed',()=>{
  const warnings=[];
  const result=callTransform(source.replace(plugin.ATTEMPT_RECORD_ANCHOR,'state.outboundAttempts.push({id:wrap.contactId});'),warnings);
  assert.equal(result,null);
  assert.equal(warnings.length,1);
  assert.match(warnings[0],/skipped the outbound integration safely/);
});

test('is idempotent and avoids injecting the outbound experience twice',()=>{
  const first=callTransform();
  const second=callTransform(first.code);
  assert.equal(second,null);
  assert.equal(first.code.split(plugin.MARKER).length-1,1);
});

test('adds responsive campaign interaction styling without duplicate injection',()=>{
  const html=plugin.transformHtml('<html><head></head><body></body></html>');
  assert.match(html,/v45-transcript/);
  assert.match(html,/@media\(max-width:760px\)/);
  assert.equal(plugin.transformHtml(html),html);
});

test('transformed main module is syntactically valid JavaScript',()=>{
  const result=callTransform();
  const dir=mkdtempSync(join(tmpdir(),'calloria-v45-'));
  const file=join(dir,'transformed.mjs');
  try{
    writeFileSync(file,result.code);
    const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    assert.equal(checked.status,0,checked.stderr||checked.stdout);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
