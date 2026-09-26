/* PuppyPay — Order Completed / Failed review screens (after admin action) */
(function () {
  var SEEN_KEY = 'puppypay_result_seen_v2';
  var POLL_MS = 4000;
  var MAX_AGE_MS = 72 * 60 * 60 * 1000; /* only last 72h reviews */

  function getSeen() {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch (_) { return {}; }
  }
  function markSeen(id) {
    try {
      var s = getSeen();
      s[id] = Date.now();
      var keys = Object.keys(s);
      if (keys.length > 100) {
        keys.sort(function (a, b) { return s[a] - s[b]; })
          .slice(0, keys.length - 60)
          .forEach(function (k) { delete s[k]; });
      }
      localStorage.setItem(SEEN_KEY, JSON.stringify(s));
    } catch (_) {}
  }

  function formatINR(n) {
    if (typeof window.formatINR === 'function') return window.formatINR(n);
    return '₹' + (Number(n) || 0).toLocaleString('en-IN');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"');
  }

  function ensureStyles() {
    var old = document.getElementById('pp-result-styles');
    if (old) old.remove();
    var s = document.createElement('style');
    s.id = 'pp-result-styles';
    s.textContent = [
      '.pp-result-ov{position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.6);',
      'display:flex;align-items:center;justify-content:center;padding:20px;animation:ppResIn .22s ease;}',
      '@keyframes ppResIn{from{opacity:0}to{opacity:1}}',
      '.pp-result-card{width:min(360px,100%);background:#fff;border-radius:22px;padding:28px 22px 20px;',
      'text-align:center;box-shadow:0 24px 60px rgba(15,23,42,.25);animation:ppResUp .28s cubic-bezier(.22,1,.36,1);}',
      '@keyframes ppResUp{from{transform:translateY(28px) scale(.96);opacity:0}to{transform:none;opacity:1}}',
      '.pp-result-icon{width:80px;height:80px;border-radius:50%;margin:0 auto 14px;',
      'display:flex;align-items:center;justify-content:center;}',
      '.pp-result-icon.ok{background:#dcfce7;color:#16a34a;box-shadow:0 8px 24px rgba(22,163,74,.25);}',
      '.pp-result-icon.bad{background:#fee2e2;color:#dc2626;box-shadow:0 8px 24px rgba(220,38,38,.22);}',
      '.pp-result-icon svg{width:40px;height:40px;}',
      '.pp-result-title{font-size:22px;font-weight:800;color:#0f172a;margin:0 0 6px;letter-spacing:-.02em;}',
      '.pp-result-sub{font-size:13px;color:#64748b;margin:0 0 18px;line-height:1.45;}',
      '.pp-result-amt{font-size:30px;font-weight:800;color:#0f172a;margin:0 0 14px;letter-spacing:-.03em;}',
      '.pp-result-details{text-align:left;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;',
      'padding:12px 14px;margin:0 0 18px;}',
      '.pp-result-row{display:flex;justify-content:space-between;gap:10px;padding:6px 0;',
      'font-size:12.5px;border-bottom:1px solid #f1f5f9;}',
      '.pp-result-row:last-child{border-bottom:none;}',
      '.pp-result-row .k{color:#94a3b8;font-weight:600;}',
      '.pp-result-row .v{color:#0f172a;font-weight:700;text-align:right;word-break:break-all;}',
      '.pp-result-btn{width:100%;border:none;border-radius:14px;padding:14px;font-size:15px;',
      'font-weight:800;cursor:pointer;font-family:inherit;color:#fff;}',
      '.pp-result-btn.ok{background:#16a34a;}',
      '.pp-result-btn.bad{background:#dc2626;}',
      '.pp-result-btn:active{transform:scale(.98);}'
    ].join('');
    document.head.appendChild(s);
  }

  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  var CROSS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';

  function detailRow(k, v) {
    if (v == null || v === '') return '';
    return '<div class="pp-result-row"><span class="k">' + esc(k) + '</span><span class="v">' + esc(v) + '</span></div>';
  }

  function showResult(item) {
    ensureStyles();
    if (document.getElementById('ppResultOverlay')) return;

    var isOk = item.ok;
    var title, sub;
    if (item.kind === 'deposit') {
      title = isOk ? 'Order Completed' : 'Order Failed';
      sub = isOk
        ? 'Admin approved your order. Amount credited to wallet.'
        : (item.note || 'Admin rejected your order.');
    } else {
      title = isOk ? 'Withdrawal Completed' : 'Withdrawal Failed';
      sub = isOk
        ? 'Admin approved your withdrawal.'
        : (item.note || 'Admin rejected your withdrawal. Amount refunded.');
    }

    var details = '';
    details += detailRow('Type', item.kind === 'deposit' ? 'Deposit / Order' : 'Withdrawal');
    details += detailRow('Status', isOk ? 'Completed' : 'Failed');
    details += detailRow('Amount', formatINR(item.amount));
    if (item.reward) details += detailRow('Reward', formatINR(item.reward));
    if (item.total && item.total !== item.amount) details += detailRow('Total credited', formatINR(item.total));
    if (item.orderId) details += detailRow('Order ID', item.orderId);
    if (item.utr) details += detailRow('UTR', item.utr);
    if (item.upi) details += detailRow('UPI', item.upi);
    if (item.destination) details += detailRow('To UPI', item.destination);
    if (item.timeStr) details += detailRow('Time', item.timeStr);
    if (item.note) details += detailRow('Note', item.note);

    var ov = document.createElement('div');
    ov.id = 'ppResultOverlay';
    ov.className = 'pp-result-ov';
    ov.innerHTML =
      '<div class="pp-result-card" role="dialog" aria-modal="true">' +
        '<div class="pp-result-icon ' + (isOk ? 'ok' : 'bad') + '">' + (isOk ? CHECK : CROSS) + '</div>' +
        '<h2 class="pp-result-title">' + esc(title) + '</h2>' +
        '<p class="pp-result-sub">' + esc(sub) + '</p>' +
        '<div class="pp-result-amt">' + formatINR(item.amount) + '</div>' +
        (details ? '<div class="pp-result-details">' + details + '</div>' : '') +
        '<button type="button" class="pp-result-btn ' + (isOk ? 'ok' : 'bad') + '" id="ppResultOkBtn">OK</button>' +
      '</div>';
    document.body.appendChild(ov);

    function close() {
      markSeen(item.id);
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      try { if (typeof loadDashboard === 'function') loadDashboard(); } catch (_) {}
      setTimeout(checkResults, 300);
    }
    document.getElementById('ppResultOkBtn').addEventListener('click', close);
  }

  function itemId(kind, row) {
    var raw = row._id != null ? row._id : row.orderId;
    if (raw && typeof raw === 'object' && raw.$oid) raw = raw.$oid;
    return kind + ':' + String(raw || '');
  }

  function reviewTime(row) {
    var t = row.reviewedAt || row.updatedAt || row.createdAt;
    var ms = new Date(t || 0).getTime();
    return isNaN(ms) ? 0 : ms;
  }

  function pickNew(rows, kind) {
    var seen = getSeen();
    var now = Date.now();
    var out = [];
    (rows || []).forEach(function (r) {
      if (!r || r.isBonus || r.isReferral || r.isReferralTransfer) return;
      var st = String(r.status || '').toLowerCase();
      if (st !== 'accepted' && st !== 'rejected' && st !== 'completed' && st !== 'failed' && st !== 'success') return;

      var id = itemId(kind, r);
      if (!id || id === kind + ':' || seen[id]) return;

      var at = reviewTime(r);
      /* skip very old reviews so history doesn't spam */
      if (at && now - at > MAX_AGE_MS) return;

      var ok = st === 'accepted' || st === 'completed' || st === 'success';
      var amt = kind === 'deposit' ? (r.total || r.amount || 0) : (r.amount || 0);
      var timeStr = '';
      try {
        if (at) timeStr = new Date(at).toLocaleString('en-IN');
      } catch (_) {}

      out.push({
        id: id,
        kind: kind,
        ok: ok,
        amount: amt,
        reward: r.reward || 0,
        total: r.total || amt,
        orderId: r.orderId || '',
        utr: r.utr || '',
        upi: r.upiId || '',
        destination: r.destination || '',
        note: r.adminNote || r.note || '',
        timeStr: timeStr,
        at: at || now
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
      if (!res || !res.ok || !res.data || !res.data.success) return;
      var deps = pickNew(res.data.deposits || res.data.history || [], 'deposit');
      var wds = pickNew(res.data.withdrawals || [], 'withdraw');
      var all = deps.concat(wds).sort(function (a, b) { return b.at - a.at; });
      if (all.length) showResult(all[0]);
    } catch (e) {
      try { console.warn('ppCheckOrderResults', e); } catch (_) {}
    }
  }

  function boot() {
    /* clear old v1 seed that blocked popups */
    try { localStorage.removeItem('puppypay_result_seeded'); } catch (_) {}
    checkResults();
    setInterval(checkResults, POLL_MS);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') checkResults();
    });
    window.addEventListener('focus', function () { checkResults(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 800); });
  } else {
    setTimeout(boot, 800);
  }

  window.ppCheckOrderResults = checkResults;
})();
