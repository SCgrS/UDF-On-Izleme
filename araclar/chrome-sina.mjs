// Eklentiyi görünmez Chrome'a yükleyip sınar.
//   node araclar/chrome-sina.mjs gorsel <udf klasörü> <çıktı klasörü>   Görüntüleyicide her dosyayı açar; ilk sayfanın
//       ekran görüntüsünü ve PDF çıktısını yazar, konsol hatalarını ve CSP ihlallerini sayar (hataToplayici).
//   node araclar/chrome-sina.mjs drive [udf dosyası] [ekran.png]   Sahte Drive sayfasında uçtan uca sınama (sahte-drive.mjs).
//   node araclar/chrome-sina.mjs gmail [udf dosyası] [ekran.png]   Sahte Gmail'in ek ön izlemesinde uçtan uca sınama (sahte-gmail.mjs).
//   node araclar/chrome-sina.mjs paket [zip]   Kullanıcıya verilen zip (varsayılan cikti/<PAKET_ADI>) çıkarılıp yüklenir.
//   node araclar/chrome-sina.mjs gercek [ekran.png]   Gerçek Drive'ın görüntüleyicisinde gömme denemesi (gercek-drive.mjs;
//       internet gerekir, herkese açık örnek klasör, oturum açılmaz).
//   node araclar/chrome-sina.mjs github   GitHub'ın Code → Download ZIP'i (HEAD) çıkarılıp doğrudan yüklenir mi.
//   node araclar/chrome-sina.mjs hiz [tekrar] [--eklenti <klasör>] [--json <dosya>]   Sahte Gmail ve Drive'da gerçekçi ağ
//       gecikmeleriyle açılış aşamalarının süresi (hiz-olcumu.mjs).
// Gerçek belgelerle çalışırken çıktı klasörü depo dışında olmalı (belge içeriği taşır).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromeBaslat, sekmeAc, ifadeBekle } from './cdp.mjs';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [kip, ...arg] = process.argv.slice(2);

function hataToplayici(c, sessionId) {
  const hatalar = [];
  c.dinle(m => {
    if (m.sessionId !== sessionId) return;
    if (m.method === 'Runtime.exceptionThrown') hatalar.push('istisna: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300));
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) hatalar.push(`konsol ${m.params.type}: ` + m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 300));
    if (m.method === 'Log.entryAdded' && (m.params.entry.level === 'error' || m.params.entry.level === 'warning')) hatalar.push(`günlük ${m.params.entry.level}: ` + m.params.entry.text.slice(0, 300));
    if (m.method === 'Audits.issueAdded' && m.params.issue.code === 'ContentSecurityPolicyIssue') hatalar.push('CSP: ' + JSON.stringify(m.params.issue.details.contentSecurityPolicyIssueDetails || {}).slice(0, 300));
  });
  return hatalar;
}
// Sekmede hata toplamak için açılan alanlar: Konsol, günlük (CSP ihlali iletisi dâhil) ve Audits (CSP sorunu).
const TOPLA = ['Runtime.enable', 'Log.enable', 'Audits.enable'];
const cspSayisi = hatalar => hatalar.filter(h => /^CSP: |Content Security Policy/i.test(h)).length;

export async function eklentiYukle(c) {
  const { id } = await c.gonder('Extensions.loadUnpacked', { path: KOK });
  return id;
}

