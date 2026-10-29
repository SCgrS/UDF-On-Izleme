import { test } from 'node:test';
import assert from 'node:assert/strict';
import { motorYukle, modelMetni } from './yardimci.mjs';
import { ornekler, Belge, udfZip, sahteImza } from '../araclar/ornek-uret.mjs';

const { motor: M, pencere } = motorYukle();
const O = ornekler();
const oku = ad => M.oku(new Uint8Array(O[ad]));
const tumParagraflar = bloklar => bloklar.flatMap(b => b.t === 'p' ? [b] : b.t === 'tablo' ? b.satirlar.flatMap(r => r.hucreler.flatMap(h => tumParagraflar(h.bloklar))) : []);

test('dilekçe: Bölüm, üst/alt bilgi, belge özellikleri, imza ve notlar', async () => {
  const m = await oku('dilekce.udf');
  assert.equal(m.bolumler.length, 2, 'sayfa sonu iki bölüm verir');
  assert.equal(m.ust.bas, 2);
  assert.equal(m.ust.bitis, null);
  assert.deepEqual({ hiza: m.alt.sayfaNo.hiza, toplam: m.alt.sayfaNo.toplam, ayrac: m.alt.sayfaNo.ayrac }, { hiza: 'right', toplam: true, ayrac: '/' });
  assert.equal(m.ozellikler.dogrulamaKodu, 'AbCd+123');
  assert.equal(m.imza.durum, 'tutarli');
  assert.equal(m.notlar.length, 1);
  assert.equal(m.notlar[0].metin, 'Bu kısım önemli');
  assert.equal(m.notlar[0].kim, 'Deneme Büro');
  assert.equal(m.sayac.ofsetSorunu, 0);
});

test('liste numaraları UYAP türlerine göre', async () => {
  const m = await oku('dilekce.udf');
  const isaretler = tumParagraflar(m.bolumler[0]).filter(p => p.liste).map(p => p.liste.isaret);
  assert.deepEqual(isaretler, ['1-', '2-', '3-', 'a.', 'a)', 'I.', '(A)', '•']);
  assert.equal(M.numaraYaz(3, 'NUMBER_TYPE_CHAR_SMALL_PARANTHESE'), 'c)');
  assert.equal(M.numaraYaz(4, 'NUMBER_TYPE_CHAR_SMALL_PARANTHESE'), 'ç)');
  assert.equal(M.numaraYaz(30, 'NUMBER_TYPE_CHAR_SMALL_DOT'), 'aa.');
  assert.equal(M.numaraYaz(4, 'NUMBER_TYPE_ROMAN_BIG_PARENTHESIS'), 'IV)');
  assert.equal(M.numaraYaz(12, 'NUMBER_TYPE_NUMBER_D_PARANTHESE'), '(12)');
  assert.equal(M.numaraYaz(7, 'BILINMEYEN'), '7.');
});

test('paragraf: Asılı girinti, sekme durakları, boş paragraf, satır aralığı', async () => {
  const m = await oku('dilekce.udf');
  const ps = tumParagraflar(m.bolumler[0]);
  const davaci = ps.find(p => p.parcalar.some(c => c.yazi === 'DAVACI'));
  assert.equal(davaci.asili, 111.42857);
  assert.deepEqual(davaci.duraklar, [{ konum: 91, hiza: 0, oncu: 0 }]);
  assert.equal(davaci.parcalar[1].t, 'sekme');
  const ortali = ps.find(p => p.parcalar.some(c => c.yazi === 'ORTALI'));
  assert.equal(ortali.duraklar[0].hiza, 2);
  const sag = ps.find(p => p.parcalar.some(c => c.yazi === 'Sağa durak'));
  assert.deepEqual(sag.duraklar[0], { konum: 300, hiza: 1, oncu: 1 });
  const bos = ps.find(p => !p.parcalar.length && !p.liste);
  assert.ok(bos, 'U+200B atılır, paragraf boş kalır');
  const aralikli = ps.find(p => p.aralik === 0.5);
  assert.equal(aralikli.once, 6);
  assert.equal(aralikli.ilk, 35.4375);
  const metin = modelMetni(m.bolumler[0]).join('\n');
  assert.ok(!metin.includes('\u00b8'), 'resim yer tutucusu metin olarak çizilmez');
});

