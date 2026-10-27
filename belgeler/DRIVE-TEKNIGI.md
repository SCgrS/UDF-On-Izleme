# GÖREV D: Drive entegrasyon tekniği (MV3 Chrome eklentisi ile Drive'daki .udf dosyasını açma)

Rapordaki iddialar üç türdür. Her birinin yanında hangisi olduğu yazıyor:

- **[CANLI]**: 2026-10-05'te sınandı. Claude'un yerleşik tarayıcısında, oturum açmadan, herkese açık gdown örnek klasöründe (`15uNXeRBIhVvZJIhL4yTw4IsStMhUaaxl`) ya da `curl` ile bakıldı. Kullanıcının bağlantısı ve belgeleri açılmadı.
- **[KAYNAK]**: Altına URL'si yazılmış bir belgeye ya da açık kaynak koda dayanır.
- **[ÇIKARIM]**: Sınanmadı. Kullanıcının kendi bağlantısıyla, oturum açıkken doğrulanmalı.

## 0. Kısa sonuç ve öneri

- **Kimlik:** Dosyanın en sağlam kaynağı Drive'ın kendi gizli öğesi `#drive-active-item-info`. Ön izleme katmanı açıkken DOM'da durur ve içinde `{"id","title","mimeType"}` JSON'u vardır [CANLI]. Adobe Acrobat'ın ve PandaDoc'un eklentileri de bu öğeyi okuyor [KAYNAK]. Dosya listesinde `[data-id]` özniteliği, seçim için `aria-selected="true"`, tekil dosya sayfasında da `/file/d/<id>/` yolu kullanılır.
- **İndirme:** Baytlar eklentinin kendi `viewer.html` sayfasından alınmalı (`chrome-extension://…`, üst düzey sekme): `fetch('https://drive.usercontent.google.com/download?id=<id>&export=download&authuser=<n>', {credentials:'include'})`. `host_permissions` sayesinde CORS sorun olmaz, oturum çerezleri gider.
  - İçerik betiğinden yapılan `credentials:'include'` isteği CORS'a takılıyor [CANLI].
  - OAuth ve Drive API gerekmez.
- **Kullanıcı deneyimi (v1):**
  - (a) Önizleme katmanı açıkken ve dosya adı `.udf` ile bitiyorsa, eklentiye ait sabit konumlu "UDF olarak aç" düğmesi.
  - (e) `drive.google.com/file/d/<id>/view` sayfasında aynı düğme, istenirse otomatik yönlendirme.
  - (c) Eklenti simgesi ya da kısayol tuşuyla seçili satırı açma.
  - (b) Chrome'un kendi sağ tık menüsü Drive satırlarında çıkmaz: Drive `contextmenu` olayını `preventDefault` ediyor [CANLI].
  - (d) Marketplace ile "Birlikte aç" menüsü en doğal yol, ama Cloud projesi ve OAuth kurulumu ister. v1 için önerilmez.
- **Görüntüleyici:** MV3'ün varsayılan CSP'si `script-src 'self'`. Yazı DOM API ile kurulur, `innerHTML` kullanılmaz. Zip açmak için kütüphane şart değil: merkezi dizini okuyup `DecompressionStream('deflate-raw')` kullanmak yeter (Chrome 103+). Yazdırma `window.print()` ve dinamik `@page` ile yapılır.

## 1. Dosya kimliğini bulma

### 1.1 URL kalıpları

| Kalıp | Ne olur | Durum |
|---|---|---|
| `https://drive.google.com/file/d/<id>/view?usp=sharing` (ayrıca `drive_link`, `share_link`, `drive_open`, `drivesdk`) | Tekil dosya sayfası. Eski bağlantılı dosyalarda Drive URL'ye `?resourcekey=0-…` ekliyor. | [CANLI]: `/file/d/0B9P1L--7Wd2vU3VUVlFnbTgtS2c/view?usp=sharing` açılınca adres `…/view?resourcekey=0-WWs_XOSctfaY_0-sJBKRSQ` oldu |
| `https://drive.google.com/open?id=<id>` | 307 ile dosyada `/file/d/<id>/view?usp=drive_open` adresine, klasörde `/drive/folders/<id>?usp=drive_open` adresine gider | [CANLI] |
| `https://drive.google.com/uc?export=download&id=<id>` | 303 ile `https://drive.usercontent.google.com/download?id=<id>&export=download` adresine gider | [CANLI] |
| `https://docs.google.com/uc?export=download&id=<id>` | 303 ile aynı usercontent adresine gider | [CANLI] |
| `https://drive.google.com/drive/u/<n>/folders/<klasörId>`, `/drive/my-drive`, `/drive/shared-with-me`, `/drive/search?q=` | Liste görünümü. `<n>` çoklu hesaptaki hesap sırasıdır (authuser). | [KAYNAK] Adobe authuser'ı `/u/0/`, `/u/1/` yolundan alıyor: PandaDoc COMPARISON.md |
| Ön izleme katmanı (listede çift tık) | **URL değişmiyor**, `/drive/folders/<id>` olarak kalıyor | [CANLI] |

Kimlik biçimi: `[A-Za-z0-9_-]`. Eski kimlikler `0B…` ile başlar ve 28 karakterdir, yeniler 33, Google Dokümanlar 44 karakterdir. Pratikte `^[A-Za-z0-9_-]{10,}$` yeter (OpenLocalForGoogleDrive `{10,120}`, MarkDrive `{10,100}` kullanıyor) [KAYNAK].

`resourcekey` alanı 2021 güvenlik güncellemesiyle geldi. Dosyayı daha önce açmış biri anahtarsız da erişebiliyor, ilk kez açan için gerekiyor. URL'de varsa indirme isteğine aynen eklenmeli [KAYNAK: slashdot/arstechnica özeti, colorado.edu]. Drive API'de karşılığı `X-Goog-Drive-Resource-Keys` başlığıdır. usercontent'in CORS izin listesinde de bu başlık var [CANLI].

```js
const KIMLIK_RE = /^[A-Za-z0-9_-]{10,}$/;
function urldenKimlik(href) {
  try {
    const u = new URL(href);
    const m = u.pathname.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/);
    const id = m ? m[1] : u.searchParams.get('id');
    return id && KIMLIK_RE.test(id) ? id : null;
  } catch { return null; }
}
function hesapNo() {                 // authuser
  const m = location.pathname.match(/\/u\/(\d+)(\/|$)/);
  return m ? m[1] : new URLSearchParams(location.search).get('authuser'); // yoksa null (varsayılan hesap)
}
const resourceKey = () => new URLSearchParams(location.search).get('resourcekey');
```

### 1.2 Dosya listesinin DOM'u [CANLI, 2026-10-05, liste görünümü]

- Her satır `<tr role="row" data-id="<id>" data-target="doc" aria-selected="false|true" class="… O5x1db …">`. Aynı `data-id` satırın içindeki iki `div`'de de yineleniyor. Klasör satırlarında da `data-target="doc"` var. Üstteki klasör adı bağlantısı `div[role=link][data-target=folder]`.
- Dosya adı satırın ilk `[aria-label]` öğesinde, "<ad> <tür> [Paylaşıldı]" biçiminde. Örnekler: `"spam.txt Text Shared"`, `"gdown.pptx Microsoft PowerPoint Shared"`. Etiket **dile bağlı** ve karışık: aynı sayfada "Shared" ve "Paylaşıldı" birlikte görüldü. Bu yüzden ad yalnızca `/^(.+?\.udf)(?=\s|$)/i` gibi uzantı eşleşmesiyle çıkarılmalı. `data-tooltip` aynı metni taşıyor.
- `textContent` güvenilmez: tarih ve "Download" ekleriyle bitişik geliyor, örneğin `"spam.txt25 Haz 2022— Download"`.
- `role="gridcell"` sayısı 0 çıktı. Izgara görünümü **sınanmadı**. Başka projeler `'[role="row"][data-id], [data-id][role="gridcell"], [data-id] [role="gridcell"]'` kullanıyor [KAYNAK: manaflow-ai/cmux google-drive.js].
- Açık kaynak örneklerdeki seçiciler:
  - PandaDoc: `tr[data-id]`, `el.closest('[data-id]')` [KAYNAK]
  - OpenLocalForGoogleDrive: `'[aria-selected="true"][data-id]'` [KAYNAK]
  - MarkDrive (drive-md-editor): `closest('[data-id], [data-target], [data-doc-id]')` [KAYNAK]
  - Adobe'nin karartılmış sınıf seçicisi: `'.O5x1db.ACGwFc'` [KAYNAK]. Sınıf adları kırılgandır, kullanılmamalı.

### 1.3 Önizleme katmanı (listede çift tıkla açılan görüntüleyici) [CANLI]

Ölçülen yapı:

```
div[role="dialog"][aria-label="Görüntüleyici gösteriliyor."]     ← etiket dile bağlı
  └ div.a-b-Sh
      └ div.a-b-Sh-ng.a-b-va-Zf[role="main"]                    ← karartılmış sınıflar (Adobe de bunu kullanıyor)
          └ div#drive-active-item-info[style="display:none"]
                {"id": "1cKSdgtWrPgvEsBGmjWALOH33taGyVXKb", "title": "spam.txt", "mimeType": "text/plain"}
```

- Görüntüleyici Esc ile kapanınca `#drive-active-item-info` DOM'dan **kalkıyor** [CANLI]. Bu yüzden "öğe var mı" sorusu "görüntüleyici açık mı" sorusunun yerine geçer.
- Aynı öğe tekil dosya sayfasında (`/file/d/<id>/view`) da var. Önizlenemeyen bir dosyada (`fcn8s_from_caffe.npz`) değer `{"id":"1l_5RK28…","title":"fcn8s_from_caffe.npz","mimeType":"application/x-zip"}` çıktı. Sayfa metni "Dosya önizlenemedi …", başlık `"<ad> - Google Drive"` [CANLI].
- **Not:** zip tabanlı bir dosya `application/x-zip` olarak raporlandı. UDF de zip olduğundan `mimeType` bilgisine güvenilmemeli; karar `title` alanının `.udf` ile bitmesine göre verilmeli [CANLI + ÇIKARIM].
- Katmandaki ek ipuçları dile bağlı olduğu için yalnızca yedek olarak düşünülmeli: aria-label `"spam.txt görüntüleniyor."` (İngilizcesi "Displaying …" [KAYNAK: salauddinn FIXES.md]), Kapat düğmesi, "Birlikte aç" düğmesi (`[role=button][aria-label="Birlikte aç"]`, sınıfı `a-b-K-cd …`). Görüntüleyicinin üst çubuğunda `[role=toolbar]` yoktu [CANLI]. PandaDoc'un `[role="dialog"] [role="toolbar"]` varsayımı en azından oturumsuz görünümde tutmuyor.
- `#drive-active-item-info` kullanan açık kaynak ve ticari örnekler:
  - Adobe Acrobat eklentisi, `gsuite-content-script.js`: `JSON.parse(e.querySelector("#drive-active-item-info")?.textContent)` ile `mimeType` denetimi [KAYNAK]
  - PandaDoc, `pdf-detector.js` `resolveDriveDownloadUrl` [KAYNAK]
  - gem-factory belgesi: "`#drive-active-item-info` … `{ id, title, mimeType }`" [KAYNAK]
  - salauddinn/gdrive-video-downloader [KAYNAK]

### 1.4 Dayanıklılık sırası (en sağlamdan en kırılgana)

1. `#drive-active-item-info` JSON'u: Drive'ın kendi verisi, birden çok üründe kullanılıyor, dilden bağımsız.
2. `location.pathname` içindeki `/file/d/<id>/` ve `resourcekey` parametresi.
3. `[data-id]` ve `aria-selected="true"`: liste ya da ızgara satırı.
4. `aria-label` ya da `data-tooltip` metni: yalnızca `.udf` eşleşmesi için; dile bağlı.
5. Karartılmış sınıflar (`.a-b-Sh-ng`, `.O5x1db`, `.a-v-T` …): kullanılmamalı.

## 2. Dosya baytlarını indirme

### 2.1 Uç noktalar ve yanıtlar [CANLI, curl]

- `drive.google.com/uc?export=download&id=X` → `303` → `drive.usercontent.google.com/download?id=X&export=download`
- Son yanıt `200 application/octet-stream`, `Content-Disposition: attachment; filename="spam.txt"`.
- `authuser=0` eklenince de 200 geldi.
- Olmayan bir kimlikte `404 text/html`.
- **CORS başlıkları:**
  - usercontent yanıtı her durumda `Access-Control-Allow-Origin: *` ve `Access-Control-Allow-Credentials: false` döndürüyor. `Origin: https://drive.google.com` gönderilince de değişmedi.
  - `drive.google.com/uc` ise `Origin` gönderilince `ACAO: https://drive.google.com` ve `ACAC: true` döndürüyor, ama 303 ile usercontent'e yönlendiriyor.
- **Virüs tarama sayfası:** Büyük dosyada usercontent `200 text/html` döndürüyor, başlık "Google Drive - Virus scan warning". İçindeki form:
  ```html
  <form id="download-form" action="https://drive.usercontent.google.com/download" method="get">
    <input type="hidden" name="id" value="…"><input type="hidden" name="export" value="download">
    <input type="hidden" name="confirm" value="t"><input type="hidden" name="uuid" value="1b4fa745-…">
  ```
  - gdown da `#download-form` öğesini okuyup gizli alanları sorguya ekliyor [KAYNAK]. PandaDoc ise HTML geldiğinde (<100 KB) `&confirm=t` ekleyip yeniden deniyor [KAYNAK].
  - Eşik ikincil kaynaklara göre 100 MB (filerev.com, windowsreport). gdrive-dl gibi eski kaynaklar 25 MB diyor. Google'ın kendi yardım sayfası **bulunamadı**.
  - UDF dosyaları KB boyutunda olduğu için bu sayfa pratikte çıkmaz, ama işlenmeli.

