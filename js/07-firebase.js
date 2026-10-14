/* ============ FIREBASE ENTEGRASYONU ============ */
const FB = {ready:false, auth:null, db:null, uid:null, me:null, unsub:[], users:{}, rawPosts:null, keyOf:{}, followUids:new Set(), busy:false};
const FB_VER = '10.12.2';
function fbLoad(){
  return new Promise((res, rej) => {
    if(window.firebase && firebase.apps) return res();
    const srcs = ['app','auth','firestore'].map(n => 'https://www.gstatic.com/firebasejs/' + FB_VER + '/firebase-' + n + '-compat.js');
    let i = 0;
    const next = () => {
      if(i >= srcs.length) return res();
      const s = document.createElement('script');
      s.src = srcs[i++]; s.onload = next; s.onerror = () => rej(new Error('Firebase yüklenemedi'));
      document.head.appendChild(s);
    };
    next();
  });
}
const FB_ERR = {
  'auth/invalid-credential':'Kullanıcı adı / e-posta veya şifre hatalı.',
  'auth/wrong-password':'Kullanıcı adı / e-posta veya şifre hatalı.',
  'auth/user-not-found':'Kullanıcı adı / e-posta veya şifre hatalı.',
  'auth/email-already-in-use':'Bu e-posta zaten kayıtlı.',
  'auth/weak-password':'Şifre çok zayıf.',
  'auth/invalid-email':'Geçerli bir e-posta adresi yaz.',
  'auth/too-many-requests':'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.',
  'auth/network-request-failed':'Bağlantı kurulamadı. İnternetini kontrol et.',
  'auth/popup-closed-by-user':'Giriş penceresi kapatıldı.',
  'auth/cancelled-popup-request':'Giriş penceresi kapatıldı.',
  'auth/popup-blocked':'Tarayıcı açılır pencereyi engelledi.',
  'permission-denied':'Yetki hatası: Firestore kuralları yayınlandı mı?'
};
const fbErr = e => FB_ERR[e && e.code] || (e && e.message) || 'İşlem başarısız.';
const fbDoc = (c, id) => FB.db.collection(c).doc(id);

async function fbInit(){
  try{
    await fbLoad();
    firebase.initializeApp(FIREBASE_CONFIG);
    FB.auth = firebase.auth(); FB.db = firebase.firestore();
    FB.ready = true;
    try{ maintStart(); }catch(e){}   // bakım modunu giriş yapmadan önce de dinle
    FB.auth.onAuthStateChanged(fbOnUser);
  }catch(e){
    showToast('Sunucuya bağlanılamadı.');
    if(!sessionOn) showAuth();
    window.__banReady = true; gsReadyMark();
  }
}

async function fbLoadProfile(uid){
  const d = await fbDoc('users', uid).get();
  return d.exists ? d.data() : null;
}
async function fbCreateProfile(u, name, handle, email, photo){
  const hRef = fbDoc('handles', handle), uRef = fbDoc('users', u.uid);
  await FB.db.runTransaction(async t => {
    const h = await t.get(hRef);
    if(h.exists) throw Object.assign(new Error('taken'), {code:'handle-taken'});
    t.set(hRef, {uid:u.uid, email:email || ''});
    t.set(uRef, {name, handle, bio:'', photo: photo || '', cover:'', following:[], createdAt:Date.now()});
  });
}
async function fbEnsureProfile(u){
  const email = u.email || '';
  let base = cleanHandle(email.split('@')[0] || '');
  if(base.length < HANDLE_MIN) base = 'kullanici';
  let name = (u.displayName || base).trim().replace(/\s+/g, ' ').slice(0, NAME_MAX);
  if(name.length < 2) name = base;
  for(let i = 0; i < 6; i++){
    const h = i ? base.slice(0, HANDLE_MAX - 4) + Math.floor(1000 + Math.random() * 9000) : base.slice(0, HANDLE_MAX);
    try{ await fbCreateProfile(u, name, h, email); return await fbLoadProfile(u.uid); }
    catch(e){ if(e.code !== 'handle-taken') throw e; }
  }
  throw new Error('Kullanıcı adı oluşturulamadı.');
}

// Giriş / kayıt (submitAuth buraya yönlenir)
async function fbAuth(b, reg){
  if(!FB.ready) throw new Error('Sunucuya bağlanılamadı. İnternetini kontrol et.');
  FB.busy = true;
  try{
    if(reg){
      if((await fbDoc('handles', b.handle).get()).exists) throw new Error('@' + b.handle + ' kullanılmakta. Başka bir kullanıcı adı dene.');
      const cred = await FB.auth.createUserWithEmailAndPassword(b.email, b.password);
      try{ await fbCreateProfile(cred.user, b.name, b.handle, b.email, b.photo); }
      catch(e){
        await cred.user.delete().catch(() => {});
        throw e.code === 'handle-taken' ? new Error('@' + b.handle + ' kullanılmakta. Başka bir kullanıcı adı dene.') : e;
      }
      const p = await fbLoadProfile(cred.user.uid);
      fbStart(cred.user.uid, p);
      return {token:'fb', user:{name:p.name, handle:p.handle, email:b.email, photo:p.photo || ''}};
    }
    let email = b.id;
    if(!email.includes('@')){
      const hs = await fbDoc('handles', cleanHandle(email)).get();
      if(!hs.exists || !hs.data().email) throw new Error('Kullanıcı adı / e-posta veya şifre hatalı.');
      email = hs.data().email;
    }
    const cred = await FB.auth.signInWithEmailAndPassword(email, b.password);
    const p = (await fbLoadProfile(cred.user.uid)) || await fbEnsureProfile(cred.user);
    fbStart(cred.user.uid, p);
    return {token:'fb', user:{name:p.name, handle:p.handle, email}};
  }catch(e){ throw new Error(fbErr(e)); }
  finally{ FB.busy = false; }
}
function fbGoogle(){
  if(!FB.ready) return showToast('Sunucuya bağlanılamadı.');
  authRun(async () => {
    FB.busy = true;
    try{
      const cred = await FB.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      const p = (await fbLoadProfile(cred.user.uid)) || await fbEnsureProfile(cred.user);
      fbStart(cred.user.uid, p);
      return {token:'fb', user:{name:p.name, handle:p.handle, email:cred.user.email || ''}};
    }catch(e){ throw new Error(fbErr(e)); }
    finally{ FB.busy = false; }
  });
}