test('tablo: Kenarlık türü ve satır düzeyinde birleştirme', async () => {
  const m = await oku('dilekce.udf');
  const t = m.bolumler[0].find(b => b.t === 'tablo');
  assert.equal(t.kenar, 'hucre');
  assert.equal(t.sutunlar.length, 2);
  assert.ok(Math.abs(t.sutunlar[0] - 170 / 270) < 1e-3);
  assert.equal(t.satirlar[1].hucreler.length, 1);
  assert.equal(t.satirlar[1].hucreler[0].cs, 2, 'tek hücreli satır iki sütunu kaplar');
});

test('sıkıştırılmamış XML, saklanmış zip ve 1.7 biçimi', async () => {
  const ham = await oku('ham-xml.udf');
  assert.equal(ham.ham, true);
  const sak = await oku('saklanmis.udf');
  assert.deepEqual(modelMetni(sak.bolumler[0]), modelMetni(ham.bolumler[0]));
  const a5 = await oku('yatay-a5.udf');
  assert.equal(a5.bicimSurumu, '1.7');
  assert.ok(a5.sayfa.en > a5.sayfa.boy, 'paperOrientation 0 yataydır');
  assert.equal(Math.round(a5.sayfa.en), 595);
  assert.equal(Math.round(a5.sayfa.boy), 420);
  assert.equal(modelMetni(a5.bolumler[0])[0], 'Ali & Veli <ortak>');
  assert.equal(a5.bolumler[0][1].hiza, 'center', '"1.0" hiza yazımı');
});

test('hatalı ve kötü niyetli dosyalar', async () => {
  const kod = async ad => { try { await oku(ad); return 'açıldı'; } catch (e) { return e.kod; } };
  assert.equal(await kod('zip-degil.udf'), 'zip');
  assert.equal(await kod('icerik-yok.udf'), 'content-xml-yok');
  assert.equal(await kod('iki-icerik.udf'), 'belirsiz');
  assert.equal(await kod('dtd.udf'), 'dtd');
  assert.equal(await kod('dtd-yorumlu.udf'), 'dtd', 'önsözdeki yorum DTD reddini atlatamaz');
  assert.equal((await oku('imza-zaman-damgali.udf')).imza.durum, 'tutarli', 'zaman damgasının özeti içerik özetini gölgelemez');
  const imza = await oku('imza-bozuk.udf');
  assert.equal(imza.imza.durum, 'tutarsiz');
  await assert.rejects(M.oku(new Uint8Array(0)), e => e.kod === 'bos');
});

test('e-imza içerikle karşılaştırılamazsa durum "bilinmiyor": Özet okunamaz, uzunluğu tanınmaz ya da imza dosyası kökte tek değil', async () => {
  const BILINMIYOR = { var: true, durum: 'bilinmiyor' };
  assert.deepEqual((await oku('imza-okunamayan.udf')).imza, BILINMIYOR, 'özniteliğin değer kümesi bozuk');
  const b = new Belge();
  const icerik = Buffer.from(b.xml({ ogeler: [b.paragraf({}, [['İmzalı metin']])] }), 'utf8');
  const imzasi = async (...ekler) => (await M.oku(new Uint8Array(udfZip([['content.xml', icerik], ...ekler])))).imza;
  // messageDigest özniteliği, verilen uzunlukta özetle (MD5 uzunluğu 16 bayt: Desteklenen bir özet algoritması yok).
  const oid = [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x04];
  const ozetli = ozet => Buffer.from([0x30, oid.length + 4 + ozet.length, ...oid, 0x31, ozet.length + 2, 0x04, ozet.length, ...ozet]);
  assert.deepEqual(await imzasi(['sign.sgn', Buffer.from([0])]), BILINMIYOR, 'tek baytlık imza dosyası');
  assert.deepEqual(await imzasi(['sign.sgn', ozetli(Buffer.alloc(16, 7))]), BILINMIYOR, '16 baytlık özet');
  assert.deepEqual(await imzasi(['x/sign.sgn', sahteImza(icerik)]), BILINMIYOR, 'imza dosyası yalnız alt klasörde');
  assert.deepEqual(await imzasi(['sign.sgn', sahteImza(icerik)], ['SIGN.SGN', sahteImza(icerik)]), BILINMIYOR, 'iki imza dosyası');
  assert.deepEqual(await imzasi(['sign.sgn', sahteImza(icerik)]), { var: true, durum: 'tutarli', algoritma: 'SHA-256' });
  assert.equal(await imzasi(), null, 'imza dosyası yok');
});

