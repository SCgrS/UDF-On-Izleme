// Belgeler kodla uyumlu kalır: README'deki, sürüm notundaki ve mağaza metnindeki e-imza rozeti yazıları görüntüleyicideki
// yazılarla birebir aynıdır. Gizlilik metnindeki süreler ve sekmenin belleğinde kalan bilgiler koddakine uyar. Belgelerde ve
// kodda kullanılmayan adlar ve eklentide olmayan seçenekler geçmez. Bilinen sınırlar (kesilme notunun nedenleri, notun
// vurgusu) ve Gmail'in bilgi öğesine güven koşulları koddaki gibi anlatılır. Kod yorumları tarihli kullanıcı isteği taşımaz
// ve kaydırılmıştır, test adlarında iki noktadan sonraki söz büyük harfle başlar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { KOK } from './yardimci.mjs';

const oku = yol => fs.readFileSync(path.join(KOK, yol), 'utf8').replace(/\r\n/g, '\n');
// Belgelerde cümleler satırlara bölünür: Satır sonu ve girinti tek boşluk sayılır.
const duz = metin => metin.replace(/\s+/g, ' ');
const listele = (klasor, uzanti) => fs.readdirSync(path.join(KOK, klasor)).filter(a => uzanti.test(a)).map(a => path.posix.join(klasor, a));
const MD = ['README.md', 'DEGISIKLIKLER.md', ...listele('belgeler', /\.md$/)];

// MAGAZA.md'de bir başlığın ardından gelen ilk kod bloğu (mağaza panosuna kopyalanan metin).
function magazaBlogu(baslik) {
  const m = oku('belgeler/MAGAZA.md');
  const bas = m.indexOf(baslik);
  assert.ok(bas >= 0, baslik);
  const ac = m.indexOf('```\n', bas) + 4;
  return duz(m.slice(ac, m.indexOf('\n```', ac)));
}
// README'de **Başlık.** ile başlayan paragraf.
function readmeParagrafi(baslik) {
  const m = oku('README.md');
  const bas = m.indexOf(`**${baslik}.**`);
  assert.ok(bas >= 0, baslik);
  return duz(m.slice(bas, m.indexOf('\n\n', bas)));
}
// Sürüm notunda (DEGISIKLIKLER.md, en yeni sürüm önce) - **Başlık:** ile başlayan madde.
function surumMaddesi(baslik) {
  const m = oku('DEGISIKLIKLER.md');
  const bas = m.indexOf(`- **${baslik}:**`);
  assert.ok(bas >= 0, baslik);
  const son = m.indexOf('\n- ', bas + 1);
  return duz(m.slice(bas, son < 0 ? m.length : son));
}
// Koddaki bir sayı sabiti (ör. `KAYIT_SURESI = 60000`).
function sabit(dosya, ad) {
  const m = oku(dosya).match(new RegExp(`\\b${ad} = (\\d+)\\b`));
  assert.ok(m, `${dosya} ${ad}`);
  return Number(m[1]);
}

