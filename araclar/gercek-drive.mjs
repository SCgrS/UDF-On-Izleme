// Gerçek Google Drive'da gömme denemesi (internet gerekir, oturum açılmaz). Herkese açık gdown örnek klasöründe UDF
// olmadığı için eklentinin geçici bir kopyası .txt dosyalarını da UDF sayar; böylece Drive'ın gerçek görüntüleyicisinde
// çerçevenin yeri, Drive içeriğinin gizlenmesi, okların üstte kalması ve Esc/ok iletimi sınanır. Metin dosyası UDF
// olmadığından çerçevede "Belge gösterilemedi" çıkması beklenir.
//   node araclar/chrome-sina.mjs gercek [ekran-görüntüsü.png]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromeBaslat, sekmeAc, ifadeBekle, CERCEVELER, CERCEVE, CERCEVE_ODAKTA } from './cdp.mjs';
import { eklentiyiKopyala } from './paketle.mjs';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KLASOR = 'https://drive.google.com/drive/folders/15uNXeRBIhVvZJIhL4yTw4IsStMhUaaxl';
const ADLAR = ['spam.txt', 'spam2.txt'];
const bekle = ms => new Promise(r => setTimeout(r, ms));

function kopyaKur() {
  const hedef = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'udf-gercek-')), 'eklenti');
  eklentiyiKopyala(hedef);
  const yol = path.join(hedef, 'drive-kimlik.js');
  const eski = fs.readFileSync(yol, 'utf8');
  const yeni = eski.replace("/\\.udf$/i.test(ad.trim())", "/\\.(udf|txt)$/i.test(ad.trim())");
  if (yeni === eski) throw new Error('drive-kimlik.js değiştirilemedi (udfAdiMi kalıbı değişmiş)');
  fs.writeFileSync(yol, yeni);
  return hedef;
}