async function gorsel(klasor, cikti) {
  if (!klasor || !cikti) throw new Error('Kullanım: gorsel <udf klasörü> <çıktı klasörü>');
  fs.mkdirSync(cikti, { recursive: true });
  const c = await chromeBaslat();
  let sorun = 0, csp = 0;
  try {
    const id = await eklentiYukle(c);
    const s = await sekmeAc(c, `chrome-extension://${id}/goruntule.html`);
    const hatalar = hataToplayici(c, s.sessionId);
    for (const a of [...TOPLA, 'Page.enable', 'DOM.enable']) await s.g(a);
    await s.g('Emulation.setDeviceMetricsOverride', { width: 1100, height: 1500, deviceScaleFactor: 1, mobile: false });
    await ifadeBekle(s.g, "document.readyState === 'complete' && !!document.getElementById('dosya-sec')");
    console.log('eklenti kimliği', id, '· boş görüntüleyici hataları:', hatalar.length);
    for (const h of hatalar) console.log('   ' + h);
    csp += cspSayisi(hatalar);
    if (hatalar.length) sorun++;
    for (const ad of fs.readdirSync(klasor).filter(f => /\.(udf|xml)$/i.test(f)).sort()) {
      hatalar.length = 0;
      const { root } = await s.g('DOM.getDocument', { depth: 0 });
      const { nodeId } = await s.g('DOM.querySelector', { nodeId: root.nodeId, selector: '#dosya-sec' });
      await s.g('DOM.setFileInputFiles', { files: [path.resolve(klasor, ad)], nodeId });
      const baslik = ad.replace(/\.udf$/i, '');
      await ifadeBekle(s.g, `document.getElementById('belge-adi').textContent === ${JSON.stringify(ad)} && !document.querySelector('.durum.yukleniyor') && (!!document.querySelector('.udf-sayfa') || !!document.querySelector('.durum.hata'))`);
      // Bütün dilimler ve resimler çizilene dek bekle.
      await ifadeBekle(s.g, `(() => { const c = [...document.querySelectorAll('.udf-resim img')]; return !document.querySelector('.durum.yukleniyor') && c.every(x => x.complete); })()`, 20000).catch(() => hatalar.push('resimler zamanında yüklenmedi'));
      const durum = (await s.g('Runtime.evaluate', {
        returnByValue: true, expression: `(() => ({
          hata: document.querySelector('.durum.hata') ? document.querySelector('.durum.hata').innerText.replace(/\\s+/g, ' ').slice(0, 200) : null,
          sayfa: document.querySelectorAll('.udf-sayfa').length,
          resim: document.querySelectorAll('.udf-resim img').length,
          bosResim: [...document.querySelectorAll('.udf-resim img')].filter(x => !x.complete || !x.naturalWidth).length,
          red: document.querySelectorAll('.udf-resim.red').length,
          rozetler: [...document.querySelectorAll('#rozetler .rozet')].map(r => r.textContent.replace(/:.*/, ':…')),
          notlar: document.getElementById('dugme-notlar').hidden ? 0 : document.querySelectorAll('#not-listesi li').length,
          tasan: [...document.querySelectorAll('.udf-p')].filter(p => p.scrollWidth > p.clientWidth + 2).length
        }))()`
      })).result.value;
      let ekran = null, pdfSayfa = null;
      if (!durum.hata) {
        const kutu = (await s.g('Runtime.evaluate', { returnByValue: true, expression: `(() => { const r = document.querySelector('.udf-sayfa').getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + document.getElementById('alan').scrollTop, w: r.width, h: Math.min(r.height, 1400) }; })()` })).result.value;
        const { data } = await s.g('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: kutu.x, y: kutu.y + 49, width: kutu.w, height: kutu.h, scale: 1 } });
        ekran = path.join(cikti, baslik + '.png');
        fs.writeFileSync(ekran, Buffer.from(data, 'base64'));
        const pdf = await s.g('Page.printToPDF', { preferCSSPageSize: true, printBackground: true });
        const b = Buffer.from(pdf.data, 'base64');
        fs.writeFileSync(path.join(cikti, baslik + '.pdf'), b);
        pdfSayfa = (b.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
      }
      const tamam = !durum.hata && !hatalar.length && !durum.bosResim && !durum.red;
      if (!tamam) sorun++;
      csp += cspSayisi(hatalar);
      console.log(`${tamam ? 'TAMAM' : 'SORUN'} ${ad} sayfa=${durum.sayfa} pdf=${pdfSayfa} resim=${durum.resim} boşResim=${durum.bosResim} gösterilemeyen=${durum.red} not=${durum.notlar} taşan=${durum.tasan} rozet=${JSON.stringify(durum.rozetler)}${durum.hata ? ' HATA=' + durum.hata : ''}`);
      for (const h of hatalar) console.log('   ' + h);
    }
    console.log(`CSP ihlali: ${csp}`);
  } finally { c.kapat(); }
  return sorun;
}

// GitHub'ın yeşil Code → Download ZIP'i (HEAD'in git archive'ı, önek <Depo>-main/) Windows'un "Tümünü ayıkla"sı gibi
// <zip adı>/<Depo>-main/ klasörüne çıkarılır. Eklenti dosyaları depo kökünde olduğu için içteki klasör (manifest.json
// orada) doğrudan yüklenir (kullanıcı isteği, 2026-10-07: UYAP Haciz Yardımcısı'ndaki gibi); dıştaki klasör Chrome'da
// "manifest eksik" verir. Kimlik sabit (key), sürüm manifest'teki, bir örnek belge CSP ihlalsiz çizilir.
async function github() {
  const { zipOku } = await import('./paketle.mjs');
  const os = await import('node:os');
  const { execFileSync } = await import('node:child_process');
  const zip = execFileSync('git', ['-C', KOK, 'archive', '--format=zip', '--prefix=UDF-On-Izleme-main/', 'HEAD'], { maxBuffer: 1 << 28 });
  const dis = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'udf-github-')), 'UDF-On-Izleme-main');
  for (const [ad, veri] of zipOku(zip)) {
    if (ad.endsWith('/')) continue;
    fs.mkdirSync(path.dirname(path.join(dis, ad)), { recursive: true });
    fs.writeFileSync(path.join(dis, ad), veri);
  }
  const ic = path.join(dis, 'UDF-On-Izleme-main');
  const c = await chromeBaslat();
  let sorun = 0;
  const sonuc = (ad, tamam, ayrinti = '') => { if (!tamam) sorun++; console.log(`${tamam ? 'TAMAM' : 'SORUN'} ${ad}${ayrinti ? ' · ' + ayrinti : ''}`); };
  try {
    const disHata = await c.gonder('Extensions.loadUnpacked', { path: dis }).then(() => null, e => e.message);
    sonuc('dıştaki klasör yüklenmez (manifest eksik)', !!disHata, disHata ? disHata.slice(0, 120) : 'yüklendi');
    const { id } = await c.gonder('Extensions.loadUnpacked', { path: ic });
    sonuc('çıkarılan klasör doğrudan yüklenir, kimlik sabit', id === 'fbbjliipglhijllpnhihgohanaajlifi', id);
    const s = await sekmeAc(c, `chrome-extension://${id}/goruntule.html`);
    const hatalar = hataToplayici(c, s.sessionId);
    for (const a of TOPLA) await s.g(a);
    await ifadeBekle(s.g, "document.readyState === 'complete' && !!document.getElementById('dosya-sec')");
    const surum = (await s.g('Runtime.evaluate', { returnByValue: true, expression: 'chrome.runtime.getManifest().version' })).result.value;
    const beklenen = JSON.parse(fs.readFileSync(path.join(KOK, 'manifest.json'), 'utf8')).version;
    sonuc('sürüm manifest’teki', surum === beklenen, surum);
    const { root } = await s.g('DOM.getDocument', { depth: 0 });
    const { nodeId } = await s.g('DOM.querySelector', { nodeId: root.nodeId, selector: '#dosya-sec' });
    await s.g('DOM.setFileInputFiles', { files: [path.join(KOK, 'testler', 'ornekler', 'dilekce.udf')], nodeId });
    const durum = await ifadeBekle(s.g, "document.querySelector('.udf-sayfa') ? 'belge' : document.querySelector('.durum.hata') ? 'hata' : ''");
    sonuc('örnek belge çizilir, konsol hatası ve CSP ihlali yok', durum === 'belge' && !hatalar.length, `${durum}${hatalar.length ? ' · ' + hatalar.join(' | ') : ''}`);
  } finally { c.kapat(); fs.rmSync(path.dirname(dis), { recursive: true, force: true }); }
  return sorun;
}

