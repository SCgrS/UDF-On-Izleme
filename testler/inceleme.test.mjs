// Bağımsız gözden geçirmenin doğruladığı bulgular için sınamalar (her biri bir bulgunun senaryosu).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { motorYukle, modelMetni } from './yardimci.mjs';
import { Belge, udfZip } from '../araclar/ornek-uret.mjs';

const { motor: M, pencere } = motorYukle();
const oku = buf => M.oku(new Uint8Array(buf));
const zip = (b, ogeler, secenek = {}) => udfZip([['content.xml', b.xml({ ogeler, ...secenek })]]);
const ciz = async m => { const g = M.ciz(m, { belge: pencere.document }); await g.bitti; return g; };

test('üst bilgi × sayfa sonu çarpımı bütçeyle kesilir', async () => {
  const b = new Belge();
  const hucreler = Array.from({ length: 200 }, (_, i) => ({ ic: [b.paragraf({}, [['h' + i]])] }));
  const ogeler = [`<header>${b.tablo({ border: 'borderNone' }, [{ hucreler }])}</header>`];
  for (let i = 0; i < 300; i++) ogeler.push(`<page-break>${b.paragraf({}, [])}</page-break>`);
  const m = await oku(zip(b, ogeler));
  assert.equal(m.kesildi, 'oge');
  // Çizimde üst bilgi her bölümde yinelenir: bölüm × hücre, hücre sınırını aşmamalı.
  assert.ok(m.bolumler.length * 200 <= M.SINIR.hucre, `bölüm ${m.bolumler.length}`);
});

test('üst bilginin parça ve resimleri de bölüm bütçesine sayılır', async () => {
  const b = new Belge();
  const ogeler = [`<header>${b.paragraf({}, [['\t'.repeat(10000)]])}</header>`];
  for (let i = 0; i < 1999; i++) ogeler.push('<page-break/>');
  const m = await oku(zip(b, ogeler));
  assert.equal(m.kesildi, 'oge');
  assert.ok(m.bolumler.length * 10000 <= M.SINIR.parca, `bölüm ${m.bolumler.length}`);
  const b2 = new Belge();
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADklEQVR4nGP4zwADQBYAD/4B//Ga+iUAAAAASUVORK5CYII=';
  const o2 = [`<header><paragraph><image imageData="${PNG}" width="453" height="120" startOffset="0" length="1"/></paragraph></header>`];
  for (let i = 0; i < 1999; i++) o2.push('<page-break/>');
  const m2 = await oku(udfZip([['content.xml', b2.xml({ ogeler: o2 }).replace('<![CDATA[', '<![CDATA[x')]]));
  assert.ok(m2.bolumler.length <= M.SINIR.resim, `resimli üst bilgide bölüm ${m2.bolumler.length}`);
});

test('DTD önündeki uzun boşluk reddi atlatamaz', async () => {
  const xml = '<?xml version="1.0"?>' + ' '.repeat(100) + '<!DOCTYPE template [<!ENTITY a "x">]><template><content>&a;</content><elements/></template>';
  await assert.rejects(oku(udfZip([['content.xml', xml]])), e => e.kod === 'dtd');
});

