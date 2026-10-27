import { test } from 'node:test';
import assert from 'node:assert/strict';
import { motorYukle, modelMetni } from './yardimci.mjs';
import { ornekler } from '../araclar/ornek-uret.mjs';

const { motor: M, pencere } = motorYukle();
const O = ornekler();
const oku = ad => M.oku(new Uint8Array(O[ad]));
const tumParagraflar = bloklar => bloklar.flatMap(b => b.t === 'p' ? [b] : b.t === 'tablo' ? b.satirlar.flatMap(r => r.hucreler.flatMap(h => tumParagraflar(h.bloklar))) : []);

test('dilekçe: bölüm, üst/alt bilgi, belge özellikleri, imza ve notlar', async () => {
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

test('paragraf: asılı girinti, sekme durakları, boş paragraf, satır aralığı', async () => {
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

test('tablo: kenarlık türü ve satır düzeyinde birleştirme', async () => {
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

test('çizim: girinti, işaret, sekme, not, üst bilgi aralığı ve güvenlik', async () => {
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

test('resim baytları: tarayıcının base64 çeviricisiyle (fromBase64) ve onsuz aynı', async () => {
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

test('yazdırma CSS: sayfa boyutu, kenar kutuları ve kaçış', async () => {
  const css = M.yazdirmaCss(await oku('dilekce.udf'));
  assert.match(css, /@page \{ size: 595\.28pt 841\.89pt;/);
  assert.match(css, /@top-left \{ content: "DENEME MAHKEMESİ";/);
  assert.match(css, /@top-right \{ content: "Esas No: 2026\/1";/);
  assert.match(css, /@bottom-right \{ content: counter\(page\) "\/" counter\(pages\);/);
  assert.match(css, /@page :first \{ @top-left \{ content: none; \}/);
  assert.equal(M.cssDize('a"b\\c\nd'), '"a\\"b\\\\c\\A d"');
});
