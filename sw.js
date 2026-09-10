/* connec+a 公開サイト Service Worker — 画像(写真/地図/ロゴ)とページ本体を常駐キャッシュ
   方針:
     - 画像 = stale-while-revalidate: 表示は即キャッシュ(常駐)、裏で再検証して次回反映
     - ページ(navigate) = network-first: 常に最新を試行、オフライン/障害時のみキャッシュ
       → インラインSVGアイコンはHTML内なのでページキャッシュで常駐
     - 対象は同一オリジンのGETのみ(GAS/Google Fonts等の外部は素通し)
   キャッシュを強制リセットしたいときは VERSION を上げて再デプロイ */
var VERSION = 'hp-v1';
var IMG_CACHE = VERSION + '-img';
var PAGE_CACHE = VERSION + '-page';
var IMG_RE = /\.(?:jpe?g|png|webp|gif|svg|avif|ico)$/i;

/* index.html が参照する全画像(初回訪問時にバックグラウンドで温める) */
var PRECACHE_IMAGES = [
  '/connecta-logo.png',
  '/connecta-icon.png',
  '/japan-map.png',
  '/map-kanto.png',
  '/map-kansai.png',
  '/coco-event.jpg',
  '/388f0872-f94b-49ce-b3a5-934b15d38dd4-x4.jpg',
  '/shinjuku-o-guard_large.jpg',
  '/nishi-shinjuku-intersection-2_large.jpg',
  '/jeremy-santana-7_puF4jioPo-unsplash.jpg',
  '/louie-martinez-IocJwyqRv3M-unsplash.jpg',
  '/pichai-sodsai-E_JLhd4yIKI-unsplash.jpg',
  '/steven-he-Y5JbvpVX1cw-unsplash.jpg',
  '/su-san-lee-E_eWwM29wfU-unsplash.jpg',
  '/syuhei-inoue-kaoHI0iHJPM-unsplash.jpg',
  '/yu-kato-824OwkP7sgk-unsplash.jpg',
  '/content-photos/depts-cclab.jpg',
  '/content-photos/depts-cclab-events-1-2.jpg',
  '/content-photos/depts-cclab-events-2-2.jpg',
  '/content-photos/depts-dg0dmc8.jpg',
  '/content-photos/depts-dg0dmc8-events-0-2.jpg',
  '/content-photos/depts-dg0dmc8-events-1-2.jpg',
  '/content-photos/depts-if.jpg',
  '/content-photos/depts-koho.jpg',
  '/content-photos/disc-cards-1-1.jpg',
  '/content-photos/disc-cards-2-1.jpg',
  '/content-photos/moments-a-0-1.jpg',
  '/content-photos/moments-a-4-1.jpg',
  '/content-photos/pillars-koryu-dial.jpg',
  '/content-photos/regions-kanto-pins-1.jpg'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(IMG_CACHE).then(function (cache) {
      /* 1枚の失敗で全滅しないよう個別fetch+allSettled(cache.addAllは不可) */
      return Promise.allSettled(PRECACHE_IMAGES.map(function (u) {
        return cache.match(u).then(function (hit) {
          if (hit) return;
          return fetch(u).then(function (res) {
            if (res && res.ok) return cache.put(u, res);
          });
        });
      }));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k.indexOf(VERSION + '-') !== 0) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;

  /* ページ本体: network-first(最新優先・落ちたらキャッシュ) */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(PAGE_CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('/index.html');
        });
      })
    );
    return;
  }

  /* 画像: stale-while-revalidate(即キャッシュ表示+裏で更新) */
  if (IMG_RE.test(url.pathname)) {
    e.respondWith(
      caches.open(IMG_CACHE).then(function (cache) {
        return cache.match(req).then(function (hit) {
          var refresh = fetch(req).then(function (res) {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          }).catch(function () { return hit; });
          return hit || refresh;
        });
      })
    );
  }
});
