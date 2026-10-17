// ---- Banko: paylaşırken at seçme paneli ----
let bk = {text:'', city:'İstanbul', race:1, no:0};
function openBanko(text){
  bk = {text, city, race: Math.min(race, raceCount(city) || 1), no: 0};
  renderBanko();
  $('bsheet').classList.remove('hidden');
}
function closeBanko(){ $('bsheet').classList.add('hidden'); }
function bkCity(c){ bk.city = c; bk.no = 0; renderBanko(); }
function bkRace(r){ bk.race = r; bk.no = 0; renderBanko(); }
function bkPick(n){ bk.no = bk.no === n ? 0 : n; renderBanko(); }
function renderBanko(){
  const hs = horsesFor(bk.city, bk.race);
  $('bsheet-body').innerHTML = `
    <div class="hint">“${esc(bk.text)}”</div>
    <div class="chips">${CITIES.map(c => `<button class="chip ${c===bk.city?'on':''}" onclick="bkCity('${c}')">${c}</button>`).join('')}</div>
    <div class="chips" id="bk-races">${Array.from({length:raceCount(bk.city)}, (_, i) => i + 1).map(r => `<button class="chip ${r===bk.race?'on':''}" onclick="bkRace(${r})">${r}. Koşu</button>`).join('')}</div>
    ${hs.map(h => `<div class="hr ${bk.no===h.no?'on':''}" onclick="bkPick(${h.no})">
      ${sc(h.no)}
      <div class="hn"><b>${esc(h.name)}</b><small>${esc(h.jockey)}</small></div>
      <div class="od"><b>${agfTxt(h.agf)}</b></div>
      <span class="tick">${bk.no===h.no ? ic('ok',15) : ''}</span>
    </div>`).join('')}
    <div class="ed-foot">
      <button class="btn2" onclick="bkShare(true)">Atsız paylaş</button>
      <button class="btn ${bk.no ? '' : 'off'}" style="${bk.no ? '' : 'opacity:.55'}" onclick="bkShare(false)">Paylaş</button>
    </div>`;
  const act = $('bk-races').querySelector('.on');
  if(act) $('bk-races').scrollLeft = act.offsetLeft - ($('bk-races').clientWidth - act.clientWidth) / 2;
}
function bkShare(noHorse){
  let c = null;
  if(!noHorse){
    if(!bk.no){ showToast('Bankonu seçmek için bir ata dokun.'); return; }
    c = {city: bk.city, type: 'Ganyan', rule: 'win', date: 'Bugün', misli: 1, legs: [L(bk.race, [bk.no], null, bk.city)]};
  }
  addPost(bk.text, c);
  posts[0].banko = true;
  $('feed-post-input').value = '';
  closeBanko();
  renderFeed();
  showToast('Banko akışta paylaşıldı!');
}

// ---- BÜLTEN: bahis türü -> seçim ----
// Çok ayaklı bahisler günün SON N koşusudur (örn. 6'lı = 4-9. koşu). Diğer türlerde tek koşu seçilir.
// TJK'nın bildirdiği ayak başlangıçları (varsa). Tür → {tur, n}
const LEG_MAP = {p7:{tur:'PLASE', n:7}, g7:{tur:'GANYAN', n:7}, g6:{tur:'GANYAN', n:6}, g6b:{tur:'GANYAN', n:6}, g5:{tur:'GANYAN', n:5}, g4:{tur:'GANYAN', n:4}, g3:{tur:'GANYAN', n:3}, c2:{tur:'CIFTE', n:2}};
// Görünen ad: bülten iki altılı bildiriyorsa "1. 6'lı Ganyan" / "2. 6'lı Ganyan"
const tLabel = (t, c = city) => (t.si != null && legStarts(t, c).length > 1) ? (t.si + 1) + '. ' + t.name : t.name;
const legBilgiVar = c => raceList(c).some(k => k.baslar && k.baslar.length);
// Bu bahsin TJK'daki başlangıç koşuları (1. 6'lı, 2. 6'lı gibi birden fazla olabilir)
function legStarts(t, c){
  const mp = LEG_MAP[t.k]; if(!mp) return [];
  return raceList(c).filter(k => (k.baslar || []).some(x => x.tur === mp.tur && x.n === mp.n)).map(k => +k.no);
}
function legStart(t, c = city){
  const N = raceCount(c);
  if(t.si != null){   // 1. / 2. altılı: bültendeki sıraya göre sabit başlangıç
    if(legBilgiVar(c)){ const st = legStarts(t, c); return st[t.si] != null ? st[t.si] : null; }
    return t.si ? null : (N >= t.n ? N - t.n + 1 : null);
  }
  if(legBilgiVar(c)){
    const st = legStarts(t, c); if(!st.length) return null;
    return st.find(r => BUL.note || gecmisMu() || admTest() || !raceDone(c, r)) || st[st.length - 1];
  }
  return N >= t.n ? N - t.n + 1 : null;     // TJK bilgisi okunamadıysa: günün son N koşusu (tahmini)
}
// ---- Tek koşuluk bahisler: hangi koşuda oynanır? ----
// Önce TJK programındaki o koşunun oyun listesine bakılır (k.oyun). Liste okunamadıysa yönetmelikteki asgari at sayısına düşülür:
// Plase ve İkili en az 7 at, Sıralı İkili en az 4 at, Plase İkili 10 at; Sıralı Üçlü/Tabela ikili ile birlikte konur (7 at); Sıralı Beşli 12 at ve üzeri.
const OYUN_KEY = {g1:'g1', pl:'pl', gp:'gp', si:'si', siv:'si', ik:'ik', ik1:'ik', pi:'pi', pi1:'pi', su:'su', suv:'su', tb:'tb', tbv:'tb', s5:'s5', s5v:'s5'};
const OYUN_MIN = {pl:7, gp:7, ik:7, si:4, pi:10, su:7, tb:7, s5:12};
function oyunMusait(t, c, r){
  const key = OYUN_KEY[t.k]; if(!key || key === 'g1') return true;
  const k = raceInfo(c, r); if(!k) return false;
  if(k.oyun && k.oyun.length) return k.oyun.indexOf(key) >= 0;
  return (k.atlar || []).filter(a => !a.kosmaz).length >= (OYUN_MIN[key] || 0);
}
const fmtKos = a => a.length <= 5 ? a.join('., ') + '. koşu' : a.length + ' koşuda';
function tekKosular(t, c = city){
  return allRaces(c).filter(r => oyunMusait(t, c, r) && (BUL.note || gecmisMu() || admTest() || !raceDone(c, r)));
}
function tekMusait(t, c = city){
  const key = OYUN_KEY[t.k];
  if(!key || key === 'g1' || !raceCount(c)) return {ok: true};
  const kos = tekKosular(t, c);
  if(kos.length){
    const kalan = allRaces(c).filter(r => BUL.note || gecmisMu() || admTest() || !raceDone(c, r)).length;
    return {ok: true, kos, sub: kos.length === kalan ? null : fmtKos(kos)};
  }
  return {ok: false, why: allRaces(c).some(r => oyunMusait(t, c, r)) ? 'koşular bitti' : c + ' programında yok'};
}

