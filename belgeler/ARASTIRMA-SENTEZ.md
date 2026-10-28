# Drive'da UDF açan Chrome eklentisi: birleşik rapor ve uygulama tasarımı

Bu belge eklenti yazılmadan önceki araştırmaların sentezidir. Dosya yapısı (2.2) eklentinin bugünkü hâlini gösterir.
Eklentinin manifest'i deponun kökündedir (`manifest.json`), tasarımın ayrıntısı `DRIVE-TEKNIGI.md` §6-§14'te ve
`GELISTIRME.md`'de.

**Kaynak etiketleri**
- **[A] [B] [C] [D]:** Dört araştırma raporu (UDF kütüphaneleri, hazır araçlar, biçim şartnamesi, Drive tekniği).
- **[DOĞRULANDI]:** Bu birleştirme sırasında 2026-10-05'te `gh api` ile bakıldı. Kaynak: https://github.com/hasanimer/legaluga-uyap-ui/blob/1a659c4233/src/extension/udf.js
- **[ÇIKARIM]:** Sınanmadı, doğrulanmalı.
- **Kota:** Bu turda iki web araması kota sınırına takıldı (Chrome'un `@page` kenar kutuları, Node'da `deflate-raw`). İlgili iddialar "doğrulanmalı" diye işaretli.

---

## 1. Kısa sonuç

**Hazır çözüm yok.**
- Chrome Web Store'daki 37 UDF ya da UYAP eklentisinin manifest dosyası okundu. Hiçbiri drive.google.com'da çalışmıyor [B].
- Görüntüleyicisi olanlar yalnız UYAP portallarında ya da kendi sayfalarında çalışıyor: Legaluga, Leges, Emileyt, IMEREK, UYAP Evrak Takip [B].
- En yakın aday AwuCat. Sağ tık menüsü yalnız adresi `.udf` ile biten bağlantılarda çıkıyor. Drive adresleri `/file/d/<id>/view` biçiminde olduğu için Drive'da görünmez [B] (https://github.com/cantuncr/awucat-tarayici-uzantisi; kodda `src/lib/http.ts` → `linkPatterns`).
- Workspace Marketplace'te Drive'ın "Birlikte aç" menüsüne UDF ekleyen bir uygulama yok. "UYAP Çevirici" dosyayı bilgisayardan alıp Google Dokümanı'na çeviriyor; ayda 5 belge ücretsiz [B] (https://workspace.google.com/marketplace/app/uyap_%C3%A7evirici/46494924541).
- Web siteleri her belge için "Drive'dan indir, siteye sürükle" adımını istiyor. Çoğu kapalı kaynak ve "yerel işleme" beyanları doğrulanmadı [B].
- GitHub'da drive.google.com'da çalışan açık kaynak bir UDF eklentisi bulunamadı [A][B].

**Neden yeni eklenti, ve neden zor değil:**
- Okuma motoru hazır. `hasanimer/legaluga-uyap-ui` deposundaki `src/extension/udf.js` MIT lisanslı ve bağımlılıksız. Zaten bir MV3 eklentisinde çalışıyor; zip açma, XML güvenliği, stil zinciri, tablo, resim, liste, üst/alt bilgi ve boyut sınırları içinde [A][C]. Lisans ve dosya [DOĞRULANDI]: MIT, "Copyright (c) 2026 Hasan İmer Akın", 58.944 bayt, dosyayı değiştiren son commit `1a659c4233` (2026-10-03).
- Drive tarafının üç dayanağı ölçüldü [D]:
  - Dosya kimliği: Drive'ın gizli `#drive-active-item-info` öğesindeki JSON.
  - İndirme: eklentinin kendi sayfasından çerezli `fetch`, adres `drive.usercontent.google.com/download`.
  - Tetikleme: eklentiye ait sabit konumlu bir düğme.
- OAuth, Google Cloud projesi ve sunucu gerekmiyor. Dosya tarayıcıdan çıkmıyor; bu, avukat ile müvekkil arasındaki gizlilik için önemli.

---

## 2. Önerilen mimari

### 2.1 Akış

```
Drive sekmesi (drive.google.com)              Eklenti
─────────────────────────────────            ─────────────────────────────────────────────
icerik.js: #drive-active-item-info'yu  ──►    arkaplan.js (service worker)
izler, ad .udf ise "UDF olarak aç"            · {id, ad, au, rk} → kendi belleği[rastgele anahtar]
düğmesi (kapalı shadow root)                  · tabs.create(goruntule.html#t=<anahtar>)
                                                            │
                                              goruntule.html (chrome-extension://, üst düzey sekme)
                                              · kaydı service worker'dan bir kez alır
                                              · fetch(usercontent/download?id&authuser&resourcekey,
                                                      {credentials:'include'})
                                              · udf.js: oku() → model, ciz() → DOM
                                              · Yazdır / PDF olarak kaydet / Drive'dan indir
```

### 2.2 Dosya yapısı

Bu yapı geliştiricinin öbür Chrome eklentilerindeki düzene uyuyor: Kullanıcıya verilen zip'in kökünde `manifest.json` durur, içine test ve `_` ile başlayan dosya girmez. Eklentinin dosyaları deponun kökündedir, zip'e yalnız onlar girer (`araclar/paketle.mjs` `EKLENTI_OGELERI`).

```
UDF-On-Izleme/
├─ manifest.json
├─ arkaplan.js            service worker: Belge kayıtları, sekme açma, Drive için ön indirme ve yedek indirme
├─ drive-kimlik.js        saf işlevler: urldenBilgi, hesapNo, sayfaHesabi, aktifOge, udfAdiMi
├─ gmail-ek.js            Gmail: Ek kartları, gösterilen ek, bilgi öğesinin doğrulanması
├─ icerik.js, icerik.css  Drive ve Gmail içerik betiği: Gözlemci, gömme, "UDF olarak aç" düğmesi
├─ goruntule.html/.css/.js, gomulu.html  görüntüleyici: Araç çubuğu, hata ekranı, yazdırma
├─ indir.js               udfIndir(): Drive indirmesi, virüs tarama sayfası, hata kodları, Gmail eki
├─ motor/udf-motoru.js    legaluga'nın udf.js'inden türetilmiş okuma motoru, başında köken commit'i
├─ simgeler/16.png 32.png 48.png 128.png
├─ LISANSLAR.txt          legaluga'nın MIT bildirimi
├─ araclar/ornek-uret.mjs, paketle.mjs, chrome-sina.mjs, sahte-drive.mjs, sahte-gmail.mjs …
├─ testler/ornekler/*.udf (yapay), testler/*.test.mjs
├─ .github/workflows/sinama.yml, yayim.yml
└─ package.json           yalnız geliştirme bağımlılıkları (ör. jsdom), eklentiye hiçbir bağımlılık girmez
```

