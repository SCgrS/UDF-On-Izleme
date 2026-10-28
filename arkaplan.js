// Arka plan (service worker): Drive ya da Gmail sekmesinden gelen "aç" isteğini görüntüleyiciye (Google'ın görüntüleyicisine
// gömülü ya da, yapısı tanınmazsa, yeni sekmede) çevirir. Gömülü görüntüleyicinin Drive için yedek indirmesini yapar,
// Gmail ekinin baytlarını görüntüleyiciye, ekin açıldığı Gmail sekmesinden aktarır. Dosya adı adrese konmaz (müvekkil adı
// ya da esas numarası taşıyabilir): Görüntüleyici belgenin kaydını rastgele bir anahtarla bir kez alır. Kayıtlar yalnız bu
// service worker'ın belleğinde durur, hiçbir depoya yazılmaz.
'use strict';
importScripts('indir.js', 'gmail-ek.js');

const KIMLIK = /^[A-Za-z0-9_-]{10,200}$/;
const ANAHTAR = /^[0-9a-f-]{36}$/;
const GORUNTULEYICI = chrome.runtime.getURL('goruntule.html');
const DRIVE = /^https:\/\/drive\.google\.com\//;
const GMAIL = /^https:\/\/mail\.google\.com\//;

// Açılacak belgenin kaydı: Görüntüleyici (gömülü çerçeve ya da sekme) açılınca 'kayit-al' ile bir kez alır, kayıt o anda
// silinir. Alınmayan kayıt (çerçeve hiç yüklenmedi) 60 sn sonra silinir, aynı anda en çok beşi durur (sınır aşılınca en
// eskisi). Görüntüleyici aldığı kaydı kendi belleğinde tutar, indirme ve "Yeniden dene" için geri gönderir (indir): Kayıt
// yeniden doğrulanır (kayitTemizle). Görüntüleyici yeniden yüklenirse (F5) kayıt yoktur, belge Drive'da ya da Gmail'de
// yeniden açılır. Service worker kayıtla alınması arasında (onlarca ms) kapanırsa da kayıt kaybolur.
const KAYIT_SURESI = 60000, KAYIT_EN_COK = 5;
const kayitlar = new Map();   // anahtar → { kayit, sure }
function kayitBirak(anahtar) {
  const k = kayitlar.get(anahtar);
  if (k) { clearTimeout(k.sure); kayitlar.delete(anahtar); }
}
function kayitAl(anahtar) {
  const k = kayitlar.get(anahtar);
  kayitBirak(anahtar);
  return k ? k.kayit : null;
}

