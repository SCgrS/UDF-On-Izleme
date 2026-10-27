// Kullanıcıya verilecek eklenti zip'ini üretir ve açıp denetler: node araclar/paketle.mjs [çıktı.zip]
// Kökte manifest.json durur (üst klasör yok); yalnız eklenti dosyaları (EKLENTI_OGELERI) girer. Manifest'in, HTML'lerin ve
// service worker'ın adını verdiği her dosya zip'te olmalı. "_" ile başlayan ad ve ters bölülü yol olmamalı.
// Eklenti dosyaları deponun kökünde durur (kullanıcı isteği: GitHub'ın yeşil Code → Download ZIP'i
// çıkarılınca klasör doğrudan Chrome'a yüklenebilsin, UYAP Haciz Yardımcısı'ndaki gibi). Kökteki öbür her şey (araçlar,
// testler, belgeler) geliştirme içindir ve pakete girmez.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PAKET_ADI = 'UDF-On-Izleme.zip';
// Eklentiye ait kök öğeler (klasörler bütünüyle). Köke yeni bir eklenti dosyası eklenince buraya da eklenir; test denetler.
export const EKLENTI_OGELERI = [
  'manifest.json', 'LISANSLAR.txt', 'arkaplan.js', 'drive-kimlik.js', 'gmail-ek.js', 'gomulu.html', 'goruntule.css',
  'goruntule.html', 'goruntule.js', 'icerik.css', 'icerik.js', 'indir.js', 'motor', 'simgeler'
];

const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = b => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };

