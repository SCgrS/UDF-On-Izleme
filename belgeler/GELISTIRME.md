# Geliştirme

Eklentinin dosyaları deponun kökünde durur: GitHub'ın yeşil Code →
Download ZIP'i çıkarılınca klasör doğrudan Chrome'a yüklenebilsin (kullanıcı isteği, UYAP Haciz Yardımcısı'ndaki gibi).
Hangi kök öğelerin eklentiye ait olduğu `araclar/paketle.mjs` `EKLENTI_OGELERI`'nde yazılı. Sürüm ve mağaza zip'ine yalnız
onlar girer. Köke yeni bir eklenti dosyası eklenince listeye de eklenir (`npm test` denetler). Sınama araçları geçici
kopya için `eklentiyiKopyala()` kullanır.

- `npm install`, ardından `npm test`: Birim testleri. Testler yapay örneklerle çalışır (`araclar/ornek-uret.mjs`).
- `node araclar/chrome-sina.mjs drive`: Görünmez Chrome'da sahte Drive sayfasıyla uçtan uca sınama (Drive'ın
  görüntüleyicisine gömme, Esc, oklar ve boşluğa tıklama, yazdırma, yakınlaştırma, alttaki çubuğun dengesi, not
  bölmesi, e-imza rozeti, paylaşım bağlantısı, izin hatası, büyük görünüm, "Yeniden dene" gömülü görünümde ve sekmede,
  yenilenen sekmede kaydın olmaması, sekmenin başlığı, eklenti simgesi, üçüncü taraf çerezleri kapalıyken indirme, Drive'ın
  ana alanı yeniden çizmesi, "Yorum" düğmesinin gizlenmesi, gölge kökü eklenemeyen ana alan). Dosya
  bir kez istenir, service worker onu görüntüleyici yüklenirken indirmeye başlar, o başaramazsa görüntüleyici kendisi
  indirir, ikisi de yalnız sayfanın hesap sırasıyla. Eklentinin sayfalarında (sekmeler, gömülü çerçeveler, service worker)
  CSP ihlali olmadığı da denetlenir (`cdp.mjs` `cspIzle`). Chrome'da Dark Reader kuruluysa onunla ayrı bir oturum da
  çalışır. Kurulu değilse atlanır, `DARK_READER_YOLU` ortam değişkeniyle paketlenmemiş bir Dark Reader klasörü de
  verilebilir (var olmayan bir klasör verilirse Chrome profiline bakılmaz, oturum atlanır).
