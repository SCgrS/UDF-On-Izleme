// Bir klasördeki gerçek .udf dosyalarını motordan geçirir ve yalnız yapısal özet yazar (belge metni yazılmaz).
// Kullanım: node araclar/yerel-sina.mjs <klasör>
import fs from 'node:fs';
import path from 'node:path';
import { motorYukle } from '../testler/yardimci.mjs';

const klasor = process.argv[2];
if (!klasor) { console.error('Kullanım: node araclar/yerel-sina.mjs <klasör>'); process.exit(2); }
const { motor } = motorYukle();
let hatali = 0;
for (const ad of fs.readdirSync(klasor).filter(f => /\.udf$/i.test(f)).sort()) {
  const bayt = fs.readFileSync(path.join(klasor, ad));
  try {
    const model = await motor.oku(new Uint8Array(bayt));
    const g = motor.ciz(model);
    await g.bitti;
    const k = g.kok;
    const ozet = {
      bolum: model.bolumler.length, ...model.sayac, liste: k.querySelectorAll('.udf-isaret').length,
      sekme: k.querySelectorAll('.udf-sekme').length, not: model.notlar.length, notlu: k.querySelectorAll('.udf-notlu').length,
      ust: model.ust ? `${model.ust.bas}-${model.ust.bitis ?? ''}` : '-', alt: model.alt ? (model.alt.sayfaNo ? model.alt.sayfaNo.hiza + (model.alt.sayfaNo.toplam ? '/N' : '') : 'var') : '-',
      imza: model.imza ? model.imza.durum : '-', dk: model.ozellikler && model.ozellikler.dogrulamaKodu ? 'var' : '-',
      ham: model.ham ? 'xml' : 'zip', surum: model.bicimSurumu, kesildi: model.kesildi || '-', ms: model.sure,
      metin: k.textContent.length
    };
    console.log(ad, JSON.stringify(ozet));
    g.birak();
  } catch (e) {
    hatali++;
    console.log(ad, 'HATA', e.kod || e.name, e.ayrinti || e.message);
  }
}
process.exit(hatali ? 1 : 0);
