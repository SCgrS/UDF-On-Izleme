// Yapay UDF örnekleri üretir (kişisel veri içermez). Zip, UYAP'ın Java ZipOutputStream çıktısını taklit eder:
// bayrak 0x0808, veri tanımlayıcısı, yerel başlıkta boyut ve CRC 0.
//   node araclar/ornek-uret.mjs [klasör]   (varsayılan testler/ornekler)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RESIM_KARAKTERI = String.fromCharCode(0xb8);   // UDE'nin resim yer tutucusu
const SIFIR_GENISLIK = String.fromCharCode(0x200b);

// ---------------------------------------------------------------- zip
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = b => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };

export function udfZip(girdiler, { saklanmis = false } = {}) {
  const parcalar = [], merkez = [];
  let ofset = 0;
  for (const [ad, veri] of girdiler) {
    const ham = Buffer.isBuffer(veri) ? veri : Buffer.from(veri, 'utf8');
    const sik = saklanmis ? ham : zlib.deflateRawSync(ham);
    const adB = Buffer.from(ad, 'utf8');
    const yontem = saklanmis ? 0 : 8, bayrak = saklanmis ? 0x0800 : 0x0808;
    const crc = crc32(ham);
    const yerel = Buffer.alloc(30);
    yerel.writeUInt32LE(0x04034b50, 0); yerel.writeUInt16LE(20, 4); yerel.writeUInt16LE(bayrak, 6); yerel.writeUInt16LE(yontem, 8);
    if (saklanmis) { yerel.writeUInt32LE(crc, 14); yerel.writeUInt32LE(sik.length, 18); yerel.writeUInt32LE(ham.length, 22); }
    yerel.writeUInt16LE(adB.length, 26);
    const tanim = saklanmis ? Buffer.alloc(0) : Buffer.alloc(16);
    if (!saklanmis) { tanim.writeUInt32LE(0x08074b50, 0); tanim.writeUInt32LE(crc, 4); tanim.writeUInt32LE(sik.length, 8); tanim.writeUInt32LE(ham.length, 12); }
    parcalar.push(yerel, adB, sik, tanim);
    const m = Buffer.alloc(46);
    m.writeUInt32LE(0x02014b50, 0); m.writeUInt16LE(20, 4); m.writeUInt16LE(20, 6); m.writeUInt16LE(bayrak, 8); m.writeUInt16LE(yontem, 10);
    m.writeUInt32LE(crc, 16); m.writeUInt32LE(sik.length, 20); m.writeUInt32LE(ham.length, 24); m.writeUInt16LE(adB.length, 28); m.writeUInt32LE(ofset, 42);
    merkez.push(m, adB);
    ofset += 30 + adB.length + sik.length + tanim.length;
  }
  const md = Buffer.concat(merkez);
  const son = Buffer.alloc(22);
  son.writeUInt32LE(0x06054b50, 0); son.writeUInt16LE(girdiler.length, 8); son.writeUInt16LE(girdiler.length, 10);
  son.writeUInt32LE(md.length, 12); son.writeUInt32LE(ofset, 16);
  return Buffer.concat([...parcalar, md, son]);
}

// ---------------------------------------------------------------- belge kurucu
const kac = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const oz = o => Object.entries(o || {}).map(([k, v]) => ` ${k}="${kac(v)}"`).join('');
export const SEKME = { sekme: true };
export const resim = (veri, o = {}) => ({ resim: veri, o });

