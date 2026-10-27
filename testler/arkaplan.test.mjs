import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { KOK } from './yardimci.mjs';

// arkaplan.js'i sahte chrome nesnesiyle yükler. chrome.storage verilmez: Arka plan hiçbir depoya yazmaz, kullanırsa sınama
// düşer. Zamanlayıcılar sahte saatle elle ilerletilir (kayıt 60 sn, bayt ve ön indirme 15 sn).
const DRIVE_ID = '1AaaBbbCccDddEeeFffGggHhhIiiJjjKk';
const EK = { au: 1, ik: '1a2b3c4d5e', th: '18f0a1b2c3d4e5f6', attid: '0.1', permmsgid: 'msg-f:1797114040482588150', realattid: null };
const GORUNTULEYICI = { id: 'ek', url: 'chrome-extension://ek/gomulu.html' };
const SEKMEDEKI = { id: 'ek', url: 'chrome-extension://ek/goruntule.html#t=x', tab: { id: 9, index: 1, windowId: 1 } };
const MB = 1 << 20;

function saatKur() {
  let sira = 0;
  const bekleyen = new Map();   // kimlik → { f, ms }
  return {
    setTimeout: (f, ms) => { bekleyen.set(++sira, { f, ms }); return sira; },
    clearTimeout: k => { bekleyen.delete(k); },
    // Süresi ms ya da daha kısa olan zamanlayıcılar dolar.
    ilerlet: ms => { for (const [k, z] of [...bekleyen]) if (z.ms <= ms && bekleyen.has(k)) { bekleyen.delete(k); z.f(); } }
  };
}

function kur({ udfIndir = async () => { throw new Error('indirilmemeli'); }, sekmeYaniti = () => null } = {}) {
  let dinleyici = null;
  const saat = saatKur();
  const sekmeler = [], gidenler = [], indirmeler = [];
  const baglam = {
    console, URL, URLSearchParams, Blob, TextEncoder, TextDecoder, atob, btoa, crypto: globalThis.crypto,
    setTimeout: saat.setTimeout, clearTimeout: saat.clearTimeout, importScripts: () => {},
    DriveIndir: { udfIndir: async k => { indirmeler.push(JSON.parse(JSON.stringify(k))); return udfIndir(k); } },
    chrome: {
      runtime: { id: 'ek', getURL: p => `chrome-extension://ek/${p}`, onMessage: { addListener: f => { dinleyici = f; } } },
      tabs: {
        create: async o => { sekmeler.push(o); },
        sendMessage: async (sekme, ileti, secenek) => { gidenler.push({ sekme, ileti, secenek }); return sekmeYaniti(ileti); }
      }
    }
  };
  vm.createContext(baglam);
  for (const ad of ['gmail-ek.js', 'arkaplan.js']) vm.runInContext(fs.readFileSync(path.join(KOK, ad), 'utf8'), baglam, { filename: ad });
  // Yanıt verilmediyse (dinleyici true döndürmedi, yanıt çağrılmadı) undefined.
  const gonder = (ileti, gonderen = GORUNTULEYICI) => new Promise(coz => {
    const uzun = dinleyici(ileti, gonderen, coz);
    if (uzun !== true) setImmediate(() => coz(undefined));
  });
  // Görüntüleyicinin aldığı kayıt (düz nesne) ya da null.
  const al = async (anahtar, gonderen) => { const y = await gonder({ tur: 'kayit-al', anahtar }, gonderen); return y && y.kayit ? JSON.parse(JSON.stringify(y.kayit)) : null; };
  const driveSekmesi = { id: 'ek', url: 'https://drive.google.com/drive/u/0/folders/x', frameId: 0, tab: { id: 3, index: 0, windowId: 1 } };
  const gmailSekmesi = { id: 'ek', url: 'https://mail.google.com/mail/u/1/#inbox/abc', frameId: 0, tab: { id: 7, index: 2, windowId: 1 } };
  // Service worker'ın tuttukları: Alınmamış kayıtlar, istenmemiş ön indirmeler ve bayt kayıtları (ekleniş sırasıyla).
  const durum = () => JSON.parse(vm.runInContext('JSON.stringify({ kayit: [...kayitlar.keys()], on: [...onIndirmeler.keys()], yedek: [...yedekler.keys()] })', baglam));
  return { gonder, al, saat, sekmeler, gidenler, indirmeler, driveSekmesi, gmailSekmesi, durum };
}
const sekmede = (a, id, url) => ({ ...a.driveSekmesi, ...(url ? { url } : {}), tab: { id, index: 0, windowId: 1 } });
const anlik = () => new Promise(r => setImmediate(r));
const ANAHTAR = '0f8fad5b-d9cb-469f-a165-70867728950e', BASKA = '11111111-2222-3333-4444-555555555555';