**legaluga'nın `udf.js`'i bir kabuk bekler** [DOĞRULANDI]: `udf.js` 7. satırda `if (!globalThis.UHD || globalThis.UHD.udf) return;` ile başlıyor ve 1134. satırda kendini `globalThis.UHD.udf = { oku, ciz, UdfHatasi, SINIR, CSS, ILETI }` olarak dışa veriyor. `UHD` önceden tanımlı değilse dosya hiçbir şey yapmadan döner. MV3'te satır içi `<script>` çalışmadığı için kabuk ayrı bir dosya olmalı [D: Manifest CSP]. Eklentinin motoru kabuk istemez, kendini `globalThis.UDFMotoru` olarak dışa verir.

### 2.3 Manifest (en dar izinler)

Araştırmadaki öneri. Bugünkü manifest deponun kökünde (`manifest.json`): `permissions` alanı yok, içerik betiği Gmail'de de
çalışır, gömülü görünüm için `web_accessible_resources` var, CSP `default-src 'none'` ile başlar (`DRIVE-TEKNIGI.md` §13).

```json
{
  "manifest_version": 3,
  "name": "UDF Ön İzleme",
  "version": "0.0.1",
  "description": "Google Drive'daki UYAP .udf belgelerini tarayıcıda açar; dosya hiçbir sunucuya gönderilmez.",
  "minimum_chrome_version": "103",
  "host_permissions": ["https://drive.usercontent.google.com/*"],
  "background": { "service_worker": "arkaplan.js" },
  "content_scripts": [{
    "matches": ["https://drive.google.com/*"],
    "js": ["drive-kimlik.js", "icerik.js"],
    "run_at": "document_idle"
  }],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'none'; connect-src https://drive.usercontent.google.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; require-trusted-types-for 'script'"
  },
  "incognito": "split"
}
```

| Alan | Gerekçe |
|---|---|
| `permissions` yok | Belgenin kaydı service worker'ın kendi belleğinde durur, görüntüleyici onu bir iletiyle bir kez alır (2.5). Depo izni gerekmez. |
| `host_permissions` yalnız usercontent | Görüntüleyici, kimlik bilgisi gönderen ve CORS'a takılmayan isteği yalnız buraya atar [D 2.3]. drive.google.com için içerik betiğinin `matches` alanı yeter. Sekme açmak ve yönlendirmek için `tabs` izni gerekmez [ÇIKARIM]. |
| `web_accessible_resources` yok | Görüntüleyici sayfasını başka sitelere açmamak için. Drive sekmesini görüntüleyiciye çevirmek gerekirse bunu `chrome.tabs.update` yapar [D 3(d)]. |
| Yok: `cookies`, `downloads`, `declarativeNetRequest`, `identity`, `<all_urls>` | v1'de gereksiz. Hepsi daha ağır izin uyarısı getirir [D 2.3, 2.5, 3(e)]. |
| `minimum_chrome_version: 103` | `DecompressionStream('deflate-raw')` Chrome 103'te geldi [D] (https://github.com/mdn/browser-compat-data/blob/main/api/DecompressionStream.json). |
| CSP `connect-src` | Görüntüleyici yalnız Drive'ın indirme adresiyle konuşabilir; belge başka bir yere gönderilemez [ÇIKARIM]. Yan etkisi: oturum yoksa usercontent'in `accounts.google.com` adresine yönlendirmesi ağ hatası olarak görünür. Hata metni bunu kapsamalı (2.6). |
| `require-trusted-types-for 'script'` | Yanlışlıkla yazılan bir `innerHTML`'i engeller [D 4, ÇIKARIM]. legaluga'nın çizimi yalnız `createElement`, `textContent` ve `style.setProperty` kullanıyor [A][DOĞRULANDI, dosya başlığı]. Bu yönerge MV3 eklenti sayfasında kabul ediliyor mu, doğrulanmalı. |
| `style-src` yazılmadı | legaluga CSS'i dize olarak veriyor (`UHD.udf.CSS`) ve yazdırma için dinamik `@page` gerekiyor; ikisi de `<style>` öğesiyle eklenir. `style-src` kısıtlanırsa bu yollar kapanır [ÇIKARIM]. |
| `incognito: "split"` | Gizli pencerede görüntüleyicinin gizli pencerenin çerezleriyle açılması için. Varsayılan "spanning" kipinde eklenti sayfası normal pencerede, yanlış oturumla açılabilir [ÇIKARIM]. |
| `object-src 'none'` | `'self'`ten sıkı. MV3'ün bunu kabul ettiği doğrulanmalı. |

Kurulumda görünecek uyarı yaklaşık "drive.google.com ve drive.usercontent.google.com'daki verilerinizi okuma ve değiştirme" olacak. Bundan kaçınılamaz [ÇIKARIM].

### 2.4 Drive'da tetikleme yolları

| Sıra | Yol | Dayanak | Kırılganlık |
|---|---|---|---|
| **Birincil (a)** | Listede çift tıkla açılan ön izleme katmanında, adı `.udf` ise sabit konumlu "UDF olarak aç" düğmesi ya da belgenin katmanın içinde kendiliğinden gösterilmesi. | `#drive-active-item-info` içindeki `{"id","title","mimeType"}` JSON'u. Katman kapanınca öğe DOM'dan kalkıyor [D 1.3, canlı ölçüm]. Adobe ve PandaDoc da bu öğeyi okuyor [D]: https://github.com/pandadoc-integration/chrome-extension/blob/HEAD/pdf-detector.js | Orta-düşük |
| **Birincil (d)** | Paylaşım bağlantısıyla açılan `/file/d/<id>/view` sayfasında aynı yol (düğme ya da belgenin sayfanın içinde gösterilmesi). | Kimlik ve `resourcekey` URL'den gelir, ad `#drive-active-item-info`'dan ya da `"<ad> - Google Drive"` başlığından [D 1.1, 3(d)] | Düşük |
| v2 (b) | Drive'ın kendi sağ tık menüsüne öğe eklemek. | `contextmenu` + `closest('[data-id]')` + `div[role=menu]` [D 3(b)]. Örnek: https://github.com/insell824/tm-open-in-new-for-gdrive | Yüksek (karartılmış sınıflar) |
| v2 (e) | İndirmeyi yakalamak (`downloads` izni). | `chrome.downloads.onDeterminingFilename` [D 3(e)] | DOM'dan bağımsız, ama olağan indirmeyi değiştirir |
| Önerilmez (c) | Marketplace'te "Birlikte aç" uygulaması. | Cloud projesi, OAuth, barındırılan Open URL, `chrome-extension://` olamaz [D 3(c)] | Bakımı ağır |