export class Belge {
  constructor() { this.havuz = ''; }
  // Parça: ['metin', {öznitelik}] | SEKME | resim(base64). Paragraf sonu "\n" ayrı content'tedir (UYAP gibi).
  paragraf(p = {}, parcalar = [], ad = 'paragraph') {
    let ic = '';
    for (const x of parcalar) {
      const a = this.havuz.length;
      if (x === SEKME) { this.havuz += '\t'; ic += `<tab${oz({ resolver: 'hvl-default', startOffset: a, length: 1 })}/>`; continue; }
      if (x.resim) { this.havuz += RESIM_KARAKTERI; ic += `<image${oz({ ...x.o, imageData: x.resim, startOffset: a, length: 1 })}/>`; continue; }
      const [metin, o = {}, etiket = 'content'] = x;
      this.havuz += metin;
      ic += `<${etiket}${oz({ resolver: 'hvl-default', ...o, startOffset: a, length: metin.length })}/>`;
    }
    ic += `<content${oz({ resolver: 'hvl-default', startOffset: this.havuz.length, length: 1 })}/>`;
    this.havuz += '\n';
    return `<${ad}${oz({ resolver: 'hvl-default', ...p })}>${ic}</${ad}>`;
  }
  tablo(t, satirlar) {
    return `<table${oz(t)}>${satirlar.map(r => `<row${oz(r.o)}>${r.hucreler.map(h => `<cell${oz(h.o)}>${h.ic.join('')}</cell>`).join('')}</row>`).join('')}</table>`;
  }
  xml({ ogeler, sayfa = {}, surum = '1.8', stiller = '' }) {
    const pf = { mediaSizeName: 1, leftMargin: 70.875, rightMargin: 70.875, topMargin: 56.69291305541992, bottomMargin: 56.69291305541992, paperOrientation: 1, headerFOffset: 20.0, footerFOffset: 20.0, ...sayfa };
    return `<?xml version="1.0" encoding="UTF-8" ?> \n\n<template format_id="${surum}" >\n<content><![CDATA[${this.havuz}]]></content><properties><pageFormat${oz(pf)} /></properties>\n` +
      `<elements resolver="hvl-default" >\n${ogeler.join('\n')}\n</elements>\n<styles><style name="default" description="Geçerli" family="Dialog" size="12" bold="false" italic="false" foreground="-13421773" />` +
      `<style name="hvl-default" family="Times New Roman" size="12" description="Gövde" />${stiller}</styles>\n</template>\n`;
  }
}

// Ayrık CMS imzasını taklit eden en küçük DER: imzalı özniteliklerde messageDigest (OID 1.2.840.113549.1.9.4).
// bozuk: Özet içerikle tutmaz. okunamaz: Özniteliğin değer kümesinin etiketi SET (0x31) değil, özet bulunamaz.
export function sahteImza(icerik, { bozuk = false, okunamaz = false } = {}) {
  const ozet = crypto.createHash('sha256').update(icerik).digest();
  if (bozuk) ozet[0] ^= 0xff;
  const oid = Buffer.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x04]);
  const dize = Buffer.concat([Buffer.from([0x04, ozet.length]), ozet]);
  const kume = Buffer.concat([Buffer.from([okunamaz ? 0x32 : 0x31, dize.length]), dize]);
  const oznitelik = Buffer.concat([oid, kume]);
  return Buffer.concat([Buffer.from([0x30, oznitelik.length]), oznitelik]);
}

// 2×2 kırmızı-siyah PNG (sağlamaları doğru; Chrome çözebilmeli)
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADklEQVR4nGP4zwADQBYAD/4B//Ga+iUAAAAASUVORK5CYII=';

// PNG kabı: Ham satırlardan (her satırın başında süzgeç baytı) RGB PNG (sağlamaları doğru).
function pngKur(g, y, ham) {
  const parca = (tur, veri) => {
    const b = Buffer.alloc(12 + veri.length);
    b.writeUInt32BE(veri.length, 0);
    b.write(tur, 4, 'latin1');
    veri.copy(b, 8);
    b.writeUInt32BE(crc32(Buffer.concat([Buffer.from(tur, 'latin1'), veri])), 8 + veri.length);
    return b;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(g, 0); ihdr.writeUInt32BE(y, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), parca('IHDR', ihdr), parca('IDAT', zlib.deflateSync(ham)), parca('IEND', Buffer.alloc(0))]);
}

