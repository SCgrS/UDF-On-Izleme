// Görüntüleyici sayfası: Drive'dan ya da Gmail'den gelen (#t=<anahtar>) ya da bilgisayardan seçilen UDF'yi gösterir. İki
// kipi var: kendi sekmesinde tam görünüm (goruntule.html), ya da Google'ın görüntüleyicisine gömülü görünüm (gomulu.html:
// html.gomulu). Gömülü görünümde üst çubuk alttaki koyu "hap" olur; Esc ve oklar Drive'a ya da Gmail'e iletilir.
(() => {
  'use strict';
  const M = globalThis.UDFMotoru, D = globalThis.DriveIndir;
  const $ = id => document.getElementById(id);
  const alan = $('alan');
  const gomulu = document.documentElement.classList.contains('gomulu');
  // Gömülü görünümde çerçeveyi koyan sayfanın kökeni: Gmail'deyse içerik betiği adrese "u=g" koyar (icerik.js, gom).
  // İletiler hemen (belge kaydı okunmadan) gönderildiği için köken eş zamanlı bilinmeli.
  const UST_KOKEN = new URLSearchParams(location.hash.slice(1)).get('u') === 'g' ? 'https://mail.google.com' : 'https://drive.google.com';
  // Google'daki belge açılırken görünen yazı: Google'ın değil eklentinin açtığı belli olsun.
  const ACILIYOR = 'UDF Ön İzleme eklentisiyle açılıyor…';
  const AD = 'UDF Ön İzleme';
  const SIMGE = {
    belge: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
    hata: 'M12 8v5M12 16.5v.5M10.3 4.2 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z'
  };

  const motorSayfasi = new CSSStyleSheet();
  motorSayfasi.replaceSync(M.CSS);
  const yazdirmaSayfasi = new CSSStyleSheet();
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, motorSayfasi, yazdirmaSayfasi];

  let gecerli = null;      // { cizim, bayt, ad, kayit }
  let denetleyici = null;  // AbortController
  let driveKaydi = null;
  let kullaniciOlcegi = null;   // null: pencereye sığdır (dar pencerede küçültür, genişte %100)

  // ------------------------------------------------------------ yardımcılar
  function eleman(etiket, ozellik = {}, ...cocuklar) {
    const e = document.createElement(etiket);
    for (const [k, v] of Object.entries(ozellik)) {
      if (k === 'sinif') e.className = v;
      else if (k === 'metin') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    e.append(...cocuklar);
    return e;
  }
  function simge(yol) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', yol);
    svg.append(p);
    return svg;
  }
  const uzantisiz = ad => String(ad || '').replace(/\.udf$/i, '').trim();
  function baslikYaz(ad) {
    const temiz = String(ad || '').trim();
    $('belge-adi').textContent = temiz || AD;
    $('belge-adi').title = temiz;
  }
  // Sekmedeki görüntüleyicinin başlığı hep "UDF Ön İzleme"dir: Sekme başlığı tarayıcı geçmişine, açık ve son kapatılan
  // sekmelerin kaydına, işletim sisteminin pencere başlığına (görev çubuğu, ekran paylaşımı) düşer. Belge adı (müvekkil
  // adı, esas no) oraya hiç konmaz. "PDF olarak kaydet" bu yüzden "UDF Ön İzleme" önerir, belgenin adı kaydederken yazılır.
  // Gömülü görünümde çerçevenin başlığı yazdırma süresince belge adıdır: Alt çerçevenin başlığı geçmişe ve sekme kaydına
  // yazılmaz, yalnız yazdırılan sayfanın üst bilgisinde görünür. PDF'e önerilen ad orada Drive ya da Gmail sekmesinin
  // başlığıdır, ona dokunulmaz (icerik.js).
  function yazdirmaBasligi(acik) {
    if (!gomulu) return;
    document.title = (acik && gecerli && uzantisiz(gecerli.ad)) || AD;
  }
  function ipucu(metin) {
    const e = eleman('div', { sinif: 'ipucu', role: 'status', metin });
    document.body.append(e);
    setTimeout(() => e.remove(), 2200);
  }
  // Gömülü görünümde Drive ya da Gmail sekmesindeki içerik betiğine ileti.
  function ustaBildir(ileti) {
    if (gomulu) window.parent.postMessage({ udfOkuyucu: 1, ...ileti }, UST_KOKEN);
  }

  function durumGoster(tur, baslik, metin = '', dugmeler = [], ayrinti = '') {
    const d = $('durum') || eleman('section', { id: 'durum', sinif: 'durum', 'aria-live': 'polite' });
    d.className = 'durum ' + tur;
    d.replaceChildren();
    const s = eleman('div', { sinif: 'durum-simge', 'aria-hidden': 'true' });
    if (tur === 'yukleniyor') s.append(eleman('div', { sinif: 'donen' }));
    else s.append(simge(tur === 'hata' ? SIMGE.hata : SIMGE.belge));
    d.append(s, eleman('h2', { metin: baslik }));
    if (metin) d.append(eleman('p', { metin }));
    if (ayrinti) d.append(eleman('p', { sinif: 'ayrinti', metin: ayrinti }));
    if (dugmeler.length) d.append(eleman('div', { sinif: 'durum-dugmeler' }, ...dugmeler));
    if (tur === 'bos') d.append(eleman('p', { sinif: 'durum-not', metin: 'Dosya bilgisayarınızdan çıkmaz. Belge bu sekmede, tarayıcının içinde açılır.' }));
    alan.replaceChildren(d);
  }

  function belgeyiBirak() {
    if (gecerli && gecerli.cizim) gecerli.cizim.birak();
    gecerli = null;
    document.body.classList.remove('belgeli');
    for (const id of ['dugme-yazdir', 'dugme-indir', 'dugme-notlar', 'olcek-grup']) $(id).hidden = true;
    $('rozetler').replaceChildren();
    notlarPaneli(false);
    yazdirmaSayfasi.replaceSync('');
  }

  // ------------------------------------------------------------ gösterme
  async function goster(bayt, ad, kayit = null) {
    if (denetleyici) denetleyici.abort();
    denetleyici = new AbortController();
    const signal = denetleyici.signal;
    belgeyiBirak();
    baslikYaz(ad);
    // Drive'dan gelen belgede indirme ile hazırlama arasında yazı değişmez.
    if (kayit) durumGoster('yukleniyor', ACILIYOR, ad || '');
    else durumGoster('yukleniyor', 'Belge hazırlanıyor…');
    let model;
    try {
      model = await M.oku(bayt, { signal });
    } catch (e) {
      // Bu sırada başka bir belge açıldıysa bu belgenin hatası onun yerine geçmez.
      if ((e && e.name === 'AbortError') || signal.aborted) return;
      const dugmeler = [];
      if (bayt) dugmeler.push(eleman('button', { type: 'button', sinif: 'dugme', metin: 'Dosyayı indir', onclick: () => kaydet(bayt, ad) }));
      if (kayit && !gomulu && kayit.kaynak !== 'gmail') dugmeler.push(eleman('button', { type: 'button', sinif: 'dugme', metin: 'Drive’da aç', onclick: () => driveAc(kayit) }));
      durumGoster('hata', 'Belge gösterilemedi', e instanceof M.UdfHatasi ? e.message : 'Dosya okunamadı.', dugmeler,
        e && e.kod ? `Kod: ${e.kod}${e.ayrinti ? ' · ' + e.ayrinti : ''}` : '');
      return;
    }
    if (signal.aborted) return;
    const cizim = M.ciz(model, { signal });
    alan.replaceChildren(cizim.kok);
    alan.scrollTop = 0;
    yazdirmaSayfasi.replaceSync(M.yazdirmaCss(model));
    // Asıl dosya baytları yalnız İndir için tutulur; Drive'ın içinde İndir yok (Drive'ın kendi düğmesi var).
    gecerli = { cizim, bayt: gomulu ? null : bayt, ad, kayit };
    kullaniciOlcegi = null;
    rozetleriYaz(model);
    notlariYaz(model);
    $('dugme-yazdir').hidden = false;
    $('dugme-indir').hidden = false;
    $('olcek-grup').hidden = false;
    // Belgede not varsa not bölmesi kendiliğinden açılır.
    if (model.notlar.length) notlarPaneli(true);
    document.body.classList.add('belgeli');
    sigdir();
    alan.focus({ preventScroll: true });
  }

  // E-imza rozeti. İmza ve sertifika burada doğrulanmaz, motor yalnız imza dosyasındaki özeti belge içeriğiyle karşılaştırır
  // (udf-motoru.js, imzaDenetle). "E-imzalıdır" yalnız özet içerikle tutunca yazar, renk nötr kalır. Özet tutmuyorsa
  // (içerik imzadan sonra değiştirilmiş olabilir) uyarı çıkar. Özet okunamadıysa ya da imza dosyası tek değilse (durum
  // 'bilinmiyor') belge içerikle karşılaştırılamamıştır: Rozet nötr kalır ve bunu söyler. Gömülü çubukta yer dar kalınca
  // bu rozetin kısa biçimi görünür (cubuguYerlestir: .kisa). Tam açıklama rozetin title'ındadır.
  function imzaRozeti(imza) {
    if (imza.durum === 'tutarli') return eleman('span', { sinif: 'rozet', metin: 'E-imzalıdır' });
    if (imza.durum === 'tutarsiz') return eleman('span', { sinif: 'rozet uyari', metin: 'E-imza içerikle uyuşmuyor', title: 'Belge içeriği imzalanan içerikle aynı değil: İmzadan sonra değiştirilmiş olabilir.' });
    return eleman('span', { sinif: 'rozet', title: 'Belgede e-imza dosyası var, ama belge içeriğiyle karşılaştırılamadı (örneğin içindeki özet okunamadı ya da imza dosyası tek değil). İmza ve sertifika doğrulanmaz.' },
      eleman('span', { sinif: 'rozet-uzun', metin: 'E-imza dosyası var, içerikle karşılaştırılamadı' }),
      eleman('span', { sinif: 'rozet-kisa', metin: 'E-imza karşılaştırılamadı' }));
  }

  function rozetleriYaz(model) {
    const r = $('rozetler');
    r.replaceChildren();
    if (model.imza) r.append(imzaRozeti(model.imza));
    else if (!model.notlar.length) {
      // E-imzasız ve notsuz belgede çubuğun sol yanı boş kalmasın diye imza durumu yazar.
      // Notlu belgede solda Notlar düğmesi durduğu için yazmaz.
      r.append(eleman('span', { sinif: 'rozet', metin: 'E-imzasız', title: 'Belgede e-imza dosyası yok.' }));
    }
    if (model.sablon) r.append(eleman('span', { sinif: 'rozet', title: 'Bu belge bir UYAP şablonundan üretilmiş. Alanlar belgedeki veriden dolduruldu.', metin: 'Şablon' }));
    if (model.kesildi) r.append(eleman('span', { sinif: 'rozet uyari', metin: 'Belgenin bir kısmı gösterilemedi' }));
  }

  // ------------------------------------------------------------ notlar
  function notlariYaz(model) {
    const liste = $('not-listesi');
    liste.replaceChildren();
    const n = model.notlar.length;
    $('dugme-notlar').hidden = !n;
    $('not-sayisi').textContent = n ? String(n) : '';
    $('dugme-notlar').setAttribute('aria-label', `Notlar (${n})`);   // düğmede yalnız simge ve sayı var
    const tarih = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
    for (const not of model.notlar) {
      const ust = eleman('div', { sinif: 'not-ust' },
        eleman('span', { metin: `Not ${not.sira}${not.kim ? ' · ' + not.kim : ''}` }),
        eleman('span', { metin: not.zaman ? tarih.format(new Date(not.zaman)) : '' }));
      const govde = eleman('div', { sinif: 'not-metni' + (not.metin ? '' : ' bos'), metin: not.metin || 'Metinsiz not (yalnız işaretleme)' });
      liste.append(eleman('li', {}, eleman('button', { type: 'button', onclick: () => notaGit(not.sira) }, ust, govde)));
    }
  }
  function notlarPaneli(acik) {
    $('notlar-paneli').hidden = !acik;
    document.body.classList.toggle('notlar-acik', acik);
    $('dugme-notlar').setAttribute('aria-pressed', String(acik));
    sigdir();
  }
  // Yalnız belge alanı kaydırılır (scrollIntoView gömülü görünümde Drive sayfasını da kaydırabilir).
  function notaGit(sira) {
    const hedefler = alan.querySelectorAll('.udf-notlu');
    const bulunan = [...hedefler].filter(e => (e.dataset.not || '').split(' ').includes(String(sira)));
    if (!bulunan.length) { ipucu('Notun işaretlediği yer bulunamadı'); return; }
    for (const e of alan.querySelectorAll('.udf-notlu.secili')) e.classList.remove('secili', 'yanip');
    const r = bulunan[0].getBoundingClientRect(), a = alan.getBoundingClientRect();
    alan.scrollTo({
      top: alan.scrollTop + r.top - a.top - (alan.clientHeight - r.height) / 2,
      left: alan.scrollLeft + r.left - a.left - (alan.clientWidth - r.width) / 2,
      behavior: 'smooth'
    });
    for (const e of bulunan) { e.classList.add('secili', 'yanip'); }
  }

  // ------------------------------------------------------------ düğmeler
  function kaydet(bayt, ad) {
    const url = URL.createObjectURL(new Blob([bayt], { type: 'application/octet-stream' }));
    const a = eleman('a', { href: url, download: /\.udf$/i.test(ad || '') ? ad : (uzantisiz(ad) || 'belge') + '.udf' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  // Drive sayfasını arka plan yeni sekmede açar; belge orada Drive'ın penceresine gömülü görünür.
  function driveAc(kayit) {
    const url = D.driveBaglantisi(kayit);
    try { chrome.runtime.sendMessage({ tur: 'drive-ac', url }).catch(() => window.open(url, '_blank', 'noopener')); }
    catch { window.open(url, '_blank', 'noopener'); }
  }

  let yazdiriliyor = false;
  async function yazdir() {
    if (!gecerli || yazdiriliyor) return;
    yazdiriliyor = true;
    try {
      const { cizim } = gecerli;
      await cizim.bitti;
      await cizim.tumunuCiz();
      yazdirmaBasligi(true);
      try { window.print(); } finally { yazdirmaBasligi(false); }
    } finally {
      yazdiriliyor = false;
    }
  }

  // ------------------------------------------------------------ yakınlaştırma
  // Varsayılan: sayfa pencereden genişse genişliğe sığdırılır, değilse %100. Düğmeler sabit basamaklarla değiştirir;
  // yüzdeye basınca sığdırmaya döner. Yazdırırken ölçek kalkar (motor CSS'i).
  const OLCEKLER = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
  function sigdirmaOlcegi() {
    const z = Math.min(1, (alan.clientWidth - 16) / (gecerli.cizim.dogalEn + 16));
    return z < 1 ? Math.max(0.25, Math.round(z * 1000) / 1000) : 1;
  }
  function sigdir() {
    if (!gecerli) { ortala(1); return; }
    const z = kullaniciOlcegi == null ? sigdirmaOlcegi() : kullaniciOlcegi;
    gecerli.cizim.kok.style.setProperty('zoom', String(z));
    $('olcek').textContent = '%' + Math.round(z * 100);
    $('olcek').setAttribute('aria-label', `Yakınlaştırma %${Math.round(z * 100)}. Pencereye sığdırmak için basın`);
    ortala(z);
  }
  // Not bölmesi belgenin yanında yer kaplarken sayfa, bölme kapalıykenki yerinde (pencerenin ortasında) kalır: Belge
  // alanının soluna bölmenin kapladığı genişlik kadar boşluk verilir. Yer yetmezse boşluk, sayfayla bölme arasında pay
  // kalacak kadar daralır (sayfa sola kayar). Hiç yer yoksa sayfa daralan alanın ortasında durur, gerekirse ona
  // sığdırılır. Dar pencerede bölme belgenin üstüne bindiği için alan daralmaz, boşluk da olmaz. Boşluk yalnız ekranda
  // (CSS'te @media screen).
  function ortala(z) {
    const a = alan.getBoundingClientRect();
    const genislik = document.documentElement.clientWidth;
    const kaplanan = gecerli && !$('notlar-paneli').hidden ? Math.max(0, Math.round(genislik - a.right)) : 0;
    const bosluk = kaplanan ? Math.max(0, Math.min(kaplanan, Math.floor(alan.clientWidth - (gecerli.cizim.dogalEn + 16) * z - 32))) : 0;
    alan.style.setProperty('--sol-bosluk', bosluk + 'px');
    if (gomulu) cubuguYerlestir(a.left + (bosluk + alan.clientWidth) / 2, kaplanan ? a.right : genislik);
  }
  // Gömülü görünümde alttaki çubuk (ve ipucu) sayfanın ortasında durur. Sayfa küçültülüp bölme açıkken ortası bölmeye
  // yaklaşınca çubuk daralmaz, sola kayar: Sağ sınırla (bölmenin sol kenarı ya da pencerenin sağı) arasında 12 px kalır,
  // düğmeler hapın dışına, bölmenin üstüne taşmaz. Çubuğun içinde yakınlaştırma ortadadır (iki yan eşit, CSS). Bu düzenin
  // doğal genişliği [12 px, sağ sınır − 12 px] şeridine sığmazsa önce rozetlerin kısa biçimi görünür (.kisa, yanlar yine
  // eşit). O da sığmazsa yanlar eşitlenmez (.sikisik: Düğmeler yan yana, aralarında boşluk kalmaz). O da sığmazsa çubuk
  // şeride sığacak kadar daralır (rozetler kırpılır). CSS: --cubuk-ortasi, --cubuk-en-cok.
  function cubuguYerlestir(orta, sagSinir) {
    const cubuk = document.querySelector('.cubuk');
    const sol = 12, sag = sagSinir - 12, yer = Math.max(0, sag - sol);
    const olc = () => Math.ceil(cubuk.getBoundingClientRect().width);   // width: max-content, gizliyken 0
    cubuk.style.setProperty('max-width', 'none');
    cubuk.classList.remove('kisa', 'sikisik');
    let gereken = olc();
    for (const sinif of ['kisa', 'sikisik']) {
      if (gereken <= yer) break;
      cubuk.classList.add(sinif);
      gereken = olc();
    }
    cubuk.style.removeProperty('max-width');
    const en = Math.min(gereken, yer);
    const merkez = Math.max(sol + en / 2, Math.min(orta, sag - en / 2));
    document.documentElement.style.setProperty('--cubuk-ortasi', merkez.toFixed(2) + 'px');
    document.documentElement.style.setProperty('--cubuk-en-cok', Math.max(0, 2 * Math.min(merkez - sol, sag - merkez)).toFixed(2) + 'px');
  }
  function olcekDegistir(yon) {
    if (!gecerli) return;
    const simdi = kullaniciOlcegi == null ? sigdirmaOlcegi() : kullaniciOlcegi;
    const sonraki = yon > 0 ? OLCEKLER.find(o => o > simdi + 0.001) : [...OLCEKLER].reverse().find(o => o < simdi - 0.001);
    if (sonraki == null) return;
    olcekUygula(sonraki);
  }
  // Ekranın ortasındaki yer korunur.
  function olcekUygula(yeni) {
    const oran = (alan.scrollTop + alan.clientHeight / 2) / Math.max(1, alan.scrollHeight);
    kullaniciOlcegi = yeni;
    sigdir();
    alan.scrollTop = oran * alan.scrollHeight - alan.clientHeight / 2;
  }

  // ------------------------------------------------------------ kaynaklar
  // Gömülü görünümde Drive dosyasını arka plan (service worker) indirir: İndirme gömme kaydıyla birlikte başlar, bu sayfa
  // yüklenirken sürer (arkaplan.js, onIndir). İsteği bütün çerezlerle gider (üçüncü taraf çerezleri kapalıyken de). Arka
  // plan başaramazsa sayfa kendisi indirir (isteği Drive sayfasının içinden, üçüncü taraf bağlamında gider).
  // Kayıt arka plandan bir kez alındığı için (basla) ona yeniden gönderilir: Ön indirme kullanıldıysa (gömülü Drive
  // dosyasının ilk açılışı) gerekmez, "Yeniden dene"de ve Gmail ekinde onunla indirilir. Gmail ekinin dilimleri ekin
  // açıldığı Gmail sekmesinden gelir (kayit.sekme).
  const YEDEGE_GECIR = ['AG', 'OTURUM_YOK', 'HTTP_401', 'HTTP_403', 'HTTP_404', 'BEKLENMEYEN_HTML'];
  async function arkaplandanIndir(anahtar, kayit) {
    const sekme = kayit.kaynak === 'gmail' ? kayit.sekme : undefined;
    let y;
    try { y = await chrome.runtime.sendMessage({ tur: 'indir', anahtar, kayit }); } catch { y = null; }
    if (!y || !Number.isInteger(y.uzunluk) || !Number.isInteger(y.dilim)) throw new D.IndirmeHatasi((y && typeof y.hata === 'string' && y.hata) || 'AG');
    if (y.uzunluk < 0 || y.uzunluk > M.SINIR.paket || y.dilim < 1) throw new D.IndirmeHatasi('AG');
    // Baytlar dilim dilim gelir (arkaplan.js, dilimVer): tek parça base64 ileti büyük dosyada çok bellek tutuyordu.
    const bayt = new Uint8Array(y.uzunluk);
    for (let i = 0, o = 0; o < bayt.length; i++) {
      let p;
      try { p = await chrome.runtime.sendMessage({ tur: 'indir-dilim', anahtar, i, sekme }); } catch { p = null; }
      if (!p || typeof p.parca !== 'string') throw new D.IndirmeHatasi('AG');
      const parca = D.base64Coz(p.parca);
      if (!parca.length || o + parca.length > bayt.length) throw new D.IndirmeHatasi('AG');
      bayt.set(parca, o);
      o += parca.length;
    }
    return { bayt, ad: typeof y.ad === 'string' ? y.ad : null, hesap: Number.isInteger(y.hesap) ? y.hesap : null };
  }

  // Drive dosyası ya da Gmail eki (kaydı arka plandan bir kez alındı, bu sayfanın belleğinde durur). Gmail ekini görüntüleyici
  // kendisi indiremez: Baytları ekin açıldığı Gmail sekmesindeki içerik betiği indirir, arka plan dilim dilim aktarır
  // (arkaplan.js, gmailIndir).
  async function kayitliDosya(kayit, anahtar) {
    const gmail = kayit.kaynak === 'gmail';
    driveKaydi = gmail ? null : kayit;
    baslikYaz(kayit.ad);
    $('dugme-drive').hidden = gomulu || gmail;
    if (denetleyici) denetleyici.abort();
    denetleyici = new AbortController();
    const signal = denetleyici.signal;
    belgeyiBirak();
    durumGoster('yukleniyor', ACILIYOR, kayit.ad || '');
    let sonuc;
    try {
      if (gmail) sonuc = await arkaplandanIndir(anahtar, kayit);
      else if (gomulu) {
        try {
          sonuc = await arkaplandanIndir(anahtar, kayit);
        } catch (e) {
          if (signal.aborted || !(e && YEDEGE_GECIR.includes(e.kod))) throw e;
          // Sayfa da başaramazsa arka planın hatası gösterilir. Arka plana ulaşılamadıysa (AG) sayfanınki.
          sonuc = await D.udfIndir(kayit, { signal }).catch(h => { throw e.kod !== 'AG' ? e : h; });
        }
      } else sonuc = await D.udfIndir(kayit, { signal });
    } catch (e) {
      if ((e && e.name === 'AbortError') || signal.aborted) return;
      const a = D.hataAciklamasi(e, gmail ? 'gmail' : 'drive');
      const dugmeler = [eleman('button', { type: 'button', sinif: 'dugme birincil', metin: 'Yeniden dene', onclick: () => kayitliDosya(kayit, anahtar) })];
      if (!gomulu && !gmail) dugmeler.push(eleman('button', { type: 'button', sinif: 'dugme', metin: 'Drive’da aç', onclick: () => driveAc(kayit) }));
      durumGoster('hata', a.baslik, a.metin, dugmeler, e && e.kod ? `Kod: ${e.kod}` : '');
      return;
    }
    if (signal.aborted) return;
    const ad = kayit.ad || sonuc.ad || 'belge.udf';
    await goster(sonuc.bayt, ad, gmail ? kayit : { ...kayit, au: sonuc.hesap == null ? kayit.au : sonuc.hesap });
  }

  async function yerelDosya(dosya) {
    if (!dosya || gomulu) return;
    // Süren Drive indirmesi ya da okunan öbür dosya sonradan ekrana gelmesin.
    if (denetleyici) denetleyici.abort();
    denetleyici = new AbortController();
    const signal = denetleyici.signal;
    belgeyiBirak();
    baslikYaz(dosya.name);
    durumGoster('yukleniyor', 'Belge hazırlanıyor…');
    driveKaydi = null;
    $('dugme-drive').hidden = true;
    // Adresteki anahtar kalkar (F5 boş görüntüleyici açsın). Sekmenin başlığı hiç değişmediği için (yazdirmaBasligi) bu
    // değişiklik geçmişe belge adı yazdırmaz.
    if (location.hash) history.replaceState(null, '', location.pathname);
    if (dosya.size > M.SINIR.paket) { durumGoster('hata', 'Dosya çok büyük', 'Görüntüleyici 40 MB’tan büyük dosyaları açmaz.'); return; }
    let bayt;
    try { bayt = new Uint8Array(await dosya.arrayBuffer()); }
    catch { if (!signal.aborted) durumGoster('hata', 'Dosya okunamadı', 'Seçilen öğe bir dosya değil ya da okunamıyor.'); return; }
    if (signal.aborted) return;
    await goster(bayt, dosya.name, null);
  }

  async function basla() {
    const p = new URLSearchParams(location.hash.slice(1));
    const anahtar = p.get('t');
    // Belgenin kaydı arka plandan bir kez alınır, arka planda silinir (arkaplan.js, kayitAl). Sayfa yenilenince ya da sekme
    // yeniden açılınca kayıt yoktur.
    if (anahtar && /^[0-9a-f-]{36}$/.test(anahtar) && globalThis.chrome && chrome.runtime && chrome.runtime.id) {
      let kayit = null;
      try { kayit = ((await chrome.runtime.sendMessage({ tur: 'kayit-al', anahtar })) || {}).kayit || null; } catch { kayit = null; }
      if (kayit && (kayit.id || kayit.kaynak === 'gmail')) { await kayitliDosya(kayit, anahtar); return; }
      durumGoster('hata', 'Belge bilgisi bulunamadı', gomulu
        ? 'Sayfayı yenileyin (F5) ve dosyayı yeniden açın.'
        : 'Belgenin bilgisi saklanmaz, yalnız sekme açılırken bir kez alınır. Dosyayı Drive’da ya da Gmail’de yeniden açın ya da “Dosya aç” ile bilgisayardan seçin.');
      return;
    }
    if (gomulu) { durumGoster('hata', 'Belge bilgisi bulunamadı', 'Sayfayı yenileyin (F5) ve dosyayı yeniden açın.'); return; }
    durumGoster('bos', 'UDF dosyası açın', 'Bir .udf dosyasını bu pencereye sürükleyin ya da “Dosya aç”a basın.', [
      eleman('button', { type: 'button', sinif: 'dugme birincil', metin: 'Dosya aç', onclick: () => $('dosya-sec').click() })
    ]);
  }

  // ------------------------------------------------------------ olaylar
  $('dugme-ac').addEventListener('click', () => $('dosya-sec').click());
  $('dosya-sec').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; yerelDosya(f); });
  $('dugme-yazdir').addEventListener('click', yazdir);
  $('dugme-indir').addEventListener('click', () => { if (gecerli) kaydet(gecerli.bayt, gecerli.ad); });
  $('dugme-drive').addEventListener('click', () => { if (driveKaydi) driveAc(gecerli && gecerli.kayit ? gecerli.kayit : driveKaydi); });
  $('dugme-notlar').addEventListener('click', () => notlarPaneli($('notlar-paneli').hidden));
  $('notlar-kapat').addEventListener('click', () => notlarPaneli(false));
  $('dugme-uzak').addEventListener('click', () => olcekDegistir(-1));
  $('dugme-yakin').addEventListener('click', () => olcekDegistir(1));
  $('olcek').addEventListener('click', () => { if (gecerli) olcekUygula(null); });
  document.addEventListener('keydown', e => {
    const ctrl = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey;
    const yalin = !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
    if (ctrl && e.key.toLowerCase() === 'p' && gecerli) { e.preventDefault(); yazdir(); }
    else if (ctrl && e.key.toLowerCase() === 'o' && !gomulu) { e.preventDefault(); $('dosya-sec').click(); }
    // Sekmede Esc not bölmesini kapatır. Drive'ın içinde Esc her zaman Drive'ın penceresini kapatır: bölme her notlu
    // belgede kendiliğinden açıldığı için önce onu kapatmak her seferinde fazladan bir basış isterdi.
    else if (e.key === 'Escape' && !gomulu && !$('notlar-paneli').hidden) notlarPaneli(false);
    else if (gomulu && yalin && !e.isComposing && !(e.target.closest && e.target.closest('input, textarea, select')) &&
      (e.key === 'Escape' || ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && alan.scrollWidth <= alan.clientWidth + 1))) {
      // Drive'ın görüntüleyicisindeki gibi: Esc kapatır, oklar öbür dosyaya geçer (belge yana kaymıyorsa).
      e.preventDefault();
      ustaBildir({ tur: 'tus', tus: e.key });
    }
  });
  // Alanın genişliği değişince (pencere, notlar paneli, araç çubuğunun kırılması) sayfa yeniden sığdırılır.
  new ResizeObserver(() => requestAnimationFrame(sigdir)).observe(alan);
  window.addEventListener('beforeprint', () => yazdirmaBasligi(true));
  window.addEventListener('afterprint', () => yazdirmaBasligi(false));
  window.addEventListener('hashchange', () => { if (new URLSearchParams(location.hash.slice(1)).get('t')) basla(); });

  // ------------------------------------------------------------ arka plana tıklama (gömülü görünüm)
  // Drive'ın PDF görüntüleyicisindeki gibi sayfaların dışındaki boşluğa tıklamak pencereyi kapatır (Esc iletilir). Drive'da
  // ölçüldü (2026-10-07): sayfanın solu, sağı ve son sayfanın altı kapatır; sayfanın içi, sayfalar arası, ilk sayfanın üstü,
  // sağ tık ve sayfada başlayıp boşlukta biten sürükleme kapatmaz; kapanma fare bırakılınca olur. Drive boşlukta başlayıp
  // sayfada biten sürüklemede de kapatıyor; burada basış da bırakış da boşlukta olmalı ve sürükleme metin seçmişse
  // kapanmaz: kenardan başlayan seçim pencereyi kapatmasın. Yerinde tıklamada önceden seçili metne bakılmaz (Chrome onu
  // tıklamadan sonra kaldırıyor; yoksa ilk tık yalnız seçimi kaldırırdı).
  // Boşluk: belge alanının kendisi, sayfaları taşıyan kap (sayfa, hata kutusu, kaydırma çubuğu değil; yükleme kutusu
  // görünmez olduğu için tıklamayı geçirir, CSS) ve not bölmesinin sağında Drive'ın oku için bırakılan şerit (.govde).
  const govde = document.querySelector('.govde');
  function bosluktaMi(e) {
    if (e.target === govde) return true;
    const kok = gecerli && gecerli.cizim.kok;
    if (e.target !== alan && (!kok || e.target !== kok)) return false;
    const a = alan.getBoundingClientRect();
    if (e.clientX - a.left - alan.clientLeft >= alan.clientWidth || e.clientY - a.top - alan.clientTop >= alan.clientHeight) return false;
    if (!kok || !kok.isConnected) return true;   // belge yok (yükleniyor, hata): kutunun dışı boşluktur
    let sol = Infinity, sag = -Infinity, alt = -Infinity;
    for (const c of kok.children) {
      const r = c.getBoundingClientRect();
      if (!r.width) continue;
      sol = Math.min(sol, r.left);
      sag = Math.max(sag, r.right);
      alt = Math.max(alt, r.bottom);
    }
    return e.clientX < sol || e.clientX > sag || e.clientY > alt;
  }
  if (gomulu) {
    let basis = null;   // boşlukta başlayan basışın yeri
    document.addEventListener('pointerdown', e => {
      basis = e.isPrimary && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && bosluktaMi(e) ? { x: e.clientX, y: e.clientY } : null;
    });
    document.addEventListener('click', e => {
      const b = basis;
      basis = null;
      if (!b || e.button !== 0 || !bosluktaMi(e)) return;
      const secim = getSelection();
      if (Math.hypot(e.clientX - b.x, e.clientY - b.y) > 4 && secim && !secim.isCollapsed) return;
      ustaBildir({ tur: 'tus', tus: 'Escape' });
    });
  }

  if (gomulu) {
    $('notlar-kapat').title = 'Notları kapat';
    // Drive ya da Gmail sekmesinden: Ctrl+P (odak Google'ın görüntüleyicisindeyken).
    window.addEventListener('message', e => {
      if (e.source !== window.parent || e.origin !== UST_KOKEN) return;
      const m = e.data;
      if (!m || typeof m !== 'object' || m.udfOkuyucu !== 1) return;
      if (m.tur === 'yazdir') yazdir();
      // Drive'ın sağdaki okunun kapladığı şerit: not bölmesi onun solunda durur (icerik.js, sagBosluk).
      else if (m.tur === 'sag-bosluk' && Number.isFinite(m.px)) {
        document.documentElement.style.setProperty('--sag-bosluk', Math.max(0, Math.min(160, Math.round(m.px))) + 'px');
      }
    });
    ustaBildir({ tur: 'hazir' });
  } else {
    let surukleme = 0;
    const dosyaVarMi = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    document.addEventListener('dragenter', e => { if (!dosyaVarMi(e)) return; e.preventDefault(); surukleme++; $('birak-katmani').hidden = false; });
    document.addEventListener('dragover', e => { if (dosyaVarMi(e)) e.preventDefault(); });
    document.addEventListener('dragleave', () => { if (--surukleme <= 0) { surukleme = 0; $('birak-katmani').hidden = true; } });
    document.addEventListener('drop', e => {
      if (!dosyaVarMi(e)) return;
      e.preventDefault();
      surukleme = 0;
      $('birak-katmani').hidden = true;
      yerelDosya(e.dataTransfer.files[0]);
    });
  }

  basla();
})();
