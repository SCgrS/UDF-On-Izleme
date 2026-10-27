// Açılış hızı ölçümü: node araclar/chrome-sina.mjs hiz [tekrar] [--eklenti <klasör>] [--json <dosya>] [--buyuk]
// Sahte Gmail'de ve sahte Drive'da gerçekçi ağ gecikmeleriyle küçük bir dilekçeyi (testler/ornekler/dilekce.udf) ve
// resimli antetli ağır bir belgeyi (ornek-uret.mjs antetliBelge: Dört bölüm metin, her bölümün üst bilgisinde ~200 KB'lık
// A4 eninde resim) açar, her aşamanın tıklamadan sonraki süresini ölçer ve ortancasını yazar. Gecikmeler: Gmail ekinde
// 302 yanıtı 250 ms, imzalı adresin baytları 250 ms (gerçek Gmail'de küçük bir ek, boyundan bağımsız, ~480-560 ms'de
// iniyor), Drive indirmesi 400 ms. Service worker'ın ilk uyanışı ayrı ölçülür: "soğuk" açılıştan önce service worker
// durdurulur, "sıcak" açılış hemen önceki açılıştan kalan service worker'la yapılır.
// Aşamalar (ms, açan tıklamadan itibaren):
//   acildi     Google'ın ön izlemesi açıldı (#drive-active-item-info sayfada)
//   algilandi  İçerik betiği gömmeye başladı (ana alan işaretlendi)
//   kayit      Arka plan kaydı yazdı, çerçeve sayfaya eklendi
//   hazir      Çerçevedeki görüntüleyici yüklendi ("hazir" iletisi)
//   indirme    Sunucuya o dosyanın ilk isteği geldi
//   istek      Görüntüleyici baytları istedi (arka plana "indir" ya da kendi indirmesi)
//   bayt       Baytlar görüntüleyicide (motor okumaya başladı)
//   okundu     Motor belgeyi okudu
//   boyandi    İlk sayfa çizildi (çizimden sonraki ilk kare)
// --buyuk: 5 MB'lık bir belge de açılır (iki sıkıştırılmamış dolgu dosyası arasında kısa metin): Baytların arka plandan
// 1 MB'lık base64 dilimlerle aktarılmasının maliyeti görülür.
// Ölçüm araçları sayfaya ve çerçeveye CDP ile eklenir, eklentinin koduna ölçüm için hiçbir şey konmaz. --eklenti başka bir
// kopyayı (ör. değişiklikten önceki kodu) yükler: Aynı bilgisayarda önce/sonra karşılaştırması.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ifadeBekle, CERCEVE } from './cdp.mjs';
import { gmailSunucusu, oturumKur as gmailOturumu, iletileriHazirla, buyukBelge } from './sahte-gmail.mjs';
import { sunucuKur, oturumKur as driveOturumu, KIMLIK } from './sahte-drive.mjs';
import { antetliBelge } from './ornek-uret.mjs';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bekle = ms => new Promise(r => setTimeout(r, ms));
export const ASAMALAR = ['acildi', 'algilandi', 'kayit', 'hazir', 'indirme', 'istek', 'bayt', 'okundu', 'boyandi'];
const GECIKME = { gmailYonlendirme: 250, gmailEk: 250, drive: 400 };

// Sayfanın kendi dünyasında (Gmail ya da Drive): Tıklama, ön izlemenin açılması, içerik betiğinin ana alanı işaretlemesi,
// çerçevenin eklenmesi ve çerçevenin "hazir" iletisi.
const SAYFA_IZLEYICI = `(() => {
  if (window.__hiz) return 1;
  const h = window.__hiz = { olaylar: [] };
  const yaz = ad => h.olaylar.push([ad, Date.now()]);
  addEventListener('click', () => yaz('tik'), true);
  let bilgi = null;
  // Çerçeve ana alanın gölge köküne eklenir (icerik.js): İşaretlenen ana alanın gölge kökü de gözlenir.
  const gozlenen = new WeakSet();
  const g = new MutationObserver(kayitlar => {
    const b = document.getElementById('drive-active-item-info');
    if (b && !bilgi) yaz('acildi');
    bilgi = b;
    for (const k of kayitlar) {
      if (k.type === 'attributes' && k.target.hasAttribute('data-udf-okuyucu-gomulu')) {
        yaz('algilandi');
        const kok = k.target.shadowRoot;
        if (kok && !gozlenen.has(kok)) { gozlenen.add(kok); g.observe(kok, { childList: true }); }
      }
      if (k.type === 'childList') for (const n of k.addedNodes) if (n.nodeType === 1 && n.matches('iframe.udf-okuyucu-cerceve')) yaz('kayit');
    }
  });
  g.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-udf-okuyucu-gomulu'] });
  addEventListener('message', e => { if (e.data && e.data.udfOkuyucu === 1 && e.data.tur === 'hazir') yaz('hazir'); });
  return 1;
})()`;

