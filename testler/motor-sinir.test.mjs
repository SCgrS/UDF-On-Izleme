// Okuma motorunun güvenlik sınırları: Zip sınırları, merkezî dizinle yerel girdilerin örtüşmesi, kötü niyetli uzun
// girdilerde süre (her biri doğrusal sürmeli), şablon verisinin ve notların bütçeleri.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { motorYukle, modelMetni } from './yardimci.mjs';
import { udfZip } from '../araclar/ornek-uret.mjs';

const { motor: M, pencere } = motorYukle();
const MiB = 1024 * 1024;
// Doğrusal yazımlar bu girdileri birkaç on milisaniyede bitirir. Uzunluğun karesiyle süren bir yazım aynı girdilerde
// 5-30 sn sürer. Sınır yavaş bir makinede de geçecek kadar gevşek.
const SURE = 2000;

const hataKodu = async paket => {
  try { await M.oku(new Uint8Array(paket)); return 'açıldı'; } catch (e) { return `${e.kod}: ${e.ayrinti}`; }
};
const sureliOku = async paket => {
  const t = performance.now();
  const m = await M.oku(new Uint8Array(paket));
  return { m, ms: performance.now() - t };
};
const sablon = (ogeler, havuz, ek = '', stiller = '') =>
  `<?xml version="1.0" encoding="UTF-8"?><template format_id="1.8"><content><![CDATA[${havuz}]]></content>` +
  `<properties><pageFormat mediaSizeName="1"/></properties><elements resolver="hvl-default">${ogeler}</elements>` +
  `<styles><style name="hvl-default" family="Times New Roman" size="12"/>${stiller}</styles>${ek}</template>`;
const metinBelgesi = metin => sablon(`<paragraph><content startOffset="0" length="${metin.length + 1}"/></paragraph>`, metin + '\n');
const parcalar = m => m.bolumler.flat().flatMap(b => b.parcalar || []);

// ---------------------------------------------------------------- zip kurucu
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = b => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };

// Elle kurulan zip. Girdi başına ad ve veriden başka şunlar seçilebilir: Saklanmış girdi (saklanmis), yerel başlıktaki ad
// (yerelAd), veri tanımlayıcısının boyu (tanim, 16 imzalı, 12 imzasız, 0 yok. Varsayılan sıkıştırılmış girdide 16,
// saklanmış girdide 0), yerel ve merkezî başlığın ek alanı (yerelEk, merkezEk), sıkıştırılmış verinin sonuna eklenen ve
// boyuta sayılan baytlar (sikEki), girdinin önüne konan baytlar (onune). dizindenOnce: Son girdiyle merkezî dizin arasına
// konan baytlar. Ofsetler araya konanları sayar.
function zipKur(girdiler, { dizindenOnce = Buffer.alloc(0) } = {}) {
  const parca = [], merkez = [];
  let ofset = 0;
  const ekle = b => { parca.push(b); ofset += b.length; };
  for (const g of girdiler) {
    if (g.onune) ekle(g.onune);
    const ham = Buffer.from(g.veri);
    const yontem = g.saklanmis ? 0 : 8;
    const sik = Buffer.concat([g.saklanmis ? ham : zlib.deflateRawSync(ham), g.sikEki || Buffer.alloc(0)]);
    const tanim = g.tanim ?? (g.saklanmis ? 0 : 16);
    const bayrak = 0x0800 | (tanim ? 8 : 0);
    const crc = crc32(ham);
    const ad = Buffer.from(g.ad), yerelAd = Buffer.from(g.yerelAd ?? g.ad);
    const yerelEk = g.yerelEk || Buffer.alloc(0), merkezEk = g.merkezEk || Buffer.alloc(0);
    const yerel = Buffer.alloc(30);
    yerel.writeUInt32LE(0x04034b50, 0); yerel.writeUInt16LE(20, 4); yerel.writeUInt16LE(bayrak, 6); yerel.writeUInt16LE(yontem, 8);
    if (!tanim) { yerel.writeUInt32LE(crc, 14); yerel.writeUInt32LE(sik.length, 18); yerel.writeUInt32LE(ham.length, 22); }
    yerel.writeUInt16LE(yerelAd.length, 26); yerel.writeUInt16LE(yerelEk.length, 28);
    const yerelOfset = ofset;
    ekle(Buffer.concat([yerel, yerelAd, yerelEk, sik]));
    if (tanim) {
      const t = Buffer.alloc(tanim);
      const i = tanim === 16 ? 4 : 0;
      if (i) t.writeUInt32LE(0x08074b50, 0);
      t.writeUInt32LE(crc, i); t.writeUInt32LE(sik.length, i + 4); t.writeUInt32LE(ham.length, i + 8);
      ekle(t);
    }
    const m = Buffer.alloc(46);
    m.writeUInt32LE(0x02014b50, 0); m.writeUInt16LE(20, 4); m.writeUInt16LE(20, 6); m.writeUInt16LE(bayrak, 8); m.writeUInt16LE(yontem, 10);
    m.writeUInt32LE(crc, 16); m.writeUInt32LE(sik.length, 20); m.writeUInt32LE(ham.length, 24); m.writeUInt16LE(ad.length, 28);
    m.writeUInt16LE(merkezEk.length, 30); m.writeUInt32LE(yerelOfset, 42);
    merkez.push(m, ad, merkezEk);
  }
  ekle(dizindenOnce);
  const md = Buffer.concat(merkez);
  const son = Buffer.alloc(22);
  son.writeUInt32LE(0x06054b50, 0); son.writeUInt16LE(girdiler.length, 8); son.writeUInt16LE(girdiler.length, 10);
  son.writeUInt32LE(md.length, 12); son.writeUInt32LE(ofset, 16);
  return Buffer.concat([...parca, md, son]);
}
const dizinSonu = z => z.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
const dizinOfseti = z => z.readUInt32LE(dizinSonu(z) + 16);
// k. merkezî dizin girdisinin başı
function merkezGirdisi(z, k = 0) {
  let p = dizinOfseti(z);
  for (let i = 0; i < k; i++) p += 46 + z.readUInt16LE(p + 28) + z.readUInt16LE(p + 30) + z.readUInt16LE(p + 32);
  return p;
}
// Tek girdili zip'in yerel kısmı (yerel başlık, veri, tanımlayıcı): Merkezî dizinde yer almayan bir girdi olarak kullanılır.
const yerelKisim = z => z.subarray(0, dizinOfseti(z));