// Hesap (authuser): Sıra (0-99) ya da e-posta adresi. Adres yalnız sıkı biçimdeyse, olduğu gibi kabul edilir: En çok 254
// karakter, tek @, boşluk, denetim karakteri ve / ? # & = yok, alan adı noktalı (drive-kimlik.js ve indir.js aynı biçimi
// kullanır). Başka her değer null (hesapsız istek).
const HESAP_EPOSTASI = /^(?=.{1,254}$)[A-Za-z0-9!$%'*+^_`{|}~.-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63})+$/;
const hesapSirasi = au => ((Number.isInteger(au) && au >= 0 && au < 100) || (typeof au === 'string' && HESAP_EPOSTASI.test(au)) ? au : null);
const kaynakAnahtari = rk => (typeof rk === 'string' && /^[A-Za-z0-9_.-]{1,200}$/.test(rk) ? rk : null);
// Kaydın doğrulanmış biçimi ya da null. Drive: Kimlik, ad, hesap (authuser) ve paylaşım bağlantısının kaynak anahtarı.
// Gmail eki: Ad, ekin doğrulanmış indirme bilgisi ve ekin açıldığı sekme (baytları o sekmedeki içerik betiği indirir,
// gmailIndir). İçerik betiğinin bildirdiği dosyaya da görüntüleyicinin geri gönderdiği kayda da uygulanır.
function kayitTemizle(b, sekme) {
  if (!b || typeof b !== 'object') return null;
  const ad = typeof b.ad === 'string' ? b.ad.slice(0, 300) : '';
  if (b.kaynak === 'gmail') {
    const ek = GmailEk.ekTemizle(b.ek);
    return ek && Number.isInteger(sekme) && sekme >= 0 ? { kaynak: 'gmail', ad, ek, sekme } : null;
  }
  return KIMLIK.test(String(b.id || '')) ? { id: b.id, ad, au: hesapSirasi(b.au), rk: kaynakAnahtari(b.rk) } : null;
}

// Açılacak dosyanın kaydını yazar, görüntüleyicinin adresine konacak anahtarı döndürür.
// onIndir: Gömülü görünümdeki Drive dosyası kayıtla birlikte indirilmeye başlar (onIndir).
function kayitYaz(b, sekme, { onIndir: indirilsin = false } = {}) {
  const kayit = kayitTemizle(b, sekme);
  if (!kayit) throw new Error('Dosya bilgisi geçersiz');
  const anahtar = crypto.randomUUID();
  // Sekmenin yeni gömme kaydı: İçerik betiği önceki çerçevesini kaldırdı, o sekmenin indirmeleri artık gerekmez.
  if (indirilsin) sekmeninIndirmeleriniBirak(sekme);
  if (indirilsin && kayit.kaynak !== 'gmail') onIndir(anahtar, kayit, sekme);
  while (kayitlar.size >= KAYIT_EN_COK) kayitBirak(kayitlar.keys().next().value);
  kayitlar.set(anahtar, { kayit, sure: setTimeout(() => kayitBirak(anahtar), KAYIT_SURESI) });
  return anahtar;
}

// Yeni sekme, yanındaki sekmenin (istek ya da tıklama onun içindeydi) hemen sağında.
async function sekmeAc(url, yanindaki) {
  const yeni = { url };
  if (yanindaki) Object.assign(yeni, { index: yanindaki.index + 1, openerTabId: yanindaki.id, windowId: yanindaki.windowId });
  await chrome.tabs.create(yeni);
}

// Drive'a gömülü görüntüleyicinin indirmesi. Gömülü sayfanın kendi isteği Drive sayfasının içinden (üçüncü taraf
// bağlamında) gider, üçüncü taraf çerezleri kapalıyken yalnız SameSite=None çerezler gitmez. Service worker'ın isteği
// bütün çerezlerle gider (2026-10-06 ölçümü, belgeler/DRIVE-TEKNIGI.md §6). Baytlar iletide base64 olarak, 1 MB'lık
// dilimlerle taşınır: 'indir' boyu döndürür, çerçeve dilimleri 'indir-dilim' ile sırayla ister. Tek parça ileti büyük
// dosyada süreçte dosyanın 6-8 katı geçici bellek tutuyordu (bağımsız ölçüm, 2026-10-07: 30 MB'lık dosyada +330 MB).
// İndirilen baytlar son dilim verilene ya da en çok 15 sn tutulur (çerçeve arada kapanırsa), bırakılırken sıfırlanır.
// Gömülü görünümde indirme kayıtla birlikte başlar (onIndir), çerçeve yüklenirken sürer. Çerçeve 'indir' deyince o
// indirmenin sonucu verilir (bir kez). Çerçeve kendi indirmesine ancak bu yol başaramazsa geçer (goruntule.js).
// Süren her indirme izlenir (surenler) ve kesilebilir (AbortController): Kesilen indirmenin o ana dek inen baytları
// sıfırlanır (indir.js govdeOku), sonucu tutulmaz. Onu bekleyen görüntüleyici yoktur (çerçevesi kaldırıldı ya da yeniden
// denedi), yine de varsa AG alır ve dosyayı kendisi indirir. Drive'da oklarla hızlı gezinince her dosya için bir kayıt
// gelir: İstenmemiş ön indirme ve tutulan bayt kaydı en çok üçer, sınır aşılınca en eskisi bırakılır (indirmesi sürüyorsa
// kesilir). İçerik betiği yeni gömme kaydından önce sekmedeki eski çerçeveyi kaldırır: Aynı sekmeden yeni bir kayıt
// gelince o sekmenin istenmemiş ön indirmesi bırakılır, süren indirmeleri (görüntüleyicinin istedikleri de) kesilir.
// Böylece bir sekmede yalnız son çerçevenin indirmesi sürer. Ön izleme kapatılınca (yeni kayıt gelmeden) süren indirme
// biter, baytları en çok 15 sn tutulur.
const DILIM = 1 << 20;
const SURE = 15000, EN_COK = 3;
const yedekler = new Map();   // anahtar → { bayt, sure }
const onIndirmeler = new Map();   // anahtar → { soz, sure, sekme }: Kayıtla başlayan, henüz istenmemiş indirme
const surenler = new Map();   // anahtar → { iptal, sekme }: Süren (henüz bitmemiş) indirme
// Tarayıcının kendi base64 çeviricisi varsa o (indir.js base64).
function base64(bayt) {
  if (typeof bayt.toBase64 === 'function') return bayt.toBase64();
  let s = '';
  for (let i = 0; i < bayt.length; i += 0x8000) s += String.fromCharCode.apply(null, bayt.subarray(i, i + 0x8000));
  return btoa(s);
}
function yedekBirak(anahtar) {
  const y = yedekler.get(anahtar);
  if (y) { clearTimeout(y.sure); yedekler.delete(anahtar); y.bayt.fill(0); }
}
function yedekKoy(anahtar, bayt) {
  yedekBirak(anahtar);
  while (yedekler.size >= EN_COK) yedekBirak(yedekler.keys().next().value);
  yedekler.set(anahtar, { bayt, sure: setTimeout(() => yedekBirak(anahtar), SURE) });
}
// Süren indirmeyi keser.
function indirmeyiKes(anahtar) {
  const s = surenler.get(anahtar);
  if (s) { surenler.delete(anahtar); s.iptal.abort(); }
}
// sekme: Çerçevenin bulunduğu Drive ya da Gmail sekmesi (bilinmiyorsa null). Aynı anahtarın süren indirmesi kesilir
// (görüntüleyici yeniden denedi, öncekinin sonucunu beklemiyor). Kesilen indirme sonradan inerse baytları tutulmaz,
// sıfırlanır.
async function driveIndir(anahtar, kayit, sekme = null) {
  indirmeyiKes(anahtar);
  const s = { iptal: new AbortController(), sekme };
  surenler.set(anahtar, s);
  try {
    const r = await DriveIndir.udfIndir(kayit, { signal: s.iptal.signal });
    if (s.iptal.signal.aborted) { r.bayt.fill(0); return { hata: 'AG' }; }
    yedekKoy(anahtar, r.bayt);
    return { uzunluk: r.bayt.length, dilim: DILIM, ad: r.ad, hesap: r.hesap };
  } catch (e) {
    return { hata: (e && e.kod) || 'AG' };
  } finally {
    if (surenler.get(anahtar) === s) surenler.delete(anahtar);
  }
}
// İstenmemiş ön indirmeyi bırakır: Süren indirme kesilir, inmiş baytlar atılır.
function onBirak(anahtar) {
  const o = onIndirmeler.get(anahtar);
  if (!o) return;
  clearTimeout(o.sure);
  onIndirmeler.delete(anahtar);
  indirmeyiKes(anahtar);
  yedekBirak(anahtar);
}
// Sekmenin çerçevesi kaldırıldı: İstenmemiş ön indirmesi bırakılır, süren indirmeleri kesilir. Görüntüleyicinin istediği
// ve inmiş baytlar son dilime ya da 15 sn'ye dek kalır.
function sekmeninIndirmeleriniBirak(sekme) {
  for (const [anahtar, o] of [...onIndirmeler]) if (o.sekme === sekme) onBirak(anahtar);
  for (const [anahtar, s] of [...surenler]) if (s.sekme === sekme) indirmeyiKes(anahtar);
}
function onIndir(anahtar, kayit, sekme) {
  while (onIndirmeler.size >= EN_COK) onBirak(onIndirmeler.keys().next().value);
  onIndirmeler.set(anahtar, { soz: driveIndir(anahtar, kayit, sekme), sure: setTimeout(() => onBirak(anahtar), SURE), sekme });
}
// Görüntüleyicinin isteği: Kayıtla başlayan ön indirme varsa onun sonucu (bir kez), yoksa görüntüleyicinin gönderdiği
// kayıtla yeni indirme ("Yeniden dene", sekmede açılan Gmail eki). sekme: Görüntüleyicinin bulunduğu sekme.
async function indir(anahtar, gelen, sekme) {
  const on = onIndirmeler.get(anahtar);
  if (on) { clearTimeout(on.sure); onIndirmeler.delete(anahtar); return on.soz; }
  const kayit = kayitTemizle(gelen, gelen && gelen.sekme);
  if (!kayit) return { hata: 'KIMLIK' };
  return kayit.kaynak === 'gmail' ? gmailIndir(anahtar, kayit) : driveIndir(anahtar, kayit, sekme);
}
function dilimVer(anahtar, i) {
  const y = yedekler.get(anahtar);
  if (!y || !Number.isInteger(i) || i < 0 || i * DILIM >= y.bayt.length) return { hata: 'AG' };
  const parca = base64(y.bayt.subarray(i * DILIM, (i + 1) * DILIM));
  if ((i + 1) * DILIM >= y.bayt.length) yedekBirak(anahtar);
  return { parca };
}

// Gmail eki: Görüntüleyici (gömülü ya da sekmede) Gmail'e kendisi istek atamaz (gömülüyken üçüncü taraf bağlamındadır,
// Gmail'in ek adresi de yalnız Gmail kökenine CORS izni veriyor). Eki, açıldığı Gmail sekmesindeki içerik betiği
// birinci taraf olarak indirir ve baytları tutar. Arka plan dilimleri ondan alıp görüntüleyiciye aynen aktarır (bayt
// tutmaz). Sekme görüntüleyicinin kaydından gelir. Sekme kapanmışsa ya da içerik betiği eskimişse (eklenti güncellendi)
// GMAIL_SEKME.
async function gmailIndir(anahtar, kayit) {
  let y;
  try { y = await chrome.tabs.sendMessage(kayit.sekme, { tur: 'gmail-indir', anahtar, ek: kayit.ek }, { frameId: 0 }); } catch { y = null; }
  if (!y || typeof y !== 'object') return { hata: 'GMAIL_SEKME' };
  if (!Number.isInteger(y.uzunluk) || !Number.isInteger(y.dilim) || y.uzunluk < 1 || y.dilim < 1) {
    return { hata: typeof y.hata === 'string' && /^[A-Z0-9_]{1,40}$/.test(y.hata) ? y.hata : 'AG' };
  }
  return { uzunluk: y.uzunluk, dilim: y.dilim, ad: null, hesap: null };
}
async function gmailDilimi(anahtar, i, sekme) {
  if (!Number.isInteger(i) || i < 0 || !Number.isInteger(sekme) || sekme < 0) return { hata: 'AG' };
  let p;
  try { p = await chrome.tabs.sendMessage(sekme, { tur: 'gmail-dilim', anahtar, i }, { frameId: 0 }); } catch { p = null; }
  return p && typeof p.parca === 'string' ? { parca: p.parca } : { hata: 'AG' };
}

// Görüntüleyici sayfasından mı (sekmede ya da Drive'a gömülü)? Gömülü sayfa (gomulu.html) web_accessible_resources'ın dinamik
// adresiyle açıldığı için adresin kökeni eklenti kimliği değil oturumluk bir GUID olabilir. İletiyi zaten yalnız bu
// eklentinin sayfaları gönderebilir (gonderen.id), içerik betiklerinin adresi ise https'tir.
function goruntuleyiciden(g) {
  try { const u = new URL(g.url); return u.protocol === 'chrome-extension:' && (u.pathname === '/goruntule.html' || u.pathname === '/gomulu.html'); } catch { return false; }
}

chrome.runtime.onMessage.addListener((ileti, gonderen, yanit) => {
  if (!ileti || gonderen.id !== chrome.runtime.id) return;
  // Gmail'de .udf ek kartına basıldı: Yalnız service worker'ı uyandırır (ardından gelecek gömme kaydı açılışını beklemesin).
  if (ileti.tur === 'uyan') { yanit({}); return; }
  // Görüntüleyicinin "Drive'da aç" bağlantısı: Yalnız drive.google.com adresi, görüntüleyicinin yanında yeni sekmede.
  if (ileti.tur === 'drive-ac') {
    if (!goruntuleyiciden(gonderen) || typeof ileti.url !== 'string' || !DRIVE.test(ileti.url)) return;
    sekmeAc(ileti.url, gonderen.tab).then(() => yanit({ tamam: true }), () => yanit({ tamam: false }));
    return true;
  }
  if (ileti.tur === 'kayit-al') {
    if (!goruntuleyiciden(gonderen) || !ANAHTAR.test(String(ileti.anahtar || ''))) return;
    const kayit = kayitAl(ileti.anahtar);
    yanit(kayit ? { kayit } : {});
    return;
  }
  if (ileti.tur === 'indir') {
    if (!goruntuleyiciden(gonderen) || !ANAHTAR.test(String(ileti.anahtar || ''))) return;
    indir(ileti.anahtar, ileti.kayit, gonderen.tab ? gonderen.tab.id : null).then(yanit, () => yanit({ hata: 'AG' }));
    return true;
  }
  if (ileti.tur === 'indir-dilim') {
    if (!goruntuleyiciden(gonderen) || !ANAHTAR.test(String(ileti.anahtar || ''))) return;
    if (yedekler.has(ileti.anahtar)) { yanit(dilimVer(ileti.anahtar, ileti.i)); return; }
    gmailDilimi(ileti.anahtar, ileti.i, ileti.sekme).then(yanit, () => yanit({ hata: 'AG' }));
    return true;
  }
  // Bundan sonrakiler Drive ya da Gmail sekmesindeki içerik betiğinden gelir. Gmail eki yalnız Gmail sekmesinden, Drive
  // dosyası ikisinden de (Gmail, iletideki Drive bağlantılarını da aynı görüntüleyicide gösterebilir).
  if (!gonderen.tab || gonderen.frameId !== 0 || !(DRIVE.test(gonderen.url || '') || GMAIL.test(gonderen.url || ''))) return;
  if (ileti.kaynak === 'gmail' ? !GMAIL.test(gonderen.url) || !GmailEk.ekTemizle(ileti.ek) : !KIMLIK.test(String(ileti.id || ''))) return;
  if (ileti.tur === 'gomulu-kayit') {
    let anahtar = null;
    try { anahtar = kayitYaz(ileti, gonderen.tab.id, { onIndir: true }); } catch { /* geçersiz dosya bilgisi */ }
    yanit(anahtar ? { anahtar } : {});
    return;
  }
  // Google'ın görüntüleyicisinin yapısı tanınmadığında çıkan "UDF olarak aç" düğmesi: Belge yeni sekmede açılır.
  if (ileti.tur === 'udf-ac') {
    let anahtar = null;
    try { anahtar = kayitYaz(ileti, gonderen.tab.id); } catch { /* geçersiz dosya bilgisi */ }
    if (!anahtar) { yanit({ tamam: false }); return; }
    sekmeAc(`${GORUNTULEYICI}#t=${anahtar}`, gonderen.tab).then(() => yanit({ tamam: true }), () => { kayitBirak(anahtar); yanit({ tamam: false }); });
    return true;
  }
});
