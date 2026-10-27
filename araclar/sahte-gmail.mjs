// Sahte Gmail ile uçtan uca sınama: node araclar/chrome-sina.mjs gmail [udf dosyası] [ekran.png]
// mail.google.com ve mail-attachment.googleusercontent.com yerel bir HTTPS sunucusuna yönlendirilir (--host-resolver-rules).
// Sahte sayfa Gmail'in ek ön izlemesinin 2026-10-26'da gerçek Gmail'de (Chrome, pencere 958×910) ölçülen yapısını ve
// davranışını taklit eder:
// - Katman: Konumu sabit, z-index 1204, pencereyi kaplar. İçinde span > span > iki kardeş: Üst çubuk bloğu (64 px'lik
//   çubuk, ikinci satırda İndir, en alttaki denetim 104 px'te biter) ve role=dialog. Pencerenin tek kabında "Önceki" ve
//   "Sonraki" okları (48×90 kutu, görünen 40×40 düğme), boş bir div, ardından tıklanan iletinin her eki için bir ana alan
//   (role=main), ek sırasıyla. Ana alanlar gerektikçe ama hep 0'dan sırayla eklenir (gösterilen ekin 5 sonrasına dek).
//   Gösterilen ana alan pencereyi kaplar, öbürleri display:none. Tek #drive-active-item-info gösterilen ana alandadır,
//   kimliği boştur. .udf için Gmail'in "Önizleme yok" kartı, .pdf için ön izleme.
// - Gmail'in kendi ana alanı (role=main, posta kutusu) katmanın dışında da durur.
// - Ek kartına tıklamak ön izlemeyi o ekte açar, adrese "?projector=1&messagePartId=<attid>" eklenir, bağlantıya gidilmez.
//   Oklar (sahte, keyCode'lu olaylar dâhil) adresi değiştirmeden öbür eke geçer. Esc kapatır, "?projector…" kalkar.
// - Kartların dışında, gelen kutusu listesindeki ek düğmeleri gibi iki düğme ([data-liste-eki]) ön izlemeyi B iletisinin
//   bir ekinde açar. Bunlar ek kartı değildir (indirme bilgisi yok): Ön izlemeyi açan ileti sayfadan anlaşılmaz.
// - Adresinde "?projector=1&messagePartId=<attid>" ile yüklenen sayfa (ön izleme açıkken yenilendi): Gmail yüklenince ön
//   izleme tıklamasız, konunun son iletisindeki o ekte açılır.
// - window.__yenidenCiz(): Görüntüleyici gösterilen ana alanı yeniden çizer, kendi koymadığı çocukları siler. Gerçek
//   Gmail'de görülmedi, eklentinin önlemi sınanır (DRIVE-TEKNIGI.md §14).
// - Sayfa adresinin sorgusu: "?ileri=<n>" ana alanların önden kurulduğu ek sayısı. "?elleAna=1" ile açılışta ve geçişte
//   yalnız gösterilen ana alana dek kurulur, sonrakileri sınama window.__anaEkle() ile (çerçeve gösterilirken) ekletir.
// - İndirme: Gmail çerezli istek 302 ile mail-attachment.googleusercontent.com'a yönlenir, orası Gmail kökenine CORS izni
//   verir. Sahte sunucu Gmail sayfasının koyduğu çerezi ister ve her isteğin kökenini, Sec-Fetch-Site'ını, çerezlerini ve
//   ekini kaydeder: Ek baytlarının Gmail sekmesindeki içerik betiğinden birinci taraf olarak alındığı denetlenir.
// Ölçülmemiş varsayımlar: Ön izleme açılınca odak pencereye geçer (Drive'ın aynı görüntüleyicisi gibi), okların z-index'i
// 5'tir (yoksa Gmail'in kendi ön izlemesi de okları örterdi), son ekte "Sonraki" gizlidir, yenilenen sayfada ön izleme
// konunun son iletisinde açılır, listedeki ek düğmesi kart tıklaması gibi bir iz bırakmaz.
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromeBaslat, sekmeAc, ifadeBekle, pikselRengi, cspIzle, CERCEVE, CERCEVELER, CERCEVE_ODAKTA } from './cdp.mjs';
import { sertifika, karanlikOkuyucu } from './sahte-drive.mjs';
import { Belge, udfZip } from './ornek-uret.mjs';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GMAIL = 'mail.google.com', EKLER = 'mail-attachment.googleusercontent.com';
const IK = '0a1b2c3d4e';
const ACILIYOR = 'UDF Ön İzleme eklentisiyle açılıyor…';
// Yapay belgelerin ayırt edici yazıları: Hangi ekin gösterildiği belgenin metninden anlaşılır.
const ISARET = { dilekce: 'DENEME İŞ MAHKEMESİNE', ayni1: 'AYNI ADLI BİRİNCİ EK', ayni2: 'AYNI ADLI İKİNCİ EK', b: 'B İLETİSİNDEKİ DİLEKÇE',
  buyuk: 'BÜYÜK EKİN METNİ', ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(k => ['c' + k, `C İLETİSİNİN ${k}. EKİ`])) };
const MiB = 1 << 20;
const CERCEVE_ANAHTARI = `(() => { const c = ${CERCEVE}; const m = c && /#t=([0-9a-f-]{36})/.exec(c.src); return m ? m[1] : null; })()`;
const bekle = ms => new Promise(r => setTimeout(r, ms));

function isaretliBelge(metin) {
  const b = new Belge();
  const ogeler = [b.paragraf({ Alignment: 1 }, [[metin, { bold: true }]]), b.paragraf({}, [['Yapay sınama belgesi.']])];
  return udfZip([['content.xml', Buffer.from(b.xml({ ogeler }), 'utf8')]]);
}

// 2 MB'tan birkaç bayt büyük yapay UDF: İçerik betiği baytları 1 MB'lık dilimlerle verir (0, 1 ve birkaç baytlık son
// dilim). Girdiler saklanmış (sıkıştırılmamış). content.xml rastgele (sıkıştırılamaz) iki dolgu dosyasının arasında,
// 1 MB sınırının üstünde durur, zip'in merkezî dizininin sonu son dilimdedir. Bir dilim eksik, bozuk ya da yanlış sırada
// aktarılırsa content.xml'in CRC-32'si ya da zip dizini tutmaz, belge açılmaz.
export function buyukBelge(metin, boyut = 2 * MiB + 37) {
  const b = new Belge();
  const ogeler = [b.paragraf({ Alignment: 1 }, [[metin, { bold: true }]]), b.paragraf({}, [['Yapay sınama belgesi, iki dolgu dosyasıyla.']])];
  const icerik = Buffer.from(b.xml({ ogeler }), 'utf8');
  let x = 0x2545f491;
  const dolgu = n => {
    const d = Buffer.alloc(n);
    for (let i = 0; i < n; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; d[i] = x & 255; }
    return d;
  };
  const kur = (n1, n2) => udfZip([['dolgu-1.bin', dolgu(n1)], ['content.xml', icerik], ['dolgu-2.bin', dolgu(n2)]], { saklanmis: true });
  // content.xml'in verisi 1 MB sınırından 300 bayt önce başlar (yerel başlık 30 bayt ve ad).
  const n1 = MiB - 300 - (30 + 'dolgu-1.bin'.length) - (30 + 'content.xml'.length);
  const zip = kur(n1, boyut - kur(0, 0).length - n1);
  if (zip.length !== boyut || icerik.length <= 300) throw new Error('büyük belgenin boyutu tutmadı');
  return zip;
}
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n', 'latin1');

// Sahte konu: A iletisinde beş, B iletisinde iki, C iletisinde (konunun son iletisi) sekiz ek: Yedi küçük .udf ve 2 MB'tan
// büyük bir .udf. th iletinin kendi onaltılık kimliğidir (msg-f'nin onaltılığı), attid her iletide 0.1'den başlar.
function konuKur(dilekce) {
  const ornek = ad => fs.readFileSync(path.join(KOK, 'testler', 'ornekler', ad));
  const iletiler = [
    { harf: 'A', msg: '1797114040482588150', ekler: [
      { ad: 'Dilekce.udf', bayt: dilekce },
      { ad: 'Ek.pdf', tur: 'application/pdf', bayt: PDF, onizleme: 'pdf' },
      { ad: 'Aynı ad.udf', bayt: isaretliBelge(ISARET.ayni1) },
      { ad: 'Aynı ad.udf', bayt: isaretliBelge(ISARET.ayni2) },
      { ad: 'Yasak.udf', yasak: true }
    ] },
    { harf: 'B', msg: '1797114040482588327', ekler: [
      { ad: 'İkinci.udf', bayt: ornek('notlu-imzasiz.udf') },
      { ad: 'Dilekce.udf', bayt: isaretliBelge(ISARET.b) }
    ] },
    { harf: 'C', msg: '1797114040482588600', ekler: [
      ...[1, 2, 3, 4, 5, 6, 7].map(k => ({ ad: `Sıra ${k}.udf`, bayt: isaretliBelge(ISARET['c' + k]) })),
      { ad: 'Büyük.udf', bayt: buyukBelge(ISARET.buyuk) }
    ] }
  ];
  return iletileriHazirla(iletiler);
}

// İletilere Gmail'deki kimlikleri verir: th iletinin onaltılık kimliği, attid her iletide 0.1'den başlar. Sayfa listedeki ek
// düğmeleri için B iletisinde en az iki ek bekler (hız ölçümü kendi konusunu kurar).
export function iletileriHazirla(iletiler) {
  for (const i of iletiler) {
    i.th = BigInt(i.msg).toString(16);
    i.ekler.forEach((e, k) => Object.assign(e, { attid: `0.${k + 1}`, tur: e.tur || 'application/octet-stream', onizleme: e.onizleme || 'yok', anahtar: `${i.harf} 0.${k + 1}` }));
  }
  return iletiler;
}