// g×y renk geçişli RGB PNG (sağlamaları doğru).
export function pngUret(g, y) {
  const ham = Buffer.alloc(y * (1 + g * 3));
  for (let j = 0; j < y; j++) for (let i = 0; i < g; i++) {
    const o = j * (1 + g * 3) + 1 + i * 3;
    ham[o] = (i * 255 / g) | 0; ham[o + 1] = (j * 255 / y) | 0; ham[o + 2] = ((i ^ j) * 7) & 255;
  }
  return pngKur(g, y, ham);
}

// Taranmış büro antedine benzeyen g×y RGB PNG: Beyaz zemin, üstte renkli şerit, solda daire (simge yeri), sağda yazı
// satırlarını andıran koyu çizgiler, altta ince çizgi. Zeminin bir kısmına tarayıcı gürültüsü eklenir (gurultu: Bir
// pikselin gürültülü olma olasılığı, 0–1): Resim gerçek antetler gibi iyi sıkışmaz, boyu gürültüyle ayarlanır.
export function antetPng(g, y, { gurultu = 0.25 } = {}) {
  let x = 0x2545f491;
  const rastgele = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
  const satirlar = [];
  for (let k = 0; k < 5; k++) satirlar.push({ ust: Math.round(y * (0.3 + k * 0.11)), bas: Math.round(g * 0.32), son: Math.round(g * (0.92 - 0.06 * k)) });
  const ham = Buffer.alloc(y * (1 + g * 3));
  for (let j = 0; j < y; j++) for (let i = 0; i < g; i++) {
    let r = 255, gr = 255, b = 255;
    if (j < y * 0.12) { r = 22; gr = 60 + Math.round(40 * i / g); b = 120; }
    else if (Math.hypot(i - g * 0.12, j - y * 0.56) < y * 0.3) { r = 196; gr = 33; b = 39; }
    else if (j > y * 0.95) { r = gr = b = 90; }
    else for (const s of satirlar) if (j >= s.ust && j < s.ust + y * 0.05 && i >= s.bas && i < s.son && (i >> 4) % 5) { r = gr = b = 40; break; }
    if (rastgele() < gurultu) { const d = Math.round((rastgele() - 0.5) * 48); r += d; gr += d; b += d; }
    const o = j * (1 + g * 3) + 1 + i * 3;
    ham[o] = Math.max(0, Math.min(255, r)); ham[o + 1] = Math.max(0, Math.min(255, gr)); ham[o + 2] = Math.max(0, Math.min(255, b));
  }
  return pngKur(g, y, ham);
}

