// Sahte Drive ile uçtan uca sınama. drive.google.com ve drive.usercontent.google.com yerel bir HTTPS sunucusuna
// yönlendirilir (--host-resolver-rules). Sahte sayfa Drive'ın ölçülen davranışını taklit eder (belgeler/DRIVE-TEKNIGI.md):
// ikinci tıklamada ve Enter'da görüntüleyiciyi açar; görüntüleyici sabit konumlu bir katman, üstte iki satırlık çubuk
// (düğmeler 104 px'te biter, boş yerleri fareyi geçirir, ikinci satırda İndir ve "Yorum"), her dosya için yeni bir ana alan
// (role=main, içinde #drive-active-item-info), iki yanda z-index 5'li oklar. Escape kapatır, oklar öbür dosyaya geçer.
// window.__yenidenCiz() Google'ın arayüzünün yeniden çizimini taklit eder: Ana alanın çocukları yeniden kurulur (Drive'ın
// koymadığı çocuklar silinir) ve Yorum düğmesi yeni öğe olur. Gerçek Drive'da bu görülmedi, eklentinin önlemi sınanır
// (DRIVE-TEKNIGI.md §14).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromeBaslat, sekmeAc, ifadeBekle, pikselRengi, cspIzle, CERCEVE, CERCEVE_ODAKTA, CERCEVELER } from './cdp.mjs';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const KIMLIK = { udf: '1AaaBbbCccDddEeeFffGggHhhIiiJjjKk', pdf: '1PppOooNnnMmmLllKkkJjjIiiHhhGgg', yasak: '1YyyXxxWwwVvvUuuTttSssRrrQqqPpp' };
const bekle = ms => new Promise(r => setTimeout(r, ms));

// Kendinden imzalı sınama sertifikası (Chrome --ignore-certificate-errors ile açılır). alanlar: Sertifikanın adları
// (sahte Gmail kendi adlarını verir).
export function sertifika(alanlar = ['drive.google.com', 'drive.usercontent.google.com']) {
  const klasor = fs.mkdtempSync(path.join(os.tmpdir(), 'udf-sertifika-'));
  const adaylar = ['openssl', 'C:/Program Files/Git/usr/bin/openssl.exe', 'C:/Program Files/Git/mingw64/bin/openssl.exe'];
  const anahtar = path.join(klasor, 'a.pem'), sert = path.join(klasor, 's.pem');
  for (const o of adaylar) {
    try {
      execFileSync(o, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', anahtar, '-out', sert, '-days', '2',
        '-subj', `/CN=${alanlar[0]}`, '-addext', 'subjectAltName=' + alanlar.map(a => 'DNS:' + a).join(',')], { stdio: 'ignore' });
      const s = { key: fs.readFileSync(anahtar), cert: fs.readFileSync(sert) };
      fs.rmSync(klasor, { recursive: true, force: true });
      return s;
    } catch { /* sonraki aday */ }
  }
  throw new Error('openssl bulunamadı');
}

// Drive'ın görüntüleyici iskeleti (katman ya da dosya sayfası kabı). Çubuk kapları pointer-events: none (gerçekte de boş
// yerleri fareyi geçiriyor); düğmeler 72–104 px arasında.
const goruntuleyiciCss = `
  .katman { position: fixed; inset: 0; z-index: 2000; background: rgba(0, 0, 0, .92); }
  .cubuk1 { position: relative; z-index: 11; height: 64px; pointer-events: none; }
  .cubuk2 { position: absolute; z-index: 11; left: 16px; right: 16px; top: 64px; height: 48px; pointer-events: none; }
  .cubuk1 button, .cubuk2 button { pointer-events: auto; position: absolute; width: 32px; height: 32px; }
  .sahne { position: absolute; inset: 0; z-index: 0; }
  .ana { position: absolute; inset: 0; }
  .kart { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); background: #282a2c; color: #fff; padding: 24px; }
  .ok { position: absolute; top: calc(50% - 45px); width: 48px; height: 90px; z-index: 5; }
`;

const klasorSayfasi = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Deneme - Google Drive</title><style>${goruntuleyiciCss}</style></head><body>
<table><tbody>
<tr role="row" data-id="${KIMLIK.udf}" tabindex="-1"><td><div aria-label="Dilekce.udf Sıkıştırılmış arşiv" style="padding:12px">Dilekce.udf</div></td>
  <td><span role="button" id="yildiz" style="display:inline-block;padding:8px" onclick="window.__yildiz = (window.__yildiz || 0) + 1">☆</span></td></tr>
<tr role="row" data-id="${KIMLIK.pdf}" tabindex="-1"><td><div aria-label="Ek.pdf PDF" style="padding:12px">Ek.pdf</div></td></tr>
<tr role="row" data-id="${KIMLIK.yasak}" tabindex="-1"><td><div aria-label="Yasak.udf Sıkıştırılmış arşiv" style="padding:12px">Yasak.udf</div></td></tr>
</tbody></table>
<div class="katman" id="katman" hidden>
  <div class="cubuk1"><button aria-label="Kapat" style="left:16px;top:16px" onclick="kapat()">×</button><span id="baslik" style="position:absolute;left:64px;top:22px;color:#fff"></span></div>
  <div class="cubuk2"><button aria-label="İndir" style="left:8px;top:8px">↓</button><button aria-label="Yorum ekleyin" id="yorum" style="left:52px;top:8px;width:97px">Yorum</button></div>
  <div role="dialog" aria-label="Görüntüleyici gösteriliyor." style="position:absolute;inset:0">
    <div class="sahne" id="sahne">
      <button class="ok" id="onceki" aria-label="Önceki" style="left:0" onclick="git(-1)">‹</button>
      <button class="ok" id="sonraki" aria-label="Sonraki" style="right:0" onclick="git(1)">›</button>
    </div>
  </div>
</div>
<script>
  window.__onizlemeler = []; window.__kapatildi = 0; window.__gezinti = [];
  document.cookie = 'ornekNone=1; domain=.google.com; path=/; secure; samesite=none';
  document.cookie = 'ornekLax=1; domain=.google.com; path=/; secure; samesite=lax';
  const satirlar = () => [...document.querySelectorAll('tr[data-id]')];
  let simdiki = -1;
  // Her dosya için yeni ana alan; eskisi gizli kalır, #drive-active-item-info yenisine taşınır (gerçek Drive gibi).
  function goster(i) {
    simdiki = i;
    const r = satirlar()[i];
    const ad = r.querySelector('[aria-label]').textContent;
    for (const a of document.querySelectorAll('#sahne > [role=main]')) a.style.display = 'none';
    const ana = document.createElement('div');
    ana.setAttribute('role', 'main');
    ana.className = 'ana';
    let bilgi = document.getElementById('drive-active-item-info');
    if (!bilgi) { bilgi = document.createElement('div'); bilgi.id = 'drive-active-item-info'; bilgi.style.display = 'none'; }
    bilgi.textContent = JSON.stringify({ id: r.dataset.id, title: ad, mimeType: /\\.pdf$/.test(ad) ? 'application/pdf' : 'application/x-zip' });
    const kart = document.createElement('div');
    kart.className = 'kart';
    kart.textContent = /\\.pdf$/.test(ad) ? 'PDF sayfaları' : 'Dosya önizlenemedi';
    ana.append(bilgi, kart);
    document.getElementById('sahne').prepend(ana);
    document.getElementById('baslik').textContent = ad;
    document.getElementById('katman').hidden = false;
  }
  // Gerçek Drive görüntüleyiciyi açınca odağı içine alır.
  function onizlemeAc(r) {
    window.__onizlemeler.push(r.dataset.id);
    goster(satirlar().indexOf(r));
    const d = document.querySelector('[role=dialog]');
    d.tabIndex = -1;
    d.focus();
  }
  function kapat() {
    if (document.getElementById('katman').hidden) return;
    document.getElementById('katman').hidden = true;
    for (const a of document.querySelectorAll('#sahne > [role=main]')) a.remove();
    window.__kapatildi++;
  }
  function git(yon) {
    if (document.getElementById('katman').hidden) return;
    const n = satirlar().length, i = (simdiki + yon + n) % n;
    window.__gezinti.push(satirlar()[i].dataset.id);
    goster(i);
  }
  // Yeniden çizim: Ana alanın çocukları yeniden kurulur (Drive'ın koymadıkları silinir), Yorum düğmesi yeni öğe.
  window.__yenidenCiz = () => {
    const bilgi = document.getElementById('drive-active-item-info');
    const ana = bilgi && bilgi.closest('[role=main]');
    if (!ana) return 0;
    const eski = ana.querySelector('.kart');
    const kart = document.createElement('div');
    kart.className = 'kart';
    kart.textContent = eski ? eski.textContent : '';
    ana.replaceChildren(bilgi, kart);
    const y = document.getElementById('yorum');
    const yeni = document.createElement('button');
    for (const o of ['aria-label', 'id', 'style']) yeni.setAttribute(o, y.getAttribute(o));
    yeni.textContent = y.textContent;
    y.replaceWith(yeni);
    return 1;
  };
  document.addEventListener('click', e => { const r = e.target.closest('tr[data-id]'); if (!r) return; r.focus(); if (e.detail === 2) onizlemeAc(r); });
  document.addEventListener('keydown', e => {
    const acik = !document.getElementById('katman').hidden;
    if (e.key === 'Enter' && !acik) { const r = document.activeElement && document.activeElement.closest('tr[data-id]'); if (r) onizlemeAc(r); }
    if (!acik) return;
    if (e.key === 'Escape') kapat();
    if (e.key === 'ArrowRight') git(1);
    if (e.key === 'ArrowLeft') git(-1);
  });