// Gömülü görüntüleyicinin çerçevesinde, sayfanın betiklerinden önce: Kendi indirmesi (fetch), arka plana iletiler (kaydın
// alınması "kayit-al" dâhil), motorun okuması ve çizimi. Çizimden sonraki ilk kare "boyandi".
const CERCEVE_IZLEYICI = `(() => {
  if (globalThis.__hiz) return;
  const h = globalThis.__hiz = { olaylar: [['belge', Date.now()]] };
  const yaz = ad => h.olaylar.push([ad, Date.now()]);
  const f = globalThis.fetch;
  globalThis.fetch = function (...a) { yaz('fetch'); return f.apply(this, a).then(r => { yaz('fetch-yanit'); return r; }); };
  try {
    const rt = chrome.runtime, gonder = rt.sendMessage;
    rt.sendMessage = function (m, ...r) {
      const ad = m && m.tur === 'indir-dilim' ? 'dilim' + m.i : String(m && m.tur);
      yaz('gonder:' + ad);
      const p = gonder.call(rt, m, ...r);
      if (p && p.then) p.then(() => yaz('yanit:' + ad), () => yaz('red:' + ad));
      return p;
    };
  } catch (e) { h.hata = String(e); }
  let motor;
  Object.defineProperty(globalThis, 'UDFMotoru', { configurable: true, get: () => motor, set: v => {
    motor = Object.freeze({ ...v,
      oku: async (...a) => { yaz('oku'); try { return await v.oku(...a); } finally { yaz('okundu'); } },
      ciz: (...a) => { const r = v.ciz(...a); yaz('cizildi'); requestAnimationFrame(() => setTimeout(() => yaz('boyandi'), 0)); return r; } });
  } });
})()`;

const ortanca = d => { const s = d.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2)) : null; };

