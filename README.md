# UDF Ön İzleme

Google Drive ve Gmail, UYAP Doküman Editörü'nün `.udf` belgelerini ön izleme olarak göstermez, eklenti bu ön izlemeyi
sağlar. Google Drive'da bir `.udf` belge açmak için dosyaya çift tıklamanız, Gmail'de bir `.udf` eki açmak için eke
tıklamanız yeter: Belge, PDF'ler gibi Google'ın kendi ön izleme penceresinde açılır.

> Eklenti yalnız Google Drive (`drive.google.com`) ve Gmail (`mail.google.com`) sitelerinde çalışır. Başka sitelere
> karışmaz.

Eklenti bağımsız bir geliştirici ([x.com/CgrShn](https://x.com/CgrShn)) tarafından üretilmiş, yardımcı bir araçtır.
Google, UYAP veya Adalet Bakanlığı tarafından geliştirilmiş bir ürün değildir.

---

## Ne yapar

- **Drive'da ön izleme:** `.udf` dosyasına çift tıklayınca belge, PDF'ler gibi Drive'ın kendi ön izleme penceresinde
  açılır. Oklarla (← →) öbür dosyalara geçilir. **Esc** ya da belgenin dışına tıklamak pencereyi kapatır. Drive'ın UDF'de
  işlemeyen **Yorum** düğmesi belge açıkken gizlenir.

  ![Drive'ın ön izleme penceresinde açılmış bir UDF dilekçesi, altta yakınlaştırma ve Yazdır / PDF çubuğu](belgeler/gorseller/drive-belge.png)

  <sub>Görüntülerdeki belge, kişi ve dosya adları örnektir.</sub>
- **Gmail'de ön izleme:** Bir e-postadaki `.udf` ekine tıklayınca belge, "Önizleme yok" yerine Gmail'in kendi ön izleme
  penceresinde açılır. Oklarla (← →) e-postanın öbür eklerine geçilir. **Esc** pencereyi kapatır. Gmail'de **Yazdır /
  PDF** ile PDF kaydederken önerilen dosya adı Gmail sekmesinin adıdır (e-postanın konusu ve hesabınızın e-posta adresi),
  belgenin adını siz yazarsınız.
- **Alttaki çubuk:** Solda imza durumu ve notlar, ortada yakınlaştırma, sağda **Yazdır / PDF** (Ctrl+P).

  <img src="belgeler/gorseller/cubuk.png" width="487" alt="Alttaki çubuk: E-imzalıdır, notlar (2), yakınlaştırma, Yazdır / PDF">
- **Notlar:** Belgeye Editör'de eklenmiş notlar sağdaki bölmede açılır. Bir nota basınca belgede işaretlediği yere gidilir.
  Pencere daraldıkça bölme de daralır, belge tek başına sıkışmaz.

  ![Not bölmesi açık: Belgedeki iki not ve işaretli yerleri](belgeler/gorseller/drive-notlar.png)
- **E-imza:** **E-imzalıdır**, belgede e-imza dosyası olduğunu gösterir. İmza ve sertifika burada doğrulanmaz. Belge
  imzadan sonra değiştirilmişse **E-imza içerikle uyuşmuyor** uyarısı çıkar.
- **Eklenti simgesi:** Eklentinin ayarı ve açılır penceresi yoktur. Simgeye sağ tıklayınca en üstteki eklenti adı
  geliştiricinin X sayfasını ([x.com/CgrShn](https://x.com/CgrShn)) açar. Kapatmak için `chrome://extensions` sayfasında
  eklentinin kartındaki anahtarı kapatın ve açık Drive ve Gmail sekmelerini yenileyin (F5).

---

## Kurulum

### Chrome Web Mağazası'ndan ekle

Mağaza bağlantısı, eklenti mağazada yayımlanınca buraya eklenecek.

1. Bağlantıya tıklayın, açılan sayfada **Chrome'a ekle**'ye basın.
2. Çıkan küçük pencerede **Uzantı ekle**'ye basın.
3. Açık Drive ve Gmail sekmelerini yenileyin (F5).

### Kaynak koddan

1. Bu depoyu indirin: Sağ üstteki yeşil **Code > Download ZIP**, sonra dosyaya sağ tıklayıp **Tümünü ayıkla** ile
   kalıcı bir klasöre çıkarın. Chrome eklentiyi bu klasörden çalıştırır. Klasör silinirse eklenti durur.
2. Chrome'da adres çubuğuna `chrome://extensions` yazıp Enter'a basın.
3. Sağ üstteki **Geliştirici modu** anahtarını açın.
4. **Paketlenmemiş öğe yükle**'ye basıp çıkardığınız `UDF-On-Izleme-main` klasörünü seçin. Bu, içinde
   `manifest.json` olan klasördür. Windows iç içe iki klasör açtıysa içtekini seçin.
5. Açık Drive ve Gmail sekmelerini yenileyin (F5).

### Güncelleme

Mağazadan kurduysanız Chrome yeni sürümü kendisi yükler. Kaynak koddan kurduysanız yeni zip'i aynı klasörün üzerine
çıkarıp `chrome://extensions` sayfasında eklentinin kartındaki **yenile** (↻) düğmesine basın. Ardından açık Drive ve
Gmail sekmelerini yenileyin (F5).

---

## Nasıl kullanılır

1. Google Drive'da bir `.udf` dosyasına çift tıklayın. Belge Drive'ın ön izleme penceresinde açılır.
2. Gmail'de e-postayı açıp `.udf` ekine tıklayın. Belge Gmail'in ön izleme penceresinde açılır.
3. Oklarla (← →) öbür dosyalara ya da eklere geçilir. **Esc** ya da belgenin dışına tıklamak pencereyi kapatır.

Kurulumdan sonra yapılacak bir ayar yoktur. Yalnız kurulumdan ya da güncellemeden önce açılmış Drive ve Gmail sekmeleri
bir kez yenilenir (F5). Bilgisayarda UYAP Doküman Editörü kurulu olması gerekmez. Eklenti, üyelik, e-posta ya da ücret
istemez.

---

## Gizlilik

Belgeleriniz hiçbir yere gönderilmez. Eklenti belgeyi yalnız Google'dan, tarayıcınızda açık olan kendi oturumunuzla alır
ve yalnız tarayıcınızda gösterir. Geliştiriciye ya da Google dışında bir yere hiçbir bilgi gitmez. Eklentinin bir
sunucusu yoktur.

**Okuduğu bilgiler.** Eklenti belgenin içeriği dışında yalnız şunları okur:

- **Drive'da:** Ön izleme penceresindeki dosyanın kimliği, adı ve türü, Drive'da açık olan hesabın sırası (birden çok
  Google hesabıyla giriş yaptıysanız hangisi olduğu), paylaşım bağlantısının erişim anahtarı (`resourcekey`) ve dosya
  sayfasında (`drive.google.com/file/…`) sekmenin başlığı (dosyanın `.udf` olduğunu anlamak için).
- **Gmail'de:** Ön izleme penceresindeki dosyanın adı, açık e-postadaki ek kartlarının indirme bağlantıları ve hangi ek
  kartına bastığınız. E-postadaki bir Drive bağlantısı bu pencerede açılırsa o dosyanın yukarıdaki Drive bilgileri.
  E-postaların metnine, konusuna, gönderenine ya da alıcılarına bakmaz.

**İndirme.** Drive'daki `.udf` dosyası, ön izleme penceresinde açıldığı anda Drive'dan, Drive'da açık olan hesabınızla
indirilir. Gmail'de bir `.udf` ekinin kartına bastığınız anda ek, belge daha çabuk açılsın diye Gmail sayfasının içinden
kendi oturumunuzla indirilmeye başlar. Ön izleme açılmazsa indirilen ek 15 saniye sonra bellekten silinir.

**Saklama.** Eklenti hiçbir şey saklamaz: Ayarı, geçmişi ya da kaydı yoktur, tarayıcının hiçbir deposunu kullanmaz.
Açılan belgenin bilgisi ve baytları eklentinin arka planında yalnız belge açılırken durur ve en geç bir dakikada silinir.
Belge gösterilirken yalnız ön izleme penceresinin belleğindedir, pencere kapanınca gider. Belgenin adı sekme başlığına ve adrese konmaz, bu yüzden tarayıcı
geçmişine düşmez. Belgeyi eklentinin **İndir** düğmesiyle bilgisayarınıza kaydederseniz dosya, adıyla Chrome'un
indirilenler listesine girer.

**İzinler.** Eklenti yalnız Drive'ın (`drive.google.com`) ve Gmail'in (`mail.google.com`) sayfalarında çalışır ve
yalnız Drive'ın indirme adresine (`drive.usercontent.google.com`) bağlanabilir. Başka bir izin istemez.

---

## Teşekkür

Eklentinin belge okuma motoru, Hasan İmer Akın'ın [legaluga-uyap-ui](https://github.com/hasanimer/legaluga-uyap-ui)
(© 2026 Hasan İmer Akın) projesindeki `udf.js` üzerine kuruldu. UDF biçimini çözen bu emeği herkesle paylaştığı için
kendisine buradan da teşekkür ederim.

---

Soru ve bildirimler için: [x.com/CgrShn](https://x.com/CgrShn)

Lisans: AGPL-3.0. Ayrıntılar için [LICENSE](LICENSE) dosyasına bakınız.
