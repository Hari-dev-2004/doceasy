// Service worker for improving WebRTC connectivity in DocEasy

const CACHE_NAME = 'doceasy-cache-v1';
const SIGNALING_CACHE_MAX_AGE = 30000; // 30 seconds 

// Static assets that should be cached
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.ico'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
    .then(() => self.clients.claim())
  );
});

// Response generator for offline API
const generateOfflineResponse = (request) => {
  // For WebRTC signaling api calls when server is unreachable
  if (request.url.includes('/api/webrtc')) {
    if (request.url.includes('/rooms/') && request.url.includes('/join')) {
      // Mock join room response
      return new Response(JSON.stringify({
        success: true,
        user_id: 'offline-' + Date.now(),
        message: 'Using direct peer mode due to server unavailability'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (request.url.includes('/messages')) {
      // Mock empty messages response
      return new Response(JSON.stringify({
        messages: []
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (request.url.includes('/signal') && request.method === 'POST') {
      // Mock signal response
      return new Response(JSON.stringify({
        success: true,
        message: 'Signal received in offline mode'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  // For health check endpoint
  if (request.url.includes('/health')) {
    return new Response(JSON.stringify({
      status: 'offline',
      message: 'Service worker providing offline fallback'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Default offline response
  return new Response(JSON.stringify({
    status: 'offline',
    message: 'No internet connection'
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
};

// Intercept fetch requests
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }
  
  // Handle API requests with network-first strategy and offline fallback
  if (request.url.includes('/api/') || request.url.includes('/health')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // If we get a successful response, return it
          if (response.ok) {
            return response;
          }
          
          // If we get an error response from the server, return the error
          return response;
        })
        .catch(error => {
          console.log('Fetch failed, switching to offline mode:', error);
          
          // For API endpoints, return generated offline responses
          return generateOfflineResponse(request);
        })
    );
    return;
  }
  
  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request)
          .then(response => {
            // Cache successful responses for static assets
            if (response.ok && (request.url.includes('.js') || 
                                request.url.includes('.css') || 
                                request.url.includes('.png') || 
                                request.url.includes('.jpg') ||
                                request.url.includes('.svg'))) {
              let responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(request, responseToCache);
                });
            }
            return response;
          })
          .catch(() => {
            // Return offline page for document requests
            if (request.mode === 'navigate') {
              return caches.match('/');
            }
            return new Response('Network error', { status: 408 });
          });
      })
  );
});

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
}); 