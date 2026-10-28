import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { JSDOM, VirtualConsole } from 'jsdom';
import { KOK } from './yardimci.mjs';

// İçerik betiğini (icerik.js) jsdom'da sahte chrome.runtime ve sahte saatle çalıştırır. Drive'ın ve Gmail'in görüntüleyicisi
// DRIVE-TEKNIGI.md'deki ölçülen yapıyla (§6.1, §11.1) yapay olarak kurulur: Konumu sabit katman, Gmail'de role=dialog, her
// dosya ya da ek için bir ana alan (role=main), gösterilenin içinde #drive-active-item-info. Gerçek tarayıcıdaki uçtan uca
// sınama: node araclar/chrome-sina.mjs drive | gmail.
// jsdom betiğin gönderdiği olayı hep güvenilmeyen (isTrusted false) yapar: Kullanıcının gerçek girişi jsdom'un iç gönderimiyle
// taklit edilir.
const ic = createRequire(import.meta.url)('jsdom/lib/jsdom/living/generated/utils.js');

const ID_A = '1AaaBbbCccDddEeeFffGggHhhIiiJjjKk', ID_B = '1ZzzYyyXxxWwwVvvUuuTttSssRrrQqq';
const IK = '1a2b3c4d5e';
const A = { harf: 'A', msg: '1797114040482588150', th: '18f0a1b2c3d4e5f6' };
const B = { harf: 'B', msg: '1797114040482588327', th: '18f0a1b2c3d4e6a7' };
const ANAHTAR = /^[0-9a-f-]{36}$/;
const MiB = 1 << 20;
const olcu = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
const ANA_OLCUSU = olcu(0, 0, 1000, 800);

// Sayfa: url, once (betikler yüklenmeden önce sayfayı kurar), kayitYaniti ve acYaniti (arka planın gomulu-kayit ve udf-ac
// yanıtı).
function kur(url, { once, kayitYaniti, acYaniti } = {}) {
  const hatalar = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => hatalar.push(String(e && (e.detail && e.detail.stack || e.stack) || e)));
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window, d = w.document;

  // Sahte saat: Betiğin zamanlayıcıları ve Date.now yalnız ilerlet() ile ilerler.
  const saat = { simdi: 1_000_000, sira: 0, bekleyen: new Map() };
  w.setTimeout = (f, ms = 0) => { const k = ++saat.sira; saat.bekleyen.set(k, { t: saat.simdi + Math.max(0, Number(ms) || 0), f }); return k; };
  w.clearTimeout = k => { saat.bekleyen.delete(k); };
  w.Date.now = () => saat.simdi;
  const akit = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r)); };
  async function ilerlet(ms) {
    const hedef = saat.simdi + ms;
    for (;;) {
      await akit();
      let sonraki = null;
      for (const [k, z] of saat.bekleyen) if (z.t <= hedef && (!sonraki || z.t < sonraki[1].t)) sonraki = [k, z];
      if (!sonraki) break;
      saat.bekleyen.delete(sonraki[0]);
      saat.simdi = Math.max(saat.simdi, sonraki[1].t);
      sonraki[1].f();
    }
    saat.simdi = hedef;
    await akit();
  }

  // Ölçü: Bağlı ve gizli olmayan ana alan pencereyi kaplar, ölçüsü verilen öğe (__olcu) o ölçüde, öbürleri boş.
  w.Element.prototype.getBoundingClientRect = function () {
    if (this.__olcu) return this.__olcu;
    if (this.getAttribute('role') === 'main' && this.isConnected && w.getComputedStyle(this).display !== 'none') return ANA_OLCUSU;
    return olcu(0, 0, 0, 0);
  };
  w.CSSStyleSheet = class { replaceSync(t) { this.metin = t; } };
  // İçerik betiğinin kapalı gölge kökleri (düğme ve uyarılar) sınamada okunabilsin.
  const kapaliKokler = [];
  const asilGolge = w.Element.prototype.attachShadow;
  w.Element.prototype.attachShadow = function (o) { const k = asilGolge.call(this, o); if (o && o.mode === 'closed') kapaliKokler.push(k); return k; };
  // Sıfırlanan baytlar (pencerenin kendi Uint8Array nesneleri: indir.js'in birleştirdiği ve betiğin tuttuğu baytlar),
  // uzunluklarıyla.
  const sifirlanan = [];
  const asilDoldur = w.Uint8Array.prototype.fill;
  w.Uint8Array.prototype.fill = function (v, ...r) { if (v === 0) sifirlanan.push(this.length); return asilDoldur.call(this, v, ...r); };

  // Sahte fetch: Her istek sınamanın ver() çağrısını bekler, signal'e uyar.
  const istekler = [];
  w.fetch = (adres, { signal } = {}) => new Promise((coz, reddet) => {
    const k = { adres: String(adres), signal, bitti: false };
    const kes = () => { if (!k.bitti) { k.bitti = true; reddet(new w.DOMException('İptal edildi', 'AbortError')); } };
    if (signal && signal.aborted) return kes();
    if (signal) signal.addEventListener('abort', kes);
    k.ver = bayt => {
      if (k.bitti) return;
      k.bitti = true;
      let verildi = false;
      coz({ ok: true, status: 200, url: k.adres, headers: { get: a => ({ 'content-type': 'application/octet-stream', 'content-length': String(bayt.length) })[a.toLowerCase()] ?? null },
        body: { getReader: () => ({ read: async () => (verildi ? { done: true } : (verildi = true, { done: false, value: bayt })), cancel: async () => {} }) } });
    };
    istekler.push(k);
  });

  const giden = [];   // içerik betiğinin arka plana gönderdikleri
  const dinleyiciler = [];
  const durum = { baglam: true };
  w.chrome = {
    runtime: {
      get id() { return durum.baglam ? 'ek' : undefined; },
      getURL: p => `chrome-extension://ek/${p}`,
      sendMessage: async m => {
        if (!durum.baglam) throw new Error('Extension context invalidated.');
        giden.push(JSON.parse(JSON.stringify(m)));
        if (m.tur === 'gomulu-kayit') return kayitYaniti ? kayitYaniti(m) : { anahtar: crypto.randomUUID() };
        if (m.tur === 'udf-ac') return acYaniti ? acYaniti(m) : { tamam: true };
        return {};
      },
      onMessage: { addListener: f => dinleyiciler.push(f) }
    }
  };
  if (once) once(d, w);
  for (const ad of ['drive-kimlik.js', 'gmail-ek.js', 'indir.js', 'icerik.js']) w.eval(fs.readFileSync(path.join(KOK, ad), 'utf8'));

  const gercekOlay = (hedef, olay) => { ic.implForWrapper(olay).isTrusted = true; ic.implForWrapper(hedef)._dispatch(ic.implForWrapper(olay)); };
  // Fare olayı (pointerdown birincil işaretçi), guvenilir: Kullanıcının gerçek girişi.
  const fare = (hedef, tur, { guvenilir = true, ...ek } = {}) => {
    const e = new w.MouseEvent(tur, { bubbles: true, cancelable: true, composed: true, button: 0, ...ek });
    if (tur === 'pointerdown') Object.defineProperty(e, 'isPrimary', { value: true });
    if (guvenilir) gercekOlay(hedef, e); else hedef.dispatchEvent(e);
  };
  const tus = (hedef, key, { guvenilir = true, ...ek } = {}) => {
    const e = new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, composed: true, ...ek });
    if (guvenilir) gercekOlay(hedef, e); else hedef.dispatchEvent(e);
    return e;
  };
  // Arka plandan içerik betiğine ileti. Yanıtı (düz nesne) ya da, dinleyici iletiyi reddettiyse, undefined döner.
  const arkaplandan = (ileti, gonderen = { id: 'ek' }) => new Promise(coz => {
    let yanitlandi = false;
    const r = dinleyiciler[0](ileti, gonderen, y => { yanitlandi = true; coz(y === undefined ? y : JSON.parse(JSON.stringify(y))); });
    if (r !== true && !yanitlandi) coz(undefined);
  });
  const kayitlar = () => giden.filter(m => m.tur === 'gomulu-kayit');
  const cerceve = ana => (ana.shadowRoot && ana.shadowRoot.querySelector('iframe.udf-okuyucu-cerceve')) || ana.querySelector(':scope > iframe.udf-okuyucu-cerceve');
  const kokSec = s => kapaliKokler.map(k => k.querySelector(s)).find(Boolean) || null;
  // Gölge kökündeki çerçevenin penceresi: jsdom gölge ağacındaki iframe'e pencere kurmuyor, sınama belgedeki bir iframe'in
  // penceresini verir (iletilerin kaynağı ve hedefi).
  const pencereVer = c => {
    const yer = d.createElement('iframe');
    d.body.append(yer);
    Object.defineProperty(c, 'contentWindow', { configurable: true, get: () => yer.contentWindow });
    const giden = [];
    yer.contentWindow.postMessage = (m, koken) => giden.push({ m: JSON.parse(JSON.stringify(m)), koken });
    return giden;
  };
  const dugmeGorunur = () => { const b = kokSec('.dugme'); return !!b && b.classList.contains('gorunur'); };
  const uyarilar = () => kapaliKokler.flatMap(k => [...k.querySelectorAll('.uyari')].map(e => e.textContent));
  let esc = 0;
  d.addEventListener('keydown', e => { if (e.key === 'Escape') esc++; });
  const kapat = () => { assert.deepEqual(hatalar, []); w.close(); };
  return { w, d, ilerlet, istekler, giden, durum, sifirlanan, fare, tus, arkaplandan, kayitlar, cerceve, kokSec, pencereVer, dugmeGorunur, uyarilar, esc: () => esc, kapat };
}

