// Browser-only Web Push helpers (call from effects or event handlers).
import { publicEnv } from '@/lib/env'
import { isIos, isStandalone } from '@/features/pwa/platform'
import { deletePushSubscription, savePushSubscription } from './actions'
import type { SubscriptionInput } from './schemas'

export type PushStatus = 'loading' | 'unsupported' | 'ios-install' | 'blocked' | 'off' | 'on'

const vapidKey = publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function supported(): boolean {
  return (
    Boolean(vapidKey) &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

// base64url VAPID public key → bytes for pushManager.subscribe().
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  return (await navigator.serviceWorker.getRegistration('/')) ?? undefined
}

function toInput(sub: PushSubscription): SubscriptionInput {
  const json = sub.toJSON()
  return {
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
  }
}

export async function getPushStatus(sync = false): Promise<PushStatus> {
  // iOS Safari exposes Web Push only to apps added to the Home Screen.
  if (isIos() && !isStandalone() && vapidKey) return 'ios-install'
  if (!supported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  const sub = await (await registration())?.pushManager.getSubscription()
  if (!sub || Notification.permission !== 'granted') return 'off'
  // Re-saving keeps the stored locale current and the row tied to the signed-in account.
  if (sync) await savePushSubscription(toInput(sub))
  return 'on'
}

export async function enablePush(): Promise<PushStatus | 'failed'> {
  if (!supported() || !vapidKey) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission === 'denied') return 'blocked'
  if (permission !== 'granted') return 'off'
  try {
    const reg = (await registration()) ?? (await navigator.serviceWorker.register('/sw.js'))
    await navigator.serviceWorker.ready
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(vapidKey),
      }))
    const result = await savePushSubscription(toInput(sub))
    return result.ok ? 'on' : 'failed'
  } catch (e) {
    console.error('[push] subscribe failed', e)
    return 'failed'
  }
}

// Also called on sign-out, so the next person on this device does not get these notifications.
export async function disablePush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const sub = await (await registration())?.pushManager.getSubscription()
  if (!sub) return
  await deletePushSubscription(sub.endpoint)
  await sub.unsubscribe()
}