// Kullanıcıya verilen zip'i Windows'un "Tümünü ayıkla"sı gibi zip adlı klasöre çıkarır, o klasörü yükler ve bir
// örneği açar.
async function paket(zipYolu) {
  const { zipOku, PAKET_ADI } = await import('./paketle.mjs');
  const os = await import('node:os');
  const zip = path.resolve(zipYolu || path.join(KOK, 'cikti', PAKET_ADI));
  const klasor = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'udf-paket-')), path.basename(zip, '.zip'));
  for (const [ad, veri] of zipOku(fs.readFileSync(zip))) {
    fs.mkdirSync(path.dirname(path.join(klasor, ad)), { recursive: true });
    fs.writeFileSync(path.join(klasor, ad), veri);
  }
  const c = await chromeBaslat();
  try {
    const { id } = await c.gonder('Extensions.loadUnpacked', { path: klasor });
    const s = await sekmeAc(c, `chrome-extension://${id}/goruntule.html`);
    const hatalar = hataToplayici(c, s.sessionId);
    for (const a of TOPLA) await s.g(a);
    await ifadeBekle(s.g, "document.readyState === 'complete' && !!document.getElementById('dosya-sec')");
    const { root } = await s.g('DOM.getDocument', { depth: 0 });
    const { nodeId } = await s.g('DOM.querySelector', { nodeId: root.nodeId, selector: '#dosya-sec' });
    await s.g('DOM.setFileInputFiles', { files: [path.join(KOK, 'testler', 'ornekler', 'dilekce.udf')], nodeId });
    const durum = await ifadeBekle(s.g, "document.querySelector('.udf-sayfa') ? 'belge' : document.querySelector('.durum.hata') ? 'hata' : ''");
    const tamam = id === 'fbbjliipglhijllpnhihgohanaajlifi' && durum === 'belge' && !hatalar.length;
    console.log(`${tamam ? 'TAMAM' : 'SORUN'} paket yüklendi · kimlik ${id} · ${durum} · CSP ihlali ${cspSayisi(hatalar)}${hatalar.length ? ' · ' + hatalar.join(' | ') : ''}`);
    return tamam ? 0 : 1;
  } finally { c.kapat(); fs.rmSync(path.dirname(klasor), { recursive: true, force: true }); }
}

