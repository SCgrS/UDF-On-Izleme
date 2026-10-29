# Değişiklikler

## 0.1.0 (2026-10-29)

İlk sürüm.

- **Drive'da ön izleme:** Google Drive'da bir `.udf` dosyasına çift tıklayınca belge, PDF'ler gibi Drive'ın kendi ön
  izleme penceresinde açılır. Oklarla (← →) öbür dosyalara geçilir. **Esc** ya da belgenin dışındaki koyu boşluğa
  tıklamak pencereyi kapatır. Paylaşım bağlantısıyla (`drive.google.com/file/d/…`) açılan `.udf` da Drive sayfasının
  içinde görünür. Drive'ın UDF'de işlemeyen **Yorum** düğmesi belge açıkken gizlenir.
- **Gmail'de ön izleme:** Bir e-postadaki `.udf` ekine tıklayınca belge, "Önizleme yok" yerine Gmail'in kendi ön izleme
  penceresinde açılır. Oklarla (← →) e-postanın öbür eklerine geçilir, **Esc** pencereyi kapatır. Açılan belge, tıklanan
  e-postadaki ve ön izlemede gösterilen sıradaki ektir. Aynı adlı ekler karışmaz. Hangi ek olduğu kesin değilse (ör. gelen
  kutusu listesindeki ek düğmesinden açılınca) Gmail'in kendi görünümü kalır.
- **Hızlı açılış:** Gmail'de `.udf` ekinin kartına basıldığı anda ek indirilmeye başlar. Belge, ön izleme penceresi
  açılırken hazırlanır.
- **Alttaki çubuk:** Solda imza durumu ve notlar, ortada yakınlaştırma (−, %, +), sağda **Yazdır / PDF**. "PDF olarak
  kaydet"in önerdiği ad Drive'da Drive sekmesinin, Gmail'de Gmail sekmesinin adıdır (e-postanın konusu ve hesabın e-posta
  adresi), yeni sekmede açılan belgede "UDF Ön İzleme". Belgenin adıyla kaydetmek için adı yazın.
- **Notlar:** Belgeye Editör'de eklenmiş notlar sağdaki bölmede açılır. Belgede not varsa bölme kendiliğinden açılır.
  Bir nota basınca belgede işaretlediği yere gidilir. Pencere daraldıkça bölme de daralır.
- **E-imza:** Belgedeki e-imza dosyasının özeti içerikle tutuyorsa **E-imzalıdır** yazar, tutmuyorsa **E-imza içerikle
  uyuşmuyor** uyarısı çıkar. İmza dosyası içerikle karşılaştırılamıyorsa (ör. içindeki özet okunamıyorsa) **E-imza dosyası
  var, içerikle karşılaştırılamadı** yazar, dar pencerede kısaca **E-imza karşılaştırılamadı**. E-imzası ve notu olmayan
  belgede **E-imzasız** yazar. İmza ve sertifika doğrulanmaz.
- **Eklenti simgesi:** Eklentinin ayarı ve açılır penceresi yoktur. Simgeye sağ tıklayınca en üstteki eklenti adı
  geliştiricinin X sayfasını (x.com/CgrShn) açar. Kapatmak için `chrome://extensions` sayfası kullanılır.
- **Desteklenenler:** Paragraf biçimleri, asılı girinti, sekme durakları (sola, sağa, ortaya, ondalık), numaralı ve
  madde işaretli listeler (ekran okuyucu numarayı ve madde işaretini de okur), tablolar, resimler, üst/alt bilgi, sayfa
  sonu, notlar, şablon belgeleri, sıkıştırılmamış (XML) UDF dosyaları. Yazdırırken sayfa boyutu, kenar boşlukları, üst
  bilgi ve sayfa numarası belgeden alınır.
- **Çok büyük ya da karmaşık belge:** Belge görüntüleyicinin sınırlarını aşarsa sayfaların altındaki not neyin
  gösterilemediğini söyler: Belgenin yalnız ilk bölümü, çok iç içe geçmiş bazı tablolar, çok iç içe geçmiş bazı öğeler
  ya da şablon verisinden gelen bazı tablo satırları. Çubukta **Belgenin bir kısmı gösterilemedi** yazar. Böyle bir
  belge yazdırılınca son sayfanın altına kısa bir "Eksik baskı" notu basılır.
- **Gizlilik:** Belge hiçbir sunucuya gönderilmez. Drive'daki dosya Drive'ın indirme adresinden
  (`drive.usercontent.google.com`), Drive'da açık olan hesabınızla, Gmail eki Gmail sayfasının içinden kendi
  oturumunuzla indirilir ve yalnız tarayıcınızda gösterilir. Eklenti hiçbir şey saklamaz. Belgenin bilgisi ve baytları
  yalnız bellekte durur: Bilgisi eklentinin arka planında en geç bir dakikada, baytları indirme bittikten en geç 15 saniye
  sonra silinir. Belge gösterilirken yalnız ön izleme penceresinin belleğindedir. Drive ya da Gmail sekmesinin belleğinde
  sekme yenilenene dek yalnız son açılan dosyanın, Gmail'de son basılan ek kartının e-postasının ve son basılan Drive
  bağlantısının kimliği (bağlantının erişim anahtarı da) kalabilir. Belgenin adı sekme başlığına ve adrese konmaz.
  Drive'da ön izlemedeki dosyanın kimliği, adı, türü, hesap sırası (adreste yazılıysa hesabın e-posta adresi), paylaşım
  bağlantısının erişim anahtarı ve dosya sayfasında sekme başlığı okunur. Gmail'de ön izlemedeki dosyanın adı, açık
  e-postadaki ek kartlarının adları ve indirme bağlantıları, hangi karta basıldığı ve basılan son Drive bağlantısının
  dosya kimliğiyle erişim anahtarı okunur. Chrome'da üçüncü taraf çerezleri kapalıyken de belge açılır. Eklenti yalnız
  `drive.google.com` ve `mail.google.com` sitelerinde çalışır, site erişimi yalnız bu iki site ve
  `drive.usercontent.google.com` içindir, başka bir izin istemez.
- Lisans AGPL-3.0. Belge okuma motorunun türetildiği kodun MIT bildirimi `LISANSLAR.txt`'de.