// Sahte Gmail sayfasının betiği (sayfada çalışır, VERI sunucudan gelir).
function sayfaBetigi(VERI) {
  document.cookie = 'GMAIL_OTURUM=1; path=/; secure; samesite=lax';
  document.cookie = 'GMAIL_GENEL=1; domain=.google.com; path=/; secure; samesite=none';
  window.__acilislar = []; window.__kapatildi = 0; window.__gezinti = [];
  const el = (etiket, oz = {}, ...cocuklar) => {
    const e = document.createElement(etiket);
    for (const [k, v] of Object.entries(oz)) {
      if (v == null) continue;
      if (k === 'metin') e.textContent = v; else if (k === 'stil') e.style.cssText = v; else e.setAttribute(k, v);
    }
    e.append(...cocuklar);
    return e;
  };
  const sorgu = (ileti, e) => `ui=2&ik=${VERI.ik}&attid=${e.attid}&permmsgid=msg-f:${ileti.msg}&th=${ileti.th}&view=att&zw&disp=safe`;
  const posta = document.getElementById('posta');
  for (const ileti of VERI.iletiler) {
    const kartlar = el('div', { class: 'ekler' });
    for (const e of ileti.ekler) {
      const a = el('a', { target: '_blank', href: `https://mail.google.com/mail/u/1?${sorgu(ileti, e)}` }, el('span', { class: 'kart-ad', metin: e.ad }));
      kartlar.append(el('span', { class: 'kart', download_url: `${e.tur}:${encodeURIComponent(e.ad)}:https://mail.google.com/mail/u/1/https://mail.google.com/mail/u/1?${sorgu(ileti, e)}` }, a));
    }
    posta.append(el('div', { class: 'ileti', 'data-message-id': '#msg-f:' + ileti.msg, 'data-legacy-message-id': ileti.th },
      el('div', { class: 'gonderen', metin: `${ileti.harf} iletisi` }), el('p', { metin: 'Ekler ektedir.' }), kartlar));
  }

  let acik = null;
  const bilgi = el('div', { id: 'drive-active-item-info', stil: 'display:none' });
  function anaKur(e) {
    const ana = el('div', { role: VERI.yapisiz ? null : 'main', class: 'ana', stil: 'display:none' });
    if (e.onizleme === 'pdf') ana.append(el('div', { class: 'pdf-onizleme', metin: 'PDF sayfası 1' }));
    else ana.append(el('div', { class: 'onizleme-yok' }, el('div', { metin: 'Önizleme yok' }), el('div', { role: 'button', tabindex: '0', class: 'onizleme-indir', metin: 'İndir' })));
    return ana;
  }
  // Ana alanlar hep 0'dan sırayla eklenir. elleAna kipinde geçişte yalnız gösterilene dek, sonrakileri sınama ekletir.
  function anaEkle(n) {
    const ekler = acik.ileti.ekler;
    while (acik.analar.length < Math.min(ekler.length, n)) {
      const a = anaKur(ekler[acik.analar.length]);
      acik.sahne.append(a);
      acik.analar.push(a);
    }
  }
  window.__anaEkle = () => { if (acik) anaEkle(acik.sira + VERI.ileri + 1); return acik ? acik.analar.length : 0; };
  window.__yenidenCiz = () => {
    if (!acik) return 0;
    const ana = acik.analar[acik.sira];
    const kendi = [...ana.children].filter(c => c.id === 'drive-active-item-info' || c.classList.contains('onizleme-yok') || c.classList.contains('pdf-onizleme'));
    ana.replaceChildren(...kendi.map(c => (c.id ? c : c.cloneNode(true))));
    return 1;
  };
  function goster(sira) {
    const ekler = acik.ileti.ekler;
    anaEkle(sira + (VERI.elleAna ? 0 : VERI.ileri) + 1);
    acik.sira = sira;
    acik.analar.forEach((a, i) => { a.style.display = i === sira ? '' : 'none'; });
    const e = ekler[sira];
    bilgi.textContent = '{"id": "", "title": ' + JSON.stringify(e.ad) + ', "mimeType": ' + JSON.stringify(e.tur).replace(/\//g, '\\/') + '}';
    acik.analar[sira].prepend(bilgi);
    acik.ad.textContent = e.ad;
    acik.onceki.firstChild.style.visibility = sira === 0 ? 'hidden' : '';
    acik.sonraki.firstChild.style.visibility = sira === ekler.length - 1 ? 'hidden' : '';
  }
  function kapat() {
    if (!acik) return;
    acik.katman.remove();
    acik = null;
    window.__kapatildi++;
    if (location.hash.includes('?')) location.hash = location.hash.replace(/\?.*$/, '');
  }
  function git(yon) {
    if (!acik) return;
    const j = acik.sira + yon;
    if (j < 0 || j >= acik.ileti.ekler.length) return;
    window.__gezinti.push(acik.ileti.ekler[j].attid);
    goster(j);
  }
  function ac(ileti, sira) {
    if (acik) kapat();
    const kapatDugmesi = el('button', { 'aria-label': 'Kapat', stil: 'left:16px;top:16px;width:32px;height:32px', metin: '×' });
    kapatDugmesi.addEventListener('click', kapat);
    const ad = el('span', { class: 'ad', stil: 'left:64px;top:12px' });
    const cubuk1 = el('div', { class: 'cubuk1' }, kapatDugmesi, ad,
      el('button', { 'aria-label': 'Drive\'a ekle', stil: 'left:278px;top:10px;width:24px;height:24px' }),
      el('div', { role: 'menubar', 'aria-label': 'Menü çubuğu', stil: 'left:89px;top:34px;right:207px;height:24px' }, el('button', { metin: 'Dosya' }), el('button', { metin: 'Yardım' })),
      el('button', { 'aria-label': 'Yeni sekmede aç', stil: 'right:155px;top:12px;width:40px;height:40px' }),
      el('div', { role: 'button', tabindex: '0', stil: 'right:25px;top:14px;width:117px;height:36px', metin: 'Birlikte aç' }));
    const cubuk2 = el('div', { class: 'cubuk2' }, el('button', { 'aria-label': 'İndir', stil: 'left:24px;top:8px;width:32px;height:32px' }));
    const okDugmesi = yon => { const d = el('div', { role: 'button', tabindex: '0', class: 'ok-dugme' }); d.addEventListener('click', () => git(yon)); return d; };
    const onceki = el('div', { 'aria-label': 'Önceki', class: 'ok sol' }, okDugmesi(-1));
    const sonraki = el('div', { 'aria-label': 'Sonraki', class: 'ok sag' }, okDugmesi(1));
    const sahne = el('div', { class: 'sahne' }, onceki, sonraki, el('div'));
    const pencere = el('div', { role: 'dialog', class: 'pencere', tabindex: '-1' }, sahne);
    const katman = el('div', { class: 'katman', id: 'katman' }, el('span', {}, el('span', {}, el('div', {}, cubuk1, cubuk2), pencere)));
    document.body.append(katman);
    acik = { ileti, sira: -1, katman, sahne, ad, onceki, sonraki, analar: [] };
    goster(sira);
    location.hash = location.hash.replace(/\?.*$/, '') + '?projector=1&messagePartId=' + ileti.ekler[sira].attid;
    window.__acilislar.push(`${ileti.harf} ${ileti.ekler[sira].attid}`);
    pencere.focus();
  }
  // Gelen kutusu listesindeki ek düğmeleri gibi: Ek kartı değil, ön izlemeyi doğrudan açar.
  const liste = document.getElementById('liste');
  for (const c of VERI.cipler) {
    const ileti = VERI.iletiler.find(i => i.harf === c.harf);
    liste.append(el('div', { role: 'button', tabindex: '0', class: 'liste-eki', 'data-liste-eki': `${c.harf} ${c.sira}` }, el('span', { metin: ileti.ekler[c.sira].ad })));
  }
  // Gmail bağlantıya gitmez, ön izlemeyi açar.
  document.addEventListener('click', e => {
    const cip = e.target instanceof Element ? e.target.closest('[data-liste-eki]') : null;
    if (cip) {
      const [harf, sira] = cip.getAttribute('data-liste-eki').split(' ');
      ac(VERI.iletiler.find(i => i.harf === harf), Number(sira));
      return;
    }
    const kart = e.target instanceof Element ? e.target.closest('[download_url]') : null;
    if (!kart) return;
    e.preventDefault();
    const iletiOgesi = kart.closest('[data-message-id]');
    const ileti = VERI.iletiler.find(i => '#msg-f:' + i.msg === iletiOgesi.getAttribute('data-message-id'));
    ac(ileti, [...iletiOgesi.querySelectorAll('[download_url]')].indexOf(kart));
  });
  document.addEventListener('keydown', e => {
    if (!acik) return;
    if (e.key === 'Escape' || e.keyCode === 27) kapat();
    else if (e.key === 'ArrowRight' || e.keyCode === 39) git(1);
    else if (e.key === 'ArrowLeft' || e.keyCode === 37) git(-1);
  });
  // Ön izleme açıkken yenilenen sayfa: Gmail yüklenince ön izlemeyi tıklamasız, konunun son iletisindeki o ekte açar.
  const yenilenen = /\?projector=1&messagePartId=([\d.]+)$/.exec(location.hash);
  if (yenilenen) {
    setTimeout(() => {
      const ileti = VERI.iletiler[VERI.iletiler.length - 1];
      const sira = ileti.ekler.findIndex(e => e.attid === yenilenen[1]);
      if (!acik && sira >= 0) ac(ileti, sira);
    }, 400);
  }
}

const sayfaCss = `
  body { margin: 0; font: 14px Arial, sans-serif; background: #f6f8fc; color: #202124; }
  .posta { position: absolute; left: 200px; right: 16px; top: 64px; bottom: 16px; background: #fff; overflow: auto; padding: 16px; border-radius: 16px; }
  .ileti { border-top: 1px solid #e0e0e0; padding: 12px 0; }
  .ekler { display: flex; flex-wrap: wrap; gap: 8px; }
  .kart { display: inline-block; width: 170px; height: 40px; border: 1px solid #dadce0; border-radius: 4px; }
  .liste { position: absolute; left: 200px; right: 16px; top: 12px; height: 40px; display: flex; gap: 8px; align-items: center; }
  .liste-eki { height: 32px; line-height: 32px; padding: 0 12px; border: 1px solid #dadce0; border-radius: 16px; background: #fff; cursor: pointer; }
  .kart a { display: block; height: 100%; line-height: 40px; padding: 0 8px; color: #202124; text-decoration: none; overflow: hidden; white-space: nowrap; }
  .katman { position: fixed; inset: 0; z-index: 1204; background: rgba(0, 0, 0, .85); }
  .cubuk1 { position: relative; z-index: 11; height: 64px; pointer-events: none; color: #fff; }
  .cubuk2 { position: absolute; z-index: 11; left: 0; right: 0; top: 64px; height: 48px; pointer-events: none; }
  .cubuk1 > *, .cubuk2 > * { position: absolute; pointer-events: auto; }
  .cubuk1 [role=menubar] button { height: 24px; }
  .pencere { position: absolute; inset: 0; }
  .sahne { position: absolute; inset: 0; z-index: 0; }
  .ok { position: absolute; top: calc(50% - 45px); width: 48px; height: 90px; z-index: 5; }
  .ok.sol { left: 0; } .ok.sag { right: 0; }
  .ok-dugme { position: absolute; top: 25px; width: 40px; height: 40px; border-radius: 50%; background: #3c4043; cursor: pointer; }
  .ok.sol .ok-dugme { left: 28px; } .ok.sag .ok-dugme { right: 28px; }
  .ana { position: absolute; inset: 0; }
  .onizleme-yok { position: absolute; left: 50%; top: 50%; width: 300px; height: 212px; margin: -106px 0 0 -150px; background: #fff;
    border-radius: 8px; text-align: center; padding-top: 60px; box-sizing: border-box; }
  .onizleme-indir { display: inline-block; width: 91px; height: 40px; line-height: 40px; margin-top: 24px; background: #0b57d0; color: #fff; border-radius: 20px; }
  .pdf-onizleme { position: absolute; left: 50%; top: 128px; width: 400px; height: 560px; margin-left: -200px; background: #fff; }
`;

// secenek: yapisiz (ön izlemede role=main yok, "UDF olarak aç" yolu), ileri (ana alanların önden kurulduğu ek sayısı),
// elleAna (ana alanlar geçişte yalnız gösterilene dek, sonrakileri window.__anaEkle ekler). Listedeki ek düğmeleri B
// iletisinin Dilekce.udf'sini (A'da da aynı adlı ek var) ve İkinci.udf'sini (adı sayfada tek) açar.
function gmailSayfasi(iletiler, { yapisiz = false, ileri = 5, elleAna = false } = {}) {
  const veri = { ik: IK, yapisiz, ileri, elleAna, cipler: [{ harf: 'B', sira: 1 }, { harf: 'B', sira: 0 }],
    iletiler: iletiler.map(i => ({ harf: i.harf, msg: i.msg, th: i.th, ekler: i.ekler.map(({ ad, tur, attid, onizleme }) => ({ ad, tur, attid, onizleme })) })) };
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Deneme konusu - Gelen Kutusu - Gmail</title><style>${sayfaCss}</style></head><body>
<div role="navigation" style="position:absolute;left:0;top:64px;width:200px">Gelen Kutusu</div>
<div class="liste" id="liste" aria-label="Gelen kutusu listesi"></div>
<div role="main" class="posta" id="posta"><h2>Deneme konusu</h2></div>
<script>(${sayfaBetigi})(${JSON.stringify(veri).replace(/</g, '\\u003c')})</script></body></html>`;
}

// secenek.gecikme: Yalnız bir sonraki ek indirmesi bu kadar ms geç yanıtlanır (yükleme yazısı görülebilsin).
// secenek.corsHatasi: İmzalı adres yalnız bir sonraki yanıtında CORS izni vermez (eklentinin yeniden denemesi sınanır).
// secenek.gecici: Sıradaki bu kadar ek isteği (Gmail'in ilk adımı) 503 alır (görüntüleyicinin "Yeniden dene"si sınanır).
// secenek.yonlendirmeGecikmesi ve secenek.ekGecikmesi: Her ek isteğinde Gmail'in 302 yanıtı ve imzalı adresin baytları bu
// kadar ms geç gelir (hız ölçümü: Gerçek Gmail'de küçük bir ek, boyundan bağımsız, toplam ~500 ms'de iniyor).
// Her isteğin geliş zamanı (Date.now) kaydedilir.
export async function gmailSunucusu(iletiler, secenek = {}) {
  const istekler = [];
  const ekler = new Map(iletiler.flatMap(i => i.ekler.map(e => [`${i.th}|${e.attid}`, e])));
  const belirtecler = new Map();   // imzalı ek adresinin belirteci → ek
  const sunucu = https.createServer(sertifika([GMAIL, EKLER]), (q, y) => {
    const host = String(q.headers.host || '').replace(/:\d+$/, '');
    const u = new URL(q.url, `https://${host}`);
    const cerezler = String(q.headers.cookie || '').split(/;\s*/).map(c => c.split('=')[0]).filter(Boolean);
    const kayit = () => {
      const k = { host, yontem: q.method, sorgu: u.search, attid: u.searchParams.get('attid'), th: u.searchParams.get('th'), koken: q.headers.origin || '',
        site: q.headers['sec-fetch-site'] || '', kip: q.headers['sec-fetch-mode'] || '', cerezler, ek: null, zaman: Date.now() };
      istekler.push(k);
      return k;
    };
    if (host === EKLER) {
      const k = kayit();
      const ek = belirtecler.get(u.searchParams.get('sadsig') || '');
      if (ek) k.ek = ek.anahtar;
      if (q.method !== 'GET' || !u.pathname.startsWith('/attachment/u/1/') || !ek) { y.writeHead(404); return y.end(); }
      const baslik = { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(ek.ad)}` };
      if (secenek.corsHatasi) secenek.corsHatasi = false;
      else if (q.headers.origin === 'https://mail.google.com') Object.assign(baslik, { 'access-control-allow-origin': 'https://mail.google.com', 'access-control-allow-credentials': 'true' });
      const gonder = () => { y.writeHead(200, baslik); y.end(ek.bayt); };
      if (secenek.ekGecikmesi) { setTimeout(gonder, secenek.ekGecikmesi); return; }
      return gonder();
    }
    if (host !== GMAIL) { y.writeHead(404); return y.end(); }
    if (u.pathname === '/mail/u/1' && u.searchParams.get('view') === 'att') {
      const k = kayit();
      const ek = ekler.get(`${k.th}|${k.attid}`);
      if (ek) k.ek = ek.anahtar;
      // Oturum çerezi yoksa Gmail giriş sayfasına yönlenir (sahte giriş sayfası HTML döndürür).
      if (!cerezler.includes('GMAIL_OTURUM')) { y.writeHead(302, { location: '/accounts/ServiceLogin' }); return y.end(); }
      if (!ek) { y.writeHead(404, { 'content-type': 'text/html' }); return y.end('<html>Yok</html>'); }
      if (ek.yasak) { y.writeHead(403, { 'content-type': 'text/html; charset=utf-8' }); return y.end('<html>Yasak</html>'); }
      if (secenek.gecici > 0) { secenek.gecici--; y.writeHead(503, { 'content-type': 'text/html; charset=utf-8' }); return y.end('<html>Geçici hata</html>'); }
      const belirtec = crypto.randomBytes(16).toString('hex');
      belirtecler.set(belirtec, ek);
      const yonlendir = () => {
        y.writeHead(302, { location: `https://${EKLER}/attachment/u/1/?ui=2&ik=${IK}&attid=${k.attid}&th=${k.th}&view=att&disp=safe&sadsig=${belirtec}` });
        y.end();
      };
      if (secenek.gecikme) { const ms = secenek.gecikme; secenek.gecikme = 0; setTimeout(yonlendir, ms); return; }
      if (secenek.yonlendirmeGecikmesi) { setTimeout(yonlendir, secenek.yonlendirmeGecikmesi); return; }
      return yonlendir();
    }
    if (u.pathname === '/accounts/ServiceLogin') { y.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return y.end('<html>Oturum açın (ServiceLogin)</html>'); }
    if (u.pathname === '/mail/u/1/') {
      y.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return y.end(gmailSayfasi(iletiler, { yapisiz: u.searchParams.has('yapisiz'), elleAna: u.searchParams.has('elleAna'),
        ileri: Number(u.searchParams.get('ileri')) || undefined }));
    }
    y.writeHead(404);
    y.end();
  });
  await new Promise(r => sunucu.listen(0, '127.0.0.1', r));
  return { sunucu, istekler, port: sunucu.address().port };
}

