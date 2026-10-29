// README'deki iki Drive görüntüsünün dar kesitlerini tanitim-gorselleri.mjs'in tam ekran çekimlerinden (1920×1200) üretir.
// Tam ekranda belge genişliğin ancak %40'ı, GitHub görseli sütuna sığdırınca yazı okunmuyor. Belgenin yanlarındaki Drive
// listesinden şeritler çıkarılır, üst çubuk iki ucundan birleşir (dosya adı solda, düğmeler sağda kalır), Drive'ın okları
// yeni kenarlara konur: Görüntü daha dar bir pencerede çekilmiş gibi olur. Kesilen yerlerin iki yanındaki sütunlar aynı
// olmalı, değilse (Drive'ın görünümü değişmişse) hata. Tam ekran çekimler mağaza görsellerinin kaynağıdır, yerinde kalır.
//   node araclar/dar-gorseller.mjs [klasör]   (varsayılan belgeler/gorseller)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromeBaslat, sekmeAc } from './cdp.mjs';
import { rgbPng } from './magaza-gorselleri.mjs';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Üst çubuk (dosya adı, menüler, düğmeler, İndir şeridi) y 0–112, altında Drive'ın listesi, belge ve not bölmesi. Üst
// çubuğun soldaki 600 px'i olduğu gibi alınır, kalanı sağ uçtan.
const UST = 112, UST_SOL = 600;
// Sağdaki okun kare kesiti (x, y, kenar). Sol ok bunun aynadaki görüntüsüdür, kenara uzaklığı aynı. Daire dışı alınmaz.
const OK = [1849, 577, 46];
// govde: Üst çubuğun altında yan yana konan sütun aralıkları [başı, sonu).
const ISLER = [
  // Belge (x 555–1349) ortada, iki yanında 191 px liste.
  { kaynak: 'drive-belge.png', ad: 'drive-belge-dar.png', govde: [[364, 1540]], oklar: ['sol', 'sağ'] },
  // Belgenin solunda 110 px, sağında not bölmesine dek 47 px kalır. Bölme gölgesiyle (1505'ten) ve sağdaki okla gelir.
  // Gölgenin altında sütun başlığının son harfleri var: O satırlar (140–160) boş bir satırdan (900) alınır.
  { kaynak: 'drive-notlar.png', ad: 'drive-notlar-dar.png', govde: [[445, 1390], [1505, 1920]], oklar: ['sol'],
    yama: { x: 1505, en: 11, y: 140, boy: 21, kaynakY: 900 } }
];

// Sayfada çalışır: Kesiti tuvalde kurar, PNG'sini (data: adresi) ya da hataları döndürür.
const KUR = `async ({ veri, ust, ustSol, ok, govde, oklar, yama }) => {
  const r = new Image();
  r.src = veri;
  await r.decode();
  const E = r.naturalWidth, B = r.naturalHeight;
  const kaynak = new OffscreenCanvas(E, B), kc = kaynak.getContext('2d');
  kc.drawImage(r, 0, 0);
  if (yama) kc.drawImage(kaynak, yama.x, yama.kaynakY, yama.en, 1, yama.x, yama.y, yama.en, yama.boy);
  const hatalar = [];
  const ayni = (x1, x2, y0, y1, ne) => {
    const a = kc.getImageData(x1, y0, 1, y1 - y0).data, b = kc.getImageData(x2, y0, 1, y1 - y0).data;
    let m = 0;
    for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
    if (m > 3) hatalar.push(ne + ': sütun ' + x1 + ' ile ' + x2 + ' farklı (' + m + ')');
  };
  const W = govde.reduce((t, [a, b]) => t + b - a, 0), sagdan = E - (W - ustSol);
  ayni(ustSol, sagdan, 0, ust, 'üst çubuk');
  for (let i = 1; i < govde.length; i++) ayni(govde[i - 1][1], govde[i][0], ust, B, 'liste');
  const k = document.createElement('canvas');
  k.width = W; k.height = B;
  const c = k.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.drawImage(kaynak, 0, 0, ustSol, ust, 0, 0, ustSol, ust);
  c.drawImage(kaynak, sagdan, 0, W - ustSol, ust, ustSol, 0, W - ustSol, ust);
  let x = 0;
  for (const [a, b] of govde) { c.drawImage(kaynak, a, ust, b - a, B - ust, x, ust, b - a, B - ust); x += b - a; }
  const [ox, oy, oe] = ok;
  for (const yan of oklar) {
    const hx = yan === 'sol' ? E - ox - oe : W - (E - ox);
    c.save();
    c.beginPath();
    c.arc(hx + oe / 2, oy + oe / 2, oe / 2, 0, 2 * Math.PI);
    c.clip();
    if (yan === 'sol') { c.translate(hx + oe, 0); c.scale(-1, 1); c.drawImage(kaynak, ox, oy, oe, oe, 0, oy, oe, oe); }
    else c.drawImage(kaynak, ox, oy, oe, oe, hx, oy, oe, oe);
    c.restore();
  }
  return hatalar.length ? { hatalar } : { png: k.toDataURL('image/png') };
}`;

export async function darGorseller(klasor = path.join(KOK, 'belgeler', 'gorseller')) {
  const c = await chromeBaslat();
  try {
    const s = await sekmeAc(c, 'about:blank');
    await s.g('Runtime.enable');
    for (const { kaynak, ad, ...ayar } of ISLER) {
      const veri = 'data:image/png;base64,' + fs.readFileSync(path.join(klasor, kaynak)).toString('base64');
      const { result, exceptionDetails } = await s.g('Runtime.evaluate', { returnByValue: true, awaitPromise: true,
        expression: `(${KUR})(${JSON.stringify({ veri, ust: UST, ustSol: UST_SOL, ok: OK, ...ayar })})` });
      if (exceptionDetails) throw new Error(`${ad}: ${exceptionDetails.exception?.description || exceptionDetails.text}`);
      if (result.value.hatalar) throw new Error(`${ad}: Drive'ın görünümü değişmiş olabilir, kesit yerleri yeniden ölçülmeli. ${result.value.hatalar.join(', ')}`);
      const png = rgbPng(Buffer.from(result.value.png.split(',')[1], 'base64'));
      const yol = path.join(klasor, ad);
      fs.writeFileSync(yol, png);
      console.log(path.relative(KOK, yol), `${png.readUInt32BE(16)}×${png.readUInt32BE(20)}`, Math.round(png.length / 1024) + ' KB');
    }
  } finally {
    c.kapat();
  }
}

if (process.argv[1] && process.argv[1].endsWith('dar-gorseller.mjs')) await darGorseller(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
