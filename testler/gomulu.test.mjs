import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { KOK } from './yardimci.mjs';
import { ornekler, Belge, udfZip, sahteImza } from '../araclar/ornek-uret.mjs';

const oku = ad => fs.readFileSync(path.join(KOK, ad), 'utf8');
const O = ornekler();
const bekle = ms => new Promise(r => setTimeout(r, ms));
async function kosulBekle(f, sure = 5000) {
  for (const bas = Date.now(); !f();) {
    if (Date.now() - bas > sure) throw new Error('zaman aşımı');
    await bekle(5);
  }
}

// Görüntüleyici sayfası (goruntule.html ya da gomulu.html) jsdom'da, stil dosyası sayfanın içinde. Motor ve indir.js
// sayfanın içinde çalışır, jsdom'da olmayan akış, kodlama ve şifreleme API'leri Node'dan verilir.
//   ozet: crypto.subtle.digest'in yerine geçer (e-imza özetinin hesabı ne zaman biter, sınama belirler).
//   motorSar: Görüntüleyiciye verilecek motoru döndürür (motorun oku'su sarılabilir).
//   dosya: { ad, bayt } Gömülü görünümde arka plandan gelen Drive dosyası (sahte chrome.runtime: kayit-al, indir, indir-dilim).
function sayfaKur(sayfa, { ozet, motorSar, dosya } = {}) {
  const hatalar = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => hatalar.push(String(e && (e.detail && e.detail.stack || e.stack) || e)));
  const html = oku(sayfa).replace('<link rel="stylesheet" href="goruntule.css">', () => `<style>${oku('goruntule.css')}</style>`);
  const adres = `https://ornek.test/${sayfa}` + (dosya ? '#t=00000000-0000-4000-8000-000000000000' : '');
  const w = new JSDOM(html, { url: adres, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc }).window;
  const d = w.document;
  Object.assign(w, { Blob, TextDecoder, DecompressionStream });
  const subtle = globalThis.crypto.subtle;
  Object.defineProperty(w, 'crypto', { configurable: true, value: { subtle: { digest: ozet || ((alg, v) => subtle.digest(alg, v)) } } });
  w.CSSStyleSheet = class { replaceSync(t) { this.metin = t; } };
  Object.defineProperty(d, 'adoptedStyleSheets', { configurable: true, writable: true, value: [] });
  const boyut = { degisti: null };
  w.ResizeObserver = class { constructor(f) { boyut.degisti = f; } observe() {} };
  w.HTMLCanvasElement.prototype.getContext = () => null;
  if (dosya) {
    w.chrome = { runtime: { id: 'ek', sendMessage: async m => {
      if (m.tur === 'kayit-al') return { kayit: { id: '1AaaBbbCccDddEeeFffGggHhhIiiJjjKk', ad: dosya.ad, au: 0 } };
      if (m.tur === 'indir') return { uzunluk: dosya.bayt.length, dilim: 1, ad: dosya.ad, hesap: 0 };
      if (m.tur === 'indir-dilim') return { parca: Buffer.from(dosya.bayt).toString('base64') };
      return undefined;
    } } };
  }
  w.eval(oku('motor/udf-motoru.js'));
  w.eval(oku('indir.js'));
  if (motorSar) w.UDFMotoru = motorSar(w.UDFMotoru);
  w.eval(oku('goruntule.js'));

  // Bilgisayardan bırakılan dosya. bayt: İçerik ya da içeriği veren söz (dosyanın okunması sınamanın istediği an biter).
  const birak = (ad, bayt) => {
    const e = new w.Event('drop', { bubbles: true, cancelable: true });
    const icerik = async () => Uint8Array.from(await bayt).buffer;
    Object.defineProperty(e, 'dataTransfer', { value: { types: ['Files'], files: [{ name: ad, size: 1, arrayBuffer: icerik }] } });
    d.dispatchEvent(e);
  };
  const durum = () => ({
    ad: d.getElementById('belge-adi').textContent,
    belge: d.body.classList.contains('belgeli') && !!d.querySelector('#alan .udf-sayfa'),
    hata: (d.querySelector('#alan .durum.hata h2') || {}).textContent || null
  });
  const rozetler = () => [...d.querySelectorAll('#rozetler .rozet')].map(r => {
    const uzun = r.querySelector('.rozet-uzun'), kisa = r.querySelector('.rozet-kisa');
    return { sinif: r.className, yazi: (uzun || r).textContent, ...(kisa ? { kisa: kisa.textContent } : {}), ...(r.title ? { title: r.title } : {}) };
  });
  return { w, d, hatalar, boyut, birak, durum, rozetler };
}

