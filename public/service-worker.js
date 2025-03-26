// Service Worker for Notes Editor PWA
const CACHE_NAME = 'notes-editor-v1';
const DATA_CACHE_NAME = 'notes-editor-data-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-register.js',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/icons/app-icon.svg'
];

// On install, cache the static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // We don't await this, so failing to cache some items won't block the worker
        // from installing
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// On activate, clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-first strategy with cache fallback for GET requests
// For API calls we always try network first
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // For API requests, use network-first strategy
  const isApiRequest = event.request.url.includes('/api/');
  const isProjectsRequest = event.request.url.includes('/projects/');
  const isStaticAsset = STATIC_ASSETS.some(asset => 
    event.request.url.endsWith(asset)
  );
  
  if (isApiRequest) {
    // For API requests, try network first, then fallback to cached response if available
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the response for future use
          const responseClone = response.clone();
          caches.open(DATA_CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // If network fails, try to serve from cache
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If not in default cache, check data cache
            return caches.open(DATA_CACHE_NAME).then(cache => {
              return cache.match(event.request);
            });
          });
        })
    );
  } 
  else if (isProjectsRequest) {
    // For project data, use cache-first strategy with data cache
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request)
            .then(response => {
              // Cache the fetched response
              const responseClone = response.clone();
              caches.open(DATA_CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
              return response;
            });
        })
    );
  }
  else if (isStaticAsset) {
    // For static assets, use cache-first strategy with static cache
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request)
            .then(response => {
              // Cache the fetched response
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
              return response;
            });
        })
    );
  }
  else {
    // For other requests, use network-first strategy
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request);
        })
    );
  }
});

// Handle push notifications (for future feature)
self.addEventListener('push', event => {
  let notificationData = {};
  
  try {
    notificationData = event.data.json();
  } catch (e) {
    notificationData = {
      title: 'New Notification',
      body: event.data ? event.data.text() : 'No details available',
    };
  }
  
  const options = {
    body: notificationData.body || 'Check your notes for updates',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: notificationData.data || {},
    vibrate: [100, 50, 100],
    actions: notificationData.actions || []
  };
  
  event.waitUntil(
    self.registration.showNotification(
      notificationData.title || 'Notes Editor Update',
      options
    )
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // If there's an open window, focus it
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Optional: Sync event for background syncing of notes
self.addEventListener('sync', event => {
  if (event.tag === 'sync-notes') {
    event.waitUntil(
      syncNotes()
    );
  }
});

// Function to sync notes in the background
async function syncNotes() {
  try {
    // Get pending operations from IndexedDB
    const pendingOperations = await getPendingOperationsFromDb();
    
    // Process each operation
    for (const op of pendingOperations) {
      // Try to execute the operation
      await executePendingOperation(op);
    }
    
    // If all operations succeed, clear them from the DB
    await clearCompletedOperationsFromDb();
    
  } catch (error) {
    console.error('Background sync failed:', error);
    // We don't clear the operations so they can be retried later
  }
}

// These functions would be implemented with IndexedDB in a real implementation
async function getPendingOperationsFromDb() {
  // This is a placeholder
  return [];
}

async function executePendingOperation(operation) {
  // This is a placeholder
  console.log('Executing operation:', operation);
  return true;
}

async function clearCompletedOperationsFromDb() {
  // This is a placeholder
  return true;
}