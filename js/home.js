/* PuppyPay home — orders, buy QR, history, withdraw */
function paintBalance(val) {
  var n = Number(val);
  if (!Number.isFinite(n)) return;
  var bal = document.getElementById('balanceAmount');
  if (!bal) return;
  var text = formatINR(n);
  if (typeof balanceHidden !== 'undefined' && balanceHidden) {
    bal.dataset.real = text;
  } else {
    bal.textContent = text;
  }
}

async function loadDashboard() {
  if (!localStorage.getItem('puppypay_token')) return;
  try {
    const { ok, data } = await walletApiCall('/dashboard', 'GET');
    if (!ok || !data || !data.success) {
      return;
    }
    window.__dashboard = data;
    const u = data.user || {};
    try {
      const c = JSON.parse(localStorage.getItem('puppypay_user') || '{}');
      if (u.balance != null) c.balance = u.balance;
      if (u.name) c.name = u.name;
      if (u.appId) c.appId = u.appId;
      if (u.referralCode) c.referralCode = u.referralCode;
      localStorage.setItem('puppypay_user', JSON.stringify(c));
    } catch (_) {}
    if (typeof populateUserUI === 'function') populateUserUI();
    if (u.balance != null) paintBalance(u.balance);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('completeOrders', data.stats?.completeOrders ?? 0);
    set('todayBuying', formatINR(data.stats?.todayBuying ?? 0));
    set('todaySold', formatINR(data.stats?.todaySold ?? 0));
    set('todayCompleted', data.stats?.todayCompleted ?? 0);
    set('totalDeposit', formatINR(data.stats?.totalDeposit ?? 0));
    set('totalWithdraw', formatINR(data.stats?.totalWithdraw ?? 0));
    set('totalReferral', formatINR(data.stats?.totalReferral ?? data.stats?.totalReferralIncome ?? 0));
  } catch (e) {}
}

async function loadReferrals() {
  try {
    const { ok, data } = await walletApiCall('/referrals', 'GET');
    if (!ok || !data?.success) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('refCount', data.totalReferrals ?? data.referredCount ?? 0);
    set('refEarnings', formatINR(data.totalEarnings ?? data.totalEarned ?? 0));
    if (data.referralCode) {
      const el = document.getElementById('myReferralCode');
      if (el) el.textContent = data.referralCode;
    }
  } catch (e) {}
}

let ordersRefreshTimer = null;
let ordersLoading = false;
let ordersLoadStartedAt = 0;
let buyingOrderId = null;
let allOrdersCache = [];
let orderFilterMin = '';
let orderFilterMax = '';
let paySheetTimer = null;
let activePayment = null;
let ordersTick = 0;

function startOrdersAutoRefresh() {
  stopOrdersAutoRefresh();
  ordersTick = 0;
  loadOrders(false, true);
  // Every 2.5s: refresh + renew so amounts change fast on All/High/Low/HOT
  ordersRefreshTimer = setInterval(function () {
    var view = document.getElementById('ordersView');
    if (view && view.classList.contains('active')) {
      ordersTick++;
      loadOrders(true, true);
    } else {
      stopOrdersAutoRefresh();
    }
  }, 2500);
}

function stopOrdersAutoRefresh() {
  if (ordersRefreshTimer) {
    clearInterval(ordersRefreshTimer);
    ordersRefreshTimer = null;
  }
}

function shortOrderId(oid) {
  var s = String(oid || '');
  return s.length <= 10 ? s : s.slice(0, 3) + '\u2026' + s.slice(-4);
}