test('tek hücreli yerleşim tablosundaki ortalı üst bilgi ortada basılır', async () => {
  const b = new Belge();
  const ust = `<header>${b.tablo({ border: 'borderNone' }, [{ hucreler: [{ ic: [b.paragraf({ Alignment: 1 }, [['T.C. DENEME MAHKEMESİ']])] }] }])}</header>`;
  const css = M.yazdirmaCss(await oku(zip(b, [ust, b.paragraf({}, [['x']])])));
  assert.match(css, /@top-center \{ content: "T\.C\. DENEME MAHKEMESİ"/);
});

test('sekme ve not bölmeleri parça sınırına sayılır', async () => {
  const b = new Belge();
  const sekmeler = '\t'.repeat(M.SINIR.parca + 50);
  const m = await oku(zip(b, [b.paragraf({}, [[sekmeler]])]));
  assert.equal(m.kesildi, 'oge');
  const parca = m.bolumler[0].reduce((a, p) => a + (p.parcalar ? p.parcalar.length : 0), 0);
  assert.ok(parca <= M.SINIR.parca, `parça ${parca}`);
});

// Büyük boyutlu sürümleri (130 bin satır, 150 bin çocuk) jsdom'da çok yavaş; gerçek Chrome'da
// `node araclar/chrome-sina.mjs yuk` sınar.
test('boş satırlar ve çocuklu sarmalayıcı işlenir', async () => {
  const b = new Belge();
  const m = await oku(udfZip([['content.xml', b.xml({ ogeler: [`<table>${'<row/>'.repeat(3000)}</table>`] })]]));
  assert.ok(m.bolumler[0][0].t === 'tablo');
  const b2 = new Belge();
  const ic = b2.paragraf({}, [['sarılı metin']]).replace(/^<paragraph[^>]*>|<\/paragraph>$/g, '');
  const m2 = await oku(udfZip([['content.xml', b2.xml({ ogeler: [`<paragraph><sarmal>${'<x/>'.repeat(3000)}${ic}</sarmal></paragraph>`] })]]));
  assert.equal(m2.bolumler[0][0].parcalar[0].yazi, 'sarılı metin', 'sarmalayıcının içindeki yapraklar okunur');
});

test('tablodan az hücreli satır eşit dağıtılır, rowspan kenarlıkları doğru sütunda', async () => {
  const b = new Belge();
  const t1 = b.tablo({ border: 'borderCell' }, [
    { hucreler: [{ ic: [b.paragraf({}, [['Başlık']])] }] },
    { hucreler: [{ ic: [b.paragraf({}, [['A']])] }, { ic: [b.paragraf({}, [['B']])] }] }
  ]);
  const t2 = b.tablo({ border: 'borderTable' }, [
    { hucreler: [{ o: { rowspan: 2 }, ic: [b.paragraf({}, [['R']])] }, { ic: [b.paragraf({}, [['1']])] }, { ic: [b.paragraf({}, [['2']])] }] },
    { hucreler: [{ ic: [b.paragraf({}, [['3']])] }, { ic: [b.paragraf({}, [['4']])] }] }
  ]);
  const m = await oku(zip(b, [t1, t2]));
  const [a, c] = m.bolumler[0].filter(x => x.t === 'tablo');
  assert.equal(a.satirlar[0].hucreler[0].cs, 2, 'tek hücreli başlık iki sütunu kaplar');
  const g = await ciz(m);
  const tds = [...g.kok.querySelectorAll('.udf-tablo')[1].querySelectorAll('td')];
  const td = metin => tds.find(x => x.textContent === metin);
  assert.equal(td('3').style.getPropertyValue('border-left'), '', '"3" orta sütunda: Sol dış kenarlık almaz');
  assert.match(td('4').style.getPropertyValue('border-right'), /solid/, '"4" son sütunda: Sağ dış kenarlık alır');
  void c;
  g.birak();
});

test('boş üst bilgi çizilmez', async () => {
  const b = new Belge();
  const m = await oku(zip(b, [`<header>${b.paragraf({}, [])}</header>`, b.paragraf({}, [['Gövde']])]));
  const g = await ciz(m);
  assert.equal(g.kok.querySelector('.udf-ust'), null);
  g.birak();
});

test('yazdırma: Tablolu üst bilgi kenar kutusunda, başka aralıklar akışta, çok satırlı üst bilgi için boşluk', async () => {
  const b = new Belge();
  const ust = `<header startPage="2">${b.tablo({ border: 'borderNone' }, [{ hucreler: [{ ic: [b.paragraf({}, [['ESAS NO']])] }, { ic: [b.paragraf({}, [['ORTA']])] }, { ic: [b.paragraf({}, [['KARAR NO']])] }] }])}</header>`;
  const css = M.yazdirmaCss(await oku(zip(b, [ust, b.paragraf({}, [['x']])])));
  assert.match(css, /@top-left \{ content: "ESAS NO"/);
  assert.match(css, /@top-center \{ content: "ORTA"/);
  assert.match(css, /@top-right \{ content: "KARAR NO"/);
  assert.match(css, /@page :first \{ @top-left \{ content: none; \}/);

  const b2 = new Belge();
  const m2 = await oku(zip(b2, [`<header startPage="3">${b2.paragraf({}, [['ÜÇTEN İTİBAREN']])}</header>`,
    `<footer pageNumber-spec="BSP32_2120" pageNumber-pageStartNumStr="5">${b2.paragraf({}, [])}</footer>`, b2.paragraf({}, [['x']])]));
  const css2 = M.yazdirmaCss(m2);
  assert.ok(!/@top-/.test(css2), 'startPage=3 kenar kutusuyla basılamaz');
  assert.ok(!/counter\(page\)/.test(css2), 'başlangıç numarası 1 değilse numara basılmaz');
  m2.bolumler.push([], []);
  const g = await ciz(m2);
  assert.ok(g.kok.querySelectorAll('.udf-sayfa')[2].querySelector('.udf-ust.akista'), 'üçüncü bölümde akış içinde');
  g.birak();

  const b3 = new Belge();
  const dort = ['T.C.', 'MAHKEME', 'ESAS NO : 1', 'KARAR NO : 2'].map(x => b3.paragraf({ Alignment: 1 }, [[x]]));
  const css3 = M.yazdirmaCss(await oku(zip(b3, [`<header>${dort.join('')}</header>`, b3.paragraf({}, [['x']])])));
  const ustKenar = Number(/@page \{ size: [^;]+; margin: ([\d.]+)pt/.exec(css3)[1]);
  assert.ok(ustKenar >= 20 + 4 * 12 * 1.2, `üst kenar ${ustKenar}`);
});

test('paragrafsız yapraklar da blok sınırına sayılır', async () => {
  // jsdom çok çocuklu öğenin çocuklarını uzunluğun karesiyle dolaşır: Yapraklar 100'lük sarmalayıcılarda durur.
  const b = new Belge();
  b.havuz = 'a\n';
  const grup = '<sarmal>' + '<x startOffset="0" length="1"/>'.repeat(100) + '</sarmal>';
  const m = await oku(zip(b, [grup.repeat(M.SINIR.blok / 100 + 1), b.paragraf({}, [['SONRA']])]));
  assert.equal(m.kesildi, 'oge');
  assert.equal(m.bolumler[0].length, M.SINIR.blok);
  assert.ok(!modelMetni(m.bolumler[0]).includes('SONRA'), 'sınırdan sonra durulur');
});

// Kesilmiş belgenin notu: Ekrandaki metni, kâğıda basılan kısa karşılığı ve yeri. Not yalnız modelin kesilme bilgisine
// bakar: Sayfalar boş çizilir (jsdom'da büyük tablonun çizimi yavaş).
const kesilmeNotu = async m => {
  const g = await ciz({ ...m, bolumler: [[]], ust: null, alt: null });
  const n = g.kok.querySelector('.udf-not');
  const sonuc = n && {
    ekran: n.querySelector('.udf-not-ekran').textContent, baski: n.querySelector('.udf-not-baski').textContent,
    yer: [n.previousElementSibling.className, g.kok.lastElementChild === n]
  };
  g.birak();
  return sonuc;
};
const TAMAMI = 'Tamamı için dosyayı indirip UYAP Doküman Editörü ile açın.';
const icIceTablo = (b, metin) => {
  let ic = b.paragraf({}, [[metin]]);
  for (let i = 0; i < M.SINIR.derinlik + 8; i++) ic = b.tablo({}, [{ hucreler: [{ ic: [ic] }] }]);
  return ic;
};

test('kesilme notu kesilmenin yerini söyler: Atlanan iç içe tablo ve şablon satırı "ilk bölüm" sayılmaz', async () => {
  // İç içe tablo sınırı: Yalnız o tablo atlanır, sonrası gösterilir.
  const b = new Belge();
  const m = await oku(zip(b, [icIceTablo(b, 'İÇTEKİ'), b.paragraf({}, [['SONRAKİ']])]));
  assert.equal(m.kesildi, 'derinlik');
  assert.deepEqual(m.eksik, { son: null, orta: ['derinlik'] });
  const metin = modelMetni(m.bolumler[0]).join('\n');
  assert.ok(metin.includes('SONRAKİ') && !metin.includes('İÇTEKİ'));
  assert.deepEqual(await kesilmeNotu(m), {
    ekran: 'Çok iç içe geçmiş bazı tablolar gösterilemedi. ' + TAMAMI,
    baski: 'Eksik baskı: Çok iç içe geçmiş bazı tablolar basılmadı.', yer: ['udf-sayfa', true]
  });

  // Şablon satırı sınırı: Fazla satırlar atlanır, sonrası gösterilir.
  const satirlar = '<s rowType="dataRow" rowName="satir"><alan>d</alan></s>'.repeat(M.SINIR.veriSatiri + 1);
  const xml = '<?xml version="1.0" encoding="UTF-8"?><template format_id="1.8"><content><![CDATA[X\nSONRAKİ\n]]></content><elements>' +
    '<table><row rowType="dataRow" rowName="satir"><cell><paragraph><content fieldName="alan" startOffset="0" length="1"/>' +
    '<content startOffset="1" length="1"/></paragraph></cell></row></table>' +
    `<paragraph><content startOffset="2" length="8"/></paragraph></elements><data>${satirlar}</data></template>`;
  const m2 = await oku(udfZip([['content.xml', xml]]));
  assert.equal(m2.kesildi, 'veri-satiri');
  assert.deepEqual(m2.eksik, { son: null, orta: ['veri-satiri'] });
  assert.equal(m2.bolumler[0][0].satirlar.length, M.SINIR.veriSatiri);
  assert.equal(modelMetni(m2.bolumler[0]).at(-1), 'SONRAKİ');
  assert.equal((await kesilmeNotu(m2)).ekran, 'Şablon verisinden gelen bazı tablo satırları gösterilemedi. ' + TAMAMI);
});

test('derinlik sınırını aşan tanınmayan sarmalayıcı atlanır ve kesilme notunda söylenir', async () => {
  const sarili = (b, n, metin) => '<x>'.repeat(n) + b.paragraf({}, [[metin]]) + '</x>'.repeat(n);
  // Sınırdaki sarmalayıcının içi gösterilir, belge kesilmiş sayılmaz.
  const b = new Belge();
  const m = await oku(zip(b, [sarili(b, M.SINIR.derinlik, 'İÇTEKİ'), b.paragraf({}, [['SONRAKİ']])]));
  assert.deepEqual([m.kesildi, m.eksik, modelMetni(m.bolumler[0])], [null, null, ['İÇTEKİ', 'SONRAKİ']]);
  // Sınırı aşan sarmalayıcının içi atlanır, sonrası gösterilir.
  for (const n of [M.SINIR.derinlik + 1, M.SINIR.derinlik + 8]) {
    const b2 = new Belge();
    const m2 = await oku(zip(b2, [sarili(b2, n, 'İÇTEKİ'), b2.paragraf({}, [['SONRAKİ']])]));
    assert.deepEqual([m2.kesildi, m2.eksik, modelMetni(m2.bolumler[0])], ['sarmal', { son: null, orta: ['sarmal'] }, ['SONRAKİ']], `${n} sarmalayıcı`);
    assert.deepEqual(await kesilmeNotu(m2), {
      ekran: 'Çok iç içe geçmiş bazı öğeler gösterilemedi. ' + TAMAMI,
      baski: 'Eksik baskı: Çok iç içe geçmiş bazı öğeler basılmadı.', yer: ['udf-sayfa', true]
    });
  }
  // Atlanan tablo ve sarmalayıcı birlikte tek sözle söylenir.
  const b3 = new Belge();
  const m3 = await oku(zip(b3, [icIceTablo(b3, 'TABLODA'), sarili(b3, M.SINIR.derinlik + 1, 'İÇTEKİ'), b3.paragraf({}, [['SONRAKİ']])]));
  assert.deepEqual([m3.kesildi, m3.eksik], ['derinlik', { son: null, orta: ['derinlik', 'sarmal'] }]);
  assert.equal(modelMetni(m3.bolumler[0]).at(-1), 'SONRAKİ');
  assert.equal((await kesilmeNotu(m3)).ekran, 'Çok iç içe geçmiş bazı tablolar ve öğeler gösterilemedi. ' + TAMAMI);
  assert.equal((await kesilmeNotu({ ...m3, eksik: { son: 'oge', orta: ['sarmal', 'veri-satiri'] } })).baski,
    'Eksik baskı: Belgenin yalnız ilk bölümü basıldı. Ayrıca çok iç içe geçmiş bazı öğeler ve şablon verisinden gelen bazı tablo satırları basılmadı.');
});

test('kesilme notu: Okuma durunca "ilk bölüm", önce bir tablo da atlandıysa ikisi birden', async () => {
  // Bölüm sınırı (üst bilgi × sayfa sonu bütçesi): Yalnız belgenin başı gösterilir.
  const ustBilgili = (b, onune = []) => {
    const hucreler = Array.from({ length: 200 }, (_, i) => ({ ic: [b.paragraf({}, [['h' + i]])] }));
    const ogeler = [`<header>${b.tablo({ border: 'borderNone' }, [{ hucreler }])}</header>`, ...onune];
    for (let i = 0; i < 300; i++) ogeler.push(`<page-break>${b.paragraf({}, [])}</page-break>`);
    return zip(b, ogeler);
  };
  const m = await oku(ustBilgili(new Belge()));
  assert.deepEqual(m.eksik, { son: 'oge', orta: [] });
  assert.deepEqual(await kesilmeNotu(m), {
    ekran: 'Belge çok uzun ya da karmaşık. Yalnız ilk bölümü gösteriliyor. ' + TAMAMI,
    baski: 'Eksik baskı: Belgenin yalnız ilk bölümü basıldı.', yer: ['udf-sayfa', true]
  });
  const b2 = new Belge();
  const m2 = await oku(ustBilgili(b2, [icIceTablo(b2, 'İÇTEKİ')]));
  assert.equal(m2.kesildi, 'derinlik', 'ilk neden kalır');
  assert.deepEqual(m2.eksik, { son: 'oge', orta: ['derinlik'] });
  const n2 = await kesilmeNotu(m2);
  assert.equal(n2.ekran, 'Belge çok uzun ya da karmaşık. Yalnız ilk bölümü gösteriliyor. Ayrıca çok iç içe geçmiş bazı tablolar gösterilemedi. ' + TAMAMI);
  assert.equal(n2.baski, 'Eksik baskı: Belgenin yalnız ilk bölümü basıldı. Ayrıca çok iç içe geçmiş bazı tablolar basılmadı.');

  // Önce bir tablo atlanmış olsa da parça sınırı okumayı durdurur: Sonraki paragraf hiç kurulmaz.
  const b3 = new Belge();
  const m3 = await oku(zip(b3, [icIceTablo(b3, 'İÇTEKİ'), b3.paragraf({}, [['\t'.repeat(M.SINIR.parca + 50)]]), b3.paragraf({}, [['SONRA']])]));
  assert.deepEqual([m3.kesildi, m3.eksik], ['derinlik', { son: 'oge', orta: ['derinlik'] }]);
  assert.deepEqual(m3.bolumler[0].map(x => x.t), ['tablo', 'p']);

  // Süre sınırı: Okuma başladıktan sonraki her ölçümde süre dolmuş görünür.
  const asil = performance.now;
  let ilk = true;
  performance.now = function () { const t = asil.call(this); if (ilk) { ilk = false; return t; } return t + 10 * M.SINIR.sure; };
  let m4;
  try { m4 = await oku(zip(new Belge(), Array.from({ length: 600 }, () => '<paragraph/>'))); } finally { performance.now = asil; }
  assert.deepEqual([m4.kesildi, m4.eksik], ['sure', { son: 'sure', orta: [] }]);
  assert.equal((await kesilmeNotu(m4)).ekran, 'Belgenin hazırlanması uzun sürdü. Yalnız ilk bölümü gösteriliyor. ' + TAMAMI);
});

test('kesilmiş belge yazdırılınca kâğıda eksik olduğu basılır, tam belgenin baskısı değişmez', async () => {
  const kurallar = metin => [...metin.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(k => ({ secici: k[1].split(',').map(x => x.trim()), govde: k[2] }));
  const i = M.CSS.indexOf('@media print');
  const ekran = kurallar(M.CSS.slice(0, i)), baski = kurallar(M.CSS.slice(i));
  const gizli = liste => liste.filter(k => /display:none/.test(k.govde)).flatMap(k => k.secici);
  // Ekranda uzun not görünür, kısa karşılığı gizli. Kâğıtta tersi.
  assert.ok(gizli(ekran).includes('.udf-gorunum .udf-not-baski') && !gizli(ekran).includes('.udf-gorunum .udf-not-ekran'));
  assert.ok(gizli(baski).includes('.udf-gorunum .udf-not-ekran') && !gizli(baski).includes('.udf-gorunum .udf-not'));
  assert.ok(baski.some(k => k.secici.includes('.udf-gorunum .udf-not-baski') && /display:inline/.test(k.govde)));
  // Not son sayfanın hemen altına basılır: Ardında not duran son sayfadan sonra da sayfa sonu yok.
  const sonSayfa = baski.find(k => k.secici.includes('.udf-gorunum .udf-sayfa:last-child'));
  assert.ok(sonSayfa.secici.includes('.udf-gorunum .udf-sayfa:has(+ .udf-not)') && /break-after:auto/.test(sonSayfa.govde));

  // Tam belgede not yok: Son öğe son sayfadır, kâğıda not basılmaz.
  const bt = new Belge();
  const tam = await ciz(await oku(zip(bt, [bt.paragraf({}, [['x']])])));
  assert.equal(tam.kok.querySelector('.udf-not'), null);
  assert.equal(tam.kok.lastElementChild.className, 'udf-sayfa');
  tam.birak();
});
