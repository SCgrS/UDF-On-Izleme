// README'deki ekran görüntülerini üretir: gerçek Google Drive'ın görüntüleyicisinde (herkese açık gdown örnek klasörü,
// oturum açılmaz) iki yapay dilekçe. Gerçek belge kullanılmaz. Klasörde UDF olmadığı için eklentinin geçici bir kopyası
// .txt dosyalarını UDF sayar ve Drive'dan indirmek yerine yapay belgeleri verir (dosya kimliğine göre); Drive'ın
// başlığında ve arkadaki listede görünen dosya adları da yapay adlarla değiştirilir (yalnız görüntü için). Tam ekran
// (1920×1200) ve 2 kat yoğunlukta çekilir: not bölmesi açıkken de belge ortada kalır, yazılar keskin olur. İnternet gerekir.
//   node araclar/tanitim-gorselleri.mjs [çıktı klasörü]   (varsayılan belgeler/gorseller)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromeBaslat, sekmeAc, ifadeBekle, CERCEVE } from './cdp.mjs';
import { Belge, SEKME, udfZip, sahteImza } from './ornek-uret.mjs';
import { eklentiyiKopyala } from './paketle.mjs';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KLASOR = 'https://drive.google.com/drive/folders/15uNXeRBIhVvZJIhL4yTw4IsStMhUaaxl';
// Açılan iki dosya: önce notlu dilekçe (not bölmesi kendiliğinden açılır), sağ okla sonraki dosya, notsuz dilekçe.
const NOTLU = 'spam.txt', NOTSUZ = 'spam2.txt';
// Görüntüde örnek klasördeki adların yerine geçen yapay adlar (Drive'ın başlığı, arkadaki liste).
const ADLAR = {
  'spam.txt': 'Bilirkişi Raporuna İtiraz.udf', 'spam2.txt': 'Dava Dilekçesi.udf', 'spam3.txt': 'Ara Karar.udf',
  'spam4.txt': 'Ek-1 Bordrolar.pdf', 'gdown.docx': 'Cevap Dilekçesi.udf', 'gdown.pptx': 'Tensip Zaptı.pdf',
  'gdown.xlsx': 'Bilirkişi Raporu.pdf', deep_folder: 'Dava Dosyası', files_1: 'Bilirkişi Raporları', files_2: 'Dilekçeler',
  files_3: 'Duruşma Tutanakları', files_51: 'Ekler', files_75: 'İcra', files_88: 'Tebligatlar', files_100: 'Yazışmalar',
  folder_with_pptx: 'Arşiv', '5 bayt': '14 KB'
};
const EN = 1920, BOY = 1200, YOGUNLUK = 2;
// Sayfada çalışır (yalnız görüntü için): adlar değişir; Drive'ın metin dosyasına özgü Yazdır ve yakınlaştırma
// denetimleri gizlenir (gerçek .udf önizlemesinde o şeritte yalnız İndir var); dosya simgesi griye döner (Drive .udf için
// gri, adsız dosya simgesi gösterir); oturum açma düğmesi ve tanıtım kutusu gizlenir.
const GORUNUM_DUZENI = `(adlar => {
  const yuruyucu = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = yuruyucu.nextNode());) { const t = n.nodeValue.trim(); if (Object.hasOwn(adlar, t)) n.nodeValue = n.nodeValue.replace(t, adlar[t]); }
  const kutu = e => e.getBoundingClientRect();
  // Görüntüleyicinin ikinci şeridindeki (64–112 px) İndir düğmesi; şeridin geri kalanı gizlenir.
  const indir = [...document.querySelectorAll('[aria-label="İndir"]')].find(e => { const r = kutu(e); return e.checkVisibility() && r.top >= 60 && r.bottom <= 116 && r.left < 100; });
  if (indir) {
    let serit = indir;
    while (serit.parentElement && kutu(serit.parentElement).width < innerWidth - 100) serit = serit.parentElement;
    serit = serit.parentElement || serit;
    if (kutu(serit).height > 80) return 'şerit bulunamadı';   // yanlışlıkla görüntüleyicinin tamamı gizlenmesin
    for (const e of serit.querySelectorAll('*')) if (!e.contains(indir) && !indir.contains(e)) e.style.visibility = 'hidden';
  }
  for (const s of document.querySelectorAll('svg')) { const r = kutu(s); if (r.top > 0 && r.top < 60 && r.left > 50 && r.left < 90) s.style.filter = 'grayscale(1) brightness(1.15)'; }
  for (const e of document.querySelectorAll('a, button, [role=button]')) if (/^oturum aç/i.test(e.textContent.trim())) e.style.visibility = 'hidden';
  for (const e of document.querySelectorAll('body *')) {
    if (![...e.childNodes].some(n => n.nodeType === 3 && /güvenli bir yer/i.test(n.nodeValue))) continue;
    let k = e;
    while (k.parentElement && kutu(k.parentElement).width < 520 && kutu(k.parentElement).height < 320) k = k.parentElement;
    k.style.visibility = 'hidden';
  }
  return indir ? 'tamam' : 'İndir yok';
})`;
const bekle = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- yapay dilekçeler
function dilekce({ baslik, bilgiler, aciklamalar, sonrakiler, istem, imza, notlar = [] }) {
  const b = new Belge();
  const o = [];
  const kalin = { bold: true };
  const satir = (p, parcalar) => o.push(b.paragraf(p, parcalar));
  const bilgi = (ad, deger) => satir({ Alignment: 3, TabSet: '110.0:0:0', Hanging: '122.0', SpaceBelow: 3 }, [[ad, kalin], SEKME, [': ' + deger]]);
  satir({ Alignment: 1, SpaceBelow: 18 }, [[baslik, kalin]]);
  for (const [ad, deger] of bilgiler) bilgi(ad, deger);
  satir({ SpaceAbove: 12, SpaceBelow: 6 }, [['AÇIKLAMALAR', kalin]]);
  for (const parcalar of aciklamalar) satir({ Alignment: 3, LeftIndent: 25, SpaceBelow: 6, Numbered: 'true', NumberType: 'NUMBER_TYPE_NUMBER_TRE', ListLevel: 1, ListId: 1 }, parcalar);
  for (const [ad, deger] of sonrakiler) { satir({ SpaceAbove: 8 }, [[ad, kalin]]); satir({ Alignment: 3, FirstLineIndent: 35.4375, SpaceBelow: 4 }, [[deger]]); }
  satir({ SpaceAbove: 12, SpaceBelow: 6 }, [['SONUÇ VE İSTEM', kalin]]);
  satir({ Alignment: 3, FirstLineIndent: 35.4375, SpaceBelow: 18 }, [[istem]]);
  satir({ Alignment: 2 }, [['07.10.2026']]);
  satir({ Alignment: 2 }, [[imza]]);
  satir({ Alignment: 2 }, [['Av. Deneme Avukat', kalin]]);
  o.push(`<footer pageNumber-spec="BSP32_2120" pageNumber-color="-16777216" pageNumber-fontFace="Times New Roman" pageNumber-fontSize="11" pageNumber-fontBold="false" pageNumber-fontItalic="false" pageNumber-foreStr="" pageNumber-seperator="/">${b.paragraf({}, [])}</footer>`);
  const icerik = Buffer.from(b.xml({ ogeler: o }), 'utf8');
  const girdiler = [['content.xml', icerik], ['sign.sgn', sahteImza(icerik)]];
  if (notlar.length) {
    // UYAP Doküman Editörü'nün notları gibi: metinleri tek bir CDATA'da, her biri kendi satırında.
    let havuz = '', ogeler = '';
    notlar.forEach(([hedef, metin, zaman], i) => {
      const bas = b.havuz.indexOf(hedef);
      if (bas < 0) throw new Error('not hedefi bulunamadı: ' + hedef);
      ogeler += `<comment type="1" strtOffs="${bas}" endOffs="${bas + hedef.length}" indx="${i}" time="${zaman}" usr="Av. Deneme Avukat"><paragraph><content startOffset="${havuz.length}" length="${metin.length + 1}"/></paragraph></comment>`;
      havuz += metin + '\n';
    });
    girdiler.push(['comments.xml', `<?xml version="1.0" encoding="UTF-8" ?> \n\n<template format_id="1.8" >\n<content><![CDATA[${havuz}]]></content>\n<elements resolver="hvl-default" >${ogeler}</elements>\n</template>\n`]);
  }
  return udfZip(girdiler);
}

