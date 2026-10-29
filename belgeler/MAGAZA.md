# Chrome Web Mağazası metinleri ve görselleri

Mağaza panosundaki (Chrome Web Store Developer Dashboard) alanlara kopyalanacak metinler. Mağazada görünen metinler
Türkçe, yalnız inceleme ekibinin okuduğu alanlar (tek amaç, izin gerekçesi, test talimatları) İngilizcedir, Türkçesi
altında. Paket: `node araclar/paketle.mjs --magaza` (manifest'te `key` yok, mağaza kabul etmiyor). Paket git deposunda
üretilir: Ona yalnız git'in izlediği dosyalar girer, dosyaları GitHub sürüm zip'iyle aynıdır. Görseller
`belgeler/magaza/` (`node araclar/tanitim-gorselleri.mjs`, ardından `node araclar/magaza-gorselleri.mjs`).

## 1. Paket (Package)

- Dosya: `UDF-On-Izleme-<sürüm>-magaza.zip`
- Ad ve özet manifest'ten gelir, panelde yazılmaz.

**Ad** (13/75 karakter): UDF Ön İzleme

**Özet** (125/132 karakter):
Google Drive ve Gmail’deki UYAP .udf belgelerini Google’ın ön izlemesinde açar, sunucuya göndermez. Geliştirici: x.com/CgrShn

## 2. Mağaza girişi (Store listing)

**Açıklama** (Description). Düz metin, README'den. Özet mağazada açıklamanın üstünde zaten görünür. Kurallar:

- Teşekkür ve kişi adı mağaza metnine girmez (UYAP Haciz Yardımcısı bu yüzden "anahtar kelime spam'i" gerekçesiyle
  reddedildi, ihlal kodu Yellow Argon).
- Aynı anahtar kelime 5'ten az geçer (Google, Drive, Gmail, UDF, PDF, UYAP, ön izleme). Mağazanın spam SSS'si: "it's
  best to keep instances of a specific keyword to under 5".
- Veri gizliliği bölümü başta durur ve okunan bilgileri sayar: Kullanıcı verisi işleyen eklenti bunu kurulumdan önce
  belirgin biçimde söylemeli (Disclosure Requirements, 2026 güncellemesi), eklentinin arayüzü olmadığı için o yer mağaza
  sayfasıdır.
- Google markalarının sahibi belirtilir (Branding Guidelines).

```
Google Drive ve Gmail, UYAP Doküman Editörü'nün .udf belgelerini ön izleme olarak göstermez. Bu eklenti o eksikliği giderir: Dosyaya çift tıklamanız ya da e-postadaki eke tıklamanız yeter. Belge, PDF'ler gibi aynı ön izleme penceresinde açılır. Belgeleri bilgisayara kaydetmeden okumak, yazdırmak ya da PDF olarak saklamak isteyenler içindir. Bilgisayarda Doküman Editörü kurulu olması gerekmez.

VERİ GİZLİLİĞİ
Belgeleriniz hiçbir sunucuya gönderilmez. Eklentinin bir sunucusu yoktur. Belge yalnız durduğu yerden, tarayıcınızda açık olan kendi oturumunuzla alınır ve yalnız tarayıcınızda gösterilir. Eklenti belgeyi bulup açmak için yalnız şunları okur: Açılan dosyanın kimliği, adı ve türü, açık hesabın sırası (adreste yazılıysa e-posta adresi), paylaşım bağlantısının erişim anahtarı, dosya sayfasında sekmenin başlığı, hangi ek kartına ya da bağlantıya bastığınız, o iletideki eklerin adları ve indirme bağlantıları. E-postaların metnine, konusuna, gönderenine ya da alıcılarına bakmaz. Hiçbir şey saklamaz: Ayarı, geçmişi ya da kaydı yoktur. Belgenin adı sekme başlığına ve adrese konmaz, bu yüzden tarayıcı geçmişine düşmez. Ayrıntılar: https://csahin.com.tr/udf-on-izleme/#veri-gizli%C4%9Fi

NE YAPAR
• Drive'da: Bir .udf dosyasına çift tıklayınca belge Drive'ın ön izleme penceresinde açılır. Oklarla (← →) öbür dosyalara geçilir. Esc ya da belgenin dışına tıklamak pencereyi kapatır. Bu belgelerde işlemeyen Yorum düğmesi belge açıkken gizlenir.
• E-posta eklerinde: Bir .udf ekine tıklayınca belge, "Önizleme yok" yerine Gmail'in kendi penceresinde açılır. Oklarla (← →) öbür eklere geçilir, Esc pencereyi kapatır.
• Alttaki çubuk: Solda imza durumu ve notlar, ortada yakınlaştırma, sağda yazdırma düğmesi. Ctrl+P de yazdırır. Yazdırma penceresinde belge PDF olarak da kaydedilebilir. Gmail'de açılan belgede önerilen dosya adı sekmenin adıdır, belgenin adını siz yazarsınız.
• Notlar: Belgeye Editör'de eklenmiş notlar sağdaki bölmede kendiliğinden açılır. Bir nota basınca belgede işaretlediği yere gidilir. Pencere daraldıkça bölme de daralır.
• İmza durumu: Belgede e-imza dosyası varsa çubukta bir rozet çıkar. İmza dosyasındaki özet belge içeriğiyle tutuyorsa "E-imzalıdır", tutmuyorsa "E-imza içerikle uyuşmuyor" (belge imzadan sonra değiştirilmiş olabilir), karşılaştırılamıyorsa "E-imza dosyası var, içerikle karşılaştırılamadı" yazar. İmza ve sertifika doğrulanmaz.

KURULUMDAN SONRA
Kurulumdan önce açılmış sekmeleri bir kez yenileyin (F5). Yapılacak bir ayar yoktur, eklentinin açılır penceresi de yoktur. Üyelik ya da ücret istemez. Güncellemeleri Chrome kendisi yapar. Eklentiyi kapatmak için chrome://extensions sayfasında eklentinin kartındaki anahtarı kapatın ve açık sekmeleri yenileyin.

Kaynak kodu herkese açıktır (AGPL-3.0): https://github.com/SCgrS/UDF-On-Izleme

Bu eklenti bağımsızdır. Google ya da UYAP ile bağlantılı değildir, onlar tarafından geliştirilmemiş ve onaylanmamıştır. Google Drive ve Gmail, Google LLC'nin ticari markalarıdır.

Soru ve geri bildirimler için: x.com/CgrShn
```

**Kategori:** Verimlilik › Araçlar (Productivity › Tools)

**Dil:** Türkçe

**Görseller** (`belgeler/magaza/`):

| Alan | Dosya | Boyut |
|---|---|---|
| Mağaza simgesi | `magaza-simgesi-128.png` | 128×128 |
| Ekran görüntüleri (sırayla) | `ekran-1-drive-gmail.png`, `ekran-2-notlar.png`, `ekran-3-yazdir.png`, `ekran-4-gizlilik.png` | 1280×800 |
| Küçük tanıtım karosu | `tanitim-kucuk-440x280.png` | 440×280 |
| Kayan yazı tanıtım bloğu | `kayan-yazi-tanitim-blogu-1400x560.png` | 1400×560 |

Görüntülerdeki belge, kişi ve dosya adları örnektir (yapay dilekçe). Ekran görüntüleri Drive'da çekildi. Gmail'de
çekilmiş görüntü yok: Gerçek bir posta kutusu kullanılmadı.

**Ek alanlar:**

- Resmî URL (Official URL): Boş. Google Search Console'da doğrulanmış site ister.
- Ana sayfa URL'si (Homepage URL): `https://csahin.com.tr/udf-on-izleme/`
- Destek URL'si (Support URL): `https://x.com/CgrShn`
- Yetişkinlere yönelik içerik (Mature content): İşaretlenmez.

## 3. Gizlilik (Privacy)

**Tek amaç açıklaması** (Single purpose description):

```
This extension has a single purpose: it shows UYAP Document Editor files (.udf, the document format of Türkiye's National Judiciary Informatics System) inside the built-in file preview window of Google Drive (drive.google.com) and Gmail (mail.google.com), so that the user can read, print or save them as PDF without first saving the file to the computer. Drive and Gmail cannot preview .udf files on their own.
```

Türkçesi: Tek amacı, UYAP Doküman Editörü'nün `.udf` belgelerini Google Drive'ın ve Gmail'in kendi ön izleme penceresinde
göstermek, böylece belgenin bilgisayara kaydedilmeden okunmasını, yazdırılmasını ya da PDF olarak kaydedilmesini
sağlamaktır.

**İzinler:** Manifest'te `permissions` yok, API izni gerekçesi istenmez.

**Ana makine izni gerekçesi** (Host permission justification): `host_permissions`'taki
`drive.usercontent.google.com` ile içerik betiğinin çalıştığı `drive.google.com` ve `mail.google.com` için. Kutu en
çok 1000 karakter alır (Google sınırı yazmıyor, panodaki sayaç).

```
drive.google.com (/drive/, /file/ pages): to detect a .udf file in Drive's preview and show it in that window. Read: the previewed file's ID, name and type, the account index (or email if in the URL), the share link's resourcekey and, on /file/ pages, the tab title. Drive's Comment button (unusable for .udf) is hidden while the document is shown.
mail.google.com (/mail/ pages): the same for .udf attachments and Drive files in Gmail's preview. Read: the previewed file's name, the clicked attachment card, that email's attachment names and download links, the account index in the URL, and whether a clicked link is a Drive file link (then its ID and resourcekey). Never email text, subject, sender or recipients. A clicked .udf card is pre-downloaded in the page with the user's session and discarded within 15 s if no preview opens.
drive.usercontent.google.com: to download the opened .udf file with the user's Drive account.
Files stay in the browser, never stored or sent elsewhere.
```

Türkçesi: Drive'da ön izlemedeki dosyanın `.udf` olup olmadığını anlamak ve belgeyi o pencerede göstermek için (yalnız
dosyanın kimliği, adı, türü, hesap sırası ya da adreste yazılıysa e-posta adresi, paylaşım bağlantısının erişim
anahtarı ve dosya sayfasında sekme başlığı okunur, UDF'de işlemeyen Yorum düğmesi belge açıkken gizlenir). Gmail'de
aynısı ek ön izlemesi ve e-postadaki Drive dosyaları için (yalnız ön izlemedeki dosyanın adı, basılan ek kartı, yalnız o
kartın e-postasındaki eklerin adları ve indirme bağlantıları ve Gmail adresindeki hesap sırası okunur. Basılan bir
bağlantının Drive dosyası bağlantısı olup olmadığına bakılır, öyleyse dosya kimliği ve erişim anahtarı alınır.
E-postanın metni, konusu, göndereni ve alıcıları okunmaz. Karta basılınca ek, çabuk açılsın diye Gmail sayfasının
içinden kullanıcının oturumuyla indirilmeye başlar, ön izleme açılmazsa en geç 15 saniyede atılır).
`drive.usercontent.google.com`: Açılan dosyayı kullanıcının Drive hesabıyla indirmek için. Dosyalar yalnız tarayıcıda
gösterilir, saklanmaz, başka yere gönderilmez.

**Uzaktan kod** (Remote code): Hayır, uzaktan kod kullanmıyorum. Bütün kod pakette, dışarıdan betik yüklenmez.

**Veri kullanımı** (Data usage): Eklenti dosyaları ve e-posta eklerini yalnız tarayıcıda işlese de mağazanın kullanıcı
verisi SSS'si yerel işlemeyi de beyan ister (SSS 3 ve 14: "even when data is processed or stored locally"). İşaretlenecek
türler:

- Kimliği tanımlayabilecek bilgiler (Personally identifiable information): Drive'ın adresinde yazılıysa hesabın e-posta
  adresi okunur.
- Kişisel iletişimler (Personal communications): Gmail'deki `.udf` ekleri indirilip gösterilir.
- Kullanıcı etkinliği (User activity): Gmail'de hangi ek kartına ya da Drive bağlantısına basıldığı okunur (mağazanın
  tanımı tıklamaları sayar).
