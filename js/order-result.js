/* PuppyPay — show completed / failed review when admin acts */
(function () {
  var SEEN_KEY = 'puppypay_result_seen';
  var POLL_MS = 8000;

  function getSeen() {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch (_) { return {}; }
  }
  function markSeen(id) {
    try {
      var s = getSeen();
      s[id] = Date.now();
      var keys = Object.keys(s);
      if (keys.length > 80) {
        keys.sort(function (a, b) { return s[a] - s[b]; })
          .slice(0, keys.length - 50)
          .forEach(function (k) { delete s[k]; });
      }
      localStorage.setItem(SEEN_KEY, JSON.stringify(s));
    } catch (_) {}
  }

  function formatINR(n) {
    if (typeof window.formatINR === 'function') return window.formatINR(n);
    var x = Number(n) || 0;
    return '₹' + x.toLocaleString('en-IN');
  }

  function ensureStyles() {
    if (document.getElementById('pp-result-styles')) return;
    var s = document.createElement('style');
    s.id = 'pp-result-styles';
    s.textContent = [
      '.pp-result-ov{position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.55);',
      'display:flex;align-items:center;justify-content:center;padding:20px;',
      'animation:ppResIn .25s ease;}',
      '@keyframes ppResIn{from{opacity:0}to{opacity:1}}',
      '.pp-result-card{width:min(340px,100%);background:#fff;border-radius:20px;padding:28px 22px 22px;',
      'text-align:center;box-shadow:0 20px 50px rgba(15,23,42,.2);',
      'animation:ppResUp .3s cubic-bezier(.22,1,.36,1);}',
      '@keyframes ppResUp{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}',
      '.pp-result-icon{width:72px;height:72px;border-radius:50%;margin:0 auto 16px;',
      'display:flex;align-items:center;justify-content:center;}',
      '.pp-result-icon.ok{background:#dcfce7;color:#16a34a;}',
      '.pp-result-icon.bad{background:#fee2e2;color:#dc2626;}',
      '.pp-result-icon svg{width:36px;height:36px;}',
      '.pp-result-title{font-size:20px;font-weight:800;color:#0f172a;margin:0 0 6px;letter-spacing:-.02em;}',
      '.pp-result-sub{font-size:13px;color:#64748b;margin:0 0 16px;line-height:1.45;}',
      '.pp-result-amt{font-size:28px;font-weight:800;color:#0f172a;margin:0 0 6px;letter-spacing:-.03em;}',
      '.pp-result-meta{font-size:12px;color:#94a3b8;margin:0 0 20px;}',
      '.pp-result-btn{width:100%;border:none;border-radius:14px;padding:14px;font-size:15px;',
      'font-weight:800;cursor:pointer;font-family:inherit;background:#2563eb;color:#fff;}',
      '.pp-result-btn:active{transform:scale(.98);}'
    ].join('');
    document.head.appendChild(s);
  }

  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  var CROSS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';

  function showResult(item) {
    ensureStyles();
    if (document.getElementById('ppResultOverlay')) return;

    var isOk = item.ok;
    var kind = item.kind; /* deposit | withdraw */
    var title, sub;
    if (kind === 'deposit') {
      title = isOk ? 'Order Completed' : 'Order Failed';
      sub = isOk
        ? 'Your deposit has been approved. Amount credited to wallet.'
        : (item.note ? item.note : 'Your deposit was rejected by admin.');
    } else {
      title = isOk ? 'Withdrawal Completed' : 'Withdrawal Failed';
      sub = isOk
        ? 'Your sell request has been approved.'
        : (item.note ? item.note : 'Your withdrawal was rejected. Amount refunded to wallet.');
    }

    var ov = document.createElement('div');
    ov.id = 'ppResultOverlay';
    ov.className = 'pp-result-ov';
    ov.innerHTML =
      '<div class="pp-result-card">' +
        '<div class="pp-result-icon ' + (isOk ? 'ok' : 'bad') + '">' + (isOk ? CHECK : CROSS) + '</div>' +
        '<h2 class="pp-result-title">' + title + '</h2>' +
        '<p class="pp-result-sub">' + sub + '</p>' +
        '<div class="pp-result-amt">' + formatINR(item.amount) + '</div>' +
        (item.orderId ? '<div class="pp-result-meta">ID: ' + item.orderId + '</div>' : '<div class="pp-result-meta"></div>') +
        '<button type="button" class="pp-result-btn" id="ppResultOkBtn">OK</button>' +
      '</div>';
    document.body.appendChild(ov);

    function close() {
      markSeen(item.id);
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      if (typeof loadDashboard === 'function') {
        try { loadDashboard(); } catch (_) {}
      }
      /* show next pending if any */
      setTimeout(checkResults, 400);
    }
    document.getElementById('ppResultOkBtn').addEventListener('click', close);
  }

  function itemId(kind, row) {
    return kind + ':' + String(row._id || row.orderId || '');
  }

  function pickNew(rows, kind) {
    var seen = getSeen();
    var out = [];
    (rows || []).forEach(function (r) {
      var st = String(r.status || '').toLowerCase();
      if (st !== 'accepted' && st !== 'rejected' && st !== 'completed' && st !== 'failed') return;
      /* only after admin review — need reviewedAt or status change from pending */
      if (r.isBonus || r.isReferral || r.isReferralTransfer) return;
      var id = itemId(kind, r);
      if (!id || id.endsWith(':') || seen[id]) return;
      var ok = st === 'accepted' || st === 'completed';
      var amt = kind === 'deposit' ? (r.total || r.amount || 0) : (r.amount || 0);
      out.push({
        id: id,
        kind: kind,
        ok: ok,
        amount: amt,
        orderId: r.orderId || '',
        note: r.adminNote || r.note || '',
        at: new Date(r.reviewedAt || r.updatedAt || r.createdAt || 0).getTime()
      });
    });
    out.sort(function (a, b) { return b.at - a.at; });
    return out;
  }

  async function checkResults() {
    if (!localStorage.getItem('puppypay_token')) return;
    if (document.getElementById('ppResultOverlay')) return;
    if (typeof walletApiCall !== 'function') return;
    try {
      var res = await walletApiCall('/history', 'GET');
      if (!res.ok || !res.data || !res.data.success) return;
      var deps = pickNew(res.data.deposits || res.data.history || [], 'deposit');
      var wds = pickNew(res.data.withdrawals || [], 'withdraw');
      var all = deps.concat(wds).sort(function (a, b) { return b.at - a.at; });
      if (all.length) showResult(all[0]);
    } catch (_) {}
  }

  /* First open: mark all currently reviewed as seen so old history doesn't spam */
  async function seedSeen() {
    if (!localStorage.getItem('puppypay_token')) return;
    if (localStorage.getItem('puppypay_result_seeded') === '1') return;
    if (typeof walletApiCall !== 'function') return;
    try {
      var res = await walletApiCall('/history', 'GET');
      if (!res.ok || !res.data || !res.data.success) return;
      var seen = getSeen();
      function seed(rows, kind) {
        (rows || []).forEach(function (r) {
          var st = String(r.status || '').toLowerCase();
          if (st === 'accepted' || st === 'rejected' || st === 'completed' || st === 'failed') {
            if (r.isBonus || r.isReferral) return;
            seen[itemId(kind, r)] = Date.now();
          }
        });
      }
      seed(res.data.deposits || res.data.history || [], 'deposit');
      seed(res.data.withdrawals || [], 'withdraw');
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
      localStorage.setItem('puppypay_result_seeded', '1');
    } catch (_) {}
  }

  function boot() {
    seedSeen().then(function () {
      checkResults();
    });
    setInterval(checkResults, POLL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 1200); });
  } else {
    setTimeout(boot, 1200);
  }

  window.ppCheckOrderResults = checkResults;
})();