const TARAFLAR = [['DAVACI', 'Örnek Kişi'], ['VEKİLİ', 'Av. Deneme Avukat, Örnek Mah. Deneme Sok. No: 1 Şişli/İSTANBUL'], ['DAVALI', 'Örnek Ticaret A.Ş.']];

// E-imzalı, iki notlu: bilirkişi raporuna itiraz.
export const notluBelge = () => dilekce({
  baslik: 'İSTANBUL 1. İŞ MAHKEMESİ’NE',
  bilgiler: [['DOSYA NO', '2026/123 Esas'], ...TARAFLAR, ['KONU', 'Bilirkişi raporuna karşı itirazlarımızın sunulmasıdır.']],
  aciklamalar: [
    [['Mahkemenizce alınan '], ['12.09.2026 tarihli bilirkişi raporu'], [' tarafımıza 25.09.2026 tarihinde tebliğ edilmiştir. Süresi içinde rapora karşı itirazlarımızı sunuyoruz.']],
    [['Bilirkişi, davacının fazla çalışma alacağını hesaplarken tanık beyanlarını dikkate almamış, yalnızca işyeri kayıtlarına dayanmıştır. Oysa işçinin imzasını taşımayan puantaj kayıtlarının tek başına delil olamayacağı '], ['Yargıtay’ın yerleşik içtihatlarıyla'], [' sabittir.']],
    [['Yıllık izin alacağı hesaplanırken davacının kıdemine göre hak ettiği izin süresi gözetilmemiş, eksik gün üzerinden hesaplama yapılmıştır.']],
    [['Hesaplamada esas alınan ücret, davacının fiilen aldığı ücretten düşüktür. Bordrolara yansımayan ve banka kayıtlarıyla sabit olan ödemeler hesaba katılmamıştır.']]
  ],
  sonrakiler: [],
  istem: 'Yukarıda açıklanan nedenlerle; bilirkişi raporuna karşı itirazlarımızın kabulü ile dosyanın ek rapor alınmak üzere aynı bilirkişiye ya da yeni bir bilirkişi heyetine tevdiine karar verilmesini saygıyla arz ve talep ederiz.',
  imza: 'Davacı Vekili',
  notlar: [
    ['12.09.2026 tarihli bilirkişi raporu', 'Tebliğ tarihi UYAP’tan kontrol edilecek.', 1791360000000],
    ['Yargıtay’ın yerleşik içtihatlarıyla', 'İçtihat künyeleri eklenecek.', 1791363600000]
  ]
});

