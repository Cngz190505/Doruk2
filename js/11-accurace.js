// ============ ACCURACE: "Son koşu analizi" kutusu ============
// Atın TJK profilinden son koşularını (tarih + hipodrom) alır, o günün Accurace sayfalarını
// aynı worker üzerinden çekip atı adıyla bulur ve kartta düz Türkçe bir etiketle gösterir.
// Veriler cihazda saklanır: aynı koşuyu bir daha çekmez (bir koşu sayfası tüm atlara yeter).
(function(){
  var ACC_TTL = 12 * 3600 * 1000;        // at sonucu cihazda 12 saat
  var BOS_TTL = 6 * 3600 * 1000;         // boş koşu sayfası 6 saat
  var SON_N = 2;                          // her at için bakılacak son koşu sayısı
  var KEY = 'gs_acc_v2', RKEY = 'gs_accr_v2_';
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

  // ---- Accurace HTML -> tablo metni -> koşu verisi (eski uygulamadaki çalışan yöntemle aynı) ----
  function htmlMetne(html){
    var doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    doc.querySelectorAll('script,style,noscript').forEach(function(n){ n.remove(); });
    function metin(n){ var t = []; (function gez(x){
      x.childNodes.forEach(function(c){ if(c.nodeType === 3){ var v = c.nodeValue.replace(/\s+/g, ' ').trim(); if(v) t.push(v); } else if(c.nodeType === 1) gez(c); });
    })(n); return t.join(' '); }
    doc.querySelectorAll('tr').forEach(function(tr){
      var h = Array.prototype.filter.call(tr.children, function(c){ return /^(TD|TH)$/i.test(c.tagName); }).map(metin);
      if(!h.length) return;
      tr.replaceWith(doc.createTextNode('\n| ' + h.join(' | ') + ' |\n'));
    });
    doc.querySelectorAll('br,p,div,li,h1,h2,h3,h4,h5,h6,span,section').forEach(function(n){ n.insertAdjacentText('afterend', '\n'); });
    return (doc.body ? doc.body.textContent : '').replace(/\n\s*\n+/g, '\n');
  }
  function metinAyristir(metin){
    var atlar = {}, sayac = 0, sayi = function(x){ var n = Number(String(x == null ? '' : x).replace(',', '.')); return isFinite(n) && String(x).trim() !== '' ? n : null; };
    String(metin || '').split('\n').filter(function(x){ return /^\|\s*\d+\s+/.test(x); }).forEach(function(satir){
      var c = satir.split('|').map(function(x){ return x.trim(); }); if(c.length < 12) return;
      var m = c[1].match(/^(\d+)\s+(.+)$/); if(!m) return;
      atlar[m[1]] = { no: m[1], isim: m[2], sira: ++sayac, sure: sureCevir(c[2]), sonSure: sureCevir(c[7]), mesafe: sayi(c[10]), delta: (c[11] === '-' ? 0 : sayi(c[11])), fark: sayi(c[12]) };
    });
    var hb = String(metin || '').match(/(\d{2}\.\d{2}\.\d{4})\s*\/\s*(\d+)\s*Metre\s*([^\n|]*)/i);
    return { atlar: atlar, meta: { tarih: hb ? hb[1] : null, mesafe: hb ? +hb[2] : null, pist: hb ? pistGec(hb[3]) : '' } };
  }
  // Koşudaki her atın son 100 m sırası (en kısa süre = 1) ile birlikte, saklamaya uygun sade liste
  function kosuHazirla(metin){
    var d = metinAyristir(metin), liste = Object.keys(d.atlar).map(function(k){ return d.atlar[k]; });
    if(!liste.length) return null;
    var s100 = liste.filter(function(x){ return x.sure > 0; }).sort(function(a, b){ return a.sure - b.sure; });
    return { meta: d.meta, n: liste.length, atlar: liste.map(function(x){
      return { no: x.no, isim: x.isim, sira: x.sira, sure: x.sure, delta: x.delta, mesafe: x.mesafe, s100sira: s100.indexOf(x) + 1 || null };
    }) };
  }

  // ---- Accurace koşu sayfası (cihaz önbellekli, aynı anda tek istek) ----
  function kosuGetir(iso, kod, no){
    var key = RKEY + iso + '_' + kod + '_' + no;
    try { var c = JSON.parse(localStorage.getItem(key) || 'null'); if(c && (!c.bos || Date.now() - c.t < BOS_TTL)) return Promise.resolve(c.bos ? null : c.v); } catch(e){}
    if(S.fly[key]) return S.fly[key];
    var url = 'https://accurace.net/network/' + iso + '/' + kod + '/' + no;
    return S.fly[key] = TJK.fetchHtml(url).then(function(html){
      var v = kosuHazirla(htmlMetne(html));
      try { localStorage.setItem(key, JSON.stringify(v ? { t: Date.now(), v: v } : { t: Date.now(), bos: 1 })); } catch(e){}
      return v;
    }).catch(function(e){
      if(/\b404\b/.test(String((e && e.message) || e))){ try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), bos: 1 })); } catch(_){} return null; }
      throw e;
    }).finally(function(){ delete S.fly[key]; });
  }
  async function kosuGetirDene(iso, kod, no){
    try { return await kosuGetir(iso, kod, no); } catch(e){ await bekle(1500); return await kosuGetir(iso, kod, no); }
  }

  // ---- atın TJK profilinden son koşuları: [{t, sira, hip}] (en yeni başta) ----
  async function atGecmis(atId){
    var url = 'https://www.tjk.org/TR/yarissever/Query/ConnectedPage/AtKosuBilgileri?1=1&QueryParameter_AtId=' + encodeURIComponent(atId);
    var html = await TJK.fetchHtml(url);
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

  // Bir günün koşularını sırayla tarar, atı bulunca durur (2 boş koşuda da durur)
  async function atiBul(iso, kod, ad){
    var bos = 0;
    for(var no = 1; no <= 12; no++){
      var k = await kosuGetirDene(iso, kod, no);
      if(!k){ if(++bos >= 2) break; continue; }
      bos = 0;
      var m = {}; k.atlar.forEach(function(a){ m[adNorm(a.isim)] = a; });
      var a = adBul(m, ad);
      if(a) return { k: k, a: a, no: no };
    }
    return null;
  }
  // Dönüş: ham sayılar (etiket görüntülenirken hesaplanır) | {n:1} (Accurace'te kayıt yok)
  async function atSonAccurace(atId, isim){
    var ad = adNorm(isim), rows = await atGecmis(atId);
    for(var i = 0; i < rows.length; i++){
      var r = rows[i], iso = tarihIso(r.t), kod = sehirKodu(r.hip); if(!iso || !kod) continue;
      var b = await atiBul(iso, kod, ad);
      if(b) return { t: r.t, hip: r.hip.replace(/\s*Hipodromu$/i, ''), no: b.no, pist: pistGec(b.k.meta.pist) || r.pist || '', mesafe: b.k.meta.mesafe, n: b.k.n,
        sira: r.sira || b.a.sira, delta: b.a.delta, s100: b.a.sure, s100sira: b.a.s100sira };
    }
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
  // Satırlar: [renk sınıfı, açıklama]. pos=yeşil, warn=turuncu, bad=kırmızı, nt=nötr
  function yolSatiri(g){
    if(g.delta == null) return null;
    if(g.delta >= 2) return ['pos', 'Dışarıdan dolaştı · ' + vir(g.delta) + ' m fazla yol koştu'];
    if(g.delta <= -2) return ['warn', 'Kısa yoldan gitti · ' + vir(-g.delta) + ' m az yol koştu'];
    return ['nt', 'Yol farkı az · ' + (g.delta > 0 ? '+' : g.delta < 0 ? '−' : '') + vir(Math.abs(g.delta)) + ' m'];
  }
  function finisSatiri(g){
    if(!g.s100sira || !g.s100) return null;
    var u1 = Math.ceil(g.n / 3), u2 = Math.ceil(g.n * 2 / 3), sn = vir(g.s100, 2) + ' sn';
    if(g.s100sira === 1) return ['pos', sn + ' · koşunun en hızlısı'];
    if(g.s100sira <= u1) return ['pos', sn + ' · ' + g.s100sira + '. en hızlı (' + g.n + ' at içinde)'];
    if(g.s100sira > u2) return ['bad', sn + ' · yavaşladı, bitirişi zayıf (' + g.s100sira + '. en hızlı)'];
    return ['nt', sn + ' · ortalama (' + g.s100sira + '. en hızlı)'];
  }
  function yolMetni(g){ var r = yolSatiri(g); return r ? r[1] + '. ' : ''; }
  function finisMetni(g){ var r = finisSatiri(g); return r ? r[1] + '.' : ''; }
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
      if(S.fail[id] && Date.now() - S.fail[id] < 600000) return '<small>' + E + '</small><b class="gm">Alınamadı</b>' + (S.err[id] ? '<div class="acc-t">' + esc(S.err[id]) + '</div>' : '');
      return '<small>' + E + '</small><b class="gm">Aranıyor…</b>';
    }
    if(g.n === 1 && !g.t) return '<small>' + E + '</small><b class="gm">Accurace verisi yok</b><div class="acc-t">Son koşuları Accurace kapsamında değil.</div>';
    var e = etiket(g), gun = gunMetni(g.t), pist = pistGec(g.pist);
    var bilgi = [g.t, g.hip, g.mesafe ? g.mesafe + ' m' + (pist ? ' ' + pist : '') : pist, g.no + '. Koşu'].filter(Boolean).map(esc).join(' · ');
    var satir = function(k, r){ return r ? '<div class="acc-r2"><span class="acc-k">' + k + '</span><span class="acc-v ' + r[0] + '">' + esc(r[1]) + '</span></div>' : ''; };
    var sirap = g.sira ? '<span class="acc-p">' + g.sira + '. geldi <i>/ ' + g.n + ' at</i></span>' : '<span class="acc-p"><i>' + g.n + ' at</i></span>';
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
          S.fail[it.id] = Date.now(); S.err[it.id] = String((e && e.message) || e).slice(0, 200);
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
      if(S.fail[id] && Date.now() - S.fail[id] < 600000) return;
      if(S.busy[id]) return;
      S.busy[id] = 1; gor.push({ id: id, ad: el.dataset.ad });
    });
    S.q.unshift.apply(S.q, gor); pompa();
  };
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) pompa(); });
  window.__acc = { pistGec: pistGec, adNorm: adNorm, metinAyristir: metinAyristir, kosuHazirla: kosuHazirla, etiket: etiket, yolMetni: yolMetni, finisMetni: finisMetni };
})();
