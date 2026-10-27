import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { KOK } from './yardimci.mjs';

// indir.js'i sahte fetch'le ayrı bir bağlamda çalıştırır; istenen adresleri kaydeder.
function yukle(yanitlar) {
  const istekler = [];
  const baglam = {
    URL, TextDecoder, Uint8Array, DOMException, Number, Object, String, Error, Promise, console,
    fetch: async (u, secenek) => {
      const url = new URL(u);
      istekler.push({ url, secenek });
      const r = yanitlar(url, istekler.length);
      if (r instanceof Error) throw r;
      const govde = typeof r.govde === 'string' ? new TextEncoder().encode(r.govde) : (r.govde || new Uint8Array(0));
      let okundu = false;
      return {
        ok: r.durum >= 200 && r.durum < 300, status: r.durum, url: r.url || url.href,
        headers: new Map(Object.entries({ 'content-type': r.tur || 'application/octet-stream', ...(r.baslik || {}) })),
        body: { getReader: () => ({ read: async () => { if (okundu) return { done: true }; okundu = true; return { done: false, value: govde }; }, cancel: async () => {} }) }
      };
    }
  };
  baglam.globalThis = baglam;
  vm.createContext(baglam);
  vm.runInContext(fs.readFileSync(path.join(KOK, 'indir.js'), 'utf8'), baglam);
  return { D: baglam.DriveIndir, istekler };
}
const ID = '1AaaBbbCccDddEeeFffGggHhhIiiJjjKk';
const PK = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);

test('doğrudan indirme: adres, çerez ve dosya adı', async () => {
  const { D, istekler } = yukle(() => ({ durum: 200, govde: PK, baslik: { 'content-disposition': "attachment; filename=\"x.udf\"; filename*=UTF-8''Dava%20Dilek%C3%A7esi.udf" } }));
  const r = await D.udfIndir({ id: ID, au: 1, rk: '0-abc' });
  assert.deepEqual([...r.bayt], [...PK]);
  assert.equal(r.ad, 'Dava Dilekçesi.udf');
  assert.equal(r.hesap, 1);
  const u = istekler[0].url;
  assert.equal(u.origin + u.pathname, 'https://drive.usercontent.google.com/download');
  assert.equal(u.searchParams.get('id'), ID);
  assert.equal(u.searchParams.get('authuser'), '1');
  assert.equal(u.searchParams.get('resourcekey'), '0-abc');
  assert.equal(istekler[0].secenek.credentials, 'include');
});

test('virüs tarama sayfası: onayla yeniden istenir', async () => {
  const { D, istekler } = yukle((u, n) => n === 1
    ? { durum: 200, tur: 'text/html; charset=utf-8', govde: '<form id="download-form" action="https://drive.usercontent.google.com/download"><input type="hidden" name="uuid" value="1b4fa745-aaaa"></form>' }
    : { durum: 200, govde: PK });
  await D.udfIndir({ id: ID, au: 0 });
  assert.equal(istekler.length, 2);
  assert.equal(istekler[1].url.searchParams.get('confirm'), 't');
  assert.equal(istekler[1].url.searchParams.get('uuid'), '1b4fa745-aaaa');
  assert.equal(istekler[1].url.host, 'drive.usercontent.google.com');
});

// Yalnız hesap sırası 2 dosyaya erişebiliyor.
const ikinciHesap = u => (u.searchParams.get('authuser') === '2' ? { durum: 200, govde: PK } : { durum: 403, tur: 'text/html' });

test('sayfanın hesap sırası biliniyorsa yalnız o hesapla denenir (kimlik öbür hesaplarla gönderilmez)', async () => {
  for (const au of [0, 1, 5, 99]) {
    const { D, istekler } = yukle(ikinciHesap);
    await assert.rejects(D.udfIndir({ id: ID, au }), e => e.kod === 'HTTP_403', String(au));
    assert.deepEqual(istekler.map(i => i.url.searchParams.get('authuser')), [String(au)], String(au));
  }
  for (const kod of [401, 404]) {
    const { D, istekler } = yukle(() => ({ durum: kod, tur: 'text/html' }));
    await assert.rejects(D.udfIndir({ id: ID, au: 0 }), e => e.kod === `HTTP_${kod}`);
    assert.equal(istekler.length, 1);
  }
  const { D, istekler } = yukle(() => new TypeError('Failed to fetch'));
  await assert.rejects(D.udfIndir({ id: ID, au: 3 }), e => e.kod === 'AG');
  assert.equal(istekler.length, 1, 'ağ hatasında da öbür hesap denenmez');
  const r = await yukle(ikinciHesap).D.udfIndir({ id: ID, au: 2 });
  assert.equal(r.hesap, 2);
});

