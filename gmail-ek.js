// Gmail sayfasından ekin indirme bilgisini okuyan saf işlevler (içerik betiği, arka plan ve testler kullanır).
// Gmail'in ek ön izlemesi Drive'ın görüntüleyicisinin aynısıdır (2026-10-26'da gerçek Gmail'de ölçüldü): #drive-active-item-info
// JSON'unda ad var, kimlik boş. Hangi ekin gösterildiği adresten anlaşılmaz: Gmail oklarla öbür eke geçince adresteki
// messagePartId'yi güncellemiyor. Görüntüleyicide her ek için bir ana alan ([role=main]) iletideki ek sırasıyla durur
// (Gmail bunları sırayla, gerektikçe ekler). Gösterilen ek: En son tıklanan ek kartının iletisindeki eklerden, etkin ana
// alanın sırasındaki ek. Adı pencerenin adıyla tutmalı. Ekin indirme adresi iletideki ek kartlarından okunur
// ([download_url] ve a[href*="view=att"]), karartılmış sınıf adları kullanılmaz. Okunan değerler sıkı biçimde doğrulanır,
// indirme adresi yalnız bunlardan yeniden kurulur (sayfadaki adres olduğu gibi kullanılmaz).
(() => {
  'use strict';
  if (globalThis.GmailEk) return;

  const IK = /^[0-9a-f]{4,32}$/;
  const TH = /^[0-9a-f]{6,24}$/;
  const ATTID = /^\d{1,4}(?:\.\d{1,4}){0,6}$/;
  const PERMMSGID = /^msg-[af]:r?-?\d{1,25}$/;
  const REALATTID = /^[A-Za-z0-9_.-]{1,80}$/;

  const udfAdiMi = ad => typeof ad === 'string' && /\.udf$/i.test(ad.trim());
  const adTemizle = ad => String(ad == null ? '' : ad).normalize('NFC').trim().slice(0, 300);
  const metinMi = (v, d) => typeof v === 'string' && d.test(v);

  // Ek bilgisini doğrular, geçersizse null. au: Hesap sırası (/mail/u/<n>/), th: İletinin kimliği (onaltılık).
  function ekTemizle(e) {
    if (!e || typeof e !== 'object') return null;
    const au = e.au == null ? null : e.au;
    if (au !== null && !(Number.isInteger(au) && au >= 0 && au < 100)) return null;
    if (!metinMi(e.ik, IK) || !metinMi(e.th, TH) || !metinMi(e.attid, ATTID)) return null;
    if (e.permmsgid != null && !metinMi(e.permmsgid, PERMMSGID)) return null;
    if (e.realattid != null && !metinMi(e.realattid, REALATTID)) return null;
    return { au, ik: e.ik, th: e.th, attid: e.attid, permmsgid: e.permmsgid == null ? null : e.permmsgid, realattid: e.realattid == null ? null : e.realattid };
  }

  // Gmail'in ek adresinden ek bilgisi. Gmail'in download_url'ündeki adres bazen "…/mail/u/1/https://mail.google.com/mail/u/1?ui=2…"
  // biçiminde (2026-10-26 ölçümü): Yalnız sorgu ve ilk hesap sırası okunur.
  function adrestenEk(adres) {
    const s = String(adres || '');
    const soru = s.indexOf('?');
    if (soru < 0 || !/^https:\/\/mail\.google\.com\/mail\//.test(s)) return null;
    const q = new URLSearchParams(s.slice(soru + 1).split('#')[0]);
    if (q.get('view') !== 'att') return null;
    const m = /\/mail\/u\/(\d{1,2})(?=[/?]|$)/.exec(s.slice(0, soru));
    return ekTemizle({
      au: m ? Number(m[1]) : null, ik: q.get('ik'), th: q.get('th'), attid: q.get('attid'),
      permmsgid: q.get('permmsgid'), realattid: q.get('realattid')
    });
  }

  // Ek kartı: download_url="<tür>:<ad>:<adres>" (ad yüzde kodlu) ya da kartın bağlantısı (href, adı yok).
  function kartBilgisi(oge) {
    if (!oge || typeof oge.getAttribute !== 'function') return null;
    const du = oge.getAttribute('download_url');
    if (du) {
      const i1 = du.indexOf(':');
      const i2 = du.indexOf(':https://mail.google.com/', i1 + 1);
      const ek = i1 > 0 && i2 > i1 ? adrestenEk(du.slice(i2 + 1)) : null;
      if (ek) {
        let ad = du.slice(i1 + 1, i2);
        try { ad = decodeURIComponent(ad); } catch { /* kodlanmamış ad */ }
        return { ...ek, ad: adTemizle(ad) };
      }
    }
    const href = oge.getAttribute('href');
    if (!href) return null;
    let tam;
    try { tam = new URL(href, 'https://mail.google.com/').href; } catch { return null; }
    const ek = adrestenEk(tam);
    return ek ? { ...ek, ad: null } : null;
  }

  // Bir iletinin ekleri (th: İletinin kimliği), sayfadaki sırayla. Yalnız adresinde bu iletinin kimliği geçen kartlar okunur,
  // sayfadaki öbür iletilerin kartlarına bakılmaz. Aynı ek (attid) bir kez. Adı bilinen kart (download_url) bağlantıdan önce
  // gelir.
  function ekListesi(belge, th) {
    if (!metinMi(th, TH)) return [];
    const ekler = new Map();
    for (const oge of belge.querySelectorAll(`[download_url*="th=${th}"], a[href*="view=att"][href*="th=${th}"]`)) {
      const e = kartBilgisi(oge);
      if (!e || e.th !== th) continue;
      const k = e.th + '|' + e.attid;
      const onceki = ekler.get(k);
      if (!onceki) ekler.set(k, e);
      else if (onceki.ad == null && e.ad != null) ekler.set(k, { ...onceki, ad: e.ad });   // Map sırası değişmez
    }
    return [...ekler.values()];
  }

  // Görüntüleyicinin bilgi öğesi (#drive-active-item-info) ya da null. Gmail'de öğe tektir ve görüntüleyicinin konumu sabit
  // kök katmanında, ekin kendi ana alanında durur (2026-10-26 ölçümü). Katman pencereyi kaplayan ayrı bir köktür, Gmail'in
  // kendi ana alanının (posta alanı, role=main) içinde durması beklenmez (ayrıca ölçülmedi, sahte Gmail de dışında kurar).
  // Bu yüzden yalnız böyle bir öğe kabul edilir: Katman bir ana alanın içinde olmamalı, öğeyle katman arasında en çok bir
  // ana alan bulunmalı. Böylece e-postanın gövdesine aynı kimlikle konmuş bir öğe (Gmail kimliği koruyorsa) konumu sabit
  // bir kabın içinde, kendi penceresi ve ana alanıyla da gösterilen dosya sayılmaz. Gmail'in kendi kabuğu konumu sabit
  // olsaydı (ölçülmedi) gövdedeki ana alansız öğe kabul edilirdi, ama posta alanı gömme yeri olmadığı için yalnız "UDF
  // olarak aç" düğmesi çıkardı (icerik.js gomulecekAlan). Belgede birden çok varsa hiçbirine güvenilmez.
  function bilgiOgesi(belge) {
    const bilgi = belge.getElementById('drive-active-item-info');
    if (!bilgi || belge.querySelectorAll('#drive-active-item-info').length !== 1) return null;
    const katman = sabitKatman(bilgi);
    if (!katman || (katman.parentElement && katman.parentElement.closest('[role="main"]'))) return null;
    let ana = 0;
    for (let e = bilgi.parentElement; e && e !== katman; e = e.parentElement) if (e.getAttribute('role') === 'main' && ++ana > 1) return null;
    return bilgi;
  }
  // Öğenin konumu sabit en yakın atası (body hariç) ya da null.
  function sabitKatman(oge) {
    const belge = oge.ownerDocument, w = belge.defaultView;
    for (let e = oge.parentElement; e && e !== belge.body; e = e.parentElement) if (w.getComputedStyle(e).position === 'fixed') return e;
    return null;
  }

  // Görüntüleyicinin gösterdiği öğe: { bilgi (öğe), id (Gmail ekinde boş), ad }.
  function gorunenOge(belge) {
    const bilgi = bilgiOgesi(belge);
    if (!bilgi) return null;
    let j;
    try { j = JSON.parse(bilgi.textContent || ''); } catch { return null; }
    if (!j || typeof j !== 'object' || typeof j.title !== 'string') return null;
    return { bilgi, id: typeof j.id === 'string' ? j.id : '', ad: adTemizle(j.title) };
  }

  // Etkin ana alanın, kardeş ana alanlar arasındaki sırası (görüntüleyicideki ek sırası), bulunamazsa -1.
  function etkinSira(bilgi) {
    const ana = bilgi && bilgi.closest('[role="main"]');
    if (!ana || !ana.parentElement) return -1;
    return [...ana.parentElement.children].filter(c => c.getAttribute('role') === 'main').indexOf(ana);
  }

  // Gmail'in ön izlemesinde gösterilen .udf eki: { ...ek, ad } ya da null (Gmail eki değil, .udf değil ya da hangi ek
  // olduğu kesin değil: Gmail'in kendi kartı kalır, başka bir belge gösterilmez). son: Bu ön izlemeyi açan ek kartının
  // iletisi ({ th }) ya da null. Yalnız bu iletinin ekleri okunur. Tıklama bilinmiyorsa (gelen kutusu listesindeki ek
  // düğmesi gibi kartsız açılış, ön izleme açıkken yenilenen sayfa) tahmin yapılmaz, sayfadaki öbür iletilere bakılmaz.
  function gosterilenEk(belge, son) {
    if (!son) return null;
    const o = gorunenOge(belge);
    if (!o || o.id || !udfAdiMi(o.ad)) return null;
    const sira = etkinSira(o.bilgi);
    const liste = ekListesi(belge, son.th);
    // Önce sıradaki ek (adı pencereninkiyle aynıysa ya da kartın adı bilinmiyorsa, yalnız bağlantısı olan kart), tutmazsa
    // iletide o adda tek ek varsa o.
    let bulunan = sira >= 0 ? liste[sira] : null;
    if (!bulunan || (bulunan.ad !== o.ad && bulunan.ad != null)) {
      const ayni = liste.filter(x => x.ad === o.ad);
      bulunan = ayni.length === 1 ? ayni[0] : null;
    }
    const ek = bulunan && ekTemizle(bulunan);
    return ek ? { ...ek, ad: o.ad } : null;
  }

  // Ekin indirme adresi, yalnız doğrulanmış değerlerden (Gmail'in kendi kartındaki sırayla).
  function indirmeAdresi(ek) {
    const e = ekTemizle(ek);
    if (!e) return null;
    const p = [['ui', '2'], ['ik', e.ik], ['attid', e.attid]];
    if (e.permmsgid) p.push(['permmsgid', e.permmsgid]);
    p.push(['th', e.th], ['view', 'att'], ['disp', 'safe']);
    if (e.realattid) p.push(['realattid', e.realattid]);
    const kok = e.au == null ? 'https://mail.google.com/mail/' : `https://mail.google.com/mail/u/${e.au}`;
    return `${kok}?${p.map(([k, v]) => `${k}=${v}`).join('&')}&zw`;
  }

  // Gmail sayfasının hesap sırası (/mail/u/<n>/).
  function sayfaHesabi(href) {
    let u;
    try { u = new URL(href); } catch { return null; }
    if (u.hostname !== 'mail.google.com') return null;
    const m = /^\/mail\/u\/(\d{1,2})(?:\/|$)/.exec(u.pathname);
    return m ? Number(m[1]) : null;
  }

  globalThis.GmailEk = Object.freeze({
    udfAdiMi, ekTemizle, adrestenEk, kartBilgisi, ekListesi, bilgiOgesi, sabitKatman, gorunenOge, etkinSira, gosterilenEk, indirmeAdresi, sayfaHesabi
  });
})();
