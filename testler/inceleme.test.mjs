// Bağımsız gözden geçirmenin doğruladığı bulgular için sınamalar (her biri bir bulgunun senaryosu).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { motorYukle } from './yardimci.mjs';
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
  assert.equal(td('3').style.getPropertyValue('border-left'), '', '"3" orta sütunda: sol dış kenarlık almaz');
  assert.match(td('4').style.getPropertyValue('border-right'), /solid/, '"4" son sütunda: sağ dış kenarlık alır');
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

test('yazdırma: tablolu üst bilgi kenar kutusunda, başka aralıklar akışta, çok satırlı üst bilgi için boşluk', async () => {
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