test('hesap sırası bilinmiyorsa yalnız hesapsız istek gider (varsayılan hesap), öbür hesaplar denenmez', async () => {
  for (const au of [undefined, null, -1, 100, 1.5, '2']) {
    const { D, istekler } = yukle(ikinciHesap);
    await assert.rejects(D.udfIndir({ id: ID, au }), e => e.kod === 'HTTP_403', String(au));
    assert.deepEqual(istekler.map(i => i.url.searchParams.get('authuser')), [null], String(au));
  }
  const { D, istekler } = yukle(() => ({ durum: 200, govde: PK }));
  const r = await D.udfIndir({ id: ID });
  assert.equal(r.hesap, null);
  assert.deepEqual(istekler.map(i => i.url.searchParams.get('authuser')), [null]);
  // Erişim ve oturum dışındaki hata (ör. dosya çok büyük) başka hesapla denenmez.
  const b = yukle(() => ({ durum: 200, govde: PK, baslik: { 'content-length': String(50 * 1024 * 1024) } }));
  await assert.rejects(b.D.udfIndir({ id: ID }), e => e.kod === 'BUYUK');
  assert.equal(b.istekler.length, 1);
});

test('hata kodları ve açıklamaları', async () => {
  const kod = async yanit => { const { D } = yukle(() => yanit); try { await D.udfIndir({ id: ID, au: 0 }); return 'indi'; } catch (e) { return e.kod; } };
  assert.equal(await kod(new TypeError('Failed to fetch')), 'AG');
  assert.equal(await kod({ durum: 200, tur: 'text/html', url: 'https://accounts.google.com/v3/signin', govde: '<html>ServiceLogin</html>' }), 'OTURUM_YOK');
  assert.equal(await kod({ durum: 404, tur: 'text/html' }), 'HTTP_404');
  assert.equal(await kod({ durum: 500 }), 'HTTP_500');
  assert.equal(await kod({ durum: 200, govde: new Uint8Array(0) }), 'BOS');
  assert.equal(await kod({ durum: 200, govde: PK, baslik: { 'content-length': String(50 * 1024 * 1024) } }), 'BUYUK');
  const { D } = yukle(() => ({ durum: 200, govde: PK }));
  await assert.rejects(D.udfIndir({ id: '../etc' }), e => e.kod === 'KIMLIK');
  assert.match(D.hataAciklamasi({ kod: 'HTTP_403' }).baslik, /izniniz yok/);
  assert.equal(D.driveBaglantisi({ id: ID, au: 2 }), `https://drive.google.com/file/d/${ID}/view?authuser=2`);
  assert.equal(D.driveBaglantisi({ id: 'x"><' }), 'https://drive.google.com/');
});

const GMAIL_ADRESI = 'https://mail.google.com/mail/u/1?ui=2&ik=1a2b3c4d5e&attid=0.1&permmsgid=msg-f:1797114040482588150&th=18f0a1b2c3d4e5f6&view=att&disp=safe&zw';

test('Gmail eki: adres olduğu gibi, çerezle; yönlendirme sonrası baytlar', async () => {
  const { D, istekler } = yukle(() => ({ durum: 200, govde: PK, url: 'https://mail-attachment.googleusercontent.com/attachment/u/1/?x=1' }));
  const r = await D.gmailEkIndir(GMAIL_ADRESI);
  assert.deepEqual([...r.bayt], [...PK]);
  assert.equal(istekler.length, 1);
  assert.equal(istekler[0].url.href, GMAIL_ADRESI);
  assert.equal(istekler[0].secenek.credentials, 'include');
  assert.equal(istekler[0].secenek.cache, 'no-store');
});