### 2.2 Neden içerik betiğinden indirilmez [CANLI + KAYNAK]

Herkese açık bir dosyada, `drive.google.com` sayfa bağlamında ölçüldü:

- `fetch(uc…, {credentials:'include'})` → `TypeError: Failed to fetch`. Kimlik bilgisi gönderen istekte `ACAO:*` kabul edilmiyor.
- `fetch(usercontent…, {credentials:'include'})` → `Failed to fetch`.
- `credentials:'omit'` ve varsayılan `same-origin` çalıştı. Ama varsayılan modda çerez yalnızca aynı kökene, yani `drive.google.com`'a gider. Yönlendirme sonrası `drive.usercontent.google.com` isteğinde çerez yoktur. Bu yüzden özel (paylaşılmamış) dosyada içerik betiği baytları alamaz [ÇIKARIM; sınanan yalnızca herkese açık dosyaydı].
- Chrome belgesi bunu doğruluyor: "Cross-origin requests are always treated as such in content scripts, even if the extension has host permissions." [KAYNAK: developer.chrome.com …/network-requests]

### 2.3 Eklenti kökeninden fetch: çerezler ve üçüncü taraf çerez kısıtları

- Uzantı kökeni (`chrome-extension://<id>`), `host_permissions` listesindeki sitelere CORS'suz istek atabilir [KAYNAK: network-requests].
- Chrome "Storage and cookies" belgesinde iki istisna var [KAYNAK]:
  1. "Third-party cookies are never blocked even in subframes if the top-level page for a given tab is a chrome-extension:// page."
  2. "Requests from an extension to a third-party are treated as same-site if the extension has host permissions for the third-party. This means SameSite=Strict cookies can be sent. … does not apply if third-party cookies are blocked."
- Service worker'dan yapılan isteklerde çerezler DevTools'ta görünmese de gidiyor; chromium-extensions grubunda 2023-01-12'de bildirilmiş [KAYNAK].
- **Sonuç ve öneri [ÇIKARIM]:** İndirme **viewer.html içinden** yapılmalı. Böylece üst düzey sayfa `chrome-extension://` olur ve kullanıcı "üçüncü taraf çerezleri engelle" ayarını açmış olsa bile 1. istisna devreye girer. Service worker'da bu istisna yok: 2. maddedeki "same-site" muamelesi, üçüncü taraf çerezleri engelliyse geçersiz.
  - Adobe'nin yolu da bu: "viewer.html … loads it via the browser's native fetch with session cookies already present" (PandaDoc'un çözümlemesi) [KAYNAK].
  - Ayrıca `chrome.runtime` iletileri JSON'a çevrilebilir olmak zorunda [KAYNAK: messaging]. Baytları service worker'dan görüntüleyiciye taşımak base64 dönüşümü gerektirir. Görüntüleyicinin kendisi indirirse bu adım hiç olmaz.
- **Yedek yol (yalnızca gerekirse):** PandaDoc'un yaptığı gibi `chrome.cookies.getAll({url})` ile çerezleri okumak ve geçici bir `declarativeNetRequest` oturum kuralıyla `Cookie` başlığını `set` etmek. İstek `credentials:'omit'` ile atılır, kural bitince silinir [KAYNAK: pandadoc background.js 512–575. satırlar]. Bu yol `cookies` ve `declarativeNetRequest` izinleri ve daha ağır izin uyarıları getirir. v1'de gereksiz.
- **Çoklu hesap:** URL'deki `/u/<n>/` değeri `authuser=<n>` olarak eklenmeli. PandaDoc'un kendi çözümlemesi, bunu eklemeyen yaklaşım için "may fetch with wrong account's cookies" diyor [KAYNAK].
- **Gizli pencere:** Eklentiye gizli pencerede izin verilmeli. Çerez deposu ayrıdır [ÇIKARIM].
- **İndirmesi kapatılmış dosyalar:** Sahip "izleyiciler indiremez" ayarını açtıysa ya da kuruluş politikası indirmeyi engelliyorsa indirme başarısız olur. Eklenti bunu aşmaya çalışmamalı, yalnızca anlaşılır bir hata göstermeli [ÇIKARIM].

### 2.4 İndirme kodu (viewer.html içinde)

```js
// goruntule.js — chrome-extension:// üst düzey sayfa
async function udfIndir({ id, au, rk }) {
  const u = new URL('https://drive.usercontent.google.com/download');
  u.searchParams.set('id', id);
  u.searchParams.set('export', 'download');
  if (au != null) u.searchParams.set('authuser', au);
  if (rk) u.searchParams.set('resourcekey', rk);

  let r = await fetch(u, { credentials: 'include', cache: 'no-store' });
  if (r.ok && (r.headers.get('content-type') || '').startsWith('text/html')) {
    const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
    const form = doc.querySelector('form#download-form');                 // virüs tarama sayfası
    if (!form) throw new Error(new URL(r.url).hostname === 'accounts.google.com' ? 'OTURUM_YOK' : 'BEKLENMEYEN_HTML');
    const u2 = new URL(form.getAttribute('action'), u);
    if (u2.hostname !== 'drive.usercontent.google.com') throw new Error('YABANCI_ADRES'); // başka adrese gitme
    for (const i of form.querySelectorAll('input[type=hidden][name]')) u2.searchParams.set(i.name, i.value);
    if (au != null && !u2.searchParams.has('authuser')) u2.searchParams.set('authuser', au);
    r = await fetch(u2, { credentials: 'include', cache: 'no-store' });
  }
  if (!r.ok) throw new Error('HTTP_' + r.status);                          // 403: izin/indirme kapalı, 404: yok
  const b = new Uint8Array(await r.arrayBuffer());
  if (!(b[0] === 0x50 && b[1] === 0x4B && b[2] === 0x03 && b[3] === 0x04)) throw new Error('ZIP_DEGIL');
  return b;
}
```

Oturumsuz bir istek özel dosyada büyük olasılıkla `accounts.google.com` giriş sayfasına yönlenir ya da HTML döner. Bu davranış sınanmadı, ama zip imzası denetimi her durumu yakalar [ÇIKARIM].

### 2.5 Alternatif: `chrome.identity` ve Drive API (önerilmez)

Gerekenler [KAYNAK: Chrome OAuth kılavuzu, MarkDrive oauth-setup.md]:

- Bir Google Cloud projesi ve orada açılmış Drive API.
- OAuth onay ekranı.
- Uygulama türü "Chrome Extension" olan bir OAuth istemcisi (gizli anahtar yok, eklenti kimliğine bağlı).
- Paketlenmemiş geliştirme sürümünde kimliğin sabit kalması için manifest'te `"key"` alanı.
- Manifest'te `"oauth2": {client_id, scopes}`.

Kapsam sorunu [KAYNAK: Drive API "Choose scopes" belgesi]:

- `drive.file` hassas olmayan kapsamdır, ama yalnızca uygulamayla açılan ya da Picker ile seçilen dosyalara erişir. DOM'dan okunan rastgele bir kimlikle `files.get?alt=media` isteği çalışmaz [ÇIKARIM; belgedeki tanıma dayanır].
- `drive.readonly` kısıtlı kapsamdır: "restricted scope OAuth App Verification" gerekir. Veri sunucuda saklanır ya da sunucuya aktarılırsa güvenlik denetimi de gerekir.

"Testing" durumunda kalan harici uygulamada yenileme belirteci **7 günde** sona erer [KAYNAK: developers.google.com/identity/protocols/oauth2]. Kullanıcı ayrıca "doğrulanmamış uygulama" uyarısı görür.

`getAuthToken` Chrome'a giriş yapılmış hesabı kullanır [KAYNAK: chrome.identity]. Bu hesap Drive'da o an açık olan hesaptan (authuser) farklı olabilir.

**Neden kaçınılmalı:** Tarayıcıda Drive'a giriş zaten var; çerezli indirme aynı yetkiyi kurulumsuz sağlıyor. OAuth eklemek Cloud projesi, onay ekranı, doğrulama, 7 günlük süre ve hesap uyuşmazlığı getirir. Kazancı yalnızca DOM'dan bağımsızlık olur, ki o da `drive.file` ile zaten yok.

## 3. Kullanıcı deneyimi seçenekleri

### (a) Önizleme katmanına "UDF olarak aç" düğmesi (ÖNERİLEN, birincil)

**Nasıl:** `MutationObserver` ile `#drive-active-item-info` öğesi izlenir. Öğe varsa ve `title` `.udf` ile bitiyorsa düğme gösterilir. Önceki/sonraki okla dosya değiştikçe JSON da değişir; gözlemciye `characterData:true` eklenmeli.

**Düğmenin yeri:** Drive'ın çubuğuna (karartılmış sınıflar, `role=toolbar` yok) değil, `document.documentElement`'e eklenen, `position:fixed`, en yüksek `z-index`'li, **kapalı shadow root** içindeki bir düğme. Böylece Drive'ın stilleri ve yeniden çizimleri düğmeyi bozmaz.

**Artıları:**
- Kullanıcının alıştığı akış korunur: çift tık, "önizleme yok" ekranı, düğme.
- Tek dayanak `#drive-active-item-info`.

**Eksileri ve kırılganlık:**
- Drive bu öğeyi kaldırırsa çalışmaz. Öğe Adobe ve PandaDoc'ta da kullanıldığı için orta-düşük risk.
- Katman dışına yapılan tıklama Drive katmanını kapatabilir. Zararsız, çünkü yeni sekme açılıyor.

**İsteğe bağlı:** "UDF dosyasında otomatik aç" ayarı. Katman açılır açılmaz görüntüleyici açılır.

```js
// icerik.js (ISOLATED dünya, drive.google.com)
const UDF_RE = /\.udf$/i;
function aktifOge() {
  const el = document.getElementById('drive-active-item-info');
  if (el) try {
    const j = JSON.parse(el.textContent);
    if (KIMLIK_RE.test(j?.id)) return { id: j.id, ad: String(j.title || '') };
  } catch {}
  const id = urldenKimlik(location.href);                     // /file/d/<id>/view sayfası
  return id ? { id, ad: document.title.replace(/ - Google Drive$/, '') } : null;
}
let kap, kok, simdiki = null;
function dugme(goster) {
  if (!kap) {
    kap = document.createElement('div');
    kok = kap.attachShadow({ mode: 'closed' });
    const st = document.createElement('style');
    st.textContent = 'button{position:fixed;top:70px;right:24px;z-index:2147483647;padding:8px 16px;border:0;border-radius:18px;background:#0b57d0;color:#fff;font:500 14px system-ui;cursor:pointer;box-shadow:0 2px 6px #0004}';
    const b = document.createElement('button');
    b.textContent = 'UDF olarak aç';
    for (const t of ['pointerdown', 'mousedown']) b.addEventListener(t, e => e.stopPropagation());
    b.addEventListener('click', e => { e.stopPropagation(); if (simdiki) ac(simdiki); });
    kok.append(st, b);
    document.documentElement.append(kap);
  }
  kap.hidden = !goster;
}
function ac(o) {
  chrome.runtime.sendMessage({ tur: 'udf-ac', id: o.id, ad: o.ad, au: hesapNo(), rk: resourceKey() });
}
let zamanlayici = 0;
function denetle() {
  const o = aktifOge();
  simdiki = o && UDF_RE.test(o.ad) ? o : null;
  dugme(!!simdiki);
}
new MutationObserver(() => {                                   // rAF gizli sekmede çalışmaz → setTimeout
  clearTimeout(zamanlayici); zamanlayici = setTimeout(denetle, 150);
}).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
denetle();
```

### (b) Sağ tık menüsü

- **`chrome.contextMenus` işe yaramaz [CANLI]:** Bir dosya satırına gönderilen `contextmenu` olayında `defaultPrevented === true` çıktı; üst başlık alanında da öyle. Drive kendi menüsünü çiziyor, Chrome'un menüsü ve eklentinin `documentUrlPatterns: ['https://drive.google.com/*']` öğeleri hiç görünmüyor. Mozilla ve WebKit hata kayıtları da Drive'ın kendi menüsünü kullandığını gösteriyor [KAYNAK].
  - MarkDrive (drive-md-editor) `contexts:['link','page']` ile kayıt yapıp test kılavuzunda sağ tık adımı yazmış, ama bu adımın sonucu bulunamadı. Güvenilir sayılmamalı [KAYNAK + ÇIKARIM].
- **Çalışan yol:** Drive'ın **kendi** menüsüne öğe eklemek. `contextmenu` olayında `event.target.closest('[data-id]')` ile kimlik yakalanır. `div[role="menu"]` göründüğünde içine `[role="menuitem"]` eklenir. Örnek: insell824/tm-open-in-new-for-gdrive userscript'i [KAYNAK].
  - Kırılgan: öğe görünümü için karartılmış sınıflar (`.a-v-T`) ve "menü sağ tıktan sonraki 1,5 sn içinde mi açıldı" sezgisi gerekiyor.
  - v2 için düşünülebilir.

### (c) Eklenti simgesi ya da kısayol tuşu

`chrome.action.onClicked` tetiklenince içerik betiğine ileti gönderilir. Betik önce `aktifOge()`, yoksa `document.querySelectorAll('[aria-selected="true"][data-id]')` sonucunu döndürür. OpenLocalForGoogleDrive tam olarak bunu yapıyor ve `commands._execute_action` ile `Ctrl+Shift+9` kısayolu tanımlıyor [KAYNAK].

