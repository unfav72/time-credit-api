const CACHE_NAME = 'timecredit-live-v2-fresh';
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/offline.html'
];

// Install: Immediately skip waiting to take over
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(console.warn);
    })
  );
});

// Activate: Immediately claim all clients and PURGE all stale caches to prevent blank screen errors
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

// Fetch: Always Network-First for navigation and code chunks; Never serve stale HTML
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. NEVER cache API requests, auth calls, or database operations
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({
            error: 'You are currently offline. Live operations require an active network connection.',
            offline: true
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 503
          }
        );
      })
    );
    return;
  }

  // 2. Navigational requests (HTML): Always Network-First to guarantee fresh chunk hashes!
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/offline.html');
      })
    );
    return;
  }

  // 3. Static assets & media: Network-first with cache fallback
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// Web Push Notification Event Handler
self.addEventListener('push', (event) => {
  let data = {
    title: 'TimeCredit Live Update',
    body: 'You have a new update on TimeCredit Live.',
    icon: '/logo.png',
    badge: '/icons/icon-192.png',
    data: { url: '/' }
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/logo.png',
    badge: data.badge || '/icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: data.data || { url: '/' }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Web Push Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