// Bir sayfada ölçüm düzeni: Sayfa izleyicisi, çerçevelerin kendiliğinden bağlanması (ölçüm betiği sayfa betiklerinden önce
// girsin diye çerçeve başlarken bekletilir) ve service worker'ı durdurma.
async function duzenKur(c, s, eklenti) {
  await s.g('Runtime.evaluate', { expression: SAYFA_IZLEYICI });
  let cerceve = null;
  c.dinle(async m => {
    if (m.method !== 'Target.attachedToTarget' || m.sessionId !== s.sessionId) return;
    const { sessionId, targetInfo, waitingForDebugger } = m.params;
    const g = (yontem, p) => c.gonder(yontem, p, sessionId);
    // Çerçeve bağlanırken adresi henüz boş: Sahte sayfalarda başka çerçeve süreci yok. Çerçevenin belgesi bekletilirken
    // kurulmuş oluyor: Betik o bağlamda hemen (runImmediately), sayfanın betiklerinden önce çalışır.
    if (targetInfo.type === 'iframe') {
      await g('Page.enable').catch(() => {});
      await g('Page.addScriptToEvaluateOnNewDocument', { source: CERCEVE_IZLEYICI, runImmediately: true }).catch(() => {});
      await g('Runtime.enable').catch(() => {});
      cerceve = { g };
    }
    if (waitingForDebugger) await g('Runtime.runIfWaitingForDebugger').catch(() => {});
  });
  await s.g('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
  const swDurdur = async () => {
    const swler = () => c.gonder('Target.getTargets').then(r => r.targetInfos.filter(t => t.type === 'service_worker' && t.url.startsWith(`chrome-extension://${eklenti}/`)));
    for (const t of await swler()) await c.gonder('Target.closeTarget', { targetId: t.targetId }).catch(() => {});
    for (let i = 0; i < 40 && (await swler()).length; i++) await bekle(50);
    await bekle(200);
  };
  return { cerceve: () => cerceve, sifirla: () => { cerceve = null; }, swDurdur };
}

// Tek açılış: Tıklar, belge çizilene dek bekler, aşama zamanlarını tıklamaya göre verir.
async function birAcilis({ s, duzen, ac, kapat, istekler, istekMi }) {
  duzen.sifirla();
  await s.g('Runtime.evaluate', { expression: 'window.__hiz.olaylar = []; 1' });
  const onceki = istekler.length;
  await ac();
  const bas = Date.now();
  let f = null;
  while (!(f = duzen.cerceve()) && Date.now() - bas < 10000) await bekle(20);
  if (!f) return { hata: 'çerçeve yok' };
  const durum = await ifadeBekle(f.g, "globalThis.__hiz && (__hiz.olaylar.some(o => o[0] === 'boyandi') ? 'tamam' : document.querySelector('.durum.hata') ? 'hata: ' + document.querySelector('.durum.hata h2').textContent : '')", 20000).catch(() => 'zaman aşımı');
  await bekle(50);
  const sayfaOlaylari = (await s.g('Runtime.evaluate', { expression: 'window.__hiz.olaylar', returnByValue: true })).result.value;
  const cerceveOlaylari = (await f.g('Runtime.evaluate', { expression: 'globalThis.__hiz.olaylar', returnByValue: true })).result.value || [];
  const yeni = istekler.slice(onceki).filter(istekMi);
  await kapat();
  if (durum !== 'tamam') return { hata: durum };
  const tikler = sayfaOlaylari.filter(o => o[0] === 'tik').map(o => o[1]);
  const t0 = tikler.length ? Math.max(...tikler) : null;
  const ilk = (liste, kosul) => { const o = liste.find(x => kosul(x[0]) && x[1] >= t0 - 5); return o ? o[1] - t0 : null; };
  const a = {
    acildi: ilk(sayfaOlaylari, x => x === 'acildi'),
    algilandi: ilk(sayfaOlaylari, x => x === 'algilandi'),
    kayit: ilk(sayfaOlaylari, x => x === 'kayit'),
    hazir: ilk(sayfaOlaylari, x => x === 'hazir'),
    indirme: yeni.length ? Math.min(...yeni.map(i => i.zaman)) - t0 : null,
    istek: ilk(cerceveOlaylari, x => x === 'fetch' || x === 'gonder:indir'),
    bayt: ilk(cerceveOlaylari, x => x === 'oku'),
    okundu: ilk(cerceveOlaylari, x => x === 'okundu'),
    boyandi: ilk(cerceveOlaylari, x => x === 'boyandi')
  };
  return { asamalar: a, istekSayisi: yeni.length, cerceveOlaylari: cerceveOlaylari.map(([ad, z]) => [ad, z - t0]) };
}

async function senaryo({ ad, s, duzen, ac, kapat, istekler, istekMi, tekrar, sonuclar }) {
  for (const kip of ['soğuk', 'sıcak']) sonuclar[`${ad} · ${kip}`] = [];
  // Isınma: Chrome'un ilk çerçeve süreci ve önbellekleri ölçüme girmesin.
  await birAcilis({ s, duzen, ac, kapat, istekler, istekMi });
  for (let i = 0; i < tekrar * 2; i++) {
    const kip = i % 2 ? 'sıcak' : 'soğuk';
    if (kip === 'soğuk') await duzen.swDurdur();
    const r = await birAcilis({ s, duzen, ac, kapat, istekler, istekMi });
    sonuclar[`${ad} · ${kip}`].push(r);
    if (r.hata) console.log(`  ${ad} · ${kip}: ${r.hata}`);
  }
}

function tablo(sonuclar) {
  const satirlar = [];
  const ozet = {};
  for (const [ad, liste] of Object.entries(sonuclar)) {
    const iyi = liste.filter(r => !r.hata);
    const o = Object.fromEntries(ASAMALAR.map(k => [k, ortanca(iyi.map(r => r.asamalar[k]))]));
    o.istekSayisi = ortanca(iyi.map(r => r.istekSayisi));
    o.hata = liste.length - iyi.length;
    ozet[ad] = o;
    satirlar.push(`${ad.padEnd(28)} ${ASAMALAR.map(k => String(o[k] ?? '-').padStart(9)).join('')}   istek ${o.istekSayisi}${o.hata ? ' · hata ' + o.hata : ''}`);
  }
  console.log(`${'ortanca, ms'.padEnd(28)} ${ASAMALAR.map(k => k.padStart(9)).join('')}`);
  for (const s of satirlar) console.log(s);
  return ozet;
}

export async function hizOlc(arg = []) {
  const secenek = { tekrar: 7, eklenti: KOK, json: null, buyuk: false };
  for (let i = 0; i < arg.length; i++) {
    if (arg[i] === '--eklenti') secenek.eklenti = path.resolve(arg[++i]);
    else if (arg[i] === '--buyuk') secenek.buyuk = true;
    else if (arg[i] === '--json') secenek.json = path.resolve(arg[++i]);
    else if (/^\d+$/.test(arg[i])) secenek.tekrar = Number(arg[i]);
  }
  const kucuk = fs.readFileSync(path.join(KOK, 'testler', 'ornekler', 'dilekce.udf'));
  const { udf: agir, resim } = antetliBelge();
  const buyuk = secenek.buyuk ? buyukBelge('BÜYÜK BELGE', 5 * (1 << 20)) : null;
  console.log(`eklenti: ${secenek.eklenti} · tekrar: ${secenek.tekrar} · küçük ${kucuk.length} bayt, ağır ${agir.length} bayt (antet resmi ${resim} bayt)` +
    (buyuk ? `, büyük ${buyuk.length} bayt` : ''));
  const sonuclar = {};

  // ---------------------------------------------------------------- Gmail
  {
    const iletiler = iletileriHazirla([
      { harf: 'A', msg: '1797114040482588150', ekler: [{ ad: 'Dilekce.udf', bayt: kucuk }, { ad: 'Antetli.udf', bayt: agir }, { ad: 'Büyük.udf', bayt: buyuk || kucuk }] },
      { harf: 'B', msg: '1797114040482588327', ekler: [{ ad: 'İkinci.udf', bayt: kucuk }, { ad: 'Üçüncü.udf', bayt: kucuk }] }
    ]);
    const { sunucu, istekler, port } = await gmailSunucusu(iletiler, { yonlendirmeGecikmesi: GECIKME.gmailYonlendirme, ekGecikmesi: GECIKME.gmailEk });
    const o = await gmailOturumu({ port, eklenti: secenek.eklenti });
    try {
      const s = await o.gmailAc();
      await s.g('Page.bringToFront');
      const duzen = await duzenKur(o.c, s, o.eklenti);
      const kapat = async () => {
        await o.deger(s.g, "(document.querySelector('[aria-label=Kapat]') || { click() {} }).click(), 1");
        await ifadeBekle(s.g, `!document.getElementById('drive-active-item-info') && !${CERCEVE}`, 3000).catch(() => {});
        await bekle(400);
      };
      for (const [ad, sira, ek] of [['Gmail küçük', 0, 'A 0.1'], ['Gmail ağır', 1, 'A 0.2'], ...(buyuk ? [['Gmail büyük', 2, 'A 0.3']] : [])]) {
        await senaryo({ ad, s, duzen, ac: () => o.ekAc(s.g, 'A', sira), kapat, istekler, istekMi: i => i.host === 'mail.google.com' && i.ek === ek, tekrar: secenek.tekrar, sonuclar });
      }
    } finally { o.c.kapat(); sunucu.close(); }
  }

  // ---------------------------------------------------------------- Drive
  {
    const ayar = { indirmeGecikmesi: GECIKME.drive };
    const { sunucu, istekler, port } = await sunucuKur(kucuk, ayar);
    const o = await driveOturumu({ port, eklenti: secenek.eklenti });
    try {
      await o.s.g('Page.bringToFront');
      const duzen = await duzenKur(o.c, o.s, o.eklenti);
      const kapat = async () => {
        await o.deger(o.s.g, 'kapat(), 1');
        await ifadeBekle(o.s.g, `!document.getElementById('drive-active-item-info') && !${CERCEVE}`, 3000).catch(() => {});
        await bekle(400);
      };
      const ac = async () => o.ciftTikla(o.s.g, await o.satir(KIMLIK.udf));
      for (const [ad, bayt] of [['Drive küçük', kucuk], ['Drive ağır', agir], ...(buyuk ? [['Drive büyük', buyuk]] : [])]) {
        ayar.bayt = bayt;
        await senaryo({ ad, s: o.s, duzen, ac, kapat, istekler, istekMi: i => i.id === KIMLIK.udf, tekrar: secenek.tekrar, sonuclar });
      }
    } finally { o.c.kapat(); sunucu.close(); }
  }

  const ozet = tablo(sonuclar);
  if (secenek.json) fs.writeFileSync(secenek.json, JSON.stringify({ eklenti: secenek.eklenti, gecikme: GECIKME, ozet, sonuclar }, null, 1));
  return Object.values(ozet).some(o => o.hata) ? 1 : 0;
}
