// Notifications on this phone: the day-before reminder, someone new to rate, join requests (admins).
// The phone's push subscription is saved for the player of the open group; a phone in two
// groups saves it for each one it turns on. The service worker shows them (public/push-sw.js).
import { api } from '../data'
import { getMyCode } from './identity'

const KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

// 'ok' | 'install' (iPhone/iPad: only from the home-screen app) | 'blocked' (the user said no
// in the phone's settings) | 'none' (this browser can't, or the app has no key)
export function pushState() {
  if (!KEY || api.mode === 'demo') return 'none'
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
  if (ios && !standalone) return 'install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'none'
  if (Notification.permission === 'denied') return 'blocked'
  return 'ok'
}

const toKey = (b64) => {
  const raw = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

// The app's service worker (null if it isn't running: dev server, or it failed to install).
const worker = (wait) =>
  wait ? Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 8000))]) : navigator.serviceWorker.getRegistration()

async function subscription(create) {
  const reg = await worker(create)
  if (!reg) return null
  const sub = await reg.pushManager.getSubscription()
  if (sub || !create) return sub
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(KEY) })
}

// Whether notifications are on for the open group on this phone.
export async function pushOn() {
  if (pushState() !== 'ok' || Notification.permission !== 'granted') return false
  const sub = await subscription(false)
  return Boolean(sub && (await api.hasPush(getMyCode(), sub.endpoint)))
}

// Turn on (must run from a tap: the phone asks for permission). Returns true when on.
export async function turnPushOn() {
  if (pushState() !== 'ok') return false
  if ((await Notification.requestPermission()) !== 'granted') return false
  const sub = await subscription(true)
  if (!sub) return false
  await api.savePush(getMyCode(), sub.toJSON())
  return true
}

// Off for the open group only (other groups on this phone keep theirs).
export async function turnPushOff() {
  const sub = await subscription(false)
  if (sub) await api.dropPush(getMyCode(), sub.endpoint)
}
