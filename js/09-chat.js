// ---- Genel Sohbet (canlı) ----
// Kapalıyken sadece en son mesajı dinler (hafif); panel açılınca son 50 mesajı dinler. Mesaj sınırı: 300 karakter, 2 sn'de 1.
let chat = {unsub: null, open: false, unread: 0, first: true, msgs: [], last: 0};
const CHAT_LIMIT = 50, CHAT_GAP = 2000;
// Yerel test modu (Firebase kapalı): sohbet bu cihazda çalışır, bulutla bağlantısı yoktur
const chatUid = () => FB_ON ? FB.uid : 'local-me';
const chatOK = () => FB_ON ? !!FB.uid : true;
const LOCAL_CHAT = [
  {id:'l1', uid:'u-demo1', n:'Mehmet Ergüner', t:'Veliefendi ye gidiyorum', ts: Date.now() - 5*3600000},
  {id:'l2', uid:'local-me', n:'', t:'Tutmayan kuponlar gece 00:00 itibari ile sistem tarafından silinir bilginiz olsun', ts: Date.now() - 3*3600000},
  {id:'l3', uid:'u-demo1', n:'Mehmet Ergüner', t:'Tamamdır 👍', ts: Date.now() - 3*3600000 + 60000},
  {id:'l4', uid:'u-demo1', n:'Mehmet Ergüner', t:'Akşam sonuçlara bakarız', ts: Date.now() - 3*3600000 + 90000}
];
// Sohbette en son ne zaman bakıldı (bu telefonda, kullanıcıya özel): uygulama kapalıyken gelen mesajlar da sayılsın
const _seenKey = () => 'gs-chat-seen-' + ((typeof FB !== 'undefined' && FB.uid) || 'x');
function chatSeenGet(){ try{ return Number(localStorage.getItem(_seenKey())) || 0; }catch(e){ return 0; } }
function chatSeenSet(t){ try{ localStorage.setItem(_seenKey(), String(t || Date.now())); }catch(e){} }
function chatListen(full){
  if(!FB_ON){ if(full){ chat.msgs = LOCAL_CHAT.slice(); renderChat(); } return; }
  if(chat.unsub){ try{ chat.unsub(); }catch(e){} chat.unsub = null; }
  if(!FB.uid || !FB.db) return;
  chat.first = true;
  chat.unsub = FB.db.collection('chat').orderBy('ts', 'desc').limit(full ? CHAT_LIMIT : 30).onSnapshot(sn => {
    if(full){
      chat.msgs = sn.docs.map(d => Object.assign({id: d.id}, d.data())).reverse();
      renderChat();
    }else{
      let seen = chatSeenGet();
      if(!seen){ seen = Date.now(); chatSeenSet(seen); }   // ilk kurulum: eski mesajlar okunmamış sayılmasın
      chat.unread = sn.docs.filter(d => { const m = d.data(); return m.uid !== FB.uid && (m.ts || 0) > seen; }).length;
      chat.first = false;
      chatBadge();
    }
  }, () => {});
}
function chatBadge(){
  const b = $('chat-badge'); if(!b) return;
  b.textContent = chat.unread > 9 ? '9+' : String(chat.unread);
  b.classList.toggle('hidden', !chat.unread || chat.open);
}
function chatStart(){
  const f = $('chat-fab'); if(!f) return;
  $('chat-fab-i').innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="10" y="2.5" width="11.5" height="9.5" rx="4" opacity=".5"/><path fill-rule="evenodd" d="M7.5 8.5h7a4.5 4.5 0 014.5 4.5v2a4.5 4.5 0 01-4.5 4.5H11l-3.2 2.6a.5.5 0 01-.8-.4V19.5A4.5 4.5 0 013 15v-2a4.5 4.5 0 014.5-4.5zM7.5 12.9a1.1 1.1 0 100 2.2 1.1 1.1 0 000-2.2zm3.5 0a1.1 1.1 0 100 2.2 1.1 1.1 0 000-2.2zm3.5 0a1.1 1.1 0 100 2.2 1.1 1.1 0 000-2.2z"/></svg>'; $('chsheet-x').innerHTML = ic('x', 18); $('ch-send').innerHTML = ic('send', 18);
  f.classList.remove('hidden'); chat.unread = 0; chatBadge(); chatListen(false);   // rozet: son bakıştan beri gelen mesajlar
}
function chatStop(){
  if(chat.unsub){ try{ chat.unsub(); }catch(e){} chat.unsub = null; }
  chat.open = false; chat.msgs = []; chat.unread = 0; chat.reply = null;
  const f = $('chat-fab'), s = $('chsheet'); if(f) f.classList.add('hidden'); if(s) s.classList.add('hidden');
}
// Klavye açılınca panel görünür alana oturur (başlık yukarıda, mesaj kutusu klavyenin hemen üstünde kalır)
function chatFit(){
  const v = window.visualViewport, sh = $('chsheet'), card = sh && sh.querySelector('.ch-card');
  if(!v || !sh || !card || !chat.open) return;
  const kb = window.innerHeight - v.height > 120;
  sh.style.top = v.offsetTop + 'px'; sh.style.height = v.height + 'px'; sh.style.bottom = 'auto';
  card.style.height = kb ? Math.max(260, v.height - 8) + 'px' : '';
  card.style.maxHeight = kb ? 'none' : '';
  if(kb){ const el = $('ch-list'); if(el) el.scrollTop = el.scrollHeight; }
}
function chatFitReset(){
  const sh = $('chsheet'), card = sh && sh.querySelector('.ch-card');
  if(sh){ sh.style.top = ''; sh.style.height = ''; sh.style.bottom = ''; }
  if(card){ card.style.height = ''; card.style.maxHeight = ''; }
}
let _cfR = 0;
if(window.visualViewport){ window.visualViewport.addEventListener('resize', () => { if(!chat.open || _cfR) return; _cfR = requestAnimationFrame(() => { _cfR = 0; chatFit(); }); }); }
// Sohbet balonu: parmakla sürüklenemez / sayfa yana kaymaz
(function(){ const f = document.getElementById('chat-fab'); if(!f) return;
  ['touchmove','pointermove','dragstart','contextmenu'].forEach(ev => f.addEventListener(ev, e => { e.preventDefault(); }, {passive:false}));
})();
// Sayfa yatay kaydırılamasın (sadece dikey)
document.addEventListener('gesturestart', e => e.preventDefault());
let _chH = false;   // sohbet penceresinin geçmiş (geri tuşu) kaydı var mı
function openChat(){
  if(!chatOK()) return;
  if(!_chH){ try{ history.pushState({gschat: 1}, ''); _chH = true; }catch(e){} }
  chat.open = true; chat.unread = 0; chatSeenSet(Date.now()); chatBadge();
  $('chsheet').classList.remove('hidden'); $('chat-fab').classList.add('hidden');
  $('ch-list').innerHTML = '<div class="ch-empty">Yükleniyor…</div>';
  chatListen(true);
  chatFit();
}
function closeChat(silent){
  if(!chat.open) return;
  if(_chH){ _chH = false; if(silent !== true){ try{ history.back(); }catch(e){} } }
  chat.open = false; chatSeenSet(Date.now()); cancelChatEdit(); clearChatReply(); $('chsheet').classList.add('hidden'); chatFitReset();
  if(chatOK()){ $('chat-fab').classList.remove('hidden'); chatListen(false); }
}
function renderChat(){
  const el = $('ch-list'); if(!el || !chat.open) return;
  const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  const L = chat.msgs;
  let prevDay = '', lastMine = false, html = '';
  L.forEach((m, i) => {
    const d = new Date(m.ts || 0), day = d.toDateString(), mine = m.uid === chatUid();
    if(day !== prevDay){ html += `<div class="ch-day"><span>${esc(d.toLocaleDateString('tr-TR', {day: 'numeric', month: 'long'}))}</span></div>`; prevDay = day; }
    const p = L[i - 1], n = L[i + 1], GAP = 5 * 60000;
    const samePrev = p && p.uid === m.uid && new Date(p.ts || 0).toDateString() === day && (m.ts - p.ts) < GAP;
    const sameNext = n && n.uid === m.uid && new Date(n.ts || 0).toDateString() === day && (n.ts - m.ts) < GAP;
    const key = mine ? ME : FB.keyOf[m.uid], name = key && USERS[key] ? dn(key) : (m.n || 'Kullanıcı');
    const hm = d.toLocaleTimeString('tr-TR', {hour: '2-digit', minute: '2-digit'});
    const delB = (mine || FB.isAdmin) ? `<button class="ch-do" onclick="event.stopPropagation();askConfirm('Mesaj silinsin mi?','Bu mesaj sohbetten kaldırılacak.','Sil',()=>delChat('${esc(m.id)}'))" aria-label="Sil">${ic('trash',14)}</button>` : '';
    const rpB = `<button class="ch-do" onclick="event.stopPropagation();setChatReply('${esc(m.id)}')" aria-label="Yanıtla"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 016 6v3"/></svg></button>`;
    const edB = mine ? `<button class="ch-do" onclick="event.stopPropagation();startChatEdit('${esc(m.id)}')" aria-label="Düzenle">${ic('pen',14)}</button>` : '';
    // Instagram gibi: profil sadece grubun SON mesajında (balonun yanında altta), diğerlerinde boşluk
    const face = mine ? '' : (!sameNext
      ? `<span class="ch-av" ${key ? `onclick="closeChat();openProfile('${esc(key)}', true)"` : ''}>${key && USERS[key] ? av(key, 's') : `<span class="av s" style="background:${colorOf(name)}">${esc(name.slice(0, 2).toUpperCase())}</span>`}</span>`
      : '<span class="ch-av sp"></span>');
    const nm = (mine || samePrev) ? '' : `<span class="ch-nm" style="color:${colorOf(key || name)}">${esc(name)}</span>`;
    html += `<div class="ch-m ${mine ? 'me' : ''} ${samePrev ? 'cont' : 'first'} ${sameNext ? 'more' : 'last'}" data-id="${esc(m.id)}">${face}
      <div class="ch-col">${nm}<div class="ch-b" onclick="this.closest('.ch-m').classList.toggle('sel')">${m.r && m.r.id ? `<div class="ch-q" onclick="event.stopPropagation();chatJump('${esc(m.r.id)}')"><b>${esc(m.r.n || 'Kullanıcı')}</b><span>${esc(m.r.t || '')}</span></div>` : ''}<span class="ch-tx">${esc(m.t || '')}</span></div><div class="ch-meta"><time>${m.ed ? 'düzenlendi · ' : ''}${hm}</time>${rpB}${edB}${delB}</div></div></div>`;
    lastMine = mine;
  });
  el.innerHTML = html || '<div class="ch-empty"><div>💬</div><b>Henüz mesaj yok</b><span>İlk mesajı sen yaz!</span></div>';
  if(near || lastMine || chat.first) el.scrollTop = el.scrollHeight;
  chat.first = false;
}
function sendChat(){
  const inp = $('ch-input'), t = (inp.value || '').trim().slice(0, 300);
  if(!t || !chatOK()) return;
  if(FB_ON && banActive(FB.ban)) return;
  if(chat.editId){
    const id = chat.editId; cancelChatEdit();
    if(!FB_ON){ const m = LOCAL_CHAT.find(x => x.id === id); if(m){ m.t = t; m.ed = true; } chat.msgs = LOCAL_CHAT.slice(); renderChat(); return; }
    FB.db.collection('chat').doc(id).update({t, ed: true}).catch(e => showToast('Mesaj düzenlenemedi: ' + fbErr(e)));
    return;
  }
  const now = Date.now();
  if(now - chat.last < CHAT_GAP){ showToast('Biraz yavaş yaz.'); return; }
  chat.last = now; inp.value = '';
  const rp = chat.reply ? {id: chat.reply.id, n: chat.reply.n, t: chat.reply.t} : null; clearChatReply();
  if(!FB_ON){ LOCAL_CHAT.push(Object.assign({id:'l' + now, uid:'local-me', n: USERS[ME].name, t, ts: now}, rp ? {r: rp} : {})); chat.msgs = LOCAL_CHAT.slice(); renderChat(); inp.focus({preventScroll: true}); return; }
  FB.db.collection('chat').add(Object.assign({uid: FB.uid, n: USERS[ME].name, t, ts: now}, rp ? {r: rp} : {})).catch(e => showToast('Mesaj gönderilemedi: ' + fbErr(e)));
  inp.focus({preventScroll: true});
}
function startChatEdit(id){
  const m = chat.msgs.find(x => x.id === id); if(!m) return;
  if(FB_ON && m.uid !== FB.uid) return;
  clearChatReply(); chat.editId = id;
  const inp = $('ch-input'); inp.value = m.t || ''; $('ch-eb').classList.remove('hidden');
  inp.focus(); try{ inp.setSelectionRange(inp.value.length, inp.value.length); }catch(e){}
}
function cancelChatEdit(){
  chat.editId = null;
  const inp = $('ch-input'), eb = $('ch-eb'); if(inp) inp.value = ''; if(eb) eb.classList.add('hidden');
}
function delChat(id){
  if(chat.editId === id) cancelChatEdit();
  if(!FB_ON){ const i = LOCAL_CHAT.findIndex(m => m.id === id); if(i > -1) LOCAL_CHAT.splice(i, 1); chat.msgs = LOCAL_CHAT.slice(); renderChat(); return; }
  if(!FB.uid) return;
  FB.db.collection('chat').doc(id).delete().catch(e => showToast(fbErr(e)));
}
// ---- Kaydırarak yanıtla (WhatsApp gibi) ----
function chatReplyName(m){ const mine = m.uid === chatUid(), key = mine ? ME : (FB_ON ? FB.keyOf[m.uid] : null); return key && USERS[key] ? dn(key) : (m.n || 'Kullanıcı'); }
function setChatReply(id){
  const m = chat.msgs.find(x => x.id === id); if(!m) return;
  if(chat.editId) cancelChatEdit();
  chat.reply = {id: m.id, n: chatReplyName(m), t: String(m.t || '').slice(0, 120)};
  $('ch-rb-n').textContent = chat.reply.n; $('ch-rb-t').textContent = chat.reply.t; $('ch-rb').classList.remove('hidden');
  const i = $('ch-input'); if(i) i.focus({preventScroll: true});
}
function clearChatReply(){ chat.reply = null; const b = $('ch-rb'); if(b) b.classList.add('hidden'); }
function chatJump(id){
  const row = $('ch-list').querySelector('.ch-m[data-id="' + id.replace(/"/g, '') + '"]'); if(!row){ showToast('Mesaj artık görünmüyor.'); return; }
  row.scrollIntoView({block: 'center', behavior: 'auto'}); row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
  setTimeout(() => row.classList.remove('flash'), 1300);
}
(function(){
  const L = $('ch-list'); if(!L) return;
  const TH = 60; let s = null;
  const ARROW = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 016 6v3"/></svg>';
  const done = (row, ic) => { row.style.transition = 'transform .2s ease-out'; row.style.transform = ''; setTimeout(() => { row.style.transition = ''; row.style.transform = ''; row.style.willChange = ''; if(ic) ic.remove(); }, 220); };
  L.addEventListener('touchstart', e => {
    const row = e.target.closest('.ch-m'); if(e.touches.length !== 1 || !row || !row.dataset.id){ s = null; return; }
    s = {row, x: e.touches[0].clientX, y: e.touches[0].clientY, lock: null, ic: null, hit: false, w: 0};
  }, {passive: true});
  L.addEventListener('touchmove', e => {
    if(!s) return;
    const t = e.touches[0], dx = t.clientX - s.x, dy = t.clientY - s.y, ax = Math.abs(dx);
    if(!s.lock){
      if(ax > 10 && ax > Math.abs(dy) * 1.3) s.lock = 'x';
      else if(Math.abs(dy) > 10){ s = null; return; }
      else return;
      s.row.style.transition = 'none'; s.row.style.willChange = 'transform';
      s.ic = document.createElement('span'); s.ic.className = 'ch-rp ' + (dx > 0 ? 'l' : 'r'); s.ic.innerHTML = ARROW; s.row.appendChild(s.ic);
    }
    e.preventDefault();
    const v = ax <= TH ? ax : Math.min(TH + (ax - TH) * .3, 90), sg = dx > 0 ? 1 : -1;
    s.row.style.transform = 'translateX(' + (sg * v) + 'px)';
    const p = Math.min(v / TH, 1); s.ic.style.opacity = p; s.ic.style.transform = 'scale(' + (.4 + .6 * p) + ')';
    const hit = ax >= TH; if(hit !== s.hit){ s.hit = hit; s.ic.classList.toggle('on', hit); if(hit){ try{ navigator.vibrate && navigator.vibrate(12); }catch(_){} } }
  }, {passive: false});
  const end = (e, cancel) => {
    if(!s) return; const c = s; s = null;
    if(c.lock !== 'x') return;
    chat.swT = Date.now();
    done(c.row, c.ic);
    if(!cancel && c.hit) setChatReply(c.row.dataset.id);
  };
  L.addEventListener('touchend', e => end(e, false));
  L.addEventListener('touchcancel', e => end(e, true));
  // kaydırma sonrası balonun "dokunma" tıklaması çalışmasın
  L.addEventListener('click', e => { if(chat.swT && Date.now() - chat.swT < 450){ e.stopPropagation(); e.preventDefault(); } }, true);
})();
$('asheet-x').innerHTML = ic('x', 18);
setInterval(() => { if(admOpen && !document.hidden && document.activeElement !== $('ad-q')) renderAdmin(); }, 30000);

setTopH();
renderFeed();
if(!FB_ON){ try{ chatStart(); }catch(e){} }   // yerel test modunda sohbet butonu
if(FB_ON){ if(!sessionOn) showAuth(); fbInit(); }
else if(!sessionOn) showAuth();
else if(AUTH_API){
  authCall('/me', null, 'GET').catch(e => {
    if(e.status === 401){ try { localStorage.removeItem(TOKEN_KEY); } catch(_){} setSession(false); showAuth(); }
  });
}
// Koşu bilgisi kartı ekrandan çıkınca üstte mini çubuk göster
(function(){
  const mini=document.getElementById('ri-mini'), card=document.querySelector('#tab-bulten .ri');
  if(!mini||!card) return;
  let tk=false;
  function upd(){
    tk=false;
    const hdr=document.querySelector('.top'), sw=document.getElementById('bul-sticky'), hh=(hdr?hdr.offsetHeight:52)+(sw?sw.offsetHeight:0);
    mini.style.top=hh+'px';
    const r=card.getBoundingClientRect();
    const on=r.height>0 && r.bottom<hh+4;
    if(on){
      document.getElementById('ri-mini-t').textContent=document.getElementById('race-title').textContent;
      const n=(document.getElementById('race-meta').querySelector('.rbn')||{}).textContent||'';
      document.getElementById('ri-mini-n').textContent=n;
    }
    mini.classList.toggle('show',on);
  }
  addEventListener('scroll',()=>{if(!tk){tk=true;requestAnimationFrame(upd);}},{passive:true});
  addEventListener('resize',upd);
})();

/* Otomatik güncelleme: sayfa açılınca arka planda sürüm kontrolü, yeni sürüm varsa kendiliğinden yenilenir */
(function(){
  if(!('serviceWorker' in navigator)) return;
  if(location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  const hash = t => { let h = 5381; for(let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return h + ':' + t.length; };
  const url = location.pathname;
  let busy = false;
  function typing(){
    const a = document.activeElement;
    return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
  }
  async function check(){
    if(busy) return; busy = true;
    try{
      // Şu an açık olan kopya (önbellekten) ile sunucudaki en yeni kopya karşılaştırılır
      const cur = await fetch(url, {cache:'force-cache'}).then(r => r.text());
      const neu = await fetch(url, {cache:'reload'}).then(r => r.ok ? r.text() : null);
      if(neu && hash(cur) !== hash(neu)){
        const last = +(sessionStorage.getItem('gs-upd') || 0);
        if(Date.now() - last > 20000 && !typing()){
          sessionStorage.setItem('gs-upd', String(Date.now()));
          location.reload();
        }
      }
    }catch(e){} finally { busy = false; }
  }
  navigator.serviceWorker.register('sw.js', {updateViaCache:'none'}).then(reg => {
    reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if(!document.hidden){ reg.update().catch(() => {}); check(); } });
  }).catch(() => {});
  check();
})();

/* Telefonun geri/çıkış tuşu: yanlışlıkla basılırsa "çıkmak istiyor musun?" sorar */
(function(){
  let exiting = false;
  const guard = () => { try{ history.pushState({gsguard:1}, ''); }catch(e){} };
  try{
    if(!(history.state && history.state.gsguard)){ history.replaceState({gsroot:1}, ''); guard(); }
  }catch(e){ return; }
  function askExit(){
    if(document.querySelector('.dlg.dlg-exit')) return;
    const d = document.createElement('div');
    d.className = 'dlg dlg-exit';
    d.innerHTML = '<div class="dlg-card" role="alertdialog"><h3>Çıkış</h3><p>Uygulamadan çıkmak istediğinize emin misiniz?</p><div class="dlg-row"><button class="no">Hayır</button><button class="del">Evet</button></div></div>';
    const stay = () => { d.remove(); guard(); };
    d.onclick = e => { if(e.target === d) stay(); };
    d.querySelector('.no').onclick = stay;
    d.querySelector('.del').onclick = () => {
      d.remove(); exiting = true;
      try{ history.back(); }catch(e){}
      setTimeout(() => { try{ window.close(); }catch(e){} }, 150);
    };
    document.body.appendChild(d);
  }
  window.addEventListener('popstate', e => {
    if(exiting) return;
    // Sohbet açıkken geri tuşu: önce sohbeti kapat (çıkış sorusu çıkmaz, uygulama kapanmaz)
    if(chat.open && !(e.state && e.state.gschat)){ _chH = false; closeChat(true); return; }
    if(!(e.state && e.state.gsroot)) return;        // sadece en alta inince (çıkış anı) devreye girer
    const dlg = document.querySelector('.dlg.dlg-exit');
    if(dlg){ dlg.remove(); guard(); return; }
    const crp = document.querySelector('.crp'); if(crp && crp._cancel){ crp._cancel(); guard(); return; }
    if(document.getElementById('cmsheet')){ closeCmSheet(); guard(); return; }   // yorum penceresi
    const sh = document.querySelector('.sheet:not(.hidden)');   // açık pencere varsa önce onu kapat
    if(sh){
      if(sh.id === 'chsheet') closeChat();            // sohbet: balonu geri getir, dinlemeyi hafife al
      else if(sh.id === 'asheet') closeAdmin();
      else sh.classList.add('hidden');
      guard(); return;
    }
    guard(); askExit();
  });
})();

/* Açılış ekranı: çubuk dolar, sayfa hazır olunca %100 olup kapanır (en az ~2 sn görünür) */
(function(){
  const sp = document.getElementById('splash'); if(!sp) return;
  const fill = document.getElementById('sp-fill'), pct = document.getElementById('sp-pct');
  const MIN = 1500;                       // en az bu kadar ms dolsun
  const t0 = Date.now();
  let p = 0, ready = false, done = false;
  document.documentElement.classList.add('sp-lock');   // açılışta sayfa kaymasın/zıplamasın
  function hide(){
    if(done) return; done = true; clearInterval(iv);
    document.documentElement.classList.remove('sp-lock');
    sp.classList.add('out');
    setTimeout(() => { try{ sp.remove(); }catch(e){} }, 600);
  }
  const iv = setInterval(() => {
    const t = Date.now() - t0;
    if(ready && (!FB_ON || window.__gsReady) && window.__banReady !== false && t >= MIN){ p += Math.max(1.2, (100 - p) * .22); }
    else { p = Math.max(p, 86 * (1 - Math.exp(-t / 700))); }
    if(p > 100) p = 100;
    if(fill) fill.style.width = p.toFixed(1) + '%';
    if(pct) pct.textContent = '%' + Math.floor(p);
    if(p >= 100) setTimeout(hide, 250);
  }, 40);
  const mark = () => { ready = true; };
  if(document.readyState === 'complete') mark(); else window.addEventListener('load', mark);
  setTimeout(hide, 12000);   // her durumda en geç 12 sn (internet çok yavaşsa)
})();
