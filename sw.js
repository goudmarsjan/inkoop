
const CACHE_NAME = "goudmarsjan-v3";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./logo.png"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Een ontbrekend optioneel bestand mag de installatie
    // van de service worker niet laten mislukken.
    await Promise.all(
      ASSETS.map(async path => {
        try {
          const response = await fetch(path, {
            cache: "reload"
          });

          if (response.ok) {
            await cache.put(path, response);
          }
        } catch (error) {
          // Het bestand kan later opnieuw worden opgehaald.
        }
      })
    );

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter(key =>
          key.startsWith("goudmarsjan-") &&
          key !== CACHE_NAME
        )
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const scopeUrl = new URL(self.registration.scope);

  // Supabase, CDN's en andere externe diensten nooit cachen.
  if (url.origin !== self.location.origin) return;

  // Alleen bestanden binnen de map van dit programma behandelen.
  if (!url.pathname.startsWith(scopeUrl.pathname)) return;

  // Pagina's: eerst de nieuwste versie van de server proberen.
  if (
    request.mode === "navigate" ||
    url.pathname.endsWith("/index.html") ||
    url.pathname === scopeUrl.pathname
  ) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);

      try {
        const response = await fetch(request, {
          cache: "no-store"
        });

        if (response.ok) {
          await cache.put("./index.html", response.clone());
        }

        return response;
      } catch (error) {
        return (
          await cache.match("./index.html") ||
          await cache.match("./") ||
          Response.error()
        );
      }
    })());

    return;
  }

  // Andere lokale bestanden: cache gebruiken indien beschikbaar,
  // en op de achtergrond een nieuwe versie ophalen.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    const update = fetch(request).then(async response => {
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    });

    if (cached) {
      event.waitUntil(update.catch(() => {}));
      return cached;
    }

    try {
      return await update;
    } catch (error) {
      return Response.error();
    }
  })());
});
