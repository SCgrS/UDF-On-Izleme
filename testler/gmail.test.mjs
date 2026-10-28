import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { KOK } from './yardimci.mjs';

// gmail-ek.js'i Gmail adresli bir jsdom penceresinde çalıştırır. Kart ve görüntüleyici yapısı 2026-10-26'da gerçek Gmail'de
// ölçülen biçimdedir (download_url'deki adres Gmail'in yazdığı gibi iki kez başlar).
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://mail.google.com/mail/u/1/#inbox/abc', runScripts: 'outside-only' });
const w = dom.window;
const d = w.document;
w.eval(fs.readFileSync(path.join(KOK, 'gmail-ek.js'), 'utf8'));
const G = w.GmailEk;
const duz = o => JSON.parse(JSON.stringify(o));

const IK = '1a2b3c4d5e';
const TH_A = '18f0a1b2c3d4e5f6', TH_B = '18f0a1b2c3d4e6a7';
const MSG_A = '1797114040482588150', MSG_B = '1797114040482588327';
const sorgu = (attid, msg, th) => `ui=2&ik=${IK}&attid=${attid}&permmsgid=msg-f:${msg}&th=${th}&view=att&zw&disp=safe`;
const duAdresi = (ad, attid, msg, th) => `application/octet-stream:${encodeURIComponent(ad)}:https://mail.google.com/mail/u/1/https://mail.google.com/mail/u/1?${sorgu(attid, msg, th)}`;

// Gmail'deki gibi: İletideki kartlar (span[download_url] içinde a[href]) ve ön izleme (konumu sabit katmanda role=dialog,
// içinde her ek için bir ana alan, gösterilende #drive-active-item-info). Gmail'in kendi ana alanı (role=main)
// görüntüleyicinin dışında da durur.
function kur({ iletiler = [], anaSayisi = 0, etkin = -1, baslik = '', id = '' }) {
  d.body.replaceChildren();
  const gmailAna = d.createElement('div');
  gmailAna.setAttribute('role', 'main');
  d.body.append(gmailAna);
  for (const { msg, th, kartlar } of iletiler) {
    const ileti = d.createElement('div');
    kartlar.forEach((ad, i) => {
      const attid = `0.${i + 1}`;
      const kart = d.createElement('span');
      kart.setAttribute('download_url', duAdresi(ad, attid, msg, th));
      const a = d.createElement('a');
      a.setAttribute('href', `https://mail.google.com/mail/u/1?${sorgu(attid, msg, th)}`);
      kart.append(a);
      ileti.append(kart);
    });
    gmailAna.append(ileti);
  }
  if (!anaSayisi) return;
  const pencere = d.createElement('div');
  pencere.setAttribute('role', 'dialog');
  const kap = d.createElement('div');
  for (const ad of ['Önceki', 'Sonraki']) { const ok = d.createElement('div'); ok.setAttribute('aria-label', ad); kap.append(ok); }
  for (let i = 0; i < anaSayisi; i++) {
    const ana = d.createElement('div');
    ana.setAttribute('role', 'main');
    if (i === etkin) {
      const b = d.createElement('div');
      b.id = 'drive-active-item-info';
      b.textContent = JSON.stringify({ id, title: baslik, mimeType: 'application/octet-stream' });
      ana.append(b);
    }
    kap.append(ana);
  }
  pencere.append(kap);
  d.body.append(katman(pencere));
}
// Görüntüleyicinin konumu sabit katmanı.
function katman(...cocuklar) {
  const k = d.createElement('div');
  k.style.position = 'fixed';
  k.append(...cocuklar);
  return k;
}
const bilgiOgesi = (metin = JSON.stringify({ id: '', title: 'Ek.udf' })) => Object.assign(d.createElement('div'), { id: 'drive-active-item-info', textContent: metin });

