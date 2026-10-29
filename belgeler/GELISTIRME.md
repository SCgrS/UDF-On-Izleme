# Geliştirme

Eklentinin dosyaları deponun kökünde durur: GitHub'ın yeşil Code →
Download ZIP'i çıkarılınca klasör doğrudan Chrome'a yüklenebilsin (kullanıcı isteği, UYAP Haciz Yardımcısı'ndaki gibi).
Hangi kök öğelerin eklentiye ait olduğu `araclar/paketle.mjs` `EKLENTI_OGELERI`'nde yazılı. Sürüm ve mağaza zip'ine yalnız
onlar girer. Köke yeni bir eklenti dosyası eklenince listeye de eklenir (`npm test` denetler). Sınama araçları geçici
kopya için `eklentiyiKopyala()` kullanır.

Pakete ve sınama kopyasına bu öğelerin altında yalnız git'in izlediği dosyalar girer (`git ls-files`). Diskte duran git
dışı dosya girmez, paketleyici onu "pakete girmedi (git'in izlemediği)" diye yazar. Yeni bir eklenti dosyası `git add`
yapılmadan pakete girmez. Git'e hiç eklenmemiş bir öğe, diskte olmayan izlenen dosya ve git deposu olmayan klasör açık hata
verir. Bu yüzden `npm test`'in paket testleri Code → Download ZIP'ten çıkarılan klasörde çalışmaz.

- `npm install`, ardından `npm test`: Birim testleri (145 test, `testler/*.test.mjs`). Testler yapay örneklerle çalışır
  (`araclar/ornek-uret.mjs`, `testler/ornekler/`).
  - `motor.test.mjs`: Belge okuma ve çizim (stiller, listeler, sekmeler, tablolar, resimler, e-imza durumları, iptal,
    yazdırma CSS'i). `motor-sinir.test.mjs`: Zip sınırları (zip bombası, girdi sayısı, CRC-32, şifreli girdi, ZIP64, çok
    parçalı arşiv), yerel başlıkların denetimi, şablon ve not metninin sınırları, uzun girdide süre. `inceleme.test.mjs`:
    Blok, bölüm ve parça sınırları, kesilme notu ve kâğıda basılan "Eksik baskı" kutusu.
  - `icerik.test.mjs`: İçerik betiği jsdom'da, sahte `chrome.runtime` ve sahte saatle (Drive'da gömme, Yorum düğmesi,
    yeniden gömme sınırı, "UDF olarak aç", çerçeveden ve arka plandan gelen iletilerin süzgeçleri, Gmail'de ön indirme,
    dilimler, indirmelerin kesilmesi ve bayt kayıtları, ön izlemenin açılış ve kapanışı, bilgi öğesinin doğrulanması).
    Kullanıcının gerçek girişi jsdom'un iç gönderimiyle taklit edilir (`jsdom/lib/jsdom/living/generated/utils.js`):
    jsdom sürümü değişirse bu yardımcıya bakılmalı. Gölge kökündeki iframe'e jsdom pencere kurmadığı için sınama belgedeki
    bir iframe'in penceresini verir.
  - `gomulu.test.mjs`: Görüntüleyici sayfası jsdom'da (manifest, CSP, izin ve depo kullanımı, e-imza rozetleri, çubuğun
    kısa ve sıkışık düzeni, art arda açılan belgelerin yarışı). `arkaplan.test.mjs`: Service worker (kayıtlar, Drive ön
    indirmesi ve kesilmesi, dilimler, hesap biçimi). `indir.test.mjs`: Drive ve Gmail indirmesi, hata iletileri, kesilen
    ve yarıda kalan indirme. `drive.test.mjs`, `gmail.test.mjs`: Kimlik, hesap, ek bulma. `paketle.test.mjs`: Paket ve
    manifest alanları, sürüm notu, iş akışlarının yetkileri, `yerel-sina.mjs`'in çıktısı. `belgeler.test.mjs`:
    README'deki, sürüm notundaki ve mağaza metnindeki e-imza rozeti yazıları, gizlilik metnindeki süreler, bilinen
    sınırlar (kesilme notunun nedenleri, notun vurgusu) ve Gmail'in bilgi öğesine güven koşulları koda uyar, belgelerde
    ve kodda kullanılmayan adlar ve eklentide olmayan seçenekler geçmez. Kod yorumları tarihsiz ve kaydırılmış, test
    adlarında iki noktadan sonraki söz büyük harfle başlar.
  - jsdom çok çocuklu bir XML öğesinin çocuklarını karesel sürede dolaşır (10.000 çocuk birkaç saniye, Chrome'da
    doğrusal). Büyük sınır testleri bu yüzden yaprakları 100'lük sarmalayıcılara böler.