</script></body></html>`;

const dosyaSayfasi = (id, yapisiz = false, golgeli = false) => `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Dilekce.udf - Google Drive</title>
<meta property="og:url" content="https://drive.google.com/file/u/0/d/${id}/view"><style>${goruntuleyiciCss}</style></head><body>
<div class="katman" style="z-index:100;background:#131314">
  <div class="cubuk1"><span style="position:absolute;left:24px;top:22px;color:#fff">Dilekce.udf</span><button aria-label="Dosya" style="left:40px;top:30px">D</button></div>
  <div class="cubuk2"><button aria-label="İndir" style="left:8px;top:8px">↓</button><button aria-label="Yorum ekleyin" id="yorum" style="left:52px;top:8px;width:97px">Yorum</button></div>
  <div class="sahne"><div ${yapisiz ? '' : 'role="main" '}class="ana">
    <div id="drive-active-item-info" style="display:none">{"id": "${id}", "title": "Dilekce.udf", "mimeType": "application\\/x-zip"}</div>
    <div class="kart" id="kart">Dosya önizlenemedi</div>
  </div></div>
</div>${golgeli ? "<script>document.querySelector('.ana').attachShadow({ mode: 'open' }).innerHTML = '<slot></slot>';</script>" : ''}</body></html>`;

// secenek.yalnizNone: indirme yalnız SameSite=None çerezle tanınır (üçüncü taraf çerezleri kapalıyken gömülü sayfanın
// kendi isteği reddedilir, arka planın isteği geçer).
// secenek.indirmeGecikmesi: Her indirme bu kadar ms geç yanıtlanır (hız ölçümü). secenek.bayt verilirse Dilekce.udf'nin
// içeriği odur (ölçüm aynı sunucuda başka belgeye geçer). Her isteğin geliş zamanı (Date.now) kaydedilir.
export async function sunucuKur(bayt, secenek = {}) {
  const istekler = [];
  const sunucu = https.createServer(sertifika(), (q, y) => {
    const u = new URL(q.url, `https://${q.headers.host}`);
    if (q.headers.host.startsWith('drive.usercontent.google.com')) {
      const cerez = q.headers.cookie || '';
      istekler.push({ id: u.searchParams.get('id'), au: u.searchParams.get('authuser'), cerez, koken: q.headers.origin || '', zaman: Date.now() });
      if (u.pathname !== '/download') { y.writeHead(404); return y.end(); }
      if (secenek.yalnizNone && !/ornekNone=1/.test(cerez)) { y.writeHead(401, { 'content-type': 'text/plain' }); return y.end('oturum yok'); }
      // secenek.reddet: Sıradaki bu kadar indirme isteği 401 alır (arka planın indirmesi başaramayınca görüntüleyicinin
      // kendi indirmesi sınanır).
      if (secenek.reddet > 0) { secenek.reddet--; y.writeHead(401, { 'content-type': 'text/plain' }); return y.end('oturum yok'); }
      if (u.searchParams.get('id') === KIMLIK.udf) {
        const gonder = () => {
          y.writeHead(200, { 'content-type': 'application/octet-stream', 'content-disposition': 'attachment; filename="Dilekce.udf"', 'access-control-allow-origin': '*' });
          y.end(secenek.bayt || bayt);
        };
        // secenek.gecikme: yalnız bir sonraki indirme bu kadar ms geç yanıtlanır (yükleme yazısı görülebilsin).
        if (secenek.gecikme) { const ms = secenek.gecikme; secenek.gecikme = 0; setTimeout(gonder, ms); return; }
        if (secenek.indirmeGecikmesi) { setTimeout(gonder, secenek.indirmeGecikmesi); return; }
        return gonder();
      }
      y.writeHead(403, { 'content-type': 'text/html' });
      return y.end('<html>Yasak</html>');
    }
    if (/^\/drive\//.test(u.pathname)) { y.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return y.end(klasorSayfasi); }
    const m = /^\/file\/d\/([^/]+)\/view/.exec(u.pathname);
    if (m) { y.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return y.end(dosyaSayfasi(m[1], u.searchParams.has('yapisiz'), u.searchParams.has('golgeli'))); }
    y.writeHead(404); y.end();
  });
  await new Promise(r => sunucu.listen(0, '127.0.0.1', r));
  return { sunucu, istekler, port: sunucu.address().port };
}

