// ============ ACCURACE: "Son koşu analizi" kutusu ============
// Atın TJK profilinden son koşularını (tarih + hipodrom) alır, o günün Accurace sayfalarını
// aynı worker üzerinden çekip atı adıyla bulur ve kartta düz Türkçe bir etiketle gösterir.
// Veriler cihazda saklanır: aynı koşuyu bir daha çekmez (bir koşu sayfası tüm atlara yeter).
(function(){
  var ACC_TTL = 12 * 3600 * 1000;        // at sonucu cihazda 12 saat
  var BOS_TTL = 6 * 3600 * 1000;         // boş koşu sayfası 6 saat
  var FAIL_MS = 120000;                  // hata sonrası 2 dk bekle, sonra yeniden dene
  var SON_N = 2;                          // her at için bakılacak son koşu sayısı
  var KEY = 'gs_acc_v4', RKEY = 'gs_accr_v4_';
  var S = { c: {}, fail: {}, err: {}, busy: {}, q: [], run: 0, fly: {} };
  try { S.c = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch(e){ S.c = {}; }
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(S.c)); } catch(e){} }
  var bekle = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };

  // ---- ad / şehir / süre yardımcıları ----
  function adNorm(s){
    var f = { 'Ç':'C','Ğ':'G','İ':'I','I':'I','Ö':'O','Ş':'S','Ü':'U' };
    return String(s || '').toLocaleUpperCase('tr-TR').replace(/\(.*?\)/g, '').replace(/[ÇĞİÖŞÜ]/g, function(c){ return f[c]; }).replace(/[^A-Z0-9]/g, '');
  }
  function sehirKodu(a){ return adNorm(a).replace(/HIPODROMU$/, ''); }
  function tarihIso(t){ var m = String(t || '').match(/(\d{2})[.\/](\d{2})[.\/](\d{4})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : null; }
  function pistGec(p){
    p = String(p || '').trim();
    if(/^K$/i.test(p)) return 'Kum'; if(/^[ÇC]$/i.test(p)) return 'Çim'; if(/^S$/i.test(p)) return 'Sentetik';
    var m = p.match(/Kum|[ÇC][iİ]m|Sentetik/i); if(!m) return '';
    return /^k/i.test(m[0]) ? 'Kum' : /^s/i.test(m[0]) ? 'Sentetik' : 'Çim';
  }
  function sureCevir(v){
    var s = String(v || '').trim().replace(/''/g, '.').replace(/'/g, ':').replace(',', '.');
    var p = s.split(':');
    if(p.length === 2) return Number(p[0]) * 60 + Number(p[1]);
    var n = Number(s); return isFinite(n) ? n : null;
  }
  function adBul(m, ad){
    if(!m || !ad) return null;
    if(m[ad]) return m[ad];
    if(ad.length < 4) return null;
    var k = Object.keys(m).find(function(x){ return x.length >= 4 && (x.indexOf(ad) === 0 || ad.indexOf(x) === 0); });
    return k ? m[k] : null;
  }

  // ---- Accurace HTML -> koşu verisi (ağaç değiştirilmez, sadece satırlar okunur: hızlı) ----
  function hucreMetni(n){
    var t = []; (function gez(x){
      for(var c = x.firstChild; c; c = c.nextSibling){
        if(c.nodeType === 3){ var v = c.nodeValue.replace(/\s+/g, ' ').trim(); if(v) t.push(v); } else if(c.nodeType === 1) gez(c);
      }
    })(n); return t.join(' ');
  }
  function kosuHazirla(html){
    var doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    var sayi = function(x){ var n = Number(String(x == null ? '' : x).replace(',', '.')); return isFinite(n) && String(x == null ? '' : x).trim() !== '' ? n : null; };
    var liste = [], sayac = 0, trs = doc.querySelectorAll('tr');
    for(var i = 0; i < trs.length; i++){
      var cells = [], ch = trs[i].children;
      for(var k = 0; k < ch.length; k++) if(/^(TD|TH)$/i.test(ch[k].tagName)) cells.push(hucreMetni(ch[k]));
      if(cells.length < 10) continue;
      var m = cells[0].match(/^(\d+)\s+(.+)$/); if(!m) continue;
      liste.push({ no: m[1], isim: m[2], sira: ++sayac, sure: sureCevir(cells[1]), mesafe: sayi(cells[9]), delta: (cells[10] === '-' ? 0 : sayi(cells[10])) });
    }
    if(!liste.length) return null;
    doc.querySelectorAll('script,style').forEach(function(n){ n.remove(); });
    var hb = (doc.body ? doc.body.textContent : '').match(/(\d{2}\.\d{2}\.\d{4})\s*\/\s*(\d+)\s*Metre\s*([^\n|]*)/i);
    var s100 = liste.filter(function(x){ return x.sure > 0; }).sort(function(a, b){ return a.sure - b.sure; });
    return { meta: { tarih: hb ? hb[1] : null, mesafe: hb ? +hb[2] : null, pist: hb ? pistGec(hb[3]) : '', s100en: s100.length ? s100[0].sure : null }, n: liste.length,
      atlar: liste.map(function(x){ return { no: x.no, isim: x.isim, sira: x.sira, sure: x.sure, delta: x.delta, mesafe: x.mesafe, s100sira: s100.indexOf(x) + 1 || null }; }) };
  }

  // ---- ağ: en çok 4 eşzamanlı istek, ayrıştırma ekran boştayken (donma yok) ----
  var fRun = 0, fQ = [];
  function drain(){
    while(fRun < 4 && fQ.length){
      var it = fQ.shift(); fRun++;
      Promise.resolve().then(it.fn).then(it.res, it.rej).then(function(){ fRun--; drain(); });
    }
  }
  function limit(fn){ return new Promise(function(res, rej){ fQ.push({ fn: fn, res: res, rej: rej }); drain(); }); }
  function bosta(){ return new Promise(function(r){ if(window.requestIdleCallback) requestIdleCallback(function(){ r(); }, { timeout: 250 }); else setTimeout(r, 20); }); }
  var yok404 = function(e){ return /\b404\b/.test(String((e && e.message) || e)); };

  // ---- Accurace koşu sayfası (cihaz önbellekli, aynı anda tek istek) ----
  function kosuGetir(iso, kod, no){
    var key = RKEY + iso + '_' + kod + '_' + no;
    try { var c = JSON.parse(localStorage.getItem(key) || 'null'); if(c && (!c.bos || Date.now() - c.t < BOS_TTL)) return Promise.resolve(c.bos ? null : c.v); } catch(e){}
    if(S.fly[key]) return S.fly[key];
    var url = 'https://accurace.net/network/' + iso + '/' + kod + '/' + no;
    var yaz = function(v){ try { localStorage.setItem(key, JSON.stringify(v ? { t: Date.now(), v: v } : { t: Date.now(), bos: 1 })); } catch(e){} };
    return S.fly[key] = limit(function(){ return TJK.fetchHtml(url); }).then(function(html){
      return bosta().then(function(){ var v = kosuHazirla(html); yaz(v); return v; });
    }).catch(function(e){
      if(yok404(e)){ yaz(null); return null; }
      throw e;
    }).then(function(v){ delete S.fly[key]; return v; }, function(e){ delete S.fly[key]; throw e; });
  }
  async function kosuGetirDene(iso, kod, no){
    try { return await kosuGetir(iso, kod, no); } catch(e){ await bekle(1200); return await kosuGetir(iso, kod, no); }
  }
  // Bir günün tüm koşuları: 4'erli paralel çekilir, 2 boş koşuda durur. Aynı gün için tek tarama, tüm atlar paylaşır.
  var GUN = {};
  function gunTara(iso, kod){
    var gk = iso + '|' + kod; if(GUN[gk]) return GUN[gk];
    return GUN[gk] = (async function(){
      var out = { kosular: {}, hata: false }, no = 1, bos = 0, dur = false;
      while(no <= 12 && !dur){
        var grup = []; for(var i = 0; i < 4 && no + i <= 12; i++) grup.push(no + i);
        var res = await Promise.all(grup.map(function(n){ return kosuGetirDene(iso, kod, n).catch(function(){ return undefined; }); }));
        for(var j = 0; j < res.length; j++){
          if(res[j] === undefined){ out.hata = true; continue; }
          if(!res[j]){ if(++bos >= 2){ dur = true; break; } } else { bos = 0; out.kosular[grup[j]] = res[j]; }
        }
        no += 4;
      }
      if(out.hata) setTimeout(function(){ delete GUN[gk]; }, 60000);   // ağ hatası olduysa bir dakika sonra yeniden denenebilsin
      return out;
    })();
  }

  // ---- atın TJK profilinden son koşuları: [{t, sira, hip}] (en yeni başta) ----
  async function atGecmis(atId){
    var url = 'https://www.tjk.org/TR/yarissever/Query/ConnectedPage/AtKosuBilgileri?1=1&QueryParameter_AtId=' + encodeURIComponent(atId);
    var html = await limit(function(){ return TJK.fetchHtml(url); });
    var dom = new DOMParser().parseFromString(html, 'text/html');
    var norm = function(s){ return String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); };
    var tabs = dom.querySelectorAll('table');
    for(var ti = 0; ti < tabs.length; ti++){
      var rows = Array.prototype.slice.call(tabs[ti].querySelectorAll('tr'));
      var hi = rows.findIndex(function(tr){ var t = norm(tr.textContent); return /Tarih/i.test(t) && /Derece/i.test(t); });
      if(hi < 0) continue;
      var heads = Array.prototype.map.call(rows[hi].querySelectorAll('th,td'), function(c){ return norm(c.textContent).toLowerCase(); });
      var iT = heads.findIndex(function(h){ return h.indexOf('tarih') === 0; });
      var iS = heads.findIndex(function(h){ return h === 's' || /^s[ıi]ra/.test(h); });
      var iH = heads.findIndex(function(h){ return /hip|şehir|sehir/.test(h); });
      var iM = heads.findIndex(function(h){ return /msf|mesafe/.test(h); });
      var iP = heads.findIndex(function(h, i){ return i !== iM && /pist|zemin/.test(h); });
      if(iT < 0 || iH < 0) continue;
      var out = [];
      for(var i = hi + 1; i < rows.length && out.length < SON_N; i++){
        var td = rows[i].querySelectorAll('td'); if(td.length <= iH || td.length <= iT) continue;
        var t = norm(td[iT].textContent); if(!/\d{2}\.\d{2}\.\d{4}/.test(t)) continue;
        var sr = iS >= 0 && td[iS] ? parseInt(norm(td[iS].textContent), 10) : NaN;
        var pt = iP >= 0 && td[iP] ? norm(td[iP].textContent) : (iM >= 0 && td[iM] ? ((td[iM].querySelector('[title],img[alt]') || {}).title || '') : '');
        out.push({ t: t.match(/\d{2}\.\d{2}\.\d{4}/)[0], sira: isFinite(sr) ? sr : null, hip: norm(td[iH].textContent), pist: pistGec(pt) });
      }
      return out;
    }
    return [];
  }

  async function atiBul(iso, kod, ad){
    var g = await gunTara(iso, kod), nolar = Object.keys(g.kosular).map(Number).sort(function(a, b){ return a - b; });
    for(var i = 0; i < nolar.length; i++){
      var k = g.kosular[nolar[i]], m = {};
      k.atlar.forEach(function(a){ m[adNorm(a.isim)] = a; });
      var a = adBul(m, ad);
      if(a) return { k: k, a: a, no: nolar[i], hata: false };
    }
    return { hata: g.hata };
  }
  // Dönüş: ham sayılar (etiket görüntülenirken hesaplanır) | {n:1} (Accurace'te kayıt yok)
  async function atSonAccurace(atId, isim){
    var ad = adNorm(isim), rows;
    try { rows = await atGecmis(atId); } catch(e){ if(yok404(e)) return { n: 1 }; throw e; }
    var hata = false;
    for(var i = 0; i < rows.length; i++){
      var r = rows[i], iso = tarihIso(r.t), kod = sehirKodu(String(r.hip).split(/\s+/)[0]); if(!iso || !kod) continue;
      var b = await atiBul(iso, kod, ad);
      if(b.k) return { t: r.t, hip: r.hip.replace(/\s*Hipodromu$/i, ''), no: b.no, pist: pistGec(b.k.meta.pist) || r.pist || '', mesafe: b.k.meta.mesafe, n: b.k.n,
        sira: r.sira || b.a.sira, delta: b.a.delta, s100: b.a.sure, s100sira: b.a.s100sira, s100en: b.k.meta.s100en };
      if(b.hata) hata = true;
    }
    if(hata) throw new Error('Accurace şu an yanıt vermedi');
    return { n: 1 };
  }

  // ---- etiket kuralı (konuştuğumuz eşikler) ----
  function etiket(g){
    var ucte1 = Math.ceil(g.n / 3), ucte2 = Math.ceil(g.n * 2 / 3);
    var hizli = g.s100sira && g.s100sira <= ucte1, yavas = g.s100sira && g.s100sira > ucte2;
    if(g.delta != null && g.delta >= 5 && hizli) return { c: 'acc-g', e: '🟢', y: 'Şanssız koştu, güçlü' };
    if(g.delta != null && g.delta <= -2) return { c: 'acc-o', e: '🟠', y: 'Sonucu şişmiş olabilir' };
    if(yavas && g.sira !== 1) return { c: 'acc-r', e: '🔴', y: 'Finişte tükendi' };
    return { c: 'acc-n', e: '⚪', y: 'Normal koştu' };
  }
  var vir = function(x, d){ return Number(x).toFixed(d == null ? 1 : d).replace('.', ','); };
  // Satır: [renk sınıfı, kalın durum yazısı, açıklama]. pos=yeşil, warn=turuncu, bad=kırmızı, nt=gri
  function yolSatiri(g){
    if(g.delta == null) return null;
    if(g.delta >= 2) return ['pos', 'Dışarıdan dolaştı', vir(g.delta) + ' m fazla yol koştu, sonucu olduğundan kötü görünüyor'];
    if(g.delta <= -2) return ['warn', 'Kısa yoldan gitti', vir(-g.delta) + ' m az yol koştu, sonucu olduğundan iyi görünüyor'];
    return ['nt', 'Yolu sıradandı', 'kazananla yol farkı çok az (' + (g.delta > 0 ? '+' : g.delta < 0 ? '−' : '') + vir(Math.abs(g.delta)) + ' m)'];
  }
  function finisSatiri(g){
    if(!g.s100sira || !g.s100) return null;
    var u1 = Math.ceil(g.n / 3), u2 = Math.ceil(g.n * 2 / 3);
    var fark = g.s100en != null ? g.s100 - g.s100en : null;
    var d = vir(g.s100, 2) + ' sn' + (fark != null && fark > 0.004 ? ' · koşunun en hızlı atından ' + vir(fark, 2) + ' sn geride' : fark != null ? ' · koşunun en hızlı finişi' : '');
    if(g.s100sira === 1) return ['pos', 'Finişte koşunun en hızlısıydı', vir(g.s100, 2) + ' sn'];
    if(g.s100sira <= u1) return ['pos', 'Finişte güçlüydü', d];
    if(g.s100sira > u2) return ['bad', 'Finişte zayıftı', d];
    return ['nt', 'Finişi ortalamaydı', d];
  }
  function yolMetni(g){ var r = yolSatiri(g); return r ? r[1] + ' · ' + r[2] + '. ' : ''; }
  function finisMetni(g){ var r = finisSatiri(g); return r ? r[1] + ' · ' + r[2] + '.' : ''; }
  function gunMetni(t){
    var m = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/.exec(t || ''); if(!m) return '';
    var n = Math.floor((new Date().setHours(0,0,0,0) - new Date(+m[3], +m[2] - 1, +m[1]).getTime()) / 86400000);
    if(!(n >= 0)) return '';
    return n === 0 ? 'Bugün' : n === 1 ? 'Dün' : n < 60 ? n + ' gün önce' : n < 730 ? Math.round(n / 30) + ' ay önce' : Math.floor(n / 365) + ' yıl önce';
  }

  // ---- görünüm ----
  var get = function(id){ var g = S.c[id]; return g && Date.now() - g.ts < ACC_TTL ? g : null; };
  function inner(id){
    var g = get(id), E = 'Son koşu analizi';
    if(!g){
      if(S.fail[id] && Date.now() - S.fail[id] < FAIL_MS) return '<small>' + E + '</small><b class="gm">Şimdilik alınamadı</b><div class="acc-t">Biraz sonra kendiliğinden tekrar denenecek.' + (S.err[id] ? ' (' + esc(S.err[id]) + ')' : '') + '</div>';
      return '<small>' + E + '</small><b class="gm">Aranıyor…</b>';
    }
    if(g.n === 1 && !g.t) return '<small>' + E + '</small><b class="gm">Accurace verisi yok</b><div class="acc-t">Son koşuları Accurace kapsamında değil.</div>';
    var e = etiket(g), gun = gunMetni(g.t), pist = pistGec(g.pist);
    var bilgi = [g.t, g.hip, g.mesafe ? g.mesafe + ' m' + (pist ? ' ' + pist : '') : pist, g.no + '. Koşu'].filter(Boolean).map(esc).join(' · ');
    var satir = function(k, r){ return r ? '<div class="acc-r2"><span class="acc-k">' + k + '</span><span class="acc-v"><b class="' + r[0] + '">' + esc(r[1]) + '</b> · ' + esc(r[2]) + '</span></div>' : ''; };
    var pc = g.sira === 1 ? ' p1' : g.sira === 2 ? ' p2' : g.sira === 3 ? ' p3' : g.sira >= 6 ? ' bk' : '';
    var sirap = g.sira ? '<span class="acc-p' + pc + '">' + g.sira + '. geldi <i>/ ' + g.n + ' at</i></span>' : '<span class="acc-p"><i>' + g.n + ' at</i></span>';
    return '<small>' + E + (gun ? ' · ' + esc(gun) : '') + '</small>'
      + '<div class="acc-h"><b>' + e.e + ' ' + esc(e.y) + '</b>' + sirap + '</div>'
      + '<div class="acc-m">' + bilgi + '</div>'
      + satir('Yol', yolSatiri(g)) + satir('Son 100 m', finisSatiri(g));
  }
  function cls(id){ var g = get(id); return g && g.t ? etiket(g).c : 'acc-n'; }
  window.accBlock = function(d, h){
    if(!d || !d.atId || !h || !h.name) return '';
    return '<div class="hacc ' + cls(d.atId) + '" data-id="' + esc(d.atId) + '" data-ad="' + esc(h.name) + '">' + inner(d.atId) + '</div>';
  };
  function yenile(id){
    document.querySelectorAll('.hacc[data-id="' + id + '"]').forEach(function(el){
      el.innerHTML = inner(id); el.className = 'hacc ' + cls(id);
    });
  }

  // ---- kuyruk: aynı anda en çok 2 at, ekrandakiler önce ----
  function pompa(){
    if(document.hidden) return;
    while(S.run < 2 && S.q.length){
      (function(it){
        S.run++;
        atSonAccurace(it.id, it.ad).then(function(r){
          S.c[it.id] = Object.assign({ ts: Date.now() }, r); save(); delete S.fail[it.id]; delete S.err[it.id];
        }).catch(function(e){
          S.fail[it.id] = Date.now(); S.err[it.id] = String((e && e.message) || e).slice(0, 60);
        }).finally(function(){
          S.run--; delete S.busy[it.id]; yenile(it.id); setTimeout(pompa, 250);
        });
      })(S.q.shift());
    }
  }
  window.accYukle = function(root){
    var gor = [];
    root.querySelectorAll('.hacc[data-id]').forEach(function(el){
      var id = el.dataset.id;
      if(get(id)) return;
      if(S.fail[id] && Date.now() - S.fail[id] < FAIL_MS) return;
      if(S.busy[id]) return;
      S.busy[id] = 1; gor.push({ id: id, ad: el.dataset.ad });
    });
    S.q.unshift.apply(S.q, gor); pompa();
  };
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) pompa(); });
  window.__acc = { pistGec: pistGec, adNorm: adNorm, kosuHazirla: kosuHazirla, etiket: etiket, yolMetni: yolMetni, finisMetni: finisMetni };
})();