function renderOrderCard(o, opts) {
  var oid = o.orderId || o.id || '';
  var rate = o.profitRate != null ? (o.profitRate * 100).toFixed(1) : '4.9';
  var reward = o.reward != null ? o.reward : Math.round((Number(o.amount) || 0) * 0.049 * 100) / 100;
  var topClass = opts && opts.isTop ? ' order-card-top' : '';
  return '<div class="order-card' + topClass + '" data-order-id="' + oid + '"><div class="order-card-left"><div class="order-amount">' + formatINR(o.amount) + '</div><div class="order-id-row">ID ' + shortOrderId(oid) + '</div><div class="order-profit-row"><span class="order-profit">+' + formatINR(reward) + '</span><span class="order-rate">' + rate + '%</span></div></div><button class="btn btn-primary btn-buy" data-buy="' + oid + '" ' + (buyingOrderId === oid ? 'disabled' : '') + '>' + (buyingOrderId === oid ? '...' : 'Buy') + '</button></div>';
}

function applyOrderFilter(orders) {
  var list = orders.slice();
  var min = Number(orderFilterMin);
  var max = Number(orderFilterMax);
  if (Number.isFinite(min) && min > 0) list = list.filter(function (o) { return Number(o.amount) >= min; });
  if (Number.isFinite(max) && max > 0) list = list.filter(function (o) { return Number(o.amount) <= max; });
  list.sort(function (a, b) { return (Number(a.amount) || 0) - (Number(b.amount) || 0); });
  return list;
}

function paintOrders(orders) {
  var list = document.getElementById('ordersList');
  if (!list) return;
  var filtered = applyOrderFilter(orders);
  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state"><p>No orders in this range</p></div>';
    return;
  }
  list.innerHTML = filtered.map(function (o, i) {
    return renderOrderCard(o, { isTop: i === 0 });
  }).join('');
}

async function loadOrders(silent, forceRenew) {
  if (ordersLoading && Date.now() - ordersLoadStartedAt > 8000) {
    ordersLoading = false;
  }
  if (ordersLoading) return;
  ordersLoading = true;
  ordersLoadStartedAt = Date.now();
  var list = document.getElementById('ordersList');
  if (!silent && list && !list.querySelector('.order-card')) {
    list.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto 12px"></div><p>Loading orders...</p></div>';
  }
  try {
    var q = [];
    if (forceRenew) q.push('renew=1');
    if (orderFilterMin) q.push('min=' + encodeURIComponent(orderFilterMin));
    if (orderFilterMax) q.push('max=' + encodeURIComponent(orderFilterMax));
    var qs = q.length ? ('?' + q.join('&')) : '';
    var result = await walletApiCall('/orders' + qs, 'GET');
    var ok = result.ok;
    var data = result.data;
    if (!ok || !data || !data.success) {
      if (!silent && list && !allOrdersCache.length) {
        list.innerHTML = '<div class="empty-state"><p>No orders right now</p></div>';
      }
      return;
    }
    allOrdersCache = data.orders || [];
    paintOrders(allOrdersCache);
  } catch (e) {
    if (!silent && list && !allOrdersCache.length) {
      list.innerHTML = '<div class="empty-state"><p>Could not load orders</p></div>';
    }
  } finally {
    ordersLoading = false;
  }
}

window.loadOrders = loadOrders;
window.startOrdersAutoRefresh = startOrdersAutoRefresh;
window.stopOrdersAutoRefresh = stopOrdersAutoRefresh;
window.paintOrders = paintOrders;
window.loadDashboard = loadDashboard;

(function bindOrderFilters() {
  var minIn = document.getElementById('orderFilterMin');
  var maxIn = document.getElementById('orderFilterMax');
  if (!minIn) return;
  var apply = function () {
    orderFilterMin = minIn.value.trim();
    orderFilterMax = (maxIn && maxIn.value.trim()) || '';
    if (allOrdersCache.length) paintOrders(allOrdersCache);
    else loadOrders(false, true);
  };
  document.getElementById('orderFilterBtn')?.addEventListener('click', apply);
  document.getElementById('orderFilterApply')?.addEventListener('click', apply);
  document.getElementById('orderFilterClear')?.addEventListener('click', function () {
    minIn.value = '';
    if (maxIn) maxIn.value = '';
    orderFilterMin = '';
    orderFilterMax = '';
    loadOrders(false, true);
  });
})();

