import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { paketle, zipOku, denetle, zipYaz, EKLENTI_OGELERI, eklentiDosyalari } from '../araclar/paketle.mjs';
import { KOK } from './yardimci.mjs';

test("kök düzeni: GitHub zip'i çıkarılınca klasör Chrome'a doğrudan yüklenebilir, eklenti dosyaları listede", () => {
  // Eklenti dosyaları kökte (kullanıcı isteği: yeşil Code → Download ZIP, UYAP Haciz Yardımcısı'ndaki gibi). Chrome kökte
  // "_" ile başlayan adı reddeder.
  const kok = fs.readdirSync(KOK);
  assert.ok(kok.includes('manifest.json'));
  assert.deepEqual(kok.filter(a => a.startsWith('_')), []);
  // Köke konan her eklenti dosyası (js/html/css) pakette de olmalı; yapılandırma dosyaları değil.
  const eklentiTuru = kok.filter(a => /\.(js|html|css)$/.test(a));
  assert.deepEqual(eklentiTuru.filter(a => !EKLENTI_OGELERI.includes(a)), [], 'EKLENTI_OGELERI listesine eklenmemiş dosya');
  for (const o of EKLENTI_OGELERI) assert.ok(fs.existsSync(path.join(KOK, o)), o);
  assert.ok(eklentiDosyalari().includes('motor/udf-motoru.js') && eklentiDosyalari().includes('simgeler/16.png'));
});

test('paket: kökte manifest, eksiksiz dosyalar, test ve örnek yok', () => {
  const hedef = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'udf-paket-')), 'p.zip');
  const r = paketle(hedef);
  const g = zipOku(fs.readFileSync(r.hedef));
  assert.ok(g.has('manifest.json'));
  assert.ok(g.has('motor/udf-motoru.js'));
  assert.ok(g.has('LISANSLAR.txt'));
  assert.deepEqual(denetle(g), []);
  for (const ad of g.keys()) assert.ok(!/^(testler|araclar|node_modules|belgeler)\//.test(ad), ad);
  const m = JSON.parse(g.get('manifest.json'));
  assert.equal(m.manifest_version, 3);
  // İzin yok (alan hiç yok ya da boş), tek ana makine izni Drive'ın indirme adresi. Simgenin eylemi (açılır pencere,
  // tıklama), ayarlar sayfası ve kısayolu yok: Geliştiricinin X sayfası eklentinin bilgilerinde (author, homepage_url) ve
  // açıklamanın sonunda durur (WA Sohbet Sil Buton Gizleyici'deki gibi).
  assert.ok(m.permissions === undefined || (Array.isArray(m.permissions) && m.permissions.length === 0), JSON.stringify(m.permissions));
  assert.ok(!m.optional_permissions && !m.optional_host_permissions);
  assert.deepEqual(m.host_permissions, ['https://drive.usercontent.google.com/*']);
  assert.equal(m.action, undefined);
  assert.equal(m.author, 'x.com/CgrShn');
  assert.equal(m.homepage_url, 'https://x.com/CgrShn');
  assert.match(m.description, /Geliştirici: x\.com\/CgrShn$/);
  assert.ok([...m.description].length <= 132, 'mağaza özeti en çok 132 karakter');
  assert.ok(!m.options_ui && !m.options_page && !m.commands, 'Ayarlar sayfası ve kısayol yok');
  assert.deepEqual([...g.keys()].filter(a => /^(acilir|ayarlar)|kapali/.test(path.basename(a))), []);
  fs.rmSync(path.dirname(hedef), { recursive: true, force: true });
});

test('mağaza paketi: manifest\'te key yok, gerisi ve dosyalar aynı', () => {
  const klasor = fs.mkdtempSync(path.join(os.tmpdir(), 'udf-paket-'));
  const olagan = zipOku(fs.readFileSync(paketle(path.join(klasor, 'p.zip')).hedef));
  const magaza = zipOku(fs.readFileSync(paketle(path.join(klasor, 'm.zip'), { magaza: true }).hedef));
  assert.deepEqual(denetle(magaza), []);
  assert.deepEqual([...magaza.keys()], [...olagan.keys()]);
  const mo = JSON.parse(olagan.get('manifest.json')), mm = JSON.parse(magaza.get('manifest.json'));
  assert.ok(mo.key, 'olağan pakette key var (her bilgisayarda aynı kimlik)');
  assert.equal(mm.key, undefined);
  const { key, ...kalan } = mo;
  assert.deepEqual(mm, kalan);
  for (const ad of olagan.keys()) if (ad !== 'manifest.json') assert.ok(olagan.get(ad).equals(magaza.get(ad)), ad);
  fs.rmSync(klasor, { recursive: true, force: true });
});

test('paket denetimi eksik dosyayı ve yasak adları yakalar', () => {
  const manifest = Buffer.from(JSON.stringify({ manifest_version: 3, background: { service_worker: 'yok.js' } }));
  const g = zipOku(zipYaz([['manifest.json', manifest], ['_gizli.js', Buffer.from('')], ['a.html', Buffer.from('<script src="b.js"></script>')]]));
  const s = denetle(g).join('\n');
  assert.match(s, /eksik dosya: yok\.js/);
  assert.match(s, /eksik dosya: b\.js/);
  assert.match(s, /"_" ile başlayan ad/);
  assert.match(s, /LISANSLAR/);
  // Service worker'ın kodunda adını verdiği betik de pakette olmalı.
  const sw = Buffer.from("importScripts('a.js'); const betik = 'baska-betik.js';");
  const g2 = zipOku(zipYaz([['manifest.json', manifest], ['yok.js', sw], ['a.js', Buffer.from('')], ['LISANSLAR.txt', Buffer.from('')]]));
  assert.deepEqual(denetle(g2), ['eksik dosya: baska-betik.js']);
  assert.deepEqual(denetle(zipOku(zipYaz([['alt/manifest.json', manifest]]))), ['kökte manifest.json yok']);
});