- `node araclar/chrome-sina.mjs drive`: Görünmez Chrome'da sahte Drive sayfasıyla uçtan uca sınama (Drive'ın
  görüntüleyicisine gömme, Esc, oklar ve boşluğa tıklama, yazdırma, yakınlaştırma, alttaki çubuğun dengesi ve düğmeleri,
  not bölmesi, e-imza rozetleri, e-imzası içerikle karşılaştırılamayan belgede nötr rozet (genişte uzun, darda kısa
  yazı, yakınlaştırma ortada), paylaşım bağlantısı, izin hatası, büyük görünüm, "Yeniden dene" gömülü görünümde ve
  sekmede, yenilenen sekmede kaydın olmaması, sekmenin başlığı, eklentinin bilgileri ve izinleri, üçüncü taraf çerezleri
  kapalıyken indirme, Drive'ın ana alanı yeniden çizmesi, "Yorum" düğmesinin gizlenmesi, gölge kökü eklenemeyen ana
  alan). Dosya bir kez istenir, service worker onu görüntüleyici yüklenirken indirmeye başlar, o başaramazsa
  görüntüleyici kendisi indirir, ikisi de yalnız sayfanın hesabıyla. Eklentinin sayfalarında (sekmeler, gömülü
  çerçeveler, service worker) CSP ihlali olmadığı da denetlenir (`cdp.mjs` `cspIzle`). Chrome'da Dark Reader kuruluysa
  onunla ayrı bir oturum da çalışır. Kurulu değilse atlanır, `DARK_READER_YOLU` ortam değişkeniyle paketlenmemiş bir
  Dark Reader klasörü de verilebilir (var olmayan bir klasör verilirse Chrome profiline bakılmaz, oturum atlanır).
