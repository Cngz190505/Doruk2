/* ===== Oranlar sekmesi: ganyan oran geçmişi (ganyan-oran worker'ından) ===== */
// Worker adresi: Cloudflare'de açtığın oran kaydedici worker'ın adresi (sonunda / olmasın)
const ORAN_WORKER = 'https://ganyan-oran.bilyoncu001.workers.dev';

const ORN = { city: '', race: 0, gun: '', data: null, at: 0, err: '', busy: false, timer: null };

const ornFmt = x => String(Math.round(x * 10) / 10).replace('.', ',');   // 5.6 → "5,6", 5 → "5"
const ornSaat = ts => { const d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

// "DIYARBAKIR" → TJK'daki önek ("DBAKIR") eşleştirmesi: şehir adından worker'daki anahtar önekini bulur
function ornOnek(ad, onekler){
  const tam = turkceNormalizeAnahtar(ad).replace(/HIPODROMU$/, '');
  const ilk = turkceNormalizeAnahtar(String(ad).trim().split(/\s+/)[0] || '');
  const TAKMA = { DIYARBAKIR: ['DBAKIR'], SANLIURFA: ['SURFA', 'URFA'], KOCAELI: ['KOCAELI', 'IZMIT'] };
  for(const d of [ilk, tam]){ for(const t of (TAKMA[d] || [])) if(onekler.includes(t)) return t; if(d && onekler.includes(d)) return d; }
  for(const d of [ilk, tam]){ if(!d || d.length < 4) continue; const e = onekler.find(o => o.length >= 4 && (o.startsWith(d) || d.startsWith(o))); if(e) return e; }
  return null;
}

async function ornYukle(zorla){
  if(ORN.busy) return;
  if(!zorla && ORN.at && Date.now() - ORN.at < 60000 && (ORN.gun === viewIso || ORN.err)) return;
  ORN.busy = true;
  try{
    const r = await fetch(ORAN_WORKER + '/oran?gun=' + encodeURIComponent(viewIso), { cache: 'no-store' });
    if(!r.ok) throw new Error('HTTP ' + r.status);
    ORN.data = await r.json(); ORN.gun = viewIso; ORN.at = Date.now(); ORN.err = '';
  }catch(e){ ORN.err = String((e && e.message) || e); ORN.at = Date.now(); }
  ORN.busy = false;
  if(visible() === 'oranlar') renderOranlar(true);
}

function ornSatir(isim, no, seri){
  // seri: [{t, o:{atNo: oran}}] zaman sıralı → bu atın oranları
  const pts = [];
  seri.forEach(s => { const v = s.o[String(no)]; if(v > 0) pts.push({ t: s.t, v }); });
  if(!pts.length) return '';
  const ilk = pts[0].v, son = pts[pts.length - 1].v, onceki = pts.length > 1 ? pts[pts.length - 2].v : son;
  const yon = son < onceki ? 'dn' : son > onceki ? 'up' : '';
  const ok = yon === 'dn' ? '↓' : yon === 'up' ? '↑' : '';
  const fark = son - ilk, farkTx = Math.abs(fark) < 0.05 ? '' : (fark < 0 ? '−' : '+') + ornFmt(Math.abs(fark));
  // Çok uzarsa: açılış + son 5 oran
  let g = pts;
  let kisa = false;
  if(pts.length > 7){ g = [pts[0]].concat(pts.slice(-5)); kisa = true; }
  const zincir = g.map((p, i) => `<span class="orn-v${i === g.length - 1 ? ' son' : ''}" title="${ornSaat(p.t)}">${ornFmt(p.v)}</span>`);
  if(kisa) zincir.splice(1, 0, '<span class="orn-dot">…</span>');
  return `<div class="orn-r">
    <div class="orn-n">${esc(String(no))}</div>
    <div class="orn-m"><b>${esc(isim || '')}</b>
      <div class="orn-z">${zincir.join('<i>→</i>')}</div></div>
    <div class="orn-s ${yon}"><b>${ornFmt(son)} ${ok}</b>${farkTx ? `<small>${farkTx}</small>` : ''}</div>
  </div>`;
}

function renderOranlar(sessiz){
  const box = $('oranlar-body'); if(!box) return;
  const sehirler = Object.keys(BUL.data || {});
  if(!sehirler.length){
    box.innerHTML = `<div class="ru-t">Oranlar</div><div class="empty">${BUL.status === 'err' ? 'Program alınamadı. Tahmin Yap sekmesinden tekrar deneyebilirsin.' : 'Program yükleniyor…'}</div>`;
    if(!BUL.status || BUL.status === 'idle') try{ loadBulten(false); }catch(e){}
    clearTimeout(ORN.timer); ORN.timer = setTimeout(() => { if(visible() === 'oranlar') renderOranlar(true); }, 1500);
    return;
  }
  if(!ORN.city || !BUL.data[ORN.city]) ORN.city = (typeof city === 'string' && BUL.data[city]) ? city : sehirler[0];
  const kosular = BUL.data[ORN.city] || [];
  if(!kosular.find(k => +k.no === ORN.race)) ORN.race = +(kosular[0] && kosular[0].no) || 1;
  if(!sessiz) ornYukle(true); else ornYukle(false);

  const cip = sehirler.map(c => `<button class="orn-chip ${c === ORN.city ? 'on' : ''}" onclick="ornSec('${esc(c)}',0)">${esc(c)}</button>`).join('');
  const kcip = kosular.map(k => `<button class="orn-chip k ${+k.no === ORN.race ? 'on' : ''}" onclick="ornSec('${esc(ORN.city)}',${+k.no})">${+k.no}. Koşu</button>`).join('');
  const k = kosular.find(x => +x.no === ORN.race);

  let govde;
  if(ORN.err && !ORN.data) govde = `<div class="empty">Oranlar alınamadı (${esc(ORN.err)}).<br>Worker adresini ve D1 bağlantısını kontrol et.</div>`;
  else if(!ORN.data) govde = '<div class="empty">Oranlar yükleniyor…</div>';
  else {
    const onekler = [...new Set(Object.keys(ORN.data).map(x => x.split('-')[0]))];
    const onek = ornOnek(ORN.city, onekler);
    const seri = onek ? (ORN.data[onek + '-' + ORN.race] || []) : [];
    if(!seri.length) govde = '<div class="empty">Bu koşu için henüz kayıtlı oran yok.<br><small>Oranlar 5 dakikada bir kaydedilir.</small></div>';
    else {
      const satirlar = (k.atlar || []).filter(a => !a.kosmaz).map(a => ornSatir(a.isim, a.no, seri)).join('');
      const son = seri[seri.length - 1].t;
      govde = `<div class="orn-bilgi">${seri.length} kayıt · son ${ornSaat(son)}</div><div class="orn-list">${satirlar || '<div class="empty">At bulunamadı.</div>'}</div>`;
    }
  }
  box.innerHTML = `<div class="ru-t">Oranlar</div>
    <div class="ru-s">Ganyan oranlarının açılıştan bu yana değişimi. Uygulama kapalıyken de 5 dakikada bir kaydedilir.</div>
    <div class="orn-chips">${cip}</div>
    <div class="orn-chips">${kcip}</div>
    ${k && k.saat ? `<div class="orn-saat">${esc(ORN.city)} · ${+k.no}. Koşu · ${esc(String(k.saat))}${ORN.err && ORN.data ? ' · <span class="orn-hata">yenilenemedi</span>' : ''}</div>` : ''}
    ${govde}
    <button class="orn-yenile" onclick="ornYukle(true)">Yenile</button>`;
  // Açıkken dakikada bir kendini yeniler
  clearTimeout(ORN.timer);
  ORN.timer = setTimeout(() => { if(visible() === 'oranlar') ornYukle(true); }, 60000);
}

function ornSec(c, r){
  ORN.city = c; ORN.race = r;
  renderOranlar(true);
}
