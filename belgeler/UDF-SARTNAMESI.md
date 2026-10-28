# UDF biçim şartnamesi (tarayıcıda çalışacak görüntüleyici için)

Bu şartname, aşağıda listelenen kaynak kodların gerçekten okunmasıyla yazıldı. Kaynakların bir kısmı yapı ölçümüdür: UYAP Doküman Editörü'nün (UDE) kaydettiği yerel test dosyaları ile herkese açık iki gerçek UYAP çıktısı. Bu dosyalarda yalnız öğe ve öznitelik adları, sayılar ve ofsetler ölçüldü; belge metni rapora alınmadı. Her kuralın yanında kaynak etiketi var. "Çelişki" yazan yerlerde kaynaklar birbirini tutmuyor; önerilen davranış ayrıca belirtildi.

## 0. Kaynak etiketleri

| Etiket | Kaynak |
|---|---|
| [LEG] | hasanimer/legaluga-uyap-ui `src/extension/udf.js` @8b8d97b9ae — https://github.com/hasanimer/legaluga-uyap-ui/blob/8b8d97b9ae/src/extension/udf.js |
| [FLY-P] / [FLY-R] | mfozmen/udfly `src/parser.js` / `src/render.js` @d5986b4f36 — https://github.com/mfozmen/udfly/blob/d5986b4f36/src/parser.js |
| [NBP] | burakayax/NB_PDF_PLATFORM `web/frontend/src/lib/udf.ts` @88694b27c9 — https://github.com/burakayax/NB_PDF_PLATFORM/blob/88694b27c9/web/frontend/src/lib/udf.ts |
| [GKS-M] / [GKS-S] | gokselb/udfpdf `src/parser/document-model.ts` / `src/utils/style-resolver.ts` (`resolveStyle`), `src/utils/color.ts` @b37575df55 — https://github.com/gokselb/udfpdf |
| [CLI-P] / [CLI-R] | murataskin/udf-cli `src/udf/parser.ts` / `README.md` @377207bae6 — https://github.com/murataskin/udf-cli |
| [TK] | saidsurucu/UDF-Toolkit `Docs.md` @fc95d92973 — https://github.com/saidsurucu/UDF-Toolkit/blob/fc95d92973/Docs.md |
| [EMD] | e-imza/evrak-md `src/udf.js` @849efba9b5 |
| [DIL] | bilalabic/udf-dilekce `docs/udf-format.md` @a5183cacf9 (gerçek UYAP dosyalarında yapılmış ölçümler) |
| [MIA-R] / [MIA-U] / [MIA-D] | miasimbilir/udf-cevirici `README.md` / `udf_docx.py` / `docx_udf.py` @7abdb3a1df. Davranışlar kurulu Editör motorunda 21.09.2026'da deneyle doğrulanmış. Lisans kod almaya izin vermiyor, yalnız bilgi kaynağı. |
| [EVR] | symbuzzer/Evrak `app/src/main/java/com/avalibeyaz/evrak/ui/UdfHtmlConverter.kt` @17a3673a20 |
| [PAD] | ygzyr/UDFpad `src/udf/cms.ts`, `types.ts`, `zip.ts` @8fa67600de |
| [PRV] | saidsurucu/udf-preview-win `crates/udf-core/src/rune.rs` |
| [JDK] | openjdk/jdk master (2026-10-05), `java.desktop/.../javax/swing/text/{StyleConstants,TabStop,ParagraphView,AbstractDocument}.java`, `java/awt/print/PageFormat.java` |
| [RES-S] / [RES-M] / [RES-Z] / [RES-MOD] | Geliştiricinin UDF Resimcisi projesi (yollar o projenin köküne göre): `src-tauri/src/udf/serialize.rs` / `model.rs` / `zip.rs` / `mod.rs` |
| [RES-J] | UDF Resimcisi `tools/macospasterich/UdeXml.java`: saidsurucu/ude-win-x64 başvuru yazıcısının MIT lisanslı kopyası |
| [RES-DOG] | UDF Resimcisi `DOGRULAMA.md` (UDE 5.4.20 ile yapılmış ölçümler) |
| [RES-TD] | UDF Resimcisi projesinin test örnekleri `testdata/turnusol.udf` ve `pano-yapistir.udf`: UDE 5.4.20'nin kendi kaydettiği dosyalar. Burada ölçüldü. |
| [ORN] | Herkese açık gerçek UYAP çıktıları: https://github.com/AvHakanOrhan/eypport/tree/HEAD/scratch/udf_evrak_13360401060 (`document.zip`, `content.xml`, `documentproperties.xml`, `sign.sgn`) ve `scratch/unzip_ilam`. Yalnız yapısı ölçüldü. |

## 1. Paket (ZIP)

- **Gerçek UYAP `.udf`** üç girdi taşır, bu sırayla: `documentproperties.xml`, `content.xml`, `sign.sgn` [ORN document.zip].
  - Hepsi deflate (yöntem 8), genel amaçlı bayrak 0x0808, sürüm 20, "made by" MS-DOS. Bu Java `ZipOutputStream` çıktısıdır [ORN].
  - Bit 3 (veri tanımlayıcı) açık: yerel başlıkta CRC ve boyut alanları 0'dır, bu yüzden boyut ve CRC merkezî dizinden okunmalı [LEG L76-77]. Bit 11 açık: dosya adları UTF-8.
- **UDE'nin kaydettiği imzasız yerel belgede** yalnız `content.xml` vardır; bayraklar aynıdır [RES-TD].
- **Yazıcılar** tek `content.xml` girdisi ve deflate kullanır [RES-Z L9-10, L21], [TK L37-39], [CLI-R L259-264]. Girdinin adı tam `content.xml` olmalı; UDE başka adı okumaz [RES-Z L9].
- Görüntüleyici ad eşleşmesinde hoşgörülü olabilir [NBP L189-200]. legaluga birden çok `content.xml` görürse reddeder [LEG L784-786].
- **Desteklenecek yöntemler:** 0 (saklanmış) ve 8 (deflate) [LEG L121-150].
  - ZIP64, şifreli girdi ve çok parçalı arşiv beklenmez; legaluga bunları reddeder [LEG L86-90, L113].
  - Tarayıcıda açma: `DecompressionStream('deflate-raw')` [LEG L127] ya da fflate/JSZip.
  - Açılan bayt sayılmalı ve beyan edilen boyutla karşılaştırılmalı (zip bombasına karşı) [LEG L125-146].
- **Yerel başlıklar da denetlenmeli:** Girdiler merkezî dizinden okunsa da yerel başlıkları sırayla okuyan bir okuyucu (Java `ZipInputStream`) başka bir `content.xml` bulmasın. Girdiler 0. bayttan merkezî dizine dek art arda gelir, aralarında yalnız veri tanımlayıcısı (12, 16, 20 ya da 24 bayt) olabilir. Yerel başlıktaki ad ve yöntem merkezî dizindekiyle aynıdır, veri tanımlayıcısız saklanmış girdide boyutlar da. UDE 5.4.20'nin kaydettiği dosyalar (bayrak 0x0808, 16 baytlık veri tanımlayıcısı) bu düzene uyar [RES-TD]. Bu eklentinin motoru (`zipGirdileri`, `yerelGirdileriDenetle`) girdiler arasında en çok 24 baytlık boşluğa izin verir, boşluğun veri tanımlayıcısı olup olmadığına bakmaz: 30 baytlık bir yerel başlık o boşluğa sığmaz. Veri tanımlayıcılı saklanmış girdinin verisinde yerel başlık imzası geçemez (sıralı okuyucu böyle bir girdinin sonunu bilemez). Ad, yöntem ya da boyutu uymayan, girdileri art arda gelmeyen paketi reddeder.
- **İsteğe bağlı girdiler:** `documentproperties.xml` ve `sign.sgn` (§13) [DIL L23-32].
  - `signature.p7s`, `binary/` ve `styles/` girdileri olduğu iddia ediliyor ama doğrulanmadı [DIL L140-143]. evrak-md `*.p7s` dosyasını da imza sayar [EMD L14].