const GORUNEN = metinBelgesi('GÖRÜNEN: Borç 1.000 TL');
const GIZLI = metinBelgesi('GİZLİ: Borç 9.000 TL');

// ---------------------------------------------------------------- zip sınırları
test('zip sınırları (zip bombası, beyan sınırı, boyut tutarsızlığı)', async () => {
  const buyuk = Buffer.alloc(25 * MiB, 0x20);
  const z = zipKur([{ ad: 'content.xml', veri: buyuk }]);
  assert.equal(await hataKodu(z), `boyut: beyan ${25 * MiB} bayt`, 'beyanı içerik sınırını aşan girdi açılmaz');
  // Yalancı beyan: Merkezî dizin 100 bayt der, akış 25 MiB açılır. Sayaç beyanı aşınca durur.
  const yalanci = Buffer.from(z);
  yalanci.writeUInt32LE(100, merkezGirdisi(yalanci) + 24);
  assert.equal(await hataKodu(yalanci), 'boyut: açılan veri beyanı aştı');
  // Beyan tam içerik sınırında, akış onu aşıyor: Sayaç içerik sınırında da durur.
  const sinirda = Buffer.from(z);
  sinirda.writeUInt32LE(M.SINIR.icerik, merkezGirdisi(sinirda) + 24);
  assert.equal(await hataKodu(sinirda), 'boyut: açılan veri beyanı aştı');
  // Akış beyandan kısa.
  const kisa = zipKur([{ ad: 'content.xml', veri: GORUNEN }]);
  kisa.writeUInt32LE(kisa.readUInt32LE(merkezGirdisi(kisa) + 24) + 1, merkezGirdisi(kisa) + 24);
  assert.equal(await hataKodu(kisa), 'zip: boyut beyanla tutmuyor');
  // Saklanmış girdide açık boyut sıkıştırılmış boyuta eşit olmalı (yerel başlıktaki boyut da aynı biçimde bozuldu).
  const saklanmis = zipKur([{ ad: 'content.xml', veri: GORUNEN, saklanmis: true }]);
  const acik = saklanmis.readUInt32LE(22) + 1;
  saklanmis.writeUInt32LE(acik, 22);
  saklanmis.writeUInt32LE(acik, merkezGirdisi(saklanmis) + 24);
  assert.equal(await hataKodu(saklanmis), 'zip: saklanmış girdi boyutu');
  assert.equal(await hataKodu(Buffer.alloc(M.SINIR.paket + 1, 0x50)), 'boyut: paket');
});