- `node araclar/chrome-sina.mjs gmail`: Görünmez Chrome'da sahte Gmail sayfasıyla uçtan uca sınama
  (`araclar/sahte-gmail.mjs`). Sahte sayfa Gmail'in ek ön izlemesinin 2026-10-26'da gerçek Gmail'de ölçülen yapısını
  taklit eder: Bir konuda üç ileti, aynı adlı ekler, PDF, izin verilmeyen bir ek ve 2 MB'tan büyük bir ek. Ek kartına
  tıklayınca belgenin ön izlemeye gömülmesi (çubuğun altında, Gmail'in "Önizleme yok" kartı gizli), yükleme yazısı,
  çerçevenin içinden oklar ve Esc, aynı adlı eklerin her birinin kendi içeriği, öbür iletideki aynı adlı ek, 403 hatası,
  Ctrl+P, not bölmesinin sağdaki okla çakışmaması, geçici hatadan sonra "Yeniden dene" (gömülü görünümde ve sekmede),
  yapı tanınmazsa "UDF olarak aç" ve yenilenen sekmede kaydın olmaması sınanır. Ayrıca: Gmail'in ana alanı yeniden
  çizmesi (belge yeniden yüklenmez), "Yazdır / PDF" düğmesi ve baskı görünümü, dar pencerede daralan not bölmesi. Gmail
  ana alanları çerçeve gösterilirken ekleyince sağ okla geçilen yedi ekin her biri kendi içeriğini gösterir ve belge
  yeniden yüklenmez. Büyük ek içerik betiğinden arka plana 1 MB'lık üç dilimle aktarılır ve bir kez istenir. Gelen
  kutusu listesindeki ek düğmesi gibi kartsız açılan ön izlemede (bir kart tıklamasından hemen sonra da) belge gömülmez,
  ek istenmez. Ön izleme açıkken yenilenen sayfada (adreste `?projector=`) tıklamasız açılan ön izlemede de belge gömülmez,
  ek istenmez. Ön izleme kapanır kapanmaz başka iletinin aynı adlı ekine basılınca
  o ekin belgesi gömülür (G17), 150 ms dolmadan listedeki düğmeyle açılan ön izleme kapanan ön izlemenin tıklamasını
  almaz (G17b). İletinin gövdesine konmuş bir `#drive-active-item-info` gösterilen dosya sayılmaz, gerçek ön izlemeyle
  birlikteyse ikisine de güvenilmez, öğe kalkınca gerçek ek gömülür (G18). Öğe gövdede konumu sabit bir kabın içindeyse
  (pencere ve ana alanla da) ne gömülür ne "UDF olarak aç" düğmesi çıkar (G18b). Sahte sunucu ek isteklerinin kökenini
  ve çerezlerini kaydeder: Ekin Gmail sekmesindeki içerik betiğinden birinci taraf (aynı köken, çerezli) indirildiği,
  kart basılınca çerçeve eklenmeden istendiği, açılışta bir kez istendiği, sayfanın ürettiği (güvenilmeyen) fare ve tuş
  olaylarında istenmediği denetlenir. Eklentinin sayfalarında CSP ihlali olmadığı da denetlenir. Üçüncü taraf çerezleri
  kapalı bir oturum ve Dark Reader kuruluysa onunla bir oturum da çalışır.
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
- `node araclar/chrome-sina.mjs yuk`: Kötü niyetli büyük yapılarla yapay belgeler üretip (130.000 satırlık tablo, 150.000
  çocuklu öğe, 2 milyon sekme, üst bilginin sayfa sonlarıyla çarpımı ve benzerleri) görüntüleyicide açar. Belge çökmeden,
  makul sürede ve sınır notuyla açılmalı, sekme kilitlenmemeli.
- `node araclar/tanitim-gorselleri.mjs`: README'deki ekran görüntülerini (`belgeler/gorseller/`) yeniden üretir. Gerçek
  Drive'ın görüntüleyicisinde iki yapay dilekçe gösterir (internet gerekir, oturum açılmaz, herkese açık örnek klasör,
  tam ekran 1920×1200, 2 kat yoğunlukta çekilip küçültülür). Görüntüdeki dosya adları da yapaydır. Sonunda
  `node araclar/dar-gorseller.mjs`'i de çalıştırır: README tam ekran çekimlerin dar kesitlerini gösterir
  (`drive-belge-dar.png`, `drive-notlar-dar.png`), GitHub'da belge büyük görünsün diye. Ardından
  `node araclar/magaza-gorselleri.mjs`: Chrome Web Mağazası görselleri (`belgeler/magaza/`, metinler `belgeler/MAGAZA.md`).
- `node araclar/simge-uret.mjs`: Simgeleri (`simgeler/`) SVG'den yeniden üretir.
- `node araclar/yerel-sina.mjs <klasör>`: Klasördeki `.udf` dosyalarını motordan geçirir. Her dosya için sıra numarası,
  adın SHA-256 özetinin ilk 8 hanesi ve yapısal özet (sayılar, imza durumu, biçim sürümü, süre) yazar. Dosya adı ve belge
  metni yazılmaz, satırın hangi dosyaya ait olduğu adın özeti yeniden hesaplanarak bulunur. Bozuk dosya varsa çıkış kodu 1.