- **Artısı:** DOM'a dokunmaz, keşfedilebilir, kısayolla hızlıdır.
- **Eksisi:** Kullanıcı simgeyi bilmeli. Seçim `aria-selected` özniteliğine dayanıyor; bu öznitelik [CANLI] olarak görüldü.

### (d) Drive'ın "Birlikte aç" menüsü (Workspace Marketplace ile Drive UI entegrasyonu)

Gerekenler [KAYNAK: enable-sdk, integrate-open, publish, api-specific-auth belgeleri]:

- Bir Cloud projesi, Drive API ve "Drive UI integration" ayarı:
  - **Open URL**: "must contain a fully qualified domain name; localhost doesn't work". Dolayısıyla `chrome-extension://` adresi olamaz; GitHub Pages gibi barındırılan bir sayfa gerekir [ÇIKARIM].
  - Varsayılan uzantı `udf` ve simgeler. Simgelerin görünmesi 24 saati bulabilir.
- `drive.install` kapsamı (hassas değil) istenir ve kullanıcı bir kez kurulum onayı verir.
- Drive, Open URL'ye `state={"ids":["…"],"resourceKeys":{…},"action":"open","userId":"…"}` gönderir.
- Dosyayı okumak için sayfa `drive.file` ile belirteç alıp Drive API'yi çağırır. "Open with" ile açılan dosyada `drive.file` yeter.
- Marketplace görünürlüğü "Public" ya da "Private" (yalnızca alan adı içi) seçilir ve "Once the visibility setting is set, it can't be changed."
- Marketplace'e yayımlamadan da çalışabilir: belge Marketplace'i yalnızca kurulum kolaylığı olarak anıyor. Ama "Testing" durumunda doğrulanmamış uygulama uyarısı ve 7 günlük belirteç süresi var [KAYNAK]. Kurulum kaydının 7 günden sonra kalıp kalmadığı **bulunamadı / sınanmadı**.
- Kullanıcının hesabı bir Google Workspace kuruluşuna aitse onay ekranı "Internal" türünde açılabilir ve kuruluş içi uygulama doğrulama gerektirmez [ÇIKARIM; genel Google OAuth kuralı, bu görevde ayrıca doğrulanmadı].

**Değerlendirme:**
- En doğal ve DOM'dan bağımsız kullanıcı deneyimi bu. Eklenti bile gerekmez: barındırılan statik sayfa tek başına görüntüleyici olur.
- Melez bir yol da mümkün: barındırılan sayfa yalnızca `state` içinden kimliği alır ve eklentiye devreder. Sınanmadı.
- Maliyeti yüksek: Cloud projesi, OAuth, alan adı sahipliği ve gizlilik politikası, bakım. Kişisel ya da büro kullanımında v1 için önerilmez.

### (e) `drive.google.com/file/d/<id>/view` sayfasında yönlendirme (ÖNERİLEN, (a) ile aynı kod)

E-posta ya da WhatsApp ile gelen paylaşım bağlantıları bu sayfayı açar.

- **Tanıma:** Kimlik yoldan, `resourcekey` sorgudan alınır. `.udf` denetimi `#drive-active-item-info` (bu sayfada var [CANLI]) ya da `document.title` (`"<ad> - Google Drive"` [CANLI]) ile yapılır.
- **Seçenekler:** düğme göstermek ya da ayar açıksa otomatik geçiş.
- **Otomatik geçiş:** İçerik betiği `location.href = chrome-extension://…` yaparsa sayfanın `web_accessible_resources` listesinde olması gerekir; bu da sayfayı her siteye açar. Bunun yerine service worker'a ileti gönderilip `chrome.tabs.update(sender.tab.id, {url})` çağrılmalı [ÇIKARIM; Chrome'un WAR kuralına dayanır].
- **Kırılganlık:** düşük. URL kalıbı yıllardır aynı.

### (f) Ek seçenek: indirmeyi yakalamak (DOM'dan bağımsız, sınanmadı)

`downloads` izniyle `chrome.downloads.onDeterminingFilename` kullanılır. `.udf` adlı ve `finalUrl` alanı `drive.usercontent.google.com` olan indirme `chrome.downloads.cancel` ile durdurulur, URL'deki `id` ile görüntüleyici açılır [KAYNAK: chrome.downloads API].

- **Artısı:** Drive'ın "İndir" düğmesi nerede olursa olsun çalışır.
- **Eksisi:** Kullanıcının olağan indirme akışını değiştirir ve "indirmelerinizi yönetme" izin uyarısı getirir. İsteğe bağlı bir ayar olmalı.

**Önerilen birleşim:** v1 = (a) + (e) + (c). v2 = (b)'deki kendi menüye ekleme ve/veya (f). (d) ancak "Birlikte aç" menüsü özellikle istenirse.

## 4. Görüntüleyici sayfası

**Manifest iskeleti:**

```json
{
  "manifest_version": 3,
  "name": "UDF Görüntüleyici (Drive)",
  "version": "0.0.1",
  "minimum_chrome_version": "103",
  "host_permissions": ["https://drive.google.com/*", "https://drive.usercontent.google.com/*"],
  "background": { "service_worker": "sw.js" },
  "content_scripts": [{ "matches": ["https://drive.google.com/*"], "js": ["icerik.js"], "run_at": "document_idle" }],
  "action": { "default_title": "Seçili UDF dosyasını aç" },
  "commands": { "_execute_action": { "suggested_key": { "default": "Alt+Shift+U" } } }
}
```

`docs.google.com/uc` bağlantılarını da yakalamak isteniyorsa `https://docs.google.com/*` eklenir.

**Dosya adını URL'ye koymamak:** Dosya adları müvekkil adı ya da esas numarası içerebilir ve görüntüleyici URL'si tarayıcı geçmişine düşer. Service worker bilgiyi kendi belleğinde rastgele bir anahtarla tutar ve sekmeyi `goruntule.html#t=<anahtar>` olarak açar. Görüntüleyici bilgiyi bir ileti ile bir kez alır, service worker onu o anda siler. Bilgi hiçbir depoya yazılmaz (uygulanan biçim §13'te).

```js
// sw.js
const kayitlar = new Map();
chrome.runtime.onMessage.addListener((m, sender, yanit) => {
  if (m?.tur === 'kayit-al' && sender.url?.startsWith(chrome.runtime.getURL('goruntule.html'))) {
    yanit({ kayit: kayitlar.get(m.anahtar) ?? null });
    kayitlar.delete(m.anahtar);                                                          // bir kez
    return;
  }
  if (m?.tur !== 'udf-ac' || !/^[A-Za-z0-9_-]{10,}$/.test(m.id)) return;
  const t = crypto.randomUUID();
  kayitlar.set(t, { id: m.id, ad: m.ad, au: m.au ?? null, rk: m.rk ?? null });
  setTimeout(() => kayitlar.delete(t), 60000);                                           // alınmazsa
  const url = chrome.runtime.getURL('goruntule.html#t=' + t);
  chrome.tabs.create({ url, openerTabId: sender.tab?.id, index: sender.tab ? sender.tab.index + 1 : undefined });
});
```

**CSP:** MV3'te tanımsız bırakılınca varsayılan `"extension_pages": "script-src 'self'; object-src 'self';"`. Uzaktan kod yüklenemez, satır içi `<script>` çalışmaz [KAYNAK]. Satır içi `<style>` ve `element.style` serbest; bu yalnızca `script-src` ve `object-src` kurallarından çıkan bir sonuç [ÇIKARIM]. Daha sıkı bir politika eklenebilir; örneğin `require-trusted-types-for 'script'` yanlışlıkla yazılan `innerHTML`'i engeller [ÇIKARIM].

**Güvenli HTML üretimi:**
- `content.xml`, `DOMParser().parseFromString(metin, 'application/xml')` ile ayrıştırılır ve `parsererror` denetlenir. XML ayrıştırırken betik çalışmaz.
- Yazı yalnızca `document.createElement`, `textContent` ve `append` ile kurulur. Biçim için `style.setProperty` kullanılır; değerler sayıya ya da renk kalıbına göre süzülür.
- Bağlantı ya da resim gibi dış kaynaklar yüklenmez. Gömülü resimler zip'ten `Blob` ve `URL.createObjectURL` ile gösterilir.

**Zip açma:**
- **JSZip:** 3.10.1 `jszip.min.js` dosyası 97.630 bayt [CANLI, jsDelivr]. cihadturhan/uyap-udf-viewer bunu kullanıyor [KAYNAK].
- **fflate:** "8kB package", yalnızca açma için 3 kB [KAYNAK]. Eşzamansız API Blob URL'li Worker açar. `script-src 'self'` altında `worker-src` engeline takılabileceğinden `unzipSync` kullanılmalı [ÇIKARIM].
- **Kütüphanesiz:** `DecompressionStream('deflate-raw')`, Chrome 103'ten beri var (`deflate` ve `gzip` 80'den beri) [KAYNAK: MDN browser-compat-data].
  - Dosya **merkezi dizinden** okunmalı. Java'nın `ZipOutputStream` gibi akış yazıcıları yerel başlıkta boyutu 0 yazıp sonuna veri tanımlayıcısı (bit 3) koyar [ÇIKARIM; UDF yazıcısı Java tabanlı, bu yüzden olası].

```js
async function zipDosyasi(b, aranan = 'content.xml') {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let e = -1;                                                   // End of Central Directory
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 0xFFFF); i--)
    if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('ZIP_SONU_YOK');
  const adet = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  const td = new TextDecoder();
  for (let n = 0; n < adet; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP_DIZIN_BOZUK');
    const bayrak = dv.getUint16(p + 8, true), yontem = dv.getUint16(p + 10, true);
    const sikisik = dv.getUint32(p + 20, true);
    const adUz = dv.getUint16(p + 28, true), ekUz = dv.getUint16(p + 30, true), notUz = dv.getUint16(p + 32, true);
    const yerel = dv.getUint32(p + 42, true);
    if (td.decode(b.subarray(p + 46, p + 46 + adUz)) === aranan) {
      if (bayrak & 1) throw new Error('SIFRELI_ZIP');
      if (dv.getUint32(yerel, true) !== 0x04034b50) throw new Error('YEREL_BASLIK_BOZUK');
      const bas = yerel + 30 + dv.getUint16(yerel + 26, true) + dv.getUint16(yerel + 28, true);
      const ham = b.subarray(bas, bas + sikisik);
      if (yontem === 0) return ham;
      if (yontem !== 8) throw new Error('DESTEKSIZ_YONTEM_' + yontem);
      const akis = new Blob([ham]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(akis).arrayBuffer());
    }
    p += 46 + adUz + ekUz + notUz;
  }
  throw new Error('CONTENT_XML_YOK');
}
// kullanım
const xml = new DOMParser().parseFromString(new TextDecoder('utf-8').decode(await zipDosyasi(bayt)), 'application/xml');
if (xml.getElementsByTagName('parsererror').length) throw new Error('XML_BOZUK');
```

ZIP64 desteklenmiyor; UDF boyutunda gerek yok. Dosya adı UTF-8 bayrağına bakılmadan çözülüyor; `content.xml` ASCII olduğu için sorun olmaz.

**Yazdırma ve PDF'e kaydetme:**
- `window.print()` eklenti sayfasında çalışır. Chrome'un yazdırma penceresindeki "PDF olarak kaydet" hedefi PDF'i verir [ÇIKARIM].
- `document.title`, belge adının `.udf` uzantısı atılmış hali yapılırsa önerilen PDF adı o olur [ÇIKARIM].
- Kenar boşlukları UDF'nin sayfa biçiminden dinamik `@page` ile verilir. UDF'deki öznitelik adları ve birimleri bu görevde doğrulanmadı; içerik çözümleme görevinin bulgusuyla eşleştirilmeli.