// E-imzalı, notsuz: dava dilekçesi.
export const notsuzBelge = () => dilekce({
  baslik: 'İSTANBUL NÖBETÇİ İŞ MAHKEMESİ’NE',
  bilgiler: [...TARAFLAR, ['KONU', 'Fazla çalışma, yıllık izin ve kıdem tazminatı alacaklarının tahsili istemidir.'], ['DAVA DEĞERİ', '10.000,00 TL (fazlaya ilişkin haklarımız saklıdır)']],
  aciklamalar: [
    [['Müvekkil, davalı şirkette 01.03.2021 – 30.06.2026 tarihleri arasında satış temsilcisi olarak çalışmıştır.']],
    [['Müvekkil haftada altı gün, 08.30 – 20.00 saatleri arasında çalışmış; fazla çalışma ücretleri ödenmemiştir.']],
    [['Müvekkilin hak ettiği yıllık izinler kullandırılmamış, izin ücretleri de ödenmemiştir.']],
    [['İş sözleşmesi, ücretlerin ödenmemesi nedeniyle müvekkil tarafından haklı nedenle feshedilmiştir.']]
  ],
  sonrakiler: [
    ['DELİLLER', 'İşyeri kayıtları, bordrolar, banka ve SGK kayıtları, tanık, bilirkişi incelemesi ve her türlü yasal delil.'],
    ['HUKUKİ NEDENLER', '4857 sayılı İş Kanunu, 7036 sayılı İş Mahkemeleri Kanunu ve ilgili mevzuat.']
  ],
  istem: 'Yukarıda açıklanan nedenlerle; davamızın kabulü ile fazlaya ilişkin haklarımız saklı kalmak kaydıyla alacakların yasal faiziyle birlikte davalıdan tahsiline, yargılama giderleri ile vekâlet ücretinin davalıya yükletilmesine karar verilmesini saygıyla arz ve talep ederiz.',
  imza: 'Davacı Vekili'
});

