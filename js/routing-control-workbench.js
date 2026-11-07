import { createClient } from '@supabase/supabase-js';
import { queueMetrics, DEPARTMENTS } from './routing-engine.js';
const $ = selector => document.querySelector(selector);
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
let supabase=null; let session=null; let access=null; let queueSummary=[]; let claims=[];
function setStatus(message,type=''){const node=$('#action-status');node.textContent=message;node.className=`status ${type}`.trim();}
function titleCase(value){return String(value||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());}
function duration(seconds){if(seconds===null||seconds===undefined)return '—';const mins=Math.floor(seconds/60);const sec=seconds%60;return mins?`${mins}m ${sec}s`:`${sec}s`;}
async function api(action,payload={}){
  if(!session?.access_token)throw new Error('Your staff session has expired. Sign in again.');
  const response=await fetch(`${supabaseUrl.replace(/\/$/,'')}/functions/v1/calloria-contact-routing`,{method:'POST',headers:{'Content-Type':'application/json','apikey':supabaseKey,'Authorization':`Bearer ${session.access_token}`},body:JSON.stringify({action,...payload})});
  const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||`Routing request failed (${response.status}).`);return result;
}
function showLogin(message=''){$('#login-panel').hidden=false;$('#workspace').hidden=true;$('#sign-out').hidden=true;$('#login-status').textContent=message;}
function showWorkspace(user){$('#login-panel').hidden=true;$('#workspace').hidden=false;$('#sign-out').hidden=false;$('#staff-name').textContent=user.email||'Authenticated staff';$('#staff-scope').textContent=`${titleCase(access.role)} · ${access.departments.includes('*')?'All departments':access.departments.join(', ')}`;}
function renderQueues(){
  const total=queueSummary.reduce((sum,row)=>sum+Number(row.total||0),0);
  const priorities={urgent:0,high:0,normal:0,low:0};
  let oldest=null;
  for(const row of queueSummary){priorities[row.priority]=(priorities[row.priority]||0)+Number(row.total||0);const time=new Date(row.oldest_created_at).getTime();if(Number.isFinite(time)&&(oldest===null||time<oldest))oldest=time;}
  $('#metric-queued').textContent=total;$('#metric-urgent').textContent=priorities.urgent;$('#metric-high').textContent=priorities.high;$('#metric-oldest').textContent=oldest===null?'—':duration(Math.max(0,Math.floor((Date.now()-oldest)/1000)));
  const box=$('#department-queues');box.replaceChildren();
  for(const dept of (access.departments.includes('*')?DEPARTMENTS:access.departments)){
    const rows=queueSummary.filter(row=>row.department===dept);const count=rows.reduce((sum,row)=>sum+Number(row.total||0),0);
    const pr=Object.fromEntries(['urgent','high','normal','low'].map(priority=>[priority,rows.filter(row=>row.priority===priority).reduce((sum,row)=>sum+Number(row.total||0),0)]));
    const card=document.createElement('article');card.className='queue-card';const number=document.createElement('span');number.className='count';number.textContent=String(count);const name=document.createElement('strong');name.textContent=dept;const detail=document.createElement('small');detail.textContent=`Urgent ${pr.urgent} · High ${pr.high} · Standard ${pr.normal+pr.low}`;card.append(number,name,detail);box.append(card);
  }
  if(!box.children.length){const empty=document.createElement('div');empty.className='empty-state';empty.textContent='No departments are in your routing permission scope.';box.append(empty);}
}
function renderClaims(){const box=$('#my-assignments');box.replaceChildren();if(!claims.length){const empty=document.createElement('div');empty.className='empty-state';empty.textContent='No recent claims are recorded for this staff account.';box.append(empty);return;}for(const row of claims){const card=document.createElement('article');card.className='assignment-card';const content=document.createElement('div');const title=document.createElement('strong');title.textContent=`${row.route_ref} · ${row.intent.replaceAll('_',' ')}`;const meta=document.createElement('small');meta.textContent=`${row.department} · ${row.channel} · ${row.platform_id||'General support'}`;content.append(title,meta);const state=document.createElement('span');state.className='state';state.textContent=row.status==='completed'?'Resolved':row.status==='cancelled'?'Closed':'Claimed';card.append(content,state);box.append(card);}}
async function refresh(){setStatus('Refreshing permitted support queues…');try{const result=await api('queues');queueSummary=result.queueSummary||[];claims=result.recentClaims||[];renderQueues();renderClaims();setStatus('Queues refreshed.');}catch(error){setStatus(error.message,'error');}}
$('#login-form').addEventListener('submit',async event=>{event.preventDefault();$('#login-status').textContent='Signing in…';try{if(!supabaseUrl||!supabaseKey)throw new Error('Supabase browser configuration is missing.');supabase=createClient(supabaseUrl,supabaseKey);const {data,error}=await supabase.auth.signInWithPassword({email:$('#staff-email').value.trim(),password:$('#staff-password').value});if(error||!data.session)throw error||new Error('Staff sign-in failed.');session=data.session;const who=await api('whoami');access=who.access;showWorkspace(data.user);await refresh();}catch(error){showLogin(error.message||'Sign-in failed.');}});
$('#sign-out').addEventListener('click',async()=>{try{await supabase?.auth.signOut();}finally{session=null;access=null;queueSummary=[];claims=[];showLogin('Signed out.');}});
$('#refresh').addEventListener('click',refresh);
$('#claim-next').addEventListener('click',async()=>{const button=$('#claim-next');button.disabled=true;setStatus('Checking shift, skills, language and queue eligibility…');try{const result=await api('claim_next');if(!result.claimed){setStatus(result.message||'No eligible request is available.');return;}setStatus(`Claimed ${result.routeRef}. Open Agent Desk to handle it.`,'success');const box=$('#my-assignments');const row=document.createElement('article');row.className='assignment-card';const content=document.createElement('div');const title=document.createElement('strong');title.textContent=`${result.routeRef} · ${result.intent.replaceAll('_',' ')}`;const meta=document.createElement('small');meta.textContent=`${result.department} · ${result.channel} · ${result.workRef}`;content.append(title,meta);const link=document.createElement('a');link.className='button outline';link.href='/agent-desk.html';link.textContent='Open Agent Desk';row.append(content,link);box.prepend(row);await refresh();}catch(error){setStatus(error.message,'error');}finally{button.disabled=false;}});
(async()=>{try{if(!supabaseUrl||!supabaseKey)return;supabase=createClient(supabaseUrl,supabaseKey);const {data}=await supabase.auth.getSession();if(data.session){session=data.session;const who=await api('whoami');access=who.access;showWorkspace(data.session.user);await refresh();}else showLogin();}catch(error){showLogin(error.message||'Sign-in required.');}})();
