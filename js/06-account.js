/* ============ AYARLAR & OTURUM ============ */
const SESSION_KEY = 'gs-session';
/* ---- Hesap sunucusu ayarları ----
   AUTH_API: auth-worker.js'i yayınladığın Worker adresi (örn. 'https://ganyan-auth.ADIN.workers.dev')
   GOOGLE_CLIENT_ID: Google Cloud > OAuth istemci kimliği (Web uygulaması) */
const AUTH_API = '';
const GOOGLE_CLIENT_ID = '';
const TOKEN_KEY = 'gs-token';
let sessionOn = true;
try {
  sessionOn = FB_ON ? localStorage.getItem(SESSION_KEY) === '1' : localStorage.getItem(SESSION_KEY) !== '0';
  if(AUTH_API) sessionOn = sessionOn && !!localStorage.getItem(TOKEN_KEY);
} catch(e){}
function setSession(v){ sessionOn = v; try { localStorage.setItem(SESSION_KEY, v ? '1' : '0'); } catch(e){} }

function askConfirm(title, text, okLabel, onOk){
  const d = document.createElement('div');
  d.className = 'dlg';
  d.innerHTML = `<div class="dlg-card" role="alertdialog"><h3>${esc(title)}</h3><p>${esc(text)}</p><div class="dlg-row"><button class="no">Vazgeç</button><button class="del">${esc(okLabel)}</button></div></div>`;
  const close = () => d.remove();
  d.onclick = e => { if(e.target === d) close(); };
  d.querySelector('.no').onclick = close;
  d.querySelector('.del').onclick = () => { close(); onOk(); };
  document.body.appendChild(d);
}

/* ---- Uygulamayı yükle (ana ekrana kısayol) ---- */
let deferredInstall = null;
function isStandalone(){ return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; showInstallBar(); });
window.addEventListener('appinstalled', () => { deferredInstall = null; const ab = $('au-install'); if(ab) ab.hidden = true; const b = $('inst-bar'); if(b) b.remove(); showToast('Uygulama yüklendi'); });
async function installApp(){
  if(deferredInstall){
    deferredInstall.prompt();
    try{ await deferredInstall.userChoice; }catch(e){}
    deferredInstall = null;
    const b = $('inst-bar'); if(b) b.remove();
    return;
  }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  askConfirm('Uygulamayı Yükle', ios
    ? 'Safari\'de alttaki Paylaş simgesine dokun, ardından "Ana Ekrana Ekle"yi seç.'
    : 'Tarayıcının sağ üstündeki ⋮ menüsüne dokun, ardından "Ana ekrana ekle" ya da "Uygulamayı yükle"yi seç.', 'Tamam', () => {});
}
function showInstallBar(){
  if(isStandalone() || $('inst-bar')) return;
  try{ if(localStorage.getItem('gs-inst-no') === '1') return; }catch(e){}
  const feed = $('tab-feed'); if(!feed) return;
  const d = document.createElement('div');
  d.id = 'inst-bar';
  d.className = 'au-install';
  d.style.margin = '0 0 12px';
  d.innerHTML = '<img src="data:image/png;base64,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" alt="" width="46" height="46"><span class="ai-t"><b>GanyanSosyal</b><small>Ana ekrana ekle, tek dokunuşla aç</small></span><em id="inst-go">Yükle</em><button id="inst-x" aria-label="Kapat" style="border:0;background:none;color:var(--mu);font-size:22px;line-height:1;padding:4px 2px 4px 6px;cursor:pointer">×</button>';
  feed.insertBefore(d, feed.firstChild);
  d.onclick = e => { if(e.target.id === 'inst-x') return; installApp(); };
  $('inst-x').onclick = e => { e.stopPropagation(); d.remove(); try{ localStorage.setItem('gs-inst-no', '1'); }catch(e){} };
}
/* ---- Mağaza ---- */
let shopPrev = '', shopEdit = false;
// Fiyatlar: varsayılan FRAMES[].p; yönetici mağazadan değiştirir. Firebase açıkken Firestore'da shop/prices belgesinde tutulur, herkes aynı fiyatı görür.
const normPrices = o => { const r = {}; FRAMES.forEach(f => { const raw = o && o[f.id], v = +raw; if(raw !== undefined && raw !== '' && raw !== null && isFinite(v) && v >= 0 && v <= 1000000) r[f.id] = Math.round(v * 100) / 100; }); return r; };
let SHOP_PRICES = (() => { try{ return normPrices(JSON.parse(localStorage.getItem('gs-shop-prices') || '{}')); }catch(e){ return {}; } })();
const priceOf = f => (f.id in SHOP_PRICES) ? SHOP_PRICES[f.id] : f.p;
const shopAdmin = () => FB_ON && !!FB.isAdmin;   // yönetici: fiyat düzenler, istediği çerçeveyi ücretsiz alır
const SHOP_TEST_FREE = false;   // TEST: true = puan olmadan her çerçeve ücretsiz alınır. Canlıya çıkarken false yap.
const shopFree = () => shopAdmin() || SHOP_TEST_FREE;
const priceTxt = n => n === 0 ? 'Ücretsiz' : fmtPts(n) + ' puan';
const shopBal = () => Math.max(0, Math.round((scoreOf(ME).pts - SHOP.spent) * 100) / 100);
function shopSave(){
  try{ localStorage.setItem('gs-shop', JSON.stringify(SHOP)); }catch(e){}
  if(FB_ON && FB.uid && FB.db) fbDoc('users', FB.uid).update({shop: SHOP, frame: SHOP.eq}).catch(e => showToast(fbErr(e)));
}
function openShop(){ shopEdit = false; shopPrev = SHOP.eq; paintShop(); $('shsheet').classList.remove('hidden'); }
function closeShop(){ $('shsheet').classList.add('hidden'); try{ rerender(); }catch(e){} }
const shopFrames = () => FRAMES.filter(f => !f.priv || shopFree() || SHOP.owned.includes(f.id));   // priv: sadece yöneticiye özel çerçeve
function shopSections(item){
  if(shopEdit) return `<div class="sh-grid">${shopFrames().map(item).join('')}</div>`;
  const own = shopFrames().filter(f => SHOP.owned.includes(f.id)), st = shopFrames().filter(f => !SHOP.owned.includes(f.id));
  return (own.length ? `<h4 class="sh-h">Satın aldıklarım <span>${own.length}</span></h4><div class="sh-grid">${own.map(item).join('')}</div>` : '')
    + (st.length ? `<h4 class="sh-h">Mağaza</h4><div class="sh-grid">${st.map(item).join('')}</div>` : '<div class="empty">Tüm çerçeveler sende 🎉</div>');
}
const frWrap = (id, h) => id ? `<span class="frw fr-${id}">${h}<img class="fi" src="${FR_BY[id].img}" alt=""></span>` : h;
// Çerçeve için işlem düğmesi (satın al / kuşan / çıkar)
function shopAct(f){
  const bal = shopBal(), pr = priceOf(f), own = SHOP.owned.includes(f.id), eq = SHOP.eq === f.id, need = Math.max(0, pr - bal);
  if(eq) return {t:'Çıkar', fn:"shopEquip('')", alt:true};
  if(own) return {t:'Kuşan', fn:`shopEquip('${f.id}')`};
  if(shopFree()) return {t:'Al · ücretsiz', fn:`shopBuy('${f.id}')`};
  if(need > 0) return {t:fmtPts(need) + ' puan eksik', dis:true};
  return {t:pr === 0 ? 'Al · Ücretsiz' : 'Satın al', fn:`shopBuy('${f.id}')`};
}
function paintShop(){
  const bal = shopBal();
  $('shsheet-body').innerHTML = `
    <div class="sh-top"><div class="bal">${fmtPts(bal)}<small>PUAN BAKİYE</small></div>
      <div class="hint">Sıralaman toplam puanına göre belirlenir, çerçeve almak onu düşürmez.</div></div>
    ${shopSections(f => {
      const pr = priceOf(f), own = SHOP.owned.includes(f.id), eq = SHOP.eq === f.id, ac = shopAct(f);
      if(shopEdit) return `<div class="sh-row"><div class="sh-av">${frWrap(f.id, rawAv(ME, 'm'))}</div><div class="sh-in"><b>${f.n}</b><small>varsayılan ${f.p} puan</small></div><input class="sh-pr sm" id="pr-${f.id}" type="number" inputmode="decimal" min="0" step="any" value="${pr}" aria-label="${f.n} fiyatı (puan)"></div>`;
      return `<div class="sh-row ${eq ? 'eq' : ''}">
        <div class="sh-av" onclick="shopPv('${f.id}')">${frWrap(f.id, rawAv(ME, 'm'))}</div>
        <div class="sh-in"><b>${f.n}</b><small>${own ? (eq ? '✓ Kuşanıldı' : 'Sende var') : f.d + ' · <i>' + priceTxt(pr) + '</i>'}</small></div>
        <div class="sh-bt"><button class="alt" onclick="shopPv('${f.id}')">Önizle</button><button class="${ac.alt ? 'alt' : ''}" ${ac.dis ? 'disabled' : `onclick="${ac.fn}"`}>${ac.t}</button></div>
      </div>`;
    })}
    ${shopAdmin() ? (shopEdit
      ? `<div class="sh-adm"><button onclick="shopPricesSave()">Fiyatları kaydet</button><button class="alt" onclick="shopPricesDefault()">Varsayılana dön</button><button class="alt" onclick="shopEdit=false;paintShop()">Vazgeç</button></div>`
      : `<button class="btn2" style="width:100%;margin-top:14px" onclick="shopEdit=true;paintShop()">Fiyatları düzenle (yönetici)</button>`) : ''}
`;
}

