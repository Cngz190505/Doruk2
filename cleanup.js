// Gece temizliği: günü geçmiş ve kaybetmiş kuponları siler, puanı kullanıcının "hist" özetine yazar.
// Tutan kuponları silmez; puanını hist'e işler ve "banked" diye işaretler (index.html'deki autoCleanLost ile aynı).
// Mantık index.html'deki autoCleanLost / status / legInfo / scoreDays ile aynıdır.
// YENİ: ayak sonuçları kuponda kayıtlı değilse Firestore "results" arşivinden doldurulur (kuponun sahibi uygulamayı açmasa da çalışır).
const admin = require('firebase-admin');

const DRY = process.env.DRY_RUN === '1';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();

// ---- Türkiye saati yardımcıları ----
const TZ = 'Europe/Istanbul';
const parts = ts => {
  const o = {};
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(ts)).forEach(p => { o[p.type] = p.value; });
  return o;
};
const isoOf = ts => { const p = parts(ts); return `${p.year}-${p.month}-${p.day}`; };
const dayKey = ts => { const p = parts(ts); return 'd' + p.year + p.month + p.day; };
const today = isoOf(Date.now());

// ---- Kupon mantığı (uygulamadan) ----
const ALTILI = "6'lı Ganyan";
const TYPE_PTS = {"7'li Ganyan":15,"6'lı Ganyan":10,"5'li Ganyan":5,"7'li Plase":4,"4'lü Ganyan":3,'Sıralı Üçlü':3,'Sıralı Beşli':8,'Tabela':4,'Tabela Bahis':4,"3'lü Ganyan":2,
  'Çifte Bahis':1,'Sıralı İkili':1,'İkili Bahis':0.5,'Plase İkili':0.5,'Ganyan':0.5,'Ganyan & Plase':0.5,'Plase':0.25};
const typePts = t => { const v = TYPE_PTS[String(t || '').replace(/\s*\(.*\)\s*$/, '').trim()]; return v == null ? 0.5 : v; };
const placeN = (f = 6) => f >= 8 ? 3 : 2;
const isAltili = c => !!c && c.type === ALTILI && !(c.legs || []).some(l => l.slot != null);
const legRes = l => l.res ? l.res : (l.win != null ? [l.win] : null);

function legSt(c, l){
  const res = legRes(l); if (!res) return 'p';
  const rule = c.rule || 'win', picks = l.picks || [], p = placeN(l.fld || 6);
  let hit;
  if (rule === 'win') hit = picks.includes(res[0]);
  else if (rule === 'place' || rule === 'gp') hit = picks.some(n => res.slice(0, p).includes(n));
  else if (rule === 'slots') hit = picks.includes(res[l.slot]);
  else if (rule === 'any2') hit = res.slice(0, 2).every(n => picks.includes(n));
  else if (rule === 'any4') { const t = res.slice(0, 4); hit = t.length === 4 && t.every(n => picks.includes(n)); }
  else hit = picks.filter(n => res.slice(0, p).includes(n)).length >= 2;
  return hit ? 'h' : 'm';
}
function status(c){
  const st = c.legs.map(l => legSt(c, l));
  if (st.includes('m')) return 'lose';
  if (st.every(x => x === 'h')) return 'win';
  return 'wait';
}
function couponPts(c){
  let pts = 0, tot = 0; const st = status(c);
  if (isAltili(c)){
    if (st === 'win'){ pts = 10; tot = c.legs.length; }
    else c.legs.forEach(l => { const s = legSt(c, l); if (s === 'h'){ pts++; tot++; } else if (s === 'm') tot++; });
  } else if (st === 'win'){ pts = typePts(c.type); tot = 1; }
  else if (st === 'lose') tot = 1;
  return { pts, tot };
}
// scoreDays: banked olmayan kuponlardan gün bazlı ham puan / kupon / isabet
function scoreDays(posts, skip){
  const D = {}, day = g => D[g] || (D[g] = { pts: 0, tot: 0, hit: 0 });
  const best = new Map();
  posts.forEach(p => {
    if (!p.coupon || p.coupon.banked || skip.has(p) || !isAltili(p.coupon)) return;
    const c = p.coupon, key = isoOf(p.ts) + '|' + (c.city || '') + '|' + (c.legs[0] ? c.legs[0].r : 0);
    const pt = couponPts(c).pts, cur = best.get(key);
    if (!cur || pt > cur.pt || (pt === cur.pt && (p.ts || 0) < (cur.p.ts || 0))) best.set(key, { p, pt });
  });
  const ok = new Set(Array.from(best.values()).map(x => x.p));
  posts.forEach(p => {
    if (!p.coupon || p.coupon.banked || skip.has(p)) return;
    if (isAltili(p.coupon) && !ok.has(p)) return;
    const c = p.coupon, r = couponPts(c), d = day(dayKey(p.ts));
    d.tot += r.tot; d.pts += r.pts;
    if (isAltili(c)) d.hit += c.legs.filter(l => legSt(c, l) === 'h').length;
    else if (r.pts > 0) d.hit++;
  });
  return D;
}
const valid = p => { const c = p.coupon; return !!c && !c.banked && Array.isArray(c.legs) && c.legs.length > 0; };
const isPast = p => (p.coupon.iso || isoOf(p.ts)) < today;
// Silinecek mi? (günü geçmiş + kaybetmiş; altılıda tüm ayak sonuçları belli olmalı)
function shouldDelete(p){
  try{
    if (!valid(p) || !isPast(p) || status(p.coupon) !== 'lose') return false;
    return !isAltili(p.coupon) || p.coupon.legs.every(l => !!legRes(l));
  }catch(e){ return false; }
}
// Puanı kalıcı yapılacak mı? (tutan kupon; altılıda gün bitince, diğerlerinde hemen)
function shouldBank(p){
  try{
    if (!valid(p) || status(p.coupon) !== 'win') return false;
    return isPast(p) || !isAltili(p.coupon);
  }catch(e){ return false; }
}