test('e-imza rozetleri: README, sürüm notu ve mağaza açıklaması görüntüleyicinin yazılarını birebir kullanır', () => {
  const kod = oku('goruntule.js');
  const bas = kod.indexOf('function imzaRozeti(');
  const imza = [...kod.slice(bas, kod.indexOf('\n  }\n', bas)).matchAll(/metin: '([^']+)'/g)].map(m => m[1]);
  const kisa = kod.slice(bas).match(/sinif: 'rozet-kisa', metin: '([^']+)'/)[1];
  const hepsi = new Set([...kod.matchAll(/metin: '(E-imza[^']*)'/g)].map(m => m[1]));
  // Özet tutuyor, tutmuyor, karşılaştırılamadı (uzun ve dar çubuktaki kısa biçim). E-imzasız rozeti rozetleriYaz'da.
  assert.equal(imza.length, 4, imza.join(' | '));
  assert.ok(hepsi.has('E-imzasız'));
  const readme = duz(oku('README.md')), surum = duz(oku('DEGISIKLIKLER.md'));
  for (const y of imza) {
    assert.ok(readme.includes(`**${y}**`), `README: ${y}`);
    assert.ok(surum.includes(`**${y}**`), `DEGISIKLIKLER: ${y}`);
  }
  assert.ok(surum.includes('**E-imzasız**'));
  const aciklama = magazaBlogu('**Açıklama**');
  for (const y of imza.filter(y => y !== kisa)) assert.ok(aciklama.includes(`"${y}"`), `mağaza açıklaması: ${y}`);
  // Belgelerin andığı her rozet yazısı görüntüleyicide var (başka araçları anlatan HAZIR-ARACLAR.md dışında).
  for (const yol of MD.filter(y => y !== 'belgeler/HAZIR-ARACLAR.md')) {
    const m = duz(oku(yol));
    const anilan = [...m.matchAll(/\*\*(E-imza[^*]*)\*\*/g), ...m.matchAll(/["“](E-imza[^"”]*)["”]/g)].map(e => e[1]).filter(y => !y.endsWith(':'));
    for (const y of anilan) assert.ok(hepsi.has(y), `${yol}: "${y}" görüntüleyicide yok`);
  }
});

test('gizlilik metni: README, sürüm notu ve gizlilik politikasındaki süreler ve sekmede kalan bilgiler koda uyar', () => {
  // Alınmayan kayıt bir dakikada, baytlar ve kullanılmayan ön indirmeler 15 sn'de bırakılır.
  assert.equal(sabit('arkaplan.js', 'KAYIT_SURESI'), 60000);
  assert.equal(sabit('arkaplan.js', 'SURE'), 15000);
  assert.equal(sabit('icerik.js', 'BAYT_SURESI'), 15000);
  assert.equal(sabit('icerik.js', 'ON_SURE'), 15000);
  const metinler = { 'README Saklama': readmeParagrafi('Saklama'), 'gizlilik politikası': magazaBlogu('**Gizlilik politikası adresi:**') };
  for (const [ad, m] of Object.entries({ ...metinler, 'sürüm notu': surumMaddesi('Gizlilik') })) {
    assert.match(m, /Bilgisi eklentinin arka planında en geç bir dakikada, baytları indirme bittikten en geç 15 saniye sonra silinir/, ad);
    assert.match(m, /Belge gösterilirken yalnız ön izleme penceresinin belleğindedir/, ad);
  }
  // Görüntüleyicinin istediği indirme ön izleme kapanınca kesilmez, baytlar indirme bittikten sonra 15 sn durur: Süre
  // ön izlemenin kapanışından sayılmaz.
  assert.doesNotMatch(surumMaddesi('Gizlilik'), /ön izleme kapanınca en geç bir dakika/);
  assert.match(readmeParagrafi('İndirme'), /Ön izleme açılmazsa ek en geç 15 saniye sonra bellekten silinir, indirme sürüyorsa kesilir/);
  // İçerik betiği Gmail'de basılan son Drive bağlantısının kimliğini ve kaynak anahtarını sıfırlamaz (ön izleme Google'ca
  // yeniden kurulunca aynı anahtarla yeniden gömülür): Metin bunun sekme yenilenene dek kaldığını söyler.
  const icerik = oku('icerik.js');
  const sifirlanir = (icerik.match(/sonDriveBaglantisi = null/g) || []).length > 1;
  if (!sifirlanir) {
    for (const [ad, m] of Object.entries(metinler)) {
      assert.match(m, /sekmesinin belleğinde sekme yenilenene ya da kapanana dek .*bastığınız son Drive bağlantısının dosya kimliğiyle erişim anahtarı kalabilir/, ad);
    }
    assert.match(duz(oku('DEGISIKLIKLER.md')), /sekmesinin belleğinde sekme yenilenene dek .*son basılan Drive bağlantısının kimliği \(bağlantının erişim anahtarı da\) kalabilir/);
  }
});

test('belgelerde ve kodda kullanılmayan adlar ve eklentide olmayan seçenekler geçmez', () => {
  // Aranan sözler bu dosyada da geçmesin diye yalnız özetleriyle tutulur: Küçük harfe çevrilip baştaki ve sondaki
  // noktalaması atılmış 1-4 kelimenin SHA-256 özetinin ilk 16 hanesi. Beş ad ve yedi seçenek.
  const YASAK = new Set([
    '68d8627e855fdf04', 'd320031d3ace41d2', '2f90fae397065655', '71f0a3e60c09a116', 'ec5790316089f953',
    'd36964db183edb85', '42a20c4655a74f35', '0cdc37de33ec899c', 'c151f22020cb71e1', '9be00ef33cc1540f', '8c4a143be75451ee',
    '854fdda908619224', 'ee3e9c876d66b5f1'
  ]);
  const kelimeler = metin => duz(metin).toLocaleLowerCase('tr-TR').split(' ')
    .map(k => k.replace(/^[^\p{L}\p{N}+]+|[^\p{L}\p{N}+]+$/gu, '')).filter(Boolean);
  const ozet = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
  // Özetin kuruluşu bozulmadı: Eklentinin adı ve bir kısayol, yasak olmayan sözlerle.
  assert.deepEqual(kelimeler('**UDF Ön İzleme** (Ctrl+P),'), ['udf', 'ön', 'izleme', 'ctrl+p']);
  assert.equal(ozet(kelimeler('**UDF Ön İzleme**').join(' ')), '714c58f2d3a05ec2');
  const dosyalar = [
    ...MD, 'manifest.json', ...listele('.', /\.(js|html|css)$/), ...listele('motor', /\.js$/), ...listele('araclar', /\.mjs$/),
    ...listele('testler', /\.mjs$/), ...listele('.github/workflows', /\.ya?ml$/)
  ];
  assert.ok(dosyalar.includes('icerik.js') && dosyalar.includes('belgeler/GELISTIRME.md'));
  const bulunan = [];
  for (const yol of dosyalar) {
    const k = kelimeler(oku(yol));
    for (let i = 0; i < k.length; i++) {
      for (let n = 1; n <= 4 && i + n <= k.length; n++) {
        const s = k.slice(i, i + n).join(' ');
        if (YASAK.has(ozet(s))) bulunan.push(`${yol}: ${s}`);
      }
    }
  }
  assert.deepEqual(bulunan, []);
});

test('bilinen sınırlar: Kesilme notunun bütün nedenleri ve notun vurgusu belgelerde koddaki gibi', () => {
  const kod = oku('motor/udf-motoru.js');
  const bas = kod.indexOf('const ATLANAN = {');
  assert.ok(bas >= 0);
  const nedenler = [...kod.slice(bas, kod.indexOf('};', bas)).matchAll(/(?:'([\w+-]+)'|(\w+)): '([^']+)'/g)].map(m => [m[1] || m[2], m[3]]);
  assert.deepEqual(nedenler.map(n => n[0]).sort(), ['derinlik', 'derinlik+sarmal', 'sarmal', 'veri-satiri']);
  const kucuk = metin => metin.toLocaleLowerCase('tr-TR');
  const gelistirme = duz(oku('belgeler/GELISTIRME.md')), surum = kucuk(surumMaddesi('Çok büyük ya da karmaşık belge'));
  // GELISTIRME notun bütün sözlerini sayar, sürüm notu tek tek nedenleri (birlikte gelen tablo ve öğe ayrı ayrı anılır).
  for (const [ad, metin] of nedenler) {
    assert.ok(kucuk(gelistirme).includes(metin), `GELISTIRME: ${metin}`);
    if (!ad.includes('+')) assert.ok(surum.includes(metin), `DEGISIKLIKLER: ${metin}`);
  }
  assert.ok(gelistirme.includes('"Yalnız ilk bölümü gösteriliyor"') && surum.includes('belgenin yalnız ilk bölümü'));
  // Notun vurgusu ve seçili not metnin satır içi zemininin üstüne binen katmandır, kâğıda basılmaz.
  assert.match(kod, /\.udf-notlu\{background-image:/);
  assert.match(kod, /\.udf-notlu,\.udf-gorunum \.udf-notlu\.secili\{background-image:none/);
  assert.match(gelistirme, /Notun vurgusu ve seçili not zeminin üstüne binen bir katmandır, zeminli yazıda da görünür\. Kâğıda vurgu basılmaz/);
  assert.doesNotMatch(gelistirme, /zeminin altında kalır/);
});

test('Gmail: Bilgi öğesine güven koşulları, 150 ms kuralı ve sahte Gmail senaryoları belgelerde koddaki gibi', () => {
  const gmailEk = oku('gmail-ek.js'), icerik = oku('icerik.js'), sahte = oku('araclar/sahte-gmail.mjs');
  // Katman Gmail'in posta alanının içinde olamaz, öğeyle katman arasında en çok bir ana alan durur.
  assert.match(gmailEk, /katman\.parentElement\.closest\('\[role="main"\]'\)/);
  assert.match(gmailEk, /\+\+ana > 1\) return null/);
  // Kapanıştan sonra 150 ms içinde yeniden beliren ön izleme yalnız aynı katmandaysa aynı ön izleme sayılır.
  assert.match(icerik, /kapanan\.katman === katman && belirdi >= kapanan\.zaman && belirdi - kapanan\.zaman < YENIDEN_KURMA/);
  assert.equal(sabit('icerik.js', 'YENIDEN_KURMA'), 150);
  const gelistirme = duz(oku('belgeler/GELISTIRME.md')), teknik = duz(oku('belgeler/DRIVE-TEKNIGI.md'));
  for (const [ad, m] of [['GELISTIRME', gelistirme], ['DRIVE-TEKNIGI', teknik]]) {
    assert.match(m, /Katman bir `role=main` içinde olmamalı/, ad);
    assert.match(m, /öğeyle katman arasında en çok bir `role=main` bulunmalı/, ad);
    assert.match(m, /Katman tanınmazsa "UDF olarak aç" düğmesi de çıkmaz/, ad);
  }
  assert.match(teknik, /Kapanıştan sonraki 150 ms içinde, kapanan ön izlemenin konumu sabit katmanında \(aynı düğüm\) tıklamasız yeniden beliren ön izleme aynı ön izleme sayılır/);
  assert.match(teknik, /Yeni bir katmanda açılan ön izleme .* önceki tıklamayı almaz/);
  for (const g of ['G17b', 'G18b']) {
    assert.match(sahte, new RegExp(`// ${g}\\. `), `sahte Gmail: ${g}`);
    assert.ok(gelistirme.includes(`(${g})`), `GELISTIRME: ${g}`);
    assert.ok(teknik.includes(g), `DRIVE-TEKNIGI: ${g}`);
  }
});

test('kod: Yorumlarda tarihli kullanıcı isteği yok, yorum satırları kaydırılmış, test adlarında iki noktadan sonra büyük harf', () => {
  const kodlar = [
    ...listele('.', /\.(js|html|css)$/), ...listele('motor', /\.js$/), ...listele('araclar', /\.mjs$/), ...listele('testler', /\.mjs$/)
  ];
  assert.ok(kodlar.includes('goruntule.css') && kodlar.includes('araclar/sahte-gmail.mjs'));
  const tarihli = [], uzun = [], kucukHarf = [];
  for (const yol of kodlar) {
    const metin = oku(yol);
    metin.split('\n').forEach((s, i) => {
      if (!/^\s*(\/\/|\/\*|\*)/.test(s)) return;
      if (/isteği,? \d{4}-\d\d-\d\d/.test(s)) tarihli.push(`${yol}:${i + 1}`);
      if ([...s].length > 150) uzun.push(`${yol}:${i + 1}`);
    });
    // Test adları, sahte sayfa sınamalarının adları (sonuc) ve tablolu testlerin satır adları (['ad', …]). İki noktadan
    // sonra gelen kod adı (download_url, x.com) küçük harfle kalır.
    for (const m of metin.matchAll(/\b(?:test|sonuc)\((['`])((?:\\.|(?!\1).)*)\1|\[\s*(['`])((?:\\.|(?!\3).)*)\3\s*,/g)) {
      const ad = m[2] ?? m[4];
      if (/[\p{L})"]: (?![\p{L}\d]*[_./])\p{Ll}/u.test(ad)) kucukHarf.push(`${yol}: ${ad}`);
    }
  }
  assert.deepEqual(tarihli, []);
  assert.deepEqual(uzun, []);
  assert.deepEqual(kucukHarf, []);
});