// Çok ayaklı bahis oynanabilir mi? TJK'da o ayak başlangıcı olmalı ve ilk ayak henüz başlamamış olmalı
function legsMusait(t, c = city){
  if(t && t.mode === 'race') return tekMusait(t, c);
  if(!t || t.mode !== 'legs') return {ok: true};
  const N = raceCount(c); if(!N) return {ok: true};
  const ilk = legStart(t, c);
  if(ilk == null) return {ok: false, why: legBilgiVar(c) ? c + ' programında yok' : c + "'da " + N + ' koşu var'};
  if(ilk + t.n - 1 > N) return {ok: false, why: c + ' programında yok'};
  if(!BUL.note && !gecmisMu() && !admTest() && raceDone(c, ilk)) return {ok: false, why: ilk + '. koşu başladı', ilk};
  return {ok: true, ilk, son: ilk + t.n - 1};
}
// Seçili çok ayaklı bahis oynanamaz hale geldiyse (ilk ayak koşuldu / yeterli koşu yok) otomatik olarak oynanabilir en büyük türe geçer
function autoFixType(){
  const T = curT(); if(!T || (T.mode !== 'legs' && T.mode !== 'race') || legsMusait(T).ok) return false;
  const alt = T.mode === 'race' ? TYPES.find(t => t.k === 'g1') : TYPES.find(t => t.k !== T.k && t.mode === 'legs' && t.rule === T.rule && t.n === T.n && legsMusait(t).ok)
    || TYPES.filter(t => t.mode === 'legs' && t.rule === T.rule && t.n < T.n && legsMusait(t).ok).sort((a, b) => b.n - a.n)[0]
    || TYPES.find(t => t.k === (T.rule === 'place' ? 'pl' : 'g1'));
  betK = alt.k; curSlot = 0; misli = 1;
  const lr = legRaces();
  const before = Object.keys(sel).length;
  if(alt.mode === 'legs'){
    const kept = {}; Object.keys(sel).forEach(k => { if(lr.includes(sel[k].r)) kept[k] = sel[k]; });
    sel = kept;
    if(!lr.includes(race) || raceDone(city, race)) race = lr.find(r => !raceDone(city, r)) || lr[lr.length - 1];
  } else {
    sel = {};
    race = nextRaceNo(city);
  }
  const lost = before - Object.keys(sel).length;
  showToast(`${tLabel(T)} oynanamaz (${legsMusait(T).why}). ${tLabel(alt)} seçildi` + (lost ? ' · koşulan ayağın seçimi silindi.' : '.'));
  return true;
}
// Çok ayaklı bahiste (3'lü, 5'li, 7'li, Çifte…) ilk ayağa — henüz başlamamış ilk ayak koşusuna — geç
function goFirstLeg(){
  const T = curT(); if(!T) return;
  if(T.mode !== 'legs'){   // tek koşuluk bahis: bu bahsin oynandığı koşuya geç; koşu bittiyse sıradaki koşuya geç
    const ks = tekMusait(T).kos;
    if(ks && ks.length && ks.indexOf(race) < 0){ race = ks.find(r => r >= race) || ks[0]; curSlot = 0; refreshOranlar(true, true); return; }
    if(raceDone(city, race)){ race = nextRaceNo(city); curSlot = 0; refreshOranlar(true, true); }
    return;
  }
  const lr = legRaces(); if(!lr.length) return;
  const hedef = lr.find(r => !raceDone(city, r)) || lr[0];
  if(race !== hedef){ race = hedef; curSlot = 0; refreshOranlar(true, true); }
}
function legRaces(c = city){
  const T = curT(), N = raceCount(c);
  if(T.mode !== 'legs') return Array.from({length: N}, (_, i) => i + 1);
  const ilk = legStart(T, c);
  if(ilk == null){ const n = Math.min(T.n, N); return Array.from({length: n}, (_, i) => N - n + 1 + i); }
  return Array.from({length: Math.min(T.n, N - ilk + 1)}, (_, i) => ilk + i);
}
const kk = (r, slot, no) => [city, r, slot, no].join('|');
const picksIn = (r, slot = 0) => selList().filter(h => h.c === city && h.r === r && h.slot === slot);
const anyIn = r => selList().some(h => h.c === city && h.r === r);

function buildCoupon(){
  if(!selList().length) return null;
  const T = curT();
  const base = {city, type: T.name, rule: T.rule, date: 'Bugün', misli};
  if(T.si != null && legStarts(T, city).length > 1) base.ord = T.si + 1;   // 1. / 2. altılı (tür adı aynı kalır: puan, limit, kontenjan bozulmaz)
  const nos = (r, sl) => picksIn(r, sl).map(h => h.no).sort((a,b) => a - b);
  if(T.mode === 'legs') return {...base, legs: legRaces().map(r => L(r, nos(r, 0)))};
  const r = selList()[0].r;
  if(T.slots) return {...base, legs: Array.from({length: T.slots}, (_, i) => ({...L(r, nos(r, i)), slot: i}))};
  return {...base, legs: [L(r, nos(r, 0))]};
}
// Tahmin limiti: aynı bahis türünden, tek koşuluk bahislerde koşu başına, çok ayaklı bahislerde şehir başına günde en fazla 2 kupon
const TAHMIN_LIMIT = 2;
function limitDolu(c){
  try{ if(isAdminKey(ME)) return null; }catch(e){}   // admin: test için günlük tahmin limiti yok
  const fam = t => String(t || '').replace(/\s*\(.*\)\s*$/, '').trim();
  const tek = k => k.legs.length === 1 || k.legs.some(l => l.slot != null);
  const gun = new Date().toDateString();
  const t1 = tek(c), f = fam(c.type), r = c.legs[0].r;
  const n = (posts || []).filter(p => {
    const k = p.coupon; if(!k || p.author !== ME || k.city !== c.city) return false;
    if(new Date(p.ts || 0).toDateString() !== gun) return false;
    if(fam(k.type) !== f || tek(k) !== t1) return false;
    if(!t1 && (k.ord || 0) !== (c.ord || 0)) return false;   // 1. ve 2. altılının limiti ayrı
    return !t1 || k.legs[0].r === r;
  }).length;
  if(n < TAHMIN_LIMIT) return null;
  return t1 ? r + '. koşu için ' + f + ' en fazla ' + TAHMIN_LIMIT + ' kez oynanabilir.'
            : c.city + ' için bugün en fazla ' + TAHMIN_LIMIT + ' adet ' + (c.ord ? c.ord + '. ' : '') + f + ' oynanabilir.';
}
function checkCoupon(){
  const c = buildCoupon();
  if(!c) return {c: null};
  if(gecmisMu() && !isAdminKey(ME)){ showToast('Geçmiş günlere kupon yapılamaz.'); return {err: true}; }   // sonucu belli koşuya tahmin: sadece admin (test)
  { const m = legsMusait(curT()); if(!m.ok){ showToast(m.why + ' · bu kupon artık oynanamaz.'); return {err: true}; } }
  { const T0 = curT(); if(T0.mode === 'race' && !oyunMusait(T0, city, c.legs[0].r)){ showToast(tLabel(T0) + ' ' + c.legs[0].r + '. koşuda oynanmıyor.'); return {err: true}; } }
  { const lm = limitDolu(c); if(lm){ showToast(lm); return {err: true}; } }
  const slotted = c.legs.some(l => l.slot != null);
  const miss = c.legs.filter(l => !l.picks.length);
  if(miss.length){
    showToast(slotted ? 'Eksik sıra: ' + miss.map(l => (l.slot + 1) + '. At').join(', ')
                      : 'Eksik ayak: ' + miss.map(l => l.r + '.').join(', ') + ' koşu');
    return {err: true};
  }
  if(kolon(c) < 1){
    showToast(slotted ? 'Her sırada farklı bir at olmalı.' : 'Seçimini tamamla: en az ' + (ruleOf(c) === 'any4' ? 4 : 2) + ' at seç.');
    return {err: true};
  }
  { const tut = kolon(c) * birimFiyat(c.type, c.city) * c.misli;
    if(tut < ASGARI){ showToast('Asgari kupon bedeli ' + money(ASGARI) + ' · şu an ' + money(tut) + ', misli artır.'); return {err: true}; }
    if(limitliMi(c.type) && tut > kuponMax()){ showToast(c.type + " kuponu en fazla " + money(kuponMax()) + ' olabilir · şu an ' + money(tut) + '. Seçimini azalt.'); return {err: true}; } }
  return {c};
}

