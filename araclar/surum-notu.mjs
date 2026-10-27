// DEGISIKLIKLER.md'den bir sürümün bölümünü yazar: node araclar/surum-notu.mjs 0.0.1
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const surum = process.argv[2];
const metin = fs.readFileSync(path.join(KOK, 'DEGISIKLIKLER.md'), 'utf8');
const bolumler = metin.split(/^## /m).slice(1);
const bolum = bolumler.find(b => b.startsWith(surum + ' ') || b.startsWith(surum + '\n'));
if (!bolum) { console.error(`DEGISIKLIKLER.md'de ${surum} bölümü yok`); process.exit(1); }
const govde = bolum.split('\n').slice(1).join('\n').trim();
process.stdout.write(`${govde}\n\n**Kurulum ve güncelleme:** README'deki adımlar. İndirilecek dosya: \`UDF-On-Izleme.zip\`.\n`);
