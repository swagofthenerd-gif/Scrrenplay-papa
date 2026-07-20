/* Papa Rentals service worker: app shell opens instantly, works offline. */
const CACHE = 'papa-rentals-v2'
const IMG_CACHE = 'papa-img-v1'
const IMG_CACHE_MAX = 60
const PRECACHE = [
  './', './index.html', './manifest.webmanifest', './icon.svg',
  './fonts/plus-jakarta-sans-latin.woff2', './fonts/plus-jakarta-sans-latin-ext.woff2',
]

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== IMG_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

async function trimCache(name, max) {
  const cache = await caches.open(name)
  const keys = await cache.keys()
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)))
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // listing photos: stale-while-revalidate in a capped, separate cache
  if (url.hostname === 'images.unsplash.com') {
    e.respondWith(
      caches.open(IMG_CACHE).then((cache) =>
        cache.match(req).then((hit) => {
          const refresh = fetch(req)
            .then((res) => {
              if (res.ok || res.type === 'opaque') {
                cache.put(req, res.clone()).then(() => trimCache(IMG_CACHE, IMG_CACHE_MAX))
              }
              return res
            })
            .catch(() => hit)
          return hit || refresh
        })
      )
    )
    return
  }

  if (url.origin !== location.origin) return

  // navigations: network-first with cached shell fallback (offline reload works)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('./index.html', copy))
          return res
        })
        .catch(() => caches.match('./index.html'))
    )
    return
  }

  // assets: stale-while-revalidate (instant loads, fresh next time)
  e.respondWith(
    caches.match(req).then((hit) => {
      const refresh = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => hit)
      return hit || refresh
    })
  )
})
