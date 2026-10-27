// Motoru Node'da çalıştırır: DOMParser ve document jsdom'dan, akış/kodlama/şifreleme Node'un kendi web API'lerinden gelir.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

export const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let pencere = null;
export function motorYukle() {
  if (globalThis.UDFMotoru) return { motor: globalThis.UDFMotoru, pencere };
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
  pencere = dom.window;
  // jsdom'un canvas uygulaması yok; getContext null döner ve motor genişliği yaklaşık hesaplar. Uyarıyı sustur.
  pencere.HTMLCanvasElement.prototype.getContext = () => null;
  globalThis.DOMParser = pencere.DOMParser;
  globalThis.document = pencere.document;
  const kod = fs.readFileSync(path.join(KOK, 'motor', 'udf-motoru.js'), 'utf8');
  vm.runInThisContext(kod, { filename: 'udf-motoru.js' });
  return { motor: globalThis.UDFMotoru, pencere };
}

// Model içinden düz metin (testlerde karşılaştırma için).
export function modelMetni(bloklar) {
  const satirlar = [];
  for (const b of bloklar) {
    if (b.t === 'p') satirlar.push((b.liste ? b.liste.isaret + ' ' : '') + b.parcalar.map(c => c.t === 'metin' ? c.yazi : c.t === 'sekme' ? '\t' : '[resim]').join(''));
    else if (b.t === 'tablo') for (const r of b.satirlar) satirlar.push(r.hucreler.map(h => modelMetni(h.bloklar).join(' / ')).join(' | '));
    else satirlar.push('[resim]');
  }
  return satirlar;
}
