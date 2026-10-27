# Değişiklikler

## 0.0.1 (2026-10-27)

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
- **E-imza:** E-imza dosyası olan belgede **E-imzalıdır** yazar, e-imzası ve notu olmayan belgede **E-imzasız**. İçerik
  imza dosyasındaki özetle tutmuyorsa **E-imza içerikle uyuşmuyor** uyarısı çıkar. İmza ve sertifika doğrulanmaz.
- **Eklenti simgesi:** Eklentinin ayarı ve açılır penceresi yoktur. Simgeye sağ tıklayınca en üstteki eklenti adı
  geliştiricinin X sayfasını (x.com/CgrShn) açar. Kapatmak için `chrome://extensions` sayfası kullanılır.
- **Desteklenenler:** Paragraf biçimleri, asılı girinti, sekme durakları (sola, sağa, ortaya, ondalık), numaralı ve
  madde işaretli listeler, tablolar, resimler, üst/alt bilgi, sayfa sonu, notlar, şablon belgeleri, sıkıştırılmamış
  (XML) UDF dosyaları. Yazdırırken sayfa boyutu, kenar boşlukları, üst bilgi ve sayfa numarası belgeden alınır.
- **Gizlilik:** Belge hiçbir sunucuya gönderilmez. Drive'daki dosya Drive'dan, Drive'da açık olan hesabınızla, Gmail eki
  Gmail sayfasının içinden kendi oturumunuzla indirilir ve yalnız tarayıcınızda gösterilir. Eklenti hiçbir şey saklamaz
  ve izin istemez: Belgenin bilgisi ve baytları yalnız açılırken bellekte durur, belgenin adı sekme başlığına ve adrese
  konmaz. Drive'da ön izlemedeki dosyanın kimliği, adı, türü, hesap sırası, paylaşım bağlantısının erişim anahtarı ve dosya
  sayfasında sekme başlığı, Gmail'de ön izlemedeki dosyanın adı, açık e-postadaki ek kartlarının indirme bağlantıları ve
  hangi karta basıldığı okunur. Chrome'da üçüncü taraf çerezleri kapalıyken de belge açılır. Eklenti yalnız
  `drive.google.com` ve `mail.google.com` sitelerinde çalışır.
- Lisans AGPL-3.0. Belge okuma motorunun türetildiği kodun MIT bildirimi `LISANSLAR.txt`'de.
