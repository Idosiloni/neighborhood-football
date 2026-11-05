// Sends what waits in push_outbox to the phones (Web Push with VAPID). Called every few minutes by
// pg_cron (supabase/push_setup.sql) and right after someone joins, by the app. Calling it more often
// only sends sooner: push_take() hands each message out once, and queues reminders when they are due.
//
// Secrets (npx supabase secrets set …): VAPID_KEYS = the JSON from scripts/vapid-keys.mjs (private,
// never in the repo), VAPID_CONTACT = mailto: address for the push services.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import * as webpush from 'jsr:@negrel/webpush@0.5.0'

const URL_ = Deno.env.get('SUPABASE_URL')!
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function rpc(name: string, body: unknown) {
  const res = await fetch(`${URL_}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

let server: webpush.ApplicationServer | null = null
async function appServer() {
  if (!server) {
    const keys = await webpush.importVapidKeys(JSON.parse(Deno.env.get('VAPID_KEYS')!), { extractable: false })
    server = await webpush.ApplicationServer.new({ contactInformation: Deno.env.get('VAPID_CONTACT') ?? 'mailto:admin@example.com', vapidKeys: keys })
  }
  return server
}

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  try {
    const rows: { endpoint: string; p256dh: string; auth: string; title: string; body: string; url: string; tag: string }[] =
      await rpc('push_take', { p_limit: 300 })
    const app = await appServer()
    const gone: string[] = []
    let sent = 0
    await Promise.all(rows.map(async (r) => {
      try {
        await app.subscribe({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } })
          .pushTextMessage(JSON.stringify({ title: r.title, body: r.body, url: r.url, tag: r.tag }), { ttl: 12 * 3600, urgency: webpush.Urgency.Normal })
        sent++
      } catch (e) {
        if (e instanceof webpush.PushMessageError && e.isGone()) gone.push(r.endpoint)
        else console.error('push failed', String(e))
      }
    }))
    if (gone.length) await rpc('push_gone', { p_endpoints: gone })
    return Response.json({ sent, gone: gone.length }, { headers: cors })
  } catch (e) {
    console.error(String(e))
    return Response.json({ error: 'failed' }, { status: 500, headers: cors })
  }
})