test('Gmail eki: ağ hatasında bir kez benzersiz ekle yeniden; HTML ve geçersiz adres hata', async () => {
  const { D, istekler } = yukle((u, n) => (n === 1 ? new TypeError('Failed to fetch') : { durum: 200, govde: PK }));
  await D.gmailEkIndir(GMAIL_ADRESI);
  assert.equal(istekler.length, 2);
  assert.match(istekler[1].url.href, /&zw&cacheCounter=\d+$/);
  const kod = async (yanit, adres = GMAIL_ADRESI) => { const y = yukle(() => yanit); try { await y.D.gmailEkIndir(adres); return 'indi'; } catch (e) { return `${e.kod} ${y.istekler.length}`; } };
  assert.equal(await kod(new TypeError('Failed to fetch')), 'AG 2');
  assert.equal(await kod({ durum: 200, tur: 'text/html', url: 'https://accounts.google.com/ServiceLogin', govde: '<html></html>' }), 'OTURUM_YOK 1');
  assert.equal(await kod({ durum: 403, tur: 'text/html' }), 'HTTP_403 1');
  for (const adres of ['https://ornek.com/mail/u/1?ui=2&view=att&zw', 'https://mail.google.com/mail/u/1?ui=2&ik=<x>&view=att&zw',
    'https://mail.google.com/mail/u/1?ui=2&ik=1a&view=att&zw#', 'javascript:alert(1)', GMAIL_ADRESI.replace('&zw', '')]) {
    assert.equal(await kod({ durum: 200, govde: PK }, adres), 'KIMLIK 0', adres);
  }
});

test('Gmail hata açıklamaları', () => {
  const { D } = yukle(() => ({ durum: 200, govde: PK }));
  assert.match(D.hataAciklamasi({ kod: 'GMAIL_SEKME' }, 'gmail').metin, /Gmail sekmesini yenileyin/);
  assert.match(D.hataAciklamasi({ kod: 'HTTP_403' }, 'gmail').metin, /Gmail bu eki vermedi/);
  assert.match(D.hataAciklamasi({ kod: 'AG' }, 'gmail').baslik, /Gmail/);
  assert.doesNotMatch(JSON.stringify(['AG', 'OTURUM_YOK', 'HTTP_401', 'HTTP_403', 'HTTP_404', 'HTTP_503', 'BUYUK', 'BOS', 'KIMLIK', 'GMAIL_SEKME', 'X']
    .map(k => D.hataAciklamasi({ kod: k }, 'gmail'))), /Drive/, 'Gmail ekinde Drive geçmez');
  assert.match(D.hataAciklamasi({ kod: 'AG' }).baslik, /Drive/, 'varsayılan Drive');
});

test('base64: tarayıcının kendi çeviricisiyle (toBase64, fromBase64) ve onsuz aynı metin ve bayt', () => {
  // Node'da yerli çevirici yok: Biri Buffer'la taklit edilir, öbüründe btoa/atob yolu çalışır.
  class Yerli extends Uint8Array {
    toBase64() { return Buffer.from(this).toString('base64'); }
    static fromBase64(s) { return new Yerli(Buffer.from(s, 'base64')); }
  }
  const kur = U8 => {
    const baglam = { Uint8Array: U8, URL, TextDecoder, DOMException, Number, Object, String, Error, Promise, atob, btoa };
    baglam.globalThis = baglam;
    vm.createContext(baglam);
    vm.runInContext(fs.readFileSync(path.join(KOK, 'indir.js'), 'utf8'), baglam);
    return baglam.DriveIndir;
  };
  const yerli = kur(Yerli), eski = kur(Uint8Array);
  for (const boy of [1, 2, 3, 0x8000 + 1, 100003]) {
    const veri = Uint8Array.from({ length: boy }, (_, i) => (i * 131 + 7) & 255);
    const beklenen = Buffer.from(veri).toString('base64');
    assert.equal(yerli.base64(Yerli.from(veri)), beklenen, `yerli ${boy}`);
    assert.equal(eski.base64(veri), beklenen, `eski ${boy}`);
    assert.deepEqual(Buffer.from(yerli.base64Coz(beklenen)), Buffer.from(veri));
    assert.deepEqual(Buffer.from(eski.base64Coz(beklenen)), Buffer.from(veri));
  }
});
