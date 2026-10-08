/// <reference lib="webworker" />
import type { PushPayload } from '@/features/push/types'

declare const self: ServiceWorkerGlobalScope

function parsePayload(event: PushEvent): PushPayload | null {
  try {
    const data: unknown = event.data?.json()
    if (!data || typeof data !== 'object') return null
    const { title, body, url, tag } = data as Record<string, unknown>
    if (typeof title !== 'string' || typeof url !== 'string' || !url.startsWith('/')) return null
    return {
      title,
      body: typeof body === 'string' ? body : '',
      url,
      tag: typeof tag === 'string' ? tag : 'vibely',
    }
  } catch {
    return null
  }
}

async function showPush(payload: PushPayload) {
  // Skip the notification if the user is already looking at that exact screen.
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const viewing = windows.some(
    (c) => c.focused && c.visibilityState === 'visible' && new URL(c.url).pathname === payload.url,
  )
  if (viewing) return
  await self.registration.showNotification(payload.title, {
    body: payload.body,
    tag: payload.tag,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: payload.url },
  })
}

async function openUrl(path: string) {
  const target = new URL(path, self.location.origin)
  if (target.origin !== self.location.origin) return
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const exact = windows.find((c) => new URL(c.url).pathname === target.pathname)
  if (exact) {
    await exact.focus()
    return
  }
  const any = windows[0]
  if (any) {
    try {
      // navigate() only works on windows this worker controls; otherwise open a new one.
      const navigated = await any.navigate(target.href)
      if (navigated) {
        await navigated.focus()
        return
      }
    } catch {}
  }
  await self.clients.openWindow(target.href)
}

export function registerPushHandlers() {
  self.addEventListener('push', (event) => {
    const payload = parsePayload(event)
    if (payload) event.waitUntil(showPush(payload))
  })

  self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const data: unknown = event.notification.data
    const url =
      data && typeof data === 'object' && 'url' in data && typeof data.url === 'string'
        ? data.url
        : '/'
    event.waitUntil(openUrl(url))
  })
}