// ---------------------------------------------------------------- kayıt bir kez alınır, bellekte durur
test('kayıt bir kez alınır: Görüntüleyici alınca silinir, ikinci alış boş döner', async () => {
  const a = kur({ udfIndir: async () => ({ bayt: new Uint8Array([1]), ad: null, hesap: null }) });
  const { anahtar } = await a.gonder({ tur: 'gomulu-kayit', id: DRIVE_ID, ad: 'Dava Dilekçesi.udf', au: 0, rk: '0-abc', fazla: 'x' }, a.driveSekmesi);
  assert.match(anahtar, /^[0-9a-f-]{36}$/);
  assert.deepEqual(a.durum().kayit, [anahtar]);
  assert.deepEqual(await a.al(anahtar), { id: DRIVE_ID, ad: 'Dava Dilekçesi.udf', au: 0, rk: '0-abc' });
  assert.deepEqual(a.durum().kayit, [], 'alınınca silindi');
  assert.equal(await a.al(anahtar), null, 'ikinci alış (ör. F5) boş');
  // Yeni sekmede açılan belgenin kaydı da bir kez alınır.
  await a.gonder({ tur: 'udf-ac', id: DRIVE_ID, ad: 'b.udf' }, a.driveSekmesi);
  const t = /#t=([0-9a-f-]{36})$/.exec(a.sekmeler[0].url)[1];
  assert.equal((await a.al(t, SEKMEDEKI)).id, DRIVE_ID);
  assert.equal(await a.al(t, SEKMEDEKI), null);
});

test('kayıt: Yalnız görüntüleyici sayfası alabilir, biçimsiz anahtara yanıt yok', async () => {
  const a = kur({ udfIndir: async () => ({ bayt: new Uint8Array([1]), ad: null, hesap: null }) });
  const { anahtar } = await a.gonder({ tur: 'gomulu-kayit', id: DRIVE_ID, ad: 'a.udf' }, a.driveSekmesi);
  for (const [ad, gonderen] of [
    ['içerik betiği (Drive sekmesi)', a.driveSekmesi],
    ['içerik betiği (Gmail sekmesi)', a.gmailSekmesi],
    ['eklentinin başka bir sayfası', { id: 'ek', url: 'chrome-extension://ek/baska.html' }],
    ['başka eklenti', { id: 'baska', url: 'chrome-extension://baska/gomulu.html' }],
    ['web sayfası', { id: 'ek', url: 'https://ornek.com/gomulu.html' }],
    ['adressiz', { id: 'ek' }]
  ]) assert.equal(await a.gonder({ tur: 'kayit-al', anahtar }, gonderen), undefined, ad);
  for (const bozuk of ['bozuk', '', null, 5, `${anahtar}x`]) assert.equal(await a.gonder({ tur: 'kayit-al', anahtar: bozuk }), undefined, String(bozuk));
  assert.deepEqual(a.durum().kayit, [anahtar], 'reddedilen istekler kaydı silmez');
  assert.equal((await a.al(anahtar)).id, DRIVE_ID);
});

