/* ===== Bildirimler (Firebase 'notifs' koleksiyonu; sunucu gerekmez) ===== */
// Görüldü takibi: saat yerine bildirim kimliği+zamanı tutulur (iki telefonun saati farklı olsa da rozet doğru çalışır)
const _nfSeenKey = () => 'gs-notif-ids-' + ((typeof FB !== 'undefined' && FB.uid) || 'x');
const nfKey = n => n.id + '|' + (n.ts || 0);
function nfSeenIds(){ try{ const v = JSON.parse(localStorage.getItem(_nfSeenKey())); return Array.isArray(v) ? v : null; }catch(e){ return null; } }
function nfSeenSet(){ try{ localStorage.setItem(_nfSeenKey(), JSON.stringify((FB.notifs || []).map(nfKey).slice(0, 300))); }catch(e){} }
function nfAgo(ts){
  const d = Math.max(0, Date.now() - ts), m = Math.floor(d / 60000);
  if(m < 1) return 'şimdi'; if(m < 60) return m + ' dk'; const h = Math.floor(m / 60);
  if(h < 24) return h + ' sa'; return Math.floor(h / 24) + ' gün';
}
function nfUnread(){
  if(typeof FB === 'undefined' || !FB_ON || !FB.notifs) return 0;
  const ids = nfSeenIds(); if(!ids) return 0;
  const seen = new Set(ids); return FB.notifs.filter(n => !seen.has(nfKey(n))).length;
}
function notifBadge(){
  const b = $('notif-badge'); if(!b) return;
  const n = nfUnread();
  b.textContent = n > 9 ? '9+' : String(n);
  b.classList.toggle('hidden', !n);
}
// Gece 00:00'da bildirimler sıfırlanır: ekrandan anında kalkar, Firebase'den de silinir (yük binmesin)
function nfDayStart(){ const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
function nfNextMidnight(){ const d = new Date(); d.setHours(24, 0, 0, 0); return d.getTime(); }
function nfCleanup(){
  const start = nfDayStart();
  const old = (FB.notifs || []).filter(n => (n.ts || 0) < start);
  FB.notifs = (FB.notifs || []).filter(n => (n.ts || 0) >= start);
  if(old.length && FB.db){
    try{
      const b = FB.db.batch();
      old.slice(0, 400).forEach(n => b.delete(FB.db.collection('notifs').doc(n.id)));
      b.commit().catch(() => {});
    }catch(e){}
  }
}
function nfMidnightTick(){
  clearTimeout(FB.nfT);
  FB.nfT = setTimeout(() => {
    try{ nfCleanup(); notifBadge(); const sh = $('nfsheet'); if(sh && !sh.classList.contains('hidden')) nfPaint(); }catch(e){}
    nfMidnightTick();
  }, Math.max(1000, nfNextMidnight() - Date.now() + 1500));
}
document.addEventListener('visibilitychange', () => {
  if(document.hidden || typeof FB === 'undefined' || !FB.uid || !FB_ON) return;
  try{ nfCleanup(); notifBadge(); nfMidnightTick(); }catch(e){}
});
function fbNotifStart(){
  FB.notifs = []; nfMidnightTick();
  FB.unsub.push(FB.db.collection('notifs').where('to', '==', FB.uid).limit(100).onSnapshot(sn => {
    FB.notifs = sn.docs.map(d => Object.assign({id: d.id}, d.data())).sort((a, b) => (b.ts || 0) - (a.ts || 0));
    nfCleanup();
    if(nfSeenIds() === null) nfSeenSet();   // ilk kurulum: eskiler okunmamış sayılmasın
    notifBadge();
    const sh = $('nfsheet'); if(sh && !sh.classList.contains('hidden')){ nfSeenSet(); nfPaint(); notifBadge(); }
  }, e => { showToast('Bildirim hatası: ' + (e && e.code)); }));
}
function fbNotifSet(id, type, to, p, tx){
  if(!FB_ON || !FB.uid || !FB.db || !to || to === FB.uid) return;
  if(type !== 'follow' && (!p || !p.docId)) return;
  p = p || {};
  FB.db.collection('notifs').doc(String(id).replace(/\//g, '_')).set({to, from: FB.uid, fn: USERS[ME].name, type, pid: p.id || '', pd: p.docId || '', ts: Date.now(), exp: firebase.firestore.Timestamp.fromDate(new Date(nfNextMidnight())), tx: String(tx || '').slice(0, 80)}).catch(() => {});
}
function fbNotifDel(id){
  if(!FB_ON || !FB.uid || !FB.db) return;
  FB.db.collection('notifs').doc(String(id).replace(/\//g, '_')).delete().catch(() => {});
}
function nfPaint(){
  const el = $('nf-list'); if(!el) return;
  const seen = nfSeenGet0, L = FB.notifs || [];
  if(!L.length){ el.innerHTML = '<div class="ch-empty">Henüz bildirim yok.</div>'; return; }
  const S = (d, f) => `<svg viewBox="0 0 24 24" width="12" height="12" fill="${f ? '#fff' : 'none'}" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const IC = {
    like: [S('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>', 1), '#ef4444'],
    comment: [S('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>'), '#3b82f6'],
    reply: [S('<path d="M9 14 4 9l5-5"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>'), '#6366f1'],
    follow: [S('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>'), '#10b981'],
    newcoupon: [S('<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 11v2"/><path d="M13 17v2"/>'), 'linear-gradient(135deg,#f59e0b,#ef4444)'],
    win: [S('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>'), 'linear-gradient(135deg,#34d399,#059669)'],
    lose: [S('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'), '#94a3b8']
  };
  IC.cmlike = IC.like;
  const TX = {like: 'gönderini beğendi', cmlike: 'yorumunu beğendi', comment: 'gönderine yorum yaptı', reply: 'yorumuna yanıt verdi', follow: 'seni takip etmeye başladı', newcoupon: 'yeni kupon paylaştı', win: 'Kuponun tuttu! 🎉', lose: 'Kuponun tutmadı'};
  const pic = n => {   // bildirimi gönderenin profil resmi (çerçeveli); kullanıcı bulunamazsa baş harfleri
    const k = n.from === FB.uid ? ME : (FB.keyOf && FB.keyOf[n.from]);
    if(k && (k === ME || USERS[k])) return av(k, 'm');
    return `<div class="av m" style="background:#64748b">${esc(String(n.fn || '?').slice(0, 2).toUpperCase())}</div>`;
  };
  el.innerHTML = L.map(n => { const i = IC[n.type] || IC.comment;
    return `<button type="button" class="nf-it ${!seen.has(nfKey(n)) ? 'new' : ''}" onclick="nfOpen('${esc(n.id)}')"><span class="nf-av">${pic(n)}<i class="nf-bd" style="background:${i[1]}">${i[0]}</i></span><span class="nf-tx">${(n.type === 'win' || n.type === 'lose') ? '' : `<b>${esc(n.fn || 'Biri')}</b> `}${TX[n.type] || ''}${n.tx ? `<em>“${esc(n.tx)}”</em>` : ''}</span><small>${nfAgo(n.ts || 0)}</small></button>`; }).join('');
}
let nfSeenGet0 = new Set();   // liste açılırken yeni olanları işaretlemek için eski "son görülme"
function nfClose(){ const sh = $('nfsheet'); if(sh) sh.classList.add('hidden'); }
function nfOpen(id){
  const n = (FB.notifs || []).find(x => x.id === id); nfClose();
  if(!n) return;
  if(n.type === 'follow'){
    const k = FB.keyOf && FB.keyOf[n.from];
    if(k && USERS[k]) openProfile(k); else showToast('Kullanıcı bulunamadı.');
    return;
  }
  // Tüm bildirimler (beğeni, yorum, yanıt, yeni kupon, tuttu/tutmadı): kuponu/gönderiyi bulur ve vurgular, yorum penceresi açılmaz
  showPostCard(n);
}
// Bildirimdeki kuponu akışta bulur: günü açar, kupona kaydırır ve kısa süre vurgular
let _flashPid = 0, _flashUntil = 0;
function showPostCard(n, after){
  filter = 'all';
  const ts = parseInt(String(n.pd || '').split('_')[0], 10);
  const known = posts.find(x => x.id === n.pid || x.docId === n.pd);
  const iso = known ? postDay(known) : (n.iso || (ts ? isoOfTs(ts) : ''));
  if(visible() !== 'feed') switchTab('feed');
  if(iso) feedGoto(iso); else renderFeed();
  let tries = 0;
  const go = () => {
    const p = posts.find(x => x.id === n.pid || x.docId === n.pd);
    const el = p && document.getElementById('pc-' + p.id);
    if(el){
      _flashPid = p.id; _flashUntil = Date.now() + 3000;
      try{ el.classList.add('nf-flash'); el.scrollIntoView({block: 'center', behavior: 'smooth'}); }catch(e){}
      setTimeout(() => { try{ el.classList.remove('nf-flash'); }catch(e){} }, 3000);
      if(after) setTimeout(() => after(p), 800);   // kaydırma bitince mesaj penceresi açılır
      return;
    }
    if(++tries < 14) setTimeout(go, 350);
    else showToast(n.type === 'lose' ? 'Kaybeden kupon silindi.' : 'Gönderi artık yok.');
  };
  setTimeout(go, 300);
}
function toggleNotifications(){
  if(!FB_ON){ $('notif-badge').classList.add('hidden'); showToast('Yeni bildirim yok.'); return; }
  let sh = $('nfsheet');
  if(!sh){
    sh = document.createElement('div');
    sh.id = 'nfsheet'; sh.className = 'sheet hidden';
    sh.onclick = e => { if(e.target === sh) nfClose(); };
    sh.innerHTML = '<div class="sheet-card"><div class="sheet-head"><h3>Bildirimler</h3><button class="x" onclick="nfClose()" aria-label="Kapat">' + ic('x', 20) + '</button></div><div id="nf-list" class="nf-list"></div></div>';
    document.body.appendChild(sh);
  }
  nfSeenGet0 = new Set(nfSeenIds() || []);
  sh.classList.remove('hidden');
  nfPaint();
  nfSeenSet(); notifBadge();
}

// Navigasyon Kurulumu
const NAV = {
  feed: ['home','Akış'],
  bulten: ['list','Tahmin Yap'],
  leaderboard: ['trophy','Liderler'],
  sonuc: ['flag','Sonuçlar'],
  profile: ['user','Profilim']
};

Object.keys(NAV).forEach(k => {
  $('nav-' + k).innerHTML = '<i class="ni">' + ic(NAV[k][0], 21) + '</i>' + NAV[k][1];
});
$('nav-out').innerHTML = '<i class="ni"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.8v8.4"/><path d="M6.9 5.9a8.2 8.2 0 1 0 10.2 0"/></svg></i>Çıkış';
$('bi').innerHTML = ic('bell', 21);
$('menu-btn').innerHTML = ic('menu', 21);
$('dw-x').innerHTML = ic('x', 20);
$('dw-out').innerHTML = '<i>' + ic('logout', 18) + '</i>Oturumu kapat';
P.oran = 'M3 17l6-6 4 4 8-8M14 7h7v7';
$('dw-oranlar').innerHTML = '<i>' + ic('oran', 20) + '</i>Oranlar';
$('dw-kurallar').innerHTML = '<i>' + ic('book', 20) + '</i>Kurallar';
$('shsheet-x').innerHTML = ic('x', 20);
$('dw-shop').innerHTML = '<i>' + ic('gem', 18) + '</i>Mağaza';
function paintDrawer(){
  const dark = document.documentElement.dataset.theme === 'dark';
  $('dw-me').innerHTML = av(ME,'m') + '<div class="dw-mt"><b>' + esc(dn(ME)) + '</b><small>' + esc(USERS[ME].h || '') + '</small></div><span class="dw-chev">' + ic('down', 18) + '</span>';
  $('dw-theme').innerHTML = '<i>' + ic(dark ? 'moon' : 'sun', 18) + '</i>Koyu tema<span class="sw ' + (dark ? 'on' : '') + '"></span>';
  const inst = $('dw-inst'); inst.classList.toggle('hidden', isStandalone());
  inst.innerHTML = '<i>' + ic('plus', 18) + '</i>Uygulamayı yükle';
  const am = $('dw-adm'), isAdm = (typeof FB !== 'undefined' && FB.isAdmin);
  am.classList.toggle('hidden', !isAdm);
  am.innerHTML = '<i>' + ic('lock', 18) + '</i>Yönetim paneli';
  $('dw-note').textContent = FB_ON ? 'Hesabın ve paylaşımların bulutta saklanır.' : 'Verilerin bu cihazda saklanır.';
}
function openDrawer(){ paintDrawer(); $('drawer').classList.add('open'); $('drawer-bg').classList.add('open'); $('drawer').setAttribute('aria-hidden','false'); }
function closeDrawer(){ $('drawer').classList.remove('open'); $('drawer-bg').classList.remove('open'); $('drawer').setAttribute('aria-hidden','true'); }
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeDrawer(); });
// Kenardan sağa kaydırınca aç, sola kaydırınca kapat
(function(){
  let sx = null, sy = null;
  document.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, {passive:true});
  document.addEventListener('touchend', e => {
    if(sx === null) return;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
    if(dy < 40){
      if(sx < 20 && dx > 70) openDrawer();
      else if(dx < -70 && $('drawer').classList.contains('open')) closeDrawer();
    }
    sx = null;
  }, {passive:true});
})();
$('lnk-add').innerHTML = ic('plus', 18) + 'Kupon ekle';

function switchTab(t){
  try{ if(t !== 'feed' && feedPick){ feedPick = ''; feedDayListen(); } }catch(e){}   // tarih çubuğu kaldırıldı: başka güne atlanmış akış, sekmeden çıkınca bugüne döner
  openCm = {}; cmAll = {}; repOpen = {}; replyTo = null;
  document.querySelectorAll('.tab').forEach(e => e.classList.add('hidden'));
  $('tab-' + t).classList.remove('hidden');
  Object.keys(NAV).forEach(k => $('nav-' + k).classList.toggle('on', k === t));
  $('dw-kurallar').classList.toggle('on', t === 'kurallar');
  $('dw-oranlar').classList.toggle('on', t === 'oranlar');
  $('draft').classList.add('hidden');
  document.body.classList.remove('has-draft');
  document.body.dataset.tab = t;
  
  ({feed:renderFeed, bulten:renderBulten, sonuc:renderSonuc, leaderboard:renderLeaders, kurallar:renderKurallar, oranlar:renderOranlar, profile:renderProfile})[t]();
  window.scrollTo({top:0, behavior:'instant'});
  if(t === 'bulten' && city) kosuSonucCek(city, race);
}

// Akış sekmesine tekrar dokununca (Instagram gibi): aşağıdaysan en üste çık, zaten üstteysen akışı yenile
let _feedRefreshing = false;
function feedTap(){
  if(visible() !== 'feed'){ switchTab('feed'); return; }
  if(window.scrollY > 80){ window.scrollTo({top: 0, behavior: 'smooth'}); return; }
  if(_feedRefreshing) return;
  _feedRefreshing = true;
  showToast('Akış yenileniyor…');
  try{ if(FB_ON && FB.uid) syncSettled(); }catch(e){}
  try{ Promise.resolve(pollSonuc(true)).catch(() => {}); refreshOranlar(true); }catch(e){}
  openCm = {}; cmAll = {}; repOpen = {}; replyTo = null;
  setTimeout(() => {
    try{ renderFeed(); }catch(e){}
    window.scrollTo({top: 0, behavior: 'instant'});
    showToast('Akış yenilendi');
    _feedRefreshing = false;
  }, 700);
}
function visible(){
  return ['feed','bulten','sonuc','leaderboard','kurallar','oranlar','profile'].find(t => !$('tab-' + t).classList.contains('hidden'));
}
function rerender(){
  const v = visible(), pl = v === 'profile' ? $('plist') : null, y = pl ? pl.scrollTop : 0;
  ({feed:renderFeed, bulten:renderBulten, sonuc:renderSonuc, leaderboard:renderLeaders, kurallar:renderKurallar, oranlar:renderOranlar, profile:renderProfile})[v]();
  if(v === 'profile' && $('plist')) $('plist').scrollTop = y;
  if(typeof cmSheetId !== 'undefined' && cmSheetId != null) renderCmSheet(false);
}
function setTopH(){ const t = document.querySelector('.top'); if(t) document.documentElement.style.setProperty('--topH', t.offsetHeight + 'px'); }
window.addEventListener('resize', setTopH);

const followBtn = n => n === ME ? '' : `<button class="fb ${following[n] ? 'on' : ''}" onclick="event.stopPropagation();toggleFollow('${n}')">${following[n] ? 'Takipte' : 'Takip Et'}</button>`;

function toggleFollow(n){
  following[n] = !following[n];
  if(FB_ON) fbFollow(n, following[n]);
  showToast(following[n] ? n + ' takip ediliyor' : 'Takipten çıkıldı');
  rerender();
}
// Admin: akıştaki paylaşımdan ve profilden hızlı yasaklama (yönetim paneline girmeden)
function admBanBtn(key, big){
  if(!canBan() || key === ME) return '';
  const uid = USERS[key] && USERS[key].uid;
  if(!uid) return '';
  if(!FB.isAdmin && (isAdminKey(key) || isModKey(key))) return '';   // moderatör: yönetici ve moderatörlere dokunamaz
  const on = banActive(FB.bans[uid]);
  return `<button class="px adm ${on ? 'on' : ''} ${big ? 'big' : ''}" onclick="event.stopPropagation();admToggleBan('${esc(uid)}')" aria-label="${on ? 'Yasağı kaldır' : 'Yasakla'}" title="${on ? 'Yasağı kaldır' : 'Yasakla'}">${ic('ban', big ? 20 : 16)}</button>`;
}
/* Profilde avatara dokununca açılan yönetim menüsü (yönetici / moderatör) */
function admCanManage(key){
  if(key === ME) return false;
  if(ADM_TEST) return !!USERS[key];
  const uid = USERS[key] && USERS[key].uid;
  if(!uid) return false;
  if(FB.isAdmin) return true;
  return canBan() && !(isAdminKey(key) || isModKey(key));
}
const ADM_TEST_BAN = {};
function admUserMenu(key){
  if(!admCanManage(key)) return;
  const uid = ADM_TEST ? ('test:' + key) : USERS[key].uid, name = dn(key);
  const isA = ADM_TEST || FB.isAdmin, canB = ADM_TEST || canBan();
  const banned = ADM_TEST ? !!ADM_TEST_BAN[uid] : banActive(FB.bans[uid]);
  const d = document.createElement('div');
  d.className = 'dlg';
  d.innerHTML = `<div class="dlg-card am-card" role="dialog">
    <h3>${esc(name)}</h3>
    <p class="am-sub">Yönetim işlemleri${ADM_TEST ? ' · test modu' : ''}</p>
    ${(viewing === key && document.getElementById('tab-profile') && document.getElementById('tab-profile').offsetParent) ? '' : `<button class="am-b am-pf" data-a="pf"><span>${ic('user', 16)}</span><b>Profili aç</b></button>`}
    ${isA ? `<button class="am-b am-gift" data-a="gift"><span>${ic('gem', 16)}</span><b>Puan / Hediye çerçeve</b></button>` : ''}
    ${canB ? `<button class="am-b ${banned ? 'am-un' : 'am-ban'}" data-a="ban"><span>${ic('ban', 16)}</span><b>${banned ? 'Yasağı kaldır' : 'Yasakla'}</b></button>` : ''}
    <button class="am-x" data-a="x">Vazgeç</button></div>`;
  const close = () => d.remove();
  d.onclick = e => { if(e.target === d) close(); };
  d.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
    const a = b.dataset.a; close();
    if(a === 'pf') openProfile(key, true);
    else if(ADM_TEST && a === 'gift') showToast('Test modu: hediye penceresi canlıda açılır.');
    else if(ADM_TEST && a === 'ban'){ ADM_TEST_BAN[uid] = !ADM_TEST_BAN[uid]; showToast(ADM_TEST_BAN[uid] ? 'Test modu: yasaklandı (gerçekte yazılmadı).' : 'Test modu: yasak kaldırıldı.'); }
    else if(a === 'gift') admGift(uid);
    else if(a === 'ban') admToggleBan(uid);
  });
  document.body.appendChild(d);
}

function admToggleBan(uid){
  if(!canBan()) return;
  if(!FB.isAdmin && ((FB.mods && FB.mods[uid]) || isAdminUid(uid))){ showToast('Yönetici ve moderatörler yasaklanamaz.'); return; }
  if(banActive(FB.bans[uid])) admUnban(uid); else admBan(uid);
}
// Admin: başkasının paylaşımını/kuponunu veritabanından tamamen siler (gizleme yok, kaybeden/tutan fark etmez).
function admDelBtn(p){
  if(!(typeof FB !== 'undefined' && FB.isAdmin) || !FB_ON || !p || !p.docId) return '';
  if(p.author === ME && canDelete(p).ok) return '';   // kendi paylaşımında zaten normal silme düğmesi var; kilitli kuponda yönetici silme düğmesi çıkar
  return `<button class="px adm" onclick="event.stopPropagation();admDelPost(${p.id})" aria-label="Paylaşımı sil (yönetici)" title="Sil">${ic('trash',16)}</button>`;
}
function admDelPost(id){
  if(!FB.isAdmin) return;
  const p = posts.find(x => x.id === id);
  if(!p || !p.docId) return;
  const own = p.author === ME;
  const d = document.createElement('div');
  d.className = 'dlg';
  d.innerHTML = `<div class="dlg-card" role="alertdialog"><h3>${p.coupon ? 'Kupon silinsin mi?' : 'Paylaşım silinsin mi?'}</h3><p>${own ? (p.coupon ? 'Kuponun' : 'Paylaşımın') : esc(dn(p.author)) + ' kullanıcısının ' + (p.coupon ? 'kuponu' : 'paylaşımı')} herkesten kalıcı olarak silinecek.</p><div class="dlg-row"><button class="no">Vazgeç</button><button class="del">Sil</button></div></div>`;
  const close = () => d.remove();
  d.onclick = e => { if(e.target === d) close(); };
  d.querySelector('.no').onclick = close;
  d.querySelector('.del').onclick = () => {
    close();
    // Kuponun getirdiği puan kuponla birlikte gitmesin: silmeden önce hesaplanıp grants.keep'e işlenir (puan ayrı, kupon ayrı)
    let keep = 0;
    try{
      if(p.coupon && !p.coupon.banked && p.uid && !p.dayOnly){
        keep = Math.round((scoreOf(p.author).raw - scoreOf(p.author, p).raw) * 100) / 100;
        if(!(keep > 0)) keep = 0;
      }
    }catch(e){ keep = 0; }
    const batch = FB.db.batch();
    batch.delete(fbDoc('posts', p.docId));
    if(keep > 0) batch.set(fbDoc('grants', p.uid), {keep: firebase.firestore.FieldValue.increment(keep)}, {merge: true});
    batch.commit()
      .then(() => showToast(p.coupon ? 'Kupon silindi' + (keep > 0 ? ' · ' + fmtPts(keep) + ' puan korundu.' : '.') : 'Paylaşım silindi.'))
      .catch(e => { p.hidden = false; rerender(); showToast('Silinemedi: ' + fbErr(e)); });
    p.hidden = true; rerender();   // anında listeden kaldır; hata olursa geri gelir
  };
  document.body.appendChild(d);
}
// Kuponu kimler takip etmiş: sayıyı ve listeyi kupon sahibi ile admin görür
function trackerUids(p){
  if(!FB_ON || !FB.users) return [];
  const k = tk(p);
  return Object.keys(FB.users).filter(uid => uid === FB.uid ? !!tracked[k] : (FB.users[uid].trackedPosts || []).includes(k));
}
function trkBadge(p){
  if(!p.coupon || !FB_ON || !(p.author === ME || FB.isAdmin)) return '';
  const n = trackerUids(p).length;
  return n ? `<button class="ab" onclick="showTrackers(${p.id})" aria-label="Kuponu takip edenler">${ic('bm',21)} ${n}</button>` : '';
}
function showTrackers(id){
  const p = posts.find(x => x.id === id);
  if(!p || !(p.author === ME || FB.isAdmin)) return;
  const us = trackerUids(p);
  const rows = us.map(uid => {
    const key = FB.keyOf[uid];
    if(!key || !USERS[key]) return '';
    return `<div class="trk-row" onclick="this.closest('.dlg').remove();openProfile('${esc(key)}')"><span style="display:block;flex:none">${av(key,'s')}</span><b>${esc(dn(key))}</b><small>${esc(USERS[key].h || '')}</small></div>`;
  }).join('');
  const d = document.createElement('div');
  d.className = 'dlg';
  d.innerHTML = `<div class="dlg-card" style="text-align:left;max-width:360px"><h3 style="text-align:center">Kuponu takip edenler (${us.length})</h3><div class="trk-list">${rows || '<p style="text-align:center">Henüz kimse takip etmiyor.</p>'}</div><div class="dlg-row"><button class="no">Kapat</button></div></div>`;
  d.onclick = e => { if(e.target === d) d.remove(); };
  d.querySelector('.no').onclick = () => d.remove();
  document.body.appendChild(d);
}
function toggleTrack(id){
  const p = posts.find(x => x.id === id);
  if(!p || !p.coupon || p.author === ME) return;   // kendi kuponunu takip edemez
  const k = tk(p);
  if(tracked[k]) delete tracked[k]; else tracked[k] = true;
  if(FB_ON) fbTrack(k, !!tracked[k]);
  else { try{ localStorage.setItem('gs-tracked', JSON.stringify(tracked)); }catch(e){} }
  showToast(tracked[k] ? 'Kupon takip listene eklendi' : 'Kupon takipten çıkarıldı');
  rerender();
}