async function loadHistory() {
  var list = document.getElementById('historyList');
  if (!list) return;
  list.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto 12px"></div></div>';
  try {
    var result = await walletApiCall('/history', 'GET');
    var ok = result.ok;
    var data = result.data;
    if (!ok || !data || !data.success) {
      list.innerHTML = '<div class="empty-state"><p>' + ((data && data.message) || 'No transactions yet') + '</p></div>';
      return;
    }
    var deps = (data.history || data.deposits || []).map(function (h) {
      return Object.assign({}, h, { _kind: 'deposit' });
    });
    var wds = (data.withdrawals || []).map(function (h) {
      return Object.assign({}, h, { _kind: 'withdraw' });
    });
    var items = deps.concat(wds).sort(function (a, b) {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><p>No transactions yet</p></div>';
      return;
    }
    list.innerHTML = items.map(function (h) {
      var status = String(h.status || '').toLowerCase();
      var isDeposit = h._kind === 'deposit' || h.isReferral || (!h.destination && (h.utr || h.orderId));
      var title = isDeposit
        ? (h.isBonus ? 'Bonus · Daily' : h.isReferral ? 'Referral · ' + (h.utr || 'Bonus') : 'Deposit · ' + (h.orderId || 'Order'))
        : ('Withdraw · ' + (h.destination || 'UPI'));
      var statusLabel = (status === 'accepted' || status === 'completed' || status === 'success' || status === 'done')
        ? 'Completed'
        : (status === 'rejected' || status === 'failed' || status === 'cancelled')
          ? 'Failed'
          : 'Processing';
      var statusCls = statusLabel === 'Completed' ? 'ok' : statusLabel === 'Failed' ? 'bad' : 'wait';
      var amt = formatINR(h.amount || h.total || 0);
      return '<div class="history-card ' + (isDeposit ? 'dep' : 'wd') + '"><div class="history-card-top"><div class="history-card-title">' + title + '</div><div class="history-card-amt ' + (isDeposit ? 'plus' : 'minus') + '">' + (isDeposit ? '+' : '-') + amt + '</div></div><div class="history-card-meta"><span class="history-status ' + statusCls + '">' + statusLabel + '</span>' + (h.utr && !h.isReferral ? '<span class="history-utr">UTR ' + h.utr + '</span>' : '') + '<span class="history-time">' + (h.createdAt ? new Date(h.createdAt).toLocaleString('en-IN') : '') + '</span></div></div>';
    }).join('');
  } catch (e) {
    list.innerHTML = '<div class="empty-state"><p>Could not load history. Pull to refresh.</p></div>';
  }
}
window.loadHistory = loadHistory;

function closePaySheet() {
  var overlay = document.getElementById('paySheetOverlay');
  if (overlay) overlay.remove();
  var sheet = document.getElementById('paySheet');
  if (sheet) sheet.classList.remove('show');
  if (paySheetTimer) { clearInterval(paySheetTimer); paySheetTimer = null; }
  activePayment = null;
}
window.closePaySheet = closePaySheet;

function showPaymentSheet(payment) {
  activePayment = payment;
  closePaySheet();
  var orderId = payment.orderId;
  var amount = payment.amount;
  var upiId = payment.upiId || '';
  var qrUrl = payment.qrImageUrl || '';
  var expiresAt = payment.expiresAt ? new Date(payment.expiresAt).getTime() : Date.now() + 600000;
  var overlay = document.createElement('div');
  overlay.className = 'pay-sheet-overlay';
  overlay.id = 'paySheetOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:flex-end;justify-content:center;background:rgba(15,23,42,.55)';
  overlay.innerHTML = '<div class="pay-sheet" id="paySheetInner"><div id="payStep1"><h3>Pay exact amount</h3><div class="pay-sub">Order ' + shortOrderId(orderId) + ' · valid 10 minutes</div><div class="pay-amount">' + formatINR(amount) + '</div><div class="pay-timer" id="payTimer">10:00 left</div><div class="pay-qr-wrap"><img src="' + qrUrl + '" alt="UPI QR" width="220" height="220"></div><div class="pay-note">Scan QR and pay the exact amount shown above</div><div class="pay-actions"><button type="button" class="btn btn-primary btn-block" id="payCompletedBtn">I have completed the order</button><button type="button" class="btn btn-ghost btn-block" id="payCloseBtn">Close</button></div></div><div id="payStep2" class="pay-step2" style="display:none"><h3>Submit proof</h3><div class="pay-sub">Order ' + shortOrderId(orderId) + ' · ' + formatINR(amount) + '</div><div class="field"><label>12-digit UTR (mandatory)</label><input type="tel" id="payUtrInput" maxlength="12" inputmode="numeric" placeholder="123456789012" autocomplete="off"></div><div class="field"><label>Transaction screenshot (mandatory)</label><div class="pay-upload" id="payUploadBox"><input type="file" id="payProofInput" accept="image/*"><strong>Tap to upload screenshot</strong><span>JPG / PNG</span><img class="pay-preview" id="payProofPreview" alt=""></div></div><div class="pay-actions"><button type="button" class="btn btn-primary btn-block btn-submit-pay" id="paySubmitBtn" disabled>Submit payment</button><button type="button" class="btn btn-ghost btn-block" id="payBackBtn">Back to QR</button></div></div></div>';
  (document.body || document.documentElement).appendChild(overlay);
  var tick = function () {
    var left = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    var m = String(Math.floor(left / 60)).padStart(2, '0');
    var s = String(left % 60).padStart(2, '0');
    var el = document.getElementById('payTimer');
    if (el) el.textContent = left > 0 ? (m + ':' + s + ' left') : 'Expired';
    if (left <= 0 && paySheetTimer) clearInterval(paySheetTimer);
  };
  tick();
  paySheetTimer = setInterval(tick, 1000);
  var proofDataUrl = '';
  var updateSubmit = function () {
    var utr = (document.getElementById('payUtrInput') && document.getElementById('payUtrInput').value || '').replace(/\D/g, '');
    var btn = document.getElementById('paySubmitBtn');
    if (btn) btn.disabled = !(utr.length === 12 && proofDataUrl);
  };
  document.getElementById('payCloseBtn')?.addEventListener('click', closePaySheet);
  document.getElementById('payCompletedBtn')?.addEventListener('click', function () {
    document.getElementById('payStep1').style.display = 'none';
    document.getElementById('payStep2').style.display = 'block';
  });
  document.getElementById('payBackBtn')?.addEventListener('click', function () {
    document.getElementById('payStep2').style.display = 'none';
    document.getElementById('payStep1').style.display = 'block';
  });
  document.getElementById('payUtrInput')?.addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 12);
    updateSubmit();
  });
  document.getElementById('payProofInput')?.addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) { showToast('Image max 1.5MB', 'error'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      proofDataUrl = String(reader.result || '');
      var img = document.getElementById('payProofPreview');
      if (img) { img.src = proofDataUrl; img.style.display = 'block'; }
      updateSubmit();
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('paySubmitBtn')?.addEventListener('click', async function () {
    var utr = (document.getElementById('payUtrInput') && document.getElementById('payUtrInput').value || '').replace(/\D/g, '');
    if (utr.length !== 12 || !proofDataUrl) { showToast('UTR (12 digit) + screenshot required', 'error'); return; }
    var btn = document.getElementById('paySubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Submitting...';
    try {
      var result = await walletApiCall('/deposit', 'POST', {
        orderId: orderId,
        utr: utr,
        proofImage: proofDataUrl,
        qrLabel: payment.label || payment.upiId || null,
        upiId: payment.upiId || null
      });
      if (result.ok && result.data && result.data.success) {
        showToast('Payment submitted — verifying automatically', 'success');
        closePaySheet();
        loadDashboard();
      } else {
        showToast((result.data && result.data.message) || 'Submit failed', 'error');
        btn.disabled = false;
        btn.textContent = 'Submit payment';
      }
    } catch (err) {
      showToast('Network error', 'error');
      btn.disabled = false;
      btn.textContent = 'Submit payment';
    }
  });
}
window.showPaymentSheet = showPaymentSheet;

async function buyOrder(orderId) {
  if (!orderId || buyingOrderId) return;
  buyingOrderId = orderId;
  var btn = document.querySelector('[data-buy="' + orderId + '"]');
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  showToast('Buying order...');
  try {
    var result = await walletApiCall('/orders/' + encodeURIComponent(orderId) + '/claim', 'POST');
    var ok = result.ok;
    var data = result.data;
    if (ok && data && data.success) {
      document.querySelectorAll('.order-card[data-order-id="' + orderId + '"]').forEach(function (el) { el.remove(); });
      var ord = data.order || {};
      var pay = data.payment || {};
      var amount = pay.amount != null ? pay.amount : ord.amount;
      var upiId = pay.upiId || ord.upiId || '';
      var expiresAt = pay.expiresAt || ord.expiresAt || null;
      var paymentUri = pay.paymentUri || (upiId ? ('upi://pay?pa=' + encodeURIComponent(upiId) + '&pn=PuppyPay&am=' + Number(amount || 0).toFixed(2) + '&cu=INR&tn=' + encodeURIComponent(orderId)) : '');
      var qrImageUrl = pay.qrImageUrl || (paymentUri ? ('https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=' + encodeURIComponent(paymentUri)) : '');
      if (amount == null || amount === '') showToast('Order secured but amount missing. Try another order.', 'error');
      else if (!upiId) showToast('Payment methods temporarily unavailable. Please try again shortly.', 'error');
      else {
        showPaymentSheet({
          orderId: pay.orderId || ord.orderId || orderId,
          amount: amount,
          upiId: upiId,
          label: pay.label || ord.qrLabel || upiId,
          paymentUri: paymentUri,
          qrImageUrl: qrImageUrl,
          expiresAt: expiresAt,
          validMinutes: pay.validMinutes || 10
        });
        showToast('Pay exact amount — 10 min', 'success');
      }
      loadDashboard();
      setTimeout(function () { loadOrders(true, true); }, 400);
    } else {
      var code = (data && data.code) || '';
      if (code === 'ORDER_MISSED' || code === 'ORDER_UNAVAILABLE') {
        showToast((data && data.message) || 'Order missed! Try another.', 'error');
        document.querySelectorAll('.order-card[data-order-id="' + orderId + '"]').forEach(function (el) { el.remove(); });
      } else if (code === 'NO_UPI_POOL') {
        showToast('Payment methods temporarily unavailable. Please try again shortly.', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Buy'; }
      } else {
        showToast((data && data.message) || 'Failed to buy', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Buy'; }
      }
      setTimeout(function () { loadOrders(true, true); }, 600);
    }
  } catch (e) {
    showToast('Network error', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Buy'; }
  } finally {
    buyingOrderId = null;
  }
}
window.buyOrder = buyOrder;
window.claimOrder = buyOrder;

document.getElementById('ordersList')?.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-buy]');
  if (btn) buyOrder(btn.getAttribute('data-buy'));
});
document.getElementById('rechargeBtn')?.addEventListener('click', function () { showView('orders'); });
document.getElementById('sellBtn')?.addEventListener('click', function () { showView('withdraw'); });

(function paintBalanceFromStorage() {
  try {
    var u = JSON.parse(localStorage.getItem('puppypay_user') || '{}');
    if (u && u.balance != null) paintBalance(u.balance);
  } catch (_) {}
})();