Chrome'un kendi sağ tık menüsü (`chrome.contextMenus`) Drive satırlarında çıkmıyor. Drive `contextmenu` olayını `preventDefault` ediyor [D 3(b), canlı ölçüm].

**Ayrıntılar:**
- **Ad denetimi.**
  - Karar `mimeType`'a göre verilmemeli: zip tabanlı bir dosya `application/x-zip` diye raporlandı [D 1.3].
  - Karar `title` alanına göre verilir: `/\.udf$/i`. WhatsApp'ın adını bozduğu `.udf.zip` dosyaları için `/\.udf(\.zip)?$/i` da kabul edilmeli. AwuCat'in fikri: asıl karar içeriğe bakılarak verilir, yani zip mi ve içinde `content.xml` var mı [B].
  - Görüntüleyici adı ne olursa olsun içeriği yeniden denetler.
- **Liste satırının adı** (satırdan okunursa) dile bağlı `aria-label`'dan (`"<ad> <tür> [Paylaşıldı]"`) yalnız `/^(.+?\.udf)(?=\s|$)/i` ile çıkarılır. `textContent` kullanılmaz (tarih ve "Download" bitişik geliyor) [D 1.2].
- **Gözlemci.** `MutationObserver` 150 ms'lik geciktirmeyle çalışır; `characterData: true` açıktır, çünkü önceki ve sonraki okla dosya değişince JSON da değişir. `requestAnimationFrame` kullanılmaz [D 3(a)].
- **Düğme.** `document.documentElement`'e eklenen bir kapsayıcıdaki kapalı shadow root içinde durur; `position:fixed`, en yüksek `z-index`. `pointerdown` ve `mousedown` olayları Drive'a geçmez [D 3(a)].
- **Otomatik geçiş döngüsü** [ÇIKARIM]. (d) yolunda sekme görüntüleyiciye kendiliğinden geçirilirse, kullanıcı görüntüleyicide "geri"ye basınca Drive sayfası yeniden açılır ve yeniden yönlendirir. Çözüm: `performance.getEntriesByType('navigation')[0].type === 'back_forward'` ise yönlendirmemek ve aynı sekmede kimlik başına bir kez yönlendirmek.
- **Çoklu hesap.** `/u/<n>/` yolundan `authuser=<n>` alınır; `resourcekey` sorgudan alınıp indirmeye aynen eklenir [D 1.1]. Kullanıcının test bağlantısı da `/drive/u/0/folders/...` biçiminde.

### 2.5 Görüntüleyiciye devir

- Dosya adı URL'ye konmaz. Ad müvekkil adı ya da esas numarası taşıyabilir. Service worker `{id, ad, au, rk}` bilgisini kendi belleğinde `crypto.randomUUID()` anahtarıyla tutar ve `goruntule.html#t=<anahtar>` sekmesini Drive sekmesinin yanında açar [D 4]. Örnek kod raporda.
- Görüntüleyici kaydı bir iletiyle bir kez alır, kayıt o anda silinir. Alınmayan kayıt 60 sn sonra silinir. Kayıt hiçbir depoya yazılmaz, bu yüzden izin gerekmez. Sekme yenilenince belge yeniden açılmaz (`DRIVE-TEKNIGI.md` §13).
- Sekmenin başlığına belge adı konmaz: Başlık tarayıcı geçmişine, Chrome'un oturum kaydına ve pencere başlığına düşer. "PDF olarak kaydet" sekmede "UDF Ön İzleme" adını önerir (`DRIVE-TEKNIGI.md` §6.3, §13).

### 2.6 İndirme yolu

- **Nerede yapılır.** İndirme yalnız `goruntule.html` içinde yapılır, içerik betiğinde ya da service worker'da yapılmaz:
  - İçerik betiğinden kimlik bilgili istek CORS'a takılıyor (`TypeError: Failed to fetch`) [D 2.2, canlı ölçüm]. Chrome belgesi: https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
  - Üst düzey sayfa `chrome-extension://` olunca üçüncü taraf çerezleri engelli olsa bile gider. Service worker bu istisnadan yararlanmaz [D 2.3]: https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies
  - Baytları service worker'dan sayfaya taşımak base64 gerektirirdi [D 2.3].
- **Adres:** `https://drive.usercontent.google.com/download?id=<id>&export=download[&authuser=<n>][&resourcekey=<rk>]` ile `{credentials:'include', cache:'no-store'}`. `drive.google.com/uc` zaten buraya 303 ile yönlendiriyor [D 2.1, canlı ölçüm]. `resourcekey` parametresinin usercontent'te bu adla işlediği doğrulanmalı.
- **Kod:** [D 2.4]'teki `udfIndir()` temel alınır. Eklenecekler:
  - **Boyut sınırı:** `Content-Length` 40 MiB'ı (legaluga'nın `SINIR.paket` değeri [DOĞRULANDI]) aşarsa gövde okunmadan `AbortController` ile kesilir. Dosya yanlışlıkla bir video ise boşuna indirilmez.
  - **Virüs tarama sayfası:** `form#download-form` alanlarıyla yeniden denenir. Yalnız `drive.usercontent.google.com` adresine gidilir [D 2.1, 2.4]. gdown aynı yolu izliyor: https://github.com/wkentaro/gdown/blob/HEAD/gdown/download.py
  - **Zip imzası:** İlk 4 bayt `PK\x03\x04` değilse "UDF değil" denir.
  - **Bellek:** Baytlar yalnız bellekte tutulur. İndirilenler klasörüne, IndexedDB'ye ya da önbelleğe yazılmaz.
- **Hata ekranı** (Türkçe; her durumda "Drive'da aç" ve "Dosyayı indir" düğmeleri olur):

| Durum | İleti |
|---|---|
| Ağ hatası ya da CSP engeli (çoğunlukla giriş sayfasına yönlendirme) | "Drive oturumu bulunamadı ya da bağlantı kurulamadı. Bu tarayıcıda Drive'a doğru hesapla giriş yapın." |
| HTML döndü, `accounts.google.com` | Yukarıdakiyle aynı |
| `HTTP_403` | "Bu dosyayı indirme izniniz yok; sahibi indirmeyi kapatmış ya da kurumunuz engellemiş olabilir." Eklenti bunu aşmaya çalışmaz [D 2.3]. |
| `HTTP_404` | "Dosya bulunamadı ya da bu hesapla erişiminiz yok (başka bir Google hesabında olabilir)." |
| `ZIP_DEGIL` ya da `content-xml-yok` | "Dosya UDF değil ya da bozuk." |
| `UdfHatasi` kodları | legaluga'nın `ILETI` metinleri [DOĞRULANDI]; "indirip açın" ifadesi "Dosyayı indirip UYAP Doküman Editörü ile açın" yapılır. |

