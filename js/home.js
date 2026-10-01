/* PuppyPay home — orders, buy QR, history, withdraw */
async function loadDashboard() {
  if (!localStorage.getItem('puppypay_token')) return;
  try {
    const { ok, data } = await walletApiCall('/dashboard', 'GET');
    if (!ok || !data?.success) {
      if (data && (data.code === 'TOKEN_FAILED' || data.code === 'USER_KILLED' || data.code === 'ACCOUNT_SUSPENDED' || data.code === 'APP_DEAD')) return;
      return;
    }
    window.__dashboard = data;
    const u = data.user || {};
    try { const c = JSON.parse(localStorage.getItem('puppypay_user')||'{}'); c.balance=u.balance; c.name=u.name||c.name; c.appId=u.appId||c.appId; c.referralCode=u.referralCode||c.referralCode; localStorage.setItem('puppypay_user',JSON.stringify(c)); } catch(_){}
    if (typeof populateUserUI === 'function') populateUserUI();
    const bal=document.getElementById('balanceAmount');
    if(bal&&typeof balanceHidden!=='undefined'&&!balanceHidden) bal.textContent=formatINR(u.balance);
    else if(bal&&typeof balanceHidden!=='undefined'&&balanceHidden) bal.dataset.real=formatINR(u.balance);
    else if(bal) bal.textContent=formatINR(u.balance);
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    set('completeOrders',data.stats?.completeOrders??0);
    set('todayBuying',formatINR(data.stats?.todayBuying??0));
    set('todaySold',formatINR(data.stats?.todaySold??0));
    set('todayCompleted',data.stats?.todayCompleted??0);
    set('totalDeposit',formatINR(data.stats?.totalDeposit??0));
    set('totalWithdraw',formatINR(data.stats?.totalWithdraw??0));
    set('totalReferral',formatINR(data.stats?.totalReferral??data.stats?.totalReferralIncome??0));
  } catch(e){}
}
async function loadReferrals() {
  try {
    const { ok, data } = await walletApiCall('/referrals', 'GET');
    if (!ok || !data?.success) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('refCount', data.totalReferrals ?? data.referredCount ?? 0);
    set('refEarnings', formatINR(data.totalEarnings ?? data.totalEarned ?? 0));
    if (data.referralCode) { const el = document.getElementById('myReferralCode'); if (el) el.textContent = data.referralCode; }
  } catch (e) {}
}
let ordersRefreshTimer = null, ordersLoading = false, buyingOrderId = null, allOrdersCache = [], orderFilterMin = '', orderFilterMax = '', paySheetTimer = null, activePayment = null;
let ordersRefreshCount = 0;

