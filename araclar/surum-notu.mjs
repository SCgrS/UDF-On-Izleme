// GitHub sürümünün notunu yazar (yayim.yml): DEGISIKLIKLER.md'deki sürüm bölümü ve ardından sürüm zip'iyle kurulum ve
// güncelleme adımları. Not kendi başına yeterlidir, README'ye gönderme yapmaz. node araclar/surum-notu.mjs 0.0.1
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAKET_ADI } from './paketle.mjs';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Sürüm zip'inin kökünde manifest.json durur (üst klasör yok): Zip'in çıkarıldığı klasör Chrome'a yüklenen klasördür.
// Güncellemede yeni zip aynı klasörün üzerine çıkarılır, kartta ↻ eklentiyi o klasörden yeniden yükler.
export const KURULUM = [
  '**Kurulum:**',
  '',
  `1. \`${PAKET_ADI}\` dosyasını indirin, sağ tıklayıp **Tümünü ayıkla** ile kalıcı bir klasöre çıkarın. Chrome eklentiyi bu klasörden çalıştırır. Klasör silinirse eklenti durur.`,
  "2. Chrome'da adres çubuğuna `chrome://extensions` yazıp Enter'a basın ve sağ üstteki **Geliştirici modu**'nu açın.",
  "3. **Paketlenmemiş öğe yükle**'ye basıp zip'i çıkardığınız klasörü seçin. Bu, içinde `manifest.json` olan klasördür.",
  '4. Açık Drive ve Gmail sekmelerini yenileyin (F5).',
  '',
  `**Güncelleme:** Yeni sürümün \`${PAKET_ADI}\` dosyasını Chrome'a yüklediğiniz klasörün (içinde \`manifest.json\` olan klasör) üzerine çıkarın. Windows sorarsa dosyaların üzerine yazılmasını onaylayın. Sonra \`chrome://extensions\` sayfasında eklentinin kartındaki **yenile** (↻) düğmesine basın ve açık Drive ve Gmail sekmelerini yenileyin (F5).`
].join('\n');

// degisiklikler: DEGISIKLIKLER.md'nin metni. Sürümün bölümü yoksa null.
export function surumNotu(degisiklikler, surum) {
  const bolum = degisiklikler.split(/^## /m).slice(1).find(b => b.startsWith(surum + ' ') || b.startsWith(surum + '\n'));
  if (!bolum) return null;
  return `${bolum.split('\n').slice(1).join('\n').trim()}\n\n${KURULUM}\n`;
}

if (process.argv[1] && process.argv[1].endsWith('surum-notu.mjs')) {
  const surum = process.argv[2];
  if (!surum) { console.error('Kullanım: node araclar/surum-notu.mjs <sürüm>'); process.exit(2); }
  const not = surumNotu(fs.readFileSync(path.join(KOK, 'DEGISIKLIKLER.md'), 'utf8'), surum);
  if (!not) { console.error(`DEGISIKLIKLER.md'de ${surum} bölümü yok`); process.exit(1); }
  process.stdout.write(not);
}
