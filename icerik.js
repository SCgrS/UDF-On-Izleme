// Drive ve Gmail içerik betiği. Belge içeriğine dokunmaz. Drive'da yalnız ön izlemedeki dosyanın kimliğini, adını ve türünü,
// hesabını (adresten ya da og:url'den, sırası ya da adreste yazılıysa e-posta adresi), paylaşım bağlantısının kaynak
// anahtarını ve /file/ sayfasında sekme başlığını (.udf adı için) okur. Gmail'de yalnız ön izlemedeki dosyanın adını, açık
// e-postadaki ek kartlarının adlarını ve indirme bağlantılarını, hangi karta basıldığını ve basılan Drive bağlantısındaki
// dosya kimliğiyle kaynak anahtarını okur.
// Drive'ın ön izleme penceresi, /file/d/<id>/view sayfası ya da Gmail'in ek ön izlemesi (Drive'ınkiyle aynı görüntüleyici)
// bir .udf gösterirken belge, üst çubuğun altındaki alana gömülü görüntüleyicide (eklenti sayfası, iframe) açılır.
// Google'ın UDF için gösterdiği "önizlenemedi"/arşiv içeriği ve Drive'ın UDF'de işlemeyen "Yorum" düğmesi gizlenir. Üst
// çubuk, oklar, Esc ile kapanma aynen çalışır.
// Görüntüleyicinin yapısı tanınmazsa (Google değiştirirse) ya da belge gömülemezse (kayıt alınamadı, yeniden gömme sınırı)
// pencerenin üstünde "UDF olarak aç" düğmesi çıkar, belge yeni sekmede açılır. Gmail'de düğme de ancak görüntüleyicinin
// konumu sabit katmanı tanınırsa çıkar (GmailEk.bilgiOgesi): Katman tanınmazsa ne gömülür ne düğme çıkar, Gmail'in kendi
// kartı kalır. Bu, e-postanın gövdesine konmuş bir öğenin belgeyi tıklamasız göstermemesi için seçildi. Betik bir şey
// saklamaz.
(() => {
  'use strict';
  const baglamVar = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch { return false; } };
  // Eklenti güncellenip betik yeniden eklendiğinde eski kopyanın bağlamı geçersizdir: O zaman yenisi kurulur, eskisi
  // hiçbir olaya karışmaz.
  if (window.top !== window || (typeof globalThis.__udfOkuyucuIcerik === 'function' && globalThis.__udfOkuyucuIcerik())) return;
  globalThis.__udfOkuyucuIcerik = baglamVar;
  const K = globalThis.DriveKimlik, G = globalThis.GmailEk, D = globalThis.DriveIndir;
  if (!K || !G || !D) return;
  const GMAIL = location.hostname === 'mail.google.com';
  // Görüntüleyicinin bilgi öğesi (#drive-active-item-info). Gmail'de yalnız görüntüleyicinin katmanındaki tek öğe
  // (GmailEk.bilgiOgesi): E-postanın gövdesine aynı kimlikle konmuş bir öğe gösterilen dosya sayılmaz. Drive'da sayfaya
  // dışarıdan öğe konamaz.
  const bilgiOgesi = () => (GMAIL ? G.bilgiOgesi(document) : document.getElementById('drive-active-item-info'));

  // Eklenti chrome://extensions'tan kapatılınca, kaldırılınca ya da güncellenince bu betiğin bağlamı kopar: Belge artık
  // açılamaz, icerik.css ise sayfa yenilenene dek kalır.
  const yenile = () => uyar('UDF Ön İzleme kapatıldı, kaldırıldı ya da güncellendi. Sayfayı yenileyin (F5).');

  // Belgeyi yeni sekmede açar ("UDF olarak aç" düğmesi). Aynı belge 1,5 sn içinde bir kez açılır (çift tıklama). Yalnız son
  // açılan belge tutulur. Arka plan sekmeyi açtığını bildirince true döner: Google'ın ön izlemesi ancak o zaman kapatılır.
  // Sekme açılamazsa (arka plan yanıt vermedi ya da sekmeyi açamadı) ön izleme açık kalır, kısa bir uyarı çıkar, düğme
  // yeniden denenebilir.
  let sonAcilan = null;   // { id, zaman }
  async function ac(bilgi) {
    if (!bilgi || !(bilgi.kaynak === 'gmail' ? G.ekTemizle(bilgi.ek) : K.KIMLIK.test(String(bilgi.id || '')))) return false;
    const simdi = Date.now();
    if (sonAcilan && sonAcilan.id === bilgi.id && simdi - sonAcilan.zaman < 1500) return false;
    if (!baglamVar()) { yenile(); return false; }
    const acilan = sonAcilan = { id: bilgi.id, zaman: simdi };
    let y = null;
    try { y = await chrome.runtime.sendMessage({ tur: 'udf-ac', ...dosyaBilgisi(bilgi) }); } catch { /* bağlam koptu */ }
    if (y && y.tamam === true) return true;
    if (sonAcilan === acilan) sonAcilan = null;
    if (baglamVar()) uyar('Belge yeni sekmede açılamadı. Yeniden deneyin.');
    else yenile();
    return false;
  }

  // Arka plana gönderilen dosya bilgisi. Drive: Kimlik, ad, hesap (authuser, sırası ya da e-posta adresi) ve paylaşım
  // bağlantısının kaynak anahtarı. Gmail eki: Ad ve ekin indirme bilgisi (GmailEk).
  function dosyaBilgisi(bilgi) {
    if (bilgi.kaynak === 'gmail') return { kaynak: 'gmail', ad: String(bilgi.ad || '').slice(0, 300), ek: G.ekTemizle(bilgi.ek) };
    const adres = K.urldenBilgi(location.href) || {};
    return {
      id: bilgi.id, ad: String(bilgi.ad || '').slice(0, 300),
      au: Number.isInteger(bilgi.au) ? bilgi.au : (GMAIL ? G.sayfaHesabi(location.href) : K.sayfaHesabi(document, location.href)),
      rk: bilgi.rk || (adres.id === bilgi.id ? adres.rk : null)
    };
  }

  // Drive'ın ön izlemesi klavyeyle yönetilir (Esc kapatır, oklar öbür dosyaya geçer). Eş zamanlı sahte tuş olayı yeterli
  // (2026-10-06'da gerçek Drive'da ölçüldü).
  const TUS_KODU = { Escape: 27, ArrowLeft: 37, ArrowRight: 39 };
  function driveTusu(tus, hedef = document.activeElement || document.body) {
    for (const tur of ['keydown', 'keyup']) {
      hedef.dispatchEvent(new KeyboardEvent(tur, { key: tus, code: tus, keyCode: TUS_KODU[tus], which: TUS_KODU[tus], bubbles: true, cancelable: true, composed: true }));
    }
  }
  function onizlemeyiKapat() {
    if (bilgiOgesi()) driveTusu('Escape');
  }

  // Belge gömülüyken Ctrl+P Drive'ın değil belgenin yazdırmasıdır (odak Drive'ın çubuğundayken de).
  window.addEventListener('keydown', e => {
    if (!gomulu || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || String(e.key).toLowerCase() !== 'p') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    cerceveyeBildir(gomulu, { tur: 'yazdir' });
  }, true);

  // ---------------------------------------------------------------- düğme ve uyarı
  let kap = null, kok = null;
  function arayuz() {
    if (kap) return;
    kap = document.createElement('div');
    kap.style.setProperty('all', 'initial');
    kok = kap.attachShadow({ mode: 'closed' });
    const stil = new CSSStyleSheet();
    stil.replaceSync(`
      .dugme { position: fixed; z-index: 2147483647; top: 72px; left: 50%; transform: translateX(-50%);
        display: none; align-items: center; gap: 8px; height: 40px; padding: 0 18px 0 14px; border: 0; border-radius: 20px;
        background: #1a73e8; color: #fff; font: 600 14px/1 "Google Sans", "Segoe UI", system-ui, sans-serif; cursor: pointer;
        box-shadow: 0 2px 6px rgba(0,0,0,.3), 0 6px 18px rgba(0,0,0,.2); }
      .dugme:hover { background: #1765cc; }
      .dugme:focus-visible { outline: 3px solid #a8c7fa; outline-offset: 2px; }
      .dugme svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
      .gorunur { display: inline-flex; }
      .uyari { position: fixed; z-index: 2147483647; left: 50%; bottom: 28px; transform: translateX(-50%); max-width: 460px;
        background: #202124; color: #fff; padding: 10px 16px; border-radius: 8px; font: 14px/1.4 "Segoe UI", system-ui, sans-serif;
        box-shadow: 0 2px 8px rgba(0,0,0,.35); }
    `);
    kok.adoptedStyleSheets = [stil];
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'dugme';
    d.title = 'Bu UYAP belgesini UDF Ön İzleme ile yeni sekmede aç';
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6');
    svg.append(p);
    const yazi = document.createElement('span');
    yazi.textContent = 'UDF olarak aç';
    d.append(svg, yazi);
    for (const tur of ['pointerdown', 'mousedown', 'mouseup', 'dblclick', 'keydown']) d.addEventListener(tur, e => e.stopPropagation());
    d.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      if (!gosterilen || !e.isTrusted) return;   // belgeyi yalnız kullanıcının gerçek tıklaması açar
      ac(gosterilen).then(acildi => { if (acildi) onizlemeyiKapat(); });
    });
    kok.append(d);
    document.documentElement.append(kap);
  }
  let gosterilen = null;
  function dugmeGoster(bilgi) {
    arayuz();
    gosterilen = bilgi;
    kok.querySelector('.dugme').classList.add('gorunur');
  }
  function dugmeGizle() {
    gosterilen = null;
    if (kok) kok.querySelector('.dugme').classList.remove('gorunur');
  }
  function uyar(metin) {
    arayuz();
    const e = document.createElement('div');
    e.className = 'uyari';
    e.setAttribute('role', 'status');
    e.textContent = metin;
    kok.append(e);
    setTimeout(() => e.remove(), 6000);
  }

  // ---------------------------------------------------------------- Google'ın görüntüleyicisine gömme
  // Drive'ın görüntüleyicisi (2026-10-06 ölçümü): #drive-active-item-info, gösterilen dosyanın ana alanında
  // (role=main) durur. Ana alan katmanı kaplar, üst çubuklar ve öbür dosyaya geçiş okları onun dışında ve üstündedir.
  // Drive her dosya için yeni bir ana alan kurar, eskilerini gizli tutar. Gmail'in ek ön izlemesi aynı görüntüleyicidir
  // (2026-10-26 ölçümü: Konumu sabit katman, iki satırlı üst çubuk, düğmeler 104 px'te biter, oklar aynı yerde).
  const CERCEVE_SINIFI = 'udf-okuyucu-cerceve';
  const ANA_OZNITELIGI = 'data-udf-okuyucu-gomulu';
  const GIZLI_OZNITELIGI = 'data-udf-okuyucu-gizli';
  let gomulu = null;   // { id, ana, cerceve, ust, sag, koken, gizlenen, anahtar }

  // Çerçeve ana alanın gölge kökünde (shadow root) durur: Google'ın görüntüleyicisi ana alanın çocuklarını yeniden çizerse
  // kendisinin koymadığı çocuğu (çerçeveyi) silebilir, belge yeniden kaydedilip indirilirdi. Google'ın kodu gölge köküne
  // dokunmaz. Bu bir önlemdir: Gerçek Drive ve Gmail'de belge ellişer saniye yerinde kaldı (2026-10-27, DRIVE-TEKNIGI.md
  // §14). Kökteki <slot> Google'ın kendi içeriğini gösterir, belge gömülüyken o içerik kökün stiliyle gizlenir: Gölge
  // ağacının !important'ı sayfanınkini yener (CSS Cascade 4, bağlam). Ana alana gölge kökü eklenemezse (başka bir kökü
  // varsa) çerçeve ana alanın çocuğu olur, içeriği icerik.css gizler. Ana alanın işareti (ANA_OZNITELIGI) iki yolda da konur.
  const golgeler = new WeakMap();   // ana alan → gölge kökü (eklenemediyse null)
  const CERCEVE_STILI = new CSSStyleSheet(), GIZLE_STILI = new CSSStyleSheet();
  CERCEVE_STILI.replaceSync(`iframe.${CERCEVE_SINIFI} { position: absolute !important; left: 0 !important; right: auto !important;
    bottom: auto !important; width: 100% !important; min-width: 0 !important; max-width: none !important; min-height: 0 !important;
    max-height: none !important; margin: 0 !important; padding: 0 !important; border: 0 !important; display: block !important;
    visibility: visible !important; opacity: 1 !important; background: transparent !important; color-scheme: light !important;
    z-index: 1 !important; }`);
  GIZLE_STILI.replaceSync('::slotted(*) { visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }');
  function golgeKoku(ana) {
    if (golgeler.has(ana)) return golgeler.get(ana);
    let kok = null;
    try {
      kok = ana.attachShadow({ mode: 'open' });
      kok.append(document.createElement('slot'));
      kok.adoptedStyleSheets = [CERCEVE_STILI];
    } catch { kok = null; }
    golgeler.set(ana, kok);
    return kok;
  }
  // Google'ın içeriği belge gömülüyken gizli, değilken (aynı ana alanda başka bir dosya gösterilince) görünür.
  function icerigiGizle(ana, gizle) {
    const kok = golgeler.get(ana);
    if (kok) kok.adoptedStyleSheets = gizle ? [CERCEVE_STILI, GIZLE_STILI] : [CERCEVE_STILI];
    if (gizle) { if (!ana.hasAttribute(ANA_OZNITELIGI)) ana.setAttribute(ANA_OZNITELIGI, ''); }
    else ana.removeAttribute(ANA_OZNITELIGI);
  }

  // Hedef hâlâ görüntüleyicide mi: Drive dosyasında kimlik, Gmail ekinde (kimlik boş) ad aynı.
  function gosteriliyor(h) {
    if (h.kaynak === 'gmail') {
      const o = G.gorunenOge(document);
      return !!o && !o.id && o.ad === h.ad;
    }
    const oge = K.aktifOge(document, bilgiOgesi());
    return !!oge && oge.id === h.id;
  }

  // Gmail'de ana alan görüntüleyicinin konumu sabit katmanında ve penceresinde (role=dialog) olmalı (2026-10-26 ölçümü):
  // Gmail'in kendi ana alanı (posta kutusu, role=main) hiçbir durumda gömme yeri olmaz.
  function gomulecekAlan(h) {
    const bilgi = bilgiOgesi();
    if (!bilgi || !gosteriliyor(h)) return null;
    const ana = bilgi.closest('[role="main"]');
    if (GMAIL && ana) {
      const katman = G.sabitKatman(bilgi);
      if (!katman || !katman.contains(ana) || !ana.closest('[role="dialog"]')) return null;
    }
    const r = ana && ana.getBoundingClientRect();
    return r && r.width >= 200 && r.height >= 200 ? ana : null;
  }

  // Görüntüleyicinin kökü: Ana alanın konumu sabit en yakın atası (ön izleme katmanı ya da dosya sayfasının kabı).
  function katmanKoku(ana) {
    for (let e = ana.parentElement; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') return e;
    return document.body;
  }

  // Drive'ın üst çubuklarının alt kenarı (ana alana göre): Görünür düğmelerden en alttakinin 8 px altı. Çubukların
  // boş yerleri fareyi geçirdiği (elementFromPoint ana alanı bulur) ve görüntüleyicinin eski kopyaları DOM'da gizli
  // durduğu için görünürlük denetlenir, sınıf adları kullanılmaz. Ölçüm: İki satırlı çubuk, düğmeler 104 px'te
  // biter, Drive'ın belge alanı 112 px'te başlar. Ortadaki oklar 160 px sınırının dışında kalır.
  const UST_DENETIMLER = 'button, [role="button"], [role="menuitem"], [role="menubar"], [role="toolbar"], input';
  // checkVisibility seçenekleri iki adıyla: visibilityProperty ve opacityProperty Chrome 121'den beri, öncesinde (en düşük
  // sürüm 116) checkVisibilityCSS ve checkOpacity. Tanımadığı adı tarayıcı yok sayar.
  const GORUNUR = { visibilityProperty: true, checkVisibilityCSS: true };
  const GORUNUR_VE_OPAK = { ...GORUNUR, opacityProperty: true, checkOpacity: true };
  function cubukAlti(ana) {
    const ar = ana.getBoundingClientRect();
    let alt = null;
    for (const d of katmanKoku(ana).querySelectorAll(UST_DENETIMLER)) {
      if (ana.contains(d)) continue;
      const r = d.getBoundingClientRect();
      if (!r.width || !r.height || r.height >= 80 || r.top < ar.top - 1 || r.top - ar.top >= 160) continue;
      if (d.checkVisibility && !d.checkVisibility(GORUNUR_VE_OPAK)) continue;
      alt = Math.max(alt == null ? 0 : alt, r.bottom);
    }
    return alt == null ? 64 : Math.max(0, Math.round(Math.min(alt - ar.top + 8, ar.height / 2)));
  }

  // Drive'ın sağdaki "sonraki" oku (z-index 5) çerçevenin üstünde durur. Görüntüleyicinin not bölmesi onun altında
  // kalırsa nota basmak isteyen kullanıcı başka dosyaya geçer. Bu yüzden okun kapladığı sağ şeridin genişliği çerçeveye
  // bildirilir, bölme o kadar içeride durur. Ok: Üst çubukların altında, ana alanın sağ kenarına yakın görünür denetim
  // (dile bağlı aria-label kullanılmaz). Gerçek Drive'da görünen düğme 40 px, sağ kenardan 28 px içeride, tıklama alanı
  // onun 12 px dışına taşıyor (2026-10-06): Pay 16 px.
  // Drive okları bir süre sonra soldurabildiği için saydamlığa bakılmaz ve ölçü bu gömme boyunca küçülmez (bölme
  // ok gidip geldikçe kaymasın).
  function sagBosluk(ana) {
    const ar = ana.getBoundingClientRect();
    let bosluk = 0;
    for (const d of katmanKoku(ana).querySelectorAll(UST_DENETIMLER)) {
      if (ana.contains(d)) continue;
      const r = d.getBoundingClientRect();
      if (!r.width || !r.height || r.height >= 200 || r.top - ar.top < 160 || r.bottom > ar.bottom + 1) continue;
      if (ar.right - r.right > 40 || r.left - ar.left < ar.width / 2) continue;
      if (d.checkVisibility && !d.checkVisibility(GORUNUR)) continue;
      bosluk = Math.max(bosluk, ar.right - r.left);
    }
    return bosluk ? Math.min(160, Math.round(bosluk + 16)) : 0;
  }

  // Drive'ın üst çubuğundaki "Yorum" düğmesi (ikinci satırda, İndir'in yanında) UDF'de işlemez: Belge eklentinin çerçevesinde
  // durduğu için yorumun yeri seçilemez (kullanıcı, 2026-10-27: "gereksiz işlev, çalışmıyor zaten"). Belge gömülüyken
  // gizlenir, kalkınca geri gelir. Düğme adından tanınır (2026-10-27 ölçümü: aria-label "Yorum ekleyin", yazısı "Yorum",
  // İngilizce arayüz için "Comment"). Yalnız üst çubuklardaki düğmelere bakılır, menü öğelerine dokunulmaz. Google düğmeyi
  // yeniden çizerse yenisi bir sonraki denetimde gizlenir.
  const YORUM = /^(yorum|comment|add a comment)\b/i;
  function yorumuGizle(g) {
    const ar = g.ana.getBoundingClientRect();
    for (const d of katmanKoku(g.ana).querySelectorAll('button, [role="button"]')) {
      if (g.ana.contains(d) || d.hasAttribute(GIZLI_OZNITELIGI) || d.closest('[role="menu"], [role="menubar"]')) continue;
      const ad = (d.getAttribute('aria-label') || d.textContent || '').trim();
      if (!YORUM.test(ad)) continue;
      const r = d.getBoundingClientRect();
      if (!r.width || !r.height || r.top < ar.top + 40 || r.top - ar.top >= 160) continue;
      d.setAttribute(GIZLI_OZNITELIGI, '');
      g.gizlenen.add(d);
    }
  }

  function konumla() {
    if (!gomulu || !gomulu.ana.isConnected) return;
    yorumuGizle(gomulu);
    const ust = cubukAlti(gomulu.ana);
    if (ust !== gomulu.ust) {
      gomulu.ust = ust;
      gomulu.cerceve.style.setProperty('top', ust + 'px', 'important');
      gomulu.cerceve.style.setProperty('height', `calc(100% - ${ust}px)`, 'important');
    }
    const sag = Math.max(gomulu.sag, sagBosluk(gomulu.ana));
    if (sag !== gomulu.sag) {
      gomulu.sag = sag;
      cerceveyeBildir(gomulu, { tur: 'sag-bosluk', px: sag });
    }
  }

  // Çerçeve kaldırılınca onun Gmail eki de bırakılır: Süren indirmesi kesilir, baytları sıfırlanır (gmailBirak).
  function gomuluKaldir() {
    const g = gomulu;
    if (!g) return;
    gomulu = null;
    g.cerceve.remove();
    if (g.anahtar) gmailBirak(g.anahtar);
    icerigiGizle(g.ana, false);
    // İşaretlenen düğmeler, ayrıca Google düğmeyi işaretli öğeden kopyaladıysa o kopya da (sayfada işaret yalnız eklentinin).
    for (const d of g.gizlenen) d.removeAttribute(GIZLI_OZNITELIGI);
    for (const d of document.querySelectorAll(`[${GIZLI_OZNITELIGI}]`)) d.removeAttribute(GIZLI_OZNITELIGI);
  }

  async function gom(h, ana) {
    if (gomulu && gomulu.id === h.id && gomulu.ana === ana && (gomulu.cerceve.isConnected || !gomulu.cerceve.src)) {
      icerigiGizle(ana, true);
      konumla();
      return;
    }
    // Aynı dosya kendi gömmemizin yerine yeniden gömülürse (çerçeve ana alandan silindi ya da Google ana alanı yeniden kurdu)
    // her seferinde kayıt, indirme ve belgenin yüklenmesi yinelenir: Bu, 10 sn içinde en çok üç kez olur. Sınır aşılınca bu
    // dosya için "UDF olarak aç" düğmesi çıkar (kayıt alınamayınca olduğu gibi). Öbür dosyaya geçip dönmek sayılmaz. Sayaç ön
    // izleme kapanınca ya da .udf olmayan bir dosya gösterilince sıfırlanır.
    if (gomulu && gomulu.id === h.id) {
      const simdi = Date.now();
      if (yenidenGomme.id !== h.id) yenidenGomme = { id: h.id, zamanlar: [] };
      yenidenGomme.zamanlar = yenidenGomme.zamanlar.filter(z => simdi - z < YENIDEN_GOMME_SURESI);
      if (yenidenGomme.zamanlar.length >= YENIDEN_GOMME_EN_COK) {
        kayitHatasiId = h.id;
        gomuluKaldir();
        dugmeGoster(h);
        return;
      }
      yenidenGomme.zamanlar.push(simdi);
    }
    gomuluKaldir();
    const cerceve = document.createElement('iframe');
    cerceve.className = CERCEVE_SINIFI;
    cerceve.title = 'UDF belgesi';
    // Renk düzeni satır içinde: Dark Reader her çerçeveye adsız bir @layer içinde `color-scheme: dark !important` veriyor.
    // Katmanlı !important, seçicisi ne olursa olsun katmansız icerik.css'i yener. Satır içi !important ise katmandan
    // önce gelir. Çerçeve içindeki sayfayla (açık düzen) aynı düzende olmayınca Chrome arkasını opak beyaz boyuyordu.
    // Değer "normal" değil "light": "normal" Drive sayfasının <meta name="color-scheme"> etiketine göre çözülür
    // (DRIVE-TEKNIGI.md §8).
    cerceve.style.setProperty('color-scheme', 'light', 'important');
    const g = { id: h.id, ana, cerceve, ust: null, sag: 0, koken: null, gizlenen: new Set() };
    gomulu = g;
    const golge = golgeKoku(ana);
    icerigiGizle(ana, true);   // Drive'ın arşiv görünümü hemen gizlenir
    let anahtar = null;
    if (baglamVar()) {
      try { anahtar = ((await chrome.runtime.sendMessage({ tur: 'gomulu-kayit', ...dosyaBilgisi(h) })) || {}).anahtar; } catch { /* bağlam koptu */ }
    }
    if (gomulu !== g) return;
    if (!anahtar || !/^[0-9a-f-]{36}$/.test(anahtar)) {
      // Kayıt alınamadı: Bu dosya için yeniden denenmez (her DOM değişikliğinde yinelenmesin), düğme yeni sekmede açar.
      kayitHatasiId = h.id;
      gomuluKaldir();
      if (baglamVar()) dugmeGoster(h);
      return;
    }
    g.anahtar = anahtar;
    // Adres ilk eklemeden önce verilir: Sonradan değiştirilen src tarayıcı geçmişine kayıt ekler (geri tuşu bozulur).
    // "u=g": Çerçeve Gmail'in içinde, iletilerini Gmail kökenine gönderir (goruntule.js, UST_KOKEN).
    cerceve.src = chrome.runtime.getURL('gomulu.html') + `#t=${anahtar}${GMAIL ? '&u=g' : ''}`;
    konumla();
    cerceve.addEventListener('load', () => {
      // Odak hâlâ Drive'ın görüntüleyicisindeyse belgeye geçer: Kaydırma tuşları belgeyi kaydırır, Esc ve oklar
      // görüntüleyiciden Drive'a iletilir.
      const odak = document.activeElement;
      if (gomulu === g && (!odak || odak === document.body || katmanKoku(ana).contains(odak))) cerceve.focus();
    }, { once: true });
    (golge || ana).append(cerceve);
  }

  // Drive ve Gmail sekmesinin başlığına dokunulmaz. "PDF olarak kaydet" önerilen adı yazdırılan çerçevenin değil sekmenin
  // başlığından alır. Ama Drive klasörler arasında pushState ile gezindiği için Chrome sonraki her başlık değişikliğini
  // tarayıcı geçmişine yazar: Belge adı (müvekkil adı, esas no) geçmişe düşerdi (DRIVE-TEKNIGI.md §6.3). Gmail de tek
  // sayfalık uygulamadır. PDF'e sekmenin başlığı önerilir, belge adı kaydederken yazılır.
  function cerceveyeBildir(g, ileti) {
    if (!g || !g.koken || !g.cerceve.contentWindow) return;
    g.cerceve.contentWindow.postMessage({ udfOkuyucu: 1, ...ileti }, g.koken);
  }

  // Gömülü görüntüleyiciden gelen iletiler: Yalnız kendi çerçevemizden, tanınan türler.
  window.addEventListener('message', e => {
    const g = gomulu;
    if (!g || e.source !== g.cerceve.contentWindow || !/^chrome-extension:\/\//.test(e.origin)) return;
    const m = e.data;
    if (!m || typeof m !== 'object' || m.udfOkuyucu !== 1) return;
    if (m.tur === 'hazir') {
      g.koken = e.origin;
      if (g.sag) cerceveyeBildir(g, { tur: 'sag-bosluk', px: g.sag });
    }
    else if (m.tur === 'tus' && Object.hasOwn(TUS_KODU, m.tus)) driveTusu(m.tus, g.cerceve);
  });
  window.addEventListener('resize', () => { if (gomulu) konumla(); });

  // ---------------------------------------------------------------- Gmail ekleri
  // Gmail'in ön izlemesinde hangi ekin gösterildiği adresten anlaşılmaz (GmailEk.gosterilenEk): Ön izlemeyi açan ek
  // kartının iletisi gerekir. Kart tıklaması zamanıyla tutulur (tıklamaya karışılmaz). Ön izleme açıldığı anda son 5 sn'deki
  // tıklama o ön izlemenin tıklamasıdır, ön izleme kapanınca unutulur. Kartsız açılan ön izlemede (gelen kutusu
  // listesindeki ek düğmesi) eski bir tıklama ya da sayfadaki başka bir ileti kullanılmaz: Gmail'in kendi kartı kalır.
  // Tıklamasız tahmin yalnız sayfa ön izlemenin adresiyle açıldıysa (ön izleme açıkken yenilendi), ilk ön izlemede.
  // Kapanış gözlemcinin geri çağrısında hemen işlenir: Ön izleme kapanıp hemen başka bir kartla açılınca yeni tıklama yeni
  // ön izlemenindir, kapanıştan önceki bir tıklama sonrakine geçmez. Açılış, tıklama görüldüyse hemen (erken denetim),
  // görülmediyse bekleyen denetimde işlenir: Gmail ön izlemeyi tıklama olayı bize ulaşmadan açarsa tıklama kaçmasın.
  // Kapanıştan sonra 150 ms içinde, kapanan ön izlemenin konumu sabit katmanında tıklamasız yeniden beliren ön izleme aynı
  // ön izlemedir (Google bilgi öğesini bir an kaldırdı): Tıklaması ve tahmin izni geri gelir. Gmail gezinirken katmanı
  // korur (ana alanları aynı pencereye gerektikçe ekler, DRIVE-TEKNIGI.md §11.1). Yeni bir katmanda açılan ön izleme
  // (kartsız açılış ya da tıklaması toplu denetime dek görülmemiş açılış) önceki tıklamayı almaz.
  const YENIDEN_KURMA = 150;
  let sonTiklanan = null;          // { th, zaman }
  let onizlemeTiklamasi = null;    // açık ön izlemeyi açan tıklama
  let onizlemeAcik = false, tiklamasizOlur = false;
  let onizlemeKatmani = null;      // açık ön izlemenin konumu sabit katmanı (GmailEk.sabitKatman)
  let kapanan = null;              // son kapanan ön izleme: { tiklama, tiklamasizOlur, zaman, katman }
  let belirdi = 0;                 // bilgi öğesinin sayfada en son belirdiği an (gözlemci)
  let sonDriveBaglantisi = null;   // { id, rk }: Gmail'de basılan son Drive bağlantısı (hedefBul)
  let yenilemeOnizlemesi = GMAIL && /[?&]projector=/.test(location.hash);
  if (GMAIL) {
    // Ön indirme yalnız kullanıcının gerçek girişiyle (isTrusted) başlar: Sayfanın betiğinin ürettiği olay ek indirtmez.
    // Tıklamanın tutulması (hangi iletinin kartı) olduğu gibi kalır: O, Gmail'in açtığı ön izlemeyi tanımak içindir.
    const yalin = e => !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey;
    const gercek = e => e.isTrusted === true;
    // Adı .udf olan ek kartı (ad download_url'den okunur, yalnız bağlantısı olan kartın adı bilinmez).
    const udfKarti = e => {
      const kart = e.target instanceof Element ? e.target.closest('[download_url]') : null;
      const b = kart && G.kartBilgisi(kart);
      return b && G.udfAdiMi(b.ad) ? b : null;
    };
    // Basılan Drive bağlantısı (iletideki drive.google.com/file/d/<id>/… adresi, kullanıcının gerçek tıklaması): Kaynak
    // anahtarı yalnız aynı kimlikli dosya Gmail'in ön izlemesinde gösterilince kullanılır (hedefBul). Yalnız son basılanın
    // kimliği ve kaynak anahtarı tutulur.
    const driveBaglantisi = e => {
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
      const b = a && K.urldenBilgi(a.href);
      if (b && b.id && b.rk) sonDriveBaglantisi = { id: b.id, rk: b.rk };
    };
    const kartTiklandi = e => {
      const kart = e.target instanceof Element ? e.target.closest('[download_url], a[href*="view=att"]') : null;
      const b = kart && G.kartBilgisi(kart);
      if (b) sonTiklanan = { th: b.th, zaman: Date.now() };
      if (gercek(e) && yalin(e)) { onIndir(udfKarti(e)); driveBaglantisi(e); }
    };
    document.addEventListener('pointerdown', e => { if (gercek(e) && e.isPrimary && e.button === 0 && yalin(e)) onIndir(udfKarti(e)); }, true);
    document.addEventListener('click', kartTiklandi, true);
    document.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') kartTiklandi(e); }, true);
  }
  const tiklamaGecerli = () => !!sonTiklanan && Date.now() - sonTiklanan.zaman < 5000 && !(kapanan && sonTiklanan.zaman < kapanan.zaman);
  // bilgi: Ön izlemenin doğrulanmış bilgi öğesi (bilgiOgesi) ya da null (ön izleme kapalı).
  function onizlemeyiIzle(bilgi) {
    const acik = !!bilgi;
    if (acik && !onizlemeAcik) {
      const katman = G.sabitKatman(bilgi);
      if (tiklamaGecerli()) {
        onizlemeTiklamasi = { th: sonTiklanan.th };
        tiklamasizOlur = yenilemeOnizlemesi;
      } else if (kapanan && kapanan.katman && kapanan.katman === katman && belirdi >= kapanan.zaman && belirdi - kapanan.zaman < YENIDEN_KURMA) {
        onizlemeTiklamasi = kapanan.tiklama;
        tiklamasizOlur = kapanan.tiklamasizOlur;
      } else {
        onizlemeTiklamasi = null;
        tiklamasizOlur = yenilemeOnizlemesi;
      }
      // Tıklama yalnız açtığı ön izlemenindir: Bu ön izleme kapanıp 5 sn dolmadan kartsız açılan bir sonrakine (listedeki ek
      // düğmesi) geçmez. Yoksa orada aynı adlı başka bir ekin belgesi gösterilirdi (sahte Gmail sınaması, G14).
      sonTiklanan = null;
      kapanan = null;
      onizlemeKatmani = katman;
    }
    if (!acik && onizlemeAcik) {
      kapanan = { tiklama: onizlemeTiklamasi, tiklamasizOlur, zaman: Date.now(), katman: onizlemeKatmani };
      onizlemeKatmani = null;
      onizlemeTiklamasi = null;
      tiklamasizOlur = false;
      yenilemeOnizlemesi = false;
    }
    if (!acik && !/[?&]projector=/.test(location.hash)) yenilemeOnizlemesi = false;
    onizlemeAcik = acik;
  }

  // Arka plandan (görüntüleyicinin isteğiyle): Gmail ekini bu sayfanın içinden indirir (DriveIndir.gmailEkIndir), baytları
  // 1 MB'lık base64 dilimlerle verir. Baytlar son dilim verilene ya da en çok 15 sn tutulur, bırakılırken sıfırlanır. Aynı
  // anda en çok üç anahtarın baytları tutulur, sınır aşılınca en eskisi bırakılır. Süren her indirme izlenir ve kesilebilir
  // (AbortController): Aynı anahtarla yeni istek gelince ("Yeniden dene") öncekinin, çerçeve kaldırılınca (gomuluKaldir)
  // onun anahtarının indirmesi kesilir. Kesilen indirmenin baytları tutulmaz, sıfırlanır.
  // İletiler yalnız eklentinin arka planından gelir (sekmesiz gönderen). İndirme adresi yalnız doğrulanmış ek bilgisinden
  // kurulur.
  const GMAIL_DILIM = 1 << 20, BAYT_SURESI = 15000, BAYT_EN_COK = 3;
  const gmailBaytlari = new Map();   // anahtar → { bayt, sure }
  const gmailSurenler = new Map();   // anahtar → AbortController: Görüntüleyicinin istediği, süren indirme
  function gmailBirak(anahtar) {
    const s = gmailSurenler.get(anahtar);
    if (s) { gmailSurenler.delete(anahtar); s.abort(); }
    const y = gmailBaytlari.get(anahtar);
    if (y) { clearTimeout(y.sure); gmailBaytlari.delete(anahtar); y.bayt.fill(0); }
  }
  const ekIndir = (adres, signal) => D.gmailEkIndir(adres, { signal }).then(r => ({ bayt: r.bayt }), e => ({ hata: (e && typeof e.kod === 'string' && e.kod) || 'AG' }));
  async function gmailIndir(anahtar, ek) {
    const adres = G.indirmeAdresi(ek);
    if (!adres) return { hata: 'KIMLIK' };
    gmailBirak(anahtar);
    // Kart basılınca başlayan indirme varsa o kullanılır (bir kez): Ek bir açılışta yalnız bir kez indirilir.
    const on = onAl(adres);
    const iptal = on ? on.iptal : new AbortController();
    gmailSurenler.set(anahtar, iptal);
    const y = await (on ? on.soz : ekIndir(adres, iptal.signal));
    if (gmailSurenler.get(anahtar) === iptal) gmailSurenler.delete(anahtar);
    if (iptal.signal.aborted) { if (y.bayt) y.bayt.fill(0); return { hata: 'AG' }; }
    if (!y.bayt) return { hata: y.hata };
    while (gmailBaytlari.size >= BAYT_EN_COK) gmailBirak(gmailBaytlari.keys().next().value);
    gmailBaytlari.set(anahtar, { bayt: y.bayt, sure: setTimeout(() => gmailBirak(anahtar), BAYT_SURESI) });
    return { uzunluk: y.bayt.length, dilim: GMAIL_DILIM };
  }

  // Ön indirme: Gmail'de .udf ek kartına basılınca (fare basışı, tıklama, Enter ya da boşluk, üstüne gelmek değil, yalnız
  // kullanıcının gerçek girişi) ek hemen indirilmeye başlar. Gerçek Gmail'de küçük bir ek de, boyundan bağımsız, ~500 ms'de
  // iniyor (302 ve imzalı adres): Bu süre Gmail ön izlemeyi açarken ve gömülü görüntüleyici yüklenirken geçer. Görüntüleyici
  // aynı eki isteyince (gmail-indir) bu indirme kullanılır. Kullanılmayan indirme (kart basıldı ama ön izleme açılmadı) 15 sn
  // sonra bırakılır. Aynı anda en çok üç tutulur, sınır aşılınca en eskisi bırakılır. Bırakılan indirme sürüyorsa kesilir
  // (AbortController), inmiş baytları sıfırlanır. Service worker da bu anda uyandırılır: Gömme kaydı (gomulu-kayit) onun
  // açılmasını beklemesin.
  const ON_SURE = 15000, ON_EN_COK = 3;
  const onIndirmeler = new Map();   // indirme adresi → { soz, iptal, sure }
  // Görüntüleyicinin istediği ön indirmeyi listeden alır (baytlarını ve kesilmesini artık gmailIndir yönetir).
  function onAl(adres) {
    const o = onIndirmeler.get(adres);
    if (o) { clearTimeout(o.sure); onIndirmeler.delete(adres); }
    return o || null;
  }
  // Kullanılmayan ön indirmeyi bırakır: Süren indirme kesilir, inmiş baytlar sıfırlanır.
  function onBirak(adres) {
    const o = onAl(adres);
    if (!o) return;
    o.iptal.abort();
    o.soz.then(y => { if (y.bayt) y.bayt.fill(0); });
  }
  function onIndir(b) {
    if (!b || !baglamVar()) return;
    const adres = G.indirmeAdresi(b);
    if (!adres || onIndirmeler.has(adres)) return;
    while (onIndirmeler.size >= ON_EN_COK) onBirak(onIndirmeler.keys().next().value);
    const iptal = new AbortController();
    onIndirmeler.set(adres, { soz: ekIndir(adres, iptal.signal), iptal, sure: setTimeout(() => onBirak(adres), ON_SURE) });
    try { chrome.runtime.sendMessage({ tur: 'uyan' }).catch(() => {}); } catch { /* bağlam koptu */ }
  }
  function gmailDilimi(anahtar, i) {
    const y = gmailBaytlari.get(anahtar);
    if (!y || !Number.isInteger(i) || i < 0 || i * GMAIL_DILIM >= y.bayt.length) return { hata: 'AG' };
    const parca = D.base64(y.bayt.subarray(i * GMAIL_DILIM, (i + 1) * GMAIL_DILIM));
    if ((i + 1) * GMAIL_DILIM >= y.bayt.length) gmailBirak(anahtar);
    return { parca };
  }
  if (GMAIL) {
    try {
      chrome.runtime.onMessage.addListener((ileti, gonderen, yanit) => {
        if (!ileti || gonderen.id !== chrome.runtime.id || gonderen.tab || !/^[0-9a-f-]{36}$/.test(String(ileti.anahtar || ''))) return;
        if (ileti.tur === 'gmail-indir') {
          gmailIndir(ileti.anahtar, ileti.ek).then(yanit, () => yanit({ hata: 'AG' }));
          return true;
        }
        if (ileti.tur === 'gmail-dilim') yanit(gmailDilimi(ileti.anahtar, ileti.i));
      });
    } catch { /* eklenti bağlamı yok */ }
  }

  // ---------------------------------------------------------------- ön izleme ve dosya sayfası
  // Görünen .udf: Ön izlemedeki öğe (Drive dosyası, Gmail'de iletideki Drive bağlantısı da), Gmail'de ek ya da adresteki
  // dosya (paylaşım bağlantısı). Kaynak anahtarı adresten (aynı dosyanın sayfası), Gmail'de basılan aynı kimlikli Drive
  // bağlantısından alınır. Drive'ın klasör görünümünde dosyanın kaynak anahtarı bilinmez.
  function hedefBul() {
    const oge = K.aktifOge(document, bilgiOgesi());
    const sayfa = K.urldenBilgi(location.href);
    if (oge && K.udfAdiMi(oge.ad)) {
      const ayni = sayfa && sayfa.id === oge.id;
      const baglanti = GMAIL && sonDriveBaglantisi && sonDriveBaglantisi.id === oge.id ? sonDriveBaglantisi : null;
      return { id: oge.id, ad: oge.ad, rk: ayni ? sayfa.rk : baglanti ? baglanti.rk : null, au: ayni ? sayfa.au : null };
    }
    if (GMAIL) {
      const ek = G.gosterilenEk(document, onizlemeTiklamasi, { tiklamasizOlur });
      return ek ? { kaynak: 'gmail', id: `gmail:${ek.th}:${ek.attid}`, ad: ek.ad, ek } : null;
    }
    if (sayfa && sayfa.id && /\/file\//.test(location.pathname)) {
      const ad = (oge && oge.id === sayfa.id ? oge.ad : null) || K.basliktanAd(document.title);
      if (K.udfAdiMi(ad)) return { id: sayfa.id, ad, rk: sayfa.rk, au: sayfa.au };
    }
    return null;
  }

  let kayitHatasiId = null;   // gömmek için kayıt alınamayan ya da yeniden gömme sınırını aşan dosya
  let uyarilanId = null;      // eklenti bağlamı koptuktan sonra "yenileyin" uyarısı gösterilen dosya
  const YENIDEN_GOMME_SURESI = 10000, YENIDEN_GOMME_EN_COK = 3;
  let yenidenGomme = { id: null, zamanlar: [] };   // aynı dosyanın yeniden gömülme anları (gom)
  // erken: Ön izleme az önce açıldı (gözlemci 150 ms beklemeden çağırır). Yalnız her şey hazırsa gömülür: Gösterilen dosya
  // belli ve ana alan ölçülebiliyor. Değilse hiçbir şey değişmez, bekleyen denetim karar verir (görüntüleyici yerleşirken
  // "UDF olarak aç" düğmesi bir an bile çıkmasın). Gmail'de ön izlemeyi açan kart tıklaması henüz görülmediyse (Gmail ön
  // izlemeyi tıklama olayı bize ulaşmadan açtıysa) erken denetim yapılmaz: Tıklama ön izlemenin açıldığı anda tutulur
  // (onizlemeyiIzle), erken bakılırsa kaçardı.
  function denetle(erken = false) {
    if (erken) {
      if (!baglamVar()) return;
      if (GMAIL && !yenilemeOnizlemesi && !tiklamaGecerli()) return;
      if (GMAIL) onizlemeyiIzle(bilgiOgesi());
      const h = hedefBul();
      const ana = h && kayitHatasiId !== h.id ? gomulecekAlan(h) : null;
      if (ana) { dugmeGizle(); gom(h, ana); }
      return;
    }
    if (GMAIL) onizlemeyiIzle(bilgiOgesi());
    if (!baglamVar()) {
      // Eklenti kapatıldı, kaldırıldı ya da güncellendi: Bu kopya artık belge açamaz, güncellenen eklentinin betiği ancak
      // sayfa yenilenince gelir. Görünen her .udf için bir kez "yenileyin" uyarısı çıkar.
      dugmeGizle();
      gomuluKaldir();
      if (globalThis.__udfOkuyucuIcerik !== baglamVar) { gozlemci.disconnect(); return; }
      const h = hedefBul();
      if (h && h.id !== uyarilanId) { uyarilanId = h.id; yenile(); }
      return;
    }
    const h = hedefBul();
    if (!h) { kayitHatasiId = null; yenidenGomme = { id: null, zamanlar: [] }; dugmeGizle(); gomuluKaldir(); return; }
    const ana = kayitHatasiId === h.id ? null : gomulecekAlan(h);
    if (ana) { dugmeGizle(); gom(h, ana); return; }
    // Görüntüleyicinin yapısı tanınmazsa (Drive değişirse) belge yine açılabilsin: Düğme yeni sekmede açar.
    gomuluKaldir();
    dugmeGoster(h);
  }

  // DOM değişiklikleri 150 ms toplanıp bir kez denetlenir (Gmail'in yoğun DOM'unda iş az kalsın). Ön izleme yeni açıldıysa
  // (#drive-active-item-info belirdi) belge beklemeden gömülür: Bekleme her açılışa 150 ms eklerdi. Gmail'de ön izlemenin
  // kapanışı da beklemeden işlenir (onizlemeyiIzle). Geri çağrı ön izleme açılıp kapanmadıkça yalnız bir kimlik araması yapar.
  let bekleyen = 0, onizlemeVardi = !!document.getElementById('drive-active-item-info');
  const gozlemci = new MutationObserver(() => {
    const acik = !!document.getElementById('drive-active-item-info');
    if (acik !== onizlemeVardi) {
      onizlemeVardi = acik;
      if (acik) { belirdi = Date.now(); denetle(true); }
      else if (GMAIL) onizlemeyiIzle(null);
    }
    if (!bekleyen) bekleyen = setTimeout(() => { bekleyen = 0; denetle(); }, 150);
  });
  gozlemci.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  denetle();
})();