// Bir sınama oturumu: Chrome, eklenti, Drive sekmesi ve yardımcılar. eklenti: Yüklenecek eklenti klasörü (hız ölçümü
// karşılaştırma için başka bir kopyayı da yükleyebilir).
export async function oturumKur({ port, ekler = [], ekEklentiler = [], eklenti: klasor = KOK }) {
  const c = await chromeBaslat({ ekler: [`--host-resolver-rules=MAP drive.google.com 127.0.0.1:${port},MAP drive.usercontent.google.com 127.0.0.1:${port}`,
    '--ignore-certificate-errors', '--window-size=1280,900', ...ekler] });
  const { id: eklenti } = await c.gonder('Extensions.loadUnpacked', { path: klasor });
  for (const yol of ekEklentiler) await c.gonder('Extensions.loadUnpacked', { path: yol });
  await c.gonder('Target.setDiscoverTargets', { discover: true });
  const s = await sekmeAc(c, `https://drive.google.com/drive/u/0/folders/deneme`);
  for (const a of ['Runtime.enable', 'Page.enable']) await s.g(a);
  await ifadeBekle(s.g, "document.readyState === 'complete' && !!document.querySelector('[data-id]')");
  await bekle(800);
  const deger = async (g, ifade) => (await g('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression: ifade })).result.value;
  const satir = async kimlik => deger(s.g, `(() => { const b = document.querySelector('[data-id="${kimlik}"] div').getBoundingClientRect(); return { x: b.left + 20, y: b.top + b.height / 2 }; })()`);
  const ciftTikla = async (g, { x, y }) => {
    for (const n of [1, 2]) {
      await g('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: n });
      await g('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: n });
    }
  };
  const TUS = { Escape: [27, 'Escape'], Enter: [13, 'Enter'], ArrowRight: [39, 'ArrowRight'], ArrowLeft: [37, 'ArrowLeft'], p: [80, 'KeyP'] };
  const tus = async (g, ad, modifiers = 0) => {
    const [kod, code] = TUS[ad];
    await g('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: ad, code, windowsVirtualKeyCode: kod, modifiers });
    if (ad === 'Enter') await g('Input.dispatchKeyEvent', { type: 'char', key: ad, text: '\r', modifiers });
    await g('Input.dispatchKeyEvent', { type: 'keyUp', key: ad, code, windowsVirtualKeyCode: kod, modifiers });
  };
  // Drive sayfasına gömülü görüntüleyici çerçevesi (ayrı süreçte; hedef türü iframe).
  async function cerceveBul(sure = 10000) {
    const bas = Date.now();
    for (;;) {
      const { targetInfos } = await c.gonder('Target.getTargets');
      const h = targetInfos.find(t => t.type === 'iframe' && t.url.includes(`${eklenti}/gomulu.html#t=`));
      if (h) {
        const { sessionId } = await c.gonder('Target.attachToTarget', { targetId: h.targetId, flatten: true });
        const g = (m, p) => c.gonder(m, p, sessionId);
        await g('Runtime.enable');
        return { hedef: h, g };
      }
      if (Date.now() - bas > sure) return null;
      await bekle(150);
    }
  }
  const belgeDurumu = g => ifadeBekle(g, `(() => { const h = document.querySelector('.durum.hata'); if (h) return 'HATA: ' + h.querySelector('h2').textContent; return document.querySelector('.udf-sayfa') ? 'BELGE: ' + (document.querySelector('.udf').textContent.includes('DENEME İŞ MAHKEMESİNE') ? 'metin var' : 'metin yok') : ''; })()`, 15000)
    .catch(async () => 'zaman aşımı: ' + await deger(g, "location.href.replace(/#.*/, '') + ' · ' + document.readyState + ' · ' + (document.querySelector('.durum') ? document.querySelector('.durum').innerText.replace(/\\s+/g, ' ').slice(0, 120) : document.body && document.body.innerText.slice(0, 80))").catch(e => String(e)));
  // Gömme denetimi: çerçeve görünen dosyanın ana alanında mı, üst çubuğun altında mı, Drive'ın içeriği gizli mi,
  // oklar çerçevenin üstünde mi.
  const gommeDurumu = () => deger(s.g, `(() => {
    const bilgi = document.getElementById('drive-active-item-info');
    const ana = bilgi && bilgi.closest('[role=main]');
    const cerceveler = ${CERCEVELER};
    const c = ana && ((ana.shadowRoot && ana.shadowRoot.querySelector('iframe.udf-okuyucu-cerceve')) || ana.querySelector(':scope > iframe.udf-okuyucu-cerceve'));
    const isaretli = document.querySelectorAll('[data-udf-okuyucu-gomulu]').length;
    const y = document.getElementById('yorum');
    const yorum = y ? getComputedStyle(y).display !== 'none' : null, gizli = document.querySelectorAll('[data-udf-okuyucu-gizli]').length;
    if (!c) return { var: false, sayi: cerceveler.length, isaretli, yorum, gizli };
    const r = c.getBoundingClientRect(), ar = ana.getBoundingClientRect();
    const kart = ana.querySelector('.kart');
    const ok = document.getElementById('sonraki');
    const okR = ok ? ok.getBoundingClientRect() : null;
    const okUstte = okR ? document.elementFromPoint(okR.left + okR.width / 2, okR.top + okR.height / 2) === ok : null;
    return { var: true, sayi: cerceveler.length, isaretli, yorum, gizli, ust: Math.round(r.top - ar.top), alt: Math.round(ar.bottom - r.bottom), en: Math.round(r.width), anaEn: Math.round(ar.width),
      kartGizli: kart ? getComputedStyle(kart).visibility === 'hidden' : null, okUstte, odak: c.getRootNode().activeElement === c,
      golgede: !!ana.shadowRoot && ana.shadowRoot.contains(c) };
  })()`);
  const sekmeHedefleri = async () => (await c.gonder('Target.getTargets')).targetInfos.filter(t => t.type === 'page' && t.url.includes('goruntule.html'));
  return { c, eklenti, s, deger, satir, ciftTikla, tus, cerceveBul, belgeDurumu, gommeDurumu, sekmeHedefleri };
}

export async function driveSina(udfYolu, ekranYolu) {
  const bayt = fs.readFileSync(udfYolu || path.join(KOK, 'testler', 'ornekler', 'dilekce.udf'));
  const sonuclar = [];
  const sonuc = (ad, tamam, ayrinti = '') => { sonuclar.push({ ad, tamam }); console.log(`${tamam ? 'TAMAM' : 'SORUN'} ${ad}${ayrinti ? ' · ' + ayrinti : ''}`); };

  // ================================================================ 1. oturum: varsayılan ayarlar
  const sunucuAyari = { gecikme: 2000 };
  const { sunucu, istekler, port } = await sunucuKur(bayt, sunucuAyari);
  const o = await oturumKur({ port });
  const { c, eklenti, s, deger, satir, ciftTikla, tus, cerceveBul, belgeDurumu, gommeDurumu, sekmeHedefleri } = o;
  const cspIhlalleri = await cspIzle(c, eklenti);
  try {
    console.log('— Drive’ın içinde görünümü (varsayılan)');
    // D1. Çift tıklama: Drive'ın görüntüleyicisi açılır, belge onun ana alanına gömülür, yeni sekme açılmaz. Çerçevedeki
    // görüntüleyicinin hazır olduğu an ("hazir" iletisi) kaydedilir: Dosyayı arka plan gömme kaydıyla birlikte, görüntüleyici
    // daha yüklenirken indirmeye başlamalı.
    await deger(s.g, "window.__cerceveHazir = 0; addEventListener('message', e => { if (!window.__cerceveHazir && e.data && e.data.udfOkuyucu === 1 && e.data.tur === 'hazir') window.__cerceveHazir = Date.now(); }); 1");
    await ciftTikla(s.g, await satir(KIMLIK.udf));
    let f = await cerceveBul();
    // İlk indirme 2 sn geç yanıtlanır: yüklenirken eklentinin açtığı belli olur, altında dosya adı.
    const yukleme = f ? await ifadeBekle(f.g, "(() => { const d = document.querySelector('.durum.yukleniyor'); return d && { baslik: d.querySelector('h2').textContent, ad: (d.querySelector('p') || {}).textContent || '' }; })()", 1500).catch(() => null) : null;
    sonuc('yüklenirken "UDF Ön İzleme eklentisiyle açılıyor…" yazar', !!yukleme && yukleme.baslik === 'UDF Ön İzleme eklentisiyle açılıyor…' && yukleme.ad === 'Dilekce.udf', JSON.stringify(yukleme));
    let durum = f ? await belgeDurumu(f.g) : 'çerçeve yok';
    let gom = await gommeDurumu();
    const kip = f ? await deger(f.g, "document.documentElement.classList.contains('gomulu') && getComputedStyle(document.querySelector('.cubuk')).position") : null;
    sonuc('çift tıklama → Drive’ın görüntüleyicisinde belge', /^BELGE: metin var/.test(durum) && gom.var && (await sekmeHedefleri()).length === 0,
      `${durum} · Drive önizlemesi: ${await deger(s.g, 'window.__onizlemeler.length')} · yeni sekme: ${(await sekmeHedefleri()).length}`);
    {
      const d1 = istekler.filter(i => i.id === KIMLIK.udf), hazir = await deger(s.g, 'window.__cerceveHazir');
      sonuc('dosya bir kez istenir, arka plan görüntüleyici yüklenirken indirmeye başlar', d1.length === 1 && hazir > 0 && d1[0].zaman < hazir,
        `${d1.length} istek · istek görüntüleyicinin hazır olmasından ${hazir - (d1[0] ? d1[0].zaman : 0)} ms önce`);
    }
    sonuc('gömme yeri: ana alanın gölge kökünde, çubuğun altında, Drive içeriği ve "Yorum" düğmesi gizli, oklar üstte', gom.var && gom.golgede && gom.yorum === false && gom.gizli === 1 && gom.ust === 112 && gom.alt === 0 && gom.en === gom.anaEn && gom.kartGizli && gom.okUstte && gom.sayi === 1,
      JSON.stringify(gom));
    if (ekranYolu && f) {
      await ifadeBekle(f.g, "[...document.querySelectorAll('.udf-resim img')].every(x => x.complete)", 5000).catch(() => {});
      fs.writeFileSync(ekranYolu, Buffer.from((await s.g('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
      console.log('ekran görüntüsü:', ekranYolu);
    }
    sonuc('gömülü kip: koyu hap altta, odak belgede', kip === 'fixed' && gom.odak, `kip=${kip} · odak=${gom.odak}`);
    const ek = f ? await deger(f.g, "({ notlar: !document.getElementById('notlar-paneli').hidden, not: document.querySelectorAll('#not-listesi li').length, rozet: [...document.querySelectorAll('#rozetler .rozet')].map(r => r.textContent), sekme: !!document.getElementById('dugme-sekme'), kod: /doğrulama/i.test(document.querySelector('.cubuk').textContent) })") : null;
    sonuc('notlu belgede not bölmesi kendiliğinden açık', !!ek && ek.notlar && ek.not > 0, JSON.stringify(ek));
    sonuc('e-imzalı belgede yalnız "E-imzalıdır" yazar', !!ek && ek.rozet.filter(r => /imza/i.test(r)).join() === 'E-imzalıdır', ek ? ek.rozet.join(' | ') : '');
    sonuc('gömülü çubukta "Yeni sekmede aç" ve doğrulama kodu yok', !!ek && !ek.sekme && !ek.kod, JSON.stringify(ek));
    // D1c. Drive ana alanı ve çubuğu yeniden çizer (kendi koymadığı çocukları siler): Belge yerinde kalır, yeniden kaydedilmez ve
    // indirilmez, Drive'ın yeni içeriği ve yeni Yorum düğmesi de gizlenir.
    if (f) {
      await deger(f.g, 'window.__ayniBelge = 1; 1');
      const once = istekler.filter(i => i.id === KIMLIK.udf).length;
      await deger(s.g, 'window.__yenidenCiz()');
      await bekle(800);
      const sonra = await gommeDurumu();
      const ayni = await deger(f.g, 'window.__ayniBelge === 1').catch(() => false);
      const yeni = istekler.filter(i => i.id === KIMLIK.udf).length - once;
      sonuc('Drive yeniden çizince belge yerinde kalır (yeniden yüklenmez), Drive içeriği ve yeni Yorum düğmesi gizli', ayni === true && sonra.var && sonra.golgede &&
        sonra.sayi === 1 && sonra.kartGizli && sonra.yorum === false && yeni === 0, `aynı belge: ${ayni} · ${yeni} yeni istek · ${JSON.stringify(sonra)}`);
      // Drive düğmeyi işaretli öğeden kopyalasa da (öznitelikler kopyalanır) belge kapanınca işaret kalkar (D4 denetler).
      await deger(s.g, "(() => { const y = document.getElementById('yorum'); y.replaceWith(y.cloneNode(true)); return 1; })()");
    }
    // Yakınlaştırma (iki çizginin arası) çubuğun tam ortasında: e-imzalı ya da değil, notlu ya da değil. Örnek belge e-imzalı
    // ve notlu; öbür durumların çubuğu çerçevenin içinde kurulur (e-imzasız notsuzda "E-imzasız" rozeti, B2 denetler).
    // Düğmeler hapın içinde, iki yan arasında üst üste binme yok. Çubuğun yerleşimi (cubuguYerlestir, .sikisik) belge
    // alanının boyu değişince yeniden hesaplanır: her durumda Drive sekmesi 1 px daraltılıp genişletilir.
    if (f) {
      const durumlar = [['e-imzalı ve notlu', 'imzali', true], ['yalnız e-imzalı', 'imzali', false], ['e-imzasız ve notlu', 'yok', true], ['e-imzasız ve notsuz', 'imzasiz', false]];
      const olcumler = [];
      const [pEn, pBoy] = await deger(s.g, '[innerWidth, innerHeight]');
      const yerlestir = async en => {
        await s.g('Emulation.setDeviceMetricsOverride', { width: en, height: pBoy, deviceScaleFactor: 1, mobile: false });
        await bekle(300);
      };
      for (const [i, [ad, rozet, notlar]] of durumlar.entries()) {
        await deger(f.g, `(() => {
          const r = document.getElementById('rozetler'), n = document.getElementById('dugme-notlar');
          window.__rozetler = window.__rozetler || [...r.children];
          const imzasiz = Object.assign(document.createElement('span'), { className: 'rozet', textContent: 'E-imzasız' });
          r.replaceChildren(...({ imzali: window.__rozetler, imzasiz: [imzasiz], yok: [] })['${rozet}']);
          n.hidden = !${notlar};
          return 1;
        })()`);
        await yerlestir(pEn - 1 + (i % 2));   // önceki durumdan farklı genişlik: alan yeniden ölçülür
        const o = await deger(f.g, `(() => {
          const kutu = e => e.getBoundingClientRect();
          const c = kutu(document.querySelector('.cubuk')), z = kutu(document.getElementById('olcek-grup'));
          const gorunen = [...document.querySelectorAll('.cubuk-sag .dugme, #rozetler .rozet')].filter(e => e.offsetParent && !e.closest('#olcek-grup')).map(kutu);
          return { fark: Math.abs((c.left + c.right) / 2 - (z.left + z.right) / 2), sikisik: document.querySelector('.cubuk').classList.contains('sikisik'),
            tasan: gorunen.filter(b => b.left < c.left - 1 || b.right > c.right + 1).length, ust: gorunen.filter(b => b.right > z.left + 1 && b.left < z.right - 1).length,
            hap: [c.left, c.top, c.width, c.height].map(Math.round) };
        })()`);
        olcumler.push({ ad, ...o });
        if (ekranYolu && o) {
          const cer = await deger(s.g, `(() => { const r = ${CERCEVE}.getBoundingClientRect(); return [r.left, r.top]; })()`);
          const kirp = { x: cer[0] + o.hap[0] - 8, y: cer[1] + o.hap[1] - 8, width: o.hap[2] + 16, height: o.hap[3] + 16, scale: 2 };
          const yol = ekranYolu.replace(/(\.png)?$/i, `-cubuk-${olcumler.length}.png`);
          fs.writeFileSync(yol, Buffer.from((await s.g('Page.captureScreenshot', { format: 'png', clip: kirp })).data, 'base64'));
          console.log(`çubuk (${ad}):`, yol);
        }
      }
      await deger(f.g, "(() => { document.getElementById('rozetler').replaceChildren(...window.__rozetler); document.getElementById('dugme-notlar').hidden = false; return 1; })()");
      await yerlestir(pEn - 1);
      await s.g('Emulation.clearDeviceMetricsOverride');
      await bekle(500);
      sonuc('yakınlaştırma çubuğun tam ortasında (e-imzalı/e-imzasız, notlu/notsuz: 4 durum)',
        olcumler.length === 4 && olcumler.every(o => o.fark <= 1 && !o.sikisik && o.tasan === 0 && o.ust === 0), JSON.stringify(olcumler.map(({ hap, ...o }) => o)));
    }
    // Not bölmesi Drive'ın sağdaki okunun altında kalmaz (oka basılırsa başka dosyaya geçilir); çubuk bölmenin üstüne
    // binmez: geniş pencerede bölmenin solunda kalır, dar pencerede (≤ 900 px) bölme çubuğun üstünde biter.
    if (f) {
      const yerlesim = async () => {
        const ic = await deger(f.g, "(() => { const p = document.getElementById('notlar-paneli').getBoundingClientRect(), c = document.querySelector('.cubuk').getBoundingClientRect(); return { panel: [p.left, p.top, p.right, p.bottom].map(Math.round), cubuk: [c.left, c.top, c.right, c.bottom].map(Math.round) }; })()");
        const dis = await deger(s.g, `(() => { const c = ${CERCEVE}.getBoundingClientRect(), o = document.getElementById('sonraki').getBoundingClientRect(); return { cerceve: Math.round(c.left), ok: Math.round(o.left) }; })()`);
        return { ...ic, ...dis };
      };
      const genis = await yerlesim();
      sonuc('not bölmesi Drive’ın okunun solunda kalır', genis.cerceve + genis.panel[2] <= genis.ok, JSON.stringify(genis));
      const olcu = async (en, boy) => {
        await s.g('Emulation.setDeviceMetricsOverride', { width: en, height: boy, deviceScaleFactor: 1, mobile: false });
        await bekle(700);
        return yerlesim();
      };
      const yarim = await olcu(960, 820);
      const dar = await olcu(800, 820);
      await s.g('Emulation.clearDeviceMetricsOverride');
      await bekle(700);
      sonuc('çubuk not bölmesinin üstüne binmez (960 ve 800 px)', yarim.cubuk[2] <= yarim.panel[0] && yarim.cerceve + yarim.panel[2] <= yarim.ok &&
        (dar.cubuk[1] >= dar.panel[3] || dar.cubuk[2] <= dar.panel[0]) && dar.cerceve + dar.panel[2] <= dar.ok, `960: ${JSON.stringify(yarim)} · 800: ${JSON.stringify(dar)}`);

      // Not bölmesi açıkken sayfa, yer yettikçe bölme kapalıykenki yerinde (ortada) kalır; çubuk sayfanın ortasında
      // durur. Yer yetmezse sayfa bölmeye 16 px'ten, çubuk 12 px'ten fazla yaklaşmaz.
      const ortalar = () => deger(f.g, `(() => {
        const p = document.querySelector('.udf-sayfa').getBoundingClientRect(), c = document.querySelector('.cubuk').getBoundingClientRect();
        const n = document.getElementById('notlar-paneli');
        return { sayfa: Math.round((p.left + p.right) / 2), sayfaSag: Math.round(p.right), cubuk: Math.round((c.left + c.right) / 2),
          cubukSag: Math.round(c.right), panel: n.hidden ? null : Math.round(n.getBoundingClientRect().left), olcek: document.getElementById('olcek').textContent };
      })()`);
      const notlar = async acik => {
        await deger(f.g, `(() => { if (document.getElementById('notlar-paneli').hidden === ${acik}) document.getElementById('dugme-notlar').click(); return 1; })()`);
        await bekle(400);
      };
      await s.g('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1000, deviceScaleFactor: 1, mobile: false });
      await bekle(700);
      const genisAcik = await ortalar();
      await notlar(false);
      const genisKapali = await ortalar();
      await notlar(true);
      await s.g('Emulation.clearDeviceMetricsOverride');
      await bekle(700);
      const olagan = await ortalar();
      sonuc('notlar açıkken sayfa ortada kalır, çubuk sayfanın ortasında (1920 px)', genisAcik.panel != null && genisKapali.panel == null &&
        Math.abs(genisAcik.sayfa - genisKapali.sayfa) <= 1 && Math.abs(genisAcik.cubuk - genisAcik.sayfa) <= 2 &&
        genisAcik.olcek === genisKapali.olcek && genisAcik.sayfaSag + 16 <= genisAcik.panel, `açık: ${JSON.stringify(genisAcik)} · kapalı: ${JSON.stringify(genisKapali)}`);
      sonuc('yer yetmezse sayfa ve çubuk bölmeye binmez (1280 px)', olagan.panel != null && olagan.sayfaSag + 16 <= olagan.panel &&
        olagan.cubukSag + 12 <= olagan.panel && Math.abs(olagan.cubuk - olagan.sayfa) <= 2, JSON.stringify(olagan));

      // Sayfa küçültülünce (bölme açık) ortası bölmeye yaklaşır; çubuk daralıp düğmelerini hapın dışına, bölmenin üstüne
      // taşırmamalı (gözden geçirmede 1000 ve 1100 px'te %25 ve %33'te görüldü): çubuk sola kayar.
      const kucuk = [];
      for (const en of [1000, 1100]) {
        await s.g('Emulation.setDeviceMetricsOverride', { width: en, height: 900, deviceScaleFactor: 1, mobile: false });
        await bekle(500);
        for (const hedef of ['%33', '%25']) {
          await deger(f.g, `(async () => { for (let i = 0; i < 12 && document.getElementById('olcek').textContent !== '${hedef}'; i++) { document.getElementById('dugme-uzak').click(); await new Promise(r => setTimeout(r, 60)); } return 1; })()`);
          await bekle(400);
          kucuk.push(await deger(f.g, `(() => {
            const c = document.querySelector('.cubuk').getBoundingClientRect(), panel = document.getElementById('notlar-paneli').getBoundingClientRect().left;
            const dugmeler = ['olcek-grup', 'dugme-notlar', 'dugme-yazdir'].map(id => document.getElementById(id).getBoundingClientRect());
            return { en: ${en}, olcek: document.getElementById('olcek').textContent, cubuk: [Math.round(c.left), Math.round(c.right)], panel: Math.round(panel),
              tasan: dugmeler.filter(r => r.left < c.left - 1 || r.right > c.right + 1).length, rozet: document.getElementById('rozetler').clientWidth };
          })()`));
        }
        await deger(f.g, "document.getElementById('olcek').click(); 1");
      }
      await s.g('Emulation.clearDeviceMetricsOverride');
      await bekle(700);
      sonuc('küçültülmüş sayfada çubuk düğmeleri hapın içinde, bölmeye binmez (1000/1100 px, %33/%25)',
        kucuk.length === 4 && kucuk.every(k => k.tasan === 0 && k.cubuk[1] + 12 <= k.panel && k.rozet > 0 && ['%33', '%25'].includes(k.olcek)), JSON.stringify(kucuk));

      // Sayfa her çerçeveye koyu renk düzeni verse de çerçeve saydam kalır, arkada Drive'ın koyu katmanı görünür. Kural
      // Dark Reader'ınki gibi adsız bir @layer içinde: katmanlı !important, katmansız içerik betiği CSS'ini yener. Chrome
      // renk düzeni içindeki sayfayla uyuşmayan çerçevenin arkasını opak beyaz boyuyordu. Sayfaya koyu bir
      // <meta name="color-scheme"> de konur: çerçevenin "normal" düzeni ona göre çözülürdü. Piksel sayfanın solundaki
      // boşluktan, Drive'ın okunun yukarısından alınır.
      await deger(s.g, `(() => {
        const st = document.createElement('style'); st.id = 'koyu-cerceve'; st.textContent = '@layer { iframe { color-scheme: dark !important; } }';
        const m = document.createElement('meta'); m.id = 'koyu-meta'; m.name = 'color-scheme'; m.content = 'dark';
        document.head.append(m, st); return 1; })()`);
      await bekle(300);
      const nokta = await deger(s.g, `(() => { const c = ${CERCEVE}, r = c.getBoundingClientRect(); return { x: Math.round(r.left + 12), y: Math.round(r.top + 100), sema: getComputedStyle(c).colorScheme }; })()`);
      const renk = await pikselRengi(s.g, nokta.x, nokta.y);
      await deger(s.g, "document.getElementById('koyu-cerceve').remove(); document.getElementById('koyu-meta').remove(); 1");
      sonuc('sayfa çerçevelere koyu düzen verse de çerçeve saydam (Dark Reader, koyu meta etiketi)', nokta.sema === 'light' && renk.every(v => v < 60),
        `color-scheme: ${nokta.sema} · sayfanın solundaki piksel: rgb(${renk.join(', ')})`);
    }
    const ilk = istekler.find(i => i.id === KIMLIK.udf);
    sonuc('gömülü görünümün indirme isteği (arka plandan) hesap ve çerezle', !!ilk && ilk.au === '0' && /ornekNone=1/.test(ilk.cerez) && /ornekLax=1/.test(ilk.cerez),
      ilk ? `authuser=${ilk.au} · çerezler: ${ilk.cerez.replace(/=1/g, '')}` : 'istek yok');
    const adresGizli = f && !/Dilekce/i.test(f.hedef.url);
    sonuc('çerçeve adresinde dosya adı yok', adresGizli, f ? f.hedef.url.replace(/#t=.+/, '#t=…') : '');

    // D2. Yakınlaştırma: + ölçeği büyütür, yüzde düğmesi sığdırmaya döndürür.
    if (f) {
      const once = await deger(f.g, "document.getElementById('olcek').textContent");
      await deger(f.g, "document.getElementById('dugme-yakin').click()");
      const sonra = await deger(f.g, "document.getElementById('olcek').textContent + ' ' + getComputedStyle(document.querySelector('.udf')).zoom");
      await deger(f.g, "document.getElementById('olcek').click()");
      const geri = await deger(f.g, "document.getElementById('olcek').textContent");
      sonuc('yakınlaştırma düğmeleri', once === '%100' && /^%110 1\.1/.test(sonra) && geri === once, `${once} → ${sonra} → ${geri}`);
    }

    // D3. Yazdırma (Ctrl+P belgede): çerçeve hemen basar; Drive sekmesinin başlığına dokunulmaz (değişiklik geçmişe
    // yazılırdı). Başlık değişiklikleri sayfada kaydedilir.
    if (f) {
      await deger(s.g, "window.__basliklar = []; new MutationObserver(() => window.__basliklar.push(document.title)).observe(document.querySelector('title'), { childList: true, characterData: true, subtree: true }); 1");
      await deger(f.g, 'window.__basim = 0; window.print = () => { window.__basim++; window.__basimZamani = Date.now(); window.__basimBasligi = document.title; }; 1');
      const basladi = Date.now();
      await tus(s.g, 'p', 2);
      await ifadeBekle(f.g, 'window.__basim === 1', 6000).catch(() => {});
      await bekle(500);
      const basliklar = await deger(s.g, 'window.__basliklar');
      const basim = await deger(f.g, 'window.__basim');
      const cerceveBasligi = await deger(f.g, 'window.__basimBasligi');
      const gecikme = (await deger(f.g, 'window.__basimZamani || 0')) - basladi;
      sonuc('Ctrl+P: belge hemen yazdırılır, Drive sekmesinin başlığı değişmez', basliklar.length === 0 && basim === 1 && gecikme < 1500 && cerceveBasligi === 'Dilekce',
        `Drive başlık değişikliği: ${JSON.stringify(basliklar)} · baskı: ${basim} · ${gecikme} ms · çerçeve başlığı: ${cerceveBasligi}`);
      // Odak Drive'dayken Ctrl+P da belgeyi yazdırır (Drive'ınki değil).
      await deger(s.g, "document.getElementById('baslik').tabIndex = -1; document.getElementById('baslik').focus(); 1");
      await tus(s.g, 'p', 2);
      await bekle(2500);
      sonuc('Ctrl+P (odak Drive’ın çubuğunda) da belgeyi yazdırır', await deger(f.g, 'window.__basim') === 2, `baskı: ${await deger(f.g, 'window.__basim')}`);
      await deger(s.g, `${CERCEVE}.focus(); 1`);
    }

    // D3b. Drive'ın PDF görüntüleyicisindeki gibi sayfaların dışındaki boşluğa (sol, sağ, son sayfanın altı, not bölmesinin
    // sağındaki şerit) tıklamak pencereyi kapatır; sayfa, sayfalar arası, sağ tık ve sürüklemeler kapatmaz (gerçek Drive'da
    // 2026-10-07'de ölçüldü; boşluktan sayfaya sürükleme Drive'da kapatıyor, burada bilerek kapatmıyor). Her adımdan önce
    // seçim temizlenir (seçili metnin üstünde başlayan basış sürükle-bırak olur, tıklama hiç oluşmaz) ve çerçevedeki tıklama
    // sayılır: kapatmaması gereken adımda tıklama gerçekten oluşmuş olmalı. Noktalar çerçeveye göre verilir.
    if (f) {
      const kutu = await deger(s.g, `(() => { const r = ${CERCEVE}.getBoundingClientRect(); return { x: r.left, y: r.top }; })()`);
      const fare = (type, x, y, ek = {}) => s.g('Input.dispatchMouseEvent', { type, x: kutu.x + x, y: kutu.y + y, ...ek });
      const tikla = async (x, y, button = 'left') => {
        const b = button === 'left' ? 1 : 2;
        await fare('mouseMoved', x, y);
        await fare('mousePressed', x, y, { button, buttons: b, clickCount: 1 });
        await fare('mouseReleased', x, y, { button, buttons: 0, clickCount: 1 });
      };
      const surukle = async (x1, y1, x2, y2) => {
        await fare('mouseMoved', x1, y1);
        await fare('mousePressed', x1, y1, { button: 'left', buttons: 1, clickCount: 1 });
        for (let i = 1; i <= 8; i++) await fare('mouseMoved', x1 + (x2 - x1) * i / 8, y1 + (y2 - y1) * i / 8, { button: 'left', buttons: 1 });
        await fare('mouseReleased', x2, y2, { button: 'left', buttons: 0, clickCount: 1 });
      };
      const kapanis = () => deger(s.g, 'window.__kapatildi');
      const hazirla = () => deger(f.g, "(() => { if (!window.__tikSayaci) { window.__tikSayaci = 1; window.__tik = 0; document.addEventListener('click', () => { window.__tik++; }, true); } window.__tik = 0; getSelection().removeAllRanges(); return 1; })()");
      const yeniden = async () => {
        await ciftTikla(s.g, await satir(KIMLIK.udf));
        f = await cerceveBul();
        if (f) await belgeDurumu(f.g);
        await bekle(500);
      };
      // Belge başa alınır; noktalar yazılı bir satırın hizasında (sürüklemeler metin seçebilsin), Drive'ın oklarının yukarısında.
      const olc = () => deger(f.g, `(() => { document.getElementById('alan').scrollTop = 0;
        const r = document.querySelector('.udf-sayfa').getBoundingClientRect(), p = document.getElementById('notlar-paneli').getBoundingClientRect();
        const satir = [...document.querySelectorAll('.udf-sayfa span')].map(e => e.getBoundingClientRect()).find(b => b.height && b.top > 40 && b.bottom < 260);
        return { sol: Math.round(r.left), sag: Math.round(r.right), orta: Math.round((r.left + r.right) / 2), y: satir ? Math.round(satir.top + satir.height / 2) : 150,
          panelSag: Math.round(p.right), en: innerWidth }; })()`);
      const sonucTik = [];
      const dene = async (ad, is, kapanmali, tikBeklenir = !kapanmali) => {
        await hazirla();
        const once = await kapanis();
        await is();
        await bekle(500);
        const kapandi = (await kapanis()) > once;
        const tik = kapandi ? null : await deger(f.g, 'window.__tik');
        sonucTik.push({ ad, kapandi, tamam: kapandi === kapanmali && (kapandi || !tikBeklenir || tik > 0), tik });
        if (kapandi) await yeniden();
      };
      let yer = await olc();
      const sol = Math.round(yer.sol / 2), sag = yer.sag + 16, y = yer.y;
      await dene('sayfanın içi', () => tikla(yer.orta, y), false);
      await dene('boşlukta sağ tık', () => tikla(sol, y, 'right'), false, false);
      await dene('sayfadan boşluğa sürükleme', () => surukle(yer.orta, y, sol, y), false);
      await dene('boşluktan sayfaya sürükleme', () => surukle(sol, y, yer.orta, y), false);
      // Kenar boyunca sürükleme metin seçer (Chrome); sürükleme metin seçtiyse pencere kapanmaz.
      await dene('kenarda sürükleyerek metin seçme', async () => {
        await surukle(sol, y, sol, y + 120);
        await bekle(200);
        sonucTik.secim = await deger(f.g, 'String(getSelection()).trim().length').catch(() => -1);
      }, false);
      // Önceden seçili metin varken boşluğa yerinde tıklamak kapatır (ilk tık yalnız seçimi kaldırmaz).
      await dene('seçili metin varken boşluğa tıklama', async () => {
        await deger(f.g, "getSelection().selectAllChildren(document.querySelector('.udf')), 1");
        await tikla(sol, y);
      }, true);
      yer = await olc();
      // Sayfalar arası: belge kaydırılıp 1. ve 2. sayfanın arası ekrana getirilir.
      const ara = await deger(f.g, `(() => { const a = document.getElementById('alan'), s = [...document.querySelectorAll('.udf-sayfa')];
        if (s.length < 2) return null; a.scrollTop += s[0].getBoundingClientRect().bottom - a.getBoundingClientRect().top - 200;
        const r1 = s[0].getBoundingClientRect(), r2 = s[1].getBoundingClientRect(); return { y: Math.round((r1.bottom + r2.top) / 2), bosluk: Math.round(r2.top - r1.bottom) }; })()`);
      if (ara) await dene('sayfalar arası', () => tikla(yer.orta, ara.y), false);
      // Son sayfanın altı: belge sona kaydırılır, son sayfayla alttaki çubuk arasına tıklanır.
      const alti = await deger(f.g, `(() => { const a = document.getElementById('alan'); a.scrollTop = a.scrollHeight;
        const s = [...document.querySelectorAll('.udf-sayfa')].pop().getBoundingClientRect(), c = document.querySelector('.cubuk').getBoundingClientRect();
        return c.top - s.bottom > 8 ? Math.round((s.bottom + c.top) / 2) : null; })()`);
      if (alti) await dene('son sayfanın altı', () => tikla(yer.orta, alti), true);
      yer = await olc();
      await dene('sayfanın solu', () => tikla(sol, y), true);
      await dene('sayfanın sağı (bölmeyle arası)', () => tikla(sag, y), true);
      await dene('not bölmesinin sağındaki şerit', () => tikla(Math.round((yer.panelSag + yer.en) / 2), y), true);
      sonuc('sayfaların dışındaki boşluğa tıklayınca kapanır; sayfa, arası, sağ tık, sürükleme kapatmaz', !!ara && ara.bosluk > 0 && !!alti && yer.en - yer.panelSag > 8 &&
        sonucTik.length === 11 && sonucTik.secim > 0 && sonucTik.every(t => t.tamam) && !!f,
        JSON.stringify(sonucTik.map(t => `${t.ad}: ${t.kapandi ? 'kapandı' : 'açık'}${t.tik == null ? '' : ' (tık ' + t.tik + ')'}`)) + ` · kenardan seçilen: ${sonucTik.secim} karakter`);
      if (f) await deger(s.g, `${CERCEVE}.focus(); 1`);
    }

    // D4. Esc belgedeyken Drive'ın görüntüleyicisini kapatır; çerçeve ve işaret kalkar.
    const kapatildiOnce = await deger(s.g, 'window.__kapatildi');
    await tus(s.g, 'Escape');
    await bekle(600);
    gom = await gommeDurumu();
    sonuc('Esc (belgede) → Drive’ın görüntüleyicisi kapanır, Yorum düğmesinin işareti kalkar', (await deger(s.g, 'window.__kapatildi')) === kapatildiOnce + 1 && !gom.var && gom.sayi === 0 &&
      gom.isaretli === 0 && gom.gizli === 0, JSON.stringify(gom));

    // D5. Enter: Drive açar, belge gömülür. Sağ ok (belgede) → sonraki dosya (PDF): çerçeve kalkar; sol ok → UDF yeni ana
    // alana yeniden gömülür.
    await deger(s.g, `document.querySelector('[data-id="${KIMLIK.udf}"]').focus()`);
    await tus(s.g, 'Enter');
    f = await cerceveBul();
    durum = f ? await belgeDurumu(f.g) : 'çerçeve yok';
    sonuc('Enter → Drive’ın görüntüleyicisinde belge', /^BELGE: metin var/.test(durum) && (await gommeDurumu()).var && (await sekmeHedefleri()).length === 0, durum);
    await ifadeBekle(s.g, `${CERCEVE_ODAKTA}`, 3000).catch(() => {});
    await tus(s.g, 'ArrowRight');
    await bekle(600);
    gom = await gommeDurumu();
    const pdfte = await deger(s.g, "JSON.parse(document.getElementById('drive-active-item-info').textContent).title");
    sonuc('sağ ok (belgede) → sonraki dosyaya geçer, çerçeve kalkar, Yorum düğmesi görünür', pdfte === 'Ek.pdf' && !gom.var && gom.sayi === 0 && gom.isaretli === 0 &&
      gom.yorum === true && gom.gizli === 0, `${pdfte} · ${JSON.stringify(gom)}`);
    await tus(s.g, 'ArrowLeft');
    f = await cerceveBul();
    durum = f ? await belgeDurumu(f.g) : 'çerçeve yok';
    gom = await gommeDurumu();
    sonuc('sol ok → UDF’ye dönülünce yeni ana alana yeniden gömülür', /^BELGE: metin var/.test(durum) && gom.var && gom.sayi === 1 && gom.isaretli === 1 && gom.ust === 112, `${durum} · ${JSON.stringify(gom)}`);
    await tus(s.g, 'Escape');
    await bekle(500);

    // D6. PDF: eklenti karışmaz.
    await ciftTikla(s.g, await satir(KIMLIK.pdf));
    await bekle(800);
    gom = await gommeDurumu();
    sonuc('PDF’te Drive’ın kendi görüntüsü kalır', (await deger(s.g, 'window.__onizlemeler.slice(-1)[0]')) === KIMLIK.pdf && !gom.var && gom.isaretli === 0);
    await tus(s.g, 'Escape');
    await bekle(400);

    // D7. İzin yok (403): Gömülü anlaşılır hata (önce arka plan, sonra görüntüleyicinin kendisi dener, ikisi de 403 alır).
    await ciftTikla(s.g, await satir(KIMLIK.yasak));
    f = await cerceveBul();
    durum = f ? await belgeDurumu(f.g) : 'çerçeve yok';
    sonuc('403 → gömülü anlaşılır hata', /^HATA: Dosyayı indirme izniniz yok/.test(durum), durum);
    // Hata kutusunun dışındaki boşluğa tıklamak da kapatır (Drive'ın "önizlenemedi" kartındaki gibi).
    {
      const once = await deger(s.g, 'window.__kapatildi');
      const k = await deger(s.g, `(() => { const r = ${CERCEVE}.getBoundingClientRect(); return { x: r.left + 100, y: r.top + 40 }; })()`);
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
        await s.g('Input.dispatchMouseEvent', { type, x: k.x, y: k.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
      }
      await bekle(500);
      const kapandi = (await deger(s.g, 'window.__kapatildi')) > once;
      sonuc('hata ekranında kutunun dışına tıklayınca kapanır', kapandi);
      if (!kapandi) {
        await deger(s.g, `${CERCEVE} && ${CERCEVE}.focus(); 1`);
        await tus(s.g, 'Escape');
      }
    }
    await bekle(400);

    // D8. Paylaşım bağlantısı: Drive sayfasında kalır, belge sayfaya gömülür.
    const d = await sekmeAc(c, `https://drive.google.com/file/d/${KIMLIK.udf}/view?usp=sharing`);
    await d.g('Runtime.enable');
    await ifadeBekle(d.g, "document.readyState === 'complete'");
    await bekle(1200);
    const dAdres = (await c.gonder('Target.getTargetInfo', { targetId: d.targetId })).targetInfo.url;
    const dCerceve = await deger(d.g, `(() => { const c = ${CERCEVE}; if (!c) return null; const r = c.getBoundingClientRect(); return { ust: Math.round(r.top), kart: getComputedStyle(document.getElementById('kart')).visibility }; })()`);
    f = await cerceveBul();
    durum = f ? await belgeDurumu(f.g) : 'çerçeve yok';
    sonuc('paylaşım bağlantısı → Drive sayfasında gömülü belge', dAdres.startsWith('https://drive.google.com/file/d/') && dCerceve && dCerceve.ust === 112 && dCerceve.kart === 'hidden' && /^BELGE: metin var/.test(durum),
      `${durum} · ${JSON.stringify(dCerceve)}`);
    await c.gonder('Target.closeTarget', { targetId: d.targetId });
    // D8b. Ana alanın zaten bir gölge kökü varsa (eklentininki eklenemez) çerçeve ana alanın çocuğu olur, Drive'ın içeriğini
    // icerik.css gizler.
    {
      const dg = await sekmeAc(c, `https://drive.google.com/file/d/${KIMLIK.udf}/view?golgeli=1`);
      await dg.g('Runtime.enable');
      await ifadeBekle(dg.g, "document.readyState === 'complete'");
      await bekle(1200);
      const yer = await deger(dg.g, `(() => { const ana = document.querySelector('[role=main]'), c = ana.querySelector(':scope > iframe.udf-okuyucu-cerceve'); if (!c) return null;
        const r = c.getBoundingClientRect();
        return { ust: Math.round(r.top), kart: getComputedStyle(document.getElementById('kart')).visibility, yorum: getComputedStyle(document.getElementById('yorum')).display }; })()`);
      f = await cerceveBul();
      durum = f ? await belgeDurumu(f.g) : 'çerçeve yok';
      sonuc('ana alana gölge kökü eklenemezse çerçeve ana alanın çocuğu, Drive içeriği ve Yorum gizli', !!yer && yer.ust === 112 && yer.kart === 'hidden' &&
        yer.yorum === 'none' && /^BELGE: metin var/.test(durum), `${durum} · ${JSON.stringify(yer)}`);
      await c.gonder('Target.closeTarget', { targetId: dg.targetId });
    }

    // D9. Arka planın indirmesi başaramazsa (401) görüntüleyici dosyayı kendisi indirir. Sayfanın hesap sırası bilindiği
    // için (/drive/u/0/) ikisi de yalnız o hesapla dener (authuser=0), öbür hesap sıraları denenmez.
    {
      const once = istekler.length;
      sunucuAyari.reddet = 1;
      await ciftTikla(s.g, await satir(KIMLIK.udf));
      f = await cerceveBul();
      durum = f ? await belgeDurumu(f.g) : 'çerçeve yok';
      const yeni = istekler.slice(once).filter(i => i.id === KIMLIK.udf);
      sonuc('arka plan indiremezse görüntüleyici kendisi indirir, yalnız sayfanın hesabıyla', /^BELGE: metin var/.test(durum) && yeni.length === 2 &&
        sunucuAyari.reddet === 0 && yeni.every(i => i.au === '0'), `${durum} · ${yeni.length} istek (biri reddedildi) · authuser: ${yeni.map(i => i.au).join(', ')}`);
      sunucuAyari.reddet = 0;
      await tus(s.g, 'Escape');
      await bekle(500);
    }

    // D10. İkisi de başaramazsa hata ve "Yeniden dene": Görüntüleyici kaydı arka plandan bir kez almıştır, yeniden denerken
    // kendi belleğindeki kaydı gönderir (arka planda kayıt yok, ön indirme kullanıldı). Belge açılır.
    {
      const once = istekler.length;
      sunucuAyari.reddet = 2;
      await ciftTikla(s.g, await satir(KIMLIK.udf));
      f = await cerceveBul();
      const hata = f ? await belgeDurumu(f.g) : 'çerçeve yok';
      if (f) await deger(f.g, "[...document.querySelectorAll('.durum-dugmeler button')].find(b => b.textContent === 'Yeniden dene').click(), 1").catch(() => {});
      durum = f ? await belgeDurumu(f.g) : 'çerçeve yok';
      const yeni = istekler.slice(once).filter(i => i.id === KIMLIK.udf);
      sonuc('gömülü görünümde "Yeniden dene" kayıtla yeniden indirir', /^HATA: /.test(hata) && /^BELGE: metin var/.test(durum) && yeni.length === 3 && sunucuAyari.reddet === 0,
        `${hata} → ${durum} · ${yeni.length} istek`);
      sunucuAyari.reddet = 0;
      await tus(s.g, 'Escape');
      await bekle(500);
    }

    // ================================================================ Büyük görünüm (yeni sekme)
    console.log('— Büyük görünüm');
    const goruntuleyiciBekle = (sure = 10000) => c.olayBekle(m => (m.method === 'Target.targetCreated' || m.method === 'Target.targetInfoChanged') &&
      m.params.targetInfo.type === 'page' && m.params.targetInfo.url.startsWith(`chrome-extension://${eklenti}/goruntule.html#t=`), sure);
    const adres = async targetId => (await c.gonder('Target.getTargetInfo', { targetId })).targetInfo.url;
    const yeniSekmeBekle = (kosul, sure = 8000) => c.olayBekle(m => m.method === 'Target.targetCreated' && m.params.targetInfo.type === 'page' && kosul(m.params.targetInfo.url), sure);
    const baglan = async targetId => {
      const { sessionId } = await c.gonder('Target.attachToTarget', { targetId, flatten: true });
      const g = (m, p) => c.gonder(m, p, sessionId);
      await g('Runtime.enable');
      return g;
    };

    // Y1. Drive'ın görüntüleyicisinin yapısı tanınmazsa üstte "UDF olarak aç" düğmesi çıkar, belge yeni sekmede (büyük
    // görünümde) açılır. Büyük görünüme yalnız bu yol götürür (gömülü çubukta "Yeni sekmede aç" düğmesi yok).
    // Düğme kapalı gölge kökte: CDP'nin DOM ağacından bulunup gerçek fare tıklamasıyla basılır.
    {
      const y = await sekmeAc(c, `https://drive.google.com/file/d/${KIMLIK.udf}/view?yapisiz=1`);
      for (const a of ['Runtime.enable', 'DOM.enable']) await y.g(a);
      await ifadeBekle(y.g, "document.readyState === 'complete'");
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
      const bek = goruntuleyiciBekle();
      // Sekmenin ilk indirmesi reddedilir: "Yeniden dene" sekmenin belleğindeki kayıtla yeniden indirir.
      sunucuAyari.reddet = 1;
      const once = istekler.length;
      if (yer) {
        await y.g('Input.dispatchMouseEvent', { type: 'mousePressed', x: yer.x, y: yer.y, button: 'left', clickCount: 1 });
        await y.g('Input.dispatchMouseEvent', { type: 'mouseReleased', x: yer.x, y: yer.y, button: 'left', clickCount: 1 });
      }
      const hedef = yer ? (await bek.catch(() => null))?.params?.targetInfo : null;
      const g = hedef ? await baglan(hedef.targetId) : null;
      const hata = g ? await belgeDurumu(g) : 'açılmadı';
      if (g) await deger(g, "[...document.querySelectorAll('.durum-dugmeler button')].find(b => b.textContent === 'Yeniden dene').click(), 1").catch(() => {});
      const dr = g ? await belgeDurumu(g) : 'açılmadı';
      const yeni = istekler.slice(once).filter(i => i.id === KIMLIK.udf);
      sonuc('yeni sekmede "Yeniden dene" kayıtla yeniden indirir, sekmenin başlığında belge adı yok', /^HATA: /.test(hata) && /^BELGE: metin var/.test(dr) &&
        yeni.length === 2 && sunucuAyari.reddet === 0 && !!g && (await deger(g, 'document.title')) === 'UDF Ön İzleme', `${hata} → ${dr} · ${yeni.length} istek`);
      sunucuAyari.reddet = 0;
      const b = g ? await deger(g, "({ gomulu: document.documentElement.classList.contains('gomulu'), driveDugmesi: !document.getElementById('dugme-drive').hidden, notlar: !document.getElementById('notlar-paneli').hidden })") : null;
      sonuc('yapı tanınmazsa "UDF olarak aç" → yeni sekmede belge', !!yer && !cerceveVar && /^BELGE: metin var/.test(dr) && !!b && !b.gomulu && b.driveDugmesi && b.notlar,
        `düğme: ${yer ? 'var' : 'yok'} · çerçeve: ${cerceveVar} · ${dr} · ${JSON.stringify(b)}`);
      if (g) {
        // Y2. Büyük görünümdeki "Drive'da aç": Drive sayfası açılır, belge orada gömülü görünür.
        const yeni = yeniSekmeBekle(u => u.startsWith('https://drive.google.com/file/d/'));
        await g('Runtime.evaluate', { expression: "document.getElementById('dugme-drive').click()" });
        const driveSekmesi = (await yeni.catch(() => null))?.params?.targetInfo;
        let gomuldu = false;
        if (driveSekmesi) {
          const dg = await baglan(driveSekmesi.targetId);
          gomuldu = await ifadeBekle(dg, `!!${CERCEVE}`, 8000).catch(() => false);
        }
        const son = driveSekmesi ? await adres(driveSekmesi.targetId) : 'açılmadı';
        sonuc('"Drive’da aç" → Drive sayfasında gömülü belge', son.startsWith('https://drive.google.com/file/d/') && gomuldu, son.replace(/\/d\/[^/]+/, '/d/…').slice(0, 70) + ` · gömülü: ${gomuldu}`);
        if (driveSekmesi) await c.gonder('Target.closeTarget', { targetId: driveSekmesi.targetId });

        // Y3. Sekmede yazdırma hemen olur, sekmenin başlığı yazdırırken de "UDF Ön İzleme" kalır (belge adı geçmişe, sekme
        // kaydına ve pencere başlığına düşmez). PDF'e de bu ad önerilir.
        await deger(g, 'window.__basim = []; window.print = () => { window.__basim.push([Date.now(), document.title]); }; 1');
        const basladi = Date.now();
        await deger(g, "document.getElementById('dugme-yazdir').click(), 1");
        const basim = await ifadeBekle(g, 'window.__basim.length && window.__basim', 6000).catch(() => []);
        const sonBaslik = await deger(g, 'document.title');
        sonuc('sekmede yazdırma hemen, başlık hep "UDF Ön İzleme"', basim.length === 1 && basim[0][0] - basladi < 1500 && basim[0][1] === 'UDF Ön İzleme' && sonBaslik === 'UDF Ön İzleme',
          `${basim.length ? `${basim[0][0] - basladi} ms · baskı başlığı: ${basim[0][1]}` : 'basılmadı'} · başlık: ${sonBaslik}`);

        // Y4. Sekme yenilenince (F5) kayıt yoktur (bir kez alındı, saklanmaz): Belge Drive'da ya da Gmail'de yeniden açılır.
        await g('Page.reload');
        await bekle(300);
        const yenilenen = await ifadeBekle(g, "(() => { const h = document.querySelector('.durum.hata'); return h ? h.innerText.replace(/\\s+/g, ' ') : ''; })()", 8000).catch(() => 'hata yok');
        sonuc('sekme yenilenince "Belge bilgisi bulunamadı", belge yeniden açılmaz', /^Belge bilgisi bulunamadı .*Drive’da ya da Gmail’de yeniden açın/.test(yenilenen) &&
          !(await deger(g, "!!document.querySelector('.udf-sayfa')")), yenilenen.slice(0, 160));
      }
      if (hedef) await c.gonder('Target.closeTarget', { targetId: hedef.targetId });
      await c.gonder('Target.closeTarget', { targetId: y.targetId });
    }

    // B1. Gömülü görünümün alt boşluğu (denetim çubuğu için) baskıya girmez: girerse son sayfası dolu belgede boş sayfa
    // eklenir.
    {
      const b = await sekmeAc(c, `chrome-extension://${eklenti}/goruntule.html`);
      await ifadeBekle(b.g, "document.readyState === 'complete' && !!document.getElementById('dosya-sec')");
      const { root } = await b.g('DOM.getDocument', { depth: 0 });
      const { nodeId } = await b.g('DOM.querySelector', { nodeId: root.nodeId, selector: '#dosya-sec' });
      await b.g('DOM.setFileInputFiles', { files: [udfYolu ? path.resolve(udfYolu) : path.join(KOK, 'testler', 'ornekler', 'dilekce.udf')], nodeId });
      await ifadeBekle(b.g, "!!document.querySelector('.udf-sayfa')");
      await deger(b.g, "document.documentElement.classList.add('gomulu'); 1");
      const dolgu = () => deger(b.g, "getComputedStyle(document.querySelector('.udf')).paddingBottom");
      const ekranda = await dolgu();
      await b.g('Emulation.setEmulatedMedia', { media: 'print' });
      const baskida = await dolgu();
      sonuc('gömülü görünüm: alt boşluk ekranda var, baskıda yok', ekranda === '96px' && baskida === '0px', `ekran ${ekranda} · baskı ${baskida}`);
      await c.gonder('Target.closeTarget', { targetId: b.targetId });
    }

    // B2. Çubuğun sol yanı (gömülü görünümle aynı kod): e-imzalıda "E-imzalıdır"; e-imzasız ve notsuzda "E-imzasız" (sol yan
    // boş kalmasın); e-imzasız notluda rozet yok, solda Notlar durur. Notlar düğmesi yazısız: simge ve not sayısı.
    {
      const b = await sekmeAc(c, `chrome-extension://${eklenti}/goruntule.html`);
      await ifadeBekle(b.g, "document.readyState === 'complete' && !!document.getElementById('dosya-sec')");
      const durumlar = [];
      for (const ad of ['dilekce.udf', 'yatay-a5.udf', 'notlu-imzasiz.udf']) {
        const { root } = await b.g('DOM.getDocument', { depth: 0 });
        const { nodeId } = await b.g('DOM.querySelector', { nodeId: root.nodeId, selector: '#dosya-sec' });
        await b.g('DOM.setFileInputFiles', { files: [path.join(KOK, 'testler', 'ornekler', ad)], nodeId });
        await ifadeBekle(b.g, `document.getElementById('belge-adi').textContent === ${JSON.stringify(ad)} && !!document.querySelector('.udf-sayfa')`);
        durumlar.push(await deger(b.g, `(() => { const n = document.getElementById('dugme-notlar'); return { ad: ${JSON.stringify(ad)},
          rozet: [...document.querySelectorAll('#rozetler .rozet')].map(r => r.textContent).join('|'),
          notlar: n.hidden ? null : { yazi: n.textContent.trim(), etiket: n.getAttribute('aria-label') } }; })()`));
      }
      const [d, y, n] = durumlar;
      // B3. Verisi yarıda kesik resim (başlığı sağlam): <img> onu hatasız ama boş gösterirdi; motor doğrulayıp uyarı yazısı
      // koyar. Yanındaki sağlam resim resim olarak kalır.
      {
        const { root } = await b.g('DOM.getDocument', { depth: 0 });
        const { nodeId } = await b.g('DOM.querySelector', { nodeId: root.nodeId, selector: '#dosya-sec' });
        await b.g('DOM.setFileInputFiles', { files: [path.join(KOK, 'testler', 'ornekler', 'resim-bozuk.udf')], nodeId });
        const bozuk = await ifadeBekle(b.g, `(() => { if (document.getElementById('belge-adi').textContent !== 'resim-bozuk.udf') return null;
          const red = [...document.querySelectorAll('.udf-resim.red')].map(e => e.textContent), img = [...document.querySelectorAll('.udf-resim img')];
          return red.length ? { red, img: img.length, yuklu: img.every(i => i.complete && i.naturalWidth > 0) } : null; })()`, 8000).catch(() => null);
        sonuc('bozuk resim yerine "[Resim gösterilemedi]", sağlam resim gösterilir', !!bozuk && bozuk.red.length === 1 && bozuk.red[0] === '[Resim gösterilemedi]' &&
          bozuk.img === 1 && bozuk.yuklu, JSON.stringify(bozuk));
      }
      sonuc('rozet: e-imzalıda "E-imzalıdır", e-imzasız notsuzda "E-imzasız", e-imzasız notluda yok; Notlar yazısız (sayı)',
        d.rozet === 'E-imzalıdır' && y.rozet === 'E-imzasız' && n.rozet === '' && !y.notlar && !!d.notlar && d.notlar.yazi === '1' &&
        d.notlar.etiket === 'Notlar (1)' && !!n.notlar && n.notlar.yazi === '1', JSON.stringify(durumlar));
      await c.gonder('Target.closeTarget', { targetId: b.targetId });
    }

    // ================================================================ Eklenti simgesi
    // E1. Simgenin eylemi yok (açılır pencere, tıklama), geliştiricinin X sayfası eklentinin bilgilerinde (homepage_url).
    // Eklentinin ek izni ve depolama izni yok: Sayfalarında chrome.storage tanımsız.
    console.log('— Eklenti simgesi');
    const p = await sekmeAc(c, `chrome-extension://${eklenti}/goruntule.html`);
    for (const a of ['Runtime.enable', 'Page.enable']) await p.g(a);
    await ifadeBekle(p.g, "document.readyState === 'complete'");
    const simge = await deger(p.g, `(async () => ({ eylemYok: chrome.runtime.getManifest().action === undefined && !chrome.action,
      site: chrome.runtime.getManifest().homepage_url, depo: typeof chrome.storage, izinler: (await chrome.permissions.getAll()).permissions }))()`);
    sonuc('simgenin eylemi yok, geliştirici eklentinin bilgilerinde, izin ve depo yok', simge.eylemYok && simge.site === 'https://x.com/CgrShn' &&
      simge.depo === 'undefined' && simge.izinler.length === 0, JSON.stringify(simge));

    // S8. Eklenti yeniden yüklenince (güncelleme; chrome://extensions'tan kapatınca ya da kaldırınca da betiğin bağlamı aynı
    // biçimde kopar) açık sekmedeki eski betik belgeyi kaldırır ve "yenileyin" uyarısı gösterir (uyarı kapalı gölge kökte;
    // CDP'nin DOM ağacı gölge köklerin içini de verir).
    await c.gonder('Target.activateTarget', { targetId: s.targetId });
    await ciftTikla(s.g, await satir(KIMLIK.udf));
    f = await cerceveBul();
    if (f) await belgeDurumu(f.g);
    const uyariSayisi = async () => {
      const { root } = await s.g('DOM.getDocument', { depth: -1, pierce: true });
      let n = 0;
      const gez = d => { if (d.nodeType === 3 && /Sayfayı yenileyin/.test(d.nodeValue)) n++; for (const k of [...(d.children || []), ...(d.shadowRoots || [])]) gez(k); };
      gez(root);
      return n;
    };
    const uyariOnce = await uyariSayisi();
    await p.g('Runtime.evaluate', { expression: 'setTimeout(() => chrome.runtime.reload(), 50); 1' });
    await bekle(2500);
    await deger(s.g, "document.body.append(document.createElement('i')); 1");   // DOM değişikliği: eski betik denetler
    await bekle(800);
    const sonra = await deger(s.g, `({ cerceve: ${CERCEVELER}.length, isaretli: document.querySelectorAll('[data-udf-okuyucu-gomulu]').length, katman: !document.getElementById('katman').hidden })`);
    sonra.uyari = (await uyariSayisi()) - uyariOnce;
    sonuc('eklenti yeniden yüklenince belge kalkar, "yenileyin" uyarısı çıkar', sonra.cerceve === 0 && sonra.isaretli === 0 && sonra.uyari === 1 && sonra.katman, JSON.stringify(sonra));

    // C1. Bu oturum boyunca eklentinin sayfalarında (sekmeler, gömülü çerçeveler, service worker) CSP ihlali olmadı.
    sonuc('eklentinin sayfalarında CSP ihlali yok', cspIhlalleri.length === 0, `${cspIhlalleri.length} ihlal${cspIhlalleri.length ? ' · ' + cspIhlalleri.slice(0, 5).join(' | ') : ''}`);
  } finally {
    c.kapat();
    sunucu.close();
  }

  // ================================================================ 2. oturum: üçüncü taraf çerezleri kapalı
  // Gömülü sayfanın kendi isteğine SameSite=None çerezler gitmez; oturum yalnız onlarla tanınıyorsa belge arka plan
  // (service worker) yoluyla gelmeli. Arka plan dosyayı gömme kaydıyla birlikte indirdiği için tek istek yeter.
  console.log('— Üçüncü taraf çerezleri kapalı');
  const s2 = await sunucuKur(bayt, { yalnizNone: true });
  const o2 = await oturumKur({ port: s2.port, ekler: ['--test-third-party-cookie-phaseout'] });
  try {
    await o2.ciftTikla(o2.s.g, await o2.satir(KIMLIK.udf));
    const f = await o2.cerceveBul();
    const durum = f ? await o2.belgeDurumu(f.g) : 'çerçeve yok';
    const udfIstekleri = s2.istekler.filter(i => i.id === KIMLIK.udf);
    const arkaplandanNoneli = udfIstekleri.length === 1 && /ornekNone/.test(udfIstekleri[0].cerez);
    sonuc('çerezler kapalı: belge arka plan yoluyla gelir, tek istek', /^BELGE: metin var/.test(durum) && arkaplandanNoneli,
      `${durum} · istek: ${udfIstekleri.length} · None'lu: ${arkaplandanNoneli}`);
  } finally {
    o2.c.kapat();
    s2.sunucu.close();
  }

  // ================================================================ 3. oturum: Dark Reader açık (kuruluysa)
  // Dark Reader Drive sayfasındaki her çerçeveye koyu renk düzeni verir; gömülü belge yine saydam görünmeli (kullanıcı
  // 2026-10-07'de bembeyaz gördü). Dark Reader bu bilgisayarın Chrome'unda yoksa bu bölüm atlanır.
  const dr = karanlikOkuyucu();
  if (!dr) console.log('— Dark Reader: ATLANDI (Chrome’da kurulu değil, DARK_READER_YOLU ile paketlenmemiş klasörü verilebilir)');
  else {
    console.log(`— Dark Reader ${dr.surum} açık`);
    let s3 = null, o3 = null;
    try {
      s3 = await sunucuKur(bayt);
      o3 = await oturumKur({ port: s3.port, ekEklentiler: [dr.yol], ekler: ['--force-dark-mode'] });
      await o3.s.g('Page.bringToFront');
      // Dark Reader'ın arka planı sayfa açılırken hazır olmayabilir: temayı koymadıysa sayfa bir kez yenilenir.
      const temali = () => ifadeBekle(o3.s.g, "!!document.querySelector('style.darkreader--user-agent')", 6000).then(() => true, () => false);
      if (!(await temali())) {
        await o3.s.g('Page.reload');
        await ifadeBekle(o3.s.g, "document.readyState === 'complete' && !!document.querySelector('[data-id]')");
      }
      const tema = await temali();
      await o3.ciftTikla(o3.s.g, await o3.satir(KIMLIK.udf));
      const f = await o3.cerceveBul();
      const durum = f ? await o3.belgeDurumu(f.g) : 'çerçeve yok';
      await bekle(800);
      const nokta = await o3.deger(o3.s.g, `(() => { const c = ${CERCEVE}; if (!c) return null; const r = c.getBoundingClientRect(); return { x: Math.round(r.left + 12), y: Math.round(r.top + 100), sema: getComputedStyle(c).colorScheme }; })()`);
      const renk = nokta ? await pikselRengi(o3.s.g, nokta.x, nokta.y) : null;
      sonuc('Dark Reader açıkken belge saydam, arkada Drive’ın katmanı', tema && /^BELGE: metin var/.test(durum) && !!nokta && nokta.sema === 'light' && renk.every(v => v < 60),
        `tema: ${tema} · ${durum} · color-scheme: ${nokta && nokta.sema} · sayfanın solundaki piksel: ${renk ? 'rgb(' + renk.join(', ') + ')' : '-'}`);
    } finally {
      if (o3) o3.c.kapat();
      if (s3) s3.sunucu.close();
      fs.rmSync(dr.yol, { recursive: true, force: true });
    }
  }
  return sonuclar.filter(x => !x.tamam).length;
}

// Sınama için Dark Reader: DARK_READER_YOLU (paketlenmemiş klasör) ya da bu bilgisayarın Chrome profillerinde kurulu en
// yeni sürüm. Geçici klasöre kopyalanır: Chrome "_" ile başlayan klasörü (_metadata) olan eklentiyi paketlenmemiş
// yüklemez. Dark Reader depoya girmez. Sahte Gmail sınaması da kullanır.
export function karanlikOkuyucu() {
  const KIMLIK_DR = 'eimadpbcbfnmbkopoojfekhnkhdbieeh';
  let kaynak = process.env.DARK_READER_YOLU || null;
  const kullanici = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data');
  if (!kaynak && kullanici && fs.existsSync(kullanici)) {
    const adaylar = [];
    for (const profil of fs.readdirSync(kullanici)) {
      const k = path.join(kullanici, profil, 'Extensions', KIMLIK_DR);
      if (!fs.existsSync(k)) continue;
      for (const s of fs.readdirSync(k)) if (fs.existsSync(path.join(k, s, 'manifest.json'))) adaylar.push(path.join(k, s));
    }
    const surum = y => path.basename(y).split(/[._]/).map(Number);
    adaylar.sort((a, b) => { const x = surum(a), y = surum(b); for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; });
    kaynak = adaylar.pop() || null;
  }
  if (!kaynak || !fs.existsSync(path.join(kaynak, 'manifest.json'))) return null;
  const hedef = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'udf-darkreader-')));
  fs.cpSync(kaynak, hedef, { recursive: true, filter: k => path.basename(k) !== '_metadata' });
  return { yol: hedef, surum: JSON.parse(fs.readFileSync(path.join(hedef, 'manifest.json'), 'utf8')).version };
}