/* ---- Çerçeve önizleme: kendi profilin bu çerçeveyle nasıl görünür ---- */
let shopPvId = '';
function shopPv(id){
  if(!FR_BY[id]) return; shopPvId = id;
  let d = $('shpv');
  if(!d){ d = document.createElement('div'); d.id = 'shpv'; d.className = 'dlg'; d.onclick = e => { if(e.target === d) shopPvClose(); }; document.body.appendChild(d); }
  shopPvPaint();
}
function shopPvClose(){ const d = $('shpv'); if(d) d.remove(); }
function shopPvGo(dir){
  const L = shopFrames(), i = L.findIndex(f => f.id === shopPvId);
  shopPvId = L[(i + dir + L.length) % L.length].id; shopPvPaint();
}
function shopPvAct(){ const f = FR_BY[shopPvId], ac = f && shopAct(f); if(!ac || ac.dis) return; shopPvClose(); try{ (new Function(ac.fn))(); }catch(e){} }
function shopPvPaint(){
  const d = $('shpv'); if(!d) return;
  const f = FR_BY[shopPvId], ac = shopAct(f), me = USERS[ME] || {};
  d.innerHTML = `<div class="dlg-card pvw" role="dialog" aria-label="Önizleme">
    <div class="pvw-nav"><button onclick="shopPvGo(-1)" aria-label="Önceki">‹</button><div><b>${f.n}</b><small>${priceTxt(priceOf(f))}</small></div><button onclick="shopPvGo(1)" aria-label="Sonraki">›</button></div>
    <div class="pvw-prof">
      <div class="pvw-cv">Ganyan<i>Sosyal</i></div>
      <div class="pvw-av">${frWrap(f.id, rawAv(ME, 'xl'))}</div>
      <h4>${esc(dn(ME))}</h4>
      <span class="uh"><i>@</i>${esc(String(me.h || '').replace(/^@/, ''))}</span>
      ${me.bio ? `<p class="pvw-bio">${esc(me.bio)}</p>` : ''}
    </div>
    <div class="pvw-post"><span>${frWrap(f.id, rawAv(ME, 'm'))}</span><div><b>${esc(dn(ME))}</b><small>Akışta böyle görünür</small></div></div>
    <div class="dlg-row"><button class="no" onclick="shopPvClose()">Kapat</button><button class="pvw-go ${ac.dis ? 'dis' : ''}" ${ac.dis ? 'disabled' : 'onclick="shopPvAct()"'}>${ac.t}</button></div>
  </div>`;
}
function shopBuy(id){
  const f = FR_BY[id]; if(!f || SHOP.owned.includes(id)) return;
  const pr = priceOf(f);
  if(!shopFree()){
    if(shopBal() < pr){ showToast('Puanın yetmiyor.'); return; }
    SHOP.spent = Math.round((SHOP.spent + pr) * 100) / 100;
  }
  SHOP.owned.push(id); SHOP.eq = id; shopPrev = id;
  shopSave(); paintShop(); showToast(f.n + ' çerçevesi alındı ve takıldı.');
}
function shopPricesSave(){
  if(!shopAdmin()) return;
  const raw = {}; FRAMES.forEach(f => { const e = $('pr-' + f.id); if(e) raw[f.id] = e.value.trim(); });
  const bad = FRAMES.find(f => raw[f.id] === '' || !isFinite(+raw[f.id]) || +raw[f.id] < 0);
  if(bad){ showToast(bad.n + ' için geçerli bir fiyat yaz.'); return; }
  const pr = normPrices(raw);
  SHOP_PRICES = pr;
  try{ localStorage.setItem('gs-shop-prices', JSON.stringify(pr)); }catch(e){}
  shopEdit = false; paintShop();
  if(FB_ON && FB.uid && FB.db){
    fbDoc('shop', 'prices').set({prices: pr, by: FB.uid, ts: Date.now()})
      .then(() => showToast('Fiyatlar kaydedildi, herkese yansıdı.'))
      .catch(e => showToast('Kaydedilemedi: ' + fbErr(e)));
  }else showToast('Fiyatlar bu cihaza kaydedildi.');
}
function shopPricesDefault(){ FRAMES.forEach(f => { const e = $('pr-' + f.id); if(e) e.value = f.p; }); }
function shopEquip(id){
  if(id && !SHOP.owned.includes(id)) return;
  SHOP.eq = id; shopPrev = id; shopSave(); paintShop();
}
function openSettings(){ paintSettings(); $('ssheet').classList.remove('hidden'); }
function closeSettings(){ $('ssheet').classList.add('hidden'); }
function paintSettings(){
  const dark = document.documentElement.dataset.theme === 'dark';
  $('ssheet-body').innerHTML = `
    <div class="set-me">${av(ME,'m')}<div><b>${esc(dn(ME))}</b><small>${esc(USERS[ME].h)}</small></div></div>
    <div class="set-list">
      <button class="set-row" onclick="toggleTheme();paintSettings()">${ic(dark ? 'moon' : 'sun', 20)}<span class="sp">Koyu tema</span><i class="sw ${dark ? 'on' : ''}"></i></button>
      ${isStandalone() ? '' : `<button class="set-row" onclick="installApp()">${ic('plus', 20)}<span class="sp">Uygulamayı Yükle</span></button>`}
      ${(typeof FB !== 'undefined' && FB.isAdmin) ? `<button class="set-row" onclick="openAdmin()">${ic('lock', 20)}<span class="sp">Yönetim Paneli</span></button>` : ''}
    </div>
    <div class="set-note">${FB_ON ? 'Hesabın ve paylaşımların bulutta saklanır.' : 'Verilerin bu cihazda saklanır.<br>Oturumu kapatman verilerini silmez.'}</div>`;
}
$('ssheet-x').innerHTML = ic('x', 18);
document.querySelectorAll('[data-ic]').forEach(e => { e.innerHTML = ic(e.dataset.ic, 18); });

