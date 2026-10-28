// Bir klasördeki .udf dosyalarını (gerçek belgeler de olabilir) motordan geçirir ve her dosya için tek satır yazar: Sıra
// numarası, dosya adının SHA-256 özetinin ilk 8 hanesi ve yapısal özet (sayılar, imza durumu, biçim sürümü, süre). Dosya
// adı ve belge metni yazılmaz (UYAP dosya adları taraf adı ve esas numarası taşıyabilir). Hata satırında motorun hata
// kodu ve teknik ayrıntısı, okunamayan dosyada yalnız okuma hatasının kodu yazılır. Bir satırın hangi dosyaya ait olduğu
// adın özeti yeniden hesaplanarak bulunur.
// Kullanım: node araclar/yerel-sina.mjs <klasör>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { motorYukle } from '../testler/yardimci.mjs';

const adOzeti = ad => crypto.createHash('sha256').update(ad, 'utf8').digest('hex').slice(0, 8);

const klasor = process.argv[2];
if (!klasor) { console.error('Kullanım: node araclar/yerel-sina.mjs <klasör>'); process.exit(2); }
const { motor } = motorYukle();
let hatali = 0, sira = 0;
for (const ad of fs.readdirSync(klasor).filter(f => /\.udf$/i.test(f)).sort()) {
  const bas = `${++sira} ${adOzeti(ad)}`;
  let bayt;
  try {
    bayt = fs.readFileSync(path.join(klasor, ad));
  } catch (e) {
    // Okunamayan dosyada (ör. başka bir programın kilitlediği) Node'un iletisi dosyanın tam yolunu taşır: Yalnız hata kodu yazılır,
    // öbür dosyalara bakılmaya devam edilir.
    hatali++;
    console.log(bas, 'HATA okuma', e.code || e.name);
    continue;
  }
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
    console.log(bas, JSON.stringify(ozet));
    g.birak();
  } catch (e) {
    hatali++;
    console.log(bas, 'HATA', e.kod || e.name, e.ayrinti || e.message);
  }
}
process.exit(hatali ? 1 : 0);