export async function gercekSina(ekranYolu) {
  const kopya = kopyaKur();
  const c = await chromeBaslat({ ekler: ['--window-size=1280,900'] });
  const sonuclar = [];
  const sonuc = (ad, tamam, ayrinti = '') => { sonuclar.push(tamam); console.log(`${tamam ? 'TAMAM' : 'SORUN'} ${ad}${ayrinti ? ' · ' + ayrinti : ''}`); };
  try {
    const { id } = await c.gonder('Extensions.loadUnpacked', { path: kopya });
    // Görünmez Chrome'un kimliği (HeadlessChrome) Drive'da başka davranışa yol açmasın.
    const s = await sekmeAc(c, 'about:blank');
    for (const a of ['Runtime.enable', 'Page.enable']) await s.g(a);
    const { userAgent } = await c.gonder('Browser.getVersion');
    await s.g('Emulation.setUserAgentOverride', { userAgent: userAgent.replace('HeadlessChrome', 'Chrome') });
    await s.g('Page.navigate', { url: KLASOR });
    const deger = async (g, ifade) => (await g('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression: ifade })).result.value;
    await ifadeBekle(s.g, `[...document.querySelectorAll('[data-id]')].some(r => r.textContent.includes('${ADLAR[0]}'))`, 30000);
    await bekle(1500);
    // Satır görünür alana getirilir; konum oturana dek beklenir ve tıklanacak noktada gerçekten o satır olduğu
    // denetlenir (Drive'ın listesi kaydırmadan sonra bir süre yerleşiyor). Drive ikinci tıklamada açar.
    const satirYeri = () => deger(s.g, `(() => { const r = [...document.querySelectorAll('[role=row][data-id]')].find(r => [...r.querySelectorAll('*')].some(e => !e.childElementCount && e.textContent.trim() === '${ADLAR[0]}'));
      const e = [...r.querySelectorAll('*')].find(e => !e.childElementCount && e.textContent.trim() === '${ADLAR[0]}');
      const b = e.getBoundingClientRect(); const x = b.left + 5, y = b.top + b.height / 2;
      if (y < 0 || y > innerHeight - 40) { e.scrollIntoView({ block: 'center' }); return null; }
      const h = document.elementFromPoint(x, y); return h && r.contains(h) ? { x, y } : null; })()`);
    let yer = null, onceki = null;
    for (let i = 0; i < 40 && !(yer && onceki && yer.y === onceki.y); i++) { onceki = yer; await bekle(250); yer = await satirYeri(); }
    if (!yer) throw new Error('satır tıklanabilir değil');
    await s.g('Input.dispatchMouseEvent', { type: 'mouseMoved', x: yer.x, y: yer.y });
    await bekle(200);
    for (const n of [1, 2]) {
      await s.g('Input.dispatchMouseEvent', { type: 'mousePressed', x: yer.x, y: yer.y, button: 'left', buttons: 1, clickCount: n });
      await bekle(40);
      await s.g('Input.dispatchMouseEvent', { type: 'mouseReleased', x: yer.x, y: yer.y, button: 'left', buttons: 0, clickCount: n });
      await bekle(80);
    }
    await ifadeBekle(s.g, "!!document.getElementById('drive-active-item-info')", 8000).catch(async () => console.log('görüntüleyici açılmadı:', await deger(s.g, "document.activeElement && document.activeElement.outerHTML.slice(0, 160)")));
    const cerceve = async () => {
      for (let i = 0; i < 80; i++) {
        const { targetInfos } = await c.gonder('Target.getTargets');
        const h = targetInfos.find(t => t.type === 'iframe' && t.url.includes(`${id}/gomulu.html#t=`));
        if (h) { const { sessionId } = await c.gonder('Target.attachToTarget', { targetId: h.targetId, flatten: true }); return (m, p) => c.gonder(m, p, sessionId); }
        await bekle(150);
      }
      return null;
    };
    const gommeDurumu = () => deger(s.g, `(() => {
      const bilgi = document.getElementById('drive-active-item-info');
      const ana = bilgi && bilgi.closest('[role=main]');
      const c = ana && ((ana.shadowRoot && ana.shadowRoot.querySelector('iframe.udf-okuyucu-cerceve')) || ana.querySelector(':scope > iframe.udf-okuyucu-cerceve'));
      const oge = bilgi ? JSON.parse(bilgi.textContent).title : null;
      if (!c) return { var: false, oge, sayi: ${CERCEVELER}.length };
      const r = c.getBoundingClientRect(), ar = ana.getBoundingClientRect();
      const oklar = [...document.querySelectorAll('[aria-label="Sonraki"], [aria-label="Önceki"]')].filter(b => b.checkVisibility({ visibilityProperty: true, opacityProperty: true }));
      const vurulur = b => { const x = b.getBoundingClientRect(); const h = document.elementFromPoint(x.left + x.width / 2, x.top + x.height / 2); return h === b || b.contains(h); };
      // Drive her okun gizli kopyalarını da tutuyor: her yönde tıklanabilir bir ok olmalı.
      const okUstte = oklar.length ? ['Önceki', 'Sonraki'].every(a => oklar.some(b => b.getAttribute('aria-label') === a && vurulur(b))) : null;
      const gorunenDrive = [...ana.children].filter(e => e !== c && e.checkVisibility({ visibilityProperty: true, opacityProperty: true })).length;
      return { var: true, oge, ust: Math.round(r.top - ar.top), alt: Math.round(ar.bottom - r.bottom), en: Math.round(r.width), anaEn: Math.round(ar.width), okSayisi: oklar.length, okUstte, gorunenDrive, odak: c.getRootNode().activeElement === c,
        golgede: !!ana.shadowRoot && ana.shadowRoot.contains(c) };
    })()`);
    let g = await cerceve();
    let durum = g ? await ifadeBekle(g, "document.querySelector('.durum.hata h2') ? document.querySelector('.durum.hata h2').textContent : document.querySelector('.udf-sayfa') ? 'belge' : ''", 20000).catch(() => 'zaman aşımı') : 'çerçeve yok';
    let gom = await gommeDurumu();
    sonuc('Drive’ın görüntüleyicisine gömüldü (ana alanın gölge kökünde)', gom.var && gom.golgede && gom.ust >= 64 && gom.ust <= 140 && gom.alt === 0 && gom.en === gom.anaEn && gom.gorunenDrive === 0 && gom.okUstte !== false,
      `${durum} · ${JSON.stringify(gom)}`);
    if (ekranYolu) {
      const { data } = await s.g('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(ekranYolu, Buffer.from(data, 'base64'));
      console.log('ekran görüntüsü:', ekranYolu);
    }
    await ifadeBekle(s.g, CERCEVE_ODAKTA, 3000).catch(() => {});
    await s.g('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await s.g('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await bekle(2500);
    gom = await gommeDurumu();
    sonuc('sağ ok (belgede) → Drive sonraki dosyaya geçti, belge yeni alana gömüldü', gom.oge === ADLAR[1] && gom.var && gom.gorunenDrive === 0, JSON.stringify(gom));
    // Drive'ın okuna fareyle basılınca da geçer (ok belgenin üstünde).
    const ok = await deger(s.g, "(() => { for (const b of document.querySelectorAll('[aria-label=\"Önceki\"]')) { const x = b.getBoundingClientRect(); const h = document.elementFromPoint(x.left + x.width / 2, x.top + x.height / 2); if (h === b || b.contains(h)) return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; } return null; })()");
    if (ok) {
      await s.g('Input.dispatchMouseEvent', { type: 'mouseMoved', x: ok.x, y: ok.y });
      await s.g('Input.dispatchMouseEvent', { type: 'mousePressed', x: ok.x, y: ok.y, button: 'left', buttons: 1, clickCount: 1 });
      await s.g('Input.dispatchMouseEvent', { type: 'mouseReleased', x: ok.x, y: ok.y, button: 'left', buttons: 0, clickCount: 1 });
      await bekle(2500);
    }
    gom = await gommeDurumu();
    sonuc('Drive’ın önceki okuna fareyle basınca geçer, belge yeniden gömülür', !!ok && gom.oge === ADLAR[0] && gom.var && gom.gorunenDrive === 0, JSON.stringify(gom));
    g = await cerceve();
    await deger(s.g, `${CERCEVE} && ${CERCEVE}.focus(), 1`);
    await ifadeBekle(s.g, CERCEVE_ODAKTA, 3000).catch(() => {});
    await s.g('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await s.g('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await bekle(1500);
    gom = await gommeDurumu();
    const isaretli = await deger(s.g, "document.querySelectorAll('[data-udf-okuyucu-gomulu]').length");
    sonuc('Esc (belgede) → Drive’ın görüntüleyicisi kapandı, iz kalmadı', !gom.oge && gom.sayi === 0 && isaretli === 0, JSON.stringify({ ...gom, isaretli }));

    // Boşluğa tıklamak (Drive'ın PDF görüntüleyicisindeki gibi) kapatır: dosya yeniden açılır, çerçevede hata kutusunun
    // dışındaki boşluğa (sol üst, okların yukarısı) tıklanır.
    yer = null; onceki = null;
    for (let i = 0; i < 40 && !(yer && onceki && yer.y === onceki.y); i++) { onceki = yer; await bekle(250); yer = await satirYeri(); }
    if (yer) {
      await s.g('Input.dispatchMouseEvent', { type: 'mouseMoved', x: yer.x, y: yer.y });
      await bekle(200);
      for (const n of [1, 2]) {
        await s.g('Input.dispatchMouseEvent', { type: 'mousePressed', x: yer.x, y: yer.y, button: 'left', buttons: 1, clickCount: n });
        await bekle(40);
        await s.g('Input.dispatchMouseEvent', { type: 'mouseReleased', x: yer.x, y: yer.y, button: 'left', buttons: 0, clickCount: n });
        await bekle(80);
      }
    }
    g = yer ? await cerceve() : null;
    if (g) await ifadeBekle(g, "!!document.querySelector('.durum.hata') || !!document.querySelector('.udf-sayfa')", 20000).catch(() => {});
    const acikti = (await gommeDurumu()).var;
    const nokta = await deger(s.g, `(() => { const c = ${CERCEVE}; if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.left + 100, y: r.top + 40 }; })()`);
    if (nokta) {
      await s.g('Input.dispatchMouseEvent', { type: 'mouseMoved', x: nokta.x, y: nokta.y });
      await s.g('Input.dispatchMouseEvent', { type: 'mousePressed', x: nokta.x, y: nokta.y, button: 'left', buttons: 1, clickCount: 1 });
      await s.g('Input.dispatchMouseEvent', { type: 'mouseReleased', x: nokta.x, y: nokta.y, button: 'left', buttons: 0, clickCount: 1 });
      await bekle(1500);
    }
    gom = await gommeDurumu();
    sonuc('boşluğa tıklayınca Drive’ın görüntüleyicisi kapandı', acikti && !!nokta && !gom.oge && gom.sayi === 0, `açılmıştı: ${acikti} · ${JSON.stringify(gom)}`);
  } finally {
    c.kapat();
    fs.rmSync(path.dirname(kopya), { recursive: true, force: true });
  }
  return sonuclar.filter(x => !x).length;
}