// Oturum durumu değişince (sayfa açılışı dahil)
async function fbOnUser(user){
  if(FB.busy) return;
  if(!user){
    fbStop(); setSession(false);
    if($('auth').classList.contains('hidden')) showAuth();
    window.__banReady = true; gsReadyMark();
    return;
  }
  if(FB.uid === user.uid) return;
  let p;
  try{ p = (await fbLoadProfile(user.uid)) || await fbEnsureProfile(user); }
  catch(e){ showToast(fbErr(e)); window.__banReady = true; gsReadyMark(); return; }
  if(FB.busy || !p) return;
  const h = '@' + p.handle;
  fbCacheProfile(p, h !== USERS[ME].h);
  if(h !== USERS[ME].h){ location.reload(); return; }   // başka hesap: cihazdaki eski profil verisi temizlendi
  USERS[ME].name = p.name; USERS[ME].bio = p.bio || ''; USERS[ME].bioColor = p.bioColor || '';
  myPhoto = p.photo || ''; myCover = p.cover || ''; applyMyImgs();
  SHOP = shopNorm(p.shop); try{ localStorage.setItem('gs-shop', JSON.stringify(SHOP)); }catch(e){}
  setSession(true);
  $('auth').classList.add('hidden');
  fbStart(user.uid, p);
  photoGate();
}
function fbCacheProfile(p, wipe){
  if(wipe) wipeUserData();
  try{
    localStorage.setItem('gs-name', p.name); localStorage.setItem('gs-handle', '@' + p.handle);
    localStorage.setItem('gs-bio', p.bio || ''); localStorage.setItem('gs-bioc', p.bioColor || ''); localStorage.setItem('gs-photo', p.photo || ''); localStorage.setItem('gs-cover', p.cover || '');
    if(FB.auth && FB.auth.currentUser && FB.auth.currentUser.email) localStorage.setItem('gs-email', FB.auth.currentUser.email);
  }catch(e){}
}
function fbStop(){
  FB.unsub.forEach(f => { try{ f(); }catch(e){} });
  try{ (FB.dayUn || []).forEach(f => f()); }catch(e){}
  FB.dayUn = []; FB.dayRaw = []; FB.unsub = []; tracked = {}; FB.uid = null; FB.me = null; FB.rawPosts = null; FB.users = {}; FB.notifs = []; clearTimeout(FB.nfT);
  try{ notifBadge(); }catch(e){}
  FB.isAdmin = false; FB.isMod = false; FB.mods = {}; FB._banL = false; FB.ban = null; FB.meta = {}; FB.bans = {}; clearInterval(FB.hbT); clearInterval(FB.banT); try{ hideBanned(); closeAdmin(); chatStop(); }catch(e){}
  FB.adminChecked = false; try{ maintEval(); }catch(e){}
}
function fbSignOut(){
  const done = () => { fbStop(); if(FB.auth) FB.auth.signOut().catch(() => {}); };
  if(FB.uid) fbMeta({lastLogout: Date.now(), lastSeen: Date.now()}).then(done, done); else done();
}

function fbStart(uid, p){
  if(FB.uid === uid) return;
  fbStop();
  FB.uid = uid; FB.me = p;
  try{ fbExtraStart(); }catch(e){}
  try{ fbNotifStart(); }catch(e){}
  FB.unsub.push(fbDoc('shop', 'prices').onSnapshot(d => {
    SHOP_PRICES = normPrices(d.exists ? d.data().prices : {});
    try{ localStorage.setItem('gs-shop-prices', JSON.stringify(SHOP_PRICES)); }catch(e){}
    if(!$('shsheet').classList.contains('hidden') && !shopEdit) paintShop();
  }, () => {}));
  FB.ann = null; try{ tickerPaint(); }catch(e){}
  FB.unsub.push(fbDoc('shop', 'announce').onSnapshot(d => {
    FB.ann = d.exists ? d.data() : null;
    try{ tickerPaint(); }catch(e){}
    if(admOpen) try{ renderAdmin(true); }catch(e){}
  }, () => {}));
  FB.grants = {};
  FB.unsub.push(FB.db.collection('grants').limit(500).onSnapshot(s => {
    FB.grants = {}; s.forEach(d => { FB.grants[d.id] = d.data(); });
    try{ grantSync(); }catch(e){}
    try{ rerender(); }catch(e){}
    if(admOpen) try{ renderAdmin(true); }catch(e){}
  }, () => {}));
  FB.unsub.push(FB.db.collection('users').limit(300).onSnapshot(s => {
    FB.users = {}; s.forEach(d => { FB.users[d.id] = d.data(); });
    fbRebuildUsers();
    FB.gotU = true; if(FB.gotP) gsReadyMark();
  }, e => { showToast(fbErr(e)); gsReadyMark(); }));
  FB.unsub.push(FB.db.collection('posts').orderBy('ts', 'desc').limit(100).onSnapshot(s => {
    FB.rawPosts = s.docs.map(d => Object.assign({docId:d.id}, d.data()));
    fbRebuildPosts();
    FB.gotP = true; if(FB.gotU) gsReadyMark();
  }, e => { showToast(fbErr(e)); gsReadyMark(); }));
}