// ---- Sonuç arşivi: Firestore "results/{tarih}_{şehir}" ----
const arcCache = {};
async function arc(iso, city){
  const id = (iso + '_' + city).replace(/\//g, '-');
  if (id in arcCache) return arcCache[id];
  const d = await db.collection('results').doc(id).get();
  return (arcCache[id] = d.exists ? d.data() : null);
}
// Kuponda kayıtlı olmayan ayak sonuçlarını arşivden doldurur; değiştiyse true
async function fillRes(p){
  const c = p.coupon;
  if (!c.city || !Array.isArray(c.legs) || c.legs.every(l => l.res || l.win != null)) return false;
  const a = await arc(c.iso || isoOf(p.ts), c.city);
  if (!a || !a.sira) return false;
  let ch = false;
  c.legs.forEach(l => {
    if (l.res || l.win != null) return;
    const r = a.sira[l.r]; if (!r || !r.length) return;
    l.res = r.slice(); if (a.fld && a.fld[l.r]) l.fld = a.fld[l.r];
    l.odds = Object.assign({}, (a.gny && a.gny[l.r]) || {}); ch = true;
  });
  return ch;
}

(async () => {
  const snap = await db.collection('posts').get();
  const byUid = {};
  snap.forEach(d => {
    const r = d.data();
    if (!r || !r.coupon || !r.uid) return;
    (byUid[r.uid] = byUid[r.uid] || []).push({ docId: d.id, ts: r.ts, uid: r.uid, coupon: r.coupon });
  });

  let deleted = 0, banked = 0, filledCnt = 0;
  for (const uid of Object.keys(byUid)) {
    let mine = byUid[uid];

    // 1) Günü geçmiş kuponların eksik ayak sonuçlarını arşivden doldur
    const filled = [];
    for (const p of mine) {
      try { if (valid(p) && isPast(p) && await fillRes(p)) filled.push(p); }
      catch (e) { console.warn('arşiv okunamadı', p.docId, e.message); }
    }

    const dl0 = mine.filter(shouldDelete).slice(0, 200);
    const bl0 = mine.filter(shouldBank).slice(0, 200);

    // 2) Silinmeyecek kuponların sonuçlarını kuponun kendi kaydına da yaz (tutan / bekleyen kupon bilgisi kalıcı olsun)
    const delSet = new Set(dl0);
    for (const p of filled) {
      if (delSet.has(p)) continue;
      console.log(`${uid}: ${p.docId} sonuçları kupona yazıldı`);
      if (!DRY) await db.collection('posts').doc(p.docId).update({ 'coupon.legs': JSON.parse(JSON.stringify(p.coupon.legs)) });
      filledCnt++;
    }

    if (!dl0.length && !bl0.length) continue;

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) continue;                       // kullanıcı belgesi yoksa puan yazamayız, silme
    const hist = JSON.parse(JSON.stringify(userSnap.data().hist || {}));

    const run = async (dl, bl) => {
      if (!dl.length && !bl.length) return;
      const set = new Set(dl.concat(bl)), before = scoreDays(mine, new Set()), after = scoreDays(mine, set);
      const cntL = {}, cntW = {};
      dl.forEach(p => { const g = dayKey(p.ts); cntL[g] = (cntL[g] || 0) + 1; });
      bl.forEach(p => { const g = dayKey(p.ts); cntW[g] = (cntW[g] || 0) + 1; });
      const upd = {};
      Object.keys(Object.assign({}, cntL, cntW)).forEach(g => {
        const b = before[g] || { pts: 0, tot: 0, hit: 0 }, a = after[g] || { pts: 0, tot: 0, hit: 0 }, cur = hist[g] || {};
        upd['hist.' + g] = {
          p: Math.round(((+cur.p || 0) + b.pts - a.pts) * 100) / 100,
          t: (+cur.t || 0) + b.tot - a.tot,
          h: (+cur.h || 0) + b.hit - a.hit,
          l: (+cur.l || 0) + (cntL[g] || 0),
          w: (+cur.w || 0) + (cntW[g] || 0)
        };
      });
      console.log(`${uid}: ${dl.length} silinecek, ${bl.length} puanlanacak`, JSON.stringify(upd));
      if (!DRY) {
        const batch = db.batch();
        batch.update(userRef, upd);
        dl.forEach(p => batch.delete(db.collection('posts').doc(p.docId)));
        bl.forEach(p => batch.update(db.collection('posts').doc(p.docId), { 'coupon.banked': true }));
        await batch.commit();                             // puan + silme/işaretleme tek işlemde
        deleted += dl.length; banked += bl.length;
      }
      Object.keys(upd).forEach(key => { hist[key.slice(5)] = upd[key]; });
      const gone = new Set(dl); mine = mine.filter(p => !gone.has(p));
      bl.forEach(p => { p.coupon.banked = true; });
    };

    await run(dl0, []);                                   // önce tutmayanlar
    await run([], bl0);                                   // sonra tutanların puanı kalıcı
  }
  console.log(`Bitti. ${DRY ? '(DENEME) ' : ''}Silinen: ${deleted}, puanı işlenen: ${banked}, sonuçları kupona yazılan: ${filledCnt}`);
})().catch(e => { console.error(e); process.exit(1); });
