// Drive sayfasından dosya kimliği, adı ve hesap sırasını okuyan saf işlevler (içerik betiği ve testler kullanır).
// Karartılmış sınıf adları kullanılmaz; dayanaklar: önizlemedeki #drive-active-item-info JSON'u ve /file/d/<id>/
// adresleri. Dile bağlı metinlere (sekme başlığı) yalnız ".udf" uzantısını bulmak için bakılır.
(() => {
  'use strict';
  if (globalThis.DriveKimlik) return;

  const KIMLIK = /^[A-Za-z0-9_-]{10,200}$/;
  const KAYNAK_ANAHTARI = /^[A-Za-z0-9_.-]{1,200}$/;

  const udfAdiMi = ad => typeof ad === 'string' && /\.udf$/i.test(ad.trim());

  const rkTemizle = rk => (rk && KAYNAK_ANAHTARI.test(rk) ? rk : null);

  function hesapNo(u) {
    const m = /\/u\/(\d{1,2})(?:\/|$)/.exec(u.pathname);
    if (m) return Number(m[1]);
    const a = u.searchParams.get('authuser');
    return a && /^\d{1,2}$/.test(a) ? Number(a) : null;
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

  // Sayfanın hesap sırası: adres (/u/<n>/ ya da authuser), yoksa og:url'deki /u/<n>/.
  function sayfaHesabi(belge, href) {
    const b = urldenBilgi(href);
    if (b && b.au != null) return b.au;
    const og = belge.querySelector('meta[property="og:url"]');
    const ogBilgi = og ? urldenBilgi(og.getAttribute('content') || '') : null;
    return ogBilgi ? ogBilgi.au : null;
  }

  // Önizleme açıkken Drive'ın gizli öğesinde {"id","title","mimeType"} JSON'u durur.
  function aktifOge(belge) {
    const e = belge.getElementById('drive-active-item-info');
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