test('ön izlemenin bilgi öğesi yalnız görüntüleyicinin katmanında ve belgede tekse', () => {
  kur({ iletiler: [{ msg: MSG_A, th: TH_A, kartlar: ['Ek.udf'] }], anaSayisi: 1, etkin: 0, baslik: 'Ek.udf' });
  const gercek = d.getElementById('drive-active-item-info');
  assert.equal(G.bilgiOgesi(d), gercek);
  assert.equal(G.sabitKatman(gercek), d.body.lastElementChild);
  assert.equal(G.gorunenOge(d).ad, 'Ek.udf');
  // İletinin gövdesinde aynı kimlikli öğe (Gmail kimliği koruyorsa): Gerçek ön izlemeyle birlikteyse ikisine de güvenilmez,
  // tek başınaysa konumu sabit katmanda olmadığı için kabul edilmez. Öğe hangi sırada gelirse gelsin.
  const sahte = bilgiOgesi(JSON.stringify({ id: '', title: 'Ek.udf' }));
  for (const yer of ['once', 'sonra']) {
    if (yer === 'once') d.querySelector('[role=main]').prepend(sahte); else d.body.append(sahte);
    assert.equal(G.bilgiOgesi(d), null, yer);
    assert.equal(G.gorunenOge(d), null, yer);
    assert.equal(G.gosterilenEk(d, { th: TH_A }), null, yer);
  }
  gercek.remove();
  assert.equal(G.bilgiOgesi(d), null, 'yalnız gövdedeki öğe');
  sahte.remove();
  // Gövdedeki öğe konumu sabit bir kabın içinde (Gmail iletideki position'ı koruyorsa): Katman Gmail'in ana alanının içinde.
  // Kendi ana alanı ve penceresiyle de kabul edilmez.
  const posta = d.querySelector('[role=main]');
  for (const yapi of [[], ['main'], ['dialog', 'main']]) {
    const kap = katman();
    let yer = kap;
    for (const rol of yapi) { const e = d.createElement('div'); e.setAttribute('role', rol); yer.append(e); yer = e; }
    yer.append(bilgiOgesi());
    posta.append(kap);
    assert.equal(G.bilgiOgesi(d), null, `sabit kapta: ${yapi.join(' > ') || 'yalnız öğe'}`);
    kap.remove();
  }
  // Gmail'in kabuğu konumu sabit olsaydı: Gövdedeki pencere ve ana alanla öğe katmandan iki ana alan içeride.
  const kabuk = katman(posta);
  d.body.prepend(kabuk);
  const pencere = d.createElement('div');
  pencere.setAttribute('role', 'dialog');
  const kendiAna = d.createElement('div');
  kendiAna.setAttribute('role', 'main');
  kendiAna.append(bilgiOgesi());
  pencere.append(kendiAna);
  posta.append(pencere);
  assert.equal(G.bilgiOgesi(d), null, 'kabuk sabit, iki ana alan');
  pencere.remove();
  d.body.append(katman(bilgiOgesi()));
  assert.ok(G.bilgiOgesi(d), 'ana alanı olmayan katmanda da (yapı tanınmazsa "UDF olarak aç" düğmesi için)');
  kur({});
  assert.equal(G.bilgiOgesi(d), null);
});

