import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { KOK } from './yardimci.mjs';

const oku = ad => fs.readFileSync(path.join(KOK, ad), 'utf8');

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

test('eklenti hiçbir şey saklamaz: Depolama izni yok, kodda chrome.storage ve tarayıcı depoları kullanılmaz', async () => {
  const { eklentiDosyalari } = await import('../araclar/paketle.mjs');
  const m = JSON.parse(oku('manifest.json'));
  assert.ok(!m.permissions || m.permissions.length === 0, 'izin yok');
  assert.ok(!(m.action && m.action.default_popup), 'açılır pencere yok');
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