test('okuma ek dosyalar açılırken ya da e-imza özeti hesaplanırken iptal edilirse AbortError ile biter, içeriğin hatasıyla bitmez', async () => {
  const b = new Belge();
  const saglam = Buffer.from(b.xml({ ogeler: [b.paragraf({}, [['Metin']])] }), 'utf8');
  const bozuk = Buffer.from('<template><content>', 'utf8');
  const iptalMi = e => e && e.name === 'AbortError';
  // E-imza özeti hesaplanırken: Özet hesabı başlayınca okuma iptal edilir, özet yine de döner.
  const subtle = globalThis.crypto.subtle;
  for (const [ad, icerik] of [['sağlam içerik', saglam], ['bozuk XML', bozuk]]) {
    const d = new AbortController();
    subtle.digest = function (...a) { d.abort(); return Object.getPrototypeOf(subtle).digest.apply(this, a); };
    try {
      await assert.rejects(M.oku(new Uint8Array(udfZip([['content.xml', icerik], ['sign.sgn', sahteImza(icerik)]])), { signal: d.signal }), iptalMi, 'özet: ' + ad);
    } finally { delete subtle.digest; }
  }
  // Ek dosya açılırken: İptal, ek dosyanın akışı bitip son okuma yanıtlanmadan hemen önce gelir (ek dosya yine de açılır).
  const Asil = globalThis.DecompressionStream;
  for (const [ad, icerik] of [['sağlam içerik', saglam], ['bozuk XML', bozuk]]) {
    const d = new AbortController();
    let sira = 0;
    globalThis.DecompressionStream = function (bicim) {
      const ic = new Asil(bicim);
      if (++sira <= 2) return ic;   // destek denetimi ve content.xml
      const okuyucu = ic.readable.getReader();
      return { writable: ic.writable, readable: new ReadableStream({ async pull(k) {
        const { done, value } = await okuyucu.read();
        if (done) { d.abort(); k.close(); } else k.enqueue(value);
      } }, { highWaterMark: 0 }) };
    };
    try {
      await assert.rejects(M.oku(new Uint8Array(udfZip([['content.xml', icerik], ['documentproperties.xml', '<properties/>']])), { signal: d.signal }), iptalMi, 'ek dosya: ' + ad);
    } finally { globalThis.DecompressionStream = Asil; }
    assert.ok(sira >= 3, 'ek dosya açıldı');
  }
});

test('UDF olmayan ya da gövdesiz sağlam XML "UDF değil" iletisiyle, bozuk XML "XML bozuk" iletisiyle reddedilir', async () => {
  const hata = async u8 => { try { await M.oku(u8); return 'açıldı'; } catch (e) { return [e.kod, e.message, e.ayrinti]; } };
  const zip = girdiler => new Uint8Array(udfZip(girdiler));
  const UDF_DEGIL = 'Dosya bir UDF belgesi değil.';
  assert.equal(M.ILETI['udf-degil'], UDF_DEGIL);
  // Adı .udf yapılmış bir metin belgesi (ODT): Zip ve XML sağlam, kök başka.
  const odt = '<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0">' +
    '<office:body><office:text>metin</office:text></office:body></office:document-content>';
  assert.deepEqual(await hata(zip([['mimetype', 'application/vnd.oasis.opendocument.text'], ['content.xml', odt]])), ['udf-degil', UDF_DEGIL, 'kök']);
  assert.deepEqual(await hata(new TextEncoder().encode('<?xml version="1.0"?><kok><a/></kok>')), ['udf-degil', UDF_DEGIL, 'kök']);
  assert.deepEqual(await hata(zip([['content.xml', '<template><content><![CDATA[abc\n]]></content></template>']])), ['udf-degil', UDF_DEGIL, 'elements yok']);
  assert.deepEqual((await hata(zip([['content.xml', '<template><content>']]))).slice(0, 2), ['xml', M.ILETI.xml], 'bozuk XML');
  const baska = await M.oku(zip([['content.xml', '<document><content><![CDATA[abc\n]]></content><elements><paragraph><content startOffset="0" length="4"/></paragraph></elements></document>']]));
  assert.equal(modelMetni(baska.bolumler[0])[0], 'abc', 'kökü başka adlı ama gövdesi olan belge açılır');
});

