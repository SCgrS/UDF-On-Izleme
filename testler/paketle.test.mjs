import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { paketle, zipOku, denetle, zipYaz, basvurulanlar, EKLENTI_OGELERI, eklentiDosyalari, eklentiyiKopyala, izlenmeyenDosyalar, PAKET_ADI } from '../araclar/paketle.mjs';
import { KURULUM, surumNotu } from '../araclar/surum-notu.mjs';
import { KOK } from './yardimci.mjs';

const ozet = b => crypto.createHash('sha256').update(b).digest('hex');

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

test('paket: Kökte manifest, eksiksiz dosyalar, test ve örnek yok', () => {
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
  // Manifest'te yalnız bu alanlar var: İzin alanı (permissions, optional_*), action, options_ui ve commands yok. Tek ana
  // makine izni Drive'ın indirme adresi. Geliştiricinin X sayfası eklentinin bilgilerinde (author, homepage_url) ve
  // açıklamanın sonunda durur (WA Sohbet Sil Buton Gizleyici'deki gibi).
  assert.deepEqual(Object.keys(m).sort(), ['author', 'background', 'content_scripts', 'content_security_policy', 'description',
    'homepage_url', 'host_permissions', 'icons', 'incognito', 'key', 'manifest_version', 'minimum_chrome_version', 'name',
    'short_name', 'version', 'web_accessible_resources'], "manifest'te beklenmeyen alan");
  assert.deepEqual(m.host_permissions, ['https://drive.usercontent.google.com/*']);
  assert.equal(m.author, 'x.com/CgrShn');
  assert.equal(m.homepage_url, 'https://x.com/CgrShn');
  assert.match(m.description, /Geliştirici: x\.com\/CgrShn$/);
  assert.ok([...m.description].length <= 132, 'mağaza özeti en çok 132 karakter');
  // Paketteki her dosyanın bir kullanıcısı var: Manifest'in, HTML'lerin ya da service worker'ın adını verdiği dosyalar,
  // manifest ve lisans. Pakete giren simgeler tam olarak manifest'in icons alanındakiler.
  const basvurulan = basvurulanlar(g);
  assert.deepEqual([...g.keys()].filter(a => !basvurulan.has(a) && a !== 'manifest.json' && a !== 'LISANSLAR.txt'), [], 'kullanılmayan dosya');
  assert.deepEqual([...g.keys()].filter(a => a.startsWith('simgeler/')).sort(), Object.values(m.icons).sort());
  assert.deepEqual([...g.keys()].filter(a => a.endsWith('.html')).sort(), ['gomulu.html', 'goruntule.html']);
  fs.rmSync(path.dirname(hedef), { recursive: true, force: true });
});

test('mağaza paketi: Manifest\'te key yok, gerisi ve dosyalar aynı', () => {
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
  // Service worker'ın açtığı sayfa da (getURL ile ya da adresin yolu olarak, başında "/") pakette olmalı.
  const sw3 = Buffer.from("const s = chrome.runtime.getURL('sayfa.html'); const yol = u => u.pathname === '/sayfa.html';");
  const g3 = zipOku(zipYaz([['manifest.json', manifest], ['yok.js', sw3], ['LISANSLAR.txt', Buffer.from('')]]));
  assert.deepEqual(denetle(g3), ['eksik dosya: sayfa.html']);
  assert.deepEqual(denetle(zipOku(zipYaz([['manifest.json', manifest], ['yok.js', sw3], ['sayfa.html', Buffer.from('')], ['LISANSLAR.txt', Buffer.from('')]]))), []);
  assert.deepEqual(denetle(zipOku(zipYaz([['alt/manifest.json', manifest]]))), ['kökte manifest.json yok']);
});

// Geçici bir git deposu: Eklenti dosyaları bu depodan kopyalanıp git'e eklenir (commit gerekmez, ls-files dizine bakar).
function geciciDepo() {
  const kok = fs.mkdtempSync(path.join(os.tmpdir(), 'udf-git-'));
  const git = (...a) => execFileSync('git', ['-C', kok, ...a], { stdio: 'pipe' });
  git('init', '-q');
  eklentiyiKopyala(kok);
  git('add', '-A');
  return { kok, git };
}

