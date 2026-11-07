import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigins = (Deno.env.get('CALLORIA_ALLOWED_ORIGINS') || '')
  .split(',').map(value => value.trim()).filter(Boolean);
const sharedHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin'
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function allowed(origin: string | null) {
  return Boolean(origin && allowedOrigins.includes(origin));
}
function respond(status: number, payload: Record<string, unknown>, origin: string | null) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...sharedHeaders,
      'Access-Control-Allow-Origin': allowed(origin) ? origin! : 'null',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}
function serviceKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    if (typeof keys.default === 'string' && keys.default) return keys.default;
  } catch { /* try legacy injected variable */ }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}
async function visitorHash(visitorId: string, pepper: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${visitorId}:${pepper}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async request => {
  const origin = request.headers.get('origin');
  if (!allowedOrigins.length) return respond(503, { error: 'CALLORIA_ALLOWED_ORIGINS must include the live CALLORIA origin.' }, origin);
  if (request.method === 'OPTIONS') {
    if (!allowed(origin)) return respond(403, { error: 'Origin is not allowed.' }, origin);
    return new Response('ok', { headers: { ...sharedHeaders, 'Access-Control-Allow-Origin': origin! } });
  }
  if (request.method !== 'POST') return respond(405, { error: 'Method not allowed.' }, origin);
  if (!allowed(origin)) return respond(403, { error: 'Origin is not allowed.' }, origin);

  try {
    const length = Number(request.headers.get('content-length') || 0);
    if (length > 5000) return respond(413, { error: 'Request is too large.' }, origin);
    const raw = await request.text();
    if (raw.length > 5000) return respond(413, { error: 'Request is too large.' }, origin);
    let body: any;
    try { body = JSON.parse(raw); } catch { return respond(400, { error: 'Invalid JSON.' }, origin); }

    const url = Deno.env.get('SUPABASE_URL') || '';
    const key = serviceKey();
    if (!url || !key) return respond(503, { error: 'Server-side Supabase credentials are unavailable.' }, origin);
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    if (body.action === 'stats') {
      const { data: stats, error: statsError } = await admin.rpc('calloria_get_public_game_stats');
      if (statsError) return respond(503, { error: 'Public game statistics are not configured. Apply CALLORIA migration 004.' }, origin);
      const now = new Date().toISOString();
      const { data: campaigns, error: campaignError } = await admin.from('calloria_sponsor_campaigns')
        .select('id,advertiser_name,campaign_name,placement,creative_headline,creative_text,image_url,destination_url')
        .eq('status', 'active').eq('placement', 'game_launch').lte('starts_at', now).gt('ends_at', now).limit(8);
      const campaign = !campaignError && campaigns?.length ? campaigns[Math.floor(Math.random() * campaigns.length)] : null;
      return respond(200, { stats, sponsor: campaign || null }, origin);
    }

    const visitorId = String(body.visitorId || '');
    const sessionId = String(body.sessionId || '');
    if (!uuidPattern.test(visitorId) || !uuidPattern.test(sessionId)) return respond(400, { error: 'Invalid anonymous game session.' }, origin);
    const hash = await visitorHash(visitorId, key);

    if (body.action === 'presence') {
      const action = String(body.presenceAction || '');
      if (!['start','heartbeat','end'].includes(action)) return respond(400, { error: 'Invalid presence event.' }, origin);
      const device = ['desktop','tablet','mobile'].includes(body.deviceCategory) ? body.deviceCategory : 'desktop';
      const { error } = await admin.rpc('calloria_record_game_presence', {
        p_visitor_hash: hash,
        p_session_id: sessionId,
        p_action: action,
        p_device_category: device
      });
      if (error) return respond(503, { error: 'Could not record game presence. Apply CALLORIA migration 004.' }, origin);
      return respond(200, { recorded: true }, origin);
    }

    if (body.action === 'sponsor-event') {
      const campaignId = String(body.campaignId || '');
      const eventType = String(body.eventType || '');
      if (!uuidPattern.test(campaignId) || !['impression','click'].includes(eventType)) return respond(400, { error: 'Invalid sponsor event.' }, origin);
      const { error } = await admin.rpc('calloria_record_sponsor_event', {
        p_campaign_id: campaignId,
        p_session_id: sessionId,
        p_visitor_hash: hash,
        p_event_type: eventType
      });
      if (error) return respond(400, { error: 'Sponsor event was not accepted.' }, origin);
      return respond(200, { recorded: true }, origin);
    }

    return respond(400, { error: 'Unknown telemetry action.' }, origin);
  } catch (error) {
    console.error('CALLORIA game telemetry failed:', error);
    return respond(500, { error: 'Game telemetry could not be processed.' }, origin);
  }
});
