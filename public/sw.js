// ROUGEE PWA Service Worker
// Optimized for blockchain music platform with IPFS integration

// 🔄 UPDATE VERSION NUMBER HERE TO TRIGGER PWA UPDATE
// Increment the version (v7 -> v8) when you want users to get the update prompt
const VERSION = 'v8'; // <-- Change this number to force update

const CACHE_NAME = `rougee-${VERSION}`;
const STATIC_CACHE = `rougee-static-${VERSION}`;
const DYNAMIC_CACHE = `rougee-dynamic-${VERSION}`;
const IPFS_CACHE = `rougee-ipfs-${VERSION}`; // Immutable IPFS content (long-lived)
const API_CACHE = `rougee-api-${VERSION}`; // API responses (short-lived)

// Cache size limits to prevent excessive storage
const MAX_DYNAMIC_ITEMS = 50;
const MAX_API_ITEMS = 30;
const MAX_IPFS_ITEMS = 100;

// Files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/favicon.png'
];

// Cache management helper
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    await trimCache(cacheName, maxItems);
  }
}

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📦 Caching static files...');
        return cache.addAll(STATIC_FILES).catch(err => {
          console.warn('⚠️ Some static files failed to cache:', err);
          // Don't fail installation if some files don't cache
          return Promise.resolve();
        });
      })
      .then(() => {
        console.log('✅ Static files cached');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== IPFS_CACHE && 
                cacheName !== API_CACHE &&
                cacheName.startsWith('rougee-')) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Claim all clients immediately
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker activated');
    })
  );
});

// Fetch event - handle requests with improved strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // STRICT MEDIA BYPASS: Never intercept any audio/video or streaming requests
  const isMedia =
    url.pathname.match(/\.(mp3|wav|ogg|flac|m4a|aac|webm|mp4|mkv|mov)$/i) ||
    request.headers.get('range') ||
    request.headers.get('accept')?.match(/audio|video/i) ||
    url.pathname.includes('ipfs-proxy') ||
    url.pathname.includes('/audio/') ||
    url.hostname.includes('supabase.co') && url.pathname.includes('/storage/');

  if (isMedia) {
    // Let the browser handle media streaming directly with proper Range support
    return;
  }

  // IPFS Images and static content - Cache first with size limit (immutable content)
  if ((url.hostname.includes('ipfs') || url.hostname.includes('lighthouse')) && 
      !url.pathname.includes('ipfs-proxy')) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            console.log('⚡ IPFS cache hit:', url.pathname.slice(0, 50));
            return cachedResponse;
          }
          // Not in cache, fetch and cache
          return fetch(request, { mode: 'cors', credentials: 'omit' })
            .then((response) => {
              if (response.status === 200 && response.headers.get('content-type')?.includes('image')) {
                const responseClone = response.clone();
                caches.open(IPFS_CACHE)
                  .then((cache) => {
                    cache.put(request, responseClone);
                    trimCache(IPFS_CACHE, MAX_IPFS_ITEMS); // Limit cache size
                    console.log('💾 Cached IPFS:', url.pathname.slice(0, 50));
                  });
              }
              return response;
            })
            .catch(err => {
              console.error('❌ IPFS fetch failed:', err);
              throw err;
            });
        })
    );
  }
  // HTML files - Network first with no-cache header (for SPA routing)
  else if (url.pathname === '/' || url.pathname.includes('.html')) {
    event.respondWith(
      fetch(request, { 
        cache: 'no-cache',
        headers: { 'Cache-Control': 'no-cache' }
      })
        .then((response) => {
          // Only cache in production, not on localhost
          if (response.status === 200 && !url.hostname.includes('localhost')) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE)
              .then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails (offline mode)
          console.log('📦 Network failed, serving from cache:', url.pathname);
          return caches.match(request);
        })
    );
  }
  
  // Supabase Edge Functions - BYPASS completely
  else if (url.pathname.includes('/functions/')) {
    console.log('🔧 Bypassing SW for Supabase function:', url.pathname);
    return;
  }
  
  // API requests - Stale-while-revalidate with cache trimming
  else if (url.pathname.includes('/api/') || 
           (url.hostname.includes('supabase') && url.pathname.includes('/rest/'))) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          const fetchPromise = fetch(request)
            .then((response) => {
              // Cache successful API responses
              if (response.status === 200) {
                const responseClone = response.clone();
                caches.open(API_CACHE)
                  .then((cache) => {
                    cache.put(request, responseClone);
                    trimCache(API_CACHE, MAX_API_ITEMS); // Limit cache size
                  });
              }
              return response;
            })
            .catch(() => null);
          
          // Return cached response immediately if available, update cache in background
          return cachedResponse || fetchPromise;
        })
    );
  }
  
  // XMTP and blockchain requests - network only (real-time data)
  else if (url.hostname.includes('xmtp') || 
           url.hostname.includes('ephemera') ||
           url.hostname.includes('rpc')) {
    return;
  }
  
  // Other requests - Cache first with network fallback
  else {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(request)
            .then((response) => {
              if (response.status === 200) {
                const responseClone = response.clone();
                caches.open(DYNAMIC_CACHE)
                  .then((cache) => {
                    cache.put(request, responseClone);
                    trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_ITEMS); // Limit cache size
                  });
              }
              return response;
            })
            .catch(err => {
              console.error('❌ Fetch failed:', err);
              throw err;
            });
        })
    );
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered:', event.tag);
  
  if (event.tag === 'xmtp-sync') {
    event.waitUntil(
      self.clients.matchAll()
        .then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'XMTP_SYNC',
              action: 'sync-messages'
            });
          });
        })
    );
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  console.log('📱 Push notification received');
  
  const data = event.data?.json() || {};
  const options = {
    body: data.body || 'New message received',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/messages'
    },
    actions: [
      {
        action: 'open',
        title: 'Open',
        icon: '/icons/icon-96x96.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    tag: data.tag || 'default',
    renotify: true,
    requireInteraction: false
  };
  
  event.waitUntil(
    self.registration.showNotification('ROUGEE', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    const urlToOpen = event.notification.data?.url || '/';
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Check if there's already a window open
          for (const client of clientList) {
            if (client.url.includes(urlToOpen) && 'focus' in client) {
              return client.focus();
            }
          }
          // Open new window if no matching window found
          if (self.clients.openWindow) {
            return self.clients.openWindow(urlToOpen);
          }
        })
    );
  }
});

// Message handling for communication with main app
self.addEventListener('message', (event) => {
  console.log('💬 Message received in service worker:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'XMTP_SYNC') {
    // Trigger background sync for XMTP
    if ('sync' in self.registration) {
      self.registration.sync.register('xmtp-sync')
        .catch(err => console.error('Sync registration failed:', err));
    }
  }
  
  // Clear specific cache
  if (event.data.type === 'CLEAR_CACHE') {
    const cacheName = event.data.cacheName;
    event.waitUntil(
      caches.delete(cacheName)
        .then(() => {
          console.log('🗑️ Cache cleared:', cacheName);
        })
    );
  }
});

console.log('🎵 ROUGEE Service Worker loaded - Version', VERSION);
