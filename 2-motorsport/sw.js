// HSN Otomotiv – service worker (uygulama kabuğunu önbellekler; veri her zaman canlı gelir)
// Bu dosya build sırasında üretilir; VERSION her derlemede değişir, eski önbellek temizlenir.
const VERSION = "202609232328";
const CACHE = "hsn-" + VERSION;
const SHELL = [
  "hesabim.html", "panel.html", "randevu.html", "style.css", "site.js", "favicon.svg",
  "app/app.css", "app/config.js", "app/data.js", "app/portal.js", "app/panel.js", "app/pwa.js",
  "app/icons/musteri-192.png", "app/icons/servis-192.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("hsn-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Supabase, fontlar, haritalar: her zaman ağdan

  // Sayfalar: önce ağ (güncel içerik), bağlantı yoksa önbellek
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("hesabim.html")))
    );
    return;
  }
  // Dosyalar: önbellekten hızlı ver, arka planda güncelle
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; }).catch(() => hit);
      return hit || net;
    })
  );
});