- `node araclar/chrome-sina.mjs gmail`: Görünmez Chrome'da sahte Gmail sayfasıyla uçtan uca sınama (`araclar/sahte-gmail.mjs`).
  Sahte sayfa Gmail'in ek ön izlemesinin 2026-10-26'da gerçek Gmail'de ölçülen yapısını taklit eder: Bir konuda üç ileti,
  aynı adlı ekler, PDF, izin verilmeyen bir ek ve 2 MB'tan büyük bir ek. Ek kartına tıklayınca belgenin ön izlemeye
  gömülmesi (çubuğun altında, Gmail'in "Önizleme yok" kartı gizli), yükleme yazısı, çerçevenin içinden oklar ve Esc, aynı
  adlı eklerin her birinin kendi içeriği, öbür iletideki aynı adlı ek, 403 hatası, Ctrl+P, not bölmesinin sağdaki okla
  çakışmaması, geçici hatadan sonra "Yeniden dene" (gömülü görünümde ve sekmede), yapı tanınmazsa "UDF olarak aç" ve
  yenilenen sekmede kaydın olmaması sınanır. Ayrıca: Gmail'in ana alanı yeniden çizmesi (belge yeniden yüklenmez), "Yazdır /
  PDF" düğmesi ve baskı görünümü, dar pencerede daralan not bölmesi. Gmail ana alanları çerçeve
  gösterilirken ekleyince sağ okla geçilen yedi ekin her biri kendi içeriğini gösterir ve belge yeniden yüklenmez. Büyük
  ek içerik betiğinden arka plana 1 MB'lık üç dilimle aktarılır ve bir kez istenir. Gelen kutusu listesindeki ek düğmesi
  gibi kartsız açılan ön izlemede (bir kart tıklamasından hemen sonra da) belge gömülmez, ek istenmez. Ön izleme açıkken
  yenilenen sayfada (adreste `?projector=`) tıklamasız açılan ilk ön izlemede adı sayfada tek olan ek gömülür, sonrakilerde
  tahmin yapılmaz. Sahte sunucu ek isteklerinin kökenini ve çerezlerini kaydeder: Ekin Gmail sekmesindeki içerik
  betiğinden birinci taraf (aynı köken, çerezli) indirildiği, kart basılınca çerçeve eklenmeden istendiği, açılışta bir kez
  istendiği, sayfanın ürettiği (güvenilmeyen) fare ve tuş olaylarında istenmediği denetlenir. Eklentinin sayfalarında CSP
  ihlali olmadığı da denetlenir. Üçüncü taraf çerezleri kapalı bir oturum ve Dark Reader kuruluysa onunla bir oturum da
  çalışır.
- Gömülü belgenin çerçevesi Google'ın ana alanının gölge kökündedir (`DRIVE-TEKNIGI.md` §14). Sınama ifadeleri çerçeveyi
  `araclar/cdp.mjs`'teki `CERCEVE` ve `CERCEVE_ODAKTA` ile bulur, `document.querySelector` onu görmez.
- `node araclar/chrome-sina.mjs hiz [tekrar] [--eklenti <klasör>] [--json <dosya>] [--buyuk]`: Açılış hızı. Sahte Gmail ve
  sahte Drive'da gerçekçi ağ gecikmeleriyle (Gmail eki ~500 ms, Drive indirmesi 400 ms) küçük bir dilekçe ve resimli antetli
  ağır bir belge açılır, her aşamanın tıklamadan sonraki süresi (ortanca) service worker soğukken ve sıcakken yazılır.
  `--eklenti` başka bir kopyayı (ör. değişiklikten önceki kodu) yükler, `--buyuk` 5 MB'lık belgeyi de ekler. Ayrıntı ve ölçümler
  `DRIVE-TEKNIGI.md` §12'de.
- `node araclar/chrome-sina.mjs paket [zip]`: Kullanıcıya verilen zip (varsayılan `cikti/UDF-On-Izleme.zip`)
  Windows'un "Tümünü ayıkla"sı gibi çıkarılıp temiz Chrome'a yüklenir, örnek belge çizilir, konsol hatası ve CSP ihlali
  sayılır.
- `node araclar/chrome-sina.mjs github`: GitHub'ın Code → Download ZIP'i (HEAD, ön ek `UDF-On-Izleme-main/`)
  çıkarılıp temiz Chrome'a doğrudan yüklenir mi (kimlik sabit, dıştaki klasör "manifest eksik" verir, örnek belge çizilir).
- `node araclar/chrome-sina.mjs gercek`: Gerçek Drive'ın görüntüleyicisinde gömme denemesi (internet gerekir, herkese
  açık örnek klasör, oturum açılmaz, `.txt` dosyaları UDF sayılır). 2026-10-27'den beri çalışmıyor: Oturumsuz Drive'ın
  görüntüleyicisi bir iframe'de açılıyor (`DRIVE-TEKNIGI.md` §14). Aynı klasörü kullanan `tanitim-gorselleri.mjs` de öyle.
- `node araclar/chrome-sina.mjs gorsel <klasör> <çıktı>`: Klasördeki `.udf` dosyalarını görüntüleyicide açar, ekran
  görüntüsü ve PDF üretir, konsol hatalarını ve CSP ihlallerini sayar. Gerçek belgelerle çalışırken çıktı klasörünü depo
  dışında tutun.
- `node araclar/tanitim-gorselleri.mjs`: README'deki ekran görüntülerini (`belgeler/gorseller/`) yeniden üretir. Gerçek
  Drive'ın görüntüleyicisinde iki yapay dilekçe gösterir (internet gerekir, oturum açılmaz, herkese açık örnek klasör,
  tam ekran 1920×1200, 2 kat yoğunlukta çekilip küçültülür). Görüntüdeki dosya adları da yapaydır. Ardından
  `node araclar/magaza-gorselleri.mjs`: Chrome Web Mağazası görselleri (`belgeler/magaza/`, metinler `belgeler/MAGAZA.md`).