test('Gmail ek adresinden ek bilgisi, geçersizler reddedilir', () => {
  const tam = `https://mail.google.com/mail/u/1/https://mail.google.com/mail/u/1?${sorgu('0.1', MSG_A, TH_A)}`;
  assert.deepEqual(duz(G.adrestenEk(tam)), { au: 1, ik: IK, th: TH_A, attid: '0.1', permmsgid: `msg-f:${MSG_A}`, realattid: null });
  assert.equal(G.adrestenEk(`https://mail.google.com/mail/?ui=2&ik=${IK}&attid=0.0.2&th=${TH_A}&view=att&realattid=f_abc-1&zw`).au, null);
  assert.equal(G.adrestenEk(`https://mail.google.com/mail/?ui=2&ik=${IK}&attid=0.0.2&th=${TH_A}&view=att&realattid=f_abc-1&zw`).realattid, 'f_abc-1');
  assert.equal(G.adrestenEk(`https://mail.google.com/mail/u/0?ui=2&ik=${IK}&attid=0.1&permmsgid=msg-a:r-1234567&th=${TH_A}&view=att`).permmsgid, 'msg-a:r-1234567');
  for (const [neden, adres] of [
    ['başka site', `https://ornek.com/mail/u/1?${sorgu('0.1', MSG_A, TH_A)}`],
    ['alt alan adı', `https://mail.google.com.ornek.com/mail/u/1?${sorgu('0.1', MSG_A, TH_A)}`],
    ['http', `http://mail.google.com/mail/u/1?${sorgu('0.1', MSG_A, TH_A)}`],
    ['ek değil', `https://mail.google.com/mail/u/1?ui=2&ik=${IK}&attid=0.1&th=${TH_A}&view=fimg`],
    ['ik bozuk', `https://mail.google.com/mail/u/1?ui=2&ik=<b>&attid=0.1&th=${TH_A}&view=att`],
    ['th yok', `https://mail.google.com/mail/u/1?ui=2&ik=${IK}&attid=0.1&view=att`],
    ['attid bozuk', `https://mail.google.com/mail/u/1?ui=2&ik=${IK}&attid=0.1;x&th=${TH_A}&view=att`],
    ['permmsgid bozuk', `https://mail.google.com/mail/u/1?ui=2&ik=${IK}&attid=0.1&permmsgid=msg-f:12ab&th=${TH_A}&view=att`],
    ['realattid bozuk', `https://mail.google.com/mail/u/1?ui=2&ik=${IK}&attid=0.1&th=${TH_A}&view=att&realattid=a/b`],
    ['sorgu yok', 'https://mail.google.com/mail/u/1']
  ]) assert.equal(G.adrestenEk(adres), null, neden);
  assert.equal(G.ekTemizle({ au: 100, ik: IK, th: TH_A, attid: '0.1' }), null, 'hesap sırası sınırda');
  assert.equal(G.ekTemizle({ au: 1, ik: { toString: () => IK }, th: TH_A, attid: '0.1' }), null, 'metin olmayan değer');
});

test('ek kartı: download_url\'den ad ve adres, bağlantıdan yalnız adres', () => {
  const kart = d.createElement('span');
  kart.setAttribute('download_url', duAdresi('Deneme dilekçesi.udf', '0.1', MSG_A, TH_A));
  assert.deepEqual(duz(G.kartBilgisi(kart)), { au: 1, ik: IK, th: TH_A, attid: '0.1', permmsgid: `msg-f:${MSG_A}`, realattid: null, ad: 'Deneme dilekçesi.udf' });
  kart.setAttribute('download_url', `application/octet-stream:a:b.udf:https://mail.google.com/mail/u/2?${sorgu('0.3', MSG_A, TH_A)}`);
  assert.equal(G.kartBilgisi(kart).ad, 'a:b.udf', 'kodlanmamış adda iki nokta');
  assert.equal(G.kartBilgisi(kart).au, 2);
  kart.setAttribute('download_url', 'application/octet-stream:x.udf:https://ornek.com/?view=att');
  assert.equal(G.kartBilgisi(kart), null);
  const a = d.createElement('a');
  a.setAttribute('href', `/mail/u/1?${sorgu('0.2', MSG_A, TH_A)}`);
  assert.deepEqual(duz(G.kartBilgisi(a)), { au: 1, ik: IK, th: TH_A, attid: '0.2', permmsgid: `msg-f:${MSG_A}`, realattid: null, ad: null });
  a.setAttribute('href', `https://ornek.com/mail/u/1?${sorgu('0.2', MSG_A, TH_A)}`);
  assert.equal(G.kartBilgisi(a), null);
});

test('sayfadaki ekler: Kart ve bağlantısı tek ek, sayfadaki sırayla', () => {
  kur({ iletiler: [{ msg: MSG_A, th: TH_A, kartlar: ['Bir.udf', 'İki.pdf'] }, { msg: MSG_B, th: TH_B, kartlar: ['Üç.udf'] }] });
  const l = duz(G.ekListesi(d));
  assert.deepEqual(l.map(e => `${e.th === TH_A ? 'A' : 'B'} ${e.attid} ${e.ad}`), ['A 0.1 Bir.udf', 'A 0.2 İki.pdf', 'B 0.1 Üç.udf']);
  // Kartın download_url'ü henüz yoksa (Gmail sonradan yazabiliyor) bağlantıdan, adsız.
  d.querySelector('[download_url]').removeAttribute('download_url');
  assert.deepEqual(duz(G.ekListesi(d)).map(e => `${e.attid} ${e.ad}`), ['0.1 null', '0.2 İki.pdf', '0.1 Üç.udf']);
});