// ===== Kupon paylaşım görseli (canvas ile çizilir, dış kütüphane yok) =====
let SHR = {blob:null, url:'', name:'', text:''};
function shrRR(x, y, w, h, r){ const k = ctx_; k.beginPath(); k.moveTo(x + r, y); k.arcTo(x + w, y, x + w, y + h, r); k.arcTo(x + w, y + h, x, y + h, r); k.arcTo(x, y + h, x, y, r); k.arcTo(x, y, x + w, y, r); k.closePath(); }
let ctx_ = null;
async function couponImage(p){
  try{ if(document.fonts && document.fonts.ready) await document.fonts.ready; }catch(e){}
  const c = p.coupon, cols = c.legs.length, slotted = c.legs.some(l => l.slot != null);
  const F = getComputedStyle(document.body).fontFamily || 'sans-serif';
  const W = 1080, CX = 24, CW = 1032, L = 52, IW = 976;
  const colW = IW / cols, s = cols >= 7 ? 62 : cols >= 5 ? 76 : cols >= 3 ? 80 : 88, gap = 12;
  const perRow = Math.max(1, Math.floor((colW - 8 + gap) / (s + gap)));
  const maxPick = Math.max(1, ...c.legs.map(l => l.picks.length));
  const rowsMax = Math.ceil(maxPick / perRow);
  const bodyH = rowsMax * (s + gap) + 36, headH = 108;
  const HEAD = 220, AUTH = 190, TITLE = 120, MONEY = 160, FOOT = 96;
  const cardH = HEAD + AUTH + TITLE + headH + bodyH + 36 + MONEY + 28 + FOOT;
  const H = cardH + 80;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d'); ctx_ = x;
  x.fillStyle = '#EDF1F7'; x.fillRect(0, 0, W, H);
  x.save(); x.shadowColor = 'rgba(14,27,44,.14)'; x.shadowBlur = 36; x.shadowOffsetY = 10;
  x.fillStyle = '#ffffff'; shrRR(CX, 40, CW, cardH, 44); x.fill(); x.restore();
  const T = (str, px, py, font, col, al, bl) => { x.font = font; x.fillStyle = col; x.textAlign = al || 'left'; x.textBaseline = bl || 'middle'; x.fillText(str, px, py); };
  // üst bant
  x.save(); shrRR(CX, 40, CW, cardH, 44); x.clip();
  const g = x.createLinearGradient(CX, 40, CX + CW, 40 + HEAD); g.addColorStop(0, '#12B886'); g.addColorStop(1, '#0A7F5C');
  x.fillStyle = g; x.fillRect(CX, 40, CW, HEAD);
  x.fillStyle = 'rgba(255,255,255,.09)'; x.beginPath(); x.arc(CX + CW - 40, 60, 150, 0, 7); x.fill();
  x.beginPath(); x.arc(CX + CW - 200, 200, 90, 0, 7); x.fill();
  x.restore();
  x.font = '800 78px ' + F; const gw = x.measureText('Ganyan').width;
  T('Ganyan', L, 40 + 92, '800 78px ' + F, '#ffffff'); T('Sosyal', L + gw, 40 + 92, '800 78px ' + F, '#C9F7E4');
  try{ x.letterSpacing = '4px'; }catch(e){}
  T('TAHMİN ET • PAYLAŞ • KAZAN', L, 40 + 160, '700 26px ' + F, 'rgba(255,255,255,.88)');
  try{ x.letterSpacing = '0px'; }catch(e){}
  const dt = p.ts ? fmtStamp(p.ts) : (p.time || '');
  T(dt, CX + CW - 36, 40 + 92, '600 30px ' + F, 'rgba(255,255,255,.92)', 'right');
  // yazar
  let y = 40 + HEAD + AUTH / 2;
  const nm = dn(p.author) || '', hd = (USERS[p.author] && USERS[p.author].h) || '';
  // avatar: gerçek profil fotoğrafı + çerçeve (feed'deki gibi)
  const AR = 58, AX = L + 22 + AR;
  const loadImg = src => new Promise(res => {
    if(!src) return res(null);
    const tryEl = (u, cors, next) => { const im = new Image(); if(cors) im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = next; im.src = u; };
    if(/^(data|blob):/.test(src)) return tryEl(src, false, () => res(null));
    // dış adres: önce CORS'lu yükle, olmazsa fetch ile blob'a çevir (canvas bozulmasın)
    tryEl(src, true, () => {
      fetch(src, {mode: 'cors'}).then(r => r.blob()).then(b => { const u = URL.createObjectURL(b); tryEl(u, false, () => res(null)); }).catch(() => res(null));
    });
  });
  const photoSrc = p.author === ME ? myPhoto : (USERS[p.author] && USERS[p.author].photo);
  const fid = frameOf(p.author);
  const [phImg, frImg] = await Promise.all([loadImg(photoSrc), loadImg(fid ? FR_BY[fid].img : '')]);
  x.save(); x.beginPath(); x.arc(AX, y, AR, 0, 7); x.clip();
  if(phImg){
    const sc2 = Math.max(AR * 2 / phImg.width, AR * 2 / phImg.height), dw = phImg.width * sc2, dh = phImg.height * sc2;
    x.drawImage(phImg, AX - dw / 2, y - dh / 2, dw, dh);
  }else{
    x.fillStyle = colorOf(p.author); x.fillRect(AX - AR, y - AR, AR * 2, AR * 2);
    const ini = nm.slice(0, 2).toUpperCase();
    T(ini, AX, y + 2, '800 30px ' + F, '#ffffff', 'center');
  }
  x.restore();
  if(frImg){ const d = AR * 2; x.drawImage(frImg, AX - d / 2 - d * .1579, y - d / 2 - d * .2895, d * 1.3158, d * 1.4474); }
  const NX = AX + AR + 34;
  T(nm, NX, y - 16, '800 46px ' + F, '#0E1B2C');
  if(hd) T(hd.startsWith('@') ? hd : '@' + hd, NX, y + 30, '600 32px ' + F, '#5E6B80');
  const won = isWon(p), lost = isLost(p);
  if(won || lost){
    const lab = won ? 'TUTTU' : 'KAYBETTİ', col = won ? '#0E9F73' : '#E0305A';
    x.font = '800 30px ' + F; const tw = x.measureText(lab).width + 44;
    x.fillStyle = col; shrRR(L + IW - tw, y - 29, tw, 58, 29); x.fill();
    T(lab, L + IW - tw / 2, y + 1, '800 30px ' + F, '#ffffff', 'center');
  }
  // başlık
  y = 40 + HEAD + AUTH + TITLE / 2 - 6;
  const title = (c.city || '') + ' · ' + (c.ord ? c.ord + '. ' : '') + (c.type || typeName(cols));
  x.font = '800 44px ' + F; const pw = Math.min(IW - 300, x.measureText(title).width + 64);
  x.fillStyle = '#0E9F73'; shrRR(L, y - 40, pw, 80, 40); x.fill();
  T(title, L + pw / 2, y + 2, '800 44px ' + F, '#ffffff', 'center');
  T(p.ts ? fmtStamp(p.ts, true) : (c.date || ''), L + IW, y + 2, '700 30px ' + F, '#5E6B80', 'right');
  // tablo
  const ty = 40 + HEAD + AUTH + TITLE + 6, th = headH + bodyH;
  x.fillStyle = '#F4F6FB'; shrRR(L, ty, IW, th, 28); x.fill(); x.fillStyle = '#E3E8F1'; x.save(); shrRR(L, ty, IW, th, 28); x.clip(); x.fillRect(L, ty, IW, headH); x.restore();
  x.strokeStyle = '#E1E6EE'; x.lineWidth = 2; shrRR(L, ty, IW, th, 28); x.stroke();
  for(let i = 1; i < cols; i++){ x.beginPath(); x.moveTo(L + colW * i, ty + 10); x.lineTo(L + colW * i, ty + th - 10); x.stroke(); }
  const fs = cols >= 6 ? 28 : 32;
  c.legs.forEach((l, i) => {
    const cx0 = L + colW * i, cm = cx0 + colW / 2, info = legInfo(c, l);
    T(slotted ? (l.slot + 1) + '. At' : l.r + '. Koşu', cm, ty + 42, '800 ' + fs + 'px ' + F, '#0E1B2C', 'center');
    T(slotted ? (l.r + '. Koşu') : (l.t || ''), cm, ty + 78, '600 25px ' + F, '#5E6B80', 'center');
    const n = l.picks.length;
    if(!n){ T('—', cm, ty + headH + 40, '700 34px ' + F, '#9AA6B8', 'center'); return; }
    for(let r = 0; r * perRow < n; r++){
      const row = l.picks.slice(r * perRow, r * perRow + perRow), rw = row.length * s + (row.length - 1) * gap;
      let px = cm - rw / 2; const py = ty + headH + 20 + r * (s + gap);
      row.forEach(num => {
        // feed ile aynı: sonuç yokken nötr, sonuç gelince duruma göre renk
        const cls = info.st === 'p' ? 'pend' : info.cls(num);
        const sty = {pend:['#ffffff','#0E1B2C','#D5DBE6'], win:['#12B886','#ffffff','#12B886'], pl:['#F5C400','#111111','#F5C400'], dim:['#ffffff','#8A97AD','#E1E6EE'], miss:['#FDE8EC','#E0305A','#F2B3C0']}[cls] || ['#F1F4F9','#0E1B2C','#C5CDDA'];
        x.save();
        x.fillStyle = sty[0]; shrRR(px, py, s, s, s * .3); x.fill();
        x.strokeStyle = sty[2]; x.lineWidth = 2; x.stroke();
        T(String(num), px + s / 2, py + s / 2 + 2, '800 ' + Math.round(s * .46) + 'px ' + F, sty[1], 'center');
        x.restore();
        px += s + gap;
      });
    }
  });
  // para satırı
  const full = c.legs.every(l => l.picks.length) && kolon(c) > 0, kn = full ? kolon(c) : kolonNow(c);
  const my = ty + th + 36;
  x.fillStyle = '#F1F4F9'; shrRR(L, my, IW, MONEY, 30); x.fill();
  if(kn){
    const totTxt = money(kn * birimFiyat(c.type, c.city) * c.misli), yy = my + MONEY / 2;
    const segs = [[kn + ' kolon', '#0E9F73'], [' × ', '#8A97AD'], [fiyatYazi(birimFiyat(c.type, c.city)) + ' ₺', '#0E1B2C'], [' × ', '#8A97AD'], [c.misli + ' misli', '#5B3FE0']];
    // tek satıra sığsın: gerekirse yazıları küçült (misli alta düşmesin)
    let f1 = 34, f2 = 64;
    const wL = () => { x.font = '800 ' + f1 + 'px ' + F; return segs.reduce((a, sg) => a + x.measureText(sg[0]).width, 0); };
    const wR = () => { x.font = '800 ' + f2 + 'px ' + F; return x.measureText(totTxt).width; };
    while(wL() + wR() > IW - 64 - 28 && f1 > 18){ f1 -= 2; f2 = Math.max(34, f2 - 4); }
    let mx = L + 32;
    segs.forEach(sg => { T(sg[0], mx, yy, '800 ' + f1 + 'px ' + F, sg[1]); x.font = '800 ' + f1 + 'px ' + F; mx += x.measureText(sg[0]).width; });
    T(totTxt, L + IW - 32, yy + 2, '800 ' + f2 + 'px ' + F, '#0E1B2C', 'right');
  }else T('Eksik seçim var', L + 32, my + MONEY / 2, '700 28px ' + F, '#5E6B80');
  // alt şerit
  T('GanyanSosyal · Tahmin et, paylaş, kazan', W / 2, 40 + cardH - FOOT / 2 + 4, '700 28px ' + F, '#8A97AD', 'center');
  return await new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('blob')), 'image/png'));
}
// Gerçek ekran görüntüsü: ekrandaki kupon kartını olduğu gibi çeker (html-to-image, tarayıcının kendi çizimi)
function loadLib(src){
  return new Promise((res, rej) => {
    if(window.htmlToImage) return res();
    const sc = document.createElement('script'); sc.src = src; sc.onload = () => res(); sc.onerror = () => rej(new Error('lib'));
    document.head.appendChild(sc);
  });
}
async function shotCard(id, btn){
  // Kaynak kart: tıklanan butonun kartı > ekranda görünen #pc-ID > yoksa (profil vb.) feed şablonuyla (postHtml) sıfırdan kurulur
  const vis = n => n && n.getBoundingClientRect().width > 0;
  let src = btn && btn.closest ? btn.closest('article.card') : null;
  if(!vis(src)) src = [...document.querySelectorAll('[id="pc-' + id + '"]')].find(vis) || null;
  let tmp = null;
  if(!src){
    const p = posts.find(x => x.id === id); if(!p || !p.coupon || typeof postHtml !== 'function') return null;
    const host = document.querySelector('#posts-container');
    const fw = Math.round((host && host.getBoundingClientRect().width) || Math.min(window.innerWidth, 560) - 24);
    tmp = document.createElement('div');
    tmp.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + fw + 'px;pointer-events:none;';
    tmp.innerHTML = postHtml(p); document.body.appendChild(tmp);
    src = tmp.firstElementChild;
  }
  await loadLib('https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js');
  try{ if(document.fonts && document.fonts.ready) await document.fonts.ready; }catch(e){}
  // Kartın kopyasını ekran dışında kur: beğeni/yorum satırı ve butonlar çıkarılır, altta boşluk kalmaz
  const w = Math.round(src.getBoundingClientRect().width) || 360;
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + w + 'px;pointer-events:none;';
  const el = src.cloneNode(true);
  el.removeAttribute('id'); el.classList.remove('nf-flash');
  el.querySelectorAll('.acts,.ph-act,.cm-more,.rp-bar,.cm-box,.cmts').forEach(n => n.remove());
  el.style.cssText += ';margin:0;width:' + w + 'px;animation:none;transition:none;';
  el.querySelectorAll('.cp-fm,.cp-tot').forEach(n => { n.style.whiteSpace = 'nowrap'; });
  box.appendChild(el); document.body.appendChild(box);
  try{
    const bg = getComputedStyle(document.body).backgroundColor;
    const opt = {pixelRatio: 3, width: w, height: box.offsetHeight, style: {position: 'static', left: '0px', top: '0px', margin: '0', transform: 'none'}, backgroundColor: (bg && bg !== 'rgba(0, 0, 0, 0)') ? bg : '#ffffff'};
    await window.htmlToImage.toBlob(box, opt);          // ilk çağrı yazı tipi/görselleri ısıtır
    return await brandShot(await window.htmlToImage.toBlob(box, opt));
  }finally{ box.remove(); if(tmp) tmp.remove(); }
}
// Ekran görüntüsünün üstüne GanyanSosyal başlık bandı + altına imza ekler
async function brandShot(blob){
  const im = await new Promise((res, rej) => { const i = new Image(), u = URL.createObjectURL(blob); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = rej; i.src = u; });
  const k = im.width / 1080, F = getComputedStyle(document.body).fontFamily || 'sans-serif';
  const pad = 40 * k, HEAD = 190 * k, FOOT = 80 * k, W = im.width + pad * 2, H = HEAD + im.height + FOOT + pad;
  const cv = document.createElement('canvas'); cv.width = Math.round(W); cv.height = Math.round(H);
  const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, HEAD); g.addColorStop(0, '#12B886'); g.addColorStop(1, '#0A7F5C');
  x.fillStyle = g; x.fillRect(0, 0, W, HEAD);
  x.fillStyle = 'rgba(255,255,255,.09)'; x.beginPath(); x.arc(W - 60 * k, 40 * k, 150 * k, 0, 7); x.fill();
  x.beginPath(); x.arc(W - 230 * k, 190 * k, 90 * k, 0, 7); x.fill();
  x.textBaseline = 'middle'; x.textAlign = 'left';
  x.font = '800 ' + 70 * k + 'px ' + F; x.fillStyle = '#fff'; x.fillText('Ganyan', pad, 78 * k);
  const gw = x.measureText('Ganyan').width; x.fillStyle = '#C9F7E4'; x.fillText('Sosyal', pad + gw, 78 * k);
  x.font = '700 ' + 24 * k + 'px ' + F; x.fillStyle = 'rgba(255,255,255,.9)';
  try{ x.letterSpacing = 4 * k + 'px'; }catch(e){}
  x.fillText('TAHMİN ET • PAYLAŞ • KAZAN', pad, 140 * k);
  try{ x.letterSpacing = '0px'; }catch(e){}
  x.fillStyle = '#EDF1F7'; x.fillRect(0, HEAD, W, H - HEAD);
  x.drawImage(im, pad, HEAD + pad / 2);
  x.textAlign = 'center'; x.font = '700 ' + 26 * k + 'px ' + F; x.fillStyle = '#8A97AD';
  x.fillText('GanyanSosyal · Tahmin et, paylaş, kazan', W / 2, H - FOOT / 2);
  return await new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('blob')), 'image/png'));
}
async function shareCoupon(id, btn){
  const p = posts.find(x => x.id === id); if(!p || !p.coupon) return;
  showToast('Görsel hazırlanıyor…');
  try{
    let blob = null; try{ blob = await shotCard(id, btn); }catch(e){ console.warn('shotCard', e); blob = null; }
    if(!blob) blob = await couponImage(p);   // kütüphane yüklenmezse çizilmiş sürüm
    const c = p.coupon;
    if(SHR.url) URL.revokeObjectURL(SHR.url);
    SHR.blob = blob; SHR.url = URL.createObjectURL(blob);
    SHR.name = 'ganyansosyal-kupon-' + id + '.png';
    SHR.text = dn(p.author) + ' · ' + (c.city || '') + ' ' + (c.type || '') + ' kuponu';
    $('shr-img').src = SHR.url; $('shrsheet-x').innerHTML = ic('x', 18);
    $('shrsheet').classList.remove('hidden');
  }catch(e){ showToast('Görsel oluşturulamadı'); }
}
function closeShare(){ $('shrsheet').classList.add('hidden'); $('shr-img').removeAttribute('src'); if(SHR.url){ URL.revokeObjectURL(SHR.url); SHR.url = ''; } }
async function doShare(){
  if(!SHR.blob) return;
  const f = new File([SHR.blob], SHR.name, {type: 'image/png'});
  try{
    if(navigator.canShare && navigator.canShare({files: [f]})){ await navigator.share({files: [f], title: 'GanyanSosyal', text: SHR.text}); return; }
  }catch(e){ if(e && e.name === 'AbortError') return; }
  saveShare(); showToast('Paylaşım bu cihazda desteklenmiyor, görsel kaydedildi');
}
async function saveShare(){
  if(!SHR.url || !SHR.blob) return;
  const ua = navigator.userAgent || '', ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  // Doğrudan telefona indir (Android/bilgisayar): paylaşım menüsü açmadan dosya iner
  try{
    const a = document.createElement('a'); a.href = SHR.url; a.download = SHR.name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    if(!ios){ showToast('Kupon görseli indirildi'); return; }
  }catch(e){}
  // iPhone: Safari indirmeyi desteklemez -> paylaşım menüsünden "Görüntüyü Kaydet"
  const f = new File([SHR.blob], SHR.name, {type: 'image/png'});
  try{ if(navigator.canShare && navigator.canShare({files: [f]})){ await navigator.share({files: [f]}); return; } }
  catch(e){ if(e && e.name === 'AbortError') return; }
  showToast('Görsele uzun basıp "Fotoğraflara Ekle" seç'); window.open(SHR.url, '_blank');
}