function renderBulStatus(){
  const e = $('bul-status'); if(!e) return;
  if(BUL.status === 'loading') e.innerHTML = '<span>TJK bülteni yükleniyor…</span>';
  else if(BUL.status === 'err') e.innerHTML = `<span class="bad">Bülten alınamadı: ${esc(BUL.msg)}</span><button onclick="loadBulten(true)">Tekrar dene</button>` + (bugunMu() ? '' : `<button onclick="gotoDate(TJK.bugunIso())">Bugüne dön</button>`);
  else if(BUL.status === 'ok'){
    const n = CITIES.reduce((a, c) => a + raceCount(c), 0), t = new Date(BUL.at);
    const hh = String(t.getHours()).padStart(2,'0') + ':' + String(t.getMinutes()).padStart(2,'0');
    e.innerHTML = `<span>TJK · ${CITIES.length} hipodrom · ${n} koşu · ${hh}</span><button onclick="loadBulten(true)">Yenile</button><button class="livebtn" onclick="liveOpen()">● Canlı yayın</button>`
      + (BUL.note ? `<small>${esc(BUL.note)}</small>` : '')
      + (BUL.hata.length ? `<small class="bad">${esc(BUL.hata.join(' · '))}</small>` : '')
      + `<button onclick="BUL.dbg=!BUL.dbg;renderBulStatus()">${BUL.dbg ? 'Teşhisi gizle' : 'Teşhis'}</button>`
      + (BUL.dbg ? '<small><b>Sürüm: oyun-r1 (11 Ekim)</b><br>' + CITIES.map(c => '<b>' + esc(c) + '</b>: ' + raceList(c).map(k => esc(k.no + '·' + k.saat + '·' + k.atlar.length + ' at' + ((k.baslar || []).length ? '·başlar: ' + k.baslar.map(x => (x.ord ? x.ord + '. ' : '') + (x.tur === 'CIFTE' ? 'Çifte' : x.n + "'li " + x.tur)).join(', ') : ''))).join(' | ') + (legBilgiVar(c) ? '' : ' | <i>ayak bilgisi bulunamadı (tahmini)</i>') + (CANLI_TESHIS[c] ? '<br><i>canlı oran:</i> ' + (CANLI_TESHIS[c].anahtar ? esc(CANLI_TESHIS[c].anahtar) + ' · ' + Object.keys(CANLI_TESHIS[c].kosu).map(n => esc(n + '=' + CANLI_TESHIS[c].kosu[n])).join(', ') : '<b>TJK listesinde şehir bulunamadı</b> (TJK şehirleri: ' + esc(CANLI_TESHIS[c].onekler.join(', ')) + ')' + (CANLI_TESHIS[c].deneme ? '<br><i>Karma denemeleri:</i> ' + esc(CANLI_TESHIS[c].deneme) : '')) : '')).join('<br>')
          + (raceInfo(city, race) ? '<br><b>Seçili koşu metni:</b> ' + esc(raceInfo(city, race).sinif || '') + '<br><b>Takı teşhisi:</b><br>' + raceInfo(city, race).atlar.map(a => esc(a.no + ' → ' + ((a.takiDetay || []).map(x => x.k + (x.a ? '✓' : '')).join(' ') || '(yok)') + ' ⟨' + (a.takiHam || '') + '⟩')).join('<br>') : '')
          + '<br><b>Sonuç okuyucu:</b>' + (window.__TESHIS ? Object.keys(window.__TESHIS).map(sn => { const D = window.__TESHIS[sn]; return '<br><b>' + esc(sn) + '</b> ' + esc(D.zaman) + ' · sayfa ' + D.htmlUzunluk + ' karakter · başlıklar: ' + esc((D.basliklar || []).join(' | ')) + ' · bülten koşuları: ' + esc(D.bultenKosular) + '<br>' + (D.tablolar || []).map(T => esc(T.no + ' → ' + T.not + ' (' + T.eslesen + '/' + T.satir + ')' + (T.eslesmeyen.length ? ' eşleşmeyen: ' + T.eslesmeyen.join(', ') : ''))).join('<br>') + (D.hatalar && D.hatalar.length ? '<br><b>HATA:</b> ' + esc(D.hatalar.join(' ; ')) : '') + '<br>sayfa sonu: ' + esc(D.htmlSon || ''); }).join('') : ' henüz sorgu atılmadı') + '</small>' : '');
  } else e.innerHTML = '';
}
// Takı kısaltmaları (TJK'nın kendi açıklamaları). Sayfada açıklama gelirse o, yoksa bu sözlük kullanılır
const TAKI_AD = {KG:'Kapalı gözlük', K:'Kulaklık', SK:'Starta kadar kulaklık', SKG:'Starta kadar kapalı gözlük', DB:'Dil bağı', GKR:'Göz koruyucu'};
const TAKI_ACIKLAMA = {
  KG:'Kapalı gözlük takılacağını ifade eder.',
  K:'Kulaklık takılacağını ifade eder.',
  SK:'Ring mahalinden starta kadar kulaklık ile geleceğini ifade eder.',
  SKG:'Ring mahalinden starta kadar kapalı gözlük ile geleceğini ifade eder.',
  DB:'Dilinin bağlanacağını ifade eder.',
  GKR:'Göz koruyucu takılacağını ifade eder.'
};
let _tkTip = null, _tkTimer = 0;
function takiTipKapat(){ if(_tkTip){ _tkTip.remove(); _tkTip = null; } clearTimeout(_tkTimer); document.removeEventListener('click', takiTipKapat, true); }
function takiTip(el){
  const acik = _tkTip && _tkTip._for === el;
  takiTipKapat(); if(acik) return;
  const t = document.createElement('div');
  t.className = 'tktip'; t.textContent = el.dataset.t || 'Açıklama bulunamadı.'; t._for = el;
  document.body.appendChild(t); _tkTip = t;
  const r = el.getBoundingClientRect(), w = t.offsetWidth, hh = t.offsetHeight;
  let left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
  let top = r.top - hh - 10, below = false;
  if(top < 8){ top = r.bottom + 10; below = true; }
  t.style.left = left + 'px'; t.style.top = top + 'px';
  t.style.setProperty('--ax', Math.min(Math.max(14, r.left + r.width / 2 - left), w - 14) + 'px');
  t.classList.toggle('below', below);
  _tkTimer = setTimeout(takiTipKapat, 2000);
  setTimeout(() => document.addEventListener('click', takiTipKapat, true), 0);
}
function takiChips(d){
  const list = (d.takiDetay && d.takiDetay.length) ? d.takiDetay : String(d.taki || '').split(/\s+/).filter(Boolean).map(k => ({k, a: ''}));
  if(!list.length) return '';
  const nokta = d.atId ? `<span class="tkd" hidden data-id="${esc(d.atId)}" data-cur="${esc(list.map(x => x.k).join(' '))}"><i></i><b></b></span>` : '';
  return `<div class="tkw">${nokta}${list.map(x => {
    const k = String(x.k).toUpperCase(), ac = x.a || TAKI_ACIKLAMA[k] || (TAKI_AD[k] ? TAKI_AD[k] + ' takılacağını ifade eder.' : 'Açıklama bulunamadı.');
    return `<button class="tkc" data-t="${esc(ac)}" onclick="event.stopPropagation();takiTip(this)"><b>${esc(x.k)}</b></button>`;
  }).join('')}</div>`;
}
// ---- Takı değişimi: atın bir önceki koşusundaki takı ile bugünküyü karşılaştırır (yeşil nokta) ----
// TJK at sayfasındaki geçmiş tablosunda takı/ekstra sütunu yoksa nokta hiç çıkmaz.
const TKD_DEBUG = /[?&]tkdebug=1/.test(location.search);   // adresin sonuna ?tkdebug=1 eklenirse nedenini gösterir
const TKD = { err: {}, key: 'gs_takionce_v1', ttl: 12 * 3600 * 1000, c: {}, busy: {}, fail: {}, q: [], run: 0 };
try{ TKD.c = JSON.parse(localStorage.getItem(TKD.key) || '{}') || {}; }catch(e){ TKD.c = {}; }
const tkdKod = t => String(t || '').toLocaleUpperCase('tr-TR').split(/\s+/).filter(x => /^[A-ZÇĞİÖŞÜ]{1,4}$/.test(x));
const tkdGet = id => { const g = TKD.c[id]; return g && Date.now() - g.ts < TKD.ttl ? g.r : undefined; };
async function atOncekiTaki(atId){
  const url = `https://www.tjk.org/TR/yarissever/Query/ConnectedPage/AtKosuBilgileri?1=1&QueryParameter_AtId=${encodeURIComponent(atId)}`;
  const html = await (await fetchWithTimeout(url, 20000, 1)).text();
  const dom = new DOMParser().parseFromString(html, 'text/html');
  const norm = x => String(x || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  for(const tb of dom.querySelectorAll('table')){
    const rows = Array.from(tb.querySelectorAll('tr'));
    const hi = rows.findIndex(tr => { const t = norm(tr.textContent); return /Tarih/i.test(t) && /Derece/i.test(t); });
    if(hi < 0) continue;
    const heads = Array.from(rows[hi].querySelectorAll('th,td')).map(c => norm(c.textContent).toLowerCase());
    const iT = heads.findIndex(x => x.startsWith('tarih'));
    const iX = heads.findIndex(x => /ekstra|tak[ıi]|donan|ekipman/.test(x));
    if(iT < 0 || iX < 0) return { n: 1 };            // sütun yok → karşılaştırma yapılamaz
    for(let i = hi + 1; i < rows.length; i++){
      const td = rows[i].querySelectorAll('td'); if(td.length <= Math.max(iT, iX)) continue;
      const tarih = (norm(td[iT].textContent).match(/\d{2}\.\d{2}\.\d{4}/) || [])[0]; if(!tarih) continue;
      const hc = td[iX], txt = norm(hc.textContent);
      if(!txt && hc.querySelector('img,svg,i')) return { t: tarih, u: 1 };   // yalnız ikon: okunamaz, bilinmiyor say
      return { t: tarih, k: txt.split(/\s+/).filter(x => /^[A-ZÇĞİÖŞÜ]{1,4}$/.test(x)).join(' ') };
    }
    return { n: 1 };
  }
  return { n: 1 };
}
function tkdBoya(root, id){
  (root || document).querySelectorAll(id ? `.tkd[data-id="${id}"]` : '.tkd').forEach(el => {
    const r = tkdGet(el.dataset.id), bugun = tkdKod(el.dataset.cur);
    let neden = '', degisti = false;
    if(r === undefined) neden = TKD.fail[el.dataset.id] ? 'Hata: TJK sayfası alınamadı (' + (TKD.err[el.dataset.id] || '?') + ')' : 'Önceki takı yükleniyor…';
    else if(r.n) neden = 'TJK geçmiş tablosunda takı sütunu bulunamadı';
    else if(r.u) neden = 'Takı sütunu var ama ikon olarak geliyor, okunamadı';
    else if(r.k == null) neden = 'Önceki takı okunamadı';
    else {
      const once = tkdKod(r.k);
      degisti = !(bugun.length === once.length && bugun.every(x => once.includes(x)));
      neden = degisti ? 'Önceki takılar: ' + (once.join(' ') || 'takısız') : 'Takı değişmedi (önceki: ' + (once.join(' ') || 'takısız') + ', bugün: ' + bugun.join(' ') + ')';
    }
    const yz = el.querySelector('b'); if(yz) yz.textContent = degisti ? neden.replace('Önceki takılar:', 'Önceki:') : neden;
    el.classList.toggle('dbg', !degisti);
    el.hidden = TKD_DEBUG ? false : !degisti;
  });
}
function tkdPompa(){
  while(TKD.run < 3 && TKD.q.length){
    const id = TKD.q.shift(); TKD.run++;
    atOncekiTaki(id).then(r => { TKD.c[id] = { ts: Date.now(), r }; try{ localStorage.setItem(TKD.key, JSON.stringify(TKD.c)); }catch(e){} })
      .catch(e => { TKD.fail[id] = Date.now(); TKD.err[id] = String(e && e.message || e).slice(0, 60); })
      .finally(() => { delete TKD.busy[id]; TKD.run--; tkdBoya(document, id); tkdPompa(); });
  }
}
function takiYukle(root){
  root.querySelectorAll('.tkd[data-id]').forEach(el => {
    const id = el.dataset.id; if(tkdGet(id) !== undefined || TKD.busy[id]) return;
    if(TKD.fail[id] && Date.now() - TKD.fail[id] < 600000) return;
    TKD.busy[id] = 1; TKD.q.push(id);
  });
  tkdBoya(root); tkdPompa();
}
// ---- Son galibiyet + son galop (at sayfalarından, cihazda 12 saat saklanır) ----
const GALIP_TTL = 12 * 3600 * 1000;
const GL = {
  gal: { key: 'gs_galip_v2', label: 'Son galibiyet', none: 'Kayıtlı galibiyeti yok', fn: 'atSonGalibiyet', cls: 'hgal' },
  gop: { key: 'gs_galop_v2', label: 'Son galop', none: 'İdman kaydı yok', fn: 'atSonGalop', cls: 'hgal hgop' }
};
Object.keys(GL).forEach(k => {
  const o = GL[k]; o.c = {}; o.fail = {}; o.busy = {}; o.err = {}; o.q = []; o.run = 0;
  try{ o.c = JSON.parse(localStorage.getItem(o.key) || '{}') || {}; }catch(e){ o.c = {}; }
});
const galipGet = (k, id) => { const g = GL[k].c[id]; return g && Date.now() - g.ts < GALIP_TTL ? g : null; };
function galipSave(k){ try{ localStorage.setItem(GL[k].key, JSON.stringify(GL[k].c)); }catch(e){} }
function galipGun(t){
  const m = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/.exec(t || ''); if(!m) return '';
  const n = Math.floor((new Date().setHours(0,0,0,0) - new Date(+m[3], +m[2] - 1, +m[1]).getTime()) / 86400000);
  if(!(n >= 0)) return '';
  return n === 0 ? 'Bugün' : n === 1 ? 'Dün' : n < 60 ? n + ' gün önce' : n < 730 ? Math.round(n / 30) + ' ay önce' : Math.floor(n / 365) + ' yıl önce';
}
function galipInner(k, id){
  const o = GL[k], g = galipGet(k, id);
  if(!g) return o.fail[id] && Date.now() - o.fail[id] < 600000
    ? (/HTTP 404/.test(o.err[id] || '')
      ? `<div><small>${o.label}</small><b class="gm">TJK'da kayıt yok</b></div>`
      : `<div><small>${o.label}</small><b class="gm">Alınamadı</b></div>${o.err[id] ? `<span>${esc(o.err[id])}</span>` : ''}`)
    : `<div><small>${o.label}</small><b class="gm">Aranıyor…</b></div>`;
  if(g.n) return `<div><small>${o.label}</small><b class="gm">${o.none}</b></div>`;
  const gun = galipGun(g.t);
  return `<div><small>${o.label}${gun ? ' · ' + esc(gun) : ''}</small><b>${esc(g.t)}${g.d ? ' · ' + esc(g.d) : ''}</b></div>${g.y ? `<span>${esc(g.y)}</span>` : ''}`;
}
const galipBlock = d => d && d.atId ? Object.keys(GL).map(k => `<div class="${GL[k].cls}" data-k="${k}" data-id="${esc(d.atId)}">${galipInner(k, d.atId)}</div>`).join('') : '';
const galipRefresh = (k, id) => document.querySelectorAll('.hgal[data-k="' + k + '"][data-id="' + id + '"]').forEach(el => { el.innerHTML = galipInner(k, id); });
// Kuyruktaki işleri (türüne göre 3 paralel) çeker, geldikçe kartı yerinde günceller
function galipPompa(k){
  const o = GL[k];
  if(document.hidden) return; // sekme arka plandaysa çekme, dönünce devam eder
  if(k === 'gop' && TJK.atGaloplarToplu && !(o.workerYok && Date.now() - o.workerYok < 600000)){ return galopTopluPompa(); }
  while(o.run < 3 && o.q.length){
    const id = o.q.shift(); o.run++;
    TJK[o.fn](id).then(r => {
      if(r){ o.c[id] = Object.assign({ts: Date.now()}, r); galipSave(k); delete o.fail[id]; }
      else o.fail[id] = Date.now();
    }).catch(e => { o.fail[id] = Date.now(); o.err[id] = String((e && e.message) || e).slice(0, 260); }).finally(() => {
      o.run--; delete o.busy[id];
      galipRefresh(k, id);
      setTimeout(() => galipPompa(k), 250); // ayrıştırma işleri üst üste binmesin, ekran akıcı kalsın
    });
    galipRefresh(k, id);
  }
}
// Galop: worker'a 6'şar atlık toplu istek (telefon sayfa indirip ayrıştırmaz). Worker yoksa 10 dk eski yönteme düşer.
function galopTopluPompa(){
  const o = GL.gop;
  while(o.run < 2 && o.q.length){
    const ids = o.q.splice(0, 6); o.run++;
    ids.forEach(id => galipRefresh('gop', id));
    TJK.atGaloplarToplu(ids).then(m => {
      ids.forEach(id => {
        const r = m[id];
        if(r && (r.t || r.n)){ o.c[id] = Object.assign({ts: Date.now()}, r); delete o.fail[id]; }
        else { o.fail[id] = Date.now(); o.err[id] = String((r && r.e) || 'Alınamadı').slice(0, 260); }
      });
      galipSave('gop');
    }).catch(e => {
      o.workerYok = Date.now(); // worker güncel değil: eski yönteme dön
      ids.forEach(id => { if(!o.q.includes(id)) o.q.unshift(id); });
    }).finally(() => {
      o.run--;
      ids.forEach(id => { if(!o.q.includes(id)){ delete o.busy[id]; galipRefresh('gop', id); } });
      setTimeout(() => galipPompa('gop'), 100);
    });
  }
}
// Ekrandaki koşunun atları için eksik olanları kuyruğun BAŞINA koyar (önce görünenler gelsin)
function galipYukle(root){
  Object.keys(GL).forEach(k => {
    const o = GL[k], gor = [];
    root.querySelectorAll('.hgal[data-k="' + k + '"][data-id]').forEach(el => {
      const id = el.dataset.id;
      if(galipGet(k, id)) return;
      if(o.fail[id] && Date.now() - o.fail[id] < 600000) return;
      if(o.busy[id]){ const i = o.q.indexOf(id); if(i > 0){ o.q.splice(i, 1); gor.push(id); } return; }
      o.busy[id] = 1; gor.push(id);
    });
    o.q.unshift(...gor);
    galipPompa(k);
  });
}
// Girişte: seçili şehrin atlarının son galopunu arka planda önceden çeker (önce seçili koşu).
// Ekran boştayken başlar, veri tasarrufu açıksa ya da sekme gizliyse yapmaz.
let _gonBekle = false;
function galopOnYukle(){
  if(_gonBekle) return; _gonBekle = true;
  const basla = () => {
    _gonBekle = false;
    try{
      if(document.hidden || (navigator.connection && navigator.connection.saveData)) return;
      const o = GL.gop;
      raceList(city).slice().sort((a, b) => (a.no === race ? -1 : b.no === race ? 1 : 0)).forEach(kz => (kz.atlar || []).forEach(a => {
        const id = a.atId || (a.d && a.d.atId);
        if(!id || a.kosmaz || galipGet('gop', id) || o.busy[id]) return;
        if(o.fail[id] && Date.now() - o.fail[id] < 600000) return;
        o.busy[id] = 1; o.q.push(id);
      }));
      galipPompa('gop');
    }catch(e){}
  };
  if(window.requestIdleCallback) requestIdleCallback(basla, {timeout: 3000}); else setTimeout(basla, 800);
}
document.addEventListener('visibilitychange', () => { if(!document.hidden) Object.keys(GL).forEach(galipPompa); });
// Detay panelleri varsayılan AÇIK; kullanıcının kapattıkları burada tutulur
const _detAcik = new Set();   // Orijin/sahip/antrenör paneli varsayılan KAPALI; kullanıcının açtıkları burada tutulur
const detKey = h => city + '|' + race + '|' + h.no;
// Açılır paneller: sınıf değişir, yükseklik CSS ile yumuşak animasyonlanır (yeniden çizim yok → zıplama yok)
function animTg(btn, set){
  const box = btn.parentElement, k = box.dataset.k; if(!k) return;
  const open = box.classList.toggle('open');
  btn.setAttribute('aria-expanded', open);
  if(open) set.delete(k); else set.add(k);
}
function detTg(btn){
  const box = btn.parentElement, k = box.dataset.k; if(!k) return;
  const open = box.classList.toggle('open');
  btn.setAttribute('aria-expanded', open);
  if(open) _detAcik.add(k); else _detAcik.delete(k);
}
const _moreClosed = new Set();
function moreTg(btn){ animTg(btn, _moreClosed); }
// Ekürü: aynı koşuda aynı sahibe ait diğer atlar
function ekuriHtml(h){
  const d = h.d; if(!d || !d.sahip || h.kosmaz) return '';
  const nrm = x => String(x || '').toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ').trim();
  const my = nrm(d.sahip); if(!my) return '';
  const es = horsesFor(city, race).filter(x => x.no !== h.no && !x.kosmaz && x.d && nrm(x.d.sahip) === my);
  if(!es.length) return '';
  return `<div class="hek"><small>Ekürü</small><span>${es.map(x => `<b>${esc(x.no)}</b> ${esc(x.name)}`).join(' · ')}</span></div>`;
}
function infoPanel(h){
  const d = h.d; if(!d || h.kosmaz) return '';
  const v = x => x != null && x !== '' && x !== '-';
  const eidS = String(d.eid || '');
  const eid = (eidS.match(/\d{1,2}\.\d{2}\.\d{2}/) || [])[0] || '';
  const em = eidS.match(/Bu derece\s+(.+?)\s+Hipodromu.{0,3}nda,?\s*([\d.]+)/i);
  const eidSub = em ? em[1].replace(/\s+/g, ' ') + ' · ' + em[2] : '';
  const sik = d.siklet ? String(d.siklet).replace('.', ',') + (d.fazla ? ' +' + d.fazla.replace('.', ',') : '') : null;
  const kgsS = String(d.kgs || '').trim();
  let kgsTxt = kgsS, kgsCls = '';
  if(/^\d+$/.test(kgsS)){
    const n = +kgsS;
    kgsTxt = n === 0 ? 'Bugün' : n === 1 ? 'Dün' : n + ' gün önce';
    kgsCls = n <= 14 ? 'kg-g' : n >= 36 ? 'kg-o' : '';
  }
  const cell = (lab, val, cls) => v(val) ? `<div><small>${esc(lab)}</small><b${cls ? ` class="${cls}"` : ''}>${esc(val)}</b></div>` : '';
  const stats = cell('Yaş', d.yas) + cell('Sıklet', sik) + cell('Kulvar', d.st) + cell('HP', d.hp, 'hp') + cell('Son koşu', kgsTxt, kgsCls) + cell('S20', d.s20);
  const best = eid ? `<div class="hbest"><div><small>En iyi derece</small><b>${esc(eid)}</b></div>${eidSub ? `<span>${esc(eidSub)}</span>` : ''}</div>` : '';
  const line = (cls, lab, val) => v(val) ? `<div class="hl ${cls}"><small>${esc(lab)}</small><span>${esc(val)}</span></div>` : '';
  const lines = line('l-or', 'Orijin', d.orijin) + line('l-sa', 'Sahip', d.sahip) + line('l-an', 'Antrenör', d.antrenor);
  const tk = takiChips(d);
  const s6 = (h.son6 && h.son6.length) ? `<button class="hlab hlg" data-t="Son 6 yarıştaki bitiş sırası. Altın, gümüş ve bronz ilk üç. Kırmızımsı kutu 6. ve daha geri. Üstteki harf pist türü: Ç çim, K kum, S sentetik." onclick="event.stopPropagation();takiTip(this)">SON 6</button>${son6Html(h.son6)}` : '';
  const ek = ekuriHtml(h);
  const top = (s6 || tk || ek) ? `${(s6 || tk) ? `<div class="hrow">${s6}${tk}</div>` : ''}${ek}` : '';
  if(!top && !stats && !best && !lines && !(d && d.atId)) return '';
  const inner = `${stats ? `<div class="hst">${stats}</div>` : ''}${best}${galipBlock(d)}${lines ? `<div class="hdet" data-k="${esc(detKey(h))}" onclick="event.stopPropagation()"><button type="button" class="hd-s" aria-expanded="false" onclick="detTg(this)"><span>Orijin, sahip, antrenör</span></button><div class="anim"><div class="anim-in"><div class="hls">${lines}</div></div></div></div>` : ''}`;
  if(!inner.trim()) return top ? `<div class="hinfo">${top}</div>` : '';
  // Kapalıyken tek satır özet: yaş · sıklet · HP · son koşu. "Detay" ile tüm bilgiler açılır
  const prev = [v(d.yas) ? esc(d.yas) : '', sik ? esc(sik) + ' kg' : '', v(d.hp) ? '<b class="hp">HP ' + esc(d.hp) + '</b>' : '', kgsTxt ? `<b class="${kgsCls}">${esc(kgsTxt)}</b>` : ''].filter(Boolean).join(' · ');
  return `<div class="hinfo">${top}<div class="hmore" data-k="${esc(detKey(h))}" onclick="event.stopPropagation()"><button type="button" class="hm-s" aria-expanded="false" onclick="moreTg(this)"><span class="hm-l"><span class="hm-p">${prev}</span><span class="hm-o">Detay bilgileri</span></span><span class="hm-b">Detay</span></button><div class="anim"><div class="anim-in"><div class="hm-in">${inner}</div></div></div></div></div>`;
}
function pistHarf(c){
  if(c === 'g') return 'Ç'; if(c === 'k') return 'K'; if(c === 's') return 'S';
  if(!c) return '';
  let r, g, b; const t = String(c).trim().toLowerCase();
  let m = t.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if(m){ let h = m[1]; if(h.length === 3) h = h.split('').map(x => x + x).join(''); r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16); }
  else if((m = t.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/))){ r = +m[1]; g = +m[2]; b = +m[3]; }
  else { if(/green|lime|olive/.test(t)) return 'Ç'; if(/brown|maroon|sienna|chocolate|peru|tan|orange|red/.test(t)) return 'K'; if(/blue|navy|teal|cyan/.test(t)) return 'S'; return ''; }
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if(d < 25) return '';
  let hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  if(hue >= 75 && hue < 170) return 'Ç';
  if(hue >= 170 && hue < 270) return 'S';
  if(hue < 60 || hue >= 330) return 'K';
  return '';
}
function son6Html(a){
  if(!a || !a.length) return '';
  return '<div class="s6" title="Son 6 koşu sıralaması">' + a.map(x => {
    const n = String(x.s), cl = /^[1-3]$/.test(n) ? ' p' + n : (n === '0' || +n >= 6) ? ' bk' : '';
    const hr = pistHarf(x.c);
    return `<span class="s6c"><small class="${hr === 'Ç' ? 'sg' : hr === 'K' ? 'sk' : hr === 'S' ? 'ss' : ''}">${hr || '&nbsp;'}</small><i class="${cl.trim()}">${esc(n)}</i></span>`;
  }).join('') + '</div>';
}
function odInner(h, fin){
  return `<b>${h.kosmaz ? '—' : agfTxt(h.agf)}</b>
        ${h.kosmaz ? '<span class="gp nr">Koşmaz</span>' : fin ? (gnyOf(city, race, h.no) ? gnyPill(gnyOf(city, race, h.no), 'Gny') : '') : (oranPill(h) || `<div class="bar"><i style="width:${Math.min((h.agf || 0) * 2.8, 100)}%"></i></div>`)}`;
}
// Canlı oran değişince listeyi baştan çizmeden sadece oran hücrelerini günceller (titreme/dokunma kaybı olmaz)
function patchOranlar(){
  const el = $('horses-list'); if(!el || visible() !== 'bulten' || raceDone(city, race)) return false;
  const hl = horsesFor(city, race);
  for(const h of hl){
    const od = el.querySelector(`.hr[data-no="${h.no}"] .od`); if(!od) return false;
    if(od.parentElement.classList.contains('nr') !== !!h.kosmaz) return false;   // koşmaz durumu değişti → tam çizim
  }
  const degisti = [];
  hl.forEach(h => {
    const od = el.querySelector(`.hr[data-no="${h.no}"] .od`), html = odInner(h, false);
    if(od._h !== html){ od.innerHTML = html; od._h = html; od.classList.remove('odflash'); degisti.push(od); }
  });
  if(degisti.length){ void el.offsetWidth; degisti.forEach(od => od.classList.add('odflash')); }
  el._h = null;
  return true;
}
function applyOpen(root){
  root.querySelectorAll('.hmore[data-k],.hdet[data-k]').forEach(b => {
    const kapali = b.classList.contains('hmore') ? _moreClosed.has(b.dataset.k) : !_detAcik.has(b.dataset.k);
    b.classList.toggle('open', !kapali);
    const s = b.firstElementChild; if(s) s.setAttribute('aria-expanded', String(!kapali));
  });
}
const setHtml = (el, h) => { if(el._h !== h){ el.innerHTML = h; el._h = h; if(el.id === 'horses-list'){ applyOpen(el); galipYukle(el); takiYukle(el); } } };
function renderBulten(){
  const y = window.scrollY;
  _renderBulten();
  galopOnYukle();
  if(Math.abs(window.scrollY - y) > 1) window.scrollTo({top: y, behavior: 'instant'});
}
function _renderBulten(){
  renderBulStatus();
  if(!CITIES.length){
    $('city-tabs').innerHTML = ''; $('race-tabs').innerHTML = ''; $('slot-tabs').classList.add('hidden');
    $('sel-sum').classList.add('hidden'); $('hint').classList.add('hidden');
    $('race-title').textContent = ''; $('race-meta').textContent = ''; $('next-wrap').innerHTML = '';
    $('tsel-name').textContent = tLabel(curT()); $('tsel-sub').textContent = curT().desc || '';
    $('horses-list')._h = null; $('res-panel')._h = null; $('res-panel').innerHTML = '';
    $('horses-list').innerHTML = `<div class="empty">${BUL.status === 'err' ? (bugunMu() ? 'Bülten alınamadı. Yukarıdan tekrar deneyebilirsin.' : 'Bu tarih için TJK programı bulunamadı. Başka bir gün seç ya da bugüne dön.') : 'Bülten yükleniyor…'}</div>`;
    return;
  }
  autoFixType();
  const T = curT(), lr = legRaces();
  if(!allRaces(city).includes(race)) race = nextRaceNo(city);
  const slotMode = T.slots && !T.one;       // virgüllü: sıra sekmeleri
  $('tsel-name').textContent = tLabel(T);
  $('tsel-sub').textContent = T.desc || (T.rule === 'place'
    ? `${lr[0]}.–${lr[lr.length - 1]}. koşu · her ayakta plase'ye girecek atı bul`
    : `${lr[0]}.–${lr[lr.length - 1]}. koşu · her ayakta kazananı bul`);
  let hintTxt = T.hint || '';
  if(T.mode === 'race' && !oyunMusait(T, city, race)){ const ks0 = tekMusait(T).kos || []; hintTxt = tLabel(T) + ' bu koşuda oynanmıyor' + (ks0.length ? ' · oynanan: ' + fmtKos(ks0) : ''); }
  $('hint').textContent = hintTxt;
  $('hint').classList.toggle('hidden', !hintTxt);

  $('city-tabs').innerHTML = CITIES.map(c => `<button class="chip ${c===city?'on':''}" onclick="selectCity('${c}')">${c}</button>`).join('');
  const rt = $('race-tabs');
  const rtHtml = allRaces(city).map(r => `<button class="chip ${r===race?'on':''} ${anyIn(r)?'has':''} ${raceDone(city, r)?'fin':''} ${(T.mode==='legs' && !lr.includes(r)) || (T.mode==='race' && !oyunMusait(T, city, r)) ? 'dim' : ''}" onclick="selectRace(${r})">${r}. Koşu</button>`).join('');
  const rtSame = rt._h === rtHtml; setHtml(rt, rtHtml);
  const act = rt.querySelector && rt.querySelector('.on');
  if(act && !rtSame) rt.scrollLeft = act.offsetLeft - (rt.clientWidth - act.clientWidth) / 2;

  const st = $('slot-tabs');
  st.classList.toggle('hidden', !slotMode);
  st.innerHTML = slotMode
    ? Array.from({length: T.slots}, (_, i) => `<button class="chip ${i===curSlot?'on':''} ${picksIn(race,i).length?'has':''}" onclick="selectSlot(${i})">${i+1}. At</button>`).join('')
    : '';

  const ri = raceInfo(city, race);
  $('race-title').textContent = `${city} ${race}. Koşu` + (ri && ri.saat ? ' • ' + ri.saat : '');
  $('race-meta').innerHTML = ri ? (ri.bilgi ? `<span class="rbi">${esc(ri.bilgi)}</span><span class="rbn">${ri.atlar.length} at</span>` : esc([ri.mesafe, ri.pist, ri.atlar.length + ' at'].filter(Boolean).join(' • '))) : '';

  const mine = selList().filter(x => x.c === city && x.r === race);
  const fin = raceDone(city, race), rres = raceRes(city, race) || [];
  setHtml($('res-panel'), resPanelHtml(city, race));
  let hlist = horsesFor(city, race);
  if(fin && rres.length) hlist = hlist.slice().sort((a, b) => { const ia = rres.indexOf(a.no), ib = rres.indexOf(b.no); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.no - b.no; });
  setHtml($('horses-list'), hlist.map(h => {
    const hit = T.one ? mine.find(x => x.no === h.no) : mine.find(x => x.no === h.no && x.slot === (slotMode ? curSlot : 0));
    const rk = rres.indexOf(h.no);
    return `<div class="hr ${hit && !h.kosmaz ? 'on' : ''} ${fin && !admTest() ? 'lock' : ''} ${h.kosmaz ? 'nr' : ''} ${fin && rk > -1 && rk < 4 ? 'top3 pos' + (rk + 1) : ''}" data-no="${h.no}" ${(fin && !admTest()) || h.kosmaz ? '' : `onclick="toggleHorse(${h.no})"`}>
      ${sc(h.no)}
      <div class="hn">
        <b>${esc(h.name)}</b>
        <small>${esc(h.jockey)}${h.d && h.d.ap ? ' <em class="apb">AP</em>' : ''}${h.d && h.d.fazla ? ' <em class="fz">+' + esc(h.d.fazla) + '</em>' : ''}</small>
      </div>
      <div class="od">${odInner(h, fin)}</div>
      ${h.kosmaz ? '<span class="tick" style="opacity:0"></span>' : fin ? (admTest() && hit ? `<span class="tick">${T.one ? hit.slot + 1 : ic('ok',15)}</span>` : rk > -1 ? `<span class="rkb r${Math.min(rk+1,5)}">${rk+1}</span>` : '<span class="tick"></span>') : `<span class="tick">${hit ? (T.one ? hit.slot + 1 : ic('ok',15)) : ''}</span>`}
      ${infoPanel(h)}
    </div>`;
  }).join(''));

  // "Sonraki" butonu: ayak ayak veya sıra sıra ilerlet
  const idx = lr.indexOf(race);
  let nx = '';
  if(T.mode === 'legs' && idx < lr.length - 1) nx = `<button class="btn2 next" onclick="selectRace(${lr[idx+1]})">Sonraki ayak: ${lr[idx+1]}. Koşu ›</button>`;
  if(slotMode && curSlot < T.slots - 1) nx = `<button class="btn2 next" onclick="selectSlot(${curSlot+1})">Sonraki sıra: ${curSlot+2}. At ›</button>`;
  $('next-wrap').innerHTML = nx;

  // Alt bar
  const n = selList().length;
  const c = buildCoupon();
  $('draft').classList.toggle('hidden', !n);
  if(document.activeElement !== $('dr-note')) $('dr-note').value = $('feed-post-input').value;
  $('sel-sum').classList.toggle('hidden', !n);
  if(document.body) document.body.classList.toggle('has-draft', !!n);
  if(c){
    const total = T.mode === 'legs' ? T.n : (T.slots || 1);
    const done = c.legs.filter(l => l.picks.length).length;
    const unit = T.slots ? 'sıra' : 'ayak';
    const k = kolon(c);
    const full = done === total && k > 0;
    const multi = total > 1;
    const kn = full ? k : kolonNow(c);
    const tutar = (full ? k : 0) * birimFiyat(T.name, city) * misli, asgOk = tutar >= ASGARI, maxOk = !(limitliMi(T.name) && tutar > kuponMax());
    $('coupon-count-text').textContent = full ? (!maxOk ? `Limit ${money(kuponMax())} · ${money(tutar - kuponMax())} fazla` : asgOk ? 'Kupon hazır' : `Asgari ${money(ASGARI)} · ${money(ASGARI - tutar)} eksik`)
      : (multi ? `${done}/${total} ${unit} · ${total - done} eksik` : `${n} at seçili · eksik seçim`);
    $('coupon-total-price').textContent = kn ? money(kn * birimFiyat(T.name, city) * misli) : '—';
    $('coupon-formula').textContent = kn
      ? `${kn} kolon × ${fiyatYazi(birimFiyat(T.name, city))} ₺ × ${misli} misli` + (full ? '' : ' · şimdilik')
      : 'Fiyat için at seç';
    if(document.body) document.body.classList.toggle('has-draft', true);
    if(document.activeElement !== $('misli-out')) $('misli-out').value = misli;
    $('draft-go').classList.toggle('off', !full || !asgOk || !maxOk);
    $('sel-sum').innerHTML = `<span><b>${esc(city)}</b> · ${c.ord ? c.ord + '. ' : ''}${esc(c.type)}</span><button onclick="clearSel()">Temizle</button>`;
  }
}

