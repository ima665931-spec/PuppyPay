/* PuppyPay — Premium in-app toast (overrides basic showToast) */
(function () {
  function ensureCss() {
    if (document.getElementById('pp-toast-v2-css')) return;
    var s = document.createElement('style');
    s.id = 'pp-toast-v2-css';
    s.textContent = [
      '#ppToast.pp-toast{position:fixed;left:50%;bottom:108px;transform:translateX(-50%) translateY(24px) scale(.96);',
      'z-index:99999;opacity:0;pointer-events:none;transition:opacity .32s cubic-bezier(.22,1,.36,1),transform .32s cubic-bezier(.22,1,.36,1);',
      'width:min(360px,calc(100vw - 28px));}',
      '#ppToast.pp-toast.show{opacity:1;transform:translateX(-50%) translateY(0) scale(1);pointer-events:auto;}',
      '.pp-toast-inner{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:18px;',
      'background:rgba(255,255,255,.92);color:#0f172a;font-size:13.5px;font-weight:600;line-height:1.35;',
      'box-shadow:0 10px 40px rgba(15,23,42,.14),0 2px 8px rgba(15,23,42,.06),inset 0 1px 0 rgba(255,255,255,.9);',
      'border:1px solid rgba(148,163,184,.35);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);}',
      '.pp-toast-inner.success{background:linear-gradient(135deg,rgba(236,253,245,.97),rgba(209,250,229,.95));',
      'border-color:rgba(16,185,129,.35);color:#065f46;',
      'box-shadow:0 12px 36px rgba(16,185,129,.2),0 2px 8px rgba(15,23,42,.06);}',
      '.pp-toast-inner.error{background:linear-gradient(135deg,rgba(254,242,242,.97),rgba(254,226,226,.95));',
      'border-color:rgba(239,68,68,.35);color:#991b1b;',
      'box-shadow:0 12px 36px rgba(239,68,68,.18),0 2px 8px rgba(15,23,42,.06);}',
      '.pp-toast-inner.info,.pp-toast-inner{/* default info */}',
      '.pp-toast-icon{width:28px;height:28px;border-radius:10px;display:flex;align-items:center;justify-content:center;',
      'font-size:14px;font-weight:800;flex-shrink:0;background:rgba(15,23,42,.06);}',
      '.pp-toast-inner.success .pp-toast-icon{background:rgba(16,185,129,.18);color:#059669;}',
      '.pp-toast-inner.error .pp-toast-icon{background:rgba(239,68,68,.15);color:#dc2626;}',
      '.pp-toast-msg{flex:1;min-width:0;}',
      '@media (min-width:431px){#ppToast.pp-toast{bottom:120px;}}'
    ].join('');
    document.head.appendChild(s);
  }

  function iconFor(type) {
    if (type === 'success') return '✓';
    if (type === 'error') return '!';
    return 'i';
  }

  window.showToast = function (msg, type) {
    type = type || 'info';
    if (type !== 'success' && type !== 'error') type = 'info';
    ensureCss();
    var el = document.getElementById('ppToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ppToast';
      el.className = 'pp-toast';
      document.body.appendChild(el);
    }
    el.innerHTML =
      '<div class="pp-toast-inner ' + type + '">' +
        '<span class="pp-toast-icon">' + iconFor(type) + '</span>' +
        '<span class="pp-toast-msg">' + String(msg || '') + '</span>' +
      '</div>';
    el.className = 'pp-toast';
    void el.offsetWidth;
    el.className = 'pp-toast show';
    clearTimeout(el._timer);
    el._timer = setTimeout(function () {
      el.classList.remove('show');
    }, 3000);
  };

  ensureCss();
})();
