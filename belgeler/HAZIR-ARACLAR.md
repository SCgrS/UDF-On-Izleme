# Görev B: Google Drive'da UDF açan hazır araçlar

## Sonuç

Kullanıcının istediği şey, Drive içindeki bir .udf dosyasını oradan açıp okumak. Bunu bugün yapan hazır bir araç bulunamadı. Chrome Web Store'daki UDF ve UYAP eklentilerinden 37'sinin manifest dosyasını okudum. Hiçbiri drive.google.com'da çalışmıyor. Workspace Marketplace'te de Drive'ın "Birlikte aç" menüsüne UDF ekleyen bir uygulama yok. Web tabanlı görüntüleyicilerin hepsi aynı adımları istiyor: dosyayı Drive'dan indirmek, sonra siteye sürüklemek. Bu yüzden yeni bir MV3 eklentisi gerekiyor. Gerekçe ve eklentide olması gerekenler en sonda.

## 1. Chrome Web Store

**Yöntem.** Mağazada "udf", "udf pdf", "udf to pdf", "udf görüntüle", "udf önizleme", "uyap udf", "uyap evrak", "uyap doküman" ve benzeri sözcüklerle aradım. "udf viewer" ve "udf okuyucu" aramaları sonuç vermedi. Bulunan eklentilerin paketlerini (CRX) Google'ın güncelleme adresinden yalnız bellekte açtım; diske dosya yazmadım. Her birinde `content_scripts.matches`, `host_permissions` ve `optional_host_permissions` alanlarına baktım. Hiçbirinde drive.google.com, `<all_urls>` ya da bütün sitelere izin yok. Tek istisna AwuCat: bütün siteler için izni isteğe bağlı olarak istiyor.

Kullanıcı sayıları ve tarihler 2026-10-05'te okunan mağaza sayfalarından.

**AwuCat — UDF aç, .zip düzelt** (ammflfcdgfikhbjegoilalfmjhdcbneb), https://chromewebstore.google.com/detail/ammflfcdgfikhbjegoilalfmjhdcbneb
- Sürüm 0.1.0, 2 Ekim 2026. Puan yok, kullanıcı sayısı mağazada görünmüyor. Geliştirici CTSS LLC.
- Açık kaynak, MIT lisanslı: https://github.com/cantuncr/awucat-tarayici-uzantisi (depo 2026-10-05'te açılmış).
- Ne yapar:
  - WhatsApp'ın .zip yaptığı UDF dosyalarının adını düzeltir.
  - Bir bağlantıya sağ tıklayınca "AwuCat'te aç" seçeneği çıkar; dosya awucat.app görüntüleyicisinde açılır.
- İzinler: downloads, contextMenus, storage, activeTab, scripting, notifications. Sitelerden yalnız web.whatsapp.com'a izni var. Bütün siteler için izin isteğe bağlı; o site açılırken soruluyor.
- Gizlilik beyanı: "Dosyalar tarayıcınızdan çıkmaz", analitik ve telemetri yok.
- **Drive'da çalışmaz.** Bu bir koddan çıkarım, denemedim. Sağ tık menüsü yalnız adresi `*://*/*.udf` ya da `*.udf?*` kalıbına uyan bağlantılarda çıkıyor (kodda `src/lib/http.ts` → `linkPatterns`). Drive'daki dosya adresleri `/file/d/<id>/view` biçiminde olduğu için menü görünmez.
- awucat.app web uygulamasının kaynak kodu bulunamadı.

**Legaluga UYAP Asistanı** (aicknihmpdcbfgidifffinnbgbghkmcn), https://chromewebstore.google.com/detail/aicknihmpdcbfgidifffinnbgbghkmcn
- Sürüm 1.19.15, 3 Ekim 2026, 9 kullanıcı.
- İçinde UDF, TIFF ve HTML evraklarını açan bir görüntüleyici var.
- İçerik betiği ve site izni yalnız avukat.uyap.gov.tr için. Ayrıca Sentry'ye hata raporu gönderme izni var.
- UDF okuyucusu MIT lisanslı: hasanimer/legaluga-uyap-ui, dosya `udf.js`.
- Drive'da çalışmaz.

**Leges UYAP Asistanı** (lbhcamjfejllmfhnnnofkkmakacggfin), https://chromewebstore.google.com/detail/lbhcamjfejllmfhnnnofkkmakacggfin
- Sürüm 1.0.2, 4 Ekim 2026.
- PDF, TIFF, UDF ve EYP evraklarını önizliyor.
- Ücretli Leges üyeliği gerekiyor. Kapalı kaynak.
- İsteğe bağlı yapay zekâ özeti Leges sunucusunda üretiliyor.
- Yalnız avukat.uyap.gov.tr ve avukatbeta.uyap.gov.tr'de çalışıyor. Drive'da çalışmaz.