## 2. content.xml: Kodlama, ön söz, kök

- **Kodlama:** UTF-8, BOM yok, satır sonu yalnız LF, CR hiç yok [DIL L46-47], [ORN], [RES-Z L13-14]. Yine de BOM, UTF-16 ve ön sözdeki kodlama beyanı tanınmalı, legaluga'daki yedekleme zinciri (utf-8, sonra windows-1254) iyi bir örnek [LEG L156-167].
- **UDE ve UYAP çıktısının ön sözü:** `<?xml version="1.0" encoding="UTF-8" ?> ` + `\n\n` + `<template format_id="1.8" >` [ORN], [RES-TD], [MIA-D L1962-1963], [DIL L37].
  - [TK L51] "bildirimden sonra boşluk yok" diyor; gerçek dosyalar bunu tutmuyor. Okuma için önemsizdir.
- **DTD ve varlık:** Meşru `content.xml`'de DTD de varlık tanımı da yoktur. Ön sözde `<!DOCTYPE` ya da `<!ENTITY` görülürse belge reddedilmeli (XXE ve varlık bombası) [LEG L169-178].
  - Bu kural `documentproperties.xml`'e uygulanmaz; o dosya DOCTYPE taşır (§13).
- **Kök öğe** `<template format_id="1.8">`. Çocukları **adla** bulunmalı, sırayla değil: `content`, `properties`, `elements`, `styles`, `webID` [ORN], [DIL L36-44].
  - Şablon belgelerde kökte `<data>` de olabilir [LEG L455-457, L557]. [TK L167-181] bunu "varsayımsal" sayıyor.
  - Bazı yazıcılar `styles`'ı `elements`'tan önce koyuyor (KilimcininKorOglu/udf-ve-usb-eimza `Tests/SignCoreTests/UDFRoundTripTests.swift` L92-95).
- **`webID`:** `<webID id="…" resolver="hvl-default">`, `styles`'tan sonra gelir. Görüntüleme için yok sayılır [ORN], [DIL L90].

## 3. Metin havuzu ve ofsetler

- **Havuz:** Belgenin bütün metni, `template`'in doğrudan çocuğu olan `<content>` içindeki CDATA'dadır.
  - Paragraf içindeki `<content startOffset=…>` yaprakları başka bir şeydir. Ayrım: havuz öğesi `template`'in çocuğudur ve `startOffset` taşımaz [NBP L215-226].
  - Havuzu `textContent` ile alın; birden çok CDATA ya da metin düğümü varsa birleşir.
- **Bağlantı:** Her yaprak havuza `startOffset` + `length` ile bağlanır [TK L79-86]. Önce ham havuz dilimlenmeli, temizlik (kırpma, dönüştürme) sonra yapılmalı [PRV rune.rs L8-10].
- **Ofset birimi: UTF-16 kod birimi.** Çelişki var:
  - UTF-16 diyenler: UDE Java/Swing olduğu için [EMD L33], [DIL L108-110], [MIA-D L43], [MIA-U L246, L289]. JS görüntüleyiciler de dizeyi doğrudan dilimler [LEG L577-582], [FLY-P L150], [NBP L235-240].
  - Kod noktası (rune) diyenler: [CLI-R L295], [TK L83], [GKS-M L140-163], [PRV rune.rs L1-6], [RES-S L4-5], [RES-J L87 `codePointCount`].
  - Pratikte fark yalnız BMP dışı karakterde (emoji) çıkar. Gerçek örneklerde BMP dışı karakter 0, UTF-16 uzunluğu kod noktası sayısına eşit [ORN]. Editör BMP dışı karakter içeren dosyayı zaten açamıyor [MIA-R L56].
  - **Öneri:** JS dize dizinini doğrudan kullanın.
  - Düzeltme: Görev A NB_PDF'in kod noktası saydığını yazmıştı; kod `String.slice` kullanıyor, yani UTF-16 sayıyor [NBP L239].
- **Paragraf sonu:** Her paragraf havuzda `\n` ile biter [TK L85], [RES-S L137-138], [MIA-D L25].
- **Gerçek UYAP'ta kaplama** [DIL L57-69], [ORN, 109 ve 288 yaprakta ölçüldü]:
  - Yapraklar havuzu boşluksuz ve çakışmasız kaplar.
  - Belge sırasında ofsetler hiç geri gitmez.
  - Havuzun en sondaki `\n`'i hiçbir yaprağa ait değildir.
- **Paragrafın `\n`'i** paragrafın son yaprağına aittir. Bunun iki biçimi var:
  - UYAP ve UDE çoğunlukla ayrı bir `<content length="1"/>` koyar [ORN], [RES-TD], [RES-DOG L135-136].
  - Yazıcılar son metin parçasının uzunluğunu 1 artırır [RES-S L210-213], [RES-J L186-188]. Paragrafın son öğesi resimse `\n` kapsanmaz [RES-S L222].
  - Görüntüleyici paragrafın son metninden tek bir sondaki `\n`'i atmalı [LEG L673-679], [MIA-U L571-575].
- **Boş paragraf:** üç farklı biçim görülüyor.
  - UYAP: yalnız `\n`, `length="1"` olan bir content ile kaplanır [ORN].
  - Yazıcılar: `\u200B\n`, `length="2"`, Times New Roman 10 [RES-S L107-110, L201-205], [RES-J L180-181], [CLI-R L300].
  - [TK L329-333]: U+200B ve `length="1"`.
  - Görüntüleyici U+200B'yi atmalı [CLI-P L147-148] ve paragrafı bir satır yüksekliğinde (&nbsp;) çizmeli [FLY-R L93-95], [LEG L961-965].