- **"Dosyayı indir" düğmesi** eldeki baytlardan `<a download>` ile kaydeder; `downloads` izni gerekmez [ÇIKARIM].
- **Dosya adı için ikinci kaynak** `Content-Disposition` başlığı olabilir [D 2.1]. Eklenti kökeninden bu başlığın okunabildiği ve Türkçe adların (`filename*`) doğru çözüldüğü doğrulanmalı.
- **Kapsam dışı:** OAuth ve Drive API. Gerekçeler: `drive.file` kapsamı DOM'dan okunan bir kimliğe erişemez; `drive.readonly` kısıtlı kapsamdır ve doğrulama ister; "Testing" durumunda belirteç 7 günde düşer [D 2.5] (https://developers.google.com/identity/protocols/oauth2).

### 2.7 Zip açma

- **Seçim:** legaluga'nın kendi zip okuyucusu kullanılır; ayrı bir kütüphane ya da [D]'deki `zipDosyasi()` gerekmez. `udf.js` içinde şunlar var [DOĞRULANDI]:
  - `zipGirdileri` merkezî dizini okuyor.
  - `girdiAc` `DecompressionStream('deflate-raw')` ile açıyor.
  - CRC32 tablosu var.
  - Sınırlar: girdi sayısı 1000, açılmış `content.xml` en çok 20 MiB, süre 8 sn.
  - Birden çok `content.xml` görürse belgeyi reddediyor (`belirsiz`).
- **Neden merkezî dizin:** Gerçek UYAP dosyaları Java `ZipOutputStream` çıktısı. Bayrak 0x0808 ve veri tanımlayıcısı var; yerel başlıkta boyut ve CRC 0. Bu yüzden merkezî dizinden okumak şart [C 1].
- **Desteklenen yöntemler:** 0 ve 8. ZIP64 ve şifreli girdi reddedilir [C 1].
- **Alternatifler:**
  - JSZip 3.10.1: 97.630 bayt, gereksiz [D 4].
  - fflate: Küçük, ama eş zamansız API'si Blob URL'li Worker açtığı için CSP'ye takılabilir [D 4].

### 2.8 UDF'den HTML'e işleyici

**Temel:** legaluga'nın `oku(blob,{signal})` → model ve `ciz(model,{signal,kaydirma})` → DOM işlevleri kullanılır [DOĞRULANDI]. Bunların zaten kapsadıkları [A][C]:
- stil zinciri ve döngü koruması
- hizalama, girinti, `LineSpacing` için 1.15 × (1 + LS) ([C §6]'nın önerdiği formül)
- tablolar: colspan, rowspan, iç içe tablo, `columnSpans` oranı
- PNG, JPEG, GIF ve BMP resimler: sihirli baytla tanınır, `createImageBitmap` ile tuvale çizilir
- liste (sınırlı), üst/alt bilgi, page-break, filigran, şablon verisi (`<data>`)
- Java'nın mantıksal yazı tiplerini eşleme ve yazı tipi adını arındırma
- DTD reddi, uzun belgeyi 200 bloklık dilimlerle ekleme

**Uyarlama:**
- Kök öğe `<main class="viewer">` içine konur, çünkü CSS `.viewer` ön ekli.
- `--shell-warn-bg` ve `--shell-warn-text` değişkenleri `goruntule.css`'te tanımlanır [DOĞRULANDI].

**Şartnameye göre yapılacak düzeltmeler** ([C §18] listesi; öncelik, gerçek UYAP çıktısında görülüp görülmediğine göre [C, ORN]):

| Öncelik | Düzeltme | Kural ve kaynak |
|---|---|---|
| P1 | `Hanging` desteği | Gerçek dosyada 145.14 değeri görüldü. CSS: `padding-left: L+H; text-indent: F−H` [C §6] |
| P1 | `TabSet`: hiza (0 sola, 1 sağa, 2 ortaya, 4 ondalık), öncü karakter, konum LeftIndent'e göreli | Şu an yalnız konum okunuyor (`split(':')[0]`, L641 [DOĞRULANDI]) ve CSS `tab-size:36pt`. Gerçek dosyada `69.0:2:0` (orta) görüldü [C §6]. |
| P1 | Birden çok üst/alt bilgide **sonuncusu**; `startPage` ve `stopPage`; `pageNumber-spec` bit kümesi (8 göster, 32 ortala, 64 sağa, 2048 "n/N"), `foreStr`, `afterStr`, `seperator` | Gerçek dosyada `startPage="2"` ve `BSP32_2120` görüldü [C §12] |
| P1 | Sekme hem `<tab>` öğesinde hem metnin içindeki `\t`'de; boş paragrafın üç biçimi; sondaki `\n` | [C §3, §15] (legaluga'da kısmen var, testle doğrulanmalı) |
| P2 | Liste numaraları | `NUMBER_TYPE_<NUMBER, CHAR_SMALL, CHAR_BIG, ROMAN_SMALL, ROMAN_BIG>_<DOT, PARANTHESE, D_PARANTHESE, TRE>` ve `PARENTHESIS` yazımı; 29 harfli Türk alfabesi (z'den sonra aa, bb…); `ListLevel` 1 tabanlı; `SecListTypeLevelN`; `NumberSetted`; `ListId` başına sayaç. legaluga'daki düzenli ifade hatası: L528-539 [C §10] |
| P2 | Boyutsuz resimde 1 piksel = 1 punto (şu an 0.75) | [C §7] (çelişkili; öneri piksel = punto) |
| P2 | `paperOrientation` 0 ya da 2 ise yatay (şu an yalnız 2) | Java `PageFormat` sabitleri [C §4] |
| P2 | `mediaSizeName` eşlemesi: MIA tablosu (1 A4, 2 A5, 3 Letter, 4 B5, 5 Legal, 6 Executive) | [C §4] |
| P3 | `bgImage`: veri varsa çiz; `bgImageWatermark` true ise soluk, değilse tam opak | [C §4] |
| P3 | Tablo `border` türleri: `borderCell`, `borderTable`, `borderRow`, `borderNone`; satır düzeyinde `columnSpans` | [C §11]. legaluga'nın satır düzeyini işleyip işlemediği doğrulanmalı. |
| Ek | `documentproperties.xml` okuması (doğrulama kodu ve sicil, görüntüleyici göstermez) | Java Properties XML. DOCTYPE taşıdığı için DTD reddi bu dosyaya uygulanmaz [C §13]. udfly'ın okuyucusu (MIT, `src/parser.js` L21-36) başvuru. |
| Ek | `sign.sgn` varsa e-imza rozeti | legaluga `model.imza` değerini veriyor [DOĞRULANDI]. WebCrypto ile `content.xml`'in SHA-256 özeti CMS'teki messageDigest ile karşılaştırılır [C §13]. Eklentide: Özet tutarsa "E-imzalıdır", tutmazsa uyarı, karşılaştırılamazsa nötr "E-imza dosyası var, içerikle karşılaştırılamadı" (`DRIVE-TEKNIGI.md` §7). İmza ve sertifika doğrulanmaz. |

**Ofset birimi:** UTF-16, yani JS dizesindeki doğrudan dizin. legaluga böyle yapıyor; şartnamenin önerisi de bu [C §3].

**Ekran görünümü (v1):**
- Sayfalar yalnız açık `page-break` yerlerinde bölünür, legaluga'daki gibi.
- Üst ve alt bilgi her bölümün başında ve sonunda bir kez çizilir [DOĞRULANDI, L1040-1060].
- Editör'deki gibi otomatik A4 sayfa görünümü ek iştir (Soru 6).

### 2.9 Yazdırma ve PDF

- **Yazdır düğmesi** önce bekleyen bütün resim tuvallerini çizer, sonra `window.print()` çağırır. Chrome'un "PDF olarak kaydet" hedefi PDF'i verir [D 4].
  - Gerekçe [DOĞRULANDI]: legaluga resimleri `IntersectionObserver` ile yalnız ekranda göründükçe çiziyor (L1068). Doğrudan yazdırılırsa ekran dışındaki resimler boş çıkabilir.
  - `udf.js`'e bütün tuvalleri çizen bir `tumunuCiz()` işlevi eklenir.
  - Ctrl+P de aynı yola yönlendirilir (`keydown` yakalanır), çünkü `beforeprint` olayı eş zamansız çizimi bekleyemez [ÇIKARIM].
- **Dinamik `@page`:** `size: <en>pt <boy>pt; margin: <üst> <sağ> <alt> <sol>` değerleri `pageFormat`'tan gelir [D 4][C §4].
- **`@media print` kuralları:**
  - `.udf-sayfa{padding:0;width:auto;min-height:0;box-shadow:none;break-after:page}`
  - `.udf-dilim{content-visibility:visible}`. legaluga ekranda `content-visibility:auto` kullanıyor [DOĞRULANDI]; yazdırırken atlanma riskini kaldırır [ÇIKARIM].
  - Araç çubuğu gizlenir.
  - Üst ve alt bilgideki ekran süsleri (kesik çizgi, gri renk) kaldırılır.
- **Sayfa numarası:** Chrome'un `@page` kenar kutuları (`@bottom-right { content: counter(page) "/" counter(pages) }`) ile basılabilir. Chrome 131'den beri desteklendiği **doğrulanmalı**; desteklenmeyen tarayıcı kuralı yok sayar.
- **Üst ve alt bilginin her basılı sayfada yinelenmesi** v2'ye kalır. `position:fixed` ile denenebilir; doğrulanmalı.

### 2.10 Gizlilik ve güvenlik özeti

- Görüntüleyici yalnız Drive'ın indirme adresiyle konuşur (CSP `connect-src`). Uzaktan kod, CDN, telemetri ve hata raporu yoktur. (Legaluga'nın mağaza sürümünde Sentry var [B]; bizim kopyada olmaz.)
- Belge metni hiçbir zaman HTML olarak işlenmez. Görünüm `textContent` ve tek tek verilen CSS özellikleriyle kurulur. Sınırlar legaluga'daki gibidir: boyut, derinlik, süre, resim pikseli [A][DOĞRULANDI].
- İçerik betiği Drive'dan yalnız kimlik, ad ve hesap numarası okur. Belge içeriğine dokunmaz.

