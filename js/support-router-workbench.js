import { PLATFORMS, validateCustomerRequest, cleanText } from './routing-engine.js';
const $ = selector => document.querySelector(selector);
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
let selectedPlatform = '';
function setStatus(node, message, type = '') { node.textContent = message; node.className = `status ${type}`.trim(); }
function safe(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
async function api(action, payload = {}) {
  if (!supabaseUrl || !supabaseKey) throw new Error('CALLORIA support routing is not configured in this deployment.');
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/calloria-contact-routing`, {
    method:'POST', headers:{'Content-Type':'application/json','apikey':supabaseKey}, body:JSON.stringify({action,...payload})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Support request failed (${response.status}).`);
  return result;
}
function renderPlatforms() {
  const box = $('#platform-options'); box.replaceChildren();
  for (const product of PLATFORMS) {
    const button = document.createElement('button'); button.type='button'; button.className='platform-card'; button.setAttribute('aria-pressed', String(selectedPlatform === product.id));
    const title = document.createElement('strong'); title.textContent=product.name;
    const small = document.createElement('small'); small.textContent='Select this product';
    button.append(title,small); button.addEventListener('click',()=>{ selectedPlatform = selectedPlatform === product.id ? '' : product.id; renderPlatforms(); renderSelectedHelp(); });
    box.append(button);
  }
}
function renderSelectedHelp() {
  const box = $('#selected-platform-help');
  const product = PLATFORMS.find(item => item.id === selectedPlatform);
  box.replaceChildren();
  if (!product) { box.textContent='Select a RuffNeck product above to see its official destination.'; return; }
  const text = document.createElement('p'); text.textContent=`You selected ${product.name}. Check the owning platform's current account and self-service options first.`;
  const link = document.createElement('a'); link.href=product.url; link.target='_blank'; link.rel='noopener noreferrer'; link.textContent=`Open ${product.name}`;
  box.append(text,link);
}
function renderCreated(result) {
  const target = $('#submit-status'); target.className='status success'; target.replaceChildren();
  const title = document.createElement('strong'); title.textContent='Support request submitted';
  const ref = document.createElement('p'); ref.textContent=`Reference: ${result.routeRef}`;
  const tokenLabel = document.createElement('p'); tokenLabel.textContent='Save this one-time access code. CALLORIA does not store the plain code and cannot display it again.';
  const row = document.createElement('div'); row.className='tracking-output';
  const code = document.createElement('code'); code.textContent=result.accessToken;
  const button = document.createElement('button'); button.type='button'; button.className='button outline'; button.textContent='Copy access code';
  button.addEventListener('click', async()=>{ try { await navigator.clipboard.writeText(result.accessToken); button.textContent='Copied'; } catch { button.textContent='Select and copy the code'; } });
  row.append(code,button);
  const hint = document.createElement('small'); hint.className='muted'; hint.textContent='Your request is queued for the appropriate support team. This is not a live call or guaranteed response time.';
  target.append(title,ref,tokenLabel,row,hint);
  $('#track-reference').value=result.routeRef;
  $('#track-token').value='';
}
$('#route-form').addEventListener('submit', async event => {
  event.preventDefault(); const status=$('#submit-status'); setStatus(status,'Submitting encrypted support request…');
  try {
    if (!$('#storage-consent').checked) throw new Error('Consent is required to store and route this support request.');
    const request = validateCustomerRequest({ platformId:selectedPlatform, intent:$('#intent').value, language:$('#language').value, subject:$('#subject').value, summary:$('#summary').value });
    const result = await api('submit_request',{...request, consent:true});
    renderCreated(result); $('#route-form').reset(); selectedPlatform=''; renderPlatforms(); renderSelectedHelp();
  } catch(error) { setStatus(status,error.message || 'The request could not be submitted.','error'); }
});
$('#track-form').addEventListener('submit', async event=>{
  event.preventDefault(); const target=$('#track-result'); target.textContent='Checking private request status…';
  try {
    const routeRef=cleanText($('#track-reference').value,32).toUpperCase(); const accessToken=cleanText($('#track-token').value,100);
    const result=await api('request_status',{routeRef,accessToken});
    target.replaceChildren(); const box=document.createElement('div'); box.className='tracking-output';
    const ref=document.createElement('strong'); ref.textContent=`${result.routeRef} · ${result.department}`;
    const state=document.createElement('p'); state.innerHTML=`Status: <span class="track-state">${safe(result.statusLabel)}</span>`;
    const created=document.createElement('small'); created.className='muted'; created.textContent=`Submitted ${new Date(result.createdAt).toLocaleString()}`;
    const note=document.createElement('p'); note.textContent=result.statusMessage;
    box.append(ref,state,created,note); target.append(box);
    $('#track-token').value='';
  } catch(error) { target.textContent=error.message || 'Status could not be checked.'; }
});
renderPlatforms(); renderSelectedHelp();