test('zip sınırları (girdi sayısı, CRC-32, şifreli girdi, ZIP64, çok parçalı, bilinmeyen yöntem, bozuk akış)', async () => {
  const dolgu = n => Array.from({ length: n }, (_, i) => ({ ad: `ek/${i}.txt`, veri: 'a' }));
  assert.equal(await hataKodu(zipKur([{ ad: 'content.xml', veri: GORUNEN }, ...dolgu(M.SINIR.girdi - 1)])), 'açıldı', 'sınırdaki girdi sayısı');
  assert.equal(await hataKodu(zipKur([{ ad: 'content.xml', veri: GORUNEN }, ...dolgu(M.SINIR.girdi)])), 'zip: girdi sınırı');

  for (const saklanmis of [false, true]) {
    const z = zipKur([{ ad: 'content.xml', veri: GORUNEN, saklanmis }]);
    const p = merkezGirdisi(z) + 16;
    z.writeUInt32LE((z.readUInt32LE(p) ^ 1) >>> 0, p);
    assert.equal(await hataKodu(z), 'zip: CRC-32', saklanmis ? 'saklanmış girdi' : 'sıkıştırılmış girdi');
  }
  const sifreli = zipKur([{ ad: 'content.xml', veri: GORUNEN }]);
  sifreli.writeUInt16LE(sifreli.readUInt16LE(merkezGirdisi(sifreli) + 8) | 1, merkezGirdisi(sifreli) + 8);
  assert.equal(await hataKodu(sifreli), 'zip: şifreli');

  const z64a = zipKur([{ ad: 'content.xml', veri: GORUNEN }]);
  z64a.writeUInt16LE(0xffff, dizinSonu(z64a) + 10);
  assert.equal(await hataKodu(z64a), 'zip: ZIP64');
  const z64b = zipKur([{ ad: 'content.xml', veri: GORUNEN }]);
  z64b.writeUInt32LE(0xffffffff, dizinSonu(z64b) + 16);
  assert.equal(await hataKodu(z64b), 'zip: ZIP64');
  const parcali = zipKur([{ ad: 'content.xml', veri: GORUNEN }]);
  parcali.writeUInt16LE(1, dizinSonu(parcali) + 4);
  assert.equal(await hataKodu(parcali), 'zip: çok parçalı');

  const yontem = zipKur([{ ad: 'content.xml', veri: GORUNEN }]);
  yontem.writeUInt16LE(12, 8);
  yontem.writeUInt16LE(12, merkezGirdisi(yontem) + 10);
  assert.equal(await hataKodu(yontem), 'zip: sıkıştırma 12');
  const bozuk = zipKur([{ ad: 'content.xml', veri: GORUNEN }]);
  bozuk.fill(0xff, 30 + 11, 30 + 11 + 4);
  assert.equal(await hataKodu(bozuk), 'zip: açılamadı');
});

test('ek dosya sınırı aşılırsa ek yok sayılır, belge açılır', async () => {
  const buyukNot = `<?xml version="1.0"?><template><content><![CDATA[${' '.repeat(M.SINIR.ekDosya)}]]></content><elements/></template>`;
  const m = await M.oku(new Uint8Array(zipKur([{ ad: 'content.xml', veri: GORUNEN }, { ad: 'comments.xml', veri: buyukNot }])));
  assert.deepEqual(m.notlar, []);
  assert.deepEqual(modelMetni(m.bolumler[0]), ['GÖRÜNEN: Borç 1.000 TL']);
});

// ---------------------------------------------------------------- yerel girdiler
// Java ZipOutputStream'in genişletilmiş zaman damgası (0x5455, bayrak 7): Yerel başlıkta değiştirme, erişim ve oluşturma
// zamanı (17 bayt), merkezî dizinde yalnız değiştirme zamanı (9 bayt).
const zamanEki = yerel => {
  const t = Buffer.alloc(yerel ? 17 : 9);
  t.writeUInt16LE(0x5455, 0); t.writeUInt16LE(t.length - 4, 2); t.writeUInt8(7, 4);
  for (let i = 5; i < t.length; i += 4) t.writeUInt32LE(1761609600, i);
  return t;
};

test('Java ZipOutputStream düzeni ve öbür olağan zip düzenleri açılır', async () => {
  const javaEki = { yerelEk: zamanEki(true), merkezEk: zamanEki(false) };
  for (const [ad, z] of [
    ['imzalı veri tanımlayıcısı (UYAP, UDE)', zipKur([{ ad: 'documentproperties.xml', veri: '<properties/>' }, { ad: 'content.xml', veri: GORUNEN }, { ad: 'sign.sgn', veri: 'x' }])],
    ['imzasız veri tanımlayıcısı', zipKur([{ ad: 'content.xml', veri: GORUNEN, tanim: 12 }, { ad: 'sign.sgn', veri: 'x', tanim: 12 }])],
    ['boyutlar yerel başlıkta', zipKur([{ ad: 'content.xml', veri: GORUNEN, tanim: 0 }, { ad: 'sign.sgn', veri: 'x', tanim: 0 }])],
    ['saklanmış', zipKur([{ ad: 'content.xml', veri: GORUNEN, saklanmis: true }])],
    ['saklanmış, veri tanımlayıcılı (Go, JSZip\'in akış kipi)', zipKur([{ ad: 'content.xml', veri: GORUNEN, saklanmis: true, tanim: 16 }, { ad: 'sign.sgn', veri: 'imza', saklanmis: true, tanim: 16 }])],
    ['Java\'nın zaman damgası: Yerel ek alan merkezîden uzun', zipKur([{ ad: 'content.xml', veri: GORUNEN, ...javaEki }, { ad: 'sign.sgn', veri: 'x', ...javaEki }])],
    ['merkezî ek alan yerelden uzun', zipKur([{ ad: 'content.xml', veri: GORUNEN, yerelEk: zamanEki(false), merkezEk: zamanEki(true) }])],
    ['örnek üreticisi', udfZip([['content.xml', GORUNEN], ['comments.xml', '<template/>']])]
  ]) {
    assert.equal(await hataKodu(z), 'açıldı', ad);
    // Veri yerel başlığın ek alanından sonra başlar: Merkezî ek alanın boyuyla okunan içerik açılmazdı.
    assert.deepEqual(modelMetni((await M.oku(new Uint8Array(z))).bolumler[0]), ['GÖRÜNEN: Borç 1.000 TL'], ad);
  }
});