test('"default" stiline bağlı yaprak belge tabanını alır, tanımsız stile bağlı yaprak paragrafı devralır', async () => {
  const b = new Belge();
  const stiller = '<style name="edf_2" resolver="hvl-default" size="20" bold="true" />';
  const ogeler = [b.paragraf({ resolver: 'edf_2' }, [['V', { resolver: 'default' }], ['K', { resolver: 'hvl-default' }], ['T', { resolver: 'yok_stil' }], ['S', { resolver: '' }]])];
  const m = await M.oku(new Uint8Array(udfZip([['content.xml', b.xml({ ogeler, stiller })]])));
  const p = m.bolumler[0][0];
  const stil = st => [st.aile, st.punto, st.kalin];
  assert.deepEqual(stil(p.stil), ['Times New Roman', 20, true]);
  assert.deepEqual(stil(m.taban), ['Times New Roman', 12, false]);
  const yaprak = yazi => stil(p.parcalar.find(x => x.yazi === yazi).stil);
  assert.deepEqual(yaprak('V'), stil(m.taban), '"default": Belge tabanı (paragraf da Dialog da değil)');
  assert.deepEqual(yaprak('K'), stil(m.taban), 'kendi stili olan yaprak paragrafı devralmaz');
  assert.deepEqual(yaprak('T'), stil(p.stil), 'tanımsız stil adı yok sayılır');
  assert.deepEqual(yaprak('S'), stil(p.stil), 'stilsiz yaprak paragrafı devralır');
});

test('altı ve üstü çizgi ile zemin metin parçasına kendi stilinden verilir, sayfaya ve paragrafa verilmez', async () => {
  const ciz = async xml => { const g = M.ciz(await M.oku(new Uint8Array(udfZip([['content.xml', xml]]))), { belge: pencere.document }); await g.bitti; return g; };
  const susleme = e => [e.style.getPropertyValue('text-decoration-line'), e.style.getPropertyValue('background-color')];
  const SARI = 'rgb(255, 255, 0)';
  // Belge tabanında (hvl-default) çizgi ve zemin: Stilli ve stilsiz bütün yapraklar çizilir.
  const b = new Belge();
  const xml = b.xml({ ogeler: [b.paragraf({}, [['Taban'], ['Paragraftan', { resolver: '' }]])] })
    .replace('<style name="hvl-default" family="Times New Roman" size="12"', '$& underline="true" strikethrough="true" background="-256"');
  const g = await ciz(xml);
  const p = g.kok.querySelector('.udf-p');
  assert.deepEqual(susleme(g.kok.querySelector('.udf-sayfa')), ['', '']);
  assert.deepEqual(susleme(p), ['', '']);
  assert.deepEqual([...p.children].map(susleme), [['underline line-through', SARI], ['underline line-through', SARI]]);
  g.birak();
  // Paragrafta çizgi ve zemin: Stilsiz yaprak (ve sekmesi) devralır, kendi stili olan yaprak devralmaz.
  const b2 = new Belge();
  const g2 = await ciz(b2.xml({ ogeler: [b2.paragraf({ underline: 'true', background: '-256' }, [['Kendi', { resolver: 'hvl-default' }], ['Devralan\tsekmeden sonra', { resolver: '' }]])] }));
  const p2 = g2.kok.querySelector('.udf-p');
  assert.deepEqual(susleme(p2), ['', '']);
  const parca = metin => [...p2.children].find(e => e.textContent === metin);
  assert.deepEqual(susleme(parca('Kendi')), ['', '']);
  assert.deepEqual(susleme(parca('Devralan')), ['underline', SARI]);
  assert.deepEqual(susleme(parca('sekmeden sonra')), ['underline', SARI]);
  const sekme = p2.querySelector('.udf-sekme');
  assert.deepEqual(susleme(sekme), ['', SARI], 'sekmenin zemini boyanır, çizgisi öncü çizgisiyle');
  assert.equal(sekme.style.getPropertyValue('border-bottom-style'), 'solid');
  g2.birak();
});