// ---------------------------------------------------------------- Drive
// Drive'ın görüntüleyicisi: Konumu sabit katman, üst çubukta "Yorum" düğmesi (72–104 px), her dosya için yeni bir ana alan
// (eskisi gizli kalır), #drive-active-item-info gösterilen ana alana taşınır.
function driveKatmani(d) {
  const katman = d.createElement('div');
  katman.style.position = 'fixed';
  const yorum = d.createElement('button');
  yorum.setAttribute('aria-label', 'Yorum ekleyin');
  yorum.textContent = 'Yorum';
  yorum.__olcu = olcu(600, 72, 97, 32);
  katman.append(yorum);
  d.body.append(katman);
  return { katman, yorum };
}
function driveGoster(d, katman, id, ad, { yapisiz = false } = {}) {
  for (const a of katman.querySelectorAll(':scope > [role="main"]')) a.style.display = 'none';
  const ana = d.createElement('div');
  if (!yapisiz) ana.setAttribute('role', 'main');
  const bilgi = d.getElementById('drive-active-item-info') || Object.assign(d.createElement('div'), { id: 'drive-active-item-info' });
  bilgi.textContent = JSON.stringify({ id, title: ad, mimeType: 'application/x-zip' });
  ana.append(bilgi);
  katman.append(ana);
  return ana;
}