test('merkezî dizinde olmayan yerel girdi reddedilir (sıralı okuyucu başka içerik bulmasın)', async () => {
  const gizli = yerelKisim(zipKur([{ ad: 'content.xml', veri: GIZLI }]));
  assert.equal(await hataKodu(zipKur([{ ad: 'content.xml', veri: GORUNEN, onune: gizli }])), 'zip: dizinde olmayan bayt', 'başta');
  assert.equal(await hataKodu(zipKur([{ ad: 'documentproperties.xml', veri: '<properties/>' }, { ad: 'content.xml', veri: GORUNEN, onune: gizli }])),
    'zip: dizinde olmayan bayt', 'iki girdinin arasında');
  assert.equal(await hataKodu(zipKur([{ ad: 'content.xml', veri: GORUNEN }], { dizindenOnce: gizli })), 'zip: dizinde olmayan bayt', 'dizinden önce');
  // Yerel başlık 30 bayttan kısa olamaz: 24 bayta kadar ara (veri tanımlayıcısı) kabul edilir, daha fazlası edilmez.
  assert.equal(await hataKodu(zipKur([{ ad: 'content.xml', veri: GORUNEN, tanim: 0 }], { dizindenOnce: Buffer.alloc(24) })), 'açıldı');
  assert.equal(await hataKodu(zipKur([{ ad: 'content.xml', veri: GORUNEN, tanim: 0 }], { dizindenOnce: Buffer.alloc(25) })), 'zip: dizinde olmayan bayt');
  // İki merkezî girdi aynı yerel başlığı gösteremez.
  const ortak = zipKur([{ ad: 'content.xml', veri: GORUNEN }, { ad: 'sign.sgn', veri: 'x' }]);
  ortak.writeUInt32LE(0, merkezGirdisi(ortak, 1) + 42);
  assert.equal(await hataKodu(ortak), 'zip: dizinde olmayan bayt');
});

test('yerel başlıktaki ad ve yöntem merkezî dizindekiyle aynı olmalı', async () => {
  // Merkezî dizinde başka ad, yerel başlıkta content.xml: Sıralı okuyucu iki content.xml görürdü.
  const ikiAd = zipKur([{ ad: 'xontent.xml', yerelAd: 'content.xml', veri: GIZLI }, { ad: 'content.xml', veri: GORUNEN }]);
  assert.equal(await hataKodu(ikiAd), 'zip: yerel ad farklı');
  assert.equal(await hataKodu(zipKur([{ ad: 'content.xml', yerelAd: 'ek/content.xml', veri: GORUNEN }])), 'zip: yerel ad farklı', 'ad uzunluğu farklı');
  const yontem = zipKur([{ ad: 'content.xml', veri: GORUNEN }]);
  yontem.writeUInt16LE(0, 8);
  assert.equal(await hataKodu(yontem), 'zip: yerel yöntem farklı');
  // Veri tanımlayıcısız saklanmış girdinin sonunu sıralı okuyucu yerel başlıktaki boyuttan bulur.
  const boyut = zipKur([{ ad: 'content.xml', veri: GORUNEN, saklanmis: true }]);
  boyut.writeUInt32LE(boyut.readUInt32LE(18) - 10, 18);
  assert.equal(await hataKodu(boyut), 'zip: yerel boyut farklı');
});

