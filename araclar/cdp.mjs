// Görünmez (headless) Chrome'u geçici profille başlatır ve DevTools iletişim kurallarını (CDP) boru üzerinden konuşur.
// Markalı Chrome 137'den beri --load-extension'ı yok saydığı için eklenti Extensions.loadUnpacked ile yüklenir.
import { spawn, execFileSync } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const VARSAYILAN_CHROME = [
  process.env.CHROME_YOLU,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome'
].filter(Boolean);

export async function chromeBaslat({ ekler = [], gorunur = false } = {}) {
  const yol = VARSAYILAN_CHROME.find(p => fs.existsSync(p));
  if (!yol) throw new Error('Chrome bulunamadı; CHROME_YOLU ortam değişkenini verin.');
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'udf-okuyucu-sinama-'));
  const argumanlar = [
    ...(gorunur ? [] : ['--headless=new']), '--remote-debugging-pipe', '--enable-unsafe-extension-debugging',
    `--user-data-dir=${profil}`, '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-component-update',
    '--hide-scrollbars', '--mute-audio', '--lang=tr-TR', ...ekler, 'about:blank'
  ];
  const surec = spawn(yol, argumanlar, { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  const yaz = surec.stdio[3], oku = surec.stdio[4];
  const cozucu = new StringDecoder('utf8');
  let tampon = '', sira = 0;
  const bekleyen = new Map(), dinleyiciler = new Set();
  oku.on('data', d => {
    tampon += cozucu.write(d);
    let i;
    while ((i = tampon.indexOf('\0')) >= 0) {
      const ileti = JSON.parse(tampon.slice(0, i));
      tampon = tampon.slice(i + 1);
      if (ileti.id && bekleyen.has(ileti.id)) {
        const { coz, red, yontem } = bekleyen.get(ileti.id);
        bekleyen.delete(ileti.id);
        if (ileti.error) red(new Error(`${yontem}: ${ileti.error.message}`)); else coz(ileti.result);
      } else for (const f of dinleyiciler) f(ileti);
    }
  });
  const gonder = (method, params = {}, sessionId) => new Promise((coz, red) => {
    const id = ++sira;
    bekleyen.set(id, { coz, red, yontem: method });
    yaz.write(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }) + '\0');
  });
  const olayBekle = (kosul, sure = 15000) => new Promise((coz, red) => {
    const z = setTimeout(() => { dinleyiciler.delete(f); red(new Error('olay zaman aşımı')); }, sure);
    const f = m => { if (kosul(m)) { clearTimeout(z); dinleyiciler.delete(f); coz(m); } };
    dinleyiciler.add(f);
  });
  function kapat() {
    try { execFileSync('taskkill', ['/F', '/T', '/PID', String(surec.pid)], { stdio: 'ignore' }); } catch { try { surec.kill('SIGKILL'); } catch { /* yok */ } }
    for (let i = 0; i < 10; i++) {
      try { fs.rmSync(profil, { recursive: true, force: true }); break; } catch { execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},300)']); }
    }
  }
  return { gonder, olayBekle, dinle: f => dinleyiciler.add(f), birak: f => dinleyiciler.delete(f), kapat, profil };
}

// Yeni sekme açar ve oturuma bağlanır; dönen nesneyle o sekmeye komut gönderilir.
export async function sekmeAc(c, url) {
  const { targetId } = await c.gonder('Target.createTarget', { url });
  const { sessionId } = await c.gonder('Target.attachToTarget', { targetId, flatten: true });
  const g = (m, p) => c.gonder(m, p, sessionId);
  return { targetId, sessionId, g };
}