function startOrdersAutoRefresh() {
  stopOrdersAutoRefresh();
  ordersRefreshCount = 0;
  loadOrders(false, true);
  // Refresh every 8s like before (smooth), renew inventory only every ~40s
  ordersRefreshTimer = setInterval(() => {
    const view = document.getElementById('ordersView');
    if (view && view.classList.contains('active')) {
      ordersRefreshCount++;
      loadOrders(true, ordersRefreshCount % 5 === 0);
    } else {
      stopOrdersAutoRefresh();
    }
  }, 8000);
}
function stopOrdersAutoRefresh() { if (ordersRefreshTimer) { clearInterval(ordersRefreshTimer); ordersRefreshTimer = null; } }
function shortOrderId(oid) { const s = String(oid || ''); return s.length <= 10 ? s : s.slice(0, 3) + '\u2026' + s.slice(-4); }
function renderOrderCard(o, opts) {
  const oid = o.orderId || o.id || '';
  const rate = o.profitRate != null ? (o.profitRate * 100).toFixed(1) : '4.9';
  const reward = o.reward != null ? o.reward : Math.round((Number(o.amount) || 0) * 0.049 * 100) / 100;
  const topClass = opts && opts.isTop ? ' order-card-top' : '';
  return '<div class="order-card' + topClass + '" data-order-id="' + oid + '"><div class="order-card-left"><div class="order-amount">' + formatINR(o.amount) + '</div><div class="order-id-row">ID ' + shortOrderId(oid) + '</div><div class="order-profit-row"><span class="order-profit">+' + formatINR(reward) + '</span><span class="order-rate">' + rate + '%</span></div></div><button class="btn btn-primary btn-buy" data-buy="' + oid + '" ' + (buyingOrderId === oid ? 'disabled' : '') + '>' + (buyingOrderId === oid ? '...' : 'Buy') + '</button></div>';
}
function applyOrderFilter(orders) {
  let list = orders.slice();
  const min = Number(orderFilterMin), max = Number(orderFilterMax);
  if (Number.isFinite(min) && min > 0) list = list.filter(o => Number(o.amount) >= min);
  if (Number.isFinite(max) && max > 0) list = list.filter(o => Number(o.amount) <= max);
  list.sort((a, b) => (Number(a.amount) || 0) - (Number(b.amount) || 0));
  return list;
}
function paintOrders(orders) {
  const list = document.getElementById('ordersList');
  if (!list) return;
  const filtered = applyOrderFilter(orders);
  if (!filtered.length) { list.innerHTML = '<div class="empty-state"><p>No orders in this range</p></div>'; return; }
  list.innerHTML = filtered.map((o, i) => renderOrderCard(o, { isTop: i === 0 })).join('');
}
async function loadOrders(silent, forceRenew) {
  if (ordersLoading) return;
  ordersLoading = true;
  const list = document.getElementById('ordersList');
  if (!silent && list && !list.querySelector('.order-card')) list.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto 12px"></div><p>Loading orders...</p></div>';
  try {
    const q = [];
    if (forceRenew) q.push('renew=1');
    if (orderFilterMin) q.push('min=' + encodeURIComponent(orderFilterMin));
    if (orderFilterMax) q.push('max=' + encodeURIComponent(orderFilterMax));
    const qs = q.length ? ('?' + q.join('&')) : '';
    const { ok, data } = await walletApiCall('/orders' + qs, 'GET');
    if (!ok || !data?.success) {
      if (!silent && list && !allOrdersCache.length) list.innerHTML = '<div class="empty-state"><p>No orders right now</p></div>';
      return;
    }
    allOrdersCache = data.orders || [];
    paintOrders(allOrdersCache);
  } catch (e) {
    if (!silent && list && !allOrdersCache.length) list.innerHTML = '<div class="empty-state"><p>Could not load orders</p></div>';
  } finally {
    ordersLoading = false;
  }
}
window.loadOrders = loadOrders;
window.startOrdersAutoRefresh = startOrdersAutoRefresh;
window.stopOrdersAutoRefresh = stopOrdersAutoRefresh;
window.paintOrders = paintOrders;

(function bindOrderFilters() {
  const minIn = document.getElementById('orderFilterMin');
  const maxIn = document.getElementById('orderFilterMax');
  if (!minIn) return;
  const apply = () => {
    orderFilterMin = minIn.value.trim();
    orderFilterMax = (maxIn && maxIn.value.trim()) || '';
    if (allOrdersCache.length) paintOrders(allOrdersCache);
    else loadOrders(false, false);
  };
  document.getElementById('orderFilterBtn')?.addEventListener('click', apply);
  document.getElementById('orderFilterApply')?.addEventListener('click', apply);
  document.getElementById('orderFilterClear')?.addEventListener('click', () => {
    minIn.value = '';
    if (maxIn) maxIn.value = '';
    orderFilterMin = '';
    orderFilterMax = '';
    loadOrders(false, false);
  });
})();

async function loadHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;
  list.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto 12px"></div></div>';
  try {
    const { ok, data } = await walletApiCall('/history', 'GET');
    if (!ok || !data?.success) { list.innerHTML = '<div class="empty-state"><p>No transactions yet</p></div>'; return; }
    const deps = (data.history || data.deposits || []).map(h => ({ ...h, _kind: 'deposit' }));
    const wds = (data.withdrawals || []).map(h => ({ ...h, _kind: 'withdraw' }));
    const items = [...deps, ...wds].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    if (!items.length) { list.innerHTML = '<div class="empty-state"><p>No transactions yet</p></div>'; return; }
    list.innerHTML = items.map(h => {
      const status = (h.status || '').toLowerCase();
      const isDeposit = h._kind === 'deposit' || h.isReferral || (!h.destination && (h.utr || h.orderId));
      const isPlus = isDeposit;
      const title = isDeposit
        ? (h.isBonus ? 'Bonus · Daily' : h.isReferral ? 'Referral · ' + (h.utr || 'Bonus') : 'Deposit · ' + (h.orderId || 'Order'))
        : ('Withdraw · ' + (h.destination || 'UPI'));
      const statusLabel = (status === 'accepted' || status === 'completed' || status === 'success' || status === 'done') ? 'Completed'
        : (status === 'rejected' || status === 'failed' || status === 'cancelled') ? 'Failed'
        : 'Processing';
      const statusCls = statusLabel === 'Completed' ? 'ok' : statusLabel === 'Failed' ? 'bad' : 'wait';
      const amt = formatINR(h.amount || h.total || 0);
      return '<div class="history-card ' + (isDeposit ? 'dep' : 'wd') + '"><div class="history-card-top"><div class="history-card-title">' + title + '</div><div class="history-card-amt ' + (isPlus ? 'plus' : 'minus') + '">' + (isPlus ? '+' : '-') + amt + '</div></div><div class="history-card-meta"><span class="history-status ' + statusCls + '">' + statusLabel + '</span>' + (h.utr && !h.isReferral ? '<span class="history-utr">UTR ' + h.utr + '</span>' : '') + '<span class="history-time">' + (h.createdAt ? new Date(h.createdAt).toLocaleString('en-IN') : '') + '</span></div></div>';
    }).join('');
  } catch (e) {
    list.innerHTML = '<div class="empty-state"><p>Could not load history. Pull to refresh.</p></div>';
  }
}
window.loadHistory = loadHistory;