- `node araclar/simge-uret.mjs`: Simgeleri (`simgeler/`) SVG'den yeniden üretir.
- `node araclar/paketle.mjs`: `cikti/UDF-On-Izleme.zip`. `--magaza` ile Chrome Web Mağazası paketi (manifest'te
  `key` yok, mağazadan kurulan eklentinin kimliği farklıdır). `v<sürüm>` etiketi gönderilince GitHub Actions sürümü
  yayımlar (etiket `manifest.json`'daki sürümle aynı olmalı).
- Sürüm notları `DEGISIKLIKLER.md`'de. Biçim kuralları ve araştırma notları `belgeler/` altında (Drive'a gömme:
  `DRIVE-TEKNIGI.md`).

## Bilinen sınırların ayrıntısı

README kısa tutulur. Yazdırmayla ilgili ayrıntılar:
- Yazdırırken metinden oluşan üst bilgi her sayfaya basılır. Resimli üst bilgi yalnız bölümün ilk sayfasına basılır.
  "2. sayfadan itibaren" dışındaki sayfa aralıkları (ör. 3. sayfadan itibaren) ve 1'den başlamayan sayfa numarası
  kâğıda tam uymaz (Chrome `@page :nth()` desteklemiyor).
- Belgenin arka plan resminin (filigran) kenar boşluklarına düşen kısmı, yazdırma penceresinde "Arka plan grafikleri"
  seçiliyse basılır.
- Sayfa numaralı alt bilgi ve kenar kutuları Chrome 131 ve sonrasında basılır.
- Büyük görünümde (yeni sekme) "PDF olarak kaydet" "UDF Ön İzleme" adını önerir: Belgenin adı sekme başlığına hiç konmaz
  (tarayıcı geçmişine, sekme kaydına ve pencere başlığına düşmesin).
- Büyük görünüm sekmesi yenilenince (F5) belge yeniden açılmaz: Belgenin kaydı saklanmaz, sekme açılırken bir kez alınır.
- Drive'ın ya da Gmail'in içinde gösterilen belgede klavyenin oklarla gezinmesi, belge yana kaydırılabiliyorsa (çok
  büyütülmüşse) çalışmaz. Ekrandaki oklar her zaman çalışır.
- Gizlilik ayrıntısı (`DRIVE-TEKNIGI.md` §13):
  - Eklentinin izni yok, hiçbir şey saklamaz (`chrome.storage`, `localStorage` ve benzeri kullanılmaz, `npm test`
    denetler). Simgenin eylemi yok (açılır pencere ve tıklama işlevi yok), geliştiricinin X sayfası `homepage_url`'de, sağ
    tıkta en üstteki eklenti adında.
  - İçerik betiği yalnız `drive.google.com/drive/*`, `drive.google.com/file/*` ve `mail.google.com/mail/*` sayfalarında
    çalışır. Gömülü sayfa (`web_accessible_resources`) ve `frame-ancestors` kökene göre iki siteye açıktır.
  - Belgenin kaydı (Drive: Kimlik, ad, hesap sırası, kaynak anahtarı. Gmail: Ad, ek bilgisi, sekme) service worker'ın
    belleğinde rastgele anahtarla durur, görüntüleyici onu bir kez alır (`kayit-al`). Alınmayan kayıt 60 sn sonra silinir,
    en çok beşi durur. Görüntüleyici aldığı kaydı yeniden denerken geri gönderir, service worker yeniden doğrular.
  - Görüntüleyicinin CSP'si `default-src 'none'`, yalnız eklentinin kendi betikleri, stilleri ve resimleri (`blob:` dâhil)
    ve `drive.usercontent.google.com`'a bağlantı açık. Gömülü sayfa yalnız `drive.google.com` ve `mail.google.com`
    çerçevesinde açılır, adresi oturumluk, belgeyi rastgele anahtarla açar.
  - Drive dosyası yalnız sayfanın hesabıyla indirilir (hesap sırası bilinmiyorsa hesapsız istek, yani varsayılan hesap). Gmail ekini görüntüleyici değil, Gmail
    sekmesindeki içerik betiği Gmail'in kendi kökeninden indirir. Ek, .udf kartına basılınca (ön izleme açılmadan önce)
    indirilmeye başlar, yalnız kullanıcının gerçek tıklaması ya da tuşuyla.
  - Baytlar service worker'da ve içerik betiğinde son dilime ya da en çok 15 sn tutulur, bırakılırken sıfırlanır. Dosya
    adı adrese ve sekme başlığına konmaz.
