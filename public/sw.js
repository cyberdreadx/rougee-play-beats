// ROUGEE PLAY PWA Service Worker
// Optimized for XMTP messaging and blockchain music platform

// 🔄 UPDATE VERSION NUMBER HERE TO TRIGGER PWA UPDATE
// Increment the version (v6 -> v7) when you want users to get the update prompt
const VERSION = 'v7'; // <-- Change this number to force update

const CACHE_NAME = `rougee-play-${VERSION}`;
const STATIC_CACHE = `rougee-play-static-${VERSION}`;
const DYNAMIC_CACHE = `rougee-play-dynamic-${VERSION}`;
const IPFS_CACHE = `rougee-play-ipfs-${VERSION}`; // Immutable IPFS content
const API_CACHE = `rougee-play-api-${VERSION}`; // API responses

// Files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📦 Caching static files...');
        return cache.addAll(STATIC_FILES);
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
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== IPFS_CACHE && 
                cacheName !== API_CACHE) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Handle different types of requests
  if (request.method === 'GET') {
    // STRICT MEDIA BYPASS: Never intercept any audio/video or proxy requests
    const isMedia =
      url.pathname.match(/\.(mp3|wav|ogg|flac|m4a|aac|webm|mp4|mkv|mov)$/i) ||
      request.headers.get('range') ||
      request.headers.get('accept')?.match(/audio|video/i) ||
      url.pathname.includes('ipfs-proxy') ||
      url.hostname.includes('supabase.co') ||
      url.hostname.includes('lighthouse.storage') ||
      url.hostname.includes('gateway.lighthouse.storage');

    if (isMedia) {
      // Let the browser stream media directly with proper Range support
      return;
    }

    // IPFS Images/Other - Cache first (immutable content)
    if (url.hostname.includes('ipfs') || url.hostname.includes('lighthouse')) {
      event.respondWith(
        caches.match(request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              console.log('⚡ IPFS cache hit:', url.pathname.slice(0, 50));
              return cachedResponse;
            }
            // Not in cache, fetch and cache
            return fetch(request)
              .then((response) => {
                if (response.status === 200) {
                  const responseClone = response.clone();
                  caches.open(IPFS_CACHE)
                    .then((cache) => {
                      cache.put(request, responseClone);
                      console.log('💾 Cached IPFS:', url.pathname.slice(0, 50));
                    });
                }
                return response;
              });
          })
      );
    }
    // HTML files - network first, cache fallback (for SPA routing)
    else if (url.pathname === '/' || url.pathname.includes('.html')) {
      event.respondWith(
        fetch(request, {
          cache: 'no-cache' // Force fresh fetch, ignore cache
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
    
    // Supabase Edge Functions - BYPASS completely (includes IPFS proxy)
    else if (url.pathname.includes('/functions/')) {
      console.log('🔧 Bypassing SW for Supabase function:', url.pathname);
      return; // Let the request pass through without SW intervention
    }
    
    // API requests - network first, with stale-while-revalidate strategy
    else if (url.pathname.includes('/api/') || url.hostname.includes('supabase')) {
      event.respondWith(
        caches.match(request)
          .then((cachedResponse) => {
            const fetchPromise = fetch(request)
              .then((response) => {
                // Cache successful API responses
                if (response.status === 200) {
                  const responseClone = response.clone();
                  caches.open(API_CACHE)
                    .then((cache) => cache.put(request, responseClone));
                }
                return response;
              })
              .catch(() => null);
            
            // Return cached response immediately if available, update cache in background
            return cachedResponse || fetchPromise;
          })
      );
    }
    
    // XMTP and blockchain requests - network only
    else if (url.hostname.includes('xmtp') || url.hostname.includes('ephemera')) {
      event.respondWith(fetch(request));
    }
    
    // Other requests - cache first, network fallback
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
                    .then((cache) => cache.put(request, responseClone));
                }
                return response;
              });
          })
      );
    }
  }
  
  // POST requests - network only (for XMTP messaging)
  else if (request.method === 'POST') {
    event.respondWith(fetch(request));
  }
});

// Background sync for XMTP messages
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered:', event.tag);
  
  if (event.tag === 'xmtp-sync') {
    event.waitUntil(
      // Notify the main app to sync XMTP messages
      self.clients.matchAll()
        .then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'XMTPSYNC',
              action: 'sync-messages'
            });
          });
        })
    );
  }
});

// Push notifications for new messages
self.addEventListener('push', (event) => {
  console.log('📱 Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New message received',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/messages'
    },
    actions: [
      {
        action: 'open',
        title: 'Open Messages',
        icon: '/icons/icon-96x96.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('ROUGEE PLAY', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      self.clients.openWindow('/messages')
    );
  }
});

// Message handling for communication with main app
self.addEventListener('message', (event) => {
  console.log('💬 Message received in service worker:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'XMTPSYNC') {
    // Trigger background sync for XMTP
    self.registration.sync.register('xmtp-sync');
  }
});

console.log('🎵 ROUGEE PLAY Service Worker loaded');
