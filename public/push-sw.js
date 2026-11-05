// Loaded into the app's service worker (vite.config.js → workbox.importScripts).
// Shows a notification from the push function and opens the right screen when it is tapped.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data && event.data.text() }
  }
  const he = /[֐-׿]/.test((data.title || '') + (data.body || ''))
  event.waitUntil(
    self.registration.showNotification(data.title || 'כדורגל שכונה', {
      body: data.body || '',
      tag: data.tag,
      data: { url: data.url || '/' },
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      lang: he ? 'he' : 'en',
      dir: he ? 'rtl' : 'ltr',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.location.origin))
      // navigate() fails for a window this worker doesn't control: then a new one.
      if (open) return open.navigate(url).then((c) => (c || open).focus()).catch(() => self.clients.openWindow(url))
      return self.clients.openWindow(url)
    }),
  )
})
