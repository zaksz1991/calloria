/** Pure formatting and validation helpers for Operations Intelligence. */
export const REPORT_RANGES=Object.freeze([7,30,90]);
export function numberValue(value){const n=Number(value);return Number.isFinite(n)?n:0;}
export function nullableNumber(value){if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null;}
export function formatCount(value){return new Intl.NumberFormat('en-NG',{maximumFractionDigits:0}).format(numberValue(value));}
export function formatPercent(value){const n=nullableNumber(value);return n===null?'—':`${n.toFixed(1)}%`;}
export function formatMinutes(value){const n=nullableNumber(value);if(n===null)return '—';if(n<1)return `${Math.round(n*60)} sec`;const h=Math.floor(n/60),m=Math.round(n%60);return h?`${h}h ${m}m`:`${m} min`;}
export function formatSeconds(value){const n=nullableNumber(value);if(n===null)return '—';const mins=Math.floor(n/60),secs=Math.round(n%60);return mins?`${mins}m ${secs}s`:`${secs}s`;}
export function safeArray(value){return Array.isArray(value)?value:[];}
export function normaliseSnapshot(value){
  if(!value||typeof value!=='object')throw new Error('The report returned no snapshot.');
  for(const key of ['overview','queue_risk','staffing','quality','voice'])if(!value[key]||typeof value[key]!=='object')value[key]={};
  for(const key of ['channels','departments','daily','provider_delivery'])value[key]=safeArray(value[key]);
  return value;
}
export function metricTone(value,kind='neutral'){
  const n=nullableNumber(value);if(n===null)return 'neutral';
  if(kind==='sla')return n>=90?'good':n>=80?'watch':'bad';
  if(kind==='risk')return n===0?'good':n<=3?'watch':'bad';
  return 'neutral';
}
export function channelLabel(channel){return ({voice:'Telephone',email:'Email',live_chat:'Website live chat',social:'Instagram / Messenger',whatsapp:'WhatsApp',sms:'SMS',portal:'Customer portal',website:'Website',game:'Game support',back_office:'Back office'})[channel]||String(channel||'Other').replaceAll('_',' ');}