- `node araclar/paketle.mjs`: `cikti/UDF-On-Izleme.zip`. `--magaza` ile Chrome Web Mağazası paketi (manifest'te
  `key` yok, mağazadan kurulan eklentinin kimliği farklıdır). `v<sürüm>` etiketi gönderilince GitHub Actions sürümü
  yayımlar (etiket `manifest.json`'daki sürümle aynı olmalı). Etiket iki işi başlatır: `paket` işi yalnız okuma yetkisiyle
  test eder, paketler, sürüm notunu yazar ve ikisini 1 gün saklanan çıktıya koyar. `yayim` işi `contents: write` yetkisi
  olan tek iştir: Depoyu çekmez, deponun kodunu çalıştırmaz, çıktıyı indirip GitHub sürümünü oluşturur. İki iş akışında da
  belirteç yalnız okur (`permissions: contents: read`), `checkout` adımı kimlik bilgisini diske bırakmaz
  (`persist-credentials: false`).
- Sürüm notları `DEGISIKLIKLER.md`'de. GitHub sürüm notu bölümün ardına `araclar/surum-notu.mjs`'in kendi Kurulum adımlarını
  (zip'i çıkarmak, Geliştirici modu, Paketlenmemiş öğe yükle, sekmeleri yenilemek) ve Güncelleme satırını (aynı klasörün
  üzerine çıkarmak, kartta ↻) ekler. Bu yüzden `DEGISIKLIKLER.md`'deki bölümlere kurulum adımı yazılmaz. Biçim kuralları
  ve araştırma notları `belgeler/` altında (Drive'a gömme: `DRIVE-TEKNIGI.md`).

## Bilinen sınırların ayrıntısı

README kısa tutulur. Yazdırma, görünüm ve gizlilikle ilgili ayrıntılar:
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
- Drive'ın klasör görünümünde dosyanın kaynak anahtarı (`resourcekey`) bilinmez: Eski bağlantı paylaşımlı (2021 öncesi)
  bir dosyayı ilk kez klasörden açan kullanıcıda indirme reddedilebilir. Gmail'de anahtar, basılan aynı kimlikli Drive
  bağlantısından alınır. Bu yol gerçek bir `resourcekey`'li bağlantıyla ölçülmedi.
- Belge görüntüleyicinin sınırlarını (`motor/udf-motoru.js` `SINIR`) aşarsa sayfaların altına neyin eksik olduğunu söyleyen
  not konur, çubukta "Belgenin bir kısmı gösterilemedi" rozeti çıkar. Okuma durduysa (öğe sınırı ya da 8 sn'lik süre)
  "Yalnız ilk bölümü gösteriliyor", 32'den derin iç içe tablo, 32'den derin iç içe tanınmayan öğe ya da şablon
  verisinden gelen fazla tablo satırı atlandıysa "Çok iç içe geçmiş bazı tablolar", "Çok iç içe geçmiş bazı öğeler" ya da
  "Şablon verisinden gelen bazı tablo satırları gösterilemedi" yazar, birkaçı birden olabilir (tablo ve öğe birlikteyse
  "Çok iç içe geçmiş bazı tablolar ve öğeler"). Böyle bir belge yazdırılınca son sayfanın içeriğinin altına kısa bir
  "Eksik baskı: …" kutusu basılır.
  Not son sayfanın ardından geldiği için `.udf-sayfa:has(+ .udf-not)` son sayfadan sonra boş sayfa çıkarmaz. Kutunun
  yeri ve boş sayfa çıkmaması gerçek Chrome'un PDF çıktısında henüz denetlenmedi (32'den derin iç içe tablolu yapay bir
  belgeyle `chrome-sina.mjs gorsel` yeter).
- Şablon belgede bir alanın birleştirilmiş değeri en çok 1.000.000 karakter (`SINIR.alanMetni`), şablon verisinden
  belgeye giren bütün metin en çok 20.000.000 karakterdir (`SINIR.veriMetni`). Aşılınca belge o noktaya dek gösterilir.
  Şablon verisindeki arama da 8 sn'lik süreye ve iptale bakar. Bir notun metni 20.000 karakterde kesilir
  (`SINIR.notMetni`). Alan değerindeki HTML etiketleri atılır: Kapanmayan bir `<` sonraki metni yutmaz (`x < y` olduğu
  gibi kalır). Öznitelik değerinin içinde `<` taşıyan etiketten kalıntı kalabilir (düzgün HTML'de `<` `&lt;` olarak
  yazılır).
- Paket merkezî dizinden okunur, yerel başlıklar da denetlenir: Girdiler 0. bayttan dizine dek art arda gelir,
  aralarında en çok 24 baytlık boşluk (veri tanımlayıcısının yeri) olabilir. Motor bu boşluğun içeriğine bakmaz: 30
  baytlık bir yerel başlık oraya sığmaz. Yerel başlıktaki ad ve yöntem merkezî dizindekiyle, veri tanımlayıcısız
  saklanmış girdide boyutlar da aynı olmalı. Veri tanımlayıcılı saklanmış girdinin (Java ve UDE yazmaz) verisinde yerel
  başlık imzası geçemez: Sıralı okuyucu böyle bir girdinin sonunu bilemez, verisine sahte bir tanımlayıcı ve ardından
  bir girdi gömülebilirdi. Uymayan paket "Dosya açılamadı: Bozuk ya da UDF değil." ile reddedilir: Yerel başlıkları
  sırayla okuyan bir okuyucu (Java `ZipInputStream`) merkezî dizindekinden başka bir `content.xml` bulmasın. UYAP ve UDE
  çıktısı (bayrak 0x0808, 16 baytlık veri tanımlayıcısı) bu düzene uyar. UDE 5.4.20'nin kaydettiği dosyalarda yalnız
  yapı okunarak denetlendi. Sıkıştırılmış akış beyan edilen boyuttan önce biterse kalan baytlara gizlenen girdi,
  `DecompressionStream` akışın sonundaki fazla baytı reddettiği için açılmaz. Bu Node 24'te sınandı, Chrome'da ayrıca
  sınanmadı (test bunu yapmayan Node sürümünde kendini atlar).
- Sağlam ama UDF olmayan XML (kökü `template` değil ve `elements`'ı yok) ve gövdesiz (`elements`'sız) `template` "Dosya bir
  UDF belgesi değil." iletisiyle reddedilir (kod `udf-degil`). Bozuk XML "Belge içeriği okunamadı (XML bozuk)." der.
- `default` stiline bağlı yaprak belgenin tabanını alır, tanımsız bir stil adına bağlı yaprak paragrafı devralır
  (`UDF-SARTNAMESI.md` §9). Altı ve üstü çizgi ile zemin metin parçasına kendi çözülmüş stilinden verilir: Paragrafın
  zemini bütün satırı değil yazının arkasını boyar. Notun vurgusu ve seçili not zeminin üstüne binen bir katmandır,
  zeminli yazıda da görünür. Kâğıda vurgu basılmaz (seçili not dâhil), zemin basılır.
- Gizlilik ayrıntısı (`DRIVE-TEKNIGI.md` §13):
  - Manifest'te `permissions` yok, site erişimi yalnız `host_permissions`'taki `drive.usercontent.google.com` ile içerik
    betiğinin iki sitesi. Eklenti hiçbir şey saklamaz (`chrome.storage`, `localStorage` ve benzeri kullanılmaz, `npm test`
    denetler). Manifest'te `action`, `options_ui` ve `commands` yok, geliştiricinin X sayfası `homepage_url`'de, sağ
    tıkta en üstteki eklenti adında.
  - İçerik betiği yalnız `drive.google.com/drive/*`, `drive.google.com/file/*` ve `mail.google.com/mail/*` sayfalarında
    çalışır. Gömülü sayfa (`web_accessible_resources`) ve `frame-ancestors` kökene göre iki siteye açıktır.
  - Belgenin kaydı (Drive: Kimlik, ad, hesap (sırası ya da e-posta adresi), kaynak anahtarı. Gmail: Ad, ek bilgisi,
    sekme) service worker'ın belleğinde rastgele anahtarla durur, görüntüleyici onu bir kez alır (`kayit-al`). Alınmayan
    kayıt 60 sn sonra silinir, en çok beşi durur. Görüntüleyici aldığı kaydı yeniden denerken geri gönderir, service worker
    yeniden doğrular.
  - Görüntüleyicinin CSP'si `default-src 'none'`, yalnız eklentinin kendi betikleri, stilleri ve resimleri (`blob:` dâhil)
    ve `drive.usercontent.google.com`'a bağlantı açık. Gömülü sayfa yalnız `drive.google.com` ve `mail.google.com`
    çerçevesinde açılır, adresi oturumluk, belgeyi rastgele anahtarla açar.
  - Drive dosyası yalnız sayfanın hesabıyla indirilir (hesap, yani sıra ya da `authuser`'daki e-posta adresi,
    bilinmiyorsa hesapsız istek, yani varsayılan hesap). Gmail ekini görüntüleyici değil, Gmail sekmesindeki içerik betiği
    Gmail'in kendi kökeninden indirir. Ek, .udf kartına basılınca (ön izleme açılmadan önce) indirilmeye başlar, yalnız
    kullanıcının gerçek tıklaması ya da tuşuyla.
  - Gmail'de `#drive-active-item-info` yalnız belgede tekse ve konumu sabit bir katmanın (görüntüleyicinin kökü) içindeyse
    gösterilen dosya sayılır. Katman bir `role=main` içinde olmamalı, öğeyle katman arasında en çok bir `role=main`
    bulunmalı. Belge, ana alan da o katmanın içinde ve bir `role=dialog` içindeyse gömülür, Gmail'in kendi posta alanı
    gömme yeri olmaz. Katman tanınmazsa "UDF olarak aç" düğmesi de çıkmaz, Gmail'in kartı kalır. Böylece bir e-postanın
    gövdesine konmuş aynı kimlikli öğe belgeyi tıklamasız gösteremez, düğmeyi de çıkaramaz.
  - Gmail'de basılan Drive dosyası bağlantısının kimliği ve kaynak anahtarı (yalnız son basılanınki) içerik betiğinin
    belleğinde sekme yenilenene dek durur. Anahtar yalnız aynı kimlikli dosya Gmail'in ön izlemesinde gösterilince
    kullanılır. Sekmede kalan öbür kimlikler `DRIVE-TEKNIGI.md` §13 "İçerik betiğinin belleği"nde.
  - Baytlar service worker'da ve içerik betiğinde son dilime ya da en çok 15 sn tutulur, bırakılırken sıfırlanır.
    Kullanılmayan ön indirme (Drive'da service worker'ın, Gmail'de içerik betiğinin) bırakılınca kesilir: En çok üçü
    durur, 15 sn dolunca da bırakılır. Görüntüleyicinin istediği ama bitmemiş indirme de kesilir: Gmail'de çerçeve
    kaldırılınca, Drive'da aynı sekmeden yeni gömme kaydı gelince, ikisinde de aynı anahtarla yeniden denenince. Kesilen
    ya da yarıda kalan indirmenin (iptal, 40 MB sınırı, kopan bağlantı) inen parçaları da, başarılı indirmenin
    birleştirilen ara parçaları da sıfırlanır (`indir.js` `govdeOku`). Dosya adı adrese ve sekme başlığına konmaz.