// Motorun 'bilinmiyor' durumu birkaç nedenden çıkar (özet okunamadı ya da uzunluğu tanınmadı, imza dosyası açılamadı, iki tane
// ya da yalnız alt klasörde). Rozetin title'ı nedeni örnekle söyler, hepsinde aynıdır.
const ROZET_KARSILASTIRILAMADI = { sinif: 'rozet', yazi: 'E-imza dosyası var, içerikle karşılaştırılamadı', kisa: 'E-imza karşılaştırılamadı',
  title: 'Belgede e-imza dosyası var, ama belge içeriğiyle karşılaştırılamadı (örneğin içindeki özet okunamadı ya da imza dosyası tek değil). İmza ve sertifika doğrulanmaz.' };

test('gomulu.html, goruntule.html\'in aynısı (yalnız açıklama ve <html> sınıfı farklı)', () => {
  const sekme = oku('goruntule.html');
  const gomulu = oku('gomulu.html');
  assert.match(gomulu, /<html lang="tr" class="gomulu">/);
  assert.doesNotMatch(sekme, /gomulu/);
  const sade = gomulu.replace(/<!--[\s\S]*?-->\n/, '').replace('<html lang="tr" class="gomulu">', '<html lang="tr">');
  assert.equal(sade, sekme, 'goruntule.html değişince gomulu.html de aynı biçimde değişmeli');
  for (const html of [sekme, gomulu]) assert.doesNotMatch(html.replace(/<script src="[^"]+"( defer)?><\/script>/g, ''), /<script/, 'satır içi betik yok');
});

test('manifest: Drive\'a ve Gmail\'e yalnız gömülü giriş sayfası açık, çerçeveye yalnız onlar koyabilir', () => {
  const m = JSON.parse(oku('manifest.json'));
  const siteler = ['https://drive.google.com/*', 'https://mail.google.com/*'];
  assert.deepEqual(m.web_accessible_resources, [{ resources: ['gomulu.html'], matches: siteler, use_dynamic_url: true }]);
  // İçerik betiği yalnız Drive'ın klasör ve dosya sayfalarında ve Gmail'in posta sayfalarında çalışır.
  const yollar = ['https://drive.google.com/drive/*', 'https://drive.google.com/file/*', 'https://mail.google.com/mail/*'];
  assert.deepEqual(m.content_scripts, [{ matches: yollar, js: ['drive-kimlik.js', 'gmail-ek.js', 'indir.js', 'icerik.js'], css: ['icerik.css'], run_at: 'document_idle' }]);
  assert.equal(m.version, JSON.parse(fs.readFileSync(path.join(KOK, 'package.json'), 'utf8')).version, 'manifest ile package.json sürümü aynı');
});

test('manifest: CSP her şeyi kapatır, yalnız gerekenleri açar', () => {
  const csp = JSON.parse(oku('manifest.json')).content_security_policy.extension_pages;
  const kurallar = Object.fromEntries(csp.split(';').map(k => k.trim().split(/\s+/)).map(([ad, ...d]) => [ad, d.join(' ')]));
  assert.deepEqual(kurallar, {
    'default-src': "'none'",
    'script-src': "'self'",
    'style-src': "'self'",
    // Belgedeki resimler ve filigran blob adresinden, simge eklentinin kendi dosyasından.
    'img-src': "'self' blob:",
    // Gmail eki görüntüleyiciden indirilmez (Gmail sekmesindeki içerik betiği indirir): Bağlantı yalnız Drive'ın indirme adresine.
    'connect-src': 'https://drive.usercontent.google.com',
    'object-src': "'none'",
    'base-uri': "'none'",
    'form-action': "'none'",
    'frame-ancestors': 'https://drive.google.com https://mail.google.com'
  });
});

test('eklenti hiçbir şey saklamaz: İzin yok, kodda chrome.storage ve tarayıcı depoları kullanılmaz', async () => {
  const { eklentiDosyalari } = await import('../araclar/paketle.mjs');
  const m = JSON.parse(oku('manifest.json'));
  assert.ok(!m.permissions || m.permissions.length === 0, 'izin yok');
  assert.equal(m.action, undefined, "manifest'te action yok");
  const kodlar = eklentiDosyalari().filter(a => /\.(js|html)$/.test(a));
  assert.ok(kodlar.includes('arkaplan.js') && kodlar.includes('motor/udf-motoru.js'));
  for (const ad of kodlar) {
    const kod = oku(ad);
    assert.doesNotMatch(kod, /chrome\s*\.\s*storage|\b(localStorage|sessionStorage|indexedDB|caches|cookieStore)\b|document\s*\.\s*cookie/, ad);
  }
});

test('çerçevenin renk düzeni satır içinde !important ve "light" (sayfanın kuralı, örn. Dark Reader, ezemesin)', () => {
  // İçerik betiğinin CSS'i sayfanın @layer'lı !important kuralına yeniliyor; satır içi !important yenilmez. "normal" ise
  // Drive sayfasının <meta name="color-scheme"> etiketine göre çözülürdü.
  assert.match(oku('icerik.js'), /cerceve\.style\.setProperty\('color-scheme', 'light', 'important'\)/);
  assert.match(oku('icerik.css'), /color-scheme: light !important;/);
  assert.match(oku('goruntule.css'), /:root\.gomulu \{\s*color-scheme: normal;/, 'çerçevenin içindeki sayfa açık düzende');
});

test('gömülü görünümde görünmez yükleme kutusu tıklamayı geçirir (boşluğa tıklama kapatsın)', () => {
  assert.match(oku('goruntule.css'), /\.gomulu \.durum\.yukleniyor \{ background: none; pointer-events: none; \}/);
});

test('not bölmesi için sol boşluk yalnız ekranda (baskıya girmez)', () => {
  const css = oku('goruntule.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /@media screen \{ \.alan \{ padding-left: var\(--sol-bosluk, 0px\); \} \}/);
  assert.equal((css.match(/--sol-bosluk/g) || []).length, 1, 'boşluk başka yerde kullanılmıyor');
});

test('içerik betiğinin CSS kuralları yalnız eklentinin kendi işaretleriyle eşleşir', () => {
  const css = oku('icerik.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const seciciler = [...css.matchAll(/([^{}]+)\{/g)].map(m => m[1].trim());
  assert.ok(seciciler.length >= 2);
  for (const s of seciciler) assert.match(s, /^(\[data-udf-okuyucu-gomulu\]|\[data-udf-okuyucu-gizli\]|iframe\.udf-okuyucu-cerceve)$|^\[data-udf-okuyucu-gomulu\] > /, s);
});

test('çerçeve ana alanın gölge kökünde: Google\'ın içeriği orada !important ile gizlenir, kök eklenemezse icerik.css', () => {
  // Google'ın görüntüleyicisi ana alanı yeniden çizerse kendisinin koymadığı çocuğu silebilir (önlem, DRIVE-TEKNIGI.md §14).
  const kod = oku('icerik.js');
  assert.match(kod, /ana\.attachShadow\(\{ mode: 'open' \}\)/);
  assert.match(kod, /::slotted\(\*\) \{ visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; \}/);
  assert.match(kod, /\(golge \|\| ana\)\.append\(cerceve\)/);
});

test('e-imza rozeti: Özet içerikle tutunca "E-imzalıdır", tutmayınca uyarı, karşılaştırılamayınca nötr rozet', async () => {
  const s = sayfaKur('goruntule.html');
  const b = new Belge();
  const icerik = Buffer.from(b.xml({ ogeler: [b.paragraf({}, [['İmzalı metin']])] }), 'utf8');
  const durumlar = [
    ['dilekce.udf', O['dilekce.udf'], [{ sinif: 'rozet', yazi: 'E-imzalıdır' }]],
    ['imza-bozuk.udf', O['imza-bozuk.udf'], [{ sinif: 'rozet uyari', yazi: 'E-imza içerikle uyuşmuyor', title: 'Belge içeriği imzalanan içerikle aynı değil: İmzadan sonra değiştirilmiş olabilir.' }]],
    ['yatay-a5.udf', O['yatay-a5.udf'], [{ sinif: 'rozet', yazi: 'E-imzasız', title: 'Belgede e-imza dosyası yok.' }]],
    ['tek-bayt-imza.udf', udfZip([['content.xml', icerik], ['sign.sgn', Buffer.from([0])]]), [ROZET_KARSILASTIRILAMADI]],
    ['iki-imza.udf', udfZip([['content.xml', icerik], ['sign.sgn', sahteImza(icerik)], ['SIGN.SGN', sahteImza(icerik)]]), [ROZET_KARSILASTIRILAMADI]],
    ['alt-klasorde-imza.udf', udfZip([['content.xml', icerik], ['x/sign.sgn', sahteImza(icerik)]]), [ROZET_KARSILASTIRILAMADI]],
    ['imza-okunamayan.udf', O['imza-okunamayan.udf'], [ROZET_KARSILASTIRILAMADI]]
  ];
  for (const [ad, bayt, beklenen] of durumlar) {
    s.birak(ad, bayt);
    await kosulBekle(() => s.durum().ad === ad && s.durum().belge);
    assert.deepEqual(s.rozetler(), beklenen, ad);
  }
  // Sekmedeki araç çubuğunda yalnız uzun biçim görünür (kısa biçim yalnız gömülü çubukta).
  const gorunum = sinif => s.w.getComputedStyle(s.d.querySelector('#rozetler .' + sinif)).display;
  assert.deepEqual([gorunum('rozet-uzun'), gorunum('rozet-kisa')], ['', 'none']);
  s.d.querySelector('.cubuk').classList.add('kisa');
  assert.deepEqual([gorunum('rozet-uzun'), gorunum('rozet-kisa')], ['', 'none'], 'sekmede .kisa sınıfı rozeti değiştirmez');
  assert.deepEqual(s.hatalar, []);
});

test('gömülü çubuk sığmazsa önce rozetlerin kısa biçimi görünür (yanlar eşit kalır), o da sığmazsa sıkışık düzen', async () => {
  const s = sayfaKur('gomulu.html', { dosya: { ad: 'Belge.udf', bayt: O['imza-okunamayan.udf'] } });
  await kosulBekle(() => s.durum().belge);
  assert.deepEqual(s.rozetler(), [ROZET_KARSILASTIRILAMADI]);
  // Çubuğun doğal genişliği (jsdom ölçmez): Uzun rozetle 900 px, kısa rozetle 600 px, sıkışık düzende 450 px.
  const cubuk = s.d.querySelector('.cubuk');
  cubuk.getBoundingClientRect = () => {
    const width = cubuk.classList.contains('sikisik') ? 450 : cubuk.classList.contains('kisa') ? 600 : 900;
    return { left: 0, top: 0, right: width, bottom: 44, width, height: 44 };
  };
  let pencere = 0;
  Object.defineProperty(s.d.documentElement, 'clientWidth', { configurable: true, get: () => pencere });
  const gorunum = sinif => s.w.getComputedStyle(s.d.querySelector('#rozetler .' + sinif)).display;
  const yerlestir = async en => {
    pencere = en;
    s.boyut.degisti();
    await new Promise(r => s.w.requestAnimationFrame(r));
    return { sinif: ['kisa', 'sikisik'].filter(c => cubuk.classList.contains(c)), uzun: gorunum('rozet-uzun'), kisa: gorunum('rozet-kisa') };
  };
  // Şerit: Pencere genişliği − 24 px (iki yanda 12 px).
  assert.deepEqual(await yerlestir(1000), { sinif: [], uzun: '', kisa: 'none' });
  assert.deepEqual(await yerlestir(800), { sinif: ['kisa'], uzun: 'none', kisa: 'inline' });
  assert.deepEqual(await yerlestir(500), { sinif: ['kisa', 'sikisik'], uzun: 'none', kisa: 'inline' });
  assert.deepEqual(await yerlestir(300), { sinif: ['kisa', 'sikisik'], uzun: 'none', kisa: 'inline' });
  assert.deepEqual(await yerlestir(1000), { sinif: [], uzun: '', kisa: 'none' }, 'yer açılınca uzun biçim geri gelir');
  assert.deepEqual(s.hatalar, []);
});

test('açılırken hata veren eski belge, ondan sonra açılan belgenin yerine geçmez', async () => {
  // Motor iptali fark etmese de (ilk okuma iptalden sonra hatayla biter) görüntüleyici eski belgenin hatasını göstermez.
  let reddet = null;
  const s = sayfaKur('goruntule.html', { motorSar: M => Object.freeze({ ...M, oku: (girdi, o) => reddet ? M.oku(girdi, o) : new Promise((_, r) => { reddet = () => r(new M.UdfHatasi('xml')); }) }) });
  s.birak('a.udf', O['dilekce.udf']);
  await kosulBekle(() => !!reddet);
  s.birak('b.udf', O['yatay-a5.udf']);
  await kosulBekle(() => s.durum().ad === 'b.udf' && s.durum().belge);
  reddet();
  await bekle(50);
  assert.deepEqual(s.durum(), { ad: 'b.udf', belge: true, hata: null });
  assert.deepEqual(s.hatalar, []);
});

test('e-imza özeti hesaplanırken başka belge açılırsa eski belgenin hatası yeni belgenin yerine geçmez', async () => {
  // A: E-imzalı, içeriği bozuk XML. Özeti hesaplanırken B açılır, B çizildikten sonra A'nın özeti biter.
  const bozuk = Buffer.from('<template><content>', 'utf8');
  let birak = null;
  const ozet = (alg, v) => {
    const sonuc = globalThis.crypto.subtle.digest(alg, v);
    if (birak) return sonuc;
    return new Promise(c => { birak = () => c(sonuc); });
  };
  const s = sayfaKur('goruntule.html', { ozet });
  s.birak('a.udf', udfZip([['content.xml', bozuk], ['sign.sgn', sahteImza(bozuk)]]));
  await kosulBekle(() => !!birak);
  s.birak('b.udf', O['yatay-a5.udf']);
  await kosulBekle(() => s.durum().ad === 'b.udf' && s.durum().belge);
  birak();
  await bekle(50);
  assert.deepEqual(s.durum(), { ad: 'b.udf', belge: true, hata: null });
  // Bozuk belge tek başına açılınca hatası görünür.
  s.birak('c.udf', udfZip([['content.xml', bozuk], ['sign.sgn', sahteImza(bozuk)]]));
  await kosulBekle(() => s.durum().ad === 'c.udf' && !!s.durum().hata);
  assert.equal(s.durum().hata, 'Belge gösterilemedi');
  assert.deepEqual(s.hatalar, []);
});

test('okunması uzun süren dosya, ondan sonra bırakılan dosyanın yerine geçmez', async () => {
  const s = sayfaKur('goruntule.html');
  let oku = null;
  s.birak('a.udf', new Promise(c => { oku = () => c(O['dilekce.udf']); }));
  s.birak('b.udf', O['yatay-a5.udf']);
  await kosulBekle(() => s.durum().ad === 'b.udf' && s.durum().belge);
  oku();
  await bekle(50);
  assert.deepEqual(s.durum(), { ad: 'b.udf', belge: true, hata: null });
  assert.deepEqual(s.hatalar, []);
});