- **Resim yer tutucusu:**
  - Gerçek UYAP ve UDE çıktısında **U+00B8 ('¸')**. Kanıtlar: [MIA-U L46 `IMG_CHAR`], [MIA-D L25-26], [ORN: 4 resmin 4'ünde U+00B8, U+FFFC sayısı 0], [RES-TD: turnusol.udf'te ofset 3'teki resmin karakteri U+00B8].
  - Yazıcılar U+FFFC kullanır [RES-S L20-21], [CLI-R L299], [TK L86, L519].
  - **Kural:** Resim (ve barkod) yaprağının kapladığı havuz karakteri asla metin olarak çizilmez.
- **Sekme:** `\t` (U+0009) hem `<tab>` yaprağında hem de `content` metninin içinde bulunabilir [DIL L103-104], [TK L362-370]. Sekme her yerde işlenmeli.
- **Havuzdaki sıra:** Önce üst bilgi metni, sonra gövde (tablo hücreleri dâhil), en son alt bilgi metni [MIA-D L24-26], [TK L81], [ORN: Üst bilgi ofset 0'da, alt bilgi sonda].
  - Görüntüleyici bu sıraya dayanmamalı; her yaprağı kendi ofsetinden dilimlemeli.
- **Tablo hücreleri:** Hücre paragrafları havuzu satır satır, soldan sağa, iç içe tablolarda da özyinelemeli olarak sırayla tüketir [RES-J L106-112], [ORN: ofsetler 789..822 hücre hücre ilerliyor].
- **CR:** XML çözücüler CDATA içinde de CRLF'yi LF'ye çevirir. UYAP çıktısında CR olmadığı için kayma olmaz [ORN], [DIL L47].
  - Başka üreticilerde CR varsa ofset kayabilir; bu durum ölçülmedi. Evrak dilimledikten sonra CR'yi temizliyor [EVR L962].
- **Metinde `]]>`:** Yazıcılar bunu `]]&gt;` diye bozuyor (kayıplı) [RES-S L319-322]. UDE'nin ne yaptığı **bulunamadı**.
- **Ofset doğrulama:** legaluga sınır dışı dilimi kırpıp sayar [LEG L577-582]; evrak-md hata fırlatır [EMD L31-32]. **Öneri:** kırpın ve sayın.
  - `elements` çözülemezse havuzu düz metin olarak gösterin [NBP L400-412], [EMD L84].
  - Bu eklentinin motoru bunu yapmaz: Gövdesi (`elements`) olmayan `template`'i ve kökü `template` olmayan, `elements`'ı da olmayan sağlam XML'i "Dosya bir UDF belgesi değil." iletisiyle reddeder (kod `udf-degil`). Bozuk XML "XML bozuk" iletisiyle reddedilir.

## 4. properties

### pageFormat

Bütün uzunluklar punto (1/72 inç) [TK L99], [RES-M L92-118].

- **`mediaSizeName`:** Kâğıt kodu. Kaynaklar yalnız 1 = A4 (595.28 × 841.89) konusunda anlaşıyor.
  - [MIA-D L1500-1502] (Editör motorunda ölçülmüş): 2 A5 (419.5 × 595.3), 3 Letter (612 × 792), 4 B5 (515.9 × 728.5), 5 Legal (612 × 1008), 6 Executive (522 × 756).
  - [LEG L544]: 2 Letter, 3 Legal.
  - [GKS-M L9-14]: 5 Letter, 6 Legal, 11 A5.
  - [PAD types.ts L122-126]: 0 Letter, 2 Legal.
  - **Öneri:** MIA eşlemesi. Gerçek örneklerde hep 1 [ORN].
- **`paperOrientation`:** 1 dikey, **0 yatay**. Bu `java.awt.print.PageFormat` sabitleridir: LANDSCAPE=0, PORTRAIT=1, REVERSE_LANDSCAPE=2 [JDK PageFormat L49-63].
  - Aynı yorum: [MIA-D L1960], [MIA-U L327], [TK L121], [GKS-M L26], [PAD types.ts L128-131]. Evrak 0 ve 2'yi yatay sayar [EVR L264].
  - **Çelişki:** [LEG L546] ve [NBP L366] yalnız 2'yi yatay sayıyor, 0'ı dikey çiziyor; büyük olasılıkla hatalı. **Öneri:** 0 ya da 2 ise yatay.
- **`leftMargin`, `rightMargin`, `topMargin`, `bottomMargin`:** punto.
  - UDE kayan nokta gürültüsü yazar (42.525000000000006, 70.8661413192749) [RES-TD], [ORN], [RES-DOG L137-138].
  - Yazıcı varsayılanları 42.52 / 28.35 / 14.17 / 14.17 [RES-M L104-118], [TK L114-123]. Gerçek örneklerde 70.875 ve 56.69… [ORN].
  - Öznitelik yoksa kullanılan değer kaynağa göre değişiyor: [LEG L548] 42.52 / 28.35 / 42.52 / 14.17; [MIA-U L330-331] 70.85.
- **`headerFOffset`, `footerFOffset`:** punto.
  - [MIA-U L1013] bunları Word'ün `w:header` / `w:footer` değerine çeviriyor, yani sayfa kenarından üst ve alt bilgiye olan uzaklık.
  - [RES-M L131-138] ikisini de kenar boşluklarına ek olarak kullanılabilir yükseklikten düşüyor.
  - Görülen değerler: 20/20 (yazıcılar), 15/60 ve 20/20 (gerçek) [ORN], 35.433… [MIA-D L1956].
  - Kesin anlamı **bulunamadı**.

### bgImage (antet ya da filigran)

- Öznitelikler: `<bgImage bgImageSource bgImageData bgImageLeftMargin bgImageUpMargin bgImageRigtMargin bgImageBottomMargin>`. "Rigt" yazımı özgündür [TK L127-140], [MIA-D L1957-1958].
- MIA'ya göre resim her sayfaya, bu paylar düşülerek gerilir ve metnin arkasında durur [MIA-U L22-25, L969-971].
- legaluga resmi yalnız `bgImageWatermark="true"` ise ve %15 opaklıkla çizer [LEG L763-768, L1127].
- `backgroundImageData` ve `arkaplanResmi` adlı varyantlar doğrulanmadı [EVR L255-283].
- **Öneri:** `bgImageData` doluysa çizin; `bgImageWatermark` true ise soluk, değilse tam opak.

## 5. elements: blok öğeler

- **`<elements resolver="hvl-default">`:** Kendi resolver'ı olmayan paragrafların taban stilini belirler [MIA-U L291-295], [NBP L370-380]. Bütün örneklerde değer `hvl-default` [ORN].
- **Çocuklar** belge sırasıyla çizilir: `header`, `paragraph`, `table`, `page-break`, `footer` [TK L144-152], [ORN: header ilk, footer son].
  - Sıra korunmalı. udfpdf `Object.entries` kullandığı için tabloları paragraflardan sonraya atıyor [GKS-M L50-70].
- **Paragrafsız yaprak:** `elements` altında doğrudan `startOffset` taşıyan öğe kendi paragrafı sayılır [MIA-U L873].
- **Tanınmayan sarmalayıcı:** İçindeki paragraflar sırayla işlenir [MIA-U L878]. Paragraf içinde de yapraklar bir sarmalayıcının içinde olabilir [MIA-U L304-314].
- **`page-break`:** Biçim `<page-break><paragraph>…</paragraph></page-break>`. İçteki paragraf havuzu tüketir; yazıcılarda `\u200B\n`, yani 2 birim [RES-S L93-98, L168-180], [TK L469-477].
  - Editör içteki paragrafta metin varsa onu yeni sayfanın başına koyar [MIA-U L861-870].
  - `pagebreak` ve `pageBreak` adları da kabul edilmeli [LEG L734], [NBP L391-392].
- **`<image>` doğrudan `elements` altında:** legaluga destekliyor [LEG L743, L755]; gerçek örneklerde görülmedi.
- **Sayfalama:** Dosyada açık `page-break` dışında sayfa bilgisi yoktur; Editör sayfayı yerleşime göre kendisi böler. Görüntüleyici ya kesintisiz akış göstermeli ya da kendisi sayfalamalı [EMD L17]. legaluga yalnız açık sayfa sonlarında böler [LEG L723-737].

## 6. paragraph öznitelikleri

Öznitelik adları Swing `StyleConstants` adlarının aynısıdır [JDK StyleConstants L69-245].

- **`Alignment`:** 0 sola, 1 ortala, 2 sağa, 3 iki yana yasla (Swing ALIGN_LEFT, CENTER, RIGHT, JUSTIFIED) [JDK StyleConstants L252-278], [RES-M L8-15], [NBP L33-35], [TK L245].
  - "1.0" gibi ondalık yazım da tolere edilmeli [MIA-U L658]. Sözcük biçimleri: [LEG L519].
- **`LeftIndent`, `RightIndent`:** punto [JDK L195-202]. Yazıcılar her zaman yazar [RES-S L193-199].
- **`FirstLineIndent`:** punto, LeftIndent'e göre görelidir ve eksi olabilir [JDK ParagraphView L1157-1166]. Gerçek değerler: 35.4375, 42.617… [ORN].
- **`Hanging`:** UDE'ye özgü, Swing'de yok.
  - Model: ilk satır LeftIndent + FirstLineIndent'ten, devam satırları LeftIndent + Hanging'den başlar [MIA-U L647-653], [MIA-D L1826-1827].
  - CSS karşılığı: `padding-left: L+H; text-indent: F−H`.
  - legaluga ve udfly bu özniteliği yok sayıyor. Gerçek değerler: 0.0 ve 145.14285 [ORN].
- **`LineSpacing`:** Satır yüksekliğine **eklenen** oran.
  - Swing tanımı "factor of the line height": her satırın alt payına satır yüksekliği × LineSpacing eklenir [JDK StyleConstants L205-209; ParagraphView L1168-1172].
  - Aynı yorum: 0.5 = 1,5 satır [DIL L98-99], [FLY-R L181-188], [MIA-U L637], [MIA-D L202], [TK L249].
  - CSS karşılığı (çelişki): legaluga `1.15 × (1 + LS)` [LEG L922]; Evrak LS ≤ 0 ise 1.15, değilse 1 + LS [EVR L437-440]; udfly `1 + LS`.
  - **Öneri:** Times New Roman'ın doğal satır yüksekliği yaklaşık 1.15 olduğu için `1.15 × (1 + LS)`.
- **`SpaceAbove`, `SpaceBelow`:** punto [JDK L211-221]. Swing'de paragraf iç payıdır ve birbirine katlanmaz (collapse yok).
  - Bu yüzden `padding` kullanılmalı [LEG L920-921]. `margin` kullanılırsa çakışıp küçülür [FLY-R L175-180].
  - legaluga `SpaceBefore` ve `SpaceAfter` adlarını da kabul ediyor [LEG L646]; gerçek dosyada görülmedi.
- **`TabSet`:** Biçim `"konum:hiza:öncü,…"` [TK L252-256], [MIA-U L519-548].
  - Konum punto cinsindendir ve **paragrafın LeftIndent'ine görelidir** [MIA-U L520-521]; Swing'de de `tabBase` sol iç paydır [JDK ParagraphView L414, L571].
  - Hiza değerleri Swing `TabStop` sabitleridir: 0 sola, 1 sağa, 2 ortaya, 4 ondalık, 5 çizgi [JDK TabStop L49-63], [MIA-U L54].
  - Öncü: 0 yok, 1 nokta, 2 tire, 3 alt çizgi, 4 kalın çizgi, 5 eşittir [JDK TabStop L71-81], [MIA-U L55].
  - **Çelişki:** [TK L255-256] 1 = orta, 2 = sağ, 3 = ondalık diyor; Swing ve MIA'ya ters. Gerçek dosyada `69.0:2:0` (orta) var [ORN].
  - TabSet yoksa: Swing her 72 puntoda bir durak koyar [JDK L416-419]; legaluga 36 punto kullanır [LEG L948]; MIA'nın `defaultdefault` stili 36 puntoluk duraklar yazar [MIA-D L1973].
  - Stok Swing'de iki yana yaslı, ortalı ve sağa yaslı paragrafta sekme yalnız 10 birimdir; son duraktan sonraki sekme +5 birimdir [JDK ParagraphView L411-425]. UDE'nin kendi görünümünde aynı mı, **doğrulanmadı**.
- **Listeler:** `Bulleted`, `Numbered`, `NumberType`, `BulletType`, `ListId`, `ListLevel`, `SecListTypeLevelN`, `NumberSetted` (§10).
- **`resolver`:** Stil adı (Swing ResolveAttribute = "resolver") [JDK StyleConstants L75].
- **Şablon öznitelikleri `GroupName`, `RepeatingLabel`:** [ORN]'de var; belgelenmiş anlamı **bulunamadı**. Görüntülemede yok sayın.
- **Paragrafta karakter öznitelikleri** (`family`, `size`, `description`) de bulunabilir [ORN]. Resolver'ı olmayan yapraklar bunları devralır (§9).

## 7. Satır içi (yaprak) öğeler

Ortak öznitelikler: `startOffset`, `length`, karakter öznitelikleri ve `resolver`.

- **`content`:** Metin parçası.
  - Paragraf özniteliklerini (Alignment, LeftIndent…) taşıyabilir; bunlar yok sayılır [ORN].
  - `header="true|false"` özniteliği görüldü; anlamı **bulunamadı** [ORN].
  - UDE'nin kaydettiği dosyada resimden sonraki `\n`'i kaplayan content üzerinde artık `width` ve `height` kalabiliyor; yok sayın [RES-TD].
- **`field`:** Şablon alanı. Havuzda **doldurulmuş değer** durur; havuz dilimi çizilir.
  - Öznitelikler: `fieldName`, `fieldType` (görülen: 1), `isList`, `isErasable`, `fieldGroupName` [DIL L85], [ORN].
  - Kökte `<data>` varsa legaluga değeri oradan alır: özel alan adları `auto`, `eol`, `ceol` [LEG L585-603].
- **`space`:** Havuzda genellikle " ". `fieldName` ve `fieldGroupName` taşıyabilir [TK L459-466], [ORN]. Havuzdan dilimleyin; NBP gibi " " yedeği kullanılabilir [NBP L264-267].
- **`tab`:** `\t`, `length="1"` [TK L362-370].
  - udf-cli bu öğeyi düşürüyor; bu bir hata [CLI-P L187-189]. udfly'ın notu: düşürülünce sütunlar birbirine yapışır [FLY-P L128-130].
- **`image`:** `imageData` (base64), `startOffset`, `length="1"`, isteğe bağlı `width` ve `height` (punto) [TK L337-353], [RES-M L45-53].
  - base64'te UDE 76 karakterde bir LF koyar (MIME); boşluklar silinmeli [RES-DOG L132-134], [RES-TD], [ORN], [NBP L166-168], [LEG L367].
  - `data:` ön eki yazıcılarda yok [RES-S L245-253], legaluga varsa da tolere eder [LEG L366].
  - **Biçim (çelişki):** UDE 5.4.20 JPEG'i kabul ediyor [RES-DOG L40-44]; MIA Editör'ün yalnız PNG desteklediğini söylüyor [MIA-R L55]. Sihirli baytla tür belirleyin (PNG, JPEG, GIF, BMP) [LEG L337-360].
  - **Boyut:** `width` ve `height` puntodur. Gerçek UYAP örneğinde ikisi de **yok** [ORN].
    - Yoksa UDE kuralı 1 piksel = 1 punto [RES-MOD L95-98], [RES-DOG L24].
    - **Çelişki:** legaluga ve MIA piksel × 0.75 kullanıyor (96 DPI varsayımı) [LEG L386-391], [MIA-U L602].
    - **Öneri:** piksel = punto. Metin genişliğine orantılı küçültün [LEG L394], [MIA-U L604].
  - Resim öğesi yazı tipi öznitelikleri de taşıyabilir (resolver, family…); bunlar yok sayılır [ORN].
- **`barcode`:** Editör dosyalarında var; metninde '¸' yer tutucusu bulunur [MIA-U L563-565]. Nasıl çizildiği **bulunamadı**.
- **`startOffset` taşıyan tanınmayan öğe:** Metin kaybolmasın diye metin olarak çizin [LEG L666-671], [MIA-U L567-568].

## 8. Karakter öznitelikleri ve renk

- **Adlar:** `family`, `size`, `bold`, `italic`, `underline`, `strikethrough`, `superscript`, `subscript`, `foreground`, `background` [JDK StyleConstants L103-162], [MIA-U L56-57]. Mantıksal değerler "true" / "false".
- **`size`:** punto, çoğunlukla tamsayı; Swing `getFontSize` int döndürür [JDK L378-384]. Yazıcılar ondalık da yazabiliyor [RES-S L310-317].
- **`family`:**
  - Java'nın mantıksal adları (Dialog, SansSerif, Serif, Monospaced, DialogInput) CSS genel ailelerine eşlenir [LEG L806-815]. MIA belgede Dialog'u Times New Roman çizer [MIA-U L255, L453].
  - Gerçek örneklerde görülen yazı tipleri: Times New Roman, Arial Narrow, Segoe Script [ORN], [MIA-D L1871].
  - Yazı tipi adı CSS'e konmadan arındırılmalı [FLY-R L220-230], [LEG L813].
- **Renk:** İşaretli 32 bit tamsayı, yani Java `Color.getRGB()` ARGB değeri. RGB = `(n >>> 0) & 0xFFFFFF` [RES-M L24-27], [TK L497-513], [LEG L328-334], [GKS color.ts `argbToCSS`].
  - Görülen değerler: -16777216 siyah; -1 beyaz; -65536 kırmızı; -13421773 #333333; -8355712 #808080; -4194304 #C00000 [TK], [DIL L97-98], [ORN].
  - İşaretsiz yazım da var (`fillColor="16777215"`) [RES-J L237], [CLI-P L252]. Her iki biçim de 32 bit olarak ayrıştırılmalı.
  - **Alfa:** legaluga atıyor. Java başvurusuna göre hücrede `borderColor="0"` (alfa 0) UDE'de kenarlığı görünmez yapıyor [RES-J L238-240]. Buna göre alfa 0 = saydam.
  - `background="-1"` = zemin yok.
- **Alt simge:** Editör alt simgeyi de yukarıda çizer; bu bir tuhaflık [MIA-R L57].
- **Varsayılan boyut (çelişki):** [TK L529] 11 diyor; gerçek dosyaların hepsinde `hvl-default` 12 [ORN], [RES-S L78-80]. Hiçbir şey çözülmezse Swing'in varsayılanı Monospaced 12'dir [JDK L354-384]. **Öneri:** Times New Roman 12.

## 9. Stiller ve stil çözümleme

- **Biçim:** `<styles><style name description resolver family size bold italic foreground FONT_ATTRIBUTE_KEY … />`. Stiller paragraf özniteliği de taşıyabilir (Alignment, LeftIndent…) [TK L156-165], [ORN].
- **Standart stiller:**
  - `default` ("Geçerli", Dialog 12, foreground -13421773, `FONT_ATTRIBUTE_KEY=javax.swing.plaf.FontUIResource[…]`): Swing arayüzünün stilidir, belge metninin tabanı değildir [RES-S L72-77], [LEG L431-432].
  - `hvl-default` ("Gövde", Times New Roman 12): gövde tabanı.
  - Kullanıcı stilleri `edf_<epoch-ms>` adını taşır ve `resolver="hvl-default"` ile bağlanır [DIL L96], [ORN: 24 stil].
  - MIA'nın yazıcısı bir de `defaultdefault` stili ekliyor [MIA-D L1973].
- **Üst stil bağlantısı** `resolver` özniteliğiyle kurulur [JDK StyleConstants L75]. legaluga `parent` adını da kabul ediyor [LEG L427]; gerçek dosyada görülmedi.
- **Çözümleme kuralı (Swing):** Kendi resolver'ı olmayan öğe, üst öğesinin özniteliklerine çözülür [JDK AbstractDocument L1987-1993].
  - **Paragraf:** kendi öznitelikleri, sonra kendi resolver zinciri. Resolver yoksa `elements@resolver`, o da yoksa `hvl-default` [MIA-U L291-295].
  - **Yaprak:**
    - Kendi öznitelikleri önce gelir.
    - Kendi resolver'ı varsa **yalnız o stil zinciri** uygulanır; paragrafın öznitelikleri devralınmaz [MIA-U L296-302], [LEG L626-632].
    - Resolver'ı yoksa paragrafın çözülmüş özniteliklerini devralır.
  - udfly önceliği ters kuruyor (paragraf, yaprağın zincirini eziyor) [FLY-P L141-148]; udfpdf tek düzey çözüyor [GKS-S `resolveStyle`]. İkisi de Swing'e uymuyor.
  - Döngü koruması şart [LEG L433-449].
- **`default` stiline çözülen yaprak** (gerçek örnekte 40 content'in 4'ü [ORN]):
  - legaluga zincirde `default`'u atlıyor [LEG L443].
  - UDE'nin bunu Dialog ve #333333 olarak mı çizdiği **bulunamadı**. Öneri: legaluga ve MIA gibi belge tabanını kullanın.
  - Bu eklentinin motoru böyle yapar: `default`'a bağlı yaprak paragrafı değil belge tabanını alır. Tanımsız bir stil adına bağlı yaprakta ad yok sayılır, yaprak paragrafı devralır (Swing'de çözülemeyen resolver yok sayılır, öğe üst öğesine çözülür).

## 10. Listeler

- **Paragraf öznitelikleri:** `Numbered="true"` ya da `Bulleted="true"`, `NumberType` / `BulletType`, `ListId`, `ListLevel`, `SecListTypeLevelN`, `NumberSetted` [TK L258-297], [MIA-U L337-371], [CLI-P L211-228], [RES-J L165-176].
- **`ListLevel` tabanı (çelişki):**
  - MIA (Editör'de sınanmış) 1..9, varsayılan 1 [MIA-U L386-390], [MIA-D: llv = ilvl + 1]. Evrak'ta da varsayılan 1 [EVR L442].
  - [TK L297] "0'dan başlar"; legaluga 0..8 kullanıyor [LEG L609].
  - **Öneri:** 1 ve altını en üst düzey sayın.
- **`NumberType` adları** (Editör sınıf sabitlerinden okunmuş, motorla çizdirilmiş) [MIA-D L389-392]:
  - Biçim `NUMBER_TYPE_<NUMBER|CHAR_SMALL|CHAR_BIG|ROMAN_SMALL|ROMAN_BIG>_<DOT|PARANTHESE|D_PARANTHESE|TRE>`.
  - Ekler sırasıyla "1.", "1)", "(1)", "1-" çizer [MIA-U `label()`].
  - **Çelişki:** [TK L272-283] `…_PARENTHESIS` yazımını kullanıyor. **Öneri:** iki yazımı da tanıyın.
  - **legaluga hatası:** `/PAREN/` ve `/LETTER|ALPHA|HARF/` düzenli ifadeleri `PARANTHESE` ve `CHAR` türlerini yakalamıyor, bu listeleri "1." diye çiziyor [LEG L528-539].
- **Harfli liste:** 29 harfli Türk alfabesiyle sayılır (a b c ç d e f g ğ h ı i j k l m n o ö p r s ş t u ü v y z). z'den sonra aa, bb… gelir [MIA-U L79-80, L129-133], [MIA-R L72]. Romen rakamları küçük ve büyük harfle.
- **`BulletType`:** ELLIPSE •, RECTANGLE ▪/■, RECTANGLE_D □/▫, ARROW ➢/➤, DIAMOND ◆, DIAMOND_2 ◊/◆, TRIANGLE ▶/▲. Kaynaklar farklı glif seçiyor [TK L285-295], [MIA-U L81-82].
- **Alt düzeyler:** `ListLevel ≥ 2` olduğunda Editör NumberType ve BulletType'a bakmaz [MIA-U L64-68, L337-371], [MIA-D L420-423]. Evrak da SecListTypeLevel kullanıyor [EVR L443].
  - Paragrafın kendi `SecListTypeLevel<N>` değerini kullanır.
  - Yoksa varsayılanlar: düzey 2 "a.", 3 "i.", 4 "(1)", 5 "(a)", 6 "(i)".
  - Madde işaretlerinde: düzey 2 RECTANGLE, 3 RECTANGLE_D.
- **Sayaç:**
  - Her `ListId` için ayrı tutulur.
  - Daha sığ düzeyde bir kalem gelince derin düzeylerin sayacı sıfırlanır.
  - `NumberSetted=n` olan kalem n+1'den sayılır [MIA-U L350-363, L392-402], [MIA-D L423].
  - ListId yoksa legaluga art arda gelen aynı türdeki paragrafları tek liste sayar [LEG L611-612].
- **Yerleşim:**
  - Numara metnin yaklaşık 6 punto soluna sağa yaslı çizilir; madde işareti yaklaşık 18 punto sola.
  - Metin ve devam satırları LeftIndent'te başlar [MIA-U L59-60, L643-645], [MIA-D L1821-1822].
  - legaluga bunun yerine girintiye düzey × 18 punto ekliyor [LEG L638]; Editör'den farklı.

## 11. Tablolar

- **Yapı:** `<table tableName columnCount columnSpans border>` > `<row rowName rowType [columnSpans] [height] [border]>` > `<cell …>` > bloklar (paragraf, iç içe tablo) [TK L372-431], [CLI-P L237-295], [RES-J L208-245].
- **Gerçek UYAP'ta:** yalnız `<table border="borderNone">`; `row` ve `cell` özniteliksiz; `columnCount` ve `columnSpans` yok [ORN]. Java başvurusu da "gerçek UDE dosyalarında hücreler daima çıplak" diyor [RES-J L238-240].
- **`columnSpans` göreli ağırlıktır.**
  - Editör toplamın 100 × sütun sayısı olmasını bekler [MIA-D L1248].
  - [TK L393] punto diyor; Java başvurusu yuvarlanmış genişlik yazıyor [RES-J L212-217].
  - Bütün görüntüleyiciler orana çeviriyor [LEG L685-686, L972-980], [NBP L332-335]. Değer yoksa sütunlar eşit.
- **`columnCount`:** İsteğe bağlı. Yoksa satırlardaki en çok hücre sayısı alınır [NBP L330-331], [LEG L709-713].
- **Satır düzeyinde `columnSpans`:** Editör yatay hücre birleştirmeyi böyle yazar: satırda daha az hücre olur ve satırın kendi `columnSpans`'ı bulunur [MIA-R L51, L75], [MIA-U L682-688], [MIA-D L1908-1909], [EVR L860-875].
  - Kural: Satırın columnSpans sayısı hücre sayısına eşitse onu kullanın. Değilse tablonun columnSpans'ı eşitse onu, o da değilse eşit dağıtın.
- **`colspan`, `rowspan` (hücrede):**
  - Yazıcılar ve legaluga küçük harf kullanıyor [RES-J L235], [CLI-P L249-250], [LEG L699-700]; udfpdf ve evrak-md `colSpan`/`rowSpan` [GKS-M L212-213], [EMD L64]. Öznitelik araması büyük/küçük harfe duyarsız olmalı [LEG L309-316].
  - Dikey birleştirme MIA'ya göre Editör'de yok; iç içe tabloyla taklit ediliyor [MIA-R L50]. legaluga ve udf-cli `rowspan`'ı uyguluyor.
- **Tablo `border` değeri** [MIA-U L765-773]:
  - `borderCell`: bütün çizgiler (varsayılan).
  - `borderTable`: yalnız dış çerçeve.
  - `borderRow`: dış çerçeve ve yatay çizgiler.
  - `borderNone`: çizgi yok.
  - legaluga none/borderNone dışındaki her değeri tam kenarlık sayıyor [LEG L687-688]; udfly yalnız borderNone'u ayırıyor [FLY-R L84-87].
- **Hücre öznitelikleri** (yazıcılar ve belgeler; Editör'deki durumu tartışmalı):
  - `align`: top, vcenter, bottom [TK L436], [CLI-P L101-110], [RES-J L273].
  - `fillColor`.
  - `border`, `borderStyle` (borderStyle-solid, dotted, dashed, double), `borderWidth` (punto), `borderColor`.
  - `borderSpec` bit maskesi: 1 üst, 2 sağ, 4 alt, 8 sol; 15 = hepsi [TK L438-453], [CLI-R L298], [EVR L923-940].
  - MIA'ya göre Editör'de hücre dolgusu ve dikey hiza yok [MIA-R L48-49]. Dolgu, yazının zemin rengiyle taklit ediliyor (NBSP bandı) [MIA-U L578-588].
  - Hücreye `borderColor="0"` yazılırsa tablo kenarlığı UDE'de görünmez oluyor [RES-J L238-240].
- **`rowType`:** `dataRow` ya da `headerRow`. headerRow tekrarlanan başlık satırıdır [MIA-U L707, L786]; Evrak bu satırı kalın çizer [EVR L945]. Şablon `<data>` ile satır çoğaltma: [LEG L457, L691-695].
- **Satır `height`:** punto [TK L398-412].
- **Hücre iç payı:**
  - Editör'de iç pay yok; yazıcılar payı paragrafın LeftIndent ve RightIndent değerine ekliyor [MIA-D L1831]. Gerçek hücre paragraflarında LeftIndent 3.0, RightIndent 1.0 [ORN].
  - [TK L455] "5,4 punto" diyor; doğrulanmadı.
  - **Öneri:** iç payı 0'a yakın tutun, girintiye güvenin. legaluga 2 punto kullanıyor [LEG L1121].

## 12. Üst bilgi, alt bilgi, sayfa numarası

- **Konum:** `<header>` ve `<footer>` `elements`'ın çocuklarıdır; içlerinde paragraf ve resim bulunur [TK L185-213]. Gerçek dosyada header ilk, footer son çocuk [ORN].
- **Birden çok varsa (çelişki):** Editör **sonuncusunu** alır [MIA-U L927-933]; legaluga **ilkini** alıyor [LEG L739-741].
- **Sayfa aralığı:** `startPage` ve `stopPage`.
  - `stopPage="1"`: yalnız ilk sayfa. `startPage="2"`: 2. sayfadan itibaren [MIA-U L935-941], [MIA-D L10].
  - Gerçek dosyada header `startPage="2"` [ORN].
  - udfly bu değer sayfa sayısını aşarsa gizliyor [FLY-R L51-58]; legaluga yok sayıyor.
- **header ve footer üzerindeki `foreground` / `background`:** Gerçek değerler -8355712 ve -1 [ORN]. Etkisi **bulunamadı**.
- **Sayfa numarası (footer öznitelikleri):**
  - `pageNumber-spec="BSP32_<n>"` bir bit kümesidir: 8 = numara göster, 32 = ortala, 64 = sağa (ikisi de yoksa sola), 2048 = "sayfa/toplam" [MIA-D L1592], [MIA-U L889-911].
  - Örnekler: `BSP32_2120` = 8 + 64 + 2048, yani sağda "n/N" [ORN], [MIA-D L1865]. `BSP32_40` = 8 + 32 [TK L203]. `BSP32_0` = numara yok [MIA-D L1870].
  - Diğer öznitelikler: `pageNumber-foreStr` (ön ek), `pageNumber-afterStr` (son ek), `pageNumber-seperator` ("seperator" yazımı özgün, varsayılan "/"), `pageNumber-fontFace`, `-fontSize`, `-fontBold`, `-fontItalic`, `-fontUnderline`, `-color`, `pageNumber-pageStartNumStr` (başlangıç numarası) [MIA-U L897-910, L997-998], [TK L215-222], [DIL L87].
  - Editör numara için alt bilginin sonuna boş bir paragraf ayırır [MIA-U L961].

## 13. documentproperties.xml ve sign.sgn

- **`documentproperties.xml`:** Java Properties XML biçimindedir:
  ```xml
  <!DOCTYPE properties SYSTEM "http://java.sun.com/dtd/properties.dtd">
  <properties>
    <entry key="uyapdogrulamakodu">…</entry>
    <entry key="uyapsicil">…</entry>
  </properties>
  ```
  - Kaynaklar: [ORN], [DIL L28], [FLY-P L21-36]. Görülen değer uzunlukları 8 ve 7 karakter [ORN].
  - Dosya DOCTYPE taşıdığı için `content.xml`'deki DTD reddi buna uygulanmamalı. Tarayıcı DOMParser dış DTD'yi indirmez; istenirse düzenli ifadeyle de okunabilir.
- **`sign.sgn`:** İkili DER, CMS SignedData, ayrık (detached) imza.
  - İmzalı özniteliklerdeki messageDigest (OID 1.2.840.113549.1.9.4), **ham `content.xml` baytlarının SHA-256 özeti**dir.
  - Kaynaklar: [PAD cms.ts L1-6, L286-300]. İki gerçek örnekte burada hesaplanıp eşleştiği görüldü [ORN].
  - Tarayıcı WebCrypto ile özeti yeniden hesaplayıp "içerik imzayla tutarlı" diyebilir. Sertifika zinciri doğrulamasını hiçbir açık görüntüleyici yapmıyor; legaluga yalnız imzanın varlığını gösteriyor [LEG L800].
  - Bu eklentinin motorunda durum üçtür: `tutarli` (özet içerikle tutuyor, rozet "E-imzalıdır"), `tutarsiz` (tutmuyor, uyarı "E-imza içerikle uyuşmuyor") ve `bilinmiyor` (imza dosyası var ama karşılaştırılamadı: Özet okunamıyor ya da uzunluğu tanınmıyor, dosya açılamadı, kökte tek değil). `bilinmiyor`da nötr "E-imza dosyası var, içerikle karşılaştırılamadı" rozeti çıkar. İmza ve sertifika doğrulanmaz.

## 14. format_id sürümleri

- **1.8 güncel sürüm.** UDE 5.4.20 durum çubuğunda "Belge Sürüm : 1.8(güncel)" yazıyor [RES-DOG L12-13]. Bütün gerçek örnekler 1.8 [ORN], [DIL L46].
- **1.7** bazı yazıcılarda ve test dosyalarında geçiyor:
  - Neyazikkikaderebak/katipuyapuzantisi `src/inject.js` L1009.
  - KilimcininKorOglu/udf-ve-usb-eimza `UDFRoundTripTests.swift` L92.
- **1.7 ile 1.8 arasındaki farkı anlatan kaynak bulunamadı.** legaluga 1.8 dışını "doğrulanmadı" diye işaretliyor ama yine de çiziyor [LEG L281-282].
- Kök öğenin `<document>` olabildiği ve `resolver="hvl-oncesi"` varyantı iddiaları doğrulanmadı [DIL L140-142].

## 15. Bilinen tuhaflıklar (kontrol listesi)

1. Resim yer tutucusu UDE ve UYAP'ta U+00B8 ('¸'), yazıcılarda U+FFFC. Görüntüleyici karaktere bakmamalı; resim yaprağının kapladığı aralığı çizmemeli.
2. Boş paragraf üç biçimde görülür: `\n` (length 1), `\u200B\n` (length 2) ve `\u200B` (length 1).
3. Paragraf sonu `\n` ya ayrı bir content'tedir ya da son parçanın içindedir; resimden sonra kapsanmamış olabilir.
4. Havuzun en sonundaki `\n`'i hiçbir yaprak kaplamaz.
5. base64 içinde LF var; boşluklar silinmeli.
6. Resimde width ve height olmayabilir; bu durumda piksel = punto.
7. Yerel başlıkta boyut ve CRC 0 (veri tanımlayıcı); merkezî dizinden okunmalı.
8. Kayan nokta gürültüsü: 42.525000000000006 gibi değerler.
9. `<content>` adı iki anlamda kullanılır: havuz ve yaprak.
10. Yapraklarda ilgisiz öznitelikler (Alignment, width, height, header) bulunabilir; yok sayılmalı.
11. Öznitelik adlarının büyük/küçük harfi tutarsız (colspan / colSpan).
12. Yazım hataları özgündür: `bgImageRigtMargin`, `pageNumber-seperator`, `NUMBER_TYPE_…_PARANTHESE`.
13. `paperOrientation` 0 = yatay.
14. `LineSpacing` ve `TabSet` Swing anlamındadır: LineSpacing eklemeli, sekme konumu LeftIndent'e göreli.
15. Stil çözümlemesinde resolver'ı olan yaprak paragrafı devralmaz.
16. Sekme hem `<tab>` öğesinde hem metnin içinde olabilir.
17. Harfli liste Türk alfabesiyle sayılır.
18. Gerçek tablolarda sütun bilgisi yok, hücreler çıplak.
19. Üst ve alt bilgi `startPage` / `stopPage` ile sayfa aralığına bağlı.
20. Editör BMP dışı karakterleri desteklemiyor.

## 16. Çelişkiler özeti

| Konu | Seçenekler (kaynak) | Öneri |
|---|---|---|
| Ofset birimi | UTF-16 [EMD, DIL, MIA, LEG, NBP, FLY] / kod noktası [CLI, TK, GKS, PRV, RES-S, RES-J] | UTF-16 (JS dizini); BMP içinde fark yok |
| Resim karakteri | U+00B8 [MIA, ORN, RES-TD] / U+FFFC [RES-S, CLI, TK] | Karaktere bakma |
| paperOrientation yatay | 0 [JDK, MIA, TK, GKS, PAD] / 2 [LEG, NBP] / 0 ve 2 [EVR] | 0 ya da 2 |
| mediaSizeName (A4 dışı) | MIA / LEG / GKS / PAD dört ayrı tablo | MIA (Editör'de ölçülmüş) |
| LineSpacing CSS | 1.15(1+LS) [LEG] / 1+LS [FLY] / LS 0 ise 1.15, değilse 1+LS [EVR] | 1.15(1+LS) |
| TabSet hiza kodu | Swing: 1 sağ, 2 orta [JDK, MIA] / 1 orta, 2 sağ [TK] | Swing |
| ListLevel tabanı | 1 [MIA, EVR] / 0 [TK, LEG] | 1 ve altı = en üst düzey |
| NumberType yazımı | PARANTHESE [MIA] / PARENTHESIS [TK] | İkisini de tanı |
| Boyutsuz resim | piksel = punto [RES-MOD, RES-DOG] / piksel × 0.75 [LEG, MIA] | piksel = punto |
| Birden çok header/footer | sonuncusu [MIA] / ilki [LEG] | Sonuncusu |
| Resim biçimi | JPEG kabul [RES-DOG] / yalnız PNG [MIA-R] | Sihirli baytla tanı, PNG ve JPEG çiz |
| Varsayılan punto | 12 [ORN, RES-S] / 11 [TK] | 12 |
| columnSpans birimi | oran [MIA, bütün görüntüleyiciler] / punto [TK] | Orana çevir |
| Hücre dolgusu ve dikey birleştirme | Editör'de yok [MIA] / var [TK, CLI, LEG] | Varsa uygula |
| Stil önceliği | yaprağın resolver'ı paragrafı keser [JDK, MIA, LEG] / paragraf yaprağı ezer [FLY] | Swing kuralı |
| bgImage | her zaman antet [MIA] / yalnız bgImageWatermark ise filigran [LEG] | Veri varsa çiz; opaklığı bayrağa göre seç |

## 17. Önerilen çözümleme sırası

1. ZIP'i merkezî dizinden açın; boyut, girdi sayısı ve CRC sınırlarını uygulayın.
2. `content.xml`'i kodlamasını tanıyarak metne çevirin. Ön sözde DOCTYPE varsa reddedin, sonra DOMParser ile çözün.
3. Havuzu `template`'in doğrudan çocuğu olan `<content>`'in `textContent`'inden alın.
4. Stil tablosunu kurun; resolver zincirinde döngüye karşı koruma koyun.
5. `elements`'ı belge sırasıyla gezin:
   - paragraf
   - tablo (satır düzeyindeki columnSpans dâhil)
   - page-break
   - header ve footer (sonuncusu; startPage ve stopPage'e göre)
6. Yaprakları havuzdan UTF-16 ile dilimleyin. Resim ve barkod aralığını metin olarak çizmeyin, U+200B'yi atın, paragrafın son `\n`'ini atın.
7. Paragrafı CSS'e çevirin:
   - `padding-left` = L + H
   - `text-indent` = F − H
   - `padding-top` ve `padding-bottom` = SpaceAbove ve SpaceBelow
   - `line-height` = 1.15(1 + LS)
   - Sekmeleri LeftIndent'e göreli TabSet duraklarına göre ve durak hizası dikkate alınarak çizin.
8. Sayfa boyutunu pageFormat'tan alın; bgImage ile sayfa numarasını çizin. `documentproperties.xml`'den doğrulama kodunu ve sicili okuyun; `sign.sgn` varsa SHA-256 özetini karşılaştırın.

## 18. Yeniden kullanılabilir tarayıcı kodu ve lisans

**1. hasanimer/legaluga-uyap-ui `src/extension/udf.js`: MIT, doğrudan alınabilir.**

- Depoda LICENSE dosyası var: "MIT License, Copyright (c) 2026 Hasan İmer Akın". README L181'e göre Hasan İmer Akın'ın bu depodaki kaynakları MIT kapsamında. README L8'deki "UYAP işlem motoru özel kaynaklıdır" notu bu dosyayı kapsamıyor; dosya açık depoda.
- Şart: telif ve izin metni kopyada korunmalı.
- Artıları: bağımlılıksız, zaten MV3'te çalışıyor, güvenlik sınırları var, sayfa yalnız createElement ve textContent ile kuruluyor.
- **Uyarlama gerekenler:**
  - `globalThis.UHD` ad alanı [L7, L1134].
  - CSS'teki `.viewer` ön eki ve `var(--shell-warn-*)` değişkenleri [L1114-1132].
- **Bu şartnameye göre düzeltilmesi gerekenler:**
  - paperOrientation 0 = yatay [L546].
  - mediaSizeName eşlemesi [L544].
  - ListLevel tabanı [L609]; liste numara türleri (CHAR, PARANTHESE, TRE, Türk alfabesi, NumberSetted, SecListTypeLevelN) [L522-539, L605-624].
  - Hanging desteği yok.
  - TabSet'in hiza ve öncü değerleri, sekme tabanının LeftIndent olması [L641-642, L948].
  - Header ve footer'da ilk yerine son öğe; startPage, stopPage ve pageNumber-* yok [L739-741].
  - Boyutsuz resimde piksel = punto [L390].
  - bgImageWatermark olmayan antet [L765].
  - Sayfalama yalnız açık page-break'lerde [L723-737].

**2. mfozmen/udfly `src/parser.js` ve `src/render.js`: MIT, alınabilir.**

- JSZip'e bağlı; JSZip MIT ya da GPLv3 çift lisanslı, MIT seçilebilir.
- HTML'i dize olarak kuruyor (kaçış ve yazı tipi arındırması var).
- Stil önceliği Swing'e uymuyor; italik, resim ve liste yok.

**3. burakayax/NB_PDF_PLATFORM `udf.ts`: MIT, alınabilir.** fflate kullanıyor (MIT). Yalnız modeli kuruyor; çizimi PDF'e yapıyor.

**4. Lisansı uygun ama tarayıcıya hazır olmayanlar:**

- gokselb/udfpdf: Apache-2.0 (SPDX başlıkları). Alınabilir; LICENSE ve NOTICE korunmalı. Node'a bağlı; blok sırası hatası var.
- e-imza/evrak-md: MIT, Node'a bağlı.
- symbuzzer/Evrak: Apache-2.0, Kotlin. Atıfla çevrilebilir.
- saidsurucu/ude-win-x64 Java yazıcısı: MIT. Yalnız yazma yönünde.

**5. Alınmamalı:**

- murataskin/udf-cli: Depoda LICENSE yok; MIT yalnız package.json'da yazıyor. npm sürümü obfuscate edilmiş.
- miasimbilir/udf-cevirici: Özel kullanım koşulları. Ücretsiz kullanım, dağıtım ve değiştirme serbest; satmak ve ücretli bir ürüne katmak yasak; bildirim korunmalı. OSI lisansı değil; bilgi kaynağı olarak kullanın.
- UDF-Toolkit, UDFpad, can-yesilyurt, iseeeva, ugarchance: Lisans yok, yalnız başvuru olarak okunabilir.

**Sonuç:** Eklentinin çekirdeği legaluga `udf.js` (MIT) olabilir; bu şartnamedeki düzeltmelerle uyarlanmalı. Biçim kurallarını doğrulamak için gerçek UYAP ve UDE çıktısına dayanan kaynaklar en güvenilir olanlar: [MIA], [DIL], [ORN], [RES-DOG], [RES-TD].

İncelenen UDF Resimcisi dosyaları (salt okundu, yollar o projenin köküne göre):
- `src-tauri/src/udf/mod.rs`
- `src-tauri/src/udf/model.rs`
- `src-tauri/src/udf/serialize.rs`
- `src-tauri/src/udf/zip.rs`
- `tools/macospasterich/UdeXml.java`
- `tools/macospasterich/UdeDoc.java`
- `DOGRULAMA.md`
- `testdata/turnusol.udf`, `pano-yapistir.udf`, `gizli-kopya-sonuc.udf`, `turnusol.orig.udf` (yalnız yapısı ölçüldü)