### 2.11 Uygulama aşamaları

Her aşama tek başına çalışır durumda biter ve ayrı commit olur.

1. **İskelet ve yerel görüntüleyici.**
   - Eklentinin dosyaları deponun kökünde durur. `udf.js` sabit commit'ten (`1a659c4233`) lisans bildirimiyle alınır (`motor/udf-motoru.js`).
   - `goruntule.html#yerel`: dosya seç ya da sürükle-bırak ile yerel `.udf` açılır. Bu Drive'sız sınamayı sağlar, WhatsApp'tan gelen dosyalar için de işe yarar.
   - Örnek üretici ve Node testleri.
2. **Drive entegrasyonu.** (a) ve (d) yolları, service worker'ın belleğinden görüntüleyiciye devir (2.5), `udfIndir()` ve hata ekranı.
3. **İşleyici düzeltmeleri.** P1, sonra P2 ve P3.
4. **Yazdırma ve PDF.** `tumunuCiz()` ve imza rozeti.
5. **Paketleme ve dağıtım.**
   - `araclar/paketle.mjs` ve testi, `yayim.yml` (`v*` etiketi = manifest sürümü), README başında `releases/latest/download/<ad>.zip` bağlantısı (geliştiricinin öbür eklentilerindeki düzen).
   - Push ve yayım ayrı onay ister.

---

## 3. Yeniden kullanılacak kod ve lisans uygunluğu