test('veri tanımlayıcılı saklanmış girdinin verisine gömülen yerel girdi reddedilir', async () => {
  // sign.sgn'in verisi: 4 bayt, sahte veri tanımlayıcısı (imza, ilk 4 baytın CRC'si, 4, 4), ardından gizli content.xml.
  // Saklanmış girdinin sonunu tanımlayıcının imzasını arayarak bulan sıralı okuyucu gizli content.xml'i görürdü.
  const bas = Buffer.from('abcd');
  const sahte = Buffer.alloc(16);
  sahte.writeUInt32LE(0x08074b50, 0); sahte.writeUInt32LE(crc32(bas), 4); sahte.writeUInt32LE(4, 8); sahte.writeUInt32LE(4, 12);
  const gizli = yerelKisim(zipKur([{ ad: 'content.xml', veri: GIZLI, tanim: 0 }]));
  const sgn = Buffer.concat([bas, sahte, gizli]);
  assert.equal(await hataKodu(zipKur([{ ad: 'content.xml', veri: GORUNEN }, { ad: 'sign.sgn', veri: sgn, saklanmis: true, tanim: 16 }])),
    'zip: saklanmış veride yerel başlık', 'sahte tanımlayıcıdan sonra');
  // Yerel başlıktaki boyuta (0) güvenen okuyucu bir sonraki girdiyi verinin başında arardı.
  assert.equal(await hataKodu(zipKur([{ ad: 'sign.sgn', veri: Buffer.concat([gizli, bas]), saklanmis: true, tanim: 12 }, { ad: 'content.xml', veri: GORUNEN }])),
    'zip: saklanmış veride yerel başlık', 'verinin başında');
  assert.equal(await hataKodu(zipKur([{ ad: 'content.xml', veri: GORUNEN }, { ad: 'sign.sgn', veri: Buffer.concat([bas, Buffer.from('PK\x03\x04')]), saklanmis: true, tanim: 16 }])),
    'zip: saklanmış veride yerel başlık', 'verinin son 4 baytında');
  // Tanımlayıcısız saklanmış girdide yerel boyut merkezîyle aynı olmalı: Sıralı okuyucu verinin içine girmez.
  assert.equal(await hataKodu(zipKur([{ ad: 'content.xml', veri: GORUNEN }, { ad: 'sign.sgn', veri: sgn, saklanmis: true }])), 'açıldı');
});