// Eklentinin sayfalarındaki (sekme, gömülü çerçeve, service worker) CSP ihlallerini toplar. Hedef bulunur bulunmaz ona
// bağlanılır, Log ve Audits açılır: İkisi de açıldıkları ana dek biriken kayıtları da verir. İhlal konsolda "Content
// Security Policy" iletisi ve Audits'te ContentSecurityPolicyIssue olarak gelir (aynı ihlal iki kez sayılabilir). Sayfalara
// bir şey eklenmez. Dönen dizi sınama boyunca dolar.
export async function cspIzle(c, kimlik) {
  const ihlaller = [];
  const oturumlar = new Map();   // sessionId → hedefin adresi (anahtarsız)
  const bagli = new Set();
  const bagla = async t => {
    if (!t || bagli.has(t.targetId) || !['page', 'iframe', 'service_worker'].includes(t.type) || !String(t.url).startsWith(`chrome-extension://${kimlik}/`)) return;
    bagli.add(t.targetId);
    try {
      const { sessionId } = await c.gonder('Target.attachToTarget', { targetId: t.targetId, flatten: true });
      oturumlar.set(sessionId, t.url.replace(/#.*/, ''));
      for (const a of ['Log.enable', 'Audits.enable']) await c.gonder(a, {}, sessionId).catch(() => {});
    } catch { /* hedef bu arada kapandı */ }
  };
  c.dinle(m => {
    if (m.method === 'Target.targetCreated' || m.method === 'Target.targetInfoChanged') { bagla(m.params.targetInfo); return; }
    const yer = oturumlar.get(m.sessionId);
    if (!yer) return;
    if (m.method === 'Log.entryAdded' && /Content Security Policy/i.test(m.params.entry.text)) ihlaller.push(`${yer}: ${m.params.entry.text.slice(0, 240)}`);
    if (m.method === 'Audits.issueAdded' && m.params.issue.code === 'ContentSecurityPolicyIssue') {
      ihlaller.push(`${yer}: ${JSON.stringify(m.params.issue.details.contentSecurityPolicyIssueDetails || {}).slice(0, 240)}`);
    }
  });
  await c.gonder('Target.setDiscoverTargets', { discover: true });
  for (const t of (await c.gonder('Target.getTargets')).targetInfos) await bagla(t);
  return ihlaller;
}

// Ekrandaki bir pikselin rengi ([r, g, b]): 1×1 ekran görüntüsü alınır. Tek pikselli PNG'de satır süzgecinin hiçbiri
// değeri değiştirmez (sol ve üst komşu yok), açılan verinin ilk baytı süzgeç, ardından renk baytları gelir.
export async function pikselRengi(g, x, y) {
  const { data } = await g('Page.captureScreenshot', { format: 'png', clip: { x, y, width: 1, height: 1, scale: 1 } });
  const png = Buffer.from(data, 'base64');
  const parcalar = [];
  let tur = null;
  for (let i = 8; i < png.length;) {
    const uzunluk = png.readUInt32BE(i), ad = png.toString('latin1', i + 4, i + 8);
    if (ad === 'IHDR') tur = png[i + 8 + 9];
    if (ad === 'IDAT') parcalar.push(png.subarray(i + 8, i + 8 + uzunluk));
    i += 12 + uzunluk;
  }
  if (tur !== 2 && tur !== 6) throw new Error('beklenmeyen PNG renk türü: ' + tur);
  const ham = zlib.inflateSync(Buffer.concat(parcalar));
  return [ham[1], ham[2], ham[3]];
}

// Sınama ifadelerinde (sayfanın kendi dünyasında) gömülü belgenin çerçevesi: Çerçeve ana alanın gölge kökündedir
// (icerik.js), gölge kökü eklenemediyse ana alanın çocuğudur. Arama ana alanın rolüne bağlı değil: "Yapı tanınmazsa"
// sınamalarında role=main yoktur ve orada hiçbir yerde çerçeve olmamalı. Gölge kökündeki çerçeve odaktayken sayfanın odağı
// (document.activeElement) ana alandır, çerçeve gölge kökünün odağıdır.
export const CERCEVELER = "[...document.querySelectorAll('iframe.udf-okuyucu-cerceve'), ...[...document.querySelectorAll('*')].flatMap(e => e.shadowRoot ? [...e.shadowRoot.querySelectorAll('iframe.udf-okuyucu-cerceve')] : [])]";
export const CERCEVE = `(${CERCEVELER}[0] || null)`;
export const CERCEVE_ODAKTA = `(c => !!c && c.getRootNode().activeElement === c)(${CERCEVE})`;

export async function ifadeBekle(g, ifade, sure = 15000) {
  const bas = Date.now();
  for (;;) {
    const r = await g('Runtime.evaluate', { expression: ifade, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.value) return r.result.value;
    if (Date.now() - bas > sure) throw new Error('bekleme zaman aşımı: ' + ifade);
    await new Promise(z => setTimeout(z, 150));
  }
}