// ---------------------------------------------------------------- yardımcılar
function kopyaKur(belgeler) {
  const hedef = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'udf-tanitim-')), 'eklenti');
  eklentiyiKopyala(hedef);
  const degistir = (ad, eski, yeni) => {
    const yol = path.join(hedef, ad);
    const s = fs.readFileSync(yol, 'utf8');
    if (!s.includes(eski)) throw new Error(`${ad} değiştirilemedi (kalıp değişmiş): ${eski}`);
    fs.writeFileSync(yol, s.replace(eski, yeni));
  };
  degistir('drive-kimlik.js', "/\\.udf$/i.test(ad.trim())", "/\\.(udf|txt)$/i.test(ad.trim())");
  const veri = Object.fromEntries(Object.entries(belgeler).map(([k, v]) => [k, Buffer.from(v).toString('base64')]));
  degistir('indir.js', '  async function udfIndir({ id, au, rk }, { signal } = {}) {\n',
    `  async function udfIndir({ id, au, rk }, { signal } = {}) {\n    { const v = (${JSON.stringify(veri)})[id]; if (v) { const s = atob(v); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return { bayt: b, ad: null, hesap: null }; } }\n`);
  return hedef;
}

// PNG'yi yüksek kaliteli küçültür (Chrome'un createImageBitmap'i, resizeQuality: 'high').
export async function pngKucult(c, png, en, boy) {
  const s = await sekmeAc(c, 'about:blank');
  try {
    const r = await s.g('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
      const blob = await (await fetch('data:image/png;base64,${png.toString('base64')}')).blob();
      const bmp = await createImageBitmap(blob, { resizeWidth: ${en}, resizeHeight: ${boy}, resizeQuality: 'high' });
      const cv = new OffscreenCanvas(${en}, ${boy}); cv.getContext('2d').drawImage(bmp, 0, 0);
      const b = new Uint8Array(await (await cv.convertToBlob({ type: 'image/png' })).arrayBuffer());
      let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      return btoa(s);
    })()` });
    if (!r.result || typeof r.result.value !== 'string') throw new Error('küçültülemedi: ' + JSON.stringify(r.exceptionDetails || r.result).slice(0, 200));
    return Buffer.from(r.result.value, 'base64');
  } finally {
    await c.gonder('Target.closeTarget', { targetId: s.targetId });
  }
}

// ---------------------------------------------------------------- çekim
const cek = async (g, secenek = {}) => Buffer.from((await g('Page.captureScreenshot', { format: 'png', ...secenek })).data, 'base64');

export async function tanitimGorselleri(cikti = path.join(KOK, 'belgeler', 'gorseller'), { incele } = {}) {
  fs.mkdirSync(cikti, { recursive: true });
  const c = await chromeBaslat({ ekler: [`--window-size=${EN},${BOY}`, `--force-device-scale-factor=${YOGUNLUK}`] });
  let kopya = null;
  const kaydet = (ad, png) => {
    const yol = path.join(cikti, ad);
    fs.writeFileSync(yol, png);
    console.log(path.relative(KOK, yol), `${png.readUInt32BE(16)}×${png.readUInt32BE(20)}`, Math.round(png.length / 1024) + ' KB');
  };
  try {
    const s = await sekmeAc(c, 'about:blank');
    for (const a of ['Runtime.enable', 'Page.enable']) await s.g(a);
    const { userAgent } = await c.gonder('Browser.getVersion');
    await s.g('Emulation.setUserAgentOverride', { userAgent: userAgent.replace('HeadlessChrome', 'Chrome'), acceptLanguage: 'tr-TR,tr' });
    await s.g('Emulation.setDeviceMetricsOverride', { width: EN, height: BOY, deviceScaleFactor: YOGUNLUK, mobile: false });
    const deger = async (g, ifade) => (await g('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression: ifade })).result.value;
    const listeyiBekle = async () => {
      await ifadeBekle(s.g, `[...document.querySelectorAll('[data-id]')].some(r => r.textContent.includes('${NOTLU}'))`, 30000);
      await bekle(1500);
    };
    // Önce dosya kimlikleri okunur, yapay belgeler bu kimliklere bağlanıp eklenti yüklenir, sayfa yenilenir.
    await s.g('Page.navigate', { url: KLASOR });
    await listeyiBekle();
    const kimlik = await deger(s.g, `(() => { const k = {}; for (const r of document.querySelectorAll('[role=row][data-id]')) for (const ad of ['${NOTLU}', '${NOTSUZ}']) if ([...r.querySelectorAll('*')].some(e => !e.childElementCount && e.textContent.trim() === ad)) k[ad] = r.dataset.id; return k; })()`);
    if (!kimlik[NOTLU] || !kimlik[NOTSUZ]) throw new Error('örnek dosyalar listede yok: ' + JSON.stringify(kimlik));
    kopya = kopyaKur({ [kimlik[NOTLU]]: notluBelge(), [kimlik[NOTSUZ]]: notsuzBelge() });
    const { id } = await c.gonder('Extensions.loadUnpacked', { path: kopya });
    await s.g('Page.reload');
    await listeyiBekle();
    // Satırı çift tıkla (Drive ikinci tıklamada açar; gercek-drive.mjs'teki gibi konum oturana dek beklenir).
    const satirYeri = () => deger(s.g, `(() => { const r = [...document.querySelectorAll('[role=row][data-id]')].find(r => [...r.querySelectorAll('*')].some(e => !e.childElementCount && e.textContent.trim() === '${NOTLU}'));
      const e = [...r.querySelectorAll('*')].find(e => !e.childElementCount && e.textContent.trim() === '${NOTLU}');
      const b = e.getBoundingClientRect(); const x = b.left + 5, y = b.top + b.height / 2;
      if (y < 0 || y > innerHeight - 40) { e.scrollIntoView({ block: 'center' }); return null; }
      const h = document.elementFromPoint(x, y); return h && r.contains(h) ? { x, y } : null; })()`);
    const ciftTikla = async () => {
      let yer = null, onceki = null;
      for (let i = 0; i < 40 && !(yer && onceki && yer.y === onceki.y); i++) { onceki = yer; await bekle(250); yer = await satirYeri(); }
      if (!yer) throw new Error('satır tıklanabilir değil');
      await s.g('Input.dispatchMouseEvent', { type: 'mouseMoved', x: yer.x, y: yer.y });
      await bekle(200);
      for (const n of [1, 2]) {
        await s.g('Input.dispatchMouseEvent', { type: 'mousePressed', x: yer.x, y: yer.y, button: 'left', buttons: 1, clickCount: n });
        await bekle(40);
        await s.g('Input.dispatchMouseEvent', { type: 'mouseReleased', x: yer.x, y: yer.y, button: 'left', buttons: 0, clickCount: n });
        await bekle(80);
      }
    };
    await ciftTikla();
    // Drive bazen ilk çift tıklamaya tepki vermiyor (yükleme sürerken): önizleme açılmadıysa bir kez daha.
    if (!(await ifadeBekle(s.g, "!!document.getElementById('drive-active-item-info')", 8000).catch(() => false))) await ciftTikla();
    // Gömülü görüntüleyici çerçevesi; belge çizilene dek beklenir. Önceki çerçeve (öbür dosya) atlanır.
    const cerceveBekle = async (haric = null) => {
      for (let i = 0; i < 100; i++) {
        const h = (await c.gonder('Target.getTargets')).targetInfos.find(t => t.type === 'iframe' && t.url.includes(`${id}/gomulu.html#t=`) && t.targetId !== haric);
        if (h) {
          const { sessionId } = await c.gonder('Target.attachToTarget', { targetId: h.targetId, flatten: true });
          const g = (m, p) => c.gonder(m, p, sessionId);
          await g('Runtime.enable');
          await ifadeBekle(g, "!!document.querySelector('.udf-sayfa') && [...document.querySelectorAll('.udf-resim img')].every(x => x.complete)", 20000);
          return { g, hedef: h.targetId };
        }
        await bekle(150);
      }
      throw new Error('görüntüleyici çerçevesi açılmadı');
    };
    const duzenle = async () => {
      // Fare imleci kenara gider (düğmelerin üstünde iz kalmasın); Drive'ın tanıtım kutusu gecikmeli çıktığı için beklenir.
      await s.g('Input.dispatchMouseEvent', { type: 'mouseMoved', x: EN - 2, y: BOY - 2 });
      await bekle(2500);
      console.log('görünüm düzeni:', await deger(s.g, `${GORUNUM_DUZENI}(${JSON.stringify(ADLAR)})`));
      await bekle(500);
    };
    const tam = async (ad, g) => kaydet(ad, await pngKucult(c, await cek(s.g), EN, BOY));

    const notlu = await cerceveBekle();
    if (incele) { await incele(s.g, notlu.g, deger); return; }
    await duzenle();
    // 1. Notlu belge: not bölmesi kendiliğinden açık, Notlar düğmesi çerçeveli; belge yine ortada.
    await tam('drive-notlar.png');
    // 2. Alttaki çubuk, yakından (2 kat), Drive'ın koyu zemininde: arkadaki belge bu çekim için gizlenir.
    const cer = await deger(s.g, `(() => { const r = ${CERCEVE}.getBoundingClientRect(); return [r.left, r.top]; })()`);
    const hap = await deger(notlu.g, "(() => { document.getElementById('alan').style.visibility = 'hidden'; const r = document.querySelector('.cubuk').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()");
    await bekle(300);
    kaydet('cubuk.png', await cek(s.g, { clip: { x: cer[0] + hap[0] - 14, y: cer[1] + hap[1] - 14, width: hap[2] + 28, height: hap[3] + 28, scale: 1 } }));
    await deger(notlu.g, "document.getElementById('alan').style.visibility = ''; 1");
    // 3. Sağ okla sonraki dosya: notsuz belge.
    await deger(s.g, `${CERCEVE}.focus(); 1`);
    await s.g('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await s.g('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await cerceveBekle(notlu.hedef);
    await duzenle();
    await tam('drive-belge.png');
  } finally {
    c.kapat();
    if (kopya) fs.rmSync(path.dirname(kopya), { recursive: true, force: true });
  }
}

if (process.argv[1] && process.argv[1].endsWith('tanitim-gorselleri.mjs')) {
  const klasor = process.argv[2];
  await tanitimGorselleri(klasor ? path.resolve(klasor) : undefined);
}