test('not vurgusu ve seçili not metnin zemininin üstüne binen katmandır, kâğıda yalnız zemin basılır', async () => {
  const kurallar = metin => [...metin.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(k => ({ secici: k[1].split(',').map(x => x.trim()), govde: k[2] }));
  const i = M.CSS.indexOf('@media print');
  const ekran = kurallar(M.CSS.slice(0, i)), baski = kurallar(M.CSS.slice(i));
  const notKurallari = liste => liste.filter(k => k.secici.some(s => s.includes('.udf-notlu')));
  // Ekranda vurgu background-image ile verilir: Metin parçasının satır içi background-color'ı onu örtmez.
  for (const secici of ['.udf-gorunum .udf-notlu', '.udf-gorunum .udf-notlu.secili']) {
    const k = ekran.find(x => x.secici.includes(secici));
    assert.match(k.govde, /background-image:linear-gradient\(rgba\(/, secici);
  }
  assert.ok(notKurallari(ekran).every(k => !/background(-color)?:/.test(k.govde)), 'not kuralı zemin rengini değiştirmez');
  // Kâğıtta vurgu (seçili not dâhil) kalkar, zemin rengine dokunulmaz.
  const kagit = notKurallari(baski);
  assert.ok(kagit.some(k => k.secici.includes('.udf-gorunum .udf-notlu') && k.secici.includes('.udf-gorunum .udf-notlu.secili') && /background-image:none/.test(k.govde)));
  assert.ok(kagit.every(k => !/background(-color)?:/.test(k.govde)));

  // Zemini paragraftan gelen notlu parça: Zemin satır içi, vurgu sınıfla.
  const b = new Belge();
  const icerik = b.xml({ ogeler: [b.paragraf({ background: '-256' }, [['Notlu', { resolver: '' }]])] });
  const yorum = '<?xml version="1.0"?><template><content><![CDATA[Not\n]]></content><elements><comment strtOffs="0" endOffs="5"><paragraph><content startOffset="0" length="3"/></paragraph></comment></elements></template>';
  const g = M.ciz(await M.oku(new Uint8Array(udfZip([['content.xml', icerik], ['comments.xml', yorum]]))), { belge: pencere.document });
  await g.bitti;
  const n = g.kok.querySelector('.udf-notlu');
  assert.equal(n.textContent, 'Notlu');
  assert.equal(n.style.getPropertyValue('background-color'), 'rgb(255, 255, 0)');
  g.birak();
});

test('hata iletileri cümle cümle yazılır', () => {
  for (const [kod, ileti] of Object.entries(M.ILETI)) {
    assert.ok(!ileti.includes(';') && !ileti.includes('  '), kod);
    assert.match(ileti, /^\p{Lu}.*\.$/u, kod);
    // Noktadan ve iki noktadan sonra büyük harf.
    for (const c of ileti.split(/(?<=[.:]) /).slice(1)) assert.match(c, /^\p{Lu}/u, `${kod}: ${c}`);
  }
});

test('liste numarası ve madde işareti ekran okuyucudan gizlenmez, paragrafın ilk öğesidir', async () => {
  const g = M.ciz(await oku('dilekce.udf'), { belge: pencere.document });
  await g.bitti;
  const isaretler = [...g.kok.querySelectorAll('.udf-isaret')];
  assert.ok(isaretler.some(e => e.textContent === '1-') && isaretler.some(e => e.textContent === '•'));
  for (const im of isaretler) {
    assert.equal(im.closest('[aria-hidden]'), null, im.textContent);
    assert.equal(im.parentElement.firstChild, im, 'okuma sırasında numara metinden önce gelir');
    // Görünüm aynı: Numara sağa yaslı, madde işareti metnin soluna, ikisi de çizgisiz ve zeminsiz.
    assert.ok(im.style.getPropertyValue(im.textContent === '•' ? 'left' : 'right'));
    assert.equal(im.style.getPropertyValue('text-decoration-line') + im.style.getPropertyValue('background-color'), '');
  }
  for (const s of g.kok.querySelectorAll('.udf-sekme')) assert.equal(s.getAttribute('aria-hidden'), 'true', 'sekme boşluğu gizli kalır');
  g.birak();
});

test('çizim: Girinti, işaret, sekme, not, üst bilgi aralığı ve güvenlik', async () => {
  const m = await oku('dilekce.udf');
  const g = M.ciz(m, { belge: pencere.document });
  await g.bitti;
  const k = g.kok;
  assert.equal(k.querySelectorAll('.udf-sayfa').length, 2);
  assert.equal(k.querySelectorAll('.udf-sayfa')[0].querySelector('.udf-ust'), null, 'startPage=2: ilk sayfada üst bilgi yok');
  assert.ok(k.querySelectorAll('.udf-sayfa')[1].querySelector('.udf-ust'), 'ikinci sayfada üst bilgi var');
  assert.deepEqual([...k.querySelectorAll('.udf-isaret')].map(e => e.textContent).slice(0, 4), ['1-', '2-', '3-', 'a.']);
  const davaci = [...k.querySelectorAll('.udf-p')].find(p => p.textContent.startsWith('DAVACI'));
  assert.equal(davaci.style.getPropertyValue('padding-left'), '111.43pt');
  assert.equal(davaci.style.getPropertyValue('text-indent'), '-111.43pt');
  const sekme = davaci.querySelector('.udf-sekme');
  assert.ok(parseFloat(sekme.style.getPropertyValue('width')) > 0);
  assert.equal(k.querySelectorAll('.udf-notlu').length, 1);
  assert.equal(k.querySelector('.udf-notlu').dataset.not, '1');
  const td = k.querySelector('.udf-tablo td');
  assert.match(td.style.getPropertyValue('border-top'), /solid/);
  g.birak();

  const kotu = M.ciz(await oku('kotu-niyet.udf'), { belge: pencere.document });
  await kotu.bitti;
  assert.equal(kotu.kok.querySelectorAll('script,img,iframe,object').length, 0);
  for (const e of kotu.kok.querySelectorAll('*')) for (const a of e.attributes) assert.ok(!/^on/i.test(a.name), 'olay özniteliği yok');
  const p = kotu.kok.querySelector('.udf-p');
  assert.ok(p.textContent.includes('<script>'), 'metin metin olarak kalır');
  assert.ok(!/background/.test(p.style.cssText), 'yazı tipi adı CSS\'e sızmaz');
});

test('ölçüm tuvali yalnız sekmeli paragrafta kurulur, son sekmeden sonraki metin ölçülmez, özet model bırakılınca da kalır', async () => {
  // jsdom'da tuval yok: Ölçen sahte bağlam (harf başına 6 px).
  const eski = pencere.HTMLCanvasElement.prototype.getContext;
  const olculen = [];
  let kurulan = 0;
  pencere.HTMLCanvasElement.prototype.getContext = () => { kurulan++; return { font: '', measureText: m => { olculen.push(m); return { width: m.length * 6 }; } }; };
  try {
    const ciz = async kur => {
      const b = new Belge();
      const g = M.ciz(await M.oku(new Uint8Array(udfZip([['content.xml', b.xml({ ogeler: kur(b) })]]))), { belge: pencere.document });
      await g.bitti;
      return g;
    };
    const duz = await ciz(b => [b.paragraf({}, [['Sekmesiz paragraf']]), b.paragraf({}, [['İkinci paragraf']])]);
    assert.equal(kurulan, 0, 'sekmesiz belgede tuval kurulmaz');
    assert.equal(duz.ozet.bolum, 1);
    assert.equal(duz.ozet.notSayisi, 0);
    duz.birak();
    const g = await ciz(b => [b.paragraf({}, [['Önce\tsonra']]), b.paragraf({}, [['Sekmesiz']])]);
    assert.equal(kurulan, 1);
    assert.deepEqual(olculen, ['Önce'], 'yalnız sekmeden önceki metin ölçülür');
    // Varsayılan durak 72 punto: 4 harf × 6 px × 0,75 = 18 pt yazıdan sonra 54 pt sekme (tuvalin ölçtüğü genişlik).
    assert.equal(g.kok.querySelector('.udf-sekme').style.getPropertyValue('width'), '54pt');
    g.birak();
  } finally { pencere.HTMLCanvasElement.prototype.getContext = eski; }
});

test('resimler <img>: tek blob adresi (antet her bölümde aynı), kapanınca bırakılır, tuval yok', async () => {
  const { Belge, resim, udfZip } = await import('../araclar/ornek-uret.mjs');
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADklEQVR4nGP4zwADQBYAD/4B//Ga+iUAAAAASUVORK5CYII=';
  const b = new Belge();
  const ogeler = [
    `<header startPage="1" foreground="-8355712" background="-1">${b.paragraf({}, [resim(PNG, { width: 40, height: 20 })])}</header>`,
    b.paragraf({}, [['Gövde '], resim(PNG, { width: 30, height: 30 })]),
    `<page-break>${b.paragraf({}, [['​']])}</page-break>`,
    b.paragraf({}, [['İkinci bölüm']])
  ];
  const m = await M.oku(new Uint8Array(udfZip([['content.xml', Buffer.from(b.xml({ ogeler }), 'utf8')]])));
  assert.equal(m.bolumler.length, 2);
  const g = M.ciz(m, { belge: pencere.document });
  await g.bitti;
  const resimler = [...g.kok.querySelectorAll('.udf-resim img')];
  assert.equal(g.kok.querySelectorAll('canvas').length, 0, 'resimler tuvale çizilmez');
  assert.equal(resimler.length, 3, 'iki bölümün anteti ve gövdedeki resim');
  for (const r of resimler) assert.match(r.getAttribute('src'), /^blob:/);
  assert.equal(new Set(resimler.map(r => r.getAttribute('src'))).size, 2, 'antet iki bölümde aynı adresi kullanır');
  g.birak();
  assert.ok(resimler.every(r => !r.hasAttribute('src')), 'kapanınca adresler bırakılır');
});

test('resim baytları: Tarayıcının base64 çeviricisiyle (fromBase64) ve onsuz aynı', async () => {
  const { antetliBelge, antetPng } = await import('../araclar/ornek-uret.mjs');
  const { udf } = antetliBelge({ sayfa: 2, paragraf: 1 });
  const beklenen = antetPng(1654, 290, { gurultu: 0.25 });
  const resimBaytlari = async () => {
    const m = await M.oku(new Uint8Array(udf));
    const r = m.ust.bloklar[0].parcalar.find(x => x.t === 'resim').r;
    assert.equal(r.tur, 'image/png');
    return Buffer.from(await r.blob.arrayBuffer());
  };
  assert.equal(typeof Uint8Array.fromBase64, 'undefined', "Node'da yerli çevirici yok: önce eski yol");
  assert.deepEqual(await resimBaytlari(), beklenen);
  Uint8Array.fromBase64 = s => new Uint8Array(Buffer.from(s, 'base64'));
  try { assert.deepEqual(await resimBaytlari(), beklenen); } finally { delete Uint8Array.fromBase64; }
});

test('yazdırma CSS: Sayfa boyutu, kenar kutuları ve kaçış', async () => {
  const css = M.yazdirmaCss(await oku('dilekce.udf'));
  assert.match(css, /@page \{ size: 595\.28pt 841\.89pt;/);
  assert.match(css, /@top-left \{ content: "DENEME MAHKEMESİ";/);
  assert.match(css, /@top-right \{ content: "Esas No: 2026\/1";/);
  assert.match(css, /@bottom-right \{ content: counter\(page\) "\/" counter\(pages\);/);
  assert.match(css, /@page :first \{ @top-left \{ content: none; \}/);
  assert.equal(M.cssDize('a"b\\c\nd'), '"a\\"b\\\\c\\A d"');
});