- Web sitesi içeriği (Website content): Drive'daki ve Gmail'deki `.udf` dosyaları, dosya adları, indirme bağlantıları ve
  dosya sayfasında sekme başlığı.

Öbür türler işaretlenmez. Web geçmişi (Web history) değil: Eklenti ziyaret listesi tutmaz, yalnız üzerinde çalıştığı
sayfanın adresini ve başlığını dosyayı tanımak için okur. Kimlik doğrulama bilgileri (Authentication information) değil:
`resourcekey` paylaşım bağlantısının parçasıdır, parola ya da kimlik bilgisi değildir, çerezler okunmaz. Alttaki üç
beyanın üçü de işaretlenir (verileri üçüncü taraflara satmama, eklentinin tek amacı dışında kullanmama ya da aktarmama,
kredi değerlendirmesi ya da borç verme için kullanmama).

**Gizlilik politikası URL'si** (Privacy policy URL): `https://csahin.com.tr/udf-on-izleme/#veri-gizli%C4%9Fi` (çapadaki
"ğ" yüzde kodlu, panonun adres denetimi ASCII dışı harfe takılmasın). Sayfa README'nin Veri gizliliği bölümünü
gösterir. README değişince site de yenilenir: Gizlilik politikası güncel olmalı. Bölümün sonunda Sınırlı Kullanım
(Limited Use) beyanı durur.

