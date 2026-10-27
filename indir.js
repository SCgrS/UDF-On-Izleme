// Drive'daki dosyayı görüntüleyici sayfasının içinden indirir. Sayfa chrome-extension:// kökenli üst düzey sayfa
// olduğu için istek, tarayıcıdaki Drive oturumunun çerezleriyle gider ve CORS'a takılmaz (host_permissions).
// Gmail ekini ise Gmail sayfasındaki içerik betiği indirir (gmailEkIndir).
// Baytlar yalnız bellekte tutulur; diske, önbelleğe ya da başka bir adrese gönderilmez.
(() => {
  'use strict';
  if (globalThis.DriveIndir) return;

  const ADRES = 'https://drive.usercontent.google.com/download';
  const EN_COK = 40 * 1024 * 1024;
  const KIMLIK = /^[A-Za-z0-9_-]{10,200}$/;

  class IndirmeHatasi extends Error {
    constructor(kod, ayrinti = '') { super(kod); this.name = 'IndirmeHatasi'; this.kod = kod; this.ayrinti = ayrinti; }
  }

  function adres(id, au, rk, ek = {}) {
    const u = new URL(ADRES);
    u.searchParams.set('id', id);
    u.searchParams.set('export', 'download');
    if (au != null) u.searchParams.set('authuser', String(au));
    if (rk) u.searchParams.set('resourcekey', rk);
    for (const [k, v] of Object.entries(ek)) u.searchParams.set(k, v);
    return u;
  }

  // Content-Disposition'daki ad (filename*=UTF-8''… önce).
  function dosyaAdi(baslik) {
    if (!baslik) return null;
    const yildiz = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(baslik);
    if (yildiz) { try { return decodeURIComponent(yildiz[1].trim().replace(/^"|"$/g, '')); } catch { /* düz ada geç */ } }
    const duz = /filename\s*=\s*"([^"]*)"/i.exec(baslik) || /filename\s*=\s*([^;]+)/i.exec(baslik);
    return duz ? duz[1].trim() : null;
  }

  async function govdeOku(yanit, signal) {
    const uz = Number(yanit.headers.get('content-length'));
    if (Number.isFinite(uz) && uz > EN_COK) throw new IndirmeHatasi('BUYUK');
    const okuyucu = yanit.body.getReader();
    const parcalar = [];
    let toplam = 0;
    for (;;) {
      if (signal && signal.aborted) { okuyucu.cancel().catch(() => {}); throw new DOMException('İptal edildi', 'AbortError'); }
      const { done, value } = await okuyucu.read();
      if (done) break;
      toplam += value.length;
      if (toplam > EN_COK) { okuyucu.cancel().catch(() => {}); throw new IndirmeHatasi('BUYUK'); }
      parcalar.push(value);
    }
    const b = new Uint8Array(toplam);
    let o = 0;
    for (const p of parcalar) { b.set(p, o); o += p.length; }
    return b;
  }

  async function birKez(u, signal) {
    let yanit;
    try {
      yanit = await fetch(u, { credentials: 'include', cache: 'no-store', redirect: 'follow', signal });
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      // Oturum yoksa Drive giriş sayfasına yönlendirir; sayfanın CSP'si yalnız indirme adresine izin verdiği için bu
      // yönlendirme ağ hatası olarak görünür.
      throw new IndirmeHatasi('AG', String(e && e.message || e));
    }
    const tur = (yanit.headers.get('content-type') || '').toLowerCase();
    if (!yanit.ok) throw new IndirmeHatasi('HTTP_' + yanit.status);
    if (tur.startsWith('text/html')) {
      const metin = new TextDecoder().decode(await govdeOku(yanit, signal)).slice(0, 200000);
      if (/id="download-form"|id=download-form/.test(metin)) {
        // Virüs tarama uyarısı: formdaki onay alanlarıyla aynı adrese yeniden gidilir (başka adrese gidilmez).
        const ek = { confirm: 't' };
        const uuid = /name="uuid"\s+value="([A-Za-z0-9-]{1,80})"/.exec(metin);
        if (uuid) ek.uuid = uuid[1];
        return { yeniden: ek };
      }
      throw new IndirmeHatasi(/accounts\.google\.com|ServiceLogin|signin/i.test(yanit.url + metin.slice(0, 5000)) ? 'OTURUM_YOK' : 'BEKLENMEYEN_HTML');
    }
    const bayt = await govdeOku(yanit, signal);
    if (!bayt.length) throw new IndirmeHatasi('BOS');
    return { bayt, ad: dosyaAdi(yanit.headers.get('content-disposition')) };
  }

  // Drive dosyası yalnız Drive sekmesinin hesabıyla istenir: Hesap sırası (authuser) biliniyorsa o, bilinmiyorsa (adreste
  // ve sayfada hesap sırası yok) hesapsız istek, yani Drive sayfasının kendi kullandığı varsayılan hesap. Dosyanın kimliği
  // tarayıcıda açık öbür Google hesaplarının oturumuyla hiç gönderilmez. Erişemeyen hesapta hata gösterilir (dosyayı ona
  // erişebilen hesapla açın).
  async function udfIndir({ id, au, rk }, { signal } = {}) {
    if (!KIMLIK.test(String(id || ''))) throw new IndirmeHatasi('KIMLIK');
    const rkTemiz = rk && /^[A-Za-z0-9_.-]{1,200}$/.test(rk) ? rk : null;
    const hesap = Number.isInteger(au) && au >= 0 && au < 100 ? au : null;
    let r = await birKez(adres(id, hesap, rkTemiz), signal);
    if (r.yeniden) r = await birKez(adres(id, hesap, rkTemiz, r.yeniden), signal);
    if (r.yeniden) throw new IndirmeHatasi('BEKLENMEYEN_HTML');
    return { ...r, hesap };
  }

  // Gmail eki, Gmail sayfasındaki içerik betiğinin içinden: istek Gmail'in kendi kökeninden, birinci taraf çerezleriyle
  // gider. Gmail eki mail-attachment.googleusercontent.com'a yönlendirir, orası Gmail kökenine CORS izni veriyor
  // (2026-10-26'da gerçek Gmail'de ölçüldü; aynı ek art arda indirilebildi). gmail.js'e göre aynı adres art arda istenince
  // yönlendirme Gmail'e geri dönebiliyor (CORS hatası): ağ hatasında adres bir kez benzersiz bir ekle yeniden denenir.
  // Adres yalnız GmailEk.indirmeAdresi'nin kurduğu biçimde olabilir.
  async function gmailEkIndir(adres, { signal } = {}) {
    if (!/^https:\/\/mail\.google\.com\/mail\/(u\/\d{1,2})?\?ui=2&[A-Za-z0-9_.:=&-]+&zw$/.test(String(adres))) throw new IndirmeHatasi('KIMLIK');
    const birKere = async u => {
      const r = await birKez(u, signal);
      if (r.yeniden) throw new IndirmeHatasi('BEKLENMEYEN_HTML');
      return r;
    };
    try {
      return await birKere(adres);
    } catch (e) {
      if (!e || e.kod !== 'AG') throw e;
      return birKere(`${adres}&cacheCounter=${Date.now()}`);
    }
  }

  // Baytların base64 metni (iletilerde taşınır, runtime iletileri JSON'dur) ve geri çevirisi. Tarayıcının kendi çeviricisi
  // (Chrome 140'tan beri) varsa o: 5 MB'ta kodlama 40 → 1,5 ms, çözme 24 → 3,5 ms (2026-10-27 ölçümü). Çıktı aynı.
  function base64(bayt) {
    if (typeof bayt.toBase64 === 'function') return bayt.toBase64();
    let s = '';
    for (let i = 0; i < bayt.length; i += 0x8000) s += String.fromCharCode.apply(null, bayt.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function base64Coz(metin) {
    if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(metin);
    const ikili = atob(metin);
    const bayt = new Uint8Array(ikili.length);
    for (let k = 0; k < ikili.length; k++) bayt[k] = ikili.charCodeAt(k);
    return bayt;
  }

  function driveBaglantisi({ id, au, rk }) {
    if (!KIMLIK.test(String(id || ''))) return 'https://drive.google.com/';
    const u = new URL(`https://drive.google.com/file/d/${id}/view`);
    if (Number.isInteger(au)) u.searchParams.set('authuser', String(au));
    if (rk && /^[A-Za-z0-9_.-]{1,200}$/.test(rk)) u.searchParams.set('resourcekey', rk);
    return u.href;
  }

  // Kullanıcıya gösterilecek açıklama (teknik ayrıntı ayrıca). kaynak: 'drive' ya da 'gmail'.
  function hataAciklamasi(e, kaynak = 'drive') {
    const kod = e && e.kod;
    if (kaynak === 'gmail') return gmailHatasi(kod);
    if (kod === 'AG' || kod === 'OTURUM_YOK') return {
      baslik: 'Drive oturumu bulunamadı',
      metin: 'Bu tarayıcıda Google Drive’a, dosyaya erişebilen hesapla giriş yapılmış olmalı. Drive’ı açıp giriş yaptıktan sonra “Yeniden dene”ye basın.'
    };
    if (kod === 'HTTP_403' || kod === 'HTTP_401') return {
      baslik: 'Dosyayı indirme izniniz yok',
      metin: 'Dosyanın sahibi indirmeyi kapatmış ya da kurumunuz engellemiş olabilir. Eklenti bu kısıtlamayı aşmaya çalışmaz.'
    };
    if (kod === 'HTTP_404') return {
      baslik: 'Dosya bulunamadı',
      metin: 'Dosya silinmiş ya da Drive’da açık olan hesabınız dosyaya erişemiyor. Dosyayı ona erişebilen hesapla açın.'
    };
    if (kod === 'BUYUK') return { baslik: 'Dosya çok büyük', metin: 'Görüntüleyici 40 MB’tan büyük dosyaları açmaz.' };
    if (kod === 'BOS') return { baslik: 'Dosya boş', metin: 'Drive boş bir dosya döndürdü.' };
    if (kod === 'KIMLIK') return { baslik: 'Dosya kimliği geçersiz', metin: 'Dosyayı Drive’da yeniden açın.' };
    if (String(kod || '').startsWith('HTTP_5')) return { baslik: 'Drive şu an yanıt vermiyor', metin: 'Biraz sonra yeniden deneyin.' };
    return { baslik: 'Dosya Drive’dan alınamadı', metin: 'Bağlantınızı denetleyip yeniden deneyin.' };
  }
  function gmailHatasi(kod) {
    if (kod === 'GMAIL_SEKME') return {
      baslik: 'Gmail sekmesine ulaşılamadı',
      metin: 'Ek, açıldığı Gmail sekmesinin içinden indirilir. O sekme kapanmış ya da eklenti güncellenmiş olabilir. Gmail sekmesini yenileyin (F5) ve eki yeniden açın.'
    };
    if (kod === 'AG' || kod === 'OTURUM_YOK') return {
      baslik: 'Ek Gmail’den alınamadı',
      metin: 'Gmail’de oturumunuzun açık olduğundan emin olup “Yeniden dene”ye basın.'
    };
    if (kod === 'HTTP_403' || kod === 'HTTP_401') return {
      baslik: 'Eki indirme izniniz yok',
      metin: 'Gmail bu eki vermedi. Ek, virüs taraması nedeniyle engellenmiş olabilir. Eklenti bu kısıtlamayı aşmaya çalışmaz.'
    };
    if (kod === 'HTTP_404') return { baslik: 'Ek bulunamadı', metin: 'İleti silinmiş ya da ek artık yok.' };
    if (kod === 'BUYUK') return { baslik: 'Dosya çok büyük', metin: 'Görüntüleyici 40 MB’tan büyük dosyaları açmaz.' };
    if (kod === 'BOS') return { baslik: 'Dosya boş', metin: 'Gmail boş bir dosya döndürdü.' };
    if (kod === 'KIMLIK') return { baslik: 'Ek bilgisi geçersiz', metin: 'Eki Gmail’de yeniden açın.' };
    if (String(kod || '').startsWith('HTTP_5')) return { baslik: 'Gmail şu an yanıt vermiyor', metin: 'Biraz sonra yeniden deneyin.' };
    return { baslik: 'Ek Gmail’den alınamadı', metin: 'Bağlantınızı denetleyip yeniden deneyin.' };
  }

  globalThis.DriveIndir = Object.freeze({ udfIndir, gmailEkIndir, base64, base64Coz, hataAciklamasi, driveBaglantisi, dosyaAdi, IndirmeHatasi });
})();