// Bir sınama oturumu: Chrome, eklenti, Gmail sekmesi ve yardımcılar. eklenti: Yüklenecek eklenti klasörü (hız ölçümü
// karşılaştırma için başka bir kopyayı da yükleyebilir).
export async function oturumKur({ port, ekler = [], ekEklentiler = [], eklenti: klasor = KOK }) {
  const c = await chromeBaslat({ ekler: [`--host-resolver-rules=MAP ${GMAIL} 127.0.0.1:${port},MAP ${EKLER} 127.0.0.1:${port}`,
    '--ignore-certificate-errors', '--window-size=958,910', ...ekler] });
  const hatalar = [];
  c.dinle(m => {
    if (m.method === 'Runtime.exceptionThrown') hatalar.push('istisna: ' + String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') hatalar.push('konsol: ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 300));
  });
  // Sekmelerin çalıştırma bağlamları: İçerik betiğinin yalıtılmış dünyasına ifade göndermek için.
  const baglamlar = new Map();   // sessionId → bağlamlar
  c.dinle(m => {
    if (m.method !== 'Runtime.executionContextCreated' || !m.sessionId) return;
    if (!baglamlar.has(m.sessionId)) baglamlar.set(m.sessionId, []);
    baglamlar.get(m.sessionId).push(m.params.context);
  });
  const { id: eklenti } = await c.gonder('Extensions.loadUnpacked', { path: klasor });
  for (const yol of ekEklentiler) await c.gonder('Extensions.loadUnpacked', { path: yol });
  await c.gonder('Target.setDiscoverTargets', { discover: true });
  const deger = async (g, ifade) => (await g('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression: ifade })).result.value;
  // hashEki: Ör. "?projector=1&messagePartId=0.1" (sayfa ön izleme açıkken yenilenmiş gibi yüklenir).
  const gmailAc = async (sorgu = '', hashEki = '') => {
    const s = await sekmeAc(c, `https://${GMAIL}/mail/u/1/${sorgu}#inbox/FMfcgzQDenemeKonusu${hashEki}`);
    for (const a of ['Runtime.enable', 'Page.enable']) await s.g(a);
    await ifadeBekle(s.g, "document.readyState === 'complete' && !!document.querySelector('[download_url]')");
    await bekle(800);
    return s;
  };
  const baglan = async targetId => {
    const { sessionId } = await c.gonder('Target.attachToTarget', { targetId, flatten: true });
    const g = (m, p) => c.gonder(m, p, sessionId);
    await g('Runtime.enable');
    return g;
  };
  // Öğenin ortasına gerçek fare tıklaması. oge: Öğeyi veren ifade.
  const ogeTikla = async (g, oge) => {
    const { x, y } = await deger(g, `(() => { const k = ${oge}; k.scrollIntoView({ block: 'center' }); const r = k.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await g('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
  };
  // İletideki ek kartına tıklama (tıklama kartın bağlantısının içine düşer). İletiler sayfada A, B, C sırasıyla.
  const ekAc = (g, harf, sira) => ogeTikla(g, `document.querySelectorAll('[data-message-id]')[${'ABC'.indexOf(harf)}].querySelectorAll('[download_url]')[${sira}]`);
  // Listedeki ek düğmesine tıklama: Ön izleme kartsız açılır.
  const listedenAc = (g, harf, sira) => ogeTikla(g, `document.querySelector('[data-liste-eki="${harf} ${sira}"]')`);
  // İçerik betiğinin yalıtılmış dünyası (sekmenin ana çerçevesinde, eklentinin adıyla) ya da null.
  const icerikBaglami = s => {
    const b = (baglamlar.get(s.sessionId) || []).filter(x => x.auxData && x.auxData.type === 'isolated' && x.auxData.frameId === s.targetId &&
      (x.name === 'UDF Ön İzleme' || String(x.origin).startsWith(`chrome-extension://${eklenti}`)));
    return b.length ? b[b.length - 1].id : null;
  };
  const TUS = { Escape: [27, 'Escape'], ArrowRight: [39, 'ArrowRight'], ArrowLeft: [37, 'ArrowLeft'], p: [80, 'KeyP'] };
  const tus = async (g, ad, modifiers = 0) => {
    const [kod, code] = TUS[ad];
    await g('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: ad, code, windowsVirtualKeyCode: kod, modifiers });
    await g('Input.dispatchKeyEvent', { type: 'keyUp', key: ad, code, windowsVirtualKeyCode: kod, modifiers });
  };
  // Sayfadaki gömülü çerçevenin hedefi (ayrı süreç, tür iframe). Çerçevenin adresindeki anahtarla eşlenir: Eski
  // çerçevenin hedefi bir süre listede kalabilir. haric: Öbür eke geçerken henüz kalkmamış olabilecek eski çerçevenin anahtarı.
  async function cerceveBul(g, { sure = 10000, haric = null } = {}) {
    const bas = Date.now();
    for (;;) {
      const anahtar = await deger(g, CERCEVE_ANAHTARI);
      if (anahtar && anahtar !== haric) {
        const h = (await c.gonder('Target.getTargets')).targetInfos.find(t => t.type === 'iframe' && t.url.includes(`/gomulu.html#t=${anahtar}`));
        if (h) return { hedef: h, g: await baglan(h.targetId), anahtar };
      }
      if (Date.now() - bas > sure) return null;
      await bekle(150);
    }
  }
  const belgeDurumu = g => ifadeBekle(g, `(() => { const h = document.querySelector('.durum.hata'); if (h) return 'HATA: ' + h.querySelector('h2').textContent;
    if (!document.querySelector('.udf-sayfa')) return ''; const m = document.querySelector('.udf').textContent;
    return 'BELGE: ' + (${JSON.stringify(Object.values(ISARET))}.filter(i => m.includes(i)).join(' + ') || 'işaret yok'); })()`, 15000)
    .catch(async () => 'zaman aşımı: ' + await deger(g, "document.readyState + ' · ' + (document.querySelector('.durum') ? document.querySelector('.durum').innerText.replace(/\\s+/g, ' ').slice(0, 120) : '')").catch(e => String(e)));
  // Gömme denetimi: Çerçeve gösterilen ekin ana alanında mı, üst çubuğun altında mı, Gmail'in kartı gizli mi, ok üstte mi.
  const gommeDurumu = g => deger(g, `(() => {
    const bilgi = document.getElementById('drive-active-item-info');
    const ana = bilgi && bilgi.closest('[role=main]');
    const sayi = ${CERCEVELER}.length;
    const isaretli = document.querySelectorAll('[data-udf-okuyucu-gomulu]').length;
    const ad = bilgi ? JSON.parse(bilgi.textContent).title : null;
    const sira = ana ? [...ana.parentElement.children].filter(x => x.getAttribute('role') === 'main').indexOf(ana) : -1;
    const anaSayisi = ana ? ana.parentElement.querySelectorAll(':scope > [role=main]').length : 0;
    const kart = ana && ana.querySelector('.onizleme-yok, .pdf-onizleme');
    const kartGorunur = !!kart && !!kart.offsetParent && getComputedStyle(kart).visibility === 'visible';
    const c = ana && ((ana.shadowRoot && ana.shadowRoot.querySelector('iframe.udf-okuyucu-cerceve')) || ana.querySelector(':scope > iframe.udf-okuyucu-cerceve'));
    const temel = { ad, sira, anaSayisi, sayi, isaretli, kartGorunur, adres: location.hash.replace(/^#[^?]*/, '') };
    if (!c) return { var: false, ...temel };
    const r = c.getBoundingClientRect(), ar = ana.getBoundingClientRect();
    const ok = document.querySelector('[aria-label="Sonraki"] [role=button]'), okR = ok.getBoundingClientRect();
    const okUstte = okR.width ? document.elementFromPoint(okR.left + okR.width / 2, okR.top + okR.height / 2) === ok : null;
    return { var: true, ...temel, ust: Math.round(r.top - ar.top), alt: Math.round(ar.bottom - r.bottom), en: Math.round(r.width), anaEn: Math.round(ar.width),
      okUstte, odak: c.getRootNode().activeElement === c, golgede: !!ana.shadowRoot && ana.shadowRoot.contains(c) };
  })()`);
  const acik = g => deger(g, "!!document.getElementById('drive-active-item-info')");
  return { c, eklenti, hatalar, deger, gmailAc, baglan, ekAc, listedenAc, icerikBaglami, tus, cerceveBul, belgeDurumu, gommeDurumu, acik };
}

export async function gmailSina(udfYolu, ekranYolu) {
  const iletiler = konuKur(fs.readFileSync(udfYolu || path.join(KOK, 'testler', 'ornekler', 'dilekce.udf')));
  const [A, B] = iletiler;
  const sonuclar = [];
  const sonuc = (ad, tamam, ayrinti = '') => { sonuclar.push({ ad, tamam }); console.log(`${tamam ? 'TAMAM' : 'SORUN'} ${ad}${ayrinti ? ' · ' + ayrinti : ''}`); };
  // Ek isteklerinin özeti: Birinci adım (mail.google.com) ve imzalı adres (mail-attachment.googleusercontent.com).
  const ekIstekleri = (istekler, ek) => ({
    gmail: istekler.filter(i => i.host === GMAIL && i.ek === ek),
    imzali: istekler.filter(i => i.host === EKLER && i.ek === ek)
  });
  const birinciTarafMi = ({ gmail, imzali }) => gmail.length > 0 && imzali.length > 0 &&
    gmail.every(i => i.site === 'same-origin' && i.kip === 'cors' && (!i.koken || i.koken === 'https://mail.google.com') && i.cerezler.includes('GMAIL_OTURUM')) &&
    imzali.every(i => i.koken === 'https://mail.google.com');
  const istekOzeti = ({ gmail, imzali }) => JSON.stringify({ gmail: gmail.map(i => ({ site: i.site, kip: i.kip, koken: i.koken, cerez: i.cerezler.join(',') })), imzali: imzali.map(i => ({ site: i.site, koken: i.koken })) });

  // ================================================================ 1. oturum: Varsayılan ayarlar
  const sunucuAyari = { gecikme: 2000 };
  const { sunucu, istekler, port } = await gmailSunucusu(iletiler, sunucuAyari);
  const o = await oturumKur({ port });
  const { c, eklenti, hatalar, deger, gmailAc, baglan, ekAc, listedenAc, icerikBaglami, tus, cerceveBul, belgeDurumu, gommeDurumu, acik } = o;
  const cspIhlalleri = await cspIzle(c, eklenti);
  // Açık ön izlemeyi kapatır (Esc, olmazsa Gmail'in Kapat düğmesi) ve içerik betiğinin bunu görmesini bekler (gözlemci 150 ms).
  const onizlemeyiKapat = async g => {
    await tus(g, 'Escape');
    await ifadeBekle(g, "!document.getElementById('drive-active-item-info')", 3000).catch(() => {});
    if (await acik(g)) await deger(g, "document.querySelector('[aria-label=Kapat]').click(), 1");
    await bekle(400);
  };
  // Listedeki ek düğmesiyle (kartsız) açılan ön izleme: Belge gömülmemeli, Gmail'in "Önizleme yok" kartı görünmeli, ek
  // istenmemeli. Ön izleme sonra kapatılır.
  const kartsizAc = async (g, harf, sira) => {
    const onceki = istekler.length;
    await listedenAc(g, harf, sira);
    await ifadeBekle(g, "!!document.getElementById('drive-active-item-info')", 3000).catch(() => {});
    await bekle(1500);
    const gom = await gommeDurumu(g);
    const yeni = istekler.length - onceki;
    const e = iletiler.find(i => i.harf === harf).ekler[sira];
    await onizlemeyiKapat(g);
    return { tamam: gom.ad === e.ad && gom.sira === sira && !gom.var && gom.sayi === 0 && gom.isaretli === 0 && gom.kartGorunur && yeni === 0,
      ayrinti: `${harf} ${e.ad}: ${JSON.stringify({ var: gom.var, ad: gom.ad, sira: gom.sira, sayi: gom.sayi, kartGorunur: gom.kartGorunur })}, ${yeni} ek isteği` };
  };
  try {
    console.log('— Gmail’in ek ön izlemesinde görünüm');
    const s = await gmailAc();
    const ilkBaslik = await deger(s.g, 'document.title');
    await deger(s.g, "window.__basliklar = []; new MutationObserver(() => window.__basliklar.push(document.title)).observe(document.querySelector('title'), { childList: true, characterData: true, subtree: true }); 1");

    // G1. A iletisindeki Dilekce.udf: Belge Gmail'in ön izlemesinde, gösterilen ekin ana alanına gömülür. Çerçevenin sayfaya
    // eklendiği an kaydedilir: Ek, kart basılınca, çerçeve daha yokken indirilmeye başlamalı.
    await deger(s.g, `window.__cerceveEklendi = 0; (() => {
      const bak = () => { if (!window.__cerceveEklendi && ${CERCEVE}) window.__cerceveEklendi = Date.now(); };
      const gozlenen = new WeakSet(), g = new MutationObserver(() => {
        for (const a of document.querySelectorAll('[data-udf-okuyucu-gomulu]')) if (a.shadowRoot && !gozlenen.has(a.shadowRoot)) { gozlenen.add(a.shadowRoot); g.observe(a.shadowRoot, { childList: true }); }
        bak();
      });
      g.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-udf-okuyucu-gomulu'] });
    })(); 1`);
    await ekAc(s.g, 'A', 0);
    let f = await cerceveBul(s.g);
    const yukleme = f ? await ifadeBekle(f.g, "(() => { const d = document.querySelector('.durum.yukleniyor'); return d && { baslik: d.querySelector('h2').textContent, ad: (d.querySelector('p') || {}).textContent || '' }; })()", 1500).catch(() => null) : null;
    sonuc(`yüklenirken "${ACILIYOR}" yazar`, !!yukleme && yukleme.baslik === ACILIYOR && yukleme.ad === 'Dilekce.udf', JSON.stringify(yukleme));
    let durum = f ? await belgeDurumu(f.g) : 'çerçeve yok';
    let gom = await gommeDurumu(s.g);
    sonuc('ek kartına tıklama → Gmail’in ön izlemesinde belge', durum === `BELGE: ${ISARET.dilekce}` && gom.var && gom.ad === 'Dilekce.udf' && gom.sira === 0 &&
      /^\?projector=1&messagePartId=0\.1$/.test(gom.adres), `${durum} · ${JSON.stringify({ ad: gom.ad, sira: gom.sira, anaSayisi: gom.anaSayisi, adres: gom.adres })}`);
    sonuc('gömme yeri: Ana alanın gölge kökünde, çubuğun altında (104 + 8 px), alta dek, Gmail’in "Önizleme yok" kartı gizli, ok üstte', gom.var && gom.golgede && gom.ust === 112 && gom.alt === 0 &&
      gom.en === gom.anaEn && !gom.kartGorunur && gom.okUstte && gom.sayi === 1 && gom.isaretli === 1, JSON.stringify(gom));
    if (ekranYolu && f) {
      await ifadeBekle(f.g, "[...document.querySelectorAll('.udf-resim img')].every(x => x.complete)", 5000).catch(() => {});
      fs.writeFileSync(ekranYolu, Buffer.from((await s.g('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
      console.log('ekran görüntüsü:', ekranYolu);
    }
    const adres = f ? f.hedef.url : '';
    const src = await deger(s.g, `(${CERCEVE} || {}).src || ''`);
    sonuc('çerçeve adresi "#t=<anahtar>&u=g", dosya adı yok', /\/gomulu\.html#t=[0-9a-f-]{36}&u=g$/.test(adres) && /#t=[0-9a-f-]{36}&u=g$/.test(src) && !/Dilekce|udf$/i.test(adres + src),
      adres.replace(/#t=[0-9a-f-]+/, '#t=…'));
    const ilk = ekIstekleri(istekler, 'A 0.1');
    sonuc('ek Gmail sekmesinden birinci taraf olarak indirilir (aynı köken, çerezli), imzalı adrese Gmail kökeniyle', birinciTarafMi(ilk), istekOzeti(ilk));
    {
      const eklendi = await deger(s.g, 'window.__cerceveEklendi');
      sonuc('ek kart basılınca, çerçeve eklenmeden indirilmeye başlar ve açılışta bir kez istenir', ilk.gmail.length === 1 && ilk.imzali.length === 1 &&
        eklendi > 0 && ilk.gmail[0].zaman < eklendi, `${ilk.gmail.length} + ${ilk.imzali.length} istek · istek çerçeveden ${eklendi - (ilk.gmail[0] ? ilk.gmail[0].zaman : 0)} ms önce`);
    }
    // El sıkışma: Çerçeve "hazir"ı mail.google.com kökenine gönderir, içerik betiği okun şeridini (sag-bosluk) bildirir.
    const sagBosluk = f ? await deger(f.g, "getComputedStyle(document.documentElement).getPropertyValue('--sag-bosluk').trim()") : '';
    const ek = f ? await deger(f.g, "({ notlar: !document.getElementById('notlar-paneli').hidden, drive: !document.getElementById('dugme-drive').hidden, odak: document.activeElement === document.getElementById('alan') })") : null;
    sonuc('çerçeve ile Gmail sayfası arasında iletiler (sağdaki okun şeridi bildirildi), odak belgede', sagBosluk === '84px' && gom.odak && !!ek && !ek.drive,
      `--sag-bosluk: ${sagBosluk || '(yok)'} · ${JSON.stringify(ek)} · çerçeve odakta: ${gom.odak}`);

    // G1c. Gmail ana alanı yeniden çizer (kendi koymadığı çocukları siler): Belge yerinde kalır, ek yeniden istenmez, Gmail'in
    // yeni "Önizleme yok" kartı da gizlenir.
    if (f) {
      await deger(f.g, 'window.__ayniBelge = 1; 1');
      const once = ekIstekleri(istekler, 'A 0.1').gmail.length;
      await deger(s.g, 'window.__yenidenCiz()');
      await bekle(800);
      const sonra = await gommeDurumu(s.g);
      const ayni = await deger(f.g, 'window.__ayniBelge === 1').catch(() => false);
      const yeni = ekIstekleri(istekler, 'A 0.1').gmail.length - once;
      sonuc('Gmail yeniden çizince belge yerinde kalır (yeniden yüklenmez), "Önizleme yok" kartı gizli', ayni === true && sonra.var && sonra.golgede && sonra.sayi === 1 &&
        !sonra.kartGorunur && yeni === 0, `aynı belge: ${ayni} · ${yeni} yeni istek · ${JSON.stringify(sonra)}`);
    }

    // G2. Çerçevenin içinden oklar: Sağ ok Ek.pdf'e geçer (çerçeve kalkar, Gmail'in ön izlemesi görünür). İki sağ ok daha
    // aynı adlı iki eke geçer, her biri kendi içeriğini gösterir (ana alanın sırası ek sırasıdır).
    await ifadeBekle(s.g, `${CERCEVE_ODAKTA}`, 3000).catch(() => {});
    await tus(s.g, 'ArrowRight');
    await bekle(700);
    gom = await gommeDurumu(s.g);
    sonuc('sağ ok (belgede) → Ek.pdf, çerçeve kalkar, Gmail’in ön izlemesi görünür, adres değişmez', gom.ad === 'Ek.pdf' && gom.sira === 1 && !gom.var &&
      gom.sayi === 0 && gom.isaretli === 0 && gom.kartGorunur && gom.adres === '?projector=1&messagePartId=0.1', JSON.stringify(gom));
    await tus(s.g, 'ArrowRight');
    f = await cerceveBul(s.g);
    const ayni1 = f ? await belgeDurumu(f.g) : 'çerçeve yok';
    const gom1 = await gommeDurumu(s.g);
    await ifadeBekle(s.g, `${CERCEVE_ODAKTA}`, 3000).catch(() => {});
    await tus(s.g, 'ArrowRight');
    f = await cerceveBul(s.g, { haric: f && f.anahtar });
    const ayni2 = f ? await belgeDurumu(f.g) : 'çerçeve yok';
    const gom2 = await gommeDurumu(s.g);
    const aynilar = ['A 0.3', 'A 0.4'].map(a => ekIstekleri(istekler, a));
    sonuc('aynı adlı iki ek: Her biri kendi içeriği (sıra 2 ve 3)', ayni1 === `BELGE: ${ISARET.ayni1}` && ayni2 === `BELGE: ${ISARET.ayni2}` &&
      gom1.sira === 2 && gom2.sira === 3 && gom1.var && gom2.var && gom2.sayi === 1 && gom2.isaretli === 1 && aynilar.every(birinciTarafMi),
      `${ayni1} (sıra ${gom1.sira}) → ${ayni2} (sıra ${gom2.sira}) · gezinti: ${JSON.stringify(await deger(s.g, 'window.__gezinti'))}`);

    // G3. Esc çerçevenin içinde: Gmail'in ön izlemesi kapanır, adresten "?projector…" kalkar, çerçeve kalkar.
    await ifadeBekle(s.g, `${CERCEVE_ODAKTA}`, 3000).catch(() => {});
    const kapatildi = await deger(s.g, 'window.__kapatildi');
    await tus(s.g, 'Escape');
    await bekle(600);
    gom = await gommeDurumu(s.g);
    const hash = await deger(s.g, 'location.hash');
    sonuc('Esc (belgede) → Gmail’in ön izlemesi kapanır', (await deger(s.g, 'window.__kapatildi')) === kapatildi + 1 && !(await acik(s.g)) && gom.sayi === 0 &&
      gom.isaretli === 0 && !hash.includes('?'), `${hash} · ${JSON.stringify(gom)}`);

    // G4. İzin yok (403): Gmail'e özgü hata, Drive'dan söz edilmez.
    await ekAc(s.g, 'A', 4);
    f = await cerceveBul(s.g);
    durum = f ? await belgeDurumu(f.g) : 'çerçeve yok';
    const hataMetni = f ? await deger(f.g, 'document.body.innerText.replace(/\\s+/g, " ")') : '';
    sonuc('403 → "Eki indirme izniniz yok", Drive’dan söz edilmez', durum === 'HATA: Eki indirme izniniz yok' && !/Drive/i.test(hataMetni) &&
      ekIstekleri(istekler, 'A 0.5').gmail.length > 0, `${durum} · ${hataMetni.slice(0, 160)}`);
    await tus(s.g, 'Escape');
    await bekle(500);
    if (await acik(s.g)) { await deger(s.g, "document.querySelector('[aria-label=Kapat]').click(), 1"); await bekle(300); }

    // G5. B iletisindeki Dilekce.udf (A'dakiyle aynı ad): B'nin eki gösterilir.
    await ekAc(s.g, 'B', 1);
    f = await cerceveBul(s.g);
    durum = f ? await belgeDurumu(f.g) : 'çerçeve yok';
    gom = await gommeDurumu(s.g);
    const bIstek = ekIstekleri(istekler, 'B 0.2');
    sonuc('B iletisindeki aynı adlı ek: B’nin içeriği', durum === `BELGE: ${ISARET.b}` && gom.var && gom.sira === 1 && gom.anaSayisi === 2 && birinciTarafMi(bIstek) &&
      bIstek.gmail.length === 1,
      `${durum} · ${JSON.stringify({ sira: gom.sira, anaSayisi: gom.anaSayisi })} · ${istekOzeti(bIstek)}`);

    // G6. Ctrl+P: Belge (çerçeve) yazdırılır, Gmail sekmesinin başlığı değişmez. Önce odak belgede, sonra Gmail'in
    // çubuğunda (içerik betiği çerçeveye iletir: Çerçevenin Gmail kökenini tanıması gerekir).
    if (f) {
      await ifadeBekle(s.g, `${CERCEVE_ODAKTA}`, 3000).catch(() => {});
      await deger(f.g, 'window.__basim = 0; window.print = () => { window.__basim++; window.__basimZamani = Date.now(); window.__basimBasligi = document.title; }; 1');
      const basladi = Date.now();
      await tus(s.g, 'p', 2);
      await ifadeBekle(f.g, 'window.__basim === 1', 6000).catch(() => {});
      const gecikme = (await deger(f.g, 'window.__basimZamani || 0')) - basladi;
      await deger(s.g, "(() => { const a = document.querySelector('#katman .ad'); a.tabIndex = -1; a.focus(); return 1; })()");
      await tus(s.g, 'p', 2);
      await ifadeBekle(f.g, 'window.__basim === 2', 4000).catch(() => {});
      await bekle(300);
      const basim = await deger(f.g, 'window.__basim');
      const basliklar = await deger(s.g, 'window.__basliklar');
      const cerceveBasligi = await deger(f.g, 'window.__basimBasligi');
      sonuc('Ctrl+P (belgede ve Gmail’in çubuğunda): Belge yazdırılır, Gmail sekmesinin başlığı değişmez', basim === 2 && gecikme < 1500 && basliklar.length === 0 &&
        (await deger(s.g, 'document.title')) === ilkBaslik && cerceveBasligi === 'Dilekce',
        `baskı: ${basim} · ${gecikme} ms · Gmail başlık değişikliği: ${JSON.stringify(basliklar)} · çerçeve başlığı: ${cerceveBasligi}`);
      // G6b. Alttaki "Yazdır / PDF" düğmesi de belgeyi hemen yazdırır (Drive'daki gibi). Baskı görünümünde yalnız belge
      // basılır: Alttaki çubuk ve not bölmesi baskıya girmez, belgenin alt boşluğu kalkar.
      const dugmeyle = Date.now();
      await deger(f.g, "document.getElementById('dugme-yazdir').click(), 1");
      await ifadeBekle(f.g, 'window.__basim === 3', 4000).catch(() => {});
      const dugmeGecikmesi = (await deger(f.g, 'window.__basimZamani || 0')) - dugmeyle;
      await f.g('Emulation.setEmulatedMedia', { media: 'print' }).catch(() => {});
      const baski = await deger(f.g, "({ cubuk: getComputedStyle(document.querySelector('.cubuk')).display, panel: getComputedStyle(document.getElementById('notlar-paneli')).display, dolgu: getComputedStyle(document.querySelector('.udf')).paddingBottom, sayfa: document.querySelectorAll('.udf-sayfa').length })");
      await f.g('Emulation.setEmulatedMedia', { media: '' }).catch(() => {});
      sonuc('"Yazdır / PDF" düğmesi belgeyi hemen yazdırır, baskıda yalnız belge (çubuk ve not bölmesi yok)', (await deger(f.g, 'window.__basim')) === 3 && dugmeGecikmesi < 1500 &&
        baski.cubuk === 'none' && baski.panel === 'none' && baski.dolgu === '0px' && baski.sayfa > 0, `${dugmeGecikmesi} ms · ${JSON.stringify(baski)}`);
    } else sonuc('Ctrl+P (belgede ve Gmail’in çubuğunda): Belge yazdırılır, Gmail sekmesinin başlığı değişmez', false, 'çerçeve yok');
    await tus(s.g, 'Escape');
    await bekle(500);
    if (await acik(s.g)) { await deger(s.g, "document.querySelector('[aria-label=Kapat]').click(), 1"); await bekle(300); }

    // G9. Not bölmesi Gmail'in sağdaki okunun solunda kalır (oka basılırsa öbür eke geçilir): Ölçülen pencere (958×910)
    // ve 1280×900. Bölme dar pencerede daralır: 958 px'te 240, 1280 px'te 320 px.
    await ekAc(s.g, 'B', 0);
    f = await cerceveBul(s.g);
    durum = f ? await belgeDurumu(f.g) : 'çerçeve yok';
    const yerlesim = async () => {
      const ic = await deger(f.g, "(() => { const p = document.getElementById('notlar-paneli'); const r = p.getBoundingClientRect(); return { acik: !p.hidden, sag: Math.round(r.right), panelEn: Math.round(r.width) }; })()");
      const dis = await deger(s.g, `(() => { const c = ${CERCEVE}.getBoundingClientRect(), o = document.querySelector('[aria-label=\"Sonraki\"]'); return { cerceve: Math.round(c.left), dugme: Math.round(o.firstChild.getBoundingClientRect().left), kutu: Math.round(o.getBoundingClientRect().left), en: innerWidth }; })()`);
      return { ...ic, ...dis };
    };
    const olculer = [];
    if (f) {
      await bekle(500);
      olculer.push(await yerlesim());
      await s.g('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      await bekle(700);
      olculer.push(await yerlesim());
      await s.g('Emulation.clearDeviceMetricsOverride');
      await bekle(500);
    }
    sonuc('not bölmesi Gmail’in sağdaki okunun solunda, dar pencerede daralır (958 px: 240, 1280 px: 320)', /^BELGE: /.test(durum) && olculer.length === 2 &&
      olculer.every(x => x.acik && x.cerceve + x.sag <= x.dugme && x.cerceve + x.sag <= x.kutu) && olculer[0].panelEn === 240 && olculer[1].panelEn === 320,
      `${durum} · ${JSON.stringify(olculer)}`);
    await tus(s.g, 'Escape');
    await bekle(500);
    if (await acik(s.g)) { await deger(s.g, "document.querySelector('[aria-label=Kapat]').click(), 1"); await bekle(300); }

    // G7. Ekin ilk isteği geçici hata alır (503, kart basılınca başlayan ön indirme): Görüntüleyici hatayı gösterir, "Yeniden
    // dene" kendi belleğindeki kayıtla (ek bilgisi ve Gmail sekmesi) eki yeniden ister, belge açılır.
    {
      sunucuAyari.gecici = 1;
      const once = istekler.length;
      await ekAc(s.g, 'A', 0);
      f = await cerceveBul(s.g);
      const hata = f ? await belgeDurumu(f.g) : 'çerçeve yok';
      if (f) await deger(f.g, "[...document.querySelectorAll('.durum-dugmeler button')].find(b => b.textContent === 'Yeniden dene').click(), 1").catch(() => {});
      durum = f ? await belgeDurumu(f.g) : 'çerçeve yok';
      const yeni = ekIstekleri(istekler.slice(once), 'A 0.1');
      sonuc('gömülü görünümde "Yeniden dene" eki Gmail sekmesinden yeniden indirir', hata === 'HATA: Gmail şu an yanıt vermiyor' && durum === `BELGE: ${ISARET.dilekce}` &&
        yeni.gmail.length === 2 && sunucuAyari.gecici === 0 && birinciTarafMi(yeni), `${hata} → ${durum} · ${istekOzeti(yeni)}`);
      sunucuAyari.gecici = 0;
      await tus(s.g, 'Escape');
      await bekle(500);
      if (await acik(s.g)) { await deger(s.g, "document.querySelector('[aria-label=Kapat]').click(), 1"); await bekle(300); }
    }

    // G8. Ön izlemenin yapısı tanınmazsa (role=main yok) "UDF olarak aç" düğmesi çıkar (kapalı gölge kök), belge yeni
    // sekmede açılır. Görüntüleyici eki arka plan aracılığıyla Gmail sekmesinden alır.
    console.log('— Yapı tanınmazsa');
    {
      const y = await gmailAc('?yapisiz=1');
      await y.g('DOM.enable');
      const onceki = istekler.length;
      // Ekin ilk isteği (kart basılınca başlayan ön indirme) geçici hata alır: Sekmedeki "Yeniden dene" eki yeniden ister.
      sunucuAyari.gecici = 1;
      await ekAc(y.g, 'A', 0);
      await bekle(1200);
      const dugmeYeri = async () => {
        const { root } = await y.g('DOM.getDocument', { depth: -1, pierce: true });
        let bulunan = null;
        const gez = d => {
          if (bulunan) return;
          if (d.nodeName === 'BUTTON' && (d.children || []).some(k => k.nodeName === 'SPAN' && (k.children || []).some(t => t.nodeValue === 'UDF olarak aç'))) bulunan = d;
          for (const k of [...(d.children || []), ...(d.shadowRoots || [])]) gez(k);
        };
        gez(root);
        if (!bulunan) return null;
        const { model } = await y.g('DOM.getBoxModel', { backendNodeId: bulunan.backendNodeId }).catch(() => ({}));
        return model && model.width ? { x: model.content[0] + model.width / 2, y: model.content[1] + model.height / 2 } : null;
      };
      const yer = await dugmeYeri();
      const cerceveVar = await deger(y.g, `!!${CERCEVE}`);
      const bek = c.olayBekle(m => (m.method === 'Target.targetCreated' || m.method === 'Target.targetInfoChanged') && m.params.targetInfo.type === 'page' &&
        m.params.targetInfo.url.startsWith(`chrome-extension://${eklenti}/goruntule.html#t=`), 10000);
      if (yer) for (const type of ['mousePressed', 'mouseReleased']) await y.g('Input.dispatchMouseEvent', { type, x: yer.x, y: yer.y, button: 'left', clickCount: 1 });
      const hedef = yer ? (await bek.catch(() => null))?.params?.targetInfo : null;
      const g = hedef ? await baglan(hedef.targetId) : null;
      const hata = g ? await belgeDurumu(g) : 'açılmadı';
      if (g) await deger(g, "[...document.querySelectorAll('.durum-dugmeler button')].find(b => b.textContent === 'Yeniden dene').click(), 1").catch(() => {});
      const dr = g ? await belgeDurumu(g) : 'açılmadı';
      const b = g ? await deger(g, "({ gomulu: document.documentElement.classList.contains('gomulu'), drive: !document.getElementById('dugme-drive').hidden, baslik: document.title })") : null;
      const kapandi = !(await acik(y.g));
      const yeni = ekIstekleri(istekler.slice(onceki), 'A 0.1');
      sonuc('yapı tanınmazsa "UDF olarak aç" → yeni sekmede belge (Gmail sekmesinden indirilir, "Yeniden dene" çalışır), Gmail’in ön izlemesi kapanır',
        !!yer && !cerceveVar && hata === 'HATA: Gmail şu an yanıt vermiyor' && dr === `BELGE: ${ISARET.dilekce}` && !!b && !b.gomulu && !b.drive && b.baslik === 'UDF Ön İzleme' &&
        kapandi && yeni.gmail.length === 2 && sunucuAyari.gecici === 0 && birinciTarafMi(yeni),
        `düğme: ${yer ? 'var' : 'yok'} · çerçeve: ${cerceveVar} · ${hata} → ${dr} · ${JSON.stringify(b)} · ön izleme kapandı: ${kapandi} · ${istekOzeti(yeni)}`);
      sunucuAyari.gecici = 0;
      // Sekme yenilenince (F5) kayıt yoktur (bir kez alındı, saklanmaz): Ek Gmail'de yeniden açılır, yeniden istenmez.
      if (g) {
        const yenilemeOncesi = istekler.length;
        await g('Page.reload');
        await bekle(300);
        const yenilenen = await ifadeBekle(g, "(() => { const h = document.querySelector('.durum.hata'); return h ? h.innerText.replace(/\\s+/g, ' ') : ''; })()", 8000).catch(() => 'hata yok');
        sonuc('sekme yenilenince "Belge bilgisi bulunamadı", ek yeniden istenmez', /^Belge bilgisi bulunamadı .*Drive’da ya da Gmail’de yeniden açın/.test(yenilenen) &&
          istekler.length === yenilemeOncesi, `${yenilenen.slice(0, 160)} · ${istekler.length - yenilemeOncesi} istek`);
      }
      if (hedef) await c.gonder('Target.closeTarget', { targetId: hedef.targetId });
      await c.gonder('Target.closeTarget', { targetId: y.targetId });
    }

    // G12. Ana alanlar çerçeve gösterilirken eklenir (Gmail onları gerektikçe ekler): C iletisinin yedi .udf'si. Sayfa geçişte
    // yalnız gösterilen ana alana dek kurar, sınama her adımda çerçeve gösterilirken bir sonrakini ekletir (?ileri=1&elleAna=1).
    // Çerçevenin içinden sağ okla geçilir, her geçişte yeni eklenen ana alana varılır. Her .udf kendi içeriğini gösterir,
    // çerçeve hep gösterilen ana alanda, sonradan eklenen ana alan gömülü belgeyi yeniden yüklemez.
    console.log('— Sonradan eklenen ana alanlar ve büyük ek');
    const C = iletiler.find(i => i.harf === 'C');
    const t = await gmailAc('?ileri=1&elleAna=1');
    await t.g('Page.bringToFront');
    {
      const onceki = istekler.length;
      const adimlar = [];
      let f = null, icerikler = true, yuklenmedi = true;
      await ekAc(t.g, 'C', 0);
      for (let k = 0; k < 7; k++) {
        if (k > 0) {
          await ifadeBekle(t.g, `${CERCEVE_ODAKTA}`, 3000).catch(() => {});
          await tus(t.g, 'ArrowRight');
        }
        f = await cerceveBul(t.g, { haric: f && f.anahtar });
        const ilk = await gommeDurumu(t.g);
        const durum = f ? await belgeDurumu(f.g) : 'çerçeve yok';
        if (f) await deger(f.g, `window.__adim = ${k}; 1`);
        await deger(t.g, 'window.__anaEkle()');
        await bekle(500);   // içerik betiğinin gözlemcisi (150 ms) eklenen ana alanı görsün
        const son = await gommeDurumu(t.g);
        const ayni = !!f && (await deger(t.g, CERCEVE_ANAHTARI)) === f.anahtar && (await deger(f.g, 'window.__adim').catch(() => null)) === k;
        const r = ekIstekleri(istekler.slice(onceki), C.ekler[k].anahtar);
        const ic = durum === `BELGE: ${ISARET['c' + (k + 1)]}` && ilk.var && ilk.ad === C.ekler[k].ad && ilk.sira === k && son.var && son.sira === k &&
          son.sayi === 1 && son.isaretli === 1 && r.gmail.length === 1 && birinciTarafMi(r);
        const yk = ilk.anaSayisi === k + 1 && son.anaSayisi === k + 2 && ayni;
        icerikler &&= ic;
        yuklenmedi &&= yk;
        adimlar.push(`${C.ekler[k].ad}: ${ic ? 'belge' : `${durum}, ${JSON.stringify({ var: son.var, ad: son.ad, sira: son.sira, sayi: son.sayi })}, ${r.gmail.length} istek`} · ana alan ${ilk.anaSayisi}→${son.anaSayisi}${ayni ? '' : ' · çerçeve yenilendi'}`);
      }
      sonuc('ana alanlar sonradan eklenirken sağ okla (belgede) yedi .udf: Her biri kendi içeriği, çerçeve hep gösterilen ana alanda, ek bir kez istenir',
        icerikler, adimlar.join(' | '));
      sonuc('çerçeve gösterilirken eklenen ana alan gömülü belgeyi yeniden yüklemez', yuklenmedi, `gezinti: ${JSON.stringify(await deger(t.g, 'window.__gezinti'))}`);
    }

    // G13. 2 MB'tan büyük ek (C iletisinin son eki): İçerik betiği baytları 1 MB'lık base64 dilimlerle arka plan aracılığıyla
    // verir (0, 1 ve birkaç baytlık son dilim). Belgenin yazısı görünür, ek bir kez istenir. Arka plandan içerik betiğine
    // gelen iletiler, onun yalıtılmış dünyasına eklenen ikinci bir dinleyiciyle sayılır.
    {
      await onizlemeyiKapat(t.g);
      const buyuk = C.ekler[7];
      const dunya = icerikBaglami(t);
      if (dunya) {
        await t.g('Runtime.evaluate', { contextId: dunya, expression: "globalThis.__sinamaIletileri = []; chrome.runtime.onMessage.addListener(m => { if (m && /^gmail-/.test(m.tur)) globalThis.__sinamaIletileri.push(m.tur === 'gmail-dilim' ? 'dilim ' + m.i : m.tur); }); 1" });
      }
      const onceki = istekler.length;
      await ekAc(t.g, 'C', 7);
      const f = await cerceveBul(t.g);
      const durum = f ? await belgeDurumu(f.g) : 'çerçeve yok';
      const gom = await gommeDurumu(t.g);
      const r = ekIstekleri(istekler.slice(onceki), buyuk.anahtar);
      const gelen = dunya ? (await t.g('Runtime.evaluate', { contextId: dunya, returnByValue: true, expression: 'globalThis.__sinamaIletileri' })).result.value : null;
      const beklenen = ['gmail-indir', ...Array.from({ length: Math.ceil(buyuk.bayt.length / MiB) }, (_, i) => 'dilim ' + i)];
      sonuc(`2 MB'tan büyük ek (${buyuk.bayt.length} bayt): 1 MB'lık ${beklenen.length - 1} dilimle aktarılır, belge görünür, ek bir kez istenir`,
        durum === `BELGE: ${ISARET.buyuk}` && gom.var && gom.ad === buyuk.ad && gom.sira === 7 && r.gmail.length === 1 && r.imzali.length === 1 && birinciTarafMi(r) &&
        JSON.stringify(gelen) === JSON.stringify(beklenen), `${durum} · içerik betiğine gelen: ${JSON.stringify(gelen)} · ${istekOzeti(r)}`);
      await onizlemeyiKapat(t.g);
      await c.gonder('Target.closeTarget', { targetId: t.targetId });
    }

    // G14. Kartsız açılış (gelen kutusu listesindeki ek düğmesi gibi): Ön izleme B iletisinin Dilekce.udf'sinde (B'de sıra 1)
    // açılır, A'nın aynı adlı eki de sayfada. Ön izlemeyi açan ileti bilinmediği için belge gömülmez, Gmail'in "Önizleme yok"
    // kartı kalır, ek istenmez. Adı sayfada tek olan İkinci.udf'de de (B'de sıra 0) tahmin yapılmaz. Sonra A'nın kartıyla
    // açılan ön izleme (belge gömülür) Esc ile kapatılır ve hemen, 5 sn dolmadan düğmeyle açılır: Eski tıklama bu ön izlemeye
    // mal edilmez.
    console.log('— Kartsız açılış ve yenilenen sayfa');
    {
      const l = await gmailAc();
      await l.g('Page.bringToFront');
      const d1 = await kartsizAc(l.g, 'B', 1);
      const d2 = await kartsizAc(l.g, 'B', 0);
      sonuc('listedeki ek düğmesi (kart tıklaması yok): Belge gömülmez, Gmail’in kartı kalır, ek istenmez', d1.tamam && d2.tamam, `${d1.ayrinti} | ${d2.ayrinti}`);
      const bas = Date.now();
      await ekAc(l.g, 'A', 0);
      const f = await cerceveBul(l.g);
      const durumA = f ? await belgeDurumu(f.g) : 'çerçeve yok';
      await ifadeBekle(l.g, `${CERCEVE_ODAKTA}`, 3000).catch(() => {});
      await onizlemeyiKapat(l.g);
      const gecen = Date.now() - bas;
      const d3 = await kartsizAc(l.g, 'B', 1);
      sonuc('A’nın kartıyla açılıp kapatılan ön izlemeden hemen sonra düğmeyle açılan ön izleme: Eski tıklama kullanılmaz, belge gömülmez',
        durumA === `BELGE: ${ISARET.dilekce}` && gecen < 4500 && d3.tamam, `A: ${durumA} · düğmeye karta tıklamadan ${gecen} ms sonra basıldı · ${d3.ayrinti}`);
      await c.gonder('Target.closeTarget', { targetId: l.targetId });
    }

    // G15. Ön izleme açıkken yenilenen sayfa: Adreste "?projector=1&messagePartId=0.1", Gmail ön izlemeyi tıklamasız açar
    // (konunun son iletisi C, Sıra 1.udf). Bu ad sayfada yalnız C'de olduğu için belge gömülür. Kapatıldıktan sonra listedeki
    // düğmeyle açılan ön izlemede tahmin yapılmaz (tahmin yalnız ilk ön izleme için): Adı sayfada tek olan İkinci.udf de gömülmez.
    {
      const onceki = istekler.length;
      const y = await gmailAc('', '?projector=1&messagePartId=0.1');
      await y.g('Page.bringToFront');
      const f = await cerceveBul(y.g);
      const durum = f ? await belgeDurumu(f.g) : 'çerçeve yok';
      const gom = await gommeDurumu(y.g);
      const acilislar = await deger(y.g, 'window.__acilislar');
      const r = ekIstekleri(istekler.slice(onceki), C.ekler[0].anahtar);
      sonuc('ön izleme açıkken yenilenen sayfa: Tıklamasız açılan ön izlemede adı sayfada tek olan ek gömülür',
        durum === `BELGE: ${ISARET.c1}` && gom.var && gom.ad === C.ekler[0].ad && gom.sira === 0 && JSON.stringify(acilislar) === '["C 0.1"]' &&
        r.gmail.length === 1 && birinciTarafMi(r), `${durum} · açılışlar: ${JSON.stringify(acilislar)} · ${JSON.stringify({ ad: gom.ad, sira: gom.sira, adres: gom.adres })}`);
      await ifadeBekle(y.g, `${CERCEVE_ODAKTA}`, 3000).catch(() => {});
      await onizlemeyiKapat(y.g);
      const hash = await deger(y.g, 'location.hash');
      const d1 = await kartsizAc(y.g, 'B', 0);
      const d2 = await kartsizAc(y.g, 'B', 1);
      sonuc('yenilemeden sonra düğmeyle açılan ön izlemede tahmin yapılmaz: Belge gömülmez', !hash.includes('?') && d1.tamam && d2.tamam,
        `${hash} · ${d1.ayrinti} | ${d2.ayrinti}`);
      await c.gonder('Target.closeTarget', { targetId: y.targetId });
    }

    // G16. Sayfanın betiğinin ürettiği (güvenilmeyen) fare basışı, tıklama, Enter ve boşluk ek kartında ön indirme
    // başlatmaz. Sahte Gmail'in ön izlemeyi açması kartın kendi dinleyicisiyle durdurulur: Yalnız ön indirme sınanır (gerçek
    // fare basışında kart, çerçeve eklenmeden indirilir, G1).
    {
      const y = await gmailAc();
      const onceki = istekler.length;
      await deger(y.g, `(() => { const k = document.querySelectorAll('[data-message-id]')[0].querySelectorAll('[download_url]')[0];
        for (const t of ['click', 'keydown']) k.addEventListener(t, e => { e.preventDefault(); e.stopPropagation(); });
        const at = (t, o = {}) => k.dispatchEvent(new (t.startsWith('key') ? KeyboardEvent : t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, { bubbles: true, cancelable: true, composed: true, button: 0, isPrimary: true, ...o }));
        for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) at(t);
        at('keydown', { key: 'Enter' }); at('keydown', { key: ' ' }); return 1; })()`);
      await bekle(1500);
      const r = ekIstekleri(istekler.slice(onceki), 'A 0.1');
      const acildi = await acik(y.g);
      sonuc('sayfanın ürettiği fare ve tuş olayları ek kartında ön indirme başlatmaz', r.gmail.length === 0 && r.imzali.length === 0 && !acildi,
        `${r.gmail.length} + ${r.imzali.length} ek isteği · ön izleme açık: ${acildi}`);
      await c.gonder('Target.closeTarget', { targetId: y.targetId });
    }

    // Bütün ek istekleri: Hiçbiri eklentinin kökeninden ya da çerçeveden değil (Gmail adımı hep aynı kökenli, çerezli).
    const gmailAdimlari = istekler.filter(i => i.host === GMAIL && i.sorgu.includes('view=att'));
    sonuc('ek isteklerinin hepsi Gmail sayfasından (aynı köken), eklentiden ya da çerçeveden değil', gmailAdimlari.length > 0 &&
      gmailAdimlari.every(i => i.site === 'same-origin' && !/^chrome-extension:/.test(i.koken) && i.cerezler.includes('GMAIL_OTURUM')),
      `${gmailAdimlari.length} istek · ${[...new Set(gmailAdimlari.map(i => `${i.site}/${i.koken || '-'}`))].join(', ')}`);
    sonuc('sayfada ve çerçevelerde istisna ya da konsol hatası yok', hatalar.length === 0, hatalar.slice(0, 5).join(' | '));
    sonuc('eklentinin sayfalarında (sekmeler, gömülü çerçeveler, service worker) CSP ihlali yok', cspIhlalleri.length === 0,
      `${cspIhlalleri.length} ihlal${cspIhlalleri.length ? ' · ' + cspIhlalleri.slice(0, 5).join(' | ') : ''}`);
  } finally {
    c.kapat();
    sunucu.close();
  }

  // ================================================================ 2. oturum: Üçüncü taraf çerezleri kapalı
  // Ek Gmail sayfasının içinden birinci taraf olarak indirildiği için belge yine açılmalı.
  console.log('— Üçüncü taraf çerezleri kapalı');
  const secenek2 = {};
  const s2 = await gmailSunucusu(iletiler, secenek2);
  const o2 = await oturumKur({ port: s2.port, ekler: ['--test-third-party-cookie-phaseout'] });
  try {
    const s = await o2.gmailAc();
    await o2.ekAc(s.g, 'A', 0);
    const f = await o2.cerceveBul(s.g);
    const durum = f ? await o2.belgeDurumu(f.g) : 'çerçeve yok';
    const r = ekIstekleri(s2.istekler, 'A 0.1');
    sonuc('çerezler kapalı: Belge açılır, ek birinci taraf olarak indirilir', durum === `BELGE: ${ISARET.dilekce}` && birinciTarafMi(r), `${durum} · ${istekOzeti(r)}`);
    // İmzalı adres bir kez CORS izni vermezse (gmail.js'e göre aynı ek art arda istenince olabiliyor) içerik betiği adresi
    // bir kez cacheCounter ekiyle yeniden ister (indir.js, gmailEkIndir).
    await o2.tus(s.g, 'Escape');
    await bekle(500);
    secenek2.corsHatasi = true;
    await o2.ekAc(s.g, 'A', 2);
    const f2 = await o2.cerceveBul(s.g);
    const durum2 = f2 ? await o2.belgeDurumu(f2.g) : 'çerçeve yok';
    const yeniden = s2.istekler.filter(i => i.host === GMAIL && i.ek === 'A 0.3').map(i => i.sorgu.replace(/^.*&zw/, '…&zw'));
    sonuc('imzalı adres bir kez CORS izni vermezse "cacheCounter" ekiyle yeniden denenir', durum2 === `BELGE: ${ISARET.ayni1}` && yeniden.length === 2 &&
      yeniden[0] === '…&zw' && /^…&zw&cacheCounter=\d+$/.test(yeniden[1]), `${durum2} · ${JSON.stringify(yeniden)}`);
  } finally {
    o2.c.kapat();
    s2.sunucu.close();
  }

  // ================================================================ 3. oturum: Dark Reader açık (kuruluysa)
  const dr = karanlikOkuyucu();
  if (!dr) console.log('— Dark Reader: ATLANDI (Chrome’da kurulu değil, DARK_READER_YOLU ile paketlenmemiş klasörü verilebilir)');
  else {
    console.log(`— Dark Reader ${dr.surum} açık`);
    let s3 = null, o3 = null;
    try {
      s3 = await gmailSunucusu(iletiler);
      o3 = await oturumKur({ port: s3.port, ekEklentiler: [dr.yol], ekler: ['--force-dark-mode'] });
      const s = await o3.gmailAc();
      await s.g('Page.bringToFront');
      const temali = () => ifadeBekle(s.g, "!!document.querySelector('style.darkreader--user-agent')", 6000).then(() => true, () => false);
      if (!(await temali())) {
        await s.g('Page.reload');
        await ifadeBekle(s.g, "document.readyState === 'complete' && !!document.querySelector('[download_url]')");
        await bekle(800);
      }
      const tema = await temali();
      await o3.ekAc(s.g, 'A', 0);
      const f = await o3.cerceveBul(s.g);
      const durum = f ? await o3.belgeDurumu(f.g) : 'çerçeve yok';
      await bekle(800);
      const nokta = await o3.deger(s.g, `(() => { const c = ${CERCEVE}; if (!c) return null; const r = c.getBoundingClientRect(); return { x: Math.round(r.left + 12), y: Math.round(r.top + 100), sema: getComputedStyle(c).colorScheme }; })()`);
      const renk = nokta ? await pikselRengi(s.g, nokta.x, nokta.y) : null;
      sonuc('Dark Reader açıkken belge saydam, arkada Gmail’in katmanı', tema && durum === `BELGE: ${ISARET.dilekce}` && !!nokta && nokta.sema === 'light' && renk.every(v => v < 60),
        `tema: ${tema} · ${durum} · color-scheme: ${nokta && nokta.sema} · sayfanın solundaki piksel: ${renk ? 'rgb(' + renk.join(', ') + ')' : '-'}`);
    } finally {
      if (o3) o3.c.kapat();
      if (s3) s3.sunucu.close();
      fs.rmSync(dr.yol, { recursive: true, force: true });
    }
  }
  return sonuclar.filter(x => !x.tamam).length;
}