## 4. Dağıtım (Distribution)

- Ödeme (Payments): Ücretsiz.
- Görünürlük (Visibility): Kullanıcının seçimi. Herkese açık (Public), Liste dışı (Unlisted, yalnız bağlantıyı bilen
  kurar) ya da Özel (Private, yalnız seçilen kişiler).
- Bölgeler (Regions): Kullanıcının seçimi (Tüm bölgeler ya da Türkiye).

## 5. Test talimatları (Test instructions)

Kullanıcı adı ve parola alanları boş kalır. "Ek talimatlar" (Additional instructions) kutusu en çok 500 karakter alır
(panodaki sayaç).

```
No login needed for the extension, any Google account works. UI is in Turkish.
Sample: https://github.com/SCgrS/UDF-On-Izleme/raw/main/testler/ornekler/dilekce.udf
1. Install, then reload open Drive and Gmail tabs.
2. Upload the sample to Drive and double-click it (without the extension: "No preview available"). It opens in Drive's preview with e-signature badge, notes, zoom and "Yazdır / PDF" (Print).
3. Gmail: email the sample to yourself, open the email and click the attachment card in it.
```

Türkçesi: Eklentinin kendisi için giriş bilgisi gerekmez, bir Google hesabı yeter. Örnek dosya depodaki yapay
`dilekce.udf` (bir not ve e-imza dosyası var). Kurduktan sonra açık sekmeler yenilenir, Drive'da dosyaya çift tıklanır
(eklentisiz Drive "No preview available" der), Gmail'de e-posta açılıp içindeki ek kartına basılır. Gelen kutusu
listesindeki ek düğmesi bilerek desteklenmez, orada Gmail'in kendi kartı kalır.

## Notlar

- Mağazadan kurulan eklentinin kimliği paketlenmemiş kopyanınkinden (`fbbjliipglhijllpnhihgohanaajlifi`) farklıdır.
  Mağaza sürümü kurulunca paketlenmemiş kopya `chrome://extensions`'tan kaldırılır. İkisi birlikte açık kalırsa ikisi de
  Drive'ın ve Gmail'in penceresine belge gömmeye çalışır.
- Adda Google markası geçmez. Google Drive ve Gmail yalnız özet ve açıklamada, eklentinin nerede çalıştığını anlatmak için
  anılır. Açıklamanın sonu eklentinin bağımsız olduğunu söyler. Simgede Google'ın logoları kopyalanmaz.
- Mağaza bağlantısı belli olunca README'nin başındaki "Chrome Web Mağazası'ndan ekle" bölümüne konur.
