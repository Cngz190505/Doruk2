// ---- SONUÇLAR SEKMESİ ----
let sonucCity = '', sonucTab = 0;
function sonucCityAl(){ if(!CITIES.includes(sonucCity)) sonucCity = CITIES.includes(city) ? city : (CITIES[0] || ''); return sonucCity; }
function sonucSec(c){ sonucCity = c; sonucTab = 0; renderSonuc(); }
function paintSonucDate(){
  const bg = TJK.bugunIso(), [y, m, d] = viewIso.split('-').map(Number), dt = new Date(y, m - 1, d);
  $('s-main').textContent = GUN_U[dt.getDay()] + ', ' + d + ' ' + AY_U[m - 1];
  $('s-sub').textContent = viewIso === bg ? 'BUGÜN' : viewIso === isoAdd(bg, 1) ? 'YARIN' : viewIso === isoAdd(bg, -1) ? 'DÜN' : viewIso < bg ? 'GEÇMİŞ' : 'GELECEK';
  const inp = $('s-input'); inp.value = viewIso; inp.min = isoAdd(bg, -360); inp.max = isoAdd(bg, 7);
  $('s-today').classList.toggle('hidden', viewIso === bg);
  $('s-prev').disabled = viewIso <= inp.min; $('s-next').disabled = viewIso >= inp.max;
}
const SO_RENK = {7: ['#6D28D9', '#A855F7'], 6: ['#0E9F73', '#2DD4A0'], 5: ['#1D4ED8', '#60A5FA'], 4: ['#EA580C', '#FDBA74'], 3: ['#BE185D', '#F472B6'], 0: ['#334155', '#64748B']};
const sonucAd = t => String(t).replace(/(\d)'li/, (m, n) => (({3: "3'lü", 4: "4'lü", 6: "6'lı"})[n] || n + "'li"));
const sonucTutar = x => '₺' + esc(x.tutar);
function sonucOdeme(c, ord, n, tur, bitis){
  const re = new RegExp('^' + (ord ? ord + '\\. ' : '') + n + "'li " + tur + '$');
  for(const k of raceList(c)){ const b = ((BUL.bahis[c] || {})[+k.no] || []).find(x => re.test(x.tur)); if(b) return b; }
  // Yedek: TJK satırda "1." sırasını yazmamış / farklı yazmışsa, altılının bittiği koşunun ödemelerinde sıra numarasına bakmadan ara (o koşuda tek eşleşme varsa o altılıya aittir)
  if(bitis){
    const re2 = new RegExp("^(?:\\d+\\. )?" + n + "'li " + tur + '$');
    const m = (((BUL.bahis[c] || {})[bitis]) || []).filter(x => re2.test(x.tur));
    if(m.length === 1) return m[0];
  }
  return null;
}
function sonucOzet(c){
  const cards = [];
  raceList(c).forEach(k => (k.baslar || []).forEach(x => { if(x.tur === 'GANYAN' && x.n >= 3) cards.push({ord: x.ord, n: x.n, st: +k.no}); }));
  cards.sort((a, b) => b.n - a.n || a.ord - b.ord);
  const i7 = cards.findIndex(x => x.n === 7);   // 7'li Ganyan her zaman 3. sırada
  if(i7 > -1) cards.splice(Math.min(2, cards.length - 1), 0, cards.splice(i7, 1)[0]);
  let html = cards.map(cd => {
    let rows = '';
    for(let i = 0; i < cd.n; i++){
      const r = cd.st + i, res = raceRes(c, r), no = res && res[0], h = no && horsesFor(c, r).find(x => x.no === no);
      rows += `<div class="so-r"><span class="lg">${i + 1}</span>` + (h
        ? `${sc(h.no)}<div class="hn"><b>${esc(h.name)}</b>${h.agf ? `<small>%${h.agf}</small>` : ''}</div>${gnyOf(c, r, no) ? gnyPill(gnyOf(c, r, no)) : ''}`
        : `<div class="hn"><b class="mu">${r}. koşu</b><small>${raceDone(c, r) ? 'Sonuç alınıyor…' : 'Henüz koşulmadı'}</small></div>`) + '</div>';
    }
    const hepsiBitti = Array.from({length: cd.n}, (_, i) => !!raceRes(c, cd.st + i)).every(Boolean);
    const od0 = sonucOdeme(c, cd.ord, cd.n, 'Ganyan', cd.st + cd.n - 1), od = hepsiBitti && od0 && /,\d{1,2}$/.test(String(od0.tutar)) ? od0 : null, cl = SO_RENK[cd.n] || SO_RENK[0];
    return `<div class="so"><div class="so-h" style="--c1:${cl[0]};--c2:${cl[1]}"><span>${cd.ord ? cd.ord + '. ' : ''}${sonucAd(cd.n + "'li")} Ganyan</span><span>${cd.st}.–${cd.st + cd.n - 1}. koşu</span></div>${rows}<div class="so-f"><span>İkramiye</span>${od ? `<b>${sonucTutar(od)}</b>` : '<em>Bekleniyor</em>'}</div></div>`;
  }).join('');
  const seen = {}, list = [];
  raceList(c).forEach(k => ((BUL.bahis[c] || {})[+k.no] || []).forEach(x => {
    if(!/'li (Ganyan|Plase)$|Çifte$/.test(x.tur) || seen[x.tur] || !/,\d{1,2}$/.test(String(x.tutar))) return;
    seen[x.tur] = 1; list.push(x);
  }));
  const key = t => { const m = /^(?:(\d)\. )?(?:(\d)'li (Ganyan|Plase)|\d\. Çifte)/.exec(t) || []; return [-(+m[2] || 2), t.includes('Plase') ? 1 : 0, +m[1] || 0]; };
  list.sort((a, b) => { const x = key(a.tur), y = key(b.tur); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; });
  const t7 = list.findIndex(x => /^7'li Ganyan$/.test(x.tur));   // 7'li Ganyan her zaman 3. sırada
  if(t7 > -1) list.splice(Math.min(2, list.length - 1), 0, list.splice(t7, 1)[0]);
  if(list.length) html += `<div class="so"><div class="so-h" style="--c1:#1E3A8A;--c2:#6366F1"><span>Bahis türü</span><span>İkramiyeler</span></div>${list.map(x => `<div class="so-r"><div class="hn"><b>${esc(sonucAd(x.tur))}</b></div><b class="so-a">${sonucTutar(x)}</b></div>`).join('')}</div>`;
  // Son koşunun tüm bahis ödemeleri (Ganyan, İkili, Plase, Tabela, Sıralı Beşli…): Tahmin Yap'taki son koşu ekranıyla aynı veri
  const sonK = raceList(c).map(k => +k.no).filter(no => ((BUL.bahis[c] || {})[no] || []).length).pop();
  if(sonK){
    const odl = BUL.bahis[c][sonK];
    html += `<div class="so"><div class="so-h bo-h" style="--c1:#0F766E;--c2:#2DD4BF"><span>Bahis ödemeleri</span><span>${sonK}. koşu</span></div>${odl.map(x => `<div class="bo-r"><div class="bt"><b>${esc(sonucAd(x.tur))}</b>${x.detay ? `<small>${esc(x.detay)}</small>` : ''}</div><b class="so-a">${sonucTutar(x)}</b></div>`).join('')}</div>`;
  }
  return html || '<div class="empty">Henüz sonuç yok. Koşular bitip ödemeler yayınlanınca burada görünecek.</div>';
}
function renderSonuc(){
  const y = window.scrollY;
  _renderSonuc();
  if(Math.abs(window.scrollY - y) > 1) window.scrollTo({top: y, behavior: 'instant'});
}
function _renderSonuc(){
  paintSonucDate();
  const box = $('s-list'), cb = $('s-city'), rt = $('s-race'), sm = $('s-sum');
  if(!CITIES.length){
    cb.innerHTML = ''; cb._h = null; rt.innerHTML = ''; rt._h = null; sm.textContent = '';
    setHtml(box, `<div class="empty">${BUL.status === 'err' ? (bugunMu() ? 'Program alınamadı. Tahmin Yap sekmesinden tekrar deneyebilirsin.' : 'Bu tarih için TJK programı bulunamadı.') : 'Sonuçlar yükleniyor…'}</div>`);
    return;
  }
  const c = sonucCityAl(), all = raceList(c);
  setHtml(cb, CITIES.map(x => `<button class="chip ${x === c ? 'on' : ''}" onclick="sonucSec('${x}')">${esc(x)}</button>`).join(''));
  if(BUL.note){ rt.innerHTML = ''; rt._h = null; sm.textContent = ''; setHtml(box, `<div class="empty">${esc(BUL.note)}</div>`); return; }
  rt.innerHTML = ''; rt._h = null;
  sm.textContent = `${all.filter(k => raceDone(c, +k.no)).length}/${all.length} koşu tamamlandı`;
  setHtml(box, sonucOzet(c));
  sonucTazele(c);
}
// Sekme açıkken: biten ama sonucu/ödemesi eksik koşuları hipodrom başına tek istekle tamamla
async function sonucTazele(c){
  if(!c || BUL.note || !BUL.ids[c] || sonucTazele.b) return;
  if(!raceList(c).some(k => odemeEksik(c, +k.no))) return;
  sonucTazele.t = sonucTazele.t || {};
  if(Date.now() - (sonucTazele.t[c] || 0) < 15000) return;
  sonucTazele.b = true; sonucTazele.t[c] = Date.now();
  const iso = viewIso;
  try{
    for(let t = 0; pollSonuc.busy && t < 40; t++) await new Promise(x => setTimeout(x, 250));
    const info = BUL.ids[c], r = await TJK.sonuclariGetir(info.id, info.adi, iso, raceList(c));
    if(iso !== viewIso) return;
    BUL.res[c] = BUL.res[c] || {}; BUL.gny[c] = BUL.gny[c] || {}; BUL.bahis[c] = BUL.bahis[c] || {}; BUL.chk[c] = BUL.chk[c] || {};
    let degisti = false;
    raceList(c).forEach(k => {
      const no = +k.no; if(!odemeEksik(c, no) || !r.sira[no]) return;
      const age = Date.now() - raceStart(c, no).getTime(), yeniB = (r.bahis && r.bahis[no]) || [];
      const eski = JSON.stringify([BUL.res[c][no], BUL.gny[c][no], BUL.bahis[c][no]]);
      BUL.res[c][no] = r.sira[no]; BUL.gny[c][no] = r.gny[no] || {};
      if(yeniB.length || !BUL.bahis[c][no]) BUL.bahis[c][no] = yeniB;
      if(age >= SONUC_FINAL) BUL.chk[c][no] = 2; else if((BUL.bahis[c][no] || []).length) BUL.chk[c][no] = 2;
      if(eski !== JSON.stringify([BUL.res[c][no], BUL.gny[c][no], BUL.bahis[c][no]])) degisti = true;
    });
    if(degisti){ saveRes(); softRefresh(); }
  }catch(e){}
  finally{ sonucTazele.b = false; }
}

// Koşu/hipodrom değişince sayfa koşunun başına (ilk ata) kaysın; sayfa zaten yukarıdaysa dokunma
function kosuBasinaGit(){
  requestAnimationFrame(() => {
    const ri = document.querySelector('#tab-bulten .ri'); if(!ri) return;
    const hdr = document.querySelector('.top'), sw = $('bul-sticky');
    const off = (hdr ? hdr.offsetHeight : 56) + (sw ? sw.offsetHeight : 0) + 6;
    const t = ri.getBoundingClientRect().top + window.scrollY - off;
    if(window.scrollY > t) window.scrollTo({top: Math.max(0, t), behavior: 'instant'});
  });
}
const selectCity = c => {
  if(c !== city){
    if(selList().length){ sel = {}; misli = 1; showToast('Şehir değişti, seçimler temizlendi.'); }
    city = c;
    curSlot = 0;
    race = nextRaceNo(city);
    goFirstLeg();
    refreshOranlar(true);
  }
  renderBulten();
  kosuBasinaGit();
  kosuSonucCek(city, race);
};
const selectRace = r => {
  // Tek koşulu bahislerde yeni koşu = yeni kupon
  if(curT().mode === 'race' && selList().some(h => h.r !== r)){ sel = {}; showToast('Yeni koşu için seçimler temizlendi.'); }
  race = r;
  curSlot = 0;
  renderBulten();
  kosuBasinaGit();
  refreshOranlar(true, true);   // yeni açılan koşunun oranlarını hemen çek
  kosuSonucCek(city, r);        // biten koşuysa sonuç + bahis ödemelerini hemen çek
};
const selectSlot = i => { curSlot = i; renderBulten(); };

function toggleHorse(no){
  if(raceDone(city, race) && !admTest()){ showToast('Koşu saati geçti, seçime kapalı.'); return; }
  const T = curT();
  if(T.mode === 'race' && !oyunMusait(T, city, race)){
    const ks0 = tekMusait(T).kos || [];
    showToast(tLabel(T) + ' bu koşuda oynanmıyor' + (ks0.length ? ' · ' + fmtKos(ks0) : ''));
    if(ks0.length) selectRace(ks0.find(r => r > race) || ks0[0]);
    return;
  }
  if(T.mode === 'legs' && !legRaces().includes(race)){
    const lr0 = legRaces();
    showToast(tLabel(T) + ' ayakları: ' + lr0[0] + '.–' + lr0[lr0.length - 1] + '. koşu · ilk ayağa geçildi');
    selectRace(lr0[0]);
    return;
  }
  if((horsesFor(city, race).find(x => x.no === no) || {}).kosmaz){ showToast('Bu at koşmuyor.'); return; }
  const same = selList().filter(x => x.c === city && x.r === race);
  const add = slot => { sel[kk(race, slot, no)] = {c: city, r: race, slot, no, name: horsesFor(city, race).find(x => x.no === no).name}; };

  if(T.slots && T.one){
    // Tek kolon sıralı: dokunma sırası = geliş sırası
    const ex = Object.keys(sel).find(k => sel[k].c === city && sel[k].r === race && sel[k].no === no);
    if(ex) delete sel[ex];
    else {
      const used = same.map(x => x.slot);
      let slot = 0; while(used.includes(slot)) slot++;
      if(slot >= T.slots){ showToast(`En fazla ${T.slots} at seçebilirsin.`); return; }
      add(slot);
    }
  } else {
    const slot = T.slots ? curSlot : 0, k = kk(race, slot, no);
    if(sel[k]) delete sel[k];
    else {
      if(T.exact && same.length >= T.exact){ showToast(`Tek kolon: tam ${T.exact} at seçilir.`); return; }
      add(slot);
    }
  }
  renderBulten();
}

function toggleNote(){
  const n = $('dr-note'), open = n.classList.toggle('hidden') === false;
  document.body.classList.toggle('note-open', open);
  $('dr-nb').textContent = open ? '− Notu gizle' : '+ Not ekle';
  if(open) n.focus({preventScroll:true});
}
const MISLI_MAX = 999;
// Misli: +/− düğmeleriyle ya da kutuya rakam yazarak ayarlanır (yazdığın an uygulanır)
function setMisli(v, step, live){
  let nm = parseInt(v, 10);
  if(!nm || nm < 1) nm = 1;
  if(nm > MISLI_MAX){ nm = MISLI_MAX; showToast('En fazla ' + MISLI_MAX + ' misli.'); }
  if(limitliMi(curT().name)){
    const c = buildCoupon(), k = c ? kolon(c) : 0, u = birimFiyat(curT().name, city);
    if(k && k * u * nm > kuponMax()){
      const mx = Math.max(1, Math.floor(kuponMax() / (k * u)));
      if(step && nm > misli){ showToast(curT().name + " kuponu en fazla " + money(kuponMax()) + ' olabilir.'); const e = $('misli-out'); if(e) e.value = misli; return; }
      showToast(curT().name + " limiti " + money(kuponMax()) + ' · misli ' + mx + ' yapıldı.');
      nm = mx;
    }
  }
  misli = nm; renderBulten();
  const e = $('misli-out'); if(e && (document.activeElement !== e || (live && String(misli) !== String(v)))) e.value = misli;   // yazarken sınır aşılırsa kutu da düzelir
}
function chgMisli(d){ setMisli(misli + d, true); }
function clearSel(){ sel = {}; misli = 1; curSlot = 0; renderBulten(); }

// Bahis türü paneli
function openTypes(){
  $('tsheet-list').innerHTML = TYPES.map(t => {
    if(t.si > 0 && t.k !== betK && legStarts(t, city).length <= t.si) return '';   // bültende 2. altılı yok
    const m = legsMusait(t);
    return m.ok
      ? `<button class="opt ${t.k===betK?'on':''}" onclick="setType('${t.k}')">
    <span>${tLabel(t)}</span>
    <span class="tk2"><small>${t.mode === 'legs' && m.ilk ? m.ilk + '.–' + m.son + '. koşu' : (m.sub || t.sub)}</small>${t.k===betK ? ic('ok',18) : ''}</span>
  </button>`
      : `<button class="opt dis" disabled>
    <span>${tLabel(t)}</span>
    <span class="tk2"><small>${m.why}</small></span>
  </button>`;
  }).join('');
  $('tsheet').classList.remove('hidden');
}
function closeTypes(){ $('tsheet').classList.add('hidden'); }
function setType(k){
  { const m = legsMusait(TYPES.find(t => t.k === k)); if(!m.ok){ showToast(m.why + ' · bu bahis oynanamaz.'); return; } }
  // Başka bahis türüne geçince eski seçimler silinir (aynı türe dokunulursa değişmez)
  if(k !== betK){
    if(selList().length) showToast('Bahis türü değişti, seçimler temizlendi.');
    sel = {};
    misli = 1;
    betK = k;
    curSlot = 0;
  }
  closeTypes();
  goFirstLeg();
  renderBulten();
}

function publishCouponFromBulten(){
  const {c, err} = checkCoupon();
  if(err || !c) return;
  const note = $('feed-post-input').value.trim();
  addPost(note || 'Yeni kuponum hazır.', c);
  $('feed-post-input').value = '';
  switchTab('feed');
  showToast('Kupon akışta paylaşıldı!');
}

// ---- KURALLAR SEKMESİ: puan tablosu TYPE_PTS'ten okunur, puanlar değişirse burası kendiliğinden güncellenir ----
function renderKurallar(){
  const sira = ["7'li Ganyan", "6'lı Ganyan", 'Sıralı Beşli', "5'li Ganyan", "7'li Plase", 'Tabela Bahis', "4'lü Ganyan", 'Sıralı Üçlü', "3'lü Ganyan", 'Çifte Bahis', 'Sıralı İkili', 'İkili Bahis', 'Plase İkili', 'Ganyan', 'Ganyan & Plase', 'Plase'];
  const rows = sira.map(t => `<div class="ru-r"><span>${esc(t)}</span><b>${fmtPts(TYPE_PTS[t] != null ? TYPE_PTS[t] : 0.5)} puan</b></div>`).join('');
  const ayak = [1, 2, 3, 4, 5].map(n => `<div class="ru-r"><span>${n} ayak tuttu</span><b>${n} puan</b></div>`).join('')
    + `<div class="ru-r"><span>6 ayak tuttu <small>kupon tam tuttu</small></span><b>${fmtPts(TYPE_PTS[ALTILI])} puan</b></div>`;
  $('kurallar-body').innerHTML = `
    <div class="ru-t">Puan kuralları</div>
    <div class="ru-s">Puan sadece paylaştığın kuponlardan gelir. Sonuçlar TJK'dan otomatik alınır ve kuponlar kendiliğinden değerlendirilir.</div>
    <div class="ru-c"><h3>Kupon tutarsa kaç puan</h3>
      <p>Puan bahsin zorluğuna göre verilir. Virgüllü ve tek kolon hâlleri aynı puanı alır. Tutmayan kupon puan getirmez.</p>
      ${rows}
    </div>
    <div class="ru-c"><h3>Kupon tam tutmasa da puan</h3>
      <p>Sadece <b>6'lı Ganyan</b>'da kısmi puan vardır: kupon tutmasa bile tutan her ayak <b>1 puan</b> getirir. Hangi ayakların tuttuğu fark etmez.</p>
      ${ayak}
      <p style="margin-top:8px">Kupon tam tutarsa ayak puanları ayrıca eklenmez, toplam ${fmtPts(TYPE_PTS[ALTILI])} puan olur. Diğer bahislerde kısmi puan yoktur: ya tutar ya tutmaz.</p>
    </div>
    <div class="ru-c"><h3>Kupon silme</h3>
      <div class="ru-r"><span>Paylaşılan kupon<small>Kullanıcı tarafından silinemez</small></span><b>Kilitli</b></div>
      <div class="ru-r"><span>Tutmayan kupon<small>Gece 00:00'da kendiliğinden silinir</small></span><b>Otomatik</b></div>
      <div class="ru-n">Kupon paylaşıldıktan sonra kullanıcı tarafından silinemez. Böylece kimse tutmayan kuponunu gizleyip puan ya da isabet oranını yükseltemez. Tutmayan kuponlar gece 00:00'da sistem tarafından silinir; tutan kuponlar silinmez. Sadece kuponsuz paylaşımlarını silebilirsin.</div>
    </div>
    <div class="ru-c"><h3>Tahmin limiti</h3>
      <div class="ru-r"><span>Tek koşuluk bahisler<small>Ganyan, Plase, İkili, Sıralı İkili, Sıralı Üçlü, Tabela…</small></span><b>Koşu başına 2</b></div>
      <div class="ru-r"><span>Çok ayaklı bahisler<small>6'lı Ganyan günde 2 kez oynanır (1. ve 2. altılı)</small></span><b>Şehir başına 2</b></div>
      <div class="ru-r"><span>Günlük puan tavanı<small>Bir günde alabileceğin en çok puan</small></span><b>20 puan</b></div>
      <div class="ru-n">Basitçe: Aynı koşuya aynı bahisten en fazla 2 kupon yapabilirsin. Bir günde en fazla 20 puan toplarsın, fazlası sayılmaz. Ertesi gün yine 20 puana kadar kazanırsın, toplam puanın silinmez. Her bahis türü kendi içinde sayılır. Sıralı bahislerin virgüllü hali ile normal hali aynı bahis sayılır: ikisi birlikte en fazla 2 olur.</div>
    </div>
    <div class="ru-c"><h3>Tutmayan kuponlar</h3>
      <p>Tutmayan kuponlar her gün <b>gece 00:00'da otomatik silinir</b>. Tutan kuponlar hiçbir zaman silinmez, akışta ve profilinde kalır.</p>
      <p>Kuponun aldığı puan <b>kalıcıdır</b>. Kupon silinse de <b>puan kaybı olmaz</b>: o kuponun sana kazandırdığı puan (6'lı Ganyan'da tutan ayak puanları dahil) toplam puanında kalır. Sıralaman ve isabet oranın da değişmez.</p>
    </div>
    <div class="ru-c"><h3>Sıralama ve öne çıkma</h3>
      <p>Öne Çıkan Tahminciler listesine sadece puanı olanlar girer. Puan eşitse isabet oranı yüksek olan öne geçer.</p>
      <p>İsabet oranı, 6'lı Ganyan'da tutan ayak sayısına, diğer bahislerde tutan kupon sayısına göre hesaplanır.</p>
      <p>Tutan kuponlar akışta en üstte durur, süre yok: yenisi gelene kadar kalır, yenisi gelince değişir. 6'lı Ganyan günde 2 kez oynandığı için en son tutan 2 altılı, 7'li Ganyan için en son tutan 1 kupon, diğer bahislerde en son tutan 2 kupon öne çıkar.</p>
    </div>`;
}

function renderLeaders(){
  // Puana göre alt alta sıralama (puanı olanlar girer; eşitlikte isabet oranı yüksek olan öne geçer)
  const admV = !!(typeof FB !== 'undefined' && FB_ON && FB.isAdmin);   // yönetici: puanı 0 olanları da görür (puan verebilsin)
  const rows = Object.keys(USERS).map(n => ({n, s: scoreOf(n)})).filter(x => admV || x.s.pts > 0)
    .sort((a, b) => b.s.pts - a.s.pts || b.s.pct - a.s.pct || a.n.localeCompare(b.n, 'tr')).slice(0, admV ? 100 : 50);
  const medal = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);
  $('leaderboard-list').innerHTML = rows.length ? `<div class="lb-note">Puana göre sıralanır. Puan eşitse isabet oranı yüksek olan öne geçer.</div>`
    + rows.map((x, i) => `<div class="lb-row ${x.n === ME ? 'me' : ''}" onclick="openProfile('${x.n}')">
      <span class="lb-rk ${i < 3 && x.s.pts > 0 ? 'top' : ''}">${x.s.pts > 0 ? medal(i) : '–'}</span>
      <span>${av(x.n, 'l')}</span>
      <div class="lb-n"><b>${esc(dn(x.n))}</b><small>${esc(USERS[x.n].h || '')}${x.s.tot ? ' · %' + x.s.pct + ' isabet' : ''}</small></div>
      <div class="lb-p"><b>${fmtPts(x.s.pts)}</b><small>puan</small></div>${admV ? admGiftBtn(x.n) : ''}
    </div>`).join('')
    : `<div class="empty" style="text-align:center;padding:48px 20px">
      <div style="font-size:44px;line-height:1;margin-bottom:14px">🏆</div>
      <b style="display:block;font-size:18px;margin-bottom:8px">Henüz puan alan yok</b>
      <span>Kuponunu tutturan ilk kişi burada görünecek.</span>
    </div>`;
}

// ---- Takipçi / Takip listesi (Instagram mantığı: gerçek veri, Firebase'den) ----
// Takip: users/{uid}.following dizisi + fts[hedefUid] (takip zamanı). Takipçiler tüm kullanıcıların following dizisinden hesaplanır.
// "Kaldır": users/{benim uid}.remFol[takipçiUid] = zaman. Kişi seni yeniden takip ederse (fts > remFol) tekrar takipçi olur.
let removedFol = {};   // yalnızca yerel test modu
let fl = {tab:'fol', who:ME, list:[], q:''};
function flUid(k){ return k === ME ? (FB_ON ? FB.uid : null) : ((USERS[k] && USERS[k].uid) || null); }
function flValid(fUid, tUid){
  if(!FB.users) return true;
  const tu = FB.users[tUid] || {}, fu = FB.users[fUid] || {};
  const rem = (tu.remFol || {})[fUid] || 0;
  return !rem || ((fu.fts || {})[tUid] || 0) > rem;
}
function flFollowersOf(key){
  if(!FB_ON) return key === ME ? [] : (following[key] ? [ME] : []);
  const uid = flUid(key); if(!uid || !FB.users) return [];
  const out = [];
  Object.keys(FB.users).forEach(u => {
    if(u === uid || u === FB.uid) return;
    const k = FB.keyOf[u]; if(!k || !USERS[k]) return;
    if((FB.users[u].following || []).includes(uid) && flValid(u, uid)) out.push(k);
  });
  if(key !== ME && following[key]) out.push(ME);
  return out;
}
function flFollowingOf(key){
  if(key === ME) return Object.keys(following).filter(k => following[k] && USERS[k]);
  if(!FB_ON || !FB.users) return [];
  const uid = flUid(key), u = FB.users[uid]; if(!u) return [];
  return (u.following || []).filter(x => x !== FB.uid || flValid(uid, FB.uid)).map(x => FB.keyOf[x]).filter(k => k && USERS[k]);
}
function flBuild(){
  let l = fl.tab === 'fol' ? flFollowersOf(fl.who) : flFollowingOf(fl.who);
  if(fl.who === ME && fl.tab === 'fol') l = l.filter(n => !removedFol[n]);
  fl.list = l;
}
function openFollows(tab){
  fl.tab = tab; fl.who = viewing; fl.q = '';
  const q = $('fl-q'); if(q) q.value = '';
  flBuild(); renderFollows(); $('fsheet').classList.remove('hidden');
}
function closeFollows(){ $('fsheet').classList.add('hidden'); }
function flTab(t){ fl.tab = t; fl.q = ''; const q = $('fl-q'); if(q) q.value = ''; flBuild(); renderFollows(); }
function flSearch(v){ fl.q = String(v || '').trim().toLowerCase(); renderFollows(); }
function flFollow(n){
  const go = () => {
    following[n] = !following[n];
    if(FB_ON) fbFollow(n, following[n]);
    renderFollows(); rerender();
  };
  if(following[n]) askConfirm('Takipten çıkılsın mı?', dn(n) + ' kullanıcısını takip etmeyi bırakacaksın.', 'Takibi bırak', go);
  else go();
}
function flRemove(n){
  askConfirm('Takipçi kaldırılsın mı?', dn(n) + ' seni takip eden listesinden çıkarılacak. Kullanıcıya bildirim gitmez; seni yeniden takip edebilir.', 'Kaldır', () => {
    if(FB_ON) fbRemoveFollower(n); else removedFol[n] = true;
    flBuild(); renderFollows(); rerender();
  });
}
function renderFollows(){
  const me = fl.who === ME;
  const nFol = flFollowersOf(fl.who).length - (me ? Object.keys(removedFol).filter(k => removedFol[k]).length : 0);
  const nIng = flFollowingOf(fl.who).length;
  $('fl-title').textContent = dn(fl.who);
  $('fl-tabs').innerHTML = `<button class="${fl.tab==='fol'?'on':''}" onclick="flTab('fol')">${fmt(Math.max(0, nFol))} Takipçi</button><button class="${fl.tab==='ing'?'on':''}" onclick="flTab('ing')">${fmt(nIng)} Takip</button>`;
  const q = fl.q;
  const rows = q ? fl.list.filter(n => (dn(n) + ' ' + (USERS[n].h || '')).toLowerCase().includes(q)) : fl.list;
  const emptyTxt = q ? 'Sonuç bulunamadı.' : (fl.tab === 'fol'
    ? (me ? 'Henüz seni takip eden yok.' : 'Henüz takipçi yok.')
    : (me ? 'Henüz kimseyi takip etmiyorsun.' : 'Henüz kimseyi takip etmiyor.'));
  $('fl-list').innerHTML = rows.length ? rows.map(n => {
    const isMe = n === ME, f = !!following[n];
    const lbl = f ? 'Takiptesin' : (me && fl.tab === 'fol' ? 'Geri Takip Et' : 'Takip Et');
    return `<div class="fl-row">
      <span onclick="closeFollows();openProfile('${esc(n)}', true)">${av(n,'l')}</span>
      <div class="fl-n" onclick="closeFollows();openProfile('${esc(n)}')"><b>${esc(dn(n))}</b><small>${esc(USERS[n].h)}</small></div>
      ${isMe ? '' : `<button class="${f ? 'btn2' : 'btn'} fl-b" onclick="flFollow('${esc(n)}')">${lbl}</button>`}
      ${me && fl.tab === 'fol' && !isMe ? `<button class="fl-x" onclick="flRemove('${esc(n)}')">Kaldır</button>` : ''}
    </div>`;
  }).join('') : `<div class="empty" style="text-align:center;padding:28px 12px">${emptyTxt}</div>`;
}

function openProfile(n, force){
  // Yönetici / moderatör başkasının profiline dokununca doğrudan profile gitmez, yönetim menüsü açılır
  if(!force && admView() && admCanManage(n)){ admUserMenu(n); return; }
  viewing = n;
  ptab = 'k';
  switchTab('profile');
}

// ---- Kullanıcı arama (USERS, Firebase 'users' koleksiyonundan canlı dolar) ----
const usrNorm = t => String(t || '').toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function usrSearch(q){
  const box = $('usr-res'), x = document.querySelector('.usr-x'); if(!box) return;
  q = String(q || '').trim();
  if(x) x.classList.toggle('hidden', !q);
  if(!q){ box.classList.add('hidden'); box.innerHTML = ''; return; }
  const n = usrNorm(q.replace(/^@/, '')), out = [];
  Object.keys(USERS).forEach(k => {
    if(k === ME) return;
    const u = USERS[k], nm = usrNorm(dn(k)), h = usrNorm((u.h || '').replace(/^@/, ''));
    let sc = -1;
    if(nm.startsWith(n) || h.startsWith(n)) sc = 0;
    else if(nm.split(/\s+/).some(w => w.startsWith(n))) sc = 1;
    else if(nm.includes(n) || h.includes(n)) sc = 2;
    if(sc >= 0) out.push({k, sc, nm});
  });
  out.sort((a, b) => a.sc - b.sc || a.nm.localeCompare(b.nm, 'tr'));
  box.innerHTML = out.length ? out.slice(0, 8).map(r => {
    const k = r.k, u = USERS[k], f = (typeof following !== 'undefined' && following[k]);
    return `<button type="button" class="usr-r" role="option" data-k="${esc(k)}" onclick="usrPick(this.dataset.k)"><span class="usr-av">${av(k, 's')}</span><span class="usr-m"><b>${esc(dn(k))}</b><small>${esc(u.h || '')}</small></span>${admBadge(k)}${f ? '<span class="usr-tag">Takipte</span>' : ''}</button>`;
  }).join('') : '<div class="usr-none">Kullanıcı bulunamadı</div>';
  box.classList.remove('hidden');
}
function usrClear(){
  const i = $('usr-q'), box = $('usr-res'), x = document.querySelector('.usr-x');
  if(i){ i.value = ''; i.blur(); }
  if(box){ box.classList.add('hidden'); box.innerHTML = ''; }
  if(x) x.classList.add('hidden');
}
function usrPick(k){ usrClear(); if(USERS[k]) openProfile(k); }
document.addEventListener('click', e => { const b = $('usr-res'); if(b && !e.target.closest('#usr-s')) b.classList.add('hidden'); });
document.addEventListener('keydown', e => { if(e.key === 'Escape'){ const b = $('usr-res'); if(b) b.classList.add('hidden'); } });

function setPtab(t){
  ptab = t;
  renderProfile();
}

// Kendi istatistiklerin: kupon paylaşınca/silince sayılar canlı değişir
function couponStats(){
  const cs = posts.filter(p => p.author === ME && p.coupon);
  let w = 0, st = 0;
  cs.forEach(p => { if(p.coupon.banked) return; const k = pst(p); if(k === 'win' || k === 'lose') st++; if(k === 'win') w++; });
  st += histLost(ME) + histWon(ME); w += histWon(ME);   // gün sonunda silinen tutmayan kuponlar da oranı düşürmeye devam eder
  return {c: cs.filter(p => !p.hidden).length, s: st, w};
}
let SEED = null;
function myStats(){
  const cur = couponStats();
  return {count: cur.c, rate: '%' + (cur.s > 0 ? Math.round(cur.w / cur.s * 100) : 0)};
}

function renderProfile(){
  try{ setTimeout(resolveDayResults, 200); }catch(e){}
  const u = USERS[viewing];
  const me = viewing === ME;
  const f = !!following[viewing];
  const mine = posts.filter(p => p.author === viewing && !p.hidden);
  const list = mine.filter(p => ptab !== 'w' || isWon(p));
  const nf = Object.values(following).filter(Boolean).length;
  const cvStyle = (me && myCover)
    ? `background:var(--my-cover) center/cover no-repeat`
    : `background:linear-gradient(135deg,${colorOf(viewing)},color-mix(in srgb,${colorOf(viewing)} 35%,#0A0F1E))`;
  
  $('profile-body').innerHTML = `
    <div class="pstick">
      <div class="cv bcv">
        
        <svg class="bcv-bg" viewBox="0 0 400 112" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <g fill="none" stroke="var(--ac)" stroke-linecap="round">
            <path d="M-20 130 Q 200 10 420 95" stroke-opacity=".16" stroke-width="2"/>
            <path d="M-20 150 Q 200 30 420 115" stroke-opacity=".11" stroke-width="2"/>
            <path d="M-20 108 Q 200 -10 420 75" stroke-opacity=".20" stroke-width="2"/>
            <path d="M-20 86 Q 200 -30 420 55" stroke-opacity=".10" stroke-width="2"/>
          </g>
          <g fill="var(--ac)" fill-opacity=".07">
            <path d="M318 0h24l-42 112h-24z"/><path d="M362 0h12l-42 112h-12z"/>
          </g>
        </svg>
        <div class="bcv-in">
          <div class="bcv-logo">Ganyan<i>Sosyal</i></div>
          <div class="bcv-line"></div>
          <div class="bcv-tag">Tahmin et <b>•</b> Paylaş <b>•</b> Kazan</div>
        </div>
      </div>
      <div class="pt2">
        ${av(viewing,'xl')}
        <div class="pid"><div class="pid-top"><h2${(!me && admView() && admCanManage(viewing)) ? ` onclick="admUserMenu('${esc(viewing)}')" style="cursor:pointer"` : ''}>${esc(dn(viewing))}</h2></div><span class="uh"><i>@</i>${esc((u.h||'').replace(/^@/,''))}</span></div>
      </div>
    </div>
    <div class="plist" id="plist">
    <div class="pn pn-row">
      ${u.bio ? `<p class="bio-t"${u.bioColor ? ` style="color:${esc(u.bioColor)}"` : ''}>${esc(u.bio)}</p>` : (me ? `<p class="bio-empty" onclick="openEdit()">+ Biyografi ekle</p>` : '')}
      ${admBadge(viewing).replace('adm-b','adm-b adm-bio')}
    </div>
    <div class="p-btns">${me ? `<button class="btn2" onclick="openEdit()">Profili Düzenle</button>` : `<button class="${f?'btn2':'btn'}" onclick="toggleFollow('${esc(viewing)}')">${f?'Takip Ediliyor':'Takip Et'}</button>`}</div>
    <div class="st">
      <div><b>${fmtPts(scoreOf(viewing).pts)}</b><small>Puan</small></div>
      <div><b>${me ? myStats().count : u.base}</b><small>Kupon</small></div>
      <button class="stb" onclick="openFollows('fol')"><b>${fmt(Math.max(0, flFollowersOf(viewing).length - (me ? Object.keys(removedFol).filter(k => removedFol[k]).length : 0)))}</b><small>Takipçi</small></button>
      <button class="stb" onclick="openFollows('ing')"><b>${fmt(flFollowingOf(viewing).length)}</b><small>Takip</small></button>
    </div>
    <div class="rt two">
      <button class="${ptab==='k'?'on':''}" onclick="setPtab('k')">Kuponlar</button>
      <button class="${ptab==='w'?'on':''}" onclick="setPtab('w')">Tutanlar</button>
    </div>
    ${list.length ? list.map(postHtml).join('') : `<div class="empty">${ptab==='k' ? 'Henüz paylaşılan kupon yok.' : 'Henüz tutan kupon bulunmuyor.'}</div>`}
    </div>
  `;
}

// Profil fotoğrafı / kapak fotoğrafı
try {
  myPhoto = localStorage.getItem('gs-photo') || '';
  myCover = localStorage.getItem('gs-cover') || '';
  applyMyImgs();
  const sb = localStorage.getItem('gs-bio');
  if(sb !== null) USERS[ME].bio = sb;
  USERS[ME].bioColor = localStorage.getItem('gs-bioc') || '';
  const sn = localStorage.getItem('gs-name'); if(sn) USERS[ME].name = sn;
  const sh = localStorage.getItem('gs-handle'); if(sh) USERS[ME].h = sh;
} catch(e){}

let draft = {photo:'', cover:'', bio:'', bioColor:'', name:'', handle:''};
const BIO_COLORS = ['', '#0E9F73', '#2563EB', '#7C3AED', '#DB2777', '#E0305A', '#EA580C', '#B87F00', '#0891B2'];
const NAME_MAX = 24, HANDLE_MIN = 3, HANDLE_MAX = 20;
const TR_MAP = {'ç':'c','ğ':'g','ı':'i','i̇':'i','ö':'o','ş':'s','ü':'u'};
const cleanHandle = v => v.toLowerCase().replace(/[çğıöşü]/g, c => TR_MAP[c]).replace(/[^a-z0-9_]/g,'').slice(0,HANDLE_MAX);
function handleError(h){
  if(h.length < HANDLE_MIN) return 'Kullanıcı adı en az ' + HANDLE_MIN + ' karakter olmalı.';
  const taken = Object.keys(USERS).some(k => k !== ME && USERS[k].h.toLowerCase() === '@' + h);
  return taken ? 'Bu kullanıcı adı kullanımda.' : '';
}
function onHandle(el){
  const v = cleanHandle(el.value);
  if(el.value !== v) el.value = v;
  draft.handle = v;
  const e = v.length >= HANDLE_MIN ? handleError(v) : '';
  el.classList.toggle('bad', !!e);
  $('hd-err').textContent = e;
}
const BIO_MAX = 160;

function openEdit(){
  draft = {photo: myPhoto, cover: myCover, bio: USERS[ME].bio, bioColor: USERS[ME].bioColor || '', name: USERS[ME].name, handle: USERS[ME].h.replace(/^@/,'')};
  paintEdit();
  $('sheet').classList.remove('hidden');
}
function closeEdit(){ $('sheet').classList.add('hidden'); }

function paintEdit(){
  const g = `linear-gradient(135deg,${colorOf(ME)},color-mix(in srgb,${colorOf(ME)} 35%,#0A0F1E))`;
  const cv = draft.cover ? `url('${draft.cover}') center/cover no-repeat` : g;
  const a = draft.photo ? `url('${draft.photo}') center/cover no-repeat` : colorOf(ME);
  $('sheet-body').innerHTML = `
    <button class="ed-av" style="background:${a}" onclick="$('in-photo').click()" aria-label="Profil fotoğrafı seç">${draft.photo ? '' : esc((draft.name || dn(ME)).slice(0,2).toUpperCase())}<i class="ed-cam">${ic('cam',14)}</i></button>
    <div class="ed-field">
      <small>Ad</small>
      <input class="ed-in" id="ed-name" maxlength="${NAME_MAX}" value="${esc(draft.name || '')}" placeholder="Görünen ad" autocomplete="off" oninput="draft.name=this.value;$('nm-err').textContent=''">
      <div class="ed-err" id="nm-err"></div>
    </div>
    <div class="ed-field">
      <small>Kullanıcı adı</small>
      <div class="ed-at"><span>@</span><input class="ed-in" id="ed-handle" maxlength="${HANDLE_MAX}" value="${esc(draft.handle || '')}" placeholder="kullanici_adi" autocomplete="off" autocapitalize="none" spellcheck="false" oninput="onHandle(this)"></div>
      <div class="ed-err" id="hd-err"></div>
    </div>
    <div class="ed-field">
      <small>Biyografi</small>
      <textarea class="ed-bio" id="ed-bio" rows="3" maxlength="${BIO_MAX}" placeholder="Kendinden kısaca bahset..." style="${draft.bioColor ? 'color:' + draft.bioColor : ''}" oninput="draft.bio=this.value;$('bio-n').textContent=this.value.length">${esc(draft.bio || '')}</textarea>
      <div class="ed-cnt"><span id="bio-n">${(draft.bio || '').length}</span>/${BIO_MAX}</div>
    </div>
    <div class="ed-field">
      <small>Biyografi yazı rengi</small>
      <div class="bc-row">${BIO_COLORS.map(c => `<button type="button" class="bc${(draft.bioColor || '') === c ? ' on' : ''}${c ? '' : ' def'}" style="${c ? 'background:' + c : ''}" onclick="setBioColor('${c}')" aria-label="${c ? 'Renk ' + c : 'Varsayılan renk'}"></button>`).join('')}</div>
    </div>
    <div class="ed-field">
      <small>Profil fotoğrafı</small>
      <div class="ed-row">
        <button class="btn2" onclick="$('in-photo').click()">${draft.photo ? 'Değiştir' : 'Fotoğraf seç'}</button>
        ${draft.photo ? `<button class="btn2 rm" onclick="draft.photo='';paintEdit()">Kaldır</button>` : ''}
      </div>
    </div>
    <div class="ed-foot">
      <button class="btn2" onclick="closeEdit()">Vazgeç</button>
      <button class="btn" onclick="saveEdit()">Kaydet</button>
    </div>`;
}

// Fotoğrafı küçültüp kırparak hafif bir veriye çevirir
function fileToData(file, w, h){
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = rej;
    fr.onload = () => {
      const img = new Image();
      img.onerror = rej;
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const k = Math.max(w / img.width, h / img.height);
        const dw = img.width * k, dh = img.height * k;
        c.getContext('2d').drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        res(c.toDataURL('image/jpeg', .85));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}


// Fotoğraf ayarlama (kırpma) penceresi: sürükle, iki parmakla yakınlaştır ya da kaydırıcıyı kullan
function cropImage(file, w, h, round){
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')); };
    img.onload = () => openCropper(img, url, w, h, !!round, res);
    img.src = url;
  });
}
function openCropper(img, url, w, h, round, done){
  const SW = Math.round(Math.min(window.innerWidth - 24, round ? 460 : 440, (window.innerHeight - 240) * (w / h)));
  const SH = Math.round(SW * h / w);
  const k0 = Math.max(SW / img.naturalWidth, SH / img.naturalHeight);
  let sc = 1, x = 0, y = 0;
  const o = document.createElement('div');
  o.className = 'crp';
  o.innerHTML = `<div class="crp-in">
    <h3>${round ? 'Profil fotoğrafını ayarla' : 'Kapak fotoğrafını ayarla'}</h3>
    <p>Sürükleyerek yerleştir, iki parmakla yakınlaştır</p>
    <div class="crp-stage" style="width:${SW}px;height:${SH}px"><img alt="" draggable="false">${round ? '' : '<i class="crp-grid"></i>'}</div>
    <div class="crp-zoom"><span>−</span><input type="range" min="1" max="4" step="0.01" value="1" aria-label="Yakınlaştır"><span>+</span></div>
    <div class="crp-row"><button type="button" class="crp-no">Vazgeç</button><button type="button" class="crp-ok">Uygula</button></div>
  </div>`;
  const st = o.querySelector('.crp-stage'), im = st.querySelector('img'), rg = o.querySelector('input');
  im.src = url;
  const clamp = () => {
    const dw = img.naturalWidth * k0 * sc, dh = img.naturalHeight * k0 * sc;
    x = Math.min(0, Math.max(SW - dw, x)); y = Math.min(0, Math.max(SH - dh, y));
  };
  const paint = () => {
    clamp();
    const k = k0 * sc;
    im.style.width = img.naturalWidth * k + 'px'; im.style.height = img.naturalHeight * k + 'px';
    im.style.transform = `translate(${x}px,${y}px)`;
    rg.value = sc;
  };
  const zoomTo = (ns, px, py) => {
    ns = Math.min(4, Math.max(1, ns));
    x = px - (px - x) * (ns / sc); y = py - (py - y) * (ns / sc); sc = ns; paint();
  };
  { const dw = img.naturalWidth * k0, dh = img.naturalHeight * k0; x = (SW - dw) / 2; y = (SH - dh) / 2; }
  const P = new Map(); let d0 = 0, s0 = 1;
  st.addEventListener('pointerdown', e => { st.setPointerCapture(e.pointerId); P.set(e.pointerId, {x: e.clientX, y: e.clientY}); if(P.size === 2){ const [a, b] = [...P.values()]; d0 = Math.hypot(a.x - b.x, a.y - b.y) || 1; s0 = sc; } });
  st.addEventListener('pointermove', e => {
    const p = P.get(e.pointerId); if(!p) return;
    if(P.size === 1){ x += e.clientX - p.x; y += e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; paint(); }
    else if(P.size === 2){
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...P.values()], r = st.getBoundingClientRect();
      zoomTo(s0 * Math.hypot(a.x - b.x, a.y - b.y) / d0, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
    }
  });
  const up = e => { P.delete(e.pointerId); if(P.size === 1){ const q = [...P.values()][0]; } };
  st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
  st.addEventListener('wheel', e => { e.preventDefault(); const r = st.getBoundingClientRect(); zoomTo(sc * (e.deltaY < 0 ? 1.08 : 0.92), e.clientX - r.left, e.clientY - r.top); }, {passive: false});
  rg.addEventListener('input', () => zoomTo(parseFloat(rg.value), SW / 2, SH / 2));
  const close = v => { o.remove(); URL.revokeObjectURL(url); document.documentElement.classList.remove('crp-open'); done(v); };
  o._cancel = () => close(null);
  o.querySelector('.crp-no').onclick = () => close(null);
  o.querySelector('.crp-ok').onclick = () => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const k = k0 * sc;
    c.getContext('2d').drawImage(img, -x / k, -y / k, SW / k, SH / k, 0, 0, w, h);
    close(c.toDataURL('image/jpeg', .85));
  };
  document.body.appendChild(o);
  document.documentElement.classList.add('crp-open');
  paint();
}

async function onPick(kind, input){
  const f = input.files && input.files[0];
  input.value = '';
  if(!f) return;
  if(!/^image\//.test(f.type)){ showToast('Lütfen bir fotoğraf seçin.'); return; }
  try {
    const dt = kind === 'photo' ? await cropImage(f, 360, 360, true) : await cropImage(f, 960, 360, false);
    if(!dt) return;
    draft[kind] = dt;
    paintEdit();
  } catch(e){ showToast('Fotoğraf yüklenemedi.'); }
}

function setBioColor(c){
  draft.bioColor = c;
  const t = $('ed-bio'); if(t) t.style.color = c || '';
  document.querySelectorAll('.bc-row .bc').forEach((b, i) => b.classList.toggle('on', BIO_COLORS[i] === c));
}
function saveEdit(){
  const nm = (draft.name || '').trim().replace(/\s+/g,' ');
  if(nm.length < 2){ $('nm-err').textContent = 'Ad en az 2 karakter olmalı.'; $('ed-name').focus(); return; }
  const he = handleError(draft.handle || '');
  if(he){ $('hd-err').textContent = he; $('ed-handle').classList.add('bad'); $('ed-handle').focus(); return; }
  USERS[ME].name = nm;
  USERS[ME].h = '@' + draft.handle;
  USERS[ME].bio = (draft.bio || '').trim();
  USERS[ME].bioColor = draft.bioColor || '';
  myPhoto = draft.photo;
  myCover = draft.cover;
  applyMyImgs();
  let ok = true;
  try {
    localStorage.setItem('gs-photo', myPhoto);
    localStorage.setItem('gs-cover', myCover);
    localStorage.setItem('gs-bio', USERS[ME].bio);
    localStorage.setItem('gs-bioc', USERS[ME].bioColor || '');
    localStorage.setItem('gs-name', USERS[ME].name);
    localStorage.setItem('gs-handle', USERS[ME].h);
  } catch(e){ ok = false; }
  if(FB_ON) fbSaveProfile();
  closeEdit();
  rerender();
  showToast(ok ? 'Profil güncellendi' : 'Güncellendi, ancak cihaza kaydedilemedi');
}
$('sheet-x').innerHTML = ic('x', 18);
$('tsheet-x').innerHTML = ic('x', 18);
$('fsheet-x').innerHTML = ic('x', 18);
$('bsheet-x').innerHTML = ic('x', 18);
$('tsel-chev').innerHTML = ic('down', 20);

// Başlangıç Ayarları
// Uygulama her açılışta gündüz modunda başlar; kullanıcı isterse üstteki düğmeyle değiştirir
myStats(); // başlangıç değerlerini kaydet
setTheme('light');

// ---- BÜLTENİ YÜKLE (TJK) ----
function applyBulten(v, t){
  BUL.data = v.data; BUL.ids = v.ids || {}; BUL.status = 'ok';
  try{ const q = JSON.parse(localStorage.getItem(resKey()) || '{}') || {}; BUL.res = q.res || {}; BUL.gny = q.gny || {}; BUL.bahis = q.bahis || {}; BUL.chk = q.chk || {}; }catch(e){ BUL.res = {}; BUL.gny = {}; BUL.bahis = {}; BUL.chk = {}; } BUL.at = t; BUL.hata = v.hata || [];
  BUL.note = (v.tarih && v.istenen && v.tarih !== v.istenen) ? 'TJK seçilen tarih için program yayınlamadı, gösterilen tarih: ' + v.tarih : '';
  CITIES = Object.keys(v.data);
  if(!CITIES.includes(city)){ city = CITIES[0]; sel = {}; misli = 1; race = nextRaceNo(city); curSlot = 0; }
  if(!allRaces(city).includes(race)) race = nextRaceNo(city);
  if(BUL.resetRace){ BUL.resetRace = false; race = nextRaceNo(city); curSlot = 0; goFirstLeg(); }   // tarih değişti: ilk koşudan başla
  nextR = null;
  if(visible() === 'bulten') renderBulten(); else if(visible() === 'sonuc') renderSonuc();
  paintLive();
  Promise.resolve(pollSonuc(true)).then(() => odemeSerisi());
  refreshOranlar(true);
}
async function loadBulten(force){
  const iso = viewIso, key = 'gs_bulten_v8_' + iso;
  if(BUL.status === 'loading' && BUL.loadingIso === iso) return;
  if(loadBulten.bg === iso) return;   // arka planda yenileme sürüyor
  let stale = false;
  if(!force){
    try {
      const c = JSON.parse(localStorage.getItem(key) || 'null');
      if(c && c.v && c.v.ids && Object.keys(c.v.data).length){
        if(Date.now() - c.t < BUL_TTL){ applyBulten(c.v, c.t); return; }
        // Eski ama aynı güne ait bülten: hemen göster, yenisini arka planda çek (boş ekran bekletme)
        if(Date.now() - c.t < 12 * 3600 * 1000){ applyBulten(c.v, c.t); stale = true; }
      }
    } catch(e){}
  }
  // Aynı güne ait önceki bülten: TJK sonradan bir şehri (biten İstanbul, Karma…) vermezse ya da çekilemezse o şehirler kaybolmasın
  let prevV = null;
  try{ const c0 = JSON.parse(localStorage.getItem(key) || 'null'); if(c0 && c0.v && c0.v.data && c0.v.ids) prevV = c0.v; }catch(e){}
  if(!prevV && iso === viewIso && BUL.data && BUL.ids && Object.keys(BUL.data).length) prevV = {data: BUL.data, ids: BUL.ids};
  const keepPrev = (data, ids) => {
    if(!prevV) return;
    Object.keys(prevV.data).forEach(ad => { if(!data[ad] && prevV.data[ad] && prevV.data[ad].length && prevV.ids[ad]){ data[ad] = prevV.data[ad]; ids[ad] = prevV.ids[ad]; } });
  };
  if(stale) loadBulten.bg = iso;
  else {
    BUL.status = 'loading'; BUL.msg = ''; BUL.loadingIso = iso;
    if(visible() === 'bulten') renderBulten(); else if(visible() === 'sonuc') renderSonuc();
  }
  try {
    const ls = await TJK.sehirleriGetir(iso);
    const data = {}, hata = [], ids = {};
    let ilk = !stale && ls.sehirler.length > 1;   // önbellek yoksa: ilk gelen hipodromla hemen aç, kalanlar arkadan eklensin
    await Promise.all(ls.sehirler.map(async sh => {
      const ad = sh.adi.replace(/\s*Hipodromu$/i, '').trim();
      try {
        const ks = await TJK.sehirProgramiGetir(sh.id, sh.adi, iso);
        if(ks.length){
          data[ad] = ks; ids[ad] = {id: sh.id, adi: sh.adi};
          if(ilk && iso === viewIso){ ilk = false; loadBulten.bg = iso; const d0 = {...data}, i0 = {...ids}; keepPrev(d0, i0); applyBulten({data: d0, ids: i0, tarih: ls.tarih, istenen: ls.istenenTarih, hata: []}, Date.now()); }
        } else hata.push(ad + ': koşu bulunamadı');
      } catch(e){ hata.push(ad + ': ' + (e && e.message ? e.message : e)); }
    }));
    if(iso !== viewIso) return;   // bu arada başka tarih seçildi
    if(!Object.keys(data).length) throw new Error(hata[0] || 'Koşu verisi bulunamadı');
    if(ls.tarih === ls.istenenTarih || !ls.istenenTarih) keepPrev(data, ids);
    const v = {data, ids, tarih: ls.tarih, istenen: ls.istenenTarih, hata};
    try { localStorage.setItem(key, JSON.stringify({t: Date.now(), v})); } catch(e){}
    applyBulten(v, Date.now());
  } catch(e){
    if(iso !== viewIso) return;
    if(stale) return;   // yenileme başarısız: eski bülten ekranda kalsın
    BUL.status = 'err'; BUL.msg = e && e.message ? e.message : String(e);
    if(visible() === 'bulten') renderBulten(); else if(visible() === 'sonuc') renderSonuc();
  } finally { if(loadBulten.bg === iso) loadBulten.bg = null; }
}

// ---- TARİH SEÇİMİ ----
const GUN_U = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
const AY_U = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
function isoAdd(iso, n){
  const [y, m, d] = iso.split('-').map(Number), t = new Date(y, m - 1, d + n), z = x => String(x).padStart(2, '0');
  return t.getFullYear() + '-' + z(t.getMonth() + 1) + '-' + z(t.getDate());
}
function paintDateBar(){
  const bg = TJK.bugunIso(), [y, m, d] = viewIso.split('-').map(Number), dt = new Date(y, m - 1, d);
  $('d-main').textContent = GUN_U[dt.getDay()] + ', ' + d + ' ' + AY_U[m - 1];
  $('d-sub').textContent = viewIso === bg ? 'BUGÜN' : viewIso === isoAdd(bg, 1) ? 'YARIN' : viewIso === isoAdd(bg, -1) ? 'DÜN' : viewIso < bg ? 'GEÇMİŞ PROGRAM' : 'GELECEK PROGRAM';
  const inp = $('d-input'); inp.value = viewIso; inp.min = isoAdd(bg, -360); inp.max = isoAdd(bg, 7);
  $('d-today').classList.toggle('hidden', viewIso === bg);
  $('d-prev').disabled = viewIso <= inp.min; $('d-next').disabled = viewIso >= inp.max;
}
function gotoDate(iso){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso || '') || iso === viewIso){ paintDateBar(); return; }
  viewIso = iso;
  // Eski tarihe ait her şeyi sıfırla
  BUL.data = {}; BUL.ids = {}; BUL.res = {}; BUL.gny = {}; BUL.live = {}; BUL.bahis = {}; BUL.chk = {};
  BUL.note = ''; BUL.hata = []; BUL.msg = ''; BUL.resetRace = true;
  CITIES = []; sel = {}; misli = 1; curSlot = 0; nextR = null; _doneSig = '';
  pollSonuc.last = {}; pollSonuc.fail = {}; pollSonuc.tried = {};
  paintDateBar();
  if(visible() === 'sonuc') renderSonuc();
  loadBulten(false);
  paintLive();
}
const shiftDay = n => gotoDate(isoAdd(viewIso, n));

// ---- Akıştaki "Sıradaki koşu" kartı: bültendeki en yakın koşuya geri sayım ----
let nextR = null;
function findNext(){
  if(!bugunMu()){ nextR = null; return; }   // Akıştaki geri sayım sadece bugünün programı için
  const now = new Date(); let best = null;
  CITIES.forEach(c => raceList(c).forEach(k => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(k.saat || ''); if(!m) return;
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), +m[1], +m[2], 0);
    if(d > now && (!best || d < best.d)) best = {d, c, k};
  }));
  nextR = best;
}
function setTopH(){ const t = document.querySelector('.top'); if(t) document.documentElement.style.setProperty('--topH', Math.max(0, t.offsetHeight - 1) + 'px'); }
setTopH(); window.addEventListener('resize', setTopH); window.addEventListener('load', setTopH);
if(document.fonts && document.fonts.ready) document.fonts.ready.then(setTopH);
function paintLive(){
  const el = $('live-card'); if(!el) return;
  if(!nextR || nextR.d <= new Date()) findNext();
  // Bülten gelene kadar kart yerinde dursun (içi boş/yükleniyor): sonradan belirip sayfayı aşağı itmesin
  const bekle = !nextR && bugunMu() && BUL.status !== 'ok' && BUL.status !== 'err';
  if(el.classList.contains('hidden') === (!!nextR || bekle)) el.classList.toggle('hidden', !(nextR || bekle));
  if(!nextR){
    if(bekle){ const st = (id, t) => { const e = $(id); if(e.textContent !== t) e.textContent = t; }; st('live-ttl', 'Bülten yükleniyor…'); st('live-sub', ''); st('countdown', '--:--'); }
    return;
  }
  const left = Math.max(0, Math.round((nextR.d - new Date()) / 1000));
  const h = Math.floor(left / 3600), m = Math.floor(left % 3600 / 60), sc2 = left % 60;
  const p2 = n => String(n).padStart(2, '0');
  const setT = (id, t) => { const e = $(id); if(e.textContent !== t) e.textContent = t; };
  setT('countdown', h ? h + ' sa ' + p2(m) + ' dk' : m ? m + ' dk ' + p2(sc2) + ' sn' : sc2 + ' sn');
  setT('live-ttl', nextR.c + ' ' + nextR.k.no + '. koşu · ' + nextR.k.saat);
  setT('live-sub', [nextR.k.pist, nextR.k.mesafe].filter(Boolean).join(' · '));
}
// Sıradaki koşu kartına tıklayınca: Tahmin Yap'ta ilgili şehir + koşuyu aç
function openNextRace(){
  if(!nextR || nextR.d <= new Date()) findNext();
  if(!nextR){ switchTab('bulten'); return; }
  const c = nextR.c, r = +nextR.k.no;
  switchTab('bulten');
  if(c !== city){
    if(selList().length){ sel = {}; misli = 1; }
    city = c;
  }
  // Çok ayaklı bahiste bu koşu ayaklar içinde değilse tek koşuluk ganyana geç
  const T = curT();
  if(T && T.mode === 'legs' && !legRaces().includes(r)){
    const g = TYPES.find(t => t.k === 'g1');
    if(g){ betK = g.k; sel = {}; misli = 1; }
  }
  if(curT().mode === 'race' && selList().some(h => h.r !== r)){ sel = {}; }
  race = r; curSlot = 0;
  renderBulten();
  refreshOranlar(true, true);
  kosuSonucCek(city, race);
  setTimeout(() => {
    const el = $('horses-list'); if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
  }, 80);
}
// Sekme/uygulama arka plandayken geri sayımı çizme (pil ve işlemci tasarrufu); geri gelince hemen güncelle
setInterval(() => { if(!document.hidden) paintLive(); }, 1000);
document.addEventListener('visibilitychange', () => { if(!document.hidden){ paintLive(); setTimeout(() => { pollSonuc(); odemeSerisi(); }, 500); } });
loadBulten();
paintLive();

paintDateBar();
