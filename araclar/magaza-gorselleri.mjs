// Chrome Web Mağazası görselleri: belgeler/gorseller/'deki README görüntülerinden (önce araclar/tanitim-gorselleri.mjs)
// dört 1280×800 ekran görüntüsü, 440×280 küçük tanıtım karosu, 1400×560 kayan yazı tanıtım bloğu ve 128×128 mağaza
// simgesi üretir. Düzen kullanıcının öbür eklentilerinin mağaza görselleri gibi (UYAP Haciz Yardımcısı, WhatsApp Web için
// Sohbeti Sil Gizleyici): Solda iki satırlık başlık (ikinci satırda vurgu), paragraf ve onay işaretli maddeler, sağda
// eklentinin görünümü kart olarak. Zemin mavi. Görünmez Chrome'da HTML'den çizilir. Ekran görüntüleri ve karolar
// saydamlıksız (24 bit) PNG olarak yazılır, mağaza saydamlığı kabul etmiyor. Simge eklentinin kendi 128 px simgesidir
// (çizim 96 px, çevresinde 16 px saydam boşluk).
//   node araclar/magaza-gorselleri.mjs [çıktı klasörü]   (varsayılan belgeler/magaza)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromeBaslat, sekmeAc, ifadeBekle } from './cdp.mjs';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GORSEL = path.join(KOK, 'belgeler', 'gorseller');
const resim = ad => pathToFileURL(path.join(GORSEL, ad)).href;
const boyut = ad => { const b = fs.readFileSync(path.join(GORSEL, ad)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const SIMGE = fs.readFileSync(path.join(KOK, 'araclar', 'simge.svg'), 'utf8').replace(/<\?xml[^>]*>/, '');

const VURGU = '#ffd166';
const ZEMIN = `radial-gradient(760px 520px at 92% 8%, #5b8fe838, transparent 70%),
  radial-gradient(700px 520px at 0% 100%, #06122a66, transparent 70%),
  linear-gradient(150deg, #23518f 0%, #1c437a 45%, #163664 75%, #112b52 100%)`;
const ORTAK_CSS = `* { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { overflow: hidden; font-family: 'Segoe UI', system-ui, sans-serif; background: ${ZEMIN}; color: #fff; }
  .v { color: ${VURGU}; }
  .kart { position: relative; overflow: hidden; border-radius: 14px; box-shadow: 0 0 0 1px #ffffff2e, 0 26px 60px #0000006b; background: #131314; }
  .kart img { position: absolute; display: block; max-width: none; }
  .simge svg { width: 100%; height: 100%; display: block; }`;
const TIK = `<svg viewBox="0 0 24 24" fill="none" stroke="${VURGU}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`;
const sayfa = (en, boy, stil, govde) => `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>${ORTAK_CSS}
  body { width: ${en}px; height: ${boy}px; position: relative; }
  ${stil}</style></head><body>${govde}</body></html>`;

// README görüntüsünün [x, y, en, boy] kesiti, en px genişliğinde kart olarak (boy orantılı). pay: Kesitin üstünde kartın
// zemin renginde bırakılan boşluk.
function kesit(ad, [kx, ky, ke, kb], en, ek = '', pay = 0) {
  const [ge] = boyut(ad), o = en / ke;
  return `<div class="kart" style="width: ${en}px; height: ${Math.round(kb * o) + pay}px; ${ek}">
    <div style="position: absolute; left: 0; right: 0; top: ${pay}px; bottom: 0; overflow: hidden"><img src="${resim(ad)}"
    style="width: ${(ge * o).toFixed(2)}px; left: ${(-kx * o).toFixed(2)}px; top: ${(-ky * o).toFixed(2)}px"></div></div>`;
}

// 1280 × 800: Solda başlık, paragraf, maddeler. Sağda eklentinin görünümü, dikeyde ortalı.
const ekran = ({ baslik, paragraf, maddeler, sag }) => sayfa(1280, 800, `
  .sol { position: absolute; left: 76px; top: 0; bottom: 0; width: 452px; display: flex; flex-direction: column; justify-content: center; }
  h1 { font-size: 44px; font-weight: 700; line-height: 1.16; letter-spacing: -.4px; }
  .p { margin-top: 22px; font-size: 18px; line-height: 1.6; color: #d4e0f2; text-wrap: pretty; }
  ul { list-style: none; margin-top: 26px; display: flex; flex-direction: column; gap: 14px; }
  li { display: flex; gap: 12px; font-size: 16.5px; line-height: 1.45; color: #f3f7fd; text-wrap: pretty; }
  li svg { width: 18px; height: 18px; flex: none; margin-top: 2px; }
  .sag { position: absolute; left: 572px; right: 48px; top: 0; bottom: 0; display: flex; align-items: center; justify-content: center; }`, `
  <div class="sol" data-tasma="sol"><h1>${baslik}</h1><div class="p">${paragraf}</div>
    <ul>${maddeler.map(m => `<li>${TIK}<span>${m}</span></li>`).join('')}</ul></div>
  <div class="sag" data-tasma="sağ">${sag}</div>`);

// Yazdırma sahnesi: Belgenin alt yarısı (drive-belge.png), üstünde alttaki çubuk büyütülmüş (cubuk.png), altında
// çubuğun bölümlerinin adları. Ölçüler cubuk.png'de: Çubuk x 28–946, y 27–115, yarıçap 44. Bölümlerin ortası: E-imza
// rozeti 123, Notlar 269, yakınlaştırma 487, Yazdır / PDF 787. Belgedeki küçük çubuğun ortası (1920 px'lik görüntüde)
// x 951, y 1162: Büyütülmüş çubuk onun üstüne oturur.
function yazdirmaSahnesi() {
  // Kesit yalnız beyaz sayfa (x 557–1348), DELİLLER başlığının üstündeki boşlukta başlar (önceki satır y 595'te biter,
  // başlık 617'de başlar): Üstte yarım satır kalmasın. Başlık kartın kenarına yapışmasın diye üstte beyaz pay.
  const SAYFA = [557, 606, 791, 594], SAYFA_EN = 500, SOL = 80, CUBUK_EN = 600, PAY = 16;
  const o = SAYFA_EN / SAYFA[2], s = CUBUK_EN / 918;
  const ortaX = SOL + (951 - SAYFA[0]) * o, ortaY = PAY + (1162 - SAYFA[1]) * o;
  const cubukSol = Math.round(ortaX - CUBUK_EN / 2), cubukUst = Math.round(ortaY - 88 * s / 2), cubukAlt = cubukUst + Math.round(88 * s);
  const etiketler = [[123, 'E-imza durumu'], [269, 'Notlar'], [487, 'Yakınlaştırma'], [787, 'Yazdır / PDF']];
  const [ce] = boyut('cubuk.png');
  return `<div class="yazdir" style="position: relative; width: 660px; height: ${Math.ceil(cubukAlt + 62)}px">
    ${kesit('drive-belge.png', SAYFA, SAYFA_EN, `position: absolute; left: ${SOL}px; top: 0; background: #fff`, PAY)}
    <div class="cubuk" style="left: ${cubukSol}px; top: ${cubukUst}px; width: ${CUBUK_EN}px; height: ${cubukAlt - cubukUst}px; border-radius: ${44 * s}px">
      <img src="${resim('cubuk.png')}" style="width: ${ce * s}px; left: ${-28 * s}px; top: ${-27 * s}px"></div>
    ${etiketler.map(([x, ad]) => `<div class="etiket" style="left: ${Math.round(cubukSol + (x - 28) * s)}px; top: ${cubukAlt + 6}px"><i></i><span>${ad}</span></div>`).join('')}
  </div>`;
}
const YAZDIRMA_CSS = `
  .cubuk { position: absolute; overflow: hidden; box-shadow: 0 0 0 1px #ffffff40, 0 18px 40px #00000080; }
  .cubuk img { position: absolute; display: block; max-width: none; }
  .etiket { position: absolute; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .etiket i { width: 2px; height: 18px; background: ${VURGU}; }
  .etiket span { font-size: 15px; font-weight: 600; color: #f3f7fd; white-space: nowrap; }`;

// Gizlilik çizimi: Ortada onay işaretli kalkan, çevresinde üstü çizili dört simge (okuma, sunucu, saklama, gönderme).
const S = d => `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}<path d="M4 20 20 4" stroke="#ff8a8d" stroke-width="2.2"/></svg>`;
const GIZLILIK_CIZIMI = `<div class="cizim">
    <div class="halka" style="width: 300px; height: 300px"></div><div class="halka" style="width: 440px; height: 440px; border-style: dashed"></div>
    <svg class="kalkan" viewBox="0 0 200 236"><defs><linearGradient id="kg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd978"/><stop offset="1" stop-color="#f5b400"/></linearGradient></defs>
      <path d="M100 8 182 38v74c0 56-34 96-82 116C52 208 18 168 18 112V38z" fill="url(#kg)" stroke="#16386b" stroke-width="8" stroke-linejoin="round"/>
      <path d="M62 118 89 145 142 90" fill="none" stroke="#16386b" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <div class="rozet" style="left: 64px; top: 92px">${S('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>')}</div>
    <div class="rozet" style="left: 354px; top: 92px">${S('<rect x="4" y="4" width="16" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="16" height="6.5" rx="1.5"/><path d="M7.5 7.25h.01M7.5 16.75h.01"/>')}</div>
    <div class="rozet" style="left: 64px; top: 428px">${S('<path d="M5 4h11l3 3v11.5A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>')}</div>
    <div class="rozet" style="left: 354px; top: 428px">${S('<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>')}</div>
  </div>`;
const GIZLILIK_CSS = `
  .cizim { position: relative; width: 418px; height: 520px; }
  .halka { position: absolute; left: 50%; top: 50%; border-radius: 50%; border: 1.5px solid #ffffff1f; transform: translate(-50%, -50%); }
  .kalkan { position: absolute; left: 50%; top: 50%; width: 230px; transform: translate(-50%, -52%); filter: drop-shadow(0 22px 40px #00000066); }
  .rozet { position: absolute; width: 76px; height: 76px; border-radius: 50%; background: #ffffff1f; box-shadow: 0 0 0 1px #ffffff33;
           display: grid; place-items: center; transform: translate(-50%, -50%); }
  .rozet svg { width: 36px; height: 36px; }`;

const BASLIK = 'UDF belgeleri<br><span class="v">ön izlemede</span> açılır.';
// README görüntülerinde Drive'ın başlığı (dosya adı) ve belge birlikte: Sağdaki tarih sütunu ve ok dışarıda kalır.
const DRIVE = ['drive-belge.png', [0, 0, 1400, 1200]];

const ISLER = [
  { ad: 'ekran-1-drive-gmail.png', en: 1280, boy: 800, html: ekran({
    baslik: BASLIK,
    paragraf: 'Google Drive ve Gmail .udf belgelerini ön izleme olarak göstermez. Eklentiyle Drive’da dosyaya çift tıklamanız, Gmail’de eke tıklamanız yeter.',
    maddeler: ['Belge, PDF’ler gibi Google’ın kendi penceresinde açılır', 'Bilgisayara indirmeden okuyun', 'UYAP Doküman Editörü kurulu olması gerekmez'],
    sag: kesit(...DRIVE, 660) }) },
  { ad: 'ekran-2-notlar.png', en: 1280, boy: 800, html: ekran({
    baslik: 'Editör notları<br><span class="v">yan bölmede</span> açılır.',
    paragraf: 'Belgeye UYAP Doküman Editörü’nde eklenmiş notlar sağdaki bölmede listelenir.',
    maddeler: ['Notlu belgede bölme kendiliğinden açılır', 'Bir nota basınca işaretlediği yere gidilir', 'Pencere daraldıkça bölme de daralır'],
    // Belge ve not bölmesi: Bölmenin sağ kenarı (1836) kartın kenarında, Drive'ın sağdaki düğmeleri ve dosya adının
    // kesilen üst şeridi (y 0–114) dışarıda.
    sag: kesit('drive-notlar.png', [398, 114, 1440, 1086], 660) }) },
  { ad: 'ekran-3-yazdir.png', en: 1280, boy: 800, html: ekran({
    baslik: 'Yazdırın ya da<br><span class="v">PDF olarak</span> kaydedin.',
    paragraf: 'Belgenin altındaki çubukta imza durumu, notlar, yakınlaştırma ve Yazdır / PDF düğmesi durur.',
    maddeler: ['Yazdır / PDF düğmesiyle ya da Ctrl+P ile yazdırın', 'Yüzdeye basınca sayfa pencere genişliğine sığar', 'Belgede e-imza dosyası varsa çubukta rozet çıkar'],
    sag: yazdirmaSahnesi() }).replace('</style>', `${YAZDIRMA_CSS}</style>`) },
  { ad: 'ekran-4-gizlilik.png', en: 1280, boy: 800, html: ekran({
    baslik: 'Belgeleriniz<br><span class="v">dışarı çıkmaz</span>.',
    paragraf: 'Eklentinin sunucusu yoktur. Belge yalnız Google’dan, kendi oturumunuzla alınır ve yalnız tarayıcınızda gösterilir.',
    maddeler: ['Belgeyi hiçbir sunucuya göndermez', 'Hiçbir şey saklamaz, ayarı ve geçmişi yoktur', 'E-postaların metnine, konusuna, gönderenine ya da alıcılarına bakmaz',
      'Yalnız Drive ve Gmail sayfalarında çalışır', 'Üyelik, e-posta ya da ücret istemez'],
    sag: GIZLILIK_CIZIMI }).replace('</style>', `${GIZLILIK_CSS}</style>`) },
  // Küçük tanıtım karosu. Simgenin çizimi kutusunun solunda 128'de 18 birim boş: Çizimle yazı birlikte ortalansın diye o
  // kadar sola.
  { ad: 'tanitim-kucuk-440x280.png', en: 440, boy: 280, html: sayfa(440, 280, `
    body { display: flex; align-items: center; justify-content: center; gap: 18px; padding: 0 24px; }
    .simge { width: 118px; height: 118px; flex: none; margin-left: -17px; filter: drop-shadow(0 8px 18px #0000005e); }
    .ad { font-size: 30px; font-weight: 700; line-height: 1.1; letter-spacing: -.4px; white-space: nowrap; }
    .alt { margin-top: 11px; font-size: 16.5px; line-height: 1.4; color: #d4e0f2; white-space: nowrap; }`, `
    <div class="simge">${SIMGE}</div><div data-tasma="yazı"><div class="ad">UDF Ön İzleme</div>
      <div class="alt">UYAP .udf belgeleri<br><span class="v">Drive’da ve Gmail’de</span> açılır</div></div>`) },
  // Kayan yazı tanıtım bloğu (panelde "Kayan yazı tanıtım bloğu", İngilizcesi Marquee promo tile).
  { ad: 'kayan-yazi-tanitim-blogu-1400x560.png', en: 1400, boy: 560, html: sayfa(1400, 560, `
    .sol { position: absolute; left: 96px; top: 0; bottom: 0; width: 560px; display: flex; flex-direction: column; justify-content: center; }
    .ust { display: flex; align-items: center; gap: 12px; margin-bottom: 30px; }
    .ust .simge { width: 72px; height: 72px; margin-left: -10px; filter: drop-shadow(0 6px 14px #00000059); }
    .ust b { font-size: 26px; font-weight: 600; }
    h1 { font-size: 54px; font-weight: 700; line-height: 1.14; letter-spacing: -.5px; }
    .p { margin-top: 22px; font-size: 21px; line-height: 1.55; color: #d4e0f2; }
    .sag { position: absolute; right: 96px; top: 0; bottom: 0; display: flex; align-items: center; }`, `
    <div class="sol" data-tasma="yazı"><div class="ust"><div class="simge">${SIMGE}</div><b>UDF Ön İzleme</b></div>
      <h1>${BASLIK}</h1>
      <div class="p">Google Drive’daki ve Gmail’deki UYAP .udf belgelerini Google’ın kendi ön izleme penceresinde açar.</div></div>
    <div class="sag" data-tasma="kart">${kesit(...DRIVE, 576)}</div>`) },
  { ad: 'magaza-simgesi-128.png', kopya: path.join(KOK, 'simgeler', '128.png') }
];

// Chrome'un ekran görüntüsü RGBA olabilir: Saydamlık kanalı atılıp 24 bitlik PNG yazılır. Sayfanın zemini opak olduğu
// için her pikselin saydamlığı 255 olmalı, değilse hata.
export function rgbPng(png) {
  const parcalar = [];
  let en, boy, derinlik, tur;
  for (let i = 8; i < png.length;) {
    const uzunluk = png.readUInt32BE(i), ad = png.toString('latin1', i + 4, i + 8);
    if (ad === 'IHDR') { en = png.readUInt32BE(i + 8); boy = png.readUInt32BE(i + 12); derinlik = png[i + 16]; tur = png[i + 17]; }
    if (ad === 'IDAT') parcalar.push(png.subarray(i + 8, i + 8 + uzunluk));
    i += 12 + uzunluk;
  }
  if (derinlik !== 8 || (tur !== 2 && tur !== 6) || png[png.indexOf('IHDR') + 16] !== 0) throw new Error(`beklenmeyen PNG: derinlik ${derinlik}, tür ${tur}`);
  if (tur === 2) return png;
  const ham = zlib.inflateSync(Buffer.concat(parcalar));
  const satir = en * 4, cikti = Buffer.alloc((en * 3 + 1) * boy);
  let onceki = Buffer.alloc(satir);
  for (let y = 0; y < boy; y++) {
    const suzgec = ham[y * (satir + 1)], s = Buffer.from(ham.subarray(y * (satir + 1) + 1, (y + 1) * (satir + 1)));
    for (let x = 0; x < satir; x++) {
      const a = x >= 4 ? s[x - 4] : 0, b = onceki[x], c = x >= 4 ? onceki[x - 4] : 0;
      let ek = 0;
      if (suzgec === 1) ek = a;
      else if (suzgec === 2) ek = b;
      else if (suzgec === 3) ek = (a + b) >> 1;
      else if (suzgec === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); ek = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      else if (suzgec !== 0) throw new Error('bilinmeyen PNG süzgeci: ' + suzgec);
      s[x] = (s[x] + ek) & 255;
    }
    const hedef = y * (en * 3 + 1);
    for (let x = 0; x < en; x++) {
      if (s[x * 4 + 3] !== 255) throw new Error(`saydam piksel (${x}, ${y})`);
      cikti[hedef + 1 + x * 3] = s[x * 4]; cikti[hedef + 2 + x * 3] = s[x * 4 + 1]; cikti[hedef + 3 + x * 3] = s[x * 4 + 2];
    }
    onceki = s;
  }
  const crcTablo = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const parca = (ad, veri) => {
    const b = Buffer.alloc(12 + veri.length), govde = Buffer.concat([Buffer.from(ad, 'latin1'), veri]);
    let c = -1; for (const x of govde) c = crcTablo[(c ^ x) & 255] ^ (c >>> 8);
    b.writeUInt32BE(veri.length, 0); govde.copy(b, 4); b.writeUInt32BE((c ^ -1) >>> 0, 8 + veri.length);
    return b;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(en, 0); ihdr.writeUInt32BE(boy, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([png.subarray(0, 8), parca('IHDR', ihdr), parca('IDAT', zlib.deflateSync(cikti, { level: 9 })), parca('IEND', Buffer.alloc(0))]);
}

export async function magazaGorselleri(cikti = path.join(KOK, 'belgeler', 'magaza')) {
  fs.mkdirSync(cikti, { recursive: true });
  const gecici = fs.mkdtempSync(path.join(os.tmpdir(), 'udf-magaza-'));
  const c = await chromeBaslat();
  try {
    const s = await sekmeAc(c, 'about:blank');
    for (const a of ['Runtime.enable', 'Page.enable']) await s.g(a);
    for (const is of ISLER) {
      const yol = path.join(cikti, is.ad);
      if (is.kopya) fs.copyFileSync(is.kopya, yol);
      else {
        const html = path.join(gecici, is.ad.replace(/\.png$/, '.html'));
        fs.writeFileSync(html, is.html);
        await s.g('Emulation.setDeviceMetricsOverride', { width: is.en, height: is.boy, deviceScaleFactor: 1, mobile: false });
        await s.g('Page.navigate', { url: pathToFileURL(html).href });
        await ifadeBekle(s.g, "document.readyState === 'complete' && document.fonts.status === 'loaded' && [...document.images].every(i => i.complete && i.naturalWidth)");
        await new Promise(r => setTimeout(r, 300));
        // data-tasma işaretli kutuların içeriği kutuya, kutular da sayfaya sığmalı.
        const { result } = await s.g('Runtime.evaluate', { returnByValue: true, expression: `[...document.querySelectorAll('[data-tasma]')].filter(e => {
          const r = e.getBoundingClientRect();
          return e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1 || r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight;
        }).map(e => e.dataset.tasma)` });
        if (result.value.length) throw new Error(`${is.ad}: taşan kutu: ${result.value.join(', ')}`);
        const { data } = await s.g('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: is.en, height: is.boy, scale: 1 } });
        fs.writeFileSync(yol, rgbPng(Buffer.from(data, 'base64')));
      }
      const b = fs.readFileSync(yol);
      console.log(path.relative(KOK, yol), `${b.readUInt32BE(16)}×${b.readUInt32BE(20)}`, b[25] === 2 ? 'RGB' : 'RGBA', Math.round(b.length / 1024) + ' KB');
    }
  } finally {
    c.kapat();
    fs.rmSync(gecici, { recursive: true, force: true });
  }
}

if (process.argv[1] && process.argv[1].endsWith('magaza-gorselleri.mjs')) await magazaGorselleri(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