test('ön izlemede gösterilen ek: Tıklanan iletideki, ana alanın sırasındaki ek', () => {
  const A = { msg: MSG_A, th: TH_A, kartlar: ['Deneme dilekçesi.udf', 'Notlu.udf', 'Aynı ad.udf', 'Aynı ad.udf', 'Düz yazı.txt'] };
  const B = { msg: MSG_B, th: TH_B, kartlar: ['İkinci ileti.udf', 'Deneme dilekçesi.udf'] };
  const goster = (o, son, s) => { kur({ iletiler: [A, B], ...o }); const e = G.gosterilenEk(d, son, s); return e && `${e.th === TH_A ? 'A' : 'B'} ${e.attid} ${e.ad}`; };
  assert.equal(goster({ anaSayisi: 5, etkin: 1, baslik: 'Notlu.udf' }, { th: TH_A }), 'A 0.2 Notlu.udf');
  // Aynı adlı iki ek: Sıra ayırır. Gmail ana alanları gerektikçe ekliyor (ilk açılışta hepsi yok), sıra yine ek sırası.
  assert.equal(goster({ anaSayisi: 3, etkin: 2, baslik: 'Aynı ad.udf' }, { th: TH_A }), 'A 0.3 Aynı ad.udf');
  assert.equal(goster({ anaSayisi: 5, etkin: 3, baslik: 'Aynı ad.udf' }, { th: TH_A }), 'A 0.4 Aynı ad.udf');
  // İki iletide aynı adlı ek: Tıklanan ileti ayırır.
  assert.equal(goster({ anaSayisi: 2, etkin: 1, baslik: 'Deneme dilekçesi.udf' }, { th: TH_B }), 'B 0.2 Deneme dilekçesi.udf');
  assert.equal(goster({ anaSayisi: 5, etkin: 0, baslik: 'Deneme dilekçesi.udf' }, { th: TH_A }), 'A 0.1 Deneme dilekçesi.udf');
  // Tıklama bilinmiyorsa: Tahmin yalnız izin varsa (sayfa ön izleme açıkken yenilendi) ve tek ileti tutuyorsa.
  assert.equal(goster({ anaSayisi: 2, etkin: 0, baslik: 'İkinci ileti.udf' }, null, { tiklamasizOlur: true }), 'B 0.1 İkinci ileti.udf');
  assert.equal(goster({ anaSayisi: 2, etkin: 1, baslik: 'Deneme dilekçesi.udf' }, null, { tiklamasizOlur: true }), null);
  // Kartsız açılan ön izleme (ör. gelen kutusu listesindeki ek düğmesi): Sayfadaki başka bir iletinin eki tahmin edilmez.
  assert.equal(goster({ anaSayisi: 2, etkin: 0, baslik: 'İkinci ileti.udf' }, null), null);
  // Tıklanan ileti sayfada değilse başka iletiye bakılmaz.
  assert.equal(goster({ anaSayisi: 2, etkin: 0, baslik: 'İkinci ileti.udf' }, { th: 'abcdef0123456789' }, { tiklamasizOlur: true }), null);
  // Sıra tutmazsa (ör. Gmail sırayı değiştirdi) tıklanan iletide o adda tek ek varsa o, birden çoksa hiçbiri.
  assert.equal(goster({ anaSayisi: 9, etkin: 7, baslik: 'Notlu.udf' }, { th: TH_A }), 'A 0.2 Notlu.udf');
  assert.equal(goster({ anaSayisi: 9, etkin: 7, baslik: 'Aynı ad.udf' }, { th: TH_A }), null);
  // Tıklanan iletide belirsizse, öbür iletide o adda tek ek olsa da o seçilmez (gözden geçirmede bulundu).
  const B2 = { ...B, kartlar: ['İkinci ileti.udf', 'Aynı ad.udf'] };
  kur({ iletiler: [A, B2], anaSayisi: 9, etkin: 7, baslik: 'Aynı ad.udf' });
  assert.equal(G.gosterilenEk(d, { th: TH_A }, { tiklamasizOlur: true }), null);
  kur({ iletiler: [A, B2], anaSayisi: 0 });
  const ana = d.createElement('div');   // Yapı tanınmıyor: Ana alan yok, sıra -1
  ana.append(bilgiOgesi(JSON.stringify({ id: '', title: 'Aynı ad.udf' })));
  d.body.append(katman(ana));
  assert.equal(G.gosterilenEk(d, { th: TH_A }), null);
  // .udf değil, Drive dosyası (kimlik dolu), ad hiçbir ekle tutmuyor, görüntüleyici kapalı.
  assert.equal(goster({ anaSayisi: 5, etkin: 4, baslik: 'Düz yazı.txt' }, { th: TH_A }), null);
  assert.equal(goster({ anaSayisi: 5, etkin: 1, baslik: 'Notlu.udf', id: '1AaaBbbCccDddEeeFffGggHhh' }, { th: TH_A }), null);
  assert.equal(goster({ anaSayisi: 5, etkin: 1, baslik: 'Başka.udf' }, { th: TH_A }), null);
  assert.equal(goster({}, { th: TH_A }), null);
  // Büyük harfli uzantı.
  assert.equal(goster({ anaSayisi: 1, etkin: 0, baslik: 'BÜYÜK.UDF' }, null), null);
  kur({ iletiler: [{ msg: MSG_A, th: TH_A, kartlar: ['BÜYÜK.UDF'] }], anaSayisi: 1, etkin: 0, baslik: 'BÜYÜK.UDF' });
  assert.equal(G.gosterilenEk(d, null, { tiklamasizOlur: true }).attid, '0.1');
});

