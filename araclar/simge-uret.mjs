// simgeler/*.png dosyalarını SVG'den görünmez Chrome ile üretir: node araclar/simge-uret.mjs
// Simge 16, 32, 48 ve 128 px (araç çubuğu, eklentiler sayfası, mağaza).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromeBaslat, sekmeAc } from './cdp.mjs';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Köşesi kıvrık beyaz sayfada Google'ın renkleriyle (mavi, yeşil, sarı) üç satır, sol alttan taşan UYAP kırmızısı rozette
// "UDF" (kullanıcının seçtiği öneri, 2026-10-27). Google'ın logoları kopyalanmaz, yalnız renkleri. UYAP kırmızısı UYAP
// Doküman Editörü simgesinin ölçülen ana rengi. Büyük çizim 128'lik alanın ortasındaki 96'lık kısımdadır (Chrome'un
// önerdiği 16 px saydam kenar, mağaza simgesi de bu). 48 px'te kenar daraltılır: Görüntüleyicinin başlığında 28 px'e
// küçülünce çizim fazla küçük kalmasın. 16 ve 32 px'te yazı okunmadığı için rozet yazısızdır,
// kâğıt geniş tutulur (araç çubuğunda dar görünmesin), şekiller tam piksellerde durur.
const MAVI = '#4285F4', YESIL = '#34A853', SARI = '#FBBC05', KIRMIZI = '#c42127', KENAR = '#bdc1c6', KIVRIM = '#dadce0';
const buyukSvg = (viewBox = '0 0 128 128') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%">
  <g transform="translate(4 0)"><path d="M42 17H80L104 41V103A8 8 0 0 1 96 111H42A8 8 0 0 1 34 103V25A8 8 0 0 1 42 17Z" fill="#fff" stroke="${KENAR}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M80 17V35A6 6 0 0 0 86 41H104Z" fill="${KIVRIM}"/>
  <path d="M47 34H68" stroke="${MAVI}" stroke-width="7" stroke-linecap="round"/><path d="M47 49H91" stroke="${YESIL}" stroke-width="7" stroke-linecap="round"/><path d="M47 64H84" stroke="${SARI}" stroke-width="7" stroke-linecap="round"/>
  <rect x="14" y="76" width="64" height="28" rx="8" fill="${KIRMIZI}"/>
  <text x="46" y="97" text-anchor="middle" font-family="Segoe UI, Roboto, Arial, sans-serif" font-weight="800" font-size="20" fill="#fff" letter-spacing="-0.5">UDF</text></g>
</svg>`;
const kucukSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="100%" height="100%">
  <path d="M3.7 0.5H10.5L14.5 4.5V14.3A1.2 1.2 0 0 1 13.3 15.5H3.7A1.2 1.2 0 0 1 2.5 14.3V1.7A1.2 1.2 0 0 1 3.7 0.5Z" fill="#fff" stroke="#9aa0a6" stroke-width="1" stroke-linejoin="round"/>
  <rect x="4" y="2" width="5" height="2" rx="0.5" fill="${MAVI}"/><rect x="4" y="5" width="8.5" height="2" rx="0.5" fill="${YESIL}"/><rect x="4" y="8" width="7" height="2" rx="0.5" fill="${SARI}"/>
  <rect x="1" y="11" width="9" height="4" rx="1" fill="${KIRMIZI}"/>
</svg>`;
const svg = boy => (boy >= 128 ? buyukSvg() : boy >= 48 ? buyukSvg('9 9 110 110') : kucukSvg);

const c = await chromeBaslat();
try {
  const s = await sekmeAc(c, 'about:blank');
  await s.g('Page.enable');
  await s.g('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  for (const boy of [16, 32, 48, 128]) {
    const ad = `${boy}.png`;
    await s.g('Emulation.setDeviceMetricsOverride', { width: boy, height: boy, deviceScaleFactor: 1, mobile: false });
    const frameId = (await s.g('Page.getFrameTree')).frameTree.frame.id;
    await s.g('Page.setDocumentContent', { frameId, html: `<!doctype html><html><body style="margin:0;background:transparent"><div style="width:${boy}px;height:${boy}px">${svg(boy)}</div></body></html>` });
    await new Promise(r => setTimeout(r, 200));
    const { data } = await s.g('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: boy, height: boy, scale: 1 } });
    fs.writeFileSync(path.join(KOK, 'simgeler', ad), Buffer.from(data, 'base64'));
    console.log(`simgeler/${ad}`);
  }
  fs.writeFileSync(path.join(KOK, 'araclar', 'simge.svg'), buyukSvg());
} finally { c.kapat(); }
