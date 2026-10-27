// Chrome Web Mağazası görselleri: belgeler/gorseller/'deki README görüntülerinden (önce araclar/tanitim-gorselleri.mjs)
// 1280×800 ekran görüntüleri, 440×280 küçük tanıtım kutusu ve 128×128 simge üretir. Görünmez Chrome'da HTML'den çizilir.
//   node araclar/magaza-gorselleri.mjs [çıktı klasörü]   (varsayılan belgeler/magaza)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromeBaslat, sekmeAc, ifadeBekle } from './cdp.mjs';
import { pngKucult } from './tanitim-gorselleri.mjs';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GORSEL = path.join(KOK, 'belgeler', 'gorseller');
const resim = ad => pathToFileURL(path.join(GORSEL, ad)).href;
const SIMGE = fs.readFileSync(path.join(KOK, 'araclar', 'simge.svg'), 'utf8').replace(/<\?xml[^>]*>/, '');
const YAZI = `font-family: "Segoe UI", system-ui, sans-serif;`;

const sayfa = (govde, stil) => `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>
* { box-sizing: border-box; margin: 0; } html, body { width: 100%; height: 100%; overflow: hidden; } body { ${YAZI} }
${stil}</style></head><body>${govde}</body></html>`;

// Başlıklı ekran görüntüsü: üstte başlık ve alt satır, ortada resim(ler).
const anlatim = ({ baslik, alt, resimler, koyu }) => sayfa(`
  <main><h1>${baslik}</h1><p>${alt}</p><div class="resimler">${resimler.map(([ad, en]) => `<img src="${resim(ad)}" style="width:${en}px">`).join('')}</div></main>`, `
  body { background: ${koyu ? 'radial-gradient(120% 90% at 50% 0%, #3a3b3e 0%, #202124 70%)' : 'radial-gradient(120% 90% at 50% 0%, #ffffff 0%, #e9edf2 75%)'}; }
  main { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0; padding: 0 64px; }
  h1 { font-size: 46px; font-weight: 700; letter-spacing: -.5px; color: ${koyu ? '#f1f3f4' : '#1f2328'}; }
  p { margin-top: 14px; font-size: 24px; color: ${koyu ? '#bdc1c6' : '#5c6470'}; }
  .resimler { margin-top: 64px; display: flex; gap: 48px; align-items: center; }
  img { display: block; border-radius: 14px; box-shadow: 0 10px 40px rgba(0, 0, 0, ${koyu ? '.55' : '.18'}); }`);

const tanitimKutusu = sayfa(`
  <div class="kutu"><div class="simge">${SIMGE}</div><div class="yazi"><h1>UDF Ön İzleme</h1><p>UYAP .udf belgeleri<br>Drive’da ve Gmail’de açılır</p></div></div>`, `
  body { background: linear-gradient(135deg, #ffffff 0%, #eef1f5 100%); }
  .kutu { height: 100%; display: flex; align-items: center; justify-content: center; gap: 22px; padding: 0 30px; }
  /* Simgenin çizimi kutusunun solunda 128'de 18 birim boş: Çizimle yazı birlikte ortalansın diye o kadar sola. */
  .simge { width: 120px; height: 120px; flex: none; margin-left: -17px; filter: drop-shadow(0 6px 14px rgba(60, 64, 67, .22)); }
  .simge svg { width: 100%; height: 100%; display: block; }
  h1 { font-size: 30px; line-height: 1.1; font-weight: 800; color: #1f2328; letter-spacing: -.4px; }
  p { margin-top: 10px; font-size: 17px; line-height: 1.35; color: #5c6470; }`);

const ISLER = [
  // README görüntüleri tam ekran (1920×1200); mağaza 1280×800 ister: yüksek kaliteyle küçültülür.
  { ad: 'ekran-1-belge.png', kucult: 'drive-belge.png' },
  { ad: 'ekran-2-notlar.png', kucult: 'drive-notlar.png' },
  { ad: 'ekran-3-cubuk.png', en: 1280, boy: 800, html: anlatim({ baslik: 'Belgenin altında tek çubuk', alt: 'İmza durumu ve notlar · yakınlaştırma · Yazdır / PDF', resimler: [['cubuk.png', 974]], koyu: true }) },
  { ad: 'tanitim-kucuk-440x280.png', en: 440, boy: 280, html: tanitimKutusu },
  { ad: 'simge-128.png', kopya: path.join('..', '..', 'simgeler', '128.png') }
];

export async function magazaGorselleri(cikti = path.join(KOK, 'belgeler', 'magaza')) {
  fs.mkdirSync(cikti, { recursive: true });
  const gecici = fs.mkdtempSync(path.join(os.tmpdir(), 'udf-magaza-'));
  const c = await chromeBaslat();
  try {
    const s = await sekmeAc(c, 'about:blank');
    for (const a of ['Runtime.enable', 'Page.enable']) await s.g(a);
    for (const is of ISLER) {
      const yol = path.join(cikti, is.ad);
      if (is.kopya) fs.copyFileSync(path.join(GORSEL, is.kopya), yol);
      else if (is.kucult) fs.writeFileSync(yol, await pngKucult(c, fs.readFileSync(path.join(GORSEL, is.kucult)), 1280, 800));
      else {
        const html = path.join(gecici, is.ad.replace(/\.png$/, '.html'));
        fs.writeFileSync(html, is.html);
        await s.g('Emulation.setDeviceMetricsOverride', { width: is.en, height: is.boy, deviceScaleFactor: 1, mobile: false });
        await s.g('Page.navigate', { url: pathToFileURL(html).href });
        await ifadeBekle(s.g, "document.readyState === 'complete' && [...document.images].every(i => i.complete && i.naturalWidth)");
        await new Promise(r => setTimeout(r, 300));
        const { data } = await s.g('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: is.en, height: is.boy, scale: 1 } });
        fs.writeFileSync(yol, Buffer.from(data, 'base64'));
      }
      const b = fs.readFileSync(yol);
      console.log(path.relative(KOK, yol), `${b.readUInt32BE(16)}×${b.readUInt32BE(20)}`, Math.round(b.length / 1024) + ' KB');
    }
  } finally {
    c.kapat();
    fs.rmSync(gecici, { recursive: true, force: true });
  }
}

if (process.argv[1] && process.argv[1].endsWith('magaza-gorselleri.mjs')) await magazaGorselleri(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