test("paket yalnız git'in izlediği dosyalardan: Diskte kalan git dışı dosya pakete girmez, paket aynı bayt", () => {
  const { kok, git } = geciciDepo();
  const cikti = fs.mkdtempSync(path.join(os.tmpdir(), 'udf-paket-'));
  try {
    const temiz = fs.readFileSync(paketle(path.join(cikti, 'temiz.zip'), { kok }).hedef);
    // Geliştiricinin klasöründe kalabilecek dosyalar: Eski bir simge, düzenleyicinin yedeği, işletim sisteminin dosyası.
    const disarida = ['simgeler/eski-16.png', 'motor/udf-motoru.js.orig', 'simgeler/desktop.ini'];
    for (const ad of disarida) fs.writeFileSync(path.join(kok, ...ad.split('/')), 'git dışı');
    assert.deepEqual(eklentiDosyalari(kok), eklentiDosyalari());
    assert.deepEqual(izlenmeyenDosyalar(kok), [...disarida].sort((a, b) => a.localeCompare(b)));
    const kirli = fs.readFileSync(paketle(path.join(cikti, 'kirli.zip'), { kok }).hedef);
    assert.equal(ozet(kirli), ozet(temiz), 'git dışı dosyalar paketi değiştirmez');
    for (const ad of zipOku(kirli).keys()) assert.ok(!disarida.includes(ad), ad);
    // Bu deponun paketiyle de aynı: Aynı dosya listesi ve aynı içerikten aynı zip (CI'daki temiz klon ile yerel klasör).
    assert.equal(ozet(fs.readFileSync(paketle(path.join(cikti, 'depo.zip')).hedef)), ozet(temiz));
    // Git'e hiç girmemiş eklenti öğesi ve izlenip diskten silinmiş dosya açık hata verir, paket sessizce eksik kalmaz.
    git('rm', '-q', '--cached', 'gmail-ek.js');
    assert.throws(() => eklentiDosyalari(kok), /git'in izlemediği eklenti öğesi: gmail-ek\.js/);
    git('add', 'gmail-ek.js');
    fs.rmSync(path.join(kok, 'simgeler', '32.png'));
    assert.throws(() => paketle(path.join(cikti, 'eksik.zip'), { kok }), /diskte yok: simgeler\/32\.png/);
  } finally {
    fs.rmSync(kok, { recursive: true, force: true });
    fs.rmSync(cikti, { recursive: true, force: true });
  }
});

test('git deposu olmayan klasörde paket üretilmez (açık hata)', () => {
  const kok = fs.mkdtempSync(path.join(os.tmpdir(), 'udf-gitsiz-'));
  try {
    eklentiyiKopyala(kok);
    assert.throws(() => eklentiDosyalari(kok), /git deposu değil/);
    assert.throws(() => paketle(path.join(kok, 'p.zip'), { kok }), /git deposu değil/);
    assert.ok(!fs.existsSync(path.join(kok, 'p.zip')));
  } finally {
    fs.rmSync(kok, { recursive: true, force: true });
  }
});

test('sürüm notu kendi başına yeterli: Bölüm, ardından sürüm zip\'iyle kurulum ve güncelleme adımları', () => {
  const metin = '# Değişiklikler\n\n## 1.2.3 (2026-01-01)\n\nYeni özellik.\n\n## 1.2.2 (2025-12-01)\n\nEski.\n';
  assert.equal(surumNotu(metin, '1.2.3'), `Yeni özellik.\n\n${KURULUM}\n`);
  assert.equal(surumNotu(metin, '1.2'), null);
  assert.equal(surumNotu(metin, '1.2.4'), null);
  // Zip üst klasörsüz: Çıkarılan klasör, içinde manifest.json olan ve Chrome'a yüklenen klasördür. Güncellemede aynı klasörün
  // üzerine çıkarılıp kartta ↻.
  for (const parca of [`\`${PAKET_ADI}\``, 'Tümünü ayıkla', '`chrome://extensions`', '**Geliştirici modu**', '**Paketlenmemiş öğe yükle**',
    '`manifest.json`', '**Güncelleme:**', 'üzerine çıkarın', '(↻)']) assert.ok(KURULUM.includes(parca), parca);
  assert.doesNotMatch(KURULUM, /README|Download ZIP|-main\b/, 'not başka bir belgeye ya da GitHub\'ın Code zip\'ine göndermez');
  assert.doesNotMatch(KURULUM, /;|  /, 'noktalı virgül ve çift boşluk yok');
  // Komut satırı: Depodaki DEGISIKLIKLER.md'den manifest'in sürümü, bilinmeyen sürümde çıkış kodu 1.
  const surum = JSON.parse(fs.readFileSync(path.join(KOK, 'manifest.json'), 'utf8')).version;
  const r = spawnSync(process.execPath, [path.join(KOK, 'araclar', 'surum-notu.mjs'), surum], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, surumNotu(fs.readFileSync(path.join(KOK, 'DEGISIKLIKLER.md'), 'utf8'), surum));
  assert.ok(r.stdout.endsWith(`${KURULUM}\n`));
  assert.equal(spawnSync(process.execPath, [path.join(KOK, 'araclar', 'surum-notu.mjs'), '99.0.0'], { encoding: 'utf8' }).status, 1);
});

// İş akışlarındaki YAML'ın kullanılan alt kümesini okur: Girintili eşlemeler, "- " dizileri, satır içi [a, b] dizileri,
// tırnaklı ve düz değerler (hepsi metin), tam satır yorumlar. Başka bir YAML biçimi görülünce hata verir (denetim
// yanlış okunan bir dosyayla sessizce geçmesin).
function yamlOku(metin) {
  const satirlar = metin.split(/\r?\n/).filter(s => s.trim() && !/^\s*#/.test(s))
    .map(s => ({ girinti: s.length - s.trimStart().length, yazi: s.trim() }));
  let i = 0;
  const deger = y => {
    if (/^\[.*\]$/.test(y)) return y.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean).map(deger);
    if (/^'.*'$/.test(y)) return y.slice(1, -1).replace(/''/g, "'");
    if (/^".*"$/.test(y)) return JSON.parse(y);
    if (/^[|>{&*!%@`'"[]/.test(y)) throw new Error(`desteklenmeyen YAML değeri: ${y}`);
    return y;
  };
  function blok(girinti) {
    if (/^-( |$)/.test(satirlar[i].yazi)) {
      const dizi = [];
      while (i < satirlar.length && satirlar[i].girinti === girinti && /^-( |$)/.test(satirlar[i].yazi)) {
        const ic = satirlar[i].yazi.slice(1).trimStart();
        if (!ic) throw new Error('boş dizi öğesi desteklenmiyor');
        // "- ad: değer": Öğe, "- "den sonraki sütunda başlayan bir eşleme ya da düz bir değer.
        if (/^[\w-]+:( |$)/.test(ic)) { satirlar[i] = { girinti: girinti + satirlar[i].yazi.length - ic.length, yazi: ic }; dizi.push(blok(satirlar[i].girinti)); }
        else { dizi.push(deger(ic)); i++; }
      }
      return dizi;
    }
    const esleme = {};
    while (i < satirlar.length && satirlar[i].girinti === girinti) {
      const m = /^([\w-]+):(?: (.*))?$/.exec(satirlar[i].yazi);
      if (!m) throw new Error(`okunamayan satır: ${satirlar[i].yazi}`);
      if (m[1] in esleme) throw new Error(`yinelenen ad: ${m[1]}`);
      i++;
      if (m[2]) esleme[m[1]] = deger(m[2].trim());
      else if (i < satirlar.length && satirlar[i].girinti > girinti) esleme[m[1]] = blok(satirlar[i].girinti);
      else esleme[m[1]] = null;
      if (i < satirlar.length && satirlar[i].girinti > girinti) throw new Error(`beklenmeyen girinti: ${satirlar[i].yazi}`);
    }
    return esleme;
  }
  const kok = blok(0);
  if (i !== satirlar.length) throw new Error(`okunmayan satır: ${satirlar[i].yazi}`);
  return kok;
}

test('YAML okuyucu iş akışlarının biçimini doğru okur, bilmediği biçimde hata verir', () => {
  const ornek = "ad: Deneme\non:\n  push:\n    tags: ['v*', b]\n  pull_request:\n# yorum\nisler:\n  bir:\n    steps:\n" +
    "      - uses: a/b@v1\n        with:\n          x: false\n      - run: echo \"a: b\" #c\n      - duz\n";
  assert.deepEqual(yamlOku(ornek), { ad: 'Deneme', on: { push: { tags: ['v*', 'b'] }, pull_request: null },
    isler: { bir: { steps: [{ uses: 'a/b@v1', with: { x: 'false' } }, { run: 'echo "a: b" #c' }, 'duz'] } } });
  assert.throws(() => yamlOku('a: |\n  metin\n'), /desteklenmeyen/);
  assert.throws(() => yamlOku('a: b\n  c: d\n'), /beklenmeyen girinti/);
  assert.throws(() => yamlOku('a: b\na: c\n'), /yinelenen/);
});

test('iş akışları: Belirteç yalnız okur, depoya yalnız sürümü yayımlayan iş yazar, checkout kimlik bilgisi bırakmaz', () => {
  const oku = ad => yamlOku(fs.readFileSync(path.join(KOK, '.github', 'workflows', ad), 'utf8'));
  const eylem = a => (a.uses || '').replace(/@.*/, '');
  const yazanlar = [];
  for (const ad of fs.readdirSync(path.join(KOK, '.github', 'workflows')).filter(a => /\.ya?ml$/.test(a))) {
    const ia = oku(ad);
    assert.deepEqual(ia.permissions, { contents: 'read' }, `${ad}: İş akışı düzeyinde yalnız okuma`);
    for (const [isAdi, is] of Object.entries(ia.jobs)) {
      const yetki = is.permissions || {};
      // CodeQL taraması sonucunu yalnız Security sekmesine yazar, depoya yazmaz.
      if (ad === 'codeql.yml') assert.deepEqual(yetki, { contents: 'read', actions: 'read', 'security-events': 'write' }, `${ad} ${isAdi}`);
      else if (Object.values(yetki).some(d => d !== 'read' && d !== 'none')) yazanlar.push([ad, isAdi, is]);
      for (const a of is.steps) {
        if (eylem(a) === 'actions/checkout') assert.equal(a.with && a.with['persist-credentials'], 'false', `${ad} ${isAdi}: checkout`);
        if (eylem(a) === 'actions/upload-artifact') {
          const gun = Number(a.with['retention-days']);
          assert.ok(gun >= 1 && gun <= 3, `${ad} ${isAdi}: Çıktı en çok 3 gün saklanır`);
        }
      }
    }
  }
  // Yazma yetkisi tek işte: Sürümü yayımlayan iş. O iş depoyu çekmez, npm'i ve deponun kodunu çalıştırmaz, paketi ve notu
  // testleri geçmiş ilk işin çıktısından alır.
  assert.equal(yazanlar.length, 1, yazanlar.map(([a, b]) => `${a} ${b}`).join(', '));
  const [ad, , yayim] = yazanlar[0];
  assert.equal(ad, 'yayim.yml');
  assert.deepEqual(yayim.permissions, { contents: 'write' });
  assert.deepEqual(yayim.steps.map(a => eylem(a) || 'run'), ['actions/download-artifact', 'run']);
  const [indir, yayimla] = yayim.steps;
  assert.match(yayimla.run, /^gh release create "\$GITHUB_REF_NAME" cikti\/UDF-On-Izleme\.zip .*--notes-file cikti\/not\.md/);
  assert.ok(yayimla.env.GH_TOKEN && yayimla.env.GH_REPO, 'depo çekilmediği için gh deponun adını ortamdan alır');
  const paket = oku('yayim.yml').jobs[yayim.needs];
  assert.ok(paket, 'yayım işi paket işini bekler');
  const komutlar = paket.steps.map(a => a.run || '').join('\n');
  for (const k of ['npm ci', 'npm test', `node araclar/paketle.mjs cikti/${PAKET_ADI}`, 'node araclar/surum-notu.mjs']) assert.ok(komutlar.includes(k), k);
  const yukle = paket.steps.find(a => eylem(a) === 'actions/upload-artifact');
  assert.equal(yukle.with.name, indir.with.name);
  assert.equal(yukle.with.path.replace(/\/$/, ''), indir.with.path.replace(/\/$/, ''));
});

test('yerel-sina: Satırlarda dosya adı ve belge metni yok, sıra numarası ve adın özeti var', () => {
  // UYAP dosya adları gibi taraf adı ve esas numarası taşıyan (yapay) adlar. Biri bozuk dosya, biri okunamayan girdi (.udf adlı
  // klasör: Okuma EISDIR verir, Node'un iletisi tam yolu taşır).
  const klasor = fs.mkdtempSync(path.join(os.tmpdir(), 'udf-yerel-'));
  const adlar = { 'Davacı Ayşe Örnekoğlu 2026-1234 Esas.udf': 'dilekce.udf', 'Davalı Veli Sınamacı 2026-987 Esas.udf': 'zip-degil.udf' };
  const okunamayan = 'Davacı Zeynep Denemeoğlu Esas.udf';
  try {
    for (const [ad, kaynak] of Object.entries(adlar)) fs.copyFileSync(path.join(KOK, 'testler', 'ornekler', kaynak), path.join(klasor, ad));
    fs.mkdirSync(path.join(klasor, okunamayan));
    const r = spawnSync(process.execPath, [path.join(KOK, 'araclar', 'yerel-sina.mjs'), klasor], { encoding: 'utf8' });
    assert.equal(r.status, 1, 'bozuk ve okunamayan dosya olduğu için çıkış kodu 1');
    assert.equal(r.stderr, '', 'okunamayan dosyada araç çökmez');
    const satirlar = r.stdout.trim().split('\n');
    const sirali = [...Object.keys(adlar), okunamayan].sort();
    assert.equal(satirlar.length, sirali.length, 'okunamayan dosyadan sonrakilere de bakılır');
    sirali.forEach((ad, k) => assert.ok(satirlar[k].startsWith(`${k + 1} ${ozet(Buffer.from(ad, 'utf8')).slice(0, 8)} `), satirlar[k]));
    assert.match(satirlar[0], /^1 [0-9a-f]{8} \{"bolum":\d+/);
    assert.match(satirlar[1], /^2 [0-9a-f]{8} HATA okuma EISDIR$/);
    assert.match(satirlar[2], /^3 [0-9a-f]{8} HATA zip /);
    for (const parca of ['Davacı', 'Davalı', 'Ayşe', 'Örnekoğlu', 'Veli', 'Sınamacı', 'Zeynep', 'Denemeoğlu', '1234', '987', 'Esas', '.udf', klasor]) {
      assert.ok(!r.stdout.includes(parca) && !r.stderr.includes(parca), parca);
    }
    // Özet yalnız sayılar ve kısa sabit değerler taşır, belgenin metninden söz yok.
    const veri = JSON.parse(satirlar[0].replace(/^1 [0-9a-f]{8} /, ''));
    for (const [alan, d] of Object.entries(veri)) assert.ok(typeof d === 'number' || /^[\w./-]{0,12}$/.test(d), `${alan}: ${d}`);
    assert.ok(veri.metin > 0, 'belge çizildi (metnin yalnız uzunluğu yazılır)');
  } finally {
    fs.rmSync(klasor, { recursive: true, force: true });
  }
});
