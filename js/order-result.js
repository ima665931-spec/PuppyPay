/* PuppyPay — reliable Order Completed / Failed screens after admin action */
(function () {
  var SEEN_KEY = 'puppypay_result_seen_v3';
  var WATCH_KEY = 'puppypay_result_watch';
  var POLL_MS = 3000;

  function api() {
    return window.__puppypayWalletApiCall || window.walletApiCall || null;
  }

  function getSeen() {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch (_) { return {}; }
  }
  function markSeen(id) {
    try {
      var s = getSeen();
      s[id] = Date.now();
      localStorage.setItem(SEEN_KEY, JSON.stringify(s));
    } catch (_) {}
  }
  function isSeen(id) {
    return !!getSeen()[id];
  }

  function getWatch() {
    try { return JSON.parse(localStorage.getItem(WATCH_KEY) || '{}'); } catch (_) { return {}; }
  }
  function addWatch(kind, orderId, meta) {
    if (!orderId) return;
    try {
      var w = getWatch();
      w[kind + ':' + orderId] = Object.assign({ kind: kind, orderId: String(orderId), at: Date.now() }, meta || {});
      localStorage.setItem(WATCH_KEY, JSON.stringify(w));
    } catch (_) {}
  }
  function removeWatch(key) {
    try {
      var w = getWatch();
      delete w[key];
      localStorage.setItem(WATCH_KEY, JSON.stringify(w));
    } catch (_) {}
  }

  function formatINR(n) {
    if (typeof window.formatINR === 'function') return window.formatINR(n);
    return '₹' + (Number(n) || 0).toLocaleString('en-IN');
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
  }

  function ensureStyles() {
    if (document.getElementById('pp-result-styles')) return;
    var s = document.createElement('style');
    s.id = 'pp-result-styles';
    s.textContent = [
      '.pp-result-ov{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.65);',
      'display:flex;align-items:center;justify-content:center;padding:20px;}',
      '.pp-result-card{width:min(360px,100%);background:#fff;border-radius:22px;padding:28px 22px 20px;',
      'text-align:center;box-shadow:0 24px 60px rgba(15,23,42,.3);}',
      '.pp-result-icon{width:84px;height:84px;border-radius:50%;margin:0 auto 16px;',
      'display:flex;align-items:center;justify-content:center;}',
      '.pp-result-icon.ok{background:#dcfce7;color:#16a34a;}',
      '.pp-result-icon.bad{background:#fee2e2;color:#dc2626;}',
      '.pp-result-icon svg{width:42px;height:42px;}',
      '.pp-result-title{font-size:22px;font-weight:800;color:#0f172a;margin:0 0 6px;}',
      '.pp-result-sub{font-size:13px;color:#64748b;margin:0 0 16px;line-height:1.45;}',
      '.pp-result-amt{font-size:30px;font-weight:800;color:#0f172a;margin:0 0 14px;}',
      '.pp-result-details{text-align:left;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;margin:0 0 18px;}',
      '.pp-result-row{display:flex;justify-content:space-between;gap:10px;padding:7px 0;font-size:12.5px;border-bottom:1px solid #f1f5f9;}',
      '.pp-result-row:last-child{border-bottom:none;}',
      '.pp-result-row .k{color:#94a3b8;font-weight:600;flex-shrink:0;}',
      '.pp-result-row .v{color:#0f172a;font-weight:700;text-align:right;word-break:break-all;}',
      '.pp-result-btn{width:100%;border:none;border-radius:14px;padding:14px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;color:#fff;}',
      '.pp-result-btn.ok{background:#16a34a;}',
      '.pp-result-btn.bad{background:#dc2626;}'
    ].join('');
    document.head.appendChild(s);
  }

  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  var CROSS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';

  function row(k, v) {
    if (v == null || v === '') return '';
    return '<div class="pp-result-row"><span class="k">' + esc(k) + '</span><span class="v">' + esc(v) + '</span></div>';
  }

  function showResult(item) {
    ensureStyles();
    if (document.getElementById('ppResultOverlay')) return;
    if (isSeen(item.id)) return;

    var isOk = !!item.ok;
    var title, sub;
    if (item.kind === 'deposit') {
      title = isOk ? 'Order Completed' : 'Order Failed';
      sub = isOk ? 'Admin approved your order. Amount credited to wallet.' : (item.note || 'Admin rejected your order.');
    } else {
      title = isOk ? 'Withdrawal Completed' : 'Withdrawal Failed';
      sub = isOk ? 'Admin approved your withdrawal.' : (item.note || 'Admin rejected your withdrawal. Amount refunded.');
    }

    var details = '';
    details += row('Type', item.kind === 'deposit' ? 'Deposit / Order' : 'Withdrawal');
    details += row('Status', isOk ? 'Completed ✓' : 'Failed ✕');
    details += row('Amount', formatINR(item.amount));
    if (item.reward) details += row('Reward', '+' + formatINR(item.reward));
    if (item.total && Number(item.total) !== Number(item.amount)) details += row('Total', formatINR(item.total));
    if (item.orderId) details += row('Order ID', item.orderId);
    if (item.utr) details += row('UTR', item.utr);
    /* UPI intentionally hidden from user review screen */
    if (item.timeStr) details += row('Time', item.timeStr);
    if (item.note) details += row('Note', item.note);

    var ov = document.createElement('div');
    ov.id = 'ppResultOverlay';
    ov.className = 'pp-result-ov';
    ov.innerHTML =
      '<div class="pp-result-card">' +
        '<div class="pp-result-icon ' + (isOk ? 'ok' : 'bad') + '">' + (isOk ? CHECK : CROSS) + '</div>' +
        '<h2 class="pp-result-title">' + esc(title) + '</h2>' +
        '<p class="pp-result-sub">' + esc(sub) + '</p>' +
        '<div class="pp-result-amt">' + formatINR(item.amount) + '</div>' +
        (details ? '<div class="pp-result-details">' + details + '</div>' : '') +
        '<button type="button" class="pp-result-btn ' + (isOk ? 'ok' : 'bad') + '" id="ppResultOkBtn">OK</button>' +
      '</div>';
    document.body.appendChild(ov);

    document.getElementById('ppResultOkBtn').onclick = function () {
      markSeen(item.id);
      removeWatch(item.kind + ':' + (item.orderId || ''));
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      try { if (typeof loadDashboard === 'function') loadDashboard(); } catch (_) {}
      setTimeout(checkResults, 250);
    };
  }

  function idOf(kind, r) {
    var raw = r && (r._id != null ? r._id : r.orderId);
    if (raw && typeof raw === 'object') raw = raw.$oid || raw.toString();
    return kind + ':' + String(raw || '');
  }

  function toItem(kind, r, ok) {
    var st = String(r.status || '').toLowerCase();
    var isOk = ok != null ? ok : (st === 'accepted' || st === 'completed' || st === 'success');
    var at = new Date(r.reviewedAt || r.updatedAt || r.createdAt || Date.now()).getTime();
    var timeStr = '';
    try { timeStr = new Date(at).toLocaleString('en-IN'); } catch (_) {}
    return {
      id: idOf(kind, r),
      kind: kind,
      ok: isOk,
      amount: kind === 'deposit' ? (r.total || r.amount || 0) : (r.amount || 0),
      reward: r.reward || 0,
      total: r.total || r.amount || 0,
      orderId: r.orderId || '',
      utr: r.utr || '',
      note: r.adminNote || r.note || '',
      timeStr: timeStr,
      at: at
    };
  }

  function isFinal(st) {
    st = String(st || '').toLowerCase();
    return st === 'accepted' || st === 'rejected' || st === 'completed' || st === 'failed' || st === 'success';
  }

  async function checkResults() {
    if (!localStorage.getItem('puppypay_token')) return;
    if (document.getElementById('ppResultOverlay')) return;
    var fn = api();
    if (!fn) return;

    try {
      var res = await fn('/history', 'GET');
      if (!res || !res.ok || !res.data || !res.data.success) return;

      var deposits = res.data.deposits || res.data.history || [];
      var withdrawals = res.data.withdrawals || [];
      var watch = getWatch();
      var candidates = [];

      Object.keys(watch).forEach(function (key) {
        var meta = watch[key];
        if (!meta || !meta.orderId) return;
        var list = meta.kind === 'withdraw' ? withdrawals : deposits;
        for (var i = 0; i < list.length; i++) {
          var r = list[i];
          if (String(r.orderId) !== String(meta.orderId)) continue;
          if (r.isBonus || r.isReferral) continue;
          if (!isFinal(r.status)) return;
          var item = toItem(meta.kind, r);
          if (!isSeen(item.id)) candidates.push(item);
          return;
        }
      });

      deposits.forEach(function (r) {
        if (r.isBonus || r.isReferral) return;
        var st = String(r.status || '').toLowerCase();
        if (st === 'pending' || st === 'processing') {
          addWatch('deposit', r.orderId, { amount: r.total || r.amount });
        } else if (isFinal(st) && r.orderId) {
          var it = toItem('deposit', r);
          if (!isSeen(it.id) && Date.now() - it.at < 6 * 60 * 60 * 1000) candidates.push(it);
        }
      });
      withdrawals.forEach(function (r) {
        var st = String(r.status || '').toLowerCase();
        if (st === 'pending' || st === 'processing') {
          addWatch('withdraw', r.orderId, { amount: r.amount });
        } else if (isFinal(st) && r.orderId) {
          var it2 = toItem('withdraw', r);
          if (!isSeen(it2.id) && Date.now() - it2.at < 6 * 60 * 60 * 1000) candidates.push(it2);
        }
      });

      var seenIds = {}, uniq = [];
      candidates.sort(function (a, b) { return b.at - a.at; });
      candidates.forEach(function (c) {
        if (seenIds[c.id]) return;
        seenIds[c.id] = 1;
        uniq.push(c);
      });

      if (uniq.length) showResult(uniq[0]);
    } catch (e) {
      try { console.warn('[pp-result]', e); } catch (_) {}
    }
  }

  function installIntercept() {
    var original = window.__puppypayWalletApiCall || window.walletApiCall;
    if (!original || original._ppResultWrapped) return;
    var wrapped = async function (path, method, body) {
      var res = await original(path, method, body);
      try {
        if (res && res.ok && res.data && res.data.success) {
          if (String(path).indexOf('/deposit') === 0 && method === 'POST') {
            var d = res.data.deposit || {};
            var oid = d.orderId || (body && body.orderId);
            addWatch('deposit', oid, { amount: d.total || d.amount });
          }
          if (String(path).indexOf('/withdraw') === 0 && method === 'POST') {
            var w = res.data.withdrawal || {};
            addWatch('withdraw', w.orderId, { amount: w.amount });
          }
        }
      } catch (_) {}
      return res;
    };
    wrapped._ppResultWrapped = true;
    window.__puppypayWalletApiCall = wrapped;
    window.walletApiCall = wrapped;
  }

  function boot() {
    installIntercept();
    checkResults();
    setInterval(checkResults, POLL_MS);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') checkResults();
    });
    window.addEventListener('focus', checkResults);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 600); });
  } else {
    setTimeout(boot, 600);
  }

  window.ppCheckOrderResults = checkResults;
  window.ppTestResult = function (opts) {
    showResult({
      id: 'test:' + Date.now(),
      kind: (opts && opts.kind) || 'deposit',
      ok: !(opts && opts.ok === false),
      amount: (opts && opts.amount) || 500,
      reward: (opts && opts.reward) || 25,
      total: (opts && opts.total) || 525,
      orderId: (opts && opts.orderId) || 'TEST123',
      utr: (opts && opts.utr) || '123456789012',
      note: (opts && opts.note) || '',
      timeStr: new Date().toLocaleString('en-IN'),
      at: Date.now()
    });
  };
})();
