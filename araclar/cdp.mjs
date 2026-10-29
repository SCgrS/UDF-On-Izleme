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

// Chrome'un ekran görüntüsü RGBA olabilir: Saydamlık kanalı atılıp 24 bitlik PNG yazılır. Sayfanın zemini opak olduğu
// için her pikselin saydamlığı 255 olmalı, değilse hata.
export function rgbPng(png) {
  const parcalar = [];
  let en, boy, derinlik, tur;
  for (let i = 8; i < png.length;) {
    const uzunluk = png.readUInt32BE(i), ad = png.toString('latin1', i + 4, i + 8);
    if (ad === 'IHDR') { en = png.readUInt32BE(i + 8); boy = png.readUInt32BE(i + 12); derinlik = png[i + 16]; tur = png[i + 17]; }
    if (ad === 'IDAT') parcalar.push(png.subarray(i + 8, i + 8 + uzunluk));
    i += 12 + uzunluk;
  }
  if (derinlik !== 8 || (tur !== 2 && tur !== 6) || png[png.indexOf('IHDR') + 16] !== 0) throw new Error(`beklenmeyen PNG: derinlik ${derinlik}, tür ${tur}`);
  if (tur === 2) return png;
  const ham = zlib.inflateSync(Buffer.concat(parcalar));
  const satir = en * 4, cikti = Buffer.alloc((en * 3 + 1) * boy);
  let onceki = Buffer.alloc(satir);
  for (let y = 0; y < boy; y++) {
    const suzgec = ham[y * (satir + 1)], s = Buffer.from(ham.subarray(y * (satir + 1) + 1, (y + 1) * (satir + 1)));
    for (let x = 0; x < satir; x++) {
      const a = x >= 4 ? s[x - 4] : 0, b = onceki[x], c = x >= 4 ? onceki[x - 4] : 0;
      let ek = 0;
      if (suzgec === 1) ek = a;
      else if (suzgec === 2) ek = b;
      else if (suzgec === 3) ek = (a + b) >> 1;
      else if (suzgec === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); ek = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      else if (suzgec !== 0) throw new Error('bilinmeyen PNG süzgeci: ' + suzgec);
      s[x] = (s[x] + ek) & 255;
    }
    const hedef = y * (en * 3 + 1);
    for (let x = 0; x < en; x++) {
      if (s[x * 4 + 3] !== 255) throw new Error(`saydam piksel (${x}, ${y})`);
      cikti[hedef + 1 + x * 3] = s[x * 4]; cikti[hedef + 2 + x * 3] = s[x * 4 + 1]; cikti[hedef + 3 + x * 3] = s[x * 4 + 2];
    }
    onceki = s;
  }
  const crcTablo = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const parca = (ad, veri) => {
    const b = Buffer.alloc(12 + veri.length), govde = Buffer.concat([Buffer.from(ad, 'latin1'), veri]);
    let c = -1; for (const x of govde) c = crcTablo[(c ^ x) & 255] ^ (c >>> 8);
    b.writeUInt32BE(veri.length, 0); govde.copy(b, 4); b.writeUInt32BE((c ^ -1) >>> 0, 8 + veri.length);
    return b;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(en, 0); ihdr.writeUInt32BE(boy, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([png.subarray(0, 8), parca('IHDR', ihdr), parca('IDAT', zlib.deflateSync(cikti, { level: 9 })), parca('IEND', Buffer.alloc(0))]);
}