**Emileyt | UYAP Toplu Dosya İndirme Asistanı** (cnpeacojcgehnogmjkjaoknngfgoakpi), https://chromewebstore.google.com/detail/cnpeacojcgehnogmjkjaoknngfgoakpi
- Sürüm 2.3.2, 12 Eylül 2026, 164 kullanıcı, puan 3.7.
- Kendi "UDF Görüntüleyici" sayfası var: dosya ya da klasör sürüklenir, belge okunur, PDF olarak kaydedilir, tam metin aranır. Paketin içinde `udf-core.js` ve `udf2pdf.js` dosyaları var.
- Kapalı kaynak. Drive erişimi yok.

**IMEREK UYAP YARDIMCISI** (hlgcdafdokigonljodongahofoeaedjk)
- Sürüm 8.11.14, 5 Ekim 2026, 552 kullanıcı. Uygulama içi satın alma var.
- UYAP portalında UDF'yi kendiliğinden PDF'e çeviriyor.
- Drive'ı yalnız yedekleme için kullanıyor (googleapis izni). İçerik betikleri yalnız UYAP avukat ve vatandaş portallarında.

**UYAP Evrak Takip** (idoelpbpbocapbajmaooomdcmjecgbii)
- Sürüm 3.2.3, 26 Eylül 2026, 1.000 kullanıcı.
- UDF'den PDF'e otomatik çevirme olduğunu extscope.org yazıyor: https://extscope.org/extension/idoelpbpbocapbajmaooomdcmjecgbii. Mağazadaki güncel açıklamada bu özellik geçmiyor.
- Yalnız avukat.uyap.gov.tr'de çalışıyor.

**Teblio UYAP Bridge BETA** (opoiphdomjapaaefpklgiaanlidlnkno)
- 4 kullanıcı. Evrakları önizliyor, onaylanan PDF ve UDF'leri Teblio sunucusuna aktarıyor.
- Drive erişimi yok.

**UDF Uzantı Düzeltici** (bohnehpgndmodbbeocbandibebnabkjm, 3.000 kullanıcı) ve **UDF Kalkanı PRO** (plkifllfijbpamofndbkpekbpcemjdce, 25 kullanıcı)
- İkisi de yalnız WhatsApp Web'de .udf.zip adını düzeltiyor; görüntüleme yok.
- Kalkanı PRO lisansı Firebase ve Shopier üzerinden ücretli.
- Düzelticinin kaynağı: https://github.com/ayvsc/udfuzantiduzeltici (lisans yok).