test('kayıt: Alınmayan kayıt 60 sn sonra silinir, aynı anda en çok beşi durur (en eskisi gider)', async () => {
  const a = kur({ udfIndir: async () => ({ bayt: new Uint8Array([1]), ad: null, hesap: null }) });
  const anahtarlar = [];
  for (let i = 0; i < 6; i++) anahtarlar.push((await a.gonder({ tur: 'udf-ac', id: DRIVE_ID, ad: `${i}.udf` }, a.driveSekmesi)) && /#t=(.+)$/.exec(a.sekmeler[i].url)[1]);
  assert.deepEqual(a.durum().kayit, anahtarlar.slice(1), 'altıncı kayıt en eskisini sildi');
  assert.equal(await a.al(anahtarlar[0]), null);
  assert.equal((await a.al(anahtarlar[1])).ad, '1.udf');
  a.saat.ilerlet(59999);
  assert.equal(a.durum().kayit.length, 4, '60 sn dolmadan silinmez');
  a.saat.ilerlet(60000);
  assert.deepEqual(a.durum().kayit, [], '60 sn dolunca silinir');
  assert.equal(await a.al(anahtarlar[5]), null);
});

test('kayıt: Gmail eki ad, doğrulanmış ek bilgisi ve sekmeyle, yalnız Gmail sekmesinden', async () => {
  const a = kur();
  const y = await a.gonder({ tur: 'gomulu-kayit', kaynak: 'gmail', ad: 'a.udf', ek: { ...EK, fazla: 'x' } }, a.gmailSekmesi);
  assert.match(y.anahtar, /^[0-9a-f-]{36}$/);
  assert.deepEqual(await a.al(y.anahtar), { kaynak: 'gmail', ad: 'a.udf', ek: EK, sekme: 7 });
  const driveSekmesi = { ...a.gmailSekmesi, url: 'https://drive.google.com/drive/u/0/' };
  assert.equal(await a.gonder({ tur: 'gomulu-kayit', kaynak: 'gmail', ad: 'a.udf', ek: EK }, driveSekmesi), undefined, 'Gmail eki Drive sekmesinden gelmez');
  assert.equal(await a.gonder({ tur: 'gomulu-kayit', kaynak: 'gmail', ad: 'a.udf', ek: { ...EK, th: 'x&y' } }, a.gmailSekmesi), undefined, 'geçersiz ek');
  assert.equal(await a.gonder({ tur: 'gomulu-kayit', kaynak: 'gmail', ad: 'a.udf', ek: EK }, { ...a.gmailSekmesi, frameId: 3 }), undefined, 'alt çerçeve');
  assert.equal(await a.gonder({ tur: 'gomulu-kayit', kaynak: 'gmail', ad: 'a.udf', ek: EK }), undefined, 'görüntüleyici kayıt yazamaz');
  // Gmail'deki Drive bağlantısı (görüntüleyicide Drive dosyası) Drive kaydı olarak kabul edilir.
  const d = await a.gonder({ tur: 'gomulu-kayit', id: DRIVE_ID, ad: 'b.udf', au: 1 }, a.gmailSekmesi);
  assert.deepEqual(await a.al(d.anahtar), { id: DRIVE_ID, ad: 'b.udf', au: 1, rk: null });
});

test('Gmail eki yeni sekmede ("UDF olarak aç"): Kayıt ekin sekmesiyle, görüntüleyici Gmail sekmesinin yanında', async () => {
  const a = kur();
  assert.deepEqual({ ...(await a.gonder({ tur: 'udf-ac', kaynak: 'gmail', ad: 'Dilekçe.udf', ek: EK }, a.gmailSekmesi)) }, { tamam: true });
  assert.equal(a.sekmeler.length, 1);
  const { url, index, openerTabId, windowId } = a.sekmeler[0];
  assert.deepEqual({ index, openerTabId, windowId }, { index: 3, openerTabId: 7, windowId: 1 });
  const anahtar = /^chrome-extension:\/\/ek\/goruntule\.html#t=([0-9a-f-]{36})$/.exec(url)[1];
  assert.deepEqual(await a.al(anahtar, SEKMEDEKI), { kaynak: 'gmail', ad: 'Dilekçe.udf', ek: EK, sekme: 7 });
  assert.equal(await a.gonder({ tur: 'udf-ac', kaynak: 'gmail', ad: 'a.udf', ek: { ...EK, attid: '0.1&x' } }, a.gmailSekmesi), undefined, 'geçersiz ek');
  assert.equal(await a.gonder({ tur: 'udf-ac', kaynak: 'gmail', ad: 'a.udf', ek: EK }, { ...a.gmailSekmesi, frameId: 2 }), undefined, 'alt çerçeve');
  assert.equal(a.sekmeler.length, 1);
});

// ---------------------------------------------------------------- görüntüleyicinin geri gönderdiği kayıt
test('görüntüleyicinin gönderdiği kayıt yeniden doğrulanır: Kimlik, hesap sırası, kaynak anahtarı, ek bilgisi, sekme', async () => {
  const a = kur({ udfIndir: async () => ({ bayt: new Uint8Array([1, 2]), ad: null, hesap: 0 }) });
  const indir = kayit => a.gonder({ tur: 'indir', anahtar: ANAHTAR, kayit });
  for (const kayit of [undefined, null, 'x', {}, { id: '../etc' }, { id: 'kisa' }, { id: `${DRIVE_ID}"><` }]) {
    assert.equal((await indir(kayit)).hata, 'KIMLIK', JSON.stringify(kayit));
  }
  assert.equal(a.indirmeler.length, 0, 'geçersiz kayıtla indirilmez');
  // Geçerli kimlik: Hesap sırası ve kaynak anahtarı ancak biçimliyse kullanılır, fazla alanlar atılır.
  await indir({ id: DRIVE_ID, au: 101, rk: 'a b', fazla: 1 });
  await indir({ id: DRIVE_ID, au: 2.5, rk: 5 });
  await indir({ id: DRIVE_ID, au: 3, rk: '0-abc', ad: 'x.udf' });
  assert.deepEqual(a.indirmeler, [{ id: DRIVE_ID, ad: '', au: null, rk: null }, { id: DRIVE_ID, ad: '', au: null, rk: null }, { id: DRIVE_ID, ad: 'x.udf', au: 3, rk: '0-abc' }]);
  // Gmail eki: Ek bilgisi ve sekme (tam sayı) doğrulanır, geçersizse içerik betiğine hiç sorulmaz.
  for (const kayit of [{ kaynak: 'gmail', ek: EK }, { kaynak: 'gmail', ek: EK, sekme: '7' }, { kaynak: 'gmail', ek: EK, sekme: 7.5 }, { kaynak: 'gmail', ek: EK, sekme: -1 },
    { kaynak: 'gmail', ek: { ...EK, ik: '<x>' }, sekme: 7 }, { kaynak: 'gmail', ek: null, sekme: 7 }]) {
    assert.equal((await indir(kayit)).hata, 'KIMLIK', JSON.stringify(kayit));
  }
  for (const sekme of [undefined, '7', 7.5, -1, null]) assert.equal((await a.gonder({ tur: 'indir-dilim', anahtar: BASKA, i: 0, sekme })).hata, 'AG', String(sekme));
  assert.equal(a.gidenler.length, 0, 'Gmail sekmesine ileti gitmedi');
  // Yalnız görüntüleyici indirme isteyebilir.
  assert.equal(await a.gonder({ tur: 'indir', anahtar: ANAHTAR, kayit: { id: DRIVE_ID } }, a.driveSekmesi), undefined);
  assert.equal(await a.gonder({ tur: 'indir', anahtar: ANAHTAR, kayit: { id: DRIVE_ID } }, { id: 'baska', url: 'chrome-extension://baska/goruntule.html' }), undefined);
});

// ---------------------------------------------------------------- Drive, dilimler, ön indirme
async function hepsiniAl(a, anahtar, kayit) {
  const y = await a.gonder({ tur: 'indir', anahtar, kayit });
  const sonuc = new Uint8Array(y.uzunluk);
  let o = 0;
  for (let i = 0; o < y.uzunluk; i++) {
    const p = await a.gonder({ tur: 'indir-dilim', anahtar, i });
    assert.equal(typeof p.parca, 'string', `dilim ${i}`);
    const ikili = Buffer.from(p.parca, 'base64');
    assert.ok(ikili.length > 0 && ikili.length <= y.dilim);
    sonuc.set(ikili, o);
    o += ikili.length;
  }
  return { y, sonuc };
}

test('yedek indirme dilimleri: Sınır boylarında bayt bayt aynı, son dilimden sonra kayıt bırakılır, baytlar sıfırlanır', async () => {
  for (const boy of [1, MB - 1, MB, MB + 1, 3 * MB + 5]) {
    const asil = Uint8Array.from({ length: boy }, (_, i) => (i * 7 + 3) & 255);
    let verilen = null;
    const a = kur({ udfIndir: async () => { verilen = asil.slice(); return { bayt: verilen, ad: 'a.udf', hesap: 0 }; } });
    const { y, sonuc } = await hepsiniAl(a, ANAHTAR, { id: DRIVE_ID, au: 0 });
    assert.equal(y.dilim, MB);
    assert.deepEqual(Buffer.from(sonuc), Buffer.from(asil), `${boy} bayt`);
    assert.equal((await a.gonder({ tur: 'indir-dilim', anahtar: ANAHTAR, i: 0 }))?.hata, 'AG', 'son dilimden sonra kayıt yok');
    assert.ok(verilen.every(b => b === 0), 'bırakılan baytlar sıfırlandı');
  }
});

test('yedek indirme dilimleri: Geçersiz istekler, 15 sn süre aşımı, yabancı gönderen', async () => {
  let verilen = null;
  const a = kur({ udfIndir: async () => { verilen = new Uint8Array(2 * MB + 10).fill(7); return { bayt: verilen, ad: null, hesap: null }; } });
  await a.gonder({ tur: 'indir', anahtar: ANAHTAR, kayit: { id: DRIVE_ID } });
  for (const i of [-1, 1.5, '0', null, 3, 1e300, NaN, Infinity]) {
    assert.equal((await a.gonder({ tur: 'indir-dilim', anahtar: ANAHTAR, i }))?.hata, 'AG', String(i));
  }
  assert.equal((await a.gonder({ tur: 'indir-dilim', anahtar: BASKA, i: 0 }))?.hata, 'AG', 'başka anahtar');
  assert.equal(await a.gonder({ tur: 'indir-dilim', anahtar: 'bozuk', i: 0 }), undefined, 'biçimsiz anahtara yanıt yok');
  assert.equal(await a.gonder({ tur: 'indir-dilim', anahtar: ANAHTAR, i: 0 }, a.driveSekmesi), undefined, 'içerik betiğine dilim yok');
  assert.equal(typeof (await a.gonder({ tur: 'indir-dilim', anahtar: ANAHTAR, i: 0 })).parca, 'string');
  a.saat.ilerlet(14999);
  assert.equal(typeof (await a.gonder({ tur: 'indir-dilim', anahtar: ANAHTAR, i: 1 })).parca, 'string', '15 sn dolmadan tutulur');
  a.saat.ilerlet(15000);
  assert.equal((await a.gonder({ tur: 'indir-dilim', anahtar: ANAHTAR, i: 2 }))?.hata, 'AG', '15 sn dolunca kayıt bırakılır');
  assert.ok(verilen.every(b => b === 0), 'süresi dolan baytlar sıfırlandı');
});

test('Drive: Gömme kaydıyla indirme başlar, görüntüleyici onu bir kez alır, "Yeniden dene" kayıtla yeniden indirir', async () => {
  const bayt = Uint8Array.from({ length: 300 }, (_, i) => i & 255);
  const a = kur({ udfIndir: async () => ({ bayt: bayt.slice(), ad: 'a.udf', hesap: 0 }) });
  const { anahtar } = await a.gonder({ tur: 'gomulu-kayit', id: DRIVE_ID, ad: 'a.udf', au: 0 }, a.driveSekmesi);
  assert.deepEqual(a.indirmeler.map(k => k.id), [DRIVE_ID], 'indirme kayıtla başlar, görüntüleyici istemeden');
  const kayit = await a.al(anahtar);
  const y = await a.gonder({ tur: 'indir', anahtar, kayit });
  assert.deepEqual({ ...y }, { uzunluk: 300, dilim: MB, ad: 'a.udf', hesap: 0 });
  assert.equal(a.indirmeler.length, 1, 'aynı indirme kullanılır');
  assert.deepEqual(Buffer.from((await a.gonder({ tur: 'indir-dilim', anahtar, i: 0 })).parca, 'base64'), Buffer.from(bayt));
  // Yeniden dene: Arka planda kayıt yok (alındı), görüntüleyici kendi tuttuğu kaydı gönderir.
  assert.deepEqual(a.durum().kayit, []);
  assert.equal((await a.gonder({ tur: 'indir', anahtar, kayit })).uzunluk, 300);
  assert.equal(a.indirmeler.length, 2, 'yeniden dene: yeni indirme');
  assert.deepEqual(a.indirmeler[1], { id: DRIVE_ID, ad: 'a.udf', au: 0, rk: null });
  assert.equal((await a.gonder({ tur: 'indir', anahtar })).hata, 'KIMLIK', 'kayıtsız yeniden deneme olmaz');
  await a.gonder({ tur: 'udf-ac', id: DRIVE_ID, ad: 'a.udf' }, a.driveSekmesi);
  assert.equal(a.indirmeler.length, 2, 'sekmede açılan belge (üst düzey sayfa) kendisi indirir');
  await a.gonder({ tur: 'gomulu-kayit', kaynak: 'gmail', ad: 'a.udf', ek: EK }, sekmede(a, 3, a.gmailSekmesi.url));
  assert.equal(a.indirmeler.length, 2, 'Gmail ekini arka plan indirmez');
});

test('Drive ön indirmesi: Hata görüntüleyiciye aynen gider, istenmeyen indirme 15 sn sonra bırakılır ve sıfırlanır', async () => {
  const hatali = kur({ udfIndir: async () => { throw Object.assign(new Error('x'), { kod: 'HTTP_403' }); } });
  const k1 = (await hatali.gonder({ tur: 'gomulu-kayit', id: DRIVE_ID, ad: 'a.udf' }, hatali.driveSekmesi)).anahtar;
  assert.equal((await hatali.gonder({ tur: 'indir', anahtar: k1, kayit: await hatali.al(k1) })).hata, 'HTTP_403');
  assert.equal(hatali.indirmeler.length, 1);

  const verilenler = [];
  const a = kur({ udfIndir: async () => { const b = new Uint8Array([1, 2, 3]); verilenler.push(b); return { bayt: b, ad: null, hesap: null }; } });
  const k2 = (await a.gonder({ tur: 'gomulu-kayit', id: DRIVE_ID, ad: 'a.udf' }, a.driveSekmesi)).anahtar;
  await anlik();
  a.saat.ilerlet(15000);   // 15 sn doldu, çerçeve hiç istemedi
  assert.equal((await a.gonder({ tur: 'indir-dilim', anahtar: k2, i: 0 })).hata, 'AG', 'baytlar bırakıldı');
  assert.deepEqual([...verilenler[0]], [0, 0, 0], 've sıfırlandı');
  assert.deepEqual(a.durum().kayit, [k2], 'kayıt 60 sn durur');
  assert.equal((await a.gonder({ tur: 'indir', anahtar: k2, kayit: await a.al(k2) })).uzunluk, 3);
  assert.equal(a.indirmeler.length, 2, 'süresi dolan ön indirme kullanılmaz, yeniden indirilir');
});

test('Drive ön indirmesi: En çok üç istenmemiş indirme ve üç bayt kaydı tutulur, en eskisi bırakılır', async () => {
  const a = kur({ udfIndir: async k => ({ bayt: new Uint8Array([Number(k.ad[0])]), ad: null, hesap: null }) });
  const anahtarlar = [];
  // Beş ayrı sekmede beş dosya (ör. oklarla hızlı gezinme), hiçbirini görüntüleyici istemedi.
  for (let i = 0; i < 5; i++) anahtarlar.push((await a.gonder({ tur: 'gomulu-kayit', id: DRIVE_ID, ad: `${i}.udf` }, sekmede(a, 10 + i))).anahtar);
  await anlik();
  assert.equal(a.indirmeler.length, 5);
  assert.deepEqual({ on: a.durum().on, yedek: a.durum().yedek }, { on: anahtarlar.slice(2), yedek: anahtarlar.slice(2) }, 'en eski ikisi bırakıldı, baytları da');
  // Bırakılan ön indirme kullanılmaz: Görüntüleyici isterse kaydıyla yeniden indirilir.
  assert.equal((await a.gonder({ tur: 'indir-dilim', anahtar: anahtarlar[0], i: 0 })).hata, 'AG');
  const y = await a.gonder({ tur: 'indir', anahtar: anahtarlar[0], kayit: await a.al(anahtarlar[0]) });
  assert.equal(y.uzunluk, 1);
  assert.equal(a.indirmeler.length, 6);
  assert.deepEqual(a.durum().yedek, [anahtarlar[3], anahtarlar[4], anahtarlar[0]], 'bayt kaydı da en çok üç');
  assert.deepEqual([...Buffer.from((await a.gonder({ tur: 'indir-dilim', anahtar: anahtarlar[0], i: 0 })).parca, 'base64')], [0]);
  // Sınırın içindeki ön indirme olduğu gibi kullanılır.
  assert.equal((await a.gonder({ tur: 'indir', anahtar: anahtarlar[4], kayit: await a.al(anahtarlar[4]) })).uzunluk, 1);
  assert.deepEqual([...Buffer.from((await a.gonder({ tur: 'indir-dilim', anahtar: anahtarlar[4], i: 0 })).parca, 'base64')], [4]);
  assert.equal(a.indirmeler.length, 6, 'yeniden indirilmedi');
});

test('Drive ön indirmesi: Aynı sekmeden yeni gömme kaydı gelince o sekmenin istenmemiş ön indirmesi bırakılır', async () => {
  const bekleyenler = [], verilenler = [];
  const a = kur({ udfIndir: k => new Promise(coz => bekleyenler.push(() => { const b = new Uint8Array([Number(k.ad[0])]); verilenler.push(b); coz({ bayt: b, ad: null, hesap: null }); })) });
  const k1 = (await a.gonder({ tur: 'gomulu-kayit', id: DRIVE_ID, ad: '1.udf' }, sekmede(a, 3))).anahtar;
  const k2 = (await a.gonder({ tur: 'gomulu-kayit', id: DRIVE_ID, ad: '2.udf' }, sekmede(a, 4))).anahtar;
  const k3 = (await a.gonder({ tur: 'gomulu-kayit', id: DRIVE_ID, ad: '3.udf' }, sekmede(a, 3))).anahtar;
  assert.deepEqual(a.durum().on, [k2, k3], '3. sekmenin önceki ön indirmesi bırakıldı, öbür sekmeninki kaldı');
  for (const coz of bekleyenler.splice(0)) coz();
  await anlik();
  assert.deepEqual(a.durum().yedek, [k2, k3], 'bırakılan indirmenin baytları inince tutulmaz');
  assert.deepEqual([...verilenler[0]], [0], 've sıfırlanır');
  assert.equal((await a.gonder({ tur: 'indir-dilim', anahtar: k1, i: 0 })).hata, 'AG');
  // Görüntüleyicinin istediği indirme (k3) sekmenin sonraki kaydıyla bırakılmaz, dilimleri verilir.
  assert.equal((await a.gonder({ tur: 'indir', anahtar: k3, kayit: await a.al(k3) })).uzunluk, 1);
  const k4 = (await a.gonder({ tur: 'gomulu-kayit', id: DRIVE_ID, ad: '4.udf' }, sekmede(a, 3))).anahtar;
  assert.deepEqual(a.durum().on, [k2, k4]);
  assert.deepEqual([...Buffer.from((await a.gonder({ tur: 'indir-dilim', anahtar: k3, i: 0 })).parca, 'base64')], [3]);
  // Aynı sekmede açılan Gmail eki de o sekmenin Drive ön indirmesini bırakır (Gmail'deki Drive bağlantısı).
  await a.gonder({ tur: 'gomulu-kayit', kaynak: 'gmail', ad: 'a.udf', ek: EK }, sekmede(a, 4, a.gmailSekmesi.url));
  assert.deepEqual(a.durum().on, [k4]);
  // 15 sn dolunca kalan ön indirme de bırakılır.
  for (const coz of bekleyenler.splice(0)) coz();
  await anlik();
  a.saat.ilerlet(15000);
  assert.deepEqual({ on: a.durum().on, yedek: a.durum().yedek }, { on: [], yedek: [] });
});

// ---------------------------------------------------------------- Gmail eki, içerik betiğinden aktarım
test('Gmail eki: İndirme ve dilimler görüntüleyicinin kaydındaki sekmeden (içerik betiği) aktarılır', async () => {
  const a = kur({ sekmeYaniti: ileti => (ileti.tur === 'gmail-indir' ? { uzunluk: 5, dilim: MB } : { parca: 'AQIDBAU=' }) });
  const { anahtar } = await a.gonder({ tur: 'gomulu-kayit', kaynak: 'gmail', ad: 'a.udf', ek: EK }, a.gmailSekmesi);
  const kayit = await a.al(anahtar);
  assert.deepEqual({ ...(await a.gonder({ tur: 'indir', anahtar, kayit })) }, { uzunluk: 5, dilim: MB, ad: null, hesap: null });
  assert.deepEqual({ ...(await a.gonder({ tur: 'indir-dilim', anahtar, i: 0, sekme: kayit.sekme })) }, { parca: 'AQIDBAU=' });
  assert.deepEqual(JSON.parse(JSON.stringify(a.gidenler.map(g => [g.sekme, g.ileti.tur, g.secenek.frameId]))), [[7, 'gmail-indir', 0], [7, 'gmail-dilim', 0]]);
  assert.deepEqual(JSON.parse(JSON.stringify(a.gidenler[0].ileti.ek)), EK);
  assert.equal((await a.gonder({ tur: 'indir-dilim', anahtar, i: -1, sekme: 7 })).hata, 'AG');
  assert.equal(await a.gonder({ tur: 'indir', anahtar, kayit }, a.gmailSekmesi), undefined, 'içerik betiği indirme isteyemez');
  assert.equal(await a.gonder({ tur: 'indir-dilim', anahtar, i: 0, sekme: 7 }, a.gmailSekmesi), undefined, 'içerik betiği dilim isteyemez');
});

test('Gmail eki: Sekme yoksa GMAIL_SEKME, içerik betiğinin hatası ancak biçimliyse aktarılır', async () => {
  const dene = async yanit => {
    const a = kur({ sekmeYaniti: () => { if (yanit instanceof Error) throw yanit; return yanit; } });
    const { anahtar } = await a.gonder({ tur: 'gomulu-kayit', kaynak: 'gmail', ad: 'a.udf', ek: EK }, a.gmailSekmesi);
    return (await a.gonder({ tur: 'indir', anahtar, kayit: await a.al(anahtar) })).hata;
  };
  assert.equal(await dene(new Error('Could not establish connection. Receiving end does not exist.')), 'GMAIL_SEKME');
  assert.equal(await dene(undefined), 'GMAIL_SEKME');
  assert.equal(await dene({ hata: 'HTTP_403' }), 'HTTP_403');
  assert.equal(await dene({ hata: '<b>' }), 'AG');
  assert.equal(await dene({ uzunluk: 0, dilim: 1 }), 'AG');
});

// ---------------------------------------------------------------- simge, uyandırma

test("'uyan' iletisine boş yanıt verilir (yalnız service worker'ı uyandırır)", async () => {
  const a = kur();
  assert.deepEqual({ ...(await a.gonder({ tur: 'uyan' }, { id: 'ek', url: 'https://mail.google.com/mail/u/1/', frameId: 0, tab: { id: 3 } })) }, {});
  assert.equal(a.indirmeler.length, 0);
  assert.deepEqual(a.durum(), { kayit: [], on: [], yedek: [] });
});
