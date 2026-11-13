// Service worker: работа приложения без интернета.
//  • при установке кэширует все файлы приложения и библиотеки с CDN;
//  • файлы приложения отдаёт из кэша и обновляет в фоне (stale-while-revalidate) —
//    новая версия подхватывается при следующем открытии;
//  • библиотеки с CDN — из кэша, сеть только если их там нет.
// При выпуске новой версии увеличьте VERSION — старый кэш удалится.

const VERSION = 'v4.1.0';
const APP_CACHE = `beauty-crm-app-${VERSION}`;
const CDN_CACHE = 'beauty-crm-cdn-v1';

// Добавили новый файл в приложение — допишите его сюда.
const APP_FILES = [
  './',
  'index.html',
  'manifest.json',
  'css/styles.css',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'js/app.js',
  'js/db.js',
  'js/demo.js',
  'js/messaging.js',
  'js/components/appointment-form.js',
  'js/components/day-forms.js',
  'js/components/icons.js',
  'js/components/ui.js',
  'js/screens/alerts.js',
  'js/screens/appointment.js',
  'js/screens/backup.js',
  'js/screens/chat.js',
  'js/screens/chats.js',
  'js/screens/client.js',
  'js/screens/clients-data.js',
  'js/screens/clients.js',
  'js/screens/expenses.js',
  'js/screens/free-slots.js',
  'js/screens/gallery.js',
  'js/screens/help.js',
  'js/screens/home.js',
  'js/screens/more.js',
  'js/screens/profile.js',
  'js/screens/reviews.js',
  'js/screens/schedule-feed.js',
  'js/screens/schedule-settings.js',
  'js/screens/schedule-week.js',
  'js/screens/schedule.js',
  'js/screens/services.js',
  'js/screens/stats.js',
  'js/screens/templates.js',
  'js/screens/waitlist.js',
  'js/screens/webpage.js',
  'js/utils/appt.js',
  'js/utils/clients.js',
  'js/utils/contacts.js',
  'js/utils/dates.js',
  'js/utils/ics.js',
  'js/utils/image.js',
  'js/utils/money.js',
  'js/utils/slots.js',
  'js/utils/stats.js',
  'js/utils/waitlist.js',
  'js/utils/webpage.js',
];

/** Библиотеки по CDN (те же адреса, что в коде) */
const CDN_FILES = [
  'https://cdn.jsdelivr.net/npm/dexie@4.0.8/dist/dexie.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const app = await caches.open(APP_CACHE);
    await app.addAll(APP_FILES);
    // Библиотеки кэшируем по одной: если какая-то не скачалась, установка всё равно пройдёт
    const cdn = await caches.open(CDN_CACHE);
    await Promise.all(CDN_FILES.map(async (url) => {
      if (await cdn.match(url)) return;
      try {
        const res = await fetch(url, { mode: 'cors' });
        if (res.ok) await cdn.put(url, res);
      } catch { /* докачаем при первом использовании */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('beauty-crm-app-') && k !== APP_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Библиотеки с CDN: сначала кэш
  if (url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith((async () => {
      const cache = await caches.open(CDN_CACHE);
      const hit = await cache.match(req.url);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req.url, res.clone());
      return res;
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Файлы приложения: ответ из кэша сразу, обновление в фоне
  event.respondWith((async () => {
    const cache = await caches.open(APP_CACHE);
    const key = req.mode === 'navigate' ? 'index.html' : req;
    const cached = await cache.match(key, { ignoreSearch: true });
    const network = fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') cache.put(key, res.clone());
      return res;
    }).catch(() => null);
    if (cached) {
      event.waitUntil(network);
      return cached;
    }
    const res = await network;
    return res || new Response('Нет подключения к интернету', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