// Hız ölçümü için ağır ama gerçekçi yapay belge: Üst bilgide sayfa eninde resimli antet (büro anteti gibi, her bölümde
// yinelenir), sayfa numaralı alt bilgi, açık sayfa sonlarıyla ayrılmış birkaç sayfalık iki yana yaslı metin. Resim
// 1654 piksel enindedir (A4, 200 dpi) ve gürültüyle 150-300 KB'a getirilir. Kişisel veri yoktur.
export function antetliBelge({ sayfa = 4, paragraf = 6, gurultu = 0.25 } = {}) {
  const b = new Belge();
  const antet = antetPng(1654, 290, { gurultu });
  const cumleler = [
    'Dosyaya sunulan belgeler birlikte incelendiğinde taraflar arasındaki sözleşmenin süresinden önce sona erdirildiği anlaşılmaktadır.',
    'Bu nedenle uğranılan zararın, sözleşmede kararlaştırılan esaslara göre hesaplanarak tarafımıza ödenmesine karar verilmesi gerekmektedir.',
    'Karşı tarafın savunmasında ileri sürdüğü hususlar dosya kapsamıyla örtüşmemekte, dayanak gösterilen yazışmalar da bu iddiayı desteklememektedir.',
    'Bilirkişi raporunda yapılan hesaplama, sözleşmenin ilgili maddesi ve yerleşik uygulama dikkate alınmadan düzenlenmiştir.',
    'Açıklanan nedenlerle itirazlarımızın kabulü ile dosyanın yeniden bilirkişiye tevdiine karar verilmesini saygıyla talep ederiz.'
  ];
  const metin = k => Array.from({ length: 4 }, (_, i) => cumleler[(k + i) % cumleler.length]).join(' ');
  const ogeler = [`<header startPage="1">${b.paragraf({ Alignment: 1 }, [resim(antet.toString('base64'), { width: 453, height: 79.4 })])}</header>`];
  for (let s = 0; s < sayfa; s++) {
    if (s) ogeler.push(`<page-break>${b.paragraf({}, [[SIFIR_GENISLIK]])}</page-break>`);
    ogeler.push(b.paragraf({ Alignment: 1, SpaceAbove: 12, SpaceBelow: 12 }, [[`DENEME BELGESİ ${s + 1}. BÖLÜM`, { bold: true }]]));
    for (let p = 0; p < paragraf; p++) ogeler.push(b.paragraf({ Alignment: 3, FirstLineIndent: 35.4375, SpaceBelow: 6 }, [[metin(s + p)]]));
  }
  ogeler.push(`<footer pageNumber-spec="BSP32_2120" pageNumber-color="-16777216" pageNumber-fontFace="Times New Roman" pageNumber-fontSize="11" pageNumber-fontBold="false" pageNumber-fontItalic="false" pageNumber-foreStr="" pageNumber-seperator="/">${b.paragraf({}, [])}</footer>`);
  return { udf: udfZip([['content.xml', Buffer.from(b.xml({ ogeler }), 'utf8')]]), resim: antet.length };
}

