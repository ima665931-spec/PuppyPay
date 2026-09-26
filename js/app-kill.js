/* PuppyPay — global kill switch overlay (polls public /api/app-status) */
(function appKillWatch() {
  var API_BASE = (typeof window !== 'undefined' && window.PP_API)
    ? String(window.PP_API).replace(/\/$/, '')
    : 'https://puppy-pay-backend.vercel.app/api';
  var overlay = null;

  function showDead() {
    if (overlay && document.body.contains(overlay)) return;
    overlay = document.createElement('div');
    overlay.id = 'ppKillOverlay';
    overlay.setAttribute('style',
      'position:fixed;inset:0;z-index:99999;background:linear-gradient(160deg,#0a0c10 0%,#12151c 45%,#1a1020 100%);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;text-align:center;color:#e8eaed;' +
      'font-family:Inter,system-ui,sans-serif;');
    overlay.innerHTML =
      '<div style="width:76px;height:76px;border-radius:22px;background:rgba(239,68,68,.14);display:flex;align-items:center;justify-content:center;margin-bottom:22px;animation:ppPulse 1.6s ease-in-out infinite">' +
      '<span style="font-size:34px">⚠</span></div>' +
      '<div style="font-size:24px;font-weight:800;letter-spacing:-.03em;margin-bottom:8px">PuppyPay</div>' +
      '<div style="font-size:16px;font-weight:600;color:#f87171;margin-bottom:10px">Not available right now</div>' +
      '<div style="font-size:13px;color:#8b93a7;max-width:300px;line-height:1.55">Try after some time. We will be back shortly.</div>' +
      '<style>@keyframes ppPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.08);opacity:.85}}</style>';
    document.body.appendChild(overlay);
  }

  function hideDead() {
    if (overlay) {
      try { overlay.remove(); } catch (_) {}
      overlay = null;
    }
  }

  async function check() {
    try {
      var res = await fetch(API_BASE + '/app-status', { cache: 'no-store' });
      var data = await res.json();
      if (data && data.isAlive === false) showDead();
      else hideDead();
    } catch (_) {
      /* fail open — do not brick app on network error */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { check(); });
  } else {
    check();
  }
  setInterval(check, 10000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) check();
  });
})();