test('Drive: Belge ana alanın gölge kökünde, çubuğun altında, "Yorum" gizli. Ön izleme kapanınca hepsi geri gelir', async () => {
  const k = kur('https://drive.google.com/drive/u/1/folders/abc');
  const { katman, yorum } = driveKatmani(k.d);
  const ana = driveGoster(k.d, katman, ID_A, 'Dilekce.udf');
  await k.ilerlet(0);
  assert.equal(k.kayitlar().length, 1, 'ön izleme açılınca beklemeden (erken denetim)');
  const { id, ad, au, rk } = k.kayitlar()[0];
  assert.deepEqual({ id, ad, au, rk }, { id: ID_A, ad: 'Dilekce.udf', au: 1, rk: null });
  const c = k.cerceve(ana);
  assert.ok(c && ana.shadowRoot.contains(c));
  assert.match(c.src, /^chrome-extension:\/\/ek\/gomulu\.html#t=[0-9a-f-]{36}$/);
  assert.equal(c.style.getPropertyValue('top'), '112px');
  assert.ok(ana.hasAttribute('data-udf-okuyucu-gomulu') && yorum.hasAttribute('data-udf-okuyucu-gizli'));
  await k.ilerlet(1000);
  assert.equal(k.kayitlar().length, 1, 'DOM değişmeden yeniden kaydedilmez');
  ana.remove();
  await k.ilerlet(200);
  assert.ok(!k.cerceve(ana) && !ana.hasAttribute('data-udf-okuyucu-gomulu') && !yorum.hasAttribute('data-udf-okuyucu-gizli'));
  assert.equal(k.dugmeGorunur(), false);
  k.kapat();
});

test('Drive: Kayıt alınamazsa "UDF olarak aç" düğmesi, her DOM değişikliğinde yeniden denenmez, ön izleme yeniden açılınca denenir', async () => {
  const k = kur('https://drive.google.com/drive/u/1/folders/abc', { kayitYaniti: () => ({}) });
  const { katman } = driveKatmani(k.d);
  const ana = driveGoster(k.d, katman, ID_A, 'Dilekce.udf');
  await k.ilerlet(300);
  assert.equal(k.kayitlar().length, 1);
  assert.ok(k.dugmeGorunur() && !k.cerceve(ana));
  for (let i = 0; i < 3; i++) { k.d.body.append(k.d.createElement('span')); await k.ilerlet(200); }
  assert.equal(k.kayitlar().length, 1);
  ana.remove();
  await k.ilerlet(300);
  assert.equal(k.dugmeGorunur(), false);
  driveGoster(k.d, katman, ID_A, 'Dilekce.udf');
  await k.ilerlet(300);
  assert.equal(k.kayitlar().length, 2);
  k.kapat();
});

test('Drive: Eklentinin bağlamı koparsa gömülü belge kalkar, "yenileyin" uyarısı dosya başına bir kez', async () => {
  const k = kur('https://drive.google.com/drive/u/1/folders/abc');
  const { katman, yorum } = driveKatmani(k.d);
  const ana = driveGoster(k.d, katman, ID_A, 'Dilekce.udf');
  await k.ilerlet(300);
  assert.ok(k.cerceve(ana));
  k.durum.baglam = false;
  for (let i = 0; i < 3; i++) { k.d.body.append(k.d.createElement('span')); await k.ilerlet(200); }
  assert.ok(!k.cerceve(ana) && !ana.hasAttribute('data-udf-okuyucu-gomulu') && !yorum.hasAttribute('data-udf-okuyucu-gizli'));
  assert.deepEqual(k.uyarilar(), ['UDF Ön İzleme kapatıldı, kaldırıldı ya da güncellendi. Sayfayı yenileyin (F5).']);
  k.kapat();
});

test('Drive: Çerçeve her eklenişte silinirse aynı dosya 10 sn içinde en çok üç kez yeniden gömülür, sonra "UDF olarak aç"', async () => {
  // Ana alanın kendi gölge kökü var (eklentininki eklenemez, çerçeve ana alanın çocuğu olur) ve sayfa yabancı çocuğu her
  // eklenişte 50 ms sonra siliyor.
  let ana = null;
  const k = kur('https://drive.google.com/drive/u/1/folders/abc', {
    once: (d, w) => {
      new w.MutationObserver(l => { for (const r of l) for (const n of r.addedNodes) if (n.tagName === 'IFRAME') w.setTimeout(() => n.remove(), 50); })
        .observe(d.body, { childList: true, subtree: true });
    }
  });
  const { katman } = driveKatmani(k.d);
  const kur2 = () => {
    ana = k.d.createElement('div');
    ana.setAttribute('role', 'main');
    ana.attachShadow({ mode: 'open' });
    ana.append(Object.assign(k.d.createElement('div'), { id: 'drive-active-item-info', textContent: JSON.stringify({ id: ID_A, title: 'Dilekce.udf' }) }));
    katman.append(ana);
  };
  kur2();
  await k.ilerlet(3000);
  assert.equal(k.kayitlar().length, 4, 'ilk gömme ve üç yeniden gömme');
  assert.ok(k.dugmeGorunur());
  await k.ilerlet(2000);
  assert.equal(k.kayitlar().length, 4, 'sınır aşılınca bu ön izlemede yeniden denenmez');
  // Ön izleme kapanınca sayaç sıfırlanır: 10 sn dolmadan yeniden açılan ön izlemede de yine üç yeniden gömme olur.
  ana.remove();
  await k.ilerlet(300);
  assert.equal(k.dugmeGorunur(), false);
  kur2();
  await k.ilerlet(3000);
  assert.equal(k.kayitlar().length, 8, 'yeni ön izlemede ilk gömme ve yine üç yeniden gömme');
  assert.ok(k.dugmeGorunur());
  k.kapat();
});

test('Drive: Öbür dosyaya geçip dönmek yeniden gömme sınırına sayılmaz', async () => {
  const k = kur('https://drive.google.com/drive/u/1/folders/abc');
  const { katman } = driveKatmani(k.d);
  const sira = [ID_A, ID_B, ID_A, ID_B, ID_A, ID_B, ID_A];
  for (const id of sira) {
    const ana = driveGoster(k.d, katman, id, id === ID_A ? 'A.udf' : 'B.udf');
    await k.ilerlet(300);
    assert.ok(k.cerceve(ana), id);
  }
  assert.deepEqual(k.kayitlar().map(m => m.id), sira);
  assert.equal(k.dugmeGorunur(), false);
  k.kapat();
});

test('Drive: "UDF olarak aç" sekme açılınca ön izlemeyi kapatır. Açılamazsa ön izleme kalır, uyarı çıkar, yeniden denenebilir', async () => {
  let yanit = { tamam: false };
  const k = kur('https://drive.google.com/drive/u/1/folders/abc', { acYaniti: () => yanit });
  const { katman } = driveKatmani(k.d);
  driveGoster(k.d, katman, ID_A, 'Dilekce.udf', { yapisiz: true });   // Ana alan yok: Yapı tanınmıyor
  await k.ilerlet(300);
  assert.ok(k.dugmeGorunur());
  const dugme = k.kokSec('.dugme');
  const acmalar = () => k.giden.filter(m => m.tur === 'udf-ac').length;
  k.fare(dugme, 'click', { guvenilir: false });
  await k.ilerlet(10);
  assert.equal(acmalar(), 0, 'sayfanın ürettiği tıklama açmaz');
  k.fare(dugme, 'click');
  await k.ilerlet(10);
  assert.equal(acmalar(), 1);
  assert.equal(k.esc(), 0, 'sekme açılamadı: Ön izleme kapatılmaz');
  assert.deepEqual(k.uyarilar(), ['Belge yeni sekmede açılamadı. Yeniden deneyin.']);
  yanit = undefined;   // arka plan yanıt vermedi
  k.fare(dugme, 'click');
  await k.ilerlet(10);
  assert.equal(acmalar(), 2, 'başarısız açılıştan sonra hemen yeniden denenebilir');
  assert.equal(k.esc(), 0);
  yanit = { tamam: true };
  k.fare(dugme, 'click');
  k.fare(dugme, 'click');   // çift tıklama
  await k.ilerlet(10);
  assert.equal(acmalar(), 3, 'aynı belge 1,5 sn içinde bir kez');
  assert.equal(k.esc(), 1, 'sekme açıldı: Google’ın ön izlemesi bir kez kapatılır');
  const { id, ad, au } = k.giden.filter(m => m.tur === 'udf-ac')[2];
  assert.deepEqual({ id, ad, au }, { id: ID_A, ad: 'Dilekce.udf', au: 1 });
  k.kapat();
});

test('Drive: Çubuğun altı ve okun şeridi gizli eski kopyaları saymaz (checkVisibility\'nin Chrome 121 öncesi ve sonrası adları)', async () => {
  for (const [surum, eskiAd] of [['116-120', true], ['121+', false]]) {
    const k = kur('https://drive.google.com/drive/u/1/folders/abc', {
      once: (d, w) => {
        w.Element.prototype.checkVisibility = function (o = {}) {
          const s = w.getComputedStyle(this);
          if ((eskiAd ? o.checkVisibilityCSS : o.visibilityProperty) && s.visibility === 'hidden') return false;
          if ((eskiAd ? o.checkOpacity : o.opacityProperty) && s.opacity === '0') return false;
          return s.display !== 'none';
        };
      }
    });
    const { katman } = driveKatmani(k.d);
    const dugme = (etiket, o, gizli) => {
      const b = k.d.createElement('button');
      b.setAttribute('aria-label', etiket);
      b.__olcu = o;
      if (gizli === 'gizli') b.style.visibility = 'hidden';
      if (gizli === 'saydam') b.style.opacity = '0';
      katman.append(b);
    };
    dugme('İndir', olcu(24, 72, 32, 32));
    dugme('İndir', olcu(24, 100, 32, 40), 'gizli');       // görüntüleyicinin gizli eski çubuğu
    dugme('Yazdır', olcu(64, 72, 32, 48), 'saydam');      // saydam eski düğme (çubuğun altında sayılmaz)
    dugme('Sonraki', olcu(932, 360, 40, 40));
    dugme('Sonraki', olcu(900, 339, 100, 90), 'gizli');  // gizli eski ok
    const ana = driveGoster(k.d, katman, ID_A, 'Dilekce.udf');
    await k.ilerlet(300);
    const c = k.cerceve(ana);
    assert.equal(c.style.getPropertyValue('top'), '112px', surum);
    const giden = k.pencereVer(c);
    k.w.dispatchEvent(new k.w.MessageEvent('message', { source: c.contentWindow, origin: 'chrome-extension://ek', data: { udfOkuyucu: 1, tur: 'hazir' } }));
    assert.deepEqual(giden, [{ m: { udfOkuyucu: 1, tur: 'sag-bosluk', px: 84 }, koken: 'chrome-extension://ek' }], surum);
    k.kapat();
  }
});

test('Drive: Çerçeveden gelen iletiler yalnız kendi çerçevesinden ve eklentinin kökeninden, tanınan türler', async () => {
  const k = kur('https://drive.google.com/drive/u/1/folders/abc');
  const { katman } = driveKatmani(k.d);
  const ana = driveGoster(k.d, katman, ID_A, 'Dilekce.udf');
  await k.ilerlet(300);
  const c = k.cerceve(ana);
  const baska = k.d.createElement('iframe');
  k.d.body.append(baska);
  const giden = k.pencereVer(c);
  const ilet = (source, origin, data) => k.w.dispatchEvent(new k.w.MessageEvent('message', { source, origin, data }));
  const yazdir = () => k.tus(k.d.body, 'p', { ctrlKey: true, guvenilir: false });
  const tuslar = [];
  c.addEventListener('keydown', e => tuslar.push(e.key));
  // El sıkışmadan önce Ctrl+P yine sayfanın yazdırmasını durdurur, ama çerçevenin kökeni bilinmediği için ileti gitmez.
  assert.equal(yazdir().defaultPrevented, true);
  ilet(baska.contentWindow, 'chrome-extension://ek', { udfOkuyucu: 1, tur: 'hazir' });
  ilet(c.contentWindow, 'https://drive.google.com', { udfOkuyucu: 1, tur: 'hazir' });
  ilet(c.contentWindow, 'chrome-extension://ek', { udfOkuyucu: 2, tur: 'hazir' });
  ilet(c.contentWindow, 'chrome-extension://ek', 'hazir');
  yazdir();
  assert.deepEqual(giden, [], 'yabancı kaynak, yabancı köken ve tanınmayan ileti el sıkışma sayılmaz');
  ilet(c.contentWindow, 'chrome-extension://ek', { udfOkuyucu: 1, tur: 'hazir' });
  yazdir();
  assert.deepEqual(giden, [{ m: { udfOkuyucu: 1, tur: 'yazdir' }, koken: 'chrome-extension://ek' }]);
  ilet(baska.contentWindow, 'chrome-extension://ek', { udfOkuyucu: 1, tur: 'tus', tus: 'ArrowRight' });
  ilet(c.contentWindow, 'chrome-extension://ek', { udfOkuyucu: 1, tur: 'tus', tus: 'Enter' });
  ilet(c.contentWindow, 'chrome-extension://ek', { udfOkuyucu: 1, tur: 'tus', tus: 'toString' });
  ilet(c.contentWindow, 'chrome-extension://ek', { udfOkuyucu: 1, tur: 'tus', tus: 'ArrowRight' });
  assert.deepEqual(tuslar, ['ArrowRight'], 'yalnız kendi çerçevesinden, yalnız Esc ve oklar');
  k.kapat();
});

// ---------------------------------------------------------------- Gmail
const sorgu = (ileti, attid) => `ui=2&ik=${IK}&attid=${attid}&permmsgid=msg-f:${ileti.msg}&th=${ileti.th}&view=att&zw&disp=safe`;
const ekAdresi = (ileti, attid) => `https://mail.google.com/mail/u/1?ui=2&ik=${IK}&attid=${attid}&permmsgid=msg-f:${ileti.msg}&th=${ileti.th}&view=att&disp=safe&zw`;
const ekBilgisi = (ileti, attid) => ({ au: 1, ik: IK, th: ileti.th, attid, permmsgid: `msg-f:${ileti.msg}`, realattid: null });
// Gmail'in kendi ana alanı (posta kutusu, role=main) ve iletiler: Her ek kartı span[download_url] > a[href] (2026-10-26 ölçümü).
// Gmail bağlantıya gitmez (ön izlemeyi açar).
function gmailKur(d, iletiler) {
  d.addEventListener('click', e => { if (e.target.closest('a')) e.preventDefault(); });
  const posta = d.createElement('div');
  posta.setAttribute('role', 'main');
  d.body.append(posta);
  const kartlar = {};
  for (const ileti of iletiler) {
    const kutu = d.createElement('div');
    ileti.ekler.forEach((ad, i) => {
      const attid = `0.${i + 1}`;
      const kart = d.createElement('span');
      kart.setAttribute('download_url', `application/octet-stream:${encodeURIComponent(ad)}:https://mail.google.com/mail/u/1/https://mail.google.com/mail/u/1?${sorgu(ileti, attid)}`);
      const a = d.createElement('a');
      a.setAttribute('href', `https://mail.google.com/mail/u/1?${sorgu(ileti, attid)}`);
      kart.append(a);
      kutu.append(kart);
      kartlar[`${ileti.harf} ${attid}`] = a;
    });
    posta.append(kutu);
    ileti.kutu = kutu;
  }
  return { posta, kartlar };
}
// Gmail'in ön izlemesi: Konumu sabit katman > role=dialog > kap > ek başına bir ana alan (ek sırasıyla). Bilgi öğesi
// gösterilen ana alanda, kimliği boş (Drive dosyasında dolu).
function onizleme(d, adlar, sira, { id = '' } = {}) {
  const katman = d.createElement('div');
  katman.style.position = 'fixed';
  const pencere = d.createElement('div');
  pencere.setAttribute('role', 'dialog');
  const kap = d.createElement('div');
  const analar = adlar.map(() => { const a = d.createElement('div'); a.setAttribute('role', 'main'); kap.append(a); return a; });
  const bilgi = Object.assign(d.createElement('div'), { id: 'drive-active-item-info' });
  const goster = i => {
    analar.forEach((a, j) => { a.style.display = j === i ? '' : 'none'; });
    bilgi.textContent = JSON.stringify({ id, title: adlar[i], mimeType: 'application/octet-stream' });
    analar[i].prepend(bilgi);
  };
  goster(sira);
  pencere.append(kap);
  katman.append(pencere);
  d.body.append(katman);
  return { katman, analar, bilgi, goster, kapat: () => katman.remove() };
}
// Kullanıcının ek kartına basması: Fare basışı ve tıklama (Gmail ön izlemeyi tıklamada açar).
const kartaBas = (k, kart, s) => { k.fare(kart, 'pointerdown', s); k.fare(kart, 'click', s); };
const bayt = n => new Uint8Array(n).fill(7);
const kayitEki = m => `${m.ek.th === A.th ? 'A' : m.ek.th === B.th ? 'B' : '?'} ${m.ek.attid} ${m.ad}`;
const GMAIL_ADRESI = 'https://mail.google.com/mail/u/1/#inbox/abc';

test('Gmail: Karta basılınca ek indirilmeye başlar, görüntüleyici aynı indirmeyi alır, baytlar dilimlerle verilir ve son dilimde bırakılır', async () => {
  const k = kur(GMAIL_ADRESI);
  const { kartlar } = gmailKur(k.d, [{ ...A, ekler: ['Dilekce.udf', 'Ek.pdf'] }]);
  k.fare(kartlar['A 0.1'], 'pointerdown');
  assert.deepEqual(k.istekler.map(i => i.adres), [ekAdresi(A, '0.1')], 'fare basışında, ön izleme açılmadan');
  assert.ok(k.giden.some(m => m.tur === 'uyan'), 'service worker uyandırılır');
  k.fare(kartlar['A 0.1'], 'click');
  const o = onizleme(k.d, ['Dilekce.udf', 'Ek.pdf'], 0);
  await k.ilerlet(0);
  assert.deepEqual(k.kayitlar().map(kayitEki), ['A 0.1 Dilekce.udf']);
  const c = k.cerceve(o.analar[0]);
  assert.match(c.src, /#t=[0-9a-f-]{36}&u=g$/);
  const anahtar = /#t=([0-9a-f-]{36})/.exec(c.src)[1];
  const yanit = k.arkaplandan({ tur: 'gmail-indir', anahtar, ek: k.kayitlar()[0].ek });
  await k.ilerlet(0);
  assert.equal(k.istekler.length, 1, 'ek bir açılışta bir kez indirilir');
  k.istekler[0].ver(bayt(MiB + 5));
  assert.deepEqual(await yanit, { uzunluk: MiB + 5, dilim: MiB });
  assert.equal((await k.arkaplandan({ tur: 'gmail-dilim', anahtar, i: 0 })).parca.length, Math.ceil(MiB / 3) * 4);
  assert.deepEqual(await k.arkaplandan({ tur: 'gmail-dilim', anahtar, i: 1 }), { parca: 'BwcHBwc=' });
  assert.deepEqual(await k.arkaplandan({ tur: 'gmail-dilim', anahtar, i: 1 }), { hata: 'AG' }, 'son dilimden sonra bırakılır');
  assert.ok(k.sifirlanan.includes(MiB + 5), 'bırakılırken sıfırlanır');
  k.kapat();
});

const anahtarOku = c => /#t=([0-9a-f-]{36})/.exec(c.src)[1];

test('Gmail: Sayfanın ürettiği fare ve tuş olayları ve değiştirici tuşlu tıklama ön indirme başlatmaz', async () => {
  const k = kur(GMAIL_ADRESI);
  const { kartlar } = gmailKur(k.d, [{ ...A, ekler: ['Dilekce.udf'] }]);
  const kart = kartlar['A 0.1'];
  for (const t of ['pointerdown', 'mousedown', 'click']) k.fare(kart, t, { guvenilir: false });
  k.tus(kart, 'Enter', { guvenilir: false });
  k.tus(kart, ' ', { guvenilir: false });
  k.fare(kart, 'pointerdown', { ctrlKey: true });
  k.fare(kart, 'click', { ctrlKey: true });
  await k.ilerlet(100);
  assert.equal(k.istekler.length, 0);
  k.tus(kart, 'Enter');
  assert.deepEqual(k.istekler.map(i => i.adres), [ekAdresi(A, '0.1')], 'gerçek Enter');
  k.kapat();
});

test('Gmail: Arka plandan gelen iletiler yalnız eklentinin arka planından, geçerli anahtar, ek ve dilimle. Baytlar en çok 15 sn tutulur', async () => {
  const k = kur(GMAIL_ADRESI);
  gmailKur(k.d, [{ ...A, ekler: ['Dilekce.udf'] }]);
  const anahtar = crypto.randomUUID(), ek = ekBilgisi(A, '0.1');
  assert.equal(await k.arkaplandan({ tur: 'gmail-indir', anahtar, ek }, { id: 'baska-eklenti' }), undefined);
  assert.equal(await k.arkaplandan({ tur: 'gmail-indir', anahtar, ek }, { id: 'ek', tab: { id: 3 } }), undefined, 'bir sekmeden (içerik betiği) gelen');
  assert.equal(await k.arkaplandan({ tur: 'gmail-indir', anahtar: 'abc', ek }), undefined, 'anahtar biçimsiz');
  assert.equal(k.istekler.length, 0);
  assert.deepEqual(await k.arkaplandan({ tur: 'gmail-indir', anahtar, ek: { ...ek, th: 'x&view=fimg' } }), { hata: 'KIMLIK' });
  assert.deepEqual(await k.arkaplandan({ tur: 'gmail-dilim', anahtar, i: 0 }), { hata: 'AG' }, 'bilinmeyen anahtar');
  const y = k.arkaplandan({ tur: 'gmail-indir', anahtar, ek });
  await k.ilerlet(0);
  assert.deepEqual(k.istekler.map(i => i.adres), [ekAdresi(A, '0.1')], 'adres yalnız doğrulanmış ek bilgisinden');
  k.istekler[0].ver(bayt(10));
  assert.deepEqual(await y, { uzunluk: 10, dilim: MiB });
  for (const i of [-1, 1, 0.5, '0', null]) assert.deepEqual(await k.arkaplandan({ tur: 'gmail-dilim', anahtar, i }), { hata: 'AG' }, String(i));
  assert.equal(await k.arkaplandan({ tur: 'gmail-dilim', anahtar, i: 0 }, { id: 'baska-eklenti' }), undefined);
  await k.ilerlet(14000);
  assert.deepEqual(await k.arkaplandan({ tur: 'gmail-dilim', anahtar, i: 0 }), { parca: 'BwcHBwcHBwcHBw==' });
  // İstenmeyen baytlar 15 sn sonra bırakılır.
  const ikinci = crypto.randomUUID();
  const y2 = k.arkaplandan({ tur: 'gmail-indir', anahtar: ikinci, ek });
  await k.ilerlet(0);
  k.istekler[1].ver(bayt(12));
  assert.equal((await y2).uzunluk, 12);
  await k.ilerlet(15000);
  assert.deepEqual(await k.arkaplandan({ tur: 'gmail-dilim', anahtar: ikinci, i: 0 }), { hata: 'AG' });
  assert.ok(k.sifirlanan.includes(12));
  k.kapat();
});

test('Gmail: Bırakılan ön indirme kesilir (en çok üç, 15 sn), inmiş baytları sıfırlanır, kesilen indirme yeniden denenmez', async () => {
  const k = kur(GMAIL_ADRESI);
  const { kartlar } = gmailKur(k.d, [{ ...A, ekler: ['Bir.udf', 'İki.udf', 'Üç.udf', 'Dört.udf'] }]);
  for (const s of ['0.1', '0.2', '0.3', '0.4']) k.fare(kartlar[`A ${s}`], 'pointerdown');
  assert.equal(k.istekler.length, 4);
  assert.deepEqual(k.istekler.map(i => i.signal.aborted), [true, false, false, false], 'dördüncüde en eskisi bırakılır');
  k.istekler[1].ver(bayt(1002));
  await k.ilerlet(14000);
  assert.deepEqual(k.istekler.map(i => i.signal.aborted), [true, false, false, false]);
  await k.ilerlet(1000);
  assert.deepEqual(k.istekler.map(i => i.signal.aborted), [true, true, true, true], '15 sn sonra hepsi bırakılır');
  assert.ok(k.sifirlanan.includes(1002), 'inmiş ön indirmenin baytları sıfırlanır');
  await k.ilerlet(1000);
  assert.equal(k.istekler.length, 4, 'kesilen indirme cacheCounter ekiyle yeniden denenmez');
  k.kapat();
});

test('Gmail: İçerik betiği en çok üç ekin baytlarını tutar, sınır aşılınca en eskisi bırakılıp sıfırlanır', async () => {
  const k = kur(GMAIL_ADRESI);
  gmailKur(k.d, [{ ...A, ekler: ['Bir.udf', 'İki.udf', 'Üç.udf', 'Dört.udf'] }]);
  const anahtarlar = [1, 2, 3, 4].map(() => crypto.randomUUID());
  const yanitlar = anahtarlar.map((anahtar, i) => k.arkaplandan({ tur: 'gmail-indir', anahtar, ek: ekBilgisi(A, `0.${i + 1}`) }));
  await k.ilerlet(0);
  for (const [i, r] of k.istekler.entries()) { r.ver(bayt(2001 + i)); await k.ilerlet(0); }
  assert.deepEqual((await Promise.all(yanitlar)).map(y => y.uzunluk), [2001, 2002, 2003, 2004]);
  assert.ok(k.sifirlanan.includes(2001));
  assert.deepEqual(await k.arkaplandan({ tur: 'gmail-dilim', anahtar: anahtarlar[0], i: 0 }), { hata: 'AG' });
  for (const anahtar of anahtarlar.slice(1)) assert.equal(typeof (await k.arkaplandan({ tur: 'gmail-dilim', anahtar, i: 0 })).parca, 'string');
  k.kapat();
});

test('Gmail: Çerçeve kaldırılınca onun ekinin süren indirmesi kesilir, tutulan baytları sıfırlanır', async () => {
  const k = kur(GMAIL_ADRESI);
  const ekler = ['Dilekce.udf', 'İkinci.udf'];
  const { kartlar } = gmailKur(k.d, [{ ...A, ekler }]);
  // İndirme sürerken ön izleme kapanır.
  kartaBas(k, kartlar['A 0.1']);
  let o = onizleme(k.d, ekler, 0);
  await k.ilerlet(0);
  let anahtar = anahtarOku(k.cerceve(o.analar[0]));
  let y = k.arkaplandan({ tur: 'gmail-indir', anahtar, ek: k.kayitlar()[0].ek });
  await k.ilerlet(0);
  assert.equal(k.istekler.length, 1);
  o.kapat();
  await k.ilerlet(200);
  assert.equal(k.istekler[0].signal.aborted, true);
  assert.deepEqual(await y, { hata: 'AG' });
  // Baytlar inmiş, ilk dilim verilmişken öbür eke geçilir (yeni çerçeve): Önceki çerçevenin baytları bırakılır.
  kartaBas(k, kartlar['A 0.1']);
  o = onizleme(k.d, ekler, 0);
  await k.ilerlet(0);
  anahtar = anahtarOku(k.cerceve(o.analar[0]));
  y = k.arkaplandan({ tur: 'gmail-indir', anahtar, ek: k.kayitlar()[1].ek });
  await k.ilerlet(0);
  k.istekler[1].ver(bayt(MiB + 3));
  assert.equal((await y).uzunluk, MiB + 3);
  assert.equal(typeof (await k.arkaplandan({ tur: 'gmail-dilim', anahtar, i: 0 })).parca, 'string');
  o.goster(1);
  await k.ilerlet(200);
  assert.deepEqual(k.kayitlar().map(kayitEki), ['A 0.1 Dilekce.udf', 'A 0.1 Dilekce.udf', 'A 0.2 İkinci.udf']);
  assert.ok(k.cerceve(o.analar[1]) && !k.cerceve(o.analar[0]));
  assert.deepEqual(await k.arkaplandan({ tur: 'gmail-dilim', anahtar, i: 1 }), { hata: 'AG' });
  assert.ok(k.sifirlanan.includes(MiB + 3));
  k.kapat();
});

test('Gmail: Aynı anahtarla yeni istek ("Yeniden dene") öncekinin süren indirmesini keser', async () => {
  const k = kur(GMAIL_ADRESI);
  gmailKur(k.d, [{ ...A, ekler: ['Dilekce.udf'] }]);
  const anahtar = crypto.randomUUID(), ek = ekBilgisi(A, '0.1');
  const y1 = k.arkaplandan({ tur: 'gmail-indir', anahtar, ek });
  await k.ilerlet(0);
  const y2 = k.arkaplandan({ tur: 'gmail-indir', anahtar, ek });
  await k.ilerlet(0);
  assert.equal(k.istekler.length, 2);
  assert.deepEqual(k.istekler.map(i => i.signal.aborted), [true, false]);
  assert.deepEqual(await y1, { hata: 'AG' });
  k.istekler[1].ver(bayt(12));
  assert.deepEqual(await y2, { uzunluk: 12, dilim: MiB });
  assert.deepEqual(await k.arkaplandan({ tur: 'gmail-dilim', anahtar, i: 0 }), { parca: 'BwcHBwcHBwcHBwcH' });
  k.kapat();
});

test('Gmail: Baytları inmiş ön indirmeyi alan istek, sonucu almadan kesilirse baytları sıfırlar ve AG döner', async () => {
  const k = kur(GMAIL_ADRESI);
  const { kartlar } = gmailKur(k.d, [{ ...A, ekler: ['Dilekce.udf'] }]);
  k.fare(kartlar['A 0.1'], 'pointerdown');
  k.istekler[0].ver(bayt(1234));
  await k.ilerlet(0);
  // Ön indirme bitti. İlk istek onu alır, sonucunu beklerken aynı anahtarla ikinci istek gelir ve ilkini keser.
  const anahtar = crypto.randomUUID(), ek = ekBilgisi(A, '0.1');
  const y1 = k.arkaplandan({ tur: 'gmail-indir', anahtar, ek });
  const y2 = k.arkaplandan({ tur: 'gmail-indir', anahtar, ek });
  assert.deepEqual(await y1, { hata: 'AG' });
  assert.ok(k.sifirlanan.includes(1234), 'kesilen isteğin aldığı baytlar sıfırlandı');
  assert.equal(k.istekler.length, 2, 'ikinci istek eki yeniden indirir');
  k.istekler[1].ver(bayt(12));
  assert.deepEqual(await y2, { uzunluk: 12, dilim: MiB });
  assert.deepEqual(await k.arkaplandan({ tur: 'gmail-dilim', anahtar, i: 0 }), { parca: 'BwcHBwcHBwcHBwcH' });
  k.kapat();
});

test('Gmail: Ön izleme kapanıp 150 ms dolmadan başka iletinin kartıyla açılırsa o kartın eki gömülür', async () => {
  for (const adB of ['Dilekce.udf', 'Baska.udf']) {
    const k = kur(GMAIL_ADRESI);
    const { kartlar } = gmailKur(k.d, [{ ...A, ekler: ['Dilekce.udf'] }, { ...B, ekler: [adB] }]);
    kartaBas(k, kartlar['A 0.1']);
    const o1 = onizleme(k.d, ['Dilekce.udf'], 0);
    await k.ilerlet(400);
    o1.kapat();
    await k.ilerlet(20);
    kartaBas(k, kartlar['B 0.1']);
    const o2 = onizleme(k.d, [adB], 0);
    await k.ilerlet(400);
    assert.deepEqual(k.kayitlar().map(kayitEki), ['A 0.1 Dilekce.udf', `B 0.1 ${adB}`], adB);
    assert.ok(k.cerceve(o2.analar[0]), adB);
    k.kapat();
  }
});

test('Gmail: Ön izleme kapanıp 150 ms dolmadan yeni bir katmanda tıklamasız açılırsa önceki tıklama kullanılmaz', async () => {
  // Kartsız açılış (gelen kutusu listesindeki ek düğmesi) ve ön izlemeyi fare basışında açan, tıklaması toplu denetimden
  // sonra gelen açılış. İki iletide de aynı adlı ek var: Önceki tıklama kullanılsaydı B'nin ön izlemesinde A'nın eki gömülürdü.
  for (const tur of ['kartsız', 'fare basışında']) {
    const k = kur(GMAIL_ADRESI);
    const { kartlar } = gmailKur(k.d, [{ ...A, ekler: ['Dilekce.udf'] }, { ...B, ekler: ['Dilekce.udf'] }]);
    kartaBas(k, kartlar['A 0.1']);
    const o1 = onizleme(k.d, ['Dilekce.udf'], 0);
    await k.ilerlet(400);
    o1.kapat();
    await k.ilerlet(20);
    if (tur === 'fare basışında') k.fare(kartlar['B 0.1'], 'pointerdown');
    const o2 = onizleme(k.d, ['Dilekce.udf'], 0);
    await k.ilerlet(140);
    if (tur === 'fare basışında') k.fare(kartlar['B 0.1'], 'click');
    await k.ilerlet(400);
    assert.deepEqual(k.kayitlar().map(kayitEki), ['A 0.1 Dilekce.udf'], tur);
    assert.ok(!k.cerceve(o2.analar[0]) && !k.dugmeGorunur(), tur);
    k.kapat();
  }
});

test('Gmail: Google ön izlemeyi 150 ms içinde aynı katmanda tıklamasız yeniden kurarsa aynı ön izlemedir, sonra kartsız açılan ön izlemede eski tıklama kullanılmaz', async () => {
  const k = kur(GMAIL_ADRESI);
  const ekler = ['Dilekce.udf', 'İkinci.udf'];
  const { kartlar } = gmailKur(k.d, [{ ...A, ekler }, { ...B, ekler: ['Dilekce.udf'] }]);
  kartaBas(k, kartlar['A 0.1']);
  const o = onizleme(k.d, ekler, 0);
  await k.ilerlet(400);
  // Öbür eke geçerken bilgi öğesi bir an kalkar, katman yerinde kalır.
  o.bilgi.remove();
  await k.ilerlet(30);
  o.goster(1);
  await k.ilerlet(400);
  assert.deepEqual(k.kayitlar().map(kayitEki), ['A 0.1 Dilekce.udf', 'A 0.2 İkinci.udf']);
  // Kapanıştan 300 ms sonra kartsız (gelen kutusu listesindeki ek düğmesiyle) açılan ön izleme: B'nin eki, A'da da aynı adlı
  // ek var. Eski tıklama kullanılmaz, Gmail'in kartı kalır.
  o.kapat();
  await k.ilerlet(300);
  const o2 = onizleme(k.d, ['Dilekce.udf'], 0);
  await k.ilerlet(400);
  assert.equal(k.kayitlar().length, 2);
  assert.ok(!k.cerceve(o2.analar[0]) && !k.dugmeGorunur());
  k.kapat();
});

test('Gmail: Ön izleme açıkken görülen ek bağlantısı tıklaması, kapanıştan sonra kartsız açılan ön izlemeye geçmez', async () => {
  const k = kur(GMAIL_ADRESI);
  const { kartlar } = gmailKur(k.d, [{ ...A, ekler: ['Dilekce.udf'] }, { ...B, ekler: ['Dilekce.udf'] }]);
  kartaBas(k, kartlar['A 0.1']);
  const o = onizleme(k.d, ['Dilekce.udf'], 0);
  await k.ilerlet(400);
  // Görüntüleyicinin içinde ekin kendi bağlantısı (ör. İndir).
  const indir = k.d.createElement('a');
  indir.setAttribute('href', `https://mail.google.com/mail/u/1?${sorgu(A, '0.1')}`);
  o.katman.append(indir);
  k.fare(indir, 'click');
  await k.ilerlet(100);
  o.kapat();
  await k.ilerlet(300);
  const o2 = onizleme(k.d, ['Dilekce.udf'], 0);
  await k.ilerlet(400);
  assert.deepEqual(k.kayitlar().map(kayitEki), ['A 0.1 Dilekce.udf']);
  assert.ok(!k.cerceve(o2.analar[0]));
  k.kapat();
});

test('Gmail: E-postanın gövdesindeki #drive-active-item-info gösterilen dosya sayılmaz, gerçek ön izlemeyle birlikteyse ikisine de güvenilmez', async () => {
  const k = kur(GMAIL_ADRESI);
  const { posta, kartlar } = gmailKur(k.d, [{ ...A, ekler: ['Dilekce.udf'] }]);
  const sahteBilgi = () => Object.assign(k.d.createElement('div'), { id: 'drive-active-item-info', textContent: JSON.stringify({ id: ID_B, title: 'Sahte.udf' }) });
  // İletinin gövdesinde, kendi ana alanıyla, Drive dosyası kimliği taşıyan öğe.
  const sahte = k.d.createElement('div');
  sahte.setAttribute('role', 'main');
  sahte.append(sahteBilgi());
  posta.append(sahte);
  await k.ilerlet(400);
  assert.equal(k.kayitlar().length, 0);
  assert.equal(k.dugmeGorunur(), false);
  // Gerçek ön izleme açılır: Belgede iki bilgi öğesi var, hiçbirine güvenilmez.
  kartaBas(k, kartlar['A 0.1']);
  const o = onizleme(k.d, ['Dilekce.udf'], 0);
  await k.ilerlet(400);
  assert.equal(k.kayitlar().length, 0);
  assert.ok(!k.cerceve(o.analar[0]) && !k.cerceve(sahte));
  // Sahte öğe kalkınca gerçek ön izlemedeki ek gömülür.
  sahte.remove();
  await k.ilerlet(400);
  assert.deepEqual(k.kayitlar().map(kayitEki), ['A 0.1 Dilekce.udf']);
  o.kapat();
  await k.ilerlet(300);
  // Konumu sabit bir kabın içinde (Gmail iletideki position'ı koruyorsa): Kendi ana alanıyla, görüntüleyicinin penceresi
  // gibi bir kapla (role=dialog) da ne gömülür ne "UDF olarak aç" düğmesi çıkar. Gmail'in kendi kabuğu konumu sabit olsa da
  // (iletideki pencere ve ana alanla öğe katmandan iki ana alan içeride) aynı.
  const kabuk = k.d.createElement('div');
  kabuk.style.position = 'fixed';
  for (const [ad, yapi, kabukta] of [['ana alanlı', ['main'], false], ['ana alansız', [], false], ['pencereli', ['dialog', 'main'], false],
    ['kabuk sabit, pencereli', ['dialog', 'main'], true]]) {
    if (kabukta) { k.d.body.prepend(kabuk); kabuk.append(posta); }
    const kap = k.d.createElement('div');
    if (!kabukta) kap.style.position = 'fixed';
    let yer = kap;
    for (const rol of yapi) { const e = k.d.createElement('div'); e.setAttribute('role', rol); yer.append(e); yer = e; }
    yer.append(sahteBilgi());
    posta.append(kap);
    await k.ilerlet(400);
    assert.equal(k.kayitlar().length, 1, ad);
    assert.equal(k.d.querySelectorAll('[data-udf-okuyucu-gomulu]').length, 0, ad);
    assert.equal(k.dugmeGorunur(), false, ad);
    kap.remove();
    if (kabukta) { k.d.body.append(posta); kabuk.remove(); }
    await k.ilerlet(300);
  }
  k.kapat();
});

test('Gmail: Ön izlemede açılan Drive dosyası, basılan aynı kimlikli Drive bağlantısının kaynak anahtarıyla kaydedilir', async () => {
  const k = kur(GMAIL_ADRESI);
  const { posta } = gmailKur(k.d, [{ ...A, ekler: ['Ek.pdf'] }]);
  const baglanti = (id, rk) => {
    const a = k.d.createElement('a');
    a.setAttribute('href', `https://drive.google.com/file/d/${id}/view?usp=sharing&resourcekey=${rk}`);
    posta.append(a);
    return a;
  };
  const a1 = baglanti(ID_A, '0-Abc_d'), a2 = baglanti(ID_B, '0-Xyz');
  k.fare(a1, 'click');
  k.fare(a2, 'click', { guvenilir: false });   // sayfanın ürettiği tıklama tutulmaz
  let o = onizleme(k.d, ['Dava.udf'], 0, { id: ID_A });
  await k.ilerlet(400);
  o.kapat();
  await k.ilerlet(300);
  o = onizleme(k.d, ['Baska.udf'], 0, { id: ID_B });
  await k.ilerlet(400);
  assert.deepEqual(k.kayitlar().map(({ id, ad, au, rk }) => ({ id, ad, au, rk })), [
    { id: ID_A, ad: 'Dava.udf', au: 1, rk: '0-Abc_d' },
    { id: ID_B, ad: 'Baska.udf', au: 1, rk: null }
  ]);
  assert.ok(k.cerceve(o.analar[0]));
  k.kapat();
});
