// PDF'in her sayfasının üst ve alt kenarındaki metni yazar (yazdırma sınaması için): node araclar/pdf-metni.mjs <pdf> [--hepsi]
import fs from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function pdfSayfalari(yol) {
  const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(yol)), useSystemFonts: false, verbosity: 0 }).promise;
  const sayfalar = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const s = await doc.getPage(i);
    const boy = s.getViewport({ scale: 1 }).height;
    const { items } = await s.getTextContent();
    const ogeler = items.filter(x => x.str.trim()).map(x => ({ metin: x.str, x: x.transform[4], y: boy - x.transform[5] }));
    sayfalar.push({ no: i, boy, ogeler });
  }
  return sayfalar;
}

if (process.argv[1] && process.argv[1].endsWith('pdf-metni.mjs')) {
  const sayfalar = await pdfSayfalari(process.argv[2]);
  for (const s of sayfalar) {
    const ust = s.ogeler.filter(o => o.y < 60).map(o => o.metin).join(' | ');
    const alt = s.ogeler.filter(o => o.y > s.boy - 45).map(o => o.metin).join(' | ');
    console.log(`sayfa ${s.no}: üst=[${ust.length > 60 ? ust.slice(0, 60) + '…' : ust}] alt=[${alt}]`);
  }
}
