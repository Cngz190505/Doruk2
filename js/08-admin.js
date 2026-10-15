/* ============ YÖNETİM: admin paneli, yasaklama, giriş/çıkış kaydı ============ */
FB.meta = {}; FB.bans = {}; FB.isAdmin = false; FB.ban = null; FB.isMod = false; FB.mods = {}; FB.maint = null; FB.adminChecked = false;
let admOpen = false, adm = {q:'', f:'all'};
const banActive = b => !!b && (b.until === 0 || b.until > Date.now());
function fbMeta(extra){
  if(!FB.uid || !FB.db) return Promise.resolve();
  const u = (FB.auth && FB.auth.currentUser) || {};
  const d = Object.assign({email: u.email || '', name: USERS[ME].name, handle: USERS[ME].h.replace(/^@/, '')}, extra);
  return fbDoc('userMeta', FB.uid).set(d, {merge: true}).catch(() => {});
}
function fbExtraStart(){
  const u = FB.auth.currentUser, uid = FB.uid;
  FB.adminChecked = false; try{ maintStart(); maintEval(); }catch(e){}   // yönetici olduğu doğrulanana kadar bakım açıksa ekran kapalı kalır
  let li = Date.now(); try{ li = Date.parse(u.metadata.lastSignInTime) || li; }catch(e){}
  fbMeta({lastLogin: li, lastSeen: Date.now(), createdAt: (FB.me && FB.me.createdAt) || 0});
  FB.hbT = setInterval(() => { if(sessionOn && !document.hidden && FB.uid === uid) fbMeta({lastSeen: Date.now()}); }, 120000);
  FB.unsub.push((window.__banReady = false, fbDoc('bans', uid).onSnapshot(s => { FB.ban = s.exists ? s.data() : null; checkBan(); window.__banReady = true; }, () => { window.__banReady = true; })));
  try{ chatStart(); }catch(e){}
  modStart(uid);
  FB.banT = setInterval(checkBan, 20000);
  FB.adminIds = FB.adminIds || {}; try{ FB.db.collection('admins').get().then(q => { q.forEach(d => { FB.adminIds[d.id] = 1; }); try{ rerender(); }catch(e){} }).catch(() => {}); }catch(e){}
  fbDoc('admins', uid).get().then(d => {
    if(FB.uid !== uid) return;
    const flag = !!(FB.me && FB.me.isAdmin);
    if(d.exists){ FB.isAdmin = true; adminListen(); if(!flag) fbDoc('users', uid).update({isAdmin: true}).then(() => showToast('Yönetici rozeti diğer kullanıcılara açıldı ✓')).catch(e => showToast('Rozet yazılamadı: ' + fbErr(e))); }
    else if(flag) fbDoc('users', uid).update({isAdmin: false}).catch(() => {});
    FB.adminChecked = true; try{ maintEval(); }catch(e){}
    try{ rerender(); }catch(e){}
  }).catch(() => { if(FB.uid === uid){ FB.adminChecked = true; try{ maintEval(); }catch(e){} } });
}
document.addEventListener('visibilitychange', () => { if(!document.hidden && FB.uid && sessionOn) fbMeta({lastSeen: Date.now()}); });
/* ---- Duyuru (kayan yazı): shop/announce -> {text, active, until, hours} ---- */
let _tkSig = '';
const annLive = a => !!(a && a.active && a.text && (+a.until || 0) > Date.now());
function tickerPaint(){
  const el = $('ticker'); if(!el) return;
  const a = (typeof FB !== 'undefined' && FB.ann) || null, on = annLive(a);
  const sig = on ? a.text + '|' + a.until : '';
  if(sig === _tkSig) return;
  _tkSig = sig;
  if(!on){ el.classList.add('hidden'); el.innerHTML = ''; document.documentElement.style.setProperty('--tkH', '0px'); return; }
  const t = esc(a.text), g = '<div class="tk-g"><span>' + t + '</span></div>';
  el.innerHTML = '<div class="tk"><div class="tk-b"><i>📢</i>DUYURU</div><div class="tk-v"><div class="tk-t">' + g + g + '</div></div></div>';
  el.classList.remove('hidden');
  requestAnimationFrame(() => { try{
    document.documentElement.style.setProperty('--tkH', (el.offsetHeight + 8) + 'px');
    const tr = el.querySelector('.tk-t'), gr = el.querySelector('.tk-g');
    if(tr && gr) tr.style.setProperty('--tkd', Math.max(10, gr.getBoundingClientRect().width / 60) + 's');
  }catch(e){} });
}
setInterval(() => { try{ tickerPaint(); if(typeof admOpen !== 'undefined' && admOpen && FB.ann && FB.ann.active) renderAdmin(true); }catch(e){} }, 20000);
function annDraft(k, v){ adm[k] = v; }
function admAnnPublish(){
  if(!FB.isAdmin) return;
  const text = String(adm.annT !== undefined ? adm.annT : '').trim().replace(/\s+/g, ' ');
  const h = parseFloat(String(adm.annH !== undefined ? adm.annH : '1').replace(',', '.'));
  if(!text) return showToast('Duyuru metni yaz.');
  if(!isFinite(h) || h <= 0 || h > 720) return showToast('Süre 0 ile 720 saat arasında olmalı.');
  fbDoc('shop', 'announce').set({text: text.slice(0, 300), active: true, hours: h, until: Date.now() + Math.round(h * 3600000), at: Date.now(), by: FB.uid})
    .then(() => showToast('📢 Duyuru yayında')).catch(e => showToast(fbErr(e)));
}
function admAnnStop(){
  if(!FB.isAdmin) return;
  fbDoc('shop', 'announce').update({active: false}).then(() => showToast('Duyuru durduruldu')).catch(e => showToast(fbErr(e)));
}
function admAnnCard(){
  const a = FB.ann || null, on = annLive(a);
  const t = adm.annT !== undefined ? adm.annT : ((a && a.text) || '');
  const h = adm.annH !== undefined ? adm.annH : ((a && a.hours) || 3);
  return `<div class="ad-ann"><h4>📢 Duyuru <em class="${on ? '' : 'off'}">${on ? 'Yayında' : 'Kapalı'}</em></h4>
    <textarea id="ad-ann-t" maxlength="300" placeholder="Kayan yazıda görünecek duyuru…" oninput="annDraft('annT',this.value)">${esc(t)}</textarea>
    <div class="ar"><label for="ad-ann-h">Süre (saat)</label><input id="ad-ann-h" type="number" inputmode="decimal" min="0.1" step="any" value="${esc(String(h))}" oninput="annDraft('annH',this.value)">
      ${[1, 3, 6, 12, 24].map(n => `<button type="button" class="q" onclick="adm.annH='${n}';renderAdmin(true)">${n} sa</button>`).join('')}</div>
    <div class="ab"><button class="go" onclick="admAnnPublish()">${on ? 'Güncelle ve yayınla' : 'Yayınla'}</button>${on ? '<button class="stop" onclick="admAnnStop()">Durdur</button>' : ''}</div>
    ${on ? `<div class="st">Kalan süre: ${esc(leftTxt(a.until - Date.now()))}</div>` : ''}</div>`;
}
// ---- Moderatör: mods/{uid} belgesi olan kişi SADECE kullanıcı yasaklayabilir / yasağı kaldırabilir ----
const isAdminUid = u => !!(u && ((FB.adminIds && FB.adminIds[u]) || (FB.users && FB.users[u] && FB.users[u].isAdmin)));   // admins koleksiyonu başkalarına kapalı: users.isAdmin rozetine bakılır
const canBan = () => !!(typeof FB !== 'undefined' && (FB.isAdmin || FB.isMod));
const isModKey = k => { try{ if(k === ME) return !!FB.isMod; const u = USERS[k] && USERS[k].uid; return !!(u && FB.mods && FB.mods[u]); }catch(e){ return false; } };
function banListen(){
  if(FB._banL) return; FB._banL = true;
  FB.unsub.push(FB.db.collection('bans').limit(500).onSnapshot(s => { FB.bans = {}; s.forEach(d => { FB.bans[d.id] = d.data(); }); if(admOpen) renderAdmin(); try{ rerender(); }catch(e){} }, () => { FB._banL = false; }));
}
function modStart(uid){
  let first = true;
  FB.unsub.push(FB.db.collection('mods').limit(100).onSnapshot(s => {
    if(FB.uid !== uid) return;
    FB.mods = {}; s.forEach(d => { FB.mods[d.id] = d.data(); });
    const was = FB.isMod; FB.isMod = !!FB.mods[uid];
    if(FB.isMod && !FB.isAdmin) banListen();
    if(!first && FB.isMod && !was) showToast('🛡️ Sana moderatör yetkisi verildi: kullanıcıları yasaklayabilirsin.');
    if(!first && !FB.isMod && was) showToast('Moderatör yetkin kaldırıldı.');
    first = false;
    try{ rerender(); }catch(e){}
    if(admOpen) try{ renderAdmin(true); }catch(e){}
  }, () => {}));
}
function adminListen(){
  try{ rerender(); }catch(e){}
  FB.unsub.push(FB.db.collection('userMeta').limit(500).onSnapshot(s => { FB.meta = {}; s.forEach(d => { FB.meta[d.id] = d.data(); }); if(admOpen) renderAdmin(); }, e => showToast(fbErr(e))));
  banListen();
}
// ---- Yasaklı kullanıcı ekranı ----
function checkBan(){ if(banActive(FB.ban)) showBanned(FB.ban); else hideBanned(); }
let bnTimer = null;
function bnTick(until){
  const el = $('bn-left'); if(!el) return;
  const ms = until - Date.now();
  if(ms <= 0){ el.textContent = 'Süre doldu'; clearInterval(bnTimer); bnTimer = null; try{ checkBan(); }catch(e){} return; }
  const t = Math.floor(ms / 1000), z = n => String(n).padStart(2, '0');
  const d = Math.floor(t / 86400), h = Math.floor(t % 86400 / 3600), m = Math.floor(t % 3600 / 60), sn = t % 60;
  el.textContent = (d ? d + ' gün ' : '') + z(h) + ':' + z(m) + ':' + z(sn);
}
function showBanned(b){
  $('bn-why').textContent = b.reason ? 'Sebep: ' + b.reason : 'Hesabın yönetici tarafından kısıtlandı.';
  const perm = b.until === 0;
  $('bn-until').textContent = perm ? 'Kalıcı' : fmtStamp(b.until);
  $('bn-until-l').textContent = perm ? 'Yasak' : 'Yasak bitişi';
  $('bn-left-row').style.display = perm ? 'none' : '';
  clearInterval(bnTimer); bnTimer = null;
  if(!perm){ bnTick(b.until); bnTimer = setInterval(() => bnTick(b.until), 1000); }
  $('banned').classList.remove('hidden');
}
function hideBanned(){ clearInterval(bnTimer); bnTimer = null; const e = $('banned'); if(e) e.classList.add('hidden'); }
function bannedOut(){ setSession(false); fbSignOut(); hideBanned(); showAuth(); }
// ---- Panel ----
const agoTxt = ts => {
  if(!ts) return '—';
  const d = Date.now() - ts;
  if(d < 60000) return 'az önce';
  if(d < 3600000) return Math.floor(d / 60000) + ' dk önce';
  if(d < 86400000) return Math.floor(d / 3600000) + ' sa önce';
  if(d < 7 * 86400000) return Math.floor(d / 86400000) + ' gün önce';
  return fmtStamp(ts);
};
const leftTxt = ms => ms < 3600000 ? Math.max(1, Math.ceil(ms / 60000)) + ' dk' : ms < 86400000 ? Math.ceil(ms / 3600000) + ' sa' : Math.ceil(ms / 86400000) + ' gün';
function openAdmin(){ if(!FB.isAdmin) return; closeSettings(); admOpen = true; adm = {q:'', f:'all'}; renderAdmin(); $('asheet').classList.remove('hidden'); }
function closeAdmin(){ admOpen = false; const e = $('asheet'); if(e) e.classList.add('hidden'); }
function admSet(k, v){ adm[k] = v; renderAdmin(true); }

