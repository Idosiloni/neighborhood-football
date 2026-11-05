// Makes a VAPID key pair for phone notifications (once per Supabase project):
//   node scripts/vapid-keys.mjs <output folder outside the project>
// Writes vapid-private.json (the VAPID_KEYS secret for the push function; never commit it) and
// prints the public key for VITE_VAPID_PUBLIC_KEY (fine to share: every phone gets it).
import { writeFileSync, chmodSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2]
if (!dir) throw new Error('usage: node scripts/vapid-keys.mjs <folder>')
const { subtle } = globalThis.crypto
const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const exported = { publicKey: await subtle.exportKey('jwk', pair.publicKey), privateKey: await subtle.exportKey('jwk', pair.privateKey) }
const raw = Buffer.from(await subtle.exportKey('raw', pair.publicKey)).toString('base64url')
const file = join(dir, 'vapid-private.json')
writeFileSync(file, JSON.stringify(exported))
chmodSync(file, 0o600)
console.log(raw)
