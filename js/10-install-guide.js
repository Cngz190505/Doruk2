/* 10-install-guide.js
 * Tarayıcıya göre "Ana ekrana ekle" rehberi.
 * 06-account.js'den SONRA yüklenmeli. Mevcut installApp()'i bozmaz:
 * tarayıcı kurulum penceresini destekliyorsa (Android Chrome/Edge/Samsung)
 * eski kod çalışır, desteklemiyorsa (iPhone, Firefox, uygulama içi tarayıcı vb.)
 * adım adım rehber penceresi açılır.
 */
(function () {
  var ua = navigator.userAgent || '';
  var isIOS = /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var inApp = /FBAN|FBAV|Instagram|Line\/|Twitter|TikTok|musical_ly|Snapchat|Telegram|; wv\)/i.test(ua);
  var isSamsung = /SamsungBrowser/i.test(ua);
  var isFirefox = /firefox|fxios/i.test(ua);
  var isIOSChromeLike = isIOS && /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);

  function getSteps() {
    if (inApp) {
      return {
        title: 'Önce tarayıcıda aç',
        steps: [
          'Sağ üstteki <b>⋮</b> veya <b>⋯</b> menüsüne dokun',
          '<b>Tarayıcıda aç</b> seçeneğini seç' + (isIOS ? ' (Safari)' : ' (Chrome)'),
          'Açılan sayfada tekrar <b>Yükle</b> butonuna bas'
        ]
      };
    }
    if (isIOS) {
      return {
        title: 'iPhone\'a ekle',
        steps: [
          (isIOSChromeLike ? 'Adres çubuğundaki veya menüdeki ' : 'Safari\'de alttaki ') +
            '<b>Paylaş</b> simgesine dokun <span class="ig-ico">⬆︎</span> (görünmüyorsa <b>⋯</b> menüsünden <b>Paylaş</b>)',
          'Listeyi yukarı kaydır, <b>Ana Ekrana Ekle</b>\'yi seç',
          'Sağ üstteki <b>Ekle</b>\'ye dokun'
        ]
      };
    }
    if (isSamsung) {
      return {
        title: 'Ana ekrana ekle',
        steps: [
          'Alttaki <b>☰</b> menüsüne dokun',
          '<b>Geçerli sayfayı ekle</b> → <b>Ana ekran</b>\'ı seç'
        ]
      };
    }
    if (isFirefox) {
      return {
        title: 'Ana ekrana ekle',
        steps: [
          'Sağ üstteki <b>⋮</b> menüsüne dokun',
          '<b>Yükle</b> (veya <b>Ana ekrana ekle</b>) seçeneğini seç'
        ]
      };
    }
    return {
      title: 'Ana ekrana ekle',
      steps: [
        'Tarayıcının <b>⋮</b> menüsünü aç',
        '<b>Uygulamayı yükle</b> veya <b>Ana ekrana ekle</b>\'yi seç'
      ]
    };
  }

  function injectCSS() {
    if (document.getElementById('ig-css')) return;
    var s = document.createElement('style');
    s.id = 'ig-css';
    s.textContent =
      '.ig-bg{position:fixed;inset:0;z-index:99999;background:rgba(10,20,17,.55);display:flex;align-items:flex-end;justify-content:center;animation:igf .2s}' +
      '.ig-card{width:100%;max-width:480px;background:#fff;border-radius:22px 22px 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom));font-family:inherit;color:#0f1b17;animation:igu .25s}' +
      '.ig-card h3{margin:0 0 14px;font-size:19px}' +
      '.ig-card ol{margin:0 0 16px;padding:0;list-style:none;counter-reset:ig}' +
      '.ig-card li{counter-increment:ig;display:flex;gap:12px;align-items:flex-start;padding:10px 0;font-size:15px;line-height:1.4}' +
      '.ig-card li:before{content:counter(ig);flex:none;width:26px;height:26px;border-radius:50%;background:#0E7A5A;color:#fff;font-weight:700;font-size:13px;display:grid;place-items:center}' +
      '.ig-ico{display:inline-block;border:1px solid #0E7A5A;border-radius:6px;padding:0 5px;color:#0E7A5A}' +
      '.ig-note{font-size:12.5px;color:#5b6b66;margin:0 0 14px}' +
      '.ig-btn{width:100%;border:0;border-radius:14px;padding:14px;background:#0E7A5A;color:#fff;font-weight:700;font-size:16px}' +
      '@keyframes igf{from{opacity:0}}@keyframes igu{from{transform:translateY(40px);opacity:0}}';
    document.head.appendChild(s);
  }

  function showGuide() {
    injectCSS();
    var old = document.getElementById('ig-modal');
    if (old) old.remove();
    var g = getSteps();
    var bg = document.createElement('div');
    bg.className = 'ig-bg';
    bg.id = 'ig-modal';
    bg.innerHTML =
      '<div class="ig-card" role="dialog" aria-modal="true">' +
        '<h3>' + g.title + '</h3>' +
        '<ol>' + g.steps.map(function (t) { return '<li><span>' + t + '</span></li>'; }).join('') + '</ol>' +
        (isIOS && !inApp ? '<p class="ig-note">Not: Ana ekrandan açınca giriş yapman gerekebilir.</p>' : '') +
        '<button class="ig-btn" type="button">Tamam</button>' +
      '</div>';
    bg.addEventListener('click', function (e) {
      if (e.target === bg || e.target.className === 'ig-btn') bg.remove();
    });
    document.body.appendChild(bg);
  }

  var original = window.installApp;
  window.installApp = function () {
    var hasNativePrompt = (typeof deferredInstall !== 'undefined') && deferredInstall;
    if (hasNativePrompt && typeof original === 'function') {
      return original.apply(this, arguments);
    }
    showGuide();
  };
})();