**UDF Reader** (DigiHolly, https://udfreader.tr/)
- Chrome Web Store'da yok. Siteden `extension.rar` olarak indiriliyor, fiyatı 20 USD, kapalı kaynak.
- Geliştirici modunda elle kurmak gerekiyor; Drive'dan söz edilmiyor.
- Önerilmez: mağaza denetiminden geçmemiş, kapalı kaynak bir paket.

**Geri kalan 28 UYAP eklentisi** (Tüze, LexUDF, Uyap Matbu Dilekçe, İstanbul Barosu UYAP Downloader, Lextum, Dilex, Hukas ve diğerleri) indirme, takip ya da dilekçe üretme işi yapıyor. Hiçbirinin Drive'a erişimi yok.

## 2. Google Workspace Marketplace

Marketplace'te "udf" ve "uyap" diye aradım.

**UYAP Çevirici** (geliştirici AKA), https://workspace.google.com/marketplace/app/uyap_%C3%A7evirici/46494924541
- Google Dokümanlar eklentisi. 23 yükleme, listeleme 3 Temmuz 2026'da güncellenmiş.
- UDF'den Dokümanlar'a ve Dokümanlar'dan UDF'ye çeviriyor.
- İçe aktarma için dosya Drive'dan değil bilgisayardan seçiliyor. UDF'yi görüntülemiyor, Google Dokümanı'na dönüştürüyor.
- Ayda 5 belge ücretsiz, fazlası Premium.
- "Sunucusuz" diyor, ama istediği izinler arasında "Harici bir hizmete bağlanın" ve e-posta adresini görme var. Bu, lisans denetimi için olabilir.
- Drive'ın "Birlikte aç" menüsüne kaydı yok.

**File Converter for Drive™, Dropbox** (youfiles.herokuapp.com), https://workspace.google.com/marketplace/app/file_converter_for_drive_dropbox/1038237829739
- Desteklenen biçimler listesinde "udf" geçiyor. Komşu biçimler (u3d, uof) yüzünden bu büyük olasılıkla Universal Disk Format (disk görüntüsü). UYAP UDF desteği belirtilmemiş.
- Herokuapp üzerinde çalışan, sunucu taraflı bir çevirici. Uygun değil.

Drive'ın "Birlikte aç" menüsüne UDF ekleyen bir uygulama bulunamadı. Bu, ancak Marketplace'te dosya türü kaydeden bir Drive uygulamasıyla yapılabiliyor: https://developers.google.com/workspace/drive/api/guides/publish?hl=tr

## 3. Web tabanlı görüntüleyiciler ve çeviriciler

Hiçbirinde Drive bağlantısı (ör. Google Picker ile Drive'dan dosya seçme) yok; hepsi dosyanın indirilip siteye verilmesini istiyor. "Sunucuya yüklemiyoruz" sözleri sitelerin kendi beyanı; ağ trafiğini izleyerek doğrulamadım.

- **imer.av.tr UDF Görüntüleyici**, https://imer.av.tr/udf-araclari/udf-goruntule
  - Beyan: "Dosyalarınız hiçbir sunucuya gönderilmez; yalnızca tarayıcınızda işlenir."
  - Ücretsiz. Sayfa biçimini, stilleri ve e-imza bilgisini (imzalayan, tarih, sertifika makamı) gösteriyor. Kapalı kaynak.
- **convertudftopdf.com**, https://convertudftopdf.com/ (kaynağı: https://github.com/ox3adie1/udf-to-pdf, lisans yok)
  - Beyan: yerel işleme. PWA olarak çevrimdışı da çalışıyor.
  - Toplu dönüştürme ve zip yüklemeyi destekliyor, PDF'leri tek dosyada birleştirebiliyor.
- **udfpdf.com.tr**, https://udfpdf.com.tr/ (kaynağı: https://github.com/rhzengin/udf-to-pdf, lisans yok)
  - Beyan: "Tüm dönüştürme işlemi yalnızca sizin cihazınızda, tarayıcı belleğinde gerçekleşir."
- **awucat.app**, https://awucat.app
  - Beyan: yerel işleme. Ücretsiz; isteğe bağlı 399 TL'lik kişisel lisans var.
  - Web uygulamasının kaynak kodu bulunamadı.
- **kadimhukuk.com.tr**, https://kadimhukuk.com.tr/udf-donusturucu/
  - Dosyanın sunucuda mı tarayıcıda mı işlendiği belirtilmemiş. Gizlilik açısından riskli say.
- **isikdogan.com/udf-viewer**, https://www.isikdogan.com/udf-viewer
  - Sayfa JavaScript ile çiziliyor; gizlilik beyanını okuyamadım. Sayfanın kendi koşulları kopyalamayı yasaklıyor.
- **nb-pdf-tools.vercel.app** (NB_PDF_PLATFORM'un sitesi): kök adres 404 veriyor, adres değişmiş olabilir.

## 4. GitHub'daki eklenti projeleri (verilen listede olmayanlar)

`gh search repos` ile aradım. Kullandığım sorgulardan bazıları: "udf chrome extension", "udf google drive", "uyap in:name,description extension", "udf in:name,description,readme eklenti", "udf in:name,description uyap".

- **cantuncr/awucat-tarayici-uzantisi** (MIT): Yukarıdaki AwuCat eklentisinin kaynağı. Mimarisi:
  - Dosyayı tarayıcı içinde indiriyor ve `postMessage` ile görüntüleyici sekmesine veriyor.
  - Dosyanın UDF olduğunu adından değil içeriğinden anlıyor: zip mi ve içinde content.xml var mı (`src/lib/sniff.ts`).
  - Başka bir siteden dosya açarken o siteye erişim iznini o anda istiyor.
- **mustafayildiran/uyap-eyp-goruntuleyici** (MIT, 1.1.6): avukat.uyap.gov.tr'de .eyp ve .udf dosyalarını indirmeden sayfa içinde açıyor (JSZip ile). Yalnız uyap.gov.tr'de çalışıyor.
- **Mancell/Chrome-eklenti-UYAP** (lisans yok): `evrak.js` ile UDF'den yalnız düz metin çıkarıyor.
- **kivancki/vatandas-uyap-editor** (MIT), **AvEmreArslan/Uyap-Flow** (MIT): UYAP portalında indirme ve dosya türü tespiti; görüntüleme yok.
- **07erkanoz/lifeos-folio** (lisans yok): masaüstü ve Android'de çalışan UDF okuyucu, yazıcı ve imzalayıcı. Tarayıcı eklentisi değil.
- drive.google.com üzerinde çalışan bir UDF eklentisi GitHub'da bulunamadı.

## 5. Drive'ın web arayüzü dışındaki geçici yollar (denenmedi)

- **Google Drive masaüstü uygulaması:** Eşitlenen klasördeki .udf dosyası, bilgisayarda kurulu UYAP Doküman Editörü ile açılabilir. Windows Gezgini önizleme bölmesi için: https://github.com/saidsurucu/udf-preview-win (MIT olduğu yalnız README'de yazıyor). Bu yöntemleri bu araştırmada denemedim.
- **Android:** Resmî "Uyap Doküman Editör" uygulaması (https://play.google.com/store/apps/details?id=tr.gov.uyap.editor) UDF'yi görüntüleyip PDF'e aktarıyor. Android Drive uygulamasındaki "Birlikte aç" listesinde çıkıp çıkmadığı doğrulanmadı.

## 6. Hazır bir çözüm yeterli mi?

Hayır. Gerekçeler:

1. Kurulu bir UDF görüntüleyicisi olan eklentilerin hepsi (Legaluga, Leges, Emileyt, IMEREK, UYAP Evrak Takip) yalnız UYAP portallarında ya da kendi sayfasında çalışıyor. Manifestlerinde Drive için izin yok.
2. En yakın aday AwuCat. Ama sağ tık menüsü yalnız adresi .udf ile biten bağlantılarda çıkıyor; Drive'ın dosya adresleri böyle bitmediği için Drive'da çalışmaz.
3. Workspace Marketplace'teki UYAP Çevirici bir görüntüleyici değil. Dosyayı Drive'dan değil bilgisayardan alıyor, Google Dokümanı'na çeviriyor, ayda 5 belgeyle sınırlı ve harici hizmete bağlanma izni istiyor. "Birlikte aç" desteği hiçbir uygulamada yok.
4. Web siteleri her belge için "Drive'dan indir, siteye sürükle" adımlarını istiyor. Çoğu kapalı kaynak, yerel işleme beyanları doğrulanmamış. Avukat–müvekkil gizliliği açısından kendi denetimimizdeki yerel kod daha güvenli.

### Yeni eklentinin kapatması gereken eksikler

- drive.google.com'da çalışmalı: dosya görüntüleme sayfasında (`/file/d/<id>/view`) ve dosya listesinde (sağ tık ya da düğme).
- Dosyanın baytlarını kullanıcının kendi Drive oturumuyla almalı; hiçbir sunucuya göndermemeli.
- Belgeyi tamamen yerelde çizmeli; uzaktan kod, CDN ya da telemetri kullanmamalı.
- İzinleri dar tutmalı: yalnız drive.google.com ve indirme için gereken Google alan adları. Bütün sitelere ya da `tabs`, `cookies` izni istememeli.
- Yazdırma ve PDF olarak kaydetme olmalı.
- Mağaza dışından .rar ile kurulan bir paket olmamalı.

### Hazır araçlardan alınacak iyi fikirler

- **legaluga-uyap-ui `udf.js` (MIT):** en kapsamlı tarayıcı okuyucusu; boyut, derinlik ve süre sınırlarıyla güvenli. Çizim motoru olarak bu alınmalı.
- **AwuCat:**
  - Dosyayı içeriğinden tanıma (zip + content.xml); böylece "dilekce.udf.zip" adlı dosyalar da açılır.
  - Belgeyi ayrı bir görüntüleyici sekmesine `postMessage` ile verme.
  - Başka bir siteye erişim iznini yalnız gerektiği anda isteme.
- **uyap-eyp-goruntuleyici:** "önizleme yok" ekranının yerine aynı sayfada görüntüleyici gösterme.
- **imer.av.tr:** e-imza bilgisini gösterme (imzalayan, tarih). Kriptografik doğrulama ayrı bir iş.
- **convertudftopdf.com ve Emileyt:** PDF olarak kaydetme, toplu açma, belge içinde tam metin arama.
- **Drive "Birlikte aç":** Daha ağır bir seçenek olarak Drive API ile Marketplace'e dosya türü kaydeden bir uygulama da yapılabilir. Bunun için Google Cloud projesi ve OAuth doğrulaması gerekir. Eklentiden sonra düşünülebilir.

## Araştırmanın sınırları

- Mağaza aramaları her sorguda en çok yaklaşık 10 sonuç döndürüyor; sayfalamayı izlemedim.
- AwuCat'in Drive'da çalışmayacağı sonucu koda dayanıyor; eklentiyi kurup denemedim.
- Web sitelerinin "yerel işleme" beyanlarını ağ trafiğini izleyerek doğrulamadım.
- extscope.org'daki kullanıcı sayısı (867) eski bir sürüme ait; mağazada güncel sayı 1.000.