function askLogout(){
  askConfirm('Oturumu kapat', 'Oturumunu kapatmak istediğine emin misin? Verilerin bu cihazda saklanır.', 'Çıkış Yap', () => {
    let tk = ''; try { tk = localStorage.getItem(TOKEN_KEY) || ''; localStorage.removeItem(TOKEN_KEY); } catch(e){}
    if(AUTH_API && tk) authCall('/logout', {}, 'POST', tk).catch(() => {});
    setSession(false);
    if(FB_ON) fbSignOut();
    closeSettings();
    showAuth();
  });
}

function wipeUserData(){
  window.__noSave = true;
  ['gs-photo','gs-cover','gs-bio','gs-bioc','gs-name','gs-handle','gs-email','gs-shop','gs-posts-v1'].forEach(k => { try { localStorage.removeItem(k); } catch(e){} });
}
/* ---- Giriş / Kayıt ---- */
let authMode = 'login', authBusy = false;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Kayıt: kullanıcı adı yazılırken önceden kontrol (handles koleksiyonu herkese okunabilir)
let _hT = 0, _hSeq = 0; const hTaken = {};
function setHS(msg, cls){ const e = $('au-hs'); if(e){ e.textContent = msg; e.className = 'au-hs ' + (cls || ''); } }
function checkHandleLive(v){
  const h = cleanHandle(v);
  clearTimeout(_hT); _hSeq++;
  if(h.length < HANDLE_MIN || !FB_ON || !FB.ready){ setHS(''); return; }
  const seq = _hSeq;
  setHS('Kontrol ediliyor…', 'chk');
  _hT = setTimeout(async () => {
    try{
      const ex = (await fbDoc('handles', h).get()).exists;
      if(seq !== _hSeq) return;
      hTaken[h] = ex;
      setHS(ex ? '@' + h + ' kullanılmakta' : '@' + h + ' kullanılabilir', ex ? 'bad' : 'ok');
    }catch(e){ if(seq === _hSeq) setHS(''); }
  }, 400);
}
let regPhoto = '';
function paintRegPhoto(){
  const pv = $('au-pv'); if(!pv) return;
  pv.style.backgroundImage = regPhoto ? `url('${regPhoto}')` : '';
  pv.classList.toggle('has', !!regPhoto); if(regPhoto) pv.classList.remove('bad');
  $('au-pt').textContent = regPhoto ? 'Değiştir' : 'Fotoğraf seç';
}
async function regPick(input){
  const f = input.files && input.files[0]; input.value = '';
  if(!f) return;
  if(!/^image\//.test(f.type)){ showToast('Lütfen bir fotoğraf seçin.'); return; }
  try{ const dt = await cropImage(f, 360, 360, true); if(!dt) return; regPhoto = dt; paintRegPhoto(); $('au-err').textContent = ''; }
  catch(e){ showToast('Fotoğraf yüklenemedi.'); }
}
// Google profil fotoğrafını indirip 360x360 JPEG'e çevirir
function urlToData(url){
  return new Promise((res, rej) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onerror = () => rej(new Error('load'));
    img.onload = () => {
      try{
        const c = document.createElement('canvas'); c.width = 360; c.height = 360;
        const k = Math.max(360 / img.width, 360 / img.height), dw = img.width * k, dh = img.height * k;
        c.getContext('2d').drawImage(img, (360 - dw) / 2, (360 - dh) / 2, dw, dh);
        res(c.toDataURL('image/jpeg', .85));
      }catch(e){ rej(e); }
    };
    img.src = String(url).replace(/=s\d+(-c)?$/, '=s360-c').replace(/\/s\d+-c\//, '/s360-c/');
  });
}
// Profil fotoğrafı olmayan herkes (e-posta / Google, yeni / eski hesap) fotoğraf ekleyene kadar uygulamaya geçemez
function photoGate(){
  if(!sessionOn || myPhoto || $('pgate')) return;
  let pic = '';
  const d = document.createElement('div'); d.id = 'pgate'; d.className = 'pgate';
  d.innerHTML = `<div class="pg-card" role="dialog" aria-modal="true">
    <h2>Profil fotoğrafı ekle</h2>
    <p>Merhaba ${esc(USERS[ME].name || '')}! Devam etmek için profil fotoğrafı eklemelisin.</p>
    <button type="button" class="pg-av" id="pg-av" aria-label="Fotoğraf seç">📷</button>
    <div class="pg-err" id="pg-err" role="alert"></div>
    <button type="button" class="pg-b" id="pg-pick">Fotoğraf seç</button>
    <button type="button" class="pg-b main" id="pg-ok">Kaydet ve devam et</button>
    <button type="button" class="pg-out" id="pg-out">Çıkış yap</button>
    <input type="file" id="pg-in" accept="image/*" hidden>
  </div>`;
  const q = i => d.querySelector(i), err = t => { q('#pg-err').textContent = t; };
  const show = () => { const a = q('#pg-av'); a.style.backgroundImage = pic ? `url('${pic}')` : ''; a.classList.toggle('has', !!pic); a.classList.remove('bad'); q('#pg-pick').textContent = pic ? 'Başka fotoğraf seç' : 'Fotoğraf seç'; err(''); };
  q('#pg-av').onclick = q('#pg-pick').onclick = () => q('#pg-in').click();
  q('#pg-in').onchange = async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if(!f) return;
    if(!/^image\//.test(f.type)) return err('Lütfen bir fotoğraf seç.');
    try{ const dt = await cropImage(f, 360, 360, true); if(!dt) return; pic = dt; show(); }catch(x){ err('Fotoğraf yüklenemedi, başka bir tane dene.'); }
  };
  q('#pg-ok').onclick = () => {
    if(!pic){ q('#pg-av').classList.add('bad'); return err('Profil fotoğrafı eklemeden devam edemezsin.'); }
    myPhoto = pic; applyMyImgs();
    try{ localStorage.setItem('gs-photo', myPhoto); }catch(x){}
    if(FB_ON) fbSaveProfile();
    d.remove(); try{ rerender(); }catch(x){}
    showToast('Profil fotoğrafın eklendi');
  };
  q('#pg-out').onclick = () => { d.remove(); setSession(false); if(FB_ON) fbSignOut(); showAuth(); };
  document.body.appendChild(d);
}
function setAuthMode(m){
  authMode = m;
  const reg = m === 'register';
  $('au-t-login').classList.toggle('on', !reg);
  $('au-t-reg').classList.toggle('on', reg);
  ['au-f-photo','au-f-name','au-f-handle','au-f-email','au-f-pw2'].forEach(i => $(i).classList.toggle('hidden', !reg));
  $('au-f-id').classList.toggle('hidden', reg);
  $('au-forgot').classList.toggle('hidden', reg);
  $('au-go').textContent = reg ? 'Kayıt Ol' : 'Giriş Yap';
  $('au-sub').textContent = reg ? 'Hesabını birkaç saniyede oluştur.' : 'Tekrar hoş geldin! Hesabına giriş yap.';
  $('au-pw').autocomplete = reg ? 'new-password' : 'current-password';
  $('au-err').textContent = ''; setHS('');
}
// Şifremi unuttum: kullanıcı adı ya da e-posta ile sıfırlama bağlantısı gönderir (Firebase)
function forgotPw(){
  const d = document.createElement('div');
  d.className = 'dlg'; d.style.zIndex = 140;
  const v = ($('au-id').value || '').trim();
  d.innerHTML = `<div class="dlg-card" style="text-align:left;max-width:360px"><h3 style="text-align:center">Şifreni sıfırla</h3>
    <p style="margin-bottom:10px;text-align:center">Kullanıcı adını ya da e-postanı yaz, sana şifre sıfırlama bağlantısı gönderelim.</p>
    <input class="bn-in" id="fp-id" placeholder="Kullanıcı adı veya e-posta" autocomplete="username" autocapitalize="none" value="${esc(v)}">
    <div class="fp-msg" id="fp-msg"></div>
    <div class="dlg-row"><button class="no">Vazgeç</button><button class="ok" id="fp-go" style="background:var(--ac);color:var(--on,#fff);border-radius:12px;font-weight:800">Bağlantı gönder</button></div></div>`;
  const close = () => d.remove(), msg = (t, ok) => { const m = d.querySelector('#fp-msg'); m.textContent = t; m.className = 'fp-msg' + (ok ? ' ok' : ''); };
  d.onclick = e => { if(e.target === d) close(); };
  d.querySelector('.no').onclick = close;
  const go = d.querySelector('#fp-go');
  go.onclick = async () => {
    const id = d.querySelector('#fp-id').value.trim();
    if(id.length < 3){ msg('Kullanıcı adı veya e-posta yaz.'); return; }
    if(!FB_ON || !FB.auth){ msg('Şifre sıfırlama şu an kullanılamıyor.'); return; }
    go.disabled = true; go.textContent = 'Gönderiliyor…'; msg('');
    try{
      let email = id;
      if(!id.includes('@')){
        const hs = await fbDoc('handles', cleanHandle(id)).get().catch(() => null);
        email = hs && hs.exists && hs.data().email ? hs.data().email : '';
      }
      if(email) await FB.auth.sendPasswordResetEmail(email);
      msg('Bu hesap kayıtlıysa e-postana bağlantı gönderildi. Gelen kutunu ve spam klasörünü kontrol et. Google ile giriş yaptıysan "Google ile devam et" butonunu kullan.', true);
      go.textContent = 'Gönderildi'; setTimeout(close, 6500);
    }catch(e){
      go.disabled = false; go.textContent = 'Bağlantı gönder';
      const c = e && e.code;
      msg(c === 'auth/invalid-email' ? 'Geçerli bir e-posta yaz.' : c === 'auth/too-many-requests' ? 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.' : 'Gönderilemedi. İnternetini kontrol edip tekrar dene.');
    }
  };
  document.body.appendChild(d);
  setTimeout(() => { try{ d.querySelector('#fp-id').focus(); }catch(e){} }, 60);
}
function togglePw(){
  const el = $('au-pw'), show = el.type === 'password';
  el.type = show ? 'text' : 'password';
  $('au-pw2').type = el.type;
  $('au-eye').textContent = show ? 'Gizle' : 'Göster';
}
function showAuth(){
  setAuthMode('login');
  ['au-name','au-handle','au-email','au-pw','au-pw2'].forEach(i => { $(i).value = ''; }); setHS(''); regPhoto = ''; paintRegPhoto();
  $('au-pw').type = 'password'; $('au-pw2').type = 'password'; $('au-eye').textContent = 'Göster';
  let h = ''; try { h = (localStorage.getItem('gs-handle') || '').replace(/^@/, ''); } catch(e){}
  $('au-id').value = h;
  $('auth').classList.remove('hidden');
  initGoogle();
}
async function authCall(path, body, method = 'POST', token = null){
  if(!AUTH_API) throw new Error('Hesap sunucusu henüz bağlı değil.');
  let tk = token; if(!tk){ try { tk = localStorage.getItem(TOKEN_KEY); } catch(e){} }
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 12000);
  let r, j = {};
  try {
    r = await fetch(AUTH_API.replace(/\/+$/, '') + path, {
      method, signal: ac.signal,
      headers: {'Content-Type': 'application/json', ...(tk ? {Authorization: 'Bearer ' + tk} : {})},
      body: body ? JSON.stringify(body) : undefined
    });
    try { j = await r.json(); } catch(e){}
  } catch(e){
    throw new Error('Bağlantı kurulamadı. İnternetini kontrol et.');
  } finally { clearTimeout(to); }
  if(!r.ok) throw Object.assign(new Error(j.error || 'İşlem başarısız.'), {status: r.status});
  return j;
}
async function authRun(fn){
  if(authBusy) return;
  authBusy = true;
  const b = $('au-go'); b.disabled = true; b.textContent = 'Lütfen bekle…';
  try { finishAuth(await fn()); }
  catch(e){ $('au-err').textContent = e.message || 'İşlem başarısız.'; }
  finally { authBusy = false; b.disabled = false; b.textContent = authMode === 'register' ? 'Kayıt Ol' : 'Giriş Yap'; }
}
function submitAuth(){
  if(authBusy) return;
  const reg = authMode === 'register';
  const err = m => { $('au-err').textContent = m; };
  const pw = $('au-pw').value;
  let body;
  if(reg){
    if(!regPhoto){ $('au-pv').classList.add('bad'); return err('Profil fotoğrafı eklemelisin.'); }
    const nm = $('au-name').value.trim().replace(/\s+/g, ' ');
    const h = cleanHandle($('au-handle').value), em = $('au-email').value.trim().toLowerCase();
    if(nm.length < 2) return err('Ad en az 2 karakter olmalı.');
    if(h.length < HANDLE_MIN) return err('Kullanıcı adı en az ' + HANDLE_MIN + ' karakter olmalı.');
    if(hTaken[h]) return err('@' + h + ' kullanılmakta. Başka bir kullanıcı adı dene.');
    if(!EMAIL_RE.test(em) || em.length > 100) return err('Geçerli bir e-posta adresi yaz.');
    if(pw.length < 6) return err('Şifre en az 6 karakter olmalı.');
    if(pw !== $('au-pw2').value) return err('Şifreler aynı değil.');
    body = {name: nm, handle: h, email: em, password: pw, photo: regPhoto};
  } else {
    const id = $('au-id').value.trim().toLowerCase();
    if(id.length < 3) return err('Kullanıcı adı veya e-posta yaz.');
    if(id.includes('@') && !EMAIL_RE.test(id)) return err('Geçerli bir e-posta adresi yaz.');
    if(!pw) return err('Şifreni yaz.');
    body = {id, password: pw};
  }
  err('');
  if(FB_ON) return authRun(() => fbAuth(body, reg));
  if(!AUTH_API) return localAuth(body, reg);
  authRun(() => authCall(reg ? '/register' : '/login', body));
}
// Hesap sunucusu bağlanana kadar: giriş bu telefonda yerel çalışır (şifre kontrolü yapılmaz)
function localAuth(b, reg){
  const cur = (USERS[ME].h || '').replace(/^@/, '');
  let handle, name;
  if(reg){ handle = b.handle; name = b.name; }
  else {
    handle = b.id.includes('@') ? cur : cleanHandle(b.id);
    if(handle.length < HANDLE_MIN) handle = cur;
    name = handle === cur ? USERS[ME].name : handle;
  }
  finishAuth({token: 'local', user: {name, handle, email: b.email || '', photo: reg ? (b.photo || '') : ''}});
}
function finishAuth(j){
  const u = j && j.user, tk = j && j.token;
  if(!u || !tk) throw new Error('Sunucudan geçersiz yanıt geldi.');
  if(tk !== 'local'){ try { localStorage.setItem(TOKEN_KEY, tk); } catch(e){} }
  setSession(true);
  if('@' + u.handle !== USERS[ME].h){
    // Başka bir hesap: bu cihazdaki eski profil verisi temizlenir
    wipeUserData();
    try {
      localStorage.setItem('gs-name', u.name); localStorage.setItem('gs-handle', '@' + u.handle);
      if(u.email) localStorage.setItem('gs-email', u.email);
      if(u.photo) localStorage.setItem('gs-photo', u.photo);
    } catch(e){}
    location.reload();
    return;
  }
  USERS[ME].name = u.name;
  try { localStorage.setItem('gs-name', u.name); if(u.email) localStorage.setItem('gs-email', u.email); } catch(e){}
  if(u.photo){ myPhoto = u.photo; applyMyImgs(); try{ localStorage.setItem('gs-photo', myPhoto); }catch(e){} }
  $('auth').classList.add('hidden');
  rerender();
  showToast('Hoş geldin, ' + u.name);
  photoGate();
}

/* ---- Google ile giriş ---- */
let _gLoaded = false;
function initGoogle(){
  if(!GOOGLE_CLIENT_ID || _gLoaded) return;
  _gLoaded = true;
  const sc = document.createElement('script');
  sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true;
  sc.onload = () => {
    try {
      google.accounts.id.initialize({client_id: GOOGLE_CLIENT_ID, callback: r => authRun(() => authCall('/google', {credential: r.credential}))});
      const box = $('au-g');
      google.accounts.id.renderButton(box, {theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'tr', width: Math.min(380, box.offsetWidth || 320)});
      $('au-gbtn').classList.add('hidden');
    } catch(e){ _gLoaded = false; }
  };
  sc.onerror = () => { _gLoaded = false; };
  document.head.appendChild(sc);
}
function googleTap(){
  if(FB_ON) return fbGoogle();
  if(!AUTH_API) return showToast('Google girişi, hesap sunucusu bağlanınca açılacak.');
  if(!GOOGLE_CLIENT_ID) return showToast('Google girişi için GOOGLE_CLIENT_ID ayarlanmalı.');
  showToast('Google yükleniyor, birkaç saniye sonra tekrar dene.');
  initGoogle();
}

