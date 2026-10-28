// Drive sayfasından dosya kimliği, adı ve hesabı (sırası ya da e-posta adresi) okuyan saf işlevler (içerik betiği ve testler
// kullanır).
// Karartılmış sınıf adları kullanılmaz. Dayanaklar: Ön izlemedeki #drive-active-item-info JSON'u ve /file/d/<id>/
// adresleri. Dile bağlı metinlere (sekme başlığı) yalnız ".udf" uzantısını bulmak için bakılır.
(() => {
  'use strict';
  if (globalThis.DriveKimlik) return;

  const KIMLIK = /^[A-Za-z0-9_-]{10,200}$/;
  const KAYNAK_ANAHTARI = /^[A-Za-z0-9_.-]{1,200}$/;

  const udfAdiMi = ad => typeof ad === 'string' && /\.udf$/i.test(ad.trim());

  const rkTemizle = rk => (rk && KAYNAK_ANAHTARI.test(rk) ? rk : null);

  // authuser hesabın e-posta adresi de olabilir (?authuser=ad@ornek.com). Yalnız bu sıkı biçimdeki adres kabul edilir: En
  // çok 254 karakter, tek @, boşluk, denetim karakteri ve / ? # & = yok, alan adı noktalı (indir.js ve arkaplan.js aynı
  // biçimi kullanır).
  const HESAP_EPOSTASI = /^(?=.{1,254}$)[A-Za-z0-9!$%'*+^_`{|}~.-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63})+$/;

  // Hesap: Yoldaki /u/<n>/ ya da authuser'daki sıra (sayı), yoksa authuser'daki e-posta adresi (olduğu gibi), yoksa null.
  function hesapNo(u) {
    const m = /\/u\/(\d{1,2})(?:\/|$)/.exec(u.pathname);
    if (m) return Number(m[1]);
    const a = u.searchParams.get('authuser');
    if (a && /^\d{1,2}$/.test(a)) return Number(a);
    return a && HESAP_EPOSTASI.test(a) ? a : null;
  }

  function urldenBilgi(href) {
    let u;
    try { u = new URL(href); } catch { return null; }
    if (u.protocol !== 'https:' || !/^(drive|docs)\.google\.com$/.test(u.hostname)) return null;
    let id = null;
    const m = /\/file\/(?:u\/\d{1,2}\/)?d\/([A-Za-z0-9_-]{10,200})(?:\/|$)/.exec(u.pathname);
    if (m) id = m[1];
    else if (/(^|\/)(open|uc)$/.test(u.pathname)) id = u.searchParams.get('id');
    return { id: id && KIMLIK.test(id) ? id : null, au: hesapNo(u), rk: rkTemizle(u.searchParams.get('resourcekey')) };
  }

  // Sayfanın hesabı: Adres (/u/<n>/ ya da authuser), yoksa og:url'deki hesap (hesapNo).
  function sayfaHesabi(belge, href) {
    const b = urldenBilgi(href);
    if (b && b.au != null) return b.au;
    const og = belge.querySelector('meta[property="og:url"]');
    const ogBilgi = og ? urldenBilgi(og.getAttribute('content') || '') : null;
    return ogBilgi ? ogBilgi.au : null;
  }

  // Ön izleme açıkken Drive'ın gizli öğesinde {"id","title","mimeType"} JSON'u durur. e: Görüntüleyicinin bilgi öğesi
  // (verilmezse belgedeki, Gmail'de içerik betiği GmailEk.bilgiOgesi'nin doğruladığını verir).
  function aktifOge(belge, e = belge.getElementById('drive-active-item-info')) {
    if (!e) return null;
    let j;
    try { j = JSON.parse(e.textContent || ''); } catch { return null; }
    if (!j || typeof j !== 'object' || !KIMLIK.test(String(j.id || ''))) return null;
    return { id: String(j.id), ad: typeof j.title === 'string' ? j.title.slice(0, 300) : '', tur: typeof j.mimeType === 'string' ? j.mimeType.slice(0, 100) : '' };
  }

  // Sekme başlığı "<ad> - Google Drive" biçimindedir.
  const basliktanAd = baslik => { const m = /^(.*\.udf)\s+-\s+Google\s+Drive$/i.exec(String(baslik || '').trim()); return m ? m[1] : null; };

  globalThis.DriveKimlik = Object.freeze({
    udfAdiMi, urldenBilgi, hesapNo, sayfaHesabi, aktifOge, basliktanAd, KIMLIK
  });
})();
