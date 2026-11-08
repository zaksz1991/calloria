import { createClient } from 'npm:@supabase/supabase-js@2';

/** Aggregate-only operations intelligence. The caller's JWT is validated here. */
const env=(name:string)=>Deno.env.get(name)||'';
const allowedOrigins=env('CALLORIA_ALLOWED_ORIGINS').split(',').map(x=>x.trim()).filter(Boolean);
const supabaseUrl=env('SUPABASE_URL');
const serviceKey=env('SUPABASE_SERVICE_ROLE_KEY');
const accessRaw=env('CALLORIA_ROUTING_ACCESS');
const DEPARTMENTS=[
  'RuffNeck Products and Platform Support','Sales and Service Enquiries',
  'Complaints and Service Recovery','Personal Development and Wellbeing Information',
  'General Customer Care','Email and Written Support','Social Media Support',
  'Technical Support and IT','Quality Assurance and Customer Experience',
  'Safeguarding and Trained Human Support','Learning and Career Development'
];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Grant={role:'agent'|'supervisor'|'people_admin';departments:string[];skills:string[];channels:string[];languages:string[];maxConcurrency:number};
const accessMap:Record<string,Grant>={};
let accessInvalid=false;
function clean(v:unknown,max=600){return String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);}
try{
  const parsed=accessRaw?JSON.parse(accessRaw):{};
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Invalid staff access map.');
  for(const [id,raw] of Object.entries(parsed)){
    const row=raw as any;
    if(!UUID.test(id)||!row||!['agent','supervisor','people_admin'].includes(row.role))throw new Error('Invalid staff entry.');
    if(!Array.isArray(row.departments)||!row.departments.length||!Array.isArray(row.skills)||!Array.isArray(row.channels)||!Array.isArray(row.languages))throw new Error('Staff scopes are incomplete.');
    const departments=row.departments.map((x:unknown)=>clean(x,120));
    if(departments.some((x:string)=>x!=='*'&&!DEPARTMENTS.includes(x)))throw new Error('Unknown staff department.');
    if(row.role==='agent'&&departments.includes('*'))throw new Error('Agents require explicit department scope.');
    if(row.role==='people_admin'&&!departments.includes('*'))throw new Error('People administrators require wildcard department scope.');
    accessMap[id]={role:row.role,departments,skills:row.skills.map((x:unknown)=>clean(x,40)),channels:row.channels.map((x:unknown)=>clean(x,24)),languages:row.languages.map((x:unknown)=>clean(x,8)),maxConcurrency:Math.max(1,Math.min(10,Number(row.maxConcurrency)||1))};
  }
}catch{accessInvalid=true;}
function json(status:number,body:Record<string,unknown>,origin:string|null){
  return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':origin&&allowedOrigins.includes(origin)?origin:'null','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS',Vary:'Origin'}});
}
function departmentsFor(grant:Grant){return grant.departments.includes('*')?DEPARTMENTS:grant.departments;}
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin');
  if(req.method==='OPTIONS')return new Response('ok',{headers:{'Access-Control-Allow-Origin':origin&&allowedOrigins.includes(origin)?origin:'null','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS',Vary:'Origin'}});
  if(req.method!=='POST')return json(405,{error:'POST required.'},origin);
  if(!supabaseUrl||!serviceKey)return json(503,{error:'Operations Intelligence is not configured.'},origin);
  if(accessInvalid||Object.keys(accessMap).length===0)return json(503,{error:'CALLORIA staff access is not configured.'},origin);
  const authorization=req.headers.get('Authorization')||'';
  const token=authorization.startsWith('Bearer ')?authorization.slice(7):'';
  if(!token)return json(401,{error:'Staff sign-in is required.'},origin);
  const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  try{
    const {data:userData,error:userError}=await admin.auth.getUser(token);
    const user=userData?.user;
    if(userError||!user)return json(401,{error:'Staff session is invalid or expired.'},origin);
    const grant=accessMap[user.id];
    if(!grant)return json(403,{error:'This account is not authorised for Operations Intelligence.'},origin);
    if(grant.role==='agent'&&(!grant.departments.length||!grant.channels.length||!grant.languages.length))return json(403,{error:'Your staff routing scope is incomplete.'},origin);
    let body:any={};
    try{const raw=await req.text();if(raw.length>4096)return json(413,{error:'Request is too large.'},origin);body=raw?JSON.parse(raw):{};}catch{return json(400,{error:'Request body must be valid JSON.'},origin);}
    const action=clean(body.action,32);
    const team=grant.role==='supervisor'||grant.role==='people_admin';
    const departments=departmentsFor(grant);
    if(action==='whoami')return json(200,{access:{role:grant.role,departments,view:team?'department_aggregate':'personal',canViewTeam:team}},origin);
    if(action!=='snapshot')return json(400,{error:'Unsupported action.'},origin);
    const days=Number(body.days??7);
    if(!Number.isInteger(days)||![7,30,90].includes(days))return json(400,{error:'Choose a 7, 30 or 90 day reporting period.'},origin);
    const until=new Date();
    const since=new Date(until.getTime()-days*86400000);
    const {data,error}=await admin.rpc('calloria_ops_intelligence_snapshot',{
      p_departments:departments,p_since:since.toISOString(),p_until:until.toISOString(),
      p_staff_user_id:team?null:user.id,p_include_team:team
    });
    if(error){
      console.error('CALLORIA operations snapshot failed:',clean(error.message,180));
      return json(503,{error:'The aggregate report could not be generated. Confirm Phase 20 migration 020 is applied.'},origin);
    }
    return json(200,{snapshot:data,generatedAt:new Date().toISOString(),refreshSeconds:60},origin);
  }catch(error){
    console.error('CALLORIA operations intelligence error:',error instanceof Error?clean(error.message,180):'unknown');
    return json(500,{error:'Operations Intelligence request failed.'},origin);
  }
});
