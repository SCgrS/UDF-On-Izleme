# Chrome Web Mağazası metinleri ve görselleri

Mağaza panosundaki (Chrome Web Store Developer Dashboard) alanlara kopyalanacak metinler. Paket:
`node araclar/paketle.mjs --magaza` (manifest'te `key` yok, mağaza kabul etmiyor). Görseller `belgeler/magaza/`
(`node araclar/tanitim-gorselleri.mjs`, ardından `node araclar/magaza-gorselleri.mjs`).

## 1. Paket (Package)

- Dosya: `UDF-On-Izleme-<sürüm>-magaza.zip`

## 2. Mağaza girişi (Store listing)

**Ad** (manifest'ten gelir, 13/75 karakter): UDF Ön İzleme

**Özet** (manifest'ten gelir, 125/132 karakter):
Google Drive ve Gmail’deki UYAP .udf belgelerini Google’ın ön izlemesinde açar, sunucuya göndermez. Geliştirici: x.com/CgrShn

**Açıklama** (Description):

```
Google Drive'daki ve Gmail'deki UYAP Doküman Editörü (.udf) belgelerini, PDF'ler gibi Google'ın kendi ön izleme penceresinde açar. Drive bu dosyaları "sıkıştırılmış arşiv" sanıp içeriğini göstermez, Gmail ise "Önizleme yok" der. Eklenti kuruluyken Drive'da .udf dosyasına çift tıklamanız, Gmail'de .udf ekine tıklamanız yeter.

Eklenti yalnız Google Drive (drive.google.com) ve Gmail (mail.google.com) sitelerinde çalışır. Başka sitelere karışmaz.

NELER YAPAR
• Belge, Drive'ın ya da Gmail'in ön izleme penceresinde UYAP Doküman Editörü'ndeki görünümüne yakın biçimde açılır: Başlıklar, tablolar, numaralı listeler, üst ve alt bilgiler, sayfa numaraları ve resimler.
• Drive'da oklarla öbür dosyalara, Gmail'de e-postanın öbür eklerine geçilir. Esc ile ya da belgenin dışına tıklayarak kapatılır.
• Yazdır / PDF: Belgeyi yazdırın ya da PDF olarak kaydedin (Ctrl+P).
• Yakınlaştırma: −, +. Yüzdeye basınca sayfa pencereye sığar.
• Notlar: Belgeye Editör'de eklenmiş notlar yan bölmede listelenir. Bir nota basınca işaretlediği yere gidilir.
• E-imza: Belgede e-imza dosyası varsa "E-imzalıdır" yazar. Belge içeriği imzalanan içerikle uyuşmuyorsa uyarır. (İmza ve sertifika doğrulanmaz.)
• Ayarı ve açılır penceresi yoktur, kurunca çalışır. Simgeye sağ tıklayınca en üstteki eklenti adı geliştiricinin X sayfasını açar. Kapatmak için chrome://extensions sayfası kullanılır.

GİZLİLİK
Belgeleriniz hiçbir yere gönderilmez. Eklenti belgeyi yalnız Google'dan, kendi oturumunuzla alır ve yalnız tarayıcınızda gösterir. Drive'da yalnız ön izlemedeki dosyanın kimliğini, adını ve türünü, açık hesabın sırasını, paylaşım bağlantısının erişim anahtarını ve dosya sayfasında sekme başlığını okur. Gmail'de yalnız ön izlemedeki dosyanın adını, açık e-postadaki ek kartlarının indirme bağlantılarını ve hangi karta bastığınızı okur. E-postaların metnine, konusuna ya da kişilere bakmaz. Bir .udf ekinin kartına basınca ek, belge çabuk açılsın diye Gmail sayfasının içinden indirilmeye başlar. Eklenti hiçbir şey saklamaz, hiçbir bilgi toplamaz, bir sunucusu da yoktur.

Bu eklenti bağımsızdır. Google, Google Drive, Gmail ya da UYAP ile bağlantılı değildir.
```

**Kategori:** Verimlilik › Araçlar (Productivity › Tools)

**Dil:** Türkçe

**Görseller** (`belgeler/magaza/`):

| Alan | Dosya | Boyut |
|---|---|---|
| Mağaza simgesi | `simge-128.png` | 128×128 |
| Ekran görüntüleri (sırayla) | `ekran-1-belge.png`, `ekran-2-notlar.png`, `ekran-3-cubuk.png` | 1280×800 |
| Küçük tanıtım kutusu | `tanitim-kucuk-440x280.png` | 440×280 |

Görüntülerdeki belge, kişi ve dosya adları örnektir (yapay dilekçe). Ekran görüntüleri Drive'da çekildi. Gmail'de
çekilmiş görüntü yok: Gerçek bir posta kutusu kullanılmadı.

**Ek alanlar:** Resmî web sitesi ve destek adresi isteğe bağlı (depo gizliyken GitHub bağlantısı verilmez,
destek için `https://x.com/CgrShn` yazılabilir). Yetişkinlere yönelik içerik: Hayır.

## 3. Gizlilik uygulamaları (Privacy practices)

**Tek amaç** (Single purpose):

```
Google Drive'daki ve Gmail'deki UYAP .udf belgelerini Google'ın kendi ön izleme penceresinde görüntülemek, yazdırmak ve PDF olarak kaydetmek.
```

**İzinler:** Manifest'te `permissions` yok (izin gerekçesi istenmez). Simgenin açılır penceresi ve tıklama işlevi yoktur,
geliştiricinin X sayfası manifest'in `author` ve `homepage_url` alanlarındadır.

**Ana makine izinlerinin gerekçesi** (Host permission justification: `host_permissions`'taki
drive.usercontent.google.com ile içerik betiğinin çalıştığı drive.google.com ve mail.google.com):

```
drive.google.com (yalnız /drive/ ve /file/ sayfaları): Drive'ın ön izleme penceresinde açık olan dosyanın .udf olup olmadığını anlamak ve belgeyi o pencerenin içinde göstermek için. Yalnız ön izlemedeki dosyanın kimliği, adı ve türü, Drive'da açık hesabın sırası, paylaşım bağlantısının erişim anahtarı (resourcekey) ve dosya sayfasında sekmenin başlığı okunur. Sayfanın başka içeriği okunmaz.
mail.google.com (yalnız /mail/ sayfaları): Gmail'in ek ön izleme penceresinde açık olan ekin .udf olup olmadığını anlamak ve belgeyi o pencerenin içinde göstermek için. Yalnız ön izleme penceresindeki dosyanın adı, açık e-postadaki ek kartlarının indirme bağlantıları ve kullanıcının hangi ek kartına bastığı okunur (e-postadaki bir Drive bağlantısı bu pencerede açılırsa o dosyanın Drive bilgileri). E-postaların metni, konusu, gönderen ve alıcılar okunmaz. Kullanıcı bir .udf ekinin kartına basınca ek, Gmail sayfasının içinden kullanıcının kendi oturumuyla indirilmeye başlar ve yalnız tarayıcının içinde gösterilir. Ön izleme açılmazsa 15 saniye sonra bellekten silinir. Başka hiçbir adrese gönderilmez. Eklenti e-posta göndermez, silmez ya da değiştirmez.
drive.usercontent.google.com: Kullanıcının açtığı .udf dosyasını Drive'ın indirme adresinden, kullanıcının Drive'da açık olan hesabıyla almak için. Dosya yalnız tarayıcının içinde gösterilir. Başka hiçbir adrese gönderilmez.
```

**Uzaktan kod** (Remote code): Hayır, uzaktan kod kullanmıyorum. (Bütün kod pakette, dışarıdan betik yüklenmez.)

**Veri kullanımı** (Data usage): Hiçbir veri türünü işaretlemeyin. Eklenti kullanıcı verisi toplamaz, saklamaz ya da
iletmez: Drive dosyası da Gmail eki de yalnız Google'dan alınır ve yalnız kullanıcının tarayıcısında işlenir, cihazdan
Google dışında bir yere gönderilmez. Alttaki üç beyanın üçünü de işaretleyin (verileri satmıyorum / amaç dışı
kullanmıyorum / kredi değerlendirmesi için kullanmıyorum).

**Gizlilik politikası adresi:** Veri toplanmadığı için genellikle istenmez. İstenirse aşağıdaki metin bir sayfada
yayımlanıp adresi verilir:

```
UDF Ön İzleme gizlilik politikası

UDF Ön İzleme hiçbir kişisel veri toplamaz, saklamaz ya da üçüncü taraflarla paylaşmaz. Eklentinin bir sunucusu yoktur. Belgeler geliştiriciye ya da Google dışında başka bir sunucuya gönderilmez, yalnız tarayıcınızın içinde gösterilir.

Okunan bilgiler: Google Drive'da yalnız ön izleme penceresindeki dosyanın kimliği, adı ve türü, Drive'da açık olan hesabın sırası, paylaşım bağlantısının erişim anahtarı ve dosya sayfasında sekmenin başlığı. Gmail'de yalnız ön izleme penceresindeki dosyanın adı, açık e-postadaki ek kartlarının indirme bağlantıları ve hangi ek kartına bastığınız (e-postadaki bir Drive bağlantısı bu pencerede açılırsa o dosyanın Drive bilgileri). E-postaların metnine, konusuna ya da kişilere bakılmaz.

İndirme: Drive'da açtığınız .udf belgesi Drive'dan, Drive'da açık olan hesabınızla indirilir. Gmail'de bir .udf ekinin kartına bastığınızda ek, Gmail sayfasının içinden kendi oturumunuzla indirilmeye başlar. Ön izleme açılmazsa 15 saniye sonra bellekten silinir.

Saklama: Eklentinin ayarı, geçmişi ya da kaydı yoktur, tarayıcının deposunu kullanmaz. Açılan belgenin bilgisi ve baytları yalnız belge açılırken bellekte durur ve en geç bir dakikada silinir. Belgenin adı sekme başlığına ve adrese konmaz. Reklam, izleme ya da kullanım istatistiği yoktur.

Eklentinin ayarı ve açılır penceresi yoktur. Eklentiyi kapatmak için chrome://extensions sayfası kullanılır.

İletişim: https://x.com/CgrShn
```

## 4. Dağıtım

Görünürlük kullanıcının seçimi: Herkese açık ya da Liste dışı (yalnız bağlantıyı bilenler). Bölge: Tüm bölgeler ya da
Türkiye.

## Notlar

- Mağazadan kurulan eklentinin kimliği paketlenmemiş kopyanınkinden (`fbbjliipglhijllpnhihgohanaajlifi`) farklıdır.
  Mağaza sürümü kurulunca paketlenmemiş kopya `chrome://extensions`'tan kaldırılır. İkisi birlikte açık kalırsa ikisi de
  Drive'ın ve Gmail'in penceresine belge gömmeye çalışır.
- Adda Google markası geçmez. Google Drive ve Gmail yalnız özet ve açıklamada, eklentinin nerede çalıştığını anlatmak için
  anılır. Açıklamanın son cümlesi eklentinin bağımsız olduğunu söyler. Simgede Google'ın logoları kopyalanmaz.