```js
const sayfaStili = document.createElement('style');
sayfaStili.textContent = `@page { size: A4; margin: ${ust}pt ${sag}pt ${alt}pt ${sol}pt; }
@media print { .arac-cubugu { display:none } body { background:#fff } .kagit { box-shadow:none; margin:0; padding:0; width:auto } }`;
document.head.append(sayfaStili);
document.getElementById('yazdir').addEventListener('click', () => window.print());
```

## 5. Kullanıcının bağlantısıyla yapılacak doğrulama (bu görevde yapılmadı)

1. Eklentiyi paketlenmemiş olarak yükle. Kullanıcının oturumu açık Chrome'unda verdiği klasörü aç. Bir `.udf` dosyasına çift tıkla.
   - `#drive-active-item-info` içindeki `title` ve `mimeType` değerlerini kaydet. Zip olarak mı görünüyor (`application/x-zip`)?
   - Düğme görünüyor mu?
2. Görüntüleyici sekmesinde `fetch` 200 dönüyor ve ilk baytlar `PK\x03\x04` mi? Dosya paylaşılmamış (özel) iken de denenmeli.
3. Çoklu hesapta bak: `/u/1/` klasöründen açınca `authuser=1` ile doğru dosya geliyor mu?
4. Ayarlarda "Üçüncü taraf çerezleri engelle" açıkken 2. adımı yinele.
5. Bağlantıyı `/file/d/<id>/view` olarak aç: düğme ya da yönlendirme çalışıyor mu, `resourcekey` taşınıyor mu?
6. Satır seçilip kısayol tuşuna basılınca seçili dosya açılıyor mu?

## Kaynaklar

- Chrome, Storage and cookies (uzantı çerez istisnaları): https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies
- Chrome, Cross-origin network requests: https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
- Chrome, Message passing (JSON'a çevrilebilir ileti): https://developer.chrome.com/docs/extensions/develop/concepts/messaging
- Chrome, Manifest CSP: https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy
- Chrome, chrome.identity: https://developer.chrome.com/docs/extensions/reference/api/identity
- Chrome, OAuth kılavuzu ("key" ve sabit kimlik): https://developer.chrome.com/docs/extensions/how-to/integrate/oauth
- Chrome, chrome.downloads: https://developer.chrome.com/docs/extensions/reference/api/downloads
- chromium-extensions, "Cookies in Service Worker" (2023-01-12): https://groups.google.com/a/chromium.org/g/chromium-extensions/c/RMUtNEhR0R8
- mv3-extension.com, cross-origin fetch: https://mv3-extension.com/core-apis-cross-browser-data-management/network-requests-and-backend-sync/making-cross-origin-fetch-requests-from-an-extension/
- PandaDoc eklentisi:
  - COMPARISON.md (Adobe ile karşılaştırma, authuser, DNR çerez): https://github.com/pandadoc-integration/chrome-extension/blob/HEAD/COMPARISON.md
  - background.js: https://github.com/pandadoc-integration/chrome-extension/blob/HEAD/background.js
  - pdf-detector.js: https://github.com/pandadoc-integration/chrome-extension/blob/HEAD/pdf-detector.js
- Adobe Acrobat eklentisi içerik betiği (arşivlenmiş kopya): https://github.com/milesrichardson/testing-extmon/blob/HEAD/unpacked/efaidnbmnnnibpcajpcglclefindmkaj/content_scripts/gsuite-content-script.js
- OpenLocalForGoogleDrive (seçili satır, action, kısayol): https://github.com/murasaqi/OpenLocalForGoogleDrive/tree/HEAD/extension
- MarkDrive (Drive'da .md açan eklenti, OAuth kurulumu, içerik betiği): https://github.com/chayprabs/drive-md-editor (src/content/drive-interceptor.ts, docs/oauth-setup.md)
- Drive menüsüne öğe ekleyen userscript: https://github.com/insell824/tm-open-in-new-for-gdrive
- gem-factory spesifikasyonu (`#drive-active-item-info`): https://github.com/shazbot996/gem-factory/blob/HEAD/docs/specs/chrome-extension-gem-extractor-SPEC.md
- salauddinn FIXES.md: https://github.com/salauddinn/gdrive-video-downloader/blob/HEAD/FIXES.md
- cmux Drive satır seçicileri: https://github.com/manaflow-ai/cmux/blob/HEAD/Resources/browser-repl/sites/google-drive.js
- gdown (virüs sayfası formunun çözümü): https://github.com/wkentaro/gdown/blob/HEAD/gdown/download.py
- gdrive-dl (25 MB eşiği): https://github.com/noureddin/gdrive-dl
- 100 MB eşiği (ikincil): https://filerev.com/blog/file-size-limit-google/ , https://windowsreport.com/scan-google-drive-virus/
- resourcekey güncellemesi: https://news.slashdot.org/story/21/07/28/2014220/what-that-google-drive-security-update-message-means , https://oit.colorado.edu/news/google-will-update-specific-drive-shared-links-starting-september-13
- Drive UI entegrasyonu:
  - https://developers.google.com/workspace/drive/api/guides/enable-sdk
  - https://developers.google.com/workspace/drive/web/integrate-open
  - https://developers.google.com/workspace/drive/api/guides/publish
  - https://developers.google.com/workspace/drive/api/guides/about-apps
- Drive API kapsam sınıfları: https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- OAuth "Testing" 7 gün: https://developers.google.com/identity/protocols/oauth2
- Drive'ın kendi sağ tık menüsü: https://bugzilla.mozilla.org/show_bug.cgi?id=1001793 , https://bugs.webkit.org/show_bug.cgi?id=253727
- MDN DecompressionStream: https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream/DecompressionStream , uyumluluk verisi: https://github.com/mdn/browser-compat-data/blob/main/api/DecompressionStream.json
- fflate: https://github.com/101arrowz/fflate
- JSZip kullanan UDF görüntüleyici: https://github.com/cihadturhan/uyap-udf-viewer
- Canlı ölçümde kullanılan herkese açık örnekler: https://drive.google.com/drive/folders/15uNXeRBIhVvZJIhL4yTw4IsStMhUaaxl , https://drive.google.com/file/d/0B9P1L--7Wd2vU3VUVlFnbTgtS2c/view , https://drive.google.com/file/d/1l_5RK28JRL19wpT22B-DY9We3TVXnnQQ/view

Yerleşik tarayıcıda açılan sekme kapatıldı. Kullanıcının bağlantısı ve belgeleri açılmadı. Çalışma klasörüne bu görev için konan geçici dosyalar silindi; klasörde kalanlar başka görevlerin.

## 6. Drive'ın görüntüleyicisine gömme (2026-10-06 ölçümleri)

Kullanıcı belgenin PDF'ler gibi Drive'ın kendi ön izleme penceresinde açılmasını istedi. Ölçümler
oturum açmadan, herkese açık gdown klasöründe (pptx, txt, npz) ve `/file/d/<id>/view` sayfasında yapıldı [CANLI].

### 6.1 Görüntüleyicinin yapısı (yeni Drive tasarımı)

- Katman `position: fixed; z-index: 2000`, zemin `rgba(0,0,0,.92)`. Dosya sayfasında kap yine sabit konumlu (`z-index: 100`),
  zemin `rgb(19,19,20)`.
- Üst çubuk iki satır: 0–64 px (×, dosya simgesi ve adı, Dosya/Görünüm/Yardım menüleri, sağda "Yeni sekmede aç"), 64–112 px
  (İndir; önizlenebilen dosyada Yazdır ve yakınlaştırma; sağda "Dosya üstbilgisini gizle"). Düğmeler 104 px'te biter.
  Drive'ın kendi belge alanı 112 + 16 px'te başlar (pptx'te içerik kutusu `[24,128,1000,640]`).
- Çubuk kapları fareyi geçirir: `elementFromPoint` çubuğun boş yerlerinde alttaki ana alanı (`[role=main]`) bulur. Çubuğun
  altını bulmak için görünür düğmelerin (`checkVisibility`) en alttakine bakılır.
- `#drive-active-item-info` gösterilen dosyanın `[role=main]` öğesinin içinde durur. Ana alan katmanı kaplar
  (`position: absolute`, `[0,0,vw,vh]`) ve `z-index: 0`'lı bir kabın içindedir.
- Önceki/Sonraki okları (`[0,339,48,90]` ve sağdaki eşi) aynı kabın içinde `z-index: 5` ile ana alanın üstündedir; ana alana
  konan `z-index: 1`'li çerçeve okların altında kalır, oklar tıklanabilir.
- Drive her dosya için **yeni** bir `[role=main]` kurar; eskileri `display: none` ile DOM'da kalır. Görüntüleyicinin üst
  çubuk ve ok kopyaları da gizli (`visibility: hidden`) durur; bu yüzden düğmeler görünürlük denetimiyle seçilmeli.
- Drive bazı alt öğelerde `visibility: visible`'ı açıkça veriyor: içeriği gizlemek için `visibility: hidden` tek başına
  yetmez, `opacity: 0` da gerekir.
- Görüntüleyici açıkken sekme başlığı klasörün adıdır ("gdown - Google Drive"); dosya sayfasında "<ad> - Google Drive".
- Sahte `KeyboardEvent` (Escape, ArrowLeft, ArrowRight; `keyCode` ile) görüntüleyicide çalışır: Esc kapatır, oklar
  öbür dosyaya geçer. Odak ana alana konmuş bir iframe'deyken olay iframe öğesinde gönderilince de çalışır.

### 6.2 Gömülü sayfanın çerezleri (sahte Drive ile ölçüldü)

Eklentinin `drive.google.com` sayfasına gömülen kendi sayfası (`web_accessible_resources`, `use_dynamic_url`) ile service
worker, offscreen belge ve üst düzey eklenti sekmesinden `drive.usercontent.google.com`'a `credentials: 'include'` isteği:

| Bağlam | Varsayılan | Üçüncü taraf çerezleri kapalı (`--test-third-party-cookie-phaseout`) |
|---|---|---|
| Drive'a gömülü eklenti sayfası | None, Lax, Strict, belirtilmemiş | Lax, Strict, belirtilmemiş (**None gitmez**) |
| Üst düzey eklenti sekmesi | hepsi | hepsi |
| Service worker | hepsi | hepsi |
| Offscreen belge | hepsi | hepsi |

Sonuç: gömülü sayfa önce kendisi indirir; oturum tanınmazsa (AG, OTURUM_YOK, 401/403/404, beklenmeyen HTML) indirmeyi
service worker yapar, baytlar iletide base64 gelir. Bu bölümün 2.3'teki "service worker'da istisna yok" çıkarımı
ölçümle çürüdü. 2026-10-27'den beri sıra ters: Service worker dosyayı gömme kaydıyla birlikte indirmeye başlar, gömülü
sayfa ancak o başaramazsa kendisi indirir (§12).

### 6.3 Diğer bulgular

- `use_dynamic_url: true` olan kaynak, eklentinin sabit kimlikli adresiyle `chrome.tabs.create`/`tabs.update` üzerinden
  açılınca Chrome sayfayı engelliyor ("… engellendi"). Bu yüzden gömülü görünümün ayrı giriş sayfası var
  (`gomulu.html`, web_accessible); sekmedeki `goruntule.html` web_accessible değil. İkisinin içeriği aynı (test denetler).
- Dinamik adresle açılan çerçevenin içinde `location.href` ve CDP hedef adresi gerçek eklenti kimliğini gösteriyor;
  `sender.url` için yalnız yol (`/goruntule.html`, `/gomulu.html`) ve `chrome-extension:` şeması denetlenir.
- iframe'in `src`'si eklendikten sonra değiştirilirse tarayıcı geçmişine kayıt eklenir (geri tuşu çerçeveyi geri alır);
  her dosya için yeni iframe kurulur, adres eklemeden önce verilir.
- iframe ancak içindeki sayfayla aynı renk düzenindeyse saydam çizilir: iki tarafta da `color-scheme: normal`.
- Yazdırma: çerçevede `window.print()` yalnız çerçeveyi basar. "PDF olarak kaydet"in önerdiği ad yazdırılan çerçevenin
  değil sekmenin (üst belgenin) başlığıdır [KAYNAK: https://gist.github.com/danielrose7/adb604b9334118d98de6e856efd043df].
  Drive sekmesinin başlığını yazdırma süresince belge adı yapmak denendi ve **bırakıldı**: Chrome
  (`HistoryTabHelper::TitleWasSet`) başlık değişikliğini yükleme bittikten sonraki 5 sn içinde ve aynı belge içi
  gezinmeden (pushState) sonra bir sonraki tam yüklemeye dek (en çok 10 değişiklik) geçmişe yazıyor; Drive klasörler
  arasında pushState ile geziniyor. Gözden geçirmede görünmez Chrome'un History veri tabanıyla ölçüldü: belge adı klasör
  adresinin geçmiş kaydında kalabiliyor (yavaş yükleme, 5. yazdırma, yazdırma penceresi açıkken sekmenin kapanması).
  Bu yüzden gömülü görünümde PDF'e Drive sekmesinin başlığı önerilir, belge adı elle yazılır (§9). Sekmedeki
  görüntüleyicinin başlığına belge adı hiç konmaz (§13): Başlık geçmişin yanında Chrome'un oturum kaydına (açık ve son
  kapatılan sekmeler) ve işletim sisteminin pencere başlığına da düşer. PDF'e orada "UDF Ön İzleme" önerilir.
- Görünmez Chrome'da gerçek Drive'ın listesi `HeadlessChrome` kullanıcı kimliğiyle çift tıklamaya tepki vermiyor;
  `Emulation.setUserAgentOverride` gerekiyor (`araclar/gercek-drive.mjs`).
## 7. Eklenti simgesi ve tek görünüm (2026-10-06)

Kullanıcı kararı: Ayarlar sayfası olmasın (chrome://extensions içindeki seçenekler penceresi titriyor), eklenti simgesi
belgeyi yeni sekmede açmasın, belge hep Drive'ın içinde görüntülensin.
- Manifest'te `options_ui` ve `commands` yok. İçerik betiği Drive listesindeki tıklamaları yakalamaz, satırları okumaz,
  yalnız ön izlemedeki `#drive-active-item-info`'ya ve adrese bakar. Simge Drive sekmesine betik eklemediği için
  `activeTab` ve `scripting` izinleri gerekmez.
- Simgenin eylemi yok (manifest'te `action` yok: Açılır pencere ve tıklama işlevi yok). Geliştiricinin X sayfası
  (`https://x.com/CgrShn`) `author` ve `homepage_url` alanlarında: Chrome onu eklentinin ayrıntılarında web sitesi olarak
  gösterir, simgeye sağ tıklayınca en üstteki eklenti adı onu açar. Açıklamanın sonunda da "Geliştirici: x.com/CgrShn" yazar
  (WA Sohbet Sil Buton Gizleyici'deki gibi). Eklentinin ayarı yok, bir şey saklamaz (§13). Kapatmak için `chrome://extensions`
  kullanılır: Açık sekmedeki içerik betiğinin bağlamı kopar, betik bir sonraki DOM değişikliğinde gömülü belgeyi kaldırır ve
  görünen `.udf` için "kapatıldı, kaldırıldı ya da güncellendi, sayfayı yenileyin (F5)" uyarısını bir kez gösterir.
  `icerik.css` sayfa yenilenene dek kalır.
- Notlu belgede not bölmesi kendiliğinden açılır. Gömülü görünümde bölme geniş pencerede belgenin yanında yer kaplar
  (belge daralan alana yeniden sığar; alt çubuk kalan alana sığacak kadar daralır), dar pencerede (≤ 900 px) belgenin
  üstüne biner ve çubuğun üstünde biter. Drive'ın sağdaki "sonraki" oku (z-index 5) çerçevenin üstünde durduğu için
  bölme onun altında kalırsa nota basmak başka dosyaya geçirir (gözden geçirmede gerçek Drive'da yeniden üretildi):
  içerik betiği okun kapladığı şeridi ölçer (`sagBosluk`: üst çubukların altında, sağ kenara yakın görünür denetim;
  gerçek Drive'da düğme 40 px, tıklama alanı 12 px dışına taşıyor, pay 16 px) ve `sag-bosluk` iletisiyle çerçeveye
  bildirir; bölme `--sag-bosluk` kadar içeride durur. Ölçü bir gömme boyunca küçülmez (ok solup gelince bölme kaymasın). Esc gömülü görünümde bölmeyi değil Drive'ın
  penceresini kapatır (bölme her notlu belgede açıldığı için her seferinde fazladan basış istemesin).
- E-imza rozeti: kullanıcının isteğiyle yalnız "E-imzalıdır". İçerik özeti tutmuyorsa yine uyarı ("E-imza içerikle
  uyuşmuyor"): değiştirilmiş belgeye "E-imzalıdır" denmez. İmza ve sertifika doğrulanmaz.
- Simge (kullanıcı on öneriden seçti, 2026-10-27): Köşesi kıvrık beyaz sayfada Google'ın renkleriyle (mavi `#4285F4`,
  yeşil `#34A853`, sarı `#FBBC05`) üç satır, sol alttan taşan UYAP kırmızısı (`#c42127`, `C:\UYAP\Uyap Kelime
  Islemci\uyapicon.ico`'dan ölçüldü) rozette beyaz "UDF". Google'ın logoları kopyalanmadı (marka), yalnız renkleri. 16 ve
  32 px'te rozet yazısız. Üretim `node araclar/simge-uret.mjs` (büyük çizimde 16 px saydam kenar, 48 px'te daraltılmış).

## 8. Notlar açıkken ortalama, Dark Reader, boşluğa tıklama (2026-10-07)

Kullanıcı iki şey istedi (gerçek Drive'dan üç ekran görüntüsüyle): not bölmesi açıkken de sayfa ortada dursun; Dark
Reader açıkken gömülü görünüm PDF'lerdeki gibi arkadaki Drive'ı göstersin, bembeyaz olmasın.

### 8.1 Dark Reader: çerçevenin arkası opak beyaz

- Ölçüm (görünmez Chrome, sahte Drive, kullanıcının Chrome'undaki Dark Reader 4.9.133'ün kopyası): Dark Reader dinamik
  kipte sayfaya `style.darkreader--user-agent` koyuyor; içinde adsız bir `@layer { … }` var ve orada
  `html { color-scheme: dark !important }` ile `iframe { color-scheme: dark !important }` duruyor
  (`getModifiedUserAgentStyle`, `theme.mode === 1`). Çerçevenin hesaplanan `color-scheme`'i `dark` çıktı;
  `CSS.getMatchedStylesForNode` iki kuralı gösterdi: sayfanınki (origin `regular`) ve içerik betiğininki (origin
  `injected`, `iframe.udf-okuyucu-cerceve { color-scheme: normal !important }`).
- Neden: cascade'de `!important` bildirimlerde katman sırası tersine döner; katmanlı `!important`, katmansız
  `!important`'ı seçicinin belirginliğine bakılmadan yener. İçerik betiğinin CSS'i katmansız. Sayfaya katmansız
  konan aynı `iframe { color-scheme: dark !important }` kuralı ise (seçicisi daha az belirgin) içerik betiğine
  yeniliyor (sınamada ölçüldü); hatayı yeniden üretmek için kuralın `@layer` içinde olması gerekiyor.
- Sonuç: çerçeve `dark`, içindeki sayfa (`:root.gomulu`) `normal` olunca Chrome çerçevenin zeminini sayfanın renk
  düzenindeki (açık) Canvas rengiyle opak boyar: bembeyaz. Dark Reader eklenti sayfalarına (chrome-extension://)
  giremediği için çerçevenin içi koyulaşmaz.
- Çözüm: `icerik.js` çerçeveye satır içi `color-scheme: light !important` verir. Satır içi stil (element-attached)
  cascade'de katmanlardan önce gelir; sayfanın hiçbir yazar kuralı onu yenemez. `icerik.css`'teki kural da `light`.
- Değer `normal` değil `light` (gözden geçirmede ölçüldü): çerçeve öğesinin `normal`'i çerçeveyi gömen sayfanın
  `<meta name="color-scheme">` etiketine göre çözülür. Sayfada `content="dark"` (ya da işletim sistemi koyuyken
  `"light dark"`) varsa `normal` koyuya çözülüp çerçeve yine beyaz oluyor; hesaplanan değer ise `normal` görünmeye devam
  ediyor. Gerçek Drive'da (oturumsuz klasör ve dosya sayfası, Google giriş sayfası) böyle bir etiket yok, Dark Reader da
  koymuyor; `light` yalnız sağlamlaştırma. İçerideki sayfa (`:root.gomulu`) `normal` kaldı: kendi meta etiketi yok,
  açık düzene çözülür.
- Dark Reader'ın `darkreader--fallback` stili (`html, body, body :not(iframe) { background-color: … !important }`)
  sayfa görünür olup stiller yüklenince boşaltılıyor; görünmez Chrome'da sekme öne alınmazsa (`Page.bringToFront`)
  kalabiliyor ve Drive'ın ana alanını opak koyu yapıyor. Gerçek kullanımda etkisi yok.
- Sınama (`node araclar/chrome-sina.mjs drive`): sahte Drive'a `@layer { iframe { color-scheme: dark !important } }`
  eklenip sayfanın solundaki boşluktan 1×1 ekran görüntüsüyle piksel okunur (`cdp.mjs` `pikselRengi`); Chrome'da Dark
  Reader kuruluysa onun kopyasıyla ayrı bir oturum da açılır. Satır içi `color-scheme` olmadan ikisi de
  `rgb(255, 255, 255)`, onunla koyu.
  Yapay denetimde sayfaya `<meta name="color-scheme" content="dark">` de konur.

### 8.2 Not bölmesi açıkken sayfa ortada

- Sorun: Geniş pencerede bölme (240-320 px, §14, + Drive'ın sağ oku için `--sag-bosluk`) belge alanını daraltır, sayfa kendiliğinden
  kalan alanın ortasına kayar (1920 px'te ortası 952 → 760).
- Çözüm (`goruntule.js` `ortala`): belge alanına bölmenin kapladığı genişlik kadar sol boşluk verilir (`--sol-bosluk`,
  CSS'te yalnız `@media screen`; baskıya girmez); sayfa bölme kapalıykenki yerinde kalır. Yer yetmezse boşluk,
  sayfayla alanın sağ kenarı arasında en az 16 px + sayfa kenarı kalacak kadar daralır: `boşluk = min(kaplanan,
  alan.clientWidth − (doğal en + 16) × ölçek − 32)`, en az 0. `clientWidth` boşluğu da içerdiği için hesap boşluğa
  bağlı değil, `ResizeObserver` döngüye girmez. Sığdırma ölçeği değişmedi (bölmenin solundaki alana göre).
- Dar pencerede (≤ 900 px) bölme belgenin üstüne biner, alan daralmaz, boşluk 0 olur (kaplanan genişlik
  `documentElement.clientWidth − alanın sağ kenarı` olarak ölçülür).
- Gömülü görünümün alttaki çubuğu ve ipucu sayfanın ortasına hizalanır (`cubuguYerlestir`): çubuk `left: 0; right:
  100% − 2 × orta` aralığında ortalanır (`--cubuk-ortasi`), en büyük genişliği `--cubuk-en-cok`. Çubuk daralmaz,
  kayar: doğal genişliği (`max-width: none` ile ölçülür) [12 px, sağ sınır − 12 px] şeridine yerleşir; sağ sınır bölme
  yanındayken bölmenin sol kenarı, değilken pencerenin sağı. Şeride sığmazsa şerit kadar daralır (rozetler kısalır).
  Çubuğun genişliği sayfanın ortasına bağlı olursa (`2 × min(orta − 12, bölme − 12 − orta)`) bölme açık ve sayfa
  %25–%33'e küçültülünce ortası bölmeye yaklaşır, çubuk 240 px'e iner, düğmeler (≈ 380 px) hapın dışına, bölmenin
  üstüne taşar (gözden geçirmede 901–1100 px pencerede ölçüldü, sınamaya eklendi).
- Sekmedeki büyük görünüm de aynı kodu kullanır (bölme aynı genişlikte).

### 8.3 Boşluğa tıklayınca kapanma

- Kullanıcı isteği: Drive'ın PDF görüntüleyicisindeki gibi, belgenin dışındaki koyu zemine tıklayınca pencere kapansın.
- Gerçek Drive'da ölçüldü (görünmez Chrome, oturumsuz; herkese açık bir klasördeki 3 sayfalık PDF ve gdown klasöründeki
  pptx; ikisi aynı sayfa görüntüleyicisi): sayfanın solundaki, sağındaki ve son sayfanın altındaki boşluk
  (`div.a-b-Xa-lc`, son sayfanın 3 px altından başlıyor) kapatır; sayfanın içi, sayfalar arasındaki 16 px'lik boşluk
  (sayfa kabının parçası), üst çubukla ilk sayfa arası, sağ tık ve sayfada başlayıp boşlukta biten sürükleme kapatmaz.
  Basılı tutmak kapatmaz, bırakınca kapanır. Boşlukta başlayıp sayfada biten sürükleme kapatıyor.
- Uygulama (`goruntule.js`, yalnız gömülü görünüm; dinleyiciler `document`'ta): `pointerdown` boşluktaysa yeri
  kaydedilir; `click` de boşluktaysa Esc iletilir (mevcut `tus` iletisi, `icerik.js` `driveTusu`). Boşluk:
  - tıklanan öğe belge alanının kendisi ya da sayfaları taşıyan kap (`.udf`), kaydırma çubuğu değil ve sayfa
    sütununun (kabın çocuklarının birleşimi) solunda, sağında ya da son çocuğun altında;
  - not bölmesinin sağında Drive'ın oku için bırakılan şerit (`.govde`; bölme kapalıyken orası belge alanıdır);
  - belge yokken (yükleniyor, hata) kutunun dışı. Yükleme kutusu görünmez (zeminsiz) olduğu için `pointer-events:
    none`: tıklama arkasındaki boşluğa geçer. Hata kutusu (görünür zeminli) kapatmaz, Drive'ın "önizlenemedi" kartı gibi.
- Drive'dan bilinçli sapma: boşlukta başlayıp sayfada biten sürükleme kapatmaz (bırakış da boşlukta olmalı) ve fare
  4 px'ten çok kıpırdayıp metin seçtiyse kapanmaz. Gerekçe: kenardan başlayan metin seçimi pencereyi kapatmasın; Chrome
  kenar boyunca sürüklemede metin seçiyor (sınamada 180 karakter). Yerinde tıklamada önceden seçili metne bakılmaz:
  Chrome seçimi tıklamadan sonra kaldırdığı için yoksa ilk tık yalnız seçimi kaldırıyordu (gözden geçirmede bulundu).
- Seçili metnin üstünde başlayan basış Chrome'da sürükle-bırak olur, `click` hiç oluşmaz. Gözden geçirmede sınamanın
  iki adımı önceki adımdan kalan seçim yüzünden hiçbir şeyi denemiyordu; şimdi her adımdan önce seçim temizlenir ve
  çerçevedeki tıklama sayılır.
- Sınama: `chrome-sina.mjs drive` D3b (11 durum) ve D7 (hata ekranında kutunun dışı); `chrome-sina.mjs gercek` gerçek
  Drive'da boşluğa tıklayınca görüntüleyicinin kapandığını denetler. İki bozuk kopyayla (seçim ve boşluk denetimi
  çıkarılmış; son sayfanın altı ve şerit çıkarılmış) D3b `SORUN` veriyor.

## 9. Alttaki çubuk: yakınlaştırma ortada (2026-10-07)

Kullanıcı istekleri: Çubukta doğrulama kodu ve "Yeni sekmede aç" düğmesi olmasın (⛶ tam ekran sanılıyor), yakınlaştırmanın
iki çizgisi şeridin tam ortasında olsun, öbür düğmeler çok farklı görünmeden. İki seçenek görüntüsüne bakıp: Notlar
düğmesi yazısız olsun (simge ve sayı), e-imzasız ve notsuz belgede solda "E-imzasız" yazsın.
- Düzen (`goruntule.html` ile `gomulu.html` aynı): `nav.cubuk-sag` üç parça: `.cubuk-yan.bas` (rozetler, Notlar),
  `#olcek-grup`, `.cubuk-yan.son` (Drive'da aç, İndir, Yazdır, Dosya aç). Rozetler bu parçada durur (sekmede de araç
  çubuğunda). Gömülü görünümde `.cubuk-sol` (simge, başlık) gizli; `.cubuk-sag` ızgara:
  `1fr auto 1fr`. Çubuk `width: max-content` olduğu için `1fr` sütunlar en geniş yanın doğal genişliğine eşitlenir
  (en büyük içerik / esneklik çarpanı), yakınlaştırma tam ortaya düşer. Dardaki yanın içeriği kendi sütununun ortasında.
- Notlar solda: Sağda yalnız Yazdır / PDF (≈ 125 px) kalınca yanlar yakın; Notlar sağda olsaydı imzalı notlu
  belgede solda ≈ 150 px boşluk kalırdı. Notlar düğmesi yazısız (≈ 64 px), `aria-label` "Notlar (n)".
- Sol yan boş kalmasın: e-imzasız ve notsuz belgede "E-imzasız" rozeti (`rozetleriYaz`). Ofisteki Drive for desktop'ta
  rastgele 12 gerçek UDF'nin 12'si e-imzasız ve notsuzdu; yani en sık görülen durum bu. Kullanıcıya dört seçenek
  (boş kalsın, çubuk kısalsın, "E-imzasız", yalnız yazıcı simgesi) görüntüyle soruldu.
- Doğal genişlik sığmazsa (`cubuguYerlestir`): `.sikisik` ile ızgara yerine düz sıra (yanlar eşitlenmez, önce
  rozetler kısalır). Önce eşit düzen ölçülür, sığmazsa sıkışık düzen ölçülür.
- Doğrulama kodu gösterilmez, motor onu yalnız okur (`ozellikler.dogrulamaKodu`). Ölçüm: Aynı 12 gerçek belgenin
  6'sında kod vardı, hiçbirinin metninde (üst/alt bilgi dâhil) yazmıyordu. Kod hiçbir yerde görünmez (kullanıcıya
  raporda söylendi).
- Büyük görünüme yalnız "UDF olarak aç" (yapı tanınmazsa) götürür. Gömülü görünümde PDF'e belge adı önerilmez (§6.3),
  ad elle yazılır.
- Yükleme yazısı (kullanıcı isteği): Drive'dan gelen belgede indirme ve hazırlama boyunca "UDF Ön İzleme
  eklentisiyle açılıyor…", altında dosya adı (`goruntule.js` `ACILIYOR`, arada yazı değişmez). Bilgisayardan açılan
  dosyada "Belge hazırlanıyor…" yazar. Sınama D1: sahte Drive ilk indirmeyi 2 sn geç yanıtlar (`sunucuKur` `gecikme`).
- README görüntüleri (`belgeler/gorseller/`, `araclar/tanitim-gorselleri.mjs`): gerçek Drive'ın görüntüleyicisi,
  herkese açık gdown klasörü, oturumsuz. Eklentinin geçici kopyası `.txt`'yi UDF sayar ve indirme yerine yapay dilekçeyi
  (e-imzalı, iki notlu; `tanitimBelgesi`) verir. Yalnız görüntü için sayfada: dosya adları yapay adlarla değişir, Drive'ın
  metin dosyasına özgü Yazdır/yakınlaştırma denetimleri gizlenir (gerçek `.udf` ön izlemesinde o şeritte yalnız İndir
  var), dosya simgesi griye döner, oturum açma düğmesi ve tanıtım kutusu gizlenir.
- Çerçevede `allow="clipboard-write"` izni yok: Panoya yazan bir düğme yok (bağımsız gözden geçirmede denetlendi). Seçip
  Ctrl+C ile kopyalamak bu izni istemez.
- Sınama: `chrome-sina.mjs drive` D1'de yakınlaştırmanın ortası çubuğun ortasıyla 1 px içinde (dört durum, düğmeler hapın
  içinde, binme yok; `[ekran.png]` verilirse her durumun çubuk görüntüsü `-cubuk-<n>.png`), B2'de rozet kuralı (yeni
  yapay örnek `notlu-imzasiz.udf`). D1 her durumda Drive sekmesini 1 px daraltıp genişletir: çubuğun yerleşimi
  (`cubuguYerlestir`) yalnız belge alanının boyu değişince yeniden hesaplanır; `window` `resize` olayı gömülü sayfada
  bir şey tetiklemez (gözden geçirmede bulundu: Daraltıp genişletmeden 2.–4. durum 1. durumun `.sikisik` değerini
  okur). Bozuk kopyayla (4. durumda çok uzun rozet) D1 `SORUN` veriyor. "Drive'da aç" "UDF olarak aç"la açılan büyük
  görünümde sınanır (Y1).

## 10. Bellek (2026-10-07)

Kullanıcı isteği: "RAM optimizasyonunu kontrol edelim". İki bağımsız ajan kodu okudu ve görünmez Chrome'da ölçtü (sahte
Drive, yapay örnekler; süreç belleği WMI, GPU süreci dâhil).
- Sorun çıkmayanlar: içerik betiği Drive sayfasına +0,27 MB yığın, +3 dinleyici; 100 aç-kapa ve 30 okla gezinmede Drive
  yığını, düğüm ve dinleyici sayısı sabit; kapanan çerçeve ≤100 ms'de kalkıyor; service worker 0,5 MB; belge kayıtları
  service worker'ın belleğinde en çok beş (§13); MutationObserver yoğun DOM değişikliğinde +%6-12 iş (geri çağrı yalnız zamanlayıcı kurar).
- Asıl yük resimlerde. Tuval yolu (her resim en az 2× çözünürlükte bir tuvale çizilir, görüntüleyici açılışta
  `tumunuCiz()` ile hepsini çizdirir, ekrandan çıkan tuval bırakılmaz, üst bilgideki antet her bölümde ayrı tuval) 40
  resimli yapay belgede Chrome toplamını 376 → 1485 MB, 24 tam sayfa resimde GPU'yu 149 → 745 MB yapar.
- Çözüm (`udf-motoru.js` `resimKutusu`): resim `<img decoding=async>`, kaynağı resim başına tek blob adresi
  (`resimAdresleri`; antet bölümlerde aynı adresi kullanır, Blink çözülmüş resmi tek tutar). Tarayıcı ekrandaki resmi
  çözer, ötekini atar; baskıda resim kendi çözünürlüğüyle basılır. Boyut ve piksel sınırları yine çözülmeden önce
  başlıktan (`resimBilgi`). `tumunuCiz()` yalnız yazdırmadan önce: dilimler + `img.decode()` + arka plan karosu.
  `birak()` adresleri bırakır. İş listesi bitince boşaltılır. Görüntüleyici açılışta `tumunuCiz` çağırmaz; gömülü
  görünümde dosya baytlarını tutmaz (İndir yok).
- Ölçüm (24 × 1654×2339 resim, GPU MB, tuval yolu → `<img>`): açık 745 → 165, sonuna dek kaydırınca 747 → 365, kapatınca +25 sn
  392 → 148 (boştaki 151), ilk yazdırma hazırlığı 303 → 158 ms.
- Yedek indirme (üçüncü taraf çerezleri kapalı): tek parça base64 ileti yerine 1 MB'lık dilimler (`arkaplan.js`
  `dilimVer`, çerçevede `arkaplandanIndir`); service worker baytları son dilime ya da en çok 15 sn tutar. 30 MB'lık
  dosyada eklenti sürecinin tepe artışı +408/+436 → +148 MB (doğrudan indirme +72 MB).
- Bağımsız gözden geçirmenin bulguları (düzeltildi): (1) `<img>` başlığı sağlam ama verisi bozuk ya da yarıda kesik
  resmi hata vermeden boş beyaz gösteriyor (`decode()` de başarılı), tuval yolunda `createImageBitmap` onu reddeder.
  Bu yüzden yüklenen her resim bir kez, sırayla tam çözülerek doğrulanır (`resimDogrula`, aynı anda tek bitmap, hemen
  kapatılır), bozuksa "[Resim gösterilemedi]" yazar. `tumunuCiz()` yazdırmadan önce hepsini doğrular. (2) Resim baytları
  modelde ve blob'da iki kopya durmasın diye `resimBilgi` doğrudan `blob` saklar. Doğrulamayla ölçüm aynı kaldı
  (açık 164, kaydırınca 359, kapatınca 147 MB).
- Sınama: `npm test` "resimler <img>" (tuval yok, antet tek adres, `birak()` sonrası adres yok) ve `arkaplan.test.mjs`
  (dilim protokolü: 1 bayt, 1 MB ± 1, 3 MB + 5 bayt, geçersiz `i`, başka anahtar, yabancı gönderen, 15 sn); `chrome-sina.mjs
  drive` çerezler kapalı adımı dilimli yolu çalıştırır, B3 bozuk resmi (`resim-bozuk.udf`) denetler; `chrome-sina.mjs
  gorsel` resimlerin yüklendiğini ve PDF'te basıldığını (`/Subtype /Image`) gösterir.

## 11. Gmail ekleri (2026-10-26)

Kullanıcı isteği: Gmail'de `.udf` ekine tıklayınca "Önizleme yok" yerine belge açılsın. Ölçümler kullanıcının Chrome'unda (Claude in Chrome), kullanıcının onayıyla kendine gönderilen, yalnız
uydurma ekli iki deneme iletisiyle yapıldı. Gerçek belgeye dokunulmadı.

### 11.1 Görüntüleyici
- Gmail'in ek ön izlemesi Drive'ın görüntüleyicisinin aynısı (`aLF-aPX` sınıfları). Kökü konumu sabit bir katman
  (z-index 1204). İçinde iki satırlı üst çubuk (Kapat 16–48 px, Dosya ve Yardım menü çubuğu, Drive'a ekle, Yeni sekmede
  aç, Birlikte aç, ikinci satırda İndir 72–104 px) ve `role=dialog` içinde her ek için bir `role=main` var. Çubuğun altı
  104 px, çerçeve 112 px'te başlar (Drive'la aynı). Önceki ve Sonraki okları 40 px, sağ kenardan 28 px içeride.
- `#drive-active-item-info` Gmail'de de var: `{"id": "", "title": "<ad>", "mimeType": "application/octet-stream"}`. Kimlik
  boş. Öğe tektir, gösterilen ekin ana alanında durur.
- Ana alanlar tıklanan iletinin ekleri için, ek sırasıyla kurulur. Gmail onları gerektikçe ekliyor (8 ekli iletide ilk
  ekle açılınca 6, gezindikçe 7 ve 8, 6. ekle açılınca hemen 8), ama sıra hep 0'dan başlar: Etkin ana alanın sırası,
  ekin iletideki sırasıdır. İki iletili yazışmada ikinci iletinin ekiyle açılınca yalnız o iletinin 2 eki vardı. Sıra
  yazışmaya değil iletiye özgü.
- Adres: Açılınca hash'e `?projector=1&messagePartId=<attid>` eklenir. Oklarla gezinince güncellenmez (ilk ek kalır), Esc
  ile kalkar. Bu yüzden gösterilen ek adresten anlaşılmaz.
- Esc ve oklar, ana alanın içindeki bir öğeye gönderilen sahte (güvenilmeyen) tuş olaylarıyla çalışıyor (Drive'daki gibi).
  Esc ile `#drive-active-item-info` kalkar.
- "Önizleme yok" kartı ana alanın çocuğu: Drive'daki kartla aynı yolla gizlenir (§14, gölge kökü).
- UDF ön izlemesinde Dosya menüsünde Yazdır yok, ikinci satırda yalnız İndir var (§14).

### 11.2 Ek kartları ve indirme
- İletideki her ek kartında `span[download_url]` var: `application/octet-stream:<yüzde kodlu ad>:https://mail.google.com/mail/u/1/https://mail.google.com/mail/u/1?ui=2&ik=<10 onaltılık>&attid=0.N&permmsgid=msg-f:<19 rakam>&th=<16 onaltılık>&view=att&zw&disp=safe`.
  Gmail adresin başını iki kez yazıyor. İçinde aynı sorguyla bir `a[target=_blank]` durur. `th` iletinin kendi kimliği
  (yazışmanınki değil), `attid` her iletide 0.1'den başlar.
- Bu adres Gmail oturumunun çerezleriyle istenince `mail-attachment.googleusercontent.com/attachment/u/1/?…` adresine
  yönlendirir. Orası `Access-Control-Allow-Origin: https://mail.google.com` ve kimlik bilgisi izniyle baytları verir.
  Gmail sayfasının kendi kökeninden yapılan istek (`credentials: 'include'`) 200 ve doğru boyu (2748 bayt, `PK`)
  döndürdü. Aynı ek art arda 4 kez ve `cacheCounter` ekiyle 2 kez daha sorunsuz indi.
- Bu yüzden Gmail ekini içerik betiği indirir: İstek birinci taraftır (üçüncü taraf çerez kısıtı yok) ve Gmail için ek izin
  (`host_permissions`) gerekmez. Görüntüleyici (gömülü çerçeve ya da sekme) baytları arka plandan dilim dilim ister. Arka
  plan isteği ekin açıldığı Gmail sekmesine aktarır (`chrome.tabs.sendMessage`, çerçeve 0), bayt tutmaz. İçerik betiği
  baytları son dilime ya da en çok 15 sn tutar, bırakırken sıfırlar. Sekme kapanmışsa ya da eklenti güncellenmişse (içerik betiği eskimiş)
  görüntüleyici "Gmail sekmesine ulaşılamadı" der. 2026-10-27'den beri ek, kartına basılınca indirilmeye başlar (§12).
- İndirme adresi sayfadan olduğu gibi alınmaz: Değerler sıkı biçimde doğrulanır (`gmail-ek.js` `ekTemizle`), adres yalnız
  onlardan kurulur, `indir.js` `gmailEkIndir` adresin biçimini yeniden denetler. gmail.js'e göre aynı adres art arda
  istenince yönlendirme Gmail'e geri dönebiliyor (CORS hatası). Ağ hatasında bir kez `&cacheCounter=<zaman>` ile yeniden
  denenir.

### 11.3 Gösterilen eki bulma (`gmail-ek.js` `gosterilenEk`)
- İçerik betiği ek kartı tıklamasını (ileti `th` ve zaman) tutar, tıklamaya karışmaz. Ön izleme açıldığı anda
  (`#drive-active-item-info` belirince) son 5 sn'deki tıklama o ön izlemenin tıklamasıdır. Ön izleme kapanınca
  unutulur (`icerik.js` `onizlemeyiIzle`). Eski bir tıklama sonraki bir ön izlemeye taşınmaz.
- Gösterilen ek, o iletinin kartlarından etkin ana alanın sırasındaki karttır. Adı pencerenin adıyla tutmalı. Tutmazsa
  iletide o adda tek ek varsa o alınır. Aynı adlı iki ek (deneme iletisinde "Aynı ad.udf" iki kez) sırayla ayrılır.
  Tıklanan iletide eşleşme belirsizse başka iletiye bakılmaz.
- Tıklamasız tahmin (sayfada tek bir ileti tutuyorsa o ek) yalnız sayfa ön izlemenin adresiyle açıldıysa (ön izleme
  açıkken yenilendi) ve yalnız o ilk ön izlemede yapılır.
- Kartsız açılan ön izlemede (gelen kutusu listesindeki ek düğmeleri) belge gömülmez, Gmail'in "Önizleme yok" kartı
  kalır. Okuma bölmesinde başka bir yazışma açıkken sayfadaki aynı adlı bir ek yanlışlıkla gösterilmesin diye tahmin
  yapılmaz (bağımsız gözden geçirmede bulundu). Gmail bu düğmeleri yalnız ön izleyebildiği türler için gösterir, .udf
  için göstermez (2026-10-27 ölçümü).
- Gmail iletideki Drive bağlantılarını da aynı görüntüleyicide gösterebilir. O zaman kimlik dolu olur ve Drive yolu
  kullanılır (hesap sırası Gmail'in adresinden). Bu yol gerçek Gmail'de ölçülmedi.

### 11.4 Diğer
- Çerçeve Gmail'in içindeyse içerik betiği adrese `u=g` koyar. Görüntüleyici iletilerini `https://mail.google.com`
  kökenine gönderir (`goruntule.js` `UST_KOKEN`). Köken eş zamanlı bilinmeli, çünkü "hazir" iletisi belge kaydı okunmadan
  gider.
- Gmail sekmesinin başlığına da dokunulmaz (§6.3). Gmail'in başlığı konuyu ve hesabın adresini taşır, gömülü yazdırmada
  PDF'e bu başlık önerilir.
- Manifest: İçerik betiği ve gömülü giriş sayfası `mail.google.com`'a da açık, `frame-ancestors` iki siteyi sayar.
  `connect-src` ve `host_permissions` Gmail'i saymaz (Gmail eki görüntüleyiciden indirilmez).
- Sınama: `npm test` (`gmail.test.mjs`, `arkaplan.test.mjs`, `indir.test.mjs`), `node araclar/chrome-sina.mjs gmail`
  (sahte Gmail, yukarıdaki ölçülen yapıyla).

## 12. Açılış hızı (2026-10-27)

Kullanıcı: "fazla bekliyoruz udfler yüklenirken". Ölçüm aracı `node araclar/chrome-sina.mjs hiz [tekrar] [--eklenti <klasör>]
[--json <dosya>] [--buyuk]` (`araclar/hiz-olcumu.mjs`). Görünmez Chrome, sahte Gmail ve sahte Drive, gerçekçi gecikmeler:
Gmail ekinde 302 yanıtı 250 ms, imzalı adresin baytları 250 ms (gerçek Gmail'de 600 baytlık ek bile sayfanın içinden,
boyundan bağımsız, 480-560 ms'de iniyor), Drive indirmesi 400 ms. Belgeler: `dilekce.udf` (2,7 KB), ağır yapay belge
`antetliBelge` (`ornek-uret.mjs`, 205 KB: Dört bölüm iki yana yaslı metin, her bölümün üst bilgisinde 1654×290 piksel,
203 KB'lık antet resmi, sayfa numaralı alt bilgi) ve `--buyuk` ile 5 MB (iki sıkıştırılmamış dolgu dosyası arasında kısa
metin). Service worker "soğuk" (açılıştan önce durdurulur) ve "sıcak" ölçülür. Ölçüm araçları CDP ile eklenir: Sayfada
gözlemci, çerçeve başlarken bekletilip `fetch`, iletiler ve motorun okuma ve çizimi sarmalanır. Eklentinin koduna ölçüm
için bir şey konmadı. `--eklenti` değişiklikten önceki kodun kopyasını yükler: Önce ve sonra aynı bilgisayarda ölçülür.

Önceki durum (ms, açan tıklamadan itibaren, 7 açılışın ortancası, sıcak):

| Aşama | Gmail küçük | Gmail ağır | Drive küçük | Drive ağır |
|---|---|---|---|---|
| İçerik betiği gömmeye başladı | 165 | 166 | 154 | 154 |
| Çerçeve eklendi (kayıt yazıldı) | 168 | 169 | 157 | 156 |
| Görüntüleyici hazır | 190 | 191 | 183 | 178 |
| İndirme başladı | 192 | 192 | 183 | 179 |
| Baytlar görüntüleyicide | 712 | 724 | 593 | 593 |
| İlk sayfa çizildi | 723 | 741 | 606 | 613 |

Bulgular:
- İçerik betiğinin gözlemcisi her denetimi 150 ms toplayıp yapıyordu: Gömme ancak ~155-165 ms'de başlıyordu.
- İndirme ancak görüntüleyici yüklenince başlıyordu (çerçeve 20-45 ms). Gmail'de ~525, Drive'da ~410 ms süren indirme
  öncesindeki her şeyle sıralıydı ve açılışın üçte ikisini tutuyordu.
- Service worker'ın soğuk açılışı görünmez Chrome'da 6-15 ms (çok eklentili bir Chrome'da daha uzun olabilir).
- Okuma ve çizim küçük belgede ~7, ağır belgede ~15 ms, ilk kare 5-10 ms. Resim doğrulaması ilk çizimi bekletmiyor
  (resim yüklenince, sırayla).
- Baytların base64 dilimlerle aktarılması 5 MB'ta ~230 ms (kodlama 40, çözme 24 ms, gerisi iletiler).

Değişiklikler:
1. Ön izleme yeni açıldıysa (`#drive-active-item-info` belirdi) içerik betiği 150 ms beklemeden gömer (`icerik.js`
   `denetle(true)`). Yalnız gösterilen dosya belli ve ana alan ölçülebiliyorsa: Değilse bekleyen denetim karar verir
   ("UDF olarak aç" düğmesi görüntüleyici yerleşirken çıkmaz). Gmail'de ön izlemeyi açan kart tıklaması henüz görülmediyse
   erken denetim yapılmaz (Gmail ön izlemeyi tıklama olayı içerik betiğine ulaşmadan açarsa §11.3'teki tıklama tutma
   bozulmasın). Öbür DOM değişikliklerinde 150 ms toplama sürer, gözlemcinin geri çağrısına yalnız bir `getElementById`
   eklendi.
2. Gmail: .udf ek kartına basılınca (fare basışı, tıklama, Enter ya da boşluk, değiştirici tuşsuz, üstüne gelmek değil,
   yalnız kullanıcının gerçek girişi: `isTrusted`, sayfanın betiğinin ürettiği olay ek indirtmez)
   içerik betiği eki hemen indirmeye başlar ve service worker'ı uyandırır (`uyan` iletisi, gömme kaydı onun açılışını
   beklemesin). Görüntüleyici baytları isteyince (`gmail-indir`) bu indirme kullanılır, bir kez (anahtarı doğrulanmış
   değerlerden kurulan indirme adresi). Kullanılmayan indirme 15 sn sonra bırakılır (baytları sıfırlanır), aynı anda en
   çok üç tutulur. Ad `download_url`'den okunur: Yalnız bağlantısı olan kartta ön indirme yok. Gerçek kullanımda fare
   basışıyla bırakışı arasındaki süre (~100 ms) de kazanılır, CDP'nin tıklaması bunu ölçmez.
3. Drive: Service worker gömme kaydını yazarken dosyayı indirmeye başlar (`arkaplan.js` `onIndir`). Gömülü görüntüleyici
   önce ona sorar (`indir`, 1 MB'lık dilimler, baytlar son dilime ya da en çok 15 sn), o başaramazsa (oturum, izin ya da ağ
   hatası) kendisi indirir. Service worker'ın isteği bütün çerezlerle gider: Üçüncü taraf çerezleri kapalıyken de tek istek
   yeter (önceden görüntüleyicinin isteği 401 alıp ardından service worker deniyordu). Bedeli dilim aktarımı (~15 ms/MB).
   Aynı kodda yalnız sıra değiştirilerek ölçüldü (5 tekrar): Küçük ve 205 KB'lık belgede service worker yolu 24-33 ms
   hızlı, 5 MB'ta 31-40 ms yavaş. UYAP belgelerinin çoğu 1 MB'ın altında olduğu için bu yol seçildi. Drive'da oklarla
   hızlı gezinince her dosya için bir kayıt ve indirme gelir: Gmail'deki gibi istenmemiş ön indirme ve tutulan bayt kaydı
   en çok üçer (sınır aşılınca en eskisi bırakılır). Aynı sekmeden yeni bir gömme kaydı gelince o sekmenin henüz
   istenmemiş ön indirmesi bırakılır (içerik betiği önceki çerçevesini kaldırdı), sürüyorsa baytları inince tutulmaz.
4. Base64: Tarayıcının kendi çeviricisi (`Uint8Array.prototype.toBase64`, `Uint8Array.fromBase64`, Chrome 140'tan beri)
   varsa o, yoksa eski yol (`indir.js` `base64`, `base64Coz`, `arkaplan.js`, motorda resim verisi). 5 MB'ta kodlama
   40 → 1,5, çözme 24 → 3,5 ms. Çıktı aynı (`npm test` iki yolu da sınar).
5. Motor: Belge özellikleri, notlar ve imza dosyası birlikte açılır. Ağır belgede okuma 16,6 → 12,4 ms (çoğu resim verisinin
   çözülmesi). Çizilen çıktı değişmedi.

Sonuç (ilk sayfanın çizildiği an, ms, 7 açılışın ortancası, soğuk / sıcak service worker):

| Durum | Önce | Sonra | Fark |
|---|---|---|---|
| Gmail küçük | 742 / 723 | 531 / 535 | −211 / −188 (%26-28) |
| Gmail ağır | 755 / 741 | 542 / 541 | −213 / −200 (%27-28) |
| Gmail 5 MB | 917 / 907 | 661 / 670 | −256 / −237 (%26-28) |
| Drive küçük | 620 / 606 | 433 / 430 | −187 / −176 (%29-30) |
| Drive ağır | 615 / 613 | 435 / 434 | −180 / −179 (%29) |
| Drive 5 MB | 616 / 612 | 501 / 492 | −115 / −120 (%19-20) |

Sonra Gmail'de ek tıklamadan ~1 ms önce (fare basışında), Drive'da 1-8 ms sonra istenir, görüntüleyici 22-44 ms'de hazır
olur. Kalan süre ağın kendisi (Gmail ~505, Drive ~405 ms), ardından okuma ve çizim ~25-35 ms. Gerçek Gmail'de ön
indirmenin kazancı ölçülmedi: Sahte sayfa ön izlemeyi tıklamayla aynı anda açıyor. Gerçek Gmail'in açılışı sürdükçe
kazanç büyür.

Sınama: `npm test` (service worker'ın ön indirmesi, süresi ve sınırları, `uyan`, base64'ün iki yolu, resim baytları iki yolda aynı),
`chrome-sina.mjs gmail` (G1'de ek çerçeve eklenmeden ve açılışta bir kez istenir, G16'da
sayfanın ürettiği olaylar ön indirme başlatmaz),
`chrome-sina.mjs drive` (D1'de tek istek, görüntüleyici hazır olmadan, D9'da service worker başaramazsa görüntüleyici
kendisi indirir, üçüncü taraf çerezleri kapalıyken tek istek).

## 13. Gizlilik (2026-10-27)

Kullanıcı kararları: Eklentinin ayarı olmasın, eklenti hiçbir şey saklamasın, geliştiricinin X sayfası WA Sohbet Sil Buton
Gizleyici'deki gibi eklentinin bilgilerinde dursun (simgenin eylemi yok). Kararlardan önce kodun bütününe bağımsız bir gizlilik incelemesi yapıldı. Uygulananlar:

- **İzinler:** Manifest'te `permissions` yok, `host_permissions` yalnız `https://drive.usercontent.google.com/*`. İçerik
  betiği yalnız `drive.google.com/drive/*`, `drive.google.com/file/*` ve `mail.google.com/mail/*` sayfalarında çalışır.
  Gömülü giriş sayfası (`web_accessible_resources`) ve `frame-ancestors` kökene göre iki siteye açık kalır. Sahte Drive'ın
  klasör (`/drive/u/0/folders/…`) ve dosya sayfası (`/file/d/<id>/view`), sahte Gmail'in posta sayfası (`/mail/u/1/`)
  bu eşleşmelerle sınandı.
- **Kayıt bir kez alınır:** Açılacak belgenin kaydı (Drive: Kimlik, ad, hesap sırası, kaynak anahtarı. Gmail eki: Ad, ek
  bilgisi, ekin açıldığı sekme) service worker'ın belleğinde (`arkaplan.js` `kayitlar`) rastgele anahtarla durur. Görüntüleyici
  açılınca `kayit-al` iletisiyle onu bir kez alır, kayıt o anda silinir. İleti yalnız eklentinin görüntüleyici sayfalarından
  kabul edilir (`goruntuleyiciden`). Alınmayan kayıt 60 sn sonra silinir, aynı anda en çok beşi durur. Görüntüleyici kaydı
  kendi belleğinde tutar, indirme ve "Yeniden dene" için geri gönderir. Service worker onu yeniden doğrular
  (`kayitTemizle`: Drive kimliği, hesap sırası 0-99, kaynak anahtarının biçimi, `GmailEk.ekTemizle`, tam sayı sekme).
  Sonuç: Sekme yenilenince (F5) ya da oturum geri yüklenince belge yeniden açılmaz ("Belge bilgisi bulunamadı"). Sayfa ya
  da başka bir eklenti eski bir anahtarla belgeyi yeniden açtıramaz. Service worker kayıtla alınması arasında (onlarca ms)
  kapanırsa kayıt kaybolur. Bu durumda gömülü görünüm "Sayfayı yenileyin" der.
- **Sekmenin başlığı:** Sekmedeki görüntüleyicinin başlığı hep "UDF Ön İzleme" (`goruntule.js` `yazdirmaBasligi` yalnız
  gömülü çerçevenin başlığını yazdırma süresince belge adı yapar). Yazdırma beklemeden başlar. Bilgisayardan dosya
  açılınca adresteki anahtarı kaldıran `history.replaceState` başlık hiç değişmediği için geçmişe ad yazdıramaz.
- **Hesap sırası:** Drive dosyası sayfanın hesap sırası (adresteki `/u/<n>/` ya da `authuser`, yoksa `og:url`) biliniyorsa
  yalnız o hesapla indirilir (`indir.js` `udfIndir`). Bilinmiyorsa yalnız hesapsız istek gider (Drive sayfasının kendi
  kullandığı varsayılan hesap). Dosyanın kimliği hiçbir durumda tarayıcıdaki öbür Google hesaplarının oturumuyla gönderilmez.
  Erişemeyen hesapta "Dosyayı ona erişebilen hesapla açın" denir. Sahte Drive D9: İki istek, ikisi de `authuser=0`.
- **Baytların ömrü:** Service worker'daki bayt kayıtları ve istenmemiş Drive ön indirmesi, içerik betiğindeki Gmail
  baytları ve ön indirmesi son dilime ya da en çok 15 sn tutulur ve bırakılırken sıfırlanır (`fill(0)`). Görüntüleyici
  baytları ön izlemeden yüzlerce ms sonra istediği için ön indirmenin kazancı sürer (aşağıdaki ölçüm).
- **CSP:** `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src
  https://drive.usercontent.google.com; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors
  https://drive.google.com https://mail.google.com`. Görüntüleyici stilleri `goruntule.css`'ten ve CSSOM'dan
  (`adoptedStyleSheets`, `style.setProperty`) gelir, ikisi de satır içi stil sayılmaz. Belgedeki resimler ve filigran
  `blob:` adresinden yüklenir. Ölçüm: Chrome aynı kökenli `blob:` adresini `'self'` ile de eşliyor (CSP 3). Bilerek
  `img-src 'self'` yapılan geçici kopyada belge resmi yine yüklendi, `data:` resmi ve satır içi `style` özniteliği
  engellendi ve sayıldı. `blob:` yine de açıkça yazılı (davranış tarayıcıya bağlı kalmasın). Görünmez Chrome'da
  `chrome-sina.mjs drive`, `gmail`, `gorsel` (bütün `testler/ornekler`) ve `paket` sıfır ihlal verdi. İhlaller
  `cdp.mjs` `cspIzle` (eklentinin sekmeleri, gömülü çerçeveleri ve service worker'ı, Log ve Audits) ve
  `chrome-sina.mjs` `hataToplayici` ile sayılır.
- **Diğer:** "UDF olarak aç"ın çift tıklama süzgeci yalnız son açılan belgeyi tutar (`icerik.js` `sonAcilan`). Eklenti
  kapatılınca, kaldırılınca ya da güncellenince içerik betiğinin uyarısı "kapatıldı, kaldırıldı ya da güncellendi,
  sayfayı yenileyin (F5)" der.

Açılış hızı (`chrome-sina.mjs hiz 3`, ilk sayfanın çizildiği an, ms, soğuk / sıcak service worker): Gmail küçük 537 / 540,
Gmail ağır 551 / 545, Drive küçük 432 / 427, Drive ağır 454 / 439. §12'deki ölçümle (7 tekrar) aynı aralıkta: Kaydın
alınması bir ileti daha ekler (1-2 ms).

Sınama: `npm test` (`arkaplan.test.mjs`: Kayıt bir kez alınır, 60 sn ve beş kayıt sınırı, yabancı gönderen, geri gönderilen
kaydın doğrulanması, 15 sn ve sıfırlama. `indir.test.mjs`: Hesap sırası. `gomulu.test.mjs`: CSP, izin
yok, kodda depo kullanımı yok. `paketle.test.mjs`: İzin ve simge), `chrome-sina.mjs drive` (D9, D10 ve Y1'de "Yeniden
dene", Y3'te sekmede yazdırma ve başlık, Y4'te yenilenen sekme, E1'de simge, izin ve depo, C1'de CSP), `chrome-sina.mjs
gmail` (G7'de ve sekmede "Yeniden dene", yenilenen sekme, CSP).

## 14. Gerçek Drive ve Gmail'de ikinci ölçüm, Yorum düğmesi, gölge kökü (2026-10-27)

Kullanıcı (dar bir Gmail penceresinden ve Drive'dan ekran görüntüleriyle): Sıkışınca not bölmesi de biraz daralsın, Drive ile
Gmail'in menüleri ve düğmeleri aynı değil, Drive'daki "Yorum" düğmesi işlemiyor ve gereksiz, genel işleyiş ve yazdırma
Drive'daki gibi olsun. Ölçümler kullanıcının Chrome'unda (Claude in Chrome) yapıldı, belge içeriği okunmadı: Gmail'de
kendine gönderilen yapay ekli deneme iletileri, Drive'da `.udf` ön izlemesinin yalnız Google'a ait çubukları. Claude in
Chrome, eklentinin çerçevesi bulunan sekmede komut çalıştıramıyor ("Cannot access a chrome-extension:// URL of different
extension"). Ölçüm betiği sayfaya önceden kondu, sonuçlarını sayfada tuttu ve ön izlemeyi kendisi kapattı, sonuçlar çerçeve
kalkınca okundu.

- **Çerçevenin silinmesi, ölçüm aracının işi:** İlk ölçümlerde Drive'da çerçeve, gömüldükten 0,3-3 sn sonra silindi
  (eklentinin işareti yerinde kaldı, sayfanın `removeChild` ve `remove` çağrılarında silme görülmedi), içerik betiği onu
  yeniden kurdu ve belge yeniden indirildi. Önce Drive'ın yeniden çizimi sanıldı. Ölçüm aracına hiç dokunulmadan beklenince
  çerçeve Drive'da 54 sn, Gmail'de 34 sn yerinde kaldı. Silinme yalnız Claude in Chrome sekmeye her bağlandığında oldu
  (başka bir eklentinin çerçevesi olan sekmeye bağlanamıyor, çerçeveyi kaldırıyor). Kullanıcının kendi kullanımında böyle
  bir silinme yok. Gerçek sitelerde sınarken çerçevenin ömrü ölçüm aracının çağrılarından bağımsız ölçülmeli.
- **Gölge kökü (önlem,** `icerik.js` `golgeKoku`**):** Google'ın arayüzü ana alanı yeniden çizerse kendisinin koymadığı
  çocuğu silebilir. Bu yüzden çerçeve ana alanın gölge kökünde (`attachShadow({ mode: 'open' })`) durur, Google'ın kodu
  gölge köküne dokunmaz. Gerçek Drive ve Gmail'de denetlendi: Çerçeve gölge kökünde, sayfanın çocukları arasında çerçeve
  yok, Google'ın içeriği gizli. Kökteki `<slot>` Google'ın kendi içeriğini gösterir. Belge gömülüyken o içerik kökün stiliyle
  (`::slotted(*)`, `!important`) gizlenir: Farklı ağaçlardaki `!important` bildirimlerde iç bağlam (gölge ağacı) kazanır (CSS
  Cascade 4), sayfanın `!important`'ı da yenilir. Gizleme stili gömme kalkınca kalkar (Gmail ana alanları başka ekler için
  yeniden gösterir). Kök eklenemezse (ana alanın kendi kökü varsa) çerçeve eskisi gibi ana alanın çocuğu olur, içeriği
  `icerik.css` gizler. Ana alanın işareti (`data-udf-okuyucu-gomulu`) iki yolda da konur.
  - Gölge kökündeki çerçeve odaktayken sayfanın `document.activeElement`'i ana alandır. Esc ve oklar çerçeveden `composed`
    olay olarak iletilir, Google onları ana alanda görür.
  - Sınama: Sahte Drive ve Gmail'de `window.__yenidenCiz()` ana alanın çocuklarını yeniden kurar. Eski yolla (çerçeve ana
    alanın çocuğu, bozuk kopyayla denendi) belge yeniden yüklendi ve bir indirme isteği daha gitti, gölge kökünde yerinde
    kalıyor (D1c, G1c). Drive'ın Yorum düğmesini işaretli öğeden kopyalaması da sınanır (D1c, D4). D8b kökü eklenemeyen ana alanı sınar. Sınama araçları çerçeveyi `cdp.mjs`'teki `CERCEVE`
    ifadesiyle bulur, hız ölçümü işaretlenen ana alanın gölge kökünü de gözler.
- **Drive'ın UDF ön izlemesi:** Üst çubukta Dosya, Görünüm, Ekle, Araçlar ve Yardım menüleri, ikinci satırda İndir ve
  "Yorum" (`aria-label` "Yorum ekleyin", yazısı "Yorum", 97 px, İndir'in sağında). Aynı kullanıcının Drive'ındaki bir PDF'te
  Ekle ve Yorum yok, Görünüm'de "Yorumlar", Dosya'da "Yazdır Ctrl+P", ikinci satırda Yazdır ve yakınlaştırma var. Oklarda
  görünen düğme 40 px, kenardan 28 px içeride (Gmail'le aynı).
- **Gmail'in UDF ön izlemesi:** Menüler Dosya ve Yardım. Dosya: Aç, İndir (Ctrl+D), Drive'a ekle, Ayrıntılar (D), Yazdır yok.
  İkinci satırda yalnız İndir. PDF ekinde menüler Dosya, Göster, Araçlar ve Yardım, Dosya'da "Yazdır Ctrl+P" var. Menü
  öğeleri `ul[role=menu]` içinde `li[role=menuitem]`.
- **Sonuç:** Üst çubuk ve menüler Google'ındır, Drive ile Gmail'de farklı kalır, eklenti onlara menü eklemez. UDF'de
  Google'ın kendi Yazdır'ı yok: Belge alttaki **Yazdır / PDF** düğmesi ve Ctrl+P ile basılır, iki sitede aynı kodla. Drive'ın
  Yorum düğmesi UDF'de işlemez (belge eklentinin çerçevesinde durduğu için yorumun yeri seçilemez) ve belge gömülüyken
  gizlenir (`icerik.js` `yorumuGizle`, `[data-udf-okuyucu-gizli]`). Düğme adından tanınır, yalnız üst çubuklarda (ana
  alanın 40-160 px'i) aranır, menü öğelerine dokunulmaz. Ekle menüsündeki ve Görünüm'deki yorum öğeleri olduğu gibi kalır
  (UDF'de içerikleri ölçülemedi: Google'ın menüsü yapay tıklamayla açılmadı).
- **Not bölmesi:** `clamp(240px, 25vw, 320px)`: 1280 px'te ve üstünde 320, 960 px'te ve altında 240 px. Kullanıcının
  Gmail penceresinde (yaklaşık 930 px, bölme açık) sayfa %65'e küçülüyor, soldaki ok sayfanın kenarına biniyordu. Bölme
  240 px olunca belge alanı 80 px genişler. Sınama: Sahte Gmail G9 (958 px'te 240, 1280 px'te 320).
- **Oturumsuz Drive'ın görüntüleyicisi çerçeveye taşındı:** `chrome-sina.mjs gercek` (herkese açık klasör, oturumsuz) artık
  çalışmıyor: Görüntüleyici `drive.google.com/viewer/main` adresli bir iframe'de açılıyor, `#drive-active-item-info` üst
  belgede yok. İçerik betiği yalnız üst belgede ve `/drive/*`, `/file/*` yollarında çalıştığı için oturum açmamış
  kullanıcının ön izlemesinde belge gömülmez. Oturum açık Drive'da görüntüleyici üst belgede (aynı gün ölçüldü). README
  görsellerini üreten `tanitim-gorselleri.mjs` de aynı klasörü kullandığı için yeniden üretilemez.
- **Yazdırma** sahte Gmail'de sınandı: Ctrl+P (belgede ve Gmail'in çubuğunda) ve **Yazdır / PDF** düğmesi çerçeveyi hemen
  basar, baskı görünümünde çubuk ve not bölmesi yok, belgenin alt boşluğu kalkar (G6, G6b). Gerçek Gmail'de Chrome'un
  yazdırma penceresi açılınca Claude onu kapatamadığı için orada denenmedi.