// Kötü niyetli büyük yapılar (bağımsız gözden geçirmenin senaryoları): görüntüleyici çökmeden, makul sürede ve sınır
// notuyla açmalı; sekme kilitlenmemeli.
async function yuk() {
  const os = await import('node:os');
  const { Belge, udfZip } = await import('./ornek-uret.mjs');
  const klasor = fs.mkdtempSync(path.join(os.tmpdir(), 'udf-yuk-'));
  const yaz = (ad, ogeler, ekler = []) => { const b = ogeler.b; fs.writeFileSync(path.join(klasor, ad), udfZip([['content.xml', b.xml({ ogeler: ogeler.liste })], ...ekler])); };
  { const b = new Belge(); yaz('satir-130bin.udf', { b, liste: [`<table>${'<row/>'.repeat(130000)}</table>`] }); }
  { const b = new Belge(); yaz('cocuk-150bin.udf', { b, liste: [`<paragraph><sarmal>${'<x/>'.repeat(150000)}</sarmal></paragraph>`] }); }
  { const b = new Belge(); yaz('sekme-2milyon.udf', { b, liste: [b.paragraf({}, [['\t'.repeat(2000000)]])] }); }
  {
    const b = new Belge();
    const hucreler = Array.from({ length: 2000 }, (_, i) => ({ ic: [b.paragraf({}, [['h' + i]])] }));
    const liste = [`<header>${b.tablo({ border: 'borderNone' }, [{ hucreler }])}</header>`];
    for (let i = 0; i < 2000; i++) liste.push(`<page-break>${b.paragraf({}, [])}</page-break>`);
    yaz('ustbilgi-x-sayfasonu.udf', { b, liste });
  }
  {
    const b = new Belge();
    const liste = [`<header>${b.paragraf({}, [['\t'.repeat(10000)]])}</header>`];
    for (let i = 0; i < 1999; i++) liste.push('<page-break/>');
    yaz('ustbilgi-sekme-x-sayfasonu.udf', { b, liste });
  }
  {
    const b = new Belge();
    b.havuz = 'x';
    const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADklEQVR4nGP4zwADQBYAD/4B//Ga+iUAAAAASUVORK5CYII=';
    const liste = [`<header><paragraph><image imageData="${PNG}" width="453" height="120" startOffset="0" length="1"/></paragraph></header>`];
    for (let i = 0; i < 1999; i++) liste.push('<page-break/>');
    yaz('ustbilgi-resim-x-sayfasonu.udf', { b, liste });
  }
  {
    const b = new Belge();
    const metin = 'x'.repeat(1000);
    const liste = Array.from({ length: 400 }, () => b.paragraf({}, [[metin]]));
    const notlar = Array.from({ length: 500 }, (_, i) => `<comment strtOffs="${i * 800}" endOffs="${i * 800 + 3}" usr="d" time="1"><paragraph><content startOffset="0" length="1"/></paragraph></comment>`).join('');
    yaz('not-x-parca.udf', { b, liste }, [['comments.xml', `<template><content><![CDATA[n]]></content><elements>${notlar}</elements></template>`]]);
  }
  const c = await chromeBaslat();
  let sorun = 0;
  try {
    const id = await eklentiYukle(c);
    for (const ad of fs.readdirSync(klasor).sort()) {
      const s = await sekmeAc(c, `chrome-extension://${id}/goruntule.html`);
      await s.g('Runtime.enable');
      const hatalar = hataToplayici(c, s.sessionId);
      await ifadeBekle(s.g, "document.readyState === 'complete' && !!document.getElementById('dosya-sec')");
      const { root } = await s.g('DOM.getDocument', { depth: 0 });
      const { nodeId } = await s.g('DOM.querySelector', { nodeId: root.nodeId, selector: '#dosya-sec' });
      const bas = Date.now();
      await s.g('DOM.setFileInputFiles', { files: [path.join(klasor, ad)], nodeId });
      const durum = await ifadeBekle(s.g, "(() => { if (document.querySelector('.durum.hata')) return 'hata: ' + document.querySelector('.durum.hata h2').textContent; const k = document.querySelector('.udf'); return k ? 'belge' + (document.querySelector('.udf-not') ? ' (kesildi notu)' : '') : ''; })()", 60000).catch(() => 'zaman aşımı');
      // Sekme yanıt veriyor mu: belge göründükten sonra basit bir ifade 5 sn içinde dönmeli.
      const yanit = await Promise.race([s.g('Runtime.evaluate', { expression: '1+1', returnByValue: true }).then(() => 'yanıt veriyor'), new Promise(r => setTimeout(() => r('YANIT YOK'), 5000))]);
      const sure = Date.now() - bas;
      const tamam = durum !== 'zaman aşımı' && yanit === 'yanıt veriyor' && sure < 60000 && !hatalar.some(h => /istisna/.test(h));
      if (!tamam) sorun++;
      console.log(`${tamam ? 'TAMAM' : 'SORUN'} ${ad} · ${durum} · ${sure} ms · ${yanit}${hatalar.length ? ' · ' + hatalar.join(' | ') : ''}`);
      await c.gonder('Target.closeTarget', { targetId: s.targetId });
    }
  } finally { c.kapat(); fs.rmSync(klasor, { recursive: true, force: true }); }
  return sorun;
}

const sonuc = kip === 'gorsel' ? await gorsel(arg[0], arg[1])
  : kip === 'yuk' ? await yuk()
  : kip === 'paket' ? await paket(arg[0])
  : kip === 'github' ? await github()
  : kip === 'drive' ? await (await import('./sahte-drive.mjs')).driveSina(arg[0], arg[1])
  : kip === 'gmail' ? await (await import('./sahte-gmail.mjs')).gmailSina(arg[0], arg[1])
  : kip === 'gercek' ? await (await import('./gercek-drive.mjs')).gercekSina(arg[0])
  : kip === 'hiz' ? await (await import('./hiz-olcumu.mjs')).hizOlc(arg)
    : (console.error('Kullanım: node araclar/chrome-sina.mjs gorsel|yuk|paket|github|drive|gmail|gercek|hiz …'), 2);
process.exit(sonuc ? 1 : 0);
