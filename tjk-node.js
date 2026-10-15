// TJK sonuç ayrıştırıcısının Node (sunucu) sürümü.
// Gövde, uygulamadaki js/01-core-tjk.js içindeki "const TJK = (() => {...})();" bloğunun AYNISIDIR
// (tarayıcı koduna dokunulmadı). Orada TJK ayrıştırması değişirse bu dosyadaki bloğu da yenile.
process.env.TZ = 'Europe/Istanbul';
const { JSDOM } = require('jsdom');
const _dom = new JSDOM('');
global.DOMParser = _dom.window.DOMParser;
global.Node = _dom.window.Node;
global.window = global.window || {};
window.__tjkFresh = true;                 // önbelleği atla: her seferinde taze sayfa
// Uygulamaya ait yardımcılar (sonuç çekmek için gerekmez; boş bırakıldı)
const CITIES = [];
const raceList = () => [];
const vidSet = () => {};

const TJK = (() => {
  const BACKEND = 'https://tiny-sunset-7f18.bilyoncu001.workers.dev';
  const bekle = ms => new Promise(r => setTimeout(r, ms));

  async function fetchWithTimeout(url, ms = 12000, retryCount = 2) {
    let sonHata = null;
    const endpoint = BACKEND.replace(/\/$/, '') + '?url=' + encodeURIComponent(url) + (window.__tjkFresh ? '&_cb=' + Date.now() : '');
    for (let deneme = 0; deneme <= retryCount; deneme++) {
      try {
        const fetchPromise = fetch(endpoint, { method: 'GET', cache: 'no-store', mode: 'cors', credentials: 'omit' });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Backend isteği zaman aşımına uğradı')), ms));
        const res = await Promise.race([fetchPromise, timeoutPromise]);
        if (res.ok) return res;
        if (res.status >= 500 && deneme < retryCount) { await bekle(1000 + deneme * 1500); continue; }
        sonHata = new Error('Backend HTTP ' + res.status);
      } catch (e) {
        sonHata = e;
        if (deneme < retryCount) await bekle(1000 + deneme * 1500);
      }
    }
    throw sonHata || new Error('TJK backend bağlantısı kurulamadı');
  }

const YERLI_HIPODROM_ILK_KELIME = new Set([
  'ISTANBUL', 'ANKARA', 'IZMIR', 'BURSA', 'ADANA', 'SANLIURFA', 'ELAZIG',
  'DIYARBAKIR', 'KOCAELI', 'IZMIT', 'ANTALYA', 'KARMA'
]);

function isoyuTjkTarihineCevir(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function bugunIso() {
  const n = new Date();
  const yy = n.getFullYear();
  const mm = String(n.getMonth()+1).padStart(2,'0');
  const dd = String(n.getDate()).padStart(2,'0');
  return `${yy}-${mm}-${dd}`;
}

function eraHesapla(iso) {
  // TJK, dünkü sonuçlar için "yesterday" kullanıyor. "past" bazı eski
  // arşivlerde çalışsa da özellikle bir önceki günün Bursa/şehir sonuçlarını
  // boş döndürebiliyor; sonuç fonksiyonu ayrıca tüm alternatifleri dener.
  if (iso < bugunIso()) return 'yesterday';
  if (iso === bugunIso()) return 'today';
  return 'today'; // gelecek tarihler için TJK'da ayrı bir era yok, "today" ile denenir
}

function sayfadanTarihiBul(dom, html) {
  const title = dom.querySelector('title');
  if (title) {
    const m = title.textContent.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (m) return m[1];
  }
  const m2 = html.match(/(\d{2}\/\d{2}\/\d{4})/);
  return m2 ? m2[1] : null;
}

function turkceNormalizeAnahtar(s) {
  return String(s || '').toUpperCase()
    .replace(/İ/g, 'I').replace(/Ğ/g, 'G').replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
    .replace(/[^A-Z0-9]/g, '');
}

function sehirYurtDisiMi(adi, linkMetni) {
  if (/\(YD\s*\d+\)/i.test(adi) || /\bYD\s*\d+\b/i.test(linkMetni || '')) return true;
  const ilkKelime = turkceNormalizeAnahtar((adi || '').trim().split(/\s+/)[0] || '');
  if (!ilkKelime) return false;
  return !YERLI_HIPODROM_ILK_KELIME.has(ilkKelime);
}

function parseKosular(html) {
  const dom = new DOMParser().parseFromString(html, 'text/html');
  // "Koşu" başlıklarını taşıyan elementleri metne göre bul (class'a bağımlı değil)
  const tumElemanlar = Array.from(dom.body.querySelectorAll('*'));
  const kosuBaslangic = tumElemanlar.filter(el => {
    if (el.children.length > 2) return false; // çok iç içe geniş kapsayıcıları ele
    const t = (el.textContent || '').trim();
    return /^\d+\.\s*Koşu\s+\d{1,2}[:.]\d{2}/.test(t) && t.length < 60;
  });

  // Her aday başlık için tablo + meta bul (aynı koşu no'su birden fazla yerde geçebilir —
  // üst hızlı-gezinme sekmesi + asıl bölüm başlığı. En iyi (atı bulunan) adayı seçeceğiz.
  const adaylar = {}; // no -> array of {saat, meta, atlar, tanilog}
  kosuBaslangic.forEach((baslikEl) => {
    const baslikText = baslikEl.textContent.trim();
    const mNo = baslikText.match(/^(\d+)\.\s*Koşu\s+(\d{1,2}[:.]\d{2})/);
    if (!mNo) return;

    let node = baslikEl;
    let tablo = null;
    let metaMetin = '';
    let adim = 0;
    while (node && adim < 400) {
      node = node.nextElementSibling || (node.parentElement ? node.parentElement.nextElementSibling : null);
      if (!node) break;
      adim++;
      if (node.tagName === 'TABLE') { tablo = node; break; }
      const iciTablo = node.querySelector && node.querySelector('table');
      if (iciTablo) { tablo = iciTablo; metaMetin += ' ' + node.textContent; break; }
      metaMetin += ' ' + (node.textContent || '');
      if (/^\d+\.\s*Koşu\s+\d{1,2}[:.]\d{2}/.test((node.textContent||'').trim())) break;
    }
    // YEDEK TABLO ARAMA: sibling zinciriyle 400 adımda tablo bulunamadıysa, belgedeki TÜM
    // tabloları tarayıp bu başlıktan SONRA ve bir sonraki koşu başlığından ÖNCE gelen ilk
    // tabloyu seçiyoruz (DOM konumuna göre, sibling zincirinden bağımsız). Bazı sayfa
    // düzenlerinde tablo, doğrudan sibling zinciriyle ulaşılamayan daha derin/farklı bir
    // kapsayıcıda olabiliyor; bu daha güçlü bir yedek.
    if (!tablo) {
      const sonrakiBaslik = kosuBaslangic[kosuBaslangic.indexOf(baslikEl) + 1] || null;
      for (const t of dom.querySelectorAll('table')) {
        const konumBaslik = baslikEl.compareDocumentPosition(t);
        if (!(konumBaslik & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
        if (sonrakiBaslik) {
          const konumSinir = sonrakiBaslik.compareDocumentPosition(t);
          if (!(konumSinir & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
        }
        tablo = t;
        break;
      }
    }

    // MESAFE / PİST İÇİN ÇOK KAYNAKLI TOPLAMA:
    // TJK aynı bilgiyi her program şablonunda aynı DOM seviyesinde vermiyor.
    // Bu yüzden tek bir metin parçasına güvenmek yerine yakın DOM bölgelerinden
    // adayları topluyor, mesafe ve pisti BAĞIMSIZ olarak birleştiriyoruz.
    const metaAdaylari = [];
    const ekleMeta = (kaynak) => {
      if (!kaynak) return;
      const m = parseKosuMeta(kaynak);
      if (m.mesafeSayi || m.pist || m.enIyiDereceRekoru) metaAdaylari.push(m);
    };
    ekleMeta(metaMetin);
    ekleMeta(baslikText);
    if (baslikEl.parentElement) ekleMeta(baslikEl.parentElement.textContent || '');
    if (baslikEl.parentElement?.parentElement) ekleMeta(baslikEl.parentElement.parentElement.textContent || '');

    // Başlığın hemen öncesi ve sonrası: rozetler bazen ayrı sibling olarak duruyor.
    let prev = baslikEl.previousElementSibling;
    for (let i=0; i<6 && prev; i++, prev=prev.previousElementSibling) ekleMeta(prev.textContent || '');
    let next = baslikEl.nextElementSibling;
    for (let i=0; i<12 && next; i++, next=next.nextElementSibling) {
      ekleMeta(next.textContent || '');
      if (/^\d+\.\s*Koşu\s+\d{1,2}[:.]\d{2}/.test((next.textContent||'').trim())) break;
    }

    // Belge metninde yalnızca BU koşunun başlığından sonraki kontrollü pencere.
    // Pencereyi kısa tutuyoruz; sonraki koşunun mesafesini yanlışlıkla alma riski yok.
    const tumMetin = dom.body.textContent || '';
    const konum = tumMetin.indexOf(baslikText);
    if (konum >= 0) ekleMeta(tumMetin.substring(konum, konum + 420));

    // Adaylar arasında önce hem mesafe+pist taşıyanı, sonra tekil alanları birleştir.
    let meta = {mesafe:null, mesafeSayi:null, pist:null, enIyiDereceRekoru:null, sinifMetni:''};
    for (const m of metaAdaylari) {
      if (!meta.mesafeSayi && m.mesafeSayi) { meta.mesafeSayi=m.mesafeSayi; meta.mesafe=m.mesafe; }
      if (!meta.pist && m.pist) meta.pist=m.pist;
      if (!meta.enIyiDereceRekoru && m.enIyiDereceRekoru) meta.enIyiDereceRekoru=m.enIyiDereceRekoru;
      if (meta.mesafeSayi && meta.pist) break;
    }
    meta.sinifMetni = (metaAdaylari.find(m => m.sinifMetni)?.sinifMetni || '').trim();
    // TJK'daki koşu başlık satırı (ör. "Maiden/DHÖW, 3 Yaşlı Araplar, 57 kg, 1600 Kum , E.İ.D. : 1.48.55")
    // bu koşunun başlığı ile bir sonraki koşu başlığı arasında, en derindeki uygun elemandan alınır
    {
      const sonrakiB = kosuBaslangic[kosuBaslangic.indexOf(baslikEl) + 1] || null;
      const temizle = t => String(t || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
      const trl = t => String(t || '').toLocaleLowerCase('tr-TR');
      const PIST_RE = /(\d{1,2}[.]\d{3}|\d{3,4})\s*(?:m\b\s*)?(çim|kum|sentetik)/;
      // Handikap koşularında kg ve "Yaş" yazmaz (örn. "4 ve Yukarı Araplar"): virgüllü şart metni de yeterli
      const SART_OK = l => /yaş|\bkg\b|yukarı|araplar|ingilizler|handikap|maiden|şartlı|dişi|erkek/.test(l) || (l.match(/,/g) || []).length >= 2;
      // Metindeki "… 2200 Kum, E.İ.D. : 2.20.30" satırını ayıkla: başlıktaki "Koşu HH:MM" sonrasından pist(+EİD) sonuna kadar
      const bilgiAyikla = (ham) => {
        const t = temizle(ham), l = trl(t);
        const m = PIST_RE.exec(l); if (!m) return '';
        let end = m.index + m[0].length;
        const eid = t.slice(end).match(/^\s*,?\s*E\.?\s*[İIi]\.?\s*D\.?\s*:\s*[\d.]+/);
        if (eid) end += eid[0].length;
        let head = t.slice(0, end).replace(/^[\s\S]*Koşu\s+\d{1,2}[:.]\d{2}\s*/, '');
        head = head.replace(/^[\s\S]*(?:Birinci Primi|Koşu İkramiyesi|İkramiye|Primi)[^,]*?(?:\d\s*TL|₺)\s*/i, '').trim();
        if (head.length < 12 || head.length > 320 || !SART_OK(trl(head))) return '';
        return head;
      };
      let bulunan = '';
      for (const el of tumElemanlar) {
        if (!(baslikEl.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
        if (sonrakiB && !(sonrakiB.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING)) continue;
        const ay = bilgiAyikla(el.textContent);
        if (!ay) continue;
        if (Array.from(el.children).some(c => bilgiAyikla(c.textContent))) continue;
        bulunan = ay; break;
      }
      // Yedek: başlıktan sonraki kardeş elemanların metni / üst kapsayıcı
      if (!bulunan) bulunan = bilgiAyikla(metaMetin);
      if (!bulunan && baslikEl.parentElement) bulunan = bilgiAyikla(baslikEl.parentElement.textContent || '');
      if (bulunan) {
        bulunan = bulunan.replace(/\s*(?:Birinci Primi|Koşu İkramiyesi|İkramiye|Primi)[\s\S]*$/i, '').replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/[\s,]+$/, '').trim();
        meta.bilgiTam = bulunan;
        const mp = trl(bulunan).match(PIST_RE);
        if (mp) { const sy = +String(mp[1]).replace('.', ''); meta.mesafeSayi = sy; meta.mesafe = sy + ' m'; meta.pist = mp[2].charAt(0).toLocaleUpperCase('tr-TR') + mp[2].slice(1); }
      }
    }
    const parseSonuc = tablo ? parseAtTablosu(tablo) : { atlar: [], teshis: null };

    if (!adaylar[mNo[1]]) adaylar[mNo[1]] = [];
    adaylar[mNo[1]].push({
      saat: mNo[2].replace('.', ':'),
      meta,
      atlar: parseSonuc.atlar,
      teshis: parseSonuc.teshis
    });
  });

  const kosular = [];
  Object.keys(adaylar).sort((a,b) => parseInt(a)-parseInt(b)).forEach(no => {
    const secenekler = adaylar[no];
    // DÜZELTME: "ilk" değil "SON" atlı adayı tercih ediyoruz. Sebep: sayfanın üstündeki
    // hızlı-geçiş sekmesi bir koşu başlığı için tablo bulamayınca (özellikle son koşuda,
    // çünkü ondan sonra sekme kalmıyor) üst kapsayıcıya zıplayıp ORADA bulduğu ilk tabloyu
    // (genelde 1. koşunun tablosu) yanlışlıkla bu koşuya mal edebiliyor. Asıl doğru koşu
    // bölümü belgede her zaman sekmelerden SONRA geldiği için, atı olan adaylar arasında
    // sondan seçmek doğru veriyi garantiliyor.
    let secilen = null;
    for (let i = secenekler.length - 1; i >= 0; i--) {
      if (secenekler[i].atlar.length > 0) { secilen = secenekler[i]; break; }
    }
    if (!secilen) secilen = secenekler[secenekler.length - 1];
    kosular.push({ no, saat: secilen.saat, ...secilen.meta, atlar: secilen.atlar, teshis: secilen.teshis });
  });

  return kosular;
}

function parseKosuMeta(text) {
  // TJK'nin farklı HTML sürümlerinde mesafe ve pist aynı metin içinde
  // "1500 m Çim", "Çim 1500 m", "1500 Çim", "1500 M / ÇİM"
  // veya ayrı DOM elemanlarında gelebiliyor. Bu nedenle mesafe ile pisti
  // tek bir regex'e bağlamıyoruz; ikisini BAĞIMSIZ olarak buluyoruz.
  const ham = String(text || '');
  const temiz = ham
    .replace(/\u00a0/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Mesafe: 1200m, 1200 m, 1.200 m, 1 200 m gibi varyasyonları yakala.
  // Öncelik "m" ile açıkça belirtilen değerde; yoksa pist adına yakın 3-4 haneli
  // değeri yedek olarak kullanıyoruz. Böylece yaş/sınıf gibi başka sayılar seçilmez.
  let mesafeSayi = null;
  let mesafeM = temiz.match(/(?:^|[^\d])(\d{1,2}[.\s]\d{3}|\d{3,4})\s*m\b/i);
  if (mesafeM) {
    mesafeSayi = parseInt(String(mesafeM[1]).replace(/[.\s]/g, ''), 10);
  }

  const pistNorm = temiz.toLocaleUpperCase('tr-TR');
  const pistM = pistNorm.match(/(?:^|\s)(ÇİM|KUM|SENTETİK)(?=\s|$|[|,;:/()])/);
  let pist = pistM ? pistM[1] : null;

  // "1500 Çim" / "Çim 1500" gibi m harfi olmayan gösterimlerde,
  // pistin hemen çevresindeki 3-4 haneli sayıyı mesafe kabul et.
  if (!mesafeSayi && pistM) {
    const sol = temiz.slice(Math.max(0, pistM.index - 28), pistM.index);
    const sag = temiz.slice(pistM.index + pistM[0].length, pistM.index + pistM[0].length + 28);
    const yakin = (sol + ' ' + sag).match(/\b(\d{3,4})\b/);
    if (yakin) mesafeSayi = parseInt(yakin[1], 10);
  }

  const eidM = temiz.match(/E\.?İ\.?D\.?\s*:\s*([\d.]+)/i);
  return {
    mesafe: mesafeSayi ? mesafeSayi + ' m' : null,
    mesafeSayi: mesafeSayi,
    pist: pist ? (pist === 'ÇİM' ? 'Çim' : pist === 'KUM' ? 'Kum' : 'Sentetik') : null,
    enIyiDereceRekoru: eidM ? eidM[1] : null,
    sinifMetni: temiz.substring(0, 320)
  };
}

// "Son 6 Yarış" hücresi → [{s:'4', c:'g'|'k'|'s'|'#hex'|''}]  (c: pist rengi — çim/kum/sentetik; bulunamazsa boş)
function son6Ayir(hucre){
  if(!hucre) return [];
  const out = [];
  const renk = el => {
    const sc = (el.getAttribute && (el.getAttribute('class') || '') || '').toLowerCase();
    if(/cim|çim|green|yesil/.test(sc)) return 'g';
    if(/kum|sand|brown|kahve/.test(sc)) return 'k';
    if(/sentetik|synth|blue/.test(sc)) return 's';
    const st = ((el.getAttribute && el.getAttribute('style')) || '').match(/color\s*:\s*([^;]+)/i) || [];
    const col = (st[1] || (el.getAttribute && el.getAttribute('color')) || '').trim();
    return col ? col : '';
  };
  const walk = (n, c) => {
    if(n.nodeType === 3){ (n.textContent.match(/[0-9A-Za-z\-]/g) || []).forEach(ch => out.push({s: ch, c})); }
    else if(n.nodeType === 1){ const rc = renk(n) || c; Array.from(n.childNodes).forEach(k => walk(k, rc)); }
  };
  walk(hucre, '');
  return out.slice(-6);
}

// At İsmi hücresinden takı kodu + açıklama çiftleri: [{k:'KG', a:'Kapalı gözlük takılacağını ifade eder.'}]
const TAKI_KOD_RE = /^[A-ZÇĞİÖŞÜ]{1,4}$/;
const TAKI_BILINEN = ['KGK', 'KDB', 'ÖDB', 'SKG', 'GKR', 'DB', 'KG', 'SK', 'ÖG', 'K'];
function takiCikar(hucre, isimHam, atLinki){
  const out = [];
  const ekle = (k, a) => {
    k = String(k || '').replace(/\s+/g, '');
    if(!TAKI_KOD_RE.test(k)) return;
    a = String(a || '').replace(/\s+/g, ' ').trim();
    const var_ = out.find(x => x.k === k);
    if(var_){ if(!var_.a && a) var_.a = a; return; }
    out.push({k, a});
  };
  if(hucre){
    const linkMetin = atLinki ? atLinki.textContent.replace(/\s+/g, ' ').trim() : '';
    const adaylar = hucre.querySelectorAll('[title],[data-original-title],[data-title],[data-content],[data-tooltip],[aria-label],[class*="taki" i],[class*="ekipman" i],[class*="tooltip" i],sup,sub');
    Array.from(adaylar).forEach(el => {
      if(el === atLinki || (atLinki && atLinki.contains(el))) return;
      const ta = ['title', 'data-original-title', 'data-title', 'data-content', 'data-tooltip', 'aria-label'].map(n => (el.getAttribute(n) || '').trim()).find(Boolean) || '';
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if(!t || t === linkMetin) return;
      // 1) sadece kod:  "KG"
      if(TAKI_KOD_RE.test(t)){ ekle(t, ta); return; }
      // 2) kod + gizli açıklama birleşik:  "KGKapalı gözlük takılacağını ifade eder."
      const m = t.match(/^([A-ZÇĞİÖŞÜ]+)([A-ZÇĞİÖŞÜ][a-zçğıöşü][\s\S]*)$/);
      if(m && TAKI_KOD_RE.test(m[1])) ekle(m[1], ta || m[2]);
    });
  }
  // Yedek: işaretlemeden hiç kod çıkmadıysa isim hücresinin metninden (isim, (3) ve (Koşmaz) atılarak) bilinen kodları al
  if(!out.length && isimHam){
    let t = String(isimHam).replace(/\u00a0/g, ' ');
    if(atLinki) t = t.replace(atLinki.textContent.trim(), ' ');
    t = t.replace(/\(\s*\d+\s*\)/g, ' ').replace(/\(\s*Ko[şs]maz\s*\)/i, ' ');
    t.split(/\s+/).forEach(w => { if(TAKI_BILINEN.includes(w)) ekle(w, ''); });
  }
  return out;
}

function parseAtTablosu(tablo) {
  const satirlar = Array.from(tablo.querySelectorAll('tr'));
  if (satirlar.length < 2) return { atlar: [], teshis: { basHucreler: [], not: 'Tabloda 2den az satır var' } };

  // Başlık satırını bul (içinde "At İsmi" ve "Jokey" geçen)
  let basIdx = satirlar.findIndex(tr => /At\s*İsmi/i.test(tr.textContent) && /Jokey/i.test(tr.textContent));
  if (basIdx === -1) basIdx = 0;
  const basHucreler = Array.from(satirlar[basIdx].querySelectorAll('th,td')).map(td => td.textContent.trim());

  function sutun(anahtar) {
    const adaylar = Array.isArray(anahtar) ? anahtar : [anahtar];
    for (const ad of adaylar) {
      const i = basHucreler.findIndex(h => h.replace(/\s+/g,' ').toLowerCase().includes(String(ad).toLowerCase()));
      if (i >= 0) return i;
    }
    return -1;
  }
  const idxN = sutun('N');
  const idxIsim = sutun('At İsmi');
  const idxYas = sutun('Yaş');
  const idxSiklet = sutun('Sıklet');
  const idxJokey = sutun('Jokey');
  const idxSt = sutun('St');
  const idxHp = sutun('HP');
  const idxSon6 = sutun('Son 6');
  const idxOrijin = sutun('Orijin');
  const idxSahip = sutun('Sahip');
  const idxS20 = sutun('s20');
  const idxKgs = sutun('KGS');
  const idxEnIyi = sutun('En İyi D');
  const idxGny = sutun('Gny');
  const idxAgf = sutun('AGF');
  const idxAntrenor = (()=>{for(const ad of ['Antrenör','Antrenor','Antr.']){const i=sutun(ad);if(i>=0)return i;}return -1;})();
  // Bugünkü koşuda takı/ekstra donanım (gözlük, yular vb.) sütunu — TJK sayfa sürümüne göre
  // bulunmayabilir. Sütun hiç yoksa (idxTaki=-1) "takısız" ile "veri yok" birbirine karışmasın diye
  // bunu ayrı bir bayrakla (takiSutunVarMi) işaretliyoruz; sütun varsa ve hücre boşsa gerçekten takısız.
  const idxTaki = sutun(['Ekstra','Takı','Taki','Donanım']);
  const takiSutunVarMi = idxTaki >= 0;

  const atlar = [];
  for (let i = basIdx+1; i < satirlar.length; i++) {
    const hucreler = Array.from(satirlar[i].querySelectorAll('td'));
    if (hucreler.length < 4) continue;
    const al = (idx) => idx >= 0 && hucreler[idx] ? hucreler[idx].textContent.trim() : null;
    // Takı/ekstra donanım sütunu TJK'de bazen metin yerine sadece ikon (gözlük/yular resmi)
    // olarak gelir — bu durumda textContent boş kalır ve "takısız" ile "veri yok" birbirine
    // karışır. Bu yüzden hücrede metin yoksa ikonun title/alt özniteliğine, o da yoksa
    // hücrenin kendi title özniteliğine bakıyoruz.
    const alGenis = (idx) => {
      if (idx < 0 || !hucreler[idx]) return null;
      const hucre = hucreler[idx];
      const metin = hucre.textContent.trim();
      if (metin) return metin;
      const ikonlar = Array.from(hucre.querySelectorAll('img,[title],[aria-label]'))
        .map(el => (el.getAttribute('title') || el.getAttribute('alt') || el.getAttribute('aria-label') || '').trim())
        .filter(Boolean);
      if (ikonlar.length) return ikonlar.join(', ');
      const hucreBaslik = (hucre.getAttribute('title') || '').trim();
      return hucreBaslik || null;
    };
    const isimHam = al(idxIsim);
    if (!isimHam) continue;
    // Koşmaz (çekilen) at: satır/öğe sınıfında ya da metninde işaret, isimde "(K)", üstü çizili stil
    const satirEl = satirlar[i];
    const sinifMetni = (satirEl.className || '') + ' ' + Array.from(satirEl.querySelectorAll('[class]')).map(e => String(e.className || '')).join(' ');
    const kosmaz = /ko[sş]maz|kosmaz|cekil|çekil|iptal|withdraw|scratch/i.test(sinifMetni)
      || /\(\s*K\s*\)/.test(isimHam)
      || /\bko[şs]maz\b/i.test(satirEl.textContent || '')
      || !!satirEl.querySelector('s, strike, del, [style*="line-through"]');
    // İsim hücresinde uyarı kodları da olabilir (KG, DB vs) — ilk satır/kelime bloğu ismi verir
    const isim = isimHam.split('\n')[0].replace(/\s{2,}.*$/,'').trim();
    // At isminin linkinden AtId'yi çıkarıyoruz — Pist/Mesafe geçmişini bu ID ile TJK'nin
    // "AtKosuBilgileri" (at profil) sayfasından çekeceğiz (bkz. atGecmisiGetir).
    const isimHucre = idxIsim >= 0 ? hucreler[idxIsim] : null;
    const atLinki = isimHucre ? isimHucre.querySelector('a') : null;
    const atIdM = atLinki ? (atLinki.getAttribute('href')||'').match(/AtId=(\d+)/i) : null;
    // ---- TAKI / EKİPMAN (KG, K, DB, SK, SKG, GKR …) ----
    // TJK'da takılar At İsmi hücresinde, ismin yanında küçük kodlar olarak durur; her kodun tooltip açıklaması vardır.
    // Kod + açıklama çiftleri doğrudan hücrenin işaretlemesinden okunur (title / data-* / gizli açıklama metni).
    // Başka (isim linki, koşmaz yazısı vb.) öğeler kod sayılmasın diye kodlar 1-4 büyük harf olmak zorundadır.
    const takiCift = takiCikar(isimHucre, isimHam, atLinki);
    const takiKodlari = takiCift.map(x => x.k);
    const takiAciklamalari = takiCift.map(x => x.a).filter(Boolean);
    const takiIsimHucresindenVarMi = takiKodlari.length > 0;
    const taki = takiIsimHucresindenVarMi ? takiKodlari.join(' ') : (alGenis(idxTaki) || null);
    const takiAciklama = takiAciklamalari.length ? takiAciklamalari.join(' | ') : null;
    const takiHam = isimHucre ? isimHucre.innerHTML.replace(/\s+/g, ' ').trim().slice(0, 360) : '';

    // Jokey hücresi: isim + (AP rozeti + gizli "Apranti" açıklaması). Temiz isim, apranti bayrağı ve sıklet farkı (+0.50) ayrı alınır
    const jokHuc = idxJokey >= 0 ? hucreler[idxJokey] : null;
    const jokHam = jokHuc ? jokHuc.textContent.replace(/\s+/g, ' ').trim() : '';
    const jokLink = jokHuc ? jokHuc.querySelector('a') : null;
    const jokApranti = /Apranti|(?:^|\s)AP(?:\s|$)/.test(jokHam) || !!(jokHuc && jokHuc.querySelector('[title*="pranti" i]'));
    const jokTemiz = ((jokLink && jokLink.textContent.trim()) || jokHam.replace(/\s*AP\s*Apranti.*$/i, '').replace(/\s+AP$/, '')).replace(/\s+/g, ' ').trim() || jokHam;
    const sikHam = al(idxSiklet) || '', sikFazla = (sikHam.match(/\+\s*(\d+(?:[.,]\d+)?)/) || [])[1] || null;
    const tek = idx => { const v = al(idx); return v ? v.replace(/\s+/g, ' ').trim() : null; };

    atlar.push({
      kosmaz,
      no: al(idxN),
      isim: isim || isimHam.substring(0,40),
      atId: atIdM ? atIdM[1] : null,
      yas: al(idxYas),
      siklet: parseFloat((al(idxSiklet)||'').replace(',','.')) || null,
      jokey: jokTemiz,
      jokeyAp: jokApranti,
      fazla: sikFazla ? sikFazla.replace(',', '.') : null,
      orijin: tek(idxOrijin),
      sahip: tek(idxSahip),
      s20: tek(idxS20),
      st: (m => m ? m[1] : al(idxSt))(String(al(idxSt) || '').trim().match(/^(\d{1,2})(?!\d)/)),
      hp: parseInt(al(idxHp)) || null,
      son6Ham: al(idxSon6),
      son6: son6Ayir(idxSon6 >= 0 ? hucreler[idxSon6] : null),
      kgs: al(idxKgs),
      enIyiDerece: parseSure(al(idxEnIyi)),
      enIyiDereceHam: al(idxEnIyi),
      gny: parseFloat((al(idxGny)||'').replace(',','.')) || null,
      agfYuzde: parseAgf(al(idxAgf)),
      agfHam: al(idxAgf), antrenor: al(idxAntrenor)||null,
      taki, takiAciklama, takiDetay: takiCift, takiHam,
      takiSutunVarMi: takiIsimHucresindenVarMi || takiSutunVarMi
    });
  }
  return {
    atlar,
    teshis: {
      basHucreler,
      indeksler: { idxN, idxIsim, idxYas, idxSiklet, idxJokey, idxSt, idxHp, idxSon6, idxKgs, idxEnIyi, idxGny, idxAgf, idxAntrenor }
    }
  };
}

function parseSure(s) {
  if (!s) return null;
  const temiz = String(s).trim();
  if (!temiz || temiz === '-' || temiz === '—') return null; // gerçekten veri yok
  const m3 = temiz.match(/(\d+)[.:,](\d{2})[.:,](\d{2})/); // dk.sn.yüzde
  if (m3) return parseInt(m3[1])*60 + parseInt(m3[2]) + parseInt(m3[3])/100;
  const m2 = temiz.match(/(\d{1,2})[.:,](\d{2})/); // sadece sn.yüzde (dk yok)
  if (m2) return parseInt(m2[1]) + parseInt(m2[2])/100;
  return null;
}

function parseAgf(s) {
  if (!s) return null;
  const m = String(s).match(/(\d+)/);
  return m ? parseInt(m[1]) : null;
}

function parseYabanciKosular(html) {
  const dom = new DOMParser().parseFromString(html, 'text/html');
  const tablolar = Array.from(dom.querySelectorAll('table'));
  const sonuc = [];
  let sira = 0;

  tablolar.forEach(tablo => {
    const satirlar = Array.from(tablo.querySelectorAll('tr'));
    if (satirlar.length < 2) return;
    const baslik = satirlar.slice(0,3).map(tr => tr.textContent || '').join(' ');
    if (!/At\s*İsmi/i.test(baslik) || !/Jokey/i.test(baslik)) return;

    let atlar = [];
    try { atlar = parseAtTablosu(tablo).atlar || []; } catch (_) { atlar = []; }
    if (!atlar.length) return;

    // Tablo öncesindeki yakın metinden "N. Koşu HH:MM" bilgisini bul.
    let onceki = '';
    let node = tablo;
    for (let i=0; i<20 && node; i++) {
      node = node.previousElementSibling || node.parentElement;
      if (!node) break;
      onceki = (node.textContent || '') + ' ' + onceki;
      const m = onceki.match(/(\d+)\.\s*Koşu\s+(\d{1,2}[:.]\d{2})/i);
      if (m) {
        const meta = parseKosuMeta(onceki);
        sonuc.push({ no:m[1], saat:m[2].replace('.',':'), ...meta, atlar, teshis:{ydFallback:true} });
        return;
      }
    }
    // Başlık DOM'da erişilemiyorsa tablo sırasını koşu numarası olarak kullan.
    sira++;
    sonuc.push({ no:String(sira), saat:'—', ...parseKosuMeta(onceki), atlar, teshis:{ydFallback:true} });
  });

  const map = new Map();
  sonuc.forEach(k => map.set(k.no, k));
  return Array.from(map.values()).sort((a,b) => parseInt(a.no)-parseInt(b.no));
}

async function sehirleriGetir(tarihIso) {
  const tjkTarih = isoyuTjkTarihineCevir(tarihIso);
  const era = eraHesapla(tarihIso);

  const url = `https://www.tjk.org/TR/yarissever/Info/Page/GunlukYarisProgrami?QueryParameter_Tarih=${encodeURIComponent(tjkTarih)}&Era=${era}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error('TJK bağlantı hatası (HTTP ' + res.status + ')');
  const html = await res.text();
  const dom = new DOMParser().parseFromString(html, 'text/html');
  const tarihStr = sayfadanTarihiBul(dom, html);

  // TJK aynı Günlük Yarış Programı ekranında yerli şehirleri ve YD (yabancı)
  // hipodromlarını birlikte yayınlıyor. Yabancı bağlantıların HTML yapısı zaman zaman
  // yerli bağlantılardan küçük farklılıklar gösterebildiği için artık sadece tek bir
  // CSS selector'a güvenmiyoruz; href'i GünlükYarisProgrami olan TÜM bağlantıları tarıyoruz.
  const tumLinkler = Array.from(dom.querySelectorAll('a[href]'));
  const linkler = tumLinkler.filter(a => /GunlukYarisProgrami/i.test(a.getAttribute('href') || ''));
  const sehirler = [];
  const gorulen = new Set();
  linkler.forEach(a => {
    const href = a.getAttribute('href') || '';
    const m = href.match(/[?&]SehirId=(\d+)/i);
    if (!m) return;
    const id = m[1];
    if (gorulen.has(id)) return;
    gorulen.add(id);

    let adi = '';
    const mAdi = href.match(/[?&]SehirAdi=([^&]+)/i);
    if (mAdi) {
      try { adi = decodeURIComponent(mAdi[1].replace(/\+/g,' ')); } catch (_) { adi = mAdi[1]; }
    }
    adi = (adi || a.textContent || '').replace(/\s+/g,' ').trim();
    // Bazı TJK sürümlerinde SehirAdi URL'de bulunmayabiliyor; bağlantı metnini kullan.
    if (!adi) adi = (a.textContent || '').replace(/\s+/g,' ').trim();
    const yurtDisi = sehirYurtDisiMi(adi, a.textContent || '');
    sehirler.push({ id, adi, yurtDisi });
  });

  // Güvenlik ağı: TJK ileride bağlantı adresini farklı bir path'e taşırsa bile
  // SehirId + YD ibaresi bulunan bağlantıları ayrıca yakala.
  if (sehirler.filter(s => s.yurtDisi).length === 0) {
    tumLinkler.forEach(a => {
      const href = a.getAttribute('href') || '';
      if (!/[?&]SehirId=\d+/i.test(href)) return;
      const metin = (a.textContent || '').replace(/\s+/g,' ').trim();
      if (!/\bYD\s*\d+\b/i.test(metin)) return;
      const m = href.match(/[?&]SehirId=(\d+)/i);
      if (!m || gorulen.has(m[1])) return;
      const id = m[1];
      let adi = metin;
      const mAdi = href.match(/[?&]SehirAdi=([^&]+)/i);
      if (mAdi) { try { adi = decodeURIComponent(mAdi[1].replace(/\+/g,' ')); } catch (_) {} }
      sehirler.push({ id, adi: (adi || metin).trim(), yurtDisi: true });
      gorulen.add(id);
    });
  }

  if (sehirler.length === 0) {
    throw new Error('TJK\'da bu tarih için yayınlanmış bir koşu programı bulunamadı.');
  }
  // Sadece yurt içi (Türkiye) hipodromları gösterilsin; yurt dışı (YD) koşuları listeden çıkar.
  const yerliSehirler = sehirler.filter(s => !s.yurtDisi);
  const sonuc = { tarih: tarihStr, istenenTarih: tjkTarih, sehirler: yerliSehirler.length ? yerliSehirler : sehirler };
  return sonuc;
}

// Bir hipodromun günlük programı: koşular + atlar (sadeleştirilmiş)
// TJK programında her koşunun altında yazan "6'LI GANYAN bu koşudan başlar" bilgisini çıkarır → {koşuNo: [{ord, n, tur}]}
// tur: GANYAN | PLASE | CIFTE. Bilgi bulunamazsa boş döner (uygulama eski "son N koşu" varsayımına düşer).
function ayakBaslangiclari(html){
  const out = {};
  try {
    const dom = new DOMParser().parseFromString(html, 'text/html');
    const txt = String(dom.body.textContent || '').replace(/\u00a0/g, ' ').toLocaleUpperCase('tr')
      .replace(/İ/g,'I').replace(/Ğ/g,'G').replace(/Ü/g,'U').replace(/Ş/g,'S').replace(/Ö/g,'O').replace(/Ç/g,'C')
      .replace(/['’`]/g, '').replace(/\s+/g, ' ')
      .replace(/\bYEDILI\b/g,'7LI').replace(/\bALTILI\b/g,'6LI').replace(/\bBESLI\b/g,'5LI').replace(/\bDORTLU\b/g,'4LI').replace(/\bUCLU\b(?= (?:GANYAN|PLASE))/g,'3LI');
    const heads = []; const rb = /(\d{1,2})\. KOSU\s+\d{1,2}[:.]\d{2}/g; let b;
    while((b = rb.exec(txt))) heads.push({i: b.index, e: b.index + b[0].length, no: +b[1]});
    const re = /KOSUDAN BASLAR/g; let m;
    while((m = re.exec(txt))){
      const h = heads.filter(x => x.e <= m.index).pop();
      if(!h) continue;   // mesafe sınırı yok: yazı hangi koşu başlığından sonra geliyorsa o koşuya aittir
      const seg = txt.slice(Math.max(h.e, m.index - 400), m.index);
      const ri = /(?:(\d)\. ?)?(\d) ?L[IU] ?(GANYAN|PLASE)|CIFTE/g; let x;
      while((x = ri.exec(seg))){
        const it = x[0] === 'CIFTE' ? {ord: 0, n: 2, tur: 'CIFTE'} : {ord: x[1] ? +x[1] : 0, n: +x[2], tur: x[3]};
        (out[h.no] = out[h.no] || []);
        if(!out[h.no].some(y => y.ord === it.ord && y.n === it.n && y.tur === it.tur)) out[h.no].push(it);
      }
    }
  } catch(e){}
  return out;
}
// TJK programında her koşunun altında yazan oyun listesi (GANYAN, İKİLİ, SIRALI İKİLİ, PLASE İKİLİ, ÜÇLÜ BAHİS, TABELA, SIRALI 5'Lİ, PLASE…)
// → {koşuNo: ['g1','ik','si','pi','su','tb','s5','pl','gp']}. Liste okunamazsa o koşu için hiç kayıt dönmez (uygulama at sayısı kuralına düşer).
function kosuOyunlari(html){
  const out = {};
  try {
    const dom = new DOMParser().parseFromString(html, 'text/html');
    const txt = String(dom.body.textContent || '').replace(/\u00a0/g, ' ').toLocaleUpperCase('tr')
      .replace(/İ/g,'I').replace(/Ğ/g,'G').replace(/Ü/g,'U').replace(/Ş/g,'S').replace(/Ö/g,'O').replace(/Ç/g,'C')
      .replace(/['’`]/g, '').replace(/\s+/g, ' ')
      .replace(/\bBESLI\b/g,'5LI');
    const heads = []; const rb = /(\d{1,2})\. KOSU\s+\d{1,2}[:.]\d{2}/g; let b;
    while((b = rb.exec(txt))) heads.push({e: b.index + b[0].length, i: b.index, no: +b[1]});
    heads.forEach((h, i) => {
      const end = i + 1 < heads.length ? heads[i + 1].i : txt.length;
      let seg = ' ' + txt.slice(h.e, end).slice(-900) + ' ';          // oyun satırı koşu bloğunun sonundadır
      seg = seg.replace(/SABIT [^,]*/g, ' ')                          // sabit ihtimalli oyunlar sayılmaz
               .replace(/\d ?L[IU] ?(?:GANYAN|PLASE)/g, ' ')          // çok ayaklı ayak başlangıçları (7li plase vb.)
               .replace(/SIRALI IKILI/g, ' @SI ').replace(/PLASE IKILI/g, ' @PI ')
               .replace(/SIRALI (?:UCLU|3LU)/g, ' @SU ').replace(/SIRALI 5 ?LI/g, ' @S5 ');
      const set = new Set();
      if(/\bGANYAN\b/.test(seg)) set.add('g1');
      if(/@SI/.test(seg)) set.add('si');
      if(/@PI/.test(seg)) set.add('pi');
      if(/@SU|\bUCLU BAHIS/.test(seg)) set.add('su');
      if(/@S5/.test(seg)) set.add('s5');
      if(/TABELA/.test(seg)) set.add('tb');
      const rest = seg.replace(/@\w+/g, ' ');
      if(/\bIKILI\b/.test(rest)) set.add('ik');
      if(/\bPLASE\b/.test(rest)){ set.add('pl'); set.add('gp'); }
      if(set.has('g1') && set.size >= 2) out[h.no] = Array.from(set);   // gerçek bir liste gibi görünmüyorsa kaydetme
    });
  } catch(e){}
  return out;
}
async function sehirProgramiGetir(sehirId, sehirAdi, tarihIso) {
  const tjkTarih = isoyuTjkTarihineCevir(tarihIso);
  const era = eraHesapla(tarihIso);
  const url = `https://www.tjk.org/TR/yarissever/Info/Sehir/GunlukYarisProgrami?SehirId=${sehirId}&QueryParameter_Tarih=${encodeURIComponent(tjkTarih)}&SehirAdi=${encodeURIComponent(sehirAdi)}&Era=${era}`;
  const res = await fetchWithTimeout(url, 45000, 2);
  const html = await res.text();
  const ayakBas = ayakBaslangiclari(html);
  const oyunKos = kosuOyunlari(html);
  let kosular = parseKosular(html);
  let yedek = [];
  try { yedek = parseYabanciKosular(html); } catch (_) { yedek = []; }
  if (yedek.length) {
    const birlesik = new Map();
    kosular.forEach(k => birlesik.set(String(k.no), k));
    yedek.forEach(k => {
      const no = String(k.no), mevcut = birlesik.get(no);
      if (!mevcut || (k.atlar?.length || 0) > (mevcut.atlar?.length || 0)) {
        // Yedek ayrıştırıcı daha çok at bulduysa onu al; ama koşu şartı satırı (bilgiTam) ve mesafe/pist kaybolmasın
        if (mevcut) {
          if (!k.bilgiTam && mevcut.bilgiTam) k.bilgiTam = mevcut.bilgiTam;
          if (!k.mesafe && mevcut.mesafe) { k.mesafe = mevcut.mesafe; k.mesafeSayi = mevcut.mesafeSayi; }
          if (!k.pist && mevcut.pist) k.pist = mevcut.pist;
          if (!k.sinifMetni && mevcut.sinifMetni) k.sinifMetni = mevcut.sinifMetni;
        }
        birlesik.set(no, k);
      } else if (mevcut && !mevcut.bilgiTam && k.bilgiTam) mevcut.bilgiTam = k.bilgiTam;
    });
    kosular = Array.from(birlesik.values()).sort((a, b) => parseInt(a.no) - parseInt(b.no));
  }
  return kosular.filter(k => k.atlar && k.atlar.length).map(k => ({
    no: k.no, saat: k.saat, mesafe: k.mesafe || null, pist: k.pist || null, sinif: String(k.sinifMetni || '').slice(0, 320), bilgi: k.bilgiTam || '', baslar: ayakBas[+k.no] || [], oyun: oyunKos[+k.no] || null,
    atlar: k.atlar.map(a => ({ kosmaz: !!a.kosmaz, no: a.no, isim: a.isim, jokey: a.jokey || '', agf: a.agfYuzde, siklet: a.siklet, yas: a.yas, gny: a.gny, son6: a.son6 || [], ap: !!a.jokeyAp, fazla: a.fazla || null, orijin: a.orijin || null, sahip: a.sahip || null, antrenor: a.antrenor || null, s20: a.s20 || null, st: a.st || null, hp: a.hp || null, kgs: a.kgs || null, eid: a.enIyiDereceHam || null, taki: a.taki || null, takiAciklama: a.takiAciklama || null, takiDetay: a.takiDetay || [], takiHam: a.takiHam || '' }))
  }));
}

// Tablo sonrası bahis özeti: "GANYAN 6 2,95 ₺İKİLİ 2/6 3,15 ₺ ..." → [{tur, detay, tutar}]
const BAHIS_KALIPLAR = [
  { re: /(?:(\d+)\.\s*)?(\d+)\s*['’]?\s*L[İIÜUiıüu]\s*GANYAN\s*(.*)$/i, tur: m => (m[1] ? m[1] + '. ' : '') + m[2] + "'li Ganyan", detay: m => m[3] },
  { re: /(?:(\d+)\.\s*)?(\d+)\s*['’]?\s*L[İIÜUiıüu]\s*PLASE\s*(.*)$/i, tur: m => (m[1] ? m[1] + '. ' : '') + m[2] + "'li Plase", detay: m => m[3] },
  { re: /SIRALI\s*[İIi]K[İIi]L[İIi]\s*(.*)$/i, tur: () => 'Sıralı İkili', detay: m => m[1] },
  { re: /SIRALI\s*(?:5\s*['’]?\s*L[İIi]|BE[ŞS]L[İIi])\s*(?:BAH[İIi]S\s*)?(.*)$/i, tur: () => 'Sıralı Beşli', detay: m => m[1] },
  { re: /TABELA\s*(?:BAH[İIi]S\s*)?(.*)$/i, tur: () => 'Tabela Bahis', detay: m => m[1] },
  { re: /SIRALI\s*(?:ÜÇLÜ\s*)?(?:BAH[İIi]S\s*)?(.*)$/i, tur: () => 'Sıralı Üçlü', detay: m => m[1] },
  { re: /PLASE\s*[İIi]K[İIi]L[İIi]\s*(.*)$/i, tur: () => 'Plase İkili', detay: m => m[1] },
  { re: /ÜÇLÜ\s*BAH[İIi]S\s*(.*)$/i, tur: () => 'Üçlü Bahis', detay: m => m[1] },
  { re: /(\d+)\.\s*ÇİFTE\s*(.*)$/i, tur: m => m[1] + '. Çifte', detay: m => m[2] },
  { re: /SAB[İIi]T\s*GANYAN\s*(.*)$/i, tur: () => 'Sabit Ganyan', detay: m => m[1] },
  { re: /PLASE\s+(.*)$/i, tur: () => 'Plase', detay: m => m[1] },
  { re: /[İIi]K[İIi]L[İIi]\s*(.*)$/i, tur: () => 'İkili', detay: m => m[1] },
  { re: /GANYAN\s*(.*)$/i, tur: () => 'Ganyan', detay: m => m[1] }
];
function bahisleriAyristir(metin) {
  const metin0 = metin;
  metin = String(metin || '').replace(/\u00a0/g, ' ').split(/Son\s*800/i)[0];
  const out = [], gorulen = new Set();
  let son = null;   // önceki parçadan eklenen bahis (satırdaki ikinci tutar = ikramiye)
  metin.split('₺').forEach(parca => {
    const prev = son; son = null;
    const tm = parca.match(/([\d.,]+)\s*$/); if (!tm) return;
    const tutar = tm[1];
    if (!(parseFloat(tutar.replace(/\./g, '').replace(',', '.')) > 0)) return;
    const et = parca.slice(0, parca.length - tm[0].length).replace(/\s+/g, ' ');
    if (/DA[ĞG]ITILACAK/.test(et.toLocaleUpperCase('tr'))) return;
    // "Bahis türü | Dağıtılacak tutar | İkramiye" satırı: etiketsiz ikinci tutar ikramiyedir, ilk tutar (havuz) yerine geçer
    if (!et.trim()) { if (prev && /,\d{1,2}$/.test(tutar) && !/,\d{1,2}$/.test(prev.tutar)) prev.tutar = tutar; return; }   // "Dağıtılacak Tutar" havuz bilgisi, ikramiye değil
    for (const k of BAHIS_KALIPLAR) {
      const mm = et.match(k.re);
      if (mm) {
        const x = { tur: k.tur(mm), detay: String(k.detay(mm) || '').replace(/\s+/g, ' ').replace(/^[İIi]KRAM[İIi]YE(LER)?\s*/i, '').trim(), tutar };
        const id = x.tur + '|' + x.detay;
        if (!gorulen.has(id)) { gorulen.add(id); out.push(x); son = x; }
        break;
      }
    }
  });
  // Yedek okuyucu: ₺ işareti metinde yoksa / "Son 800" önce geliyorsa kaçan sade ödemeleri (Ganyan, Sıralı İkili, İkili, Plase İkili, Üçlü, Çifte, Sabit Ganyan) etiketten yakala
  const temiz = String(metin0 || '').replace(/\u00a0/g, ' ').replace(/Son\s*800\s*:?\s*[\d.:\-\s]*/gi, ' ').replace(/\s+/g, ' ');
  const YRE = /(SIRALI\s*[İIi]K[İIi]L[İIi]|PLASE\s*[İIi]K[İIi]L[İIi]|ÜÇLÜ\s*BAH[İIi]S|SAB[İIi]T\s*GANYAN|\d+\.\s*ÇİFTE|(?<![\wİıÜü'’])GANYAN|(?<![\wİıÜü])[İIi]K[İIi]L[İIi])\s*(\d+(?:\s*[\/\-]\s*\d+)*)?\s+(?:₺|TL)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/gi;
  const yTur = t => { t = t.replace(/\s+/g, ' ').toLocaleUpperCase('tr'); return /^SIRALI/.test(t) ? 'Sıralı İkili' : /^PLASE/.test(t) ? 'Plase İkili' : /^ÜÇLÜ/.test(t) ? 'Üçlü Bahis' : /^SAB/.test(t) ? 'Sabit Ganyan' : /ÇİFTE/.test(t) ? t.replace(/\s*ÇİFTE/, '. Çifte').replace(/\.\.+/g, '.').replace(/^(\d+)\.?\s*\.?\s*Çifte/, '$1. Çifte') : t === 'GANYAN' ? 'Ganyan' : 'İkili'; };
  let ym;
  while((ym = YRE.exec(temiz))){
    if(!(parseFloat(ym[3].replace(/\./g, '').replace(',', '.')) > 0)) continue;
    const tur = yTur(ym[1]), detay = String(ym[2] || '').replace(/\s+/g, '').trim();
    if(out.some(x => x.tur === tur)) continue;
    out.push({ tur, detay, tutar: ym[3] });
  }
  // Çok ayaklı bahislerde (6'lı, 7'li, 5'li Ganyan, Çifte...) virgüllü kuruşu olmayan tutar havuz/devir bilgisidir, ödeme değil
  return out.filter(x => !/'li (Ganyan|Plase)$|Çifte$/.test(x.tur) || /,\d{1,2}$/.test(String(x.tutar)));
}

// Bir hipodromun günlük sonuçları: {koşuNo: [1. at no, 2. at no, 3. at no]}
async function sonuclariGetir(sehirId, sehirAdi, tarihIso, kosular) {
  const tjkTarih = isoyuTjkTarihineCevir(tarihIso);
  const era = eraHesapla(tarihIso);
  const url = `https://www.tjk.org/TR/yarissever/Info/Sehir/GunlukYarisSonuclari?SehirId=${sehirId}&QueryParameter_Tarih=${encodeURIComponent(tjkTarih)}&SehirAdi=${encodeURIComponent(sehirAdi)}&Era=${era}`;
  const res = await fetchWithTimeout(url, 30000, 1);
  const html = await res.text();
  await new Promise(r => (window.requestIdleCallback ? requestIdleCallback(() => r(), {timeout: 2000}) : setTimeout(r, 30)));
  const dom = new DOMParser().parseFromString(html, 'text/html');
  const nrm = s => String(s || '').toLocaleUpperCase('tr').replace(/İ/g,'I').replace(/Ğ/g,'G').replace(/Ü/g,'U').replace(/Ş/g,'S').replace(/Ö/g,'O').replace(/Ç/g,'C').replace(/[^A-Z0-9]/g,'');
  const basliklar = Array.from(dom.body.querySelectorAll('*')).filter(el => {
    if (el.children.length > 2) return false;
    const t = (el.textContent || '').trim();
    return /^\d+\.\s*Koşu/.test(t) && t.length < 400;   // grup/ödüllü koşularda başlık uzun olabilir
  });
  const out = {}, gout = {}, bout = {}, vout = {};
  const D = { zaman: new Date().toLocaleTimeString('tr'), basliklar: basliklar.map(b => (b.textContent || '').trim().slice(0, 30)), bultenKosular: kosular.map(k => k.no).join(','), tablolar: [] };   // teşhis kaydı (#teshis)
  // Sayfadaki tüm koşu video kodları (href / onclick / data-* / script içinde) — sıra ile eşleştirme için yedek
  const _allCodes = []; { const rx = /KosuKodu\W{0,8}?(-?\d{3,})/gi; let mm; while((mm = rx.exec(html))){ if(_allCodes.indexOf(mm[1]) < 0) _allCodes.push(mm[1]); } }
  const _allMp4 = []; { const rx = /(?:https?:)?\/\/video-cdn\.tjk\.org\/videoftp\/[^"'\s<>\\]+?\.mp4/gi; let mm; while((mm = rx.exec(html))){ if(_allMp4.indexOf(mm[0]) < 0) _allMp4.push(mm[0]); } }
  let _sonNo = 0; const _gorulenNo = new Set();   // başlık okunamazsa tablo sırasına göre koşu no
  D.hatalar = []; D.htmlUzunluk = html.length; D.htmlSon = html.slice(-120).replace(/\s+/g, ' ');
  Array.from(dom.querySelectorAll('table')).forEach(tablo => { try { (() => {   // bir koşu hata verirse diğerleri kaybolmasın
    const trs = Array.from(tablo.querySelectorAll('tr'));
    const bi = trs.findIndex(tr => /At\s*İsmi/i.test(tr.textContent));
    if (bi < 0) return;
    let no = null, bHead = null;
    for (const b of basliklar) {
      if (b.compareDocumentPosition(tablo) & Node.DOCUMENT_POSITION_FOLLOWING) { no = parseInt(b.textContent.trim()); bHead = b; }
      else break;
    }
    let seqFb = false; const _oncekiNo = _sonNo;
    if (!no || _gorulenNo.has(no) || no <= _sonNo) { no = _sonNo + 1; bHead = null; seqFb = true; }   // başlık yok / kaymış: bir önceki tablonun ardından gelen koşu
    _sonNo = no; _gorulenNo.add(no);
    const T = { no, not: seqFb ? 'sıraya göre atandı' : '', satir: 0, eslesen: 0, eslesmeyen: [] }; D.tablolar.push(T);
    if (out[no]) { T.not = 'bu koşu zaten alınmış'; return; }
    const kosu = kosular.find(k => +k.no === no); if (!kosu) { T.not = 'bültende bu koşu yok'; return; }
    const bas = Array.from(trs[bi].querySelectorAll('th,td')).map(td => td.textContent.replace(/\s+/g, ' ').trim());
    let iS = bas.findIndex(h => /^(S|Sıra|Sira)$/i.test(h)); if (iS < 0) iS = 0;
    const iIsim = bas.findIndex(h => /At\s*İsmi/i.test(h));
    const iGny = bas.findIndex(h => /^Gny$/i.test(h));
    const iNo = bas.findIndex((h, i) => i !== iS && /^(At\s*No|No|Nu|Numara)$/i.test(h));   // at numarası sütunu (isim eşleşmezse yedek)
    const atlar = kosu.atlar.map(a => ({ no: parseInt(a.no), n: nrm(a.isim) })).filter(a => a.no && a.n);
    const sira = [], gn = {};
    trs.slice(bi + 1).forEach(tr => {
      const td = tr.querySelectorAll('td'); if (td.length <= Math.max(iS, iIsim)) return;
      const sr = parseInt(td[iS].textContent.trim()); if (!sr) return;
      T.satir++;
      const rn = nrm(String(td[iIsim].textContent).replace(/\(\s*\d{1,2}\s*\)/g, ' '));   // "LOCO SUGAR(4) (IRE)": (4) at numarasıdır, ülke koduyla isim arasına girip eşleşmeyi bozuyordu
      let best = null;
      atlar.forEach(a => { if (rn.startsWith(a.n) && (!best || a.n.length > best.n.length)) best = a; });
      // Yedek 1: bültendeki isim sonuç sayfasındakinden uzunsa (ek/kısaltma farkı) ters yönde dene
      if (!best && rn.length >= 4) atlar.forEach(a => { if (a.n.startsWith(rn) && (!best || a.n.length > best.n.length)) best = a; });
      // Yedek 1b: isimdeki (no) at numarası; isim tutmazsa (ithal atlar) numarayla eşleştir
      if (!best && !seqFb) { const mN = String(td[iIsim].textContent).match(/\(\s*(\d{1,2})\s*\)/); if (mN) best = atlar.find(a => a.no === +mN[1]) || null; }
      // Yedek 2: isim hiç tutmazsa at numarasıyla eşleştir
      if (!best && !seqFb && iNo >= 0 && td[iNo]) { const hn = parseInt(td[iNo].textContent.trim()); if (hn) best = atlar.find(a => a.no === hn) || (kosu.atlar.find(a => parseInt(a.no) === hn) ? { no: hn, n: rn } : null); }
      if (!best) { T.eslesmeyen.push(sr + '. ' + td[iIsim].textContent.trim().slice(0, 28)); try { console.warn('[sonuç] eşleşmeyen at:', no + '. koşu', sr, td[iIsim].textContent.trim()); } catch (e) {} }
      if (best){ T.eslesen++; sira.push({ sr, no: best.no }); const g = iGny >= 0 && td[iGny] ? td[iGny].textContent.trim() : ''; if (/^\d+[.,]\d+$/.test(g)) gn[best.no] = g; }
    });
    sira.sort((a, b) => a.sr - b.sr);
    // Sıraya göre atanan tabloda atların çoğu isimle tutmalı; yoksa bu kopya/başka tablodur, geri al
    if (seqFb && T.eslesen < Math.max(2, Math.ceil(T.satir * 0.6))) { T.not = 'sıra tahmini doğrulanamadı (kopya tablo olabilir)'; _sonNo = _oncekiNo; _gorulenNo.delete(no); return; }
    const nextB = basliklar.find(b => (tablo.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) && !tablo.contains(b));
    let metin = '';
    try { const rg = dom.createRange(); rg.setStartAfter(tablo); if (nextB) rg.setEndBefore(nextB); else rg.setEndAfter(dom.body.lastChild); metin = rg.cloneContents().textContent || ''; } catch (e) {}
    const bahisler = bahisleriAyristir(metin);
    // Koşu filmi bağlantısı: bu koşunun başlığı ile sonraki koşu başlığı arasındaki YarisVideo bağlantısı
    let vurl = '';
    try {
      const VBASE = 'https://www.tjk.org/TR/yarissever/Info/YarisVideoKosu/Kosu?KosuKodu=';
      // 1) Düz bağlantı: href içinde YarisVideo + KosuKodu
      for (const a of dom.querySelectorAll('a[href]')) {
        const hf = a.getAttribute('href') || '';
        if (!/YarisVideo/i.test(hf) || !/KosuKodu=-?\d+/i.test(hf)) continue;
        if (bHead && !(bHead.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
        if (nextB && !(nextB.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_PRECEDING)) continue;
        { const kk = hf.match(/KosuKodu=(-?\d+)/i); vurl = VBASE + kk[1]; }
        break;
      }
      // 2) Tıklayınca açılan ikon: onclick / data-* / javascript: içindeki koşu kodunu bu koşunun bölümünden oku
      if (!vurl && bHead) {
        const rg2 = dom.createRange();
        rg2.setStartBefore(bHead);
        if (nextB) rg2.setEndBefore(nextB); else rg2.setEndAfter(dom.body.lastChild);
        const box = dom.createElement('div');
        box.appendChild(rg2.cloneContents());
        const raw = box.innerHTML;
        const mp = raw.match(/(?:https?:)?\/\/video-cdn\.tjk\.org\/videoftp\/[^"'\s<>\\]+?\.mp4/i);
        if (mp) vurl = mp[0].indexOf('//') === 0 ? 'https:' + mp[0] : mp[0];
        const m = raw.match(/KosuKodu\W{0,8}?(-?\d{3,})/i) || raw.match(/(?:video|film)\w*\s*\(\s*['"]?(\d{4,})/i) || raw.match(/data-(?:kosu-?kodu|kosukodu|video-?id)\s*=\s*["'](\d{4,})["']/i);
        if (!vurl && m) vurl = VBASE + m[1];
      }
      // 3) Yedek: ikon başlıktan önce duruyorsa bölüm eşleşmez; kod sayısı koşu sayısına eşitse sıraya göre eşle
      if (!vurl && basliklar.length && _allMp4.length === basliklar.length) {
        const u0 = _allMp4[no - 1]; if (u0) vurl = u0.indexOf('//') === 0 ? 'https:' + u0 : u0;
      }
      if (!vurl && basliklar.length && _allCodes.length === basliklar.length) {
        const sc = _allCodes[no - 1]; if (sc) vurl = VBASE + sc;
      }
    } catch (e) {}
    if (seqFb) vurl = '';   // başlık yoksa video bağlantısı yanlış koşuya gidebilir
    try { D.video = D.video || { sayfadaMp4: _allMp4.length, sayfadaKosuKodu: _allCodes.length, baslik: basliklar.length, koşu: {} }; D.video.koşu[no] = vurl || 'YOK'; } catch (e) {}   // teşhis: hangi koşuda video bağlantısı bulundu
    const gk = bahisler.find(b => b.tur === 'Ganyan'), gno = gk ? parseInt(gk.detay) : 0;
    if (gno && !gn[gno]) gn[gno] = gk.tutar;   // kazananın resmi ganyan ödemesi
    T.not = (seqFb ? '[sıraya göre] ' : '') + (sira.length ? (sira[0].sr === 1 ? 'tamam' : 'kazanan at eşleşmedi (ilk sıra ' + sira[0].sr + ')') : 'hiç at eşleşmedi');
    if (sira.length && sira[0].sr === 1){ out[no] = sira.map(x => x.no); gout[no] = gn; bout[no] = bahisler; if (vurl) vout[no] = vurl; }
  })(); } catch (e) { D.hatalar.push(String((e && e.message) || e)); } });
  try {   // teşhis: sayfada video/film ile ilgili ham HTML parçaları (okuyucu neden bulamıyor görmek için)
    D.video = D.video || { sayfadaMp4: _allMp4.length, sayfadaKosuKodu: _allCodes.length, baslik: basliklar.length, koşu: {} };
    D.video.htmlUzunluk = html.length;
    const ornek = [], rx = /YarisVideo|videoftp|KosuKodu|Kosu\s*Film|Yar[ıi]ş\s*Video|data-video|\.mp4/gi; let m2, son = -999;
    while ((m2 = rx.exec(html)) && ornek.length < 6) { if (m2.index - son < 400) continue; son = m2.index; ornek.push(html.slice(Math.max(0, m2.index - 150), m2.index + 250).replace(/\s+/g, ' ')); }
    D.video.ornek = ornek.length ? ornek : 'sayfa HTML\'inde video/film ifadesi HİÇ yok (bağlantı sonradan JavaScript ile ekleniyor olabilir)';
  } catch (e) {}
  try { window.__TESHIS = window.__TESHIS || {}; window.__TESHIS[sehirAdi] = D; } catch (e) {}
  try { vidSet(tarihIso, sehirId, vout); } catch (e) {}
  return { sira: out, gny: gout, bahis: bout, video: vout };
}

// ---- CANLI GANYAN ORANLARI (vhs-medya.tjk.org / muhtemeller) ----
// 1) checksum.json: günün tüm şehir+koşu hash listesi  2) {SEHIR}-{KOSU}-{hash}.json: koşunun ganyan oranları
const CANLI = {};
const canliOku = (k, ms) => { const c = CANLI[k]; return c && Date.now() - c.t < ms ? c.v : null; };
let _direktHata = 0;
async function canliFetch(url) {
  if(Date.now() - _direktHata > 60000) try {
    const zaman = new Promise((_, j) => setTimeout(() => j(new Error('zaman aşımı')), 8000));
    const r = await Promise.race([fetch(url, { cache: 'no-store', mode: 'cors', credentials: 'omit' }), zaman]);
    if (r.ok) return r;
  } catch (e) { _direktHata = Date.now(); /* CORS/ağ: 60 sn worker'a düş */ }
  return fetchWithTimeout(url, 8000, 1);
}
// kosular: [{no}] → {koşuNo: {atNo: oran}}
// Teşhis: CANLI_TESHIS[şehir] = {anahtar, onekler, kosu: {no: durum}}
const CANLI_TESHIS = {};
function canliSehirAnahtari(runs, sehirAdi){
  const onekler = [...new Set(Object.keys(runs).map(k => k.split('-')[0]))];
  const tam = turkceNormalizeAnahtar(String(sehirAdi || '')).replace(/HIPODROMU$/, '');
  const ilk = turkceNormalizeAnahtar(String(sehirAdi || '').trim().split(/\s+/)[0] || '');
  const dene = [ilk, tam];
  // TJK bazı şehirleri kısaltmayla yayınlıyor (ör. Diyarbakır → DBAKIR)
  const TAKMA = {DIYARBAKIR: ['DBAKIR'], SANLIURFA: ['SURFA', 'URFA'], ELAZIG: ['ELAZIG'], KOCAELI: ['KOCAELI', 'IZMIT']};
  for (const d of dene) for (const t of (TAKMA[d] || [])) if (onekler.includes(t)) return {anahtar: t, onekler};
  for (const d of dene) if (d && onekler.includes(d)) return {anahtar: d, onekler};
  // Esnek eşleşme: biri diğerinin başlangıcıysa (örn. DIYARBAKIR / DIYARBAKIRHIPODROMU, KARMA / KARMA1)
  for (const d of dene) {
    if (!d || d.length < 4) continue;
    const e = onekler.find(o => o.length >= 4 && (o.startsWith(d) || d.startsWith(o)));
    if (e) return {anahtar: e, onekler};
  }
  // Kısaltma yedeği: önek, şehir adının harf sırasını koruyan bir alt dizisiyse (DBAKIR ⊂ DIYARBAKIR) ve tek aday varsa
  const altDizi = (kisa, uzun) => { let i = 0; for (const ch of uzun) if (ch === kisa[i]) i++; return i === kisa.length; };
  for (const d of dene) {
    if (!d || d.length < 5) continue;
    const adaylar = onekler.filter(o => o.length >= 4 && o.length < d.length && o[0] === d[0] && altDizi(o, d));
    if (adaylar.length === 1) return {anahtar: adaylar[0], onekler};
  }
  return {anahtar: null, onekler};
}
async function oranlariGetir(sehirAdi, kosular, tarihIso, ttl = 15000) {
  const [y, m, d] = tarihIso.split('-');
  let cs = canliOku('cs' + tarihIso, ttl);
  if (!cs) {
    const r = await canliFetch(`https://vhs-medya.tjk.org/muhtemeller/s/${y}/${m}/${d}/checksum.json`);
    const tx = await r.text(), eskiCs = CANLI['cs' + tarihIso];
    cs = (eskiCs && eskiCs.tx === tx) ? eskiCs.v : JSON.parse(tx);   // değişmediyse ayrıştırma yok
    CANLI['cs' + tarihIso] = { t: Date.now(), v: cs, tx };
  }
  const runs = (cs && cs.runs) || {};
  const {anahtar, onekler} = canliSehirAnahtari(runs, sehirAdi);
  const tesh = CANLI_TESHIS[sehirAdi] = {anahtar, onekler, kosu: {}};
  // Bir önekteki (anahtar) koşuların canlı ganyan oranlarını çeker. dogrula=true: at numaraları programla uyuşmayan koşu kabul edilmez
  const cek = async (anahtar, dogrula) => {
  const out = {};
  await Promise.all(kosular.map(async k => {
    try {
      const key = `${anahtar}-${k.no}`, hs = runs[key];
      if (!hs || !hs.length) { tesh.kosu[k.no] = 'TJK listesinde yok'; return; }
      const ck = key + '-' + hs[0];
      let v = canliOku(ck, ttl);
      if (!v) {
        // Önce ilk hash, olmazsa sonuncusu (liste birden fazla sürüm taşıyabilir)
        let j = null, hata = '';
        for (const h of (hs.length > 1 ? [hs[0], hs[hs.length - 1]] : [hs[0]])) {
          try {
            const r = await canliFetch(`https://vhs-medya-cdn.tjk.org/muhtemeller/s/${y}/${m}/${d}/${key}-${h}.json`);
            if (!r.ok) { hata = 'HTTP ' + r.status; continue; }
            j = await r.json(); if (j) break;
          } catch (e) { hata = (e && e.message) || 'hata'; }
        }
        if (!j) { tesh.kosu[k.no] = 'dosya alınamadı ' + hata; return; }
        const veri = j && j.success && j.data && j.data.muhtemeller;
        if (!veri) { tesh.kosu[k.no] = 'veri yok'; return; }
        const gb = (veri.bahisler || []).find(b => b && (b.cls === 'ganyan' || b.B === 'GANYAN'));
        v = {};
        if (gb && Array.isArray(gb.muhtemeller)) gb.muhtemeller.forEach(x => {
          const no = String((x && (x.S1 ?? x.S)) ?? '').trim(), o = parseFloat(String((x && x.G) ?? '').replace(',', '.'));
          if (no && o > 0) v[no] = o;
        });
        CANLI[ck] = { t: Date.now(), v };
      }
      const n = Object.keys(v).length;
      if (dogrula && n) {
        const nos = new Set((k.atlar || []).map(a => String(parseInt(a.no))));
        if (!Object.keys(v).every(x => nos.has(String(parseInt(x)))) || n < nos.size - 1) { tesh.kosu[k.no] = 'at numaraları uyuşmadı'; return; }
      }
      tesh.kosu[k.no] = n ? n + ' at oran' : 'ganyan oranı boş';
      if (n) out[k.no] = v;
    } catch (e) { tesh.kosu[k.no] = 'hata'; }
  }));
  return out;
  };
  if (anahtar) return cek(anahtar, false);
  // Karma: TJK oran listesinde "KARMA" adıyla bulunamadıysa, başka bir şehre ait olmayan önekleri dene;
  // at numaraları programla birebir uyuşan önek Karma'nın oranlarıdır
  if (/^KARMA/.test(turkceNormalizeAnahtar(String(sehirAdi || '')))) {
    // TJK Karma koşularını diğer hipodromların koşularından oluşturuyor: her Karma koşusunu at isimleriyle kaynak koşuya bağla,
    // oranları kaynak şehrin canlı verisinden al (at numaraları farklıysa isimle eşle)
    try {
      const diger0 = (typeof CITIES !== 'undefined' ? CITIES : []).filter(c => c !== sehirAdi);
      const nm = a => turkceNormalizeAnahtar(a.isim);
      const harita = {};   // karmaKoşuNo → {c, r, kaynakAtlar}
      kosular.forEach(k => {
        const adlar = (k.atlar || []).map(nm).filter(Boolean); if (adlar.length < 2) return;
        let en = null, enSkor = 0;
        diger0.forEach(c => (typeof raceList === 'function' ? raceList(c) : []).forEach(r => {
          const kay = new Set((r.atlar || []).map(nm));
          const skor = adlar.filter(x => kay.has(x)).length + (r.saat && r.saat === k.saat ? 0.5 : 0);
          if (skor > enSkor) { enSkor = skor; en = {c, r: +r.no, atlar: r.atlar || []}; }
        }));
        if (en && enSkor >= Math.max(2, Math.ceil(adlar.length * 0.6))) harita[k.no] = en;
      });
      const nos = Object.keys(harita);
      if (nos.length) {
        const kaynakCanli = {};   // 'şehir|koşu' → {atNo: oran}
        const gruplar = {};
        nos.forEach(n => { (gruplar[harita[n].c] = gruplar[harita[n].c] || []).push(raceList(harita[n].c).find(x => +x.no === harita[n].r)); });
        for (const c of Object.keys(gruplar)) {
          const ayri = Object.assign({}, CANLI_TESHIS[c]);
          const o = await oranlariGetir(c, gruplar[c].filter(Boolean), tarihIso, ttl);
          CANLI_TESHIS[c] = ayri.anahtar !== undefined ? ayri : CANLI_TESHIS[c];
          Object.keys(o).forEach(r => { kaynakCanli[c + '|' + r] = o[r]; });
        }
        const out2 = {};
        tesh.kosu = {};
        kosular.forEach(k => {
          const h = harita[k.no];
          if (!h) { tesh.kosu[k.no] = 'kaynak koşu bulunamadı'; return; }
          const src = kaynakCanli[h.c + '|' + h.r];
          if (!src) { tesh.kosu[k.no] = h.c + ' ' + h.r + '. koşu: oran yok'; return; }
          const adNo = {}; h.atlar.forEach(a => { adNo[nm(a)] = String(parseInt(a.no)); });
          const v = {};
          (k.atlar || []).forEach(a => { const so = adNo[nm(a)]; const o = so != null ? src[so] : null; if (o > 0) v[String(parseInt(a.no))] = o; });
          const n = Object.keys(v).length;
          tesh.kosu[k.no] = h.c + ' ' + h.r + '. koşudan · ' + n + ' at oran';
          if (n) out2[k.no] = v;
        });
        if (Object.keys(out2).length) { tesh.anahtar = 'diğer koşulardan'; return out2; }
      }
    } catch (e) { tesh.kosu = {}; }
    const diger = new Set();
    (typeof CITIES !== 'undefined' ? CITIES : []).forEach(c => { if (c !== sehirAdi) { const a = canliSehirAnahtari(runs, c).anahtar; if (a) diger.add(a); } });
    let en = null, enOut = {};
    const adaylar = onekler.filter(o => !diger.has(o)), dn = [];
    for (const a of adaylar) {
      tesh.kosu = {};
      const o = await cek(a, true);
      dn.push(a + ': ' + Object.keys(o).length + '/' + kosular.length + ' koşu uydu (' + (Object.values(tesh.kosu).slice(0, 2).join('; ') || '—') + ')');
      if (Object.keys(o).length > Object.keys(enOut).length) { en = a; enOut = o; }
    }
    tesh.deneme = adaylar.length ? dn.join(' | ') : 'Karma dışında kalan aday önek yok · TJK listesi: ' + (onekler.join(', ') || 'boş') + ' · diğer şehirlerle eşleşen: ' + ([...diger].join(', ') || '—');
    if (en) { tesh.anahtar = en + ' (eşleştirildi)'; tesh.kosu = {}; return cek(en, true); }
    tesh.kosu = {};
  }
  return {};
}

return { bugunIso, sehirleriGetir, sehirProgramiGetir, sonuclariGetir, oranlariGetir, parseKosular, fetchHtml: async url => (await fetchWithTimeout(url, 20000, 1)).text() };
})();

module.exports = TJK;