test('adsız kart (yalnız bağlantı) yalnız tıklanan iletide, sırasıyla kabul edilir', () => {
  kur({ iletiler: [{ msg: MSG_A, th: TH_A, kartlar: ['Bir.udf', 'İki.udf'] }], anaSayisi: 2, etkin: 1, baslik: 'İki.udf' });
  for (const k of d.querySelectorAll('[download_url]')) k.removeAttribute('download_url');
  assert.equal(G.gosterilenEk(d, { th: TH_A }).attid, '0.2');
  assert.equal(G.gosterilenEk(d, null), null);
});

test('indirme adresi yalnız doğrulanmış değerlerden, Gmail\'in kartındaki biçimde', () => {
  const ek = { au: 1, ik: IK, th: TH_A, attid: '0.1', permmsgid: `msg-f:${MSG_A}`, realattid: null };
  assert.equal(G.indirmeAdresi(ek), `https://mail.google.com/mail/u/1?ui=2&ik=${IK}&attid=0.1&permmsgid=msg-f:${MSG_A}&th=${TH_A}&view=att&disp=safe&zw`);
  assert.equal(G.indirmeAdresi({ ...ek, au: null, permmsgid: null, realattid: 'f_x1' }), `https://mail.google.com/mail/?ui=2&ik=${IK}&attid=0.1&th=${TH_A}&view=att&disp=safe&realattid=f_x1&zw`);
  assert.equal(G.indirmeAdresi({ ...ek, th: 'x&view=fimg' }), null);
  assert.equal(G.indirmeAdresi(null), null);
  // Gmail kartındaki adresle aynı ek
  assert.deepEqual(duz(G.adrestenEk(G.indirmeAdresi(ek))), ek);
});

test('Gmail sayfasının hesap sırası', () => {
  assert.equal(G.sayfaHesabi('https://mail.google.com/mail/u/1/#inbox'), 1);
  assert.equal(G.sayfaHesabi('https://mail.google.com/mail/u/12/'), 12);
  assert.equal(G.sayfaHesabi('https://mail.google.com/mail/#inbox'), null);
  assert.equal(G.sayfaHesabi('https://drive.google.com/drive/u/1/'), null);
});
