import { createClient } from '@supabase/supabase-js';
import { validateKnowledgeDraft, normaliseRecord, formatKnowledgeType, formatStatus } from './knowledge-operations-engine.js';
const $ = id => document.getElementById(id);
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
let supabase = null, session = null, access = null, records = [], selected = null, announcements = [];
function setText(id, value) { const el=$(id); if(el)el.textContent=String(value ?? ''); }
function setStatus(id, value, bad=false) { const el=$(id); if(!el)return; el.textContent=value; el.style.color=bad?'#ff9898':''; }
function showLogin(message='') { $('ko-login').hidden=false; $('ko-workspace').hidden=true; $('ko-sign-out').hidden=true; setStatus('ko-login-status',message,true); }
function toLocalInput(date) { if(!date)return ''; const d=new Date(date); if(Number.isNaN(d.getTime()))return ''; const local=new Date(d.getTime()-d.getTimezoneOffset()*60000); return local.toISOString().slice(0,16); }
function csv(value) { return String(value??'').split(',').map(x=>x.trim()).filter(Boolean); }
async function api(action,payload={}) {
  if(!session?.access_token)throw new Error('Staff session expired. Sign in again.');
  const response=await fetch(`${supabaseUrl.replace(/\/$/,'')}/functions/v1/calloria-knowledge-operations`,{method:'POST',headers:{'Content-Type':'application/json','apikey':supabaseKey,'Authorization':`Bearer ${session.access_token}`},body:JSON.stringify({action,...payload})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||`Knowledge request failed (${response.status}).`);
  return data;
}
function setTypeFields() {
  const type=$('ko-record-type').value;
  $('ko-article-fields').hidden=type!=='article';$('ko-platform-fields').hidden=type!=='platform';$('ko-service-fields').hidden=type!=='service';
}
function clearEditor() {
  selected=null;$('ko-record-form').reset();$('ko-record-id').value='';$('ko-record-type').value='article';$('ko-category').value='general';$('ko-platform-self-service').value='[]';$('ko-platform-active').checked=true;$('ko-service-active').checked=true;
  $('ko-editor-title').textContent='New knowledge record';$('ko-record-status').textContent='Draft';$('ko-record-status').className='ko-status-pill';
  setTypeFields();applyRoleControls();document.querySelectorAll('.ko-record').forEach(el=>el.classList.remove('selected'));
}
function startRevision() {
  if(!selected || selected.status!=='published' || !access?.canDraft)return;
  const prior=selected;
  $('ko-record-id').value='';
  $('ko-change-summary').value='Describe the revision, affected customer questions and the new verification source.';
  selected=null;
  $('ko-editor-title').textContent=`New revision · ${prior.title}`;
  $('ko-record-status').textContent=`New draft · next version after v${prior.version}`;
  $('ko-record-status').className='ko-status-pill';
  applyRoleControls();renderRecords();setStatus('ko-editor-status','This will create a new version. The currently published version remains live until the new version is independently approved and published.');
}
function applyRoleControls() {
  const editable=Boolean(access?.canDraft && (!selected || ['draft','changes_requested'].includes(selected.status)));
  $('ko-record-form').querySelectorAll('input,select,textarea').forEach(el=>{if(el.id!=='ko-record-id')el.disabled=!editable;});
  $('ko-save-draft').hidden=!editable;$('ko-submit-review').hidden=!editable || !selected?.id;
  const review=Boolean(access?.canReview && selected?.status==='in_review' && selected.authored_by!==session?.user?.id);
  $('ko-approve').hidden=!review;$('ko-request-changes').hidden=!review;$('ko-reject').hidden=!review;
  $('ko-publish').hidden=!(access?.canReview && selected?.status==='approved' && selected.reviewed_by!==selected.authored_by);
  $('ko-retire').hidden=!(access?.canReview && selected?.status==='published');
  $('ko-new-record').hidden=!access?.canDraft;$('ko-revise-record').hidden=!(access?.canDraft && selected?.status==='published');
  $('ko-announcement-form').querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=!access?.canDraft);
  $('ko-save-announcement').hidden=!access?.canDraft;
}
function fillEditor(row) {
  selected=normaliseRecord(row);const r=selected,p=r.payload||{};
  $('ko-record-id').value=r.id;$('ko-record-type').value=r.record_type;$('ko-record-key').value=r.record_key;$('ko-title').value=r.title;$('ko-category').value=r.category;$('ko-change-summary').value=r.change_summary;$('ko-source-url').value=r.source_url||'';$('ko-source-verified').value=r.source_verified_at?new Date(r.source_verified_at).toISOString().slice(0,10):'';
  $('ko-audience').value=p.audience||'customer';$('ko-tags').value=Array.isArray(p.tags)?p.tags.join(', '):'';$('ko-article-body').value=p.body||'';
  $('ko-platform-name').value=p.name||'';$('ko-platform-url').value=p.url||'';$('ko-platform-purpose').value=p.purpose||'';$('ko-platform-features').value=Array.isArray(p.features)?p.features.join('\n'):'';$('ko-platform-topics').value=Array.isArray(p.support_topics)?p.support_topics.join('\n'):'';$('ko-platform-self-service').value=JSON.stringify(p.self_service||[],null,2);$('ko-platform-limitations').value=p.limitations||'';$('ko-platform-active').checked=p.active!==false;
  $('ko-service-name').value=p.name||'';$('ko-service-category').value=p.category||r.category;$('ko-service-description').value=p.description||'';$('ko-service-active').checked=p.active!==false;
  $('ko-editor-title').textContent=`${formatKnowledgeType(r.record_type)} · ${r.title}`;$('ko-record-status').textContent=`${formatStatus(r.status)} · v${r.version}`;$('ko-record-status').className=`ko-status-pill ${r.status}`;
  setTypeFields();applyRoleControls();renderRecords();setStatus('ko-editor-status',`Updated ${r.updated_at?new Date(r.updated_at).toLocaleString():'recently'}. Author and reviewer must be different accounts.`);
}
function recordPayload() {
  const type=$('ko-record-type').value;
  if(type==='article')return {category:$('ko-category').value.trim(),body:$('ko-article-body').value,tags:csv($('ko-tags').value),audience:$('ko-audience').value};
  if(type==='service')return {name:$('ko-service-name').value,description:$('ko-service-description').value,category:$('ko-service-category').value,active:$('ko-service-active').checked};
  let selfService;try{selfService=JSON.parse($('ko-platform-self-service').value||'[]');}catch{throw new Error('Self-service tasks must be valid JSON.');}
  if(!Array.isArray(selfService))throw new Error('Self-service tasks must be a JSON array.');
  return {name:$('ko-platform-name').value,url:$('ko-platform-url').value,purpose:$('ko-platform-purpose').value,features:$('ko-platform-features').value.split('\n'),support_topics:$('ko-platform-topics').value.split('\n'),self_service:selfService,limitations:$('ko-platform-limitations').value,active:$('ko-platform-active').checked};
}
function draftInput() {
  return validateKnowledgeDraft({id:$('ko-record-id').value||undefined,record_type:$('ko-record-type').value,record_key:$('ko-record-key').value,title:$('ko-title').value,category:$('ko-category').value,change_summary:$('ko-change-summary').value,source_url:$('ko-source-url').value,source_verified_at:$('ko-source-verified').value||null,payload:recordPayload()});
}
function renderRecords() {
  const query=$('ko-search').value.trim().toLowerCase(), status=$('ko-status-filter').value, type=$('ko-type-filter').value;
  const rows=records.filter(r=>(!query||`${r.title} ${r.record_key} ${r.category}`.toLowerCase().includes(query))&&(!status||r.status===status)&&(!type||r.record_type===type));
  $('ko-record-count').textContent=String(rows.length);const box=$('ko-record-list');box.replaceChildren();
  if(!rows.length){const p=document.createElement('p');p.className='ko-empty';p.textContent='No records match this filter.';box.append(p);return;}
  for(const row of rows){const b=document.createElement('button');b.type='button';b.className=`ko-record${selected?.id===row.id?' selected':''}`;const title=document.createElement('strong');title.textContent=row.title;const detail=document.createElement('small');detail.textContent=`${formatKnowledgeType(row.record_type)} · ${row.record_key}`;const meta=document.createElement('span');meta.className='ko-record-meta';const state=document.createElement('span');state.textContent=formatStatus(row.status);const version=document.createElement('span');version.textContent=`v${row.version}`;meta.append(state,version);b.append(title,detail,meta);b.addEventListener('click',()=>loadRecord(row.id));box.append(b);}
}
async function loadRecords(){setStatus('ko-editor-status','Loading records…');const data=await api('list_records');records=(data.records||[]).map(normaliseRecord).filter(Boolean);renderRecords();setStatus('ko-editor-status',`${records.length} records available within your permission scope.`);}
async function loadRecord(id){try{const data=await api('get_record',{id});fillEditor(data.record);}catch(e){setStatus('ko-editor-status',e.message,true);}}
async function saveDraft(event){event?.preventDefault();try{const input=draftInput();const data=await api('save_draft',{...input,id:$('ko-record-id').value||undefined});fillEditor(data.record);await loadRecords();setStatus('ko-editor-status','Draft saved. Customer-facing answers have not changed.');}catch(e){setStatus('ko-editor-status',e.message,true);}}
async function actionOnRecord(action,extra={}){if(!selected?.id)return;try{const data=await api(action,{id:selected.id,...extra});if(data.record)fillEditor(data.record);await loadRecords();setStatus('ko-editor-status',action==='publish'?'Published and synchronised to the Phase 4 customer knowledge tables.':`Record ${action.replaceAll('_',' ')} completed.`);}catch(e){setStatus('ko-editor-status',e.message,true);}}
function renderAnnouncements() {
  const box=$('ko-announcement-list');box.replaceChildren();if(!announcements.length){const p=document.createElement('p');p.className='ko-empty';p.textContent='No current product or service notices for your department scope.';box.append(p);return;}
  for(const row of announcements){const card=document.createElement('article');card.className='ko-notice';const title=document.createElement('strong');title.textContent=row.title;const detail=document.createElement('small');detail.textContent=`${row.status==='draft'?'DRAFT · ':''}${row.category.replaceAll('_',' ')} · ends ${new Date(row.ends_at).toLocaleString()}`;const body=document.createElement('p');body.textContent=row.body;card.append(title,detail,body);if(row.status==='draft'){const state=document.createElement('small');state.textContent=row.authored_by===session?.user?.id?'Your draft · independent publication required.':'Draft · independent publication approval required.';state.style.color='#f4c76a';card.append(state);if(row.authored_by===session?.user?.id||access?.canReview){const edit=document.createElement('button');edit.className='ko-button outline';edit.textContent='Edit briefing draft';edit.addEventListener('click',()=>{ $('ko-announcement-id').value=row.id;$('ko-announcement-title').value=row.title;$('ko-announcement-body').value=row.body;$('ko-announcement-category').value=row.category;$('ko-announcement-products').value=(row.product_ids||[]).join(', ');$('ko-announcement-departments').value=(row.target_departments||[]).join(', ');$('ko-announcement-starts').value=toLocalInput(row.starts_at);$('ko-announcement-ends').value=toLocalInput(row.ends_at);$('ko-announcement-ack').checked=row.requires_ack;setStatus('ko-announcement-status','Draft loaded for editing.');});card.append(edit);}if(access?.canReview&&row.authored_by!==session?.user?.id){const publish=document.createElement('button');publish.className='ko-button success';publish.textContent='Publish briefing';publish.addEventListener('click',async()=>{try{await api('publish_announcement',{id:row.id});await loadAnnouncements();setStatus('ko-announcement-status','Briefing published to its target staff departments.');}catch(e){setStatus('ko-announcement-status',e.message,true);}});card.append(publish);}}else if(row.requires_ack){const ack=document.createElement('small');ack.textContent=row.acknowledged?'Acknowledged':'Acknowledgement required';ack.style.color=row.acknowledged?'#56d6a4':'#f4c76a';card.append(ack);if(!row.acknowledged){const b=document.createElement('button');b.className='ko-button outline';b.textContent='Acknowledge briefing';b.addEventListener('click',async()=>{try{await api('acknowledge',{id:row.id});await loadAnnouncements();}catch(e){setStatus('ko-announcement-status',e.message,true);}});card.append(b);}}
    box.append(card);
  }
}
async function loadAnnouncements(){const data=await api('list_announcements');announcements=data.announcements||[];renderAnnouncements();}
async function saveAnnouncement(event){event.preventDefault();try{const starts=new Date($('ko-announcement-starts').value),ends=new Date($('ko-announcement-ends').value);const payload={title:$('ko-announcement-title').value,body:$('ko-announcement-body').value,category:$('ko-announcement-category').value,product_ids:csv($('ko-announcement-products').value),target_departments:csv($('ko-announcement-departments').value),starts_at:starts.toISOString(),ends_at:ends.toISOString(),requires_ack:$('ko-announcement-ack').checked,id:$('ko-announcement-id').value||undefined};const result=await api('save_announcement',payload);$('ko-announcement-id').value=result.announcement.id;setStatus('ko-announcement-status','Briefing draft saved. A knowledge administrator other than the author must publish it.');}catch(e){setStatus('ko-announcement-status',e.message,true);}}
async function signIn(event){event.preventDefault();setStatus('ko-login-status','Signing in…');try{if(!supabaseUrl||!supabaseKey)throw new Error('Public Supabase browser configuration is missing.');supabase=createClient(supabaseUrl,supabaseKey);const {data,error}=await supabase.auth.signInWithPassword({email:$('ko-email').value.trim(),password:$('ko-password').value});if(error||!data.session)throw error||new Error('Sign-in failed.');session=data.session;await openWorkspace();}catch(e){showLogin(e.message||'Sign-in failed.');}}
async function openWorkspace(){const who=await api('whoami');access=who.access;$('ko-login').hidden=true;$('ko-workspace').hidden=false;$('ko-sign-out').hidden=false;setText('ko-scope',`${access.role.replaceAll('_',' ')} · ${access.departments.length===11?'All departments':access.departments.join(' · ')}`);applyRoleControls();await Promise.all([loadRecords(),loadAnnouncements()]);}
$('ko-login-form').addEventListener('submit',signIn);$('ko-record-form').addEventListener('submit',saveDraft);$('ko-record-type').addEventListener('change',setTypeFields);$('ko-new-record').addEventListener('click',clearEditor);$('ko-revise-record').addEventListener('click',startRevision);$('ko-refresh').addEventListener('click',async()=>{try{await Promise.all([loadRecords(),loadAnnouncements()]);}catch(e){setStatus('ko-editor-status',e.message,true);}});['ko-search','ko-status-filter','ko-type-filter'].forEach(id=>$(id).addEventListener('input',renderRecords));
$('ko-submit-review').addEventListener('click',()=>actionOnRecord('submit_review'));
$('ko-approve').addEventListener('click',()=>{const note=prompt('Independent review note (optional):');if(note!==null)actionOnRecord('review',{decision:'approved',note});});
$('ko-request-changes').addEventListener('click',()=>{const note=prompt('Describe the changes required:');if(note!==null)actionOnRecord('review',{decision:'changes_requested',note});});
$('ko-reject').addEventListener('click',()=>{const note=prompt('Reason for rejection:');if(note!==null)actionOnRecord('review',{decision:'rejected',note});});
$('ko-publish').addEventListener('click',()=>actionOnRecord('publish'));
$('ko-retire').addEventListener('click',()=>{if(confirm('Retire this published record? It will stop appearing in public knowledge retrieval.'))actionOnRecord('retire');});
$('ko-announcement-form').addEventListener('submit',saveAnnouncement);
$('ko-sign-out').addEventListener('click',async()=>{try{await supabase?.auth.signOut();}finally{session=null;access=null;showLogin('Signed out.');}});
(async()=>{try{if(!supabaseUrl||!supabaseKey){showLogin('Supabase browser configuration is missing.');return;}supabase=createClient(supabaseUrl,supabaseKey);const {data}=await supabase.auth.getSession();if(data.session){session=data.session;await openWorkspace();}}catch(e){showLogin(e.message||'Sign-in required.');}})();