/* ---- Yönetici: puan ekle / çerçeve hediye et ---- */
function grantSync(){
  const g = FB.grants && FB.grants[FB.uid]; if(!g) return;
  const fr = (g.frames || []).filter(i => FR_BY[i] && !SHOP.owned.includes(i));
  if(fr.length){
    fr.forEach(i => SHOP.owned.push(i));
    SHOP.eq = fr[fr.length - 1];   // yönetici hediyesi otomatik giyilir
    shopSave();
    try{ rerender(); }catch(e){}
    showToast('🎁 Yönetici sana hediye çerçeve verdi: ' + fr.map(i => FR_BY[i].n).join(', '));
  }
  let seen = 0; try{ seen = +localStorage.getItem('gs-grant-seen') || 0; }catch(e){}
  const pts = +g.pts || 0;
  if(g.note && g.at && g.at > seen && !fr.length){ showToast('🎁 ' + g.note); }
  try{ if(g.at) localStorage.setItem('gs-grant-seen', String(g.at)); }catch(e){}
  if(!$('shsheet').classList.contains('hidden') && !shopEdit) paintShop();
}
function admGift(uid){
  if(!FB.isAdmin) return;
  const u = FB.users[uid] || {}, name = u.name || 'Kullanıcı', key = (FB.keyOf && FB.keyOf[uid]) || null;
  const g = FB.grants[uid] || {}, have = g.frames || [];
  const tot = () => { try{ return Math.max(0, key ? scoreOf(key).raw : 0); }catch(e){ return 0; } };
  const d = document.createElement('div');
  d.className = 'dlg';
  d.innerHTML = `<div class="dlg-card gift-card" role="dialog">
    <h3>🎁 ${esc(name)}</h3>
    <p style="margin-bottom:12px">Toplam puan: <b id="gf-tot">${fmtPts(tot())}</b></p>
    <div class="gift-sec"><small>Puan artır / azalt</small>
      <div class="gift-row"><input id="gf-pts" type="number" inputmode="decimal" step="any" min="0" placeholder="Miktar (örn. 5)"></div>
      <div class="gift-row" style="margin-top:8px"><button id="gf-dec" style="flex:1;background:var(--sf2);color:var(--tx);height:42px">− Azalt</button><button id="gf-inc" style="flex:1;height:42px">+ Artır</button></div></div>
    <div class="gift-sec"><small>Puanı doğrudan belirle</small>
      <div class="gift-row"><input id="gf-set" type="number" inputmode="decimal" step="any" min="0" placeholder="Yeni toplam puan"><button id="gf-setbtn">Belirle</button></div>
      <div class="gift-row" style="margin-top:8px"><button id="gf-zero" style="flex:1;background:var(--sf2);color:#ef4444;height:42px">Tüm puanı sil (sıfırla)</button></div></div>
    ${isAdminUid(uid) ? '' : `<div class="gift-sec"><small>Yetki</small>
      <div class="gift-row"><button id="gf-mod" style="flex:1;height:42px"></button></div>
      <div style="font-size:12px;color:var(--mu);margin-top:6px">Moderatör sadece kullanıcıları yasaklayabilir ve yasağı kaldırabilir. Başka yetkisi olmaz.</div></div>`}
    <div class="gift-sec"><small>Hediye çerçeve</small>
      <div class="gift-fr">${FRAMES.filter(f => !f.priv).map(f => `<button data-f="${f.id}" class="${have.includes(f.id) ? 'on' : ''}"><span class="frw fr-${f.id}"><span class="gf-av"></span><img class="fi" src="${f.img}" alt=""></span><b>${esc(f.n)}</b><i>${have.includes(f.id) ? 'Verildi' : 'Gönder'}</i></button>`).join('')}</div></div>
    <div class="dlg-row" style="margin-top:14px"><button class="no">Kapat</button></div></div>`;
  const close = () => d.remove();
  d.onclick = e => { if(e.target === d) close(); };
  d.querySelector('.no').onclick = close;
  const F = firebase.firestore.FieldValue;
  const paint = () => setTimeout(() => { const e = d.querySelector('#gf-tot'); if(e) e.textContent = fmtPts(tot()); }, 500);
  const num = id => { const raw = d.querySelector(id).value.trim(), n = Math.round(+raw * 100) / 100; return (!raw || !isFinite(n) || Math.abs(n) > 1000000) ? null : n; };
  // artır / azalt: yönetici ayarına eklenir, kuponlardan gelen puana dokunmaz
  const delta = sign => {
    const n = num('#gf-pts');
    if(n === null || n <= 0){ showToast('Geçerli bir puan yaz.'); return; }
    const v = n * sign;
    fbDoc('grants', uid).set({pts: F.increment(v), at: Date.now(), note: 'Yönetici sana ' + (v > 0 ? '+' : '') + fmtPts(v) + ' puan ' + (v > 0 ? 'ekledi' : 'düşürdü')}, {merge: true})
      .then(() => { showToast(name + ': ' + (v > 0 ? '+' : '') + fmtPts(v) + ' puan'); d.querySelector('#gf-pts').value = ''; paint(); })
      .catch(e => showToast(fbErr(e)));
  };
  d.querySelector('#gf-inc').onclick = () => delta(1);
  d.querySelector('#gf-dec').onclick = () => delta(-1);
  // belirle / sıfırla: toplam puan istenen değere gelecek şekilde yönetici ayarı hesaplanır
  const setTotal = (T, msg) => {
    const gr = FB.grants[uid] || {}, manual = +gr.pts || 0, cur = key ? scoreOf(key).raw : 0;
    const val = Math.round((T - (cur - manual)) * 100) / 100;
    fbDoc('grants', uid).set({pts: val, at: Date.now(), note: msg}, {merge: true})
      .then(() => { showToast(name + ': toplam puan ' + fmtPts(T)); paint(); })
      .catch(e => showToast(fbErr(e)));
  };
  d.querySelector('#gf-setbtn').onclick = () => {
    const n = num('#gf-set');
    if(n === null || n < 0){ showToast('Geçerli bir puan yaz (0 veya üstü).'); return; }
    setTotal(n, 'Yönetici puanını ' + fmtPts(n) + ' yaptı'); d.querySelector('#gf-set').value = '';
  };
  const modBtn = d.querySelector('#gf-mod');
  if(modBtn){
    const paintMod = () => { const on = !!(FB.mods && FB.mods[uid]); modBtn.textContent = on ? '🛡️ Moderatör yetkisini kaldır' : '🛡️ Moderatör yap (sadece yasaklama)'; modBtn.style.background = on ? 'var(--sf2)' : 'var(--ac)'; modBtn.style.color = on ? '#ef4444' : 'var(--on)'; };
    paintMod();
    modBtn.onclick = () => {
      if(!FB.isAdmin) return;
      const on = !!(FB.mods && FB.mods[uid]);
      (on ? fbDoc('mods', uid).delete() : fbDoc('mods', uid).set({at: Date.now(), by: FB.uid, name: name}))
        .then(() => { if(on) delete FB.mods[uid]; else FB.mods[uid] = {at: Date.now()}; paintMod(); showToast(on ? name + ': moderatörlük kaldırıldı' : name + ' artık moderatör'); try{ rerender(); }catch(e){} })
        .catch(e => showToast(fbErr(e)));
    };
  }
  let zArm = 0;
  d.querySelector('#gf-zero').onclick = e => {
    const b = e.currentTarget;
    if(!zArm){ zArm = 1; b.textContent = 'Emin misin? Tekrar dokun'; setTimeout(() => { zArm = 0; b.textContent = 'Tüm puanı sil (sıfırla)'; }, 3500); return; }
    zArm = 0; b.textContent = 'Tüm puanı sil (sıfırla)';
    setTotal(0, 'Yönetici puanını sıfırladı');
  };
  d.querySelectorAll('.gift-fr button').forEach(b => { b.onclick = () => {
    const id = b.dataset.f, f = FR_BY[id];
    if(!f || b.classList.contains('on')) return;
    const F = firebase.firestore.FieldValue;
    fbDoc('grants', uid).set({frames: F.arrayUnion(id), at: Date.now(), note: 'Yönetici sana ' + f.n + ' çerçevesi hediye etti'}, {merge: true})
      .then(() => { b.classList.add('on'); b.querySelector('i').textContent = 'Verildi'; showToast(f.n + ' → ' + name); })
      .catch(e => showToast(fbErr(e)));
  }; });
  document.body.appendChild(d);
}
const admGiftBtn = (key, big) => {
  if(!(typeof FB !== 'undefined' && FB.isAdmin)) return '';
  const uid = key === ME ? FB.uid : (USERS[key] && USERS[key].uid); if(!uid) return '';
  return `<button class="px adm gift ${big ? 'big' : ''}" onclick="event.stopPropagation();admGift('${esc(uid)}')" aria-label="Puan / hediye" title="Puan / hediye">🎁</button>`;
};
function renderAdmin(keepQ){
  const body = $('asheet-body'); if(!body) return;
  const now = Date.now();
  const all = Object.keys(FB.users).map(uid => {
    const u = FB.users[uid], m = FB.meta[uid] || {}, b = FB.bans[uid], ba = banActive(b);
    return {uid, u, m, b, ba, on: !!m.lastSeen && now - m.lastSeen < 240000, seen: m.lastSeen || m.lastLogin || 0};
  });
  const q = adm.q.trim().toLowerCase();
  let list = all.filter(x => !q || [x.u.name, x.u.handle, x.m.email].some(t => String(t || '').toLowerCase().includes(q)));
  if(adm.f === 'on') list = list.filter(x => x.on);
  if(adm.f === 'ban') list = list.filter(x => x.ba);
  list.sort((a, b) => (b.on - a.on) || (b.seen - a.seen) || ((b.u.createdAt || 0) - (a.u.createdAt || 0)));
  const delList = Object.keys(FB.bans || {}).filter(uid => FB.bans[uid] && FB.bans[uid].deleted && !FB.users[uid])
    .map(uid => Object.assign({uid}, FB.bans[uid])).sort((a, b) => (b.at || 0) - (a.at || 0))
    .filter(b => !q || [b.name, b.handle].some(t => String(t || '').toLowerCase().includes(q)));
  const delRows = delList.map(b => `<div class="ad-row ban">
      <div class="ad-top"><span class="ad-av" style="background:${colorOf(b.name || '?')}">${esc((b.name || '?').slice(0, 2).toUpperCase())}</span>
        <div class="ad-n"><b>${esc(b.name || 'Kullanıcı')}</b><small>${b.handle ? '@' + esc(String(b.handle).replace(/^@/, '')) + ' · ' : ''}silindi ${esc(agoTxt(b.at))}</small></div><span class="ad-pill ban">Silinmiş</span></div>
      <div class="ad-act"><button class="unban" onclick="admRestore('${b.uid}')">Yasağı kaldır · tekrar girebilsin</button></div>
    </div>`).join('');
  const rows = adm.f === 'del' ? delRows : list.map(x => {
    const u = x.u, me = x.uid === FB.uid, key = FB.keyOf[x.uid];
    const bg = u.photo ? `url('${esc(u.photo)}')` : colorOf(u.name || '?');
    const pill = x.ba ? `<span class="ad-pill ban">${x.b.until === 0 ? 'Kalıcı yasak' : leftTxt(x.b.until - now) + ' yasak'}</span>` : x.on ? '<span class="ad-pill on">Çevrimiçi</span>' : '';
    return `<div class="ad-row ${x.ba ? 'ban' : ''}">
      <div class="ad-top">
        <span class="ad-av" style="background:${bg}"${key ? ` onclick="closeAdmin();openProfile('${esc(key)}', true)"` : ''}>${u.photo ? '' : esc((u.name || '?').slice(0, 2).toUpperCase())}</span>
        <div class="ad-n"><b>${esc(u.name || '')}${me ? ' (sen)' : ''}</b><small>@${esc(u.handle || '')}${x.m.email ? ' · ' + esc(x.m.email) : ''}</small></div>${pill}
      </div>
      <div class="ad-grid">
        <div><small>Kayıt</small><b>${u.createdAt ? esc(fmtStamp(u.createdAt)) : '—'}</b></div>
        <div><small>Son giriş</small><b>${esc(agoTxt(x.m.lastLogin))}</b></div>
        <div><small>Son görülme</small><b>${x.on ? 'Şu an' : esc(agoTxt(x.m.lastSeen))}</b></div>
        <div><small>Son çıkış</small><b>${esc(agoTxt(x.m.lastLogout))}</b></div>
      </div>
      ${x.ba && x.b.reason ? `<div class="ad-why">Sebep: ${esc(x.b.reason)}</div>` : ''}
      ${me ? '' : `<div class="ad-act">${x.ba ? `<button class="unban" onclick="admUnban('${x.uid}')">Yasağı kaldır</button>` : `<button class="ban" onclick="admBan('${x.uid}')">Yasakla</button>`}<button class="rm" onclick="admDelete('${x.uid}')">Hesabı sil</button></div>`}
      <div class="ad-act" style="margin-top:8px"><button class="gift" onclick="admGift('${x.uid}')">🎁 Puan / Hediye çerçeve</button></div>
    </div>`;
  }).join('');
  const F = [['all', 'Tümü'], ['on', 'Çevrimiçi'], ['ban', 'Yasaklı'], ['del', 'Silinenler' + (delList.length ? ' (' + delList.length + ')' : '')]];
  const keep = keepQ && document.getElementById('ad-q') === document.activeElement;
  const ae = document.activeElement, keepId = keepQ && ae && (ae.id === 'ad-ann-t' || ae.id === 'ad-ann-h') ? ae.id : '', keepPos = keepId ? ae.selectionStart : 0;
  body.innerHTML = `<div class="ad-sum"><div><b>${all.length}</b><small>Kayıtlı</small></div><div class="g"><b>${all.filter(x => x.on).length}</b><small>Çevrimiçi</small></div><div class="r"><b>${all.filter(x => x.ba).length}</b><small>Yasaklı</small></div></div>
    ${admMaintCard()}
    ${admChatLockCard()}
    ${admAnnCard()}
    <input class="ad-q" id="ad-q" placeholder="Ad, kullanıcı adı veya e-posta ara…" value="${esc(adm.q)}" oninput="adm.q=this.value;admList()">
    <div class="chips">${F.map(([k, l]) => `<button class="chip ${adm.f === k ? 'on' : ''}" onclick="admSet('f','${k}')">${l}</button>`).join('')}</div>
    <div id="ad-list">${rows || '<div class="empty">' + (adm.f === 'del' ? 'Silinmiş hesap yok.' : 'Kullanıcı bulunamadı.') + '</div>'}</div>`;
  if(keep){ const i = $('ad-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  if(keepId){ const i = $(keepId); i.focus(); try{ i.setSelectionRange(keepPos, keepPos); }catch(e){} }
}
let _admT = 0;
function admList(){ clearTimeout(_admT); _admT = setTimeout(() => renderAdmin(true), 180); }
function admRestore(uid){
  const b = (FB.bans && FB.bans[uid]) || {};
  askConfirm('Yasağı kaldır: ' + (b.name || 'Kullanıcı'), 'Silinen hesabın kalıcı yasağı kaldırılır. Kullanıcı aynı e-posta ve şifreyle tekrar girebilir; yeni, boş bir profil açılır (eski paylaşımlar ve puanlar geri gelmez).', 'Yasağı kaldır', () => {
    fbDoc('bans', uid).delete().then(() => showToast((b.name || 'Kullanıcı') + ' tekrar girebilir')).catch(e => showToast(fbErr(e)));
  });
}
function admUnban(uid){
  const u = FB.users[uid] || {};
  askConfirm('Yasağı kaldır', (u.name || 'Kullanıcı') + ' için yasak kaldırılsın mı?', 'Kaldır', () => {
    fbDoc('bans', uid).delete().then(() => showToast('Yasak kaldırıldı')).catch(e => showToast(fbErr(e)));
  });
}
function admDelete(uid){
  if(!FB.isAdmin || uid === FB.uid) return;
  const u = FB.users[uid] || {}, name = u.name || 'Kullanıcı';
  askConfirm('Hesabı sil: ' + name, 'Profili, paylaşımları, yorumları ve kullanıcı adı silinir. Aynı hesapla bir daha giriş yapamaz. Bu işlem geri alınamaz. Emin misin?', 'Hesabı sil', async () => {
    try{
      const B = FB.db.batch();
      (FB.rawPosts || []).forEach(r => {
        if(r.uid === uid) B.delete(fbDoc('posts', r.docId));
        else if((r.comments || []).some(c => c.uid === uid)) B.update(fbDoc('posts', r.docId), {comments: r.comments.filter(c => c.uid !== uid)});
      });
      if(u.handle) B.delete(fbDoc('handles', String(u.handle).replace(/^@/, '').toLowerCase()));
      B.delete(fbDoc('userMeta', uid));
      B.set(fbDoc('bans', uid), {until: 0, reason: 'Hesap yönetici tarafından silindi', deleted: true, by: FB.uid, at: Date.now(), name: u.name || '', handle: u.handle || ''});
      B.delete(fbDoc('users', uid));
      await B.commit();
      showToast(name + ' hesabı silindi');
    }catch(e){ showToast(fbErr(e)); }
  });
}
function admBan(uid){
  if(!canBan()) return;
  const u = FB.users[uid] || {};
  const OPT = [['1 Saat', 3600000], ['1 Gün', 86400000], ['7 Gün', 7 * 86400000], ['30 Gün', 30 * 86400000], ['Kalıcı', 0]];
  let dur = 86400000;
  const d = document.createElement('div');
  d.className = 'dlg';
  d.innerHTML = `<div class="dlg-card" style="text-align:left;max-width:360px"><h3 style="text-align:center">Yasakla: ${esc(u.name || '')}</h3>
    <p style="margin-bottom:6px;text-align:center">Yasak süresi</p>
    <div class="bn-opts">${OPT.map(([l, v]) => `<button class="chip ${v === dur ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
    <input class="bn-in" id="bn-reason" maxlength="120" placeholder="Sebep (isteğe bağlı)">
    ${FB.isAdmin ? '<label class="bn-chk"><input type="checkbox" id="bn-del"> Paylaşımlarını da sil</label>' : ''}
    <div class="dlg-row"><button class="no">Vazgeç</button><button class="del">Yasakla</button></div></div>`;
  const close = () => d.remove();
  d.onclick = e => { if(e.target === d) close(); };
  d.querySelectorAll('.bn-opts .chip').forEach(b => { b.onclick = () => { dur = +b.dataset.v; d.querySelectorAll('.bn-opts .chip').forEach(x => x.classList.toggle('on', x === b)); }; });
  d.querySelector('.no').onclick = close;
  d.querySelector('.del').onclick = async () => {
    const reason = d.querySelector('#bn-reason').value.trim(), del = !!(FB.isAdmin && d.querySelector('#bn-del') && d.querySelector('#bn-del').checked);
    close();
    try{
      await fbDoc('bans', uid).set({until: dur === 0 ? 0 : Date.now() + dur, reason, by: FB.uid, at: Date.now(), name: u.name || '', handle: u.handle || ''});
      if(del && FB.rawPosts){
        const b = FB.db.batch(); let n = 0;
        FB.rawPosts.filter(r => r.uid === uid).forEach(r => { b.delete(fbDoc('posts', r.docId)); n++; });
        if(n) await b.commit();
      }
      showToast((u.name || 'Kullanıcı') + ' yasaklandı');
    }catch(e){ showToast(fbErr(e)); }
  };
  document.body.appendChild(d);
}

/* ---- Bakım modu: config/maintenance -> {on, at, by}. Açıkken yönetici dışında herkese bakım ekranı gösterilir ---- */
function maintStart(){
  if(FB._maintL || !FB.db) return; FB._maintL = true;
  const known = () => { FB.maintKnown = true; maintEval(); };
  FB.db.collection('config').doc('maintenance').onSnapshot(s => {
    FB.maint = s.exists ? s.data() : null; FB.maintKnown = true;
    try{ localStorage.setItem('gs-maint', FB.maint && FB.maint.on ? '1' : '0'); }catch(e){}   // bir sonraki açılışta splash'tan sonra değil, doğrudan bakım ekranı gelsin
    maintEval();
  }, () => {   // okunamazsa siteyi kapatma
    FB._maintL = false; FB.maint = null;
    try{ localStorage.setItem('gs-maint', '0'); }catch(e){}
    known();
  });
  setTimeout(() => { if(!FB.maintKnown) known(); }, 12000);   // bağlantı gelmezse eski önbellek siteyi sonsuza dek kapalı tutmasın
}
function maintEval(){
  let cached = false; try{ cached = localStorage.getItem('gs-maint') === '1'; }catch(e){}
  const on = FB.maintKnown ? !!(FB.maint && FB.maint.on) : cached, signed = !!FB.uid;
  if(on && signed && FB.adminChecked && !FB.isAdmin) window.__maintAdm = false;   // yönetici olmayan biri "yönetici girişi" ile girse de tekrar kapatılır
  const block = on && !FB.isAdmin && !(window.__maintAdm && !signed);
  document.body.classList.toggle('maint', block);
  let b = document.getElementById('maint-bar');
  if(on && FB.isAdmin){
    if(!b){ b = document.createElement('button'); b.id = 'maint-bar'; b.type = 'button'; b.className = 'maint-bar'; b.onclick = () => { try{ openAdmin(); }catch(e){} }; document.body.appendChild(b); }
    b.innerHTML = '<i></i>Bakım modu açık';
  } else if(b) b.remove();
  if(typeof admOpen !== 'undefined' && admOpen) try{ renderAdmin(true); }catch(e){}
}
function maintAdminLogin(){ window.__maintAdm = true; maintEval(); try{ showAuth(); }catch(e){} }
function admMaintCard(){
  const on = !!(FB.maint && FB.maint.on);
  return `<div class="ad-mt ${on ? 'on' : ''}"><span class="ad-mt-i">🛠</span><div class="ad-mt-t"><b>Bakım modu <em>${on ? 'Açık' : 'Kapalı'}</em></b><small>${on ? 'Site herkese kapalı. Sen yönetici olarak girebiliyorsun.' : 'Site herkese açık.'}</small></div><button type="button" class="ad-mt-b" onclick="admMaintToggle()">${on ? 'Bakımı kapat' : 'Siteyi bakıma al'}</button></div>`;
}
function admMaintToggle(){
  if(!FB.isAdmin) return;
  const on = !!(FB.maint && FB.maint.on);
  askConfirm(on ? 'Bakım modu kapatılsın mı?' : 'Site bakıma alınsın mı?',
    on ? 'Site herkese yeniden açılır.' : 'Sen hariç herkese bakım ekranı gösterilir, kimse giriş yapamaz. Kapatana kadar böyle kalır.',
    on ? 'Bakımı kapat' : 'Bakıma al', () => {
      fbDoc('config', 'maintenance').set({on: !on, at: Date.now(), by: FB.uid})
        .then(() => showToast(on ? 'Site herkese açıldı ✓' : 'Site bakıma alındı 🛠'))
        .catch(e => showToast(fbErr(e)));
    });
}

/* ---- Genel sohbet kilidi: config/chat -> {locked, at, by}. Açıkken yönetici dışında kimse mesaj yazamaz ---- */
function admChatLockCard(){
  const on = !!(FB.chatLock && FB.chatLock.locked);
  return `<div class="ad-mt ${on ? 'on' : ''}"><span class="ad-mt-i">🔒</span><div class="ad-mt-t"><b>Genel sohbet <em>${on ? 'Kilitli' : 'Açık'}</em></b><small>${on ? 'Sadece yönetici yazabilir, herkes okuyabilir.' : 'Herkes mesaj yazabilir.'}</small></div><button type="button" class="ad-mt-b" onclick="admChatLockToggle()">${on ? 'Kilidi aç' : 'Sohbeti kilitle'}</button></div>`;
}
function admChatLockToggle(){
  if(!FB.isAdmin) return;
  const on = !!(FB.chatLock && FB.chatLock.locked);
  askConfirm(on ? 'Sohbet kilidi açılsın mı?' : 'Genel sohbet kilitlensin mi?',
    on ? 'Herkes yeniden mesaj yazabilir.' : 'Sen hariç kimse mesaj yazamaz, mesajlar okunmaya devam eder. Açana kadar böyle kalır.',
    on ? 'Kilidi aç' : 'Kilitle', () => {
      fbDoc('config', 'chat').set({locked: !on, at: Date.now(), by: FB.uid})
        .then(() => showToast(on ? 'Sohbet açıldı ✓' : 'Sohbet kilitlendi 🔒'))
        .catch(e => showToast(fbErr(e)));
    });
}