| Kaynak | Lisans | Kullanım | Yükümlülük |
|---|---|---|---|
| hasanimer/legaluga-uyap-ui `src/extension/udf.js` (https://github.com/hasanimer/legaluga-uyap-ui) | MIT [DOĞRULANDI] | **Kopyalanır ve yamalanır** (motor) | Telif ve izin metni dağıtılan kopyada kalır: `udf.js` başına köken (depo, commit `1a659c4233`) ve değişiklik notu, `LISANSLAR.txt` içinde tam MIT metni ("Copyright (c) 2026 Hasan İmer Akın"). LISANSLAR.txt zip'e de girer. |
| mfozmen/udfly `src/parser.js`, `src/render.js`, `test/render.security` (https://github.com/mfozmen/udfly) | MIT [A] | `documentproperties.xml` okuması ve güvenlik testleri için başvuru; kod alınırsa küçük parça | Alınırsa aynı biçimde MIT bildirimi |
| burakayax/NB_PDF_PLATFORM (https://github.com/burakayax/NB_PDF_PLATFORM) | MIT [A] | Gerek yok (PDF yazdırmayla alınıyor) | – |
| symbuzzer/Evrak `UdfHtmlConverter.kt` (https://github.com/symbuzzer/Evrak) | Apache-2.0 [A] | Liste ve kenarlık kuralları için başvuru | Kod çevrilirse Apache-2.0 bildirimi ve "değiştirildi" notu |
| gokselb/udfpdf (https://github.com/gokselb/udfpdf) | Apache-2.0 [A] | Gerek yok (Node'a bağlı, blok sırası hatası var) | – |
| [D]'deki kod örnekleri (`udfIndir`, `aktifOge`, `sw.js`, `zipDosyasi`) | Araştırma çıktısı, bizim | Doğrudan kullanılabilir | – |
| PandaDoc ve Adobe içerik betikleri, OpenLocalForGoogleDrive, tm-open-in-new-for-gdrive | Adobe özel; ötekilerin lisansı bu raporlarda doğrulanmadı | **Kod alınmaz.** Yalnız bilgi kullanılır: seçici adları ve davranış. | – |
| miasimbilir/udf-cevirici | Özel kullanım koşulları, OSI lisansı değil [C §18] | Yalnız bilgi kaynağı (liste, sayfa numarası, kâğıt kodları) | – |
| UDF-Toolkit `Docs.md`, UDFpad, can-yesilyurt, iseeeva, ugarchance, isikdogan.com kopyası | Lisans yok ya da kopyalama yasak [A][C] | Yalnız okunur, kod alınmaz | – |
| murataskin/udf-cli | LICENSE yok, npm sürümü obfuscate edilmiş [A] | Kullanılmaz | – |

**Projenin kendi lisansı:** AGPL-3.0 (`LICENSE`), legaluga'nın MIT lisansıyla uyumlu. Motorun türetildiği kodun MIT bildirimi `LISANSLAR.txt`'de.

**Upstream:** Düzeltmelerin legaluga'ya PR olarak önerilmesi mümkün, ama dışarıya yapılan bir adım; ancak kullanıcı isterse.

---

## 4. Kırılganlık riskleri ve azaltma

| Risk | Olasılık | Azaltma |
|---|---|---|
| Drive `#drive-active-item-info` öğesini kaldırır ya da biçimini değiştirir | Orta-düşük (Adobe ve PandaDoc da kullanıyor [D]) | Katmanlı tanıma: JSON → `/file/d/<id>/` → `[aria-selected][data-id]` [D 1.4]. Karartılmış sınıflar (`.a-b-Sh-ng`, `.O5x1db`) hiç kullanılmaz. Görüntüleyicinin yapısı tanınmazsa "UDF olarak aç" düğmesi belgeyi yeni sekmede açar. |
| Ölçüm oturumsuz görünümde yapıldı; oturum açıkken DOM farklı olabilir | Bilinmiyor | Kullanıcının oturumuyla ilk sınama (5.5) zorunlu. Izgara görünümü ve "Benimle paylaşılanlar" ayrıca denenir; `role="gridcell"` 0 çıkmıştı, ızgara sınanmadı [D 1.2]. |
| Dile bağlı metinler (aria-label "Shared/Paylaşıldı") | Yüksek, ama etkisi küçük | Yalnız `.udf` uzantı eşleşmesi kullanılır; dil sözcüklerine bağlanılmaz [D 1.2]. |
| Usercontent indirme adresi ya da yanıtı değişir | Düşük | Hata ekranında "Dosyayı indir" ve "Drive'da aç" yedekleri; zip imzası denetimi. `drive.google.com/uc` yönlendirmesi ikinci yol olarak eklenebilir (`connect-src` ve izin genişler). |
| Virüs tarama sayfası, kurum indirme yasağı, "izleyiciler indiremez" ayarı | Düşük (UDF KB boyutunda) | Form işlenir; 403'te anlaşılır ileti, aşma girişimi yok [D 2.1, 2.3]. |
| Çoklu hesapta yanlış hesap | Orta | `authuser` her istekte gönderilir [D 2.3]; 404'te "başka hesapta olabilir" iletisi. |
| Üçüncü taraf çerezleri engelli | Düşük | İndirme üst düzey eklenti sayfasında yapılır, istisna devrede [D 2.3]. Sınama adımı 5.5'te. |
| Gizli pencere | Düşük | `incognito: "split"` [ÇIKARIM] ya da gizli pencere desteklenmez. |
| Otomatik geçişte geri tuşu döngüsü | Orta | `back_forward` denetimi ve sekme başına bir kez yönlendirme (2.4). |
| legaluga'nın gelecek sürümleri | – | Sabit commit'ten alınır; yükseltme elle ve testlerle yapılır. Kendi yamalarımız ayrı commit'lerde tutulur. |
| Yazdırırken ekran dışındaki resimler boş çıkar | Orta [DOĞRULANDI: tembel çizim] | `tumunuCiz()` ve `content-visibility:visible` (2.9). |
| Drive içerik betiğinin yükü | Düşük | Geciktirilmiş gözlemci; yalnız `getElementById` ve küçük sorgular. |
| Eklentinin kurum politikasıyla engellenmesi (Workspace) | Bilinmiyor | Soru 5. |

**Yayımdan önce Drive bekçisi:** `araclar/chrome-sina.mjs drive` geçici görünmez profilde herkese açık bir `.udf` dosyasını açar ve şunları denetler: `#drive-active-item-info` var mı, düğme çıkıyor mu, indirme `PK` ile başlıyor mu. Bunun için herkese açık, içeriği yapay bir test `.udf` dosyası gerekir (Soru 2). Kalıcı zamanlanmış görev kurulmaz.

---

## 5. Sınama planı

### 5.1 Yerel örnek UDF'ler (`araclar/ornek-uret.mjs` → `testler/ornekler/`)

- Hepsi yapay metinlerle, Node `zlib.deflateRawSync` ile üretilir. Kişisel veri girmez.
- Zip biçimi Java `ZipOutputStream`'i taklit eder: bayrak 0x0808, veri tanımlayıcısı, yerel başlıkta boyut ve CRC 0 [C 1].
- Kapsanması gerekenler [C §3–§15]:
  - **Paket:**
    - Yalnız `content.xml` içeren paket.
    - `documentproperties.xml` + `content.xml` + `sign.sgn` (sahte imza; yalnız varlığı sınanır).
    - Saklanmış yöntem (0).
    - Merkezî dizin sonrası yorum.
    - Hata durumları: zip değil, iki `content.xml`, şifreli bayrak, ZIP64, beyan edilen boyutu aşan açılım (zip bombası), 1001 girdi.
  - **XML:**
    - UTF-8 BOM'lu ve BOM'suz, `format_id` 1.7 ve 1.8, ön sözden sonra boş satır.
    - `<!DOCTYPE>` ve `<!ENTITY>` reddi.
    - Havuzda çok parçalı CDATA.
    - Sınır dışı ofset.
    - `startOffset` taşıyan tanınmayan öğe.
  - **Paragraf:** hiza 0–3 ve "1.0" yazımı; LeftIndent, RightIndent, FirstLineIndent (eksi dahil), Hanging; LineSpacing 0 ve 0.5; SpaceAbove ve SpaceBelow.
  - **Sekme:**
    - TabSet'te hiza 0, 1, 2, 4 ve öncü 0–5.
    - `<tab>` öğesi ve metin içindeki `\t`.
    - TabSet olmadan varsayılan duraklar.
  - **Karakter ve stil:**
    - Kalın, italik, altı çizili, üstü çizili, üst ve alt simge.
    - `foreground` işaretli ve işaretsiz, alfa 0; `background="-1"`.
    - `family` değerleri: Dialog, Times New Roman, Arial Narrow ve kötü niyetli bir ad (`x";}body{…`), arındırma için.
    - Ondalık `size`.
  - **Stiller:** `hvl-default` zinciri, `edf_*` stilleri, `default`'a çözülen yaprak, döngülü resolver. Resolver'ı olan yaprağın paragrafı devralmaması (Swing kuralı) [C §9].
  - **Yapraklar:** `field` (havuzdaki değer), `space`, boş paragrafın üç biçimi, havuz sonundaki sahipsiz `\n`, paragraf sonunun ayrı content'te ya da son parçada olması.
  - **Resim:**
    - PNG ve JPEG; `width`/`height` var ve yok.
    - Yer tutucu hem U+00B8 hem U+FFFC, ikisi de çizilmemeli.
    - base64 içinde 76 karakterde bir LF.
    - Aşırı büyük piksel boyutu (red kutusu).
  - **Tablo:**
    - `border` türleri: borderNone, borderCell, borderTable, borderRow.
    - `columnSpans` tablo ve satır düzeyinde.
    - colspan/rowspan küçük ve büyük harfle.
    - İç içe tablo, `headerRow`, gerçek UYAP'taki gibi çıplak `row` ve `cell`.
  - **Liste:**
    - Numbered ve Bulleted; NumberType'ın bütün türleri (PARANTHESE ve PARENTHESIS).
    - CHAR türünde 30'dan fazla kalem: Türk alfabesi, sonra aa.
    - ListLevel 1–3, SecListTypeLevel2, NumberSetted, iki ayrı ListId.
  - **Sayfa:**
    - `page-break`, `pagebreak` ve `pageBreak` yazımları.
    - pageFormat A4, A5 ve Letter; yön 0, 1 ve 2; kayan noktalı kenar boşlukları.
    - bgImage, filigranlı ve filigransız.
  - **Üst ve alt bilgi:** iki header (sonuncusu seçilmeli), `startPage="2"`, `stopPage="1"`, `pageNumber-spec` değerleri BSP32_2120, BSP32_40 ve BSP32_0.
  - **Şablon:** kökte `<data>` ve `dataRow`.
- **Gerçek biçim karşılaştırması:**
  - UDE 5.4.20'nin kaydettiği `turnusol.udf` ve `pano-yapistir.udf` (UDF Resimcisi projesinin test örnekleri) [C, RES-TD]. Depoya kopyalanmadan önce içeriğinde kişisel veri olmadığı denetlenmeli.
  - Herkese açık gerçek UYAP çıktıları (https://github.com/AvHakanOrhan/eypport/tree/HEAD/scratch/udf_evrak_13360401060) yalnız yerelde, yapı karşılaştırması için kullanılır. Gerçek dava içeriği taşıyabileceği için depoya girmez.

### 5.2 Birim testleri (Node, `node --test`)

- **Model katmanı.**
  - `oku()` her örnek üzerinde çalıştırılır: blok sırası, dilimlenen metin, çözülmüş stil, liste etiketleri, tablo sütun oranları, sayfa ölçüleri, hata kodları ve sınırlar.
  - Beklenen model JSON anlık görüntüyle (snapshot) karşılaştırılır.
  - Node'da `DOMParser` ve `document` yok. `udf.js` jsdom penceresinde `vm` ile çalıştırılır; jsdom yalnız geliştirme bağımlılığıdır.
  - Node'da `DecompressionStream('deflate-raw')` bulunduğu (Node 22 LTS) doğrulanmalı. Yoksa test ortamında `zlib.inflateRawSync` ile yamalanır.
- **Çizim katmanı (jsdom).** Oluşan DOM'da metin, sınıflar ve `style` değerleri (`padding-left`, `text-indent`, `line-height`) denetlenir. Hiçbir öğede `on*` özniteliği ya da `<script>` olmadığı da denetlenir. Tuval ve resim çizimi jsdom'da sınanamaz; 5.4'e kalır.
- **Drive katmanı.**
  - `drive-kimlik.js` işlevleri: URL kalıpları (`/file/d/`, `open?id=`, `uc?id=`, `/u/1/`, `resourcekey`).
  - Kimlik düzenli ifadesi, `.udf` ve `.udf.zip` ad eşleşmesi.
  - `aria-label`'dan ad çıkarma (Türkçe ve İngilizce).
  - Girdiler: [D 1.2–1.3]'te ölçülen yapıyı taklit eden **yapay** HTML parçaları (`testler/drive-dom/`). Gerçek Drive sayfası kaydedilmez, çünkü ad ve e-posta taşır.
- **İndirme.** `udfIndir()` sahte `fetch` ile sınanır: 200 zip; virüs tarama sayfası (form ve `confirm=t`); başka alan adına giden form (reddedilmeli); giriş sayfası HTML'i; 403; 404; zip olmayan yanıt; 40 MiB'ı aşan `Content-Length` (gövde okunmamalı); ağ hatası.
- **Paketleme** (geliştiricinin Chrome eklentisi düzeni):
  - Zip açılır; kökte `manifest.json` olmalı.
  - Manifest'in, HTML'lerin ve betiklerin adını verdiği bütün dosyalar zip'te olmalı.
  - Test dosyası, `_` ile başlayan ad ve ters bölülü yol olmamalı.
  - `LISANSLAR.txt` olmalı.

### 5.3 Geçici Chrome profilinde yükleme

- Yöntem geliştiricinin öbür eklentilerinde de kullandığı düzendir: Görünmez geçici profil ve CDP `Extensions.loadUnpacked`. Ekranı devralan denetim kullanılmaz.
- Adımlar:
  1. Paket zip'i `Expand-Archive` ile zip adlı bir klasöre açılır ve eklenti yüklenir. Eklentinin hatasız yüklendiği ve service worker'ın çalıştığı denetlenir.
  2. `goruntule.html#yerel` açılır; her örnek `DOM.setFileInputFiles` ile verilir. Denetimler:
     - konsolda hata ve CSP ihlali yok
     - yerel kipte ağ isteği sıfır (`Network` olayları)
     - resim tuvalleri çizilmiş
     - `ozet()` sayaçları beklendiği gibi
  3. Yazdırma: önce `tumunuCiz()`, sonra CDP `Page.printToPDF`. Sayfa boyutu ve kenar boşlukları, sayfa sonları, resimlerin dolu olduğu ve sayfa numarası (kenar kutuları destekleniyorsa) denetlenir. Çıkan PDF'in metni okunarak karşılaştırılır.
  4. Drive, oturumsuz: herkese açık bir `.udf` dosyası (Soru 2) `/file/d/<id>/view` ve klasör görünümünde açılır. Düğmenin çıktığı, görüntüleyicinin açıldığı ve indirmenin `PK` ile başladığı denetlenir. Kullanıcının bağlantısı yalnız kullanıcı test için verdiği ve herkese açık olduğu için bu sınamada kullanılabilir.
- Görsel benzerlik için legaluga'nın kendi görünümü ve UYAP Doküman Editörü ile bir kez göz karşılaştırması yapılır (kullanıcıyla). Piksel karşılaştırması yapılmaz.

### 5.4 Kullanıcının oturumuyla son sınama

Bu adım kullanıcının Google oturumunu gerektirir. Kullanıcı eklentiyi kendi Chrome'una zip'ten "Paketlenmemiş öğe yükle" ile kurar.

Claude in Chrome kullanıcının Drive sekmesinde sayfayı okuyarak yardımcı olabilir. `chrome-extension://` görüntüleyici sekmesini okuyup okuyamadığı doğrulanmalı.

[D 5]'teki adımlar:
1. Klasörde bir `.udf` dosyasına çift tıklanır. `#drive-active-item-info` içindeki `title` ve `mimeType` not edilir; düğme görünüyor mu?
2. Görüntüleyicide indirme 200 dönüyor mu, ilk baytlar `PK\x03\x04` mi? Bu, **paylaşılmamış (özel)** bir dosyada da denenir.
3. `/u/1/` ile ikinci hesap: doğru dosya geliyor mu?
4. "Üçüncü taraf çerezleri engelle" açıkken 2. adım yinelenir.
5. Dosya `/file/d/<id>/view` bağlantısıyla açılır: düğme ya da otomatik geçiş çalışıyor mu, `resourcekey` taşınıyor mu, geri tuşu döngüye giriyor mu?
6. Ek: Drive'ın arayüz dili Türkçe ve İngilizce, ızgara görünümü, Ortak Drive, gizli pencere, yazdırma ve PDF'in önerilen dosya adı.

Gerçek belgeler yalnız açılıp bakılır. İçerikleri rapora, teste ya da depoya girmez.

---

## 6. Kullanıcı kararı gerektirenler

1. **Ad.** Eklentinin adı: UDF Ön İzleme.
2. **Test bağlantısı.** Verilen klasör "bağlantıya sahip herkes" ile mi paylaşıldı, içindeki dosyalar gerçek dosya evrakı mı?
   - Herkese açıksa otomatik sınama sizin oturumunuz olmadan yapılabilir.
   - Gerçek evraksa yalnız açılıp bakılır, depoya girmez.
   - Yayım öncesi Drive denetimi için içeriği yapay, herkese açık tek bir `.udf` dosyası koyabilir misiniz?
3. **Çift tıkta davranış.** Öneri: Ön izleme ekranında "UDF olarak aç" düğmesi. Yoksa her `.udf` çift tıkta kendiliğinden mi açılsın? (Eklenti belgeyi Drive'ın ön izleme penceresinin içinde kendiliğinden gösterir, düğme yalnız pencerenin yapısı tanınmazsa ya da belge gömülemezse çıkar, `DRIVE-TEKNIGI.md` §7.)
4. **Dağıtım.** Öneri: önce öteki eklentileriniz gibi GitHub sürüm zip'i ve "Paketlenmemiş öğe yükle". Chrome Web Store sonra düşünülür; geliştirici hesabı, gizlilik beyanı ve mağaza incelemesi ister.
5. **Hesap ve kurum.** Drive'ı birden çok Google hesabıyla mı kullanıyorsunuz? Büro hesabı Google Workspace mı? Workspace yöneticisi eklentileri ya da indirmeyi kısıtlayabilir. Ofis bilgisayarında da kurulacak mı?
6. **Sayfa görünümü.** v1'de ekranda sayfalar yalnız elle konmuş sayfa sonlarında bölünür; yazdırırken A4'e kendiliğinden bölünür. Editör'deki gibi ekranda da otomatik sayfa bölme istenirse ek iş çıkar.

---

## Kaynaklar

- **UDF okuma motoru:**
  - https://github.com/hasanimer/legaluga-uyap-ui (MIT [DOĞRULANDI])
  - https://github.com/hasanimer/legaluga-uyap-ui/blob/1a659c4233/src/extension/udf.js
- **Başvuru okuyucular:**
  - https://github.com/mfozmen/udfly
  - https://github.com/burakayax/NB_PDF_PLATFORM
  - https://github.com/symbuzzer/Evrak
  - https://github.com/gokselb/udfpdf
- **Biçim kaynakları:**
  - https://github.com/saidsurucu/UDF-Toolkit (Docs.md)
  - https://github.com/miasimbilir/udf-cevirici
  - https://github.com/bilalabic/udf-dilekce (docs/udf-format.md)
  - https://github.com/ygzyr/UDFpad (cms.ts)
  - Gerçek UYAP örnekleri: https://github.com/AvHakanOrhan/eypport/tree/HEAD/scratch/udf_evrak_13360401060
- **Hazır araçlar:**
  - https://chromewebstore.google.com/detail/ammflfcdgfikhbjegoilalfmjhdcbneb
  - https://github.com/cantuncr/awucat-tarayici-uzantisi
  - https://chromewebstore.google.com/detail/aicknihmpdcbfgidifffinnbgbghkmcn
  - https://workspace.google.com/marketplace/app/uyap_%C3%A7evirici/46494924541
  - https://developers.google.com/workspace/drive/api/guides/publish
- **Chrome belgeleri:**
  - https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies
  - https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
  - https://developer.chrome.com/docs/extensions/develop/concepts/messaging
  - https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy
  - https://developer.chrome.com/docs/extensions/reference/api/downloads
- **Drive DOM'u ve indirme örnekleri:**
  - https://github.com/pandadoc-integration/chrome-extension/blob/HEAD/COMPARISON.md
  - https://github.com/pandadoc-integration/chrome-extension/blob/HEAD/pdf-detector.js
  - https://github.com/milesrichardson/testing-extmon/blob/HEAD/unpacked/efaidnbmnnnibpcajpcglclefindmkaj/content_scripts/gsuite-content-script.js
  - https://github.com/murasaqi/OpenLocalForGoogleDrive/tree/HEAD/extension
  - https://github.com/insell824/tm-open-in-new-for-gdrive
  - https://github.com/wkentaro/gdown/blob/HEAD/gdown/download.py
- **OAuth ve Drive API:**
  - https://developers.google.com/identity/protocols/oauth2
  - https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- **DecompressionStream uyumluluğu:** https://github.com/mdn/browser-compat-data/blob/main/api/DecompressionStream.json
- **Geliştiricinin kendi düzeni (yerel):**
  - Geliştiricinin yerel notları: Chrome eklentisi düzeni ve UYAP Haciz Yardımcısı'nın sınama yöntemi
  - UDF Resimcisi projesinin test örnekleri (`testdata/`)