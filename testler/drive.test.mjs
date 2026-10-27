import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { KOK } from './yardimci.mjs';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://drive.google.com/drive/u/1/folders/abc', runScripts: 'outside-only' });
const w = dom.window;
w.eval(fs.readFileSync(path.join(KOK, 'drive-kimlik.js'), 'utf8'));
const K = w.DriveKimlik;

test('adresten kimlik, hesap ve kaynak anahtarı', () => {
  assert.deepEqual({ ...K.urldenBilgi('https://drive.google.com/file/d/1AbcDEFghij_KLMnop-123/view?usp=sharing&resourcekey=0-Abc_d') },
    { id: '1AbcDEFghij_KLMnop-123', au: null, rk: '0-Abc_d' });
  assert.equal(K.urldenBilgi('https://drive.google.com/file/u/3/d/1AbcDEFghij_KLMnop-123/view').au, 3);
  assert.equal(K.urldenBilgi('https://drive.google.com/open?id=1AbcDEFghij_KLMnop-123&authuser=2').id, '1AbcDEFghij_KLMnop-123');
  assert.equal(K.urldenBilgi('https://drive.google.com/open?id=1AbcDEFghij_KLMnop-123&authuser=2').au, 2);
  assert.equal(K.urldenBilgi('https://drive.google.com/uc?id=1AbcDEFghij_KLMnop-123&export=download').id, '1AbcDEFghij_KLMnop-123');
  assert.equal(K.urldenBilgi('https://drive.google.com/drive/u/1/folders/abc').id, null);
  assert.equal(K.urldenBilgi('https://ornek.com/file/d/1AbcDEFghij_KLMnop-123/view'), null);
  assert.equal(K.urldenBilgi('https://drive.google.com/file/d/kisa/view').id, null);
  assert.equal(K.urldenBilgi('https://drive.google.com/file/d/1AbcDEFghij_KLMnop-123/view?resourcekey=a<b').rk, null);
});

test('önizleme JSON\'u ve sayfa hesabı', () => {
  const d = w.document;
  d.body.innerHTML = '';
  assert.equal(K.aktifOge(d), null);
  const e = d.createElement('div');
  e.id = 'drive-active-item-info';
  e.textContent = '{"id": "1ZzzYyyXxxWwwVvvUuuTttSssRrrQqq", "title": "Takip Talebi.udf", "mimeType": "text\\/xml"}';
  d.body.append(e);
  assert.deepEqual({ ...K.aktifOge(d) }, { id: '1ZzzYyyXxxWwwVvvUuuTttSssRrrQqq', ad: 'Takip Talebi.udf', tur: 'text/xml' });
  e.textContent = '{bozuk';
  assert.equal(K.aktifOge(d), null);
  e.textContent = '{"id": "../../x", "title": "a.udf"}';
  assert.equal(K.aktifOge(d), null);
  assert.equal(K.sayfaHesabi(d, 'https://drive.google.com/drive/u/1/folders/abc'), 1);
  const og = d.createElement('meta');
  og.setAttribute('property', 'og:url');
  og.setAttribute('content', 'https://drive.google.com/file/u/4/d/1ZzzYyyXxxWwwVvvUuuTttSssRrrQqq/view');
  d.head.append(og);
  assert.equal(K.sayfaHesabi(d, 'https://drive.google.com/file/d/1ZzzYyyXxxWwwVvvUuuTttSssRrrQqq/view'), 4);
  og.remove();
});

test('sekme başlığından ad', () => {
  assert.equal(K.basliktanAd('Dava Dilekçesi.udf - Google Drive'), 'Dava Dilekçesi.udf');
  assert.equal(K.basliktanAd('Ek.pdf - Google Drive'), null);
  assert.equal(K.udfAdiMi('dilekce.UDF '), true);
  assert.equal(K.udfAdiMi('Ek.pdf'), false);
});