function dosyalar(klasor, on = '') {
  const sonuc = [];
  for (const g of fs.readdirSync(klasor, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const yol = on ? `${on}/${g.name}` : g.name;
    if (g.isDirectory()) sonuc.push(...dosyalar(path.join(klasor, g.name), yol));
    else sonuc.push(yol);
  }
  return sonuc;
}
// Eklentinin dosyaları ("/" ile ayrılmış göreli yollar, sıralı).
export function eklentiDosyalari() {
  return EKLENTI_OGELERI.flatMap(o => (fs.statSync(path.join(KOK, o)).isDirectory() ? dosyalar(path.join(KOK, o), o) : [o]))
    .sort((a, b) => a.localeCompare(b));
}
// Eklentinin dosyalarını bir klasöre kopyalar (sınama araçları geçici kopya üzerinde değişiklik yapar).
export function eklentiyiKopyala(hedef) {
  for (const ad of eklentiDosyalari()) {
    const y = path.join(hedef, ...ad.split('/'));
    fs.mkdirSync(path.dirname(y), { recursive: true });
    fs.copyFileSync(path.join(KOK, ...ad.split('/')), y);
  }
  return hedef;
}

export function zipYaz(girdiler) {
  // Sabit tarih (2026-01-01 00:00): aynı kaynaktan aynı zip çıkar.
  const SAAT = 0, TARIH = ((2026 - 1980) << 9) | (1 << 5) | 1;
  const yerel = [], merkez = [];
  let ofset = 0;
  for (const [ad, veri] of girdiler) {
    const adB = Buffer.from(ad, 'utf8'), sik = zlib.deflateRawSync(veri, { level: 9 }), crc = crc32(veri);
    const b = Buffer.alloc(30);
    b.writeUInt32LE(0x04034b50, 0); b.writeUInt16LE(20, 4); b.writeUInt16LE(0x0800, 6); b.writeUInt16LE(8, 8);
    b.writeUInt16LE(SAAT, 10); b.writeUInt16LE(TARIH, 12); b.writeUInt32LE(crc, 14); b.writeUInt32LE(sik.length, 18);
    b.writeUInt32LE(veri.length, 22); b.writeUInt16LE(adB.length, 26);
    yerel.push(b, adB, sik);
    const m = Buffer.alloc(46);
    m.writeUInt32LE(0x02014b50, 0); m.writeUInt16LE(20, 4); m.writeUInt16LE(20, 6); m.writeUInt16LE(0x0800, 8); m.writeUInt16LE(8, 10);
    m.writeUInt16LE(SAAT, 12); m.writeUInt16LE(TARIH, 14); m.writeUInt32LE(crc, 16); m.writeUInt32LE(sik.length, 20);
    m.writeUInt32LE(veri.length, 24); m.writeUInt16LE(adB.length, 28); m.writeUInt32LE(ofset, 42);
    merkez.push(m, adB);
    ofset += 30 + adB.length + sik.length;
  }
  const md = Buffer.concat(merkez), son = Buffer.alloc(22);
  son.writeUInt32LE(0x06054b50, 0); son.writeUInt16LE(girdiler.length, 8); son.writeUInt16LE(girdiler.length, 10);
  son.writeUInt32LE(md.length, 12); son.writeUInt32LE(ofset, 16);
  return Buffer.concat([...yerel, md, son]);
}

export function zipOku(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('zip dizini yok');
  const girdiler = new Map();
  let p = buf.readUInt32LE(eocd + 16);
  for (let k = 0; k < buf.readUInt16LE(eocd + 10); k++) {
    const yontem = buf.readUInt16LE(p + 10), sik = buf.readUInt32LE(p + 20), adUz = buf.readUInt16LE(p + 28);
    const ekUz = buf.readUInt16LE(p + 30), notUz = buf.readUInt16LE(p + 32), yerel = buf.readUInt32LE(p + 42);
    const ad = buf.slice(p + 46, p + 46 + adUz).toString('utf8');
    const bas = yerel + 30 + buf.readUInt16LE(yerel + 26) + buf.readUInt16LE(yerel + 28);
    const ham = buf.slice(bas, bas + sik);
    girdiler.set(ad, yontem === 8 ? zlib.inflateRawSync(ham) : ham);
    p += 46 + adUz + ekUz + notUz;
  }
  return girdiler;
}

// Zip'in Chrome'da yüklenebilir olduğunu denetler; sorunları dizi olarak döndürür.
export function denetle(girdiler) {
  const sorunlar = [];
  const var_ = ad => girdiler.has(ad);
  if (!var_('manifest.json')) return ['kökte manifest.json yok'];
  for (const ad of girdiler.keys()) {
    if (ad.includes('\\')) sorunlar.push(`ters bölülü yol: ${ad}`);
    if (ad.split('/').some(p => p.startsWith('_'))) sorunlar.push(`"_" ile başlayan ad: ${ad}`);
    if (/\.(pem|crx|test\.mjs|udf)$/i.test(ad)) sorunlar.push(`pakete girmemeli: ${ad}`);
  }
  const m = JSON.parse(girdiler.get('manifest.json').toString('utf8'));
  const gerekli = new Set([...Object.values(m.icons || {}), ...Object.values((m.action && m.action.default_icon) || {}),
    m.background && m.background.service_worker, m.options_ui && m.options_ui.page, ...(m.content_scripts || []).flatMap(c => [...(c.js || []), ...(c.css || [])]),
    ...(m.web_accessible_resources || []).flatMap(w => w.resources || [])].filter(Boolean));
  for (const ad of [...girdiler.keys()].filter(a => a.endsWith('.html'))) {
    const html = girdiler.get(ad).toString('utf8'), dizin = path.posix.dirname(ad);
    for (const x of html.matchAll(/\b(?:src|href)="([^"#?:]+)"/g)) gerekli.add(path.posix.normalize(path.posix.join(dizin === '.' ? '' : dizin, x[1])));
  }
  // Service worker'ın importScripts ile yüklediği ve kodunda adını verdiği her betik.
  const sw = m.background && m.background.service_worker;
  if (sw && var_(sw)) {
    const kod = girdiler.get(sw).toString('utf8');
    for (const x of kod.matchAll(/importScripts\(([^)]*)\)/g)) for (const y of x[1].matchAll(/['"]([^'"]+)['"]/g)) gerekli.add(path.posix.normalize(y[1]));
    for (const x of kod.matchAll(/['"]([\w./-]+\.js)['"]/g)) gerekli.add(path.posix.normalize(x[1]));
  }
  for (const ad of gerekli) if (!var_(ad)) sorunlar.push(`eksik dosya: ${ad}`);
  if (!var_('LISANSLAR.txt')) sorunlar.push('LISANSLAR.txt yok');
  return sorunlar;
}

// magaza: Chrome Web Mağazası'na yüklenecek paket. Mağaza manifest'te "key" alanını kabul etmiyor (kimliği kendisi verir);
// alan çıkarılır, gerisi aynı. Mağazadan kurulan eklentinin kimliği bu yüzden paketlenmemiş kopyanınkinden farklıdır.
export function paketle(hedef, { magaza = false } = {}) {
  const girdiler = eklentiDosyalari().map(ad => [ad, fs.readFileSync(path.join(KOK, ...ad.split('/')))]);
  if (magaza) {
    const i = girdiler.findIndex(([ad]) => ad === 'manifest.json');
    const { key, ...m } = JSON.parse(girdiler[i][1].toString('utf8'));
    girdiler[i] = ['manifest.json', Buffer.from(JSON.stringify(m, null, 2) + '\n', 'utf8')];
  }
  const zip = zipYaz(girdiler);
  const sorunlar = denetle(zipOku(zip));
  if (sorunlar.length) throw new Error('Paket denetimi başarısız:\n  ' + sorunlar.join('\n  '));
  fs.mkdirSync(path.dirname(hedef), { recursive: true });
  fs.writeFileSync(hedef, zip);
  return { hedef, dosya: girdiler.length, bayt: zip.length };
}

// node araclar/paketle.mjs [--magaza] [çıktı.zip]
if (process.argv[1] && process.argv[1].endsWith('paketle.mjs')) {
  const arg = process.argv.slice(2);
  const magaza = arg.includes('--magaza');
  const surum = JSON.parse(fs.readFileSync(path.join(KOK, 'manifest.json'), 'utf8')).version;
  const varsayilan = magaza ? `UDF-On-Izleme-${surum}-magaza.zip` : PAKET_ADI;
  const hedef = path.resolve(arg.find(a => a !== '--magaza') || path.join(KOK, 'cikti', varsayilan));
  const r = paketle(hedef, { magaza });
  console.log(`${path.relative(KOK, r.hedef)} · sürüm ${surum}${magaza ? ' · mağaza (key yok)' : ''} · ${r.dosya} dosya · ${r.bayt} bayt`);
}