// Sıkıştırılmış akışın bittiği yerden sonra, beyan edilen boyutun içinde kalan baytlar (oraya gizlenmiş bir yerel girdi)
// açıcıda hata verir. Chrome'un DecompressionStream'i akış sonundaki fazla baytı reddeder. Bunu yapmayan bir Node
// sürümünde sınama atlanır.
const kuyrukReddi = await (async () => {
  const r = new Blob([zlib.deflateRawSync(Buffer.from('a')), Buffer.from('fazla')]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  try { for (;;) if ((await r.read()).done) return false; } catch { return true; }
})();
test('sıkıştırılmış akışın sonundan sonra gizlenen girdi açılmaz', { skip: !kuyrukReddi && 'Bu Node sürümünün DecompressionStream\'i akış sonundaki fazla baytı reddetmiyor' }, async () => {
  const gizli = yerelKisim(zipKur([{ ad: 'content.xml', veri: GIZLI }]));
  assert.equal(await hataKodu(zipKur([{ ad: 'content.xml', veri: GORUNEN, sikEki: gizli }])), 'zip: açılamadı');
});

// ---------------------------------------------------------------- uzun girdide süre
test('şablon alanında ">" içermeyen uzun HTML kalıntısı doğrusal sürede düz metne çevrilir', async () => {
  const alanli = deger => udfZip([['content.xml', sablon(
    '<paragraph><content fieldName="alan" startOffset="0" length="1"/><content startOffset="1" length="1"/></paragraph>', 'X\n',
    `<data><alan><![CDATA[${deger}]]></alan></data>`)]]);
  for (const [ad, deger] of [['"<"', '<'.repeat(200000)], ['"<br"', '<br'.repeat(70000)], ['"< /"', '< /'.repeat(70000)]]) {
    const { m, ms } = await sureliOku(alanli(deger));
    assert.ok(ms < SURE, `${ad}: ${Math.round(ms)} ms`);
    assert.equal(m.kesildi, null);
    assert.equal(parcalar(m)[0].yazi, deger, `${ad} için kapanmayan etiket metin olarak kalır`);
  }
  const { m } = await sureliOku(alanli('Ad<br>Soyad</p>x<b>kalın</b> <i>eğik</i>\r\n<br class="a"/>son'));
  assert.equal(parcalar(m)[0].yazi, 'Ad\nSoyad\nxkalın eğik\nson', 'etiketler atılır, satır sonları korunur');
});

test('not metninde ve üst/alt bilgide uzun boşluk dizisi doğrusal sürede kırpılır', async () => {
  const N = 200000;
  const notHavuzu = ' '.repeat(N) + 'x';
  const notlu = (n, uzunluk) => udfZip([['content.xml', metinBelgesi('a')], ['comments.xml',
    `<?xml version="1.0"?><template><content><![CDATA[${notHavuzu}]]></content><elements>` +
    `<comment strtOffs="0" endOffs="1"><paragraph><content startOffset="0" length="${uzunluk}"/></paragraph></comment>`.repeat(n) + '</elements></template>']]);
  let { m, ms } = await sureliOku(notlu(1, notHavuzu.length));
  assert.ok(ms < SURE, `tek not: ${Math.round(ms)} ms`);
  assert.equal(m.notlar[0].metin, '', 'notun ilk SINIR.notMetni karakteri boşluk, kırpılınca boş kalır');
  ({ m, ms } = await sureliOku(notlu(M.SINIR.not, M.SINIR.notMetni + 1)));
  assert.ok(ms < SURE, `${M.SINIR.not} not: ${Math.round(ms)} ms`);
  assert.equal(m.notlar.length, M.SINIR.not);

  const bas = 'ilk  ikinci \u200b \n';
  const dilim = Math.ceil(M.SINIR.notMetni / 2) + 10;
  const metinli = udfZip([['content.xml', metinBelgesi('a')], ['comments.xml',
    `<?xml version="1.0"?><template><content><![CDATA[${bas}${'y'.repeat(dilim)}]]></content><elements>` +
    `<comment strtOffs="0" endOffs="1"><paragraph><content startOffset="0" length="5"/><content startOffset="5" length="${bas.length - 5}"/></paragraph></comment>` +
    `<comment strtOffs="0" endOffs="1"><paragraph>${`<content startOffset="${bas.length}" length="${dilim}"/>`.repeat(3)}</paragraph></comment></elements></template>`]]);
  const n = (await M.oku(new Uint8Array(metinli))).notlar;
  assert.equal(n[0].metin, 'ilk  ikinci', 'dilimler birleşir, sondaki boşluk ve U+200B atılır');
  assert.equal(n[1].metin, 'y'.repeat(M.SINIR.notMetni), 'son dilim kalan bütçeyle kesilir');

  for (const yer of ['header', 'footer']) {
    const ek = ' '.repeat(N) + 'x';
    const xml = sablon(`<${yer}><paragraph><content startOffset="0" length="${ek.length}"/></paragraph></${yer}>` +
      `<paragraph><content startOffset="${ek.length}" length="6"/></paragraph>`, ek + 'Gövde\n');
    const model = await M.oku(new Uint8Array(udfZip([['content.xml', xml]])));
    const t = performance.now();
    const css = M.yazdirmaCss(model);
    const ms2 = performance.now() - t;
    assert.ok(ms2 < SURE, `${yer}: ${Math.round(ms2)} ms`);
    assert.ok(css.includes(`@${yer === 'header' ? 'top' : 'bottom'}-left { content: "${ek}";`), `${yer} için baştaki boşluk korunur`);
  }
});

test('madde ve numara türünde uzun değer doğrusal sürede tanınır, tanınmayan uzun değer varsayılana döner', async () => {
  const uzun = 'BULLET_TYPE_'.repeat(Math.ceil(400000 / 12)) + '!';
  const turler = [
    ['madde', 1, `BulletType="${uzun}"`, '•'],
    ['madde', 2, `SecListTypeLevel2="${uzun}"`, '•'],
    ['numara', 1, `NumberType="${'NUMBER_TYPE_'.repeat(Math.ceil(400000 / 12))}ROMAN_BIG_DOT"`, '1.'],
    ['madde', 1, 'BulletType="BULLET_TYPE_ARROW"', '➢'],
    ['madde', 1, 'BulletType="bullet_type_diamond_2"', '◊'],
    ['madde', 1, 'BulletType="X_BULLET_TYPE_TRIANGLE"', '►'],
    ['madde', 1, 'BulletType="BULLET_TYPE_ARROW!"', '•'],
    ['madde', 2, '', '▪'],
    ['numara', 1, 'NumberType="NUMBER_TYPE_ROMAN_BIG_PARENTHESIS"', 'I)']
  ];
  let havuz = '', ogeler = '';
  turler.forEach(([tur, duzey, oz], i) => {
    const a = havuz.length;
    havuz += 'kalem\n';
    ogeler += `<paragraph ${tur === 'madde' ? 'Bulleted' : 'Numbered'}="true" ListLevel="${duzey}" ListId="${i}" ${oz}><content startOffset="${a}" length="6"/></paragraph>`;
  });
  const { m, ms } = await sureliOku(udfZip([['content.xml', sablon(ogeler, havuz)]]));
  assert.ok(ms < SURE, `${Math.round(ms)} ms`);
  assert.deepEqual(m.bolumler[0].map(p => p.liste.isaret), turler.map(t => t[3]));
});

test('şablon verisinde çok sayıda farklı değer (tekrarlar bir kez alınır, süre değer sayısıyla doğru orantılı)', async () => {
  const N = 50000;
  let veri = '';
  for (let g = 0; g < N / 100; g++) { veri += '<kume>'; for (let i = 0; i < 100; i++) veri += `<alan>d${g * 100 + i}</alan>`; veri += '</kume>'; }
  const xml = sablon('<paragraph><content fieldName="alan" startOffset="0" length="1"/><content startOffset="1" length="1"/></paragraph>', 'X\n',
    `<data><alan>d1</alan>${veri}<alan>d2</alan></data>`);
  const { m, ms } = await sureliOku(udfZip([['content.xml', xml]]));
  // Sürenin çoğu jsdom'un XML çözmesi (Chrome'da çok daha kısa).
  assert.ok(ms < 1.5 * SURE, `${Math.round(ms)} ms`);
  const satirlar = parcalar(m)[0].yazi.split('\n');
  assert.equal(satirlar.length, N, 'd1 ve d2 ikinci kez alınmaz');
  assert.deepEqual(satirlar.slice(0, 3), ['d1', 'd0', 'd2'], 'ilk görülme sırası korunur');
});

// ---------------------------------------------------------------- bütçeler
test('şablon alanının değeri SINIR.alanMetni, veriden gelen bütün metin SINIR.veriMetni ile kesilir', async () => {
  const alanli = (deger, adet, onune = '') => udfZip([['content.xml', sablon(onune +
    '<paragraph>' + Array.from({ length: adet }, (_, i) => `<content fieldName="alan" startOffset="${i}" length="1"/>`).join('') +
    `<content startOffset="${adet}" length="1"/></paragraph><paragraph><content startOffset="${adet + 1}" length="6"/></paragraph>`,
    'X'.repeat(adet) + '\nSONRA\n', `<data><alan><![CDATA[${deger}]]></alan></data>`)]]);
  let m = await M.oku(new Uint8Array(alanli('a'.repeat(M.SINIR.alanMetni), 1)));
  assert.equal(m.kesildi, null, 'sınırdaki değer kesilmez');
  m = await M.oku(new Uint8Array(alanli('a'.repeat(M.SINIR.alanMetni + 1), 1)));
  assert.equal(m.kesildi, 'oge');
  assert.equal(parcalar(m)[0].yazi.length, M.SINIR.alanMetni, 'kesilen değerin başı gösterilir');
  assert.ok(!modelMetni(m.bolumler.flat()).includes('SONRA'), 'kesildikten sonra durulur, gösterilen belgenin ilk bölümüdür');
  // Önce başka bir kesilme nedeni (iç içe tablo sınırı) yazılmış olsa da kesilen alandan sonra durulur.
  const icIce = '<table><row><cell>'.repeat(40) + '</cell></row></table>'.repeat(40);
  m = await M.oku(new Uint8Array(alanli('a'.repeat(M.SINIR.alanMetni + 1), 1, icIce)));
  assert.equal(m.kesildi, 'derinlik');
  assert.ok(!modelMetni(m.bolumler.flat()).includes('SONRA'));

  const uzunluk = Math.floor(M.SINIR.alanMetni * 0.9);
  const adet = Math.ceil(M.SINIR.veriMetni / uzunluk) + 2;
  m = await M.oku(new Uint8Array(alanli('b'.repeat(uzunluk), adet)));
  assert.equal(m.kesildi, 'oge');
  assert.equal(parcalar(m).reduce((t, p) => t + (p.yazi || '').length, 0), M.SINIR.veriMetni);
});

test('şablon verisinde arama da süre sınırına ve iptale bakar', async () => {
  const xml = sablon('<paragraph><content fieldName="alan" startOffset="0" length="1"/><content startOffset="1" length="1"/></paragraph>', 'X\n',
    `<data>${'<bos/>'.repeat(1000)}<alan>DEĞER</alan></data>`);
  const paket = new Uint8Array(udfZip([['content.xml', xml]]));
  assert.equal(parcalar(await M.oku(paket))[0].yazi, 'DEĞER');
  // Okuma başladıktan sonraki her ölçümde süre dolmuş görünsün: Ana gezinti 256 öğeye varmadan veri aramasında durulur.
  const asil = performance.now;
  let ilk = true;
  performance.now = function () { const t = asil.call(this); if (ilk) { ilk = false; return t; } return t + 10 * M.SINIR.sure; };
  try {
    const m = await M.oku(paket);
    assert.equal(m.kesildi, 'sure');
    assert.ok(!parcalar(m).some(p => p.yazi === 'DEĞER'));
  } finally { performance.now = asil; }

  // İptal: İlk süre ölçümünde (veri aramasının 256. adımı) okuma iptal edilir. Ana gezinti 256 öğeye varmadığı için iptali
  // ancak veri aramasının bir sonraki denetimi görebilir.
  const iptal = new AbortController();
  let olcum = 0;
  performance.now = function () { if (++olcum === 2) iptal.abort(); return asil.call(this); };
  try {
    await assert.rejects(M.oku(paket, { signal: iptal.signal }), e => e.name === 'AbortError');
    assert.equal(olcum, 2, 'iptal bir sonraki denetimde, süre ölçülmeden görülür');
  } finally { performance.now = asil; }
});

test('not dilimleri aralık başına bir not dizisini paylaşır, sonuç dilim dilim aynı', async () => {
  // Havuz "abcdefghij\n", iki yaprak [0,5) ve [5,11). Not 1 [2,7), not 2 [0,11), not 3 [6,8).
  const yorum = (aralar, metin = 'not') => `<?xml version="1.0"?><template><content><![CDATA[${metin}]]></content><elements>` +
    aralar.map(([b, s]) => `<comment strtOffs="${b}" endOffs="${s}"><paragraph><content startOffset="0" length="${metin.length}"/></paragraph></comment>`).join('') + '</elements></template>';
  const icerik = sablon('<paragraph><content startOffset="0" length="5"/><content startOffset="5" length="6"/></paragraph>', 'abcdefghij\n');
  const m = await M.oku(new Uint8Array(udfZip([['content.xml', icerik], ['comments.xml', yorum([[2, 7], [0, 11], [6, 8]])]])));
  const p = parcalar(m);
  assert.deepEqual(p.map(x => [x.yazi, x.notlar]), [['ab', [2]], ['cde', [2, 1]], ['f', [2, 1]], ['g', [2, 1, 3]], ['h', [2, 3]], ['ij', [2]]]);
  assert.equal(p[1].notlar, p[2].notlar, 'aynı aralıktaki dilimler aynı diziyi kullanır');

  // Belgenin tamamını kapsayan SINIR.not kadar not: Parça sayısı ne olursa olsun tek dizi, ipucu bir kez kurulur.
  const P = 2000;
  let havuz = '', ogeler = '';
  for (let i = 0; i < P / 10; i++) {
    ogeler += '<paragraph>' + Array.from({ length: 10 }, (_, k) => `<content startOffset="${havuz.length + k}" length="1"/>`).join('') + '</paragraph>';
    havuz += 'a'.repeat(10);
  }
  const uzunNot = 'n'.repeat(M.SINIR.notMetni);
  const tam = await M.oku(new Uint8Array(udfZip([['content.xml', sablon(ogeler, havuz)],
    ['comments.xml', yorum(Array.from({ length: M.SINIR.not }, () => [0, havuz.length]), uzunNot)]])));
  const tp = parcalar(tam);
  assert.equal(tp.length, P);
  assert.equal(new Set(tp.map(x => x.notlar)).size, 1);
  assert.equal(tp[0].notlar.length, M.SINIR.not);
  const g = M.ciz(tam, { belge: pencere.document });
  await g.bitti;
  const notlu = g.kok.querySelectorAll('.udf-notlu');
  assert.equal(notlu.length, P);
  assert.equal(notlu[0].dataset.not, Array.from({ length: M.SINIR.not }, (_, i) => i + 1).join(' '));
  assert.equal(notlu[0].title, ('Not 1: ' + uzunNot).slice(0, 2000), 'ipucu ilk 2000 karakter');
  assert.equal(notlu[P - 1].title, notlu[0].title);
  g.birak();

  const kisa = await M.oku(new Uint8Array(udfZip([['content.xml', icerik], ['comments.xml', yorum([[0, 3], [1, 4]], 'kısa')]])));
  const gk = M.ciz(kisa, { belge: pencere.document });
  await gk.bitti;
  assert.equal(gk.kok.querySelectorAll('.udf-notlu')[1].title, 'Not 1: kısa\nNot 2: kısa');
  gk.birak();
});

test('yazı tipi adı kırpılır, 64 karakterden uzun ad modele girmez', async () => {
  const stiller = `<style name="uzun" family="${'A'.repeat(100000)}"/>`;
  const xml = sablon('<paragraph family="Courier New"><content resolver="uzun" startOffset="0" length="2"/>' +
    '<content family=" Arial " startOffset="2" length="2"/><content family="   " startOffset="4" length="2"/></paragraph>', 'aabbcc\n', '', stiller);
  const m = await M.oku(new Uint8Array(udfZip([['content.xml', xml]])));
  assert.deepEqual(parcalar(m).map(x => x.stil.aile), ['Times New Roman', 'Arial', '']);
  const g = M.ciz(m, { belge: pencere.document });
  await g.bitti;
  const sp = [...g.kok.querySelectorAll('.udf-p span')];
  assert.deepEqual(sp.map(e => e.style.getPropertyValue('font-family')),
    ['"Times New Roman", "Times New Roman", serif', '"Arial", "Times New Roman", serif', '"Times New Roman", serif']);
  g.birak();
});