export function ornekler() {
  const sonuc = {};

  // 1. Dilekçe: başlık, sekmeli etiketler, asılı girinti, numaralı ve madde işaretli liste, renk, vurgu, resim.
  {
    const b = new Belge();
    const ogeler = [];
    ogeler.push(`<header startPage="2" foreground="-8355712" background="-1">${b.paragraf({ TabSet: '309.0:0:0' }, [['DENEME MAHKEMESİ', { bold: true, size: 11 }], SEKME, ['Esas No: 2026/1', { size: 11 }]])}</header>`);
    ogeler.push(b.paragraf({ Alignment: 1 }, [['GÖRSEL: '], resim(PNG, { width: 40, height: 20 })]));
    ogeler.push(b.paragraf({ Alignment: 1 }, [['DENEME İŞ MAHKEMESİNE', { bold: true }]]));
    ogeler.push(b.paragraf({ Alignment: 3, TabSet: '91.0:0:0', Hanging: '111.42857' }, [['DAVACI', { bold: true, underline: true }], SEKME, [': Deneme Kişi, Örnek Mahallesi, Uzun Bir Sokak Adı No: 1 Daire: 2 Örnekköy/DENEME ve devam eden uzun bir adres satırı']]));
    ogeler.push(b.paragraf({ Alignment: 0, TabSet: '67.0:2:0' }, [SEKME, ['ORTALI', { italic: true }]]));
    ogeler.push(b.paragraf({ Alignment: 0, TabSet: '300.0:1:1' }, [['Sağa durak'], SEKME, ['1.234,56']]));
    ogeler.push(b.paragraf({ Alignment: 0 }, [['  '], SEKME, ['         Varsayılan durak']]));
    ogeler.push(b.paragraf({ Alignment: 3, FirstLineIndent: 35.4375, LineSpacing: 0.5, SpaceAbove: 6, SpaceBelow: 6 }, [['Kırmızı', { foreground: -65536 }], [' ve '], ['vurgulu', { background: -256 }], [' metin '], ['üstü çizili', { strikethrough: true }], ['.']]));
    for (let i = 0; i < 3; i++) ogeler.push(b.paragraf({ Alignment: 3, LeftIndent: 25, Numbered: 'true', NumberType: 'NUMBER_TYPE_NUMBER_TRE', ListLevel: 1, ListId: 7 }, [[`Numaralı kalem ${i + 1}`]]));
    ogeler.push(b.paragraf({ Alignment: 3, LeftIndent: 50, Numbered: 'true', NumberType: 'NUMBER_TYPE_NUMBER_TRE', ListLevel: 2, ListId: 7 }, [['Alt düzey kalem']]));
    for (const t of ['NUMBER_TYPE_CHAR_SMALL_PARANTHESE', 'NUMBER_TYPE_ROMAN_BIG_DOT', 'NUMBER_TYPE_CHAR_BIG_D_PARANTHESE']) ogeler.push(b.paragraf({ LeftIndent: 25, Numbered: 'true', NumberType: t, ListLevel: 1, ListId: t }, [[t]]));
    ogeler.push(b.paragraf({ LeftIndent: 25, Bulleted: 'true', BulletType: 'BULLET_TYPE_ELLIPSE', ListLevel: 1, ListId: 9 }, [['Madde işaretli']]));
    ogeler.push(b.paragraf({}, [[SIFIR_GENISLIK]]));
    ogeler.push(b.tablo({ tableName: 'Sabit', columnCount: 2, columnSpans: '170,100', border: 'borderCell', borderWidth: '1.0', borderColor: -16777216 }, [
      { o: { rowType: 'dataRow' }, hucreler: [{ ic: [b.paragraf({ LeftIndent: 3, RightIndent: 1 }, [['Hücre 1']])] }, { ic: [b.paragraf({ LeftIndent: 3, Alignment: 2 }, [['Hücre 2']])] }] },
      { o: { columnSpans: '270' }, hucreler: [{ ic: [b.paragraf({ LeftIndent: 3 }, [['Birleşik satır']])] }] }
    ]));
    ogeler.push(`<page-break>${b.paragraf({}, [[SIFIR_GENISLIK]])}</page-break>`);
    ogeler.push(b.paragraf({}, [['İkinci sayfa metni']]));
    ogeler.push(`<footer pageNumber-spec="BSP32_2120" pageNumber-color="-16777216" pageNumber-fontFace="Times New Roman" pageNumber-fontSize="11" pageNumber-fontBold="false" pageNumber-fontItalic="false" pageNumber-foreStr="" pageNumber-seperator="/">${b.paragraf({}, [])}</footer>`);
    const icerik = Buffer.from(b.xml({ ogeler }), 'utf8');
    const notXml = `<?xml version="1.0" encoding="UTF-8" ?> \n\n<template format_id="1.8" >\n<content><![CDATA[${'Bu kısım önemli'}\n]]></content>\n<elements resolver="hvl-default" ><comment type="1" strtOffs="${b.havuz.indexOf('vurgulu')}" endOffs="${b.havuz.indexOf('vurgulu') + 7}" indx="0" time="1749033668937" usr="Deneme Büro"><paragraph><content startOffset="0" length="16"/></paragraph></comment></elements>\n</template>\n`;
    const ozellik = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<!DOCTYPE properties SYSTEM "http://java.sun.com/dtd/properties.dtd">\n<properties>\n<entry key="uyapdogrulamakodu">AbCd+123</entry>\n<entry key="uyapsicil">1234567</entry>\n</properties>\n';
    sonuc['dilekce.udf'] = udfZip([['documentproperties.xml', ozellik], ['content.xml', icerik], ['sign.sgn', sahteImza(icerik)], ['comments.xml', notXml]]);
    sonuc['imza-bozuk.udf'] = udfZip([['content.xml', icerik], ['sign.sgn', sahteImza(icerik, { bozuk: true })]]);
    // E-imza dosyası var ama içindeki özet okunamıyor: Belge içerikle karşılaştırılamaz (imza durumu 'bilinmiyor').
    sonuc['imza-okunamayan.udf'] = udfZip([['content.xml', icerik], ['sign.sgn', sahteImza(icerik, { okunamaz: true })]]);
    sonuc['notlu-imzasiz.udf'] = udfZip([['content.xml', icerik], ['comments.xml', notXml]]);
    sonuc['saklanmis.udf'] = udfZip([['content.xml', icerik]], { saklanmis: true });
    sonuc['ham-xml.udf'] = icerik;
  }

  // 1b. Bozuk resim: başlığı sağlam, verisi yarıda kesik PNG (<img> bunu hatasız, boş gösterir; motor doğrulayıp uyarı
  // yazısı koyar) ve yanında sağlam bir resim.
  {
    const b = new Belge();
    const saglam = pngUret(120, 80), kesik = pngUret(200, 200);
    const ogeler = [
      b.paragraf({}, [['Sağlam: '], resim(saglam.toString('base64'), { width: 60, height: 40 })]),
      b.paragraf({}, [['Bozuk: '], resim(kesik.subarray(0, Math.floor(kesik.length * 0.6)).toString('base64'), { width: 80, height: 80 })])
    ];
    sonuc['resim-bozuk.udf'] = udfZip([['content.xml', Buffer.from(b.xml({ ogeler }), 'utf8')]]);
  }

  // 2. Yatay A5, format 1.7, varlıklı metin (CDATA'sız), boş uzunluklu parça.
  {
    const b = new Belge();
    const ogeler = [b.paragraf({}, [['Ali & Veli <ortak>'], ['', {}]]), b.paragraf({ Alignment: '1.0' }, [['Ortalanmış']])];
    const xml = b.xml({ ogeler, sayfa: { mediaSizeName: 2, paperOrientation: 0 }, surum: '1.7' })
      .replace(/<content><!\[CDATA\[([\s\S]*?)\]\]><\/content>/, (m, c) => `<content>${kac(c)}</content>`);
    sonuc['yatay-a5.udf'] = udfZip([['content.xml', xml]]);
  }

  // 3. Zaman damgalı imza: imzasız öznitelikte içerikle tutmayan ikinci bir messageDigest (TSTInfo özeti) vardır.
  {
    const b = new Belge();
    const icerik = Buffer.from(b.xml({ ogeler: [b.paragraf({}, [['Zaman damgalı']])] }), 'utf8');
    const zd = sahteImza(Buffer.from('zaman damgası'));
    sonuc['imza-zaman-damgali.udf'] = udfZip([['content.xml', icerik], ['sign.sgn', Buffer.concat([sahteImza(icerik), zd])]]);
  }

  // 4. Hatalı ve kötü niyetli dosyalar.
  sonuc['dtd-yorumlu.udf'] = udfZip([['content.xml', '<?xml version="1.0"?><!-- <a --><!DOCTYPE template [<!ENTITY a "VARLIK">]><template><content>&a;</content><elements/></template>']]);
  sonuc['zip-degil.udf'] = Buffer.from('Bu bir UDF değil.');
  sonuc['icerik-yok.udf'] = udfZip([['baska.xml', '<a/>']]);
  sonuc['iki-icerik.udf'] = udfZip([['content.xml', '<template/>'], ['./content.xml', '<template/>']]);
  sonuc['dtd.udf'] = udfZip([['content.xml', '<?xml version="1.0"?><!DOCTYPE t [<!ENTITY a "aaaa">]><template><content>&a;</content><elements/></template>']]);
  {
    const b = new Belge();
    const ogeler = [b.paragraf({ family: 'x";}body{background:red' }, [['<script>alert(1)</script>', { family: 'Arial"><img src=x onerror=alert(1)>' }]])];
    sonuc['kotu-niyet.udf'] = udfZip([['content.xml', b.xml({ ogeler })]]);
  }
  return sonuc;
}

if (process.argv[1] && process.argv[1].endsWith('ornek-uret.mjs')) {
  const hedef = path.resolve(process.argv[2] || path.join(KOK, 'testler', 'ornekler'));
  fs.mkdirSync(hedef, { recursive: true });
  for (const [ad, veri] of Object.entries(ornekler())) {
    fs.writeFileSync(path.join(hedef, ad), veri);
    console.log(path.relative(KOK, path.join(hedef, ad)), veri.length);
  }
}