function closePaySheet() {
  const overlay = document.getElementById('paySheetOverlay');
  if (overlay) overlay.remove();
  const sheet = document.getElementById('paySheet');
  if (sheet) sheet.classList.remove('show');
  if (paySheetTimer) { clearInterval(paySheetTimer); paySheetTimer = null; }
  activePayment = null;
}
window.closePaySheet = closePaySheet;

function showPaymentSheet(payment) {
  activePayment = payment;
  closePaySheet();
  const orderId = payment.orderId;
  const amount = payment.amount;
  const upiId = payment.upiId || '';
  const qrUrl = payment.qrImageUrl || '';
  const expiresAt = payment.expiresAt ? new Date(payment.expiresAt).getTime() : Date.now() + 600000;
  const overlay = document.createElement('div');
  overlay.className = 'pay-sheet-overlay';
  overlay.id = 'paySheetOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:flex-end;justify-content:center;background:rgba(15,23,42,.55)';
  overlay.innerHTML = '<div class="pay-sheet" id="paySheetInner"><div id="payStep1"><h3>Pay exact amount</h3><div class="pay-sub">Order ' + shortOrderId(orderId) + ' · valid 10 minutes</div><div class="pay-amount">' + formatINR(amount) + '</div><div class="pay-timer" id="payTimer">10:00 left</div><div class="pay-qr-wrap"><img src="' + qrUrl + '" alt="UPI QR" width="220" height="220"></div><div class="pay-note">Scan QR and pay the exact amount shown above</div><div class="pay-actions"><button type="button" class="btn btn-primary btn-block" id="payCompletedBtn">I have completed the order</button><button type="button" class="btn btn-ghost btn-block" id="payCloseBtn">Close</button></div></div><div id="payStep2" class="pay-step2" style="display:none"><h3>Submit proof</h3><div class="pay-sub">Order ' + shortOrderId(orderId) + ' · ' + formatINR(amount) + '</div><div class="field"><label>12-digit UTR (mandatory)</label><input type="tel" id="payUtrInput" maxlength="12" inputmode="numeric" placeholder="123456789012" autocomplete="off"></div><div class="field"><label>Transaction screenshot (mandatory)</label><div class="pay-upload" id="payUploadBox"><input type="file" id="payProofInput" accept="image/*"><strong>Tap to upload screenshot</strong><span>JPG / PNG</span><img class="pay-preview" id="payProofPreview" alt=""></div></div><div class="pay-actions"><button type="button" class="btn btn-primary btn-block btn-submit-pay" id="paySubmitBtn" disabled>Submit payment</button><button type="button" class="btn btn-ghost btn-block" id="payBackBtn">Back to QR</button></div></div></div>';
  (document.body || document.documentElement).appendChild(overlay);
  const tick = () => {
    const left = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    const m = String(Math.floor(left / 60)).padStart(2, '0'), s = String(left % 60).padStart(2, '0');
    const el = document.getElementById('payTimer');
    if (el) el.textContent = left > 0 ? (m + ':' + s + ' left') : 'Expired';
    if (left <= 0 && paySheetTimer) clearInterval(paySheetTimer);
  };
  tick(); paySheetTimer = setInterval(tick, 1000);
  let proofDataUrl = '';
  const updateSubmit = () => {
    const utr = (document.getElementById('payUtrInput')?.value || '').replace(/\D/g, '');
    const btn = document.getElementById('paySubmitBtn');
    if (btn) btn.disabled = !(utr.length === 12 && proofDataUrl);
  };
  document.getElementById('payCloseBtn')?.addEventListener('click', closePaySheet);
  document.getElementById('payCompletedBtn')?.addEventListener('click', () => {
    document.getElementById('payStep1').style.display = 'none';
    document.getElementById('payStep2').style.display = 'block';
  });
  document.getElementById('payBackBtn')?.addEventListener('click', () => {
    document.getElementById('payStep2').style.display = 'none';
    document.getElementById('payStep1').style.display = 'block';
  });
  document.getElementById('payUtrInput')?.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 12);
    updateSubmit();
  });
  document.getElementById('payProofInput')?.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) { showToast('Image max 1.5MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      proofDataUrl = String(reader.result || '');
      const img = document.getElementById('payProofPreview');
      if (img) { img.src = proofDataUrl; img.style.display = 'block'; }
      updateSubmit();
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('paySubmitBtn')?.addEventListener('click', async () => {
    const utr = (document.getElementById('payUtrInput')?.value || '').replace(/\D/g, '');
    if (utr.length !== 12 || !proofDataUrl) { showToast('UTR (12 digit) + screenshot required', 'error'); return; }
    const btn = document.getElementById('paySubmitBtn'); btn.disabled = true; btn.textContent = 'Submitting...';
    try {
      const { ok, data } = await walletApiCall('/deposit', 'POST', {
        orderId: orderId, utr: utr, proofImage: proofDataUrl,
        qrLabel: payment.label || payment.upiId || null, upiId: payment.upiId || null
      });
      if (ok && data?.success) {
        showToast('Payment submitted — verifying automatically', 'success');
        closePaySheet();
        loadDashboard();
      } else {
        showToast(data?.message || 'Submit failed', 'error');
        btn.disabled = false; btn.textContent = 'Submit payment';
      }
    } catch (err) {
      showToast('Network error', 'error');
      btn.disabled = false; btn.textContent = 'Submit payment';
    }
  });
}
window.showPaymentSheet = showPaymentSheet;

async function buyOrder(orderId) {
  if (!orderId || buyingOrderId) return;
  buyingOrderId = orderId;
  const btn = document.querySelector('[data-buy="' + orderId + '"]');
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  showToast('Buying order...');
  try {
    const { ok, data } = await walletApiCall('/orders/' + encodeURIComponent(orderId) + '/claim', 'POST');
    if (ok && data?.success) {
      document.querySelectorAll('.order-card[data-order-id="' + orderId + '"]').forEach(el => el.remove());
      const ord = data.order || {}, pay = data.payment || {};
      const amount = pay.amount != null ? pay.amount : ord.amount;
      const upiId = pay.upiId || ord.upiId || '';
      const expiresAt = pay.expiresAt || ord.expiresAt || null;
      const paymentUri = pay.paymentUri || (upiId ? ('upi://pay?pa=' + encodeURIComponent(upiId) + '&pn=PuppyPay&am=' + Number(amount || 0).toFixed(2) + '&cu=INR&tn=' + encodeURIComponent(orderId)) : '');
      const qrImageUrl = pay.qrImageUrl || (paymentUri ? ('https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=' + encodeURIComponent(paymentUri)) : '');
      if (amount == null || amount === '') showToast('Order secured but amount missing. Try another order.', 'error');
      else if (!upiId) showToast('Payment methods temporarily unavailable. Please try again shortly.', 'error');
      else {
        showPaymentSheet({ orderId: pay.orderId || ord.orderId || orderId, amount: amount, upiId: upiId, label: pay.label || ord.qrLabel || upiId, paymentUri: paymentUri, qrImageUrl: qrImageUrl, expiresAt: expiresAt, validMinutes: pay.validMinutes || 10 });
        showToast('Pay exact amount — 10 min', 'success');
      }
      loadDashboard(); setTimeout(() => loadOrders(true, false), 400);
    } else {
      const code = data?.code || '';
      if (code === 'ORDER_MISSED' || code === 'ORDER_UNAVAILABLE') {
        showToast(data?.message || 'Order missed! Try another.', 'error');
        document.querySelectorAll('.order-card[data-order-id="' + orderId + '"]').forEach(el => el.remove());
      } else if (code === 'NO_UPI_POOL') {
        showToast('Payment methods temporarily unavailable. Please try again shortly.', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Buy'; }
      } else {
        showToast(data?.message || 'Failed to buy', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Buy'; }
      }
      setTimeout(() => loadOrders(true, false), 600);
    }
  } catch (e) {
    showToast('Network error', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Buy'; }
  } finally { buyingOrderId = null; }
}
window.buyOrder = buyOrder; window.claimOrder = buyOrder;
document.getElementById('ordersList')?.addEventListener('click', (e) => { const btn = e.target.closest('[data-buy]'); if (btn) buyOrder(btn.getAttribute('data-buy')); });
document.getElementById('rechargeBtn')?.addEventListener('click', () => showView('orders'));
document.getElementById('sellBtn')?.addEventListener('click', () => { showView('withdraw'); });