// uid -> uygulamadaki anahtar (görünen ad); aynı ad çakışırsa @kullanıcıadı eklenir
function fbAssignKeys(){
  const used = {}; used[ME] = FB.uid; FB.keyOf = {};
  Object.keys(FB.users).sort().forEach(uid => {
    if(uid === FB.uid){ FB.keyOf[uid] = ME; return; }
    const u = FB.users[uid];
    let k = String(u.name || 'Kullanıcı').replace(/['"\\<>&`]/g, '').trim() || 'Kullanıcı';
    if(used[k]) k = k + ' @' + u.handle;
    used[k] = uid; FB.keyOf[uid] = k;
  });
}
function fbRebuildUsers(){
  fbAssignKeys();
  const mine = FB.users[FB.uid];
  if(mine){ FB.me = mine; USERS[ME].name = mine.name; USERS[ME].bio = mine.bio || USERS[ME].bio; USERS[ME].bioColor = mine.bioColor !== undefined ? mine.bioColor : USERS[ME].bioColor; }
  USERS[ME].hist = (mine && mine.hist) || {};
  FB.followUids = new Set((mine && mine.following) || []);
  tracked = {}; ((mine && mine.trackedPosts) || []).forEach(k => { tracked[k] = true; });
  const fc = {};
  Object.keys(FB.users).forEach(uid => (FB.users[uid].following || []).forEach(t => { fc[t] = (fc[t] || 0) + 1; }));
  Object.keys(USERS).forEach(k => { if(k !== ME) delete USERS[k]; });
  Object.keys(FB.users).forEach(uid => {
    if(uid === FB.uid) return;
    const u = FB.users[uid];
    USERS[FB.keyOf[uid]] = {name:u.name, h:'@' + u.handle, bio:u.bio || '', bioColor:u.bioColor || '', photo:u.photo || '', frame:(FR_BY[u.frame] ? u.frame : ''), adm:!!u.isAdmin, rate:'%0', base:0, hist:u.hist || {},
      fol: Math.max(0, (fc[uid] || 0) - (FB.followUids.has(uid) ? 1 : 0)), ing:(u.following || []).length, uid};
  });
  USERS[ME].fol = fc[FB.uid] || 0; USERS[ME].ing = 0;   // "Takip" sayısını arayüz following listesinden ekliyor
  following = {};
  FB.followUids.forEach(uid => { if(FB.keyOf[uid] && flValid(FB.uid, uid)) following[FB.keyOf[uid]] = true; });
  fbRebuildPosts();
}
// Beğeni dışındaki alanların imzası: yalnızca beğeni değiştiyse tüm akışı yeniden çizmeyiz (kart titremesi/zıplama olmasın)
function _feedNoLikeSig(list){
  try{ return JSON.stringify((list || []).map(p => [p.docId, p.ts, p.uid, p.text, p.mark, p.hidden, p.dayOnly, p.coupon, p.comments])); }catch(e){ return null; }
}
function fbRebuildPosts(){
  if(!FB.rawPosts) return;
  const _oldPosts = posts, _oldSig = _feedNoLikeSig(posts);
  const have = new Set(FB.rawPosts.map(r => r.docId));
  const extra = (FB.dayRaw || []).filter(r => !have.has(r.docId)).map(r => Object.assign({}, r, {_day: 1}));
  posts = FB.rawPosts.concat(extra).map(r => {
    const mine = r.uid === FB.uid, lb = r.likedBy || [];
    const key = mine ? ME : (FB.keyOf[r.uid] || String(r.authorName || 'Kullanıcı').replace(/['"\\<>&`]/g, ''));
    if(!USERS[key]) USERS[key] = {name:key, h:'@' + (r.handle || 'kullanici'), bio:'', rate:'%0', base:0, fol:0, ing:0};
    return {id:r.ts, docId:r.docId, ts:r.ts, uid:r.uid, author:key, time:fmtStamp(r.ts), text:r.text || '', coupon:r.coupon || null, mark:r.mark || '', hidden:!!r.adminHidden, dayOnly:!!r._day,
      likes:lb.length, liked:lb.includes(FB.uid), won:false,
      comments:(r.comments || []).map(c => ({a: c.uid === FB.uid ? ME : (FB.keyOf[c.uid] || c.n || 'Kullanıcı'), t:c.t, ts:c.ts, uid:c.uid, rp:c.rp || '', rn:c.rn || '', edited:!!c.edited, likes:(c.likedBy || []).length, liked:(c.likedBy || []).includes(FB.uid)}))};
  });
  if(_oldSig && _oldSig === _feedNoLikeSig(posts) && _oldPosts.length === posts.length){
    // Sadece beğeni değişti: ilgili butonları yerinde güncelle, yeniden çizme
    posts.forEach(p => {
      document.querySelectorAll('[data-like="' + p.id + '"]').forEach(b => {
        b.classList.toggle('on', p.liked);
        const sv = b.querySelector('svg'); if(sv) sv.setAttribute('fill', p.liked ? 'currentColor' : 'none');
        const cn = b.querySelector('.cnt'); if(cn && cn.textContent !== String(p.likes)) cn.textContent = p.likes;
      });
    });
    return;
  }
  posts.forEach(p => { try{ if(needDayRes(p)) applyDayRes(p); }catch(e){} });   // geçmiş gün kuponlarının sonuçları kayıtlı değilse TJK'dan çekilenleri uygula
  setTimeout(resolveDayResults, 600);
  Object.keys(USERS).forEach(k => {
    if(k === ME) return;
    try{
      const cs = posts.filter(p => p.author === k && p.coupon); let w = 0, st = 0;
      cs.forEach(p => { if(p.coupon.banked) return; const s = pst(p); if(s === 'win' || s === 'lose') st++; if(s === 'win') w++; });
      st += histLost(k) + histWon(k); w += histWon(k);
      USERS[k].base = cs.filter(p => !p.hidden).length; USERS[k].rate = '%' + (st ? Math.round(w / st * 100) : 0);
    }catch(e){}
  });
  fbRerender();
}
// Sonuçlanan ayaklar kuponla birlikte buluta yazılır: puanlar günler sonra da doğru kalır
const _syncSig = {};
function syncSettled(){
  if(!FB_ON || !FB.uid || !FB.db) return;
  posts.forEach(p => {
    if(p.uid !== FB.uid || !p.coupon || !p.docId) return;
    try{ status(p.coupon); }catch(e){}
    if(!p.coupon.legs.some(l => l.res)) return;
    if(!p.coupon.ikrH && p.coupon.legs.every(l => l.res)){ try{ postHtml(p); }catch(e){} }   // ikramiye kutusu hesaplanıp kuponda saklansın (c.ikrH)
    const sig = JSON.stringify(p.coupon.legs.map(l => l.res || 0)) + '|' + (p.coupon.ikrH || '');
    const raw = (FB.rawPosts || []).find(r => r.docId === p.docId);
    const rawSig = raw && raw.coupon ? JSON.stringify(raw.coupon.legs.map(l => l.res || 0)) + '|' + (raw.coupon.ikrH || '') : '';
    if(sig === rawSig || _syncSig[p.docId] === sig) return;
    _syncSig[p.docId] = sig;
    fbDoc('posts', p.docId).update({coupon: JSON.parse(JSON.stringify(p.coupon))}).catch(() => { delete _syncSig[p.docId]; });
  });
}
// Başkalarının geçmiş gün kuponlarının ayak sonuçları, sahibi uygulamayı açana kadar kuponda kayıtlı olmayabilir.
// Kayıtlı değilse sonuçlar TJK'dan çekilip bellekte uygulanır: puan, isabet ve tuttu/kaybetti gün atlayınca silinmez.
const _dayRes = {}, _dayResFail = {}, _dayResToast = {};
let _dayResBusy = false;
const couponDayKey = p => (p.coupon.iso || isoOfTs(p.ts)) + '|' + p.coupon.city;
function needDayRes(p){
  const c = p && p.coupon;
  return !!(c && c.city && c.legs && !c.banked && (c.iso || isoOfTs(p.ts)) < TJK.bugunIso() && c.legs.some(l => !l.res && l.win == null));
}
function applyDayRes(p){
  const dk = couponDayKey(p), g = _dayRes[dk] || liveDayGet()[dk]; if(!g) return false;
  let ch = false;
  p.coupon.legs.forEach(l => {
    if(l.res || l.win != null) return;
    const res = g.sira[l.r]; if(!res) return;
    l.res = res.slice(); if(g.fld && g.fld[l.r]) l.fld = g.fld[l.r]; l.odds = Object.assign({}, (g.gny && g.gny[l.r]) || {}); ch = true;
  });
  return ch;
}
// SONUÇ ARŞİVİ (Firestore "results"): koşu günü sonuçlar bir kez buraya yazılır, gün atlayınca TJK'ya gitmeden buradan okunur.
// Belgeler "exp" alanındaki Firestore TTL politikasıyla 3 gün sonra kendiliğinden silinir (veritabanı şişmez).
const _arcSig = {};
const arcId = (iso, city) => (iso + '_' + city).replace(/\//g, '-');
function arcWrite(iso, city, sira, gny, fld){
  try{
    if(!FB_ON || !FB.uid || !FB.db) return;
    const nos = Object.keys(sira || {}); if(!nos.length) return;
    const id = arcId(iso, city), sig = JSON.stringify([sira, gny]);
    if(_arcSig[id] === sig) return; _arcSig[id] = sig;
    const S = {}, G = {}, F = {};
    nos.forEach(n => { S[n] = (sira[n] || []).map(Number); G[n] = (gny && gny[n]) ? Object.assign({}, gny[n]) : {}; if(fld && fld[n]) F[n] = +fld[n]; });
    fbDoc('results', id).set({iso, city, sira: S, gny: G, fld: F, n: nos.length, tot: Object.keys(fld || {}).length, exp: new Date(Date.now() + 3 * 86400000)}, {merge: true}).catch(() => { delete _arcSig[id]; });
  }catch(e){}
}
function arcToday(){
  try{
    if(!FB_ON || !FB.uid) return;
    const iso = viewIso;   // ekranda hangi günün sonuçları açıksa (bugün ya da geçmiş gün) o gün arşive yazılır
    Object.keys(BUL.res || {}).forEach(c => {
      const fld = {}; try{ raceList(c).forEach(k => { fld[+k.no] = (k.atlar || []).length; }); }catch(e){}
      arcWrite(iso, c, BUL.res[c], BUL.gny[c], fld);
    });
  }catch(e){}
}
setInterval(() => { if(!document.hidden) arcToday(); }, 60000);
setTimeout(arcToday, 6000);
async function fetchDayRes(iso, city){
  const k = iso + '|' + city;
  if(_dayRes[k]) return _dayRes[k];
  if(Date.now() - (_dayResFail[k] || 0) < 45000) return null;
  let arc = null;
  try{   // önce arşivden oku: tam ise TJK'ya gitmeye gerek yok
    if(FB_ON && FB.db){
      const d = await Promise.race([fbDoc('results', arcId(iso, city)).get(), new Promise((_, rj) => setTimeout(() => rj(new Error('arşiv zaman aşımı')), 8000))]);
      if(d.exists){
        const x = d.data() || {};
        arc = {sira: x.sira || {}, gny: x.gny || {}, fld: x.fld || {}};
        if(x.tot > 0 && x.n >= x.tot) return (_dayRes[k] = arc);
      }
    }
  }catch(e){}
  try{
    window.__tjkFresh = true;   // önbelleği atla: eski (sonuçsuz) sayfa dönmesin; tarih değiştirince çalışan yol da böyle
    let ls, ks, r;
    try{
      ls = await TJK.sehirleriGetir(iso);
      if(ls.istenenTarih && ls.tarih !== ls.istenenTarih) throw new Error('tarih yok');
      var sh = ls.sehirler.find(x => x.adi.replace(/\s*Hipodromu$/i, '').trim() === city);
      if(!sh) throw new Error('şehir yok');
      ks = await TJK.sehirProgramiGetir(sh.id, sh.adi, iso);
      if(!ks.length) throw new Error('program yok');
      r = await TJK.sonuclariGetir(sh.id, sh.adi, iso, ks);
    } finally { window.__tjkFresh = false; }
    if(!r || !Object.keys(r.sira || {}).length) throw new Error('sonuç yok');
    const fld = {}; ks.forEach(x => { fld[+x.no] = (x.atlar || []).length; });
    arcWrite(iso, city, r.sira || {}, r.gny || {}, fld);   // TJK'dan çekilen sonuç arşive de yazılır
    return (_dayRes[k] = {sira: r.sira || {}, gny: r.gny || {}, fld});
  }catch(e){ if(arc && Object.keys(arc.sira).length) return (_dayRes[k] = arc); _dayResFail[k] = Date.now(); window.__dayResDbg = window.__dayResDbg || {}; window.__dayResDbg[k] = String(e && e.message || e); try{ if(admTest() && !_dayResToast[k]){ _dayResToast[k] = 1; showToast('Geçmiş sonuç alınamadı (' + k + '): ' + String(e && e.message || e)); } }catch(_){} try{ console.warn('[geçmiş sonuç]', k, e); }catch(_){} return null; }
}
async function resolveDayResults(){
  if(_dayResBusy || !FB_ON || !posts) return;
  const need = {};
  posts.forEach(p => { try{ if(needDayRes(p)){ const k = couponDayKey(p); if(!_dayRes[k] && Date.now() - (_dayResFail[k] || 0) >= 45000) need[k] = 1; } }catch(e){} });
  const keys = Object.keys(need).slice(0, 6);
  if(!keys.length) return;
  _dayResBusy = true;
  try{ for(const k of keys){ const i = k.indexOf('|'); await fetchDayRes(k.slice(0, i), k.slice(i + 1)); } }
  finally{ _dayResBusy = false; }
  try{ fbRebuildPosts(); }catch(e){}
}
setInterval(() => { if(!document.hidden) resolveDayResults(); }, 45000);
document.addEventListener('visibilitychange', () => { if(!document.hidden) setTimeout(resolveDayResults, 1200); });
setTimeout(resolveDayResults, 4000);
// Puan kalıcılığı: puan artık "son 100 paylaşım" penceresine bağlı değil, kullanıcı belgesindeki "hist" özetinde saklanır.
//  - Tutmayan kuponlar gün bitince silinir, puanı / isabeti hist'e işlenir.
//  - Tutan kuponlar silinmez; puanı hist'e işlenir ve kupon "banked" diye işaretlenir (çift sayılmaz).
//  - Hepsi kullanıcının KENDİ tüm paylaşımları üzerinden yapılır (pencerenin dışında kalanlar dahil).
// Temizlik sunucuda (23:50). Telefon temizliği KAPALI: kurallarda users.hist yazmaya kapatıldığı için (puan hilesi). Sadece admin telefonu çalışır (admin hist yazabilir).
const PHONE_CLEAN = false;
let _cleanBusy = false, _cleanOff = 0, _fullDone = false, _lastFull = 0;
const _resFail = {};
async function autoCleanLost(force){
  if(!PHONE_CLEAN && !admTest()) return;   // telefon temizliği kapalı; sadece admin için açık (geçmiş gün test kuponları silinsin)
  if(!FB_ON || !FB.uid || !FB.db || _cleanBusy || Date.now() < _cleanOff || !FB.users || !FB.users[FB.uid]) return;
  const today = TJK.bugunIso();
  const isoOf = ts => { const d = new Date(ts || 0); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const classify = list => {
    const del = [], bank = [];
    list.forEach(p => {
      if(!p || !p.docId || !p.coupon || p.coupon.banked) return;
      const past = (p.coupon.iso || isoOf(p.ts)) < today;
      let k; try{ k = status(p.coupon).k; }catch(e){ return; }
      if(k === 'win'){ if(past || !isAltili(p.coupon)) bank.push(p); }   // altılıda aynı altılının en iyisi sayıldığı için gün bitince işlenir
      else if(k === 'lose' && past){
        if(!isAltili(p.coupon) || admTest() || p.coupon.legs.every(l => { try{ return !!legRes(p.coupon, l); }catch(e){ return false; } })) del.push(p);   // 6'lı Ganyan: kısmi ayak puanı için tüm sonuçlar belli olmalı
      }
    });
    return {del, bank};
  };
  // Ucuz ön kontrol: yapılacak iş yoksa ve ilk tam tarama bittiyse veritabanına gitme
  const needRes = p => !!(p && p.coupon && p.coupon.city && !p.coupon.banked && (p.coupon.iso || isoOf(p.ts)) < today && p.coupon.legs.some(l => !l.res && l.win == null));
  const own = posts.filter(p => p.uid === FB.uid && !p.dayOnly);
  const quick = classify(own), quickRes = own.some(needRes);
  if(!force && _fullDone && !quick.del.length && !quick.bank.length && !(quickRes && Date.now() - _lastFull > 600000)) return;
  _cleanBusy = true;
  try{
    const snap = await FB.db.collection('posts').where('uid', '==', FB.uid).limit(500).get();
    let mine = [];
    snap.forEach(d => { const r = d.data(); if(r && r.coupon) mine.push({id:r.ts, docId:d.id, ts:r.ts, uid:FB.uid, author:ME, coupon:r.coupon, dayOnly:false}); });
    _lastFull = Date.now();
    // Günü geçmiş ama ayak sonuçları kuponda kayıtlı olmayan kuponların sonuçlarını TJK'dan çekip kuponun kendi kaydına yaz:
    // gün atlayınca kupon bilgisi (tutan atlar, tuttu / kaybetti) kaybolmasın
    try{
      const groups = {};
      mine.filter(needRes).forEach(p => { const iso = p.coupon.iso || isoOf(p.ts), k = iso + '|' + p.coupon.city; (groups[k] = groups[k] || {iso, city: p.coupon.city, ps: []}).ps.push(p); });
      const keys = Object.keys(groups).filter(k => Date.now() - (_resFail[k] || 0) > 3600000).slice(0, 6), changed = [], lsBy = {};
      for(const k of keys){
        const g = groups[k];
        try{
          const ls = lsBy[g.iso] || (lsBy[g.iso] = await TJK.sehirleriGetir(g.iso));
          if(ls.istenenTarih && ls.tarih !== ls.istenenTarih) throw new Error('tarih yok');
          const sh = ls.sehirler.find(x => x.adi.replace(/\s*Hipodromu$/i, '').trim() === g.city);
          if(!sh) throw new Error('şehir yok');
          const ks = await TJK.sehirProgramiGetir(sh.id, sh.adi, g.iso);
          if(!ks.length) throw new Error('program yok');
          const r = await TJK.sonuclariGetir(sh.id, sh.adi, g.iso, ks);
          g.ps.forEach(p => {
            let ch = false;
            p.coupon.legs.forEach(l => {
              if(l.res || l.win != null) return;
              const res = r.sira[l.r]; if(!res) return;
              const kk = ks.find(x => +x.no === +l.r);
              l.res = res.slice(); if(kk) l.fld = kk.atlar.length; l.odds = Object.assign({}, (r.gny && r.gny[l.r]) || {});
              ch = true;
            });
            if(ch) changed.push(p);
          });
        }catch(e){ _resFail[k] = Date.now(); }
      }
      for(const p of changed){ try{ await fbDoc('posts', p.docId).update({coupon: JSON.parse(JSON.stringify(p.coupon))}); }catch(e){} }
    }catch(e){}
    const cl = classify(mine);
    const hist = JSON.parse(JSON.stringify(FB.users[FB.uid].hist || {}));
    let _stale = false;
    const run = async (dl, bl) => {
      if(!dl.length && !bl.length) return;
      const set = new Set(dl.concat(bl)), before = scoreDays(ME, null, mine), after = scoreDays(ME, set, mine);
      const cntL = {}, cntW = {};
      dl.forEach(p => { const g = dayKey(p.ts); cntL[g] = (cntL[g] || 0) + 1; });
      bl.forEach(p => { const g = dayKey(p.ts); cntW[g] = (cntW[g] || 0) + 1; });
      const gd = new Set(dl.map(p => p.docId));
      const nt = (FB.notifs || []).filter(n => n.pd && gd.has(n.pd)).slice(0, 300);
      const uRef = fbDoc('users', FB.uid);
      const res = await FB.db.runTransaction(async tx => {
        // Önce tüm okumalar: kullanıcı özeti + silinecek/işlenecek paylaşımlar hâlâ duruyor mu
        const uSn = await tx.get(uRef);
        const pSn = await Promise.all(dl.concat(bl).map(p => tx.get(fbDoc('posts', p.docId))));
        if(pSn.some((x, i) => !x.exists || (i >= dl.length && x.data().coupon && x.data().coupon.banked))) return {stale: true};   // başka yerde (sunucu/başka cihaz) işlenmiş: tekrar tara
        const cur0 = (uSn.exists && uSn.data().hist) || {}, upd = {}, nh = {};
        Object.keys(Object.assign({}, cntL, cntW)).forEach(g => {
          const b = before[g] || {pts: 0, tot: 0, hit: 0}, a = after[g] || {pts: 0, tot: 0, hit: 0}, cur = cur0[g] || {};
          nh[g] = {p: Math.round(((+cur.p || 0) + b.pts - a.pts) * 100) / 100, t: (+cur.t || 0) + b.tot - a.tot, h: (+cur.h || 0) + b.hit - a.hit, l: (+cur.l || 0) + (cntL[g] || 0), w: (+cur.w || 0) + (cntW[g] || 0)};
          upd['hist.' + g] = nh[g];
        });
        tx.update(uRef, upd);                                   // 1) puan kuponlardan ayrı yere işlenir
        dl.forEach(p => tx.delete(fbDoc('posts', p.docId)));    // 2) kaybeden kupon komple silinir (yorum, beğeni, sonuç verisi aynı belgede)
        nt.forEach(n => tx.delete(fbDoc('notifs', n.id)));      // silinen kupona ait bildirimler
        bl.forEach(p => tx.update(fbDoc('posts', p.docId), {'coupon.banked': true}));
        return {nh};
      });
      if(res.stale){ _stale = true; return; }
      Object.keys(res.nh).forEach(g => { hist[g] = res.nh[g]; });
      try{ FB.notifs = (FB.notifs || []).filter(n => !(n.pd && gd.has(n.pd))); }catch(e){}
      const gone = new Set(dl); mine = mine.filter(p => !gone.has(p));
      bl.forEach(p => { p.coupon.banked = true; });
    };
    let ok = true;
    try{ await run(cl.del.slice(0, 100), []); }catch(e){ ok = false; try{ if(admTest()) showToast('Temizlik hatası: ' + fbErr(e)); }catch(_){} }          // önce tutmayanlar (eski davranış)
    try{ await run([], cl.bank.slice(0, 100)); }catch(e){ ok = false; try{ if(admTest()) showToast('Puan işleme hatası: ' + fbErr(e)); }catch(_){} }        // sonra tutanların puanını kalıcı yap
    if(ok && !_stale) _fullDone = true; else if(_stale) _cleanOff = Date.now() + 30000; else _cleanOff = Date.now() + 3600000;           // izin / bağlantı sorunu: puanlara dokunmadan bir saat sonra yeniden dener
  }catch(e){ _cleanOff = Date.now() + 3600000; try{ if(admTest()) showToast('Temizlik taraması hatası: ' + fbErr(e)); }catch(_){} }
  finally{ _cleanBusy = false; }
}
setInterval(() => { if(!document.hidden) syncSettled(); }, 15000);
setInterval(() => { if(!document.hidden) autoCleanLost(); }, 20000);
// Gece 00:00'da (birkaç sn sonra) temizliği hemen çalıştır; uygulama arka plandan dönünce de kontrol et
(function schedMidnight(){
  const n = new Date(), t = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 5);
  setTimeout(() => { _cleanOff = 0; autoCleanLost(true); schedMidnight(); }, Math.max(1000, t - n));
})();
document.addEventListener('visibilitychange', () => { if(!document.hidden) setTimeout(() => autoCleanLost(true), 1500); });
setTimeout(() => autoCleanLost(true), 8000);
function fbRerender(){
  const a = document.activeElement;   // yorum yazarken ekranı yenileyip yazıyı silme
  if(a && a.tagName === 'INPUT' && (String(a.id).indexOf('cm-') === 0 || String(a.id).indexOf('ce-') === 0) && a.value){ setTimeout(fbRerender, 1500); return; }
  try{ rerender(); }catch(e){}
}

// Yazma işlemleri
function fbPushPost(p){
  if(!FB.uid){ showToast('Paylaşmak için giriş yapmalısın.'); return; }
  const docId = p.ts + '_' + FB.uid;
  p.docId = docId; p.uid = FB.uid;
  const data = JSON.parse(JSON.stringify({uid:FB.uid, authorName:USERS[ME].name, handle:USERS[ME].h.replace(/^@/, ''), ts:p.ts, text:p.text, coupon:p.coupon || null, likedBy:[], comments:[]}));
  fbDoc('posts', docId).set(data).then(() => { try{ notifyFollowers(p); }catch(e){} }).catch(e => showToast('Paylaşım kaydedilemedi: ' + fbErr(e)));
}
// Takipçilere "yeni kupon paylaştı" bildirimi (en fazla 300 kişi; bildirim gece 00:00'da kendiliğinden silinir)
function notifyFollowers(p){
  if(!FB_ON || !FB.uid || !p || !p.coupon || !p.docId) return;
  const ids = Object.keys(FB.users || {}).filter(u => u !== FB.uid && (FB.users[u].following || []).includes(FB.uid)).slice(0, 300);
  if(!ids.length) return;
  const exp = firebase.firestore.Timestamp.fromDate(new Date(nfNextMidnight())), batch = FB.db.batch(), c = p.coupon;
  const tx = [c.city, c.type].filter(Boolean).join(' · ').slice(0, 80);
  ids.forEach(u => batch.set(fbDoc('notifs', 'nc_' + p.docId + '_' + u), {to: u, from: FB.uid, fn: USERS[ME].name, type: 'newcoupon', pid: p.id || '', pd: p.docId, iso: c.iso || '', ts: Date.now(), exp, tx}));
  batch.commit().catch(() => {});
}
// Kuponun tuttu / tutmadı bildirimi: sonuç belli olunca kupon sahibine (bugünün kuponları, her kupon için bir kez)
function resultNotify(){
  if(!FB_ON || !FB.uid || !FB.db || !FB.notifs || !posts) return;
  const today = TJK.bugunIso(), have = new Set((FB.notifs || []).map(n => n.id));
  let seen = {}; const lk = 'gs-res-nf-' + FB.uid;
  try{ seen = JSON.parse(localStorage.getItem(lk) || '{}') || {}; }catch(e){}
  let ch = false;
  posts.forEach(p => {
    try{
      if(p.uid !== FB.uid || !p.coupon || !p.docId || p.dayOnly) return;   // banked olsa da (puanı işlendi) bildirim gider; tekrar gitmez
      if((p.coupon.iso || '') < today) return;   // eski günün sonucu için bildirim gönderme
      const k = status(p.coupon).k; if(k !== 'win' && k !== 'lose') return;
      const id = 'res_' + p.docId;
      if(seen[p.docId] || have.has(id)) return;
      seen[p.docId] = k; ch = true;
      fbDoc('notifs', id).set({to: FB.uid, from: FB.uid, fn: USERS[ME].name, type: k, pid: p.id || '', pd: p.docId, iso: p.coupon.iso || '', ts: Date.now(), exp: firebase.firestore.Timestamp.fromDate(new Date(nfNextMidnight())), tx: [p.coupon.city, p.coupon.type].filter(Boolean).join(' · ').slice(0, 80)}).catch(() => {});
    }catch(e){}
  });
  if(ch){ try{ const ks = Object.keys(seen); if(ks.length > 200) ks.slice(0, ks.length - 200).forEach(x => delete seen[x]); localStorage.setItem(lk, JSON.stringify(seen)); }catch(e){} }
}
setInterval(() => { if(!document.hidden) resultNotify(); }, 20000);
setTimeout(resultNotify, 7000);
function fbDeletePost(p){
  if(p && p.docId) fbDoc('posts', p.docId).delete().catch(e => showToast('Silinemedi: ' + fbErr(e)));
}
function fbLike(p){
  if(!FB.uid || !p || !p.docId) return;
  const F = firebase.firestore.FieldValue;
  fbDoc('posts', p.docId).update({likedBy: p.liked ? F.arrayUnion(FB.uid) : F.arrayRemove(FB.uid)}).catch(e => showToast('Beğeni kaydedilemedi.'));
  const nid = 'like_' + p.docId + '_' + FB.uid;
  if(p.liked) fbNotifSet(nid, 'like', p.uid, p); else fbNotifDel(nid);
}
function fbComment(p, t, ts, rp, rn){
  if(!FB.uid || !p || !p.docId) return;
  fbDoc('posts', p.docId).update({comments: firebase.firestore.FieldValue.arrayUnion(Object.assign({uid:FB.uid, n:USERS[ME].name, t:String(t).slice(0, 500), ts:ts || Date.now(), likedBy:[]}, rp ? {rp, rn: String(rn || '').slice(0, 60)} : {}))}).catch(e => showToast('Yorum kaydedilemedi.'));
  // Bildirim: yanıtsa yorum sahibine, değilse gönderi sahibine (aynı kişiye iki kez gitmesin)
  const rTo = rp ? String(rp).split('|')[0] : '';
  const base = 'cm_' + p.docId + '_' + (ts || Date.now()) + '_' + FB.uid;
  if(rTo) fbNotifSet(base + '_r', 'reply', rTo, p, t);
  if(p.uid && p.uid !== rTo) fbNotifSet(base, 'comment', p.uid, p, t);
}
function fbFollow(key, on){
  const uid = USERS[key] && USERS[key].uid;
  if(!FB.uid || !uid) return;
  const F = firebase.firestore.FieldValue, ts = Date.now();
  try{   // anında tutarlılık: anlık görüntü gelmeden önce de sayılar doğru olsun
    const me = FB.users[FB.uid] = FB.users[FB.uid] || {};
    me.following = (me.following || []).filter(x => x !== uid); if(on) me.following.push(uid);
    me.fts = Object.assign({}, me.fts); if(on) me.fts[uid] = ts; else delete me.fts[uid];
  }catch(e){}
  fbDoc('users', FB.uid).update({following: on ? F.arrayUnion(uid) : F.arrayRemove(uid), ['fts.' + uid]: on ? ts : F.delete()}).catch(e => showToast('Takip kaydedilemedi.'));
  if(on) fbNotifSet('follow_' + FB.uid + '_' + uid + '_' + Date.now(), 'follow', uid, null);   // her takipte yeni bildirim
}
// Instagram'daki "Takipçiyi kaldır": kişi seni takip etmeye devam ediyor görünse de listenden ve sayından düşer; yeniden takip ederse geri gelir
function fbRemoveFollower(key){
  const uid = USERS[key] && USERS[key].uid;
  if(!FB.uid || !uid) return;
  const ts = Date.now();
  try{ const me = FB.users[FB.uid] = FB.users[FB.uid] || {}; me.remFol = Object.assign({}, me.remFol, {[uid]: ts}); }catch(e){}
  fbDoc('users', FB.uid).update({['remFol.' + uid]: ts}).catch(e => showToast('Kaldırılamadı.'));
  try{ fbRebuildUsers(); }catch(e){}
}
function fbTrack(k, on){
  if(!FB.uid) return;
  const F = firebase.firestore.FieldValue;
  fbDoc('users', FB.uid).update({trackedPosts: on ? F.arrayUnion(k) : F.arrayRemove(k)}).catch(e => showToast('Takip kaydedilemedi.'));
}
async function fbSaveProfile(){
  if(!FB.uid) return;
  const me = USERS[ME], handle = me.h.replace(/^@/, ''), old = (FB.me && FB.me.handle) || handle;
  const data = {name:me.name, handle, bio:me.bio || '', bioColor:me.bioColor || ''};
  if(myPhoto.length + myCover.length < 700000){ data.photo = myPhoto; data.cover = myCover; }
  else showToast('Fotoğraflar büyük olduğu için yalnızca bu cihazda saklandı.');
  try{
    await FB.db.runTransaction(async t => {
      if(handle !== old){
        const n = await t.get(fbDoc('handles', handle));
        if(n.exists) throw Object.assign(new Error('taken'), {code:'handle-taken'});
        const o = await t.get(fbDoc('handles', old));
        t.delete(fbDoc('handles', old));
        t.set(fbDoc('handles', handle), {uid:FB.uid, email: o.exists ? (o.data().email || '') : ((FB.auth.currentUser && FB.auth.currentUser.email) || '')});
      }
      t.update(fbDoc('users', FB.uid), data);
    });
  }catch(e){
    if(e.code === 'handle-taken'){
      me.h = '@' + old; try{ localStorage.setItem('gs-handle', me.h); }catch(_){}
      showToast('Bu kullanıcı adı kullanımda; eskisi geri yüklendi.'); rerender();
    } else showToast('Profil kaydedilemedi: ' + fbErr(e));
  }
}


