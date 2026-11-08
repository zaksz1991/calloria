import test from 'node:test';
import assert from 'node:assert/strict';
import { validateKnowledgeDraft, normalizePayload, sourceIsRequired, sourceFresh, canReview, normaliseRecord, formatStatus } from '../js/knowledge-operations-engine.js';

test('article draft normalises strings and tags while enforcing a useful body',()=>{
  const row=validateKnowledgeDraft({record_type:'article',record_key:'refund-complaint-process',title:'Complaint process',category:'complaint_recovery',change_summary:'Clarify escalation steps.',payload:{body:'Customers should describe the issue and keep their reference number available.',tags:'complaint, escalation',audience:'customer'}});
  assert.equal(row.record_type,'article');assert.deepEqual(row.payload.tags,['complaint, escalation']);assert.equal(row.payload.audience,'customer');
});
test('article body shorter than 30 characters is rejected',()=>assert.throws(()=>normalizePayload('article',{body:'Too short.'}),/30 characters/));
test('platform requires HTTPS and meaningful purpose',()=>assert.throws(()=>normalizePayload('platform',{name:'Kano',url:'http://example.com',purpose:'A long enough product purpose description.'}),/HTTPS/));
test('platform normalises structured self service tasks',()=>{
 const p=normalizePayload('platform',{name:'Kano Keke',url:'https://kano-keke.vercel.app/',purpose:'A Kano keke simulation for route and vehicle selection.',features:['Drivers','Routes'],support_topics:['Controls'],self_service:[{task:'Start shift',steps:['Select a driver','Choose a route']}]});
 assert.equal(p.self_service[0].steps.length,2);assert.equal(p.features[0],'Drivers');
});
test('service requires a name and sufficiently complete description',()=>assert.throws(()=>normalizePayload('service',{name:'IT',description:'Short'}),/useful description/));
test('slug and change rationale are mandatory',()=>assert.throws(()=>validateKnowledgeDraft({record_type:'article',record_key:'Bad Key',title:'A',change_summary:'ok',payload:{body:'This is a sufficiently long article body with facts.'}}),/lowercase slug/));
test('HTTPS source rejects embedded credentials',()=>assert.throws(()=>validateKnowledgeDraft({record_type:'article',record_key:'safe-content',title:'Safe content',change_summary:'Update text',source_url:'https://user:pass@example.com',payload:{body:'This article body is deliberately long enough to pass validation.'}}),/without embedded credentials/));
test('product and service content require sources',()=>{
 assert.equal(sourceIsRequired({record_type:'platform',category:'platform_support'}),true);
 assert.equal(sourceIsRequired({record_type:'service',category:'general'}),true);
 assert.equal(sourceIsRequired({record_type:'article',category:'psychology'}),true);
 assert.equal(sourceIsRequired({record_type:'article',category:'general'}),false);
});
test('source freshness rejects missing, future and old dates',()=>{
 const now=Date.now();assert.equal(sourceFresh({record_type:'platform',source_url:'https://example.com',source_verified_at:new Date(now-30*86400000).toISOString()},now),true);
 assert.equal(sourceFresh({record_type:'platform',source_url:'https://example.com',source_verified_at:null},now),false);
 assert.equal(sourceFresh({record_type:'platform',source_url:'https://example.com',source_verified_at:new Date(now+86400000).toISOString()},now),false);
 assert.equal(sourceFresh({record_type:'platform',source_url:'https://example.com',source_verified_at:new Date(now-181*86400000).toISOString()},now),false);
});
test('authors cannot independently review their own records',()=>{
 assert.equal(canReview({authored_by:'u1',status:'in_review'},'u1'),false);
 assert.equal(canReview({authored_by:'u1',status:'in_review'},'u2'),true);
 assert.equal(canReview({authored_by:'u1',status:'draft'},'u2'),false);
});
test('record normalisation constrains status and version',()=>{
 const r=normaliseRecord({id:'x',record_type:'article',status:'not-real',version:-4,payload:{body:'ok'}});
 assert.equal(r.status,'draft');assert.equal(r.version,1);assert.equal(r.payload.body,'ok');
});
test('workflow status labels are explicit',()=>assert.equal(formatStatus('in_review'),'Awaiting review'));
