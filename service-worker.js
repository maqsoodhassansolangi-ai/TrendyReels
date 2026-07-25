// ============================================
// TrendyReels — Service Worker (Network-First)
// ============================================
// ✅ حکمت عملی: ہمیشہ پہلے انٹرنیٹ سے تازہ ترین فائل لانے کی کوشش کریں۔
// صرف انٹرنیٹ نہ ہونے کی صورت میں پرانی (cached) فائل دکھائیں۔
// اس طرح مستقبل میں کوئی بھی فائل بدلنے پر یوزر کو خودکار نیا ورژن ملے گا —
// نہ کوئی دستی "version number" بڑھانے کی ضرورت، نہ کچھ اور۔

const CACHE_NAME = 'trendyreels-cache-v1'; // ✅ صرف تب بدلیں جب precache والی فائلوں کی فہرست بدلے

// یہ چند بنیادی فائلیں پہلی وزٹ پر cache ہو جائیں گی (offline fallback کے لیے)
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/user.js',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png'
];

// --- Install: بنیادی فائلیں cache کریں، فوراً فعال ہو جائیں ---
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    );
    self.skipWaiting(); // ✅ نیا service worker فوراً فعال ہو، پرانے کے انتظار میں نہ رہے
});

// --- Activate: پرانے caches صاف کریں، فوراً کنٹرول سنبھالیں ---
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
        )
    );
    self.clients.claim(); // ✅ کھلے ہوئے تمام ٹیبز فوراً نئے worker کے کنٹرول میں آ جائیں
});

// --- Fetch: Network-First — پہلے انٹرنیٹ سے تازہ ترین لائیں، ناکامی پر cache سے دکھائیں ---
self.addEventListener('fetch', (event) => {
    // صرف GET requests کیش کریں (POST/PATCH/DELETE — یعنی Supabase لکھنے والی requests — کبھی cache نہ ہوں)
    if (event.request.method !== 'GET') return;

    // ✅ Admin پینل، API proxy، اور بیرونی video/API ہوسٹس کبھی cache نہ ہوں — ہمیشہ تازہ ڈیٹا آئے
    const skipHosts = ['supabase.co', 'youtube.com', 'googleapis.com', 'dailymotion.com', 'dmcdn.net'];
    if (event.request.url.includes('admin.html') || event.request.url.includes('/api/') || skipHosts.some(h => event.request.url.includes(h))) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // ✅ کامیاب response کو cache میں بھی محفوظ کر لیں (اگلی offline وزٹ کے لیے)
                const clonedResponse = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, clonedResponse);
                });
                return networkResponse;
            })
            .catch(() => {
                // ❌ انٹرنیٹ نہیں — پرانی محفوظ شدہ فائل دکھائیں
                return caches.match(event.request).then((cachedResponse) => {
                    return cachedResponse || caches.match('/index.html');
                });
            })
    );
});
