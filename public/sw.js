const CACHE_NAME = "learning-bengali-offline-v5";
const PRECACHE_URLS = [
  "/",
  "/lessons",
  "/review",
  "/progress",
  "/vocabulary",
  "/strengthen",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/practice/u01-l01-greetings",
  "/practice/u01-l02-how-are-you",
  "/practice/u02-l01-introduce-yourself",
  "/practice/u02-l02-family-words",
  "/practice/u03-l01-food-and-water",
  "/practice/u03-l02-hungry-and-thirsty",
  "/practice/u04-l01-yes-no-replies",
  "/practice/u04-l02-simple-questions",
  "/practice/u05-l01-basic-feelings",
  "/practice/u05-l02-asking-for-help",
  "/practice/u06-l01-visiting-home",
  "/practice/u06-l02-politeness-at-home",
  "/practice/u07-l01-getting-around",
  "/practice/u07-l02-transport-help",
  "/practice/u08-l01-small-talk",
  "/practice/u08-l02-care-and-emergencies",
  "/practice/es-u01-l01-hello-and-thanks",
  "/practice/es-u01-l02-slowly-and-english",
  "/practice/es-u02-l01-my-name-is",
  "/practice/es-u02-l02-traveling-in-peru",
  "/practice/es-u03-l01-where-is-it",
  "/practice/es-u03-l02-taxi-and-directions",
  "/practice/es-u04-l01-ordering-food",
  "/practice/es-u04-l02-food-needs",
  "/practice/es-u05-l01-hotel-basics",
  "/practice/es-u05-l02-tour-questions",
  "/practice/es-u06-l01-market-prices",
  "/practice/es-u06-l02-buying-and-paying",
  "/practice/es-u07-l01-help-and-health",
  "/practice/es-u07-l02-lost-documents",
  "/practice/es-u08-l01-machu-picchu-and-tours",
  "/practice/es-u08-l02-altitude-and-photos",
  "/practice/ml-u01-l01-greetings-and-respect",
  "/practice/ml-u01-l02-how-are-you",
  "/practice/ml-u01-l03-names-and-introductions",
  "/practice/ml-u01-l04-family-and-people",
  "/practice/ml-u02-l01-food-and-drinks",
  "/practice/ml-u02-l02-visiting-someones-home",
  "/practice/ml-u02-l03-daily-conversation",
  "/practice/ml-u02-l04-questions-and-small-talk",
  "/practice/ml-u02-l05-travel-and-getting-around",
  "/practice/ml-u03-l01-polite-requests",
  "/practice/ml-u03-l02-feelings-and-needs",
  "/practice/ml-u03-l03-help-and-emergencies",
  "/practice/ml-u03-l04-review-everyday-malayalam",
  "/practice/hist-u13-l01-ancient-peru-before-the-inca",
  "/practice/hist-u13-l02-the-inca-empire",
  "/practice/hist-u13-l03-cusco-as-a-capital",
  "/practice/hist-u13-l04-roads-terraces-and-mountain-life",
  "/practice/hist-u13-l05-machu-picchu",
  "/practice/hist-u13-l06-spanish-conquest",
  "/practice/hist-u13-l07-colonial-peru-and-lima",
  "/practice/hist-u13-l08-independence-from-spain",
  "/practice/hist-u13-l09-indigenous-culture-and-modern-peru",
  "/practice/hist-u13-l10-peru-today-cities-tourism-and-memory",
  "/favicon.ico",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            cache.add(new Request(url, { cache: "reload" })),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/lessons"));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/audio/") ||
    url.pathname.includes("favicon") ||
    url.pathname.includes("apple-touch-icon")
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok) {
    cache.put(request, response.clone());
  }

  return response;
}

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);

    if (response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);

      if (fallback) {
        return fallback;
      }
    }

    return new Response("Offline", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      status: 503,
    });
  }
}
